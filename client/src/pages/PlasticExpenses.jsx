import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, StatusBadge, Modal } from "../components";
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
        const cats = catRes.data.categories || [];
        setCategories(cats);
        if (cats.length > 0 && !expenseForm.category_id) {
          setExpenseForm((prev) => ({ ...prev, category_id: cats[0].id }));
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

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setPaymentStatusFilter("ALL");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="Plant & Operational Expenses"
          subtitle="Record and monitor power bills, machine spare parts, transport fuel, factory rent, and consumables"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "HR & Workforce", to: "/plastic-erp/hr" },
            { label: "Plant Expenses" },
          ]}
          actions={
            <div className="expenses-action-group">
              <Button
                variant="outline"
                icon="⚙️"
                onClick={() => setCategoryModalOpen(true)}
              >
                Manage Categories
              </Button>
              <Button
                variant="primary"
                icon="➕"
                onClick={handleOpenCreateModal}
              >
                Record Expense Voucher
              </Button>
            </div>
          }
        />

        {/* KPI Grid */}
        <div className="expenses-kpis-grid">
          <KpiCard
            title="Total Expenses"
            value={`₹${Number(summary.totalAmount || 0).toLocaleString("en-IN")}`}
            subtitle={`${summary.count || 0} recorded vouchers`}
            icon="🧾"
            color="navy"
          />
          <KpiCard
            title="Paid Vouchers"
            value={`₹${Number(summary.paidAmount || 0).toLocaleString("en-IN")}`}
            subtitle="Disbursed cash & bank"
            icon="✅"
            color="teal"
          />
          <KpiCard
            title="Pending Payment"
            value={`₹${Number(summary.pendingAmount || 0).toLocaleString("en-IN")}`}
            subtitle="Accounts payable obligations"
            icon="⏳"
            color="amber"
          />
          <KpiCard
            title="Expense Heads"
            value={categories.length}
            subtitle="Active expense categories"
            icon="🏷️"
            color="blue"
          />
        </div>

        {/* Filter Card */}
        <Card className="expenses-filter-card">
          <div className="expenses-filter-grid">
            <div className="filter-item">
              <label htmlFor="exp-search">Search Vouchers</label>
              <input
                id="exp-search"
                type="text"
                className="sb-input"
                placeholder="Search voucher, title, vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-item">
              <label htmlFor="exp-category">Category</label>
              <select
                id="exp-category"
                className="sb-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label htmlFor="exp-status">Payment Status</label>
              <select
                id="exp-status"
                className="sb-select"
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            <div className="filter-item">
              <label htmlFor="exp-from">From Date</label>
              <input
                id="exp-from"
                type="date"
                className="sb-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="filter-item">
              <label htmlFor="exp-to">To Date</label>
              <input
                id="exp-to"
                type="date"
                className="sb-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="filter-item filter-actions-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Expenses List */}
        <Card
          title="Expense Vouchers Register"
          subtitle={`Displaying ${expenses.length} voucher records`}
          actions={
            <Button variant="ghost" size="sm" icon="🔄" onClick={fetchExpenses}>
              Refresh
            </Button>
          }
        >
          {loading ? (
            <LoadingScreen />
          ) : (
            <div className="expenses-table-wrapper">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th>Voucher No</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Title & Description</th>
                    <th>Vendor / Beneficiary</th>
                    <th>Payment Mode</th>
                    <th className="cell-right">Amount</th>
                    <th>Payment</th>
                    <th>Approval</th>
                    <th className="cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="expenses-table-empty">
                        <div className="empty-state">
                          <span className="empty-icon">🧾</span>
                          <p>No plant expenses recorded matching your criteria.</p>
                          <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
                            Record First Expense
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>
                          <span className="voucher-code-badge">{exp.expense_no}</span>
                        </td>
                        <td>
                          <span className="voucher-date">
                            {new Date(exp.expense_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                        </td>
                        <td>
                          <span className="category-chip">{exp.category_name}</span>
                        </td>
                        <td>
                          <div className="voucher-title">{exp.title}</div>
                          {exp.description && (
                            <div className="voucher-desc">{exp.description}</div>
                          )}
                        </td>
                        <td>
                          <span className="vendor-name">{exp.vendor_name || "Direct / Internal"}</span>
                        </td>
                        <td>
                          <div className="payment-mode-tag">{exp.payment_mode}</div>
                          {exp.reference_no && (
                            <div className="voucher-ref">Ref: {exp.reference_no}</div>
                          )}
                        </td>
                        <td className="cell-right">
                          <span className="voucher-amount">
                            ₹{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={exp.payment_status} />
                        </td>
                        <td>
                          <StatusBadge status={exp.approval_status} />
                        </td>
                        <td className="cell-right">
                          <div className="row-actions">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="✏️"
                              title="Edit Voucher"
                              onClick={() => handleOpenEditModal(exp)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="🗑️"
                              title="Delete Voucher"
                              onClick={() => handleDeleteExpense(exp)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal: Record / Edit Expense */}
        <Modal
          isOpen={recordModalOpen}
          onClose={() => !submitting && setRecordModalOpen(false)}
          title={selectedExpense ? "Edit Expense Voucher" : "Record Plant Expense Voucher"}
          subtitle="Log operating expenses against plant cost centers and categories"
          size="lg"
        >
          <form onSubmit={handleSaveExpense} className="expense-form">
            <div className="form-grid-3">
              <div className="form-group">
                <label className="sb-label">Voucher No *</label>
                <input
                  type="text"
                  className="sb-input"
                  value={expenseForm.expense_no}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_no: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Category Head *</label>
                <select
                  className="sb-select"
                  value={expenseForm.category_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="sb-label">Expense Date *</label>
                <input
                  type="date"
                  className="sb-input"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Expense Title / Description *</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. Industrial Electricity Bill — HT Feed"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Amount (₹) *</label>
                <input
                  type="number"
                  className="sb-input"
                  placeholder="e.g. 45000"
                  min="1"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="sb-label">Vendor / Beneficiary</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. DGVCL / Torrent Power"
                  value={expenseForm.vendor_name}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Payment Mode</label>
                <select
                  className="sb-select"
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
              <div className="form-group">
                <label className="sb-label">Ref / UTR / Cheque No</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="Reference number"
                  value={expenseForm.reference_no}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reference_no: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Payment Status</label>
                <select
                  className="sb-select"
                  value={expenseForm.payment_status}
                  onChange={(e) => setExpenseForm({ ...expenseForm, payment_status: e.target.value })}
                >
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending (Payable)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="sb-label">Approval Status</label>
                <select
                  className="sb-select"
                  value={expenseForm.approval_status}
                  onChange={(e) => setExpenseForm({ ...expenseForm, approval_status: e.target.value })}
                >
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending Approval</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="sb-label">Internal Notes & Breakdown</label>
              <textarea
                className="sb-textarea"
                rows="3"
                placeholder="Machine code, repair breakdown notes, invoice numbers..."
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>

            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setRecordModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : selectedExpense ? "Update Voucher" : "Save Voucher"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add Expense Category */}
        <Modal
          isOpen={categoryModalOpen}
          onClose={() => !submitting && setCategoryModalOpen(false)}
          title="Add Expense Category Head"
          subtitle="Configure high-level expense heads for plant operations"
          size="md"
        >
          <form onSubmit={handleSaveCategory} className="category-form">
            <div className="form-group">
              <label className="sb-label">Category Name *</label>
              <input
                type="text"
                className="sb-input"
                placeholder="e.g. Effluent Treatment (ETP) Maintenance"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="sb-label">Unique Code *</label>
              <input
                type="text"
                className="sb-input"
                placeholder="e.g. ETP_MAINT"
                value={categoryForm.code}
                onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="form-group">
              <label className="sb-label">Description</label>
              <textarea
                className="sb-textarea"
                rows="3"
                placeholder="Define operational scope for this expense head"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              />
            </div>
            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setCategoryModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Create Category"}
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}

export default PlasticExpenses;
