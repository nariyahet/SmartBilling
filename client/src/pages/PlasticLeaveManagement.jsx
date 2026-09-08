import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticLeaveManagement.css";

function PlasticLeaveManagement() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("REQUESTS"); // 'REQUESTS' or 'BALANCES'
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [balances, setBalances] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [applyForm, setApplyForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    total_days: 1,
    reason: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [reqRes, typeRes, empRes] = await Promise.all([
        API.get("/plastic-erp/leaves/requests", {
          params: { status: statusFilter !== "ALL" ? statusFilter : undefined },
        }),
        API.get("/plastic-erp/leaves/types"),
        API.get("/plastic-erp/employees", { params: { status: "ACTIVE" } }),
      ]);

      if (reqRes.data?.success) setLeaveRequests(reqRes.data.requests || []);
      if (typeRes.data?.success) {
        setLeaveTypes(typeRes.data.leaveTypes || []);
        if (typeRes.data.leaveTypes.length > 0 && !applyForm.leave_type_id) {
          setApplyForm((prev) => ({ ...prev, leave_type_id: typeRes.data.leaveTypes[0].id }));
        }
      }
      if (empRes.data?.employees) {
        setEmployees(empRes.data.employees || []);
        if (empRes.data.employees.length > 0 && !applyForm.employee_id) {
          setApplyForm((prev) => ({ ...prev, employee_id: empRes.data.employees[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load leave data:", err);
      alert("Failed to load leave management data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, applyForm.employee_id, applyForm.leave_type_id]);

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/leaves/balances", {
        params: { year: selectedYear },
      });
      if (res.data?.success) setBalances(res.data.balances || []);
    } catch (err) {
      console.error("Failed to load balances:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const loadLeaveData = useCallback(() => {
    if (activeTab === "REQUESTS") {
      fetchData();
    } else {
      fetchBalances();
    }
  }, [activeTab, fetchData, fetchBalances]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLeaveData();
  }, [loadLeaveData]);




  // Recalculate days when start/end changes
  const handleDateChange = (field, val) => {
    const updated = { ...applyForm, [field]: val };
    const d1 = new Date(updated.start_date);
    const d2 = new Date(updated.end_date);
    if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      updated.total_days = diffDays;
    }
    setApplyForm(updated);
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applyForm.employee_id || !applyForm.leave_type_id || !applyForm.start_date || !applyForm.end_date) {
      alert("Please fill in all mandatory fields");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/leaves/requests", applyForm);
      alert("Leave application submitted successfully");
      setApplyModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to apply leave:", err);
      alert(err.response?.data?.message || "Failed to apply leave");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (reqId, status) => {
    const actionName = status === "APPROVED" ? "Approve" : "Reject";
    const comments = window.prompt(`Enter review notes to ${actionName} this leave:`, `${actionName}d by plant manager`);
    if (comments === null) return;

    try {
      await API.put(`/plastic-erp/leaves/requests/${reqId}/status`, {
        status,
        approval_notes: comments,
      });
      alert(`Leave request ${status.toLowerCase()} successfully`);
      fetchData();
    } catch (err) {
      console.error("Failed to update leave status:", err);
      alert(err.response?.data?.message || "Failed to update leave status");
    }
  };

  const handleInitializeBalances = async () => {
    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/leaves/initialize-balances", { year: selectedYear });
      alert(res.data?.message || "Annual leave balances allocated successfully");
      setInitModalOpen(false);
      fetchBalances();
    } catch (err) {
      console.error("Failed to initialize balances:", err);
      alert(err.response?.data?.message || "Failed to allocate balances");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const pendingCount = leaveRequests.filter((r) => r.status === "PENDING").length;
  const approvedCount = leaveRequests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = leaveRequests.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / HR & Payroll</span>
            <h1 className="plastic-title">🏖️ Leave Management & Balances</h1>
            <p className="plastic-subtitle">
              Manage employee leave applications, approvals, paid quota balances, and factory holiday allocations.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div className="tab-pills">
              <button
                type="button"
                className={`pill-btn ${activeTab === "REQUESTS" ? "active" : ""}`}
                onClick={() => setActiveTab("REQUESTS")}
              >
                📋 Leave Applications
              </button>
              <button
                type="button"
                className={`pill-btn ${activeTab === "BALANCES" ? "active" : ""}`}
                onClick={() => setActiveTab("BALANCES")}
              >
                📊 Annual Quotas
              </button>
            </div>
            {activeTab === "REQUESTS" ? (
              <button
                type="button"
                className="plastic-btn plastic-btn-primary"
                onClick={() => setApplyModalOpen(true)}
              >
                + Apply Leave
              </button>
            ) : (
              <button
                type="button"
                className="plastic-btn plastic-btn-secondary"
                onClick={() => setInitModalOpen(true)}
              >
                ⚙️ Initialize {selectedYear} Balances
              </button>
            )}
          </div>
        </div>

        {/* Requests Tab View */}
        {activeTab === "REQUESTS" && (
          <>
            {/* KPI Cards */}
            <div className="plastic-kpi-grid">
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⏳</span>
                <div>
                  <span className="plastic-kpi-label">Pending Reviews</span>
                  <h3 className="plastic-kpi-val">{pendingCount}</h3>
                  <small className="plastic-kpi-sub">Awaiting manager signoff</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>✅</span>
                <div>
                  <span className="plastic-kpi-label">Approved</span>
                  <h3 className="plastic-kpi-val">{approvedCount}</h3>
                  <small className="plastic-kpi-sub">Sanctioned leaves</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>❌</span>
                <div>
                  <span className="plastic-kpi-label">Rejected</span>
                  <h3 className="plastic-kpi-val">{rejectedCount}</h3>
                  <small className="plastic-kpi-sub">Declined applications</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>🏷️</span>
                <div>
                  <span className="plastic-kpi-label">Leave Types</span>
                  <h3 className="plastic-kpi-val">{leaveTypes.length}</h3>
                  <small className="plastic-kpi-sub">Configured policies (CL, SL, EL, LWP)</small>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="plastic-filter-card">
              <div className="filter-form-inline">
                <label htmlFor="leave-status-select" style={{ fontWeight: "700", fontSize: "0.85rem", color: "#475569" }}>
                  Filter Status:
                </label>
                <select
                  id="leave-status-select"
                  className="plastic-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Applications</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
              </div>
            </div>

            {/* Leave Requests Table */}
            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Duration</th>
                      <th>Days</th>
                      <th>Reason / Remarks</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem" }}>
                          No leave applications found.
                        </td>
                      </tr>
                    ) : (
                      leaveRequests.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.full_name}</strong>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {r.employee_code} • {r.department}
                            </div>
                          </td>
                          <td>
                            <span className="leave-type-badge">{r.leave_type_name} ({r.leave_type_code})</span>
                          </td>
                          <td>
                            <div>{new Date(r.start_date).toLocaleDateString("en-IN")} - {new Date(r.end_date).toLocaleDateString("en-IN")}</div>
                            <small style={{ color: "var(--text-muted)" }}>Applied: {new Date(r.created_at).toLocaleDateString("en-IN")}</small>
                          </td>
                          <td>
                            <strong>{r.total_days} day(s)</strong>
                          </td>
                          <td>
                            <div>{r.reason || "Not specified"}</div>
                            {r.approval_notes && (
                              <div style={{ fontSize: "0.75rem", color: "#059669", fontStyle: "italic" }}>
                                Note: {r.approval_notes}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`plastic-status-tag tag-${r.status.toLowerCase()}`}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {r.status === "PENDING" ? (
                              <div className="plastic-table-actions">
                                <button
                                  type="button"
                                  className="btn-action btn-approve"
                                  title="Approve Leave"
                                  onClick={() => handleStatusUpdate(r.id, "APPROVED")}
                                >
                                  ✅ Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn-action btn-reject"
                                  title="Reject Leave"
                                  onClick={() => handleStatusUpdate(r.id, "REJECTED")}
                                >
                                  ❌ Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {r.status === "APPROVED" ? `Approved by ${r.approved_by_name || "Admin"}` : "Declined"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Balances Tab View */}
        {activeTab === "BALANCES" && (
          <div className="balances-view">
            <div className="plastic-filter-card">
              <div className="filter-form-inline">
                <label htmlFor="leave-year-select" style={{ fontWeight: "700", fontSize: "0.85rem", color: "#475569" }}>
                  Calendar Year:
                </label>
                <select
                  id="leave-year-select"
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

            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Emp Code</th>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Leave Type</th>
                      <th>Annual Allocated</th>
                      <th>Availed / Used</th>
                      <th>Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem" }}>
                          No leave quotas initialized for {selectedYear}. Click &quot;Initialize {selectedYear} Balances&quot; above to allocate standard quotas.
                        </td>
                      </tr>
                    ) : (
                      balances.map((b) => (
                        <tr key={b.id}>
                          <td><span className="plastic-code-badge">{b.employee_code}</span></td>
                          <td><strong>{b.full_name}</strong></td>
                          <td><span className="plastic-chip">{b.department}</span></td>
                          <td><span className="leave-type-badge">{b.leave_type_name} ({b.leave_type_code})</span></td>
                          <td>{b.total_allocated} days</td>
                          <td style={{ color: "#b91c1c", fontWeight: "700" }}>{b.used_days} days</td>
                          <td><strong style={{ color: "#059669", fontSize: "1rem" }}>{b.remaining_days} days</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Apply Leave */}
        {applyModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setApplyModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>🏖️ Apply Leave Application</h3>
                <button type="button" className="btn-close" onClick={() => setApplyModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleApplySubmit}>
                <div className="plastic-modal-body">
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Select Employee *</label>
                      <select
                        className="plastic-select"
                        value={applyForm.employee_id}
                        onChange={(e) => setApplyForm({ ...applyForm, employee_id: e.target.value })}
                        required
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.employee_code} - {emp.department})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Leave Category / Policy *</label>
                      <select
                        className="plastic-select"
                        value={applyForm.leave_type_id}
                        onChange={(e) => setApplyForm({ ...applyForm, leave_type_id: e.target.value })}
                        required
                      >
                        {leaveTypes.map((lt) => (
                          <option key={lt.id} value={lt.id}>
                            {lt.name} ({lt.code}) — {lt.is_paid ? "Paid" : "Unpaid"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>From Date *</label>
                      <input
                        type="date"
                        className="plastic-input"
                        value={applyForm.start_date}
                        onChange={(e) => handleDateChange("start_date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>To Date *</label>
                      <input
                        type="date"
                        className="plastic-input"
                        value={applyForm.end_date}
                        onChange={(e) => handleDateChange("end_date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Total Days *</label>
                      <input
                        type="number"
                        className="plastic-input"
                        value={applyForm.total_days}
                        min="0.5"
                        step="0.5"
                        onChange={(e) => setApplyForm({ ...applyForm, total_days: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Reason for Leave *</label>
                    <textarea
                      className="plastic-textarea"
                      rows="3"
                      placeholder="e.g. Family medical emergency, festival visit..."
                      value={applyForm.reason}
                      onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setApplyModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit Application"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Initialize Quotas */}
        {initModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setInitModalOpen(false)}>
            <div className="plastic-modal" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>⚙️ Initialize Leave Balances for {selectedYear}</h3>
                <button type="button" className="btn-close" onClick={() => setInitModalOpen(false)}>✕</button>
              </div>
              <div className="plastic-modal-body">
                <p>
                  This action will allocate standard leave quotas (Casual: 12 days, Sick: 10 days, Earned: 15 days) for all currently active employees who do not already have records for year <strong>{selectedYear}</strong>.
                </p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Existing records will not be overwritten.
                </p>
              </div>
              <div className="plastic-modal-footer">
                <button
                  type="button"
                  className="plastic-btn plastic-btn-ghost"
                  onClick={() => setInitModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="plastic-btn plastic-btn-primary"
                  onClick={handleInitializeBalances}
                  disabled={submitting}
                >
                  {submitting ? "Allocating..." : "Confirm Allocation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticLeaveManagement;
