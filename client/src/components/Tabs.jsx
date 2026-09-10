import "./Tabs.css";

/**
 * Standardized SmartBilling 2.0 Tab Navigation
 */
function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = "pills",
  size = "md",
  className = "",
}) {
  return (
    <div className={`sb-tabs-container variant-${variant} size-${size} ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`sb-tab-btn ${isActive ? "is-active" : ""}`}
            onClick={() => onChange && onChange(tab.id)}
          >
            {tab.icon && <span className="sb-tab-icon" aria-hidden="true">{tab.icon}</span>}
            <span className="sb-tab-label">{tab.label}</span>
            {tab.count !== undefined && tab.count !== null && (
              <span className={`sb-tab-count ${isActive ? "is-active" : ""}`}>
                {tab.count}
              </span>
            )}
            {tab.badge && <span className="sb-tab-badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
