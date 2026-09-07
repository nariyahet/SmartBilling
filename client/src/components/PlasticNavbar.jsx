import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./PlasticNavbar.css";

function PlasticNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    navigate("/");
  };

  const navLinks = [
    { path: "/plastic-erp", label: "📊 ERP Dashboard", exact: true },
    { path: "/plastic-erp/suppliers", label: "🏢 Suppliers" },
    { path: "/plastic-erp/raw-materials", label: "♻️ Raw Materials" },
    { path: "/plastic-erp/truck-inward", label: "🚚 Truck Inward" },
    { path: "/plastic-erp/weighment", label: "⚖️ Weighment" },
    { path: "/plastic-erp/purchase-bills", label: "📑 Purchase Bills" },
    { path: "/plastic-erp/stock", label: "📦 Stock & Adjustments" },
  ];

  const isActive = (link) => {
    if (link.exact) {
      return location.pathname === link.path;
    }
    return location.pathname.startsWith(link.path);
  };

  return (
    <nav className="plastic-navbar">
      <div className="plastic-nav-top">
        <div className="plastic-nav-brand">
          <Link to="/plastic-erp" className="brand-link">
            <span className="brand-icon">♻️</span>
            <div>
              <span className="brand-title">Plastic Recycling ERP</span>
              <span className="brand-subtitle">Kim, Surat • Plant Operations</span>
            </div>
          </Link>
        </div>

        <button
          type="button"
          className="plastic-nav-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          ☰
        </button>

        {mobileOpen && (
          <div
            className="plastic-drawer-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className={`plastic-nav-links ${mobileOpen ? "open" : ""}`}>
          <div className="plastic-drawer-header">
            <div className="drawer-brand">
              <span className="drawer-icon">♻️</span>
              <div>
                <strong className="drawer-title">Plastic Recycling ERP</strong>
                <small className="drawer-subtitle">Kim, Surat Plant</small>
              </div>
            </div>
            <button
              type="button"
              className="plastic-drawer-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          </div>

          <div className="plastic-nav-core-links">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`plastic-nav-link ${isActive(link) ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="plastic-nav-actions">
            <Link
              to="/dashboard"
              className="plastic-nav-link-billing"
              title="Return to SmartBilling Sales Dashboard"
              onClick={() => setMobileOpen(false)}
            >
              ← SmartBilling
            </Link>

            <button type="button" className="plastic-logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default PlasticNavbar;
