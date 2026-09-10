import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, StatusBadge, Tabs } from "../components";
import "./PlasticHrReports.css";

function PlasticHrReports() {
  const [activeTab, setActiveTab] = useState("SALARY"); // 'SALARY', 'EXPENSES', 'LABOUR_COST', 'ADVANCES'
  const [loading, setLoading] = useState(false);

  // Tab 1: Salary Register
  const [salaryMonth, setSalaryMonth] = useState(new Date().getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());
  const [salaryData, setSalaryData] = useState({ summary: {}, register: [] });

  // Tab 2: Expense Analysis
  const [expFrom, setExpFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [expTo, setExpTo] = useState(new Date().toISOString().slice(0, 10));
  const [expenseReport, setExpenseReport] = useState({ byCategory: [], byMonth: [], topVendors: [] });

  // Tab 3: Labour Cost vs Production Output
  const [labourFrom, setLabourFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [labourTo, setLabourTo] = useState(new Date().toISOString().slice(0, 10));
  const [labourReport, setLabourReport] = useState({ summary: {}, dailyBreakdown: [] });

  // Tab 4: Advances Recovery
  const [advanceReport, setAdvanceReport] = useState({ summary: {}, advances: [] });

  const fetchSalaryRegister = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/hr-reports/salary-register", {
        params: { month: salaryMonth, year: salaryYear },
      });
      if (res.data?.success) {
        setSalaryData({
          summary: res.data.summary || {},
          register: res.data.register || [],
        });
      }
    } catch (err) {
      console.error("Failed to load salary register:", err);
    } finally {
      setLoading(false);
    }
  }, [salaryMonth, salaryYear]);

  const fetchExpenseReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/hr-reports/expenses-summary", {
        params: { from_date: expFrom, to_date: expTo },
      });
      if (res.data?.success) {
        setExpenseReport(res.data);
      }
    } catch (err) {
      console.error("Failed to load expense report:", err);
    } finally {
      setLoading(false);
    }
  }, [expFrom, expTo]);

  const fetchLabourCostReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/hr-reports/labour-cost", {
        params: { from_date: labourFrom, to_date: labourTo },
      });
      if (res.data?.success) {
        setLabourReport(res.data);
      }
    } catch (err) {
      console.error("Failed to load labour cost report:", err);
    } finally {
      setLoading(false);
    }
  }, [labourFrom, labourTo]);

  const fetchAdvanceReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/hr-reports/advance-recovery");
      if (res.data?.success) {
        setAdvanceReport(res.data);
      }
    } catch (err) {
      console.error("Failed to load advance report:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReportData = useCallback(() => {
    if (activeTab === "SALARY") {
      fetchSalaryRegister();
    } else if (activeTab === "EXPENSES") {
      fetchExpenseReport();
    } else if (activeTab === "LABOUR_COST") {
      fetchLabourCostReport();
    } else if (activeTab === "ADVANCES") {
      fetchAdvanceReport();
    }
  }, [activeTab, fetchSalaryRegister, fetchExpenseReport, fetchLabourCostReport, fetchAdvanceReport]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const tabItems = [
    { key: "SALARY", label: "Salary Register", icon: "📑" },
    { key: "EXPENSES", label: "Expense Analytics", icon: "🧾" },
    { key: "LABOUR_COST", label: "Labour Cost / Kg", icon: "🏭" },
    { key: "ADVANCES", label: "Advance Recovery", icon: "💳" },
  ];

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="HR, Payroll & Expense Reports"
          subtitle="Detailed salary registers, monthly operational overhead summaries, advance recoveries, and production labour costing"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "HR & Workforce", to: "/plastic-erp/hr" },
            { label: "Reports & Analytics" },
          ]}
          actions={
            <div className="hr-rep-actions">
              <Button
                variant="outline"
                icon="🖨️"
                onClick={() => window.print()}
              >
                Print Current View
              </Button>
            </div>
          }
        />

        {/* Tab Navigation */}
        <div className="hr-rep-tabs-wrap">
          <Tabs
            items={tabItems}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
          />
        </div>

        {/* Tab 1: Salary Register */}
        {activeTab === "SALARY" && (
          <div className="hr-tab-content">
            {/* Filter Card */}
            <Card className="hr-filter-card">
              <div className="hr-filter-grid">
                <div className="filter-item">
                  <label htmlFor="sal-month">Payroll Month</label>
                  <select
                    id="sal-month"
                    className="sb-select"
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(Number(e.target.value))}
                  >
                    {monthNames.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-item">
                  <label htmlFor="sal-year">Payroll Year</label>
                  <select
                    id="sal-year"
                    className="sb-select"
                    value={salaryYear}
                    onChange={(e) => setSalaryYear(Number(e.target.value))}
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
                <div className="filter-item filter-btn-end">
                  <Button
                    variant="primary"
                    icon="🔍"
                    onClick={fetchSalaryRegister}
                  >
                    Generate Register
                  </Button>
                </div>
              </div>
            </Card>

            {/* Summary KPIs */}
            <div className="hr-kpi-grid">
              <KpiCard
                title="Paid Staff"
                value={salaryData.summary?.totalEmployees || 0}
                subtitle="Payslips issued"
                icon="👥"
                color="navy"
              />
              <KpiCard
                title="Total Gross"
                value={`₹${Number(salaryData.summary?.totalGross || 0).toLocaleString("en-IN")}`}
                subtitle="Basic + OT + Allowances"
                icon="💰"
                color="blue"
              />
              <KpiCard
                title="Total Deductions"
                value={`₹${Number(salaryData.summary?.totalDeductions || 0).toLocaleString("en-IN")}`}
                subtitle="Advances + PF + Tax"
                icon="📉"
                color="amber"
              />
              <KpiCard
                title="Net Disbursed"
                value={`₹${Number(salaryData.summary?.totalNet || 0).toLocaleString("en-IN")}`}
                subtitle="Net bank & cash paid"
                icon="💵"
                color="teal"
              />
            </div>

            {/* Table */}
            <Card
              title={`Salary Register — ${monthNames[salaryMonth - 1]} ${salaryYear}`}
              subtitle="Breakdown of gross earnings, deductions, and net payouts"
            >
              {loading ? (
                <LoadingScreen />
              ) : (
                <div className="hr-table-wrapper">
                  <table className="hr-table">
                    <thead>
                      <tr>
                        <th>Emp Code</th>
                        <th>Employee Name</th>
                        <th>Department & Role</th>
                        <th>Present / HD</th>
                        <th className="cell-right">Basic</th>
                        <th className="cell-right">OT Pay</th>
                        <th className="cell-right">Gross</th>
                        <th className="cell-right">Adv Rec</th>
                        <th className="cell-right">Total Ded</th>
                        <th className="cell-right">Net Pay</th>
                        <th>Bank / Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryData.register.length === 0 ? (
                        <tr>
                          <td colSpan="11" className="hr-table-empty">
                            <div className="empty-state">
                              <span className="empty-icon">📑</span>
                              <p>No salary register generated for {monthNames[salaryMonth - 1]} {salaryYear}. Please run monthly payroll first.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        salaryData.register.map((r) => (
                          <tr key={r.item_id}>
                            <td>
                              <span className="emp-code-badge">{r.employee_code}</span>
                            </td>
                            <td>
                              <strong>{r.full_name}</strong>
                            </td>
                            <td>
                              <span className="dept-chip">{r.department}</span>
                              <div className="sub-text">{r.designation}</div>
                            </td>
                            <td>
                              <span>{r.present_days} P / {r.half_days} HD</span>
                            </td>
                            <td className="cell-right">
                              ₹{Number(r.earned_basic || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right text-blue">
                              ₹{Number(r.overtime_amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right">
                              <strong>₹{Number(r.gross_salary || 0).toLocaleString("en-IN")}</strong>
                            </td>
                            <td className="cell-right text-amber">
                              -₹{Number(r.advance_recovery || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right text-danger">
                              -₹{Number(r.total_deductions || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right">
                              <strong className="text-teal">
                                ₹{Number(r.net_salary || 0).toLocaleString("en-IN")}
                              </strong>
                            </td>
                            <td>
                              <div className="bank-name">{r.bank_name || "Cash"}</div>
                              {r.account_number && (
                                <div className="sub-text">{r.account_number}</div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 2: Expense Analytics */}
        {activeTab === "EXPENSES" && (
          <div className="hr-tab-content">
            {/* Filter Card */}
            <Card className="hr-filter-card">
              <div className="hr-filter-grid">
                <div className="filter-item">
                  <label htmlFor="exp-rep-from">From Date</label>
                  <input
                    id="exp-rep-from"
                    type="date"
                    className="sb-input"
                    value={expFrom}
                    onChange={(e) => setExpFrom(e.target.value)}
                  />
                </div>
                <div className="filter-item">
                  <label htmlFor="exp-rep-to">To Date</label>
                  <input
                    id="exp-rep-to"
                    type="date"
                    className="sb-input"
                    value={expTo}
                    onChange={(e) => setExpTo(e.target.value)}
                  />
                </div>
                <div className="filter-item filter-btn-end">
                  <Button
                    variant="primary"
                    icon="🔍"
                    onClick={fetchExpenseReport}
                  >
                    Generate Analytics
                  </Button>
                </div>
              </div>
            </Card>

            {/* Total Expense KPI */}
            <div className="hr-single-kpi">
              <KpiCard
                title="Total Plant Overhead Expenditure"
                value={`₹${Number(expenseReport.overallTotal || 0).toLocaleString("en-IN")}`}
                subtitle={`Period: ${new Date(expFrom).toLocaleDateString("en-IN")} to ${new Date(expTo).toLocaleDateString("en-IN")}`}
                icon="🧾"
                color="teal"
              />
            </div>

            {/* Grid: Category Breakdown and Top Vendors */}
            <div className="rep-two-col-grid">
              <Card title="Expense Breakdown by Category" subtitle="Expenditure grouped by plant cost heads">
                <div className="hr-table-wrapper">
                  <table className="hr-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Vouchers</th>
                        <th className="cell-right">Paid</th>
                        <th className="cell-right">Pending</th>
                        <th className="cell-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(expenseReport.byCategory || []).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="hr-table-empty">
                            No expense breakdown found for period.
                          </td>
                        </tr>
                      ) : (
                        (expenseReport.byCategory || []).map((c) => (
                          <tr key={c.category_id}>
                            <td><strong>{c.category_name}</strong></td>
                            <td>{c.expense_count}</td>
                            <td className="cell-right text-teal">
                              ₹{Number(c.paid_amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right text-amber">
                              ₹{Number(c.pending_amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right">
                              <strong>₹{Number(c.total_amount || 0).toLocaleString("en-IN")}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Top Vendors & Service Providers" subtitle="Largest vendor accounts in selected range">
                <div className="hr-table-wrapper">
                  <table className="hr-table">
                    <thead>
                      <tr>
                        <th>Vendor / Beneficiary</th>
                        <th>Bills</th>
                        <th className="cell-right">Total Invoiced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(expenseReport.topVendors || []).length === 0 ? (
                        <tr>
                          <td colSpan="3" className="hr-table-empty">
                            No vendor records in this date range.
                          </td>
                        </tr>
                      ) : (
                        (expenseReport.topVendors || []).map((v, idx) => (
                          <tr key={idx}>
                            <td><strong>{v.vendor}</strong></td>
                            <td>{v.bill_count} bills</td>
                            <td className="cell-right">
                              <strong className="text-teal">
                                ₹{Number(v.total_amount || 0).toLocaleString("en-IN")}
                              </strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 3: Labour Cost vs Production Output */}
        {activeTab === "LABOUR_COST" && (
          <div className="hr-tab-content">
            {/* Filter Card */}
            <Card className="hr-filter-card">
              <div className="hr-filter-grid">
                <div className="filter-item">
                  <label htmlFor="lab-from">From Date</label>
                  <input
                    id="lab-from"
                    type="date"
                    className="sb-input"
                    value={labourFrom}
                    onChange={(e) => setLabourFrom(e.target.value)}
                  />
                </div>
                <div className="filter-item">
                  <label htmlFor="lab-to">To Date</label>
                  <input
                    id="lab-to"
                    type="date"
                    className="sb-input"
                    value={labourTo}
                    onChange={(e) => setLabourTo(e.target.value)}
                  />
                </div>
                <div className="filter-item filter-btn-end">
                  <Button
                    variant="primary"
                    icon="🔍"
                    onClick={fetchLabourCostReport}
                  >
                    Calculate Costing
                  </Button>
                </div>
              </div>
            </Card>

            {/* KPI Cards */}
            <div className="hr-kpi-grid">
              <KpiCard
                title="Total Labour Expenditure"
                value={`₹${Number(labourReport.summary?.totalLabourCost || 0).toLocaleString("en-IN")}`}
                subtitle="Shift worker compensation"
                icon="💰"
                color="teal"
              />
              <KpiCard
                title="Finished Goods Output"
                value={`${Number(labourReport.summary?.totalProducedKg || 0).toLocaleString("en-IN")} kg`}
                subtitle="Total batches output weight"
                icon="⚖️"
                color="blue"
              />
              <KpiCard
                title="Labour Cost Per KG"
                value={`₹${Number(labourReport.summary?.averageLabourCostPerKg || 0).toFixed(2)} / kg`}
                subtitle="Plant operational efficiency"
                icon="⚡"
                color="amber"
              />
            </div>

            {/* Daily Breakdown */}
            <Card
              title="Daily Labour Cost vs Finished Output"
              subtitle="Daily production efficiency and overtime impact analysis"
            >
              {loading ? (
                <LoadingScreen />
              ) : (
                <div className="hr-table-wrapper">
                  <table className="hr-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Workers Present</th>
                        <th>Regular Hours</th>
                        <th>Overtime Hours</th>
                        <th className="cell-right">Total Labour Cost</th>
                        <th className="cell-right">Produced Output (KG)</th>
                        <th className="cell-right">Labour Cost / KG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(labourReport.dailyBreakdown || []).length === 0 ? (
                        <tr>
                          <td colSpan="7" className="hr-table-empty">
                            No production or attendance records in this period.
                          </td>
                        </tr>
                      ) : (
                        labourReport.dailyBreakdown.map((row, i) => (
                          <tr key={i}>
                            <td>
                              <strong>
                                {new Date(row.date).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                })}
                              </strong>
                            </td>
                            <td>{row.workers} workers</td>
                            <td>{row.regularHours} hrs</td>
                            <td className="text-blue">⚡ {row.overtimeHours} hrs</td>
                            <td className="cell-right">
                              <strong>₹{Number(row.labourCost).toLocaleString("en-IN")}</strong>
                            </td>
                            <td className="cell-right">
                              {Number(row.producedKg).toLocaleString("en-IN")} kg
                            </td>
                            <td className="cell-right">
                              <strong className="text-teal font-medium">
                                ₹{Number(row.costPerKg).toFixed(2)} / kg
                              </strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 4: Advance Recovery Status */}
        {activeTab === "ADVANCES" && (
          <div className="hr-tab-content">
            {/* KPI Cards */}
            <div className="hr-kpi-grid">
              <KpiCard
                title="Total Disbursed"
                value={`₹${Number(advanceReport.summary?.totalAdvanced || 0).toLocaleString("en-IN")}`}
                subtitle="All time advances disbursed"
                icon="💳"
                color="blue"
              />
              <KpiCard
                title="Total Recovered"
                value={`₹${Number(advanceReport.summary?.totalRecovered || 0).toLocaleString("en-IN")}`}
                subtitle="Settled via payroll & cash"
                icon="🔄"
                color="teal"
              />
              <KpiCard
                title="Active Outstanding"
                value={`₹${Number(advanceReport.summary?.totalOutstanding || 0).toLocaleString("en-IN")}`}
                subtitle="Current balance receivable"
                icon="⏳"
                color="amber"
              />
              <KpiCard
                title="Ongoing Loans"
                value={advanceReport.summary?.activeCount || 0}
                subtitle="Staff with active balances"
                icon="👥"
                color="navy"
              />
            </div>

            {/* Table */}
            <Card
              title="Employee Advances Register"
              subtitle="Tracking cumulative disbursements, monthly recoveries, and pending loan balances"
            >
              {loading ? (
                <LoadingScreen />
              ) : (
                <div className="hr-table-wrapper">
                  <table className="hr-table">
                    <thead>
                      <tr>
                        <th>Advance No</th>
                        <th>Disbursement Date</th>
                        <th>Employee</th>
                        <th>Department & Role</th>
                        <th className="cell-right">Disbursed (₹)</th>
                        <th className="cell-right">Recovered (₹)</th>
                        <th className="cell-right">Remaining (₹)</th>
                        <th>Monthly EMI</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(advanceReport.advances || []).length === 0 ? (
                        <tr>
                          <td colSpan="9" className="hr-table-empty">
                            No advance records found.
                          </td>
                        </tr>
                      ) : (
                        advanceReport.advances.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <span className="emp-code-badge">{a.advance_no}</span>
                            </td>
                            <td>
                              {new Date(a.disbursement_date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                              })}
                            </td>
                            <td><strong>{a.full_name}</strong></td>
                            <td>
                              <span className="dept-chip">{a.department}</span>
                              <div className="sub-text">{a.designation}</div>
                            </td>
                            <td className="cell-right">
                              ₹{Number(a.amount).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right text-teal">
                              ₹{Number(a.recovery_amount).toLocaleString("en-IN")}
                            </td>
                            <td className="cell-right">
                              <strong className={Number(a.outstanding_amount) > 0 ? "text-amber" : "text-muted"}>
                                ₹{Number(a.outstanding_amount).toLocaleString("en-IN")}
                              </strong>
                            </td>
                            <td>
                              ₹{Number(a.monthly_installment || 0).toLocaleString("en-IN")}/mo
                            </td>
                            <td>
                              <StatusBadge status={a.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticHrReports;
