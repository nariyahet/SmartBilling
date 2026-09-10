import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, StatusBadge, Modal } from "../components";
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
        setStatementData(res.data);
      }
    } catch (err) {
      console.error("Failed to load statement:", err);
      alert("Failed to load statement");
    }
  };

  const clearFilters = () => {
    setSelectedAccFilter("ALL");
    setTypeFilter("ALL");
    setFromDate("");
    setToDate("");
  };

  if (loading && accounts.length === 0) {
    return <LoadingScreen message="Loading Cash & Bank Accounts..." />;
  }

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="Cash & Bank Accounts"
          subtitle="Manage operating bank accounts, plant cash registers, contra transfers, and account statements"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "Accounting & GST", to: "/plastic-erp/accounting" },
            { label: "Cash & Bank" },
          ]}
          actions={
            <div className="cb-action-group">
              <Button
                variant="outline"
                icon="📥"
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
                Direct Cash / Deposit
              </Button>
              <Button
                variant="outline"
                icon="💸"
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
                Funds Transfer (Contra)
              </Button>
              <Button
                variant="primary"
                icon="➕"
                onClick={() => setAccountModalOpen(true)}
              >
                Add Bank Account
              </Button>
            </div>
          }
        />

        {/* Liquid Funds Overview */}
        <div className="cb-kpi-grid">
          <KpiCard
            title="Cash on Hand"
            value={`₹${Number(summary.totalCash || 0).toLocaleString("en-IN")}`}
            subtitle="Plant register & petty cash"
            icon="💵"
            color="teal"
          />
          <KpiCard
            title="Bank Balances"
            value={`₹${Number(summary.totalBank || 0).toLocaleString("en-IN")}`}
            subtitle="Current & operative accounts"
            icon="🏛️"
            color="blue"
          />
          <KpiCard
            title="Total Liquid Funds"
            value={`₹${Number(summary.totalLiquidFunds || 0).toLocaleString("en-IN")}`}
            subtitle="Total operational liquidity"
            icon="💎"
            color="navy"
          />
          <KpiCard
            title="Active Accounts"
            value={accounts.length}
            subtitle="Monitored banking entities"
            icon="📊"
            color="amber"
          />
        </div>

        {/* Bank & Cash Accounts Cards */}
        <div className="cb-accounts-section">
          <div className="cb-section-title">Active Liquidity Accounts</div>
          <div className="bank-cards-grid">
            {accounts.map((acc) => (
              <div key={acc.id} className="bank-account-card">
                <div className="bank-card-header">
                  <div className="bank-card-meta">
                    <h4 className="bank-card-name">{acc.account_name}</h4>
                    <div className="bank-card-sub">
                      {acc.bank_name} • {acc.account_number}
                    </div>
                  </div>
                  <div className="bank-card-badge-icon">
                    {acc.account_type === "CASH" ? "💵" : "🏦"}
                  </div>
                </div>
                <div className="bank-card-balance">
                  ₹{Number(acc.current_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div className="bank-card-footer">
                  <span className="opening-label">
                    Opening: ₹{Number(acc.opening_balance || 0).toLocaleString("en-IN")}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="📜"
                    onClick={() => handleOpenStatement(acc)}
                  >
                    View Statement
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Card */}
        <Card className="cb-filter-card">
          <div className="cb-filter-grid">
            <div className="filter-item">
              <label htmlFor="cb-acc">Bank Account</label>
              <select
                id="cb-acc"
                value={selectedAccFilter}
                onChange={(e) => setSelectedAccFilter(e.target.value)}
                className="sb-select"
              >
                <option value="ALL">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label htmlFor="cb-type">Transaction Type</label>
              <select
                id="cb-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="sb-select"
              >
                <option value="ALL">All Types</option>
                <option value="RECEIPT">RECEIPT</option>
                <option value="PAYMENT">PAYMENT</option>
                <option value="TRANSFER">TRANSFER</option>
                <option value="DEPOSIT">DEPOSIT</option>
                <option value="WITHDRAWAL">WITHDRAWAL</option>
              </select>
            </div>
            <div className="filter-item">
              <label htmlFor="cb-from">From Date</label>
              <input
                id="cb-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="sb-input"
              />
            </div>
            <div className="filter-item">
              <label htmlFor="cb-to">To Date</label>
              <input
                id="cb-to"
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

        {/* Live Transactions Ledger */}
        <Card
          title="Recent Cash & Bank Transactions"
          subtitle={`Displaying ${transactions.length} recorded cash and banking events`}
          actions={
            <Button variant="ghost" size="sm" icon="🔄" onClick={fetchData}>
              Refresh
            </Button>
          }
        >
          <div className="cb-table-wrapper">
            <table className="cb-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Mode / Ref</th>
                  <th>Description</th>
                  <th className="cell-right">Amount (₹)</th>
                  <th className="cell-right">Balance After</th>
                  <th className="cell-center">Recon Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="cb-table-empty">
                      <div className="empty-state">
                        <span className="empty-icon">🏦</span>
                        <p>No cash/bank transactions recorded matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isInward = ["DEPOSIT", "RECEIPT"].includes(tx.transaction_type) || (tx.transaction_type === "TRANSFER" && tx.description?.includes("Transfer from"));
                    return (
                      <tr key={tx.id}>
                        <td>
                          <span className="tx-date">
                            {new Date(tx.transaction_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                        </td>
                        <td>
                          <strong>{tx.account_name}</strong>
                          <div className="sub-text">{tx.account_number}</div>
                        </td>
                        <td>
                          <span className={`tx-type-badge ${tx.transaction_type === "TRANSFER" ? "tx-type-transfer" : isInward ? "tx-type-inward" : "tx-type-outward"}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td>
                          <div>{tx.payment_mode}</div>
                          {tx.reference_no && <div className="sub-text">{tx.reference_no}</div>}
                        </td>
                        <td className="tx-desc-cell">{tx.description || "—"}</td>
                        <td className="cell-right">
                          <strong className={isInward ? "text-teal" : "text-danger"}>
                            {isInward ? "+" : "-"}₹{Number(tx.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </strong>
                        </td>
                        <td className="cell-right">
                          <strong className="tx-balance-after">
                            ₹{Number(tx.balance_after || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </strong>
                        </td>
                        <td className="cell-center">
                          <StatusBadge status={Boolean(tx.is_reconciled) ? "RECONCILED" : "UNRECONCILED"} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Create Account */}
        <Modal
          isOpen={accountModalOpen}
          onClose={() => !submitting && setAccountModalOpen(false)}
          title="Add Bank or Cash Account"
          subtitle="Configure operating bank ledger or plant cash register"
          size="md"
        >
          <form onSubmit={handleCreateAccount} className="cb-modal-form">
            <div className="form-group">
              <label className="sb-label">Account Type</label>
              <select
                value={accountForm.account_type}
                onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                className="sb-select"
              >
                <option value="BANK">Bank Account</option>
                <option value="CASH">Cash Counter / Register</option>
              </select>
            </div>
            <div className="form-group">
              <label className="sb-label">Institution / Bank Name *</label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank Ltd or Plant Cash Counter"
                value={accountForm.bank_name}
                onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                className="sb-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="sb-label">Account Title / Name *</label>
              <input
                type="text"
                placeholder="e.g. Factory Current Account"
                value={accountForm.account_name}
                onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                className="sb-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="sb-label">Account Number *</label>
              <input
                type="text"
                placeholder="e.g. 50200012345678"
                value={accountForm.account_number}
                onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })}
                className="sb-input"
                required
              />
            </div>
            {accountForm.account_type === "BANK" && (
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="sb-label">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0001234"
                    value={accountForm.ifsc_code}
                    onChange={(e) => setAccountForm({ ...accountForm, ifsc_code: e.target.value })}
                    className="sb-input"
                  />
                </div>
                <div className="form-group">
                  <label className="sb-label">Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. Kim GIDC"
                    value={accountForm.branch}
                    onChange={(e) => setAccountForm({ ...accountForm, branch: e.target.value })}
                    className="sb-input"
                  />
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="sb-label">Opening Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                value={accountForm.opening_balance}
                onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setAccountModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Create Account"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Transfer Funds (Contra) */}
        <Modal
          isOpen={transferModalOpen}
          onClose={() => !submitting && setTransferModalOpen(false)}
          title="Transfer Funds (Contra Entry)"
          subtitle="Inter-account fund transfers with simultaneous double-entry ledger impact"
          size="md"
        >
          <form onSubmit={handleTransferFunds} className="cb-modal-form">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">From Account (Source) *</label>
                <select
                  value={transferForm.bank_account_id}
                  onChange={(e) => setTransferForm({ ...transferForm, bank_account_id: e.target.value })}
                  className="sb-select"
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
              <div className="form-group">
                <label className="sb-label">To Account (Destination) *</label>
                <select
                  value={transferForm.to_bank_account_id}
                  onChange={(e) => setTransferForm({ ...transferForm, to_bank_account_id: e.target.value })}
                  className="sb-select"
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

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Transfer Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Date *</label>
                <input
                  type="date"
                  value={transferForm.transaction_date}
                  onChange={(e) => setTransferForm({ ...transferForm, transaction_date: e.target.value })}
                  className="sb-input"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="sb-label">Reference / Cheque No</label>
              <input
                type="text"
                placeholder="e.g. UTR / Cheque 00123"
                value={transferForm.reference_no}
                onChange={(e) => setTransferForm({ ...transferForm, reference_no: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="form-group">
              <label className="sb-label">Remarks / Purpose</label>
              <textarea
                rows="2"
                placeholder="e.g. Cash withdrawal from bank for factory petty cash"
                value={transferForm.description}
                onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                className="sb-textarea"
              />
            </div>

            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setTransferModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Direct Deposit / Withdrawal */}
        <Modal
          isOpen={depositModalOpen}
          onClose={() => !submitting && setDepositModalOpen(false)}
          title="Record Direct Deposit / Withdrawal"
          subtitle="Record direct adjustments or manual injections to cash and bank"
          size="md"
        >
          <form onSubmit={handleDepositWithdrawal} className="cb-modal-form">
            <div className="form-group">
              <label className="sb-label">Transaction Nature</label>
              <select
                value={depositForm.transaction_type}
                onChange={(e) => setDepositForm({ ...depositForm, transaction_type: e.target.value })}
                className="sb-select"
              >
                <option value="DEPOSIT">Deposit / Inflow (+)</option>
                <option value="WITHDRAWAL">Withdrawal / Outflow (-)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="sb-label">Target Account *</label>
              <select
                value={depositForm.bank_account_id}
                onChange={(e) => setDepositForm({ ...depositForm, bank_account_id: e.target.value })}
                className="sb-select"
                required
              >
                <option value="">Select Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>
                ))}
              </select>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Date *</label>
                <input
                  type="date"
                  value={depositForm.transaction_date}
                  onChange={(e) => setDepositForm({ ...depositForm, transaction_date: e.target.value })}
                  className="sb-input"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="sb-label">Description / Memo</label>
              <input
                type="text"
                placeholder="e.g. Director short-term capital deposit"
                value={depositForm.description}
                onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setDepositModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? "Recording..." : "Record Transaction"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: View Statement */}
        <Modal
          isOpen={Boolean(statementData)}
          onClose={() => setStatementData(null)}
          title={statementData ? `Statement: ${statementData.account.account_name}` : ""}
          subtitle="Detailed audit statement with running balances"
          size="lg"
        >
          {statementData && (
            <div className="cb-statement-view">
              <div className="cb-statement-kpi-bar">
                <div className="detail-box">
                  <span className="detail-label">Opening Balance</span>
                  <strong className="detail-value">₹{Number(statementData.summary.openingBalance).toLocaleString("en-IN")}</strong>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Total Inflows</span>
                  <strong className="detail-value text-teal">+₹{Number(statementData.summary.totalDeposits).toLocaleString("en-IN")}</strong>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Total Outflows</span>
                  <strong className="detail-value text-danger">-₹{Number(statementData.summary.totalWithdrawals).toLocaleString("en-IN")}</strong>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Closing Balance</span>
                  <strong className="detail-value text-blue">₹{Number(statementData.summary.closingBalance).toLocaleString("en-IN")}</strong>
                </div>
              </div>

              <div className="cb-table-wrapper cb-statement-scroll">
                <table className="cb-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Ref</th>
                      <th>Description</th>
                      <th className="cell-right">Amount (₹)</th>
                      <th className="cell-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementData.transactions.length === 0 ? (
                      <tr><td colSpan="6" className="cb-table-empty">No transactions in this account.</td></tr>
                    ) : (
                      statementData.transactions.map((tx) => {
                        const isInward = ["DEPOSIT", "RECEIPT"].includes(tx.transaction_type) || (tx.transaction_type === "TRANSFER" && tx.description?.includes("Transfer from"));
                        return (
                          <tr key={tx.id}>
                            <td>{new Date(tx.transaction_date).toLocaleDateString("en-IN")}</td>
                            <td>
                              <span className={`tx-type-badge ${tx.transaction_type === "TRANSFER" ? "tx-type-transfer" : isInward ? "tx-type-inward" : "tx-type-outward"}`}>
                                {tx.transaction_type}
                              </span>
                            </td>
                            <td><small className="sub-text">{tx.reference_no || "—"}</small></td>
                            <td className="tx-desc-cell">{tx.description || "—"}</td>
                            <td className="cell-right">
                              <strong className={isInward ? "text-teal" : "text-danger"}>
                                {isInward ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </strong>
                            </td>
                            <td className="cell-right">
                              <strong className="tx-balance-after">
                                ₹{Number(tx.balance_after).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </strong>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions-bar">
                <Button variant="outline" onClick={() => setStatementData(null)}>
                  Close Statement
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}

export default PlasticCashBank;
