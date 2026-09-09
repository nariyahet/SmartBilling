import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticCashBank.css";

function PlasticCashBank() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalCash: 0, totalBank: 0, totalLiquidFunds: 0, count: 0 });

  // Filters
  const [selectedAccFilter, setSelectedAccFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [statementAccount, setStatementAccount] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Account Form
  const [accountForm, setAccountForm] = useState({
    account_type: "BANK",
    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc_code: "",
    branch: "",
    opening_balance: 0.00,
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    bank_account_id: "",
    to_bank_account_id: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    transaction_type: "TRANSFER",
    amount: "",
    payment_mode: "BANK_TRANSFER",
    reference_no: "",
    description: "",
  });

  // Direct Deposit / Withdrawal Form
  const [depositForm, setDepositForm] = useState({
    bank_account_id: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    transaction_type: "DEPOSIT",
    amount: "",
    payment_mode: "CASH",
    reference_no: "",
    description: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedAccFilter !== "ALL") params.bank_account_id = selectedAccFilter;
      if (typeFilter !== "ALL") params.transaction_type = typeFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const [accRes, txRes] = await Promise.all([
        API.get("/plastic-erp/accounting/cash-bank/accounts"),
        API.get("/plastic-erp/accounting/cash-bank/transactions", { params }),
      ]);

      if (accRes.data?.success) {
        setAccounts(accRes.data.accounts || []);
        setSummary(accRes.data.summary || {});
      }
      if (txRes.data?.success) {
        setTransactions(txRes.data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to fetch cash and bank data:", err);
      alert("Failed to load cash and bank records");
    } finally {
      setLoading(false);
    }
  }, [selectedAccFilter, typeFilter, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.bank_name || !accountForm.account_name || !accountForm.account_number) {
      alert("Please fill in all required account fields");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/accounting/cash-bank/accounts", accountForm);
      alert("Account created successfully");
      setAccountModalOpen(false);
      setAccountForm({
        account_type: "BANK",
        bank_name: "",
        account_name: "",
        account_number: "",
        ifsc_code: "",
        branch: "",
        opening_balance: 0.00,
      });
      fetchData();
    } catch (err) {
      console.error("Create account error:", err);
      alert(err.response?.data?.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferFunds = async (e) => {
    e.preventDefault();
    if (!transferForm.bank_account_id || !transferForm.to_bank_account_id || !Number(transferForm.amount)) {
      alert("Please select source, destination, and valid transfer amount");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/accounting/cash-bank/transactions", transferForm);
      alert("Funds transferred successfully");
      setTransferModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Transfer error:", err);
      alert(err.response?.data?.message || "Failed to transfer funds");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositWithdrawal = async (e) => {
    e.preventDefault();
    if (!depositForm.bank_account_id || !Number(depositForm.amount)) {
      alert("Please select account and valid amount");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/accounting/cash-bank/transactions", depositForm);
      alert(`${depositForm.transaction_type} recorded successfully`);
      setDepositModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Deposit/withdrawal error:", err);
      alert(err.response?.data?.message || "Failed to record transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenStatement = async (acc) => {
    try {
      const res = await API.get(`/plastic-erp/accounting/cash-bank/statement/${acc.id}`);
      if (res.data?.success) {
        setStatementAccount(acc);
        setStatementData(res.data);
      }
    } catch (err) {
      console.error("Failed to load statement:", err);
      alert("Failed to load statement");
    }
  };

  if (loading && accounts.length === 0) {
    return <LoadingScreen message="Loading Cash & Bank Accounts..." />;
  }

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / Accounting</span>
            <h1 className="plastic-title">🏦 Cash & Bank Accounts</h1>
            <p className="plastic-subtitle">
              Manage operating bank accounts, plant cash registers, contra transfers, and account statements.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="plastic-btn plastic-btn-secondary"
              onClick={() => {
                setDepositForm({
                  bank_account_id: accounts[0]?.id || "",
                  transaction_date: new Date().toISOString().slice(0, 10),
                  transaction_type: "DEPOSIT",
                  amount: "",
                  payment_mode: "CASH",
                  reference_no: "",
                  description: "",
                });
                setDepositModalOpen(true);
              }}
            >
              📥 Direct Cash / Deposit
            </button>
            <button
              type="button"
              className="plastic-btn plastic-btn-secondary"
              onClick={() => {
                setTransferForm({
                  bank_account_id: accounts[0]?.id || "",
                  to_bank_account_id: accounts[1]?.id || "",
                  transaction_date: new Date().toISOString().slice(0, 10),
                  transaction_type: "TRANSFER",
                  amount: "",
                  payment_mode: "BANK_TRANSFER",
                  reference_no: "",
                  description: "",
                });
                setTransferModalOpen(true);
              }}
            >
              💸 Funds Transfer (Contra)
            </button>
            <button
              type="button"
              className="plastic-btn plastic-btn-primary"
              onClick={() => setAccountModalOpen(true)}
            >
              + Add Bank Account
            </button>
          </div>
        </div>

        {/* Liquid Funds Overview */}
        <div className="plastic-kpi-grid" style={{ marginBottom: "20px" }}>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💵</span>
            <div>
              <span className="plastic-kpi-label">Cash on Hand</span>
              <h3 className="plastic-kpi-val">₹{Number(summary.totalCash || 0).toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Plant register & petty cash</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>🏛️</span>
            <div>
              <span className="plastic-kpi-label">Bank Balances</span>
              <h3 className="plastic-kpi-val">₹{Number(summary.totalBank || 0).toLocaleString("en-IN")}</h3>
              <small className="plastic-kpi-sub">Current & operative accounts</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#f5f3ff", color: "#6d28d9" }}>💎</span>
            <div>
              <span className="plastic-kpi-label">Total Liquid Funds</span>
              <h3 className="plastic-kpi-val" style={{ color: "#6d28d9" }}>
                ₹{Number(summary.totalLiquidFunds || 0).toLocaleString("en-IN")}
              </h3>
              <small className="plastic-kpi-sub">Total operational liquidity</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon">📊</span>
            <div>
              <span className="plastic-kpi-label">Active Accounts</span>
              <h3 className="plastic-kpi-val">{accounts.length}</h3>
              <small className="plastic-kpi-sub">Monitored banking entities</small>
            </div>
          </div>
        </div>

        {/* Bank & Cash Accounts Cards */}
        <h3 style={{ margin: "0 0 14px 0", color: "#1e293b", fontSize: "1.1rem" }}>Active Accounts</h3>
        <div className="bank-cards-grid">
          {accounts.map((acc) => (
            <div key={acc.id} className="bank-card">
              <div className="bank-card-header">
                <div>
                  <h4 className="bank-card-name">{acc.account_name}</h4>
                  <div className="bank-card-num">
                    {acc.bank_name} • {acc.account_number}
                  </div>
                </div>
                <div className="bank-card-icon">
                  {acc.account_type === "CASH" ? "💵" : "🏦"}
                </div>
              </div>
              <div className="bank-card-balance">
                ₹{Number(acc.current_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="bank-card-footer">
                <span>Opening: ₹{Number(acc.opening_balance || 0).toLocaleString("en-IN")}</span>
                <button
                  type="button"
                  className="plastic-btn plastic-btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                  onClick={() => handleOpenStatement(acc)}
                >
                  📜 View Statement
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Live Transactions Ledger */}
        <div className="plastic-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>Recent Cash & Bank Transactions</h3>
            <span className="plastic-badge plastic-badge-info">{transactions.length} Transactions</span>
          </div>

          <div className="plastic-filters-bar" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <select
              value={selectedAccFilter}
              onChange={(e) => setSelectedAccFilter(e.target.value)}
              className="plastic-select"
              style={{ flex: "0 0 200px" }}
            >
              <option value="ALL">All Bank Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="plastic-select"
              style={{ flex: "0 0 160px" }}
            >
              <option value="ALL">All Types</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="PAYMENT">PAYMENT</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
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
                  <th>Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Mode / Ref</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Amount (₹)</th>
                  <th style={{ textAlign: "right" }}>Balance After</th>
                  <th style={{ textAlign: "center" }}>Recon Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      No cash/bank transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isInward = ["DEPOSIT", "RECEIPT"].includes(tx.transaction_type) || (tx.transaction_type === "TRANSFER" && tx.description?.includes("Transfer from"));
                    return (
                      <tr key={tx.id}>
                        <td>{new Date(tx.transaction_date).toLocaleDateString("en-IN")}</td>
                        <td>
                          <strong>{tx.account_name}</strong>
                          <small style={{ display: "block", color: "#64748b" }}>{tx.account_number}</small>
                        </td>
                        <td>
                          <span className={`tx-type-badge ${tx.transaction_type === "TRANSFER" ? "tx-type-transfer" : isInward ? "tx-type-inward" : "tx-type-outward"}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td>
                          <span>{tx.payment_mode}</span>
                          {tx.reference_no && <small style={{ display: "block", color: "#64748b" }}>{tx.reference_no}</small>}
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "#334155" }}>{tx.description || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: "700", color: isInward ? "#059669" : "#dc2626" }}>
                          {isInward ? "+" : "-"}₹{Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "600" }}>
                          ₹{Number(tx.balance_after || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`plastic-badge ${Boolean(tx.is_reconciled) ? "plastic-badge-success" : "plastic-badge-secondary"}`}>
                            {Boolean(tx.is_reconciled) ? "Reconciled" : "Unreconciled"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Create Account */}
        {accountModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => setAccountModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
              <div className="plastic-modal-header">
                <h2>+ Add Bank or Cash Account</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setAccountModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateAccount}>
                <div className="plastic-modal-body">
                  <div className="plastic-form-group">
                    <label>Account Type</label>
                    <select
                      value={accountForm.account_type}
                      onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                      className="plastic-select"
                    >
                      <option value="BANK">Bank Account</option>
                      <option value="CASH">Cash Counter / Register</option>
                    </select>
                  </div>
                  <div className="plastic-form-group">
                    <label>Institution / Bank Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank Ltd or Plant Cash"
                      value={accountForm.bank_name}
                      onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                      className="plastic-input"
                      required
                    />
                  </div>
                  <div className="plastic-form-group">
                    <label>Account Title / Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Factory Current Account"
                      value={accountForm.account_name}
                      onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                      className="plastic-input"
                      required
                    />
                  </div>
                  <div className="plastic-form-group">
                    <label>Account Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 50200012345678"
                      value={accountForm.account_number}
                      onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })}
                      className="plastic-input"
                      required
                    />
                  </div>
                  {accountForm.account_type === "BANK" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="plastic-form-group">
                        <label>IFSC Code</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC0001234"
                          value={accountForm.ifsc_code}
                          onChange={(e) => setAccountForm({ ...accountForm, ifsc_code: e.target.value })}
                          className="plastic-input"
                        />
                      </div>
                      <div className="plastic-form-group">
                        <label>Branch</label>
                        <input
                          type="text"
                          placeholder="e.g. Kim GIDC"
                          value={accountForm.branch}
                          onChange={(e) => setAccountForm({ ...accountForm, branch: e.target.value })}
                          className="plastic-input"
                        />
                      </div>
                    </div>
                  )}
                  <div className="plastic-form-group">
                    <label>Opening Balance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={accountForm.opening_balance}
                      onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })}
                      className="plastic-input"
                    />
                  </div>
                </div>
                <div className="plastic-modal-footer">
                  <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setAccountModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="plastic-btn plastic-btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Transfer Funds (Contra) */}
        {transferModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => setTransferModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
              <div className="plastic-modal-header">
                <h2>💸 Transfer Funds / Contra Entry</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setTransferModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleTransferFunds}>
                <div className="plastic-modal-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>From Account (Source) *</label>
                      <select
                        value={transferForm.bank_account_id}
                        onChange={(e) => setTransferForm({ ...transferForm, bank_account_id: e.target.value })}
                        className="plastic-select"
                        required
                      >
                        <option value="">Select Source</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_name} (₹{Number(a.current_balance).toLocaleString("en-IN")})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="plastic-form-group">
                      <label>To Account (Destination) *</label>
                      <select
                        value={transferForm.to_bank_account_id}
                        onChange={(e) => setTransferForm({ ...transferForm, to_bank_account_id: e.target.value })}
                        className="plastic-select"
                        required
                      >
                        <option value="">Select Destination</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_name} (₹{Number(a.current_balance).toLocaleString("en-IN")})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>Transfer Amount (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                        className="plastic-input"
                        required
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={transferForm.transaction_date}
                        onChange={(e) => setTransferForm({ ...transferForm, transaction_date: e.target.value })}
                        className="plastic-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="plastic-form-group">
                    <label>Reference / Cheque No</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR / Cheque 00123"
                      value={transferForm.reference_no}
                      onChange={(e) => setTransferForm({ ...transferForm, reference_no: e.target.value })}
                      className="plastic-input"
                    />
                  </div>

                  <div className="plastic-form-group">
                    <label>Remarks / Purpose</label>
                    <textarea
                      rows="2"
                      placeholder="e.g. Cash withdrawal from bank for factory petty cash"
                      value={transferForm.description}
                      onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                      className="plastic-textarea"
                    />
                  </div>
                </div>
                <div className="plastic-modal-footer">
                  <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setTransferModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="plastic-btn plastic-btn-primary" disabled={submitting}>
                    {submitting ? "Transferring..." : "Confirm Transfer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Direct Deposit / Withdrawal */}
        {depositModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => setDepositModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
              <div className="plastic-modal-header">
                <h2>📥 Record Direct Deposit / Withdrawal</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setDepositModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleDepositWithdrawal}>
                <div className="plastic-modal-body">
                  <div className="plastic-form-group">
                    <label>Transaction Nature</label>
                    <select
                      value={depositForm.transaction_type}
                      onChange={(e) => setDepositForm({ ...depositForm, transaction_type: e.target.value })}
                      className="plastic-select"
                    >
                      <option value="DEPOSIT">Deposit / Inflow (+)</option>
                      <option value="WITHDRAWAL">Withdrawal / Outflow (-)</option>
                    </select>
                  </div>
                  <div className="plastic-form-group">
                    <label>Target Account *</label>
                    <select
                      value={depositForm.bank_account_id}
                      onChange={(e) => setDepositForm({ ...depositForm, bank_account_id: e.target.value })}
                      className="plastic-select"
                      required
                    >
                      <option value="">Select Account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>Amount (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={depositForm.amount}
                        onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                        className="plastic-input"
                        required
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={depositForm.transaction_date}
                        onChange={(e) => setDepositForm({ ...depositForm, transaction_date: e.target.value })}
                        className="plastic-input"
                        required
                      />
                    </div>
                  </div>
                  <div className="plastic-form-group">
                    <label>Description / Memo</label>
                    <input
                      type="text"
                      placeholder="e.g. Director short-term capital deposit"
                      value={depositForm.description}
                      onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                      className="plastic-input"
                    />
                  </div>
                </div>
                <div className="plastic-modal-footer">
                  <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setDepositModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="plastic-btn plastic-btn-primary" disabled={submitting}>
                    {submitting ? "Recording..." : "Record Transaction"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Statement */}
        {statementData && (
          <div className="plastic-modal-backdrop" onClick={() => setStatementData(null)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px" }}>
              <div className="plastic-modal-header">
                <h2>📜 Statement: {statementData.account.account_name}</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setStatementData(null)}>✕</button>
              </div>
              <div className="plastic-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div>
                    <small style={{ color: "#64748b" }}>Opening Balance</small>
                    <strong style={{ display: "block" }}>₹{Number(statementData.summary.openingBalance).toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Total Inflows</small>
                    <strong style={{ display: "block", color: "#059669" }}>+₹{Number(statementData.summary.totalDeposits).toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Total Outflows</small>
                    <strong style={{ display: "block", color: "#dc2626" }}>-₹{Number(statementData.summary.totalWithdrawals).toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Closing Balance</small>
                    <strong style={{ display: "block", color: "#0284c7" }}>₹{Number(statementData.summary.closingBalance).toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                <div className="plastic-table-responsive" style={{ maxHeight: "350px" }}>
                  <table className="plastic-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Ref</th>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Amount (₹)</th>
                        <th style={{ textAlign: "right" }}>Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.transactions.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: "center" }}>No transactions in this account.</td></tr>
                      ) : (
                        statementData.transactions.map((tx) => {
                          const isInward = ["DEPOSIT", "RECEIPT"].includes(tx.transaction_type) || (tx.transaction_type === "TRANSFER" && tx.description?.includes("Transfer from"));
                          return (
                            <tr key={tx.id}>
                              <td>{new Date(tx.transaction_date).toLocaleDateString("en-IN")}</td>
                              <td><span className="plastic-badge plastic-badge-secondary">{tx.transaction_type}</span></td>
                              <td><small>{tx.reference_no || "—"}</small></td>
                              <td style={{ fontSize: "0.85rem" }}>{tx.description || "—"}</td>
                              <td style={{ textAlign: "right", fontWeight: "700", color: isInward ? "#059669" : "#dc2626" }}>
                                {isInward ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: "600" }}>
                                ₹{Number(tx.balance_after).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="plastic-modal-footer">
                <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setStatementData(null)}>
                  Close Statement
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticCashBank;
