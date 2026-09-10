import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Modal, Button, StatusBadge } from "../components";
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
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title="Employee Advances & Loan Recoveries"
          subtitle="Manage salary advances, emergency plant loans, and automated payroll recovery schedules."
          badge="HR & RECOVERIES"
          actions={
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setDisburseModalOpen(true)}
            >
              + Disburse Advance
            </Button>
          }
        />

        {/* KPI Cards */}
        <div className="padv-kpis">
          <KpiCard
            title="Total Advanced"
            value={`₹${totalAdvanced.toLocaleString("en-IN")}`}
            subtitle="Total disbursed principal"
            variant="primary"
          />
          <KpiCard
            title="Total Recovered"
            value={`₹${totalRecovered.toLocaleString("en-IN")}`}
            subtitle="Payroll deductions & cash recoveries"
            variant="success"
          />
          <KpiCard
            title="Outstanding Balance"
            value={`₹${totalOutstanding.toLocaleString("en-IN")}`}
            subtitle="Pending factory recovery"
            variant="warning"
          />
          <KpiCard
            title="Active Advances"
            value={activeCount}
            subtitle="Staff with ongoing balance"
            variant="default"
          />
        </div>

        {/* Filter Card */}
        <Card className="padv-filter-card">
          <div className="attendance-controls-row">
            <div className="filter-group filter-search">
              <label htmlFor="adv-search">Search Staff / Advance No</label>
              <input
                id="adv-search"
                type="text"
                className="sb-input"
                placeholder="Search code, name, advance no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="adv-status">Status</label>
              <select
                id="adv-status"
                className="sb-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active (Unrecovered)</option>
                <option value="CLOSED">Closed / Fully Settled</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Advances Table */}
        <Card title={`Employee Advances & Loans (${advances.length})`}>
          {loading ? (
            <LoadingScreen message="Loading employee advances..." />
          ) : advances.length === 0 ? (
            <div className="padv-empty">No employee advances found.</div>
          ) : (
            <div className="padv-table-wrap">
              <table className="padv-table">
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
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((adv) => (
                    <tr key={adv.id}>
                      <td><span className="pemp-code-badge">{adv.advance_no}</span></td>
                      <td>{new Date(adv.disbursement_date).toLocaleDateString("en-IN")}</td>
                      <td>
                        <strong>{adv.full_name}</strong>
                        <div className="text-muted text-sm">
                          {adv.employee_code} • {adv.department}
                        </div>
                      </td>
                      <td>₹{Number(adv.amount).toLocaleString("en-IN")}</td>
                      <td className="text-success font-semibold">₹{Number(adv.recovery_amount).toLocaleString("en-IN")}</td>
                      <td>
                        <strong className={Number(adv.outstanding_amount) > 0 ? "text-warning font-bold" : "text-muted"}>
                          ₹{Number(adv.outstanding_amount).toLocaleString("en-IN")}
                        </strong>
                      </td>
                      <td>₹{Number(adv.monthly_installment || 0).toLocaleString("en-IN")}/mo</td>
                      <td>
                        <StatusBadge
                          status={adv.status}
                          variant={adv.status === "ACTIVE" ? "warning" : "success"}
                        />
                      </td>
                      <td className="text-right">
                        {adv.status === "ACTIVE" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenRepayModal(adv)}
                          >
                            💵 Repay
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal: Disburse Advance */}
        {disburseModalOpen && (
          <Modal
            isOpen={disburseModalOpen}
            onClose={() => !submitting && setDisburseModalOpen(false)}
            title="➕ Disburse Salary Advance / Loan"
            size="md"
          >
            <form onSubmit={handleDisburseSubmit} className="padv-modal-form">
              <div className="form-field">
                <label>Select Employee *</label>
                <select
                  className="sb-select"
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

              <div className="form-grid-2 mt-3">
                <div className="form-field">
                  <label>Advance Amount (₹) *</label>
                  <input
                    type="number"
                    className="sb-input"
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
                    className="sb-input"
                    value={disburseForm.disbursement_date}
                    onChange={(e) => setDisburseForm({ ...disburseForm, disbursement_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-field mt-3">
                <label>Monthly Payroll Recovery Installment (₹)</label>
                <input
                  type="number"
                  className="sb-input"
                  placeholder="e.g. 2500 (recovered each month in payroll)"
                  value={disburseForm.monthly_installment}
                  onChange={(e) => setDisburseForm({ ...disburseForm, monthly_installment: e.target.value })}
                />
              </div>

              <div className="form-field mt-3">
                <label>Purpose / Reason</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. Festival advance, hospital emergency"
                  value={disburseForm.reason}
                  onChange={(e) => setDisburseForm({ ...disburseForm, reason: e.target.value })}
                />
              </div>

              <div className="modal-footer-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setDisburseModalOpen(false)}
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
                  {submitting ? "Disbursing..." : "Confirm & Disburse"}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal: Manual Repay */}
        {repayModalOpen && selectedAdv && (
          <Modal
            isOpen={repayModalOpen}
            onClose={() => !submitting && setRepayModalOpen(false)}
            title="💵 Record Manual Cash Repayment"
            size="md"
          >
            <form onSubmit={handleRepaySubmit} className="padv-modal-form">
              <div className="repay-summary-box mb-3">
                <div>Advance: <strong>{selectedAdv.advance_no}</strong> ({selectedAdv.full_name})</div>
                <div>Outstanding Balance: <strong className="text-warning">₹{Number(selectedAdv.outstanding_amount).toLocaleString("en-IN")}</strong></div>
              </div>

              <div className="form-field">
                <label>Repayment Amount (₹) *</label>
                <input
                  type="number"
                  className="sb-input"
                  max={Number(selectedAdv.outstanding_amount)}
                  min="1"
                  value={repayForm.amount}
                  onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-field mt-3">
                <label>Receipt Notes</label>
                <input
                  type="text"
                  className="sb-input"
                  value={repayForm.notes}
                  onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setRepayModalOpen(false)}
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
                  {submitting ? "Recording..." : "Save Repayment"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default PlasticEmployeeAdvances;
