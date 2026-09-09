import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import "./KpiCard.css";

/**
 * Standardized SmartBilling 2.0 KPI Card
 */
function KpiCard({
  title,
  value,
  icon = null,
  accent = "blue",
  supportingText = null,
  link = null,
  linkText = null,
  loading = false,
  onClick = undefined,
  className = "",
}) {
  const isClickable = Boolean(link || onClick);

  const cardContent = (
    <>
      <div className="sb-stat-top">
        <span className="sb-stat-title">{title}</span>
        {icon && <span className="sb-stat-icon-wrap">{icon}</span>}
      </div>

      <div className="sb-stat-value-wrap">
        {loading ? (
          <div className="sb-stat-skeleton" aria-hidden="true" />
        ) : (
          <strong className="sb-stat-value">{value}</strong>
        )}
        {supportingText && <span className="sb-stat-sub">{supportingText}</span>}
      </div>

      {link && linkText && (
        <span className="sb-stat-action-link">{linkText} →</span>
      )}
    </>
  );

  const cardClasses = [
    "sb-stat-card",
    `accent-${accent}`,
    isClickable ? "is-clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (link) {
    return (
      <Link to={link} className={cardClasses}>
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} className={cardClasses}>
        {cardContent}
      </div>
    );
  }

  return <div className={cardClasses}>{cardContent}</div>;
}

KpiCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.node,
  accent: PropTypes.oneOf(["blue", "teal", "green", "amber", "red", "navy"]),
  supportingText: PropTypes.node,
  link: PropTypes.string,
  linkText: PropTypes.string,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default KpiCard;
