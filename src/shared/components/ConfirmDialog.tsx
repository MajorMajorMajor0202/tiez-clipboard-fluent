interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  theme: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmDialog = ({
  open,
  title,
  message,
  theme,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose
}: ConfirmDialogProps) => {
  if (!open) return null;

  const isDanger = confirmLabel === '删除' || confirmLabel === 'Delete' || confirmLabel === '確定' || confirmLabel === '确定' || confirmLabel === '確定刪除' || confirmLabel === '确定删除';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`confirm-dialog theme-${theme}`} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-upper">
          <div className="confirm-dialog-title">{title}</div>
          <div className="confirm-dialog-message">{message}</div>
        </div>
        <div className="confirm-dialog-lower">
          <div className="confirm-dialog-buttons">
            <button className="confirm-dialog-button" onClick={onClose}>
              {cancelLabel}
            </button>
            <button className={`confirm-dialog-button primary ${isDanger ? 'danger' : ''}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
