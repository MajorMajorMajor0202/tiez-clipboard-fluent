import React from "react";
import FluentModal from "./FluentModal";
import FluentButton from "./FluentButton";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  theme?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  isDanger?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  theme,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  isDanger: explicitDanger,
}) => {
  const isDanger =
    explicitDanger ??
    (confirmLabel === "删除" ||
      confirmLabel === "Delete" ||
      confirmLabel === "確定" ||
      confirmLabel === "确定" ||
      confirmLabel === "確定刪除" ||
      confirmLabel === "确定删除");

  return (
    <FluentModal
      open={open}
      onClose={onClose}
      title={title}
      theme={theme}
      width={340}
      footer={
        <>
          <FluentButton variant="secondary" onClick={onClose}>
            {cancelLabel}
          </FluentButton>
          <FluentButton
            variant={isDanger ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </FluentButton>
        </>
      }
    >
      <div className="fluent-modal-text">{message}</div>
    </FluentModal>
  );
};

export default ConfirmDialog;
