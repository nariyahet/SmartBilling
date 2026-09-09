import { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import "./Dashboard.css";

// Semantic color mapping for polymers
const POLYMER_COLORS = {
  PET: "#0879D1", // Primary Ocean Blue
  PP: "#159A9C", // Teal
  HDPE: "#1597E5", // Secondary Blue
  LDPE: "#063B66", // Deep Navy
  OTHER: "#718096", // Slate Muted
};

function Dashboard() {
  const navigate = useNavigate();

  // Core SmartBilling stats
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalProducts: 0,
    totalInvoices: 0,
    totalSales: 0,
    todaySales: 0,
  });

  // Plastic ERP Comprehensive KPIs
  const [plasticStats, setPlasticStats] = useState({
    totalPurchasedKg: 0,
    totalPurchaseAmount: 0,
    currentStockKg: 0,
    currentStockValue: 0,
    totalSuppliers: 0,
    totalTruckInwards: 0,
    totalInwardWeight: 0,
    totalPurchaseBills: 0,
    lowStockMaterials: [],
    todayProductionKg: 0,
    monthProductionKg: 0,
    productionTargetKg: 0,
    productionAchievementPercent: 0,
    activeBatches: 0,
    currentWipKg: 0,
    finishedGoodsStockKg: 0,
    scrapGeneratedKg: 0,
    regrindGeneratedKg: 0,
    efficiencyPercent: 0,
    machineUtilizationPercent: 0,
    activeMachines: 0,
    maintenanceMachines: 0,
    qcPending: 0,
    qcRejected: 0,
    totalProductionCost: 0,
    todaySales: 0,
    monthSales: 0,
    salesOrders: 0,
    pendingOrders: 0,
    todayDispatches: 0,
    monthDispatches: 0,
    totalDispatches: 0,
    finishedGoodsSoldKg: 0,
    finishedGoodsAvailableKg: 0,
    outstandingReceivables: 0,
    paymentsCollected: 0,
    salesReturns: 0,
    salesReturnAmount: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
    totalEmployees: 0,
    todayPresentEmployees: 0,
    activeAdvances: 0,
    outstandingAdvanceAmount: 0,
    monthExpensesAmount: 0,
    monthPayrollAmount: 0,
    pendingLeavesCount: 0,
  });

  // Supporting arrays & data sets
  const [invoices, setInvoices] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [stockList, setStockList] = useState([]);
  const [truckInwards, setTruckInwards] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [phase3Analytics, setPhase3Analytics] = useState(null);
  const [phase4Analytics, setPhase4Analytics] = useState(null);

  // Filter & UI state
  const [period, setPeriod] = useState("month");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [recentTab, setRecentTab] = useState("invoices");

  // Company and user info
  const [companyInfo] = useState(() => {
    try {
      const saved = localStorage.getItem("company");
      return saved ? JSON.parse(saved) : { name: "Kim Plant Operations" };
    } catch {
      return { name: "Kim Plant Operations" };
    }
  });

  const [businessSettings, setBusinessSettings] = useState(null);

  const formatCurrency = useCallback(
    (amount) => {
      return `${currencySymbol}${Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [currencySymbol]
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  // Main data fetcher
  const loadDashboardData = useCallback(
    async (targetPeriod = period, fromDate = customFromDate, toDate = customToDate, isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError("");

        let plasticStatsUrl = `/dashboard/plastic-stats?period=${targetPeriod}`;
        if (targetPeriod === "custom" && fromDate && toDate) {
          plasticStatsUrl += `&from_date=${fromDate}&to_date=${toDate}`;
        }

        const [
          statsRes,
          lowStockRes,
          settingsRes,
          plasticStatsRes,
          salesRepRes,
          invoicesRes,
          p3Res,
          p4Res,
          stockRes,
          inwardsRes,
          billsRes,
        ] = await Promise.allSettled([
          API.get("/dashboard"),
          API.get("/dashboard/low-stock"),
          API.get("/business-settings"),
          API.get(plasticStatsUrl),
          API.get("/dashboard/sales-report"),
          API.get("/invoices"),
          API.get("/dashboard/plastic-phase3-analytics"),
          API.get("/dashboard/plastic-phase4-analytics"),
          API.get("/raw-material-stock"),
          API.get("/truck-inwards"),
          API.get("/purchase-bills"),
        ]);

        // 1. Core billing stats
        if (statsRes.status === "fulfilled" && statsRes.value.data?.success && statsRes.value.data?.stats) {
          const s = statsRes.value.data.stats;
          setStats({
            totalCustomers: Number(s.totalCustomers) || 0,
            totalProducts: Number(s.totalProducts) || 0,
            totalInvoices: Number(s.totalInvoices) || 0,
            totalSales: Number(s.totalSales) || 0,
            todaySales: Number(s.todaySales) || 0,
          });
        }

        // 2. Low stock products
        if (lowStockRes.status === "fulfilled" && Array.isArray(lowStockRes.value.data?.products)) {
          setLowStockProducts(lowStockRes.value.data.products);
        }

        // 3. Settings
        if (settingsRes.status === "fulfilled" && settingsRes.value.data?.settings) {
          setBusinessSettings(settingsRes.value.data.settings);
          if (settingsRes.value.data.settings.currency_symbol) {
            setCurrencySymbol(settingsRes.value.data.settings.currency_symbol);
          }
        }

        // 4. Plastic ERP Stats
        if (plasticStatsRes.status === "fulfilled" && plasticStatsRes.value.data?.success && plasticStatsRes.value.data?.stats) {
          setPlasticStats(plasticStatsRes.value.data.stats);
        }

        // 5. Sales Report (Daily & Monthly trends)
        if (salesRepRes.status === "fulfilled" && salesRepRes.value.data?.report) {
          const rep = salesRepRes.value.data.report;
          setDailySales(Array.isArray(rep.dailySales) ? rep.dailySales : []);
          setMonthlySales(Array.isArray(rep.monthlySales) ? rep.monthlySales : []);
        }

        // 6. Invoices
        if (invoicesRes.status === "fulfilled" && Array.isArray(invoicesRes.value.data?.invoices)) {
          setInvoices(invoicesRes.value.data.invoices);
        }

        // 7. Phase 3 Analytics (Sales, Dispatches, Pipeline)
        if (p3Res.status === "fulfilled" && p3Res.value.data?.success) {
          setPhase3Analytics(p3Res.value.data.analytics || null);
        }

        // 8. Phase 4 Analytics (HR, Workforce, Expenses)
        if (p4Res.status === "fulfilled" && p4Res.value.data?.success) {
          setPhase4Analytics(p4Res.value.data.analytics || null);
        }

        // 9. Stock List (for polymer composition)
        if (stockRes.status === "fulfilled" && stockRes.value.data?.success) {
          setStockList(Array.isArray(stockRes.value.data.stock) ? stockRes.value.data.stock : []);
        }

        // 10. Truck Inwards
        if (inwardsRes.status === "fulfilled" && inwardsRes.value.data?.success) {
          setTruckInwards(Array.isArray(inwardsRes.value.data.truck_inwards) ? inwardsRes.value.data.truck_inwards : []);
        }

        // 11. Purchase Bills
        if (billsRes.status === "fulfilled" && billsRes.value.data?.success) {
          setPurchaseBills(Array.isArray(billsRes.value.data.purchase_bills) ? billsRes.value.data.purchase_bills : []);
        }
      } catch (err) {
        console.error("Dashboard loading error:", err);
        setError("Unable to load latest dashboard metrics. Please check network connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, customFromDate, customToDate]
  );

  useEffect(() => {
    loadDashboardData(period, customFromDate, customToDate, false);
  }, []);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod !== "custom") {
      loadDashboardData(newPeriod, customFromDate, customToDate, true);
    }
  };

  const handleApplyCustomFilter = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (customFromDate && customToDate) {
      loadDashboardData("custom", customFromDate, customToDate, true);
    }
  };

  // Polymer Stock Distribution calculation
  const polymerDistribution = useMemo(() => {
    const buckets = {
      PET: { name: "PET", quantityKg: 0, color: POLYMER_COLORS.PET },
      PP: { name: "PP", quantityKg: 0, color: POLYMER_COLORS.PP },
      HDPE: { name: "HDPE", quantityKg: 0, color: POLYMER_COLORS.HDPE },
      LDPE: { name: "LDPE", quantityKg: 0, color: POLYMER_COLORS.LDPE },
      OTHER: { name: "OTHER", quantityKg: 0, color: POLYMER_COLORS.OTHER },
    };

    let total = 0;
    stockList.forEach((item) => {
      const type = (item.plastic_type || "OTHER").toUpperCase();
      const bucket = buckets[type] || buckets.OTHER;
      const qtyKg = item.unit === "TON" ? Number(item.current_stock || 0) * 1000 : Number(item.current_stock || 0);
      bucket.quantityKg += qtyKg;
      total += qtyKg;
    });

    const data = Object.values(buckets).map((b) => ({
      ...b,
      percentage: total > 0 ? Number(((b.quantityKg / total) * 100).toFixed(1)) : 0,
    }));

    return {
      chartData: data.filter((d) => d.quantityKg > 0),
      totalStockKg: total,
    };
  }, [stockList]);

  // Combined Sales trend chart data
  const salesChartData = useMemo(() => {
    if (period === "today") {
      const todayDateStr = new Date().toISOString().split("T")[0];
      const todayInvs = invoices.filter((inv) => {
        if (!inv.created_at) return false;
        return new Date(inv.created_at).toISOString().split("T")[0] === todayDateStr;
      });

      if (todayInvs.length > 0) {
        return todayInvs.map((inv, idx) => ({
          label: inv.invoice_no || `#${idx + 1}`,
          amount: Number(inv.grand_total) || 0,
        }));
      }

      return [
        { label: "09:00", amount: 0 },
        { label: "12:00", amount: Number(plasticStats.todaySales || stats.todaySales) * 0.4 },
        { label: "15:00", amount: Number(plasticStats.todaySales || stats.todaySales) * 0.7 },
        { label: "18:00", amount: Number(plasticStats.todaySales || stats.todaySales) },
      ];
    }

    if (period === "year" && monthlySales.length > 0) {
      return monthlySales.map((m) => ({
        label: m.month,
        amount: m.total,
      }));
    }

    if (dailySales.length > 0) {
      return dailySales.map((d) => ({
        label: d.day,
        amount: d.total,
      }));
    }

    return [];
  }, [period, invoices, dailySales, monthlySales, plasticStats.todaySales, stats.todaySales]);

  // Operational alerts aggregation
  const alertsList = useMemo(() => {
    const list = [];

    // 1. Low Raw Materials
    if (plasticStats.lowStockMaterials && plasticStats.lowStockMaterials.length > 0) {
      list.push({
        id: "low-raw-mat",
        severity: "warning",
        icon: "⚠️",
        title: "Raw Materials Low Stock",
        message: `${plasticStats.lowStockMaterials.length} material(s) below minimum safety stock`,
        link: "/plastic-erp/stock",
        linkText: "Inspect Stock",
      });
    }

    // 2. Low Catalog Products
    if (lowStockProducts.length > 0) {
      list.push({
        id: "low-products",
        severity: "warning",
        icon: "📦",
        title: "Catalog Inventory Low",
        message: `${lowStockProducts.length} finished product(s) have 5 or fewer items remaining`,
        link: "/products",
        linkText: "View Products",
      });
    }

    // 3. Outstanding Receivables
    if (plasticStats.outstandingReceivables > 0) {
      list.push({
        id: "receivables",
        severity: "warning",
        icon: "⚖️",
        title: "Pending Receivables",
        message: `${formatCurrency(plasticStats.outstandingReceivables)} awaiting collection`,
        link: "/plastic-erp/receivables",
        linkText: "Receivables",
      });
    }

    // 4. Overdue Invoices
    if (phase3Analytics?.alerts?.overdueInvoices > 0) {
      list.push({
        id: "overdue-invoices",
        severity: "critical",
        icon: "🚨",
        title: "Overdue Invoices",
        message: `${phase3Analytics.alerts.overdueInvoices} customer invoices are past due date`,
        link: "/invoices/history",
        linkText: "Invoice History",
      });
    }

    // 5. Ready for Dispatch
    if (phase3Analytics?.alerts?.readyDispatches > 0) {
      list.push({
        id: "ready-dispatch",
        severity: "healthy",
        icon: "🚚",
        title: "Dispatches Ready",
        message: `${phase3Analytics.alerts.readyDispatches} finished order(s) staged for dispatch`,
        link: "/plastic-erp/dispatch",
        linkText: "View Dispatch",
      });
    }

    // 6. Quality Checks Pending
    if (plasticStats.qcPending > 0) {
      list.push({
        id: "qc-pending",
        severity: "warning",
        icon: "🔬",
        title: "Quality Inspection Required",
        message: `${plasticStats.qcPending} production batch(es) awaiting QC approval`,
        link: "/plastic-erp/quality",
        linkText: "Inspect QC",
      });
    }

    // 7. Machines in Maintenance
    if (plasticStats.maintenanceMachines > 0) {
      list.push({
        id: "machines-maint",
        severity: "critical",
        icon: "⚙️",
        title: "Machine Maintenance Alert",
        message: `${plasticStats.maintenanceMachines} machine(s) offline for maintenance / breakdown`,
        link: "/plastic-erp/machines",
        linkText: "Check Machines",
      });
    }

    return list;
  }, [plasticStats, lowStockProducts, phase3Analytics, formatCurrency]);

  if (loading) {
    return <LoadingScreen title="Loading Executive Dashboard..." subtitle="Synchronizing enterprise metrics..." />;
  }

  return (
    <div className="sb-dashboard-canvas">
      {/* =========================================================================
          1. EXECUTIVE HEADER
          ========================================================================= */}
      <header className="sb-exec-header">
        <div className="sb-header-meta">
          <div className="sb-header-badge-row">
            <span className="sb-plant-badge">
              <span className="sb-badge-pulse"></span>
              {businessSettings?.business_name || companyInfo?.name || "Kim, Surat Plant Operations"}
            </span>
            <span className="sb-sys-status">
              <span className="sb-status-dot"></span> System Live & Operational
            </span>
          </div>
          <h1 className="sb-exec-title">Executive Dashboard</h1>
          <p className="sb-exec-subtitle">Here&apos;s what&apos;s happening with your business today.</p>
        </div>

        <div className="sb-exec-controls">
          {/* Period Selector Tabs */}
          <div className="sb-period-btn-group" role="group" aria-label="Filter period">
            <button
              type="button"
              className={`sb-period-tab ${period === "today" ? "active" : ""}`}
              onClick={() => handlePeriodChange("today")}
            >
              Today
            </button>
            <button
              type="button"
              className={`sb-period-tab ${period === "month" ? "active" : ""}`}
              onClick={() => handlePeriodChange("month")}
            >
              This Month
            </button>
            <button
              type="button"
              className={`sb-period-tab ${period === "year" ? "active" : ""}`}
              onClick={() => handlePeriodChange("year")}
            >
              This Year
            </button>
            <button
              type="button"
              className={`sb-period-tab ${period === "custom" ? "active" : ""}`}
              onClick={() => handlePeriodChange("custom")}
            >
              Custom Range
            </button>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            className={`sb-btn-refresh ${refreshing ? "spinning" : ""}`}
            onClick={() => loadDashboardData(period, customFromDate, customToDate, true)}
            title="Refresh dashboard metrics"
            disabled={refreshing}
          >
            <span className="sb-btn-icon">🔄</span>
            <span className="sb-btn-text">{refreshing ? "Updating..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* Custom Date Range Filter Form (Displayed when Custom is active) */}
      {period === "custom" && (
        <form className="sb-custom-filter-bar" onSubmit={handleApplyCustomFilter}>
          <div className="sb-filter-field">
            <label htmlFor="custom-from-date">From Date:</label>
            <input
              id="custom-from-date"
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              required
            />
          </div>
          <div className="sb-filter-field">
            <label htmlFor="custom-to-date">To Date:</label>
            <input
              id="custom-to-date"
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="sb-btn-apply-filter">
            Apply Date Filter
          </button>
        </form>
      )}

      {/* Non-blocking error notification */}
      {error && (
        <div className="sb-dashboard-error-banner" role="alert">
          <span className="sb-error-icon">⚠️</span>
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          2. HIGH-VISIBILITY ALERT & ACTION CENTER
          ========================================================================= */}
      <section className="sb-alert-section" aria-label="Operational Alerts">
        <div className="sb-section-header">
          <div className="sb-sec-title-wrap">
            <span className="sb-sec-icon">🔔</span>
            <h2 className="sb-sec-title">Operational Alerts &amp; Attention Items</h2>
          </div>
          <span className="sb-alert-count-pill">
            {alertsList.length} Action{alertsList.length !== 1 ? "s" : ""} Required
          </span>
        </div>

        {alertsList.length === 0 ? (
          <div className="sb-alert-empty-box">
            <span className="sb-empty-icon">✅</span>
            <div>
              <strong>All Operations Nominal</strong>
              <p>Zero critical bottlenecks or low stock warnings detected in current operations.</p>
            </div>
          </div>
        ) : (
          <div className="sb-alerts-grid">
            {alertsList.map((alert) => (
              <div key={alert.id} className={`sb-alert-card severity-${alert.severity}`}>
                <div className="sb-alert-icon-wrap">{alert.icon}</div>
                <div className="sb-alert-content">
                  <strong className="sb-alert-heading">{alert.title}</strong>
                  <p className="sb-alert-msg">{alert.message}</p>
                </div>
                <Link to={alert.link} className="sb-alert-action-btn">
                  {alert.linkText} →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          3. PRIMARY MANAGEMENT KPI GRID (8 Standardized Cards)
          ========================================================================= */}
      <section className="sb-primary-kpi-section" aria-label="Management KPIs">
        <div className="sb-kpi-grid-8">
          {/* 1. Total Sales / Revenue */}
          <div className="sb-kpi-card accent-blue">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Total Revenue</span>
              <span className="sb-kpi-icon-box">💰</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value">
                {formatCurrency(plasticStats.monthSales || stats.totalSales)}
              </strong>
              <span className="sb-kpi-sub">
                Today: {formatCurrency(plasticStats.todaySales || stats.todaySales)}
              </span>
            </div>
            <Link to="/sales-report" className="sb-kpi-footer-link">
              Sales Analytics →
            </Link>
          </div>

          {/* 2. Total Dispatches */}
          <div className="sb-kpi-card accent-blue-alt">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Total Dispatches</span>
              <span className="sb-kpi-icon-box">🚚</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value">
                {plasticStats.monthDispatches || plasticStats.totalDispatches || 0}
              </strong>
              <span className="sb-kpi-sub">
                Today: {plasticStats.todayDispatches || 0} dispatches
              </span>
            </div>
            <Link to="/plastic-erp/dispatch" className="sb-kpi-footer-link">
              Dispatch Register →
            </Link>
          </div>

          {/* 3. Sales Orders */}
          <div className="sb-kpi-card accent-teal">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Sales Orders</span>
              <span className="sb-kpi-icon-box">📋</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value">{plasticStats.salesOrders || 0}</strong>
              <span className="sb-kpi-sub">
                {plasticStats.pendingOrders || 0} pending processing
              </span>
            </div>
            <Link to="/plastic-erp/sales-orders" className="sb-kpi-footer-link">
              Order Pipeline →
            </Link>
          </div>

          {/* 4. Outstanding Receivables */}
          <div className="sb-kpi-card accent-amber">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Outstanding Receivables</span>
              <span className="sb-kpi-icon-box">⚖️</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value text-amber">
                {formatCurrency(plasticStats.outstandingReceivables || 0)}
              </strong>
              <span className="sb-kpi-sub">
                Collected: {formatCurrency(plasticStats.paymentsCollected || 0)}
              </span>
            </div>
            <Link to="/plastic-erp/receivables" className="sb-kpi-footer-link">
              Receivables Aging →
            </Link>
          </div>

          {/* 5. Purchase Spend / Value */}
          <div className="sb-kpi-card accent-blue">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Purchase Value</span>
              <span className="sb-kpi-icon-box">📦</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value">
                {formatCurrency(plasticStats.totalPurchaseAmount || 0)}
              </strong>
              <span className="sb-kpi-sub">
                {(plasticStats.totalPurchasedKg || 0).toLocaleString("en-IN")} KG acquired
              </span>
            </div>
            <Link to="/plastic-erp/purchase-bills" className="sb-kpi-footer-link">
              Purchase Bills →
            </Link>
          </div>

          {/* 6. Production Output */}
          <div className="sb-kpi-card accent-teal">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Production Output</span>
              <span className="sb-kpi-icon-box">🏭</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value">
                {Number(plasticStats.monthProductionKg || plasticStats.todayProductionKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="sb-kpi-sub">
                Efficiency: {plasticStats.efficiencyPercent || 0}%
              </span>
            </div>
            <Link to="/plastic-erp/production" className="sb-kpi-footer-link">
              Production Floor →
            </Link>
          </div>

          {/* 7. Raw Material Stock */}
          <div className="sb-kpi-card accent-navy">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Raw Material Stock</span>
              <span className="sb-kpi-icon-box">♻️</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value">
                {Number(plasticStats.currentStockKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="sb-kpi-sub">
                Value: {formatCurrency(plasticStats.currentStockValue || 0)}
              </span>
            </div>
            <Link to="/plastic-erp/stock" className="sb-kpi-footer-link">
              Inventory Ledger →
            </Link>
          </div>

          {/* 8. Finished Goods Stock */}
          <div className="sb-kpi-card accent-green">
            <div className="sb-kpi-top">
              <span className="sb-kpi-label">Finished Goods Stock</span>
              <span className="sb-kpi-icon-box">✅</span>
            </div>
            <div className="sb-kpi-value-wrap">
              <strong className="sb-kpi-value text-green">
                {Number(plasticStats.finishedGoodsStockKg || plasticStats.finishedGoodsAvailableKg || 0).toLocaleString("en-IN")} KG
              </strong>
              <span className="sb-kpi-sub">
                Sold: {Number(plasticStats.finishedGoodsSoldKg || 0).toLocaleString("en-IN")} KG
              </span>
            </div>
            <Link to="/plastic-erp/wip-fg" className="sb-kpi-footer-link">
              Finished Goods →
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. SALES & FINANCE SECTION WITH PIPELINE
          ========================================================================= */}
      <div className="sb-two-col-grid">
        {/* Sales Performance Area Chart */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Sales Revenue &amp; Billing Trend</h3>
              <span className="sb-panel-subtitle">Revenue volume over selected period</span>
            </div>
            <Link to="/sales-report" className="sb-panel-action-link">
              Detailed Report →
            </Link>
          </div>

          <div className="sb-chart-wrapper">
            {salesChartData.length === 0 ? (
              <div className="sb-empty-chart-state">No sales transactions found for this timeframe.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0879D1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#159A9C" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3EBF2" vertical={false} />
                  <XAxis dataKey="label" stroke="#718096" fontSize={12} tickLine={false} />
                  <YAxis
                    stroke="#718096"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), "Revenue"]}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "8px",
                      borderColor: "#E3EBF2",
                      boxShadow: "0 4px 12px rgba(6, 59, 102, 0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#0879D1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Compact Sales Order Pipeline & Financial Overview */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Sales Pipeline &amp; Liquidity</h3>
              <span className="sb-panel-subtitle">Lifecycle status from order to cash</span>
            </div>
            <Link to="/plastic-erp/receivables" className="sb-panel-action-link">
              Receivables →
            </Link>
          </div>

          {/* Step Pipeline Visualization */}
          <div className="sb-pipeline-stepper">
            <div className="sb-pipe-step">
              <span className="sb-pipe-num">{plasticStats.salesOrders || 0}</span>
              <span className="sb-pipe-label">Orders</span>
              <span className="sb-pipe-arrow">→</span>
            </div>
            <div className="sb-pipe-step">
              <span className="sb-pipe-num">{plasticStats.pendingOrders || 0}</span>
              <span className="sb-pipe-label">Pending</span>
              <span className="sb-pipe-arrow">→</span>
            </div>
            <div className="sb-pipe-step">
              <span className="sb-pipe-num">{plasticStats.monthDispatches || 0}</span>
              <span className="sb-pipe-label">Dispatched</span>
              <span className="sb-pipe-arrow">→</span>
            </div>
            <div className="sb-pipe-step">
              <span className="sb-pipe-num">{stats.totalInvoices || 0}</span>
              <span className="sb-pipe-label">Invoiced</span>
              <span className="sb-pipe-arrow">→</span>
            </div>
            <div className="sb-pipe-step active">
              <span className="sb-pipe-num">{formatCurrency(plasticStats.paymentsCollected || 0)}</span>
              <span className="sb-pipe-label">Collected</span>
            </div>
          </div>

          {/* Financial summary KPI pills */}
          <div className="sb-fin-pills-grid">
            <div className="sb-fin-pill">
              <span className="sb-fin-pill-title">Invoiced Revenue</span>
              <strong className="sb-fin-pill-val">{formatCurrency(stats.totalSales)}</strong>
            </div>
            <div className="sb-fin-pill">
              <span className="sb-fin-pill-title">Cash Collections</span>
              <strong className="sb-fin-pill-val text-green">
                {formatCurrency(plasticStats.paymentsCollected || 0)}
              </strong>
            </div>
            <div className="sb-fin-pill">
              <span className="sb-fin-pill-title">Uncollected Balance</span>
              <strong className="sb-fin-pill-val text-amber">
                {formatCurrency(plasticStats.outstandingReceivables || 0)}
              </strong>
            </div>
            <div className="sb-fin-pill">
              <span className="sb-fin-pill-title">Gross Margin</span>
              <strong className="sb-fin-pill-val text-blue">
                {plasticStats.grossMarginPercent || 0}%
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. PROCUREMENT, INWARD & RAW MATERIAL OVERVIEW
          ========================================================================= */}
      <div className="sb-two-col-grid">
        {/* Procurement Summary & Inward Gate */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Procurement &amp; Inward Operations</h3>
              <span className="sb-panel-subtitle">Vendor supply chain &amp; weighment status</span>
            </div>
            <Link to="/plastic-erp/suppliers" className="sb-panel-action-link">
              Suppliers Master →
            </Link>
          </div>

          <div className="sb-procure-stats-grid">
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">Scrap Vendors</span>
              <strong className="sb-metric-box-val">{plasticStats.totalSuppliers}</strong>
              <span className="sb-metric-box-hint">Active vendors</span>
            </div>
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">Truck Inwards</span>
              <strong className="sb-metric-box-val">{plasticStats.totalTruckInwards}</strong>
              <span className="sb-metric-box-hint">
                {(plasticStats.totalInwardWeight || 0).toLocaleString()} KG net
              </span>
            </div>
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">Purchase Bills</span>
              <strong className="sb-metric-box-val">{plasticStats.totalPurchaseBills}</strong>
              <span className="sb-metric-box-hint">Bills processed</span>
            </div>
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">Purchase Value</span>
              <strong className="sb-metric-box-val text-blue">
                {formatCurrency(plasticStats.totalPurchaseAmount)}
              </strong>
              <span className="sb-metric-box-hint">Materials spend</span>
            </div>
          </div>

          {/* Quick links to procurement workflow */}
          <div className="sb-quick-links-row">
            <Link to="/plastic-erp/truck-inward" className="sb-pill-action">
              🚛 Gate Truck Inward
            </Link>
            <Link to="/plastic-erp/weighment" className="sb-pill-action">
              ⚖️ Gross/Tare Weighment
            </Link>
            <Link to="/plastic-erp/purchase-bills" className="sb-pill-action">
              📄 Purchase Bills
            </Link>
            <Link to="/plastic-erp/purchase-orders" className="sb-pill-action">
              📦 Purchase Orders
            </Link>
          </div>
        </div>

        {/* Low Stock Raw Materials Monitor */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Low Stock Raw Materials</h3>
              <span className="sb-panel-subtitle">Materials below reorder threshold</span>
            </div>
            <Link to="/plastic-erp/stock" className="sb-panel-action-link">
              Full Stock →
            </Link>
          </div>

          {plasticStats.lowStockMaterials.length === 0 ? (
            <div className="sb-empty-table-state">
              <span className="sb-empty-icon">✅</span>
              <p>All raw material inventory levels are healthy and above minimum thresholds.</p>
            </div>
          ) : (
            <div className="sb-table-responsive">
              <table className="sb-mini-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Polymer</th>
                    <th>Current Stock</th>
                    <th>Min Threshold</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plasticStats.lowStockMaterials.slice(0, 5).map((mat) => (
                    <tr key={mat.id}>
                      <td>
                        <strong>{mat.material_name}</strong>
                      </td>
                      <td>
                        <span className="sb-polymer-tag">{mat.plastic_type || "N/A"}</span>
                      </td>
                      <td>
                        <span className="sb-stock-danger">
                          {Number(mat.current_stock || 0).toLocaleString()} {mat.unit || "KG"}
                        </span>
                      </td>
                      <td>
                        {Number(mat.minimum_stock || 0).toLocaleString()} {mat.unit || "KG"}
                      </td>
                      <td>
                        <Link to="/plastic-erp/purchase-requisitions" className="sb-table-link">
                          Requisition →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          6. PRODUCTION, QUALITY & PLANT OPERATIONS
          ========================================================================= */}
      <div className="sb-two-col-grid">
        {/* Plant Production & Efficiency Metrics */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Plant Production &amp; Machine Status</h3>
              <span className="sb-panel-subtitle">Extrusion, washing &amp; pelletizing output</span>
            </div>
            <Link to="/plastic-erp/production" className="sb-panel-action-link">
              Production Batches →
            </Link>
          </div>

          <div className="sb-procure-stats-grid">
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">Batch Efficiency</span>
              <strong className="sb-metric-box-val text-teal">
                {plasticStats.efficiencyPercent || 0}%
              </strong>
              <span className="sb-metric-box-hint">Avg output ratio</span>
            </div>
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">Active Machines</span>
              <strong className="sb-metric-box-val text-blue">
                {plasticStats.activeMachines}
              </strong>
              <span className="sb-metric-box-hint">
                {plasticStats.machineUtilizationPercent || 0}% utilization
              </span>
            </div>
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">WIP Inventory</span>
              <strong className="sb-metric-box-val">
                {Number(plasticStats.currentWipKg || 0).toLocaleString()} KG
              </strong>
              <span className="sb-metric-box-hint">Flakes &amp; Agglo</span>
            </div>
            <div className="sb-metric-box">
              <span className="sb-metric-box-label">Regrind Produced</span>
              <strong className="sb-metric-box-val text-green">
                {Number(plasticStats.regrindGeneratedKg || 0).toLocaleString()} KG
              </strong>
              <span className="sb-metric-box-hint">
                Process loss: {Number(plasticStats.scrapGeneratedKg || 0).toLocaleString()} KG
              </span>
            </div>
          </div>

          {/* Machine and maintenance badges */}
          <div className="sb-status-pills-row">
            <span className="sb-status-pill green">
              ● {plasticStats.activeMachines} Machines Running
            </span>
            <span className={`sb-status-pill ${plasticStats.maintenanceMachines > 0 ? "red" : "gray"}`}>
              ● {plasticStats.maintenanceMachines} Maintenance / Downtime
            </span>
            <span className="sb-status-pill blue">
              ● {plasticStats.activeBatches} Live Production Batches
            </span>
          </div>
        </div>

        {/* Quality Control & Polymer Stock Distribution */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Polymer Stock &amp; Quality Control</h3>
              <span className="sb-panel-subtitle">Polymer distribution (PET, PP, HDPE, LDPE)</span>
            </div>
            <Link to="/plastic-erp/quality" className="sb-panel-action-link">
              Quality Register →
            </Link>
          </div>

          <div className="sb-polymer-flex-wrap">
            <div className="sb-donut-wrapper">
              {polymerDistribution.chartData.length === 0 ? (
                <div className="sb-empty-chart-state">No polymer stock recorded.</div>
              ) : (
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={polymerDistribution.chartData}
                      dataKey="quantityKg"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {polymerDistribution.chartData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${Number(val).toLocaleString()} KG`, name]}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: "8px",
                        borderColor: "#E3EBF2",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="sb-polymer-legend-list">
              {polymerDistribution.chartData.map((poly) => (
                <div key={poly.name} className="sb-poly-legend-item">
                  <span className="sb-poly-dot" style={{ backgroundColor: poly.color }}></span>
                  <span className="sb-poly-name">{poly.name}</span>
                  <strong className="sb-poly-qty">
                    {poly.quantityKg.toLocaleString()} KG
                  </strong>
                  <span className="sb-poly-pct">({poly.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quality summary bar */}
          <div className="sb-qc-summary-bar">
            <div className="sb-qc-stat-item">
              <span className="sb-qc-title">QC Pending:</span>
              <strong className={plasticStats.qcPending > 0 ? "text-amber" : ""}>
                {plasticStats.qcPending} Batches
              </strong>
            </div>
            <div className="sb-qc-stat-item">
              <span className="sb-qc-title">QC Rejected:</span>
              <strong className={plasticStats.qcRejected > 0 ? "text-danger" : ""}>
                {plasticStats.qcRejected} Batches
              </strong>
            </div>
            <div className="sb-qc-stat-item">
              <span className="sb-qc-title">Quality Rating:</span>
              <strong className="text-green">
                {plasticStats.qcRejected === 0 ? "100% Pass" : "Controlled"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          7. WORKFORCE, PAYROLL & EXPENSES (Phase 4 Integration)
          ========================================================================= */}
      <section className="sb-card-panel sb-workforce-section" aria-label="Workforce & Expenses">
        <div className="sb-panel-header">
          <div>
            <h3 className="sb-panel-title">Workforce, Payroll &amp; Plant Expenses</h3>
            <span className="sb-panel-subtitle">Human capital and operating cost monitoring</span>
          </div>
          <Link to="/plastic-erp/employees" className="sb-panel-action-link">
            HR Management →
          </Link>
        </div>

        <div className="sb-workforce-grid">
          <div className="sb-wf-card">
            <div className="sb-wf-icon">👥</div>
            <div className="sb-wf-info">
              <span className="sb-wf-label">Active Workforce</span>
              <strong className="sb-wf-val">{plasticStats.totalEmployees || 0} Staff</strong>
              <span className="sb-wf-sub">
                {plasticStats.todayPresentEmployees || 0} present on shift today
              </span>
            </div>
          </div>

          <div className="sb-wf-card">
            <div className="sb-wf-icon">⏱️</div>
            <div className="sb-wf-info">
              <span className="sb-wf-label">Attendance Rate</span>
              <strong className="sb-wf-val text-green">
                {plasticStats.totalEmployees > 0
                  ? Math.round((plasticStats.todayPresentEmployees / plasticStats.totalEmployees) * 100)
                  : 100}
                %
              </strong>
              <span className="sb-wf-sub">
                {plasticStats.pendingLeavesCount || 0} pending leave request(s)
              </span>
            </div>
          </div>

          <div className="sb-wf-card">
            <div className="sb-wf-icon">💵</div>
            <div className="sb-wf-info">
              <span className="sb-wf-label">Monthly Payroll</span>
              <strong className="sb-wf-val">
                {formatCurrency(plasticStats.monthPayrollAmount || 0)}
              </strong>
              <span className="sb-wf-sub">Disbursed salary obligations</span>
            </div>
          </div>

          <div className="sb-wf-card">
            <div className="sb-wf-icon">📉</div>
            <div className="sb-wf-info">
              <span className="sb-wf-label">Operating Expenses</span>
              <strong className="sb-wf-val text-amber">
                {formatCurrency(plasticStats.monthExpensesAmount || 0)}
              </strong>
              <span className="sb-wf-sub">Power, consumables &amp; transport</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. RECENT ACTIVITY & BUSINESS INTELLIGENCE
          ========================================================================= */}
      <div className="sb-two-col-grid">
        {/* Recent Operational Activity Log */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Recent Operational Activity</h3>
              <span className="sb-panel-subtitle">Real-time enterprise transactions</span>
            </div>

            <div className="sb-tab-toggle-group">
              <button
                type="button"
                className={`sb-tab-toggle ${recentTab === "invoices" ? "active" : ""}`}
                onClick={() => setRecentTab("invoices")}
              >
                Invoices
              </button>
              <button
                type="button"
                className={`sb-tab-toggle ${recentTab === "dispatches" ? "active" : ""}`}
                onClick={() => setRecentTab("dispatches")}
              >
                Dispatches
              </button>
              <button
                type="button"
                className={`sb-tab-toggle ${recentTab === "inwards" ? "active" : ""}`}
                onClick={() => setRecentTab("inwards")}
              >
                Trucks
              </button>
            </div>
          </div>

          <div className="sb-activity-feed">
            {recentTab === "invoices" && (
              <>
                {invoices.length === 0 ? (
                  <div className="sb-empty-table-state">No invoices generated yet.</div>
                ) : (
                  <div className="sb-table-responsive">
                    <table className="sb-mini-table">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Customer</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 5).map((inv) => (
                          <tr key={inv.id}>
                            <td>
                              <Link to={`/invoice/${inv.id}`} className="sb-table-link">
                                {inv.invoice_no}
                              </Link>
                            </td>
                            <td>{inv.customer_name || "Walk-in"}</td>
                            <td>{formatDate(inv.created_at)}</td>
                            <td>
                              <strong>{formatCurrency(inv.grand_total)}</strong>
                            </td>
                            <td>
                              <span
                                className={`sb-status-badge ${
                                  inv.payment_status === "PAID"
                                    ? "badge-success"
                                    : inv.payment_status === "PARTIAL"
                                    ? "badge-warning"
                                    : "badge-danger"
                                }`}
                              >
                                {inv.payment_status || "PENDING"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {recentTab === "dispatches" && (
              <>
                {phase3Analytics?.recentDispatches?.length === 0 ? (
                  <div className="sb-empty-table-state">No recent dispatch records.</div>
                ) : (
                  <div className="sb-table-responsive">
                    <table className="sb-mini-table">
                      <thead>
                        <tr>
                          <th>Dispatch #</th>
                          <th>Customer</th>
                          <th>Date</th>
                          <th>Volume</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(phase3Analytics?.recentDispatches || []).slice(0, 5).map((d) => (
                          <tr key={d.id}>
                            <td>
                              <strong>{d.dispatch_no}</strong>
                            </td>
                            <td>{d.customer_name || "Client"}</td>
                            <td>{formatDate(d.dispatch_date)}</td>
                            <td>{Number(d.total_kg || 0).toLocaleString()} KG</td>
                            <td>
                              <span className="sb-status-badge badge-success">
                                {d.status || "DISPATCHED"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {recentTab === "inwards" && (
              <>
                {truckInwards.length === 0 ? (
                  <div className="sb-empty-table-state">No truck inward records found.</div>
                ) : (
                  <div className="sb-table-responsive">
                    <table className="sb-mini-table">
                      <thead>
                        <tr>
                          <th>Inward #</th>
                          <th>Supplier</th>
                          <th>Vehicle #</th>
                          <th>Net Weight</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {truckInwards.slice(0, 5).map((tr) => (
                          <tr key={tr.id}>
                            <td>
                              <strong>{tr.inward_no}</strong>
                            </td>
                            <td>{tr.supplier_name || "Scrap Vendor"}</td>
                            <td>{tr.vehicle_number}</td>
                            <td>{Number(tr.net_weight || 0).toLocaleString()} KG</td>
                            <td>
                              <span className="sb-status-badge badge-info">
                                {tr.status || "INWARDED"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Top Business Clients / Finished Goods */}
        <div className="sb-card-panel">
          <div className="sb-panel-header">
            <div>
              <h3 className="sb-panel-title">Top Revenue Clients</h3>
              <span className="sb-panel-subtitle">Leading customer accounts by volume</span>
            </div>
            <Link to="/customers" className="sb-panel-action-link">
              All Customers →
            </Link>
          </div>

          {(phase3Analytics?.topCustomers || []).length === 0 ? (
            <div className="sb-empty-table-state">
              <span className="sb-empty-icon">👥</span>
              <p>Top customer data will populate as invoices and dispatches are registered.</p>
            </div>
          ) : (
            <div className="sb-table-responsive">
              <table className="sb-mini-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Invoices</th>
                    <th>Total Revenue</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(phase3Analytics?.topCustomers || []).slice(0, 5).map((cust) => (
                    <tr key={cust.id}>
                      <td>
                        <strong>{cust.name}</strong>
                      </td>
                      <td>{cust.invoices_count || 0}</td>
                      <td>
                        <strong className="text-blue">
                          {formatCurrency(cust.total_revenue || 0)}
                        </strong>
                      </td>
                      <td>
                        <span className={Number(cust.outstanding || 0) > 0 ? "text-amber" : "text-green"}>
                          {formatCurrency(cust.outstanding || 0)}
                        </span>
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
  );
}

export default Dashboard;
