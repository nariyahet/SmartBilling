import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button } from "../components";
import "./PlasticSalesReports.css";

function PlasticSalesReports({ defaultTab = "SALES" }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname === "/plastic-erp/payment-reports" || defaultTab === "COLLECTIONS") {
      return "COLLECTIONS";
    }
    if (location.pathname === "/plastic-erp/dispatch-reports" || defaultTab === "DISPATCH") {
      return "DISPATCH";
    }
    return defaultTab;
  });

  useEffect(() => {
    if (location.pathname === "/plastic-erp/payment-reports") {
      setActiveTab("COLLECTIONS");
    } else if (location.pathname === "/plastic-erp/dispatch-reports") {
      setActiveTab("DISPATCH");
    } else if (location.pathname === "/plastic-erp/sales-reports") {
      setActiveTab("SALES");
    }
  }, [location.pathname]);

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
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title={
            activeTab === "COLLECTIONS"
              ? "Payment & Collections Reports"
              : activeTab === "DISPATCH"
              ? "Dispatch & Logistics Reports"
              : "Sales, Dispatch & Margin Reports"
          }
          subtitle={
            activeTab === "COLLECTIONS"
              ? "Comprehensive records across customer receipts, payment methods, channel analytics, and cash flow."
              : activeTab === "DISPATCH"
              ? "Comprehensive analytics across vehicle tracking, dispatch volumes, logistics metrics, and delivery fulfillment."
              : "Comprehensive analytics across order volumes, transport logistics, payment collections, and actual production margins."
          }
          badge="EXECUTIVE INTELLIGENCE"
          actions={
            <div className="prep-header-actions no-print">
              <Button variant="secondary" size="md" onClick={() => window.print()}>
                🖨️ Print Report
              </Button>
            </div>
          }
        />

        {/* Date Filter & Tab Bar */}
        <Card className="prep-control-card no-print">
          <div className="prep-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === "SALES" ? "active" : ""}`}
              onClick={() => setActiveTab("SALES")}
            >
              📊 Sales Orders
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "DISPATCH" ? "active" : ""}`}
              onClick={() => setActiveTab("DISPATCH")}
            >
              🚚 Dispatches & Logistics
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "COLLECTIONS" ? "active" : ""}`}
              onClick={() => setActiveTab("COLLECTIONS")}
            >
              💰 Collections & Cash Flow
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "PROFIT" ? "active" : ""}`}
              onClick={() => setActiveTab("PROFIT")}
            >
              📈 Profit & Gross Margin
            </button>
          </div>

          <div className="prep-date-filters">
            <Button variant="ghost" size="sm" onClick={() => handleQuickDate("TODAY")}>
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleQuickDate("THIS_MONTH")}>
              This Month
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleQuickDate("ALL")}>
              All Time
            </Button>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="sb-input prep-date-input"
            />
            <span className="prep-date-separator">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="sb-input prep-date-input"
            />
          </div>
        </Card>

        {/* TAB 1: SALES SUMMARY */}
        {activeTab === "SALES" && salesData && (
          <div className="report-content">
            <div className="prep-kpis">
              <KpiCard
                title="Total Sales Orders"
                value={salesData.totalOrders || 0}
                subtitle="All generated orders"
                variant="default"
              />
              <KpiCard
                title="Confirmed & Active"
                value={salesData.confirmedOrders || 0}
                subtitle="Approved production backlog"
                variant="info"
              />
              <KpiCard
                title="Total Booked Value"
                value={`₹${Number(salesData.totalSalesValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                subtitle="Total order commitment"
                variant="success"
              />
              <KpiCard
                title="Realized Invoiced Value"
                value={`₹${Number(salesData.totalDispatchedValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                subtitle="Actual delivered turnover"
                variant="primary"
              />
            </div>

            <div className="grid-2-sections">
              {/* Top Customers */}
              <Card title="Top Customers by Sales Value">
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
              </Card>

              {/* Top Products */}
              <Card title="Top Products by Sales Volume">
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
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: DISPATCH & LOGISTICS */}
        {activeTab === "DISPATCH" && dispatchData && (
          <div className="report-content">
            <div className="prep-kpis">
              <KpiCard
                title="Total Dispatches"
                value={dispatchData.totalDispatches || 0}
                subtitle="Completed vehicle departures"
                variant="info"
              />
              <KpiCard
                title="Shipped Granule Volume"
                value={`${Number(dispatchData.totalDispatchedQty || 0).toLocaleString()} KG`}
                subtitle="Physical material moved"
                variant="success"
              />
            </div>

            <div className="grid-2-sections">
              {/* Transport Fleet Breakdown */}
              <Card title="Dispatches by Transporter / Fleet">
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
              </Card>

              {/* Destination Breakdown */}
              <Card title="Top Delivery Destinations">
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
              </Card>
            </div>
          </div>
        )}

        {/* TAB 3: COLLECTIONS & CASH FLOW */}
        {activeTab === "COLLECTIONS" && paymentData && (
          <div className="report-content">
            <div className="prep-kpis">
              <KpiCard
                title="Total Cash Inflow"
                value={`₹${Number(paymentData.totalCollected || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                subtitle="Cleared collections"
                variant="success"
              />
              <KpiCard
                title="Payment Transactions"
                value={paymentData.totalPayments || 0}
                subtitle="Individual receipts logged"
                variant="info"
              />
            </div>

            <div className="grid-2-sections">
              {/* Mode Breakdown */}
              <Card title="Collections by Payment Channel">
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
              </Card>

              {/* Top Paying Customers */}
              <Card title="Top Realized Collections by Customer">
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
              </Card>
            </div>
          </div>
        )}

        {/* TAB 4: PROFIT & GROSS MARGIN (PHASE 2 BATCH COSTING LINKED) */}
        {activeTab === "PROFIT" && profitData && (
          <div className="report-content">
            <div className="prep-kpis">
              <KpiCard
                title="Total Sales Revenue"
                value={`₹${Number(profitData.totalSalesRevenue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                subtitle="Net invoiced turnover"
                variant="default"
              />
              <KpiCard
                title="Total Cost of Goods (COGS)"
                value={`₹${Number(profitData.totalCostOfGoodsSold || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                subtitle="Direct material & batch costs"
                variant="warning"
              />
              <KpiCard
                title="Total Gross Profit"
                value={`₹${Number(profitData.totalGrossProfit || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
                subtitle="Gross manufacturing contribution"
                variant="success"
              />
              <KpiCard
                title="Average Gross Margin"
                value={`${Number(profitData.grossMarginPercentage || 0).toFixed(1)}%`}
                subtitle="Blended production margin"
                variant="primary"
              />
            </div>

            <div className="costing-notice-banner">
              <strong>Phase 2 Cost Engine Link:</strong> Product costs are derived directly from actual production batch costs (raw material consumption, machine running hours, electricity, direct labor).
            </div>

            <Card title="Product Profit & Gross Margin Analysis">
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
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlasticSalesReports;
