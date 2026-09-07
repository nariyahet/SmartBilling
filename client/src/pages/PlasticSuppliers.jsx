import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticSuppliers.css";

function PlasticSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    supplier_code: "",
    supplier_name: "",
    company_name: "",
    mobile: "",
    email: "",
    gst_number: "",
    address: "",
    city: "",
    state: "",
    payment_terms: "",
    opening_balance: 0,
    status: "ACTIVE",
    notes: "",
  });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError("");

      let url = "/suppliers";
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await API.get(url);
      if (res.data?.success) {
        setSuppliers(res.data.suppliers || []);
      }
    } catch (err) {
      console.error("Fetch suppliers error:", err);
      setError(err.response?.data?.message || "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSuppliers();
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      supplier_code: "",
      supplier_name: "",
      company_name: "",
      mobile: "",
      email: "",
      gst_number: "",
      address: "",
      city: "",
      state: "",
      payment_terms: "30 Days",
      opening_balance: 0,
      status: "ACTIVE",
      notes: "",
    });
    setIsModalOpen(true);
    setError("");
  };

  const handleOpenEditModal = (sup) => {
    setEditingId(sup.id);
    setFormData({
      supplier_code: sup.supplier_code || "",
      supplier_name: sup.supplier_name || "",
      company_name: sup.company_name || "",
      mobile: sup.mobile || "",
      email: sup.email || "",
      gst_number: sup.gst_number || "",
      address: sup.address || "",
      city: sup.city || "",
      state: sup.state || "",
      payment_terms: sup.payment_terms || "",
      opening_balance: sup.opening_balance || 0,
      status: sup.status || "ACTIVE",
      notes: sup.notes || "",
    });
    setIsModalOpen(true);
    setError("");
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_name.trim()) {
      alert("Supplier name is required.");
      return;
    }
    if (!formData.mobile.trim()) {
      alert("Mobile number is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingId) {
        await API.put(`/suppliers/${editingId}`, formData);
        setSuccessMsg("Supplier updated successfully! ✅");
      } else {
        await API.post("/suppliers", formData);
        setSuccessMsg("Supplier created successfully! ✅");
      }

      setIsModalOpen(false);
      await fetchSuppliers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Save supplier error:", err);
      alert(err.response?.data?.message || "Failed to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Are you sure you want to delete supplier "${name}"?`);
    if (!confirmed) return;

    try {
      await API.delete(`/suppliers/${id}`);
      setSuccessMsg(`Supplier "${name}" deleted successfully. ✅`);
      await fetchSuppliers();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Delete supplier error:", err);
      alert(err.response?.data?.message || "Failed to delete supplier.");
    }
  };

  return (
    <div className="plastic-suppliers-page">
      <PlasticNavbar />

      <main className="plastic-content-wrap">
        <div className="page-title-row">
          <div>
            <h1>🏢 Scrap Suppliers Management</h1>
            <p>Maintain vendor master, scrap procurement terms, contact details, and GST numbers</p>
          </div>

          <div className="title-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            <button type="button" className="btn-add-entity" onClick={handleOpenAddModal}>
              ➕ Add New Supplier
            </button>
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}
        {successMsg && <div className="alert-box success">{successMsg}</div>}

        {/* Filter Controls */}
        <div className="filter-card">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by supplier name, code, mobile, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn-search">
              🔍 Search
            </button>
            {searchTerm && (
              <button
                type="button"
                className="btn-clear"
                onClick={() => {
                  setSearchTerm("");
                  fetchSuppliers();
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="status-toggle-wrap">
            <span>Status:</span>
            {["ALL", "ACTIVE", "INACTIVE"].map((st) => (
              <button
                key={st}
                type="button"
                className={`filter-chip ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Suppliers Data Table */}
        {loading ? (
          <LoadingScreen title="Loading Suppliers..." subtitle="Retrieving vendor records..." />
        ) : suppliers.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-icon">🏢</span>
            <h3>No Suppliers Found</h3>
            <p>Start by adding your first scrap plastic supplier for the Kim plant.</p>
            <button type="button" className="btn-add-entity" onClick={handleOpenAddModal}>
              ➕ Add Supplier Now
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Supplier / Company</th>
                  <th>Contact Info</th>
                  <th>Location</th>
                  <th>GST Number</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((sup) => (
                  <tr key={sup.id}>
                    <td>
                      <span className="code-pill">{sup.supplier_code}</span>
                    </td>
                    <td>
                      <strong className="entity-primary-name">{sup.supplier_name}</strong>
                      {sup.company_name && <span className="entity-subtext">{sup.company_name}</span>}
                    </td>
                    <td>
                      <div className="contact-col">
                        <span>📞 {sup.mobile}</span>
                        {sup.email && <small>✉️ {sup.email}</small>}
                      </div>
                    </td>
                    <td>
                      <span className="location-text">
                        {[sup.city, sup.state].filter(Boolean).join(", ") || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="gst-badge">{sup.gst_number || "Unregistered"}</span>
                    </td>
                    <td>
                      <strong>₹{Number(sup.opening_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                    </td>
                    <td>
                      <span className={`status-pill ${sup.status === "ACTIVE" ? "active" : "inactive"}`}>
                        {sup.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons-cell">
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => handleOpenEditModal(sup)}
                          title="Edit Supplier"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDelete(sup.id, sup.supplier_name)}
                          title="Delete Supplier"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="plastic-modal-backdrop" onClick={handleCloseModal}>
          <div className="plastic-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? "✏️ Edit Scrap Supplier" : "➕ Add Scrap Supplier"}</h2>
              <button type="button" className="btn-close-modal" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="plastic-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Supplier Code (Optional / Auto-generated)</label>
                  <input
                    type="text"
                    name="supplier_code"
                    placeholder="e.g. SUP-1001"
                    value={formData.supplier_code}
                    onChange={handleFormChange}
                    disabled={!!editingId}
                  />
                  <small className="help-text">Leave blank to auto-generate sequentially</small>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleFormChange}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Supplier Contact Person Name *</label>
                  <input
                    type="text"
                    name="supplier_name"
                    placeholder="e.g. Rajeshbhai Patel"
                    value={formData.supplier_name}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Company / Firm Name</label>
                  <input
                    type="text"
                    name="company_name"
                    placeholder="e.g. Surat Scrap Traders"
                    value={formData.company_name}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Mobile Number *</label>
                  <input
                    type="tel"
                    name="mobile"
                    placeholder="e.g. 9876543210"
                    value={formData.mobile}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="e.g. rajesh@example.com"
                    value={formData.email}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>GST Number</label>
                  <input
                    type="text"
                    name="gst_number"
                    placeholder="24AAAAA0000A1Z5"
                    value={formData.gst_number}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    name="city"
                    placeholder="Kim / Surat"
                    value={formData.city}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    name="state"
                    placeholder="Gujarat"
                    value={formData.state}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Payment Terms</label>
                  <input
                    type="text"
                    name="payment_terms"
                    placeholder="e.g. Immediate / 15 Days / 30 Days"
                    value={formData.payment_terms}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="opening_balance"
                    placeholder="0.00"
                    value={formData.opening_balance}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Address</label>
                <textarea
                  name="address"
                  rows="2"
                  placeholder="Plot / GIDC / Highway address"
                  value={formData.address}
                  onChange={handleFormChange}
                ></textarea>
              </div>

              <div className="form-group">
                <label>Notes / Quality Remarks</label>
                <textarea
                  name="notes"
                  rows="2"
                  placeholder="Notes about scrap quality, polymers supplied, etc."
                  value={formData.notes}
                  onChange={handleFormChange}
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticSuppliers;
