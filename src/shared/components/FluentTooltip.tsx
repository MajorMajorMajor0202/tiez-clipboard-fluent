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
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');
  const [realWidth, setRealWidth] = useState<number | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tooltipRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const width = node.getBoundingClientRect().width;
      setRealWidth(width);
    }
  }, []);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      
      const expectedHeight = 32;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let nextPlacement: 'top' | 'bottom' = 'bottom';
      if (spaceBelow < expectedHeight + 8 && spaceAbove > spaceBelow) {
        nextPlacement = 'top';
      }
      
      const top = nextPlacement === 'top' ? rect.top - 12 : rect.bottom + 12;
      setPos({ left: cx, top });
      setPlacement(nextPlacement);
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
    setRealWidth(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Measure exact width based on Chinese/English character sizes
  const getTextWidth = (str: string): number => {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 255) {
        len += 12; // Chinese/full-width character
      } else {
        len += 7; // English/half-width character
      }
    }
    return Math.min(len + 20, 240); // Clamp to max-width
  };

  const estW = realWidth || getTextWidth(text);

  // Clamp horizontal position within viewport
  const adjustedPos =
    pos
      ? (() => {
          let left = pos.left - estW / 2;
          const vw = window.innerWidth;
          const margin = 8;
          if (left < margin) left = margin;
          if (left + estW > vw - margin) left = vw - estW - margin;
          
          // Calculate arrow offset relative to the tooltip left edge
          const arrowLeft = Math.max(12, Math.min(pos.left - left, estW - 12));
          
          return { left, top: pos.top, arrowLeft };
        })()
      : null;

  const tooltip =
    visible && adjustedPos
      ? createPortal(
          <div
            ref={tooltipRef}
            className={`fluent-tooltip placement-${placement} ${visible ? "fluent-tooltip-visible" : "fluent-tooltip-enter"}`}
            style={{
              position: "absolute",
              left: adjustedPos.left,
              top: adjustedPos.top,
              ["--arrow-left" as any]: `${adjustedPos.arrowLeft}px`,
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
      style={{ display: "inline-flex" }}
    >
      {children}
      {tooltip}
    </span>
  );
};

export default FluentTooltip;
