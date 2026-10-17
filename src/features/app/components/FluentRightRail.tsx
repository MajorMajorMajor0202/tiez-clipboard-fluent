import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Clipboard,
  Eraser,
  Folder,
  Lock,
  MessageSquare,
  Plus,
  Settings as SettingsIcon,
  Smile,
  Tag,
  Trash2,
  Unlock
} from "lucide-react";
import FluentTooltip from "../../../shared/components/FluentTooltip";
import type { TabItem } from "../types";

export interface FluentRightRailProps {
  // Tabs
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onAddTab?: (name: string) => void;
  onDeleteTab?: (tabId: string) => void;
  onDropItemOnTab?: (itemId: number, tabName: string) => void;
  onDropExternalFilesOnTab?: (paths: string[], tabIdOrName: string) => void;
  onDropExternalTextOnTab?: (text: string, tabIdOrName: string) => void;

  // Item Actions (CopyQ style)
  onOpenAddEntry?: () => void;
  clearHistory: () => void;
  onTogglePin?: (e: React.MouseEvent) => void;
  onToggleLock?: (e: React.MouseEvent) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;

  // Status
  hasSelectedItem: boolean;
  isPinned: boolean;
  isLocked: boolean;

  // Navigation & Subpages
  showTagManager: boolean;
  setShowTagManager: (val: boolean) => void;
  tagManagerEnabled: boolean;
  showEmojiPanel: boolean;
  setShowEmojiPanel: (val: boolean) => void;
  emojiPanelEnabled: boolean;
  chatMode: boolean;
  fileServerEnabled: boolean;
  onToggleChat: () => void;
  onOpenSettings: () => void;
  t: (key: string) => string;
}

