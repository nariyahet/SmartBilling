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

  // Lock body scroll when mobile drawer is open to prevent background scrolling & double scrollbars
  useEffect(() => {
    if (mobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileOpen]);

  // Close drawer and dropdowns automatically when location pathname changes
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    if (mobileOpen) setMobileOpen(false);
    if (activeDropdown) setActiveDropdown(null);
  }

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setActiveDropdown(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      paths: [
        "/plastic-erp/production",
        "/plastic-erp/recipes",
        "/plastic-erp/wip-fg",
        "/plastic-erp/quality",
        "/plastic-erp/scrap-regrind",
        "/plastic-erp/machines",
        "/plastic-erp/operations",
        "/plastic-erp/traceability",
        "/plastic-erp/costing",
        "/plastic-erp/reports",
      ],
      items: [
        { path: "/plastic-erp/production", label: "🏭 Orders & Planning" },
        { path: "/plastic-erp/recipes", label: "🧪 BOM & Recipes" },
        { path: "/plastic-erp/wip-fg", label: "📦 WIP & Finished Goods" },
        { path: "/plastic-erp/quality", label: "🔬 Quality Control" },
        { path: "/plastic-erp/scrap-regrind", label: "♻️ Scrap & Regrind" },
        { path: "/plastic-erp/machines", label: "⚙️ Machines & Downtime" },
        { path: "/plastic-erp/operations", label: "👥 Shifts & Operators" },
        { path: "/plastic-erp/traceability", label: "🔍 Batch Traceability" },
        { path: "/plastic-erp/costing", label: "💰 Production Costing" },
        { path: "/plastic-erp/reports", label: "📊 Plant Reports" },
      ],
    },
    {
      id: "sales",
      label: "💼 Sales",
      paths: [
        "/plastic-erp/sales-orders",
        "/plastic-erp/dispatch",
        "/plastic-erp/delivery-challans",
        "/plastic-erp/transport",
        "/plastic-erp/sales-returns",
      ],
      items: [
        { path: "/plastic-erp/sales-orders", label: "📋 Sales Orders" },
        { path: "/plastic-erp/dispatch", label: "🚚 Dispatch Management" },
        { path: "/plastic-erp/delivery-challans", label: "📄 Delivery Challans" },
        { path: "/plastic-erp/transport", label: "🚛 Transport & Vehicles" },
        { path: "/plastic-erp/sales-returns", label: "🔄 Sales Returns" },
      ],
    },
    {
      id: "finance",
      label: "💳 Finance",
      paths: [
        "/plastic-erp/payments",
        "/plastic-erp/receivables",
        "/plastic-erp/customer-ledger",
        "/plastic-erp/credit-notes",
        "/plastic-erp/debit-notes",
        "/plastic-erp/sales-reports",
      ],
      items: [
        { path: "/plastic-erp/payments", label: "💵 Payment Collections" },
        { path: "/plastic-erp/receivables", label: "⏳ Receivables & Aging" },
        { path: "/plastic-erp/customer-ledger", label: "📑 Customer Ledger" },
        { path: "/plastic-erp/credit-notes", label: "📉 Credit Notes" },
        { path: "/plastic-erp/debit-notes", label: "📈 Debit Notes" },
        { path: "/plastic-erp/sales-reports", label: "📊 Sales & Margin Reports" },
      ],
    },
    {
      id: "hr_expenses",
      label: "👥 HR & Expenses",
      paths: [
        "/plastic-erp/employees",
        "/plastic-erp/attendance",
        "/plastic-erp/leaves",
        "/plastic-erp/workforce",
        "/plastic-erp/payroll",
        "/plastic-erp/advances",
        "/plastic-erp/expenses",
        "/plastic-erp/hr-reports",
      ],
      items: [
        { path: "/plastic-erp/employees", label: "👥 Employees Master" },
        { path: "/plastic-erp/attendance", label: "⏱️ Attendance & Shifts" },
        { path: "/plastic-erp/leaves", label: "🏖️ Leave Management" },
        { path: "/plastic-erp/workforce", label: "🏭 Plant Workforce & Labour" },
        { path: "/plastic-erp/payroll", label: "💰 Payroll & Payslips" },
        { path: "/plastic-erp/advances", label: "💳 Employee Advances" },
        { path: "/plastic-erp/expenses", label: "🧾 Plant Expenses" },
        { path: "/plastic-erp/hr-reports", label: "📊 HR & Expense Reports" },
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
              <span className="brand-subtitle">Kim, Surat • Plant Operations & Finance</span>
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

            {/* Desktop Dropdown Groups */}
            {navGroups.map((group) => (
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
          </div>

          {/* Mobile Drawer Complete Module List (shown only on mobile) */}
          <div className="plastic-mobile-only-modules">
            <Link
              to="/plastic-erp"
              className={`plastic-nav-link ${location.pathname === "/plastic-erp" ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              📊 ERP Dashboard
            </Link>

            <div className="mobile-section-label">PHASE 1: PROCUREMENT</div>
            <Link to="/plastic-erp/suppliers" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/suppliers") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🏢 Scrap Suppliers
            </Link>
            <Link to="/plastic-erp/raw-materials" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/raw-materials") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              ♻️ Raw Material Catalog
            </Link>
            <Link to="/plastic-erp/truck-inward" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/truck-inward") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🚚 Truck Inward
            </Link>
            <Link to="/plastic-erp/weighment" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/weighment") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              ⚖️ Weighment Slips
            </Link>
            <Link to="/plastic-erp/purchase-bills" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/purchase-bills") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📑 Purchase Bills
            </Link>
            <Link to="/plastic-erp/stock" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/stock") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📦 Raw Material Stock
            </Link>

            <div className="mobile-section-label">PHASE 2: PRODUCTION</div>
            <Link to="/plastic-erp/production" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/production") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🏭 Orders & Planning
            </Link>
            <Link to="/plastic-erp/recipes" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/recipes") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🧪 BOM & Recipes
            </Link>
            <Link to="/plastic-erp/wip-fg" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/wip-fg") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📦 WIP & Finished Goods
            </Link>
            <Link to="/plastic-erp/quality" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/quality") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🔬 Quality Control
            </Link>
            <Link to="/plastic-erp/scrap-regrind" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/scrap-regrind") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              ♻️ Scrap & Regrind
            </Link>
            <Link to="/plastic-erp/machines" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/machines") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              ⚙️ Machines & Downtime
            </Link>
            <Link to="/plastic-erp/operations" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/operations") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              👥 Shifts & Operators
            </Link>
            <Link to="/plastic-erp/traceability" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/traceability") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🔍 Batch Traceability
            </Link>
            <Link to="/plastic-erp/costing" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/costing") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              💰 Production Costing
            </Link>
            <Link to="/plastic-erp/reports" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/reports") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📊 Plant Reports
            </Link>

            <div className="mobile-section-label">PHASE 3</div>
            <div className="mobile-subsection-label">Sales & Dispatch</div>
            <Link to="/plastic-erp/sales-orders" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/sales-orders") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📋 Sales Orders
            </Link>
            <Link to="/plastic-erp/dispatch" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/dispatch") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🚚 Dispatch Management
            </Link>
            <Link to="/plastic-erp/delivery-challans" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/delivery-challans") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📄 Delivery Challans
            </Link>
            <Link to="/plastic-erp/transport" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/transport") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🚛 Transport & Vehicles
            </Link>
            <Link to="/plastic-erp/sales-returns" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/sales-returns") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🔄 Sales Returns
            </Link>

            <div className="mobile-subsection-label">Finance & Receivables</div>
            <Link to="/plastic-erp/payments" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/payments") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              💵 Payment Collections
            </Link>
            <Link to="/plastic-erp/receivables" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/receivables") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              ⏳ Receivables & Aging
            </Link>
            <Link to="/plastic-erp/customer-ledger" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/customer-ledger") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📑 Customer Ledger
            </Link>
            <Link to="/plastic-erp/credit-notes" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/credit-notes") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📉 Credit Notes
            </Link>
            <Link to="/plastic-erp/debit-notes" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/debit-notes") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📈 Debit Notes
            </Link>
            <Link to="/plastic-erp/sales-reports" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/sales-reports") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📊 Sales & Margin Reports
            </Link>

            <div className="mobile-section-label">PHASE 4</div>
            <div className="mobile-subsection-label">HR & Workforce</div>
            <Link to="/plastic-erp/employees" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/employees") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              👥 Employees Master
            </Link>
            <Link to="/plastic-erp/attendance" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/attendance") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              ⏱️ Attendance & Shifts
            </Link>
            <Link to="/plastic-erp/leaves" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/leaves") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🏖️ Leave Management
            </Link>
            <Link to="/plastic-erp/workforce" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/workforce") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🏭 Plant Workforce & Labour
            </Link>

            <div className="mobile-subsection-label">Payroll & Expenses</div>
            <Link to="/plastic-erp/payroll" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/payroll") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              💰 Payroll & Payslips
            </Link>
            <Link to="/plastic-erp/advances" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/advances") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              💳 Employee Advances
            </Link>
            <Link to="/plastic-erp/expenses" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/expenses") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              🧾 Plant Expenses
            </Link>
            <Link to="/plastic-erp/hr-reports" className={`plastic-nav-link ${location.pathname.startsWith("/plastic-erp/hr-reports") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              📊 HR & Expense Reports
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
