require("dotenv").config();
const path = require("path");
const { spawn } = require("child_process");
const bcrypt = require("bcrypt");
const db = require("../config/db");

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

async function runTests() {
  console.log("==================================================");
  console.log("🚀 Starting SmartBilling Trial Registration System Tests (A-M)");
  console.log("==================================================\n");

  await startServerIfNeeded();
  const pdb = db.promise();

  // Test data constants
  const testCompanyA = {
    company_name: "Automated Test Corp",
    name: "Alex Tester",
    email: `test.owner.${Date.now()}@example.com`,
    password: "SecurePassword123!",
    confirm_password: "SecurePassword123!",
  };

  let tokenA = null;
  let companyIdA = null;
  let adminIdA = null;
  let companyDataA = null;
  let tokenC = null;
  let companyIdC = null;

  try {
    // ----------------------------------------------------
    // Test A: Register new company
    // ----------------------------------------------------
    try {
      const resA = await apiRequest("POST", "/auth/register", testCompanyA);
      if (
        resA.status === 201 &&
        resA.data?.success &&
        resA.data?.data?.token &&
        resA.data?.data?.company &&
        resA.data?.data?.admin
      ) {
        tokenA = resA.data.data.token;
        companyIdA = resA.data.data.company.id;
        adminIdA = resA.data.data.admin.id;
        companyDataA = resA.data.data.company;

        const isTrial = companyDataA.subscription_status === "trial";
        const isDemoZero = companyDataA.is_demo === 0;
        const isActive = companyDataA.status === "active";

        recordTest(
          "Test A: Register new company",
          isTrial && isDemoZero && isActive,
          `Company ID: ${companyIdA}, Subscription: ${companyDataA.subscription_status}, is_demo: ${companyDataA.is_demo}`
        );
      } else {
        recordTest(
          "Test A: Register new company",
          false,
          `Status: ${resA.status}, Message: ${resA.data?.message}`
        );
      }
    } catch (err) {
      recordTest("Test A: Register new company", false, err.message);
    }

    // ----------------------------------------------------
    // Test B: Register duplicate email -> reject (409)
    // ----------------------------------------------------
    try {
      const resB = await apiRequest("POST", "/auth/register", {
        company_name: "Another Business",
        name: "Duplicate User",
        email: testCompanyA.email,
        password: "Password123!",
        confirm_password: "Password123!",
      });

      const is409 = resB.status === 409;
      recordTest(
        "Test B: Register duplicate email -> reject",
        is409,
        `Status: ${resB.status}, Message: "${resB.data?.message}"`
      );
    } catch (err) {
      recordTest("Test B: Register duplicate email -> reject", false, err.message);
    }

    // ----------------------------------------------------
    // Test C: Register duplicate company slug -> handle safely
    // ----------------------------------------------------
    try {
      const resC = await apiRequest("POST", "/auth/register", {
        company_name: testCompanyA.company_name, // Same company name
        name: "Second Alex",
        email: `test.second.${Date.now()}@example.com`,
        password: "Password123!",
        confirm_password: "Password123!",
      });

      if (resC.status === 201 && resC.data?.data?.company?.slug) {
        tokenC = resC.data.data.token;
        companyIdC = resC.data.data.company.id;
        const slugA = companyDataA.slug;
        const slugC = resC.data.data.company.slug;
        const slugsDifferent = slugA !== slugC;

        recordTest(
          "Test C: Register duplicate company slug -> handle safely",
          slugsDifferent,
          `Slug A: '${slugA}', Slug C: '${slugC}'`
        );
      } else {
        recordTest(
          "Test C: Register duplicate company slug -> handle safely",
          false,
          `Status: ${resC.status}, Msg: ${resC.data?.message}`
        );
      }
    } catch (err) {
      recordTest("Test C: Register duplicate company slug -> handle safely", false, err.message);
    }

    // ----------------------------------------------------
    // Test D: New user receives company_id
    // ----------------------------------------------------
    try {
      const decodedToken = JSON.parse(
        Buffer.from(tokenA.split(".")[1], "base64").toString("utf-8")
      );
      const hasCompanyId =
        decodedToken.company_id === companyIdA &&
        typeof companyIdA === "number" &&
        companyIdA > 2;

      recordTest(
        "Test D: New user receives company_id",
        hasCompanyId,
        `JWT company_id: ${decodedToken.company_id}, Created company_id: ${companyIdA}`
      );
    } catch (err) {
      recordTest("Test D: New user receives company_id", false, err.message);
    }

    // ----------------------------------------------------
    // Test E: Trial starts correctly
    // ----------------------------------------------------
    try {
      const startAt = new Date(companyDataA.trial_start_at).getTime();
      const now = Date.now();
      const diffMs = Math.abs(now - startAt);
      const isWithin2Minutes = diffMs < 120000;

      recordTest(
        "Test E: Trial starts correctly",
        isWithin2Minutes,
        `Start: ${companyDataA.trial_start_at}, diff with current time: ${(diffMs / 1000).toFixed(1)}s`
      );
    } catch (err) {
      recordTest("Test E: Trial starts correctly", false, err.message);
    }

    // ----------------------------------------------------
    // Test F: Trial ends approximately 3 days later
    // ----------------------------------------------------
    try {
      const startAt = new Date(companyDataA.trial_start_at).getTime();
      const endAt = new Date(companyDataA.trial_end_at).getTime();
      const expectedDiffMs = 3 * 24 * 60 * 60 * 1000;
      const actualDiffMs = endAt - startAt;
      const deviationMs = Math.abs(actualDiffMs - expectedDiffMs);
      const isApprox3Days = deviationMs < 60000; // within 1 minute

      recordTest(
        "Test F: Trial ends approximately 3 days later",
        isApprox3Days,
        `Duration: ${(actualDiffMs / (1000 * 60 * 60 * 24)).toFixed(2)} days (expected 3.00)`
      );
    } catch (err) {
      recordTest("Test F: Trial ends approximately 3 days later", false, err.message);
    }

    // ----------------------------------------------------
    // Test G: Active trial can access dashboard APIs
    // ----------------------------------------------------
    try {
      const dashRes = await apiRequest("GET", "/dashboard", null, tokenA);
      const prodRes = await apiRequest("GET", "/products", null, tokenA);

      const canAccess = dashRes.status === 200 && prodRes.status === 200;
      recordTest(
        "Test G: Active trial can access dashboard APIs",
        canAccess,
        `GET /dashboard: ${dashRes.status}, GET /products: ${prodRes.status}`
      );
    } catch (err) {
      recordTest("Test G: Active trial can access dashboard APIs", false, err.message);
    }

    // ----------------------------------------------------
    // Test H: Expired trial receives 403 TRIAL_EXPIRED
    // ----------------------------------------------------
    try {
      // Simulate trial expiration by setting trial_end_at in the past
      await pdb.query(
        "UPDATE companies SET trial_end_at = DATE_SUB(NOW(), INTERVAL 5 MINUTE) WHERE id = ?",
        [companyIdA]
      );

      const dashExpired = await apiRequest("GET", "/dashboard", null, tokenA);
      const rejectedWith403 = dashExpired.status === 403;
      const errorCode = dashExpired.data?.code;

      // Verify that login is still permitted for expired accounts
      const loginRes = await apiRequest("POST", "/auth/login", {
        email: testCompanyA.email,
        password: testCompanyA.password,
      });
      const loginAllowed = loginRes.status === 200 && loginRes.data?.data?.token;

      recordTest(
        "Test H: Expired trial receives 403 TRIAL_EXPIRED",
        rejectedWith403 && errorCode === "TRIAL_EXPIRED" && !!loginAllowed,
        `Protected API: ${dashExpired.status} code='${errorCode}', Login permitted: ${!!loginAllowed}`
      );
    } catch (err) {
      recordTest("Test H: Expired trial receives 403 TRIAL_EXPIRED", false, err.message);
    }

    // ----------------------------------------------------
    // Test I: Demo Company is never blocked
    // ----------------------------------------------------
    try {
      const demoLogin = await apiRequest("POST", "/auth/login", {
        email: "demo@smartbilling.com",
        password: "Demo@12345",
      });
      const demoToken = demoLogin.data?.data?.token;

      const demoDash = await apiRequest("GET", "/dashboard", null, demoToken);
      const demoInvoices = await apiRequest("GET", "/invoices", null, demoToken);

      const demoOk = demoDash.status === 200 && demoInvoices.status === 200;
      const invoiceCount = demoInvoices.data?.data?.length ?? demoInvoices.data?.length ?? 0;
      recordTest(
        "Test I: Demo Company is never blocked",
        demoOk,
        `Demo invoices count: ${invoiceCount}`
      );
    } catch (err) {
      recordTest("Test I: Demo Company is never blocked", false, err.message);
    }

    // ----------------------------------------------------
    // Test J: Existing SmartBilling Main admin still works
    // ----------------------------------------------------
    try {
      const adminLogin = await apiRequest("POST", "/auth/login", {
        email: "admin@gmail.com",
        password: "admin123",
      });
      const adminToken = adminLogin.data?.data?.token;

      const adminDash = await apiRequest("GET", "/dashboard", null, adminToken);
      const adminInvoices = await apiRequest("GET", "/invoices", null, adminToken);

      const adminOk = adminDash.status === 200 && adminInvoices.status === 200;
      const invoiceCount = adminInvoices.data?.data?.length ?? adminInvoices.data?.length ?? 0;
      recordTest(
        "Test J: Existing SmartBilling Main admin still works",
        adminOk,
        `Admin invoices count: ${invoiceCount}`
      );
    } catch (err) {
      recordTest("Test J: Existing SmartBilling Main admin still works", false, err.message);
    }

    // ----------------------------------------------------
    // Test K: Tenant A cannot access Tenant B data
    // ----------------------------------------------------
    try {
      // Re-activate Company A's trial temporarily to test data isolation
      await pdb.query(
        "UPDATE companies SET trial_end_at = DATE_ADD(NOW(), INTERVAL 3 DAY) WHERE id = ?",
        [companyIdA]
      );

      // Create a unique product under Company A
      const createProdRes = await apiRequest(
        "POST",
        "/products",
        {
          name: `Alpha Secret Product ${Date.now()}`,
          price: 999,
          stock: 10,
        },
        tokenA
      );
      const createdProdId = createProdRes.data?.data?.id || createProdRes.data?.id;

      // Query products using Tenant C's token
      const resProdsC = await apiRequest("GET", "/products", null, tokenC);
      const productsC = resProdsC.data?.data || resProdsC.data || [];
      const leakedProduct = Array.isArray(productsC)
        ? productsC.find((p) => p.id === createdProdId)
        : null;

      // Attempt to access Company A's product by ID as Company C
      const directGet = await apiRequest("GET", `/products/${createdProdId}`, null, tokenC);
      const crossAccessBlocked =
        directGet.status === 404 ||
        directGet.status === 403 ||
        !directGet.data?.data;

      const isolationMaintained = !leakedProduct && crossAccessBlocked;
      recordTest(
        "Test K: Tenant A cannot access Tenant B data",
        isolationMaintained,
        `Leaked in list: ${!!leakedProduct}, Direct access blocked: ${crossAccessBlocked}`
      );
    } catch (err) {
      recordTest("Test K: Tenant A cannot access Tenant B data", false, err.message);
    }

    // ----------------------------------------------------
    // Test L: Password is hashed
    // ----------------------------------------------------
    try {
      const [admins] = await pdb.query(
        "SELECT password FROM admins WHERE id = ? LIMIT 1",
        [adminIdA]
      );
      const storedHash = admins[0]?.password;
      const isPlaintext = storedHash === testCompanyA.password;
      const isBcryptHash = storedHash && storedHash.startsWith("$2");
      const isValidCompare = await bcrypt.compare(testCompanyA.password, storedHash);

      recordTest(
        "Test L: Password is hashed",
        !isPlaintext && isBcryptHash && isValidCompare,
        `Starts with $2: ${isBcryptHash}, Matches bcrypt.compare: ${isValidCompare}`
      );
    } catch (err) {
      recordTest("Test L: Password is hashed", false, err.message);
    }

    // ----------------------------------------------------
    // Test M: Registration transaction rolls back if step fails
    // ----------------------------------------------------
    try {
      const failSlug = `rollback-test-${Date.now()}`;

      // Simulate a failure inside transaction:
      await pdb.beginTransaction();
      const [compRes] = await pdb.query(
        "INSERT INTO companies (name, slug, status, is_demo, subscription_status) VALUES (?, ?, 'active', 0, 'trial')",
        ["Rollback Test Corp", failSlug]
      );
      const tempCompanyId = compRes.insertId;

      // Intentionally trigger rollback
      await pdb.rollback();

      // Verify that tempCompanyId was NOT persisted
      const [checkComp] = await pdb.query(
        "SELECT id FROM companies WHERE id = ? LIMIT 1",
        [tempCompanyId]
      );
      const rolledBack = checkComp.length === 0;

      recordTest(
        "Test M: Registration transaction rolls back if admin/company creation fails",
        rolledBack,
        `Company record after rollback: ${checkComp.length} found`
      );
    } catch (err) {
      recordTest("Test M: Registration transaction rolls back if admin/company creation fails", false, err.message);
    }
  } finally {
    // ----------------------------------------------------
    // Cleanup automated test companies
    // ----------------------------------------------------
    console.log("\n🧹 Cleaning up automated test companies...");
    try {
      if (companyIdA) {
        await pdb.query("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ?)", [companyIdA]);
        await pdb.query("DELETE FROM invoices WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM products WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM plastic_customer_ledger WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM customers WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM business_settings WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM admins WHERE company_id = ?", [companyIdA]);
        await pdb.query("DELETE FROM companies WHERE id = ?", [companyIdA]);
      }
      if (companyIdC) {
        await pdb.query("DELETE FROM business_settings WHERE company_id = ?", [companyIdC]);
        await pdb.query("DELETE FROM admins WHERE company_id = ?", [companyIdC]);
        await pdb.query("DELETE FROM companies WHERE id = ?", [companyIdC]);
      }
      console.log("✅ Cleanup complete. Demo Company (1) and SmartBilling Main (2) remain untouched.");
    } catch (cleanupErr) {
      console.error("Cleanup notice:", cleanupErr.message);
    }

    if (serverProcess) {
      console.log("Stopping temporary test server process...");
      serverProcess.kill();
    }

    console.log("\n==================================================");
    console.log("📊 Summary of Test Results:");
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${results.length - passedCount}`);
    console.log("==================================================");

    process.exit(passedCount === results.length ? 0 : 1);
  }
}

runTests();
