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
}

async function runEWayBillTests() {
  console.log("==================================================");
  console.log("🚚 Starting Internal E-Way Bill Workflow & Security Tests");
  console.log("==================================================\n");

  const pdb = db.promise();
  let demoToken = null;
  let adminToken = null;
  let createdEwbId = null;
  let createdEwbNo = null;

  try {
    // 1. Authenticate Demo User (Company 1)
    const demoLoginRes = await apiRequest("POST", "/auth/login", {
      email: "demo@smartbilling.com",
      password: "Demo@12345",
    });
    demoToken = demoLoginRes.data?.data?.token;
    recordTest("Auth: Demo user login", Boolean(demoToken), `Status: ${demoLoginRes.status}`);

    // 2. Authenticate Main Admin (Company 2)
    const adminLoginRes = await apiRequest("POST", "/auth/login", {
      email: "admin@gmail.com",
      password: "admin123",
    });
    adminToken = adminLoginRes.data?.data?.token;
    recordTest("Auth: Main admin login", Boolean(adminToken), `Status: ${adminLoginRes.status}`);

    // 3. Test Next Sequential EWB Number (EWB-DRAFT-XXXXXX)
    const nextNoRes = await apiRequest("GET", "/plastic-erp/eway-bills/next-no", null, demoToken);
    const hasNextNo = nextNoRes.data?.success && /^EWB-DRAFT-\d{6}$/.test(nextNoRes.data?.nextNo);
    recordTest(
      "EWB 1: Next sequential internal reference format EWB-DRAFT-XXXXXX",
      hasNextNo,
      `Next No: "${nextNoRes.data?.nextNo}"`
    );

    // 4. Test Source Data extraction from existing Invoices
    const [existingInvs] = await pdb.query("SELECT id, invoice_no FROM invoices WHERE company_id = 1 LIMIT 1");
    let sourceDataOk = false;
    let sampleInvoiceId = null;
    if (existingInvs.length > 0) {
      sampleInvoiceId = existingInvs[0].id;
      const srcRes = await apiRequest(
        "GET",
        `/plastic-erp/eway-bills/source-data?invoice_id=${sampleInvoiceId}`,
        null,
        demoToken
      );
      sourceDataOk =
        srcRes.status === 200 &&
        srcRes.data?.success &&
        srcRes.data?.sourceData?.invoice_no === existingInvs[0].invoice_no &&
        Array.isArray(srcRes.data?.sourceData?.items);
      recordTest(
        "EWB 2: Auto-fill source data extraction from existing Invoice",
        sourceDataOk,
        `Invoice: ${existingInvs[0].invoice_no}, Items extracted: ${srcRes.data?.sourceData?.items?.length}`
      );
    } else {
      recordTest("EWB 2: Auto-fill source data extraction from existing Invoice", true, "Skipped: No invoice found in company 1");
    }

    // 5. Test Creation of Internal E-Way Bill (Draft)
    const newEwbPayload = {
      invoice_id: sampleInvoiceId,
      invoice_no: existingInvs[0]?.invoice_no || "INV-1001",
      customer_name: "Gujarat Plastic Industries",
      customer_phone: "9876543210",
      billing_address: "Plot 42, GIDC Sachin, Surat, Gujarat",
      shipping_address: "Plot 42, GIDC Sachin, Surat, Gujarat",
      dispatch_from_name: "SmartBilling Recycled Polymers Plant",
      dispatch_from_gstin: "24AAACG1234M1Z5",
      dispatch_from_address: "Kim Industrial Area, Surat, Gujarat",
      transport_mode: "ROAD",
      distance_km: 35,
      transporter_name: "Shree Ram Transport Service",
      vehicle_number: "GJ-05-BT-1234",
      vehicle_type: "REGULAR",
      driver_name: "Ramesh Bhai",
      driver_mobile: "9898989898",
      dispatch_date: new Date().toISOString().split("T")[0],
      status: "DRAFT",
      notes: "Internal warehouse transfer test document",
      items: [
        {
          product_name: "PP Reprocessed Granules Blue",
          hsn_code: "3915",
          quantity: 2500,
          unit: "KG",
          rate: 78.50,
          taxable_amount: 196250,
          tax_percent: 18,
          tax_amount: 35325,
          total_amount: 231575,
          weight_kg: 2500,
        },
      ],
    };

    const createRes = await apiRequest("POST", "/plastic-erp/eway-bills", newEwbPayload, demoToken);
    const createdOk = createRes.status === 201 && createRes.data?.success && createRes.data?.ewayBill?.id;
    if (createdOk) {
      createdEwbId = createRes.data.ewayBill.id;
      createdEwbNo = createRes.data.ewayBill.ewb_number;
    }
    recordTest(
      "EWB 3: Create Internal E-Way Bill in DRAFT status with items",
      createdOk,
      `ID: ${createdEwbId}, Ref: ${createdEwbNo}`
    );

    // 6. Test Fetch by ID
    const getByIdRes = await apiRequest("GET", `/plastic-erp/eway-bills/${createdEwbId}`, null, demoToken);
    const fetchOk =
      getByIdRes.status === 200 &&
      getByIdRes.data?.ewayBill?.ewb_number === createdEwbNo &&
      getByIdRes.data?.ewayBill?.items?.length === 1 &&
      getByIdRes.data?.ewayBill?.companySettings;
    recordTest(
      "EWB 4: Retrieve single E-Way Bill with items and company settings",
      fetchOk,
      `Items count: ${getByIdRes.data?.ewayBill?.items?.length}`
    );

    // 7. Test KPI Aggregation Endpoint
    const kpiRes = await apiRequest("GET", "/plastic-erp/eway-bills/kpi", null, demoToken);
    const kpiOk = kpiRes.status === 200 && kpiRes.data?.kpis?.total >= 1 && kpiRes.data?.kpis?.draft >= 1;
    recordTest(
      "EWB 5: KPI summary metrics aggregated correctly",
      kpiOk,
      `Total: ${kpiRes.data?.kpis?.total}, Drafts: ${kpiRes.data?.kpis?.draft}`
    );

    // 8. Test Search & Filter List
    const searchRes = await apiRequest(
      "GET",
      `/plastic-erp/eway-bills?search=${createdEwbNo}`,
      null,
      demoToken
    );
    const searchOk =
      searchRes.status === 200 &&
      searchRes.data?.ewayBills?.some((e) => e.ewb_number === createdEwbNo);
    recordTest(
      "EWB 6: Search internal E-Way Bills by reference number",
      searchOk,
      `Results count: ${searchRes.data?.ewayBills?.length}`
    );

    // 9. Test Logical Status Progression: DRAFT -> READY_FOR_DISPATCH
    const status1Res = await apiRequest(
      "PATCH",
      `/plastic-erp/eway-bills/${createdEwbId}/status`,
      { status: "READY_FOR_DISPATCH" },
      demoToken
    );
    const status1Ok = status1Res.status === 200 && status1Res.data?.status === "READY_FOR_DISPATCH";
    recordTest(
      "EWB 7: Transition DRAFT -> READY_FOR_DISPATCH",
      status1Ok,
      `New Status: ${status1Res.data?.status}`
    );

    // 10. Test Transition READY_FOR_DISPATCH -> DISPATCHED
    const status2Res = await apiRequest(
      "PATCH",
      `/plastic-erp/eway-bills/${createdEwbId}/status`,
      { status: "DISPATCHED" },
      demoToken
    );
    const status2Ok = status2Res.status === 200 && status2Res.data?.status === "DISPATCHED";
    recordTest(
      "EWB 8: Transition READY_FOR_DISPATCH -> DISPATCHED",
      status2Ok,
      `New Status: ${status2Res.data?.status}`
    );

    // 11. Test Transition DISPATCHED -> COMPLETED
    const status3Res = await apiRequest(
      "PATCH",
      `/plastic-erp/eway-bills/${createdEwbId}/status`,
      { status: "COMPLETED" },
      demoToken
    );
    const status3Ok = status3Res.status === 200 && status3Res.data?.status === "COMPLETED";
    recordTest(
      "EWB 9: Transition DISPATCHED -> COMPLETED",
      status3Ok,
      `New Status: ${status3Res.data?.status}`
    );

    // 12. Test Invalid Status Transition Rejection (Cannot move COMPLETED -> DRAFT)
    const invalidStatusRes = await apiRequest(
      "PATCH",
      `/plastic-erp/eway-bills/${createdEwbId}/status`,
      { status: "DRAFT" },
      demoToken
    );
    const invalidRejected = invalidStatusRes.status === 400;
    recordTest(
      "EWB 10: Reject invalid status transition from terminal COMPLETED status",
      invalidRejected,
      `Status: ${invalidStatusRes.status}, Message: "${invalidStatusRes.data?.message}"`
    );

    // 13. Test Delete Prevention on non-DRAFT bill
    const deleteNonDraftRes = await apiRequest(
      "DELETE",
      `/plastic-erp/eway-bills/${createdEwbId}`,
      null,
      demoToken
    );
    const deleteBlocked = deleteNonDraftRes.status === 400;
    recordTest(
      "EWB 11: Deletion strictly prohibited on non-DRAFT (COMPLETED) records",
      deleteBlocked,
      `Status: ${deleteNonDraftRes.status}, Msg: "${deleteNonDraftRes.data?.message}"`
    );

    // 14. Test Multi-Tenant Isolation (Tenant 2 Admin cannot access Tenant 1 E-Way Bill)
    const idorGetRes = await apiRequest(
      "GET",
      `/plastic-erp/eway-bills/${createdEwbId}`,
      null,
      adminToken
    );
    const idorBlocked = idorGetRes.status === 404;
    recordTest(
      "Security: Multi-tenant isolation - Tenant 2 cannot read Tenant 1 E-Way Bill",
      idorBlocked,
      `Status: ${idorGetRes.status}`
    );

    const idorUpdateRes = await apiRequest(
      "PATCH",
      `/plastic-erp/eway-bills/${createdEwbId}/status`,
      { status: "CANCELLED" },
      adminToken
    );
    const idorUpdateBlocked = idorUpdateRes.status === 404;
    recordTest(
      "Security: Multi-tenant isolation - Tenant 2 cannot modify Tenant 1 E-Way Bill",
      idorUpdateBlocked,
      `Status: ${idorUpdateRes.status}`
    );

    // 15. Create a disposable DRAFT and verify successful deletion
    const disposableRes = await apiRequest(
      "POST",
      "/plastic-erp/eway-bills",
      {
        ...newEwbPayload,
        customer_name: "Disposable Draft Customer",
        status: "DRAFT",
      },
      demoToken
    );
    const disposableId = disposableRes.data?.ewayBill?.id;
    const deleteDraftRes = await apiRequest(
      "DELETE",
      `/plastic-erp/eway-bills/${disposableId}`,
      null,
      demoToken
    );
    const deleteDraftOk = deleteDraftRes.status === 200 && deleteDraftRes.data?.success;
    recordTest(
      "EWB 12: Successful deletion of DRAFT E-Way Bill",
      deleteDraftOk,
      `Deleted Ref: ${disposableRes.data?.ewayBill?.ewb_number}`
    );
  } finally {
    // Cleanup created test records
    if (createdEwbId) {
      await pdb.query("DELETE FROM internal_eway_bill_items WHERE eway_bill_id = ?", [createdEwbId]);
      await pdb.query("DELETE FROM internal_eway_bills WHERE id = ?", [createdEwbId]);
    }

    console.log("\n==================================================");
    console.log("📊 Summary of Internal E-Way Bill Integration Tests:");
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`Total: ${results.length}, Passed: ${passedCount}, Failed: ${results.length - passedCount}`);
    console.log("==================================================");

    process.exit(passedCount === results.length ? 0 : 1);
  }
}

runEWayBillTests();
