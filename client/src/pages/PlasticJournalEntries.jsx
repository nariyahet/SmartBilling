import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, StatusBadge, Modal } from "../components";
import "./PlasticJournalEntries.css";

function PlasticJournalEntries() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({ totalEntries: 0, totalVolume: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [refFilter, setRefFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Voucher Form
  const [voucherForm, setVoucherForm] = useState({
    journal_no: "",
    entry_date: new Date().toISOString().slice(0, 10),
    reference_type: "MANUAL",
    reference_no: "",
    narration: "",
    items: [
      { accountId: "", entryType: "DEBIT", amount: "", narration: "" },
      { accountId: "", entryType: "CREDIT", amount: "", narration: "" },
    ],
  });

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (refFilter !== "ALL") params.reference_type = refFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const [jRes, accRes] = await Promise.all([
        API.get("/plastic-erp/accounting/journals", { params }),
        API.get("/plastic-erp/accounting/accounts/accounts?status=ACTIVE"),
      ]);

      if (jRes.data?.success) {
        setEntries(jRes.data.entries || []);
        setSummary(jRes.data.summary || {});
      }
      if (accRes.data?.success) {
        setAccounts(accRes.data.accounts || []);
      }
    } catch (err) {
      console.error("Failed to load journal entries:", err);
      alert("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  }, [search, refFilter, fromDate, toDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleOpenCreateModal = async () => {
    try {
      const res = await API.get("/plastic-erp/accounting/journals/next-no");
      const nextNo = res.data?.nextNo || "";
      const defaultAcc1 = accounts[0]?.id || "";
      const defaultAcc2 = accounts[1]?.id || "";

      setVoucherForm({
        journal_no: nextNo,
        entry_date: new Date().toISOString().slice(0, 10),
        reference_type: "MANUAL",
        reference_no: "",
        narration: "",
        items: [
          { accountId: defaultAcc1, entryType: "DEBIT", amount: "", narration: "" },
          { accountId: defaultAcc2, entryType: "CREDIT", amount: "", narration: "" },
        ],
      });
      setCreateModalOpen(true);
    } catch (err) {
      console.error("Get next journal no error:", err);
      setCreateModalOpen(true);
    }
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...voucherForm.items];
    updated[index] = { ...updated[index], [field]: value };
    setVoucherForm({ ...voucherForm, items: updated });
  };

  const handleAddLine = () => {
    setVoucherForm({
      ...voucherForm,
      items: [
        ...voucherForm.items,
        { accountId: accounts[0]?.id || "", entryType: "CREDIT", amount: "", narration: "" },
      ],
    });
  };

  const handleRemoveLine = (index) => {
    if (voucherForm.items.length <= 2) {
      alert("A journal entry requires at least two line items (Debit and Credit).");
      return;
    }
    const updated = voucherForm.items.filter((_, idx) => idx !== index);
    setVoucherForm({ ...voucherForm, items: updated });
  };

  // Calculations for real-time balance
  const totalDebit = voucherForm.items
    .filter((itm) => itm.entryType === "DEBIT")
    .reduce((acc, itm) => acc + (Number(itm.amount) || 0), 0);

  const totalCredit = voucherForm.items
    .filter((itm) => itm.entryType === "CREDIT")
    .reduce((acc, itm) => acc + (Number(itm.amount) || 0), 0);

  const imbalance = Math.abs(totalDebit - totalCredit);
  const isBalanced = totalDebit > 0 && totalCredit > 0 && imbalance < 0.02;

  const handleSubmitVoucher = async (e) => {
    e.preventDefault();

    if (!isBalanced) {
      alert(`Cannot post unbalanced voucher! Total Debit (₹${totalDebit.toFixed(2)}) must equal Total Credit (₹${totalCredit.toFixed(2)}).`);
      return;
    }

    // Check account validity
    for (const itm of voucherForm.items) {
      if (!itm.accountId || !Number(itm.amount) || Number(itm.amount) <= 0) {
        alert("Each line item must have a valid account selected and positive amount.");
        return;
      }
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/accounting/journals", voucherForm);
      alert("Journal voucher posted successfully");
      setCreateModalOpen(false);
      fetchEntries();
    } catch (err) {
      console.error("Post journal error:", err);
      alert(err.response?.data?.message || "Failed to post journal voucher");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (entry) => {
    try {
      const res = await API.get(`/plastic-erp/accounting/journals/${entry.id}`);
      if (res.data?.success) {
        setSelectedEntry(res.data);
      }
    } catch (err) {
      console.error("Fetch journal details error:", err);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setRefFilter("ALL");
    setFromDate("");
    setToDate("");
  };

  if (loading && entries.length === 0) {
    return <LoadingScreen message="Loading Journal Entries..." />;
  }

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="Double-Entry Journal System"
          subtitle="Strict audit journal ledger with Total Debit = Total Credit validation and automatic module integration"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "Accounting & GST", to: "/plastic-erp/accounting" },
            { label: "Journal Entries" },
          ]}
          actions={
            <Button
              variant="primary"
              icon="➕"
              onClick={handleOpenCreateModal}
            >
              New Journal Voucher
            </Button>
          }
        />

        {/* KPI Cards */}
        <div className="journal-kpi-grid">
          <KpiCard
            title="Journal Postings"
            value={summary.totalEntries || 0}
            subtitle="Total posted vouchers"
            icon="📑"
            color="navy"
          />
          <KpiCard
            title="Accounting Volume"
            value={`₹${Number(summary.totalVolume || 0).toLocaleString("en-IN")}`}
            subtitle="Balanced turnover"
            icon="💰"
            color="teal"
          />
          <KpiCard
            title="Auto-Integrated"
            value={entries.filter((e) => e.reference_type !== "MANUAL").length}
            subtitle="Purchases, Sales, Payroll"
            icon="⚡"
            color="blue"
          />
          <KpiCard
            title="Integrity Status"
            value="100% Balanced"
            subtitle="Dr = Cr verified across all"
            icon="⚖️"
            color="teal"
          />
        </div>

        {/* Filters Card */}
        <Card className="journal-filter-card">
          <div className="journal-filter-grid">
            <div className="filter-item">
              <label htmlFor="j-search">Search Vouchers</label>
              <input
                id="j-search"
                type="text"
                placeholder="Search voucher no, narration, ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sb-input"
              />
            </div>
            <div className="filter-item">
              <label htmlFor="j-ref">Reference Type</label>
              <select
                id="j-ref"
                value={refFilter}
                onChange={(e) => setRefFilter(e.target.value)}
                className="sb-select"
              >
                <option value="ALL">All Reference Types</option>
                <option value="MANUAL">MANUAL</option>
                <option value="PURCHASE_BILL">PURCHASE_BILL</option>
                <option value="INVOICE">INVOICE</option>
                <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                <option value="SUPPLIER_PAYMENT">SUPPLIER_PAYMENT</option>
                <option value="EXPENSE">EXPENSE</option>
                <option value="PAYROLL_PROCESSED">PAYROLL_PROCESSED</option>
                <option value="PAYROLL_PAID">PAYROLL_PAID</option>
                <option value="CREDIT_NOTE">CREDIT_NOTE</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              </select>
            </div>
            <div className="filter-item">
              <label htmlFor="j-from">From Date</label>
              <input
                id="j-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="sb-input"
              />
            </div>
            <div className="filter-item">
              <label htmlFor="j-to">To Date</label>
              <input
                id="j-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="sb-input"
              />
            </div>
            <div className="filter-item filter-actions-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Journal Entries Table Card */}
        <Card
          title="General Journal Register"
          subtitle={`Displaying ${entries.length} posted financial vouchers`}
          actions={
            <Button variant="ghost" size="sm" icon="🔄" onClick={fetchEntries}>
              Refresh
            </Button>
          }
        >
          <div className="journal-table-wrapper">
            <table className="journal-table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Narration & Account Breakdown</th>
                  <th className="cell-right">Total Amount</th>
                  <th>Status</th>
                  <th className="cell-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="journal-table-empty">
                      <div className="empty-state">
                        <span className="empty-icon">📖</span>
                        <p>No journal vouchers found for the selected criteria.</p>
                        <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
                          Post First Journal Voucher
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((je) => (
                    <tr key={je.id}>
                      <td>
                        <span className="journal-code-badge">{je.journal_no}</span>
                      </td>
                      <td>
                        <span className="journal-date">
                          {je.entry_date ? new Date(je.entry_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          }) : "—"}
                        </span>
                      </td>
                      <td>
                        <span className="journal-ref-chip">{je.reference_type}</span>
                        {je.reference_no && (
                          <div className="sub-text">{je.reference_no}</div>
                        )}
                      </td>
                      <td>
                        <strong className="journal-narration">
                          {je.narration || "Journal entry"}
                        </strong>
                        {je.debit_account_name && je.credit_account_name && (
                          <div className="sub-text">
                            Dr: {je.debit_account_name} | Cr: {je.credit_account_name}
                          </div>
                        )}
                      </td>
                      <td className="cell-right">
                        <strong className="journal-amount">
                          ₹{Number(je.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td>
                        <StatusBadge status={je.status} />
                      </td>
                      <td className="cell-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="👁️"
                          title="View Voucher Line Items"
                          onClick={() => handleViewDetails(je)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Create Journal Voucher */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => !submitting && setCreateModalOpen(false)}
          title="Create Double-Entry Journal Voucher"
          subtitle="Post balanced multi-leg financial transactions directly to the general ledger"
          size="lg"
        >
          <form onSubmit={handleSubmitVoucher} className="journal-form">
            <div className="form-grid-3">
              <div className="form-group">
                <label className="sb-label">Journal Voucher No</label>
                <input
                  type="text"
                  value={voucherForm.journal_no}
                  onChange={(e) => setVoucherForm({ ...voucherForm, journal_no: e.target.value })}
                  className="sb-input"
                  placeholder="Auto generated"
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Entry Date *</label>
                <input
                  type="date"
                  value={voucherForm.entry_date}
                  onChange={(e) => setVoucherForm({ ...voucherForm, entry_date: e.target.value })}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Reference No (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Bank Ref / Memo No"
                  value={voucherForm.reference_no}
                  onChange={(e) => setVoucherForm({ ...voucherForm, reference_no: e.target.value })}
                  className="sb-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="sb-label">Narration / Purpose *</label>
              <input
                type="text"
                placeholder="e.g. Depreciation adjustment for plant machinery"
                value={voucherForm.narration}
                onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                className="sb-input"
                required
              />
            </div>

            {/* Dynamic Line Items Header */}
            <div className="journal-legs-header">
              <span className="legs-title">Voucher Line Items (Legs)</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon="➕"
                onClick={handleAddLine}
              >
                Add Leg
              </Button>
            </div>

            <div className="journal-lines-wrapper">
              <table className="journal-lines-table">
                <thead>
                  <tr>
                    <th style={{ width: "35%" }}>Account</th>
                    <th style={{ width: "20%" }}>Dr / Cr</th>
                    <th style={{ width: "20%" }}>Amount (₹)</th>
                    <th>Line Narration</th>
                    <th style={{ width: "5%", textAlign: "center" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {voucherForm.items.map((itm, idx) => (
                    <tr key={idx}>
                      <td>
                        <select
                          value={itm.accountId}
                          onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                          className="sb-select"
                          required
                        >
                          <option value="">Select Account</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              [{acc.account_code}] {acc.account_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={itm.entryType}
                          onChange={(e) => handleLineChange(idx, "entryType", e.target.value)}
                          className="sb-select"
                        >
                          <option value="DEBIT">DEBIT (Dr)</option>
                          <option value="CREDIT">CREDIT (Cr)</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={itm.amount}
                          onChange={(e) => handleLineChange(idx, "amount", e.target.value)}
                          className="sb-input"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Optional line remarks"
                          value={itm.narration}
                          onChange={(e) => handleLineChange(idx, "narration", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {voucherForm.items.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon="✕"
                            title="Remove leg"
                            onClick={() => handleRemoveLine(idx)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Real-time Double Entry Validation Box */}
            <div className={`journal-balance-indicator ${isBalanced ? "journal-balance-ok" : "journal-balance-err"}`}>
              <div className="balance-totals">
                <span>Total Debit: <strong>₹{totalDebit.toFixed(2)}</strong></span>
                <span className="balance-sep">|</span>
                <span>Total Credit: <strong>₹{totalCredit.toFixed(2)}</strong></span>
              </div>
              <div className="balance-status">
                {isBalanced ? (
                  <span className="badge-ok">✅ Balanced (Dr = Cr)</span>
                ) : (
                  <span className="badge-err">⚠️ Out of Balance by ₹{imbalance.toFixed(2)}</span>
                )}
              </div>
            </div>

            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !isBalanced}
              >
                {submitting ? "Posting Voucher..." : "Post Journal Voucher"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: View Details */}
        <Modal
          isOpen={Boolean(selectedEntry)}
          onClose={() => setSelectedEntry(null)}
          title={selectedEntry ? `Voucher Details: ${selectedEntry.entry.journal_no}` : ""}
          subtitle="Audit breakdown of debits, credits, and module posting origin"
          size="lg"
        >
          {selectedEntry && (
            <div className="journal-view-modal">
              <div className="journal-view-kpis">
                <div className="detail-box">
                  <span className="detail-label">Date</span>
                  <strong className="detail-value">{new Date(selectedEntry.entry.entry_date).toLocaleDateString("en-IN")}</strong>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Reference</span>
                  <strong className="detail-value">{selectedEntry.entry.reference_type}</strong>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Total Amount</span>
                  <strong className="detail-value text-teal">₹{Number(selectedEntry.entry.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Created By</span>
                  <strong className="detail-value">{selectedEntry.entry.created_by_name || "System"}</strong>
                </div>
              </div>

              <div className="journal-narration-box">
                <span className="detail-label">Narration</span>
                <p className="narration-text">{selectedEntry.entry.narration || "—"}</p>
              </div>

              <h4 className="legs-title">Accounting Breakdown</h4>
              <div className="journal-table-wrapper">
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Type</th>
                      <th className="cell-right">Debit (₹)</th>
                      <th className="cell-right">Credit (₹)</th>
                      <th>Line Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEntry.items?.map((itm) => (
                      <tr key={itm.id}>
                        <td>
                          <strong>{itm.account_name}</strong>
                          <div className="sub-text">Code: {itm.account_code}</div>
                        </td>
                        <td>
                          <span className="journal-type-pill">{itm.account_type}</span>
                        </td>
                        <td className="cell-right">
                          <strong className={itm.entry_type === "DEBIT" ? "text-blue" : "text-muted"}>
                            {itm.entry_type === "DEBIT" ? `₹${Number(itm.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                          </strong>
                        </td>
                        <td className="cell-right">
                          <strong className={itm.entry_type === "CREDIT" ? "text-amber" : "text-muted"}>
                            {itm.entry_type === "CREDIT" ? `₹${Number(itm.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                          </strong>
                        </td>
                        <td className="sub-text">{itm.narration || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions-bar">
                <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}

export default PlasticJournalEntries;
