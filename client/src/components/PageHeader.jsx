import PropTypes from "prop-types";
import "./PageHeader.css";

/**
 * Standardized SmartBilling 2.0 Page Header
 */
function PageHeader({
  title,
  subtitle = null,
  badge = null,
  actions = null,
  className = "",
}) {
  return (
    <div className={`sb-page-header ${className}`}>
      <div className="sb-page-header-meta">
        {badge && <div className="sb-page-header-badge">{badge}</div>}
        <h1 className="sb-page-header-title">{title}</h1>
        {subtitle && <p className="sb-page-header-subtitle">{subtitle}</p>}
      </div>

      {actions && <div className="sb-page-header-actions">{actions}</div>}
    </div>
  );
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.node,
  badge: PropTypes.node,
  actions: PropTypes.node,
  className: PropTypes.string,
};

export default PageHeader;
