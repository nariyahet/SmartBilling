import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticEmployeeAdvances.css";

function PlasticEmployeeAdvances() {
  const [loading, setLoading] = useState(true);
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Modals
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [selectedAdv, setSelectedAdv] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [disburseForm, setDisburseForm] = useState({
    employee_id: "",
    amount: "",
    disbursement_date: new Date().toISOString().slice(0, 10),
    monthly_installment: "",
    reason: "",
    notes: "",
  });

  const [repayForm, setRepayForm] = useState({
    amount: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [advRes, empRes] = await Promise.all([
        API.get("/plastic-erp/advances", {
          params: {
            status: statusFilter !== "ALL" ? statusFilter : undefined,
            search: search || undefined,
          },
        }),
        API.get("/plastic-erp/employees", { params: { status: "ACTIVE" } }),
      ]);

      if (advRes.data?.success) setAdvances(advRes.data.advances || []);
      if (empRes.data?.employees) {
        setEmployees(empRes.data.employees || []);
        if (empRes.data.employees.length > 0 && !disburseForm.employee_id) {
          setDisburseForm((prev) => ({ ...prev, employee_id: empRes.data.employees[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load advances data:", err);
      alert("Failed to load advances");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, disburseForm.employee_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);


  const handleDisburseSubmit = async (e) => {
    e.preventDefault();
    if (!disburseForm.employee_id || Number(disburseForm.amount) <= 0) {
      alert("Employee and valid advance amount are required");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/advances", disburseForm);
      alert("Employee advance disbursed successfully");
      setDisburseModalOpen(false);
      setDisburseForm({
        employee_id: employees[0]?.id || "",
        amount: "",
        disbursement_date: new Date().toISOString().slice(0, 10),
        monthly_installment: "",
        reason: "",
        notes: "",
      });
      fetchData();
    } catch (err) {
      console.error("Failed to disburse advance:", err);
      alert(err.response?.data?.message || "Failed to disburse advance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRepayModal = (adv) => {
    setSelectedAdv(adv);
    setRepayForm({
      amount: String(adv.outstanding_amount),
      notes: "Manual cash recovery by plant cashier",
    });
    setRepayModalOpen(true);
  };

  const handleRepaySubmit = async (e) => {
    e.preventDefault();
    if (Number(repayForm.amount) <= 0) {
      alert("Recovery amount must be greater than 0");
      return;
    }

    try {
      setSubmitting(true);
      await API.post(`/plastic-erp/advances/${selectedAdv.id}/repay`, repayForm);
      alert("Repayment recorded successfully");
      setRepayModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to record repayment:", err);
      alert(err.response?.data?.message || "Failed to record repayment");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalAdvanced = advances.reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalRecovered = advances.reduce((s, a) => s + Number(a.recovery_amount || 0), 0);
  const totalOutstanding = advances.reduce((s, a) => s + Number(a.outstanding_amount || 0), 0);
  const activeCount = advances.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / HR & Payroll</span>
            <h1 className="plastic-title">💳 Employee Advances & Loan Recoveries</h1>
            <p className="plastic-subtitle">
              Manage salary advances, emergency plant loans, and automated payroll recovery schedules.
            </p>
          </div>
          <button
            type="button"
            className="plastic-btn plastic-btn-primary"
            onClick={() => setDisburseModalOpen(true)}
          >
            + Disburse Advance
          </button>
        </div>

        {/* KPI Cards */}
        <div className="plastic-kpi-grid">
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>💳</span>
            <div>
              <span className="plastic-kpi-label">Total Advanced</span>
              <h3 className="plastic-kpi-val">₹{totalAdvanced.toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Total disbursed principal</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>🔄</span>
            <div>
              <span className="plastic-kpi-label">Total Recovered</span>
              <h3 className="plastic-kpi-val">₹{totalRecovered.toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Payroll deductions & cash recoveries</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⏳</span>
            <div>
              <span className="plastic-kpi-label">Outstanding Balance</span>
              <h3 className="plastic-kpi-val">₹{totalOutstanding.toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Pending factory recovery</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">👥</span>
            <div>
              <span className="plastic-kpi-label">Active Advances</span>
              <h3 className="plastic-kpi-val">{activeCount}</h3>
              <small className="plastic-kpi-sub">Staff currently with ongoing balance</small>
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="plastic-filter-card">
          <div className="attendance-controls-row">
            <div className="filter-group filter-search">
              <label htmlFor="adv-search">Search Staff / Advance No</label>
              <input
                id="adv-search"
                type="text"
                className="plastic-input"
                placeholder="Search code, name, advance no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="adv-status">Status</label>
              <select
                id="adv-status"
                className="plastic-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active (Unrecovered)</option>
                <option value="CLOSED">Closed / Fully Settled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Advances Table */}
        {loading ? (
          <LoadingScreen />
        ) : (
          <div className="plastic-table-container">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Advance No</th>
                  <th>Disbursed Date</th>
                  <th>Employee</th>
                  <th>Principal</th>
                  <th>Recovered</th>
                  <th>Outstanding</th>
                  <th>Monthly Installment</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "2.5rem" }}>
                      No employee advances found.
                    </td>
                  </tr>
                ) : (
                  advances.map((adv) => (
                    <tr key={adv.id}>
                      <td><span className="plastic-code-badge">{adv.advance_no}</span></td>
                      <td>{new Date(adv.disbursement_date).toLocaleDateString("en-IN")}</td>
                      <td>
                        <strong>{adv.full_name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {adv.employee_code} • {adv.department}
                        </div>
                      </td>
                      <td>₹{Number(adv.amount).toLocaleString("en-IN")}</td>
                      <td style={{ color: "#059669" }}>₹{Number(adv.recovery_amount).toLocaleString("en-IN")}</td>
                      <td>
                        <strong style={{ color: Number(adv.outstanding_amount) > 0 ? "#b45309" : "#64748b", fontSize: "0.95rem" }}>
                          ₹{Number(adv.outstanding_amount).toLocaleString("en-IN")}
                        </strong>
                      </td>
                      <td>₹{Number(adv.monthly_installment || 0).toLocaleString("en-IN")}/mo</td>
                      <td>
                        <span className={`plastic-status-tag tag-${adv.status.toLowerCase()}`}>
                          {adv.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {adv.status === "ACTIVE" && (
                          <button
                            type="button"
                            className="plastic-btn plastic-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                            onClick={() => handleOpenRepayModal(adv)}
                          >
                            💵 Repay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Disburse Advance */}
        {disburseModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setDisburseModalOpen(false)}>
            <div className="plastic-modal" style={{ maxWidth: "580px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>➕ Disburse Salary Advance / Loan</h3>
                <button type="button" className="btn-close" onClick={() => setDisburseModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleDisburseSubmit}>
                <div className="plastic-modal-body">
                  <div className="form-field">
                    <label>Select Employee *</label>
                    <select
                      className="plastic-select"
                      value={disburseForm.employee_id}
                      onChange={(e) => setDisburseForm({ ...disburseForm, employee_id: e.target.value })}
                      required
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.employee_code} - {emp.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: "12px" }}>
                    <div className="form-field">
                      <label>Advance Amount (₹) *</label>
                      <input
                        type="number"
                        className="plastic-input"
                        placeholder="e.g. 10000"
                        min="100"
                        value={disburseForm.amount}
                        onChange={(e) => setDisburseForm({ ...disburseForm, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Disbursement Date *</label>
                      <input
                        type="date"
                        className="plastic-input"
                        value={disburseForm.disbursement_date}
                        onChange={(e) => setDisburseForm({ ...disburseForm, disbursement_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field" style={{ marginTop: "12px" }}>
                    <label>Monthly Payroll Recovery Installment (₹)</label>
                    <input
                      type="number"
                      className="plastic-input"
                      placeholder="e.g. 2500 (recovered each month in payroll)"
                      value={disburseForm.monthly_installment}
                      onChange={(e) => setDisburseForm({ ...disburseForm, monthly_installment: e.target.value })}
                    />
                  </div>

                  <div className="form-field" style={{ marginTop: "12px" }}>
                    <label>Purpose / Reason</label>
                    <input
                      type="text"
                      className="plastic-input"
                      placeholder="e.g. Festival advance, hospital emergency"
                      value={disburseForm.reason}
                      onChange={(e) => setDisburseForm({ ...disburseForm, reason: e.target.value })}
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setDisburseModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Disbursing..." : "Confirm & Disburse"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Manual Repay */}
        {repayModalOpen && selectedAdv && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setRepayModalOpen(false)}>
            <div className="plastic-modal" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>💵 Record Manual Cash Repayment</h3>
                <button type="button" className="btn-close" onClick={() => setRepayModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleRepaySubmit}>
                <div className="plastic-modal-body">
                  <p style={{ margin: "0 0 12px 0" }}>
                    Advance: <strong>{selectedAdv.advance_no}</strong> ({selectedAdv.full_name})<br />
                    Outstanding Balance: <strong>₹{Number(selectedAdv.outstanding_amount).toLocaleString("en-IN")}</strong>
                  </p>

                  <div className="form-field">
                    <label>Repayment Amount (₹) *</label>
                    <input
                      type="number"
                      className="plastic-input"
                      max={Number(selectedAdv.outstanding_amount)}
                      min="1"
                      value={repayForm.amount}
                      onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-field" style={{ marginTop: "12px" }}>
                    <label>Receipt Notes</label>
                    <input
                      type="text"
                      className="plastic-input"
                      value={repayForm.notes}
                      onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setRepayModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Recording..." : "Save Repayment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticEmployeeAdvances;
