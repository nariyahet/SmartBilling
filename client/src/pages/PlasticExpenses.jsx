import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticExpenses.css";

function PlasticExpenses() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ totalAmount: 0, paidAmount: 0, pendingAmount: 0, count: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [expenseForm, setExpenseForm] = useState({
    expense_no: "",
    category_id: "",
    title: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    description: "",
    payment_mode: "CASH",
    reference_no: "",
    vendor_name: "",
    approval_status: "APPROVED",
    payment_status: "PAID",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    code: "",
    description: "",
  });

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (categoryFilter !== "ALL") params.category_id = categoryFilter;
      if (paymentStatusFilter !== "ALL") params.payment_status = paymentStatusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const [expRes, catRes] = await Promise.all([
        API.get("/plastic-erp/expenses", { params }),
        API.get("/plastic-erp/expenses/categories"),
      ]);

      if (expRes.data?.success) {
        setExpenses(expRes.data.expenses || []);
        setSummary(expRes.data.summary || {});
      }
      if (catRes.data?.success) {
        setCategories(catRes.data.categories || []);
        if (catRes.data.categories.length > 0 && !expenseForm.category_id) {
          setExpenseForm((prev) => ({ ...prev, category_id: catRes.data.categories[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load plant expenses:", err);
      alert("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, paymentStatusFilter, fromDate, toDate, expenseForm.category_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExpenses();
  }, [fetchExpenses]);


  const handleOpenCreateModal = async () => {
    try {
      const noRes = await API.get("/plastic-erp/expenses/next-no");
      setExpenseForm({
        expense_no: noRes.data?.nextExpenseNumber || "",
        category_id: categories[0]?.id || "",
        title: "",
        amount: "",
        expense_date: new Date().toISOString().slice(0, 10),
        description: "",
        payment_mode: "CASH",
        reference_no: "",
        vendor_name: "",
        approval_status: "APPROVED",
        payment_status: "PAID",
      });
      setSelectedExpense(null);
      setRecordModalOpen(true);
    } catch (err) {
      console.error("Failed to get next expense no:", err);
      setSelectedExpense(null);
      setRecordModalOpen(true);
    }
  };

  const handleOpenEditModal = (exp) => {
    setSelectedExpense(exp);
    setExpenseForm({
      expense_no: exp.expense_no || "",
      category_id: exp.category_id || "",
      title: exp.title || "",
      amount: exp.amount || "",
      expense_date: exp.expense_date ? exp.expense_date.slice(0, 10) : "",
      description: exp.description || "",
      payment_mode: exp.payment_mode || "CASH",
      reference_no: exp.reference_no || "",
      vendor_name: exp.vendor_name || "",
      approval_status: exp.approval_status || "APPROVED",
      payment_status: exp.payment_status || "PAID",
    });
    setRecordModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.category_id || !expenseForm.title || Number(expenseForm.amount) <= 0) {
      alert("Category, title and valid amount are required");
      return;
    }

    try {
      setSubmitting(true);
      if (selectedExpense) {
        await API.put(`/plastic-erp/expenses/${selectedExpense.id}`, expenseForm);
        alert("Expense record updated successfully");
      } else {
        await API.post("/plastic-erp/expenses", expenseForm);
        alert("Expense voucher recorded successfully");
      }
      setRecordModalOpen(false);
      fetchExpenses();
    } catch (err) {
      console.error("Failed to save expense:", err);
      alert(err.response?.data?.message || "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Delete expense voucher ${exp.expense_no}?`)) return;
    try {
      await API.delete(`/plastic-erp/expenses/${exp.id}`);
      alert("Expense voucher deleted");
      fetchExpenses();
    } catch (err) {
      console.error("Failed to delete expense:", err);
      alert(err.response?.data?.message || "Failed to delete expense");
    }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name || !categoryForm.code) {
      alert("Category name and code are required");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/expenses/categories", categoryForm);
      alert("Expense category added");
      setCategoryModalOpen(false);
      setCategoryForm({ name: "", code: "", description: "" });
      fetchExpenses();
    } catch (err) {
      console.error("Failed to add category:", err);
      alert(err.response?.data?.message || "Failed to add category");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / HR & Payroll</span>
            <h1 className="plastic-title">🧾 Plant & Operational Expenses</h1>
            <p className="plastic-subtitle">
              Record power bills, machine spare parts, transport fuel, factory rent, and consumables.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="plastic-btn plastic-btn-secondary"
              onClick={() => setCategoryModalOpen(true)}
            >
              ⚙️ Manage Categories
            </button>
            <button
              type="button"
              className="plastic-btn plastic-btn-primary"
              onClick={handleOpenCreateModal}
            >
              + Record Expense Voucher
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="plastic-kpi-grid">
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>🧾</span>
            <div>
              <span className="plastic-kpi-label">Total Expenses</span>
              <h3 className="plastic-kpi-val">₹{Number(summary.totalAmount || 0).toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">{summary.count || 0} recorded vouchers</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>✅</span>
            <div>
              <span className="plastic-kpi-label">Paid Vouchers</span>
              <h3 className="plastic-kpi-val">₹{Number(summary.paidAmount || 0).toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Disbursed factory cash & bank</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⏳</span>
            <div>
              <span className="plastic-kpi-label">Pending Payment</span>
              <h3 className="plastic-kpi-val">₹{Number(summary.pendingAmount || 0).toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Accounts payable invoices</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">🏷️</span>
            <div>
              <span className="plastic-kpi-label">Expense Heads</span>
              <h3 className="plastic-kpi-val">{categories.length}</h3>
              <small className="plastic-kpi-sub">Active plant categories</small>
            </div>
          </div>
        </div>

        {/* Filter Card */}
        <div className="plastic-filter-card">
          <div className="attendance-controls-row">
            <div className="filter-group filter-search">
              <label htmlFor="exp-search">Search Vouchers</label>
              <input
                id="exp-search"
                type="text"
                className="plastic-input"
                placeholder="Search voucher, title, vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="exp-category">Category</label>
              <select
                id="exp-category"
                className="plastic-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="exp-status">Payment Status</label>
              <select
                id="exp-status"
                className="plastic-select"
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="exp-from">From</label>
              <input
                id="exp-from"
                type="date"
                className="plastic-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="exp-to">To</label>
              <input
                id="exp-to"
                type="date"
                className="plastic-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        {loading ? (
          <LoadingScreen />
        ) : (
          <div className="plastic-table-container">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Title / Purpose</th>
                  <th>Vendor / Beneficiary</th>
                  <th>Payment Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "2.5rem" }}>
                      No plant expenses recorded matching your criteria.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td><span className="plastic-code-badge">{exp.expense_no}</span></td>
                      <td>{new Date(exp.expense_date).toLocaleDateString("en-IN")}</td>
                      <td><span className="plastic-chip">{exp.category_name}</span></td>
                      <td>
                        <strong>{exp.title}</strong>
                        {exp.description && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{exp.description}</div>
                        )}
                      </td>
                      <td>{exp.vendor_name || "Direct / Internal"}</td>
                      <td>
                        <span style={{ fontSize: "0.8rem", color: "#475569" }}>{exp.payment_mode}</span>
                        {exp.reference_no && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Ref: {exp.reference_no}</div>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: "#047857", fontSize: "1rem" }}>
                          ₹{Number(exp.amount).toLocaleString("en-IN")}
                        </strong>
                      </td>
                      <td>
                        <span className={`plastic-status-tag tag-${exp.payment_status.toLowerCase()}`}>
                          {exp.payment_status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="plastic-table-actions">
                          <button
                            type="button"
                            className="btn-action btn-edit"
                            title="Edit Voucher"
                            onClick={() => handleOpenEditModal(exp)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-delete"
                            title="Delete Voucher"
                            onClick={() => handleDeleteExpense(exp)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Record Expense */}
        {recordModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setRecordModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>{selectedExpense ? "✏️ Edit Expense Voucher" : "➕ Record Plant Expense Voucher"}</h3>
                <button type="button" className="btn-close" onClick={() => setRecordModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveExpense}>
                <div className="plastic-modal-body">
                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Voucher No</label>
                      <input
                        type="text"
                        className="plastic-input"
                        value={expenseForm.expense_no}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expense_no: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Expense Head / Category *</label>
                      <select
                        className="plastic-select"
                        value={expenseForm.category_id}
                        onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                        required
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Expense Date *</label>
                      <input
                        type="date"
                        className="plastic-input"
                        value={expenseForm.expense_date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: "12px" }}>
                    <div className="form-field">
                      <label>Expense Title / Description *</label>
                      <input
                        type="text"
                        className="plastic-input"
                        placeholder="e.g. Monthly Industrial Electricity Bill"
                        value={expenseForm.title}
                        onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>Amount (₹) *</label>
                      <input
                        type="number"
                        className="plastic-input"
                        placeholder="e.g. 45000"
                        min="1"
                        step="0.01"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-grid-3" style={{ marginTop: "12px" }}>
                    <div className="form-field">
                      <label>Vendor / Beneficiary</label>
                      <input
                        type="text"
                        className="plastic-input"
                        placeholder="e.g. DGVCL, Patel Machinery"
                        value={expenseForm.vendor_name}
                        onChange={(e) => setExpenseForm({ ...expenseForm, vendor_name: e.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Payment Mode</label>
                      <select
                        className="plastic-select"
                        value={expenseForm.payment_mode}
                        onChange={(e) => setExpenseForm({ ...expenseForm, payment_mode: e.target.value })}
                      >
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                        <option value="UPI">UPI / QR</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="CREDIT_CARD">Credit Card</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Ref / UTR / Cheque No</label>
                      <input
                        type="text"
                        className="plastic-input"
                        placeholder="Reference details"
                        value={expenseForm.reference_no}
                        onChange={(e) => setExpenseForm({ ...expenseForm, reference_no: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: "12px" }}>
                    <div className="form-field">
                      <label>Payment Status</label>
                      <select
                        className="plastic-select"
                        value={expenseForm.payment_status}
                        onChange={(e) => setExpenseForm({ ...expenseForm, payment_status: e.target.value })}
                      >
                        <option value="PAID">Paid</option>
                        <option value="PENDING">Pending (Payable)</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Approval Status</label>
                      <select
                        className="plastic-select"
                        value={expenseForm.approval_status}
                        onChange={(e) => setExpenseForm({ ...expenseForm, approval_status: e.target.value })}
                      >
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING">Pending Approval</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-field" style={{ marginTop: "12px" }}>
                    <label>Internal Notes / Remarks</label>
                    <textarea
                      className="plastic-textarea"
                      rows="2"
                      placeholder="Notes on machine, repair bill breakdown, invoice reference..."
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setRecordModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : selectedExpense ? "Update Voucher" : "Save Voucher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Expense Category */}
        {categoryModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setCategoryModalOpen(false)}>
            <div className="plastic-modal" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>⚙️ Add Plant Expense Category</h3>
                <button type="button" className="btn-close" onClick={() => setCategoryModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveCategory}>
                <div className="plastic-modal-body">
                  <div className="form-field">
                    <label>Category Name *</label>
                    <input
                      type="text"
                      className="plastic-input"
                      placeholder="e.g. Effluent Treatment (ETP) Maintenance"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-field" style={{ marginTop: "12px" }}>
                    <label>Unique Code *</label>
                    <input
                      type="text"
                      className="plastic-input"
                      placeholder="e.g. ETP_MAINT"
                      value={categoryForm.code}
                      onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div className="form-field" style={{ marginTop: "12px" }}>
                    <label>Description</label>
                    <textarea
                      className="plastic-textarea"
                      rows="2"
                      placeholder="Scope of this expense head"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setCategoryModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Create Category"}
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

export default PlasticExpenses;
