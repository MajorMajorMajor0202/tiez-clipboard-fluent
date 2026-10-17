import { useCallback, useEffect, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Clipboard } from "lucide-react";
import type { TabItem } from "../types";
import FluentTooltip from "../../../shared/components/FluentTooltip";

interface FluentTabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onAddTab?: () => void;
  t?: (key: string) => string;
}

export const FluentTabBar = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  t
}: FluentTabBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measure scrollability
  const updateScrollBounds = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  // Handle scroll and resize bounds
  useEffect(() => {
    updateScrollBounds();
  }, [tabs, activeTabId, updateScrollBounds]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const handleScroll = () => {
      updateScrollBounds();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    const observer = new ResizeObserver(() => {
      updateScrollBounds();
    });
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [updateScrollBounds]);

  // Auto-hide controls when hover is inactive
  const resetHoverTimer = useCallback(() => {
    setIsHovering(true);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 1800);
  }, []);

  const handleMouseEnter = useCallback(() => {
    updateScrollBounds();
    resetHoverTimer();
  }, [resetHoverTimer, updateScrollBounds]);

  const handleMouseMove = useCallback(() => {
    resetHoverTimer();
  }, [resetHoverTimer]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 300);
  }, []);

  const scrollByAmount = useCallback((delta: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
    resetHoverTimer();
  }, [resetHoverTimer]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = trackRef.current;
    if (!el) return;
    if (e.deltaY !== 0 || e.deltaX !== 0) {
      el.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
      resetHoverTimer();
    }
  }, [resetHoverTimer]);

  return (
    <div
      className="fluent-tab-bar-container window-no-drag"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left Paging Floating Button */}
      <button
        type="button"
        className={`fluent-tab-nav-btn nav-left ${
          canScrollLeft && isHovering ? "nav-visible" : "nav-hidden"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          scrollByAmount(-140);
        }}
        onMouseEnter={() => {
          setIsHovering(true);
          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        }}
        tabIndex={-1}
        title="向左滚动"
      >
        <ChevronLeft size={13} strokeWidth={2.6} />
      </button>

      {/* Edge gradient mask left */}
      <div
        className="fluent-tab-edge-gradient fluent-tab-edge-left"
        style={{ opacity: canScrollLeft ? 1 : 0 }}
      />

      {/* Main horizontal scrolling track */}
      <div
        ref={trackRef}
        className="fluent-tab-track hide-scrollbar"
        onWheel={handleWheel}
      >
        <LayoutGroup id="fluent-tabs">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isFirstTab = index === 0 || tab.id === "clipboard";
            return (
              <button
                key={tab.id}
                type="button"
                data-tab-id={tab.id}
                className={`fluent-tab-item ${isActive ? "active" : ""} ${
                  isFirstTab ? "tab-icon-only" : ""
                }`}
                onClick={() => {
                  onSelectTab(tab.id);
                  // Ensure clicked tab is scrolled into view
                  const el = trackRef.current;
                  const btn = el?.querySelector(
                    `.fluent-tab-item[data-tab-id="${tab.id}"]`
                  ) as HTMLElement | null;
                  if (el && btn) {
                    const trackRect = el.getBoundingClientRect();
                    const btnRect = btn.getBoundingClientRect();
                    if (btnRect.left < trackRect.left + 24) {
                      el.scrollBy({
                        left: btnRect.left - trackRect.left - 32,
                        behavior: "smooth"
                      });
                    } else if (btnRect.right > trackRect.right - 24) {
                      el.scrollBy({
                        left: btnRect.right - trackRect.right + 32,
                        behavior: "smooth"
                      });
                    }
                  }
                }}
                title={isFirstTab ? tab.name || (t ? t("clipboard") || "剪贴板" : "剪贴板") : undefined}
                aria-label={tab.name}
              >
                {isFirstTab ? (
                  <Clipboard size={14} strokeWidth={2.2} className="fluent-tab-icon" />
                ) : (
                  <span>{tab.name}</span>
                )}

                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className="fluent-tab-badge">{tab.count}</span>
                )}

                {/* Accent Underline Indicator - follows active tab smoothly */}
                {isActive && (
                  <motion.div
                    layoutId="fluent-tab-active-indicator"
                    layout="position"
                    className="fluent-tab-indicator"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 35
                    }}
                  />
                )}
              </button>
            );
          })}
        </LayoutGroup>

        {/* Add Tab Button */}
        {onAddTab && (
          <FluentTooltip text={t ? t("add_tab") || "新建材料集" : "新建材料集"}>
            <button
              type="button"
              className="fluent-tab-add-btn"
              onClick={onAddTab}
            >
              <Plus size={14} />
            </button>
          </FluentTooltip>
        )}
      </div>

      {/* Edge gradient mask right */}
      <div
        className="fluent-tab-edge-gradient fluent-tab-edge-right"
        style={{ opacity: canScrollRight ? 1 : 0 }}
      />

      {/* Right Paging Floating Button */}
      <button
        type="button"
        className={`fluent-tab-nav-btn nav-right ${
          canScrollRight && isHovering ? "nav-visible" : "nav-hidden"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          scrollByAmount(140);
        }}
        onMouseEnter={() => {
          setIsHovering(true);
          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        }}
        tabIndex={-1}
        title="向右滚动"
      >
        <ChevronRight size={13} strokeWidth={2.6} />
      </button>
    </div>
  );
};

export default FluentTabBar;
