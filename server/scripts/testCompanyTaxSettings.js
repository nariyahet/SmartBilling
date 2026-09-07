const assert = require("assert");
const path = require("path");
const { spawn } = require("child_process");
const db = require(path.resolve(__dirname, "../config/db"));

const BASE_URL = "http://localhost:5000/api";
let serverProcess = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startServerIfNeeded = async () => {
  try {
    const res = await fetch(`${BASE_URL}/auth/me`);
    if (res.status === 401 || res.status === 200) {
      console.log("ℹ️ Server is already running on port 5000.");
      return;
    }
  } catch {
    console.log("🚀 Starting local backend server for automated tests...");
    serverProcess = spawn("node", ["server.js"], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
    });

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`${BASE_URL}/auth/me`);
        if (res.status === 401 || res.status === 200) {
          console.log("✅ Local server is online and ready.");
          return;
        }
      } catch {}
    }
    throw new Error("Failed to start server within timeout");
  }
};

const cleanupCompany2TestRecords = async (pdb) => {
  // Clean up any test entities created during test
  const [testInvoices] = await pdb.query(
    "SELECT id FROM invoices WHERE company_id = 2 AND invoice_no LIKE 'INV-TAX-%'"
  );
  for (const inv of testInvoices) {
    await pdb.query("DELETE FROM invoice_items WHERE invoice_id = ?", [inv.id]);
    await pdb.query("DELETE FROM invoices WHERE id = ?", [inv.id]);
  }
  await pdb.query("DELETE FROM products WHERE company_id = 2 AND name LIKE 'Test Tax Product%'");
  await pdb.query("DELETE FROM customers WHERE company_id = 2 AND name LIKE 'Test Tax Customer%'");
};

