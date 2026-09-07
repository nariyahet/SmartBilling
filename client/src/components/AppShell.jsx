import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./AppShell.css";

function AppShell({
  children,
  activePage,
  searchPlaceholder = "Search products, customers, invoices...",
  searchValue = "",
  onSearchChange,
  headerActions = null,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const [userProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("admin");
      return saved ? JSON.parse(saved) : { name: "Het Nariya", email: "admin@smartbilling.com" };
    } catch {
      return { name: "Het Nariya", email: "admin@smartbilling.com" };
    }
  });

  const [companyInfo] = useState(() => {
    try {
      const saved = localStorage.getItem("company");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });


  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    localStorage.removeItem("company");
    navigate("/");
  };

  const currentPath = location.pathname;
  const userInitials = userProfile?.name
    ? userProfile.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "HN";

  const isNavActive = (pageId, path) => {
    if (activePage) return activePage === pageId;
    return currentPath === path;
  };

  return (
    <div className="sb-app-layout">
      {/* ---------------------------------------------------- */}
      {/* SIDEBAR (Desktop Fixed/Sticky, Mobile Off-Canvas)    */}
      {/* ---------------------------------------------------- */}
      <aside className={`sb-sidebar ${mobileMenuOpen ? "drawer-open" : ""}`}>
        <div className="sb-sidebar-header">
          <Link to="/dashboard" className="sb-brand-link">
            <div className="sb-logo-icon">⚡</div>
            <div className="sb-brand-text">
              <span className="sb-brand-name">SmartBilling</span>
              <span className="sb-brand-tagline">Billing & ERP Suite</span>
            </div>
          </Link>
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
            className={`sb-nav-item ${isNavActive("dashboard", "/dashboard") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📊</span>
            <span className="sb-nav-text">Dashboard</span>
            {isNavActive("dashboard", "/dashboard") && <span className="sb-nav-indicator"></span>}
          </Link>

          <Link
            to="/products"
            className={`sb-nav-item ${isNavActive("products", "/products") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📦</span>
            <span className="sb-nav-text">Products</span>
            {isNavActive("products", "/products") && <span className="sb-nav-indicator"></span>}
          </Link>

          <Link
            to="/customers"
            className={`sb-nav-item ${isNavActive("customers", "/customers") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">👥</span>
            <span className="sb-nav-text">Customers</span>
            {isNavActive("customers", "/customers") && <span className="sb-nav-indicator"></span>}
          </Link>

          <Link
            to="/invoices/create"
            className={`sb-nav-item ${isNavActive("invoices", "/invoices/create") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">🧾</span>
            <span className="sb-nav-text">New Invoice</span>
            {isNavActive("invoices", "/invoices/create") && <span className="sb-nav-indicator"></span>}
          </Link>

          <Link
            to="/invoices/history"
            className={`sb-nav-item ${isNavActive("history", "/invoices/history") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📋</span>
            <span className="sb-nav-text">Invoice History</span>
            {isNavActive("history", "/invoices/history") && <span className="sb-nav-indicator"></span>}
          </Link>

          <Link
            to="/sales-report"
            className={`sb-nav-item ${isNavActive("reports", "/sales-report") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">📈</span>
            <span className="sb-nav-text">Sales Report</span>
            {isNavActive("reports", "/sales-report") && <span className="sb-nav-indicator"></span>}
          </Link>

          <Link
            to="/settings"
            className={`sb-nav-item ${isNavActive("settings", "/settings") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sb-nav-icon">⚙️</span>
            <span className="sb-nav-text">Business Settings</span>
            {isNavActive("settings", "/settings") && <span className="sb-nav-indicator"></span>}
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
      {/* MAIN WRAPPER & TOP HEADER                            */}
      {/* ---------------------------------------------------- */}
      <div className="sb-main-wrapper">
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
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              />
              {searchValue && (
                <button
                  type="button"
                  className="sb-search-clear"
                  onClick={() => onSearchChange && onSearchChange("")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="sb-header-right">
            {headerActions}

            <div className="sb-company-badge">
              <span className="sb-company-icon">🏢</span>
              <span className="sb-company-name">
                {companyInfo?.name || "SmartBilling Main"}
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

        {/* Page Content */}
        <main className="sb-page-content-canvas">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
