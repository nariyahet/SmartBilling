import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  Card,
  DataTable,
  Button,
  StatusBadge,
  AlertBanner,
} from "../components";
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
    <div className="sb-page-container">
      <PageHeader
        title="Batch & Lot Traceability"
        subtitle="Inspect upstream supplier inward slips, downstream finished goods lots, and full plant process audit trails."
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Production", to: "/plastic-erp/production" },
          { label: "Traceability" },
        ]}
        actions={
          <Link to="/plastic-erp">
            <Button variant="secondary">ERP Dashboard</Button>
          </Link>
        }
      />

      {/* Search Bar */}
      <Card style={{ marginBottom: "24px" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: "14px", color: "var(--sb-muted)" }}>🔍</span>
            <input
              type="text"
              placeholder="Enter Batch Number (e.g. BATCH-1001, BATCH-1002)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="sb-input"
              style={{ paddingLeft: "42px", height: "42px" }}
            />
          </div>
          <Button type="submit" variant="primary" disabled={loading} style={{ height: "42px" }}>
            {loading ? "Tracing..." : "Inspect Traceability"}
          </Button>
        </form>

        {/* Quick lookup suggestions */}
        {recentBatches.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--sb-muted)" }}>Recent Batches:</span>
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
      </Card>

      {/* Error Alert */}
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      {loading && <LoadingScreen message="Reconstructing batch genealogy..." />}

      {/* Trace Data Presentation */}
      {!loading && traceData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* 1. Batch Overview Header Card */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--sb-border)" }}>
              <div>
                <span className="trace-batch-badge">{traceData.batch?.batch_no}</span>
                <h2 style={{ margin: "4px 0", fontSize: "20px", fontWeight: 800, color: "var(--sb-navy)" }}>
                  {traceData.batch?.product_name}
                </h2>
                <span style={{ fontSize: "13px", color: "var(--sb-muted)" }}>
                  Order Ref: {traceData.batch?.production_order_no || "Ad-hoc"} • Date: {new Date(traceData.batch?.batch_date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <StatusBadge status={traceData.batch?.status} />
              </div>
            </div>

            <div className="trace-metrics-grid">
              <div className="trace-metric-box">
                <span className="trace-metric-label">Planned Qty</span>
                <span className="trace-metric-val">{traceData.batch?.planned_quantity} {traceData.batch?.unit || "KG"}</span>
              </div>
              <div className="trace-metric-box">
                <span className="trace-metric-label">Actual Output</span>
                <span className="trace-metric-val" style={{ color: "var(--sb-success)" }}>
                  {traceData.batch?.actual_quantity} {traceData.batch?.unit || "KG"}
                </span>
              </div>
              <div className="trace-metric-box">
                <span className="trace-metric-label">Scrap Generated</span>
                <span className="trace-metric-val" style={{ color: "var(--sb-danger)" }}>
                  {traceData.batch?.scrap_quantity} {traceData.batch?.unit || "KG"}
                </span>
              </div>
              <div className="trace-metric-box">
                <span className="trace-metric-label">Yield Efficiency</span>
                <span className="trace-metric-val" style={{ color: "var(--sb-ocean)" }}>
                  {traceData.batch?.efficiency_percent}%
                </span>
              </div>
              <div className="trace-metric-box">
                <span className="trace-metric-label">Machine</span>
                <span className="trace-metric-val">{traceData.batch?.machine_name || "Line 1"}</span>
              </div>
              <div className="trace-metric-box">
                <span className="trace-metric-label">Operator & Shift</span>
                <span className="trace-metric-val">{traceData.batch?.operator_name || "—"} ({traceData.batch?.shift_name || "General"})</span>
              </div>
            </div>
          </Card>

          {/* Visual Traceability Flow Diagram */}
          <Card>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700, color: "var(--sb-navy)" }}>
              Genealogy Lifecycle Map
            </h3>
            <div className="trace-flow-diagram">
              <div className="trace-flow-node">
                <div className="node-icon">🚛</div>
                <div className="node-title">Inward & Suppliers</div>
                <div className="node-desc">
                  {traceData.backward?.suppliersCount || 0} Supplier(s) • {traceData.backward?.truckInwardsCount || 0} Truck Slip(s)
                </div>
              </div>

              <div className="trace-flow-arrow">➔</div>

              <div className="trace-flow-node">
                <div className="node-icon">📦</div>
                <div className="node-title">Raw Materials</div>
                <div className="node-desc">
                  {traceData.backward?.consumptions?.length || 0} Materials Consumed
                </div>
              </div>

              <div className="trace-flow-arrow">➔</div>

              <div className="trace-flow-node active-node">
                <div className="node-icon">⚙️</div>
                <div className="node-title">{traceData.batch?.batch_no}</div>
                <div className="node-desc">
                  {traceData.batch?.machine_name || "Plant Bay"} • {traceData.batch?.actual_quantity} KG
                </div>
              </div>

              <div className="trace-flow-arrow">➔</div>

              <div className="trace-flow-node">
                <div className="node-icon">🔬</div>
                <div className="node-title">Quality Control</div>
                <div className="node-desc">
                  {traceData.quality?.length || 0} Inspection(s) Logged
                </div>
              </div>

              <div className="trace-flow-arrow">➔</div>

              <div className="trace-flow-node">
                <div className="node-icon">🏷️</div>
                <div className="node-title">FG Lots & Storage</div>
                <div className="node-desc">
                  {traceData.forward?.finishedGoodsLots?.length || 0} Lot(s) Packaged
                </div>
              </div>
            </div>
          </Card>

          {/* Detailed 2-Column Section: Backward & Forward Trace */}
          <div className="trace-details-grid">
            {/* BACKWARD TRACE */}
            <Card noPadding>
              <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sb-border)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                  ⬅️ Backward Trace: Material Origin & Inwards
                </h3>
                <span className="trace-tag tag-blue">Upstream Audit</span>
              </div>
              {traceData.backward?.consumptions?.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--sb-muted)" }}>
                  No direct material consumptions linked to this batch.
                </div>
              ) : (
                <DataTable
                  headers={["Material", "Qty Consumed", "Inward / Truck", "Supplier & City", "Weighment"]}
                >
                  {traceData.backward?.consumptions.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.material_name}</strong>
                        <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{c.plastic_type} - {c.color}</div>
                      </td>
                      <td><strong>{c.actual_quantity} {c.unit}</strong></td>
                      <td>
                        {c.inward_no ? (
                          <div>
                            <span className="trace-code-tag">{c.inward_no}</span>
                            <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{c.truck_number}</div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--sb-muted)" }}>Direct Stock</span>
                        )}
                      </td>
                      <td>
                        {c.supplier_name ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.supplier_name}</div>
                            <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{c.supplier_city || "Gujarat"}</div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--sb-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        {c.weighment_no ? (
                          <span className="trace-slip-badge">{c.weighment_no}</span>
                        ) : (
                          <span style={{ color: "var(--sb-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Card>

            {/* FORWARD TRACE */}
            <Card noPadding>
              <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sb-border)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                  ➡️ Forward Trace: Finished Goods & Packaging
                </h3>
                <span className="trace-tag tag-teal">Downstream Audit</span>
              </div>
              {traceData.forward?.finishedGoodsLots?.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--sb-muted)" }}>
                  No finished goods lots generated from this batch yet.
                </div>
              ) : (
                <DataTable
                  headers={["Lot Number", "Product Name", "Quantity", "Packing / Warehouse", "Status"]}
                >
                  {traceData.forward?.finishedGoodsLots.map((lot) => (
                    <tr key={lot.id}>
                      <td><code>{lot.lot_number}</code></td>
                      <td>
                        <strong>{lot.fg_name}</strong>
                        <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{lot.plastic_type}</div>
                      </td>
                      <td><strong>{lot.quantity} {lot.unit}</strong></td>
                      <td>
                        <div>{lot.packing_type || "25 KG Bags"}</div>
                        <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>Loc: {lot.warehouse_location || "Bay A"}</div>
                      </td>
                      <td>
                        <StatusBadge status={lot.status} />
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}

              {/* Regrind & Scrap Outflow */}
              <div className="trace-subgrid" style={{ padding: "16px", borderTop: "1px solid var(--sb-border)" }}>
                <div className="trace-subgrid-box">
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--sb-navy)" }}>♻️ Regrind Generated</h4>
                  {traceData.forward?.regrindTransactions?.length === 0 ? (
                    <span style={{ color: "var(--sb-muted)", fontSize: "12px" }}>None recorded</span>
                  ) : (
                    traceData.forward?.regrindTransactions.map((r) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span>{r.plastic_type} ({r.regrind_type})</span>
                        <strong style={{ color: "var(--sb-success)" }}>+{r.quantity} KG</strong>
                      </div>
                    ))
                  )}
                </div>
                <div className="trace-subgrid-box">
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--sb-navy)" }}>🗑️ Scrap Records</h4>
                  {traceData.forward?.scrapRecords?.length === 0 ? (
                    <span style={{ color: "var(--sb-muted)", fontSize: "12px" }}>None recorded</span>
                  ) : (
                    traceData.forward?.scrapRecords.map((sc) => (
                      <div key={sc.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span>{sc.scrap_type} ({sc.stage})</span>
                        <strong style={{ color: "var(--sb-danger)" }}>+{sc.quantity} KG</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Downstream Customer Deliveries & Invoices */}
              <div style={{ padding: "16px", borderTop: "1px dashed var(--sb-border)" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "var(--sb-navy)", fontWeight: 700 }}>
                  💼 Downstream Customer Deliveries & Invoices
                </h4>
                {(!traceData.forward?.downstreamSales || traceData.forward.downstreamSales.length === 0) ? (
                  <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--sb-muted)" }}>
                    This batch&apos;s finished goods are currently in storage and have not been dispatched to customers yet.
                  </p>
                ) : (
                  <DataTable
                    headers={["Dispatch #", "Date", "Customer", "Sales Order", "Challan", "Shipped Qty", "Invoice #"]}
                  >
                    {traceData.forward.downstreamSales.map((s, idx) => (
                      <tr key={idx}>
                        <td><strong style={{ color: "var(--sb-ocean)" }}>{s.dispatch_no}</strong></td>
                        <td>{s.dispatch_date ? new Date(s.dispatch_date).toLocaleDateString() : "—"}</td>
                        <td>
                          <strong>{s.customer_name}</strong>
                          <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{s.customer_mobile}</div>
                        </td>
                        <td>{s.sales_order_no || "Direct"}</td>
                        <td>{s.challan_no || "—"}</td>
                        <td><strong>{Number(s.quantity).toLocaleString()} KG</strong></td>
                        <td>
                          {s.invoice_no ? (
                            <span className="trace-slip-badge" style={{ background: "#ecfdf5", color: "#059669" }}>
                              {s.invoice_no} ({s.invoice_payment_status || "UNPAID"})
                            </span>
                          ) : (
                            <span style={{ color: "var(--sb-muted)" }}>Unbilled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </div>
            </Card>
          </div>

          {/* Quality & Chronological Timeline */}
          <div className="trace-details-grid">
            {/* Quality Inspections */}
            <Card noPadding>
              <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sb-border)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                  🔬 Quality Inspections Performed
                </h3>
                <span className="trace-tag tag-purple">Lab Testing</span>
              </div>
              {traceData.quality?.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--sb-muted)" }}>
                  No QC inspections logged for this batch.
                </div>
              ) : (
                <DataTable
                  headers={["Inspection No", "Stage", "Inspector", "Result", "Date"]}
                >
                  {traceData.quality.map((qc) => (
                    <tr key={qc.id}>
                      <td><code>{qc.inspection_no}</code></td>
                      <td>{qc.stage}</td>
                      <td>{qc.inspector_name || "QC Lab"}</td>
                      <td>
                        <StatusBadge status={qc.overall_status} />
                      </td>
                      <td>{new Date(qc.inspection_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Card>

            {/* Chronological Timeline Audit Trail */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--sb-border)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                  📜 Full Process Audit Trail
                </h3>
                <span className="trace-tag tag-neutral">Timestamped Log</span>
              </div>
              {traceData.timeline?.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--sb-muted)" }}>
                  No audit timeline entries recorded.
                </div>
              ) : (
                <div className="trace-timeline-wrap">
                  {traceData.timeline.map((item, idx) => (
                    <div key={item.id || idx} className="trace-timeline-item">
                      <div className="trace-timeline-marker"></div>
                      <div className="trace-timeline-content">
                        <div style={{ fontSize: "13px", color: "var(--sb-navy)" }}>
                          <strong>{item.stage}</strong>: {item.event_type}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--sb-muted)" }}>{item.description}</div>
                        <div style={{ fontSize: "11px", color: "var(--sb-muted)", marginTop: "2px" }}>
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Initial Empty Guide */}
      {!loading && !traceData && (
        <Card style={{ textAlign: "center", padding: "48px 24px", maxWidth: "680px", margin: "40px auto" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--sb-navy)", marginBottom: "8px" }}>
            Enter a Batch Number to Begin Full Traceability
          </h3>
          <p style={{ color: "var(--sb-muted)", fontSize: "14px", marginBottom: "24px" }}>
            Inspect the end-to-end lineage from incoming scrap trucks and weighment slips through plant extrusion, lab testing, and finished pallets.
          </p>
          {recentBatches.length > 0 && (
            <div>
              <span style={{ fontSize: "12px", color: "var(--sb-muted)", fontWeight: 600, display: "block", marginBottom: "10px" }}>
                Or select a recent batch:
              </span>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                {recentBatches.slice(0, 4).map((b) => (
                  <Button
                    key={b.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleQuickSelect(b.batch_no)}
                  >
                    {b.batch_no} • {b.product_name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default PlasticTraceability;
