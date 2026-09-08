import { useState, useEffect } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticSalesReports.css";

function PlasticSalesReports() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("SALES"); // SALES, DISPATCH, COLLECTIONS, PROFIT

  // Date Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Report Data
  const [salesData, setSalesData] = useState(null);
  const [dispatchData, setDispatchData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [profitData, setProfitData] = useState(null);

  const fetchReports = async (start, end) => {
    try {
      setLoading(true);
      const params = [];
      if (start) params.push(`from_date=${start}`);
      if (end) params.push(`to_date=${end}`);
      const qs = params.length > 0 ? `?${params.join("&")}` : "";

      const [sRes, dRes, pRes, mRes] = await Promise.all([
        API.get(`/plastic-erp/reports/sales-summary${qs}`),
        API.get(`/plastic-erp/reports/dispatches${qs}`),
        API.get(`/plastic-erp/reports/payments${qs}`),
        API.get(`/plastic-erp/reports/profit-margin${qs}`),
      ]);

      if (sRes.data?.success) setSalesData(sRes.data.summary);
      if (dRes.data?.success) setDispatchData(dRes.data.summary);
      if (pRes.data?.success) setPaymentData(pRes.data.summary);
      if (mRes.data?.success) setProfitData(mRes.data.summary);
    } catch (err) {
      console.error("Failed to load reports:", err);
      alert("Failed to load sales and financial reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports(fromDate, toDate);
  }, [fromDate, toDate]);

  const handleQuickDate = (period) => {
    const today = new Date();
    if (period === "TODAY") {
      const d = today.toISOString().split("T")[0];
      setFromDate(d);
      setToDate(d);
    } else if (period === "THIS_MONTH") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      const last = today.toISOString().split("T")[0];
      setFromDate(first);
      setToDate(last);
    } else if (period === "ALL") {
      setFromDate("");
      setToDate("");
    }
  };

  if (loading) return <LoadingScreen message="Loading Sales & Financial Intelligence..." />;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container">
        {/* Header */}
        <div className="prep-header">
          <div>
            <span className="prep-badge">EXECUTIVE INTELLIGENCE</span>
            <h1 className="prep-title">Sales, Dispatch & Margin Reports</h1>
            <p className="prep-subtitle">
              Comprehensive analytics across order volumes, transport logistics, payment collections, and actual production margins.
            </p>
          </div>
          <div className="prep-header-actions">
            <button className="prep-btn prep-btn-print" onClick={() => window.print()}>
              🖨️ Print Report
            </button>
          </div>
        </div>

        {/* Date Filter & Tab Bar */}
        <div className="prep-control-card no-print">
          <div className="prep-tabs">
            <button
              className={`tab-btn ${activeTab === "SALES" ? "active" : ""}`}
              onClick={() => setActiveTab("SALES")}
            >
              📊 Sales Orders
            </button>
            <button
              className={`tab-btn ${activeTab === "DISPATCH" ? "active" : ""}`}
              onClick={() => setActiveTab("DISPATCH")}
            >
              🚚 Dispatches & Logistics
            </button>
            <button
              className={`tab-btn ${activeTab === "COLLECTIONS" ? "active" : ""}`}
              onClick={() => setActiveTab("COLLECTIONS")}
            >
              💰 Collections & Cash Flow
            </button>
            <button
              className={`tab-btn ${activeTab === "PROFIT" ? "active" : ""}`}
              onClick={() => setActiveTab("PROFIT")}
            >
              📈 Profit & Gross Margin
            </button>
          </div>

          <div className="prep-date-filters">
            <button className="btn-quick-date" onClick={() => handleQuickDate("TODAY")}>
              Today
            </button>
            <button className="btn-quick-date" onClick={() => handleQuickDate("THIS_MONTH")}>
              This Month
            </button>
            <button className="btn-quick-date" onClick={() => handleQuickDate("ALL")}>
              All Time
            </button>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="prep-date-input"
            />
            <span>to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="prep-date-input"
            />
          </div>
        </div>

        {/* TAB 1: SALES SUMMARY */}
        {activeTab === "SALES" && salesData && (
          <div className="report-content">
            <div className="prep-kpis">
              <div className="prep-kpi-card">
                <div className="prep-kpi-val">{salesData.totalOrders || 0}</div>
                <div className="prep-kpi-lbl">Total Sales Orders</div>
              </div>
              <div className="prep-kpi-card info">
                <div className="prep-kpi-val">{salesData.confirmedOrders || 0}</div>
                <div className="prep-kpi-lbl">Confirmed & Active</div>
              </div>
              <div className="prep-kpi-card success">
                <div className="prep-kpi-val">
                  ₹{Number(salesData.totalSalesValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="prep-kpi-lbl">Total Booked Value</div>
              </div>
              <div className="prep-kpi-card primary">
                <div className="prep-kpi-val">
                  ₹{Number(salesData.totalDispatchedValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="prep-kpi-lbl">Realized Invoiced Value</div>
              </div>
            </div>

            <div className="grid-2-sections">
              {/* Top Customers */}
              <div className="report-table-card">
                <h3>Top Customers by Sales Value</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Total Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesData.topCustomers || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No sales data
                        </td>
                      </tr>
                    ) : (
                      salesData.topCustomers.map((c, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{c.customer_name}</strong>
                          </td>
                          <td className="text-right">{c.order_count || 1}</td>
                          <td className="text-right font-bold text-success">
                            ₹{Number(c.total_value || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Top Products */}
              <div className="report-table-card">
                <h3>Top Products by Sales Volume</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">Volume (KG)</th>
                      <th className="text-right">Total Revenue (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesData.topProducts || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No product sales
                        </td>
                      </tr>
                    ) : (
                      salesData.topProducts.map((p, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{p.fg_name}</strong>
                            <div className="text-muted text-sm">{p.fg_code}</div>
                          </td>
                          <td className="text-right font-bold">
                            {Number(p.total_quantity || 0).toLocaleString()} KG
                          </td>
                          <td className="text-right text-primary font-bold">
                            ₹{Number(p.total_revenue || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DISPATCH & LOGISTICS */}
        {activeTab === "DISPATCH" && dispatchData && (
          <div className="report-content">
            <div className="prep-kpis">
              <div className="prep-kpi-card info">
                <div className="prep-kpi-val">{dispatchData.totalDispatches || 0}</div>
                <div className="prep-kpi-lbl">Total Dispatches</div>
              </div>
              <div className="prep-kpi-card success">
                <div className="prep-kpi-val">
                  {Number(dispatchData.totalDispatchedQty || 0).toLocaleString()} <span className="punit">KG</span>
                </div>
                <div className="prep-kpi-lbl">Shipped Granule Volume</div>
              </div>
            </div>

            <div className="grid-2-sections">
              {/* Transport Fleet Breakdown */}
              <div className="report-table-card">
                <h3>Dispatches by Transporter / Fleet</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Transporter</th>
                      <th className="text-right">Trips</th>
                      <th className="text-right">Volume (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dispatchData.byTransporter || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No transporter data
                        </td>
                      </tr>
                    ) : (
                      dispatchData.byTransporter.map((t, i) => (
                        <tr key={i}>
                          <td>{t.transporter || "Self Transport / Ex-Factory"}</td>
                          <td className="text-right">{t.trips_count || 1}</td>
                          <td className="text-right font-bold">
                            {Number(t.total_qty || 0).toLocaleString()} KG
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Destination Breakdown */}
              <div className="report-table-card">
                <h3>Top Delivery Destinations</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Destination / Hub</th>
                      <th className="text-right">Shipments</th>
                      <th className="text-right">Volume (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dispatchData.byDestination || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No destination data
                        </td>
                      </tr>
                    ) : (
                      dispatchData.byDestination.map((d, i) => (
                        <tr key={i}>
                          <td>{d.destination || "Factory Pickup"}</td>
                          <td className="text-right">{d.shipments_count || 1}</td>
                          <td className="text-right font-bold">
                            {Number(d.total_qty || 0).toLocaleString()} KG
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COLLECTIONS & CASH FLOW */}
        {activeTab === "COLLECTIONS" && paymentData && (
          <div className="report-content">
            <div className="prep-kpis">
              <div className="prep-kpi-card success">
                <div className="prep-kpi-val">
                  ₹{Number(paymentData.totalCollected || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="prep-kpi-lbl">Total Cash Inflow</div>
              </div>
              <div className="prep-kpi-card info">
                <div className="prep-kpi-val">{paymentData.totalPayments || 0}</div>
                <div className="prep-kpi-lbl">Payment Transactions</div>
              </div>
            </div>

            <div className="grid-2-sections">
              {/* Mode Breakdown */}
              <div className="report-table-card">
                <h3>Collections by Payment Channel</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Payment Channel</th>
                      <th className="text-right">Receipts</th>
                      <th className="text-right">Total Collected (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paymentData.byMode || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No collection data
                        </td>
                      </tr>
                    ) : (
                      paymentData.byMode.map((m, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{m.payment_mode}</strong>
                          </td>
                          <td className="text-right">{m.receipt_count}</td>
                          <td className="text-right font-bold text-success">
                            ₹{Number(m.total_amount || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Top Paying Customers */}
              <div className="report-table-card">
                <h3>Top Realized Collections by Customer</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="text-right">Payments</th>
                      <th className="text-right">Amount Paid (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paymentData.byCustomer || []).length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No customer collections
                        </td>
                      </tr>
                    ) : (
                      paymentData.byCustomer.map((c, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{c.customer_name}</strong>
                          </td>
                          <td className="text-right">{c.payment_count}</td>
                          <td className="text-right font-bold text-success">
                            ₹{Number(c.total_paid || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFIT & GROSS MARGIN (PHASE 2 BATCH COSTING LINKED) */}
        {activeTab === "PROFIT" && profitData && (
          <div className="report-content">
            <div className="prep-kpis">
              <div className="prep-kpi-card">
                <div className="prep-kpi-val">
                  ₹{Number(profitData.totalSalesRevenue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="prep-kpi-lbl">Total Sales Revenue</div>
              </div>
              <div className="prep-kpi-card warning">
                <div className="prep-kpi-val">
                  ₹{Number(profitData.totalCostOfGoodsSold || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="prep-kpi-lbl">Total Cost of Goods (COGS)</div>
              </div>
              <div className="prep-kpi-card success">
                <div className="prep-kpi-val">
                  ₹{Number(profitData.totalGrossProfit || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="prep-kpi-lbl">Total Gross Profit</div>
              </div>
              <div className="prep-kpi-card primary">
                <div className="prep-kpi-val">
                  {Number(profitData.grossMarginPercentage || 0).toFixed(1)}%
                </div>
                <div className="prep-kpi-lbl">Average Gross Margin</div>
              </div>
            </div>

            <div className="costing-notice-banner">
              <strong>Phase 2 Cost Engine Link:</strong> Product costs are derived directly from actual production batch costs (raw material consumption, machine running hours, electricity, direct labor).
            </div>

            <div className="report-table-card">
              <h3>Product Profit & Gross Margin Analysis</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Qty (KG)</th>
                    <th className="text-right">Revenue (₹)</th>
                    <th className="text-right">Actual Cost (₹)</th>
                    <th className="text-right">Gross Profit (₹)</th>
                    <th className="text-right">Margin (%)</th>
                    <th>Cost Source</th>
                  </tr>
                </thead>
                <tbody>
                  {(profitData.items || []).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted">
                        No sales items to analyze
                      </td>
                    </tr>
                  ) : (
                    profitData.items.map((it, i) => {
                      const gp = Number(it.gross_profit || 0);
                      const margin = Number(it.margin_pct || 0);
                      return (
                        <tr key={i}>
                          <td>
                            <strong>{it.fg_name}</strong>
                          </td>
                          <td className="text-right">{Number(it.total_qty || 0).toLocaleString()} KG</td>
                          <td className="text-right font-semibold">
                            ₹{Number(it.revenue || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="text-right text-muted">
                            ₹{Number(it.cost || 0).toLocaleString("en-IN")}
                          </td>
                          <td className={`text-right font-bold ${gp >= 0 ? "text-success" : "text-danger"}`}>
                            ₹{gp.toLocaleString("en-IN")}
                          </td>
                          <td className="text-right font-bold">
                            <span className={`margin-pill ${margin >= 15 ? "high" : margin >= 5 ? "mid" : "low"}`}>
                              {margin.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <span className="source-tag">
                              {it.cost_source || (it.cost_data_available ? "Batch Cost" : "Standard")}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlasticSalesReports;
