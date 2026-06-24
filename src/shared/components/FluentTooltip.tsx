import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface FluentTooltipProps {
  text: string;
  children: React.ReactNode;
}

const SHOW_DELAY = 200;

// Shared portal container — one per app, reused by all tooltip instances
let sharedPortalRoot: HTMLDivElement | null = null;
function getPortalRoot(): HTMLDivElement {
  if (!sharedPortalRoot && typeof document !== "undefined") {
    sharedPortalRoot = document.createElement("div");
    sharedPortalRoot.className = "fluent-tooltip-portal";
    document.body.appendChild(sharedPortalRoot);
  }
  return sharedPortalRoot!;
}

const FluentTooltip = ({ text, children }: FluentTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const top = rect.bottom + 6;
      setPos({ left: cx, top });
      setVisible(true);
    }, SHOW_DELAY);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    setPos(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Clamp horizontal position within viewport
  const adjustedPos =
    pos
      ? (() => {
          const estW = Math.min(text.length * 8 + 20, 240);
          let left = pos.left - estW / 2;
          const vw = window.innerWidth;
          const margin = 8;
          if (left < margin) left = margin;
          if (left + estW > vw - margin) left = vw - estW - margin;
          return { left, top: pos.top };
        })()
      : null;

  const tooltip =
    visible && adjustedPos
      ? createPortal(
          <div
            className={`fluent-tooltip ${visible ? "fluent-tooltip-visible" : "fluent-tooltip-enter"}`}
            style={{
              position: "absolute",
              left: adjustedPos.left,
              top: adjustedPos.top,
            }}
          >
            {text}
          </div>,
          getPortalRoot()
        )
      : null;

  return (
    <span
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: "inline-flex" }}
    >
      {children}
      {tooltip}
    </span>
  );
};

export default FluentTooltip;
