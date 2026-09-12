import { useState, useEffect, createContext, useContext, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { searchDestinations } from "../utils/searchCatalog";
import "./AppShell.css";

export const AppShellContext = createContext(false);

// Safe exact and prefix route matching helper
export const isPathActive = (currentPath, targetPath) => {
  if (!currentPath || !targetPath) return false;
  if (currentPath === targetPath) return true;
  // Dashboard and settings root routes require exact match
  if (targetPath === "/dashboard" || targetPath === "/settings") return false;
  return currentPath.startsWith(targetPath + "/");
};

// Navigation group configuration matching approved SmartBilling 2.0 structure
const NAV_GROUPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "🏠",
    isDirectLink: true,
    path: "/dashboard",
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: "📦",
    paths: [
      "/plastic-erp/suppliers",
      "/plastic-erp/raw-materials",
      "/plastic-erp/purchase-requisitions",
      "/plastic-erp/supplier-quotations",
      "/plastic-erp/purchase-comparison",
      "/plastic-erp/purchase-orders",
      "/plastic-erp/purchase-deliveries",
      "/plastic-erp/supplier-performance",
      "/plastic-erp/procurement-dashboard",
      "/plastic-erp/truck-inward",
      "/plastic-erp/weighment",
      "/plastic-erp/purchase-bills",
      "/plastic-erp/stock",
    ],
    items: [
      { path: "/plastic-erp/suppliers", label: "Scrap Suppliers Master", icon: "🏢" },
      { path: "/plastic-erp/raw-materials", label: "Raw Materials", icon: "♻️" },
      { path: "/plastic-erp/purchase-requisitions", label: "Purchase Requisitions", icon: "📋" },
      { path: "/plastic-erp/supplier-quotations", label: "Supplier Quotations", icon: "🏷️" },
      { path: "/plastic-erp/purchase-comparison", label: "Purchase Comparison", icon: "⚖️" },
      { path: "/plastic-erp/purchase-orders", label: "Purchase Orders", icon: "📦" },
      { path: "/plastic-erp/purchase-deliveries", label: "Purchase Deliveries", icon: "🚚" },
      { path: "/plastic-erp/supplier-performance", label: "Supplier Performance", icon: "⭐" },
      { path: "/plastic-erp/procurement-dashboard", label: "Procurement Dashboard", icon: "📈" },
    ],
  },
  {
    id: "production",
    label: "Production",
    icon: "🏭",
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
    ],
    items: [
      { path: "/plastic-erp/production", label: "Production Management", icon: "🏭" },
      { path: "/plastic-erp/recipes", label: "Recipes / BOM", icon: "🧪" },
      { path: "/plastic-erp/wip-fg", label: "WIP & Finished Goods", icon: "📦" },
      { path: "/plastic-erp/quality", label: "Quality Control", icon: "🔬" },
      { path: "/plastic-erp/scrap-regrind", label: "Scrap & Regrind", icon: "♻️" },
      { path: "/plastic-erp/machines", label: "Machines", icon: "⚙️" },
      { path: "/plastic-erp/operations", label: "Operations", icon: "👥" },
      { path: "/plastic-erp/traceability", label: "Batch Traceability", icon: "🔍" },
      { path: "/plastic-erp/costing", label: "Production Costing", icon: "💰" },
    ],
  },
  {
    id: "sales",
    label: "Sales & Dispatch",
    icon: "🚚",
    paths: [
      "/customers",
      "/products",
      "/plastic-erp/sales-orders",
      "/plastic-erp/dispatch",
      "/plastic-erp/delivery-challans",
      "/plastic-erp/transport",
      "/plastic-erp/eway-bills",
      "/invoices/create",
      "/invoices/history",
      "/plastic-erp/payments",
      "/plastic-erp/receivables",
      "/plastic-erp/customer-ledger",
      "/plastic-erp/sales-returns",
      "/plastic-erp/credit-notes",
      "/plastic-erp/debit-notes",
    ],
    items: [
      { path: "/customers", label: "Customers", icon: "👥" },
      { path: "/products", label: "Products / Finished Goods", icon: "📦" },
      { path: "/plastic-erp/sales-orders", label: "Sales Orders", icon: "📋" },
      { path: "/plastic-erp/dispatch", label: "Dispatch", icon: "🚚" },
      { path: "/plastic-erp/delivery-challans", label: "Delivery Challans", icon: "📄" },
      { path: "/plastic-erp/transport", label: "Transport", icon: "🚛" },
      { path: "/plastic-erp/eway-bills", label: "Internal E-Way Bills", icon: "🚚" },
      { path: "/invoices/create", label: "Invoice", icon: "🧾" },
      { path: "/invoices/history", label: "Invoice History", icon: "📋" },
      { path: "/plastic-erp/payments", label: "Payments", icon: "💵" },
      { path: "/plastic-erp/receivables", label: "Receivables", icon: "⏳" },
      { path: "/plastic-erp/customer-ledger", label: "Customer Ledger", icon: "📑" },
      { path: "/plastic-erp/sales-returns", label: "Sales Returns", icon: "🔄" },
      { path: "/plastic-erp/credit-notes", label: "Credit Notes", icon: "📉" },
      { path: "/plastic-erp/debit-notes", label: "Debit Notes", icon: "📈" },
    ],
  },
  {
    id: "hr",
    label: "HR & Workforce",
    icon: "👥",
    paths: [
      "/plastic-erp/employees",
      "/plastic-erp/attendance",
      "/plastic-erp/leaves",
      "/plastic-erp/workforce",
      "/plastic-erp/payroll",
      "/plastic-erp/advances",
      "/plastic-erp/expenses",
    ],
    items: [
      { path: "/plastic-erp/employees", label: "Employees", icon: "👥" },
      { path: "/plastic-erp/attendance", label: "Attendance", icon: "⏱️" },
      { path: "/plastic-erp/leaves", label: "Leave Management", icon: "🏖️" },
      { path: "/plastic-erp/workforce", label: "Workforce", icon: "🏭" },
      { path: "/plastic-erp/payroll", label: "Payroll", icon: "💵" },
      { path: "/plastic-erp/advances", label: "Employee Advances", icon: "🤝" },
      { path: "/plastic-erp/expenses", label: "Expenses", icon: "💸" },
    ],
  },
  {
    id: "accounting",
    label: "Accounting & GST",
    icon: "💰",
    paths: [
      "/plastic-erp/chart-of-accounts",
      "/plastic-erp/journal-entries",
      "/plastic-erp/cash-bank",
      "/plastic-erp/bank-reconciliation",
      "/plastic-erp/supplier-ledger",
      "/plastic-erp/gst-management",
      "/plastic-erp/gst-reconciliation",
      "/plastic-erp/accounting-dashboard",
      "/plastic-erp/accounting",
    ],
    items: [
      { path: "/plastic-erp/chart-of-accounts", label: "Chart of Accounts", icon: "📑" },
      { path: "/plastic-erp/journal-entries", label: "Journal Entries", icon: "✍️" },
      { path: "/plastic-erp/cash-bank", label: "Cash & Bank", icon: "💵" },
      { path: "/plastic-erp/bank-reconciliation", label: "Bank Reconciliation", icon: "🏛️" },
      { path: "/plastic-erp/supplier-ledger", label: "Supplier Ledger", icon: "🚛" },
      { path: "/plastic-erp/gst-management", label: "GST Management", icon: "⚖️" },
      { path: "/plastic-erp/gst-reconciliation", label: "GST Reconciliation", icon: "🔍" },
      { path: "/plastic-erp/accounting-dashboard", label: "Accounting Dashboard", icon: "📈" },
    ],
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    icon: "📊",
    paths: [
      "/plastic-erp/sales-reports",
      "/sales-report",
      "/plastic-erp/dispatch-reports",
      "/plastic-erp/payment-reports",
      "/plastic-erp/customer-ledger-reports",
      "/plastic-erp/reports",
      "/plastic-erp/procurement-reports",
      "/plastic-erp/hr-reports",
      "/plastic-erp/financial-reports",
      "/plastic-erp/executive-analytics",
    ],
    items: [
      { path: "/plastic-erp/sales-reports", label: "Sales Reports", icon: "📊" },
      { path: "/plastic-erp/dispatch-reports", label: "Dispatch Reports", icon: "🚚" },
      { path: "/plastic-erp/payment-reports", label: "Payment Reports", icon: "💵" },
      { path: "/plastic-erp/customer-ledger-reports", label: "Customer Ledger Reports", icon: "📑" },
      { path: "/plastic-erp/reports", label: "Production Reports", icon: "🏭" },
      { path: "/plastic-erp/procurement-reports", label: "Procurement Reports", icon: "📦" },
      { path: "/plastic-erp/hr-reports", label: "HR & Expense Reports", icon: "👥" },
      { path: "/plastic-erp/financial-reports", label: "Financial Reports", icon: "📈" },
      { path: "/plastic-erp/executive-analytics", label: "Executive Analytics", icon: "⚡" },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    icon: "⚙️",
    paths: ["/settings"],
    items: [
      { path: "/settings", label: "Business Settings", icon: "⚙️" },
    ],
  },
];

