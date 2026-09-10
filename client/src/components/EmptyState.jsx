import "./EmptyState.css";

/**
 * Standardized SmartBilling 2.0 Empty State Display
 */
function EmptyState({
  icon = "📦",
  title = "No records found",
  description = null,
  action = null,
  className = "",
}) {
  return (
    <div className={`sb-empty-state ${className}`}>
      <div className="sb-empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="sb-empty-state-title">{title}</h3>
      {description && <p className="sb-empty-state-desc">{description}</p>}
      {action && <div className="sb-empty-state-action">{action}</div>}
    </div>
  );
}

export default EmptyState;
