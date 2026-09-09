import PropTypes from "prop-types";
import "./Card.css";

/**
 * Standardized SmartBilling 2.0 Card container
 */
function Card({
  title = null,
  subtitle = null,
  actions = null,
  children,
  footer = null,
  noPadding = false,
  className = "",
}) {
  const hasHeader = Boolean(title || subtitle || actions);

  return (
    <div className={`sb-ui-card ${className}`}>
      {hasHeader && (
        <div className="sb-ui-card-header">
          <div className="sb-ui-card-title-wrap">
            {title && <h3 className="sb-ui-card-title">{title}</h3>}
            {subtitle && <span className="sb-ui-card-subtitle">{subtitle}</span>}
          </div>
          {actions && <div className="sb-ui-card-actions">{actions}</div>}
        </div>
      )}

      <div className={`sb-ui-card-body ${noPadding ? "no-padding" : ""}`}>
        {children}
      </div>

      {footer && <div className="sb-ui-card-footer">{footer}</div>}
    </div>
  );
}

Card.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
  footer: PropTypes.node,
  noPadding: PropTypes.bool,
  className: PropTypes.string,
};

export default Card;
