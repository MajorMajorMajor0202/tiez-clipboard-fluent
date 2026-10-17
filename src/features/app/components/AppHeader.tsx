import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Pin,
  PinOff,
  Search,
  X
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getTagColor, getTagTextColor } from "../../../shared/lib/utils";
import FluentTooltip from "../../../shared/components/FluentTooltip";

interface AppHeaderProps {
  t: (key: string) => string;
  showSettings: boolean;
  showTagManager: boolean;
  tagManagerEnabled: boolean;
  showEmojiPanel: boolean;
  isWindowPinned: boolean;
  setIsWindowPinned: (val: boolean) => void;
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
  tagColors?: Record<string, string>;
}

const AppHeader = ({
  t,
  showSettings,
  showTagManager,
  tagManagerEnabled,
  showEmojiPanel,
  isWindowPinned,
  setIsWindowPinned,
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
  typeFilter: _typeFilter,
  setTypeFilter: _setTypeFilter,
  onBack,
  tagColors
}: AppHeaderProps) => {

  return (
  <header className={(showSettings || showTagManager || showEmojiPanel) ? 'subpage-header' : ''}>
    <div className="header-top window-drag-region" data-tauri-drag-region>
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
        {/* Pin Window Button */}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )}
  </header>
);
};

export default AppHeader;
