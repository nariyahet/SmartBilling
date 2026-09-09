import PropTypes from "prop-types";
import "./Button.css";

/**
 * Standardized SmartBilling 2.0 Button component
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  icon = null,
  iconRight = null,
  loading = false,
  disabled = false,
  fullWidth = false,
  type = "button",
  onClick = undefined,
  className = "",
  title = undefined,
  ...rest
}) {
  const classes = [
    "sb-ui-btn",
    `variant-${variant}`,
    `size-${size}`,
    fullWidth ? "is-full-width" : "",
    loading ? "is-loading" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <>
          <span className="sb-btn-spinner" aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon && <span className="sb-btn-icon-wrap">{icon}</span>}
          {children && <span>{children}</span>}
          {iconRight && <span className="sb-btn-icon-wrap">{iconRight}</span>}
        </>
      )}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "teal",
    "success",
    "warning",
    "danger",
    "ghost",
  ]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  icon: PropTypes.node,
  iconRight: PropTypes.node,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  onClick: PropTypes.func,
  className: PropTypes.string,
  title: PropTypes.string,
};

export default Button;
