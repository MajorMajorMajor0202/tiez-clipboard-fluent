import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, LayoutGroup } from "framer-motion";
import { ChevronLeft, ChevronRight, Clipboard, Plus, Trash2 } from "lucide-react";
import type { TabItem } from "../types";

interface FluentTabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onAddTab?: (name: string) => void;
  onDeleteTab?: (tabId: string) => void;
  onDropItemOnTab?: (itemId: number, tabName: string) => void;
  t?: (key: string) => string;
}

export const FluentTabBar = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onDeleteTab,
  onDropItemOnTab,
  t
}: FluentTabBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId?: string;
    tabName?: string;
    isBuiltin?: boolean;
  } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dialogTabName, setDialogTabName] = useState("");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".fluent-tab-context-menu")) return;
      setContextMenu(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleOpenCreateDialog = () => {
    setContextMenu(null);
    setDialogTabName("");
    setIsCreateDialogOpen(true);
    setTimeout(() => dialogInputRef.current?.focus(), 50);
  };

  const handleConfirmCreateDialog = () => {
    const trimmed = dialogTabName.trim();
    if (trimmed && onAddTab) {
      onAddTab(trimmed);
    }
    setIsCreateDialogOpen(false);
    setDialogTabName("");
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

  const isDroppableTab = useCallback((tab: TabItem, index: number) => {
    const isFirstTab = index === 0 || tab.id === "clipboard";
    if (isFirstTab) {
      // Allow dropping onto clipboard tab when viewing another custom tab (to move out/remove)
      return activeTabId !== "clipboard";
    }
    return !tab.isBuiltin;
  }, [activeTabId]);

  const resolveTabFromPoint = useCallback((x: number, y: number): { tab: TabItem; index: number } | null => {
    const el = document.elementFromPoint(x, y);
    const btn = el?.closest(".fluent-tab-item") as HTMLElement | null;
    const tabId = btn?.getAttribute("data-tab-id");
    if (tabId) {
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx >= 0) return { tab: tabs[idx], index: idx };
    }
    return null;
  }, [tabs]);

  const handlePerformDrop = useCallback((tab: TabItem, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTabId(null);
    let idStr = "";
    try {
      idStr = e.dataTransfer.getData("application/x-tiez-item") || e.dataTransfer.getData("text/tiez-item-id");
    } catch {}
    const fallbackId = (window as any).__tiezDraggedItemId;
    const finalId = idStr ? parseInt(idStr, 10) : (typeof fallbackId === "number" ? fallbackId : NaN);
    if (!isNaN(finalId) && onDropItemOnTab) {
      onDropItemOnTab(finalId, tab.name);
    }
    (window as any).__tiezDraggedItemId = null;
  }, [onDropItemOnTab]);

  return (
    <div
      className="fluent-tab-bar-container window-no-drag"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOverTabId(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          isBuiltin: true
        });
      }}
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
        title={t ? t("scroll_left") : "向左滚动"}
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
        onDragOver={(e) => {
          const resolved = resolveTabFromPoint(e.clientX, e.clientY);
          if (resolved && isDroppableTab(resolved.tab, resolved.index)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (dragOverTabId !== resolved.tab.id) {
              setDragOverTabId(resolved.tab.id);
            }
          }
        }}
        onDrop={(e) => {
          const resolved = resolveTabFromPoint(e.clientX, e.clientY);
          const targetTab = resolved?.tab || (dragOverTabId ? tabs.find((t) => t.id === dragOverTabId) : null);
          if (targetTab) {
            const idx = tabs.findIndex((t) => t.id === targetTab.id);
            if (isDroppableTab(targetTab, idx)) {
              handlePerformDrop(targetTab, e);
            }
          }
        }}
      >
        <LayoutGroup id="fluent-tabs">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isFirstTab = index === 0 || tab.id === "clipboard";
            const isDragTarget = dragOverTabId === tab.id;
            const canDrop = isDroppableTab(tab, index);
            return (
              <button
                key={tab.id}
                type="button"
                data-tab-id={tab.id}
                className={`fluent-tab-item ${isActive ? "active" : ""} ${
                  isFirstTab ? "tab-icon-only" : ""
                } ${isDragTarget ? "drag-target-hover" : ""}`}
                onDragEnter={(e) => {
                  if (!canDrop) return;
                  e.preventDefault();
                  if (dragOverTabId !== tab.id) {
                    setDragOverTabId(tab.id);
                  }
                }}
                onDragOver={(e) => {
                  if (!canDrop) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  if (dragOverTabId !== tab.id) {
                    setDragOverTabId(tab.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverTabId === tab.id) {
                    setDragOverTabId(null);
                  }
                }}
                onDrop={(e) => {
                  if (!canDrop) return;
                  handlePerformDrop(tab, e);
                }}
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    tabId: tab.id,
                    tabName: tab.name,
                    isBuiltin: isFirstTab || tab.isBuiltin
                  });
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
        title={t ? t("scroll_right") : "向右滚动"}
      >
        <ChevronRight size={13} strokeWidth={2.6} />
      </button>

      {/* Right-click Context Menu */}
      {contextMenu && createPortal(
        <div
          className="fluent-tab-context-menu"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 150)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 80)}px`
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="fluent-tab-context-item"
            onClick={handleOpenCreateDialog}
          >
            <Plus size={13} />
            <span>{t ? t("new_tab") : "新建标签页..."}</span>
          </button>
          {contextMenu.tabId && !contextMenu.isBuiltin && onDeleteTab && (
            <button
              type="button"
              className="fluent-tab-context-item danger"
              onClick={() => {
                const id = contextMenu.tabId!;
                setContextMenu(null);
                onDeleteTab(id);
              }}
            >
              <Trash2 size={13} />
              <span>{t ? t("delete_tab") : "删除此标签页"}</span>
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Tab Creation Dialog */}
      {isCreateDialogOpen && createPortal(
        <div
          className="fluent-tab-dialog-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsCreateDialogOpen(false);
          }}
        >
          <div className="fluent-tab-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fluent-tab-dialog-title">{t ? t("create_new_tab") : "新建标签页"}</div>
            <input
              ref={dialogInputRef}
              type="text"
              className="fluent-tab-dialog-input"
              placeholder={t ? t("tab_name_placeholder") : "输入标签页名称..."}
              value={dialogTabName}
              onChange={(e) => setDialogTabName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmCreateDialog();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setIsCreateDialogOpen(false);
                }
              }}
              autoFocus
            />
            <div className="fluent-tab-dialog-actions">
              <button
                type="button"
                className="fluent-tab-dialog-btn"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                {t ? t("cancel") : "取消"}
              </button>
              <button
                type="button"
                className="fluent-tab-dialog-btn primary"
                onClick={handleConfirmCreateDialog}
              >
                {t ? t("confirm") : "确定"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FluentTabBar;
