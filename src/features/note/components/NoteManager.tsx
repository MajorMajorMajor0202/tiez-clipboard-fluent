import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Search, Plus, Trash2, StickyNote, X } from "lucide-react";
import type { ClipboardEntry } from "../../../shared/types";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import FluentTooltip from "../../../shared/components/FluentTooltip";
import { openStickyNote } from "../lib/openStickyNote";
import "../../../styles/components/note-manager.css";

interface NoteManagerProps {
  t: (key: string) => string;
  onCreateNote?: () => void;
}

export const NoteManager: React.FC<NoteManagerProps> = ({
  t,
  onCreateNote
}) => {
  const [notes, setNotes] = useState<ClipboardEntry[]>([]);
  const [searchText, setSearchText] = useState("");

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
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!searchText.trim()) return notes;
    const q = searchText.trim().toLowerCase();
    return notes.filter((n) => {
      const matchContent = n.content.toLowerCase().includes(q);
      const matchPreview = n.preview?.toLowerCase().includes(q);
      return matchContent || matchPreview;
    });
  }, [notes, searchText]);

  const getNoteDisplay = (content: string) => {
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    let title = "便笺";
    let excerpt = "";
    if (lines.length > 0) {
      title = lines[0].replace(/^[#\s\-*]+/, "").slice(0, 40) || "便笺";
      excerpt = lines.slice(1).join("\n").slice(0, 160);
    }
    return { title, excerpt };
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
        openStickyNote(newEntry);
        fetchNotes();
      }
    } catch (err) {
      console.error("Failed to create note:", err);
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

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isSameYear = d.getFullYear() === now.getFullYear();
    if (isSameYear) {
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="note-manager-root">
      {/* 1. Header: Search Bar and New Note Button in the same row */}
      <div className="note-manager-toolbar">
        <div className={`fluent-search-box note-search-wrapper ${searchText ? "has-clear" : ""}`}>
          <Search size={14} className="fluent-search-icon" />
          <input
            type="text"
            className="fluent-search-input"
            placeholder={t("search_notes") || "搜索便笺..."}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              type="button"
              className="fluent-search-clear"
              onClick={() => setSearchText("")}
              title="清除搜索"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="note-btn-primary"
          onClick={handleCreateNew}
          title="新建便笺"
        >
          <Plus size={15} strokeWidth={2.4} />
          <span>{t("new_note") || "新建便笺"}</span>
        </button>
      </div>

      {/* 2. Content: Cards Grid or Minimal Empty State */}
      <div className="note-manager-content">
        {filteredNotes.length === 0 ? (
          <div className="note-manager-empty">
            <StickyNote size={40} className="note-empty-icon" />
            <div className="note-empty-title">
              {searchText ? "未找到匹配的便笺" : "暂无便笺"}
            </div>
            <div className="note-empty-desc">
              {searchText
                ? "尝试输入其他关键字进行搜索"
                : "点击上方「新建便笺」开始记录"}
            </div>
            {searchText && (
              <button
                type="button"
                className="note-btn-secondary"
                onClick={() => setSearchText("")}
              >
                清除搜索
              </button>
            )}
          </div>
        ) : (
          <div ref={scrollRef} className="note-items-scroll fluent-scrollbar-host">
            <div className="note-cards-grid">
              {filteredNotes.map((note) => {
                const { title, excerpt } = getNoteDisplay(note.content);

                return (
                  <div
                    key={note.id}
                    className="note-card"
                    onClick={() => openStickyNote(note)}
                  >
                    <div className="note-card-header">
                      <span className="note-card-title" title={title}>
                        {title}
                      </span>
                      <FluentTooltip text="删除便笺">
                        <button
                          type="button"
                          className="note-card-delete-btn"
                          onClick={(e) => handleDeleteNote(e, note.id)}
                          aria-label="删除便笺"
                        >
                          <Trash2 size={13} />
                        </button>
                      </FluentTooltip>
                    </div>

                    <div className="note-card-body">
                      {excerpt || "（空白内容）"}
                    </div>

                    <div className="note-card-footer">
                      <span className="note-card-date">
                        {formatDate(note.timestamp)}
                      </span>
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
