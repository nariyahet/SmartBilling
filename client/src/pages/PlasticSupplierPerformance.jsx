import { useState, useEffect, useCallback } from "react";
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
  SearchInput,
} from "../components";
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
      setScorecards(res.data?.data || []);
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
      setSelectedSupplierHistory(res.data?.data);
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

  if (loading && scorecards.length === 0) {
    return <LoadingScreen title="Loading Scorecards..." subtitle="Computing vendor metrics and ratings..." />;
  }

  const columns = [
    {
      key: "supplier_name",
      title: "Supplier",
      render: (val, row) => (
        <div>
          <strong>{val}</strong>
          <div className="sb-text-muted text-xs">{row.supplier_code} • {row.mobile || "Surat"}</div>
        </div>
      ),
    },
    {
      key: "total_orders",
      title: "Orders / Spend",
      render: (val, row) => (
        <div>
          <strong>{val} Orders</strong>
          <div className="sb-text-muted text-xs">₹{Number(row.total_purchase_value || 0).toLocaleString("en-IN")}</div>
        </div>
      ),
    },
    {
      key: "deliveries",
      title: "Deliveries (On-Time / Late)",
      render: (_, row) => (
        <div>
          <span style={{ color: "var(--sb-success, #18A673)", fontWeight: 600 }}>{row.on_time_deliveries} on-time</span>
          {" / "}
          <span style={{ color: row.late_deliveries > 0 ? "var(--sb-warning, #F2A93B)" : "var(--sb-text-muted, #718096)" }}>
            {row.late_deliveries} late
          </span>
        </div>
      ),
    },
    {
      key: "delivered_qty",
      title: "Delivered vs Accepted",
      render: (val, row) => (
        <div>
          <div>{Number(val || 0).toLocaleString()} KG delivered</div>
          <div style={{ color: "var(--sb-success, #18A673)", fontSize: "12px", fontWeight: 600 }}>
            {Number(row.accepted_qty || 0).toLocaleString()} KG accepted
          </div>
        </div>
      ),
    },
    {
      key: "quality_acceptance_percent",
      title: "Quality Pass %",
      render: (val) => {
        const num = Number(val || 100);
        const color = num >= 95 ? "var(--sb-success, #18A673)" : "var(--sb-warning, #F2A93B)";
        return <strong style={{ color }}>{num}%</strong>;
      },
    },
    {
      key: "delivery_score",
      title: "Delivery Score",
      render: (val) => (
        <StatusBadge
          status={val >= 90 ? "high" : "medium"}
          variant={val >= 90 ? "success" : "warning"}
        >
          {val}%
        </StatusBadge>
      ),
    },
    {
      key: "quality_score",
      title: "Quality Score",
      render: (val) => (
        <StatusBadge
          status={val >= 90 ? "high" : "medium"}
          variant={val >= 90 ? "success" : "warning"}
        >
          {val}%
        </StatusBadge>
      ),
    },
    {
      key: "overall_score",
      title: "Overall Rating",
      render: (val) => (
        <span className={`vendor-overall-badge ${val >= 90 ? "elite" : "standard"}`}>
          {val} / 100
        </span>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (_, row) => (
        <Button
          size="sm"
          variant="secondary"
          icon="📊"
          onClick={() => openHistory(row.supplier_id)}
        >
          Full Audit
        </Button>
      ),
    },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Supplier Performance & Scorecards"
        subtitle="Intelligent vendor ratings, on-time delivery metrics, quality acceptance rates & commercial audits"
        badge="VENDOR INTELLIGENCE"
        actions={
          <div className="sb-header-actions">
            <Button variant="secondary" size="md" onClick={fetchData} icon="🔄">
              Refresh Ratings
            </Button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="sb-kpi-grid">
        <KpiCard
          title="Delivery Reliability"
          value={`${avgDelivery}%`}
          accent="green"
          icon="⚡"
          supportingText="Based on agreed lead times"
        />
        <KpiCard
          title="Quality Acceptance"
          value={`${avgQuality}%`}
          accent="teal"
          icon="🔬"
          supportingText="QC gate inspection approvals"
        />
        <KpiCard
          title="Active Vendors Rated"
          value={scorecards.length}
          accent="blue"
          icon="⭐"
          supportingText="Consolidated vendor pool"
        />
        <KpiCard
          title="Total Outstanding"
          value={`₹${totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          accent="amber"
          icon="💰"
          supportingText="Current vendor liabilities"
        />
      </div>

      {/* Filter Bar */}
      <Card className="sb-filter-card" noPadding>
        <div className="sb-filter-row">
          <div className="sb-filter-item search-grow">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor name, code, contact..."
            />
          </div>
        </div>
      </Card>

      {/* Scorecards Table */}
      <Card noPadding>
        <DataTable
          columns={columns}
          data={filteredScorecards}
          loading={loading}
          emptyMessage="No supplier performance scorecards found."
        />
      </Card>

      {/* History Modal */}
      <Modal
        isOpen={historyModalOpen && Boolean(selectedSupplierHistory)}
        onClose={() => setHistoryModalOpen(false)}
        title={`Performance History: ${selectedSupplierHistory?.supplier?.supplier_name || ""}`}
        subtitle={`Code: ${selectedSupplierHistory?.supplier?.supplier_code || ""} • ${selectedSupplierHistory?.supplier?.city || "Surat"}`}
        size="lg"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedSupplierHistory && (
          <div>
            <h4 className="sb-section-title" style={{ marginTop: 0 }}>Recent Deliveries & Timeliness</h4>
            <div className="sb-table-responsive" style={{ marginBottom: "20px" }}>
              <table className="sb-table">
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
                    <tr>
                      <td colSpan="7" className="sb-text-muted" style={{ textAlign: "center", padding: "16px" }}>
                        No recent deliveries recorded
                      </td>
                    </tr>
                  ) : (
                    selectedSupplierHistory.deliveries?.map((d) => (
                      <tr key={d.id}>
                        <td className="sb-font-semibold">{d.delivery_no}</td>
                        <td>{d.delivery_date ? d.delivery_date.slice(0, 10) : "-"}</td>
                        <td>{d.po_no}</td>
                        <td>{d.material_name}</td>
                        <td>{Number(d.delivered_qty).toLocaleString()} KG</td>
                        <td style={{ color: "var(--sb-success)", fontWeight: 600 }}>{Number(d.accepted_qty).toLocaleString()} KG</td>
                        <td>
                          {d.delivery_delay_days > 0 ? (
                            <span style={{ color: "var(--sb-danger)", fontWeight: 600 }}>+{d.delivery_delay_days}d late</span>
                          ) : (
                            <span style={{ color: "var(--sb-success)", fontWeight: 600 }}>On-Time</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h4 className="sb-section-title">Purchase Rate History & Variance</h4>
            <div className="sb-table-responsive">
              <table className="sb-table">
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
                    <tr>
                      <td colSpan="5" className="sb-text-muted" style={{ textAlign: "center", padding: "16px" }}>
                        No rate history recorded
                      </td>
                    </tr>
                  ) : (
                    selectedSupplierHistory.rates?.map((r) => (
                      <tr key={r.id}>
                        <td>{r.purchase_date ? r.purchase_date.slice(0, 10) : "-"}</td>
                        <td className="sb-font-semibold">{r.material_name}</td>
                        <td>₹{Number(r.purchase_rate).toFixed(2)}</td>
                        <td>₹{Number(r.previous_rate).toFixed(2)}</td>
                        <td>
                          {Number(r.variance_percent) > 0 ? (
                            <span style={{ color: "var(--sb-danger)", fontWeight: 600 }}>+{Number(r.variance_percent).toFixed(1)}%</span>
                          ) : (
                            <span style={{ color: "var(--sb-success)", fontWeight: 600 }}>{Number(r.variance_percent).toFixed(1)}%</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticSupplierPerformance;
