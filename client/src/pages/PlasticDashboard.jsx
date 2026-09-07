import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticDashboard.css";

function PlasticDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plasticStats, setPlasticStats] = useState({
    totalPurchasedKg: 0,
    totalPurchaseAmount: 0,
    currentStockKg: 0,
    currentStockValue: 0,
    totalSuppliers: 0,
    totalTruckInwards: 0,
    totalPurchaseBills: 0,
    lowStockMaterials: [],
  });
  const [plasticPeriod, setPlasticPeriod] = useState("month");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₹");

  const formatCurrency = (amount) => {
    return `${currencySymbol}${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const fetchPlasticStats = async (period = plasticPeriod, fromDate = customFromDate, toDate = customToDate) => {
    try {
      let url = `/dashboard/plastic-stats?period=${period}`;
      if (period === "custom" && fromDate && toDate) {
        url += `&from_date=${fromDate}&to_date=${toDate}`;
      }
      const res = await API.get(url);
      if (res.data?.success && res.data?.stats) {
        setPlasticStats(res.data.stats);
      }
    } catch (err) {
      console.error("Failed to load plastic recycling stats:", err);
      setError("Unable to load plastic recycling metrics.");
    }
  };

  const handlePeriodChange = (newPeriod) => {
    setPlasticPeriod(newPeriod);
    if (newPeriod !== "custom") {
      fetchPlasticStats(newPeriod);
    }
  };

  const handleApplyCustomFilter = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (customFromDate && customToDate) {
      fetchPlasticStats("custom", customFromDate, customToDate);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      const [statsRes, settingsRes] = await Promise.allSettled([
        API.get(`/dashboard/plastic-stats?period=${plasticPeriod}`),
        API.get("/business-settings"),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value.data?.success && statsRes.value.data?.stats) {
        setPlasticStats(statsRes.value.data.stats);
      }

      if (settingsRes.status === "fulfilled" && settingsRes.value.data?.settings?.currency_symbol) {
        setCurrencySymbol(settingsRes.value.data.settings.currency_symbol);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Unable to load initial dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <LoadingScreen title="Loading Plastic ERP..." subtitle="Retrieving scrap plant metrics..." />;
  }

  const quickOperations = [
    {
      title: "Scrap Suppliers",
      icon: "🏢",
      count: `${plasticStats.totalSuppliers} Active`,
      desc: "Manage scrap vendors, mobile contacts, and GST records",
      link: "/plastic-erp/suppliers",
      color: "#0284c7",
    },
    {
      title: "Raw Material Catalog",
      icon: "♻️",
      count: "Polymers & Scrap",
      desc: "PET, PP, HDPE, LDPE grades and minimum stock thresholds",
      link: "/plastic-erp/raw-materials",
      color: "#059669",
    },
    {
      title: "Truck Inward",
      icon: "🚚",
      count: `${plasticStats.totalTruckInwards} Inbound`,
      desc: "Log inbound scrap vehicles, material type, and driver info",
      link: "/plastic-erp/truck-inward",
      color: "#d97706",
    },
    {
      title: "Weighbridge Slips",
      icon: "⚖️",
      count: "Dual Weighment",
      desc: "Gross & tare scale recordings with net weight calculation",
      link: "/plastic-erp/weighment",
      color: "#7c3aed",
    },
    {
      title: "Purchase Bills",
      icon: "📑",
      count: `${plasticStats.totalPurchaseBills} Invoices`,
      desc: "Generate supplier bills with company GST ON/OFF calculation",
      link: "/plastic-erp/purchase-bills",
      color: "#e11d48",
    },
    {
      title: "Scrap Stock & Ledger",
      icon: "📦",
      count: `${Number(plasticStats.currentStockKg || 0).toLocaleString("en-IN")} KG`,
      desc: "Real-time scrap inventory, valuation, and movement audit logs",
      link: "/plastic-erp/stock",
      color: "#0d9488",
    },
  ];

  return (
    <div className="plastic-dashboard-page">
      <PlasticNavbar />

      <main className="plastic-dashboard-container">
        {/* Header Block */}
        <header className="plastic-header-bar">
          <div className="plastic-header-left">
            <span className="plant-tag">🏭 KIM, SURAT PLANT OPERATIONS</span>
            <h1>♻️ Plastic Recycling ERP</h1>
            <p>Complete scrap purchase, weighment, and raw material inventory management system</p>
          </div>

          <div className="plastic-period-controls">
            <div className="period-pill-group">
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "today" ? "active" : ""}`}
                onClick={() => handlePeriodChange("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "month" ? "active" : ""}`}
                onClick={() => handlePeriodChange("month")}
              >
                This Month
              </button>
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "year" ? "active" : ""}`}
                onClick={() => handlePeriodChange("year")}
              >
                This Year
              </button>
              <button
                type="button"
                className={`period-pill ${plasticPeriod === "custom" ? "active" : ""}`}
                onClick={() => handlePeriodChange("custom")}
              >
                Custom Range
              </button>
            </div>

            <button type="button" className="plastic-refresh-btn" onClick={() => fetchPlasticStats()}>
              🔄 Refresh
            </button>
          </div>
        </header>

        {error && <div className="plastic-alert error">{error}</div>}

        {/* Custom Date Selector */}
        {plasticPeriod === "custom" && (
          <form className="plastic-custom-date-box" onSubmit={handleApplyCustomFilter}>
            <div className="custom-input-wrap">
              <label>From Date:</label>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                required
              />
            </div>
            <div className="custom-input-wrap">
              <label>To Date:</label>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="plastic-btn-primary">
              Apply Filter
            </button>
          </form>
        )}

        {/* 6 Executive KPI Metric Cards */}
        <section className="plastic-kpi-grid">
          <div className="plastic-kpi-card accent-green">
            <div className="kpi-icon-wrap">⚖️</div>
            <div className="kpi-details">
              <span className="kpi-label">Raw Material Purchased</span>
              <strong className="kpi-value">{Number(plasticStats.totalPurchasedKg || 0).toLocaleString("en-IN")} KG</strong>
              <span className="kpi-subtext">Total volume inward</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-blue">
            <div className="kpi-icon-wrap">💵</div>
            <div className="kpi-details">
              <span className="kpi-label">Total Purchase Spend</span>
              <strong className="kpi-value">{formatCurrency(plasticStats.totalPurchaseAmount)}</strong>
              <span className="kpi-subtext">Cumulative scrap purchases</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-teal">
            <div className="kpi-icon-wrap">🏭</div>
            <div className="kpi-details">
              <span className="kpi-label">Current Scrap Stock</span>
              <strong className="kpi-value">{Number(plasticStats.currentStockKg || 0).toLocaleString("en-IN")} KG</strong>
              <span className="kpi-subtext val">Valuation: {formatCurrency(plasticStats.currentStockValue)}</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-amber">
            <div className="kpi-icon-wrap">🏢</div>
            <div className="kpi-details">
              <span className="kpi-label">Active Suppliers</span>
              <strong className="kpi-value">{plasticStats.totalSuppliers || 0}</strong>
              <span className="kpi-subtext">Registered scrap vendors</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-purple">
            <div className="kpi-icon-wrap">🚚</div>
            <div className="kpi-details">
              <span className="kpi-label">Truck Inwards</span>
              <strong className="kpi-value">{plasticStats.totalTruckInwards || 0}</strong>
              <span className="kpi-subtext">Vehicles logged</span>
            </div>
          </div>

          <div className="plastic-kpi-card accent-rose">
            <div className="kpi-icon-wrap">📑</div>
            <div className="kpi-details">
              <span className="kpi-label">Purchase Bills</span>
              <strong className="kpi-value">{plasticStats.totalPurchaseBills || 0}</strong>
              <span className="kpi-subtext">Billed transactions</span>
            </div>
          </div>
        </section>

        {/* Quick Operations Launch Grid */}
        <section className="plastic-section-block">
          <div className="section-title-wrap">
            <h2>Plant Operations & Modules</h2>
            <p>Access scrap inward slips, weighbridge records, and purchase billing workflows</p>
          </div>

          <div className="operations-grid">
            {quickOperations.map((op) => (
              <Link to={op.link} key={op.title} className="operation-card">
                <div className="op-card-top">
                  <span className="op-icon">{op.icon}</span>
                  <span className="op-badge" style={{ backgroundColor: `${op.color}15`, color: op.color }}>
                    {op.count}
                  </span>
                </div>
                <h3>{op.title}</h3>
                <p>{op.desc}</p>
                <span className="op-link-text" style={{ color: op.color }}>
                  Manage {op.title} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Low Stock Scrap Raw Materials Alert Card */}
        <section className="plastic-section-block">
          <div className="section-title-wrap">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2>Scrap Stock Health & Threshold Alerts</h2>
              <span className="alert-count-pill">
                {Array.isArray(plasticStats.lowStockMaterials) ? plasticStats.lowStockMaterials.length : 0}
              </span>
            </div>
            <p>Materials currently at or below minimum operating safety stock</p>
          </div>

          {Array.isArray(plasticStats.lowStockMaterials) && plasticStats.lowStockMaterials.length > 0 ? (
            <div className="low-stock-grid">
              {plasticStats.lowStockMaterials.map((mat) => (
                <div className="low-stock-box" key={mat.id}>
                  <div className="low-stock-info">
                    <span className="polymer-tag">{mat.plastic_type || "SCRAP"}</span>
                    <h4>{mat.material_name}</h4>
                    <p>Safety Min: {mat.minimum_stock} {mat.unit || "KG"}</p>
                  </div>
                  <div className="low-stock-status">
                    <span className="stock-qty-danger">
                      {mat.current_stock} {mat.unit || "KG"}
                    </span>
                    <Link to="/plastic-erp/stock" className="stock-action-btn">
                      Inspect Stock →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="plastic-empty-card">
              <span className="empty-icon">✅</span>
              <h3>All Scrap Polymers Sufficiently Stocked</h3>
              <p>No raw material grades are currently below their minimum threshold at the Kim plant.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default PlasticDashboard;
