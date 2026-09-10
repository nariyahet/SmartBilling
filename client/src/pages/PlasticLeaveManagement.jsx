import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Modal, Button, StatusBadge } from "../components";
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

  const getLeaveStatusVariant = (status) => {
    switch (status) {
      case "APPROVED":
        return "success";
      case "REJECTED":
        return "danger";
      case "PENDING":
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
          title="Leave Management & Balances"
          subtitle="Manage employee leave applications, approvals, paid quota balances, and factory holiday allocations."
          badge="HR & ATTENDANCE"
          actions={
            <div className="pleave-header-actions">
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
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setApplyModalOpen(true)}
                >
                  + Apply Leave
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setInitModalOpen(true)}
                >
                  ⚙️ Initialize {selectedYear} Balances
                </Button>
              )}
            </div>
          }
        />

        {/* Requests Tab View */}
        {activeTab === "REQUESTS" && (
          <>
            {/* KPI Cards */}
            <div className="pleave-kpis">
              <KpiCard
                title="Pending Reviews"
                value={pendingCount}
                subtitle="Awaiting manager signoff"
                variant="warning"
              />
              <KpiCard
                title="Approved"
                value={approvedCount}
                subtitle="Sanctioned leaves"
                variant="success"
              />
              <KpiCard
                title="Rejected"
                value={rejectedCount}
                subtitle="Declined applications"
                variant="danger"
              />
              <KpiCard
                title="Leave Types"
                value={leaveTypes.length}
                subtitle="Configured policies (CL, SL, EL, LWP)"
                variant="info"
              />
            </div>

            {/* Filter Bar */}
            <Card className="pleave-filter-card">
              <div className="filter-form-inline">
                <label htmlFor="leave-status-select">Filter Status:</label>
                <select
                  id="leave-status-select"
                  className="sb-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Applications</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
              </div>
            </Card>

            {/* Leave Requests Table */}
            <Card title={`Leave Applications (${leaveRequests.length})`}>
              {loading ? (
                <LoadingScreen message="Loading leave applications..." />
              ) : leaveRequests.length === 0 ? (
                <div className="pleave-empty">No leave applications found.</div>
              ) : (
                <div className="pleave-table-wrap">
                  <table className="pleave-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Duration</th>
                        <th>Days</th>
                        <th>Reason / Remarks</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRequests.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.full_name}</strong>
                            <div className="text-muted text-sm">
                              {r.employee_code} • {r.department}
                            </div>
                          </td>
                          <td>
                            <span className="leave-type-badge">{r.leave_type_name} ({r.leave_type_code})</span>
                          </td>
                          <td>
                            <div>{new Date(r.start_date).toLocaleDateString("en-IN")} - {new Date(r.end_date).toLocaleDateString("en-IN")}</div>
                            <small className="text-muted">Applied: {new Date(r.created_at).toLocaleDateString("en-IN")}</small>
                          </td>
                          <td>
                            <strong>{r.total_days} day(s)</strong>
                          </td>
                          <td>
                            <div>{r.reason || "Not specified"}</div>
                            {r.approval_notes && (
                              <div className="approval-notes-text">
                                Note: {r.approval_notes}
                              </div>
                            )}
                          </td>
                          <td>
                            <StatusBadge
                              status={r.status}
                              variant={getLeaveStatusVariant(r.status)}
                            />
                          </td>
                          <td className="text-right">
                            {r.status === "PENDING" ? (
                              <div className="pleave-table-actions">
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  title="Approve Leave"
                                  onClick={() => handleStatusUpdate(r.id, "APPROVED")}
                                >
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  title="Reject Leave"
                                  onClick={() => handleStatusUpdate(r.id, "REJECTED")}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted text-sm">
                                {r.status === "APPROVED" ? `Approved by ${r.approved_by_name || "Admin"}` : "Declined"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Balances Tab View */}
        {activeTab === "BALANCES" && (
          <div className="balances-view">
            <Card className="pleave-filter-card">
              <div className="filter-form-inline">
                <label htmlFor="leave-year-select">Calendar Year:</label>
                <select
                  id="leave-year-select"
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

            <Card title={`Leave Quotas for ${selectedYear} (${balances.length} Allocations)`}>
              {loading ? (
                <LoadingScreen message="Loading leave quotas..." />
              ) : balances.length === 0 ? (
                <div className="pleave-empty">
                  No leave quotas initialized for {selectedYear}. Click &quot;Initialize {selectedYear} Balances&quot; above to allocate standard quotas.
                </div>
              ) : (
                <div className="pleave-table-wrap">
                  <table className="pleave-table">
                    <thead>
                      <tr>
                        <th>Emp Code</th>
                        <th>Employee Name</th>
                        <th>Department</th>
                        <th>Leave Type</th>
                        <th className="text-right">Annual Allocated</th>
                        <th className="text-right">Availed / Used</th>
                        <th className="text-right">Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balances.map((b) => (
                        <tr key={b.id}>
                          <td><span className="pemp-code-badge">{b.employee_code}</span></td>
                          <td><strong>{b.full_name}</strong></td>
                          <td><span className="pemp-chip">{b.department}</span></td>
                          <td><span className="leave-type-badge">{b.leave_type_name} ({b.leave_type_code})</span></td>
                          <td className="text-right">{b.total_allocated} days</td>
                          <td className="text-right font-bold text-danger">{b.used_days} days</td>
                          <td className="text-right font-bold text-success">{b.remaining_days} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Modal: Apply Leave */}
        {applyModalOpen && (
          <Modal
            isOpen={applyModalOpen}
            onClose={() => !submitting && setApplyModalOpen(false)}
            title="🏖️ Apply Leave Application"
            size="md"
          >
            <form onSubmit={handleApplySubmit} className="pleave-modal-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label>Select Employee *</label>
                  <select
                    className="sb-select"
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
                    className="sb-select"
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
                    className="sb-input"
                    value={applyForm.start_date}
                    onChange={(e) => handleDateChange("start_date", e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>To Date *</label>
                  <input
                    type="date"
                    className="sb-input"
                    value={applyForm.end_date}
                    onChange={(e) => handleDateChange("end_date", e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Total Days *</label>
                  <input
                    type="number"
                    className="sb-input"
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
                  className="sb-textarea"
                  rows="3"
                  placeholder="e.g. Family medical emergency, festival visit..."
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setApplyModalOpen(false)}
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
                  {submitting ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal: Initialize Quotas */}
        {initModalOpen && (
          <Modal
            isOpen={initModalOpen}
            onClose={() => !submitting && setInitModalOpen(false)}
            title={`⚙️ Initialize Leave Balances for ${selectedYear}`}
            size="md"
          >
            <div className="init-modal-content">
              <p>
                This action will allocate standard leave quotas (Casual: 12 days, Sick: 10 days, Earned: 15 days) for all currently active employees who do not already have records for year <strong>{selectedYear}</strong>.
              </p>
              <p className="text-muted text-sm">
                Existing records will not be overwritten.
              </p>
            </div>
            <div className="modal-footer-actions">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setInitModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleInitializeBalances}
                disabled={submitting}
              >
                {submitting ? "Allocating..." : "Confirm Allocation"}
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default PlasticLeaveManagement;
