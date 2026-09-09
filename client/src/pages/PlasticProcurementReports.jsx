import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticProcurementReports.css";

const REPORTS = [
  { id: "requisitions", name: "1. Purchase Requisitions", endpoint: "/plastic-erp/procurement/reports/requisitions" },
  { id: "orders", name: "2. Purchase Orders", endpoint: "/plastic-erp/procurement/reports/orders" },
  { id: "pending-orders", name: "3. Pending PO & Overdue", endpoint: "/plastic-erp/procurement/reports/pending-orders" },
  { id: "suppliers", name: "4. Supplier Purchase Summary", endpoint: "/plastic-erp/procurement/reports/suppliers" },
  { id: "materials", name: "5. Material Purchase Summary", endpoint: "/plastic-erp/procurement/reports/materials" },
  { id: "rate-history", name: "6. Purchase Rate History", endpoint: "/plastic-erp/procurement/reports/rate-history" },
  { id: "supplier-performance", name: "7. Supplier Scorecards", endpoint: "/plastic-erp/procurement/reports/supplier-performance" },
  { id: "delivery-performance", name: "8. Delivery Timeliness", endpoint: "/plastic-erp/procurement/reports/delivery-performance" },
  { id: "variance", name: "9. Purchase Price Variance", endpoint: "/plastic-erp/procurement/reports/variance" },
  { id: "trend", name: "10. Monthly Purchase Trends", endpoint: "/plastic-erp/procurement/reports/trend" },
  { id: "mrp", name: "11. Material Requirements (MRP)", endpoint: "/plastic-erp/procurement/reports/mrp" },
  { id: "savings", name: "12. Procurement Savings", endpoint: "/plastic-erp/procurement/reports/savings" },
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
      setReportData(res.data.data || []);
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
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">📊 Procurement & Vendor Intelligence Reports</h1>
            <p className="procurement-subtitle">
              Comprehensive analytics covering requisitions, purchase orders, delivery timeliness, price variance & MRP
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.print()}
          >
            🖨️ Print / Export Report
          </button>
        </div>

        {/* Report Selector Pills */}
        <div className="reports-nav-pills">
          {REPORTS.map((rep) => (
            <button
              key={rep.id}
              type="button"
              className={`report-pill-btn ${selectedReportId === rep.id ? "active" : ""}`}
              onClick={() => setSelectedReportId(rep.id)}
            >
              {rep.name}
            </button>
          ))}
        </div>

        {/* Date Filter Bar */}
        <div className="procurement-filters-bar">
          <div className="filter-group">
            <label>Active Report:</label>
            <strong>{activeReport?.name}</strong>
          </div>
          <div className="filter-group">
            <label>From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="procurement-input"
            />
          </div>
          <div className="filter-group">
            <label>To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="procurement-input"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => { setFromDate(""); setToDate(""); }}
            >
              Clear Dates
            </button>
          )}
        </div>

        {/* Report Content Table */}
        <div className="procurement-table-card">
          {loading ? (
            <div className="p-8 text-center text-muted">Generating report data...</div>
          ) : reportData.length === 0 ? (
            <div className="p-8 text-center text-muted">No records found for the selected reporting period.</div>
          ) : (
            <div className="table-responsive">
              {/* Render specific table structures based on report id */}
              {selectedReportId === "requisitions" && (
                <table className="procurement-table">
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
                        <td className="font-semibold text-primary">{r.pr_no}</td>
                        <td>{r.request_date ? String(r.request_date).slice(0, 10) : "-"}</td>
                        <td>{r.requester_name}</td>
                        <td>{r.department}</td>
                        <td><span className={`priority-badge ${r.priority.toLowerCase()}`}>{r.priority}</span></td>
                        <td>{r.items_count}</td>
                        <td>{Number(r.total_qty).toLocaleString()} KG</td>
                        <td className="font-bold">₹{Number(r.total_estimated_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td><span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "orders" && (
                <table className="procurement-table">
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
                        <td className="font-semibold text-primary">{r.po_no}</td>
                        <td>{r.po_date ? String(r.po_date).slice(0, 10) : "-"}</td>
                        <td>{r.supplier_name}</td>
                        <td>{r.expected_delivery_date ? String(r.expected_delivery_date).slice(0, 10) : "-"}</td>
                        <td>{Number(r.total_ordered_qty).toLocaleString()} KG</td>
                        <td className="text-emerald-400 font-semibold">{Number(r.total_received_qty).toLocaleString()} KG</td>
                        <td className="text-amber-400 font-semibold">{Number(r.total_pending_qty).toLocaleString()} KG</td>
                        <td className="font-bold">₹{Number(r.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td><span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "pending-orders" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Material</th>
                      <th>Ordered</th>
                      <th>Received</th>
                      <th>Pending</th>
                      <th>Agreed Rate</th>
                      <th>Pending Value</th>
                      <th>Overdue Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-semibold text-primary">{r.po_no}</td>
                        <td>{r.supplier_name}</td>
                        <td>{r.material_name}</td>
                        <td>{Number(r.ordered_qty).toLocaleString()} KG</td>
                        <td>{Number(r.received_qty).toLocaleString()} KG</td>
                        <td className="text-amber-400 font-bold">{Number(r.pending_qty).toLocaleString()} KG</td>
                        <td>₹{Number(r.rate).toFixed(2)}</td>
                        <td className="font-bold">₹{Number(r.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td>
                          {r.overdue_days > 0 ? (
                            <span className="text-rose-400 font-bold">+{r.overdue_days} days late</span>
                          ) : (
                            <span className="text-emerald-400">On Track</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "suppliers" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Supplier Code & Name</th>
                      <th>Mobile</th>
                      <th>City</th>
                      <th>Total Purchase Bills</th>
                      <th>Total Purchased Qty</th>
                      <th>Weighted Avg Rate</th>
                      <th>Total Spend Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.supplier_name}</strong> <small className="text-muted">({r.supplier_code})</small></td>
                        <td>{r.mobile}</td>
                        <td>{r.city || "-"}</td>
                        <td>{r.total_bills}</td>
                        <td>{Number(r.total_purchased_qty).toLocaleString()} KG</td>
                        <td className="font-semibold">₹{Number(r.weighted_avg_rate).toFixed(2)}</td>
                        <td className="font-bold text-emerald-400">₹{Number(r.total_spend).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "materials" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Material Code & Name</th>
                      <th>Plastic Type</th>
                      <th>Bills Count</th>
                      <th>Total Purchased Qty</th>
                      <th>Lowest Rate</th>
                      <th>Highest Rate</th>
                      <th>Average Rate</th>
                      <th>Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.material_name}</strong> <small className="text-muted">({r.material_code})</small></td>
                        <td>{r.plastic_type}</td>
                        <td>{r.purchase_count}</td>
                        <td>{Number(r.total_purchased_qty).toLocaleString()} {r.unit}</td>
                        <td>₹{Number(r.lowest_rate || 0).toFixed(2)}</td>
                        <td>₹{Number(r.highest_rate || 0).toFixed(2)}</td>
                        <td className="font-semibold">₹{Number(r.average_rate || 0).toFixed(2)}</td>
                        <td className="font-bold text-emerald-400">₹{Number(r.total_spend).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "rate-history" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Purchase Date</th>
                      <th>Material</th>
                      <th>Supplier</th>
                      <th>Quantity</th>
                      <th>Purchase Rate</th>
                      <th>Previous Rate</th>
                      <th>Variance Amount</th>
                      <th>Variance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td>{r.purchase_date ? String(r.purchase_date).slice(0, 10) : "-"}</td>
                        <td><strong>{r.material_name}</strong></td>
                        <td>{r.supplier_name}</td>
                        <td>{Number(r.quantity).toLocaleString()} KG</td>
                        <td className="font-bold">₹{Number(r.purchase_rate).toFixed(2)}</td>
                        <td>₹{Number(r.previous_rate).toFixed(2)}</td>
                        <td>₹{Number(r.variance_amount).toFixed(2)}</td>
                        <td>
                          {Number(r.variance_percent) > 0 ? (
                            <span className="text-amber-400">+{Number(r.variance_percent).toFixed(1)}%</span>
                          ) : (
                            <span className="text-emerald-400">{Number(r.variance_percent).toFixed(1)}%</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "supplier-performance" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Total Orders</th>
                      <th>On-Time Deliveries</th>
                      <th>Late Deliveries</th>
                      <th>Quality Pass %</th>
                      <th>Delivery Score</th>
                      <th>Quality Score</th>
                      <th>Commercial Score</th>
                      <th>Overall Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.supplier_name}</strong></td>
                        <td>{r.total_orders}</td>
                        <td className="text-emerald-400">{r.on_time_deliveries}</td>
                        <td className={r.late_deliveries > 0 ? "text-amber-400" : "text-muted"}>{r.late_deliveries}</td>
                        <td>{r.quality_acceptance_percent}%</td>
                        <td>{r.delivery_score}%</td>
                        <td>{r.quality_score}%</td>
                        <td>{r.commercial_score}%</td>
                        <td className="font-bold text-primary">{r.overall_score} / 100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "delivery-performance" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Delivery #</th>
                      <th>Date</th>
                      <th>PO #</th>
                      <th>Supplier</th>
                      <th>Material</th>
                      <th>Delivered</th>
                      <th>Accepted</th>
                      <th>Delay</th>
                      <th>Timeliness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-semibold text-primary">{r.delivery_no}</td>
                        <td>{r.delivery_date ? String(r.delivery_date).slice(0, 10) : "-"}</td>
                        <td>{r.po_no}</td>
                        <td>{r.supplier_name}</td>
                        <td>{r.material_name}</td>
                        <td>{Number(r.delivered_qty).toLocaleString()} KG</td>
                        <td className="text-emerald-400">{Number(r.accepted_qty).toLocaleString()} KG</td>
                        <td>{r.delivery_delay_days > 0 ? `+${r.delivery_delay_days}d late` : "0d"}</td>
                        <td>
                          <span className={`status-badge ${r.timeliness_status === "ON_TIME" ? "approved" : "rejected"}`}>
                            {r.timeliness_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "variance" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Material Code & Name</th>
                      <th>Standard Baseline Rate</th>
                      <th>Actual Purchase Rate</th>
                      <th>Variance (₹/KG)</th>
                      <th>Variance %</th>
                      <th>Purchased Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.material_name}</strong> <small className="text-muted">({r.material_code})</small></td>
                        <td>₹{Number(r.standard_rate).toFixed(2)}</td>
                        <td className="font-semibold">₹{Number(r.actual_avg_rate).toFixed(2)}</td>
                        <td>₹{Number(r.variance_amount).toFixed(2)}</td>
                        <td>
                          {Number(r.variance_percentage) > 0 ? (
                            <span className="text-rose-400">+{Number(r.variance_percentage).toFixed(1)}%</span>
                          ) : (
                            <span className="text-emerald-400">{Number(r.variance_percentage).toFixed(1)}%</span>
                          )}
                        </td>
                        <td>{Number(r.total_qty).toLocaleString()} KG</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "trend" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Month Period</th>
                      <th>Total Inward Bills</th>
                      <th>Taxable Purchases</th>
                      <th>Taxes Paid</th>
                      <th>Total Gross Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-bold text-primary">{r.period}</td>
                        <td>{r.total_bills}</td>
                        <td>₹{Number(r.total_taxable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td>₹{Number(r.total_tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="font-bold text-emerald-400">₹{Number(r.total_spend).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "mrp" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>Material Code & Name</th>
                      <th>Type</th>
                      <th>Current Stock</th>
                      <th>Min Threshold</th>
                      <th>Max Target</th>
                      <th>Deficit Qty</th>
                      <th>Suggested Reorder</th>
                      <th>Urgency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.material_name}</strong> <small className="text-muted">({r.material_code})</small></td>
                        <td>{r.plastic_type}</td>
                        <td className={r.current_stock < r.minimum_stock ? "text-amber-400 font-bold" : ""}>
                          {Number(r.current_stock).toLocaleString()} {r.unit}
                        </td>
                        <td>{Number(r.minimum_stock).toLocaleString()} {r.unit}</td>
                        <td>{Number(r.maximum_stock).toLocaleString()} {r.unit}</td>
                        <td className="text-rose-400 font-bold">{Number(r.deficit_quantity).toLocaleString()} {r.unit}</td>
                        <td className="text-emerald-400 font-bold">{Number(r.suggested_reorder_qty).toLocaleString()} {r.unit}</td>
                        <td><span className={`priority-badge ${r.urgency_level.toLowerCase()}`}>{r.urgency_level}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedReportId === "savings" && (
                <table className="procurement-table">
                  <thead>
                    <tr>
                      <th>PO #</th>
                      <th>Date</th>
                      <th>Supplier</th>
                      <th>Material</th>
                      <th>Quantity</th>
                      <th>Agreed PO Rate</th>
                      <th>Baseline Rate</th>
                      <th>Unit Savings</th>
                      <th>Total Commercial Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-semibold text-primary">{r.po_no}</td>
                        <td>{r.po_date ? String(r.po_date).slice(0, 10) : "-"}</td>
                        <td>{r.supplier_name}</td>
                        <td>{r.material_name}</td>
                        <td>{Number(r.ordered_qty).toLocaleString()} KG</td>
                        <td>₹{Number(r.agreed_po_rate).toFixed(2)}</td>
                        <td>₹{Number(r.standard_baseline_rate).toFixed(2)}</td>
                        <td className="text-emerald-400 font-semibold">₹{Number(r.unit_savings).toFixed(2)}</td>
                        <td className="font-bold text-emerald-400">₹{Number(r.total_savings).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlasticProcurementReports;
