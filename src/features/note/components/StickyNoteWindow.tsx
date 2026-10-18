import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Plus,
  Eye,
  Edit3,
  Pin,
  PinOff,
  Trash2,
  X
} from "lucide-react";
import { marked } from "marked";
import type { ClipboardEntry } from "../../../shared/types/clipboard";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import { openStickyNote } from "../lib/openStickyNote";
import "../../../styles/components/note-window.css";

// Configure marked with GFM (GitHub Flavored Markdown) and breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const StickyNoteWindow: React.FC = () => {
  const [item, setItem] = useState<ClipboardEntry | null>(null);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [scrollHostEl, setScrollHostEl] = useState<HTMLElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Load Note Data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const id = Number(idParam);

    // Instant load from localStorage
    try {
      const cached = localStorage.getItem(`note_entry_${id}`);
      if (cached) {
        const parsed = JSON.parse(cached) as ClipboardEntry;
        setItem(parsed);
        setContent(parsed.content);
        if (!parsed.content || parsed.content.trim() === "" || parsed.content.trim() === "# 新便笺") {
          setIsEditing(true);
        }
      }
    } catch {}

    // Load from DB
    invoke<ClipboardEntry>("get_clipboard_entry_by_id", { id })
      .then((entry) => {
        setItem(entry);
        setContent(entry.content);
        if (!entry.content || entry.content.trim() === "" || entry.content.trim() === "# 新便笺") {
          setIsEditing(true);
        }
        try {
          localStorage.setItem(`note_entry_${id}`, JSON.stringify(entry));
        } catch {}
      })
      .catch((err) => {
        console.error("Failed to load note entry:", err);
      });
  }, []);

  // 2. Window Focus Tracking
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlistenFocus: (() => void) | undefined;

    appWindow.onFocusChanged(({ payload: focused }) => {
      setIsFocused(focused);
    }).then((unlisten) => {
      unlistenFocus = unlisten;
    }).catch(() => {});

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      unlistenFocus?.();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // 3. System Theme & Dark Mode Sync
  useEffect(() => {
    const handleThemeEvent = (event: { payload: string }) => {
      const isDark = event.payload === "dark";
      document.documentElement.classList.toggle("dark-mode", isDark);
      document.body.classList.toggle("dark-mode", isDark);
      document.documentElement.classList.toggle("light-mode", !isDark);
      document.body.classList.toggle("light-mode", !isDark);
    };

    const unlistenPromise = listen<string>("system-theme-changed", handleThemeEvent).catch(() => () => {});

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const mode = localStorage.getItem("tiez_color_mode") || "system";
      if (mode === "system") {
        document.documentElement.classList.toggle("dark-mode", e.matches);
        document.body.classList.toggle("dark-mode", e.matches);
        document.documentElement.classList.toggle("light-mode", !e.matches);
        document.body.classList.toggle("light-mode", !e.matches);
      }
    };
    mql.addEventListener("change", handleMediaChange);

    return () => {
      unlistenPromise.then((off) => { if (typeof off === "function") off(); }).catch(() => {});
      mql.removeEventListener("change", handleMediaChange);
    };
  }, []);

  // 4. Auto-save content to database (debounced 350ms)
  const saveContent = useCallback((newText: string) => {
    if (!item) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await invoke("update_item_content", { id: item.id, newContent: newText });
        const updated = { ...item, content: newText, preview: newText.slice(0, 200) };
        setItem(updated);
        localStorage.setItem(`note_entry_${item.id}`, JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to auto-save note content:", err);
      }
    }, 350);
  }, [item]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    saveContent(val);
  };

  // 5. Window Dragging Handler
  const handleMouseDownDrag = useCallback(async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest(".window-no-drag, button, input, textarea")) {
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.error("Failed to start dragging note window", err);
      }
    }
  }, []);

  // 6. Toggle Always On Top (Pin)
  const handleTogglePin = async () => {
    try {
      const next = !isAlwaysOnTop;
      await getCurrentWindow().setAlwaysOnTop(next);
      setIsAlwaysOnTop(next);
    } catch (err) {
      console.error("Failed to toggle always on top", err);
    }
  };

  // 7. Close Window
  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await invoke("close_window_by_label", { label: win.label });
    } catch {
      try {
        await getCurrentWindow().close();
      } catch (err) {
        console.error("Failed to close note window", err);
      }
    }
  };

  // 8. Delete Note
  const handleDelete = async () => {
    if (!item) return;
    try {
      await invoke("delete_clipboard_entry", { id: item.id });
      localStorage.removeItem(`note_entry_${item.id}`);
      await handleClose();
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  // 9. Create Another Note
  const handleCreateAnother = async () => {
    try {
      const newId = await invoke<number>("add_manual_item", {
        content: "# 新便笺\n\n",
        contentType: "note",
        tags: []
      });
      if (typeof newId === "number") {
        const params = new URLSearchParams(window.location.search);
        const tabId = params.get("tabId");
        if (tabId) {
          try {
            const rawAssignments = localStorage.getItem("tiez_tab_assignments");
            if (rawAssignments) {
              const assignments = JSON.parse(rawAssignments);
              const list = assignments[tabId] || [];
              assignments[tabId] = [newId, ...list.filter((x: number) => x !== newId)];
              const str = JSON.stringify(assignments);
              localStorage.setItem("tiez_tab_assignments", str);
              invoke("save_setting", { key: "app.tab_assignments", val: str }).catch(() => {});
            }
          } catch {}
        }
        const newEntry: ClipboardEntry = {
          id: newId,
          content_type: "note",
          content: "# 新便笺\n\n",
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
        openStickyNote(newEntry, tabId || undefined);
      }
    } catch (err) {
      console.error("Failed to create another note", err);
    }
  };

  // 10. Rendered Markdown HTML
  const parsedMarkdownHtml = useMemo(() => {
    if (!content || !content.trim()) return "";
    try {
      return marked.parse(content) as string;
    } catch (e) {
      console.error("Markdown parse error:", e);
      return `<p>${content}</p>`;
    }
  }, [content]);

  // 11. Interactive checkbox click in preview mode
  const handlePreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
      e.stopPropagation();
      const checkboxes = previewRef.current?.querySelectorAll('input[type="checkbox"]');
      if (checkboxes) {
        let index = -1;
        for (let i = 0; i < checkboxes.length; i++) {
          if (checkboxes[i] === target) {
            index = i;
            break;
          }
        }
        if (index >= 0) {
          let count = 0;
          const updatedContent = content.replace(/- \[( |x|X)\]/g, (match, p1) => {
            if (count === index) {
              count++;
              return p1.trim() ? "- [ ]" : "- [x]";
            }
            count++;
            return match;
          });
          setContent(updatedContent);
          saveContent(updatedContent);
        }
      }
    }
  };

  // Sync scroll host element for FluentScrollbar
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      setScrollHostEl(textareaRef.current);
    } else if (!isEditing && previewRef.current) {
      setScrollHostEl(previewRef.current);
    }
  }, [isEditing]);

  const hasControlsVisible = isFocused || isHovered;

  return (
    <div
      className={`note-window-root ${hasControlsVisible ? "is-focused" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="note-card" onMouseDown={handleMouseDownDrag}>
        {/* Top Header Controls (Hidden when idle, automatically appears on focus/hover) */}
        <header className="note-header" onMouseDown={handleMouseDownDrag}>
          <div className="note-header-actions window-no-drag">
            {/* New Note Button */}
            <button
              type="button"
              className="note-btn"
              title="新建便笺"
              onClick={handleCreateAnother}
            >
              <Plus size={15} strokeWidth={2.2} />
            </button>

            {/* Toggle Preview / Edit Button */}
            <button
              type="button"
              className={`note-btn ${isEditing ? "active" : ""}`}
              title={isEditing ? "预览 Markdown" : "编辑内容"}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
            </button>
          </div>

          {/* Central Drag Region */}
          <div className="note-drag-center" onMouseDown={handleMouseDownDrag} />

          <div className="note-header-actions window-no-drag">
            {/* Pin / Always On Top Button */}
            <button
              type="button"
              className={`note-btn ${isAlwaysOnTop ? "active" : ""}`}
              title={isAlwaysOnTop ? "取消置顶" : "置顶便笺"}
              onClick={handleTogglePin}
            >
              {isAlwaysOnTop ? <PinOff size={14} /> : <Pin size={14} />}
            </button>

            {/* Delete Note Button */}
            <button
              type="button"
              className="note-btn"
              title="删除便笺"
              onClick={handleDelete}
            >
              <Trash2 size={14} />
            </button>

            {/* Close Window Button */}
            <button
              type="button"
              className="note-btn note-btn-close"
              title="关闭"
              onClick={handleClose}
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="note-body">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="note-editor-textarea window-no-drag"
              value={content}
              onChange={handleTextChange}
              placeholder="在此输入 Markdown 便笺内容..."
              autoFocus
            />
          ) : (
            <div
              ref={previewRef}
              className="note-markdown-view window-no-drag"
              onClick={handlePreviewClick}
              onDoubleClick={() => setIsEditing(true)}
              dangerouslySetInnerHTML={{
                __html: parsedMarkdownHtml || '<div class="note-empty-hint">双击此处或点击上方编辑图标输入内容</div>',
              }}
            />
          )}

          {/* Custom Fluent Scrollbar */}
          <FluentScrollbar scrollContainer={scrollHostEl} />
        </div>
      </div>
    </div>
  );
};

export default StickyNoteWindow;
