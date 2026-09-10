import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, StatusBadge, Tabs, Modal } from "../components";
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
        const grps = grpRes.data.groups || [];
        setGroups(grps);
        if (grps.length > 0 && !accountForm.group_id) {
          setAccountForm((prev) => ({ ...prev, group_id: grps[0].id }));
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

  const tabItems = [
    { key: "ALL", label: `All Ledger Accounts (${accounts.length})`, icon: "📋" },
    { key: "GROUPS", label: `Account Groups (${groups.length})`, icon: "🌳" },
    { key: "MASTERS", label: "Integrated Masters (Customers & Suppliers)", icon: "🔗" },
  ];

  if (loading && accounts.length === 0) {
    return <LoadingScreen message="Loading Chart of Accounts..." />;
  }

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="Chart of Accounts"
          subtitle="Manage hierarchical ledger accounts, normal balance natures, opening balances, and integrated masters"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "Accounting & GST", to: "/plastic-erp/accounting" },
            { label: "Chart of Accounts" },
          ]}
          actions={
            <div className="coa-action-group">
              <Button
                variant="outline"
                icon="➕"
                onClick={() => setGroupModalOpen(true)}
              >
                Create Group
              </Button>
              <Button
                variant="primary"
                icon="➕"
                onClick={handleOpenCreateAccount}
              >
                Add Ledger Account
              </Button>
            </div>
          }
        />

        {/* KPI Cards */}
        <div className="coa-kpi-grid">
          <KpiCard
            title="Total Accounts"
            value={summary.totalAccounts || 0}
            subtitle={`Across ${groups.length} account groups`}
            icon="📚"
            color="navy"
          />
          <KpiCard
            title="Asset Accounts"
            value={summary.assetCount || 0}
            subtitle="Cash, Bank, Inventory, Debtors"
            icon="🏢"
            color="blue"
          />
          <KpiCard
            title="Liability Accounts"
            value={summary.liabilityCount || 0}
            subtitle="Creditors, Taxes & Payables"
            icon="⚖️"
            color="amber"
          />
          <KpiCard
            title="Income & Expenses"
            value={(summary.incomeCount || 0) + (summary.expenseCount || 0)}
            subtitle={`${summary.incomeCount || 0} Income / ${summary.expenseCount || 0} Expenses`}
            icon="📈"
            color="teal"
          />
        </div>

        {/* Tab Switcher */}
        <div className="coa-tabs-wrap">
          <Tabs
            items={tabItems}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
          />
        </div>

        {/* Tab 1: All Ledger Accounts */}
        {activeTab === "ALL" && (
          <Card
            title="Ledger Accounts Register"
            subtitle="Complete list of general ledger accounts with real-time Dr/Cr balances"
          >
            {/* Filters */}
            <div className="coa-filters-row">
              <input
                type="text"
                placeholder="Search account name, code, group..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sb-input coa-search-input"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="sb-select coa-type-select"
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
                className="sb-select coa-status-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Accounts Table */}
            <div className="coa-table-wrapper">
              <table className="coa-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Group</th>
                    <th>Type</th>
                    <th>Nature</th>
                    <th className="cell-right">Opening Bal</th>
                    <th className="cell-right">Current Bal</th>
                    <th>Status</th>
                    <th className="cell-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="coa-table-empty">
                        No ledger accounts found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc) => (
                      <tr key={acc.id}>
                        <td>
                          <span className="coa-code-badge">{acc.account_code}</span>
                          {Boolean(acc.is_system) && <span className="coa-system-tag">SYS</span>}
                        </td>
                        <td>
                          <strong className="coa-account-name">{acc.account_name}</strong>
                          {acc.reference_type && (
                            <div className="coa-ref-sub">Ref: {acc.reference_type}</div>
                          )}
                        </td>
                        <td>
                          <span className="coa-group-text">{acc.group_name}</span>
                        </td>
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
                        <td className="cell-right">
                          ₹{Number(acc.opening_balance || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="cell-right">
                          <strong className="coa-balance-strong">
                            ₹{Number(acc.current_balance || 0).toLocaleString("en-IN")}
                          </strong>
                        </td>
                        <td>
                          <StatusBadge status={acc.status} />
                        </td>
                        <td className="cell-right">
                          <div className="coa-actions-inline">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="👁️"
                              title="View Details & Journal"
                              onClick={() => handleViewDetails(acc)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="✏️"
                              title="Edit Account"
                              onClick={() => handleOpenEditAccount(acc)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 2: Account Groups Hierarchy */}
        {activeTab === "GROUPS" && (
          <div className="coa-groups-container">
            {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((type) => {
              const grpList = groups.filter((g) => g.type === type);
              if (grpList.length === 0) return null;
              return (
                <Card
                  key={type}
                  className="coa-group-card"
                  title={
                    <div className="coa-group-card-header">
                      <span className={`coa-type-badge coa-type-${type.toLowerCase()}`}>{type}</span>
                      <span>Primary Account Groups</span>
                    </div>
                  }
                  actions={
                    <span className="coa-grp-count-label">{grpList.length} Groups</span>
                  }
                >
                  <div className="coa-table-wrapper">
                    <table className="coa-table">
                      <thead>
                        <tr>
                          <th>Group Code</th>
                          <th>Group Name</th>
                          <th>Description</th>
                          <th>Parent Group</th>
                          <th className="cell-right">Accounts Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grpList.map((g) => (
                          <tr key={g.id}>
                            <td>
                              <span className="coa-code-badge">{g.code}</span>
                            </td>
                            <td><strong>{g.name}</strong></td>
                            <td className="text-muted">{g.description || "—"}</td>
                            <td>{g.parent_name || "Primary"}</td>
                            <td className="cell-right">
                              <strong className="coa-account-count-badge">{g.account_count || 0}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Tab 3: Integrated Masters (Customers & Suppliers) */}
        {activeTab === "MASTERS" && (
          <div className="coa-masters-grid">
            {/* Customers Control */}
            <Card
              title="Customers (Sundry Debtors)"
              subtitle="Direct integration with existing Customers master. Balance reflects sales minus receipts."
              actions={
                <span className="coa-master-count-badge">{masters.customers.length} Customers</span>
              }
            >
              <div className="coa-table-wrapper coa-max-scroll">
                <table className="coa-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mobile</th>
                      <th className="cell-right">Receivable (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masters.customers.length === 0 ? (
                      <tr><td colSpan="3" className="coa-table-empty">No customers found</td></tr>
                    ) : (
                      masters.customers.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.mobile}</td>
                          <td className="cell-right">
                            <strong className={Number(c.outstanding_balance) > 0 ? "text-amber" : "text-teal"}>
                              ₹{Number(c.outstanding_balance || 0).toLocaleString("en-IN")}
                            </strong>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Suppliers Control */}
            <Card
              title="Suppliers (Sundry Creditors)"
              subtitle="Direct integration with Scrap Suppliers master. Balance reflects purchase bills minus disbursements."
              actions={
                <span className="coa-master-count-badge">{masters.suppliers.length} Suppliers</span>
              }
            >
              <div className="coa-table-wrapper coa-max-scroll">
                <table className="coa-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>GSTIN / State</th>
                      <th className="cell-right">Payable (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masters.suppliers.length === 0 ? (
                      <tr><td colSpan="3" className="coa-table-empty">No suppliers found</td></tr>
                    ) : (
                      masters.suppliers.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.supplier_name}</strong>
                            <div className="sub-text">{s.supplier_code}</div>
                          </td>
                          <td>
                            {s.gst_number || "Unregistered"}
                            <div className="sub-text">{s.state || "Gujarat"}</div>
                          </td>
                          <td className="cell-right">
                            <strong className={Number(s.current_payable) > 0 ? "text-amber" : "text-teal"}>
                              ₹{Number(s.current_payable || 0).toLocaleString("en-IN")}
                            </strong>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Modal: Create/Edit Account */}
        <Modal
          isOpen={accountModalOpen}
          onClose={() => !submitting && setAccountModalOpen(false)}
          title={accountForm.id ? "Edit Ledger Account" : "Add New Ledger Account"}
          subtitle="Define general ledger account, nature of balance, and group assignment"
          size="md"
        >
          <form onSubmit={handleSaveAccount} className="coa-modal-form">
            <div className="form-group">
              <label className="sb-label">Account Group *</label>
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
                className="sb-select"
                required
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    [{g.type}] {g.name} ({g.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Account Code</label>
                <input
                  type="text"
                  placeholder="Auto-assigned if blank"
                  value={accountForm.account_code}
                  onChange={(e) => setAccountForm({ ...accountForm, account_code: e.target.value })}
                  className="sb-input"
                  disabled={Boolean(accountForm.id)}
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Factory Boiler Maintenance"
                  value={accountForm.account_name}
                  onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                  className="sb-input"
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Account Type</label>
                <input
                  type="text"
                  value={accountForm.account_type}
                  className="sb-input"
                  readOnly
                  style={{ background: "#f8fafc", color: "#64748b" }}
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Normal Balance Nature</label>
                <select
                  value={accountForm.debit_credit_nature}
                  onChange={(e) => setAccountForm({ ...accountForm, debit_credit_nature: e.target.value })}
                  className="sb-select"
                >
                  <option value="DEBIT">DEBIT (Dr)</option>
                  <option value="CREDIT">CREDIT (Cr)</option>
                </select>
              </div>
            </div>

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

            <div className="form-group">
              <label className="sb-label">Description / Remarks</label>
              <textarea
                rows="2"
                value={accountForm.description}
                onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                className="sb-textarea"
                placeholder="Optional remarks about account purpose"
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
                {submitting ? "Saving..." : accountForm.id ? "Update Account" : "Save Account"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Create Group */}
        <Modal
          isOpen={groupModalOpen}
          onClose={() => !submitting && setGroupModalOpen(false)}
          title="Create Account Group"
          subtitle="Create high-level account groups for the ledger hierarchy"
          size="md"
        >
          <form onSubmit={handleSaveGroup} className="coa-modal-form">
            <div className="form-group">
              <label className="sb-label">Group Name *</label>
              <input
                type="text"
                placeholder="e.g. Administrative Overheads"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                className="sb-input"
                required
              />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Group Code *</label>
                <input
                  type="text"
                  placeholder="e.g. EXP_ADMIN"
                  value={groupForm.code}
                  onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase() })}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Account Type *</label>
                <select
                  value={groupForm.type}
                  onChange={(e) => setGroupForm({ ...groupForm, type: e.target.value })}
                  className="sb-select"
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
            <div className="form-group">
              <label className="sb-label">Description</label>
              <textarea
                rows="2"
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                className="sb-textarea"
                placeholder="Optional group description"
              />
            </div>
            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setGroupModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
              >
                {submitting ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Account Details & Recent Journal */}
        <Modal
          isOpen={Boolean(selectedAccount)}
          onClose={() => setSelectedAccount(null)}
          title={selectedAccount ? `${selectedAccount.account.account_name} (${selectedAccount.account.account_code})` : ""}
          subtitle="Ledger summary and recent journal postings"
          size="lg"
        >
          {selectedAccount && (
            <div className="coa-details-content">
              <div className="coa-details-kpi-bar">
                <div className="detail-box">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">{selectedAccount.account.account_type}</span>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Nature</span>
                  <span className="detail-value">{selectedAccount.account.debit_credit_nature}</span>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Opening Balance</span>
                  <span className="detail-value">₹{Number(selectedAccount.account.opening_balance || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="detail-box">
                  <span className="detail-label">Current Balance</span>
                  <span className="detail-value text-blue">₹{Number(selectedAccount.account.current_balance || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <h4 className="coa-journal-heading">Recent Journal Postings</h4>
              <div className="coa-table-wrapper coa-max-scroll">
                <table className="coa-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Journal No</th>
                      <th>Ref Type</th>
                      <th>Dr / Cr</th>
                      <th className="cell-right">Amount</th>
                      <th>Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAccount.recentEntries?.length === 0 ? (
                      <tr><td colSpan="6" className="coa-table-empty">No journal postings recorded yet.</td></tr>
                    ) : (
                      selectedAccount.recentEntries.map((re) => (
                        <tr key={re.id}>
                          <td>{re.entry_date ? new Date(re.entry_date).toLocaleDateString("en-IN") : "—"}</td>
                          <td><strong>{re.journal_no}</strong></td>
                          <td><span className="coa-ref-sub">{re.reference_type}</span></td>
                          <td>
                            <span className={`coa-nature-badge coa-nature-${re.entry_type.toLowerCase() === "debit" ? "dr" : "cr"}`}>
                              {re.entry_type}
                            </span>
                          </td>
                          <td className="cell-right">
                            <strong className="coa-balance-strong">₹{Number(re.amount || 0).toLocaleString("en-IN")}</strong>
                          </td>
                          <td className="text-muted">{re.narration || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions-bar">
                <Button variant="outline" onClick={() => setSelectedAccount(null)}>
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

export default PlasticChartOfAccounts;
