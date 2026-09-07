import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticScrapRegrind.css";

function PlasticScrapRegrind() {
  const [activeTab, setActiveTab] = useState("scrap");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [scrapRecords, setScrapRecords] = useState([]);
  const [scrapSummary, setScrapSummary] = useState({ totalScrapKg: 0, reusableScrapKg: 0, nonReusableScrapKg: 0 });

  const [regrindTx, setRegrindTx] = useState([]);
  const [regrindSummary, setRegrindSummary] = useState({ totalGeneratedKg: 0, totalConsumedKg: 0, currentRegrindStockKg: 0 });

  const [batches, setBatches] = useState([]);
  const [machines, setMachines] = useState([]);

  // Modals
  const [showScrapModal, setShowScrapModal] = useState(false);
  const [showRegrindModal, setShowRegrindModal] = useState(false);

  const [scrapForm, setScrapForm] = useState({
    scrap_type: "PROCESS_SCRAP",
    batch_id: "",
    machine_id: "",
    material_name: "PP Process Waste",
    quantity: "",
    unit: "KG",
    reason: "Startup purge and trimming",
    is_reusable: 1,
  });

  const [regrindForm, setRegrindForm] = useState({
    source_batch_id: "",
    material_name: "PP Regrind Granules",
    quantity: "",
    unit: "KG",
    recovery_rate_percent: "95.0",
    notes: "Crushed and granulated in-house",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [scrapRes, regrindRes, batchesRes, machinesRes] = await Promise.allSettled([
        API.get("/plastic-erp/inventory/scrap"),
        API.get("/plastic-erp/inventory/regrind"),
        API.get("/plastic-erp/production/batches"),
        API.get("/plastic-erp/plant/machines"),
      ]);

      if (scrapRes.status === "fulfilled") {
        setScrapRecords(scrapRes.value.data.scrapRecords || []);
        setScrapSummary(scrapRes.value.data.summary || { totalScrapKg: 0, reusableScrapKg: 0, nonReusableScrapKg: 0 });
      }
      if (regrindRes.status === "fulfilled") {
        setRegrindTx(regrindRes.value.data.transactions || []);
        setRegrindSummary(regrindRes.value.data.summary || { totalGeneratedKg: 0, totalConsumedKg: 0, currentRegrindStockKg: 0 });
      }
      if (batchesRes.status === "fulfilled") setBatches(batchesRes.value.data.batches || []);
      if (machinesRes.status === "fulfilled") setMachines(machinesRes.value.data.machines || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load scrap and regrind records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleRecordScrap = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/inventory/scrap", scrapForm);
      setSuccessMsg("Scrap record logged successfully!");
      setShowScrapModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to log scrap.");
    }
  };

  const handleRecordRegrind = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/inventory/regrind/generate", regrindForm);
      setSuccessMsg("Regrind generation logged successfully!");
      setShowRegrindModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to log regrind.");
    }
  };

  if (loading) return <LoadingScreen message="Loading Scrap & Regrind..." />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />

      <div className="plastic-content-wrap">
        <div className="plastic-page-header">
          <div>
            <h1 className="plastic-page-title">♻️ Scrap & Regrind Operations</h1>
            <p className="plastic-page-subtitle">Process Waste Tracking, In-House Regrind Recycling & Recovery %</p>
          </div>

          <div className="plastic-page-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            {activeTab === "scrap" ? (
              <button type="button" className="btn-primary" onClick={() => setShowScrapModal(true)}>
                ➕ Record Process Scrap
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setShowRegrindModal(true)}>
                ➕ Generate Regrind Stock
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

        {/* Top KPI Cards */}
        <div className="wip-summary-cards">
          <div className="summary-stat-card">
            <span className="stat-label">Total Process Scrap</span>
            <strong className="stat-value text-red">
              {Number(scrapSummary.totalScrapKg || 0).toLocaleString()} KG
            </strong>
            <span className="stat-sub">{Number(scrapSummary.reusableScrapKg || 0).toLocaleString()} KG reusable</span>
          </div>

          <div className="summary-stat-card">
            <span className="stat-label">Current Regrind Stock</span>
            <strong className="stat-value text-green">
              {Number(regrindSummary.currentRegrindStockKg || 0).toLocaleString()} KG
            </strong>
            <span className="stat-sub">Available for future extrusion batches</span>
          </div>

          <div className="summary-stat-card">
            <span className="stat-label">Regrind Generated</span>
            <strong className="stat-value text-blue">
              {Number(regrindSummary.totalGeneratedKg || 0).toLocaleString()} KG
            </strong>
            <span className="stat-sub">{Number(regrindSummary.totalConsumedKg || 0).toLocaleString()} KG consumed in production</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="plastic-tabs-nav">
          <button
            type="button"
            className={`tab-btn ${activeTab === "scrap" ? "active" : ""}`}
            onClick={() => setActiveTab("scrap")}
          >
            🗑️ Process Scrap & Waste ({scrapRecords.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "regrind" ? "active" : ""}`}
            onClick={() => setActiveTab("regrind")}
          >
            ♻️ Regrind Transactions ({regrindTx.length})
          </button>
        </div>

        {/* TAB 1: SCRAP RECORDS */}
        {activeTab === "scrap" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Scrap No</th>
                    <th>Type</th>
                    <th>Material</th>
                    <th>Quantity</th>
                    <th>Origin Batch</th>
                    <th>Machine</th>
                    <th>Reusable</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapRecords.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="empty-cell">No scrap records logged.</td>
                    </tr>
                  ) : (
                    scrapRecords.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.scrap_no}</strong></td>
                        <td><span className="type-tag regrind">{s.scrap_type}</span></td>
                        <td>{s.material_name}</td>
                        <td><strong>{Number(s.quantity).toLocaleString()} {s.unit}</strong></td>
                        <td>{s.batch_no || "-"}</td>
                        <td>{s.machine_name || "General"}</td>
                        <td>
                          <span className={`badge ${s.is_reusable ? "qc-passed" : "qc-rejected"}`}>
                            {s.is_reusable ? "Reusable" : "Waste"}
                          </span>
                        </td>
                        <td>{s.reason || "-"}</td>
                        <td>{s.recorded_at?.split("T")[0]}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REGRIND TRANSACTIONS */}
        {activeTab === "regrind" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Tx No</th>
                    <th>Type</th>
                    <th>Material Name</th>
                    <th>Quantity</th>
                    <th>Recovery Rate</th>
                    <th>Date</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {regrindTx.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-cell">No regrind transactions recorded. Click "Generate Regrind Stock".</td>
                    </tr>
                  ) : (
                    regrindTx.map((tx) => (
                      <tr key={tx.id}>
                        <td><strong>{tx.transaction_no}</strong></td>
                        <td>
                          <span className={`badge ${tx.transaction_type === "GENERATION" ? "status-completed" : "status-running"}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td>{tx.material_name}</td>
                        <td><strong>{Number(tx.quantity).toLocaleString()} {tx.unit}</strong></td>
                        <td>{Number(tx.recovery_rate_percent || 100).toFixed(1)}%</td>
                        <td>{tx.transaction_date?.split("T")[0]}</td>
                        <td>{tx.notes || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: RECORD SCRAP */}
        {showScrapModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Record Process Scrap / Waste</h3>
                <button type="button" onClick={() => setShowScrapModal(false)}>✕</button>
              </div>
              <form onSubmit={handleRecordScrap} className="modal-form">
                <div className="form-group">
                  <label>Material Name *</label>
                  <input
                    type="text"
                    required
                    value={scrapForm.material_name}
                    onChange={(e) => setScrapForm({ ...scrapForm, material_name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Scrap Type</label>
                    <select
                      value={scrapForm.scrap_type}
                      onChange={(e) => setScrapForm({ ...scrapForm, scrap_type: e.target.value })}
                    >
                      <option value="PROCESS_SCRAP">Process Scrap</option>
                      <option value="PRODUCTION_WASTE">Production Waste</option>
                      <option value="REJECTION">Rejected Parts</option>
                      <option value="REWORK">Rework Purge</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Quantity (KG) *</label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.01"
                      value={scrapForm.quantity}
                      onChange={(e) => setScrapForm({ ...scrapForm, quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Origin Batch</label>
                    <select
                      value={scrapForm.batch_id}
                      onChange={(e) => setScrapForm({ ...scrapForm, batch_id: e.target.value })}
                    >
                      <option value="">None (Floor Purge)</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.batch_no} - {b.product_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Machine</label>
                    <select
                      value={scrapForm.machine_id}
                      onChange={(e) => setScrapForm({ ...scrapForm, machine_id: e.target.value })}
                    >
                      <option value="">Select Machine</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>{m.machine_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason / Defect</label>
                  <input
                    type="text"
                    value={scrapForm.reason}
                    onChange={(e) => setScrapForm({ ...scrapForm, reason: e.target.value })}
                    placeholder="e.g. Purge lump, die head pressure buildup, contaminated trims"
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={scrapForm.is_reusable === 1}
                      onChange={(e) => setScrapForm({ ...scrapForm, is_reusable: e.target.checked ? 1 : 0 })}
                    />
                    Reusable in Regrind Granulator
                  </label>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowScrapModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Record Scrap
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD REGRIND GENERATION */}
        {showRegrindModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Generate Regrind Stock</h3>
                <button type="button" onClick={() => setShowRegrindModal(false)}>✕</button>
              </div>
              <form onSubmit={handleRecordRegrind} className="modal-form">
                <div className="form-group">
                  <label>Regrind Material Name *</label>
                  <input
                    type="text"
                    required
                    value={regrindForm.material_name}
                    onChange={(e) => setRegrindForm({ ...regrindForm, material_name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity Generated (KG) *</label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.01"
                      value={regrindForm.quantity}
                      onChange={(e) => setRegrindForm({ ...regrindForm, quantity: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Recovery Rate %</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="0.1"
                      value={regrindForm.recovery_rate_percent}
                      onChange={(e) => setRegrindForm({ ...regrindForm, recovery_rate_percent: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Source Batch (Optional)</label>
                  <select
                    value={regrindForm.source_batch_id}
                    onChange={(e) => setRegrindForm({ ...regrindForm, source_batch_id: e.target.value })}
                  >
                    <option value="">General Reusable Scrap</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.batch_no} - {b.product_name}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowRegrindModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Regrind Stock
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

export default PlasticScrapRegrind;