function getRouteInfo(pathname) {
  if (pathname === "/dashboard") {
    return { module: "Overview", title: "Executive Dashboard" };
  }
  for (const group of NAV_GROUPS) {
    if (group.items) {
      for (const item of group.items) {
        if (isPathActive(pathname, item.path)) {
          return { module: group.label, title: item.label };
        }
      }
    }
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return { module: "Administration", title: "Business Settings" };
  }
  return { module: "ERP", title: "SmartBilling" };
}

function getUserInitials(name) {
  if (!name) return "DA";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AppShell({
  children,
  headerActions = null,
  searchPlaceholder = "Search products, customers, invoices...",
  searchValue = "",
  onSearchChange = null,
}) {
  const isNested = useContext(AppShellContext);
  const location = useLocation();
  const navigate = useNavigate();

  // Internal search state fallback when page does not pass controlled onSearchChange
  const [internalSearch, setInternalSearch] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("search") || "";
    } catch {
      return "";
    }
  });
  const isControlled = onSearchChange !== null && onSearchChange !== undefined;
  const currentSearch = isControlled ? searchValue : internalSearch;

  // Global search dropdown & active selection state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const searchWrapRef = useRef(null);

  // Sync internalSearch if URL search query changes and search is not controlled
  useEffect(() => {
    try {
      const urlQuery = new URLSearchParams(location.search).get("search");
      if (urlQuery !== null && !isControlled && urlQuery !== internalSearch) {
        setInternalSearch(urlQuery);
      }
    } catch {
      // ignore
    }
  }, [location.search, isControlled, internalSearch]);

  // Compute matching destinations
  const searchResults = useMemo(() => {
    if (isControlled || !currentSearch.trim()) return [];
    return searchDestinations(currentSearch.trim());
  }, [isControlled, currentSearch]);

  const handleSearchInput = (val) => {
    if (isControlled) {
      onSearchChange(val);
    } else {
      setInternalSearch(val);
      setIsSearchOpen(Boolean(val.trim()));
      setSearchActiveIndex(0);
    }
  };

  const handleClearSearch = () => {
    if (isControlled) {
      onSearchChange("");
    } else {
      setInternalSearch("");
      setIsSearchOpen(false);
      setSearchActiveIndex(0);
    }
  };

  const handleSelectDestination = (dest) => {
    if (!dest || !dest.path) return;
    setIsSearchOpen(false);
    setInternalSearch("");
    navigate(dest.path);
  };

  const handleSearchKeyDown = (e) => {
    if (isControlled) {
      if (e.key === "Enter") {
        e.target.blur();
      }
      return;
    }

    if (e.key === "ArrowDown" || e.key === "Down") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setIsSearchOpen(true);
        setSearchActiveIndex((prev) => (prev + 1) % searchResults.length);
      }
      return;
    }

    if (e.key === "ArrowUp" || e.key === "Up") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setIsSearchOpen(true);
        setSearchActiveIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
      return;
    }

    if (e.key === "Escape" || e.key === "Esc") {
      setIsSearchOpen(false);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0) {
        const target =
          searchResults[searchActiveIndex >= 0 && searchActiveIndex < searchResults.length ? searchActiveIndex : 0];
        handleSelectDestination(target);
      } else if (currentSearch.trim()) {
        setIsSearchOpen(true);
      }
    }
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close search dropdown and clear query on route navigation
  useEffect(() => {
    setIsSearchOpen(false);
    if (!isControlled) {
      setInternalSearch("");
    }
  }, [location.pathname, isControlled]);

  // Tablet collapsed sidebar state: default collapsed on tablet viewports
  const [collapsed, setCollapsed] = useState(() => {
    return typeof window !== "undefined" && window.innerWidth >= 768 && window.innerWidth <= 1024;
  });
  // Mobile off-canvas drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // Profile dropdown menu state
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // User and Company Profile info from localStorage
  const [userProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("admin");
      return saved ? JSON.parse(saved) : { name: "Demo Admin", email: "demo@smartbilling.com" };
    } catch {
      return { name: "Demo Admin", email: "demo@smartbilling.com" };
    }
  });

  const [companyInfo] = useState(() => {
    try {
      const saved = localStorage.getItem("company");
      return saved ? JSON.parse(saved) : { name: "Demo Company" };
    } catch {
      return { name: "Demo Company" };
    }
  });

  // Track expanded navigation groups
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const currentPath = location.pathname;
    const initial = {};
    NAV_GROUPS.forEach((group) => {
      if (group.paths && group.paths.some((p) => isPathActive(currentPath, p))) {
        initial[group.id] = true;
      }
    });
    return initial;
  });

  // Auto-expand group when path changes
  useEffect(() => {
    const currentPath = location.pathname;
    NAV_GROUPS.forEach((group) => {
      if (group.paths && group.paths.some((p) => isPathActive(currentPath, p))) {
        setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
    setMobileDrawerOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is active
  useEffect(() => {
    if (mobileDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileDrawerOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("admin");
    localStorage.removeItem("company");
    navigate("/");
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const currentRouteInfo = getRouteInfo(location.pathname);
  const userInitials = getUserInitials(userProfile?.name);

  // If already wrapped in an AppShell, render as inner container to avoid duplicate sidebars
  if (isNested) {
    return (
      <div className="sb-inner-page-canvas">
        {headerActions && <div className="sb-inner-header-actions">{headerActions}</div>}
        {children}
      </div>
    );
  }

  return (
    <AppShellContext.Provider value={true}>
      <div className={`sb-app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
        {/* ------------------------------------------------------------------
            1. FIXED LEFT SIDEBAR (Desktop Fixed, Tablet Collapsible, Mobile Drawer)
            ------------------------------------------------------------------ */}
        <aside
          className={`sb-sidebar ${mobileDrawerOpen ? "drawer-open" : ""} ${
            collapsed ? "collapsed" : ""
          }`}
          aria-label="Main Navigation"
        >
          {/* Brand Header */}
          <div className="sb-sidebar-header">
            <Link to="/dashboard" className="sb-brand-link" onClick={() => setMobileDrawerOpen(false)}>
              <div className="sb-logo-icon">♻️</div>
              {!collapsed && (
                <div className="sb-brand-text">
                  <span className="sb-brand-name">SmartBilling 2.0</span>
                  <span className="sb-brand-tagline">Plastic Recycling ERP · Billing & ERP Suite</span>
                </div>
              )}
            </Link>
            {mobileDrawerOpen && (
              <button
                type="button"
                className="sb-drawer-close-btn"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation drawer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Scrollable Navigation Items */}
          <nav className="sb-nav-menu">
            {NAV_GROUPS.map((group) => {
              // Direct Top-level Link (e.g. Dashboard)
              if (group.isDirectLink) {
                const isActive = isPathActive(location.pathname, group.path);
                return (
                  <Link
                    key={group.id}
                    to={group.path}
                    className={`sb-nav-item ${isActive ? "active" : ""}`}
                    onClick={() => setMobileDrawerOpen(false)}
                    title={collapsed ? group.label : undefined}
                  >
                    <span className="sb-nav-icon">{group.icon}</span>
                    {!collapsed && <span className="sb-nav-text">{group.label}</span>}
                    {isActive && <span className="sb-nav-indicator"></span>}
                  </Link>
                );
              }

              // Accordion Group Header
              const isGroupActive = Boolean(
                group.paths && group.paths.some((p) => isPathActive(location.pathname, p))
              );
              const isExpanded = expandedGroups[group.id];

              return (
                <div key={group.id} className={`sb-nav-group ${isGroupActive ? "group-active" : ""}`}>
                  <button
                    type="button"
                    className={`sb-nav-group-btn ${isGroupActive ? "active-parent" : ""}`}
                    onClick={() => toggleGroup(group.id)}
                    title={collapsed ? group.label : undefined}
                    aria-expanded={isExpanded}
                  >
                    <span className="sb-nav-icon">{group.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="sb-nav-text">{group.label}</span>
                        <span className="sb-group-arrow">{isExpanded ? "▾" : "▸"}</span>
                      </>
                    )}
                  </button>

                  {/* Submenu Items */}
                  {!collapsed && isExpanded && (
                    <div className="sb-nav-submenu">
                      {group.items.map((subitem) => {
                        const isSubActive = isPathActive(location.pathname, subitem.path);
                        return (
                          <Link
                            key={subitem.label + subitem.path}
                            to={subitem.path}
                            className={`sb-nav-subitem ${isSubActive ? "active" : ""}`}
                            onClick={() => setMobileDrawerOpen(false)}
                          >
                            <span className="sb-subitem-bullet"></span>
                            <span className="sb-nav-subtext">{subitem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer User Card */}
          <div className="sb-sidebar-footer">
            <div className="sb-user-card">
              <div className="sb-user-avatar-mini">{userInitials}</div>
              {!collapsed && (
                <div className="sb-user-card-info">
                  <span className="sb-user-card-name">{userProfile?.name || "Demo Admin"}</span>
                  <span className="sb-user-card-role">Administrator</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="sb-sidebar-logout-btn"
              onClick={handleLogout}
              title={collapsed ? "Logout" : undefined}
            >
              <span className="sb-logout-icon">🚪</span>
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Backdrop for Mobile Off-Canvas Drawer */}
        {mobileDrawerOpen && (
          <div
            className="sb-drawer-backdrop"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ------------------------------------------------------------------
            2. MAIN WRAPPER & TOPBAR (Desktop Offset, Content Canvas)
            ------------------------------------------------------------------ */}
        <div className="sb-main-wrapper">
          {/* Topbar Header */}
          <header className="sb-top-header">
            <div className="sb-header-left">
              <button
                type="button"
                className="sb-hamburger-btn sb-sidebar-toggle-btn"
                onClick={() => {
                  // If on mobile toggle off-canvas drawer; on tablet/desktop toggle collapsed
                  if (window.innerWidth < 768) {
                    setMobileDrawerOpen(!mobileDrawerOpen);
                  } else {
                    setCollapsed(!collapsed);
                  }
                }}
                aria-label="Toggle Navigation Menu"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                ☰
              </button>

              <div className="sb-header-title-block">
                <span className="sb-header-module">{currentRouteInfo.module}</span>
                <span className="sb-header-separator">/</span>
                <span className="sb-header-page-title">{currentRouteInfo.title}</span>
              </div>
            </div>

            <div className="sb-header-center">
              <div className="sb-search-wrap" ref={searchWrapRef}>
                <span className="sb-search-icon">🔍</span>
                <input
                  type="text"
                  className="sb-search-input"
                  placeholder={searchPlaceholder}
                  value={currentSearch}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => {
                    if (!isControlled && currentSearch.trim()) {
                      setIsSearchOpen(true);
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                  aria-label="Search"
                  aria-expanded={!isControlled && isSearchOpen}
                  aria-autocomplete={!isControlled ? "list" : undefined}
                />
                {currentSearch && (
                  <button
                    type="button"
                    className="sb-search-clear"
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}

                {/* Global Search Results Dropdown */}
                {!isControlled && isSearchOpen && currentSearch.trim() && (
                  <div className="sb-search-dropdown" role="listbox" aria-label="Search results">
                    {searchResults.length > 0 ? (
                      <>
                        <div className="sb-search-dropdown-header">
                          <span>NAVIGATION DESTINATIONS</span>
                          <span className="sb-search-count">
                            {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
                          </span>
                        </div>
                        <div className="sb-search-results-list">
                          {searchResults.map((dest, idx) => {
                            const isSelected = idx === searchActiveIndex;
                            return (
                              <div
                                key={dest.id || dest.path}
                                className={`sb-search-result-item ${isSelected ? "is-selected" : ""}`}
                                onClick={() => handleSelectDestination(dest)}
                                onMouseEnter={() => setSearchActiveIndex(idx)}
                                role="option"
                                aria-selected={isSelected}
                              >
                                <span className="sb-search-result-icon">{dest.icon}</span>
                                <div className="sb-search-result-body">
                                  <span className="sb-search-result-title">{dest.label}</span>
                                  <span className="sb-search-result-module">{dest.module}</span>
                                </div>
                                <span className="sb-search-result-hint">↵ Go</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="sb-search-empty-state">
                        <span className="sb-search-empty-icon">🔎</span>
                        <div className="sb-search-empty-message">
                          <strong className="sb-search-empty-title">No matching pages found</strong>
                          <span className="sb-search-empty-sub">
                            No destination matches "{currentSearch.trim()}". Try searching for "payments", "invoices", "gst", or "production".
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="sb-header-right">
              {headerActions}

              <div className="sb-company-badge">
                <span className="sb-company-icon">🏢</span>
                <span className="sb-company-name">
                  {companyInfo?.name || "Demo Company"}
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
                  <span className="sb-profile-name">{userProfile?.name || "Demo Admin"}</span>
                  <span className="sb-profile-role">Admin</span>
                </div>
                <span className="sb-dropdown-arrow">▾</span>

                {profileDropdownOpen && (
                  <div className="sb-profile-dropdown" onClick={(e) => e.stopPropagation()}>
                    <div className="dropdown-user-header">
                      <strong>{userProfile?.name || "Demo Admin"}</strong>
                      <span>{userProfile?.email || "demo@smartbilling.com"}</span>
                    </div>
                    <hr className="dropdown-divider" />
                    <Link
                      to="/settings"
                      className="dropdown-item"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      ⚙️ Business Settings
                    </Link>
                    <Link
                      to="/dashboard"
                      className="dropdown-item"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      📊 ERP Dashboard
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

          {/* Page Content Canvas */}
          <main className="sb-page-content-canvas">
            {children}
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}

export default AppShell;
