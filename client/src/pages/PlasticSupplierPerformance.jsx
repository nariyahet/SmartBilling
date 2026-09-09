import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticSupplierPerformance.css";

function PlasticSupplierPerformance() {
  const [loading, setLoading] = useState(true);
  const [scorecards, setScorecards] = useState([]);
  const [selectedSupplierHistory, setSelectedSupplierHistory] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/procurement/suppliers/scorecard");
      setScorecards(res.data.data || []);
    } catch (err) {
      console.error("Error loading supplier scorecard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openHistory = async (suppId) => {
    try {
      const res = await API.get(`/plastic-erp/procurement/suppliers/${suppId}/history`);
      setSelectedSupplierHistory(res.data.data);
      setHistoryModalOpen(true);
    } catch (err) {
      alert("Failed to load supplier performance history");
    }
  };

  const filteredScorecards = scorecards.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.supplier_name.toLowerCase().includes(q) ||
      s.supplier_code.toLowerCase().includes(q)
    );
  });

  // KPIs
  const avgDelivery = scorecards.length > 0 ? Math.round(scorecards.reduce((sum, s) => sum + Number(s.delivery_score), 0) / scorecards.length) : 100;
  const avgQuality = scorecards.length > 0 ? Math.round(scorecards.reduce((sum, s) => sum + Number(s.quality_score), 0) / scorecards.length) : 100;
  const totalOutstanding = scorecards.reduce((sum, s) => sum + Number(s.outstanding_amount || 0), 0);

  if (loading && scorecards.length === 0) return <LoadingScreen />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">⭐ Supplier Performance & Scorecards</h1>
            <p className="procurement-subtitle">
              Intelligent vendor ratings, on-time delivery metrics, quality acceptance rates & commercial audits
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="procurement-kpi-grid">
          <div className="procurement-kpi-card success">
            <span className="kpi-label">Avg Delivery Reliability</span>
            <span className="kpi-value">{avgDelivery}%</span>
            <span className="kpi-hint">Based on agreed lead times</span>
          </div>
          <div className="procurement-kpi-card purple">
            <span className="kpi-label">Avg Quality Acceptance</span>
            <span className="kpi-value">{avgQuality}%</span>
            <span className="kpi-hint">QC gate inspection approvals</span>
          </div>
          <div className="procurement-kpi-card">
            <span className="kpi-label">Active Suppliers Rated</span>
            <span className="kpi-value">{scorecards.length}</span>
            <span className="kpi-hint">Tracked vendors</span>
          </div>
          <div className="procurement-kpi-card warning">
            <span className="kpi-label">Total Outstanding Ledger</span>
            <span className="kpi-value">₹{totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            <span className="kpi-hint">Current vendor liabilities</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="procurement-filters-bar">
          <div className="filter-group">
            <label>Search Supplier:</label>
            <input
              type="text"
              placeholder="Search by vendor name, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="procurement-input"
            />
          </div>
        </div>

        {/* Scorecard Table */}
        <div className="procurement-table-card">
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Orders / Total Spend</th>
                  <th>Deliveries (On-Time / Late)</th>
                  <th>Delivered vs Accepted</th>
                  <th>Quality Pass %</th>
                  <th>Delivery Score</th>
                  <th>Quality Score</th>
                  <th>Overall Rating</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScorecards.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-6 text-muted">
                      No supplier performance records found.
                    </td>
                  </tr>
                ) : (
                  filteredScorecards.map((s) => (
                    <tr key={s.supplier_id}>
                      <td>
                        <strong>{s.supplier_name}</strong>
                        <div className="text-muted text-xs">{s.supplier_code} • {s.mobile}</div>
                      </td>
                      <td>
                        <strong>{s.total_orders} Orders</strong>
                        <div className="text-muted text-xs">₹{Number(s.total_purchase_value).toLocaleString("en-IN")}</div>
                      </td>
                      <td>
                        <span className="text-emerald-400 font-semibold">{s.on_time_deliveries} on-time</span> /{" "}
                        <span className={s.late_deliveries > 0 ? "text-amber-400" : "text-muted"}>{s.late_deliveries} late</span>
                      </td>
                      <td>
                        <div>{Number(s.delivered_qty).toLocaleString()} KG delivered</div>
                        <div className="text-emerald-400 text-xs font-semibold">{Number(s.accepted_qty).toLocaleString()} KG accepted</div>
                      </td>
                      <td>
                        <strong className={Number(s.quality_acceptance_percent) >= 95 ? "text-emerald-400" : "text-amber-400"}>
                          {s.quality_acceptance_percent}%
                        </strong>
                      </td>
                      <td>
                        <div className="score-pill-container">
                          <span className={`score-badge ${s.delivery_score >= 90 ? "high" : "medium"}`}>
                            {s.delivery_score}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="score-pill-container">
                          <span className={`score-badge ${s.quality_score >= 90 ? "high" : "medium"}`}>
                            {s.quality_score}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="overall-score-cell">
                          <span className={`overall-score-badge ${s.overall_score >= 90 ? "elite" : "good"}`}>
                            {s.overall_score} / 100
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-action view"
                          onClick={() => openHistory(s.supplier_id)}
                        >
                          📊 Full Audit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {historyModalOpen && selectedSupplierHistory && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <div>
                <h3>Performance History: {selectedSupplierHistory.supplier.supplier_name}</h3>
                <small className="text-muted">{selectedSupplierHistory.supplier.supplier_code} • {selectedSupplierHistory.supplier.city || "Surat"}</small>
              </div>
              <button type="button" className="close-btn" onClick={() => setHistoryModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <h4>Recent Deliveries & Timeliness</h4>
              <table className="procurement-table mb-4">
                <thead>
                  <tr>
                    <th>Delivery #</th>
                    <th>Date</th>
                    <th>PO #</th>
                    <th>Material</th>
                    <th>Delivered</th>
                    <th>Accepted</th>
                    <th>Delay</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSupplierHistory.deliveries?.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-4 text-muted">No recent deliveries recorded</td></tr>
                  ) : (
                    selectedSupplierHistory.deliveries?.map((d) => (
                      <tr key={d.id}>
                        <td>{d.delivery_no}</td>
                        <td>{d.delivery_date ? d.delivery_date.slice(0, 10) : "-"}</td>
                        <td>{d.po_no}</td>
                        <td>{d.material_name}</td>
                        <td>{Number(d.delivered_qty).toLocaleString()} KG</td>
                        <td className="text-emerald-400 font-semibold">{Number(d.accepted_qty).toLocaleString()} KG</td>
                        <td>{d.delivery_delay_days > 0 ? `+${d.delivery_delay_days}d late` : "On-Time"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h4>Purchase Rate History & Trends</h4>
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Material</th>
                    <th>Purchase Rate</th>
                    <th>Previous Rate</th>
                    <th>Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSupplierHistory.rates?.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-4 text-muted">No rate history recorded</td></tr>
                  ) : (
                    selectedSupplierHistory.rates?.map((r) => (
                      <tr key={r.id}>
                        <td>{r.purchase_date ? r.purchase_date.slice(0, 10) : "-"}</td>
                        <td>{r.material_name}</td>
                        <td className="font-semibold">₹{Number(r.purchase_rate).toFixed(2)}</td>
                        <td>₹{Number(r.previous_rate).toFixed(2)}</td>
                        <td>
                          {Number(r.variance_percent) > 0 ? (
                            <span className="text-amber-400">+{Number(r.variance_percent).toFixed(1)}%</span>
                          ) : (
                            <span className="text-emerald-400">{Number(r.variance_percent).toFixed(1)}%</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setHistoryModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticSupplierPerformance;
