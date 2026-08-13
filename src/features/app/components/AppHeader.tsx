import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  MessageSquare,
  Pin,
  PinOff,
  Search,
  Settings as SettingsIcon,
  Smile,
  Tag,
  Trash2,
  X
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getTagColor, getTagTextColor } from "../../../shared/lib/utils";
import FluentTooltip from "../../../shared/components/FluentTooltip";

interface AppHeaderProps {
  t: (key: string) => string;
  showSettings: boolean;
  setShowSettings: (val: boolean) => void;
  showTagManager: boolean;
  setShowTagManager: (val: boolean) => void;
  tagManagerEnabled: boolean;
  showEmojiPanel: boolean;
  setShowEmojiPanel: (val: boolean) => void;
  emojiPanelEnabled: boolean;
  chatMode: boolean;
  fileServerEnabled: boolean;
  isWindowPinned: boolean;
  setIsWindowPinned: (val: boolean) => void;
  clearHistory: () => void;
  showSearchBox: boolean;
  search: string;
  setSearch: (val: string) => void;
  setIsComposing: (val: boolean) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  showTagFilter: boolean;
  setShowTagFilter: (val: boolean) => void;
  allTags: string[];
  searchIsFocused: boolean;
  setSearchIsFocused: (val: boolean) => void;
  setEditingTagsId: (val: number | null) => void;
  theme: string;
  settingsTitle: string;
  typeFilter: string | null;
  setTypeFilter: (val: string | null) => void;
  onBack: () => void;
  onToggleChat: () => void;
  tagColors?: Record<string, string>;
}

