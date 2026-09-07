import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticRawMaterials.css";

const PLASTIC_TYPES = ["ALL", "PET", "PP", "HDPE", "LDPE", "OTHER"];

function PlasticRawMaterials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    material_code: "",
    material_name: "",
    category: "",
    plastic_type: "PET",
    grade: "",
    color: "",
    unit: "KG",
    minimum_stock: 500,
    maximum_stock: 50000,
    default_purchase_rate: 0,
    default_selling_rate: 0,
    description: "",
    status: "ACTIVE",
  });

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError("");

      let url = "/raw-materials";
      const params = new URLSearchParams();
      if (selectedType !== "ALL") params.append("plastic_type", selectedType);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await API.get(url);
      if (res.data?.success) {
        setMaterials(res.data.raw_materials || []);
      }
    } catch (err) {
      console.error("Fetch raw materials error:", err);
      setError(err.response?.data?.message || "Failed to load raw materials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMaterials();
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      material_code: "",
      material_name: "",
      category: "BOTTLES",
      plastic_type: "PET",
      grade: "A Grade",
      color: "Transparent",
      unit: "KG",
      minimum_stock: 500,
      maximum_stock: 50000,
      default_purchase_rate: 42.5,
      default_selling_rate: 55,
      description: "",
      status: "ACTIVE",
    });
    setIsModalOpen(true);
    setError("");
  };

  const handleOpenEditModal = (mat) => {
    setEditingId(mat.id);
    setFormData({
      material_code: mat.material_code || "",
      material_name: mat.material_name || "",
      category: mat.category || "",
      plastic_type: mat.plastic_type || "PET",
      grade: mat.grade || "",
      color: mat.color || "",
      unit: mat.unit || "KG",
      minimum_stock: mat.minimum_stock || 0,
      maximum_stock: mat.maximum_stock || 0,
      default_purchase_rate: mat.default_purchase_rate || 0,
      default_selling_rate: mat.default_selling_rate || 0,
      description: mat.description || "",
      status: mat.status || "ACTIVE",
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
    if (!formData.material_name.trim()) {
      alert("Material name is required.");
      return;
    }
    if (!formData.plastic_type.trim()) {
      alert("Plastic polymer type is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingId) {
        await API.put(`/raw-materials/${editingId}`, formData);
        setSuccessMsg("Raw material updated successfully! ✅");
      } else {
        await API.post("/raw-materials", formData);
        setSuccessMsg("Raw material created successfully! ✅");
      }

      setIsModalOpen(false);
      await fetchMaterials();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Save material error:", err);
      alert(err.response?.data?.message || "Failed to save raw material.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Are you sure you want to delete raw material "${name}"?`);
    if (!confirmed) return;

    try {
      await API.delete(`/raw-materials/${id}`);
      setSuccessMsg(`Raw material "${name}" deleted successfully. ✅`);
      await fetchMaterials();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Delete material error:", err);
      alert(err.response?.data?.message || "Failed to delete raw material.");
    }
  };

  return (
    <div className="plastic-materials-page">
      <PlasticNavbar />

      <main className="plastic-content-wrap">
        <div className="page-title-row">
          <div>
            <h1>♻️ Scrap Raw Material Catalog</h1>
            <p>Maintain plastic polymers (PET, PP, HDPE, LDPE), scrap grades, safety stock thresholds, and purchase rates</p>
          </div>

          <div className="title-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            <button type="button" className="btn-add-entity" onClick={handleOpenAddModal}>
              ➕ Add Raw Material
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
              placeholder="Search by material name, code, or category..."
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
                  fetchMaterials();
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="type-pills-wrap">
            <span>Polymer:</span>
            {PLASTIC_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`filter-chip ${selectedType === type ? "active" : ""}`}
                onClick={() => setSelectedType(type)}
              >
                {type}
              </button>
            ))}
          </div>

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

        {/* Materials Table */}
        {loading ? (
          <LoadingScreen title="Loading Raw Materials..." subtitle="Retrieving polymer master..." />
        ) : materials.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-icon">♻️</span>
            <h3>No Raw Materials Found</h3>
            <p>Register plastic polymers like PET Bottles, PP Bags, or HDPE Scrap to begin.</p>
            <button type="button" className="btn-add-entity" onClick={handleOpenAddModal}>
              ➕ Add Raw Material
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Polymer</th>
                  <th>Code</th>
                  <th>Material Name</th>
                  <th>Category / Grade</th>
                  <th>Current Stock</th>
                  <th>Min Alert</th>
                  <th>Default Rates</th>
                  <th>Stock Health</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => {
                  const isLow = Number(mat.current_stock || 0) <= Number(mat.minimum_stock || 0);
                  return (
                    <tr key={mat.id}>
                      <td>
                        <span className={`polymer-badge ${String(mat.plastic_type).toLowerCase()}`}>
                          {mat.plastic_type}
                        </span>
                      </td>
                      <td>
                        <span className="code-pill">{mat.material_code}</span>
                      </td>
                      <td>
                        <strong className="entity-primary-name">{mat.material_name}</strong>
                        {mat.color && <span className="entity-subtext">Color: {mat.color}</span>}
                      </td>
                      <td>
                        <span className="category-text">{mat.category || "General Scrap"}</span>
                        {mat.grade && <small className="grade-badge">{mat.grade}</small>}
                      </td>
                      <td>
                        <strong className="stock-number">
                          {Number(mat.current_stock || 0).toLocaleString("en-IN")} {mat.unit || "KG"}
                        </strong>
                      </td>
                      <td>
                        <span className="threshold-text">
                          {Number(mat.minimum_stock || 0).toLocaleString("en-IN")} {mat.unit || "KG"}
                        </span>
                      </td>
                      <td>
                        <div className="rate-col">
                          <span>Buy: ₹{Number(mat.default_purchase_rate || 0).toFixed(2)}</span>
                          <small>Sell: ₹{Number(mat.default_selling_rate || 0).toFixed(2)}</small>
                        </div>
                      </td>
                      <td>
                        {isLow ? (
                          <span className="health-badge danger">⚠️ Low Stock</span>
                        ) : (
                          <span className="health-badge optimal">✅ Optimal</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons-cell">
                          <button
                            type="button"
                            className="btn-edit"
                            onClick={() => handleOpenEditModal(mat)}
                            title="Edit Material"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() => handleDelete(mat.id, mat.material_name)}
                            title="Delete Material"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add / Edit Material Modal */}
      {isModalOpen && (
        <div className="plastic-modal-backdrop" onClick={handleCloseModal}>
          <div className="plastic-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? "✏️ Edit Raw Material" : "➕ Add Scrap Raw Material"}</h2>
              <button type="button" className="btn-close-modal" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="plastic-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Material Code (Optional / Auto-generated)</label>
                  <input
                    type="text"
                    name="material_code"
                    placeholder="e.g. MAT-1001"
                    value={formData.material_code}
                    onChange={handleFormChange}
                    disabled={!!editingId}
                  />
                  <small className="help-text">Leave blank to auto-generate</small>
                </div>

                <div className="form-group">
                  <label>Polymer Category *</label>
                  <select name="plastic_type" value={formData.plastic_type} onChange={handleFormChange} required>
                    <option value="PET">PET (Polyethylene Terephthalate)</option>
                    <option value="PP">PP (Polypropylene)</option>
                    <option value="HDPE">HDPE (High-Density Polyethylene)</option>
                    <option value="LDPE">LDPE (Low-Density Polyethylene)</option>
                    <option value="OTHER">OTHER (Mixed Scrap / Polymer)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Material Name *</label>
                  <input
                    type="text"
                    name="material_name"
                    placeholder="e.g. PET Clear Bottle Scrap"
                    value={formData.material_name}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Scrap Form / Category</label>
                  <input
                    type="text"
                    name="category"
                    placeholder="e.g. Bottles, Films, Lumps, Regrind"
                    value={formData.category}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Grade / Quality</label>
                  <input
                    type="text"
                    name="grade"
                    placeholder="e.g. A Grade / Washed / Mixed"
                    value={formData.grade}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="text"
                    name="color"
                    placeholder="e.g. Transparent / Blue / Multi"
                    value={formData.color}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Unit of Measurement</label>
                  <select name="unit" value={formData.unit} onChange={handleFormChange}>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="TON">TON (Metric Tons)</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Safety Min Stock Alert ({formData.unit})</label>
                  <input
                    type="number"
                    step="0.01"
                    name="minimum_stock"
                    placeholder="500"
                    value={formData.minimum_stock}
                    onChange={handleFormChange}
                  />
                  <small className="help-text">Triggers dashboard low stock alerts</small>
                </div>

                <div className="form-group">
                  <label>Maximum Plant Capacity ({formData.unit})</label>
                  <input
                    type="number"
                    step="0.01"
                    name="maximum_stock"
                    placeholder="50000"
                    value={formData.maximum_stock}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Default Purchase Rate (₹/{formData.unit})</label>
                  <input
                    type="number"
                    step="0.01"
                    name="default_purchase_rate"
                    placeholder="42.50"
                    value={formData.default_purchase_rate}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Default Selling Rate (₹/{formData.unit})</label>
                  <input
                    type="number"
                    step="0.01"
                    name="default_selling_rate"
                    placeholder="55.00"
                    value={formData.default_selling_rate}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleFormChange}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Description / Notes</label>
                  <input
                    type="text"
                    name="description"
                    placeholder="e.g. Pre-sorted post-consumer PET bottles"
                    value={formData.description}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Raw Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticRawMaterials;
