import { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Core metrics
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalProducts: 0,
    totalInvoices: 0,
    totalSales: 0,
    todaySales: 0,
  });

  const [invoices, setInvoices] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);

  // Plastic ERP metrics
  const [plasticStats, setPlasticStats] = useState({
    totalPurchasedKg: 0,
    totalPurchaseAmount: 0,
    currentStockKg: 0,
    currentStockValue: 0,
    totalSuppliers: 0,
    totalTruckInwards: 0,
    totalPurchaseBills: 0,
    lowStockMaterials: [],
    todayProductionKg: 0,
    monthProductionKg: 0,
    activeBatches: 0,
    currentWipKg: 0,
    finishedGoodsStockKg: 0,
    activeMachines: 0,
    qcPending: 0,
    regrindGeneratedKg: 0,
  });

  // UI State
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [salesPeriod, setSalesPeriod] = useState("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // User & Company State
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("admin");
      return saved ? JSON.parse(saved) : { name: "Het Nariya", email: "admin@smartbilling.com" };
    } catch {
      return { name: "Het Nariya", email: "admin@smartbilling.com" };
    }
  });

  const [trialInfo, setTrialInfo] = useState(() => {
    try {
      const saved = localStorage.getItem("company");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const formatCurrency = (amount) => {
    return `${currencySymbol}${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const [
        statsRes,
        lowStockRes,
        settingsRes,
        meRes,
        plasticRes,
        salesRepRes,
        invoicesRes,
      ] = await Promise.allSettled([
        API.get("/dashboard"),
        API.get("/dashboard/low-stock"),
        API.get("/business-settings"),
        API.get("/auth/me"),
        API.get("/dashboard/plastic-stats?period=month"),
        API.get("/dashboard/sales-report"),
        API.get("/invoices"),
      ]);

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

      if (lowStockRes.status === "fulfilled" && Array.isArray(lowStockRes.value.data?.products)) {
        setLowStockProducts(lowStockRes.value.data.products);
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value.data?.settings?.currency_symbol) {
        setCurrencySymbol(settingsRes.value.data.settings.currency_symbol);
      }

      if (meRes.status === "fulfilled" && meRes.value.data?.data) {
        const { user, company } = meRes.value.data.data;
        if (user) {
          setUserProfile(user);
          localStorage.setItem("admin", JSON.stringify(user));
        }
        if (company) {
          setTrialInfo(company);
          localStorage.setItem("company", JSON.stringify(company));
        }
      }

      if (plasticRes.status === "fulfilled" && plasticRes.value.data?.success && plasticRes.value.data?.stats) {
        setPlasticStats(plasticRes.value.data.stats);
      }

      if (salesRepRes.status === "fulfilled" && salesRepRes.value.data?.report) {
        const rep = salesRepRes.value.data.report;
        setDailySales(Array.isArray(rep.dailySales) ? rep.dailySales : []);
        setMonthlySales(Array.isArray(rep.monthlySales) ? rep.monthlySales : []);
      }

      if (invoicesRes.status === "fulfilled" && Array.isArray(invoicesRes.value.data?.invoices)) {
        setInvoices(invoicesRes.value.data.invoices);
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Unable to load latest dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    localStorage.removeItem("company");
    navigate("/");
  };

  // Aggregated Top Customers from real invoice data
  const topCustomers = useMemo(() => {
    if (!Array.isArray(invoices) || invoices.length === 0) return [];
    const customerMap = {};
    for (const inv of invoices) {
      const name = inv.customer_name || "Walk-in Customer";
      if (!customerMap[name]) {
        customerMap[name] = {
          name,
          mobile: inv.customer_mobile || "",
          invoicesCount: 0,
          totalSpend: 0,
        };
      }
      customerMap[name].invoicesCount += 1;
      customerMap[name].totalSpend += Number(inv.grand_total) || 0;
    }
    return Object.values(customerMap)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);
  }, [invoices]);

  // Recent invoices list (filtered if search query is present)
  const filteredInvoices = useMemo(() => {
    if (!Array.isArray(invoices)) return [];
    if (!searchQuery.trim()) return invoices.slice(0, 6);

    const q = searchQuery.toLowerCase().trim();
    return invoices
      .filter(
        (inv) =>
          inv.invoice_no?.toLowerCase().includes(q) ||
          inv.customer_name?.toLowerCase().includes(q) ||
          String(inv.grand_total).includes(q)
      )
      .slice(0, 8);
  }, [invoices, searchQuery]);

  // Chart data for Sales Overview Line/Area Chart
  const chartData = useMemo(() => {
    if (salesPeriod === "today") {
      const todayDateStr = new Date().toISOString().split("T")[0];
      const todayInvoices = invoices.filter((inv) => {
        if (!inv.created_at) return false;
        const d = new Date(inv.created_at).toISOString().split("T")[0];
        return d === todayDateStr;
      });

      if (todayInvoices.length > 0) {
        return todayInvoices.map((inv, idx) => ({
          label: inv.invoice_no || `Invoice #${idx + 1}`,
          amount: Number(inv.grand_total) || 0,
        }));
      }

      // Default today trend markers
      return [
        { label: "09:00", amount: 0 },
        { label: "12:00", amount: Number(stats.todaySales) * 0.4 },
        { label: "15:00", amount: Number(stats.todaySales) * 0.7 },
        { label: "18:00", amount: Number(stats.todaySales) },
      ];
    } else if (salesPeriod === "month") {
      if (dailySales.length > 0) {
        return [...dailySales]
          .reverse()
          .slice(-10)
          .map((d) => {
            const dt = new Date(d.date);
            const label = isNaN(dt.getTime())
              ? d.date
              : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
            return {
              label,
              amount: Number(d.total) || 0,
            };
          });
      }
      return [
        { label: "Week 1", amount: Number(stats.totalSales) * 0.2 },
        { label: "Week 2", amount: Number(stats.totalSales) * 0.45 },
        { label: "Week 3", amount: Number(stats.totalSales) * 0.75 },
        { label: "Week 4", amount: Number(stats.totalSales) },
      ];
    } else {
      // year
      if (monthlySales.length > 0) {
        return [...monthlySales].reverse().map((m) => {
          const parts = m.month.split("-");
          const monthIdx = parseInt(parts[1], 10) - 1;
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          return {
            label: monthNames[monthIdx] || m.month,
            amount: Number(m.total) || 0,
          };
        });
      }
      return [
        { label: "Q1", amount: Number(stats.totalSales) * 0.2 },
        { label: "Q2", amount: Number(stats.totalSales) * 0.5 },
        { label: "Q3", amount: Number(stats.totalSales) * 0.8 },
        { label: "Q4", amount: Number(stats.totalSales) },
      ];
    }
  }, [salesPeriod, invoices, dailySales, monthlySales, stats]);

  // Donut chart status breakdown
  const pieData = useMemo(() => {
    const totalCount = stats.totalInvoices || invoices.length || 0;
    if (totalCount === 0) {
      return [{ name: "No Invoices", value: 1, color: "#E7EAF0" }];
    }
    return [
      { name: "Paid", value: totalCount, color: "#10B981" },
      { name: "Pending", value: 0, color: "#F59E0B" },
      { name: "Overdue", value: 0, color: "#EF4444" },
    ];
  }, [stats.totalInvoices, invoices]);

  const firstName = userProfile?.name ? userProfile.name.split(" ")[0] : "Het";
  const userInitials = userProfile?.name
    ? userProfile.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "HN";

  if (loading) {
    return <LoadingScreen title="Loading SmartBilling Dashboard..." subtitle="Preparing business overview..." />;
  }

  return (
    <div className="sb-app-layout">
      {/* ---------------------------------------------------- */}
      {/* 1. DESKTOP SIDEBAR & MOBILE DRAWER                   */}
      {/* ---------------------------------------------------- */}
      <aside className={`sb-sidebar ${mobileMenuOpen ? "drawer-open" : ""}`}>
        <div className="sb-sidebar-header">
          <div className="sb-brand-block">
            <div className="sb-logo-icon">⚡</div>
            <div className="sb-brand-text">
              <span className="sb-brand-name">SmartBilling</span>
              <span className="sb-brand-tagline">Billing & ERP Suite</span>
            </div>
          </div>
          {mobileMenuOpen && (
            <button
              type="button"
              className="sb-drawer-close"
              onClick={() => setMobileMenuOpen(false)}
            >
              ✕
            </button>
          )}
        </div>

        <nav className="sb-nav-menu">
          <div className="sb-nav-group-label">MAIN NAVIGATION</div>

          <Link
            to="/dashboard"
            className={`sb-nav-item ${location.pathname === "/dashboard" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📊</span>
            <span className="sb-nav-text">Dashboard</span>
            <span className="sb-nav-indicator"></span>
          </Link>

          <Link
            to="/products"
            className={`sb-nav-item ${location.pathname === "/products" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📦</span>
            <span className="sb-nav-text">Products</span>
          </Link>

          <Link
            to="/customers"
            className={`sb-nav-item ${location.pathname === "/customers" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">👥</span>
            <span className="sb-nav-text">Customers</span>
          </Link>

          <Link
            to="/invoices/create"
            className={`sb-nav-item ${location.pathname === "/invoices/create" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">🧾</span>
            <span className="sb-nav-text">New Invoice</span>
          </Link>

          <Link
            to="/invoices/history"
            className={`sb-nav-item ${location.pathname === "/invoices/history" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📋</span>
            <span className="sb-nav-text">Invoice History</span>
          </Link>

          <Link
            to="/sales-report"
            className={`sb-nav-item ${location.pathname === "/sales-report" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📈</span>
            <span className="sb-nav-text">Sales Report</span>
          </Link>

          <Link
            to="/settings"
            className={`sb-nav-item ${location.pathname === "/settings" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">⚙️</span>
            <span className="sb-nav-text">Business Settings</span>
          </Link>

          <div className="sb-nav-group-label" style={{ marginTop: "16px" }}>SPECIALIZED MODULES</div>

          <Link
            to="/plastic-erp"
            className="sb-nav-item sb-plastic-pill"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">♻️</span>
            <span className="sb-nav-text">Plastic ERP</span>
            <span className="sb-pill-badge">Kim Plant</span>
          </Link>
        </nav>

        <div className="sb-sidebar-footer">
          <div className="sb-user-card">
            <div className="sb-user-avatar-mini">{userInitials}</div>
            <div className="sb-user-card-info">
              <span className="sb-user-card-name">{userProfile.name}</span>
              <span className="sb-user-card-role">Administrator</span>
            </div>
          </div>
          <button type="button" className="sb-sidebar-logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="sb-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN CONTENT AREA & TOP HEADER                     */}
      {/* ---------------------------------------------------- */}
      <div className="sb-main-wrapper">
        {/* Top Header */}
        <header className="sb-top-header">
          <div className="sb-header-left">
            <button
              type="button"
              className="sb-hamburger-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation"
            >
              ☰
            </button>
            <div className="sb-search-wrap">
              <span className="sb-search-icon">🔍</span>
              <input
                type="text"
                className="sb-search-input"
                placeholder="Search products, customers, invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sb-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="sb-header-right">
            <div className="sb-company-badge">
              <span className="sb-company-icon">🏢</span>
              <span className="sb-company-name">
                {trialInfo?.name || "SmartBilling Main"}
              </span>
            </div>

            <div className="sb-header-bell" title="System Notifications">
              <span>🔔</span>
              <span className="sb-bell-dot"></span>
            </div>

            <div
              className="sb-profile-menu-container"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            >
              <div className="sb-avatar-circle">{userInitials}</div>
              <div className="sb-profile-text">
                <span className="sb-profile-name">{userProfile.name}</span>
                <span className="sb-profile-role">Admin</span>
              </div>
              <span className="sb-dropdown-arrow">▾</span>

              {profileDropdownOpen && (
                <div className="sb-profile-dropdown">
                  <div className="dropdown-user-header">
                    <strong>{userProfile.name}</strong>
                    <span>{userProfile.email}</span>
                  </div>
                  <hr className="dropdown-divider" />
                  <Link to="/settings" className="dropdown-item">
                    ⚙️ Settings
                  </Link>
                  <Link to="/plastic-erp" className="dropdown-item">
                    ♻️ Plastic Recycling ERP
                  </Link>
                  <hr className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-item text-danger"
                    onClick={handleLogout}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Dashboard Canvas */}
        <main className="sb-dashboard-canvas">
          {/* Welcome & Action Bar */}
          <div className="sb-welcome-bar">
            <div>
              <h1 className="sb-welcome-title">
                {getGreeting()}, {firstName}! 👋
              </h1>
              <p className="sb-welcome-subtitle">
                Here&apos;s what&apos;s happening with your business today.
              </p>
            </div>

            <div className="sb-welcome-right">
              <div className="sb-date-pill">
                <span>📅</span>
                <span>
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              <button
                type="button"
                className="sb-btn-refresh"
                onClick={() => loadDashboardData(true)}
                disabled={refreshing}
              >
                <span className={refreshing ? "spin-icon" : ""}>🔄</span>
                <span>{refreshing ? "Updating..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="sb-alert sb-alert-danger">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")}>
                ✕
              </button>
            </div>
          )}

          {/* Trial / Demo Banner */}
          {trialInfo && (trialInfo.is_demo === 1 || trialInfo.id === 1) && (
            <div className="sb-environment-banner banner-demo">
              <div className="banner-left">
                <span className="banner-icon">🚀</span>
                <div>
                  <strong>Demo Company Environment</strong>
                  <span>
                    You are exploring SmartBilling in a permanent, isolated demonstration account.
                  </span>
                </div>
              </div>
              <span className="banner-pill pill-demo">Permanent Demo</span>
            </div>
          )}

          {trialInfo &&
            trialInfo.subscription_status === "trial" &&
            trialInfo.is_demo !== 1 &&
            trialInfo.id !== 1 && (
              <div className="sb-environment-banner banner-trial">
                <div className="banner-left">
                  <span className="banner-icon">⚡</span>
                  <div>
                    <strong>3-Day Free Trial Active</strong>
                    <span>
                      {trialInfo.trial_end_at
                        ? `Full access expires on ${new Date(trialInfo.trial_end_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Enjoy unlimited access during your trial period"}
                    </span>
                  </div>
                </div>
                <span className="banner-pill pill-trial">Trial Mode</span>
              </div>
            )}

          {/* ---------------------------------------------------- */}
          {/* 3. SIX PREMIUM KPI METRIC CARDS                      */}
          {/* ---------------------------------------------------- */}
          <section className="sb-kpi-grid">
            {/* Card 1: Total Sales */}
            <div className="sb-kpi-card accent-mint">
              <div className="kpi-top">
                <span className="kpi-icon-wrap">💰</span>
                <span className="kpi-tag-pill tag-mint">Revenue</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Total Sales</span>
                <strong className="kpi-number">{formatCurrency(stats.totalSales)}</strong>
                <span className="kpi-subtext">Cumulative settled revenue</span>
              </div>
            </div>

            {/* Card 2: Today's Sales */}
            <div className="sb-kpi-card accent-blue">
              <div className="kpi-top">
                <span className="kpi-icon-wrap">📈</span>
                <span className="kpi-tag-pill tag-blue">Today</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Today&apos;s Sales</span>
                <strong className="kpi-number">{formatCurrency(stats.todaySales)}</strong>
                <span className="kpi-subtext">Earned in today&apos;s billing</span>
              </div>
            </div>

            {/* Card 3: Invoices */}
            <div className="sb-kpi-card accent-purple">
              <div className="kpi-top">
                <span className="kpi-icon-wrap">🧾</span>
                <span className="kpi-tag-pill tag-purple">Billed</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Total Invoices</span>
                <strong className="kpi-number">{stats.totalInvoices}</strong>
                <span className="kpi-subtext">Generated client invoices</span>
              </div>
            </div>

            {/* Card 4: Customers */}
            <div className="sb-kpi-card accent-orange">
              <div className="kpi-top">
                <span className="kpi-icon-wrap">👥</span>
                <span className="kpi-tag-pill tag-orange">Clients</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Total Customers</span>
                <strong className="kpi-number">{stats.totalCustomers}</strong>
                <span className="kpi-subtext">Registered customer profiles</span>
              </div>
            </div>

            {/* Card 5: Products */}
            <div className="sb-kpi-card accent-pink">
              <div className="kpi-top">
                <span className="kpi-icon-wrap">📦</span>
                <span className="kpi-tag-pill tag-pink">Inventory</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Total Products</span>
                <strong className="kpi-number">{stats.totalProducts}</strong>
                <span className="kpi-subtext">Active catalog items</span>
              </div>
            </div>

            {/* Card 6: Outstanding */}
            <div className="sb-kpi-card accent-teal">
              <div className="kpi-top">
                <span className="kpi-icon-wrap">⏳</span>
                <span className="kpi-tag-pill tag-teal">Settlement</span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Outstanding</span>
                <strong className="kpi-number">{formatCurrency(0)}</strong>
                <span className="kpi-subtext">All client bills up to date</span>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* 4. SALES ANALYTICS (Overview Chart + Donut Summary)  */}
          {/* ---------------------------------------------------- */}
          <section className="sb-analytics-row">
            {/* Sales Overview Chart */}
            <div className="sb-card sb-chart-card">
              <div className="sb-card-header">
                <div>
                  <h2 className="sb-card-title">📈 Sales Overview</h2>
                  <p className="sb-card-subtitle">
                    {salesPeriod === "today"
                      ? "Hourly revenue trajectory for today"
                      : salesPeriod === "month"
                      ? "Daily billed sales for this month"
                      : "Monthly sales revenue trend for this year"}
                  </p>
                </div>
                <div className="sb-period-tabs">
                  <button
                    type="button"
                    className={`sb-tab-btn ${salesPeriod === "today" ? "active" : ""}`}
                    onClick={() => setSalesPeriod("today")}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`sb-tab-btn ${salesPeriod === "month" ? "active" : ""}`}
                    onClick={() => setSalesPeriod("month")}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    className={`sb-tab-btn ${salesPeriod === "year" ? "active" : ""}`}
                    onClick={() => setSalesPeriod("year")}
                  >
                    This Year
                  </button>
                </div>
              </div>

              <div className="sb-chart-area">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "#64748B" }}
                      axisLine={{ stroke: "#E2E8F0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748B" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(val) => [formatCurrency(val), "Sales Revenue"]}
                      contentStyle={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        fontSize: "13px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#4F46E5"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#salesGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales Summary Donut */}
            <div className="sb-card sb-donut-card">
              <div className="sb-card-header">
                <div>
                  <h2 className="sb-card-title">🍩 Sales Summary</h2>
                  <p className="sb-card-subtitle">Settlement and collection breakdown</p>
                </div>
              </div>

              <div className="sb-donut-wrapper">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name) => [`${val} invoices`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center-text">
                  <span className="donut-center-num">{stats.totalInvoices}</span>
                  <span className="donut-center-sub">Invoices</span>
                </div>
              </div>

              <div className="sb-donut-legend">
                <div className="legend-row">
                  <div className="legend-label">
                    <span className="legend-dot dot-paid"></span>
                    <span>Paid</span>
                  </div>
                  <strong>{stats.totalInvoices} (100%)</strong>
                </div>
                <div className="legend-row">
                  <div className="legend-label">
                    <span className="legend-dot dot-pending"></span>
                    <span>Pending</span>
                  </div>
                  <strong className="text-muted">0 (0%)</strong>
                </div>
                <div className="legend-row">
                  <div className="legend-label">
                    <span className="legend-dot dot-overdue"></span>
                    <span>Overdue</span>
                  </div>
                  <strong className="text-muted">0 (0%)</strong>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* 5. RECENT INVOICES SECTION                           */}
          {/* ---------------------------------------------------- */}
          <section className="sb-card sb-table-card">
            <div className="sb-card-header">
              <div>
                <h2 className="sb-card-title">🧾 Recent Invoices</h2>
                <p className="sb-card-subtitle">
                  {searchQuery ? `Showing matching invoices for "${searchQuery}"` : "Latest generated client invoices"}
                </p>
              </div>
              <Link to="/invoices/history" className="sb-view-all-link">
                View All →
              </Link>
            </div>

            <div className="sb-table-responsive">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        No invoices found. Click &quot;+ New Invoice&quot; to generate an invoice.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>
                          <Link to={`/invoice/${inv.id}`} className="inv-code-link">
                            <code>{inv.invoice_no}</code>
                          </Link>
                        </td>
                        <td>
                          <div className="cell-primary">{inv.customer_name || "Walk-in Customer"}</div>
                          {inv.customer_mobile && (
                            <div className="cell-secondary">{inv.customer_mobile}</div>
                          )}
                        </td>
                        <td className="cell-secondary">{formatDate(inv.created_at)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(inv.grand_total)}
                        </td>
                        <td>
                          <span className="sb-status-pill status-paid">Paid</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <Link to={`/invoice/${inv.id}`} className="btn-preview-sm">
                            Preview →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* 6. LOWER DUAL GRID: LOW STOCK & TOP CUSTOMERS        */}
          {/* ---------------------------------------------------- */}
          <section className="sb-dual-grid">
            {/* Low Stock Products Card */}
            <div className="sb-card">
              <div className="sb-card-header">
                <div>
                  <h2 className="sb-card-title">⚠️ Low Stock Products</h2>
                  <p className="sb-card-subtitle">Products with stock of 5 or less</p>
                </div>
                <span className="sb-count-badge">
                  {Array.isArray(lowStockProducts) ? lowStockProducts.length : 0}
                </span>
              </div>

              <div className="sb-card-list">
                {Array.isArray(lowStockProducts) && lowStockProducts.length > 0 ? (
                  lowStockProducts.map((prod) => (
                    <div className="sb-list-item" key={prod.id}>
                      <div className="list-item-left">
                        <div className="item-icon-box">📦</div>
                        <div>
                          <h4 className="item-title">{prod.name || "Unnamed Product"}</h4>
                          <span className="item-sub">Price: {formatCurrency(prod.price)}</span>
                        </div>
                      </div>
                      <div className="list-item-right">
                        <span
                          className={`stock-badge ${
                            Number(prod.stock) <= 2 ? "badge-danger" : "badge-warning"
                          }`}
                        >
                          {Number(prod.stock) || 0} left
                        </span>
                        <Link to="/products" className="item-link">
                          Adjust →
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sb-empty-state">
                    <span className="empty-state-icon">✅</span>
                    <h4>All products have sufficient stock.</h4>
                    <p>No inventory items are currently below minimum safety thresholds.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Customers Card */}
            <div className="sb-card">
              <div className="sb-card-header">
                <div>
                  <h2 className="sb-card-title">👥 Top Customers</h2>
                  <p className="sb-card-subtitle">Key client volume and billing spend</p>
                </div>
                <Link to="/customers" className="sb-view-all-link">
                  View All →
                </Link>
              </div>

              <div className="sb-card-list">
                {topCustomers.length > 0 ? (
                  topCustomers.map((cust, idx) => (
                    <div className="sb-list-item" key={cust.name}>
                      <div className="list-item-left">
                        <span className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</span>
                        <div>
                          <h4 className="item-title">{cust.name}</h4>
                          <span className="item-sub">
                            {cust.invoicesCount} {cust.invoicesCount === 1 ? "Invoice" : "Invoices"}
                          </span>
                        </div>
                      </div>
                      <div className="list-item-right">
                        <strong className="item-spend">{formatCurrency(cust.totalSpend)}</strong>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sb-empty-state">
                    <span className="empty-state-icon">👥</span>
                    <h4>No Customers Registered</h4>
                    <p>Add customers to track repeat orders and cumulative spending.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* 7. QUICK ACTIONS                                     */}
          {/* ---------------------------------------------------- */}
          <section className="sb-quick-actions-card">
            <div className="quick-actions-header">
              <h3>⚡ Quick Actions</h3>
              <p>Jump directly into frequent billing and management workflows</p>
            </div>
            <div className="quick-actions-buttons">
              <Link to="/invoices/create" className="btn-qa btn-qa-primary">
                <span>+</span> New Invoice
              </Link>
              <Link to="/customers" className="btn-qa btn-qa-pastel">
                <span>👥</span> Add Customer
              </Link>
              <Link to="/products" className="btn-qa btn-qa-pastel">
                <span>📦</span> Add Product
              </Link>
              <Link to="/sales-report" className="btn-qa btn-qa-pastel">
                <span>📊</span> View Reports
              </Link>
              <Link to="/plastic-erp" className="btn-qa btn-qa-emerald">
                <span>♻️</span> Open Plastic ERP
              </Link>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* 8. COMPACT PLASTIC RECYCLING ERP CARD                */}
          {/* ---------------------------------------------------- */}
          <section className="sb-card sb-plastic-card">
            <div className="plastic-card-top">
              <div className="plastic-title-wrap">
                <div className="plastic-meta-tag">♻️ PLASTIC RECYCLING ERP</div>
                <h2 className="plastic-headline">Plastic Recycling ERP</h2>
                <p className="plastic-subheadline">
                  Manage your plastic recycling operations (Kim, Surat Plant)
                </p>
              </div>
              <Link to="/plastic-erp" className="btn-plastic-cta">
                Open Plastic ERP →
              </Link>
            </div>

            <div className="plastic-compact-grid">
              <div className="plastic-metric-box">
                <span className="p-label">Raw Material Stock</span>
                <strong className="p-val">
                  {Number(plasticStats.currentStockKg || 0).toLocaleString("en-IN")} KG
                </strong>
                <span className="p-sub">Val: {formatCurrency(plasticStats.currentStockValue)}</span>
              </div>

              <div className="plastic-metric-box">
                <span className="p-label">Finished Goods</span>
                <strong className="p-val text-indigo">
                  {Number(plasticStats.finishedGoodsStockKg || 0).toLocaleString("en-IN")} KG
                </strong>
                <span className="p-sub">Pellets in warehouse</span>
              </div>

              <div className="plastic-metric-box">
                <span className="p-label">WIP Inventory</span>
                <strong className="p-val text-cyan">
                  {Number(plasticStats.currentWipKg || 0).toLocaleString("en-IN")} KG
                </strong>
                <span className="p-sub">Flakes in process</span>
              </div>

              <div className="plastic-metric-box">
                <span className="p-label">Active Batches</span>
                <strong className="p-val text-green">
                  {plasticStats.activeBatches || 0} Running
                </strong>
                <span className="p-sub">Shop floor extrusion</span>
              </div>

              <div className="plastic-metric-box">
                <span className="p-label">Plant Machines</span>
                <strong className="p-val text-purple">
                  {plasticStats.activeMachines || 0} Lines
                </strong>
                <span className="p-sub">Active crushers & lines</span>
              </div>

              <div className="plastic-metric-box">
                <span className="p-label">Quality Status</span>
                <strong className="p-val text-pink">
                  {plasticStats.qcPending || 0} Pending
                </strong>
                <span className="p-sub">Lab testing & checks</span>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- */}
          {/* 9. CLEAN FOOTER                                      */}
          {/* ---------------------------------------------------- */}
          <footer className="sb-footer">
            <span className="footer-copyright">
              © 2026 SmartBilling. All rights reserved.
            </span>
            <span className="footer-tagline">
              Simple Billing. Big Possibilities. 🚀
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
