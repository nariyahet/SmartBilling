import PropTypes from "prop-types";
import "./AlertBanner.css";

const VARIANT_ICONS = {
  success: "✅",
  warning: "⚠️",
  danger: "❌",
  info: "ℹ️",
};

/**
 * Standardized SmartBilling 2.0 Alert Banner
 */
function AlertBanner({
  variant = "info",
  title = null,
  children,
  onDismiss = null,
  className = "",
}) {
  return (
    <div className={`sb-alert-banner variant-${variant} ${className}`} role="alert">
      <div className="sb-alert-banner-left">
        <span className="sb-alert-banner-icon" aria-hidden="true">
          {VARIANT_ICONS[variant] || "ℹ️"}
        </span>
        <div className="sb-alert-banner-body">
          {title && <span className="sb-alert-banner-title">{title}</span>}
          <span>{children}</span>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          className="sb-alert-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}

AlertBanner.propTypes = {
  variant: PropTypes.oneOf(["success", "warning", "danger", "info"]),
  title: PropTypes.node,
  children: PropTypes.node.isRequired,
  onDismiss: PropTypes.func,
  className: PropTypes.string,
};

export default AlertBanner;
