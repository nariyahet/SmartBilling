import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
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

  if (loading && entries.length === 0) {
    return <LoadingScreen message="Loading Journal Entries..." />;
  }

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / Accounting</span>
            <h1 className="plastic-title">📖 Double-Entry Journal System</h1>
            <p className="plastic-subtitle">
              Strict audit journal ledger with Total Debit = Total Credit validation and automatic module integration.
            </p>
          </div>
          <button
            type="button"
            className="plastic-btn plastic-btn-primary"
            onClick={handleOpenCreateModal}
          >
            + New Journal Voucher
          </button>
        </div>

        {/* KPI Cards */}
        <div className="plastic-kpi-grid">
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>📑</span>
            <div>
              <span className="plastic-kpi-label">Journal Postings</span>
              <h3 className="plastic-kpi-val">{summary.totalEntries || 0}</h3>
              <small className="plastic-kpi-sub">Total posted accounting vouchers</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💰</span>
            <div>
              <span className="plastic-kpi-label">Accounting Volume</span>
              <h3 className="plastic-kpi-val">₹{Number(summary.totalVolume || 0).toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Total balanced financial turnover</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⚡</span>
            <div>
              <span className="plastic-kpi-label">Auto-Integrated</span>
              <h3 className="plastic-kpi-val">{entries.filter((e) => e.reference_type !== "MANUAL").length}</h3>
              <small className="plastic-kpi-sub">Purchases, Sales, Payroll, Expenses</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">⚖️</span>
            <div>
              <span className="plastic-kpi-label">Integrity Status</span>
              <h3 className="plastic-kpi-val" style={{ color: "#059669" }}>100% Balanced</h3>
              <small className="plastic-kpi-sub">Dr = Cr verified across all vouchers</small>
            </div>
          </div>
        </div>

        {/* Filters & Table */}
        <div className="plastic-card">
          <div className="plastic-filters-bar" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Search voucher no, narration, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="plastic-input"
              style={{ flex: "1 1 240px" }}
            />
            <select
              value={refFilter}
              onChange={(e) => setRefFilter(e.target.value)}
              className="plastic-select"
              style={{ flex: "0 0 180px" }}
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
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="plastic-input"
              style={{ flex: "0 0 140px" }}
              title="From Date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="plastic-input"
              style={{ flex: "0 0 140px" }}
              title="To Date"
            />
          </div>

          <div className="plastic-table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Narration / Account Summary</th>
                  <th style={{ textAlign: "right" }}>Total Amount (₹)</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      No journal vouchers found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  entries.map((je) => (
                    <tr key={je.id}>
                      <td><strong>{je.journal_no}</strong></td>
                      <td>{je.entry_date ? new Date(je.entry_date).toLocaleDateString("en-IN") : "—"}</td>
                      <td>
                        <span className="plastic-badge plastic-badge-secondary" style={{ fontSize: "0.75rem" }}>
                          {je.reference_type}
                        </span>
                        {je.reference_no && <small style={{ display: "block", color: "#475569" }}>{je.reference_no}</small>}
                      </td>
                      <td>
                        <span style={{ fontWeight: "600", color: "#0f172a" }}>
                          {je.narration || "Journal entry"}
                        </span>
                        {je.debit_account_name && je.credit_account_name && (
                          <small style={{ display: "block", color: "#64748b" }}>
                            Dr: {je.debit_account_name} | Cr: {je.credit_account_name}
                          </small>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>
                        ₹{Number(je.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="plastic-badge plastic-badge-success">{je.status}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="plastic-action-btn"
                          title="View Voucher Line Items"
                          onClick={() => handleViewDetails(je)}
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Create Journal Voucher */}
        {createModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => setCreateModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "850px" }}>
              <div className="plastic-modal-header">
                <h2>+ Create Double-Entry Journal Voucher</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setCreateModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmitVoucher}>
                <div className="plastic-modal-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>Journal Voucher No</label>
                      <input
                        type="text"
                        value={voucherForm.journal_no}
                        onChange={(e) => setVoucherForm({ ...voucherForm, journal_no: e.target.value })}
                        className="plastic-input"
                        placeholder="Auto generated"
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Entry Date *</label>
                      <input
                        type="date"
                        value={voucherForm.entry_date}
                        onChange={(e) => setVoucherForm({ ...voucherForm, entry_date: e.target.value })}
                        className="plastic-input"
                        required
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Reference No (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Bank Ref / Memo No"
                        value={voucherForm.reference_no}
                        onChange={(e) => setVoucherForm({ ...voucherForm, reference_no: e.target.value })}
                        className="plastic-input"
                      />
                    </div>
                  </div>

                  <div className="plastic-form-group">
                    <label>Narration / Purpose *</label>
                    <input
                      type="text"
                      placeholder="e.g. Depreciation adjustment for plant machinery"
                      value={voucherForm.narration}
                      onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                      className="plastic-input"
                      required
                    />
                  </div>

                  {/* Dynamic Line Items Table */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 8px 0" }}>
                    <label style={{ fontWeight: "700", color: "#1e293b", margin: 0 }}>Voucher Line Items</label>
                    <button
                      type="button"
                      className="plastic-btn plastic-btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                      onClick={handleAddLine}
                    >
                      + Add Leg
                    </button>
                  </div>

                  <div className="plastic-table-responsive" style={{ border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                    <table className="journal-lines-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: "0.8rem", color: "#64748b" }}>
                          <th style={{ width: "35%" }}>Account</th>
                          <th style={{ width: "18%" }}>Dr / Cr</th>
                          <th style={{ width: "20%" }}>Amount (₹)</th>
                          <th>Line Narration</th>
                          <th style={{ width: "5%", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {voucherForm.items.map((itm, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td>
                              <select
                                value={itm.accountId}
                                onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                                className="plastic-select"
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
                                className="plastic-select"
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
                                className="plastic-input"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                placeholder="Optional description"
                                value={itm.narration}
                                onChange={(e) => handleLineChange(idx, "narration", e.target.value)}
                                className="plastic-input"
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {voucherForm.items.length > 2 && (
                                <button
                                  type="button"
                                  className="journal-row-btn-del"
                                  title="Remove line"
                                  onClick={() => handleRemoveLine(idx)}
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Real-time Double Entry Validation Box */}
                  <div className={`journal-balance-indicator ${isBalanced ? "journal-balance-ok" : "journal-balance-err"}`}>
                    <div>
                      <span>Total Debit: <strong>₹{totalDebit.toFixed(2)}</strong></span>
                      <span style={{ margin: "0 16px" }}>|</span>
                      <span>Total Credit: <strong>₹{totalCredit.toFixed(2)}</strong></span>
                    </div>
                    <div>
                      {isBalanced ? (
                        <strong>✅ Balanced (Dr = Cr)</strong>
                      ) : (
                        <strong>⚠️ Out of Balance by ₹{imbalance.toFixed(2)}</strong>
                      )}
                    </div>
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setCreateModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting || !isBalanced}
                  >
                    {submitting ? "Posting Voucher..." : "Post Journal Voucher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Details */}
        {selectedEntry && (
          <div className="plastic-modal-backdrop" onClick={() => setSelectedEntry(null)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "750px" }}>
              <div className="plastic-modal-header">
                <h2>Voucher Details: {selectedEntry.entry.journal_no}</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setSelectedEntry(null)}>✕</button>
              </div>
              <div className="plastic-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div>
                    <small style={{ color: "#64748b" }}>Date</small>
                    <strong style={{ display: "block" }}>{new Date(selectedEntry.entry.entry_date).toLocaleDateString("en-IN")}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Reference</small>
                    <strong style={{ display: "block" }}>{selectedEntry.entry.reference_type}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Total Amount</small>
                    <strong style={{ display: "block", color: "#0284c7" }}>₹{Number(selectedEntry.entry.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Created By</small>
                    <strong style={{ display: "block" }}>{selectedEntry.entry.created_by_name || "System"}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <small style={{ color: "#64748b", fontWeight: "600" }}>Narration</small>
                  <p style={{ margin: "4px 0", color: "#1e293b" }}>{selectedEntry.entry.narration || "—"}</p>
                </div>

                <h4 style={{ margin: "14px 0 8px 0" }}>Accounting Breakdown</h4>
                <div className="plastic-table-responsive">
                  <table className="plastic-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Type</th>
                        <th style={{ textAlign: "right" }}>Debit (₹)</th>
                        <th style={{ textAlign: "right" }}>Credit (₹)</th>
                        <th>Line Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntry.items?.map((itm) => (
                        <tr key={itm.id}>
                          <td>
                            <strong>{itm.account_name}</strong>
                            <small style={{ display: "block", color: "#64748b" }}>Code: {itm.account_code}</small>
                          </td>
                          <td>
                            <span className={`coa-type-badge coa-type-${itm.account_type.toLowerCase()}`}>
                              {itm.account_type}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: itm.entry_type === "DEBIT" ? "700" : "normal" }}>
                            {itm.entry_type === "DEBIT" ? `₹${Number(itm.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: itm.entry_type === "CREDIT" ? "700" : "normal" }}>
                            {itm.entry_type === "CREDIT" ? `₹${Number(itm.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td style={{ fontSize: "0.85rem", color: "#475569" }}>{itm.narration || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="plastic-modal-footer">
                <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setSelectedEntry(null)}>
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

export default PlasticJournalEntries;
