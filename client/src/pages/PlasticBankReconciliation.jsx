import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticBankReconciliation.css";

function PlasticBankReconciliation() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [reconciliations, setReconciliations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [matchModalItem, setMatchModalItem] = useState(null);
  const [availableTransactions, setAvailableTransactions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Statement Line Form
  const [stmtForm, setStmtForm] = useState({
    statement_date: new Date().toISOString().slice(0, 10),
    reference_no: "",
    description: "",
    withdrawal_amount: "",
    deposit_amount: "",
    bank_balance: "",
  });

  // Fetch Accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await API.get("/plastic-erp/accounting/cash-bank/accounts");
        if (res.data?.success) {
          const bankOnly = (res.data.accounts || []).filter((a) => a.account_type === "BANK");
          setAccounts(bankOnly);
          if (bankOnly.length > 0 && !selectedAccountId) {
            setSelectedAccountId(bankOnly[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load accounts:", err);
      }
    };
    fetchAccounts();
  }, [selectedAccountId]);

  // Fetch Reconciliations & Summary
  const fetchReconData = useCallback(async () => {
    if (!selectedAccountId) return;
    try {
      setLoading(true);
      const params = { bank_account_id: selectedAccountId };
      if (statusFilter !== "ALL") params.status = statusFilter;

      const [reconRes, sumRes] = await Promise.all([
        API.get("/plastic-erp/accounting/bank-recon", { params }),
        API.get("/plastic-erp/accounting/bank-recon/summary", { params: { bank_account_id: selectedAccountId } }),
      ]);

      if (reconRes.data?.success) {
        setReconciliations(reconRes.data.reconciliations || []);
      }
      if (sumRes.data?.success) {
        setSummary(sumRes.data.summary || null);
      }
    } catch (err) {
      console.error("Failed to load reconciliation data:", err);
      alert("Failed to load reconciliation data");
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, statusFilter]);

  useEffect(() => {
    fetchReconData();
  }, [fetchReconData]);

  const handleAddStatementLine = async (e) => {
    e.preventDefault();
    if (!selectedAccountId) {
      alert("Please select a bank account");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/accounting/bank-recon", {
        ...stmtForm,
        bank_account_id: selectedAccountId,
      });
      alert("Bank statement line added");
      setStatementModalOpen(false);
      setStmtForm({
        statement_date: new Date().toISOString().slice(0, 10),
        reference_no: "",
        description: "",
        withdrawal_amount: "",
        deposit_amount: "",
        bank_balance: "",
      });
      fetchReconData();
    } catch (err) {
      console.error("Add statement line error:", err);
      alert(err.response?.data?.message || "Failed to add statement line");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMatchModal = async (item) => {
    try {
      setMatchModalItem(item);
      const res = await API.get("/plastic-erp/accounting/cash-bank/transactions", {
        params: { bank_account_id: selectedAccountId },
      });
      if (res.data?.success) {
        // Filter unreconciled
        const unreconciled = (res.data.transactions || []).filter((t) => !t.is_reconciled);
        setAvailableTransactions(unreconciled);
      }
    } catch (err) {
      console.error("Load matchable transactions error:", err);
    }
  };

  const handleConfirmMatch = async (txId) => {
    if (!matchModalItem) return;
    try {
      setSubmitting(true);
      await API.post(`/plastic-erp/accounting/bank-recon/${matchModalItem.id}/match`, {
        transaction_id: txId,
      });
      alert("Transaction matched and reconciled successfully");
      setMatchModalItem(null);
      fetchReconData();
    } catch (err) {
      console.error("Match error:", err);
      alert(err.response?.data?.message || "Failed to match transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnmatch = async (id) => {
    if (!window.confirm("Unmatch this transaction and revert status?")) return;
    try {
      await API.post(`/plastic-erp/accounting/bank-recon/${id}/unmatch`);
      alert("Transaction unlinked and marked unreconciled");
      fetchReconData();
    } catch (err) {
      console.error("Unmatch error:", err);
      alert(err.response?.data?.message || "Failed to unmatch");
    }
  };

  if (loading && reconciliations.length === 0 && !summary) {
    return <LoadingScreen message="Loading Bank Reconciliation..." />;
  }

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / Accounting</span>
            <h1 className="plastic-title">⚖️ Bank Reconciliation</h1>
            <p className="plastic-subtitle">
              Match official bank statements against system general ledger transactions to verify clearing.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="plastic-select"
              style={{ fontWeight: "600", minWidth: "220px" }}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  🏦 {acc.bank_name} - {acc.account_number}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="plastic-btn plastic-btn-primary"
              onClick={() => setStatementModalOpen(true)}
            >
              + Add Statement Line
            </button>
          </div>
        </div>

        {/* Reconciliation Summary Cards */}
        {summary && (
          <div className="recon-summary-panel">
            <div className="recon-box">
              <div className="recon-box-label">Ledger Balance (Books)</div>
              <div className="recon-box-val" style={{ color: "#0284c7" }}>
                ₹{Number(summary.booksBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <small style={{ color: "#64748b" }}>Current system balance</small>
            </div>
            <div className="recon-box">
              <div className="recon-box-label">+ Uncredited Cheques / Deposits</div>
              <div className="recon-box-val" style={{ color: "#059669" }}>
                ₹{Number(summary.unreconciledBookDeposits || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <small style={{ color: "#64748b" }}>In books, not in bank</small>
            </div>
            <div className="recon-box">
              <div className="recon-box-label">- Unpresented Cheques / Debits</div>
              <div className="recon-box-val" style={{ color: "#dc2626" }}>
                ₹{Number(summary.unreconciledBookWithdrawals || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <small style={{ color: "#64748b" }}>Issued, not cleared yet</small>
            </div>
            <div className="recon-box" style={{ background: "#f8fafc", border: "2px solid #cbd5e1" }}>
              <div className="recon-box-label">Adjusted Bank Balance</div>
              <div className="recon-box-val" style={{ color: "#1e293b" }}>
                ₹{Number(summary.adjustedBankBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <small style={{ color: "#64748b" }}>Reconciled statement target</small>
            </div>
          </div>
        )}

        {/* Statement Lines Table */}
        <div className="plastic-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>Bank Statement Clearing Register</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="plastic-select"
              style={{ width: "160px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="UNRECONCILED">UNRECONCILED</option>
              <option value="RECONCILED">RECONCILED</option>
            </select>
          </div>

          <div className="plastic-table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Statement Date</th>
                  <th>Reference No</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Withdrawal (Dr)</th>
                  <th style={{ textAlign: "right" }}>Deposit (Cr)</th>
                  <th style={{ textAlign: "right" }}>Bank Balance</th>
                  <th>Matched System Tx</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      No bank statement entries recorded for this account.
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.statement_date).toLocaleDateString("en-IN")}</td>
                      <td><strong>{row.reference_no || "—"}</strong></td>
                      <td style={{ fontSize: "0.85rem" }}>{row.description || "—"}</td>
                      <td style={{ textAlign: "right", color: Number(row.withdrawal_amount) > 0 ? "#dc2626" : "inherit" }}>
                        {Number(row.withdrawal_amount) > 0 ? `₹${Number(row.withdrawal_amount).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: Number(row.deposit_amount) > 0 ? "#059669" : "inherit" }}>
                        {Number(row.deposit_amount) > 0 ? `₹${Number(row.deposit_amount).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "600" }}>
                        ₹{Number(row.bank_balance || 0).toLocaleString("en-IN")}
                      </td>
                      <td>
                        {row.matched_transaction_id ? (
                          <div>
                            <span style={{ fontWeight: "600" }}>Tx #{row.matched_transaction_id}</span>
                            <small style={{ display: "block", color: "#64748b" }}>
                              ₹{Number(row.matched_amount).toLocaleString("en-IN")} ({row.matched_type})
                            </small>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>None</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`plastic-badge ${row.status === "RECONCILED" ? "plastic-badge-success" : "plastic-badge-warning"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {row.status === "RECONCILED" ? (
                          <button
                            type="button"
                            className="plastic-btn plastic-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                            onClick={() => handleUnmatch(row.id)}
                          >
                            Unmatch
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="plastic-btn plastic-btn-primary"
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                            onClick={() => handleOpenMatchModal(row)}
                          >
                            🔗 Match Tx
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Statement Line */}
        {statementModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => setStatementModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
              <div className="plastic-modal-header">
                <h2>+ Record Bank Statement Entry</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setStatementModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleAddStatementLine}>
                <div className="plastic-modal-body">
                  <div className="plastic-form-group">
                    <label>Statement Date *</label>
                    <input
                      type="date"
                      value={stmtForm.statement_date}
                      onChange={(e) => setStmtForm({ ...stmtForm, statement_date: e.target.value })}
                      className="plastic-input"
                      required
                    />
                  </div>
                  <div className="plastic-form-group">
                    <label>Reference / Cheque / UTR No</label>
                    <input
                      type="text"
                      placeholder="e.g. CMS/123984/N"
                      value={stmtForm.reference_no}
                      onChange={(e) => setStmtForm({ ...stmtForm, reference_no: e.target.value })}
                      className="plastic-input"
                    />
                  </div>
                  <div className="plastic-form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      placeholder="e.g. INW NEFT - M/S PLASTIC BUYER"
                      value={stmtForm.description}
                      onChange={(e) => setStmtForm({ ...stmtForm, description: e.target.value })}
                      className="plastic-input"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>Withdrawal / Debit (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={stmtForm.withdrawal_amount}
                        onChange={(e) => setStmtForm({ ...stmtForm, withdrawal_amount: e.target.value })}
                        className="plastic-input"
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Deposit / Credit (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={stmtForm.deposit_amount}
                        onChange={(e) => setStmtForm({ ...stmtForm, deposit_amount: e.target.value })}
                        className="plastic-input"
                      />
                    </div>
                  </div>
                  <div className="plastic-form-group">
                    <label>Bank Statement Balance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Balance after this entry"
                      value={stmtForm.bank_balance}
                      onChange={(e) => setStmtForm({ ...stmtForm, bank_balance: e.target.value })}
                      className="plastic-input"
                    />
                  </div>
                </div>
                <div className="plastic-modal-footer">
                  <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setStatementModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="plastic-btn plastic-btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Statement Line"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Match Transaction */}
        {matchModalItem && (
          <div className="plastic-modal-backdrop" onClick={() => setMatchModalItem(null)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
              <div className="plastic-modal-header">
                <h2>Match Bank Statement Entry</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setMatchModalItem(null)}>✕</button>
              </div>
              <div className="plastic-modal-body">
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
                  <strong>Statement Entry:</strong> {matchModalItem.description} ({new Date(matchModalItem.statement_date).toLocaleDateString("en-IN")})
                  <div style={{ marginTop: "4px", fontSize: "0.95rem" }}>
                    Target Amount: <strong style={{ color: "#0284c7" }}>
                      ₹{(Number(matchModalItem.deposit_amount) || Number(matchModalItem.withdrawal_amount)).toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>

                <h4>Available Unreconciled System Transactions</h4>
                <div className="plastic-table-responsive" style={{ maxHeight: "300px" }}>
                  <table className="plastic-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Ref</th>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Amount (₹)</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableTransactions.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: "center" }}>No unreconciled transactions found.</td></tr>
                      ) : (
                        availableTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{new Date(tx.transaction_date).toLocaleDateString("en-IN")}</td>
                            <td><span className="plastic-badge plastic-badge-secondary">{tx.transaction_type}</span></td>
                            <td>{tx.reference_no || "—"}</td>
                            <td style={{ fontSize: "0.85rem" }}>{tx.description || "—"}</td>
                            <td style={{ textAlign: "right", fontWeight: "700" }}>₹{Number(tx.amount).toLocaleString("en-IN")}</td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                className="plastic-btn plastic-btn-primary"
                                style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                onClick={() => handleConfirmMatch(tx.id)}
                                disabled={submitting}
                              >
                                Match
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="plastic-modal-footer">
                <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setMatchModalItem(null)}>
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

export default PlasticBankReconciliation;
