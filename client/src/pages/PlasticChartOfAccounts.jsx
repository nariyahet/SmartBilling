import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticChartOfAccounts.css";

function PlasticChartOfAccounts() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL"); // ALL, GROUPS, MASTERS
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [masters, setMasters] = useState({ customers: [], suppliers: [] });
  const [summary, setSummary] = useState({
    totalAccounts: 0,
    assetCount: 0,
    liabilityCount: 0,
    equityCount: 0,
    incomeCount: 0,
    expenseCount: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [accountForm, setAccountForm] = useState({
    id: null,
    group_id: "",
    account_code: "",
    account_name: "",
    account_type: "ASSET",
    debit_credit_nature: "DEBIT",
    opening_balance: 0.00,
    description: "",
  });

  const [groupForm, setGroupForm] = useState({
    name: "",
    code: "",
    type: "ASSET",
    parent_id: "",
    description: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (typeFilter !== "ALL") params.type = typeFilter;
      if (statusFilter !== "ALL") params.status = statusFilter;

      const [accRes, grpRes, mastRes] = await Promise.all([
        API.get("/plastic-erp/accounting/accounts/accounts", { params }),
        API.get("/plastic-erp/accounting/accounts/groups"),
        API.get("/plastic-erp/accounting/accounts/integrated-masters"),
      ]);

      if (accRes.data?.success) {
        setAccounts(accRes.data.accounts || []);
        setSummary(accRes.data.summary || {});
      }
      if (grpRes.data?.success) {
        setGroups(grpRes.data.groups || []);
        if (grpRes.data.groups.length > 0 && !accountForm.group_id) {
          setAccountForm((prev) => ({ ...prev, group_id: grpRes.data.groups[0].id }));
        }
      }
      if (mastRes.data?.success) {
        setMasters({
          customers: mastRes.data.customers || [],
          suppliers: mastRes.data.suppliers || [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch Chart of Accounts data:", err);
      alert("Failed to load Chart of Accounts data");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, accountForm.group_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreateAccount = () => {
    setAccountForm({
      id: null,
      group_id: groups[0]?.id || "",
      account_code: "",
      account_name: "",
      account_type: "ASSET",
      debit_credit_nature: "DEBIT",
      opening_balance: 0.00,
      description: "",
    });
    setAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc) => {
    setAccountForm({
      id: acc.id,
      group_id: acc.group_id,
      account_code: acc.account_code,
      account_name: acc.account_name,
      account_type: acc.account_type,
      debit_credit_nature: acc.debit_credit_nature,
      opening_balance: acc.opening_balance,
      description: acc.description || "",
    });
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.account_name || !accountForm.group_id) {
      alert("Account name and group are required");
      return;
    }

    try {
      setSubmitting(true);
      if (accountForm.id) {
        await API.put(`/plastic-erp/accounting/accounts/accounts/${accountForm.id}`, accountForm);
        alert("Account updated successfully");
      } else {
        await API.post("/plastic-erp/accounting/accounts/accounts", accountForm);
        alert("Account created successfully");
      }
      setAccountModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Save account error:", err);
      alert(err.response?.data?.message || "Failed to save account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.name || !groupForm.code) {
      alert("Group name and code are required");
      return;
    }

    try {
      setSubmitting(true);
      await API.post("/plastic-erp/accounting/accounts/groups", groupForm);
      alert("Account group created successfully");
      setGroupModalOpen(false);
      setGroupForm({ name: "", code: "", type: "ASSET", parent_id: "", description: "" });
      fetchData();
    } catch (err) {
      console.error("Save group error:", err);
      alert(err.response?.data?.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (acc) => {
    try {
      const res = await API.get(`/plastic-erp/accounting/accounts/accounts/${acc.id}`);
      if (res.data?.success) {
        setSelectedAccount(res.data);
      }
    } catch (err) {
      console.error("Fetch account details error:", err);
    }
  };

  if (loading && accounts.length === 0) {
    return <LoadingScreen message="Loading Chart of Accounts..." />;
  }

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / Accounting</span>
            <h1 className="plastic-title">🏛️ Chart of Accounts</h1>
            <p className="plastic-subtitle">
              Manage hierarchical ledger accounts, balance natures, opening balances, and integrated masters.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="plastic-btn plastic-btn-secondary"
              onClick={() => setGroupModalOpen(true)}
            >
              + Create Group
            </button>
            <button
              type="button"
              className="plastic-btn plastic-btn-primary"
              onClick={handleOpenCreateAccount}
            >
              + Add Ledger Account
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="plastic-kpi-grid">
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#1d4ed8" }}>📚</span>
            <div>
              <span className="plastic-kpi-label">Total Accounts</span>
              <h3 className="plastic-kpi-val">{summary.totalAccounts || 0}</h3>
              <small className="plastic-kpi-sub">Across {groups.length} account groups</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>🏢</span>
            <div>
              <span className="plastic-kpi-label">Asset Accounts</span>
              <h3 className="plastic-kpi-val">{summary.assetCount || 0}</h3>
              <small className="plastic-kpi-sub">Cash, Bank, Inventory, Debtors</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>⚖️</span>
            <div>
              <span className="plastic-kpi-label">Liability Accounts</span>
              <h3 className="plastic-kpi-val">{summary.liabilityCount || 0}</h3>
              <small className="plastic-kpi-sub">Creditors, Taxes & Payables</small>
            </div>
          </div>
          <div className="plastic-kpi-card">
            <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>📈</span>
            <div>
              <span className="plastic-kpi-label">Income & Expenses</span>
              <h3 className="plastic-kpi-val">{(summary.incomeCount || 0) + (summary.expenseCount || 0)}</h3>
              <small className="plastic-kpi-sub">{summary.incomeCount || 0} Income / {summary.expenseCount || 0} Expenses</small>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="coa-view-tabs">
          <button
            type="button"
            className={`coa-tab-btn ${activeTab === "ALL" ? "active" : ""}`}
            onClick={() => setActiveTab("ALL")}
          >
            📋 All Ledger Accounts ({accounts.length})
          </button>
          <button
            type="button"
            className={`coa-tab-btn ${activeTab === "GROUPS" ? "active" : ""}`}
            onClick={() => setActiveTab("GROUPS")}
          >
            🌳 Account Groups Hierarchy ({groups.length})
          </button>
          <button
            type="button"
            className={`coa-tab-btn ${activeTab === "MASTERS" ? "active" : ""}`}
            onClick={() => setActiveTab("MASTERS")}
          >
            🔗 Integrated Masters (Customers & Suppliers)
          </button>
        </div>

        {activeTab === "ALL" && (
          <div className="plastic-card">
            {/* Filters Bar */}
            <div className="plastic-filters-bar" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="Search account name, code, group..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="plastic-input"
                style={{ flex: "1 1 240px" }}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="plastic-select"
                style={{ flex: "0 0 160px" }}
              >
                <option value="ALL">All Account Types</option>
                <option value="ASSET">ASSET</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="EQUITY">EQUITY</option>
                <option value="INCOME">INCOME</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="plastic-select"
                style={{ flex: "0 0 140px" }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Table */}
            <div className="plastic-table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Group</th>
                    <th>Type</th>
                    <th>Nature</th>
                    <th style={{ textAlign: "right" }}>Opening Bal</th>
                    <th style={{ textAlign: "right" }}>Current Bal</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                        No ledger accounts found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc) => (
                      <tr key={acc.id}>
                        <td>
                          <strong>{acc.account_code}</strong>
                          {Boolean(acc.is_system) && <span className="coa-system-tag" style={{ marginLeft: "6px" }}>SYS</span>}
                        </td>
                        <td>
                          <span style={{ fontWeight: "600", color: "#0f172a" }}>{acc.account_name}</span>
                          {acc.reference_type && (
                            <small style={{ display: "block", color: "#64748b", fontSize: "0.75rem" }}>
                              Ref: {acc.reference_type}
                            </small>
                          )}
                        </td>
                        <td>{acc.group_name}</td>
                        <td>
                          <span className={`coa-type-badge coa-type-${acc.account_type.toLowerCase()}`}>
                            {acc.account_type}
                          </span>
                        </td>
                        <td>
                          <span className={`coa-nature-badge coa-nature-${acc.debit_credit_nature.toLowerCase() === "debit" ? "dr" : "cr"}`}>
                            {acc.debit_credit_nature}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>₹{Number(acc.opening_balance || 0).toLocaleString("en-IN")}</td>
                        <td style={{ textAlign: "right", fontWeight: "700" }}>₹{Number(acc.current_balance || 0).toLocaleString("en-IN")}</td>
                        <td>
                          <span className={`plastic-badge ${acc.status === "ACTIVE" ? "plastic-badge-success" : "plastic-badge-secondary"}`}>
                            {acc.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="plastic-action-btn"
                            title="View Account Details & Journal"
                            onClick={() => handleViewDetails(acc)}
                          >
                            👁️
                          </button>
                          <button
                            type="button"
                            className="plastic-action-btn"
                            title="Edit Account"
                            onClick={() => handleOpenEditAccount(acc)}
                          >
                            ✏️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "GROUPS" && (
          <div>
            {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((type) => {
              const grpList = groups.filter((g) => g.type === type);
              if (grpList.length === 0) return null;
              return (
                <div key={type} className="coa-group-section">
                  <div className="coa-group-header">
                    <span className="coa-group-title">
                      <span className={`coa-type-badge coa-type-${type.toLowerCase()}`}>{type}</span>
                      <span>Primary Account Groups</span>
                    </span>
                    <small style={{ color: "#64748b", fontWeight: "600" }}>{grpList.length} Groups</small>
                  </div>
                  <div className="plastic-table-responsive">
                    <table className="plastic-table">
                      <thead>
                        <tr>
                          <th>Group Code</th>
                          <th>Group Name</th>
                          <th>Description</th>
                          <th>Parent Group</th>
                          <th style={{ textAlign: "center" }}>Accounts Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grpList.map((g) => (
                          <tr key={g.id}>
                            <td><strong>{g.code}</strong></td>
                            <td>{g.name}</td>
                            <td style={{ color: "#64748b" }}>{g.description || "—"}</td>
                            <td>{g.parent_name || "Primary"}</td>
                            <td style={{ textAlign: "center", fontWeight: "700" }}>{g.account_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "MASTERS" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" }}>
            {/* Customers Control */}
            <div className="plastic-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#1e293b" }}>
                  👥 Customers (Sundry Debtors)
                </h3>
                <span className="plastic-badge plastic-badge-info">{masters.customers.length} Customers</span>
              </div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 16px 0" }}>
                Direct integration with existing SmartBilling Customers master. Balance reflects sales invoices minus receipts.
              </p>
              <div className="plastic-table-responsive" style={{ maxHeight: "400px" }}>
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mobile</th>
                      <th style={{ textAlign: "right" }}>Outstanding Receivable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masters.customers.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: "center" }}>No customers found</td></tr>
                    ) : (
                      masters.customers.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.mobile}</td>
                          <td style={{ textAlign: "right", fontWeight: "700", color: Number(c.outstanding_balance) > 0 ? "#b91c1c" : "#047857" }}>
                            ₹{Number(c.outstanding_balance || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Suppliers Control */}
            <div className="plastic-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#1e293b" }}>
                  🏢 Suppliers (Sundry Creditors)
                </h3>
                <span className="plastic-badge plastic-badge-info">{masters.suppliers.length} Suppliers</span>
              </div>
              <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 16px 0" }}>
                Direct integration with Plastic ERP Scrap Suppliers master. Balance reflects purchase bills minus disbursements.
              </p>
              <div className="plastic-table-responsive" style={{ maxHeight: "400px" }}>
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>GSTIN / State</th>
                      <th style={{ textAlign: "right" }}>Current Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masters.suppliers.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: "center" }}>No suppliers found</td></tr>
                    ) : (
                      masters.suppliers.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.supplier_name}</strong>
                            <small style={{ display: "block", color: "#64748b" }}>{s.supplier_code}</small>
                          </td>
                          <td>
                            {s.gst_number || "Unregistered"}
                            <small style={{ display: "block", color: "#64748b" }}>{s.state || "Gujarat"}</small>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "700", color: Number(s.current_payable) > 0 ? "#b91c1c" : "#047857" }}>
                            ₹{Number(s.current_payable || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create/Edit Account */}
        {accountModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => setAccountModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
              <div className="plastic-modal-header">
                <h2>{accountForm.id ? "✏️ Edit Ledger Account" : "+ Add New Ledger Account"}</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setAccountModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveAccount}>
                <div className="plastic-modal-body">
                  <div className="plastic-form-group">
                    <label>Account Group *</label>
                    <select
                      value={accountForm.group_id}
                      onChange={(e) => {
                        const selGrp = groups.find((g) => g.id === Number(e.target.value));
                        setAccountForm({
                          ...accountForm,
                          group_id: e.target.value,
                          account_type: selGrp ? selGrp.type : accountForm.account_type,
                          debit_credit_nature: selGrp && ["ASSET", "EXPENSE"].includes(selGrp.type) ? "DEBIT" : "CREDIT",
                        });
                      }}
                      className="plastic-select"
                      required
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          [{g.type}] {g.name} ({g.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>Account Code</label>
                      <input
                        type="text"
                        placeholder="Auto if blank"
                        value={accountForm.account_code}
                        onChange={(e) => setAccountForm({ ...accountForm, account_code: e.target.value })}
                        className="plastic-input"
                        disabled={Boolean(accountForm.id)}
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Account Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Factory Boiler Maintenance"
                        value={accountForm.account_name}
                        onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                        className="plastic-input"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>Account Type</label>
                      <input
                        type="text"
                        value={accountForm.account_type}
                        className="plastic-input"
                        readOnly
                        style={{ background: "#f8fafc", color: "#64748b" }}
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Normal Balance Nature</label>
                      <select
                        value={accountForm.debit_credit_nature}
                        onChange={(e) => setAccountForm({ ...accountForm, debit_credit_nature: e.target.value })}
                        className="plastic-select"
                      >
                        <option value="DEBIT">DEBIT (Dr)</option>
                        <option value="CREDIT">CREDIT (Cr)</option>
                      </select>
                    </div>
                  </div>

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

                  <div className="plastic-form-group">
                    <label>Description / Notes</label>
                    <textarea
                      rows="2"
                      value={accountForm.description}
                      onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                      className="plastic-textarea"
                      placeholder="Optional remarks about account purpose"
                    />
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setAccountModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="plastic-btn plastic-btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : accountForm.id ? "Update Account" : "Save Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Group */}
        {groupModalOpen && (
          <div className="plastic-modal-backdrop" onClick={() => setGroupModalOpen(false)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
              <div className="plastic-modal-header">
                <h2>+ Create Account Group</h2>
                <button type="button" className="plastic-modal-close" onClick={() => setGroupModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveGroup}>
                <div className="plastic-modal-body">
                  <div className="plastic-form-group">
                    <label>Group Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Administrative Overheads"
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      className="plastic-input"
                      required
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="plastic-form-group">
                      <label>Group Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. EXP_ADMIN"
                        value={groupForm.code}
                        onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })}
                        className="plastic-input"
                        required
                      />
                    </div>
                    <div className="plastic-form-group">
                      <label>Account Type *</label>
                      <select
                        value={groupForm.type}
                        onChange={(e) => setGroupForm({ ...groupForm, type: e.target.value })}
                        className="plastic-select"
                        required
                      >
                        <option value="ASSET">ASSET</option>
                        <option value="LIABILITY">LIABILITY</option>
                        <option value="EQUITY">EQUITY</option>
                        <option value="INCOME">INCOME</option>
                        <option value="EXPENSE">EXPENSE</option>
                      </select>
                    </div>
                  </div>
                  <div className="plastic-form-group">
                    <label>Description</label>
                    <textarea
                      rows="2"
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      className="plastic-textarea"
                    />
                  </div>
                </div>
                <div className="plastic-modal-footer">
                  <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setGroupModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="plastic-btn plastic-btn-primary" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Group"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Account Details & Recent Journal */}
        {selectedAccount && (
          <div className="plastic-modal-backdrop" onClick={() => setSelectedAccount(null)}>
            <div className="plastic-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
              <div className="plastic-modal-header">
                <h2>
                  🔍 {selectedAccount.account.account_name} ({selectedAccount.account.account_code})
                </h2>
                <button type="button" className="plastic-modal-close" onClick={() => setSelectedAccount(null)}>✕</button>
              </div>
              <div className="plastic-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div>
                    <small style={{ color: "#64748b" }}>Type</small>
                    <strong style={{ display: "block" }}>{selectedAccount.account.account_type}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Nature</small>
                    <strong style={{ display: "block" }}>{selectedAccount.account.debit_credit_nature}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Opening Balance</small>
                    <strong style={{ display: "block" }}>₹{Number(selectedAccount.account.opening_balance || 0).toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <small style={{ color: "#64748b" }}>Current Balance</small>
                    <strong style={{ display: "block", color: "#0284c7" }}>₹{Number(selectedAccount.account.current_balance || 0).toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                <h4 style={{ margin: "14px 0 8px 0" }}>Recent Journal Entries</h4>
                <div className="plastic-table-responsive" style={{ maxHeight: "300px" }}>
                  <table className="plastic-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Journal No</th>
                        <th>Ref</th>
                        <th>Dr / Cr</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Narration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAccount.recentEntries?.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: "center" }}>No journal postings yet.</td></tr>
                      ) : (
                        selectedAccount.recentEntries.map((re) => (
                          <tr key={re.id}>
                            <td>{re.entry_date ? new Date(re.entry_date).toLocaleDateString("en-IN") : "—"}</td>
                            <td><strong>{re.journal_no}</strong></td>
                            <td><small>{re.reference_type}</small></td>
                            <td>
                              <span className={`coa-nature-badge coa-nature-${re.entry_type.toLowerCase() === "debit" ? "dr" : "cr"}`}>
                                {re.entry_type}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "700" }}>₹{Number(re.amount || 0).toLocaleString("en-IN")}</td>
                            <td style={{ fontSize: "0.85rem", color: "#475569" }}>{re.narration || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="plastic-modal-footer">
                <button type="button" className="plastic-btn plastic-btn-secondary" onClick={() => setSelectedAccount(null)}>
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

export default PlasticChartOfAccounts;
