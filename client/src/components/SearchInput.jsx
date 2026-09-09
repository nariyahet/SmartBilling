import PropTypes from "prop-types";
import "./SearchInput.css";

/**
 * Standardized SmartBilling 2.0 Search Input field
 */
function SearchInput({
  value,
  onChange,
  onClear = null,
  placeholder = "Search...",
  className = "",
  ariaLabel = "Search input",
}) {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: "" } });
    }
  };

  return (
    <div className={`sb-search-field-wrap ${className}`}>
      <span className="sb-search-field-icon" aria-hidden="true">
        🔍
      </span>
      <input
        type="text"
        className="sb-search-field-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          className="sb-search-field-clear"
          onClick={handleClear}
          aria-label="Clear search query"
        >
          ✕
        </button>
      )}
    </div>
  );
}

SearchInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onClear: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};

export default SearchInput;
