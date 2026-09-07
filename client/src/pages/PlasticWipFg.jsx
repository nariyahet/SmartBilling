import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticWipFg.css";

function PlasticWipFg() {
  const [activeTab, setActiveTab] = useState("wip");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [wipItems, setWipItems] = useState([]);
  const [wipSummary, setWipSummary] = useState({ totalBatchesInWip: 0, totalWipKg: 0 });

  const [finishedGoods, setFinishedGoods] = useState([]);
  const [fgSummary, setFgSummary] = useState({ totalProducts: 0, totalFgStockKg: 0 });

  const [fgLots, setFgLots] = useState([]);

  // Modals
  const [showWipModal, setShowWipModal] = useState(false);
  const [selectedWip, setSelectedWip] = useState(null);
  const [wipForm, setWipForm] = useState({ stage: "EXTRUSION", location: "Shop Floor 1", status: "PROCESSING" });

  const [showFgModal, setShowFgModal] = useState(false);
  const [fgForm, setFgForm] = useState({
    fg_name: "",
    plastic_type: "PP",
    grade: "Grade A",
    color: "Natural",
    minimum_stock: "1000",
    standard_cost: "42.00",
    selling_price: "55.00",
    warehouse_location: "Main Warehouse Bay 1",
    packing_type: "25 KG Bags",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [wipRes, fgRes, lotsRes] = await Promise.allSettled([
        API.get("/plastic-erp/inventory/wip"),
        API.get("/plastic-erp/inventory/finished-goods"),
        API.get("/plastic-erp/inventory/finished-goods/lots"),
      ]);

      if (wipRes.status === "fulfilled") {
        setWipItems(wipRes.value.data.wipStock || []);
        setWipSummary(wipRes.value.data.summary || { totalBatchesInWip: 0, totalWipKg: 0 });
      }
      if (fgRes.status === "fulfilled") {
        setFinishedGoods(fgRes.value.data.finishedGoods || []);
        setFgSummary(fgRes.value.data.summary || { totalProducts: 0, totalFgStockKg: 0 });
      }
      if (lotsRes.status === "fulfilled") {
        setFgLots(lotsRes.value.data.lots || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const openUpdateWip = (wip) => {
    setSelectedWip(wip);
    setWipForm({
      stage: wip.stage,
      location: wip.location,
      status: wip.status,
    });
    setShowWipModal(true);
  };

  const handleUpdateWip = async (e) => {
    e.preventDefault();
    if (!selectedWip) return;
    try {
      await API.put(`/plastic-erp/inventory/wip/${selectedWip.id}`, wipForm);
      setSuccessMsg("WIP stage updated successfully!");
      setShowWipModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update WIP.");
    }
  };

  const handleCreateFg = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/inventory/finished-goods", fgForm);
      setSuccessMsg("Finished Good catalog item created!");
      setShowFgModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create FG item.");
    }
  };

  if (loading) return <LoadingScreen message="Loading WIP & Finished Goods..." />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />

      <div className="plastic-content-wrap">
        <div className="plastic-page-header">
          <div>
            <h1 className="plastic-page-title">📦 WIP & Finished Goods Inventory</h1>
            <p className="plastic-page-subtitle">Shop Floor Work-in-Progress Stages & Warehouse Finished Stock</p>
          </div>

          <div className="plastic-page-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            {activeTab === "fg" && (
              <button type="button" className="btn-primary" onClick={() => setShowFgModal(true)}>
                ➕ Add Finished Good Item
              </button>
            )}
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

        {/* Top Summary Banner */}
        <div className="wip-summary-cards">
          <div className="summary-stat-card">
            <span className="stat-label">Current WIP Volume</span>
            <strong className="stat-value text-blue">
              {Number(wipSummary.totalWipKg || 0).toLocaleString()} KG
            </strong>
            <span className="stat-sub">{wipSummary.totalBatchesInWip} batches processing</span>
          </div>

          <div className="summary-stat-card">
            <span className="stat-label">Finished Goods in Stock</span>
            <strong className="stat-value text-green">
              {Number(fgSummary.totalFgStockKg || 0).toLocaleString()} KG
            </strong>
            <span className="stat-sub">{fgSummary.totalProducts} catalog products</span>
          </div>

          <div className="summary-stat-card">
            <span className="stat-label">Production Lots Ready</span>
            <strong className="stat-value text-purple">{fgLots.length}</strong>
            <span className="stat-sub">Batch-traceable output lots</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="plastic-tabs-nav">
          <button
            type="button"
            className={`tab-btn ${activeTab === "wip" ? "active" : ""}`}
            onClick={() => setActiveTab("wip")}
          >
            ⚙️ Work-in-Progress ({wipItems.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "fg" ? "active" : ""}`}
            onClick={() => setActiveTab("fg")}
          >
            📦 Finished Goods Stock ({finishedGoods.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "lots" ? "active" : ""}`}
            onClick={() => setActiveTab("lots")}
          >
            🏷️ Production Lots ({fgLots.length})
          </button>
        </div>

        {/* TAB 1: WIP TRACKING */}
        {activeTab === "wip" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Product</th>
                    <th>Current Stage</th>
                    <th>Location</th>
                    <th>Machine</th>
                    <th>WIP Quantity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wipItems.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-cell">No active WIP items found on shop floor.</td>
                    </tr>
                  ) : (
                    wipItems.map((w) => (
                      <tr key={w.id}>
                        <td><strong>{w.batch_no}</strong></td>
                        <td>{w.product_name}</td>
                        <td>
                          <span className={`stage-badge stage-${w.stage?.toLowerCase()}`}>{w.stage}</span>
                        </td>
                        <td>{w.location}</td>
                        <td>{w.machine_name || "General Floor"}</td>
                        <td>
                          <strong>{Number(w.wip_quantity).toLocaleString()} {w.unit}</strong>
                        </td>
                        <td>
                          <span className={`badge status-${w.status?.toLowerCase()}`}>{w.status}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-update-stage"
                            onClick={() => openUpdateWip(w)}
                          >
                            Update Stage 🔄
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

        {/* TAB 2: FINISHED GOODS CATALOG & STOCK */}
        {activeTab === "fg" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>FG Code</th>
                    <th>Product Name</th>
                    <th>Polymer</th>
                    <th>Grade / Color</th>
                    <th>Current Stock</th>
                    <th>Min Stock</th>
                    <th>Std Cost</th>
                    <th>Selling Price</th>
                    <th>Warehouse Location</th>
                  </tr>
                </thead>
                <tbody>
                  {finishedGoods.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="empty-cell">No finished goods found in warehouse. Click "Add Finished Good Item".</td>
                    </tr>
                  ) : (
                    finishedGoods.map((fg) => (
                      <tr key={fg.id}>
                        <td><strong>{fg.fg_code}</strong></td>
                        <td><strong>{fg.fg_name}</strong></td>
                        <td><span className="polymer-pill">{fg.plastic_type}</span></td>
                        <td>{fg.grade || "-"} • {fg.color || "-"}</td>
                        <td>
                          <strong className="text-green">{Number(fg.current_stock).toLocaleString()} {fg.unit}</strong>
                        </td>
                        <td>{Number(fg.minimum_stock).toLocaleString()} {fg.unit}</td>
                        <td>₹{Number(fg.standard_cost).toFixed(2)}</td>
                        <td>₹{Number(fg.selling_price).toFixed(2)}</td>
                        <td>{fg.warehouse_location}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: FG PRODUCTION LOTS */}
        {activeTab === "lots" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Lot Number</th>
                    <th>Product</th>
                    <th>Origin Batch</th>
                    <th>Quantity Produced</th>
                    <th>Production Date</th>
                    <th>QC Status</th>
                    <th>Dispatch Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fgLots.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-cell">No finished production lots generated yet.</td>
                    </tr>
                  ) : (
                    fgLots.map((lot) => (
                      <tr key={lot.id}>
                        <td><strong>{lot.lot_number}</strong></td>
                        <td>{lot.fg_name} ({lot.fg_code})</td>
                        <td>
                          <Link to={`/plastic-erp/traceability?batch=${lot.batch_no}`} className="action-link">
                            {lot.batch_no} 🔍
                          </Link>
                        </td>
                        <td><strong>{Number(lot.quantity).toLocaleString()} {lot.unit}</strong></td>
                        <td>{lot.production_date?.split("T")[0]}</td>
                        <td>
                          <span className={`badge qc-${lot.qc_status?.toLowerCase()}`}>{lot.qc_status}</span>
                        </td>
                        <td>
                          <span className={`badge dispatch-${lot.dispatch_status?.toLowerCase()}`}>
                            {lot.dispatch_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: UPDATE WIP STAGE */}
        {showWipModal && selectedWip && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Update WIP Stage: {selectedWip.batch_no}</h3>
                <button type="button" onClick={() => setShowWipModal(false)}>✕</button>
              </div>
              <form onSubmit={handleUpdateWip} className="modal-form">
                <div className="form-group">
                  <label>Current Stage</label>
                  <select
                    value={wipForm.stage}
                    onChange={(e) => setWipForm({ ...wipForm, stage: e.target.value })}
                  >
                    <option value="SORTING">Sorting & Segregation</option>
                    <option value="CRUSHING">Crushing & Shredding</option>
                    <option value="WASHING">Washing & Friction Washer</option>
                    <option value="EXTRUSION">Extrusion & Die Face Cutting</option>
                    <option value="PELLETIZING">Pelletizing & Cooling</option>
                    <option value="PACKING">Packing & Bagging</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Floor Location</label>
                  <input
                    type="text"
                    value={wipForm.location}
                    onChange={(e) => setWipForm({ ...wipForm, location: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={wipForm.status}
                    onChange={(e) => setWipForm({ ...wipForm, status: e.target.value })}
                  >
                    <option value="PROCESSING">Processing</option>
                    <option value="HOLD">Hold</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowWipModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update WIP
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD FINISHED GOOD ITEM */}
        {showFgModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Add Finished Good Product</h3>
                <button type="button" onClick={() => setShowFgModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateFg} className="modal-form">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    value={fgForm.fg_name}
                    onChange={(e) => setFgForm({ ...fgForm, fg_name: e.target.value })}
                    placeholder="e.g. Recycled PP Granules Grade A"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Polymer Type</label>
                    <select
                      value={fgForm.plastic_type}
                      onChange={(e) => setFgForm({ ...fgForm, plastic_type: e.target.value })}
                    >
                      <option value="PP">PP (Polypropylene)</option>
                      <option value="HDPE">HDPE</option>
                      <option value="LDPE">LDPE</option>
                      <option value="PET">PET</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Grade / Color</label>
                    <input
                      type="text"
                      value={fgForm.grade}
                      onChange={(e) => setFgForm({ ...fgForm, grade: e.target.value })}
                      placeholder="Grade A / Natural"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Standard Cost / KG (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fgForm.standard_cost}
                      onChange={(e) => setFgForm({ ...fgForm, standard_cost: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Selling Price / KG (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fgForm.selling_price}
                      onChange={(e) => setFgForm({ ...fgForm, selling_price: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Packing Information</label>
                  <input
                    type="text"
                    value={fgForm.packing_type}
                    onChange={(e) => setFgForm({ ...fgForm, packing_type: e.target.value })}
                    placeholder="e.g. 25 KG Bags with Liners"
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowFgModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Product
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

export default PlasticWipFg;
