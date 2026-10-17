import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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

  // Underline indicator geometry
  const [indicatorRect, setIndicatorRect] = useState<{ left: number; width: number } | null>(null);

  // Measure scrollability
  const updateScrollBounds = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Buffer of 2px for subpixel rendering differences
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  // Update underline indicator position
  const updateIndicator = useCallback(() => {
    const el = trackRef.current;
    if (!el || !activeTabId) {
      setIndicatorRect(null);
      return;
    }
    const activeBtn = el.querySelector(`.fluent-tab-item[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    if (!activeBtn) {
      setIndicatorRect(null);
      return;
    }
    const trackRect = el.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const indicatorWidth = 16;
    setIndicatorRect({
      left: btnRect.left - trackRect.left + (btnRect.width - indicatorWidth) / 2 + el.scrollLeft,
      width: indicatorWidth
    });
  }, [activeTabId]);

  // Handle scroll and resize
  useEffect(() => {
    updateScrollBounds();
    updateIndicator();
  }, [tabs, activeTabId, updateScrollBounds, updateIndicator]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const handleScroll = () => {
      updateScrollBounds();
      updateIndicator();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    const observer = new ResizeObserver(() => {
      updateScrollBounds();
      updateIndicator();
    });
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [updateScrollBounds, updateIndicator]);

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
    // Smoothly hide on mouse leave
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
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              data-tab-id={tab.id}
              className={`fluent-tab-item ${isActive ? "active" : ""}`}
              onClick={() => {
                onSelectTab(tab.id);
                // Ensure the clicked tab scrolls smoothly into visible view
                const el = trackRef.current;
                const btn = el?.querySelector(`.fluent-tab-item[data-tab-id="${tab.id}"]`) as HTMLElement | null;
                if (el && btn) {
                  const trackRect = el.getBoundingClientRect();
                  const btnRect = btn.getBoundingClientRect();
                  if (btnRect.left < trackRect.left + 30) {
                    el.scrollBy({ left: btnRect.left - trackRect.left - 40, behavior: "smooth" });
                  } else if (btnRect.right > trackRect.right - 30) {
                    el.scrollBy({ left: btnRect.right - trackRect.right + 40, behavior: "smooth" });
                  }
                }
              }}
            >
              <span>{tab.name}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className="fluent-tab-badge">{tab.count}</span>
              )}
            </button>
          );
        })}

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

        {/* Animated Accent Underline Indicator */}
        {indicatorRect && (
          <div
            className="fluent-tab-indicator"
            style={{
              transform: `translateX(${indicatorRect.left}px)`,
              width: `${indicatorRect.width}px`
            }}
          >
            <div className="fluent-tab-indicator-inner" />
          </div>
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
