import "./StatusBadge.css";

// Automatically map common ERP statuses to approved semantic variants
const STATUS_VARIANT_MAP = {
  // Success (Green)
  completed: "success",
  paid: "success",
  approved: "success",
  passed: "success",
  active: "success",
  dispatched: "success",
  delivered: "success",
  healthy: "success",
  running: "success",

  // Warning (Amber)
  pending: "warning",
  partial: "warning",
  "in progress": "warning",
  processing: "warning",
  reserved: "warning",
  "low stock": "warning",
  paused: "warning",
  maintenance: "warning",

  // Danger (Red)
  failed: "danger",
  rejected: "danger",
  overdue: "danger",
  "out of stock": "danger",
  cancelled: "danger",
  breakdown: "danger",
  critical: "danger",

  // Info / Teal
  inwarded: "info",
  open: "info",

  // Neutral (Gray)
  draft: "neutral",
  inactive: "neutral",
  closed: "neutral",
};

/**
 * Standardized SmartBilling 2.0 Status Badge
 */
function StatusBadge({
  status,
  variant = undefined,
  showDot = true,
  className = "",
  children = undefined,
}) {
  const displayLabel = children || status || "-";
  const normalizedKey = String(status || children || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, " ");

  const resolvedVariant = variant || STATUS_VARIANT_MAP[normalizedKey] || "neutral";

  return (
    <span className={`sb-status-badge variant-${resolvedVariant} ${className}`}>
      {showDot && <span className="sb-status-badge-dot" aria-hidden="true" />}
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
