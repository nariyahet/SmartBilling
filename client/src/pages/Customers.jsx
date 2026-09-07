import { useEffect, useState, useMemo } from "react";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import AppShell from "../components/AppShell";
import "./Customers.css";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await API.get("/customers");
      if (response.data?.success) {
        setCustomers(response.data.customers || []);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Fetch Customers Error:", error);
      alert(error.response?.data?.message || "Unable to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers();
  }, []);

  const resetForm = () => {
    setName("");
    setMobile("");
    setEmail("");
    setAddress("");
    setEditingId(null);
    setShowModal(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (customer) => {
    setEditingId(customer.id);
    setName(customer.name || "");
    setMobile(customer.mobile || "");
    setEmail(customer.email || "");
    setAddress(customer.address || "");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter customer name");
      return;
    }

    if (!mobile.trim()) {
      alert("Please enter mobile number");
      return;
    }

    if (!/^[0-9+\-\s]{7,15}$/.test(mobile.trim())) {
      alert("Please enter a valid mobile number");
      return;
    }

    try {
      setSaving(true);
      const customerData = {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        address: address.trim(),
      };

      if (editingId) {
        const response = await API.put(`/customers/${editingId}`, customerData);
        if (response.data?.success) {
          alert("Customer updated successfully ✅");
        }
      } else {
        const response = await API.post("/customers", customerData);
        if (response.data?.success) {
          alert("Customer added successfully ✅");
        }
      }

      resetForm();
      await fetchCustomers();
    } catch (error) {
      console.error("Save Customer Error:", error);
      alert(error.response?.data?.message || "Unable to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this customer?");
    if (!confirmed) return;

    try {
      await API.delete(`/customers/${id}`);
      alert("Customer deleted successfully ✅");
      await fetchCustomers();
    } catch (error) {
      if (error.response?.status === 409) {
        alert("This customer cannot be deleted because invoices are linked to this customer.");
        return;
      }
      console.error("Delete Customer Error:", error);
      alert(error.response?.data?.message || "Unable to delete customer");
    }
  };

  const filteredCustomers = useMemo(() => {
    const text = search.toLowerCase().trim();
    if (!text) return customers;
    return customers.filter((customer) => {
      return (
        customer.name?.toLowerCase().includes(text) ||
        customer.mobile?.toLowerCase().includes(text) ||
        customer.email?.toLowerCase().includes(text) ||
        customer.address?.toLowerCase().includes(text)
      );
    });
  }, [customers, search]);

  // KPI Calculations
  const totalCustomers = customers.length;
  const withMobileCount = customers.filter((c) => c.mobile && c.mobile.trim()).length;
  const withEmailCount = customers.filter((c) => c.email && c.email.trim()).length;
  const withAddressCount = customers.filter((c) => c.address && c.address.trim()).length;

  if (loading && customers.length === 0) {
    return <LoadingScreen title="Loading Customers..." subtitle="Fetching client profiles..." />;
  }

  return (
    <AppShell
      activePage="customers"
      searchPlaceholder="Search customers by name, phone, or email..."
      searchValue={search}
      onSearchChange={setSearch}
      headerActions={
        <button
          type="button"
          className="sb-btn-primary"
          onClick={handleOpenAddModal}
        >
          <span>+</span> Add Customer
        </button>
      }
    >
      {/* Header Section */}
      <div className="cust-header-bar">
        <div>
          <div className="cust-badge-tag">CLIENT RELATIONSHIPS</div>
          <h1 className="cust-title">Customer Management</h1>
          <p className="cust-subtitle">
            Manage your client accounts, contact phone numbers, billing addresses, and history.
          </p>
        </div>

        <div className="cust-header-actions">
          <button
            type="button"
            className="sb-btn-refresh-sm"
            onClick={fetchCustomers}
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="sb-btn-primary"
            onClick={handleOpenAddModal}
          >
            <span>+</span> Add Customer
          </button>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="cust-kpi-grid">
        <div className="cust-kpi-card accent-orange">
          <div className="kpi-icon-box">👥</div>
          <div className="kpi-info">
            <span className="kpi-label">Total Customers</span>
            <strong className="kpi-val">{totalCustomers}</strong>
            <span className="kpi-sub">Registered client base</span>
          </div>
        </div>

        <div className="cust-kpi-card accent-blue">
          <div className="kpi-icon-box">📱</div>
          <div className="kpi-info">
            <span className="kpi-label">Verified Mobile</span>
            <strong className="kpi-val text-blue">{withMobileCount}</strong>
            <span className="kpi-sub">WhatsApp & SMS enabled</span>
          </div>
        </div>

        <div className="cust-kpi-card accent-purple">
          <div className="kpi-icon-box">✉️</div>
          <div className="kpi-info">
            <span className="kpi-label">Email Contacts</span>
            <strong className="kpi-val text-purple">{withEmailCount}</strong>
            <span className="kpi-sub">Registered email accounts</span>
          </div>
        </div>

        <div className="cust-kpi-card accent-mint">
          <div className="kpi-icon-box">📍</div>
          <div className="kpi-info">
            <span className="kpi-label">Billing Address</span>
            <strong className="kpi-val text-mint">{withAddressCount}</strong>
            <span className="kpi-sub">Verified delivery locations</span>
          </div>
        </div>
      </div>

      {/* Customers Table Card */}
      <div className="cust-main-card">
        <div className="cust-card-top">
          <div className="cust-card-top-info">
            <h2 className="cust-card-title">Customers Directory</h2>
            <span className="cust-count-pill">
              {filteredCustomers.length} client{filteredCustomers.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="cust-search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, phone, email, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cust-search-input"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="cust-empty-state">
            <span className="empty-icon">👥</span>
            <h3>No Customers Found</h3>
            <p>No customer records match your search criteria. Try a different search term or add a new customer.</p>
            {search && (
              <button
                type="button"
                className="btn-clear-filter"
                onClick={() => setSearch("")}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="cust-table-responsive">
            <table className="cust-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>Billing Address</th>
                  <th style={{ textAlign: "right", width: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer, index) => (
                  <tr key={customer.id}>
                    <td className="text-muted font-bold">{index + 1}</td>
                    <td>
                      <div className="cust-cell-main">
                        <div className="cust-avatar-icon">
                          {customer.name ? customer.name[0].toUpperCase() : "C"}
                        </div>
                        <div>
                          <strong className="cust-name-text">{customer.name}</strong>
                          <span className="cust-code-sub">ID: CUST-{customer.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cust-contact-cell">
                        <div className="contact-row">
                          <span className="contact-icon">📱</span>
                          <strong>{customer.mobile || "—"}</strong>
                        </div>
                        {customer.email && (
                          <div className="contact-row text-muted">
                            <span className="contact-icon">✉️</span>
                            <span>{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="cust-address-text">
                        {customer.address || "No address provided"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="cust-actions-wrap">
                        <button
                          type="button"
                          className="btn-action-edit"
                          onClick={() => handleEdit(customer)}
                          title="Edit Customer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() => handleDelete(customer.id)}
                          title="Delete Customer"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {showModal && (
        <div className="cust-modal-backdrop" onClick={() => resetForm()}>
          <div className="cust-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cust-modal-header">
              <div>
                <h3 className="modal-title">{editingId ? "✏️ Edit Customer" : "➕ Add New Customer"}</h3>
                <span className="modal-subtitle">
                  {editingId ? "Update client contact details and address" : "Enter customer information to register profile"}
                </span>
              </div>
              <button type="button" className="btn-modal-close" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="cust-modal-form">
              <div className="form-group">
                <label>Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel, Shreenath Traders"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Billing & Delivery Address</label>
                <textarea
                  rows="3"
                  placeholder="Enter full address, city, state, pincode..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="cust-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingId ? "Update Customer" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default Customers;
