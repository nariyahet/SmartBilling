import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticPayroll.css";

function PlasticPayroll() {
  const [loading, setLoading] = useState(true);
  const [payrolls, setPayrolls] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Modals
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [payslipsModalOpen, setPayslipsModalOpen] = useState(false);
  const [singleSlipModalOpen, setSingleSlipModalOpen] = useState(false);
  const [activePayroll, setActivePayroll] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Run Form
  const [runForm, setRunForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    notes: "",
  });

  const fetchPayrolls = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/payrolls", {
        params: { year: selectedYear },
      });
      if (res.data?.success) {
        setPayrolls(res.data.payrolls || []);
      }
    } catch (err) {
      console.error("Failed to fetch payroll batches:", err);
      alert("Failed to load payroll batches");
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayrolls();
  }, [fetchPayrolls]);


  const handleCreatePayrollRun = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/payrolls/generate", runForm);
      alert(res.data?.message || "Payroll generated successfully");
      setRunModalOpen(false);
      fetchPayrolls();
    } catch (err) {
      console.error("Failed to generate payroll:", err);
      alert(err.response?.data?.message || "Failed to generate payroll batch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPayslips = async (payroll) => {
    try {
      setLoading(true);
      const res = await API.get(`/plastic-erp/payrolls/${payroll.id}`);
      if (res.data?.success) {
        setActivePayroll(res.data.payroll);
        setPayslips(res.data.items || []);
        setPayslipsModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to load payslips:", err);
      alert("Failed to load payslips for this batch");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBatchStatus = async (payrollId, status) => {
    const actionText = status === "APPROVED" ? "approve" : "mark as PAID";
    if (!window.confirm(`Are you sure you want to ${actionText} this payroll batch?`)) {
      return;
    }
    try {
      const payload = { status };
      if (status === "PAID") {
        payload.payment_date = new Date().toISOString().slice(0, 10);
      }
      await API.put(`/plastic-erp/payrolls/${payrollId}/status`, payload);
      alert(`Payroll batch marked as ${status}`);
      fetchPayrolls();
      if (payslipsModalOpen) {
        setPayslipsModalOpen(false);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(err.response?.data?.message || "Failed to update payroll status");
    }
  };

  const handleDeletePayroll = async (payrollId) => {
    if (!window.confirm("Are you sure you want to delete this draft payroll run?")) return;
    try {
      await API.delete(`/plastic-erp/payrolls/${payrollId}`);
      alert("Payroll run deleted successfully");
      fetchPayrolls();
    } catch (err) {
      console.error("Failed to delete payroll:", err);
      alert(err.response?.data?.message || "Failed to delete payroll batch");
    }
  };

  const handlePrintSlip = (slip) => {
    setSelectedSlip(slip);
    setSingleSlipModalOpen(true);
  };

  // KPIs
  const totalSpend = payrolls.reduce((s, p) => s + Number(p.total_net_salary || 0), 0);
  const totalEmployeesCount = payrolls.length > 0 ? payrolls[0].total_employees : 0;
  const pendingApprovals = payrolls.filter((p) => p.status === "DRAFT").length;

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
            <h1 className="plastic-title">💰 Monthly Payroll & Payslip Register</h1>
            <p className="plastic-subtitle">
              Automated monthly salary calculation factoring attendance, shift rosters, overtime rates, and advance deductions.
            </p>
          </div>
          <button
            type="button"
            className="plastic-btn plastic-btn-primary"
            onClick={() => setRunModalOpen(true)}
          >
            ⚡ Run Monthly Payroll
          </button>
        </div>

        {/* KPI Cards */}
        <div className="plastic-kpi-grid">
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💵</span>
            <div>
              <span className="plastic-kpi-label">Annual Net Payout</span>
              <h3 className="plastic-kpi-val">₹{totalSpend.toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Total disbursed in {selectedYear}</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>👥</span>
            <div>
              <span className="plastic-kpi-label">Staff Enrolled</span>
              <h3 className="plastic-kpi-val">{totalEmployeesCount}</h3>
              <small className="plastic-kpi-sub">Last processed batch count</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⏳</span>
            <div>
              <span className="plastic-kpi-label">Draft Batches</span>
              <h3 className="plastic-kpi-val">{pendingApprovals}</h3>
              <small className="plastic-kpi-sub">Pending review & approval</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">📅</span>
            <div>
              <span className="plastic-kpi-label">Total Batches Run</span>
              <h3 className="plastic-kpi-val">{payrolls.length}</h3>
              <small className="plastic-kpi-sub">Processed runs in {selectedYear}</small>
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="plastic-filter-card">
          <div className="filter-form-inline">
            <label htmlFor="payroll-year-select" style={{ fontWeight: "700", fontSize: "0.85rem", color: "#475569" }}>
              Filter by Year:
            </label>
            <select
              id="payroll-year-select"
              className="plastic-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </div>

        {/* Payroll Batches Table */}
        {loading ? (
          <LoadingScreen />
        ) : (
          <div className="plastic-table-container">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Batch Number</th>
                  <th>Period</th>
                  <th>Employees</th>
                  <th>Gross Salary</th>
                  <th>Adv Recovered</th>
                  <th>Net Payout</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "2.5rem" }}>
                      No payroll batches generated for {selectedYear}. Click &quot;Run Monthly Payroll&quot; to initiate a run.
                    </td>
                  </tr>
                ) : (
                  payrolls.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="plastic-code-badge">{p.payroll_batch_no}</span>
                      </td>
                      <td>
                        <strong>{monthNames[p.month - 1]} {p.year}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {new Date(p.start_date).toLocaleDateString("en-IN")} - {new Date(p.end_date).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td>{p.total_employees} staff</td>
                      <td>₹{Number(p.total_gross_salary || 0).toLocaleString("en-IN")}</td>
                      <td style={{ color: "#b45309" }}>
                        ₹{Number(p.total_advances_recovered || 0).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <strong style={{ color: "#047857", fontSize: "1.05rem" }}>
                          ₹{Number(p.total_net_salary || 0).toLocaleString("en-IN")}
                        </strong>
                      </td>
                      <td>
                        <span className={`plastic-status-tag tag-${p.status.toLowerCase()}`}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="plastic-table-actions">
                          <button
                            type="button"
                            className="btn-action"
                            title="View Payslips"
                            onClick={() => handleViewPayslips(p)}
                          >
                            📑 Payslips
                          </button>
                          {p.status === "DRAFT" && (
                            <>
                              <button
                                type="button"
                                className="btn-action"
                                style={{ color: "#059669" }}
                                title="Approve Payroll"
                                onClick={() => handleUpdateBatchStatus(p.id, "APPROVED")}
                              >
                                ✅ Approve
                              </button>
                              <button
                                type="button"
                                className="btn-action"
                                style={{ color: "#b91c1c" }}
                                title="Delete Draft Run"
                                onClick={() => handleDeletePayroll(p.id)}
                              >
                                🗑️
                              </button>
                            </>
                          )}
                          {p.status === "APPROVED" && (
                            <button
                              type="button"
                              className="btn-action"
                              style={{ color: "#047857", fontWeight: "700" }}
                              title="Mark Paid"
                              onClick={() => handleUpdateBatchStatus(p.id, "PAID")}
                            >
                              💵 Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Generate Payroll Run */}
        {runModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setRunModalOpen(false)}>
            <div className="plastic-modal" style={{ maxWidth: "550px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>⚡ Run Monthly Plant Payroll</h3>
                <button type="button" className="btn-close" onClick={() => setRunModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleCreatePayrollRun}>
                <div className="plastic-modal-body">
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                    Automated payroll run will inspect daily attendance records, paid leave approvals, overtime hours, and active advance recovery schedules for all active employees.
                  </p>
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Payroll Month *</label>
                      <select
                        className="plastic-select"
                        value={runForm.month}
                        onChange={(e) => setRunForm({ ...runForm, month: Number(e.target.value) })}
                      >
                        {monthNames.map((name, i) => (
                          <option key={i + 1} value={i + 1}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Calendar Year *</label>
                      <select
                        className="plastic-select"
                        value={runForm.year}
                        onChange={(e) => setRunForm({ ...runForm, year: Number(e.target.value) })}
                      >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-field" style={{ marginTop: "14px" }}>
                    <label>Batch Processing Notes</label>
                    <textarea
                      className="plastic-textarea"
                      rows="2"
                      placeholder="e.g. Regular monthly production & plant shift payroll"
                      value={runForm.notes}
                      onChange={(e) => setRunForm({ ...runForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setRunModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Calculating..." : "Compute & Generate Batch"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Payslips List for Selected Batch */}
        {payslipsModalOpen && activePayroll && (
          <div className="plastic-modal-backdrop" onClick={() => setPayslipsModalOpen(false)}>
            <div className="plastic-modal modal-detail" style={{ maxWidth: "1050px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>
                    📑 Payslips Register — {activePayroll.payroll_batch_no} ({monthNames[activePayroll.month - 1]} {activePayroll.year})
                  </h3>
                  <small style={{ color: "var(--text-muted)" }}>
                    Total Net: ₹{Number(activePayroll.total_net_salary || 0).toLocaleString("en-IN")} • Status: {activePayroll.status}
                  </small>
                </div>
                <button type="button" className="btn-close" onClick={() => setPayslipsModalOpen(false)}>✕</button>
              </div>

              <div className="plastic-modal-body">
                <div className="plastic-table-container">
                  <table className="plastic-table">
                    <thead>
                      <tr>
                        <th>Payslip No</th>
                        <th>Employee</th>
                        <th>Present / HD</th>
                        <th>Earned Basic</th>
                        <th>OT Pay</th>
                        <th>Gross</th>
                        <th>Advance Rec</th>
                        <th>Total Ded</th>
                        <th>Net Salary</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslips.map((item) => (
                        <tr key={item.id}>
                          <td><span className="plastic-code-badge">{item.payslip_no}</span></td>
                          <td>
                            <strong>{item.full_name}</strong>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {item.employee_code} • {item.department}
                            </div>
                          </td>
                          <td>{item.present_days} / {item.half_days} HD</td>
                          <td>₹{Number(item.earned_basic || 0).toLocaleString("en-IN")}</td>
                          <td style={{ color: "#2563eb" }}>₹{Number(item.overtime_amount || 0).toLocaleString("en-IN")}</td>
                          <td><strong>₹{Number(item.gross_salary || 0).toLocaleString("en-IN")}</strong></td>
                          <td style={{ color: "#b45309" }}>-₹{Number(item.advance_recovery || 0).toLocaleString("en-IN")}</td>
                          <td style={{ color: "#b91c1c" }}>-₹{Number(item.total_deductions || 0).toLocaleString("en-IN")}</td>
                          <td>
                            <strong style={{ color: "#047857", fontSize: "1rem" }}>
                              ₹{Number(item.net_salary || 0).toLocaleString("en-IN")}
                            </strong>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="plastic-btn plastic-btn-secondary"
                              style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                              onClick={() => handlePrintSlip(item)}
                            >
                              🖨️ Payslip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="plastic-modal-footer">
                <button
                  type="button"
                  className="plastic-btn plastic-btn-primary"
                  onClick={() => setPayslipsModalOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Single Payslip Printable Layout */}
        {singleSlipModalOpen && selectedSlip && (
          <div className="plastic-modal-backdrop" onClick={() => setSingleSlipModalOpen(false)}>
            <div className="plastic-modal" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>🖨️ Payslip — {selectedSlip.payslip_no}</h3>
                <button type="button" className="btn-close" onClick={() => setSingleSlipModalOpen(false)}>✕</button>
              </div>
              <div className="plastic-modal-body">
                <div className="payslip-doc">
                  <div className="payslip-doc-header">
                    <h2>SmartBilling Plastic Recycling Plant</h2>
                    <p>Kim, Surat Industrial Zone, Gujarat • Phone: +91 98765 43210</p>
                    <div className="payslip-title-banner">
                      PAYSLIP FOR {monthNames[(activePayroll?.month || 1) - 1]?.toUpperCase()} {activePayroll?.year}
                    </div>
                  </div>

                  <div className="payslip-info-grid">
                    <div>
                      <p><strong>Employee Name:</strong> {selectedSlip.full_name}</p>
                      <p><strong>Employee Code:</strong> {selectedSlip.employee_code}</p>
                      <p><strong>Department:</strong> {selectedSlip.department}</p>
                      <p><strong>Designation:</strong> {selectedSlip.designation}</p>
                    </div>
                    <div>
                      <p><strong>Payslip No:</strong> {selectedSlip.payslip_no}</p>
                      <p><strong>Present Days:</strong> {selectedSlip.present_days} (Half: {selectedSlip.half_days})</p>
                      <p><strong>Overtime Hours:</strong> {selectedSlip.overtime_hours} hrs</p>
                      <p><strong>Bank:</strong> {selectedSlip.bank_name || "N/A"} ({selectedSlip.account_number || "N/A"})</p>
                    </div>
                  </div>

                  <div className="payslip-breakdown-grid">
                    <div className="breakdown-col">
                      <h4>Earnings</h4>
                      <div className="breakdown-row"><span>Earned Basic</span><span>₹{Number(selectedSlip.earned_basic || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-row"><span>Allowances</span><span>₹{Number(selectedSlip.allowances || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-row"><span>Overtime Pay</span><span>₹{Number(selectedSlip.overtime_amount || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-row"><span>Bonus / Incentive</span><span>₹{Number(selectedSlip.bonus_incentive || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-total"><span>Gross Earnings</span><span>₹{Number(selectedSlip.gross_salary || 0).toLocaleString("en-IN")}</span></div>
                    </div>

                    <div className="breakdown-col">
                      <h4>Deductions</h4>
                      <div className="breakdown-row"><span>Advance Recovery</span><span>₹{Number(selectedSlip.advance_recovery || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-row"><span>PF Deduction</span><span>₹{Number(selectedSlip.pf_deduction || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-row"><span>ESIC Deduction</span><span>₹{Number(selectedSlip.esic_deduction || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-row"><span>PT Deduction</span><span>₹{Number(selectedSlip.pt_deduction || 0).toLocaleString("en-IN")}</span></div>
                      <div className="breakdown-total"><span>Total Deductions</span><span>₹{Number(selectedSlip.total_deductions || 0).toLocaleString("en-IN")}</span></div>
                    </div>
                  </div>

                  <div className="payslip-net-box">
                    <span>NET TAKE-HOME PAYABLE:</span>
                    <strong style={{ fontSize: "1.4rem", color: "#047857" }}>
                      ₹{Number(selectedSlip.net_salary || 0).toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="plastic-modal-footer">
                <button
                  type="button"
                  className="plastic-btn plastic-btn-secondary"
                  onClick={() => window.print()}
                >
                  🖨️ Print
                </button>
                <button
                  type="button"
                  className="plastic-btn plastic-btn-primary"
                  onClick={() => setSingleSlipModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticPayroll;
