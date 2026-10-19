import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  ExternalLink,
  Copy,
  Trash2,
  FolderPlus,
  Pin,
  PinOff,
  Check,
  StickyNote,
  X
} from "lucide-react";
import type { ClipboardEntry } from "../../../shared/types";
import type { TabItem } from "../../app/types";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import FluentTooltip from "../../../shared/components/FluentTooltip";
import { openStickyNote } from "../lib/openStickyNote";
import { NOTE_THEMES, type NoteBackdrop } from "./StickyNoteWindow";
import "../../../styles/components/note-manager.css";

interface NoteManagerProps {
  t: (key: string) => string;
  theme?: string;
  tabs?: TabItem[];
  tabAssignments?: Record<string, number[]>;
  saveTabAssignments?: (assignments: Record<string, number[]>) => void;
  onCreateNote?: () => void;
}

export const NoteManager: React.FC<NoteManagerProps> = ({
  t,
  tabs = [],
  tabAssignments = {},
  saveTabAssignments,
  onCreateNote
}) => {
  const [notes, setNotes] = useState<ClipboardEntry[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedTabId, setSelectedTabId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeTabFlyoutId, setActiveTabFlyoutId] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await invoke<ClipboardEntry[]>("get_clipboard_history", {
        limit: 1000,
        offset: 0,
        contentType: "note"
      });
      setNotes(res);
    } catch (err) {
      console.error("Failed to load notes in NoteManager:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotes();

    let unlistenAll: (() => void)[] = [];
    const setup = async () => {
      const u1 = await listen("clipboard-changed", fetchNotes).catch(() => () => {});
      const u2 = await listen("clipboard-updated", fetchNotes).catch(() => () => {});
      const u3 = await listen("clipboard-removed", fetchNotes).catch(() => () => {});
      unlistenAll = [u1, u2, u3];
    };
    setup();

    return () => {
      unlistenAll.forEach((u) => u());
    };
  }, [fetchNotes]);

  useEffect(() => {
    if (scrollRef.current) {
      setScrollEl(scrollRef.current);
    }
  }, [notes, viewMode]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedTabId !== "all") {
        const assigned = tabAssignments[selectedTabId]?.includes(n.id);
        if (!assigned) return false;
      }
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const matchContent = n.content.toLowerCase().includes(q);
        const matchPreview = n.preview?.toLowerCase().includes(q);
        if (!matchContent && !matchPreview) return false;
      }
      return true;
    });
  }, [notes, selectedTabId, searchText, tabAssignments]);

  const getNoteDisplay = (content: string) => {
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    let title = "便笺";
    let excerpt = "";
    if (lines.length > 0) {
      title = lines[0].replace(/^[#\s\-*]+/, "").slice(0, 40) || "便笺";
      excerpt = lines.slice(1).join("\n").slice(0, 150);
    }
    return { title, excerpt };
  };

  const getNoteColorDot = (noteId: number) => {
    const backdrop = localStorage.getItem(`note_backdrop_${noteId}`) as NoteBackdrop;
    const found = NOTE_THEMES.find((th) => th.id === backdrop);
    if (found) {
      return found.dotColorLight;
    }
    return "var(--accent-color, #0078d4)";
  };

  const handleCopyNote = async (e: React.MouseEvent, note: ClipboardEntry) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(note.content);
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy note content:", err);
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    try {
      await invoke("delete_clipboard_entry", { id: noteId });
      localStorage.removeItem(`note_entry_${noteId}`);
      localStorage.removeItem(`note_backdrop_${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const handleTogglePinNote = async (e: React.MouseEvent, note: ClipboardEntry) => {
    e.stopPropagation();
    try {
      await invoke("toggle_pin_clipboard_entry", {
        id: note.id,
        isPinned: !note.is_pinned
      });
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n))
      );
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const handleCreateNew = async () => {
    if (onCreateNote) {
      onCreateNote();
      return;
    }
    try {
      const newId = await invoke<number>("add_manual_item", {
        content: "# 新便笺\n\n- [ ] 事项 1\n",
        contentType: "note",
        tags: []
      });
      if (typeof newId === "number") {
        if (selectedTabId !== "all" && saveTabAssignments) {
          const list = tabAssignments[selectedTabId] || [];
          const next = {
            ...tabAssignments,
            [selectedTabId]: [newId, ...list.filter((x) => x !== newId)]
          };
          saveTabAssignments(next);
        }
        const newEntry: ClipboardEntry = {
          id: newId,
          content_type: "note",
          content: "# 新便笺\n\n- [ ] 事项 1\n",
          source_app: "Manual",
          timestamp: Date.now(),
          preview: "新便笺",
          is_pinned: false,
          tags: [],
          use_count: 0,
          is_external: false,
          pinned_order: 0,
          file_preview_exists: true
        };
        openStickyNote(newEntry, selectedTabId !== "all" ? selectedTabId : undefined);
        fetchNotes();
      }
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  const handleAssignTab = (e: React.MouseEvent, noteId: number, tabId: string) => {
    e.stopPropagation();
    if (!saveTabAssignments) return;
    const currentList = tabAssignments[tabId] || [];
    const isAssigned = currentList.includes(noteId);
    const nextList = isAssigned
      ? currentList.filter((id) => id !== noteId)
      : [...currentList, noteId];
    const next = { ...tabAssignments, [tabId]: nextList };
    saveTabAssignments(next);
  };

  // Close flyouts on outside click
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (activeTabFlyoutId !== null && !(e.target as HTMLElement).closest(".note-tab-flyout, .btn-assign-tab")) {
        setActiveTabFlyoutId(null);
      }
    };
    window.addEventListener("mousedown", handleDown);
    return () => window.removeEventListener("mousedown", handleDown);
  }, [activeTabFlyoutId]);

  return (
    <div className="note-manager-root">
      {/* 1. Header Toolbar */}
      <div className="note-manager-toolbar">
        <div className="note-manager-top-row">
          <div className="note-search-box">
            <Search size={14} opacity={0.6} />
            <input
              type="text"
              className="note-search-input"
              placeholder={t("search_notes") || "搜索便笺内容..."}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                type="button"
                className="note-card-btn"
                style={{ width: 16, height: 16 }}
                onClick={() => setSearchText("")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="note-toolbar-actions">
            <button
              type="button"
              className="note-btn-primary"
              onClick={handleCreateNew}
              title="新建便笺"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>{t("new_note") || "新建便笺"}</span>
            </button>

            <button
              type="button"
              className={`note-tool-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="网格视图"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              className={`note-tool-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="列表视图"
            >
              <List size={15} />
            </button>
          </div>
        </div>

        {/* 2. Tabs Filter Row */}
        {tabs.length > 0 && (
          <div className="note-tabs-filter-bar">
            <button
              type="button"
              className={`note-tab-pill ${selectedTabId === "all" ? "active" : ""}`}
              onClick={() => setSelectedTabId("all")}
            >
              全部便笺 ({notes.length})
            </button>
            {tabs.map((tab) => {
              const count = notes.filter((n) => tabAssignments[tab.id]?.includes(n.id)).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`note-tab-pill ${selectedTabId === tab.id ? "active" : ""}`}
                  onClick={() => setSelectedTabId(tab.id)}
                >
                  {tab.name} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Cards Area */}
      <div className="note-manager-content">
        {filteredNotes.length === 0 ? (
          <div className="note-manager-empty">
            <StickyNote size={36} className="note-empty-icon" />
            <div className="note-empty-title">
              {searchText ? "未找到匹配的便笺" : "暂无便笺"}
            </div>
            <div className="note-empty-desc">
              {searchText
                ? "尝试更换搜索关键字或切换分组"
                : "点击上方的「新建便笺」按钮，快速记录灵感或待办事项"}
            </div>
            {!searchText && (
              <button
                type="button"
                className="note-btn-primary"
                style={{ marginTop: 8 }}
                onClick={handleCreateNew}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>新建第一张便笺</span>
              </button>
            )}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="note-items-scroll fluent-scrollbar-host"
          >
            <div className={viewMode === "grid" ? "note-cards-grid" : "note-cards-list"}>
              {filteredNotes.map((note) => {
                const { title, excerpt } = getNoteDisplay(note.content);
                const assignedTabs = tabs.filter((t) => tabAssignments[t.id]?.includes(note.id));

                return (
                  <div
                    key={note.id}
                    className="note-manager-card"
                    onDoubleClick={() => openStickyNote(note)}
                  >
                    {/* Top Row: Title + Theme Dot */}
                    <div className="note-card-top">
                      <div className="note-card-title-group">
                        <span
                          className="note-theme-dot"
                          style={{ backgroundColor: getNoteColorDot(note.id) }}
                        />
                        <span className="note-card-title" title={title}>
                          {title}
                        </span>
                      </div>

                      {/* Card Actions */}
                      <div className="note-card-actions">
                        <FluentTooltip text="在便笺窗口打开">
                          <button
                            type="button"
                            className="note-card-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openStickyNote(note);
                            }}
                          >
                            <ExternalLink size={13} />
                          </button>
                        </FluentTooltip>

                        <FluentTooltip text={note.is_pinned ? "取消置顶" : "置顶便笺"}>
                          <button
                            type="button"
                            className="note-card-btn"
                            onClick={(e) => handleTogglePinNote(e, note)}
                          >
                            {note.is_pinned ? <PinOff size={13} color="var(--accent-color, #0078d4)" /> : <Pin size={13} />}
                          </button>
                        </FluentTooltip>

                        <FluentTooltip text={copiedId === note.id ? "已复制" : "复制全文"}>
                          <button
                            type="button"
                            className="note-card-btn"
                            onClick={(e) => handleCopyNote(e, note)}
                          >
                            {copiedId === note.id ? <Check size={13} color="#107c41" /> : <Copy size={13} />}
                          </button>
                        </FluentTooltip>

                        {/* Assign Tab Flyout Trigger */}
                        {tabs.length > 0 && (
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <FluentTooltip text="分配到分组 (Tab)">
                              <button
                                type="button"
                                className="note-card-btn btn-assign-tab"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTabFlyoutId(activeTabFlyoutId === note.id ? null : note.id);
                                }}
                              >
                                <FolderPlus size={13} />
                              </button>
                            </FluentTooltip>

                            {/* Tab Dropdown Flyout */}
                            {activeTabFlyoutId === note.id && (
                              <div
                                className="note-tab-flyout"
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: 28,
                                  background: "var(--bg-card, #ffffff)",
                                  border: "1px solid rgba(0,0,0,0.12)",
                                  borderRadius: 6,
                                  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
                                  padding: 4,
                                  zIndex: 1000,
                                  minWidth: 130
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {tabs.map((tab) => {
                                  const isAssigned = tabAssignments[tab.id]?.includes(note.id);
                                  return (
                                    <button
                                      key={tab.id}
                                      type="button"
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        width: "100%",
                                        padding: "6px 8px",
                                        border: "none",
                                        background: "transparent",
                                        fontSize: 12,
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        color: isAssigned ? "var(--accent-color, #0078d4)" : "inherit"
                                      }}
                                      onClick={(e) => handleAssignTab(e, note.id, tab.id)}
                                    >
                                      <span>{tab.name}</span>
                                      {isAssigned && <Check size={12} />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        <FluentTooltip text="删除便笺">
                          <button
                            type="button"
                            className="note-card-btn danger"
                            onClick={(e) => handleDeleteNote(e, note.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </FluentTooltip>
                      </div>
                    </div>

                    {/* Excerpt */}
                    <div className="note-card-excerpt">
                      {excerpt || "（空白便笺）"}
                    </div>

                    {/* Bottom Row: Date + Assigned Tab Badges */}
                    <div className="note-card-bottom">
                      <div className="note-card-meta">
                        <span>
                          {new Date(note.timestamp).toLocaleDateString([], {
                            month: "numeric",
                            day: "numeric"
                          })}
                        </span>
                        {assignedTabs.map((t) => (
                          <span key={t.id} className="note-tab-badge">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <FluentScrollbar scrollContainer={scrollEl} />
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteManager;
