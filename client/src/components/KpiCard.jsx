import { Link } from "react-router-dom";
import "./KpiCard.css";

/**
 * Standardized SmartBilling 2.0 KPI Card
 */
function KpiCard({
  title,
  label,
  value,
  icon = null,
  accent = "blue",
  supportingText = null,
  subtext = null,
  link = null,
  linkText = null,
  loading = false,
  onClick = undefined,
  className = "",
}) {
  const isClickable = Boolean(link || onClick);
  const displayTitle = title || label;
  const displaySubtext = supportingText || subtext;
  const normalizedAccent = accent === "danger" ? "red" : accent;

  const cardContent = (
    <>
      <div className="sb-stat-top">
        <span className="sb-stat-title">{displayTitle}</span>
        {icon && <span className="sb-stat-icon-wrap">{icon}</span>}
      </div>

      <div className="sb-stat-value-wrap">
        {loading ? (
          <div className="sb-stat-skeleton" aria-hidden="true" />
        ) : (
          <strong className="sb-stat-value">{value}</strong>
        )}
        {displaySubtext && <span className="sb-stat-sub">{displaySubtext}</span>}
      </div>

      {link && linkText && (
        <span className="sb-stat-action-link">{linkText} →</span>
      )}
    </>
  );

  const cardClasses = [
    "sb-stat-card",
    `accent-${normalizedAccent}`,
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

export default KpiCard;