const runAllTests = async () => {
  console.log("=================================================================");
  console.log("🧪 SMARTBILLING: COMPANY-SPECIFIC GST/TAX AUTOMATED TEST SUITE");
  console.log("=================================================================\n");

  await startServerIfNeeded();
  const pdb = db.promise();

  try {
    // Record historical invoice snapshots before running test
    const [historicalInvoicesBefore] = await pdb.query(
      "SELECT id, invoice_no, company_id, subtotal, tax_percent, tax_amount, grand_total FROM invoices WHERE company_id = 1 ORDER BY id ASC"
    );

    // 1. Authenticate Demo Admin (Company 1)
    console.log("Authenticating Demo Admin (Company 1)...");
    const demoLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo@smartbilling.com",
        password: "Demo@12345",
      }),
    });
    assert.strictEqual(demoLoginRes.status, 200, "Demo login failed");
    const demoToken = (await demoLoginRes.json()).data.token;
    const demoHeaders = {
      Authorization: `Bearer ${demoToken}`,
      "Content-Type": "application/json",
    };

    // 2. Authenticate Primary Admin (Company 2)
    console.log("Authenticating Primary Admin (Company 2)...");
    const mainLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@gmail.com",
        password: "admin123",
      }),
    });
    assert.strictEqual(mainLoginRes.status, 200, "Main admin login failed");
    const mainToken = (await mainLoginRes.json()).data.token;
    const mainHeaders = {
      Authorization: `Bearer ${mainToken}`,
      "Content-Type": "application/json",
    };

    // Clean up any leftovers
    await cleanupCompany2TestRecords(pdb);

    // Save initial Company 2 settings for restoration later
    const [initSettingsRows] = await pdb.query(
      "SELECT * FROM business_settings WHERE company_id = 2"
    );
    const initialComp2Settings = initSettingsRows[0];

    // TEST A: Existing businesses default to tax_enabled = true
    console.log("\n--- TEST A: Existing businesses default to tax_enabled = true ---");
    const getDemoSettings = await fetch(`${BASE_URL}/business-settings`, { headers: demoHeaders });
    const demoSettingsData = await getDemoSettings.json();
    assert.strictEqual(demoSettingsData.success, true);
    assert.strictEqual(
      demoSettingsData.settings.tax_enabled,
      true,
      "Demo company must default to tax_enabled = true"
    );

    const getMainSettings = await fetch(`${BASE_URL}/business-settings`, { headers: mainHeaders });
    const mainSettingsData = await getMainSettings.json();
    assert.strictEqual(mainSettingsData.success, true);
    assert.strictEqual(
      mainSettingsData.settings.tax_enabled,
      true,
      "Main company must default to tax_enabled = true"
    );
    console.log("✅ TEST A PASSED: Both existing businesses default to tax_enabled = true.");

    // TEST B: Business can turn tax OFF
    console.log("\n--- TEST B: Business can turn tax OFF ---");
    const turnOffRes = await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({
        tax_enabled: false,
      }),
    });
    const turnOffData = await turnOffRes.json();
    assert.strictEqual(turnOffRes.status, 200);
    assert.strictEqual(turnOffData.settings.tax_enabled, false);

    // Confirm in DB
    const [dbCheckOff] = await pdb.query(
      "SELECT tax_enabled FROM business_settings WHERE company_id = 2"
    );
    assert.strictEqual(Boolean(dbCheckOff[0].tax_enabled), false);
    console.log("✅ TEST B PASSED: Company 2 successfully turned tax OFF (tax_enabled = false).");

    // TEST C: Business can turn tax ON
    console.log("\n--- TEST C: Business can turn tax ON ---");
    const turnOnRes = await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({
        tax_enabled: true,
      }),
    });
    const turnOnData = await turnOnRes.json();
    assert.strictEqual(turnOnRes.status, 200);
    assert.strictEqual(turnOnData.settings.tax_enabled, true);
    console.log("✅ TEST C PASSED: Company 2 successfully turned tax ON (tax_enabled = true).");

    // TEST D & E: Turning OFF does not delete saved tax number or percentage
    console.log("\n--- TEST D & E: Turning OFF preserves saved tax number and percentage ---");
    // First, configure a specific tax number and tax rate
    await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({
        tax_number: "24TESTTAX9999Z1",
        default_tax_percent: 18.0,
        tax_enabled: true,
      }),
    });

    // Now turn tax OFF
    const turnOffAgainRes = await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({
        tax_enabled: false,
      }),
    });
    const turnOffAgainData = await turnOffAgainRes.json();
    assert.strictEqual(turnOffAgainData.settings.tax_enabled, false);
    assert.strictEqual(
      turnOffAgainData.settings.tax_number,
      "24TESTTAX9999Z1",
      "Saved tax_number must not be wiped when turning OFF"
    );
    assert.strictEqual(
      Number(turnOffAgainData.settings.default_tax_percent),
      18,
      "Saved default_tax_percent must not be wiped when turning OFF"
    );

    // Confirm in DB directly
    const [dbPreserved] = await pdb.query(
      "SELECT tax_number, default_tax_percent, tax_enabled FROM business_settings WHERE company_id = 2"
    );
    assert.strictEqual(dbPreserved[0].tax_number, "24TESTTAX9999Z1");
    assert.strictEqual(Number(dbPreserved[0].default_tax_percent), 18);
    assert.strictEqual(Boolean(dbPreserved[0].tax_enabled), false);
    console.log("✅ TEST D & E PASSED: Saved tax number and rate remain stored when tax is turned OFF.");

    // Setup a customer and product for Company 2
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: "POST",
      headers: mainHeaders,
      body: JSON.stringify({
        name: "Test Tax Customer",
        mobile: "9988776655",
        email: "testcust@example.com",
      }),
    });
    const testCustId = (await custRes.json()).customer.id;

    const prodRes = await fetch(`${BASE_URL}/products`, {
      method: "POST",
      headers: mainHeaders,
      body: JSON.stringify({
        name: "Test Tax Product",
        price: 1000.0,
        stock: 50,
      }),
    });
    const testProdId = (await prodRes.json()).productId;

    // TEST F: Tax calculation is 0 when disabled
    console.log("\n--- TEST F & I: Tax calculation is 0 and Grand Total is Subtotal - Discount ---");
    // Ensure tax is OFF
    await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({ tax_enabled: false }),
    });

    const createInvOffRes = await fetch(`${BASE_URL}/invoices`, {
      method: "POST",
      headers: mainHeaders,
      body: JSON.stringify({
        invoice_no: "INV-TAX-001",
        customer_id: testCustId,
        items: [{ product_id: testProdId, quantity: 2 }], // 2 * 1000 = 2000
        discount_percent: 10, // 10% discount = 200, afterDiscount = 1800
      }),
    });
    const invOffData = await createInvOffRes.json();
    assert.strictEqual(createInvOffRes.status, 201);
    assert.strictEqual(Number(invOffData.invoice.subtotal), 2000);
    assert.strictEqual(Number(invOffData.invoice.discount_amount), 200);
    assert.strictEqual(Number(invOffData.invoice.tax_percent), 0);
    assert.strictEqual(Number(invOffData.invoice.tax_amount), 0);
    assert.strictEqual(Number(invOffData.invoice.grand_total), 1800);
    console.log("✅ TEST F & I PASSED: Invoice tax is 0 and grand_total equals subtotal - discount.");

    // TEST G: Backend ignores a malicious tax_percent when tax is disabled
    console.log("\n--- TEST G: Backend ignores malicious tax_percent when tax is disabled ---");
    const maliciousInvRes = await fetch(`${BASE_URL}/invoices`, {
      method: "POST",
      headers: mainHeaders,
      body: JSON.stringify({
        invoice_no: "INV-TAX-002",
        customer_id: testCustId,
        items: [{ product_id: testProdId, quantity: 1 }], // 1000
        discount_percent: 0,
        tax_percent: 18, // Malicious client explicitly sending 18% when tax is disabled!
      }),
    });
    const maliciousInvData = await maliciousInvRes.json();
    assert.strictEqual(maliciousInvRes.status, 201);
    assert.strictEqual(
      Number(maliciousInvData.invoice.tax_percent),
      0,
      "Backend must enforce tax_percent = 0 when tax is disabled"
    );
    assert.strictEqual(
      Number(maliciousInvData.invoice.tax_amount),
      0,
      "Backend must enforce tax_amount = 0 when tax is disabled"
    );
    assert.strictEqual(
      Number(maliciousInvData.invoice.grand_total),
      1000,
      "Grand total must not include any tax when tax is disabled"
    );

    // Verify in DB directly
    const [dbInv] = await pdb.query("SELECT * FROM invoices WHERE invoice_no = 'INV-TAX-002'");
    assert.strictEqual(Number(dbInv[0].tax_percent), 0);
    assert.strictEqual(Number(dbInv[0].tax_amount), 0);
    assert.strictEqual(Number(dbInv[0].grand_total), 1000);
    console.log("✅ TEST G PASSED: Malicious tax_percent: 18 was strictly neutralized by backend to 0.");

    // TEST H & J: Tax calculation works normally when enabled
    console.log("\n--- TEST H & J: Tax calculation and Grand Total work normally when tax is ON ---");
    // Turn tax ON
    await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({ tax_enabled: true, default_tax_percent: 18 }),
    });

    const createInvOnRes = await fetch(`${BASE_URL}/invoices`, {
      method: "POST",
      headers: mainHeaders,
      body: JSON.stringify({
        invoice_no: "INV-TAX-003",
        customer_id: testCustId,
        items: [{ product_id: testProdId, quantity: 2 }], // 2000
        discount_percent: 10, // discount 200 -> afterDiscount 1800
        tax_percent: 18, // 18% of 1800 = 324 -> grandTotal = 2124
      }),
    });
    const invOnData = await createInvOnRes.json();
    assert.strictEqual(createInvOnRes.status, 201);
    assert.strictEqual(Number(invOnData.invoice.subtotal), 2000);
    assert.strictEqual(Number(invOnData.invoice.discount_amount), 200);
    assert.strictEqual(Number(invOnData.invoice.tax_percent), 18);
    assert.strictEqual(Number(invOnData.invoice.tax_amount), 324);
    assert.strictEqual(Number(invOnData.invoice.grand_total), 2124);
    console.log("✅ TEST H & J PASSED: Invoice tax and grand_total calculate normally when tax is ON.");

    // TEST K: Invoice creation remains atomic
    console.log("\n--- TEST K: Invoice creation atomicity and rollback ---");
    const [prodBefore] = await pdb.query("SELECT stock FROM products WHERE id = ?", [testProdId]);
    const stockBefore = Number(prodBefore[0].stock);

    // Attempt creation with excessive quantity to cause failure
    const failedInvRes = await fetch(`${BASE_URL}/invoices`, {
      method: "POST",
      headers: mainHeaders,
      body: JSON.stringify({
        customer_id: testCustId,
        items: [{ product_id: testProdId, quantity: 99999 }], // exceeds stock
      }),
    });
    assert.strictEqual(failedInvRes.status, 400);

    // Verify stock was not decremented
    const [prodAfter] = await pdb.query("SELECT stock FROM products WHERE id = ?", [testProdId]);
    assert.strictEqual(Number(prodAfter[0].stock), stockBefore);
    console.log("✅ TEST K PASSED: Invoice transaction remained atomic and rolled back cleanly.");

    // TEST L & M & N: Multi-tenant isolation between Demo Company & Admin Company
    console.log("\n--- TEST L, M & N: Multi-Tenant Settings Isolation ---");
    // Company 2 turns tax OFF
    await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({ tax_enabled: false }),
    });

    // Verify Company 2 settings have tax_enabled = false
    const comp2Check = await (await fetch(`${BASE_URL}/business-settings`, { headers: mainHeaders })).json();
    assert.strictEqual(comp2Check.settings.tax_enabled, false);

    // Verify Demo Company (Company 1) settings were NOT affected and remain tax_enabled = true!
    const comp1Check = await (await fetch(`${BASE_URL}/business-settings`, { headers: demoHeaders })).json();
    assert.strictEqual(
      comp1Check.settings.tax_enabled,
      true,
      "Demo Company settings must NOT be changed by Company 2's action"
    );

    console.log("✅ TEST L, M & N PASSED: Tenant tax settings are strictly isolated per company_id.");

    // TEST O: Historical invoices are not modified
    console.log("\n--- TEST O: Historical invoices integrity ---");
    const [historicalInvoicesAfter] = await pdb.query(
      "SELECT id, invoice_no, company_id, subtotal, tax_percent, tax_amount, grand_total FROM invoices WHERE company_id = 1 ORDER BY id ASC"
    );
    assert.strictEqual(
      historicalInvoicesAfter.length,
      historicalInvoicesBefore.length,
      "Historical invoice count must be identical"
    );
    for (let i = 0; i < historicalInvoicesBefore.length; i++) {
      const b = historicalInvoicesBefore[i];
      const a = historicalInvoicesAfter[i];
      assert.strictEqual(a.id, b.id);
      assert.strictEqual(a.invoice_no, b.invoice_no);
      assert.strictEqual(Number(a.subtotal), Number(b.subtotal));
      assert.strictEqual(Number(a.tax_percent), Number(b.tax_percent));
      assert.strictEqual(Number(a.tax_amount), Number(b.tax_amount));
      assert.strictEqual(Number(a.grand_total), Number(b.grand_total));
    }
    console.log("✅ TEST O PASSED: All historical invoices remain completely untouched.");

    // TEST P: Authentication and trial protections still work
    console.log("\n--- TEST P: Authentication and validation protections ---");
    // Unauthenticated request to /business-settings
    const unauthRes = await fetch(`${BASE_URL}/business-settings`);
    assert.strictEqual(unauthRes.status, 401, "Unauthenticated GET /business-settings must return 401");

    // Invalid tax_enabled value
    const invalidValRes = await fetch(`${BASE_URL}/business-settings`, {
      method: "PUT",
      headers: mainHeaders,
      body: JSON.stringify({ tax_enabled: "not-a-boolean" }),
    });
    assert.strictEqual(invalidValRes.status, 400, "Invalid tax_enabled must return 400");
    const invalidData = await invalidValRes.json();
    assert.strictEqual(invalidData.message, "tax_enabled must be a boolean");
    console.log("✅ TEST P PASSED: Authentication (401) and strict validation (400) are enforced.");

    // Clean up test records
    console.log("\nCleaning up temporary test entities...");
    await cleanupCompany2TestRecords(pdb);

    // Restore Company 2 settings
    if (initialComp2Settings) {
      await pdb.query(
        `UPDATE business_settings SET
          business_name = ?,
          tax_number = ?,
          default_tax_percent = ?,
          tax_enabled = ?
         WHERE company_id = 2`,
        [
          initialComp2Settings.business_name,
          initialComp2Settings.tax_number,
          initialComp2Settings.default_tax_percent,
          initialComp2Settings.tax_enabled !== null ? initialComp2Settings.tax_enabled : 1,
        ]
      );
    }
    console.log("✅ Test environment cleaned and restored.");

    console.log("\n🎉 ALL 16 AUTOMATED TESTS (A THROUGH P) PASSED SUCCESSFULLY!");
  } finally {
    if (serverProcess) {
      console.log("Stopping temporary test server process...");
      serverProcess.kill();
    }
    db.end();
  }
};

runAllTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
  try {
    db.end();
  } catch {}
  process.exit(1);
});
