import type { MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Eraser,
  Lock,
  MessageSquare,
  Plus,
  Settings as SettingsIcon,
  Smile,
  Tag,
  Unlock
} from "lucide-react";
import FluentTooltip from "../../../shared/components/FluentTooltip";

export interface FluentRightRailProps {
  // Item Actions (CopyQ style)
  onOpenAddEntry?: () => void;
  clearHistory: () => void;
  onTogglePin?: (e: ReactMouseEvent) => void;
  onToggleLock?: (e: ReactMouseEvent) => void;
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
  return (
    <aside className="fluent-right-rail window-no-drag">
      {/* 1. Item Action Controls (CopyQ style) */}
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

      {/* 2. Bottom Section: Feature Navigation */}
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
    </aside>
  );
};

export default FluentRightRail;
