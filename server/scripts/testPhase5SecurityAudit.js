require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("../config/db");

const BASE_URL = "http://localhost:5000/api";

const results = [];

function recordTest(testName, passed, details = "") {
  results.push({ testName, passed, details });
  const symbol = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${symbol} - ${testName}${details ? ` (${details})` : ""}`);
}

async function apiRequest(method, endpoint, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

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

  return {
    status: res.status,
    ok: res.ok,
    data,
  };
}

async function runPhase5AuditTests() {
  console.log("==================================================");
  console.log("🔒 Starting SmartBilling Phase 5: Security Audit & Readiness Tests");
  console.log("==================================================\n");

  const pdb = db.promise();

  let tokenA = null;
  let companyIdA = null;
  let adminIdA = null;
  let tokenB = null;
  let companyIdB = null;
  let productAId = null;
  let customerAId = null;
  let invoiceAId = null;

  try {
    // ====================================================
    // 1. AUTHENTICATION SECURITY AUDIT
    // ====================================================
    console.log("--- 1. Authentication Security ---");

    // Register Tenant A
    const regResA = await apiRequest("POST", "/auth/register", {
      company_name: "Audit Tenant Alpha",
      name: "Alpha Admin",
      email: `audit.alpha.${Date.now()}@example.com`,
      password: "SuperSecretPassword123!",
      confirm_password: "SuperSecretPassword123!",
      company_id: 9999, // Attempt arbitrary company_id injection
      is_demo: 1, // Attempt arbitrary is_demo injection
    });

    tokenA = regResA.data?.data?.token;
    companyIdA = regResA.data?.data?.company?.id;
    adminIdA = regResA.data?.data?.admin?.id;

    // Test: Arbitrary company_id and is_demo injection in registration ignored
    const injectionIgnored =
      companyIdA !== 9999 &&
      typeof companyIdA === "number" &&
      regResA.data?.data?.company?.is_demo === 0;

    recordTest(
      "Auth 1: Arbitrary company_id and is_demo injection in register ignored",
      injectionIgnored,
      `Assigned company_id: ${companyIdA}, is_demo: ${regResA.data?.data?.company?.is_demo}`
    );

    // Test: Password hashing verification
    const [adminCheck] = await pdb.query(
      "SELECT password FROM admins WHERE id = ? LIMIT 1",
      [adminIdA]
    );
    const storedHash = adminCheck[0]?.password;
    const isBcrypt = storedHash && storedHash.startsWith("$2");
    const plaintextNotStored = storedHash !== "SuperSecretPassword123!";
    const bcryptValid = await bcrypt.compare("SuperSecretPassword123!", storedHash);

    recordTest(
      "Auth 2: Password hashed with bcrypt (plaintext never stored)",
      isBcrypt && plaintextNotStored && bcryptValid,
      `Starts with $2: ${isBcrypt}, Plaintext absent: ${plaintextNotStored}`
    );

    // Test: Missing token rejected with 401
    const missingTokenRes = await apiRequest("GET", "/dashboard");
    recordTest(
      "Auth 3: Missing authorization header rejected with HTTP 401",
      missingTokenRes.status === 401,
      `Status: ${missingTokenRes.status}`
    );

    // Test: Malformed token rejected with 401
    const malformedTokenRes = await apiRequest("GET", "/dashboard", null, "invalid.malformed.token");
    recordTest(
      "Auth 4: Malformed authorization token rejected with HTTP 401",
      malformedTokenRes.status === 401,
      `Status: ${malformedTokenRes.status}`
    );

    // Test: Invalid login does not enumerate accounts
    const badLoginRes = await apiRequest("POST", "/auth/login", {
      email: "nonexistent.user@example.com",
      password: "WrongPassword123!",
    });
    recordTest(
      "Auth 5: Invalid credentials return 401 without user enumeration",
      badLoginRes.status === 401 && badLoginRes.data?.message === "Invalid email or password",
      `Status: ${badLoginRes.status}, Message: "${badLoginRes.data?.message}"`
    );

    // Test: Duplicate email registration rejected with 409
    const dupEmailRes = await apiRequest("POST", "/auth/register", {
      company_name: "Another Alpha",
      name: "Duplicate Person",
      email: regResA.data?.data?.admin?.email,
      password: "Password123!",
      confirm_password: "Password123!",
    });
    recordTest(
      "Auth 6: Duplicate email rejected with HTTP 409 Conflict",
      dupEmailRes.status === 409,
      `Status: ${dupEmailRes.status}`
    );

    // ====================================================
    // 2. TENANT ISOLATION & IDOR DEFENSE AUDIT
    // ====================================================
    console.log("\n--- 2. Tenant Isolation & IDOR Defense ---");

    // Register Tenant B
    const regResB = await apiRequest("POST", "/auth/register", {
      company_name: "Audit Tenant Bravo",
      name: "Bravo Admin",
      email: `audit.bravo.${Date.now()}@example.com`,
      password: "SuperSecretPassword123!",
      confirm_password: "SuperSecretPassword123!",
    });
    tokenB = regResB.data?.data?.token;
    companyIdB = regResB.data?.data?.company?.id;

    // Create resources under Tenant A
    const prodResA = await apiRequest(
      "POST",
      "/products",
      { name: "Alpha Secure Product", price: 500, stock: 20 },
      tokenA
    );
    productAId = prodResA.data?.productId || prodResA.data?.data?.id;

    const custResA = await apiRequest(
      "POST",
      "/customers",
      { name: "Alpha Private Client", mobile: "9988776655", email: "client@alpha.com" },
      tokenA
    );
    customerAId = custResA.data?.customer?.id;

    const invResA = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 2 }],
        discount_percent: 5,
        tax_percent: 18,
      },
      tokenA
    );
    invoiceAId = invResA.data?.invoice?.id;

    // Test: IDOR Product Read
    const idorProdRead = await apiRequest("GET", `/products/${productAId}`, null, tokenB);
    recordTest(
      "IDOR 1: Tenant B cannot read Tenant A product by ID",
      idorProdRead.status === 404 || !idorProdRead.data?.product,
      `Status: ${idorProdRead.status}`
    );

    // Test: IDOR Product Update
    const idorProdUpdate = await apiRequest(
      "PUT",
      `/products/${productAId}`,
      { name: "Hacked Product", price: 1, stock: 100 },
      tokenB
    );
    recordTest(
      "IDOR 2: Tenant B cannot update Tenant A product by ID",
      idorProdUpdate.status === 404,
      `Status: ${idorProdUpdate.status}`
    );

    // Test: IDOR Customer Read
    const idorCustRead = await apiRequest("GET", `/customers/${customerAId}`, null, tokenB);
    recordTest(
      "IDOR 3: Tenant B cannot read Tenant A customer by ID",
      idorCustRead.status === 404 || !idorCustRead.data?.customer,
      `Status: ${idorCustRead.status}`
    );

    // Test: IDOR Customer Update
    const idorCustUpdate = await apiRequest(
      "PUT",
      `/customers/${customerAId}`,
      { name: "Hacked Client", mobile: "0000000000" },
      tokenB
    );
    recordTest(
      "IDOR 4: Tenant B cannot update Tenant A customer by ID",
      idorCustUpdate.status === 404,
      `Status: ${idorCustUpdate.status}`
    );

    // Test: IDOR Invoice Read
    const idorInvRead = await apiRequest("GET", `/invoices/${invoiceAId}`, null, tokenB);
    recordTest(
      "IDOR 5: Tenant B cannot read Tenant A invoice by ID",
      idorInvRead.status === 404,
      `Status: ${idorInvRead.status}`
    );

    // Test: IDOR Create invoice referencing foreign customer
    const idorInvCust = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId, // Belongs to Tenant A!
        items: [{ product_id: productAId, quantity: 1 }],
      },
      tokenB
    );
    recordTest(
      "IDOR 6: Tenant B cannot create invoice using Tenant A's customer_id",
      idorInvCust.status === 404,
      `Status: ${idorInvCust.status}, Msg: "${idorInvCust.data?.message}"`
    );

    // Test: IDOR Create invoice referencing foreign product
    // Create a customer for Tenant B first
    const custResB = await apiRequest(
      "POST",
      "/customers",
      { name: "Bravo Client", mobile: "1122334455" },
      tokenB
    );
    const customerBId = custResB.data?.customer?.id;

    const idorInvProd = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerBId,
        items: [{ product_id: productAId, quantity: 1 }], // Belongs to Tenant A!
      },
      tokenB
    );
    recordTest(
      "IDOR 7: Tenant B cannot create invoice using Tenant A's product_id",
      idorInvProd.status === 404,
      `Status: ${idorInvProd.status}, Msg: "${idorInvProd.data?.message}"`
    );

    // Test: IDOR Product Delete
    const idorProdDelete = await apiRequest("DELETE", `/products/${productAId}`, null, tokenB);
    recordTest(
      "IDOR 8: Tenant B cannot delete Tenant A product by ID",
      idorProdDelete.status === 404,
      `Status: ${idorProdDelete.status}`
    );

    // Test: IDOR Customer Delete
    const idorCustDelete = await apiRequest("DELETE", `/customers/${customerAId}`, null, tokenB);
    recordTest(
      "IDOR 9: Tenant B cannot delete Tenant A customer by ID",
      idorCustDelete.status === 404,
      `Status: ${idorCustDelete.status}`
    );

    // ====================================================
    // 3. DEFENSIVE INPUT VALIDATION AUDIT
    // ====================================================
    console.log("\n--- 3. Defensive Input Validation ---");

    // Test: Reject negative discount percentage
    const negDiscountRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 1 }],
        discount_percent: -10,
      },
      tokenA
    );
    recordTest(
      "Validation 1: Reject negative discount_percent (< 0)",
      negDiscountRes.status === 400,
      `Status: ${negDiscountRes.status}, Msg: "${negDiscountRes.data?.message}"`
    );

    // Test: Reject discount percentage > 100
    const overDiscountRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 1 }],
        discount_percent: 150,
      },
      tokenA
    );
    recordTest(
      "Validation 2: Reject discount_percent > 100",
      overDiscountRes.status === 400,
      `Status: ${overDiscountRes.status}, Msg: "${overDiscountRes.data?.message}"`
    );

    // Test: Reject negative tax percentage
    const negTaxRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 1 }],
        tax_percent: -5,
      },
      tokenA
    );
    recordTest(
      "Validation 3: Reject negative tax_percent (< 0)",
      negTaxRes.status === 400,
      `Status: ${negTaxRes.status}, Msg: "${negTaxRes.data?.message}"`
    );

    // Test: Reject tax percentage > 100
    const overTaxRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 1 }],
        tax_percent: 105,
      },
      tokenA
    );
    recordTest(
      "Validation 4: Reject tax_percent > 100",
      overTaxRes.status === 400,
      `Status: ${overTaxRes.status}, Msg: "${overTaxRes.data?.message}"`
    );

    // Test: Reject negative item quantity
    const negQtyRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: -5 }],
      },
      tokenA
    );
    recordTest(
      "Validation 5: Reject negative item quantity",
      negQtyRes.status === 400,
      `Status: ${negQtyRes.status}, Msg: "${negQtyRes.data?.message}"`
    );

    // Test: Reject decimal/non-integer item quantity
    const decQtyRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 2.7 }],
      },
      tokenA
    );
    recordTest(
      "Validation 6: Reject decimal non-integer item quantity",
      decQtyRes.status === 400,
      `Status: ${decQtyRes.status}, Msg: "${decQtyRes.data?.message}"`
    );

    // Test: Customer email regex validation
    const badEmailCustRes = await apiRequest(
      "POST",
      "/customers",
      { name: "Invalid Email Person", mobile: "9876543210", email: "not-an-email" },
      tokenA
    );
    recordTest(
      "Validation 7: Reject malformed customer email on createCustomer",
      badEmailCustRes.status === 400,
      `Status: ${badEmailCustRes.status}, Msg: "${badEmailCustRes.data?.message}"`
    );

    // Test: Customer update email regex validation
    const badUpdateEmailRes = await apiRequest(
      "PUT",
      `/customers/${customerAId}`,
      { name: "Alpha Private Client", mobile: "9988776655", email: "bad-email-format@" },
      tokenA
    );
    recordTest(
      "Validation 8: Reject malformed customer email on updateCustomer",
      badUpdateEmailRes.status === 400,
      `Status: ${badUpdateEmailRes.status}, Msg: "${badUpdateEmailRes.data?.message}"`
    );

    // ====================================================
    // 4. TRANSACTION ATOMICITY AUDIT
    // ====================================================
    console.log("\n--- 4. Invoice Transaction Atomicity ---");

    // Verify stock deduction on valid invoice
    const [prodBefore] = await pdb.query("SELECT stock FROM products WHERE id = ?", [productAId]);
    const initialStock = Number(prodBefore[0].stock);

    const validInvRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 3 }],
        discount_percent: 10,
        tax_percent: 18,
      },
      tokenA
    );

    const [prodAfter] = await pdb.query("SELECT stock FROM products WHERE id = ?", [productAId]);
    const finalStock = Number(prodAfter[0].stock);
    const stockDeductedCorrectly = finalStock === initialStock - 3;

    recordTest(
      "Transaction 1: Valid invoice creation atomically creates invoice and deducts stock",
      validInvRes.status === 201 && stockDeductedCorrectly,
      `Initial stock: ${initialStock}, Final stock: ${finalStock} (Deducted: 3)`
    );

    // Verify transaction rollback / non-creation on failure
    const [invCountBefore] = await pdb.query(
      "SELECT COUNT(*) as c FROM invoices WHERE company_id = ?",
      [companyIdA]
    );
    const [itemCountBefore] = await pdb.query(
      "SELECT COUNT(*) as c FROM invoice_items WHERE company_id = ?",
      [companyIdA]
    );

    const failedInvRes = await apiRequest(
      "POST",
      "/invoices",
      {
        customer_id: customerAId,
        items: [{ product_id: productAId, quantity: 99999 }], // Exceeds available stock
        discount_percent: 10,
        tax_percent: 18,
      },
      tokenA
    );

    const [invCountAfter] = await pdb.query(
      "SELECT COUNT(*) as c FROM invoices WHERE company_id = ?",
      [companyIdA]
    );
    const [itemCountAfter] = await pdb.query(
      "SELECT COUNT(*) as c FROM invoice_items WHERE company_id = ?",
      [companyIdA]
    );

    const noPartialWrites =
      failedInvRes.status === 400 &&
      invCountBefore[0].c === invCountAfter[0].c &&
      itemCountBefore[0].c === itemCountAfter[0].c;

    recordTest(
      "Transaction 2: Failed invoice creation aborts cleanly without partial records",
      noPartialWrites,
      `Status: ${failedInvRes.status}, Invoices before/after: ${invCountBefore[0].c}/${invCountAfter[0].c}`
    );

    // ====================================================
    // 5. DATABASE INTEGRITY & DEMO IMMUNITY AUDIT
    // ====================================================
    console.log("\n--- 5. Database Integrity & Demo Immunity ---");

    // Zero NULL company_id check across core tenant tables
    const tables = ["admins", "customers", "products", "invoices", "invoice_items"];
    let nullFound = false;
    for (const t of tables) {
      const [nullCount] = await pdb.query(
        `SELECT COUNT(*) as count FROM ${t} WHERE company_id IS NULL`
      );
      if (nullCount[0].count > 0) nullFound = true;
    }
    recordTest(
      "DB Integrity 1: Zero NULL company_id in tenant tables (admins, customers, products, invoices, items)",
      !nullFound,
      `Found nulls: ${nullFound}`
    );

    // Unique index on invoices (company_id, invoice_no) check
    const [indexes] = await pdb.query(
      "SHOW INDEXES FROM invoices WHERE Key_name = 'unique_company_invoice_no'"
    );
    const hasCompositeIndex = indexes.length >= 2;
    recordTest(
      "DB Integrity 2: Composite unique index (company_id, invoice_no) enforced",
      hasCompositeIndex,
      `Indexed columns: ${indexes.map((i) => i.Column_name).join(", ")}`
    );

    // Demo Company (company_id: 1) data preservation
    const [demoInvs] = await pdb.query("SELECT count(*) as count FROM invoices WHERE company_id = 1");
    const [demoCusts] = await pdb.query("SELECT count(*) as count FROM customers WHERE company_id = 1");
    const [demoProds] = await pdb.query("SELECT count(*) as count FROM products WHERE company_id = 1");
    const demoDataPreserved =
      demoInvs[0].count === 5 && demoCusts[0].count === 1 && demoProds[0].count === 1;

    recordTest(
      "DB Integrity 3: Demo Company (id: 1) data preserved intact",
      demoDataPreserved,
      `Invoices: ${demoInvs[0].count}, Customers: ${demoCusts[0].count}, Products: ${demoProds[0].count}`
    );

    // SmartBilling Main (company_id: 2) data preservation
    const [adminInvs] = await pdb.query("SELECT count(*) as count FROM invoices WHERE company_id = 2");
    const [adminCusts] = await pdb.query("SELECT count(*) as count FROM customers WHERE company_id = 2");
    const [adminProds] = await pdb.query("SELECT count(*) as count FROM products WHERE company_id = 2");
    const adminDataPreserved =
      adminInvs[0].count === 3 && adminCusts[0].count === 1 && adminProds[0].count === 1;

    recordTest(
      "DB Integrity 4: SmartBilling Main (id: 2) data preserved intact",
      adminDataPreserved,
      `Invoices: ${adminInvs[0].count}, Customers: ${adminCusts[0].count}, Products: ${adminProds[0].count}`
    );

    // Reserved slug test: registration cannot claim "demo-company"
    const imposterRes = await apiRequest("POST", "/auth/register", {
      company_name: "Demo Company",
      name: "Imposter",
      email: `imposter.${Date.now()}@example.com`,
      password: "Password123!",
      confirm_password: "Password123!",
    });
    const imposterSlug = imposterRes.data?.data?.company?.slug;
    const slugSafe = imposterSlug !== "demo-company";

    if (imposterRes.data?.data?.company?.id) {
      const imposterId = imposterRes.data.data.company.id;
      await pdb.query("DELETE FROM business_settings WHERE company_id = ?", [imposterId]);
      await pdb.query("DELETE FROM admins WHERE company_id = ?", [imposterId]);
      await pdb.query("DELETE FROM companies WHERE id = ?", [imposterId]);
    }

    recordTest(
      "Security 1: Reserved slug 'demo-company' cannot be claimed by new tenants",
      slugSafe,
      `Generated slug: "${imposterSlug}"`
    );

    // Security 2: Production debug endpoints disabled
    const fs = require("fs");
    const path = require("path");
    const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    const debugGuarded =
      serverSource.includes('process.env.NODE_ENV !== "production"') &&
      serverSource.includes("/api/debug/admin") &&
      serverSource.includes("/api/debug/db");

    recordTest(
      "Security 2: Debug endpoints guarded behind process.env.NODE_ENV !== 'production'",
      debugGuarded,
      "Endpoints /api/debug/admin and /api/debug/db protected from production"
    );

    // Security 3: server/.env.example exists and contains no real secrets
    const envExamplePath = path.join(__dirname, "../.env.example");
    const envExampleExists = fs.existsSync(envExamplePath);
    let envSafe = false;
    if (envExampleExists) {
      const content = fs.readFileSync(envExamplePath, "utf8");
      envSafe =
        content.includes("your_database_password_here") &&
        content.includes("your_super_secret_jwt_key_here") &&
        !content.includes(process.env.DB_PASSWORD || "_____impossible_____") &&
        !content.includes(process.env.JWT_SECRET || "_____impossible_____");
    }

    recordTest(
      "Security 3: server/.env.example exists with sanitized placeholders and no real secrets",
      envExampleExists && envSafe,
      `Exists: ${envExampleExists}, Sanitized: ${envSafe}`
    );
  } finally {
    console.log("\n🧹 Cleaning up test tenants...");
    try {
      if (companyIdA) {
        await pdb.query("DELETE FROM invoice_items WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM invoices WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM products WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM customers WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM business_settings WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM admins WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM companies WHERE id = ?", [companyIdA]);
      }
      if (companyIdB) {
        await pdb.query("DELETE FROM invoice_items WHERE company_id = ?", [companyIdB]);
        await pdb.query("DELETE FROM invoices WHERE company_id = ?", [companyIdB]);
        await pdb.query("DELETE FROM products WHERE company_id = ?", [companyIdB]);
        await pdb.query("DELETE FROM customers WHERE company_id = ?", [companyIdB]);
        await pdb.query("DELETE FROM business_settings WHERE company_id = ?", [companyIdB]);
        await pdb.query("DELETE FROM admins WHERE company_id = ?", [companyIdB]);
        await pdb.query("DELETE FROM companies WHERE id = ?", [companyIdB]);
      }
      console.log("✅ Cleanup complete.");
    } catch (e) {
      console.error("Cleanup error:", e.message);
    }

    console.log("\n==================================================");
    console.log("📊 Summary of Phase 5 Security Audit Test Results:");
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${results.length - passedCount}`);
    console.log("==================================================");

    process.exit(passedCount === results.length ? 0 : 1);
  }
}

runPhase5AuditTests();
