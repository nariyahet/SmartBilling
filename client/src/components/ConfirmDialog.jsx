import PropTypes from "prop-types";
import Modal from "./Modal";
import Button from "./Button";

/**
 * Standardized SmartBilling 2.0 Confirmation Dialog
 */
function ConfirmDialog({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed with this action?",
  detail = null,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const iconMap = {
    danger: "⚠️",
    warning: "⚠️",
    primary: "ℹ️",
  };

  const footer = (
    <>
      <Button
        variant="secondary"
        onClick={onCancel}
        disabled={loading}
      >
        {cancelText}
      </Button>
      <Button
        variant={variant}
        onClick={onConfirm}
        loading={loading}
      >
        {confirmText}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={footer}
    >
      <div className="sb-confirm-dialog-content">
        <div className={`sb-confirm-dialog-icon variant-${variant}`}>
          {iconMap[variant] || "⚠️"}
        </div>
        <div className="sb-confirm-dialog-texts">
          <p className="sb-confirm-dialog-msg">{message}</p>
          {detail && <p className="sb-confirm-dialog-detail">{detail}</p>}
        </div>
      </div>
    </Modal>
  );
}

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.node,
  message: PropTypes.node,
  detail: PropTypes.node,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(["danger", "warning", "primary"]),
  loading: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmDialog;
