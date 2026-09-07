import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticRecipes.css";

function PlasticRecipes() {
  const [recipes, setRecipes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const [formData, setFormData] = useState({
    recipe_name: "",
    target_product_name: "",
    version: "v1.0",
    effective_date: new Date().toISOString().split("T")[0],
    description: "",
    items: [
      { raw_material_id: "", material_name: "", percentage: 70, standard_consumption_per_unit: 0.7, is_recycled: true, is_regrind: false, is_additive: false },
      { raw_material_id: "", material_name: "Regrind Flakes", percentage: 25, standard_consumption_per_unit: 0.25, is_recycled: true, is_regrind: true, is_additive: false },
      { raw_material_id: "", material_name: "Color Masterbatch", percentage: 5, standard_consumption_per_unit: 0.05, is_recycled: false, is_regrind: false, is_additive: true },
    ],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [recipesRes, materialsRes] = await Promise.allSettled([
        API.get("/plastic-erp/recipes"),
        API.get("/raw-materials"),
      ]);

      if (recipesRes.status === "fulfilled") setRecipes(recipesRes.value.data.recipes || []);
      if (materialsRes.status === "fulfilled") {
        setRawMaterials(materialsRes.value.data.raw_materials || materialsRes.value.data.materials || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const viewRecipeDetails = async (id) => {
    try {
      const res = await API.get(`/plastic-erp/recipes/${id}`);
      setSelectedRecipe(res.data.recipe);
    } catch {
      setError("Failed to fetch recipe details.");
    }
  };

  const handleAddItemRow = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { raw_material_id: "", material_name: "", percentage: 0, standard_consumption_per_unit: 0, is_recycled: true, is_regrind: false, is_additive: false },
      ],
    });
  };

  const handleRemoveItemRow = (index) => {
    const updated = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updated });
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];
    updated[index][field] = value;

    if (field === "raw_material_id") {
      const found = rawMaterials.find((m) => String(m.id) === String(value));
      if (found) {
        updated[index].material_name = found.material_name;
      }
    }

    setFormData({ ...formData, items: updated });
  };

  const totalPercentage = formData.items.reduce((acc, row) => acc + (Number(row.percentage) || 0), 0);

  const handleSubmitRecipe = async (e) => {
    e.preventDefault();
    if (Math.abs(totalPercentage - 100) > 0.5) {
      if (!window.confirm(`Warning: Total percentage is ${totalPercentage}%. Standard BOM usually sums to 100%. Do you want to proceed?`)) {
        return;
      }
    }

    try {
      await API.post("/plastic-erp/recipes", formData);
      setSuccessMsg("Recipe created successfully!");
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create recipe.");
    }
  };

  if (loading) return <LoadingScreen message="Loading Recipe Management..." />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />

      <div className="plastic-content-wrap">
        <div className="plastic-page-header">
          <div>
            <h1 className="plastic-page-title">🧪 BOM & Recipe Management</h1>
            <p className="plastic-page-subtitle">Formulations, Recycled Content % & Raw Material Standards</p>
          </div>

          <div className="plastic-page-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
              ➕ New Recipe / BOM
            </button>
          </div>
        </div>

        {error && (
          <div className="plastic-alert error">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {successMsg && (
          <div className="plastic-alert success">
            <span>✅ {successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg("")}>✕</button>
          </div>
        )}

        <div className="plastic-card">
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Recipe Code</th>
                  <th>Recipe Name</th>
                  <th>Target Product</th>
                  <th>Version</th>
                  <th>Components</th>
                  <th>Recycled Content</th>
                  <th>Regrind</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty-cell">No recipes found. Click "New Recipe / BOM" to create standard recipes.</td>
                  </tr>
                ) : (
                  recipes.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.recipe_code}</strong></td>
                      <td>{r.recipe_name}</td>
                      <td>{r.target_product_name}</td>
                      <td><span className="version-pill">{r.version}</span></td>
                      <td>{r.total_components} materials</td>
                      <td>
                        <strong className="text-success">{Number(r.total_recycled_percent || 0).toFixed(0)}%</strong>
                      </td>
                      <td>{Number(r.total_regrind_percent || 0).toFixed(0)}%</td>
                      <td>
                        <span className={`badge status-${r.status?.toLowerCase()}`}>{r.status}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-view-details"
                          onClick={() => viewRecipeDetails(r.id)}
                        >
                          View BOM 📋
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: VIEW RECIPE BOM DETAILS */}
        {selectedRecipe && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal large">
              <div className="modal-header">
                <h3>BOM: {selectedRecipe.recipe_name} ({selectedRecipe.version})</h3>
                <button type="button" onClick={() => setSelectedRecipe(null)}>✕</button>
              </div>
              <div className="modal-body-padding">
                <div className="recipe-summary-box">
                  <p><strong>Target Product:</strong> {selectedRecipe.target_product_name}</p>
                  <p><strong>Effective Date:</strong> {selectedRecipe.effective_date?.split("T")[0] || "Immediate"}</p>
                  {selectedRecipe.description && <p><strong>Notes:</strong> {selectedRecipe.description}</p>}
                </div>

                <h4>Recipe Component Breakdown</h4>
                <table className="plastic-table items-table">
                  <thead>
                    <tr>
                      <th>Material Component</th>
                      <th>Ratio %</th>
                      <th>Std Consumption / KG</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecipe.items?.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.material_name}</strong></td>
                        <td>{Number(item.percentage).toFixed(1)}%</td>
                        <td>{item.standard_consumption_per_unit || (item.percentage / 100).toFixed(3)} KG</td>
                        <td>
                          {item.is_regrind ? (
                            <span className="type-tag regrind">Regrind</span>
                          ) : item.is_additive ? (
                            <span className="type-tag additive">Additive</span>
                          ) : (
                            <span className="type-tag recycled">Recycled Scrap</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setSelectedRecipe(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE RECIPE */}
        {showCreateModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal large">
              <div className="modal-header">
                <h3>Create New BOM / Recipe</h3>
                <button type="button" onClick={() => setShowCreateModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmitRecipe} className="modal-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Recipe Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.recipe_name}
                      onChange={(e) => setFormData({ ...formData, recipe_name: e.target.value })}
                      placeholder="e.g. Standard Recycled PP Granules"
                    />
                  </div>

                  <div className="form-group">
                    <label>Target Product Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.target_product_name}
                      onChange={(e) => setFormData({ ...formData, target_product_name: e.target.value })}
                      placeholder="e.g. Recycled PP Granules Grade A"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Recipe Version</label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      placeholder="v1.0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={formData.effective_date}
                      onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* DYNAMIC BOM ITEMS TABLE */}
                <div className="bom-builder-section">
                  <div className="bom-header-row">
                    <h4>BOM Components (Must Total 100%)</h4>
                    <span className={`percentage-counter ${Math.abs(totalPercentage - 100) < 0.5 ? "valid" : "invalid"}`}>
                      Total: {totalPercentage}%
                    </span>
                  </div>

                  {formData.items.map((row, idx) => (
                    <div key={idx} className="bom-item-row">
                      <select
                        value={row.raw_material_id}
                        onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                        className="material-select"
                      >
                        <option value="">Select Phase 1 Raw Material</option>
                        {rawMaterials.map((m) => (
                          <option key={m.id} value={m.id}>{m.material_name} ({m.plastic_type})</option>
                        ))}
                      </select>

                      <input
                        type="text"
                        required
                        placeholder="Or Component Name"
                        value={row.material_name}
                        onChange={(e) => handleItemChange(idx, "material_name", e.target.value)}
                        className="material-name-input"
                      />

                      <div className="pct-input-wrap">
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="%"
                          value={row.percentage}
                          onChange={(e) => handleItemChange(idx, "percentage", e.target.value)}
                        />
                        <span>%</span>
                      </div>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={row.is_regrind}
                          onChange={(e) => handleItemChange(idx, "is_regrind", e.target.checked)}
                        />
                        Regrind
                      </label>

                      <button
                        type="button"
                        className="btn-remove-row"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={formData.items.length <= 1}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button type="button" className="btn-add-row" onClick={handleAddItemRow}>
                    ➕ Add Material Component
                  </button>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Recipe & BOM
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlasticRecipes;
