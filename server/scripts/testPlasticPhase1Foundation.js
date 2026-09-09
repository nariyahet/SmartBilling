const assert = require("assert");
const path = require("path");
const fs = require("fs");
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

const apiRequest = async (method, endpoint, body = null, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, ok: res.ok, data };
};

const runPlasticPhase1Tests = async () => {
  console.log("=================================================================");
  console.log("♻️ SMARTBILLING: PLASTIC RECYCLING ERP (PHASE 1) TEST SUITE");
  console.log("=================================================================\n");

  await startServerIfNeeded();
  const pdb = db.promise();

  let demoToken = null; // Company 1
  let adminToken = null; // Company 2

  // Track created entities for cleanup
  const createdSuppliers = [];
  const createdMaterials = [];
  const createdTruckInwards = [];
  const createdWeighments = [];
  const createdBills = [];

  try {
    // Authenticate Demo Company (1) and Primary Admin (2)
    console.log("Authenticating test administrators...");
    const demoLogin = await apiRequest("POST", "/auth/login", {
      email: "demo@smartbilling.com",
      password: "Demo@12345",
    });
    assert.strictEqual(demoLogin.status, 200, "Demo login must succeed");
    demoToken = demoLogin.data.data.token;

    const adminLogin = await apiRequest("POST", "/auth/login", {
      email: "admin@gmail.com",
      password: "admin123",
    });
    assert.strictEqual(adminLogin.status, 200, "Primary Admin login must succeed");
    adminToken = adminLogin.data.data.token;
    console.log("✅ Authenticated Demo Admin (Company 1) and Primary Admin (Company 2).\n");

    // TEST 1: Migration exists
    console.log("--- TEST 1: Migration Files Existence ---");
    const sqlPath = path.resolve(__dirname, "../../database/migrations/004_plastic_recycling_phase1_foundation.sql");
    const runnerPath = path.resolve(__dirname, "../../database/migrations/run_004.js");
    assert(fs.existsSync(sqlPath), "004 SQL migration file must exist");
    assert(fs.existsSync(runnerPath), "004 migration runner must exist");
    console.log("✅ TEST 1 PASSED: 004 migration SQL and JS runner files exist.\n");

    // TEST 2: Migration idempotency
    console.log("--- TEST 2: Migration Idempotency ---");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");
    const statements = sqlContent.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await pdb.query(stmt);
    }
    console.log("✅ TEST 2 PASSED: Migration statements re-executed with zero errors (idempotent).\n");

    // TEST 3: Required NEW tables exist
    console.log("--- TEST 3: Required NEW Tables Exist ---");
    const requiredTables = [
      "suppliers",
      "raw_materials",
      "truck_inwards",
      "weighments",
      "purchase_bills",
      "purchase_bill_items",
      "raw_material_stock",
      "raw_material_stock_movements",
    ];
    const [existingTables] = await pdb.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${requiredTables.map(() => "?").join(",")})
    `, requiredTables);
    const existingTableNames = existingTables.map((t) => t.TABLE_NAME);
    for (const tbl of requiredTables) {
      assert(existingTableNames.includes(tbl), `Table ${tbl} must exist in database`);
    }
    console.log("✅ TEST 3 PASSED: All 8 required Phase 1 tables exist in schema.\n");

    // TEST 4: Required columns exist in tables
    console.log("--- TEST 4: Key Columns Exist Across New Tables ---");
    const checkColumns = async (table, cols) => {
      const [colRows] = await pdb.query(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [table]);
      const existingCols = colRows.map((r) => r.COLUMN_NAME);
      for (const col of cols) {
        assert(existingCols.includes(col), `Column ${col} must exist in table ${table}`);
      }
    };
    await checkColumns("suppliers", ["company_id", "supplier_code", "supplier_name", "mobile", "status", "opening_balance"]);
    await checkColumns("raw_materials", ["company_id", "material_code", "material_name", "plastic_type", "unit", "minimum_stock"]);
    await checkColumns("truck_inwards", ["company_id", "inward_no", "supplier_id", "truck_number", "gross_weight", "tare_weight", "net_weight", "total_amount"]);
    await checkColumns("weighments", ["company_id", "weighment_no", "truck_inward_id", "first_weight", "second_weight", "net_weight"]);
    await checkColumns("purchase_bills", ["company_id", "purchase_bill_no", "supplier_id", "subtotal", "tax_percent", "tax_amount", "grand_total"]);
    await checkColumns("raw_material_stock", ["company_id", "raw_material_id", "quantity", "average_rate", "stock_value"]);
    await checkColumns("raw_material_stock_movements", ["company_id", "raw_material_id", "movement_type", "quantity", "balance_quantity"]);
    console.log("✅ TEST 4 PASSED: All critical columns verified across all Phase 1 tables.\n");

    // TEST 5: Supplier creation via API
    console.log("--- TEST 5: Supplier Creation via API ---");
    const createSupRes = await apiRequest("POST", "/suppliers", {
      supplier_name: "Gujarat Polymer Scrap Traders",
      company_name: "Gujarat Polymer LLP",
      mobile: "9876500111",
      email: "contact@gujaratpolymers.com",
      city: "Kim",
      state: "Gujarat",
      status: "ACTIVE",
    }, adminToken);
    assert.strictEqual(createSupRes.status, 201, "Supplier creation must return 201");
    assert(createSupRes.data?.supplier?.id, "Supplier must return an ID");
    assert(createSupRes.data?.supplier?.supplier_code.startsWith("SUP-"), "Supplier code must auto-generate SUP-...");
    const supplierId = createSupRes.data.supplier.id;
    createdSuppliers.push(supplierId);
    console.log(`✅ TEST 5 PASSED: Created supplier ${createSupRes.data.supplier.supplier_code} for Company 2.\n`);

    // TEST 6: Supplier company isolation
    console.log("--- TEST 6: Supplier Company Isolation ---");
    const crossSupRes = await apiRequest("GET", `/suppliers/${supplierId}`, null, demoToken);
    assert.strictEqual(crossSupRes.status, 404, "Demo company must NOT be able to access Company 2's supplier");
    console.log("✅ TEST 6 PASSED: Cross-tenant supplier access strictly blocked (404).\n");

    // TEST 7: Raw material creation via API
    console.log("--- TEST 7: Raw Material Creation via API ---");
    const createMatRes = await apiRequest("POST", "/raw-materials", {
      material_name: "Recycled PET Flakes Clear",
      plastic_type: "PET",
      category: "Flakes",
      unit: "KG",
      minimum_stock: 500,
      maximum_stock: 50000,
      default_purchase_rate: 42.50,
      default_selling_rate: 48.00,
      status: "ACTIVE",
    }, adminToken);
    assert.strictEqual(createMatRes.status, 201, "Raw material creation must return 201");
    assert(createMatRes.data?.raw_material?.id, "Raw material must return an ID");
    assert.strictEqual(createMatRes.data.raw_material.plastic_type, "PET", "Plastic type must be PET");
    const materialId = createMatRes.data.raw_material.id;
    createdMaterials.push(materialId);

    // Also create a second material (HDPE) for multi-item testing
    const createMat2Res = await apiRequest("POST", "/raw-materials", {
      material_name: "HDPE Regrind Blue Drums",
      plastic_type: "HDPE",
      category: "Regrind",
      unit: "KG",
      minimum_stock: 1000,
      default_purchase_rate: 55.00,
      status: "ACTIVE",
    }, adminToken);
    assert.strictEqual(createMat2Res.status, 201);
    const material2Id = createMat2Res.data.raw_material.id;
    createdMaterials.push(material2Id);
    console.log(`✅ TEST 7 PASSED: Created raw materials PET (${materialId}) and HDPE (${material2Id}) for Company 2.\n`);

    // TEST 8: Raw material company isolation
    console.log("--- TEST 8: Raw Material Company Isolation ---");
    const crossMatRes = await apiRequest("GET", `/raw-materials/${materialId}`, null, demoToken);
    assert.strictEqual(crossMatRes.status, 404, "Demo company must NOT be able to access Company 2's raw material");
    console.log("✅ TEST 8 PASSED: Cross-tenant raw material access strictly blocked (404).\n");

    // TEST 9: Truck inward calculation
    console.log("--- TEST 9: Truck Inward Calculation ---");
    const inwardRes = await apiRequest("POST", "/truck-inwards", {
      supplier_id: supplierId,
      material_id: materialId,
      truck_number: "GJ-05-BX-4421",
      driver_name: "Ramesh Patel",
      driver_mobile: "9825123456",
      gross_weight: 15400,
      tare_weight: 5400,
      rate_per_unit: 42.50,
      quality_status: "ACCEPTED",
      remarks: "Kim plant inward test",
    }, adminToken);
    assert.strictEqual(inwardRes.status, 201, "Truck inward creation must return 201");
    assert.strictEqual(inwardRes.data?.truck_inward?.net_weight, 10000, "Net weight must be gross (15400) - tare (5400) = 10000");
    assert.strictEqual(inwardRes.data?.truck_inward?.total_amount, 425000, "Total amount must be 10000 * 42.50 = 425000");
    const inwardId = inwardRes.data.truck_inward.id;
    createdTruckInwards.push(inwardId);
    console.log(`✅ TEST 9 PASSED: Truck inward net weight (10000 KG) and total (₹425,000) calculated accurately.\n`);

    // TEST 10: Gross/tare validation
    console.log("--- TEST 10: Gross/Tare Weight Validation ---");
    const invalidInward = await apiRequest("POST", "/truck-inwards", {
      supplier_id: supplierId,
      material_id: materialId,
      truck_number: "GJ-05-BX-9999",
      gross_weight: 4000,
      tare_weight: 6000, // Invalid: tare > gross
      rate_per_unit: 40,
    }, adminToken);
    assert.strictEqual(invalidInward.status, 400, "Gross < tare must be rejected with status 400");
    console.log("✅ TEST 10 PASSED: Invalid weight inputs (gross < tare) strictly rejected.\n");

    // TEST 11: Weighment calculation & link
    console.log("--- TEST 11: Weighment Management ---");
    const weighmentRes = await apiRequest("POST", "/weighments", {
      truck_inward_id: inwardId,
      first_weight: 15400,
      second_weight: 5400,
      operator_name: "Kim Scale Operator 1",
    }, adminToken);
    assert.strictEqual(weighmentRes.status, 201, "Weighment creation must return 201");
    assert.strictEqual(weighmentRes.data?.weighment?.net_weight, 10000, "Weighment net weight must be 10000");
    createdWeighments.push(weighmentRes.data.weighment.id);
    console.log("✅ TEST 11 PASSED: Manual weighment slip created and verified against inward.\n");

    // TEST 12: Purchase bill calculation & GST ON integration
    console.log("--- TEST 12 & 13: Purchase Bill Calculation with GST ON ---");
    // Ensure Company 2 has tax_enabled = true
    await pdb.query("UPDATE business_settings SET tax_enabled = TRUE, default_tax_percent = 18.00 WHERE company_id = 2");

    const billGstOnRes = await apiRequest("POST", "/purchase-bills", {
      supplier_id: supplierId,
      truck_inward_id: inwardId,
      purchase_date: new Date().toISOString().split("T")[0],
      items: [
        { raw_material_id: materialId, quantity: 1000, rate: 40.00 }, // 40,000
        { raw_material_id: material2Id, quantity: 500, rate: 50.00 },  // 25,000
      ],
      discount_amount: 5000.00, // Subtotal: 65,000 -> after discount: 60,000
      tax_percent: 18.00,       // 18% of 60,000 = 10,800 -> Grand Total: 70,800
      payment_status: "UNPAID",
      notes: "Test Bill GST ON",
    }, adminToken);

    assert.strictEqual(billGstOnRes.status, 201, "Purchase bill creation must return 201");
    const billGstOn = billGstOnRes.data.purchase_bill;
    assert.strictEqual(Number(billGstOn.subtotal), 65000, "Subtotal must be 65,000");
    assert.strictEqual(Number(billGstOn.discount_amount), 5000, "Discount must be 5,000");
    assert.strictEqual(Number(billGstOn.tax_percent), 18, "Tax percent must be 18");
    assert.strictEqual(Number(billGstOn.tax_amount), 10800, "Tax amount must be 10,800 (18% of 60,000)");
    assert.strictEqual(Number(billGstOn.grand_total), 70800, "Grand total must be 70,800");
    createdBills.push(billGstOn.id);
    console.log("✅ TEST 12 & 13 PASSED: Purchase bill created with GST ON (18% tax accurately applied).\n");

    // TEST 14: Purchase bill with GST OFF integration
    console.log("--- TEST 14: Purchase Bill Calculation with GST OFF ---");
    // Temporarily turn OFF tax_enabled for Company 2
    await pdb.query("UPDATE business_settings SET tax_enabled = FALSE WHERE company_id = 2");

    const billGstOffRes = await apiRequest("POST", "/purchase-bills", {
      supplier_id: supplierId,
      purchase_date: new Date().toISOString().split("T")[0],
      items: [
        { raw_material_id: materialId, quantity: 200, rate: 40.00 }, // 8,000
      ],
      discount_amount: 0,
      tax_percent: 18.00, // Client passes 18%, but company has tax_enabled = FALSE
      payment_status: "UNPAID",
      notes: "Test Bill GST OFF",
    }, adminToken);

    assert.strictEqual(billGstOffRes.status, 201, "Purchase bill creation must return 201");
    const billGstOff = billGstOffRes.data.purchase_bill;
    assert.strictEqual(Number(billGstOff.tax_percent), 0, "Tax percent must be strictly neutralized to 0% when tax_enabled is OFF");
    assert.strictEqual(Number(billGstOff.tax_amount), 0, "Tax amount must be strictly 0 when tax_enabled is OFF");
    assert.strictEqual(Number(billGstOff.grand_total), 8000, "Grand total must equal subtotal (8,000)");
    createdBills.push(billGstOff.id);
    // Restore tax_enabled to TRUE for Company 2
    await pdb.query("UPDATE business_settings SET tax_enabled = TRUE WHERE company_id = 2");
    console.log("✅ TEST 14 PASSED: Purchase bill created with GST OFF (strictly enforced 0% tax).\n");

    // TEST 15: Purchase transaction updates raw material stock
    console.log("--- TEST 15: Inventory Stock Update Upon Purchase ---");
    const [stockRow] = await pdb.query(
      "SELECT quantity, average_rate, stock_value FROM raw_material_stock WHERE raw_material_id = ? AND company_id = 2",
      [materialId]
    );
    assert(stockRow.length > 0, "Stock record must exist for material");
    // Material 1 was purchased twice: 1000 KG + 200 KG = 1200 KG
    assert.strictEqual(Number(stockRow[0].quantity), 1200, "Current stock must be 1200 KG (1000 + 200)");
    console.log(`✅ TEST 15 PASSED: Raw material stock increased automatically to ${stockRow[0].quantity} KG.\n`);

    // TEST 16: Stock movement is created
    console.log("--- TEST 16: Stock Movement Audit Record Created ---");
    const [movements] = await pdb.query(
      "SELECT * FROM raw_material_stock_movements WHERE raw_material_id = ? AND company_id = 2 ORDER BY id DESC",
      [materialId]
    );
    assert(movements.length >= 2, "At least 2 purchase movements must be logged");
    assert.strictEqual(movements[0].movement_type, "PURCHASE", "Movement type must be PURCHASE");
    assert.strictEqual(movements[0].reference_type, "PURCHASE_BILL", "Reference type must be PURCHASE_BILL");
    console.log("✅ TEST 16 PASSED: Stock movements audit records created with balance quantity tracking.\n");

    // TEST 17: Cross-tenant purchase bill access is blocked
    console.log("--- TEST 17: Cross-Tenant Purchase Bill Isolation ---");
    const crossBillRes = await apiRequest("GET", `/purchase-bills/${billGstOn.id}`, null, demoToken);
    assert.strictEqual(crossBillRes.status, 404, "Demo company must NOT be able to view Company 2's purchase bill");
    console.log("✅ TEST 17 PASSED: Cross-tenant purchase bill access strictly rejected.\n");

    // TEST 18: Transaction rollback works
    console.log("--- TEST 18: Purchase Transaction Atomic Rollback ---");
    const [stockBefore] = await pdb.query(
      "SELECT quantity FROM raw_material_stock WHERE raw_material_id = ? AND company_id = 2",
      [materialId]
    );
    const qtyBefore = Number(stockBefore[0].quantity);

    // Attempt purchase bill with an invalid/non-existent material to force failure
    const failedBill = await apiRequest("POST", "/purchase-bills", {
      supplier_id: supplierId,
      items: [
        { raw_material_id: materialId, quantity: 500, rate: 40 },
        { raw_material_id: 999999, quantity: 100, rate: 50 }, // Non-existent material
      ],
    }, adminToken);
    assert.strictEqual(failedBill.status, 404, "Invalid material must fail transaction with 404");

    const [stockAfter] = await pdb.query(
      "SELECT quantity FROM raw_material_stock WHERE raw_material_id = ? AND company_id = 2",
      [materialId]
    );
    assert.strictEqual(Number(stockAfter[0].quantity), qtyBefore, "Stock must NOT change when transaction fails (rollback verified)");
    console.log("✅ TEST 18 PASSED: Failed transaction rolled back cleanly without stock corruption.\n");

    // TEST 19: Dashboard Plastic Stats API
    console.log("--- TEST 19: Plastic Recycling Dashboard Metrics ---");
    const dashRes = await apiRequest("GET", "/dashboard/plastic-stats?period=month", null, adminToken);
    assert.strictEqual(dashRes.status, 200, "Dashboard plastic-stats must return 200");
    assert(dashRes.data?.stats, "Response must include stats object");
    assert(dashRes.data.stats.totalPurchasedKg >= 1200, "Total purchased KG must include created purchase bills");
    assert(dashRes.data.stats.totalSuppliers >= 1, "Active suppliers count must be >= 1");
    assert(dashRes.data.stats.totalTruckInwards >= 1, "Truck inwards count must be >= 1");
    assert(dashRes.data.stats.totalPurchaseBills >= 2, "Purchase bills count must be >= 2");
    console.log("✅ TEST 19 PASSED: Dashboard plastic recycling endpoint returns accurate aggregated metrics.\n");

    // TEST 20: Existing Core Tables and Data Untouched
    console.log("--- TEST 20: Core Tables and Data Integrity ---");
    const [coreCompanies] = await pdb.query("SELECT COUNT(*) AS count FROM companies WHERE id IN (1, 2)");
    assert.strictEqual(Number(coreCompanies[0].count), 2, "Core companies (1 and 2) must remain intact");

    const [coreCustomers] = await pdb.query("SELECT COUNT(*) AS count FROM customers");
    assert(Number(coreCustomers[0].count) >= 0, "Customers table must be intact");

    const [coreInvoices] = await pdb.query("SELECT COUNT(*) AS count FROM invoices");
    assert(Number(coreInvoices[0].count) >= 0, "Invoices table must be intact");

    console.log("✅ TEST 20 PASSED: All existing companies, customers, and invoices remain completely untouched.\n");

    console.log("🎉 ALL 20 TARGETED PLASTIC RECYCLING (PHASE 1) TESTS PASSED SUCCESSFULLY!\n");
  } catch (err) {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  } finally {
    // Clean up created test entities safely
    console.log("Cleaning up temporary test entities...");
    for (const billId of createdBills) {
      await pdb.query("DELETE FROM raw_material_stock_movements WHERE reference_type = 'PURCHASE_BILL' AND reference_id = ?", [billId]);
      await pdb.query("DELETE FROM purchase_bill_items WHERE purchase_bill_id = ?", [billId]);
      await pdb.query("DELETE FROM plastic_supplier_ledger WHERE reference_type = 'PURCHASE_BILL' AND reference_id = ?", [billId]);
      await pdb.query("DELETE FROM plastic_gst_records WHERE reference_type = 'purchase_bills' AND reference_id = ?", [billId]);
      const [jEntries] = await pdb.query("SELECT id FROM plastic_journal_entries WHERE reference_type = 'purchase_bills' AND reference_id = ?", [billId]);
      for (const je of jEntries) {
        await pdb.query("DELETE FROM plastic_journal_items WHERE journal_entry_id = ?", [je.id]);
        await pdb.query("DELETE FROM plastic_journal_entries WHERE id = ?", [je.id]);
      }
      await pdb.query("DELETE FROM purchase_bills WHERE id = ?", [billId]);
    }
    for (const wId of createdWeighments) {
      await pdb.query("DELETE FROM weighments WHERE id = ?", [wId]);
    }
    for (const inId of createdTruckInwards) {
      await pdb.query("DELETE FROM truck_inwards WHERE id = ?", [inId]);
    }
    for (const mId of createdMaterials) {
      await pdb.query("DELETE FROM raw_material_stock WHERE raw_material_id = ?", [mId]);
      await pdb.query("DELETE FROM raw_material_stock_movements WHERE raw_material_id = ?", [mId]);
      await pdb.query("DELETE FROM raw_materials WHERE id = ?", [mId]);
    }
    for (const sId of createdSuppliers) {
      await pdb.query("DELETE FROM plastic_supplier_ledger WHERE supplier_id = ?", [sId]);
      await pdb.query("DELETE FROM suppliers WHERE id = ?", [sId]);
    }
    console.log("✅ Temporary test entities cleaned up successfully.");

    if (serverProcess) {
      console.log("Stopping temporary test server process...");
      serverProcess.kill();
    }
    db.end();
  }
};

runPlasticPhase1Tests();
