import type { MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Edit3,
  Eraser,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Settings as SettingsIcon,
  Smile,
  Sparkles,
  Tag,
  Tags,
  Trash2,
  Unlock
} from "lucide-react";
import FluentTooltip from "../../../shared/components/FluentTooltip";

export interface FluentRightRailProps {
  // Global Actions
  onOpenAddEntry?: () => void;
  clearHistory: () => void;

  // Selected Item Actions (Unpacked from Card & More Menu)
  hasSelectedItem: boolean;
  onCopySelectedItem?: () => void;
  onEditContent?: () => void;
  isEditingContent?: boolean;
  onOpenContent?: (e?: ReactMouseEvent) => void;
  onAssignTab?: () => void;
  isTabFlyoutOpen?: boolean;
  isTabAssigned?: boolean;
  onAssignTag?: () => void;
  isEditingTags?: boolean;
  hasTags?: boolean;
  onTogglePin?: (e: ReactMouseEvent) => void;
  isPinned: boolean;
  onPinToDesktop?: () => void;
  onToggleLock?: (e: ReactMouseEvent) => void;
  isLocked: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleReveal?: () => void;
  isRevealed?: boolean;
  hasSensitiveTag?: boolean;
  onAIAction?: () => void;
  isAIOpen?: boolean;
  isAIProcessing?: boolean;
  canAI?: boolean;
  onDeleteSelectedItem?: (e?: ReactMouseEvent) => void;

  // Bottom Navigation & Subpages
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
  hasSelectedItem,
  onCopySelectedItem,
  onEditContent,
  isEditingContent,
  onOpenContent,
  onAssignTab,
  isTabFlyoutOpen,
  isTabAssigned,
  onAssignTag,
  isEditingTags,
  hasTags,
  onTogglePin,
  isPinned,
  onPinToDesktop,
  onToggleLock,
  isLocked,
  onMoveUp,
  onMoveDown,
  onToggleReveal,
  isRevealed,
  hasSensitiveTag,
  onAIAction,
  isAIOpen,
  isAIProcessing,
  canAI,
  onDeleteSelectedItem,
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
      {/* 1. Item Action Controls (Unpacked from Card & More Menu) */}
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

        <div className="rail-divider" />

        {/* Copy / Paste Selected Item */}
        {onCopySelectedItem && (
          <FluentTooltip text={t("paste_item") || "复制/粘贴选中项 (双击条目也可粘贴)"}>
            <button
              type="button"
              className="rail-btn"
              onClick={onCopySelectedItem}
              disabled={!hasSelectedItem}
              aria-label="Paste selected item"
            >
              <Copy size={15} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Edit Content */}
        {onEditContent && (
          <FluentTooltip text={t("edit_content") || "编辑选中条目内容"}>
            <button
              type="button"
              className={`rail-btn ${isEditingContent ? "active" : ""}`}
              onClick={onEditContent}
              disabled={!hasSelectedItem}
              aria-label="Edit content"
            >
              <Edit3 size={15} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* External Open */}
        {onOpenContent && (
          <FluentTooltip text={t("open") || "外部打开选中条目"}>
            <button
              type="button"
              className="rail-btn"
              onClick={onOpenContent}
              disabled={!hasSelectedItem}
              aria-label="Open externally"
            >
              <ExternalLink size={15} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Assign to Tab */}
        {onAssignTab && (
          <FluentTooltip text={t("add_to_tab") || "归入标签页"}>
            <button
              type="button"
              className={`rail-btn ${isTabFlyoutOpen || isTabAssigned ? "active" : ""}`}
              onClick={onAssignTab}
              disabled={!hasSelectedItem}
              aria-label="Assign to tab"
            >
              <FolderPlus size={15} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Assign Tag */}
        {onAssignTag && (
          <FluentTooltip text={t("tags") || "设置标签"}>
            <button
              type="button"
              className={`rail-btn ${isEditingTags || hasTags ? "active" : ""}`}
              onClick={onAssignTag}
              disabled={!hasSelectedItem}
              aria-label="Set tags"
            >
              <Tag size={15} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Pin to Top */}
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
              {isPinned ? <PinOff size={15} strokeWidth={2} /> : <Pin size={15} strokeWidth={2} />}
            </button>
          </FluentTooltip>
        )}

        {/* Pin to Desktop Floating Sticker */}
        {onPinToDesktop && (
          <FluentTooltip text={t("pin_to_desktop") || "固定到桌面浮窗 (贴图便签)"}>
            <button
              type="button"
              className="rail-btn"
              onClick={onPinToDesktop}
              disabled={!hasSelectedItem}
              aria-label="Pin to desktop"
            >
              <Layers size={15} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Lock Item Protection */}
        {onToggleLock && (
          <FluentTooltip
            text={
              isLocked
                ? "已锁定保护 (防清空/防删除)"
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

        {/* Move Item Up */}
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

        {/* Move Item Down */}
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

        {/* Sensitive Content Reveal / Hide */}
        {onToggleReveal && (hasSensitiveTag || isRevealed) && (
          <FluentTooltip text={isRevealed ? t("hide") || "隐藏敏感内容" : t("reveal") || "显示敏感内容"}>
            <button
              type="button"
              className={`rail-btn ${isRevealed ? "active" : ""}`}
              onClick={onToggleReveal}
              disabled={!hasSelectedItem}
              aria-label="Toggle reveal"
            >
              {isRevealed ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
            </button>
          </FluentTooltip>
        )}

        {/* AI Assistant */}
        {onAIAction && canAI && (
          <FluentTooltip text={t("ai_assistant") || "AI 助手"}>
            <button
              type="button"
              className={`rail-btn ${isAIOpen ? "active" : ""}`}
              onClick={onAIAction}
              disabled={!hasSelectedItem || isAIProcessing}
              aria-label="AI assistant"
            >
              {isAIProcessing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} strokeWidth={2} />
              )}
            </button>
          </FluentTooltip>
        )}

        <div className="rail-divider" />

        {/* Delete Selected Item */}
        {onDeleteSelectedItem && (
          <FluentTooltip text={t("delete") || "删除选中条目"}>
            <button
              type="button"
              className="rail-btn rail-btn-danger"
              onClick={onDeleteSelectedItem}
              disabled={!hasSelectedItem}
              aria-label="Delete selected item"
            >
              <Trash2 size={15} strokeWidth={2} />
            </button>
          </FluentTooltip>
        )}

        {/* Clear All History */}
        <FluentTooltip text={t("clear_history") || "清空全部历史 (保留置顶/锁定)"}>
          <button
            type="button"
            className="rail-btn rail-btn-danger"
            onClick={clearHistory}
            aria-label="Clear all history"
          >
            <Eraser size={15} strokeWidth={2} />
          </button>
        </FluentTooltip>
      </div>

      {/* Rail Divider */}
      <div className="rail-divider" />

      {/* 2. Bottom Section: Feature Navigation */}
      <div className="rail-bottom-section">
        {tagManagerEnabled && (
          <FluentTooltip text={t("tag_manager") || "标签管理中心"}>
            <button
              type="button"
              className={`rail-btn ${showTagManager ? "active" : ""}`}
              onClick={() => setShowTagManager(!showTagManager)}
              aria-label="Tag manager"
            >
              <Tags size={16} strokeWidth={2} />
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
