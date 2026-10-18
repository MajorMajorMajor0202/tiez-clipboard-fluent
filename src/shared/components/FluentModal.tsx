import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";

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
  useEffect(() => {
    if (!open) return;

    // Prevent Tauri from closing on blur while modal is open and ensure window receives OS keyboard focus
    invoke("set_ignore_blur", { ignore: true }).catch(() => {});
    invoke("activate_window_focus").catch(() => {});
    invoke("focus_clipboard_window").catch(() => {});

    const timer = setTimeout(() => {
      invoke("activate_window_focus").catch(() => {});
      const dialog = document.querySelector(".fluent-modal-dialog");
      if (dialog) {
        const editable = dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "[autofocus], textarea, input:not([type=hidden])"
        );
        editable?.focus();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      invoke("set_ignore_blur", { ignore: false }).catch(() => {});
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const themeClass = theme ? `theme-${theme}` : "";

  return createPortal(
    <div
      className={`fluent-modal-overlay ${themeClass} ${overlayClassName}`.trim()}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className={`fluent-modal-dialog ${className}`.trim()}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          invoke("activate_window_focus").catch(() => {});
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="fluent-modal-upper">
          {(title || subtitle || icon) && (
            <div className="fluent-modal-header">
              {icon && <div className="fluent-modal-icon">{icon}</div>}
              <div className="fluent-modal-titles">
                {title && <h3 className="fluent-modal-title">{title}</h3>}
                {subtitle && <div className="fluent-modal-subtitle">{subtitle}</div>}
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
      </div>
    </div>,
    document.body
  );
};

export default FluentModal;
