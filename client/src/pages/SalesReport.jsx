import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import AppShell from "../components/AppShell";
import "./SalesReport.css";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

function SalesReport() {
  const navigate = useNavigate();

  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartView, setChartView] = useState("monthly"); // "monthly" | "daily"

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      setError("");

      const [reportRes, invRes] = await Promise.allSettled([
        API.get("/dashboard/sales-report"),
        API.get("/invoices"),
      ]);

      if (reportRes.status === "fulfilled" && reportRes.value.data?.success) {
        setDailySales(reportRes.value.data.dailySales || []);
        setMonthlySales(reportRes.value.data.monthlySales || []);
      } else {
        setError(reportRes.value?.data?.message || "Unable to load sales report");
      }

      if (invRes.status === "fulfilled" && invRes.value.data?.invoices) {
        setInvoices(invRes.value.data.invoices || []);
      }
    } catch (err) {
      console.error("Sales Report Error:", err);
      setError(err.response?.data?.message || "Unable to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSalesReport();
  }, []);

  // KPIs
  const totalSales = useMemo(() => {
    if (invoices.length > 0) {
      return invoices.reduce((sum, inv) => sum + (Number(inv.grand_total) || 0), 0);
    }
    return monthlySales.reduce((sum, m) => sum + (Number(m.total) || 0), 0);
  }, [invoices, monthlySales]);

  const totalInvoicesCount = invoices.length;
  const avgInvoiceValue = totalInvoicesCount > 0 ? totalSales / totalInvoicesCount : 0;

  const todaySales = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const match = dailySales.find((d) => {
      if (!d.date) return false;
      const dStr = typeof d.date === "string" ? d.date.split("T")[0] : new Date(d.date).toISOString().split("T")[0];
      return dStr === today;
    });
    return match ? Number(match.total) || 0 : 0;
  }, [dailySales]);

  // Chart datasets
  const monthlyChartData = useMemo(() => {
    return [...monthlySales].reverse().map((item) => ({
      name: String(item.month || ""),
      total: Number(item.total) || 0,
    }));
  }, [monthlySales]);

  const dailyChartData = useMemo(() => {
    return [...dailySales].reverse().slice(-14).map((item) => ({
      name: formatDate(item.date),
      total: Number(item.total) || 0,
    }));
  }, [dailySales]);

  // Top Customers aggregation
  const topCustomers = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      const name = inv.customer_name || "Walk-in Customer";
      if (!map[name]) {
        map[name] = { name, count: 0, total: 0 };
      }
      map[name].count += 1;
      map[name].total += Number(inv.grand_total) || 0;
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices]);

  if (loading && dailySales.length === 0 && monthlySales.length === 0) {
    return <LoadingScreen title="Loading Sales Analytics..." subtitle="Aggregating financial reports..." />;
  }

  return (
    <AppShell
      activePage="sales-report"
      headerActions={
        <button
          type="button"
          className="sb-btn-primary"
          onClick={() => navigate("/invoices/create")}
        >
          <span>+</span> Create Invoice
        </button>
      }
    >
      {/* Header Bar */}
      <div className="rep-header-bar">
        <div>
          <div className="rep-badge-tag">FINANCIAL INTELLIGENCE</div>
          <h1 className="rep-title">Sales Analytics & Reports</h1>
          <p className="rep-subtitle">
            Track gross billing trends, daily revenue volume, and customer financial performance.
          </p>
        </div>

        <div className="rep-header-actions">
          <button
            type="button"
            className="sb-btn-refresh-sm"
            onClick={fetchSalesReport}
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="rep-error-banner">
          <span>⚠️ {error}</span>
          <button type="button" onClick={fetchSalesReport}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="rep-kpi-grid">
        <div className="rep-kpi-card accent-mint">
          <div className="kpi-icon-box">💰</div>
          <div className="kpi-info">
            <span className="kpi-label">Total Gross Sales</span>
            <strong className="kpi-val text-mint">{formatCurrency(totalSales)}</strong>
            <span className="kpi-sub">All-time revenue billing</span>
          </div>
        </div>

        <div className="rep-kpi-card accent-blue">
          <div className="kpi-icon-box">⚡</div>
          <div className="kpi-info">
            <span className="kpi-label">Today's Revenue</span>
            <strong className="kpi-val text-blue">{formatCurrency(todaySales)}</strong>
            <span className="kpi-sub">Settled sales today</span>
          </div>
        </div>

        <div className="rep-kpi-card accent-purple">
          <div className="kpi-icon-box">🧾</div>
          <div className="kpi-info">
            <span className="kpi-label">Total Invoices</span>
            <strong className="kpi-val text-purple">{totalInvoicesCount}</strong>
            <span className="kpi-sub">Total bills issued</span>
          </div>
        </div>

        <div className="rep-kpi-card accent-orange">
          <div className="kpi-icon-box">📊</div>
          <div className="kpi-info">
            <span className="kpi-label">Avg Invoice Value</span>
            <strong className="kpi-val text-orange">{formatCurrency(avgInvoiceValue)}</strong>
            <span className="kpi-sub">Average per transaction</span>
          </div>
        </div>
      </div>

      {/* Analytics Chart Card */}
      <div className="rep-main-card">
        <div className="rep-card-top">
          <div className="rep-card-top-info">
            <h2 className="rep-card-title">Revenue Trajectory</h2>
            <span className="rep-count-pill">
              {chartView === "monthly" ? "Monthly Breakdown" : "Recent 14 Days"}
            </span>
          </div>

          <div className="rep-chart-tabs">
            <button
              type="button"
              className={`rep-tab-btn ${chartView === "monthly" ? "active" : ""}`}
              onClick={() => setChartView("monthly")}
            >
              📆 Monthly View
            </button>
            <button
              type="button"
              className={`rep-tab-btn ${chartView === "daily" ? "active" : ""}`}
              onClick={() => setChartView("daily")}
            >
              📅 Daily View (14D)
            </button>
          </div>
        </div>

        <div className="rep-chart-container">
          {(chartView === "monthly" ? monthlyChartData : dailyChartData).length === 0 ? (
            <div className="rep-empty-state">
              <span className="empty-icon">📊</span>
              <h3>No Revenue Data Yet</h3>
              <p>Sales trend charts will activate once you generate invoices.</p>
            </div>
          ) : chartView === "monthly" ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={monthlyChartData}
                margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickFormatter={(val) => `₹${Number(val).toLocaleString("en-IN")}`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), "Gross Sales"]}
                  labelFormatter={(label) => `Period: ${label}`}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Sales"
                  fill="#4F46E5"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={dailyChartData}
                margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickFormatter={(val) => `₹${Number(val).toLocaleString("en-IN")}`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), "Daily Sales"]}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#4F46E5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2-Column Split: Daily Sales Breakdown + Top Accounts */}
      <div className="rep-split-grid">
        {/* Daily Breakdown */}
        <div className="rep-main-card">
          <div className="rep-card-top">
            <div className="rep-card-top-info">
              <h3 className="rep-card-title">📅 Daily Revenue Ledger</h3>
              <span className="rep-count-pill">{dailySales.length} entries</span>
            </div>
          </div>

          {dailySales.length === 0 ? (
            <div className="rep-empty-state">
              <span className="empty-icon">📅</span>
              <p>No daily sales entries found.</p>
            </div>
          ) : (
            <div className="rep-table-responsive">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Gross Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySales.slice(0, 10).map((item, idx) => (
                    <tr key={item.date || idx}>
                      <td className="text-muted font-bold">{idx + 1}</td>
                      <td>
                        <strong className="rep-date-str">{formatDate(item.date)}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong className="rep-amount-highlight text-mint">
                          {formatCurrency(item.total)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Accounts */}
        <div className="rep-main-card">
          <div className="rep-card-top">
            <div className="rep-card-top-info">
              <h3 className="rep-card-title">👥 Top Customer Accounts</h3>
              <span className="rep-count-pill">Ranked by volume</span>
            </div>
          </div>

          {topCustomers.length === 0 ? (
            <div className="rep-empty-state">
              <span className="empty-icon">👥</span>
              <p>No customer transactions available.</p>
            </div>
          ) : (
            <div className="rep-table-responsive">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>Client Name</th>
                    <th style={{ textAlign: "center" }}>Orders</th>
                    <th style={{ textAlign: "right" }}>Total Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((cust, idx) => (
                    <tr key={cust.name}>
                      <td className="text-muted font-bold">{idx + 1}</td>
                      <td>
                        <strong className="rep-client-name">{cust.name}</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="rep-order-pill">{cust.count} bill{cust.count !== 1 ? "s" : ""}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong className="rep-amount-highlight text-blue">
                          {formatCurrency(cust.total)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default SalesReport;
