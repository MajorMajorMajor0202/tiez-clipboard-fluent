import { useCallback, useEffect, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Clipboard, X, Check } from "lucide-react";
import type { TabItem } from "../types";
import FluentTooltip from "../../../shared/components/FluentTooltip";

interface FluentTabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onAddTab?: (name: string) => void;
  onDeleteTab?: (tabId: string) => void;
  t?: (key: string) => string;
}

export const FluentTabBar = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onDeleteTab,
  t
}: FluentTabBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const newTabInputRef = useRef<HTMLInputElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleConfirmCreate = () => {
    const trimmed = newTabName.trim();
    if (trimmed && onAddTab) {
      onAddTab(trimmed);
    }
    setIsCreatingTab(false);
    setNewTabName("");
  };

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
                <span className="fluent-tab-content">
                  {isFirstTab ? (
                    <Clipboard size={14} strokeWidth={2.2} className="fluent-tab-icon" />
                  ) : (
                    <span>{tab.name}</span>
                  )}

                  {typeof tab.count === "number" && tab.count > 0 && (
                    <span className="fluent-tab-badge">{tab.count}</span>
                  )}

                  {!isFirstTab && onDeleteTab && (
                    <span
                      className="fluent-tab-close-btn"
                      title={t ? t("delete_tab") || "删除标签页" : "删除标签页"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTab(tab.id);
                      }}
                    >
                      <X size={10} strokeWidth={2} />
                    </span>
                  )}
                </span>

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

        {/* Add Tab Button / Inline Create */}
        {isCreatingTab ? (
          <div className="fluent-tab-create-box">
            <input
              ref={newTabInputRef}
              type="text"
              className="fluent-tab-create-input"
              placeholder={t ? t("tab_name_placeholder") || "标签页名称..." : "标签页名称..."}
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmCreate();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setIsCreatingTab(false);
                  setNewTabName("");
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className="fluent-tab-create-btn confirm"
              onClick={handleConfirmCreate}
              title={t ? t("confirm") || "确定" : "确定"}
            >
              <Check size={12} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="fluent-tab-create-btn cancel"
              onClick={() => {
                setIsCreatingTab(false);
                setNewTabName("");
              }}
              title={t ? t("cancel") || "取消" : "取消"}
            >
              <X size={12} strokeWidth={2.4} />
            </button>
          </div>
        ) : onAddTab ? (
          <FluentTooltip text={t ? t("add_tab") || "新建标签页" : "新建标签页"}>
            <button
              type="button"
              className="fluent-tab-add-btn"
              onClick={() => {
                setIsCreatingTab(true);
                setNewTabName("");
                setTimeout(() => {
                  newTabInputRef.current?.focus();
                  if (trackRef.current) {
                    trackRef.current.scrollTo({
                      left: trackRef.current.scrollWidth,
                      behavior: "smooth"
                    });
                  }
                }, 50);
              }}
            >
              <Plus size={14} />
            </button>
          </FluentTooltip>
        ) : null}
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
