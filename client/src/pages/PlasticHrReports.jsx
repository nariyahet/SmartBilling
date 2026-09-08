import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReportData();
  }, [loadReportData]);




  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / HR & Payroll</span>
            <h1 className="plastic-title">📊 HR, Payroll & Plant Expense Reports</h1>
            <p className="plastic-subtitle">
              Detailed salary registers, monthly operational overhead summaries, advance recoveries, and production labour costing.
            </p>
          </div>
          <div className="tab-pills">
            <button
              type="button"
              className={`pill-btn ${activeTab === "SALARY" ? "active" : ""}`}
              onClick={() => setActiveTab("SALARY")}
            >
              📑 Salary Register
            </button>
            <button
              type="button"
              className={`pill-btn ${activeTab === "EXPENSES" ? "active" : ""}`}
              onClick={() => setActiveTab("EXPENSES")}
            >
              🧾 Expense Analytics
            </button>
            <button
              type="button"
              className={`pill-btn ${activeTab === "LABOUR_COST" ? "active" : ""}`}
              onClick={() => setActiveTab("LABOUR_COST")}
            >
              🏭 Labour Cost / Kg
            </button>
            <button
              type="button"
              className={`pill-btn ${activeTab === "ADVANCES" ? "active" : ""}`}
              onClick={() => setActiveTab("ADVANCES")}
            >
              💳 Advance Recovery
            </button>
          </div>
        </div>

        {/* Tab 1: Salary Register */}
        {activeTab === "SALARY" && (
          <div>
            <div className="plastic-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="sal-month">Month</label>
                  <select
                    id="sal-month"
                    className="plastic-select"
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(Number(e.target.value))}
                  >
                    {monthNames.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="sal-year">Year</label>
                  <select
                    id="sal-year"
                    className="plastic-select"
                    value={salaryYear}
                    onChange={(e) => setSalaryYear(Number(e.target.value))}
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
                <div className="attendance-actions-right">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-secondary"
                    onClick={() => window.print()}
                  >
                    🖨️ Print Register
                  </button>
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-primary"
                    onClick={fetchSalaryRegister}
                  >
                    🔍 Generate Register
                  </button>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="plastic-kpi-grid">
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>👥</span>
                <div>
                  <span className="plastic-kpi-label">Paid Staff</span>
                  <h3 className="plastic-kpi-val">{salaryData.summary?.totalEmployees || 0}</h3>
                  <small className="plastic-kpi-sub">Total payslips issued</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon">💰</span>
                <div>
                  <span className="plastic-kpi-label">Total Gross</span>
                  <h3 className="plastic-kpi-val">₹{Number(salaryData.summary?.totalGross || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">Basic + Allowances + OT</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>📉</span>
                <div>
                  <span className="plastic-kpi-label">Total Deductions</span>
                  <h3 className="plastic-kpi-val">₹{Number(salaryData.summary?.totalDeductions || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">Advances + PF + ESIC + PT</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💵</span>
                <div>
                  <span className="plastic-kpi-label">Net Disbursed</span>
                  <h3 className="plastic-kpi-val">₹{Number(salaryData.summary?.totalNet || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">Total bank/cash disbursed</small>
                </div>
              </div>
            </div>

            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Emp Code</th>
                      <th>Employee Name</th>
                      <th>Department & Role</th>
                      <th>Present / HD</th>
                      <th>Basic</th>
                      <th>OT Amount</th>
                      <th>Gross</th>
                      <th>Adv Rec</th>
                      <th>Total Ded</th>
                      <th>Net Pay</th>
                      <th>Bank & Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryData.register.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ textAlign: "center", padding: "2.5rem" }}>
                          No salary register generated for {monthNames[salaryMonth - 1]} {salaryYear}. Please run monthly payroll first.
                        </td>
                      </tr>
                    ) : (
                      salaryData.register.map((r) => (
                        <tr key={r.item_id}>
                          <td><span className="plastic-code-badge">{r.employee_code}</span></td>
                          <td><strong>{r.full_name}</strong></td>
                          <td>
                            <span className="plastic-chip">{r.department}</span>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.designation}</div>
                          </td>
                          <td>{r.present_days} / {r.half_days} HD</td>
                          <td>₹{Number(r.earned_basic || 0).toLocaleString("en-IN")}</td>
                          <td style={{ color: "#2563eb" }}>₹{Number(r.overtime_amount || 0).toLocaleString("en-IN")}</td>
                          <td><strong>₹{Number(r.gross_salary || 0).toLocaleString("en-IN")}</strong></td>
                          <td style={{ color: "#b45309" }}>-₹{Number(r.advance_recovery || 0).toLocaleString("en-IN")}</td>
                          <td style={{ color: "#b91c1c" }}>-₹{Number(r.total_deductions || 0).toLocaleString("en-IN")}</td>
                          <td>
                            <strong style={{ color: "#047857", fontSize: "0.95rem" }}>
                              ₹{Number(r.net_salary || 0).toLocaleString("en-IN")}
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontSize: "0.8rem" }}>{r.bank_name || "Cash"}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.account_number || ""}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Expense Analytics */}
        {activeTab === "EXPENSES" && (
          <div>
            <div className="plastic-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="exp-rep-from">From Date</label>
                  <input
                    id="exp-rep-from"
                    type="date"
                    className="plastic-input"
                    value={expFrom}
                    onChange={(e) => setExpFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="exp-rep-to">To Date</label>
                  <input
                    id="exp-rep-to"
                    type="date"
                    className="plastic-input"
                    value={expTo}
                    onChange={(e) => setExpTo(e.target.value)}
                  />
                </div>
                <div className="attendance-actions-right">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-primary"
                    onClick={fetchExpenseReport}
                  >
                    🔍 Generate Analytics
                  </button>
                </div>
              </div>
            </div>

            {/* Total Expense KPI */}
            <div className="plastic-kpi-card" style={{ marginBottom: "20px" }}>
              <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>🧾</span>
              <div>
                <span className="plastic-kpi-label">Total Plant Overhead Expenditure</span>
                <h3 className="plastic-kpi-val">
                  ₹{Number(expenseReport.overallTotal || 0).toLocaleString("en-IN")}
                </h3>
                <small className="plastic-kpi-sub">
                  Period: {new Date(expFrom).toLocaleDateString("en-IN")} to {new Date(expTo).toLocaleDateString("en-IN")}
                </small>
              </div>
            </div>

            {/* Grid: Category Breakdown and Top Vendors */}
            <div className="rep-two-col">
              <div className="rep-card">
                <h3>🏷️ Expense Breakdown by Category</h3>
                <div className="plastic-table-container">
                  <table className="plastic-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Vouchers</th>
                        <th>Paid</th>
                        <th>Pending</th>
                        <th style={{ textAlign: "right" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(expenseReport.byCategory || []).map((c) => (
                        <tr key={c.category_id}>
                          <td><strong>{c.category_name}</strong></td>
                          <td>{c.expense_count}</td>
                          <td style={{ color: "#059669" }}>₹{Number(c.paid_amount || 0).toLocaleString("en-IN")}</td>
                          <td style={{ color: "#b45309" }}>₹{Number(c.pending_amount || 0).toLocaleString("en-IN")}</td>
                          <td style={{ textAlign: "right" }}>
                            <strong>₹{Number(c.total_amount || 0).toLocaleString("en-IN")}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rep-card">
                <h3>🏢 Top Vendors & Service Providers</h3>
                <div className="plastic-table-container">
                  <table className="plastic-table">
                    <thead>
                      <tr>
                        <th>Vendor / Beneficiary</th>
                        <th>Bills</th>
                        <th style={{ textAlign: "right" }}>Total Invoiced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(expenseReport.topVendors || []).map((v, idx) => (
                        <tr key={idx}>
                          <td><strong>{v.vendor}</strong></td>
                          <td>{v.bill_count} bills</td>
                          <td style={{ textAlign: "right", color: "#047857", fontWeight: "700" }}>
                            ₹{Number(v.total_amount || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Labour Cost vs Production Output */}
        {activeTab === "LABOUR_COST" && (
          <div>
            <div className="plastic-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="lab-from">From Date</label>
                  <input
                    id="lab-from"
                    type="date"
                    className="plastic-input"
                    value={labourFrom}
                    onChange={(e) => setLabourFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="lab-to">To Date</label>
                  <input
                    id="lab-to"
                    type="date"
                    className="plastic-input"
                    value={labourTo}
                    onChange={(e) => setLabourTo(e.target.value)}
                  />
                </div>
                <div className="attendance-actions-right">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-primary"
                    onClick={fetchLabourCostReport}
                  >
                    🔍 Calculate Output Costing
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="plastic-kpi-grid">
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💰</span>
                <div>
                  <span className="plastic-kpi-label">Total Labour Expenditure</span>
                  <h3 className="plastic-kpi-val">₹{Number(labourReport.summary?.totalLabourCost || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">Total shift worker compensation</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>⚖️</span>
                <div>
                  <span className="plastic-kpi-label">Finished Goods Produced</span>
                  <h3 className="plastic-kpi-val">{Number(labourReport.summary?.totalProducedKg || 0).toLocaleString("en-IN")} kg</h3>
                  <small className="plastic-kpi-sub">Total batches output weight</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⚡</span>
                <div>
                  <span className="plastic-kpi-label">Labour Cost Per KG</span>
                  <h3 className="plastic-kpi-val">₹{Number(labourReport.summary?.averageLabourCostPerKg || 0).toFixed(2)} / kg</h3>
                  <small className="plastic-kpi-sub">Plant efficiency metric</small>
                </div>
              </div>
            </div>

            {/* Daily Table */}
            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Workers Present</th>
                      <th>Regular Hours</th>
                      <th>Overtime Hours</th>
                      <th>Total Labour Cost</th>
                      <th>Produced Output (KG)</th>
                      <th style={{ textAlign: "right" }}>Labour Cost / KG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(labourReport.dailyBreakdown || []).length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem" }}>
                          No production or attendance records in this period.
                        </td>
                      </tr>
                    ) : (
                      labourReport.dailyBreakdown.map((row, i) => (
                        <tr key={i}>
                          <td><strong>{new Date(row.date).toLocaleDateString("en-IN")}</strong></td>
                          <td>{row.workers} workers</td>
                          <td>{row.regularHours} hrs</td>
                          <td style={{ color: "#2563eb" }}>⚡ {row.overtimeHours} hrs</td>
                          <td><strong>₹{Number(row.labourCost).toLocaleString("en-IN")}</strong></td>
                          <td>{Number(row.producedKg).toLocaleString("en-IN")} kg</td>
                          <td style={{ textAlign: "right" }}>
                            <strong style={{ color: "#047857", fontSize: "1.05rem" }}>
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
          </div>
        )}

        {/* Tab 4: Advance Recovery Status */}
        {activeTab === "ADVANCES" && (
          <div>
            {/* KPI Cards */}
            <div className="plastic-kpi-grid">
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>💳</span>
                <div>
                  <span className="plastic-kpi-label">Total Disbursed</span>
                  <h3 className="plastic-kpi-val">₹{Number(advanceReport.summary?.totalAdvanced || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">All time advances</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>🔄</span>
                <div>
                  <span className="plastic-kpi-label">Total Recovered</span>
                  <h3 className="plastic-kpi-val">₹{Number(advanceReport.summary?.totalRecovered || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">Settled via payroll & cash</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⏳</span>
                <div>
                  <span className="plastic-kpi-label">Active Outstanding</span>
                  <h3 className="plastic-kpi-val">₹{Number(advanceReport.summary?.totalOutstanding || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">Current company balance receivable</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon">👥</span>
                <div>
                  <span className="plastic-kpi-label">Ongoing Loans</span>
                  <h3 className="plastic-kpi-val">{advanceReport.summary?.activeCount || 0}</h3>
                  <small className="plastic-kpi-sub">Staff with active advances</small>
                </div>
              </div>
            </div>

            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Advance No</th>
                      <th>Disbursement Date</th>
                      <th>Employee</th>
                      <th>Department & Role</th>
                      <th>Disbursed (₹)</th>
                      <th>Recovered (₹)</th>
                      <th>Remaining Balance (₹)</th>
                      <th>Monthly Installment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(advanceReport.advances || []).length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center", padding: "2.5rem" }}>
                          No advance records found.
                        </td>
                      </tr>
                    ) : (
                      advanceReport.advances.map((a) => (
                        <tr key={a.id}>
                          <td><span className="plastic-code-badge">{a.advance_no}</span></td>
                          <td>{new Date(a.disbursement_date).toLocaleDateString("en-IN")}</td>
                          <td><strong>{a.full_name}</strong></td>
                          <td>
                            <span className="plastic-chip">{a.department}</span>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{a.designation}</div>
                          </td>
                          <td>₹{Number(a.amount).toLocaleString("en-IN")}</td>
                          <td style={{ color: "#059669" }}>₹{Number(a.recovery_amount).toLocaleString("en-IN")}</td>
                          <td>
                            <strong style={{ color: Number(a.outstanding_amount) > 0 ? "#b45309" : "#64748b" }}>
                              ₹{Number(a.outstanding_amount).toLocaleString("en-IN")}
                            </strong>
                          </td>
                          <td>₹{Number(a.monthly_installment || 0).toLocaleString("en-IN")}/mo</td>
                          <td>
                            <span className={`plastic-status-tag tag-${a.status.toLowerCase()}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticHrReports;
