import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Modal, Button, StatusBadge } from "../components";
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

  const getBatchStatusVariant = (status) => {
    switch (status) {
      case "PAID":
        return "success";
      case "APPROVED":
        return "info";
      case "DRAFT":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title="Monthly Payroll & Payslip Register"
          subtitle="Automated monthly salary calculation factoring attendance, shift rosters, overtime rates, and advance deductions."
          badge="HR & PAYROLL"
          actions={
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setRunModalOpen(true)}
            >
              ⚡ Run Monthly Payroll
            </Button>
          }
        />

        {/* KPI Cards */}
        <div className="ppay-kpis">
          <KpiCard
            title="Annual Net Payout"
            value={`₹${totalSpend.toLocaleString("en-IN")}`}
            subtitle={`Total disbursed in ${selectedYear}`}
            variant="success"
          />
          <KpiCard
            title="Staff Enrolled"
            value={totalEmployeesCount}
            subtitle="Last processed batch count"
            variant="primary"
          />
          <KpiCard
            title="Draft Batches"
            value={pendingApprovals}
            subtitle="Pending review & approval"
            variant="warning"
          />
          <KpiCard
            title="Total Batches Run"
            value={payrolls.length}
            subtitle={`Processed runs in ${selectedYear}`}
            variant="default"
          />
        </div>

        {/* Filter Card */}
        <Card className="ppay-filter-card">
          <div className="filter-form-inline">
            <label htmlFor="payroll-year-select">Filter by Year:</label>
            <select
              id="payroll-year-select"
              className="sb-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </Card>

        {/* Payroll Batches Table */}
        <Card title={`Payroll Batches (${payrolls.length})`}>
          {loading ? (
            <LoadingScreen message="Loading payroll batches..." />
          ) : payrolls.length === 0 ? (
            <div className="ppay-empty">
              No payroll batches generated for {selectedYear}. Click &quot;Run Monthly Payroll&quot; to initiate a run.
            </div>
          ) : (
            <div className="ppay-table-wrap">
              <table className="ppay-table">
                <thead>
                  <tr>
                    <th>Batch Number</th>
                    <th>Period</th>
                    <th>Employees</th>
                    <th>Gross Salary</th>
                    <th>Adv Recovered</th>
                    <th>Net Payout</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="pemp-code-badge">{p.payroll_batch_no}</span>
                      </td>
                      <td>
                        <strong>{monthNames[p.month - 1]} {p.year}</strong>
                        <div className="text-muted text-sm">
                          {new Date(p.start_date).toLocaleDateString("en-IN")} - {new Date(p.end_date).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td>{p.total_employees} staff</td>
                      <td>₹{Number(p.total_gross_salary || 0).toLocaleString("en-IN")}</td>
                      <td className="text-warning">
                        ₹{Number(p.total_advances_recovered || 0).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <strong className="text-success font-bold">
                          ₹{Number(p.total_net_salary || 0).toLocaleString("en-IN")}
                        </strong>
                      </td>
                      <td>
                        <StatusBadge
                          status={p.status}
                          variant={getBatchStatusVariant(p.status)}
                        />
                      </td>
                      <td className="text-right">
                        <div className="ppay-table-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            title="View Payslips"
                            onClick={() => handleViewPayslips(p)}
                          >
                            📑 Payslips
                          </Button>
                          {p.status === "DRAFT" && (
                            <>
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                title="Approve Payroll"
                                onClick={() => handleUpdateBatchStatus(p.id, "APPROVED")}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Delete Draft Run"
                                onClick={() => handleDeletePayroll(p.id)}
                              >
                                🗑️
                              </Button>
                            </>
                          )}
                          {p.status === "APPROVED" && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              title="Mark Paid"
                              onClick={() => handleUpdateBatchStatus(p.id, "PAID")}
                            >
                              💵 Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal: Generate Payroll Run */}
        {runModalOpen && (
          <Modal
            isOpen={runModalOpen}
            onClose={() => !submitting && setRunModalOpen(false)}
            title="⚡ Run Monthly Plant Payroll"
            size="md"
          >
            <form onSubmit={handleCreatePayrollRun} className="ppay-modal-form">
              <p className="text-muted text-sm mb-3">
                Automated payroll run will inspect daily attendance records, paid leave approvals, overtime hours, and active advance recovery schedules for all active employees.
              </p>
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Payroll Month *</label>
                  <select
                    className="sb-select"
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
                    className="sb-select"
                    value={runForm.year}
                    onChange={(e) => setRunForm({ ...runForm, year: Number(e.target.value) })}
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              <div className="form-field mt-3">
                <label>Batch Processing Notes</label>
                <textarea
                  className="sb-textarea"
                  rows="2"
                  placeholder="e.g. Regular monthly production & plant shift payroll"
                  value={runForm.notes}
                  onChange={(e) => setRunForm({ ...runForm, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setRunModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting}
                >
                  {submitting ? "Calculating..." : "Compute & Generate Batch"}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal: Payslips List for Selected Batch */}
        {payslipsModalOpen && activePayroll && (
          <Modal
            isOpen={payslipsModalOpen}
            onClose={() => setPayslipsModalOpen(false)}
            title={`📑 Payslips Register — ${activePayroll.payroll_batch_no} (${monthNames[activePayroll.month - 1]} ${activePayroll.year})`}
            size="lg"
          >
            <div className="payslips-batch-summary">
              <span className="text-muted">Total Net: </span>
              <strong className="text-success">₹{Number(activePayroll.total_net_salary || 0).toLocaleString("en-IN")}</strong>
              <span className="summary-divider">•</span>
              <span className="text-muted">Status: </span>
              <StatusBadge status={activePayroll.status} variant={getBatchStatusVariant(activePayroll.status)} />
            </div>

            <div className="ppay-table-wrap mt-3">
              <table className="ppay-table">
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
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((item) => (
                    <tr key={item.id}>
                      <td><span className="pemp-code-badge">{item.payslip_no}</span></td>
                      <td>
                        <strong>{item.full_name}</strong>
                        <div className="text-muted text-sm">
                          {item.employee_code} • {item.department}
                        </div>
                      </td>
                      <td>{item.present_days} / {item.half_days} HD</td>
                      <td>₹{Number(item.earned_basic || 0).toLocaleString("en-IN")}</td>
                      <td className="text-primary font-semibold">₹{Number(item.overtime_amount || 0).toLocaleString("en-IN")}</td>
                      <td><strong>₹{Number(item.gross_salary || 0).toLocaleString("en-IN")}</strong></td>
                      <td className="text-warning">-₹{Number(item.advance_recovery || 0).toLocaleString("en-IN")}</td>
                      <td className="text-danger">-₹{Number(item.total_deductions || 0).toLocaleString("en-IN")}</td>
                      <td>
                        <strong className="text-success">
                          ₹{Number(item.net_salary || 0).toLocaleString("en-IN")}
                        </strong>
                      </td>
                      <td className="text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePrintSlip(item)}
                        >
                          🖨️ Payslip
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer-actions">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setPayslipsModalOpen(false)}
              >
                Done
              </Button>
            </div>
          </Modal>
        )}

        {/* Modal: Single Payslip Printable Layout */}
        {singleSlipModalOpen && selectedSlip && (
          <Modal
            isOpen={singleSlipModalOpen}
            onClose={() => setSingleSlipModalOpen(false)}
            title={`🖨️ Payslip — ${selectedSlip.payslip_no}`}
            size="md"
          >
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
                <strong className="payslip-net-amount">
                  ₹{Number(selectedSlip.net_salary || 0).toLocaleString("en-IN")}
                </strong>
              </div>
            </div>

            <div className="modal-footer-actions">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => window.print()}
              >
                🖨️ Print
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setSingleSlipModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default PlasticPayroll;
