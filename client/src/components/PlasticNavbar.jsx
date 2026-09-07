import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./PlasticNavbar.css";

function PlasticNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const navRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    navigate("/");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const navGroups = [
    {
      id: "procurement",
      label: "🛒 Procurement",
      paths: [
        "/plastic-erp/suppliers",
        "/plastic-erp/raw-materials",
        "/plastic-erp/truck-inward",
        "/plastic-erp/weighment",
        "/plastic-erp/purchase-bills",
        "/plastic-erp/stock",
      ],
      items: [
        { path: "/plastic-erp/suppliers", label: "🏢 Scrap Suppliers" },
        { path: "/plastic-erp/raw-materials", label: "♻️ Raw Material Catalog" },
        { path: "/plastic-erp/truck-inward", label: "🚚 Truck Inward" },
        { path: "/plastic-erp/weighment", label: "⚖️ Weighment Slips" },
        { path: "/plastic-erp/purchase-bills", label: "📑 Purchase Bills" },
        { path: "/plastic-erp/stock", label: "📦 Raw Material Stock" },
      ],
    },
    {
      id: "production",
      label: "🏭 Production",
      paths: ["/plastic-erp/production", "/plastic-erp/recipes"],
      items: [
        { path: "/plastic-erp/production", label: "🏭 Orders & Planning" },
        { path: "/plastic-erp/recipes", label: "🧪 BOM & Recipes" },
      ],
    },
    {
      id: "inventory",
      label: "📦 Inventory",
      paths: ["/plastic-erp/wip-fg", "/plastic-erp/scrap-regrind"],
      items: [
        { path: "/plastic-erp/wip-fg", label: "📦 WIP & Finished Goods" },
        { path: "/plastic-erp/scrap-regrind", label: "♻️ Scrap & Regrind" },
      ],
    },
    {
      id: "plant",
      label: "⚙️ Plant Ops",
      paths: ["/plastic-erp/machines", "/plastic-erp/operations"],
      items: [
        { path: "/plastic-erp/machines", label: "⚙️ Machines & Downtime" },
        { path: "/plastic-erp/operations", label: "👥 Shifts & Operators" },
      ],
    },
    {
      id: "reports",
      label: "📈 Reports",
      paths: ["/plastic-erp/costing", "/plastic-erp/reports"],
      items: [
        { path: "/plastic-erp/costing", label: "💰 Production Costing" },
        { path: "/plastic-erp/reports", label: "📊 Reports & Alerts" },
      ],
    },
  ];

  const isGroupActive = (group) => {
    return group.paths.some((p) => location.pathname.startsWith(p));
  };

  return (
    <nav className="plastic-navbar" ref={navRef}>
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

        {/* Desktop and Mobile Navigation Container */}
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

          {/* Desktop Single-Row Navigation Menu */}
          <div className="plastic-nav-core-links">
            <Link
              to="/plastic-erp"
              className={`plastic-nav-link ${location.pathname === "/plastic-erp" ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              📊 Dashboard
            </Link>

            {/* Procurement Dropdown */}
            {navGroups.slice(0, 2).map((group) => (
              <div
                key={group.id}
                className={`plastic-dropdown ${activeDropdown === group.id ? "open" : ""}`}
                onMouseEnter={() => setActiveDropdown(group.id)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  className={`plastic-nav-link plastic-drop-btn ${isGroupActive(group) ? "active" : ""}`}
                  onClick={() => setActiveDropdown(activeDropdown === group.id ? null : group.id)}
                >
                  {group.label} <span className="caret">▾</span>
                </button>
                <div className="plastic-dropdown-menu">
                  {group.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`plastic-dropdown-item ${location.pathname.startsWith(item.path) ? "active" : ""}`}
                      onClick={() => {
                        setActiveDropdown(null);
                        setMobileOpen(false);
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* Inventory Dropdown */}
            <div
              className={`plastic-dropdown ${activeDropdown === "inventory" ? "open" : ""}`}
              onMouseEnter={() => setActiveDropdown("inventory")}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                className={`plastic-nav-link plastic-drop-btn ${isGroupActive(navGroups[2]) ? "active" : ""}`}
                onClick={() => setActiveDropdown(activeDropdown === "inventory" ? null : "inventory")}
              >
                {navGroups[2].label} <span className="caret">▾</span>
              </button>
              <div className="plastic-dropdown-menu">
                {navGroups[2].items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`plastic-dropdown-item ${location.pathname.startsWith(item.path) ? "active" : ""}`}
                    onClick={() => {
                      setActiveDropdown(null);
                      setMobileOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Direct Quality Link */}
            <Link
              to="/plastic-erp/quality"
              className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/quality") ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              🔬 Quality
            </Link>

            {/* Plant Ops Dropdown */}
            <div
              className={`plastic-dropdown ${activeDropdown === "plant" ? "open" : ""}`}
              onMouseEnter={() => setActiveDropdown("plant")}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                className={`plastic-nav-link plastic-drop-btn ${isGroupActive(navGroups[3]) ? "active" : ""}`}
                onClick={() => setActiveDropdown(activeDropdown === "plant" ? null : "plant")}
              >
                {navGroups[3].label} <span className="caret">▾</span>
              </button>
              <div className="plastic-dropdown-menu">
                {navGroups[3].items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`plastic-dropdown-item ${location.pathname.startsWith(item.path) ? "active" : ""}`}
                    onClick={() => {
                      setActiveDropdown(null);
                      setMobileOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Direct Traceability Link */}
            <Link
              to="/plastic-erp/traceability"
              className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/traceability") ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              🔍 Traceability
            </Link>

            {/* Reports Dropdown */}
            <div
              className={`plastic-dropdown ${activeDropdown === "reports" ? "open" : ""}`}
              onMouseEnter={() => setActiveDropdown("reports")}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                className={`plastic-nav-link plastic-drop-btn ${isGroupActive(navGroups[4]) ? "active" : ""}`}
                onClick={() => setActiveDropdown(activeDropdown === "reports" ? null : "reports")}
              >
                {navGroups[4].label} <span className="caret">▾</span>
              </button>
              <div className="plastic-dropdown-menu">
                {navGroups[4].items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`plastic-dropdown-item ${location.pathname.startsWith(item.path) ? "active" : ""}`}
                    onClick={() => {
                      setActiveDropdown(null);
                      setMobileOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Drawer Complete Module List (shown only on mobile) */}
          <div className="plastic-mobile-only-modules">
            <div className="mobile-section-label">PHASE 1: PROCUREMENT</div>
            <Link to="/plastic-erp/suppliers" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              🏢 Suppliers
            </Link>
            <Link to="/plastic-erp/raw-materials" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              ♻️ Raw Materials
            </Link>
            <Link to="/plastic-erp/truck-inward" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              🚚 Truck Inward
            </Link>
            <Link to="/plastic-erp/weighment" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              ⚖️ Weighment
            </Link>
            <Link to="/plastic-erp/purchase-bills" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              📑 Purchase Bills
            </Link>
            <Link to="/plastic-erp/stock" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              📦 Raw Material Stock
            </Link>

            <div className="mobile-section-label">PHASE 2: OPERATIONS</div>
            <Link to="/plastic-erp/production" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              🏭 Production Orders & Planning
            </Link>
            <Link to="/plastic-erp/recipes" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              🧪 BOM & Recipes
            </Link>
            <Link to="/plastic-erp/wip-fg" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              📦 WIP & Finished Goods
            </Link>
            <Link to="/plastic-erp/quality" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              🔬 Quality Control
            </Link>
            <Link to="/plastic-erp/scrap-regrind" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              ♻️ Scrap & Regrind
            </Link>
            <Link to="/plastic-erp/machines" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              ⚙️ Machines & Downtime
            </Link>
            <Link to="/plastic-erp/operations" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              👥 Shifts & Operators
            </Link>
            <Link to="/plastic-erp/traceability" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              🔍 Batch Traceability
            </Link>
            <Link to="/plastic-erp/costing" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              💰 Production Costing
            </Link>
            <Link to="/plastic-erp/reports" className="plastic-nav-link" onClick={() => setMobileOpen(false)}>
              📊 Reports & Alerts
            </Link>
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
