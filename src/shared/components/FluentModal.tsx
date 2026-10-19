import React, { useEffect, useId } from "react";
import { Dialog, DialogSurface, DialogTitle } from "@fluentui/react-components";
import { isTauriRuntime } from "../lib/tauriRuntime";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

let openNativeModals = 0;

export interface FluentModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  maxWidth?: number | string;
  className?: string;
  overlayClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  theme?: string;
}

const FluentModal: React.FC<FluentModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width,
  maxWidth,
  className = "",
  overlayClassName = "",
  closeOnOverlayClick = true,
  closeOnEscape = true,
  theme,
}) => {
  const titleId = useId();
  const subtitleId = useId();
  useEffect(() => {
    if (!open || !isTauriRuntime()) return;
    if (++openNativeModals === 1) invoke("set_ignore_blur", { ignore: true }).catch(console.error);
    const win = getCurrentWindow();
    if (win.label === "main") invoke("activate_window_focus").catch(console.error);
    else win.setFocus().catch(console.error);
    return () => {
      if (--openNativeModals === 0) invoke("set_ignore_blur", { ignore: false }).catch(console.error);
    };
  }, [open]);

  const themeClass = theme ? `theme-${theme}` : "";

  return (
    <Dialog open={open} onOpenChange={(_event, data) => {
      if (data.open) return;
      if (data.type === "escapeKeyDown" && !closeOnEscape) return;
      if (data.type === "backdropClick" && !closeOnOverlayClick) return;
      onClose();
    }}>
      <DialogSurface
        className={`fluent-modal-dialog tiez-official-dialog ${themeClass} ${className}`.trim()}
        backdrop={{ className: `fluent-modal-overlay ${themeClass} ${overlayClassName}`.trim() }}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "对话框"}
        aria-describedby={subtitle ? subtitleId : undefined}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        }}
      >
        <div className="fluent-modal-upper">
          {(title || subtitle || icon) && (
            <div className="fluent-modal-header">
              {icon && <div className="fluent-modal-icon">{icon}</div>}
              <div className="fluent-modal-titles">
                {title && <DialogTitle id={titleId} className="fluent-modal-title">{title}</DialogTitle>}
                {subtitle && <div id={subtitleId} className="fluent-modal-subtitle">{subtitle}</div>}
              </div>
            </div>
          )}
          {children && <div className="fluent-modal-body">{children}</div>}
        </div>
        {footer && (
          <div className="fluent-modal-lower">
            <div className="fluent-modal-actions">{footer}</div>
          </div>
        )}
      </DialogSurface>
    </Dialog>
  );
};

export default FluentModal;
