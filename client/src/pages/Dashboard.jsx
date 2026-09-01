import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalProducts: 0,
    totalInvoices: 0,
    totalSales: 0,
    todaySales: 0,
  });

  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatCurrency = (amount) => {
    return `${currencySymbol}${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [statsResponse, lowStockResponse, settingsResponse] =
        await Promise.allSettled([
          API.get("/dashboard"),
          API.get("/dashboard/low-stock"),
          API.get("/business-settings"),
        ]);

      if (
        statsResponse.status === "fulfilled" &&
        statsResponse.value.data?.success &&
        statsResponse.value.data?.stats
      ) {
        const dashboardStats = statsResponse.value.data.stats;

        setStats({
          totalCustomers: Number(dashboardStats.totalCustomers) || 0,
          totalProducts: Number(dashboardStats.totalProducts) || 0,
          totalInvoices: Number(dashboardStats.totalInvoices) || 0,
          totalSales: Number(dashboardStats.totalSales) || 0,
          todaySales: Number(dashboardStats.todaySales) || 0,
        });
      }

      if (
        lowStockResponse.status === "fulfilled" &&
        lowStockResponse.value.data &&
        Array.isArray(lowStockResponse.value.data.products)
      ) {
        setLowStockProducts(lowStockResponse.value.data.products);
      } else {
        setLowStockProducts([]);
      }

      if (
        settingsResponse.status === "fulfilled" &&
        settingsResponse.value.data?.settings?.currency_symbol
      ) {
        setCurrencySymbol(settingsResponse.value.data.settings.currency_symbol);
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);

      setError("Unable to load dashboard data.");
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");

    navigate("/");
  };

  if (loading) {
    return <LoadingScreen title="Loading Dashboard..." subtitle="Please wait..." />;
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h2>Smart Billing</h2>
        </div>

        <div className="nav-links">
          <Link to="/dashboard" className="nav-link active">
            🏠 Dashboard
          </Link>

          <Link to="/products" className="nav-link">
            📦 Products
          </Link>

          <Link to="/customers" className="nav-link">
            👥 Customers
          </Link>

          <Link to="/invoices/create" className="nav-link">
            🧾 Invoices
          </Link>

          <Link to="/invoices/history" className="nav-link">
            📋 Invoice History
          </Link>

          <Link to="/sales-report" className="nav-link">
            📊 Sales Report
          </Link>

          <Link to="/settings" className="nav-link">
            ⚙️ Business Settings
          </Link>

          <button type="button" className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>

          <p>Welcome back! Here's your business overview.</p>
        </div>

        <button
          type="button"
          className="refresh-btn"
          onClick={loadDashboardData}
        >
          🔄 Refresh
        </button>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">👥</div>

          <div className="stat-content">
            <h3>Total Customers</h3>

            <strong>{stats.totalCustomers}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📦</div>

          <div className="stat-content">
            <h3>Total Products</h3>

            <strong>{stats.totalProducts}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🧾</div>

          <div className="stat-content">
            <h3>Total Invoices</h3>

            <strong>{stats.totalInvoices}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>

          <div className="stat-content">
            <h3>Total Sales</h3>

            <strong>{formatCurrency(stats.totalSales)}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>

          <div className="stat-content">
            <h3>Today's Sales</h3>

            <strong>{formatCurrency(stats.todaySales)}</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Low Stock Products</h2>

              <p>Products with stock of 5 or less</p>
            </div>

            <span className="card-count">
              {Array.isArray(lowStockProducts) ? lowStockProducts.length : 0}
            </span>
          </div>

          <div className="low-stock-list">
            {Array.isArray(lowStockProducts) && lowStockProducts.length > 0 ? (
              lowStockProducts.map((product) => (
                <div className="low-stock-item" key={product.id}>
                  <div className="product-info">
                    <div className="product-icon">📦</div>

                    <div>
                      <h3>{product.name || "Unnamed Product"}</h3>

                      <p>Price: {formatCurrency(product.price)}</p>
                    </div>
                  </div>

                  <div className="stock-info">
                    <span
                      className={
                        Number(product.stock) <= 2
                          ? "stock-danger"
                          : "stock-warning"
                      }
                    >
                      {Number(product.stock) || 0} left
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon">✅</div>

                <h3>No Low Stock Products</h3>

                <p>All products have sufficient stock.</p>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Business Summary</h2>

              <p>Current system overview</p>
            </div>
          </div>

          <div className="summary-list">
            <div className="summary-row">
              <span>👥 Customers</span>

              <strong>{stats.totalCustomers}</strong>
            </div>

            <div className="summary-row">
              <span>📦 Products</span>

              <strong>{stats.totalProducts}</strong>
            </div>

            <div className="summary-row">
              <span>🧾 Invoices</span>

              <strong>{stats.totalInvoices}</strong>
            </div>

            <div className="summary-row">
              <span>💰 Total Sales</span>

              <strong>{formatCurrency(stats.totalSales)}</strong>
            </div>

            <div className="summary-row">
              <span>📅 Today's Sales</span>

              <strong>{formatCurrency(stats.todaySales)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
