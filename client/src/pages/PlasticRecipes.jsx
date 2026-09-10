import { useEffect, useState, useCallback } from "react";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  Button,
  StatusBadge,
  DataTable,
  Modal,
  AlertBanner,
} from "../components";
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

      if (recipesRes.status === "fulfilled") setRecipes(recipesRes.value.data?.recipes || []);
      if (materialsRes.status === "fulfilled") {
        setRawMaterials(materialsRes.value.data?.raw_materials || materialsRes.value.data?.materials || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const viewRecipeDetails = async (id) => {
    try {
      const res = await API.get(`/plastic-erp/recipes/${id}`);
      setSelectedRecipe(res.data?.recipe);
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

  if (loading && recipes.length === 0) {
    return <LoadingScreen title="Loading Recipes..." subtitle="Fetching BOM formulations..." />;
  }

  // KPIs
  const totalRecipes = recipes.length;
  const avgRecycled = recipes.length > 0
    ? Math.round(recipes.reduce((sum, r) => sum + Number(r.total_recycled_percent || 0), 0) / recipes.length)
    : 0;
  const uniqueProducts = new Set(recipes.map((r) => r.target_product_name)).size;
  const totalBOMRows = recipes.reduce((sum, r) => sum + Number(r.total_components || 0), 0);

  const columns = [
    {
      key: "recipe_code",
      title: "Recipe Code",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "recipe_name",
      title: "Recipe Name",
      render: (val) => <strong>{val}</strong>,
    },
    {
      key: "target_product_name",
      title: "Target Product",
    },
    {
      key: "version",
      title: "Version",
      render: (val) => <span className="sb-badge sb-badge-blue">{val}</span>,
    },
    {
      key: "total_components",
      title: "Components",
      render: (val) => `${val} materials`,
    },
    {
      key: "total_recycled_percent",
      title: "Recycled Content",
      render: (val) => (
        <span className="sb-font-semibold" style={{ color: "var(--sb-teal, #159A9C)" }}>
          {Number(val || 0).toFixed(0)}%
        </span>
      ),
    },
    {
      key: "total_regrind_percent",
      title: "Regrind",
      render: (val) => `${Number(val || 0).toFixed(0)}%`,
    },
    {
      key: "status",
      title: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "actions",
      title: "Actions",
      render: (_, r) => (
        <Button
          size="sm"
          variant="secondary"
          icon="📋"
          onClick={() => viewRecipeDetails(r.id)}
        >
          View BOM
        </Button>
      ),
    },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="BOM & Recipe Management"
        subtitle="Standardized polymer formulations, recycled content ratios & material consumption baselines"
        badge="MANUFACTURING BOM"
        actions={
          <div className="sb-header-actions">
            <Button variant="secondary" size="md" onClick={fetchData} icon="🔄">
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              icon="+"
              onClick={() => setShowCreateModal(true)}
            >
              New Recipe / BOM
            </Button>
          </div>
        }
      />

      {error && (
        <AlertBanner variant="danger" onDismiss={() => setError("")} className="mb-4">
          {error}
        </AlertBanner>
      )}

      {successMsg && (
        <AlertBanner variant="success" onDismiss={() => setSuccessMsg("")} className="mb-4">
          {successMsg}
        </AlertBanner>
      )}

      {/* KPI Cards Grid */}
      <div className="sb-kpi-grid">
        <KpiCard
          title="Active Formulations"
          value={totalRecipes}
          accent="blue"
          icon="🧪"
          supportingText="Approved master recipes"
        />
        <KpiCard
          title="Avg Recycled Ratio"
          value={`${avgRecycled}%`}
          accent="teal"
          icon="♻️"
          supportingText="Eco-sustainability index"
        />
        <KpiCard
          title="Products Formulated"
          value={uniqueProducts}
          accent="green"
          icon="📦"
          supportingText="Finished good specs"
        />
        <KpiCard
          title="BOM Components"
          value={totalBOMRows}
          accent="navy"
          icon="📑"
          supportingText="Mapped raw material lines"
        />
      </div>

      {/* Main Table */}
      <Card noPadding>
        <DataTable
          columns={columns}
          data={recipes}
          loading={loading}
          emptyMessage="No recipes found. Click 'New Recipe / BOM' to create standard formulations."
        />
      </Card>

      {/* MODAL: CREATE RECIPE */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Master Recipe / BOM"
        subtitle="Formulate target plastic compound with raw materials, regrind and additives"
        size="lg"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmitRecipe}>
              Save Recipe Formulation
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitRecipe}>
          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Recipe Name *</label>
              <input
                type="text"
                required
                value={formData.recipe_name}
                onChange={(e) => setFormData({ ...formData, recipe_name: e.target.value })}
                placeholder="e.g. PP Copolymer Black Extrusion Grade"
                className="sb-input"
              />
            </div>

            <div className="sb-form-group">
              <label>Target Finished Product *</label>
              <input
                type="text"
                required
                value={formData.target_product_name}
                onChange={(e) => setFormData({ ...formData, target_product_name: e.target.value })}
                placeholder="e.g. Recycled PP Granules"
                className="sb-input"
              />
            </div>
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Version Tag</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="sb-form-group">
              <label>Effective Date</label>
              <input
                type="date"
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                className="sb-input"
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label>Formulation Description & Processing Parameters</label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Recommended melt temperature (210°C - 230°C), screen mesh 60/80..."
              className="sb-textarea"
            />
          </div>

          {/* BOM Items Header */}
          <div className="sb-section-header">
            <div>
              <h4 className="sb-section-title">BOM Material Breakdown</h4>
              <span className={`sb-percent-indicator ${Math.abs(totalPercentage - 100) < 0.1 ? "balanced" : "unbalanced"}`}>
                Total: {totalPercentage.toFixed(1)}% {Math.abs(totalPercentage - 100) < 0.1 ? "✓ 100% Balanced" : "⚠️ Needs 100%"}
              </span>
            </div>
            <Button size="sm" variant="secondary" icon="+" onClick={handleAddItemRow}>
              Add Material Component
            </Button>
          </div>

          <div className="sb-table-responsive">
            <table className="sb-table">
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Raw Material *</th>
                  <th style={{ width: "16%" }}>Ratio %</th>
                  <th style={{ width: "16%" }}>Consumption / KG</th>
                  <th style={{ width: "25%" }}>Material Nature</th>
                  <th style={{ width: "8%" }}></th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        required
                        value={row.raw_material_id}
                        onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                        className="sb-select"
                      >
                        <option value="">Select Raw Material</option>
                        {rawMaterials.map((m) => (
                          <option key={m.id} value={m.id}>{m.material_name} ({m.plastic_type})</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        required
                        value={row.percentage}
                        onChange={(e) => {
                          const p = parseFloat(e.target.value) || 0;
                          handleItemChange(idx, "percentage", p);
                          handleItemChange(idx, "standard_consumption_per_unit", p / 100);
                        }}
                        className="sb-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.001"
                        readOnly
                        value={row.standard_consumption_per_unit}
                        className="sb-input"
                        style={{ background: "var(--sb-bg)" }}
                      />
                    </td>
                    <td>
                      <div className="sb-nature-checkboxes">
                        <label>
                          <input
                            type="checkbox"
                            checked={row.is_recycled}
                            onChange={(e) => handleItemChange(idx, "is_recycled", e.target.checked)}
                          />
                          Recycled
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={row.is_regrind}
                            onChange={(e) => handleItemChange(idx, "is_regrind", e.target.checked)}
                          />
                          Regrind
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={row.is_additive}
                            onChange={(e) => handleItemChange(idx, "is_additive", e.target.checked)}
                          />
                          Additive
                        </label>
                      </div>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={formData.items.length <= 1}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </Modal>

      {/* MODAL: VIEW RECIPE BOM */}
      <Modal
        isOpen={Boolean(selectedRecipe)}
        onClose={() => setSelectedRecipe(null)}
        title={`BOM: ${selectedRecipe?.recipe_name || ""}`}
        subtitle={`Version: ${selectedRecipe?.version || ""} • Target: ${selectedRecipe?.target_product_name || ""}`}
        size="md"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setSelectedRecipe(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedRecipe && (
          <div>
            <div className="sb-detail-summary-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
              <div><span className="sb-detail-label">Recipe Code:</span> <strong>{selectedRecipe.recipe_code}</strong></div>
              <div><span className="sb-detail-label">Status:</span> <StatusBadge status={selectedRecipe.status} /></div>
              <div><span className="sb-detail-label">Recycled Content:</span> <strong>{Number(selectedRecipe.total_recycled_percent || 0).toFixed(0)}%</strong></div>
              <div><span className="sb-detail-label">Regrind Ratio:</span> <strong>{Number(selectedRecipe.total_regrind_percent || 0).toFixed(0)}%</strong></div>
            </div>

            {selectedRecipe.description && (
              <div className="sb-detail-note" style={{ background: "var(--sb-bg)", border: "1px solid var(--sb-border)", color: "var(--sb-text)" }}>
                <span className="sb-detail-label">Description & Parameters:</span>
                {selectedRecipe.description}
              </div>
            )}

            <h4 className="sb-section-title">Bill of Materials (BOM Components)</h4>
            <div className="sb-table-responsive">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Material Component</th>
                    <th>Percentage</th>
                    <th>Std Consumption / KG</th>
                    <th>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecipe.items?.map((itm) => (
                    <tr key={itm.id}>
                      <td className="sb-font-semibold">{itm.material_name}</td>
                      <td><strong>{Number(itm.percentage).toFixed(1)}%</strong></td>
                      <td>{Number(itm.standard_consumption_per_unit).toFixed(3)} KG</td>
                      <td>
                        {itm.is_recycled && <span className="sb-badge sb-badge-teal" style={{ marginRight: "4px" }}>Recycled</span>}
                        {itm.is_regrind && <span className="sb-badge sb-badge-warning" style={{ marginRight: "4px" }}>Regrind</span>}
                        {itm.is_additive && <span className="sb-badge sb-badge-blue">Additive</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticRecipes;
