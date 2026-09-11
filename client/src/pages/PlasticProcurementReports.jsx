import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  Card,
  Button,
  StatusBadge,
  Tabs,
  EmptyState,
} from "../components";
import "./PlasticProcurementReports.css";

const REPORTS = [
  { id: "requisitions", label: "Requisitions", endpoint: "/plastic-erp/procurement/reports/requisitions" },
  { id: "orders", label: "Purchase Orders", endpoint: "/plastic-erp/procurement/reports/orders" },
  { id: "pending-orders", label: "Pending PO & Overdue", endpoint: "/plastic-erp/procurement/reports/pending-orders" },
  { id: "suppliers", label: "Supplier Summary", endpoint: "/plastic-erp/procurement/reports/suppliers" },
  { id: "materials", label: "Material Summary", endpoint: "/plastic-erp/procurement/reports/materials" },
  { id: "rate-history", label: "Rate History", endpoint: "/plastic-erp/procurement/reports/rate-history" },
  { id: "supplier-performance", label: "Supplier Scorecards", endpoint: "/plastic-erp/procurement/reports/supplier-performance" },
  { id: "delivery-performance", label: "Delivery Timeliness", endpoint: "/plastic-erp/procurement/reports/delivery-performance" },
  { id: "variance", label: "Price Variance", endpoint: "/plastic-erp/procurement/reports/variance" },
  { id: "trend", label: "Monthly Trends", endpoint: "/plastic-erp/procurement/reports/trend" },
  { id: "mrp", label: "MRP Requirements", endpoint: "/plastic-erp/procurement/reports/mrp" },
  { id: "savings", label: "Procurement Savings", endpoint: "/plastic-erp/procurement/reports/savings" },
];

