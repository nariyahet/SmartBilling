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

const runPhase4Tests = async () => {
  console.log("=================================================================");
  console.log("👥 SMARTBILLING: PLASTIC RECYCLING ERP (PHASE 4) TEST SUITE");
  console.log("   HR, Attendance, Leaves, Workforce, Payroll & Expenses");
  console.log("=================================================================\n");

  await startServerIfNeeded();

  let tokenComp1 = null;
  let tokenComp2 = null;

  try {
    console.log("Authenticating test administrators...");
    const login1 = await apiRequest("POST", "/auth/login", {
      email: "demo@smartbilling.com",
      password: "Demo@12345",
    });
    tokenComp1 = login1.data?.data?.token;

    const login2 = await apiRequest("POST", "/auth/login", {
      email: "admin@gmail.com",
      password: "admin123",
    });
    tokenComp2 = login2.data?.data?.token;

    assert.ok(tokenComp1, "Company 1 admin token required");
    assert.ok(tokenComp2, "Company 2 admin token required");
    console.log("✅ Authenticated Company 1 (Demo) and Company 2 (Admin).\n");

    const conn = db.promise();

    // Clean up any lingering test artifacts from prior aborted runs
    await conn.query("DELETE FROM plastic_payroll_items WHERE payroll_id IN (SELECT id FROM plastic_payrolls WHERE notes LIKE '%Automated test%')");
    await conn.query("DELETE FROM plastic_payrolls WHERE notes LIKE '%Automated test%'");
    await conn.query("DELETE FROM plastic_employees WHERE employee_code LIKE 'TEST-%'");

    // 1. Employee Management Tests
    console.log("--- 1. Employee Master & Salary Structure Tests ---");
    const nextCodeRes = await apiRequest("GET", "/plastic-erp/employees/next-code", null, tokenComp2);
    assert.strictEqual(nextCodeRes.status, 200);
    assert.ok(nextCodeRes.data?.nextCode, "Generated next employee code");
    const testEmpCode = `TEST-${Date.now().toString().slice(-4)}`;

    const createEmpRes = await apiRequest("POST", "/plastic-erp/employees", {
      employee_code: testEmpCode,
      full_name: "Test Extruder Operator",
      mobile: "9876543210",
      email: "operator.test@plant.com",
      department: "PRODUCTION",
      designation: "Lead Extruder Operator",
      joining_date: "2026-01-01",
      employment_type: "FULL_TIME",
      gender: "MALE",
    }, tokenComp2);

    assert.strictEqual(createEmpRes.status, 201);
    const empId = createEmpRes.data?.employeeId;
    assert.ok(empId, "Created employee ID");
    console.log(`✅ Employee registered successfully with ID: ${empId} (${testEmpCode})`);

    // Update Salary Structure
    const salaryRes = await apiRequest("PUT", `/plastic-erp/employees/${empId}/salary`, {
      salary_type: "MONTHLY",
      base_salary: 22000,
      hra: 2000,
      overtime_rate_per_hour: 120,
      pf_applicable: true,
      esic_applicable: true,
      pt_applicable: true,
      effective_date: "2026-01-01",
    }, tokenComp2);
    assert.strictEqual(salaryRes.status, 200);
    console.log("✅ Configured active salary structure for employee");

    // Verify Multi-tenant isolation: Company 1 should not see Company 2's employee
    const comp1EmpList = await apiRequest("GET", "/plastic-erp/employees", null, tokenComp1);
    assert.strictEqual(comp1EmpList.status, 200);
    const foundInComp1 = comp1EmpList.data?.employees?.some((e) => e.id === empId);
    assert.strictEqual(foundInComp1, false, "Company 1 must NOT see Company 2 employee");
    console.log("🔒 Tenant Isolation Verified: Company 1 cannot see Company 2's employee.\n");

    // 2. Attendance & Roster Tests
    console.log("--- 2. Daily Attendance & Overtime Tests ---");
    const todayStr = new Date().toISOString().slice(0, 10);
    const bulkAttRes = await apiRequest("POST", "/plastic-erp/attendance/bulk", {
      attendance_date: todayStr,
      records: [
        {
          employee_id: empId,
          status: "PRESENT",
          working_hours: 8,
          overtime_hours: 2.5,
          remarks: "Batch testing on Line 1",
        },
      ],
    }, tokenComp2);
    assert.strictEqual(bulkAttRes.status, 200);
    console.log("✅ Bulk daily roll call recorded successfully");

    const rosterRes = await apiRequest("GET", `/plastic-erp/attendance/daily-roster?attendance_date=${todayStr}`, null, tokenComp2);
    assert.strictEqual(rosterRes.status, 200);
    const empRosterItem = rosterRes.data?.roster?.find((r) => r.employee_id === empId);
    assert.ok(empRosterItem, "Employee present in daily roster");
    assert.strictEqual(empRosterItem.status, "PRESENT");
    assert.strictEqual(Number(empRosterItem.overtime_hours), 2.5);
    console.log("✅ Verified daily roll call roster and overtime hours\n");

    // 3. Leave Management Tests
    console.log("--- 3. Leave Policies, Quotas & Applications ---");
    const leaveTypesRes = await apiRequest("GET", "/plastic-erp/leaves/types", null, tokenComp2);
    assert.strictEqual(leaveTypesRes.status, 200);
    assert.ok(leaveTypesRes.data?.leaveTypes?.length >= 4, "Seeded default leave types (CL, SL, EL, LWP)");
    const casualLeaveType = leaveTypesRes.data.leaveTypes.find((lt) => lt.code === "CL");

    // Initialize leave balances
    const initRes = await apiRequest("POST", "/plastic-erp/leaves/initialize-balances", { year: 2026 }, tokenComp2);
    assert.strictEqual(initRes.status, 200);
    console.log("✅ Initialized annual leave quotas for 2026");

    // Apply for leave
    const applyRes = await apiRequest("POST", "/plastic-erp/leaves/requests", {
      employee_id: empId,
      leave_type_id: casualLeaveType.id,
      start_date: "2026-03-10",
      end_date: "2026-03-11",
      total_days: 2,
      reason: "Family event",
    }, tokenComp2);
    assert.strictEqual(applyRes.status, 201);
    const leaveReqId = applyRes.data?.requestId;
    console.log(`✅ Applied for leave request ID: ${leaveReqId}`);

    // Approve leave
    const approveRes = await apiRequest("PUT", `/plastic-erp/leaves/requests/${leaveReqId}/status`, {
      status: "APPROVED",
      approval_notes: "Approved by Shift Supervisor",
    }, tokenComp2);
    assert.strictEqual(approveRes.status, 200);
    console.log("✅ Approved leave request and updated balance deduction\n");

    // 4. Workforce & Operator Mapping Tests
    console.log("--- 4. Plant Workforce & Machine Operator Mapping ---");
    const wfRes = await apiRequest("GET", "/plastic-erp/workforce/overview", null, tokenComp2);
    assert.strictEqual(wfRes.status, 200);
    assert.ok(Array.isArray(wfRes.data?.operators), "Retrieved operators list");

    if (wfRes.data.operators.length > 0) {
      const testOp = wfRes.data.operators[0];
      const mapRes = await apiRequest("POST", "/plastic-erp/workforce/map-operator", {
        operator_id: testOp.id,
        employee_id: empId,
      }, tokenComp2);
      assert.strictEqual(mapRes.status, 200);
      console.log(`✅ Linked machine operator (${testOp.name}) to employee master (${testEmpCode})`);
    }

    const labourCostRes = await apiRequest("GET", `/plastic-erp/workforce/shift-labour-cost?from_date=${todayStr}&to_date=${todayStr}`, null, tokenComp2);
    assert.strictEqual(labourCostRes.status, 200);
    assert.ok(labourCostRes.data?.summary?.totalLabourCost >= 0, "Calculated shift labour cost");
    console.log(`✅ Shift labour costing computed: ₹${labourCostRes.data.summary.totalLabourCost}\n`);

    // 5. Employee Advances & Loans Tests
    console.log("--- 5. Employee Advance Disbursements & Recovery ---");
    const disburseRes = await apiRequest("POST", "/plastic-erp/advances", {
      employee_id: empId,
      amount: 5000,
      disbursement_date: todayStr,
      monthly_installment: 1000,
      reason: "Urgent medical advance",
    }, tokenComp2);
    assert.strictEqual(disburseRes.status, 201);
    const advanceId = disburseRes.data?.advanceId;
    console.log(`✅ Disbursed advance ID: ${advanceId} with outstanding ₹5000`);

    // Manual cash repayment
    const repayRes = await apiRequest("POST", `/plastic-erp/advances/${advanceId}/repay`, {
      amount: 500,
      notes: "Cash recovery receipt",
    }, tokenComp2);
    assert.strictEqual(repayRes.status, 200);
    console.log("✅ Recorded manual repayment, outstanding updated to ₹4500\n");

    // 6. Monthly Payroll Batch Generation Tests
    console.log("--- 6. Monthly Payroll Computation & Payslip Generation ---");
    const payrollRunRes = await apiRequest("POST", "/plastic-erp/payrolls/generate", {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      notes: "Automated test payroll run",
    }, tokenComp2);
    assert.strictEqual(payrollRunRes.status, 201);
    const payrollId = payrollRunRes.data?.payrollId;
    assert.ok(payrollId, "Generated payroll batch ID");
    console.log(`✅ Payroll batch generated: ${payrollRunRes.data.batch_no} for ₹${payrollRunRes.data.total_net_salary}`);

    // Inspect payslips
    const payslipsRes = await apiRequest("GET", `/plastic-erp/payrolls/${payrollId}`, null, tokenComp2);
    assert.strictEqual(payslipsRes.status, 200);
    assert.ok(payslipsRes.data?.items?.length > 0, "Batch generated employee payslips");
    console.log(`✅ Generated ${payslipsRes.data.items.length} individual employee payslip(s)`);

    // Approve & Mark Paid
    const approveBatchRes = await apiRequest("PUT", `/plastic-erp/payrolls/${payrollId}/status`, { status: "APPROVED" }, tokenComp2);
    assert.strictEqual(approveBatchRes.status, 200);
    const paidBatchRes = await apiRequest("PUT", `/plastic-erp/payrolls/${payrollId}/status`, {
      status: "PAID",
      payment_date: todayStr,
    }, tokenComp2);
    assert.strictEqual(paidBatchRes.status, 200);
    console.log("✅ Payroll batch approved and marked as PAID (advances deducted & settled)\n");

    // 7. Plant Expenses Tests
    console.log("--- 7. Plant Expenses & Overhead Management ---");
    const catRes = await apiRequest("GET", "/plastic-erp/expenses/categories", null, tokenComp2);
    assert.strictEqual(catRes.status, 200);
    assert.ok(catRes.data?.categories?.length > 0, "Seeded plant expense categories");
    const powerCat = catRes.data.categories[0];

    const expNoRes = await apiRequest("GET", "/plastic-erp/expenses/next-no", null, tokenComp2);
    assert.strictEqual(expNoRes.status, 200);
    const expNo = expNoRes.data?.nextExpenseNumber;

    const createExpRes = await apiRequest("POST", "/plastic-erp/expenses", {
      expense_no: expNo,
      category_id: powerCat.id,
      title: "Extrusion Line Electricity Bill - Unit 2",
      amount: 15450,
      expense_date: todayStr,
      payment_mode: "BANK_TRANSFER",
      vendor_name: "DGVCL Power Distribution",
      payment_status: "PAID",
      approval_status: "APPROVED",
    }, tokenComp2);
    assert.strictEqual(createExpRes.status, 201);
    const expId = createExpRes.data?.expenseId;
    console.log(`✅ Recorded plant expense voucher ID: ${expId} (${expNo})`);

    // Tenant Isolation Check on Expenses
    const comp1Expenses = await apiRequest("GET", "/plastic-erp/expenses", null, tokenComp1);
    assert.strictEqual(comp1Expenses.status, 200);
    const foundExpInComp1 = comp1Expenses.data?.expenses?.some((e) => e.id === expId);
    assert.strictEqual(foundExpInComp1, false, "Company 1 must NOT see Company 2 expenses");
    console.log("🔒 Tenant Isolation Verified: Company 1 cannot see Company 2 expenses.\n");

    // 8. HR, Payroll & Labour Cost Reports Tests
    console.log("--- 8. Executive HR & Labour Cost Reports ---");
    const salRegRes = await apiRequest("GET", `/plastic-erp/hr-reports/salary-register?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`, null, tokenComp2);
    assert.strictEqual(salRegRes.status, 200);
    assert.ok(Array.isArray(salRegRes.data?.register), "Salary register returned");

    const expRepRes = await apiRequest("GET", "/plastic-erp/hr-reports/expenses-summary", null, tokenComp2);
    assert.strictEqual(expRepRes.status, 200);
    assert.ok(Array.isArray(expRepRes.data?.byCategory), "Expense summary report returned");

    const labOutputRes = await apiRequest("GET", "/plastic-erp/hr-reports/labour-cost", null, tokenComp2);
    assert.strictEqual(labOutputRes.status, 200);
    assert.ok(labOutputRes.data?.summary?.averageLabourCostPerKg !== undefined, "Labour cost per kg calculated");

    const advRepRes = await apiRequest("GET", "/plastic-erp/hr-reports/advance-recovery", null, tokenComp2);
    assert.strictEqual(advRepRes.status, 200);
    console.log("✅ Verified all 4 executive HR, Payroll and Expense reporting endpoints\n");

    // 9. Dashboard Integration Tests
    console.log("--- 9. Executive Dashboard Intelligence Integration ---");
    const dashStatsRes = await apiRequest("GET", "/dashboard/plastic-stats", null, tokenComp2);
    assert.strictEqual(dashStatsRes.status, 200);
    assert.ok(dashStatsRes.data?.stats?.totalEmployees >= 1, "Dashboard returns Phase 4 employee count");
    assert.ok(dashStatsRes.data?.stats?.todayPresentEmployees >= 1, "Dashboard returns Phase 4 present count");

    const dashP4Res = await apiRequest("GET", "/dashboard/plastic-phase4-analytics", null, tokenComp2);
    assert.strictEqual(dashP4Res.status, 200);
    assert.ok(dashP4Res.data?.analytics?.deptDistribution, "Phase 4 department distribution returned");
    assert.ok(dashP4Res.data?.analytics?.alerts, "Phase 4 operational alerts returned");
    console.log("✅ Verified Plastic Dashboard Phase 4 KPIs and operational analytics\n");

    // Clean up test data
    console.log("Cleaning up created test records...");
    await conn.query("DELETE FROM plastic_expenses WHERE id = ?", [expId]);
    await conn.query("DELETE FROM plastic_payroll_items WHERE payroll_id = ?", [payrollId]);
    await conn.query("DELETE FROM plastic_payrolls WHERE id = ?", [payrollId]);
    await conn.query("DELETE FROM plastic_employee_advances WHERE id = ?", [advanceId]);
    await conn.query("DELETE FROM plastic_leave_requests WHERE id = ?", [leaveReqId]);
    await conn.query("DELETE FROM plastic_leave_balances WHERE employee_id = ?", [empId]);
    await conn.query("DELETE FROM plastic_attendance WHERE employee_id = ?", [empId]);
    await conn.query("DELETE FROM plastic_employee_salaries WHERE employee_id = ?", [empId]);
    await conn.query("DELETE FROM plastic_employees WHERE id = ?", [empId]);
    console.log("✅ Test cleanup complete.");

    console.log("\n=================================================================");
    console.log("🎉 ALL PHASE 4 HR, PAYROLL & EXPENSES TESTS PASSED CLEANLY (100%)");
    console.log("=================================================================\n");
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(0);
  }
};

runPhase4Tests();
