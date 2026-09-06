require("dotenv").config();
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

async function runPhase4Tests() {
  console.log("==================================================");
  console.log("🚀 Starting SmartBilling Phase 4: Demo Isolation & Permanence Tests");
  console.log("==================================================\n");

  const pdb = db.promise();

  let demoToken = null;
  let adminToken = null;
  let tempTrialToken = null;
  let tempTrialCompanyId = null;

  try {
    // ----------------------------------------------------
    // Test 1: Demo login succeeds
    // ----------------------------------------------------
    const demoLoginRes = await apiRequest("POST", "/auth/login", {
      email: "demo@smartbilling.com",
      password: "Demo@12345",
    });

    const demoLoginSuccess =
      demoLoginRes.status === 200 &&
      demoLoginRes.data?.success &&
      demoLoginRes.data?.data?.token;

    if (demoLoginSuccess) {
      demoToken = demoLoginRes.data.data.token;
    }

    recordTest(
      "Test 1: Demo login succeeds",
      demoLoginSuccess,
      `Status: ${demoLoginRes.status}, Message: "${demoLoginRes.data?.message}"`
    );

    // ----------------------------------------------------
    // Test 2: Demo company_id = 1 and is_demo = 1
    // ----------------------------------------------------
    const demoAdmin = demoLoginRes.data?.data?.admin;
    const demoCompany = demoLoginRes.data?.data?.company;
    const demoContextCorrect =
      demoAdmin?.company_id === 1 &&
      demoCompany?.id === 1 &&
      demoCompany?.is_demo === 1 &&
      demoCompany?.slug === "demo-company";

    recordTest(
      "Test 2: Demo company_id = 1 and is_demo = 1",
      demoContextCorrect,
      `company_id: ${demoAdmin?.company_id}, is_demo: ${demoCompany?.is_demo}, slug: "${demoCompany?.slug}"`
    );

    // ----------------------------------------------------
    // Test 3: Demo can access dashboard
    // ----------------------------------------------------
    const demoDash = await apiRequest("GET", "/dashboard", null, demoToken);
    recordTest(
      "Test 3: Demo can access dashboard",
      demoDash.status === 200 && demoDash.data?.success,
      `Status: ${demoDash.status}, Customers: ${demoDash.data?.stats?.totalCustomers}, Invoices: ${demoDash.data?.stats?.totalInvoices}`
    );

    // ----------------------------------------------------
    // Test 4: Demo can access products
    // ----------------------------------------------------
    const demoProds = await apiRequest("GET", "/products", null, demoToken);
    const demoProductsList = demoProds.data?.products || [];
    recordTest(
      "Test 4: Demo can access products",
      demoProds.status === 200 && Array.isArray(demoProductsList),
      `Status: ${demoProds.status}, Count: ${demoProductsList.length}`
    );

    // ----------------------------------------------------
    // Test 5: Demo can access customers
    // ----------------------------------------------------
    const demoCusts = await apiRequest("GET", "/customers", null, demoToken);
    const demoCustomersList = demoCusts.data?.customers || [];
    recordTest(
      "Test 5: Demo can access customers",
      demoCusts.status === 200 && Array.isArray(demoCustomersList),
      `Status: ${demoCusts.status}, Count: ${demoCustomersList.length}`
    );

    // ----------------------------------------------------
    // Test 6: Demo can access invoices
    // ----------------------------------------------------
    const demoInvs = await apiRequest("GET", "/invoices", null, demoToken);
    const demoInvoicesList = demoInvs.data?.invoices || [];
    recordTest(
      "Test 6: Demo can access invoices",
      demoInvs.status === 200 && Array.isArray(demoInvoicesList),
      `Status: ${demoInvs.status}, Count: ${demoInvoicesList.length}`
    );

    // ----------------------------------------------------
    // Test 7: Demo can access business settings
    // ----------------------------------------------------
    const demoSettings = await apiRequest("GET", "/business-settings", null, demoToken);
    recordTest(
      "Test 7: Demo can access business settings",
      demoSettings.status === 200 && demoSettings.data?.settings,
      `Status: ${demoSettings.status}, Business: "${demoSettings.data?.settings?.business_name}"`
    );

    // ----------------------------------------------------
    // Trial Behavior Case A: Demo Company with NULL trial_end_at
    // ----------------------------------------------------
    await pdb.query(
      "UPDATE companies SET trial_start_at = NULL, trial_end_at = NULL WHERE id = 1"
    );
    const demoCaseARes = await apiRequest("GET", "/dashboard", null, demoToken);
    recordTest(
      "Trial Behavior Case A: Demo Company with NULL trial_end_at -> access allowed",
      demoCaseARes.status === 200,
      `Status: ${demoCaseARes.status}`
    );

    // ----------------------------------------------------
    // Trial Behavior Case B / Test 8: Demo remains accessible if trial_end_at is in the past
    // ----------------------------------------------------
    await pdb.query(
      "UPDATE companies SET trial_end_at = DATE_SUB(NOW(), INTERVAL 10 DAY) WHERE id = 1"
    );
    const demoCaseBRes = await apiRequest("GET", "/dashboard", null, demoToken);
    const demoProdsExpiredTime = await apiRequest("GET", "/products", null, demoToken);
    const demoStillAllowed = demoCaseBRes.status === 200 && demoProdsExpiredTime.status === 200;
    recordTest(
      "Test 8 (Trial Behavior Case B): Demo remains accessible if trial_end_at is in the past",
      demoStillAllowed,
      `Dashboard: ${demoCaseBRes.status}, Products: ${demoProdsExpiredTime.status}`
    );

    // Restore Demo Company trial timestamps back to null
    await pdb.query(
      "UPDATE companies SET trial_start_at = NULL, trial_end_at = NULL WHERE id = 1"
    );

    // ----------------------------------------------------
    // Trial Behavior Case C: Normal trial company with future trial_end_at -> access allowed
    // ----------------------------------------------------
    const tempRegRes = await apiRequest("POST", "/auth/register", {
      company_name: "Phase4 Temporary Trial",
      name: "Temp Owner",
      email: `temp.phase4.${Date.now()}@example.com`,
      password: "Password123!",
      confirm_password: "Password123!",
    });
    tempTrialToken = tempRegRes.data?.data?.token;
    tempTrialCompanyId = tempRegRes.data?.data?.company?.id;

    const normalTrialFutureRes = await apiRequest("GET", "/dashboard", null, tempTrialToken);
    recordTest(
      "Trial Behavior Case C: Normal trial company with future trial_end_at -> access allowed",
      normalTrialFutureRes.status === 200,
      `Status: ${normalTrialFutureRes.status}`
    );

    // ----------------------------------------------------
    // Trial Behavior Case D / Test 9: Normal expired trial remains blocked (403 TRIAL_EXPIRED)
    // ----------------------------------------------------
    await pdb.query(
      "UPDATE companies SET trial_end_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?",
      [tempTrialCompanyId]
    );
    const normalTrialExpiredRes = await apiRequest("GET", "/dashboard", null, tempTrialToken);
    const normalBlocked403 =
      normalTrialExpiredRes.status === 403 &&
      normalTrialExpiredRes.data?.code === "TRIAL_EXPIRED";

    recordTest(
      "Test 9 (Trial Behavior Case D): Normal expired trial remains blocked",
      normalBlocked403,
      `Status: ${normalTrialExpiredRes.status}, Code: "${normalTrialExpiredRes.data?.code}"`
    );

    // ----------------------------------------------------
    // Trial Behavior Case E / Test 10: Main Admin remains accessible
    // ----------------------------------------------------
    const adminLoginRes = await apiRequest("POST", "/auth/login", {
      email: "admin@gmail.com",
      password: "admin123",
    });
    adminToken = adminLoginRes.data?.data?.token;

    const adminDash = await apiRequest("GET", "/dashboard", null, adminToken);
    const adminProds = await apiRequest("GET", "/products", null, adminToken);
    const adminInvs = await apiRequest("GET", "/invoices", null, adminToken);

    const adminOk =
      adminDash.status === 200 &&
      adminProds.status === 200 &&
      adminInvs.status === 200;

    recordTest(
      "Test 10 (Trial Behavior Case E): Main Admin remains accessible",
      adminOk,
      `Dashboard: ${adminDash.status}, Products: ${adminProds.status}, Invoices: ${adminInvs.status}`
    );

    // ----------------------------------------------------
    // Test 11: Demo cannot see Main Admin customers
    // ----------------------------------------------------
    const adminCusts = await apiRequest("GET", "/customers", null, adminToken);
    const adminCustomersList = adminCusts.data?.customers || [];
    const adminCustomerIds = adminCustomersList.map((c) => c.id);

    const demoHasAdminCustomer = demoCustomersList.some((c) =>
      adminCustomerIds.includes(c.id) || c.name.toLowerCase().includes("meet patel")
    );
    recordTest(
      "Test 11: Demo cannot see Main Admin customers",
      !demoHasAdminCustomer,
      `Demo customers: [${demoCustomersList.map((c) => c.name).join(", ")}], Admin customers: [${adminCustomersList.map((c) => c.name).join(", ")}]`
    );

    // ----------------------------------------------------
    // Test 12: Demo cannot see Main Admin products
    // ----------------------------------------------------
    const adminProductsList = adminProds.data?.products || [];
    const adminProductIds = adminProductsList.map((p) => p.id);

    const demoHasAdminProduct = demoProductsList.some((p) =>
      adminProductIds.includes(p.id)
    );
    recordTest(
      "Test 12: Demo cannot see Main Admin products",
      !demoHasAdminProduct,
      `Demo prod IDs: [${demoProductsList.map((p) => p.id).join(", ")}], Admin prod IDs: [${adminProductIds.join(", ")}]`
    );

    // ----------------------------------------------------
    // Test 13: Demo cannot see Main Admin invoices
    // ----------------------------------------------------
    const adminInvoicesList = adminInvs.data?.invoices || [];
    const adminInvoiceIds = adminInvoicesList.map((i) => i.id);

    const demoHasAdminInvoice = demoInvoicesList.some((i) =>
      adminInvoiceIds.includes(i.id)
    );
    recordTest(
      "Test 13: Demo cannot see Main Admin invoices",
      !demoHasAdminInvoice,
      `Demo inv IDs: [${demoInvoicesList.map((i) => i.id).join(", ")}], Admin inv IDs: [${adminInvoiceIds.join(", ")}]`
    );

    // ----------------------------------------------------
    // Test 14: Main Admin cannot see Demo customers
    // ----------------------------------------------------
    const demoCustomerIds = demoCustomersList.map((c) => c.id);
    const adminHasDemoCustomer = adminCustomersList.some((c) =>
      demoCustomerIds.includes(c.id) || c.name.toLowerCase().includes("rahul patel")
    );
    recordTest(
      "Test 14: Main Admin cannot see Demo customers",
      !adminHasDemoCustomer,
      `Admin customer count: ${adminCustomersList.length}, Contains Demo customer: ${adminHasDemoCustomer}`
    );

    // ----------------------------------------------------
    // Test 15: Main Admin cannot see Demo products
    // ----------------------------------------------------
    const demoProductIds = demoProductsList.map((p) => p.id);
    const adminHasDemoProduct = adminProductsList.some((p) =>
      demoProductIds.includes(p.id)
    );
    recordTest(
      "Test 15: Main Admin cannot see Demo products",
      !adminHasDemoProduct,
      `Admin product count: ${adminProductsList.length}, Contains Demo product: ${adminHasDemoProduct}`
    );

    // ----------------------------------------------------
    // Test 16: Main Admin cannot see Demo invoices
    // ----------------------------------------------------
    const demoInvoiceIds = demoInvoicesList.map((i) => i.id);
    const adminHasDemoInvoice = adminInvoicesList.some((i) =>
      demoInvoiceIds.includes(i.id)
    );
    recordTest(
      "Test 16: Main Admin cannot see Demo invoices",
      !adminHasDemoInvoice,
      `Admin invoice count: ${adminInvoicesList.length}, Contains Demo invoice: ${adminHasDemoInvoice}`
    );

    // ----------------------------------------------------
    // Test 17: Reserved Slug Protection (demo-company cannot be claimed)
    // ----------------------------------------------------
    const slugTestRes = await apiRequest("POST", "/auth/register", {
      company_name: "Demo Company", // Attempt exact match
      name: "Attacker",
      email: `imposter.${Date.now()}@example.com`,
      password: "Password123!",
      confirm_password: "Password123!",
    });
    const imposterSlug = slugTestRes.data?.data?.company?.slug;
    const slugProtected = imposterSlug !== "demo-company";

    // Clean up imposter
    if (slugTestRes.data?.data?.company?.id) {
      const imposterId = slugTestRes.data.data.company.id;
      await pdb.query("DELETE FROM business_settings WHERE company_id = ?", [imposterId]);
      await pdb.query("DELETE FROM admins WHERE company_id = ?", [imposterId]);
      await pdb.query("DELETE FROM companies WHERE id = ?", [imposterId]);
    }

    recordTest(
      "Test 17: Reserved Slug Protection",
      slugProtected,
      `Registered slug for 'Demo Company' was '${imposterSlug}' (never 'demo-company')`
    );

    // ----------------------------------------------------
    // Test 18: Normal user cannot alter company_id via business settings
    // ----------------------------------------------------
    await apiRequest("PUT", "/business-settings", {
      company_id: 1, // Malicious attempt to overwrite Demo Company
      is_demo: 1,
      business_name: "Attacker Business",
    }, adminToken);

    // Check that Demo Company's business settings remain unchanged
    const [demoSettingsCheck] = await pdb.query(
      "SELECT business_name FROM business_settings WHERE company_id = 1"
    );
    const demoSettingsPreserved = demoSettingsCheck[0]?.business_name !== "Attacker Business";

    recordTest(
      "Test 18: Normal user cannot alter other company settings",
      demoSettingsPreserved,
      `Demo business_name: "${demoSettingsCheck[0]?.business_name}"`
    );

    // ----------------------------------------------------
    // Test 19: Demo Company database level marking
    // ----------------------------------------------------
    const [demoDbCheck] = await pdb.query(
      "SELECT id, slug, is_demo, status FROM companies WHERE id = 1"
    );
    const dbMarkedDemo =
      demoDbCheck[0]?.is_demo === 1 &&
      demoDbCheck[0]?.slug === "demo-company" &&
      demoDbCheck[0]?.status === "active";

    recordTest(
      "Test 19: Demo Company marked as demo at database level",
      dbMarkedDemo,
      `is_demo: ${demoDbCheck[0]?.is_demo}, slug: "${demoDbCheck[0]?.slug}"`
    );

    // ----------------------------------------------------
    // Test 20: Data count verification
    // ----------------------------------------------------
    const [invCountCheck] = await pdb.query(
      "SELECT company_id, COUNT(*) as count FROM invoices GROUP BY company_id"
    );
    const demoInvRow = invCountCheck.find((r) => r.company_id === 1);
    const adminInvRow = invCountCheck.find((r) => r.company_id === 2);

    const countsIntact = demoInvRow?.count === 5 && adminInvRow?.count === 3;
    recordTest(
      "Test 20: Demo (5 invoices) and Admin (3 invoices) counts intact",
      countsIntact,
      `Demo invoices: ${demoInvRow?.count}, Admin invoices: ${adminInvRow?.count}`
    );
  } finally {
    console.log("\n🧹 Cleaning up test companies...");
    if (tempTrialCompanyId) {
      await pdb.query("DELETE FROM business_settings WHERE company_id = ?", [tempTrialCompanyId]);
      await pdb.query("DELETE FROM admins WHERE company_id = ?", [tempTrialCompanyId]);
      await pdb.query("DELETE FROM companies WHERE id = ?", [tempTrialCompanyId]);
    }
    // Ensure Demo Company trial timestamps remain null
    await pdb.query(
      "UPDATE companies SET trial_start_at = NULL, trial_end_at = NULL, is_demo = 1, status = 'active' WHERE id = 1"
    );
    console.log("✅ Cleanup complete.");

    console.log("\n==================================================");
    console.log("📊 Summary of Phase 4 Test Results:");
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${results.length - passedCount}`);
    console.log("==================================================");

    process.exit(passedCount === results.length ? 0 : 1);
  }
}

runPhase4Tests();