export const FluentRightRail = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onDeleteTab,
  onDropItemOnTab,
  onDropExternalFilesOnTab,
  onDropExternalTextOnTab,

  onOpenAddEntry,
  clearHistory,
  onTogglePin,
  onToggleLock,
  onMoveUp,
  onMoveDown,

  hasSelectedItem,
  isPinned,
  isLocked,

  showTagManager,
  setShowTagManager,
  tagManagerEnabled,
  showEmojiPanel,
  setShowEmojiPanel,
  emojiPanelEnabled,
  chatMode,
  fileServerEnabled,
  onToggleChat,
  onOpenSettings,
  t
}: FluentRightRailProps) => {
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId?: string;
    tabName?: string;
    isBuiltin?: boolean;
  } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dialogTabName, setDialogTabName] = useState("");
  const dialogInputRef = useRef<HTMLInputElement>(null);

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

  const handlePerformDrop = useCallback((tab: TabItem, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTabId(null);

    // 1. Check for internal item drag
    let idStr = "";
    try {
      idStr = e.dataTransfer.getData("application/x-tiez-item") || e.dataTransfer.getData("text/tiez-item-id");
    } catch {}
    const fallbackId = (window as any).__tiezDraggedItemId;
    const finalId = idStr ? parseInt(idStr, 10) : (typeof fallbackId === "number" ? fallbackId : NaN);
    if (!isNaN(finalId)) {
      if (onDropItemOnTab) {
        onDropItemOnTab(finalId, tab.id);
      }
      (window as any).__tiezDraggedItemId = null;
      return;
    }

    // 2. Check for external files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = Array.from(e.dataTransfer.files)
        .map((f) => (f as any).path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (paths.length > 0 && onDropExternalFilesOnTab) {
        onDropExternalFilesOnTab(paths, tab.id);
        return;
      }
    }

    // 3. Check for external text / URLs
    let droppedText = "";
    try {
      droppedText = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    } catch {}

    if (droppedText && droppedText.trim().length > 0 && onDropExternalTextOnTab) {
      onDropExternalTextOnTab(droppedText.trim(), tab.id);
      return;
    }
  }, [onDropItemOnTab, onDropExternalFilesOnTab, onDropExternalTextOnTab]);

  return (
    <aside className="fluent-right-rail window-no-drag">
      {/* 1. Top Section: Vertical Tab Bar */}
      <div className="rail-section">
        <div className="rail-tabs-scroll hide-scrollbar">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isFirstTab = index === 0 || tab.id === "clipboard";
            const isDragTarget = dragOverTabId === tab.id;

            return (
              <FluentTooltip key={tab.id} text={tab.name || (t ? t("clipboard") || "剪贴板" : "剪贴板")}>
                <button
                  type="button"
                  data-tab-id={tab.id}
                  className={`rail-tab-btn ${isActive ? "active" : ""} ${isDragTarget ? "drag-target-hover" : ""}`}
                  onClick={() => onSelectTab(tab.id)}
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (dragOverTabId !== tab.id) setDragOverTabId(tab.id);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dragOverTabId === tab.id) setDragOverTabId(null);
                  }}
                  onDrop={(e) => handlePerformDrop(tab, e)}
                  aria-label={tab.name}
                >
                  {/* Vertical Accent Pill Indicator */}
                  {isActive && <div className="rail-tab-indicator" />}

                  {isFirstTab ? (
                    <Clipboard size={16} strokeWidth={2.2} />
                  ) : (
                    <span className="rail-tab-chip">
                      {tab.name ? tab.name.slice(0, 2) : <Folder size={14} />}
                    </span>
                  )}
                </button>
              </FluentTooltip>
            );
          })}
        </div>

        {/* Add Tab Button */}
        {onAddTab && (
          <FluentTooltip text={t("new_tab") || "新建标签页"}>
            <button
              type="button"
              className="rail-btn"
              onClick={handleOpenCreateDialog}
              aria-label="New Tab"
            >
              <Plus size={14} strokeWidth={2.4} />
            </button>
          </FluentTooltip>
        )}
      </div>

      {/* Rail Divider */}
      <div className="rail-divider" />

      {/* 2. Middle Section: CopyQ-style Item Controls */}
      <div className="rail-actions-scroll hide-scrollbar">
        {/* Add New Entry */}
        {onOpenAddEntry && (
          <FluentTooltip text={t("add_item") || "新建条目"}>
            <button
              type="button"
              className="rail-btn"
              onClick={onOpenAddEntry}
              aria-label="Add entry"
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Pin to Top (CopyQ) */}
        {onTogglePin && (
          <FluentTooltip
            text={
              isPinned
                ? t("unpin") || "取消置顶"
                : t("pin_to_top") || "置顶当前条目"
            }
          >
            <button
              type="button"
              className={`rail-btn ${isPinned ? "active" : ""}`}
              onClick={onTogglePin}
              disabled={!hasSelectedItem}
              aria-label="Pin to top"
            >
              <ArrowUpToLine size={16} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Lock Item Protection (CopyQ) */}
        {onToggleLock && (
          <FluentTooltip
            text={
              isLocked
                ? "已锁定保护 (点击解除)"
                : "锁定保护 (防清空/防删除)"
            }
          >
            <button
              type="button"
              className={`rail-btn ${isLocked ? "active" : ""}`}
              onClick={onToggleLock}
              disabled={!hasSelectedItem}
              aria-label="Lock protection"
            >
              {isLocked ? (
                <Lock size={15} strokeWidth={2.2} />
              ) : (
                <Unlock size={15} strokeWidth={2} />
              )}
            </button>
          </FluentTooltip>
        )}

        {/* Move Item Up (CopyQ) */}
        {onMoveUp && (
          <FluentTooltip text="上移选中项">
            <button
              type="button"
              className="rail-btn"
              onClick={onMoveUp}
              disabled={!hasSelectedItem}
              aria-label="Move item up"
            >
              <ArrowUp size={15} strokeWidth={2.2} />
            </button>
          </FluentTooltip>
        )}

        {/* Move Item Down (CopyQ) */}
        {onMoveDown && (
          <FluentTooltip text="下移选中项">
            <button
              type="button"
              className="rail-btn"
              onClick={onMoveDown}
              disabled={!hasSelectedItem}
              aria-label="Move item down"
            >
              <ArrowDown size={15} strokeWidth={2.2} />
            </button>
          </FluentTooltip>
        )}

        {/* Clear All History (Distinct icon from single item delete) */}
        <FluentTooltip text={t("clear_history") || "清空全部历史 (保留置顶)"}>
          <button
            type="button"
            className="rail-btn rail-btn-danger"
            onClick={clearHistory}
            aria-label="Clear all history"
          >
            <Eraser size={16} strokeWidth={2} />
          </button>
        </FluentTooltip>
      </div>

      {/* Rail Divider */}
      <div className="rail-divider" />

      {/* 3. Bottom Section: Feature Navigation */}
      <div className="rail-bottom-section">
        {tagManagerEnabled && (
          <FluentTooltip text={t("tag_manager") || "标签管理"}>
            <button
              type="button"
              className={`rail-btn ${showTagManager ? "active" : ""}`}
              onClick={() => setShowTagManager(!showTagManager)}
              aria-label="Tag manager"
            >
              <Tag size={16} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {emojiPanelEnabled && (
          <FluentTooltip text={t("emoji_panel") || "表情包"}>
            <button
              type="button"
              className={`rail-btn ${showEmojiPanel ? "active" : ""}`}
              onClick={() => setShowEmojiPanel(!showEmojiPanel)}
              aria-label="Emoji panel"
            >
              <Smile size={16} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {fileServerEnabled && (
          <FluentTooltip text="局域网文件传输">
            <button
              type="button"
              className={`rail-btn ${chatMode ? "active" : ""}`}
              onClick={onToggleChat}
              aria-label="File transfer chat"
            >
              <MessageSquare size={16} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        <FluentTooltip text={t("settings") || "设置"}>
          <button
            type="button"
            className="rail-btn"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <SettingsIcon size={16} strokeWidth={2} />
          </button>
        </FluentTooltip>
      </div>

      {/* Right-click Context Menu for Tabs */}
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
    </aside>
  );
};

export default FluentRightRail;
