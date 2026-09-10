import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, StatusBadge, Modal } from "../components";
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
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="Bank Reconciliation"
          subtitle="Match official bank statements against system general ledger transactions to verify clearing"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "Accounting & GST", to: "/plastic-erp/accounting" },
            { label: "Bank Reconciliation" },
          ]}
          actions={
            <div className="recon-action-group">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="sb-select recon-account-select"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    🏦 {acc.bank_name} - {acc.account_number}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                icon="➕"
                onClick={() => setStatementModalOpen(true)}
              >
                Add Statement Line
              </Button>
            </div>
          }
        />

        {/* Reconciliation Summary Cards */}
        {summary && (
          <div className="recon-kpis-grid">
            <KpiCard
              title="Ledger Balance (Books)"
              value={`₹${Number(summary.booksBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              subtitle="Current system general ledger balance"
              icon="📘"
              color="blue"
            />
            <KpiCard
              title="+ Uncredited Cheques"
              value={`₹${Number(summary.unreconciledBookDeposits || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              subtitle="Recorded in books, pending in bank"
              icon="📥"
              color="teal"
            />
            <KpiCard
              title="- Unpresented Cheques"
              value={`₹${Number(summary.unreconciledBookWithdrawals || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              subtitle="Issued payments, not cleared yet"
              icon="📤"
              color="amber"
            />
            <KpiCard
              title="Adjusted Bank Balance"
              value={`₹${Number(summary.adjustedBankBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              subtitle="Target reconciled bank statement target"
              icon="⚖️"
              color="navy"
            />
          </div>
        )}

        {/* Statement Lines Register Card */}
        <Card
          title="Bank Statement Clearing Register"
          subtitle="Match imported or recorded bank statement lines with SmartBilling general ledger vouchers"
          actions={
            <div className="recon-filter-controls">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="sb-select recon-status-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNRECONCILED">UNRECONCILED</option>
                <option value="RECONCILED">RECONCILED</option>
              </select>
              <Button variant="ghost" size="sm" icon="🔄" onClick={fetchReconData}>
                Refresh
              </Button>
            </div>
          }
        >
          <div className="recon-table-wrapper">
            <table className="recon-table">
              <thead>
                <tr>
                  <th>Statement Date</th>
                  <th>Reference No</th>
                  <th>Description</th>
                  <th className="cell-right">Withdrawal (Dr)</th>
                  <th className="cell-right">Deposit (Cr)</th>
                  <th className="cell-right">Bank Balance</th>
                  <th>Matched System Tx</th>
                  <th className="cell-center">Status</th>
                  <th className="cell-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="recon-table-empty">
                      <div className="empty-state">
                        <span className="empty-icon">⚖️</span>
                        <p>No bank statement entries recorded for this account.</p>
                        <Button variant="primary" size="sm" onClick={() => setStatementModalOpen(true)}>
                          Add First Statement Entry
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="recon-date">
                          {new Date(row.statement_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </td>
                      <td>
                        <strong className="recon-ref">{row.reference_no || "—"}</strong>
                      </td>
                      <td className="recon-desc-cell">{row.description || "—"}</td>
                      <td className="cell-right">
                        {Number(row.withdrawal_amount) > 0 ? (
                          <strong className="text-danger">
                            -₹{Number(row.withdrawal_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </strong>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="cell-right">
                        {Number(row.deposit_amount) > 0 ? (
                          <strong className="text-teal">
                            +₹{Number(row.deposit_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </strong>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="cell-right">
                        <strong className="recon-bank-balance">
                          ₹{Number(row.bank_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td>
                        {row.matched_transaction_id ? (
                          <div>
                            <span className="matched-tx-badge">Tx #{row.matched_transaction_id}</span>
                            <div className="sub-text">
                              ₹{Number(row.matched_amount).toLocaleString("en-IN")} ({row.matched_type})
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">Unlinked</span>
                        )}
                      </td>
                      <td className="cell-center">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="cell-right">
                        {row.status === "RECONCILED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnmatch(row.id)}
                          >
                            Unmatch
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            icon="🔗"
                            onClick={() => handleOpenMatchModal(row)}
                          >
                            Match Tx
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Add Statement Line */}
        <Modal
          isOpen={statementModalOpen}
          onClose={() => !submitting && setStatementModalOpen(false)}
          title="Record Bank Statement Entry"
          subtitle="Add line items from official bank statement for clearing against ERP ledger"
          size="md"
        >
          <form onSubmit={handleAddStatementLine} className="recon-modal-form">
            <div className="form-group">
              <label className="sb-label">Statement Date *</label>
              <input
                type="date"
                value={stmtForm.statement_date}
                onChange={(e) => setStmtForm({ ...stmtForm, statement_date: e.target.value })}
                className="sb-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="sb-label">Reference / Cheque / UTR No</label>
              <input
                type="text"
                placeholder="e.g. CMS/123984/N or Cheque 00123"
                value={stmtForm.reference_no}
                onChange={(e) => setStmtForm({ ...stmtForm, reference_no: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="form-group">
              <label className="sb-label">Statement Description / Narration</label>
              <input
                type="text"
                placeholder="e.g. INW NEFT - M/S PLASTIC BUYER"
                value={stmtForm.description}
                onChange={(e) => setStmtForm({ ...stmtForm, description: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Withdrawal / Debit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={stmtForm.withdrawal_amount}
                  onChange={(e) => setStmtForm({ ...stmtForm, withdrawal_amount: e.target.value })}
                  className="sb-input"
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Deposit / Credit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={stmtForm.deposit_amount}
                  onChange={(e) => setStmtForm({ ...stmtForm, deposit_amount: e.target.value })}
                  className="sb-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="sb-label">Bank Statement Running Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Balance recorded in bank statement"
                value={stmtForm.bank_balance}
                onChange={(e) => setStmtForm({ ...stmtForm, bank_balance: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setStatementModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Statement Line"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Match Transaction */}
        <Modal
          isOpen={Boolean(matchModalItem)}
          onClose={() => setMatchModalItem(null)}
          title="Match Bank Statement Entry"
          subtitle="Select corresponding ERP cash/bank transaction to reconcile"
          size="lg"
        >
          {matchModalItem && (
            <div className="recon-match-content">
              <div className="recon-target-card">
                <div className="target-line">
                  <span className="target-label">Statement Entry:</span>
                  <strong>{matchModalItem.description}</strong> ({new Date(matchModalItem.statement_date).toLocaleDateString("en-IN")})
                </div>
                <div className="target-amount-line">
                  <span>Target Amount: </span>
                  <strong className="target-amount-val">
                    ₹{(Number(matchModalItem.deposit_amount) || Number(matchModalItem.withdrawal_amount)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <h4 className="available-tx-heading">Available Unreconciled System Transactions</h4>
              <div className="recon-table-wrapper recon-match-scroll">
                <table className="recon-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Ref</th>
                      <th>Description</th>
                      <th className="cell-right">Amount (₹)</th>
                      <th className="cell-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableTransactions.length === 0 ? (
                      <tr><td colSpan="6" className="recon-table-empty">No unreconciled transactions found.</td></tr>
                    ) : (
                      availableTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>{new Date(tx.transaction_date).toLocaleDateString("en-IN")}</td>
                          <td>
                            <span className="recon-tx-type">{tx.transaction_type}</span>
                          </td>
                          <td><small className="sub-text">{tx.reference_no || "—"}</small></td>
                          <td className="sub-text">{tx.description || "—"}</td>
                          <td className="cell-right">
                            <strong>₹{Number(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                          </td>
                          <td className="cell-center">
                            <Button
                              variant="primary"
                              size="sm"
                              icon="🔗"
                              onClick={() => handleConfirmMatch(tx.id)}
                              disabled={submitting}
                            >
                              Match
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions-bar">
                <Button variant="outline" onClick={() => setMatchModalItem(null)}>
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

export default PlasticBankReconciliation;
