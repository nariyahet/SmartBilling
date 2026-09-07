import { useEffect, useState } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticStock.css";

const POLYMER_TYPES = ["ALL", "PET", "PP", "HDPE", "LDPE", "OTHER"];

function PlasticStock() {
  const [stockList, setStockList] = useState([]);
  const [summary, setSummary] = useState({
    totalMaterials: 0,
    totalStockVolumeKg: 0,
    totalStockValue: 0,
  });
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [selectedPolymer, setSelectedPolymer] = useState("ALL");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Movement Ledger Modal State
  const [ledgerMaterial, setLedgerMaterial] = useState(null);
  const [movements, setMovements] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Stock Adjustment Modal State
  const [adjustMaterial, setAdjustMaterial] = useState(null);
  const [quantityChange, setQuantityChange] = useState("");
  const [adjustmentRate, setAdjustmentRate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fetchStock = async () => {
    try {
      setLoading(true);
      setError("");

      let url = "/raw-material-stock";
      const params = new URLSearchParams();
      if (selectedPolymer !== "ALL") params.append("plastic_type", selectedPolymer);
      if (lowStockOnly) params.append("low_stock_only", "true");

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const [stockRes, settingsRes] = await Promise.allSettled([
        API.get(url),
        API.get("/business-settings"),
      ]);

      if (stockRes.status === "fulfilled" && stockRes.value.data?.success) {
        setStockList(stockRes.value.data.stock || []);
        if (stockRes.value.data.summary) {
          setSummary(stockRes.value.data.summary);
        }
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value.data?.settings?.currency_symbol) {
        setCurrencySymbol(settingsRes.value.data.settings.currency_symbol);
      }
    } catch (err) {
      console.error("Fetch stock error:", err);
      setError(err.response?.data?.message || "Failed to load raw material stock.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPolymer, lowStockOnly]);

  const handleOpenLedger = async (material) => {
    try {
      setLedgerMaterial(material);
      setLedgerLoading(true);
      const res = await API.get(`/raw-material-stock/movements/${material.raw_material_id}`);
      if (res.data?.success) {
        setMovements(res.data.movements || []);
      }
    } catch (err) {
      console.error("Fetch movements error:", err);
      alert(err.response?.data?.message || "Failed to load stock movements.");
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleOpenAdjustModal = (material) => {
    setAdjustMaterial(material);
    setQuantityChange("");
    setAdjustmentRate(material.average_rate || 40);
    setRemarks("Physical plant audit adjustment");
    setError("");
  };

  const currentQty = adjustMaterial ? Number(adjustMaterial.current_stock) || 0 : 0;
  const changeNum = Number(quantityChange) || 0;
  const projectedBalance = currentQty + changeNum;

  const handleSubmitAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustMaterial) return;

    if (isNaN(changeNum) || changeNum === 0) {
      alert("Quantity change must be non-zero (positive to add, negative to deduct).");
      return;
    }

    if (projectedBalance < 0) {
      alert(`Cannot reduce stock below 0. Current stock is ${currentQty} KG.`);
      return;
    }

    try {
      setAdjusting(true);
      const payload = {
        raw_material_id: adjustMaterial.raw_material_id,
        quantity_change: changeNum,
        rate: Number(adjustmentRate) || 0,
        remarks: remarks.trim() || "Manual plant adjustment",
      };

      await API.post("/raw-material-stock/adjust", payload);
      setSuccessMsg(`Stock for "${adjustMaterial.material_name}" adjusted by ${changeNum > 0 ? "+" : ""}${changeNum} KG. ✅`);
      setAdjustMaterial(null);
      await fetchStock();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Stock adjustment error:", err);
      alert(err.response?.data?.message || "Failed to adjust stock.");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="plastic-stock-page">
      <PlasticNavbar />

      <main className="plastic-content-wrap">
        <div className="page-title-row">
          <div>
            <h1>📦 Raw Material Stock & Ledger</h1>
            <p>Real-time scrap inventory valuation, polymer balances, low stock alerts, and immutable audit movements</p>
          </div>

          <button type="button" className="btn-refresh-stock" onClick={fetchStock}>
            🔄 Refresh Stock
          </button>
        </div>

        {error && <div className="alert-box error">{error}</div>}
        {successMsg && <div className="alert-box success">{successMsg}</div>}

        {/* 3 Metric Cards */}
        <div className="stock-kpi-row">
          <div className="stock-kpi-card accent-green">
            <span className="stock-kpi-icon">🏭</span>
            <div>
              <span className="stock-kpi-label">Total Scrap Volume</span>
              <strong className="stock-kpi-num">
                {Number(summary.totalStockVolumeKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <small>Across {summary.totalMaterials || 0} registered scrap grades</small>
            </div>
          </div>

          <div className="stock-kpi-card accent-teal">
            <span className="stock-kpi-icon">💰</span>
            <div>
              <span className="stock-kpi-label">Total Scrap Inventory Value</span>
              <strong className="stock-kpi-num">
                {currencySymbol}{Number(summary.totalStockValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </strong>
              <small>Valuation at weighted average cost</small>
            </div>
          </div>

          <div className="stock-kpi-card accent-rose">
            <span className="stock-kpi-icon">⚠️</span>
            <div>
              <span className="stock-kpi-label">Low Stock Threshold Alerts</span>
              <strong className="stock-kpi-num">
                {stockList.filter((s) => s.is_low_stock === 1).length} Grades
              </strong>
              <small>Materials requiring replenishment</small>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="filter-card">
          <div className="type-pills-wrap">
            <span>Filter Polymer:</span>
            {POLYMER_TYPES.map((p) => (
              <button
                key={p}
                type="button"
                className={`filter-chip ${selectedPolymer === p ? "active" : ""}`}
                onClick={() => setSelectedPolymer(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`btn-toggle-low-stock ${lowStockOnly ? "active" : ""}`}
            onClick={() => setLowStockOnly(!lowStockOnly)}
          >
            {lowStockOnly ? "⚠️ Showing Low Stock Only" : "Show Only Low Stock"}
          </button>
        </div>

        {/* Stock Table */}
        {loading ? (
          <LoadingScreen title="Loading Stock Ledger..." subtitle="Calculating current inventory balances..." />
        ) : stockList.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-icon">📦</span>
            <h3>No Scrap Stock Available</h3>
            <p>Purchase bills or stock adjustments will automatically populate inventory balances.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Polymer</th>
                  <th>Code</th>
                  <th>Material Name</th>
                  <th>Current Stock</th>
                  <th>Safety Min</th>
                  <th>Avg Rate</th>
                  <th>Stock Value</th>
                  <th>Health Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stockList.map((item) => {
                  const isLow = item.is_low_stock === 1;
                  return (
                    <tr key={item.raw_material_id}>
                      <td>
                        <span className={`polymer-badge ${String(item.plastic_type).toLowerCase()}`}>
                          {item.plastic_type}
                        </span>
                      </td>
                      <td>
                        <span className="code-pill">{item.material_code}</span>
                      </td>
                      <td>
                        <strong className="entity-primary-name">{item.material_name}</strong>
                        {item.grade && <span className="entity-subtext">Grade: {item.grade}</span>}
                      </td>
                      <td>
                        <strong className="stock-number">
                          {Number(item.current_stock || 0).toLocaleString("en-IN")} {item.unit || "KG"}
                        </strong>
                      </td>
                      <td>
                        <span className="threshold-text">
                          {Number(item.minimum_stock || 0).toLocaleString("en-IN")} {item.unit || "KG"}
                        </span>
                      </td>
                      <td>
                        <span>₹{Number(item.average_rate || 0).toFixed(2)}</span>
                      </td>
                      <td>
                        <strong className="entity-primary-name">
                          ₹{Number(item.stock_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </strong>
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
                            className="btn-action-ledger"
                            onClick={() => handleOpenLedger(item)}
                            title="View Stock Movement Audit Trail"
                          >
                            📜 History
                          </button>
                          <button
                            type="button"
                            className="btn-action-adjust"
                            onClick={() => handleOpenAdjustModal(item)}
                            title="Adjust Stock Quantity"
                          >
                            ⚖️ Adjust
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

      {/* Movement Ledger Modal */}
      {ledgerMaterial && (
        <div className="plastic-modal-backdrop" onClick={() => setLedgerMaterial(null)}>
          <div className="plastic-modal-card large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>📜 Stock Movement Audit Trail</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                  {ledgerMaterial.material_name} ({ledgerMaterial.material_code}) [{ledgerMaterial.plastic_type}]
                </p>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setLedgerMaterial(null)}>
                ✕
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              {ledgerLoading ? (
                <p>Loading movements...</p>
              ) : movements.length === 0 ? (
                <div className="empty-state-box" style={{ padding: "30px" }}>
                  <p>No historical movements recorded yet for this material.</p>
                </div>
              ) : (
                <table className="movement-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Quantity</th>
                      <th>Rate</th>
                      <th>Balance After</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const isAddition = ["PURCHASE", "INWARD"].includes(m.movement_type) || Number(m.quantity) > 0;
                      return (
                        <tr key={m.id}>
                          <td>{new Date(m.movement_date || m.created_at).toLocaleString("en-IN")}</td>
                          <td>
                            <span className={`movement-badge ${String(m.movement_type).toLowerCase()}`}>
                              {m.movement_type}
                            </span>
                          </td>
                          <td>
                            <small>{m.reference_type} #{m.reference_id || "—"}</small>
                          </td>
                          <td>
                            <strong className={isAddition ? "qty-positive" : "qty-negative"}>
                              {isAddition ? "+" : ""}{Number(m.quantity).toLocaleString("en-IN")} {ledgerMaterial.unit || "KG"}
                            </strong>
                          </td>
                          <td>₹{Number(m.rate || 0).toFixed(2)}</td>
                          <td>
                            <strong>{Number(m.balance_quantity || 0).toLocaleString("en-IN")} {ledgerMaterial.unit || "KG"}</strong>
                          </td>
                          <td>
                            <span className="remarks-text">{m.remarks || "—"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-actions" style={{ padding: "16px 20px" }}>
              <button type="button" className="btn-cancel" onClick={() => setLedgerMaterial(null)}>
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustMaterial && (
        <div className="plastic-modal-backdrop" onClick={() => setAdjustMaterial(null)}>
          <div className="plastic-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>⚖️ Adjust Scrap Stock Quantity</h2>
                <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                  {adjustMaterial.material_name} ({adjustMaterial.material_code})
                </p>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setAdjustMaterial(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="plastic-form">
              <div className="calc-summary-card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Current Physical Stock:</span>
                  <strong>{currentQty.toLocaleString("en-IN")} {adjustMaterial.unit || "KG"}</strong>
                </div>

                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label>Quantity Change (+ to add, - to deduct) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. +500 or -200"
                    value={quantityChange}
                    onChange={(e) => setQuantityChange(e.target.value)}
                    required
                  />
                  <small className="help-text">Use positive for unrecorded inward, negative for audit loss/moisture</small>
                </div>

                <div className="live-weight-preview-bar">
                  <span>Projected New Balance:</span>
                  <strong className={projectedBalance < 0 ? "highlight-red" : "highlight-green"}>
                    {projectedBalance.toLocaleString("en-IN")} {adjustMaterial.unit || "KG"}
                  </strong>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Adjustment Valuation Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustmentRate}
                    onChange={(e) => setAdjustmentRate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Reason / Audit Remarks *</label>
                  <input
                    type="text"
                    placeholder="e.g. Physical inventory count reconciliation"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setAdjustMaterial(null)}
                  disabled={adjusting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={adjusting || projectedBalance < 0 || changeNum === 0}
                >
                  {adjusting ? "Adjusting..." : "Confirm Stock Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticStock;