const AppHeader = ({
  t,
  showSettings,
  showTagManager,
  setShowTagManager,
  tagManagerEnabled,
  showEmojiPanel,
  setShowEmojiPanel,
  emojiPanelEnabled,
  chatMode,
  fileServerEnabled,
  isWindowPinned,
  setIsWindowPinned,
  clearHistory,
  showSearchBox,
  search,
  setSearch,
  setIsComposing,
  searchInputRef,
  showTagFilter,
  setShowTagFilter,
  allTags,
  searchIsFocused,
  setSearchIsFocused,
  setEditingTagsId,
  theme,
  settingsTitle,
  typeFilter,
  setTypeFilter,
  onBack,
  onToggleChat,
  tagColors
}: AppHeaderProps) => {
  const getTypeName = (type: string) => {
    switch (type) {
      case "code": return t('type_code');
      case "link":
      case "url": return t('type_url');
      case "file": return t('type_file');
      case "image": return t('type_image');
      case "video": return t('type_video');
      case "rich_text": return t('type_rich_text');
      default: return t('type_text') || 'Text';
    }
  };

  // Shared indicator for type filter — slides between active buttons
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [indicatorRect, setIndicatorRect] = useState<{ left: number; width: number } | null>(null);
  const prevFilter = useRef<string | null>(null);

  const updateIndicator = useCallback(() => {
    if (!filterBarRef.current || !typeFilter) {
      setIndicatorRect(null);
      return;
    }
    const activeBtn = filterBarRef.current.querySelector('.type-filter-btn.active') as HTMLElement | null;
    if (!activeBtn) {
      setIndicatorRect(null);
      return;
    }
    const barRect = filterBarRef.current.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    setIndicatorRect({
      left: btnRect.left - barRect.left + (btnRect.width - 16) / 2,
      width: 16,
    });
  }, [typeFilter]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Re-measure on resize
  useEffect(() => {
    if (!filterBarRef.current) return;
    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    observer.observe(filterBarRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  const handleOpenSettings = useCallback(async () => {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const existing = await WebviewWindow.getByLabel("settings");
      if (existing) {
        await invoke("hide_window_cmd", { restore_focus: false }).catch(console.error);
        await existing.setAlwaysOnTop(isWindowPinned);
        await existing.show();
        await existing.setFocus();
      } else {
        const currentAccent = document.documentElement.style.getPropertyValue("--accent-color") || "";
        const accentParam = currentAccent ? `&accent=${encodeURIComponent(currentAccent)}` : "";
        const isDark = document.documentElement.classList.contains("dark-mode");
        const themeParam = `&theme=${encodeURIComponent(theme || "retro")}`;
        const colorModeParam = `&color_mode=${isDark ? "dark" : "light"}`;
        const win = new WebviewWindow("settings", {
          url: `index.html?window=settings${accentParam}${themeParam}${colorModeParam}`,
          title: t('settings') || "Settings",
          width: 780,
          height: 560,
          resizable: true,
          decorations: true,
          transparent: true,
          backgroundColor: "#00000000",
          skipTaskbar: false,
          visible: false,
          alwaysOnTop: isWindowPinned,
        });
        win.once("tauri://created", () => {
          invoke("hide_window_cmd", { restore_focus: false })
            .then(() => win.show())
            .then(() => win.setFocus())
            .catch(console.error);
        });
      }
    } catch (err) {
      console.error("Failed to open settings window:", err);
    }
  }, [t, isWindowPinned]);

  // Segoe Fluent Icons — official Microsoft icon codepoints
  const FILTER_ICONS: Record<string, string> = {
    text:      '',  // TextDocument
    image:     '',  // Photo
    file:      '',  // Document
    url:       '',  // Link
    code:      '',  // Code
    video:     '',  // Video
    rich_text: '',  // FontColor
  };

  return (
  <header className={`window-drag-region ${(showSettings || showTagManager || showEmojiPanel) ? 'subpage-header' : ''}`}>
    <div className="header-top">
      <div className="header-leading">
        {(showSettings || showTagManager || showEmojiPanel) && (
          <FluentTooltip text={t('back') || '返回'}>
            <button className="btn-icon-ghost window-no-drag" onClick={onBack}>
              <ChevronLeft size={18} />
            </button>
          </FluentTooltip>
        )}
        <div className="header-drag-region" data-tauri-drag-region>
          <span className="header-title">
            {showEmojiPanel
              ? (t('emoji_panel') || '表情包')
              : showTagManager && tagManagerEnabled
                ? (t('tag_manager') || '标签管理')
                : showSettings
                  ? settingsTitle
                  : t('app_name')}
          </span>
        </div>
      </div>
      <div className="header-actions window-no-drag">
        {/* Pin Button - Always visible but single instance */}
        <FluentTooltip text={t('pin')}>
          <button
            className={`btn-icon-ghost ${isWindowPinned ? 'active' : ''}`}
            onClick={() => {
              const newVal = !isWindowPinned;
              setIsWindowPinned(newVal);
              invoke("set_window_pinned", { pinned: newVal }).catch(console.error);
            }}
          >
            {isWindowPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        </FluentTooltip>

        {!showSettings && !showTagManager && !showEmojiPanel && (
          <>
            <FluentTooltip text={t('clear_history')}>
              <button className="btn-icon-ghost" onClick={clearHistory}>
                <Trash2 size={16} />
              </button>
            </FluentTooltip>
            {tagManagerEnabled && (
              <FluentTooltip text={t('tag_manager') || '标签管理'}>
                <button className="btn-icon-ghost" onClick={() => setShowTagManager(true)}>
                  <Tag size={16} />
                </button>
              </FluentTooltip>
            )}
            {emojiPanelEnabled && (
              <FluentTooltip text={t('emoji_panel') || '表情包'}>
                <button className="btn-icon-ghost" onClick={() => setShowEmojiPanel(true)}>
                  <Smile size={16} />
                </button>
              </FluentTooltip>
            )}
            <FluentTooltip text={t('settings')}>
              <button className="btn-icon-ghost" onClick={handleOpenSettings}>
                <SettingsIcon size={16} />
              </button>
            </FluentTooltip>
          </>
        )}
        {fileServerEnabled && (
          <FluentTooltip text="Chat">
            <button
              className={`btn-icon-ghost header-chat-btn ${chatMode && showSettings ? 'active' : ''}`}
              onClick={onToggleChat}
            >
              <MessageSquare size={16} />
            </button>
          </FluentTooltip>
        )}
        <FluentTooltip text={t('hide')}>
          <button className="btn-icon-ghost" onClick={async () => {
            invoke("hide_window_cmd").catch(console.error);
          }}>
            <X size={20} strokeWidth={1.6} />
          </button>
        </FluentTooltip>
      </div>
    </div>

    {!showSettings && !showTagManager && !showEmojiPanel && (
      <AnimatePresence>
        {(showSearchBox || search.trim().length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            animate={{
              height: "auto",
              opacity: 1,
              transitionEnd: { overflow: "visible" }
            }}
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            transition={{ duration: 0.2, ease: "circOut" }}
            style={{ flexShrink: 0 }}
          >
            <div className="search-container window-no-drag">
              <div className="fluent-search-box home-search-wrapper">
                <Search size={14} className="fluent-search-icon search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className={`fluent-search-input search-input ${showTagFilter && allTags.length > 0 ? 'dropdown-open' : ''}`}
                  placeholder={t('search_placeholder')}
                  value={search}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={(e) => {
                    setIsComposing(false);
                    setSearch((e.target as HTMLInputElement).value);
                  }}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  onMouseDown={() => {
                    invoke("activate_window_focus").catch(console.error);
                  }}
                  onClick={() => { setShowTagFilter(true); setEditingTagsId(null); }}
                  onFocus={() => {
                    invoke("activate_window_focus").catch(console.error);
                    setShowTagFilter(true);
                    setSearchIsFocused(true);
                    setEditingTagsId(null);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowTagFilter(false);
                      setSearchIsFocused(false);
                    }, 200);
                  }}
                />
                <AnimatePresence>
                  {showTagFilter && searchIsFocused && allTags.length > 0 && (
                    <motion.div
                      className="tags-dropdown"
                      initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
                      animate={{ opacity: 1, y: 0, scaleY: 1 }}
                      exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
                      transition={{ duration: 0.25, ease: [0.1, 0.9, 0.2, 1] }}
                      style={{ transformOrigin: 'top center' }}
                    >
                      <div className="tags-label">{t('tags') || "Tags"}</div>
                      <div className="tags-list">
                        {allTags.map(tag => {
                          const dbTagKey = tag === t("tag_builtin_sensitive")
                            ? "sensitive"
                            : tag === t("tag_builtin_password")
                            ? "password"
                            : tag;
                          const tagBackground = tagColors?.[dbTagKey] || getTagColor(dbTagKey, theme);
                          return (
                            <span
                              className="tag-chip"
                              key={tag}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSearch("tag:" + tag);
                                setShowTagFilter(false);
                              }}
                              data-tag={tag}
                              style={{ background: tagBackground, color: getTagTextColor(tagBackground) }}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div
                ref={filterBarRef}
                className="hide-scrollbar"
                style={{
                  position: 'relative',
                  display: 'flex',
                  gap: '8px',
                  padding: '8px 0 12px 0',
                  overflowX: 'auto',
                  overflowY: 'clip',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
              >
                {['text', 'image', 'file', 'url', 'code', 'video', 'rich_text'].map(t => (
                  <FluentTooltip key={t} text={getTypeName(t)}>
                    <button
                      className={`type-filter-btn ${typeFilter === t ? 'active' : ''}`}
                      onClick={(e) => {
                        const target = e.currentTarget;
                        prevFilter.current = typeFilter;
                        const nextFilter = typeFilter === t ? null : t;
                        setTypeFilter(nextFilter);
                        
                        if (nextFilter && filterBarRef.current) {
                          const barRect = filterBarRef.current.getBoundingClientRect();
                          const btnRect = target.getBoundingClientRect();
                          setIndicatorRect({
                            left: btnRect.left - barRect.left + (btnRect.width - 16) / 2,
                            width: 16,
                          });
                        } else {
                          setIndicatorRect(null);
                        }
                      }}
                    >
                      <span className="type-filter-icon">{FILTER_ICONS[t]}</span>
                    </button>
                  </FluentTooltip>
                ))}
                {indicatorRect && (
                  <div
                    className="type-filter-indicator"
                    style={{ transform: `translateX(${indicatorRect.left}px)` }}
                  >
                    <div key={typeFilter || 'none'} className="type-filter-indicator-inner" />
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )}
  </header>
);
};

export default AppHeader;