function PlasticProcurementReports() {
  const [selectedReportId, setSelectedReportId] = useState("orders");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const activeRep = REPORTS.find((r) => r.id === selectedReportId);
      if (!activeRep) return;

      const res = await API.get(activeRep.endpoint, {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      setReportData(res.data?.data || []);
    } catch (err) {
      console.error("Error loading procurement report:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedReportId, fromDate, toDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const activeReport = REPORTS.find((r) => r.id === selectedReportId);

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Procurement & Vendor Intelligence Reports"
        subtitle="Comprehensive analytics covering requisitions, purchase orders, delivery timeliness, price variance & MRP"
        badge="PROCUREMENT REPORTS"
        actions={
          <div className="sb-header-actions">
            <Button
              variant="secondary"
              size="md"
              icon="🖨️"
              onClick={() => window.print()}
            >
              Print / Export Report
            </Button>
            <Button
              variant="primary"
              size="md"
              icon="🔄"
              onClick={fetchReport}
            >
              Refresh Data
            </Button>
          </div>
        }
      />

      {/* Report Selector Tabs */}
      <div className="proc-reports-selector-wrap">
        <div className="proc-pills-scroll">
          <Tabs
            tabs={REPORTS}
            activeTab={selectedReportId}
            onChange={setSelectedReportId}
            variant="pills"
          />
        </div>
      </div>

      {/* Date Filter Bar */}
      <Card className="sb-filter-card" noPadding>
        <div className="sb-filter-row">
          <div className="sb-filter-item">
            <label className="sb-filter-label">Active Report:</label>
            <strong className="sb-text-primary">{activeReport?.label}</strong>
          </div>
          <div className="sb-filter-item">
            <label className="sb-filter-label">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="sb-input"
            />
          </div>
          <div className="sb-filter-item">
            <label className="sb-filter-label">To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="sb-input"
            />
          </div>
          {(fromDate || toDate) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setFromDate(""); setToDate(""); }}
            >
              Clear Dates
            </Button>
          )}
        </div>
      </Card>

      {/* Report Content Table Card */}
      <Card noPadding>
        {loading ? (
          <div className="sb-text-muted" style={{ textAlign: "center", padding: "48px" }}>
            Generating report data...
          </div>
        ) : reportData.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No records found"
            description="No data records match the selected reporting period and criteria."
          />
        ) : (
          <div className="sb-table-responsive">
            {selectedReportId === "requisitions" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>PR Number</th>
                    <th>Request Date</th>
                    <th>Requester</th>
                    <th>Department</th>
                    <th>Priority</th>
                    <th>Items Count</th>
                    <th>Requested Qty</th>
                    <th>Est. Total Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold sb-text-primary">{r.pr_no}</td>
                      <td>{r.request_date ? String(r.request_date).slice(0, 10) : "-"}</td>
                      <td>{r.requester_name}</td>
                      <td>{r.department}</td>
                      <td><StatusBadge status={r.priority} /></td>
                      <td>{r.items_count}</td>
                      <td>{Number(r.total_qty).toLocaleString()} KG</td>
                      <td className="sb-font-semibold">₹{Number(r.total_estimated_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "orders" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Expected Delivery</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Pending</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold sb-text-primary">{r.po_no}</td>
                      <td>{r.po_date ? String(r.po_date).slice(0, 10) : "-"}</td>
                      <td>{r.supplier_name}</td>
                      <td>{r.expected_delivery_date ? String(r.expected_delivery_date).slice(0, 10) : "-"}</td>
                      <td>{Number(r.total_ordered_qty).toLocaleString()} KG</td>
                      <td style={{ color: "var(--sb-success)" }}>{Number(r.received_qty || 0).toLocaleString()} KG</td>
                      <td style={{ color: "var(--sb-warning)" }}>{Number(r.pending_qty || 0).toLocaleString()} KG</td>
                      <td className="sb-font-semibold">₹{Number(r.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "pending-orders" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Expected Delivery</th>
                    <th>Overdue Days</th>
                    <th>Pending Qty</th>
                    <th>Order Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold sb-text-primary">{r.po_no}</td>
                      <td>{r.supplier_name}</td>
                      <td>{r.expected_delivery_date ? String(r.expected_delivery_date).slice(0, 10) : "-"}</td>
                      <td>
                        {r.delay_days > 0 ? (
                          <span style={{ color: "var(--sb-danger)", fontWeight: 700 }}>+{r.delay_days} days late</span>
                        ) : (
                          <span style={{ color: "var(--sb-success)" }}>On Track</span>
                        )}
                      </td>
                      <td className="sb-font-semibold">{Number(r.pending_qty).toLocaleString()} KG</td>
                      <td>₹{Number(r.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "suppliers" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Total Orders</th>
                    <th>Delivered Qty</th>
                    <th>Total Spend</th>
                    <th>Avg Landed Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold">{r.supplier_name}</td>
                      <td>{r.total_orders} orders</td>
                      <td>{Number(r.total_qty || 0).toLocaleString()} KG</td>
                      <td className="sb-font-semibold">₹{Number(r.total_spend || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>₹{Number(r.avg_rate || 0).toFixed(2)} / KG</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "materials" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Plastic Type</th>
                    <th>Total Purchased</th>
                    <th>Total Cost</th>
                    <th>Avg Rate / KG</th>
                    <th>Min Rate</th>
                    <th>Max Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold">{r.material_name}</td>
                      <td><span className="sb-badge sb-badge-teal">{r.plastic_type}</span></td>
                      <td>{Number(r.total_qty || 0).toLocaleString()} KG</td>
                      <td className="sb-font-semibold">₹{Number(r.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="sb-font-semibold sb-text-primary">₹{Number(r.avg_rate || 0).toFixed(2)}</td>
                      <td>₹{Number(r.min_rate || 0).toFixed(2)}</td>
                      <td>₹{Number(r.max_rate || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "rate-history" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Material</th>
                    <th>Supplier</th>
                    <th>PO #</th>
                    <th>Rate / KG</th>
                    <th>Tax %</th>
                    <th>Landed / KG</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td>{r.po_date ? String(r.po_date).slice(0, 10) : "-"}</td>
                      <td className="sb-font-semibold">{r.material_name}</td>
                      <td>{r.supplier_name}</td>
                      <td className="sb-text-primary">{r.po_no}</td>
                      <td>₹{Number(r.rate).toFixed(2)}</td>
                      <td>{r.tax_percent}%</td>
                      <td className="sb-font-semibold">₹{Number(r.landed_rate || r.rate).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "supplier-performance" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Total Orders</th>
                    <th>Quality Acceptance</th>
                    <th>Delivery Reliability</th>
                    <th>Overall Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold">{r.supplier_name}</td>
                      <td>{r.total_orders}</td>
                      <td>
                        <StatusBadge
                          status={r.quality_score >= 90 ? "high" : "medium"}
                          variant={r.quality_score >= 90 ? "success" : "warning"}
                        >
                          {r.quality_score}%
                        </StatusBadge>
                      </td>
                      <td>
                        <StatusBadge
                          status={r.delivery_score >= 90 ? "high" : "medium"}
                          variant={r.delivery_score >= 90 ? "success" : "warning"}
                        >
                          {r.delivery_score}%
                        </StatusBadge>
                      </td>
                      <td><strong>{r.overall_score} / 100</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "delivery-performance" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Delivery #</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>PO #</th>
                    <th>Delivered Qty</th>
                    <th>Accepted Qty</th>
                    <th>Delay Days</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold sb-text-primary">{r.delivery_no}</td>
                      <td>{r.delivery_date ? String(r.delivery_date).slice(0, 10) : "-"}</td>
                      <td>{r.supplier_name}</td>
                      <td>{r.po_no}</td>
                      <td>{Number(r.delivered_qty).toLocaleString()} KG</td>
                      <td style={{ color: "var(--sb-success)" }}>{Number(r.accepted_qty).toLocaleString()} KG</td>
                      <td>{r.delay_days > 0 ? `+${r.delay_days}d` : "0d"}</td>
                      <td>
                        <StatusBadge
                          status={r.delay_days > 0 ? "late" : "on time"}
                          variant={r.delay_days > 0 ? "danger" : "success"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "variance" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Supplier</th>
                    <th>Quoted Rate</th>
                    <th>Actual PO Rate</th>
                    <th>Variance Amount</th>
                    <th>Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold">{r.material_name}</td>
                      <td>{r.supplier_name}</td>
                      <td>₹{Number(r.quoted_rate).toFixed(2)}</td>
                      <td>₹{Number(r.actual_rate).toFixed(2)}</td>
                      <td className="sb-font-semibold">₹{Number(r.variance_amount).toFixed(2)}</td>
                      <td>
                        {Number(r.variance_percent) <= 0 ? (
                          <span style={{ color: "var(--sb-success)", fontWeight: 700 }}>{r.variance_percent}%</span>
                        ) : (
                          <span style={{ color: "var(--sb-danger)", fontWeight: 700 }}>+{r.variance_percent}%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "trend" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>PO Count</th>
                    <th>Delivered Volume</th>
                    <th>Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold">{r.month_label}</td>
                      <td>{r.po_count} orders</td>
                      <td>{Number(r.volume_kg || 0).toLocaleString()} KG</td>
                      <td className="sb-font-semibold">₹{Number(r.spend || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "mrp" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Current Stock</th>
                    <th>Safety Min</th>
                    <th>Target Max</th>
                    <th>Deficit</th>
                    <th>Suggested Qty</th>
                    <th>Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold">{r.material_name}</td>
                      <td>{Number(r.current_stock).toLocaleString()} {r.unit}</td>
                      <td>{Number(r.minimum_stock).toLocaleString()} {r.unit}</td>
                      <td>{Number(r.maximum_stock).toLocaleString()} {r.unit}</td>
                      <td style={{ color: "var(--sb-warning)", fontWeight: 600 }}>{Number(r.required_stock).toLocaleString()} {r.unit}</td>
                      <td style={{ color: "var(--sb-success)", fontWeight: 700 }}>{Number(r.suggested_order_qty).toLocaleString()} {r.unit}</td>
                      <td><StatusBadge status={r.urgency_level} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReportId === "savings" && (
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>Market / Standard Rate</th>
                    <th>Negotiated Rate</th>
                    <th>Qty Purchased</th>
                    <th>Total Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={i}>
                      <td className="sb-font-semibold">{r.supplier_name}</td>
                      <td>{r.material_name}</td>
                      <td>₹{Number(r.standard_rate).toFixed(2)}</td>
                      <td>₹{Number(r.negotiated_rate).toFixed(2)}</td>
                      <td>{Number(r.qty).toLocaleString()} KG</td>
                      <td style={{ color: "var(--sb-success)", fontWeight: 700 }}>
                        ₹{Number(r.total_savings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default PlasticProcurementReports;
