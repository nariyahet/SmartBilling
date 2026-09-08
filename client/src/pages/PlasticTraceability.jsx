import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticTraceability.css";

function PlasticTraceability() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryBatch = searchParams.get("batch") || "";

  const [searchInput, setSearchInput] = useState(queryBatch || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentBatches, setRecentBatches] = useState([]);
  const [traceData, setTraceData] = useState(null);

  // Load recent batches on mount for quick lookup chips
  const loadRecentBatches = useCallback(async () => {
    try {
      const res = await API.get("/plastic-erp/production/batches");
      if (res.data?.batches) {
        setRecentBatches(res.data.batches.slice(0, 8));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecentBatches();
  }, [loadRecentBatches]);

  const fetchTraceability = useCallback(async (identifier) => {
    if (!identifier) return;
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/plastic-erp/traceability/batch/${encodeURIComponent(identifier.trim())}`);
      if (res.data?.traceability) {
        setTraceData(res.data.traceability);
      } else {
        setError("No traceability records found for this identifier.");
        setTraceData(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load traceability details.");
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (queryBatch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchInput(queryBatch);
      fetchTraceability(queryBatch);
    }
  }, [queryBatch, fetchTraceability]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearchParams({ batch: searchInput.trim() });
    fetchTraceability(searchInput.trim());
  };

  const handleQuickSelect = (batchNo) => {
    setSearchInput(batchNo);
    setSearchParams({ batch: batchNo });
    fetchTraceability(batchNo);
  };

  return (
    <div className="plastic-trace-page">
      <PlasticNavbar />

      <main className="plastic-trace-container">
        {/* Header */}
        <div className="plastic-trace-header">
          <div>
            <span className="plastic-trace-badge">END-TO-END GENEALOGY</span>
            <h1 className="plastic-trace-title">Batch & Lot Traceability</h1>
            <p className="plastic-trace-subtitle">
              Inspect upstream supplier inward slips, downstream finished goods lots, and full plant process audit trails.
            </p>
          </div>
          <div className="plastic-trace-header-actions">
            <Link to="/plastic-erp" className="btn-secondary-link">
              ← ERP Dashboard
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="trace-search-box">
          <form onSubmit={handleSearch} className="trace-search-form">
            <div className="trace-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Enter Batch Number (e.g. BATCH-1001, BATCH-1002)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="trace-search-input"
              />
            </div>
            <button type="submit" className="btn-trace-search" disabled={loading}>
              {loading ? "Tracing..." : "Inspect Traceability"}
            </button>
          </form>

          {/* Quick lookup suggestions */}
          {recentBatches.length > 0 && (
            <div className="trace-quick-chips">
              <span className="chips-label">Recent Batches:</span>
              {recentBatches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`trace-chip ${searchInput === b.batch_no ? "active" : ""}`}
                  onClick={() => handleQuickSelect(b.batch_no)}
                >
                  {b.batch_no} ({b.product_name})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="trace-alert trace-alert-danger">
            <span>{error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {loading && <LoadingScreen message="Reconstructing batch genealogy..." />}

        {/* Trace Data Presentation */}
        {!loading && traceData && (
          <div className="trace-results-area">
            {/* 1. Batch Overview Header Card */}
            <div className="trace-batch-card">
              <div className="batch-card-header">
                <div>
                  <div className="batch-number-badge">{traceData.batch?.batch_no}</div>
                  <h2 className="batch-product-title">{traceData.batch?.product_name}</h2>
                  <span className="batch-sub-meta">
                    Order Ref: {traceData.batch?.production_order_no || "Ad-hoc"} • Date: {new Date(traceData.batch?.batch_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="batch-status-box">
                  <span className={`badge-pill status-${traceData.batch?.status?.toLowerCase()}`}>
                    {traceData.batch?.status}
                  </span>
                </div>
              </div>

              <div className="batch-metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">Planned Qty</span>
                  <span className="metric-value">{traceData.batch?.planned_quantity} {traceData.batch?.unit || "KG"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Actual Output</span>
                  <span className="metric-value text-green">{traceData.batch?.actual_quantity} {traceData.batch?.unit || "KG"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Scrap Generated</span>
                  <span className="metric-value text-red">{traceData.batch?.scrap_quantity} {traceData.batch?.unit || "KG"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Yield Efficiency</span>
                  <span className="metric-value text-blue">{traceData.batch?.efficiency_percent}%</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Machine</span>
                  <span className="metric-value">{traceData.batch?.machine_name || "Line 1"}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Operator & Shift</span>
                  <span className="metric-value">{traceData.batch?.operator_name || "—"} ({traceData.batch?.shift_name || "General"})</span>
                </div>
              </div>
            </div>

            {/* Visual Traceability Flow Diagram */}
            <div className="trace-flow-container">
              <h3 className="section-title">Genealogy Lifecycle Map</h3>
              <div className="trace-flow-diagram">
                {/* Node 1: Inward & Suppliers */}
                <div className="flow-node node-supplier">
                  <div className="node-icon">🚛</div>
                  <div className="node-title">Inward & Suppliers</div>
                  <div className="node-desc">
                    {traceData.backward?.suppliersCount || 0} Supplier(s) • {traceData.backward?.truckInwardsCount || 0} Truck Slip(s)
                  </div>
                </div>

                <div className="flow-arrow">➔</div>

                {/* Node 2: Raw Material Consumption */}
                <div className="flow-node node-consumption">
                  <div className="node-icon">📦</div>
                  <div className="node-title">Raw Materials</div>
                  <div className="node-desc">
                    {traceData.backward?.consumptions?.length || 0} Materials Consumed
                  </div>
                </div>

                <div className="flow-arrow">➔</div>

                {/* Node 3: Plant Production Batch */}
                <div className="flow-node node-batch active-node">
                  <div className="node-icon">⚙️</div>
                  <div className="node-title">{traceData.batch?.batch_no}</div>
                  <div className="node-desc">
                    {traceData.batch?.machine_name || "Plant Bay"} • {traceData.batch?.actual_quantity} KG
                  </div>
                </div>

                <div className="flow-arrow">➔</div>

                {/* Node 4: Quality Inspections */}
                <div className="flow-node node-qc">
                  <div className="node-icon">🔬</div>
                  <div className="node-title">Quality Control</div>
                  <div className="node-desc">
                    {traceData.quality?.length || 0} Inspection(s) Logged
                  </div>
                </div>

                <div className="flow-arrow">➔</div>

                {/* Node 5: Finished Goods Lots */}
                <div className="flow-node node-fg">
                  <div className="node-icon">🏷️</div>
                  <div className="node-title">FG Lots & Storage</div>
                  <div className="node-desc">
                    {traceData.forward?.finishedGoodsLots?.length || 0} Lot(s) Packaged
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed 2-Column Section: Backward & Forward Trace */}
            <div className="trace-details-grid">
              {/* BACKWARD TRACE: Raw Material Origin */}
              <div className="trace-detail-card">
                <div className="detail-card-header">
                  <h3>⬅️ Backward Trace: Material Origin & Supplier Inwards</h3>
                  <span className="card-tag tag-blue">Upstream Audit</span>
                </div>
                {traceData.backward?.consumptions?.length === 0 ? (
                  <p className="empty-state-text">No direct material consumptions linked to this batch.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Qty Consumed</th>
                          <th>Inward / Truck</th>
                          <th>Supplier & City</th>
                          <th>Weighment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceData.backward?.consumptions.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <strong>{c.material_name}</strong>
                              <div className="meta-sub">{c.plastic_type} - {c.color}</div>
                            </td>
                            <td><strong>{c.actual_quantity} {c.unit}</strong></td>
                            <td>
                              {c.inward_no ? (
                                <div>
                                  <span className="code-tag">{c.inward_no}</span>
                                  <div className="meta-sub">{c.truck_number}</div>
                                </div>
                              ) : (
                                <span className="text-muted">Direct Stock</span>
                              )}
                            </td>
                            <td>
                              {c.supplier_name ? (
                                <div>
                                  <div className="supplier-name">{c.supplier_name}</div>
                                  <div className="meta-sub">{c.supplier_city || "Gujarat"}</div>
                                </div>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td>
                              {c.weighment_no ? (
                                <span className="badge-slip">{c.weighment_no}</span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* FORWARD TRACE: Finished Goods & Warehousing */}
              <div className="trace-detail-card">
                <div className="detail-card-header">
                  <h3>➡️ Forward Trace: Finished Goods Lots & Packaging</h3>
                  <span className="card-tag tag-green">Downstream Audit</span>
                </div>
                {traceData.forward?.finishedGoodsLots?.length === 0 ? (
                  <p className="empty-state-text">No finished goods lots generated from this batch yet.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Lot Number</th>
                          <th>Product Name</th>
                          <th>Quantity</th>
                          <th>Packing / Warehouse</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceData.forward?.finishedGoodsLots.map((lot) => (
                          <tr key={lot.id}>
                            <td><code>{lot.lot_number}</code></td>
                            <td>
                              <strong>{lot.fg_name}</strong>
                              <div className="meta-sub">{lot.plastic_type}</div>
                            </td>
                            <td><strong>{lot.quantity} {lot.unit}</strong></td>
                            <td>
                              <div>{lot.packing_type || "25 KG Bags"}</div>
                              <div className="meta-sub">Loc: {lot.warehouse_location || "Bay A"}</div>
                            </td>
                            <td>
                              <span className={`badge-pill status-${lot.status?.toLowerCase()}`}>
                                {lot.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Regrind & Scrap Outflow */}
                <div className="regrind-scrap-subgrid">
                  <div className="subgrid-box">
                    <h4>♻️ Regrind Generated</h4>
                    {traceData.forward?.regrindTransactions?.length === 0 ? (
                      <span className="text-muted font-sm">None recorded</span>
                    ) : (
                      traceData.forward?.regrindTransactions.map((r) => (
                        <div key={r.id} className="mini-record">
                          <span>{r.plastic_type} ({r.regrind_type})</span>
                          <strong>+{r.quantity} KG</strong>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="subgrid-box">
                    <h4>🗑️ Scrap Records</h4>
                    {traceData.forward?.scrapRecords?.length === 0 ? (
                      <span className="text-muted font-sm">None recorded</span>
                    ) : (
                      traceData.forward?.scrapRecords.map((sc) => (
                        <div key={sc.id} className="mini-record">
                          <span>{sc.scrap_type} ({sc.stage})</span>
                          <strong className="text-red">+{sc.quantity} KG</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Phase 3: Downstream Sales Orders, Dispatches & Customer Invoices */}
                <div className="downstream-sales-section mt-4" style={{ marginTop: "20px", borderTop: "1px dashed #cbd5e1", paddingTop: "14px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "#1e3a8a", fontWeight: 700 }}>
                    💼 Downstream Customer Deliveries & Invoices
                  </h4>
                  {(!traceData.forward?.downstreamSales || traceData.forward.downstreamSales.length === 0) ? (
                    <p className="empty-state-text" style={{ margin: "4px 0", fontSize: "0.85rem", color: "#64748b" }}>
                      This batch's finished goods are currently in storage and have not been dispatched to customers yet.
                    </p>
                  ) : (
                    <div className="table-wrapper">
                      <table className="trace-table">
                        <thead>
                          <tr>
                            <th>Dispatch #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Sales Order</th>
                            <th>Challan</th>
                            <th>Shipped Qty</th>
                            <th>Invoice #</th>
                          </tr>
                        </thead>
                        <tbody>
                          {traceData.forward.downstreamSales.map((s, idx) => (
                            <tr key={idx}>
                              <td>
                                <strong className="text-primary">{s.dispatch_no}</strong>
                              </td>
                              <td>{s.dispatch_date ? new Date(s.dispatch_date).toLocaleDateString() : "—"}</td>
                              <td>
                                <strong>{s.customer_name}</strong>
                                <div className="meta-sub">{s.customer_mobile}</div>
                              </td>
                              <td>{s.sales_order_no || "Direct"}</td>
                              <td>{s.challan_no || "—"}</td>
                              <td>
                                <strong>{Number(s.quantity).toLocaleString()} KG</strong>
                              </td>
                              <td>
                                {s.invoice_no ? (
                                  <span className="badge-slip" style={{ background: "#ecfdf5", color: "#059669" }}>
                                    {s.invoice_no} ({s.invoice_payment_status || "UNPAID"})
                                  </span>
                                ) : (
                                  <span className="text-muted">Unbilled</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quality & Chronological Timeline */}
            <div className="trace-details-grid">
              {/* Quality Inspections */}
              <div className="trace-detail-card">
                <div className="detail-card-header">
                  <h3>🔬 Quality Inspections Performed</h3>
                  <span className="card-tag tag-purple">Lab Testing</span>
                </div>
                {traceData.quality?.length === 0 ? (
                  <p className="empty-state-text">No QC inspections logged for this batch.</p>
                ) : (
                  <div className="table-wrapper">
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Inspection No</th>
                          <th>Stage</th>
                          <th>Inspector</th>
                          <th>Result</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceData.quality.map((qc) => (
                          <tr key={qc.id}>
                            <td><code>{qc.inspection_no}</code></td>
                            <td>{qc.stage}</td>
                            <td>{qc.inspector_name || "QC Lab"}</td>
                            <td>
                              <span
                                className={`badge-pill ${
                                  qc.overall_status === "PASSED"
                                    ? "status-completed"
                                    : qc.overall_status === "REJECTED"
                                    ? "status-danger"
                                    : "status-warning"
                                }`}
                              >
                                {qc.overall_status}
                              </span>
                            </td>
                            <td>{new Date(qc.inspection_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Chronological Timeline Audit Trail */}
              <div className="trace-detail-card">
                <div className="detail-card-header">
                  <h3>📜 Full Process Audit Trail</h3>
                  <span className="card-tag tag-neutral">Timestamped Log</span>
                </div>
                {traceData.timeline?.length === 0 ? (
                  <p className="empty-state-text">No audit timeline entries recorded.</p>
                ) : (
                  <div className="trace-timeline-wrap">
                    {traceData.timeline.map((item, idx) => (
                      <div key={item.id || idx} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                          <div className="timeline-title">
                            <strong>{item.stage}</strong>: {item.event_type}
                          </div>
                          <div className="timeline-desc">{item.description}</div>
                          <div className="timeline-time">
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Initial Empty Guide */}
        {!loading && !traceData && (
          <div className="trace-empty-guide">
            <div className="guide-icon">🔍</div>
            <h3>Enter a Batch Number to Begin Full Traceability</h3>
            <p>
              Inspect the end-to-end lineage from incoming scrap trucks and weighment slips through plant extrusion, lab testing, and finished pallets.
            </p>
            {recentBatches.length > 0 && (
              <div className="guide-chips">
                <span>Or select a recent batch:</span>
                <div className="guide-buttons">
                  {recentBatches.slice(0, 4).map((b) => (
                    <button
                      key={b.id}
                      className="btn-guide-chip"
                      onClick={() => handleQuickSelect(b.batch_no)}
                    >
                      {b.batch_no} • {b.product_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticTraceability;
