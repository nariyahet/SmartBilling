import { useEffect } from "react";
import "./Modal.css";

/**
 * Standardized SmartBilling 2.0 Accessible Modal
 */
function Modal({
  isOpen,
  onClose,
  title = null,
  subtitle = null,
  children,
  footer = null,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = "",
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div
      className="sb-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className={`sb-modal-box size-${size} ${className}`}>
        {(title || onClose) && (
          <div className="sb-modal-header">
            <div className="sb-modal-title-wrap">
              {title && <h2 className="sb-modal-title">{title}</h2>}
              {subtitle && <span className="sb-modal-subtitle">{subtitle}</span>}
            </div>
            {onClose && (
              <button
                type="button"
                className="sb-modal-close-btn"
                onClick={onClose}
                aria-label="Close modal"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="sb-modal-body">{children}</div>

        {footer && <div className="sb-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
