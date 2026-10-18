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

export type NoteBackdrop =
  | "mica"
  | "acrylic"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "charcoal";

export interface NoteThemeOption {
  id: NoteBackdrop;
  name: string;
  dotColorLight: string;
  dotColorDark: string;
}

export const NOTE_THEMES: NoteThemeOption[] = [
  { id: "mica", name: "云母 (Mica)", dotColorLight: "rgba(255,255,255,0.85)", dotColorDark: "rgba(32,32,32,0.85)" },
  { id: "acrylic", name: "亚克力 (Acrylic)", dotColorLight: "rgba(245,245,245,0.7)", dotColorDark: "rgba(24,24,24,0.7)" },
  { id: "yellow", name: "便笺黄 (Yellow)", dotColorLight: "#FFF9C4", dotColorDark: "#3B331A" },
  { id: "green", name: "薄荷绿 (Mint)", dotColorLight: "#E8F5E9", dotColorDark: "#1B3523" },
  { id: "blue", name: "天空蓝 (Sky Blue)", dotColorLight: "#E3F2FD", dotColorDark: "#182B44" },
  { id: "purple", name: "薰衣草 (Lavender)", dotColorLight: "#F3E5F5", dotColorDark: "#311C3B" },
  { id: "pink", name: "樱花粉 (Rose)", dotColorLight: "#FCE4EC", dotColorDark: "#3C1B27" },
  { id: "charcoal", name: "石板灰 (Slate)", dotColorLight: "#ECEFF1", dotColorDark: "#272B2E" },
];

export const StickyNoteWindow: React.FC = () => {
  const [item, setItem] = useState<ClipboardEntry | null>(null);
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [backdrop, setBackdrop] = useState<NoteBackdrop>("mica");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [scrollHostEl, setScrollHostEl] = useState<HTMLElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Initial Load & Route Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const id = Number(idParam);

    // Initial theme & dark mode detection
    const colorModeParam = params.get("color_mode");
    const savedMode = localStorage.getItem("tiez_color_mode") || "system";
    let isDark = false;
    if (colorModeParam === "dark") {
      isDark = true;
    } else if (savedMode === "dark") {
      isDark = true;
    } else if (savedMode === "light") {
      isDark = false;
    } else {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("dark-mode", isDark);
    document.documentElement.classList.toggle("light-mode", !isDark);
    document.body.classList.toggle("light-mode", !isDark);

    // Load saved backdrop theme for this note
    const savedBackdrop = localStorage.getItem(`note_backdrop_${id}`) as NoteBackdrop;
    if (savedBackdrop && NOTE_THEMES.some((t) => t.id === savedBackdrop)) {
      setBackdrop(savedBackdrop);
    } else {
      const appTheme = localStorage.getItem("tiez_theme");
      if (appTheme === "acrylic") {
        setBackdrop("acrylic");
      } else {
        setBackdrop("mica");
      }
    }

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

  // 2. Track Window Focus State for Auto-Hiding Controls
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
      setIsDarkMode(isDark);
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
        setIsDarkMode(e.matches);
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
      if (contextMenu) setContextMenu(null);
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
      localStorage.removeItem(`note_backdrop_${item.id}`);
      await handleClose();
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  // 9. Create Another Note
  const handleCreateAnother = async () => {
    try {
      if (contextMenu) setContextMenu(null);
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

  // 10. Backdrop Theme Selection
  const handleSelectBackdrop = (themeId: NoteBackdrop) => {
    setBackdrop(themeId);
    if (item) {
      localStorage.setItem(`note_backdrop_${item.id}`, themeId);
    }
    setContextMenu(null);
  };

  // 11. Context Menu Handler
  const handleContextMenu = (e: React.MouseEvent) => {
    // If inside textarea and editing, allow default OS text context menu
    if (isEditing && (e.target as HTMLElement).tagName === "TEXTAREA") {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 205;
    const menuHeight = 250;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y) });
  };

  // Close context menu on outside click or Esc
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenu && !(e.target as HTMLElement).closest(".note-context-menu")) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  // 12. Rendered Markdown HTML
  const parsedMarkdownHtml = useMemo(() => {
    if (!content || !content.trim()) return "";
    try {
      return marked.parse(content) as string;
    } catch (e) {
      console.error("Markdown parse error:", e);
      return `<p>${content}</p>`;
    }
  }, [content]);

  // 13. Interactive Checkbox Click in Preview Mode
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

  // Controls are visible when window is focused, hovered, or context menu is active
  const isControlsVisible = isFocused || isHovered || Boolean(contextMenu);

  return (
    <div
      className={`note-window-root ${isControlsVisible ? "is-controls-visible" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
    >
      <div className={`note-card note-theme-${backdrop}`} onMouseDown={handleMouseDownDrag}>
        {/* Windows 11 Fluent 32px Square-Button TitleBar (Auto-hiding) */}
        <div className="note-titlebar" onMouseDown={handleMouseDownDrag}>
          {/* Left: Pin / Always On Top (32x32) */}
          <div className="note-titlebar-left window-no-drag">
            <button
              type="button"
              className={`note-titlebar-btn ${isAlwaysOnTop ? "is-pinned" : ""}`}
              title={isAlwaysOnTop ? "取消置顶" : "置顶便笺"}
              onClick={handleTogglePin}
            >
              {isAlwaysOnTop ? <PinOff size={13} strokeWidth={2} /> : <Pin size={13} strokeWidth={2} />}
            </button>
          </div>

          {/* Center: Blank Drag Region */}
          <div className="note-titlebar-drag" onMouseDown={handleMouseDownDrag} />

          {/* Right: Action Buttons (32x32 each) */}
          <div className="note-titlebar-right window-no-drag">
            {/* Toggle Preview / Edit */}
            <button
              type="button"
              className={`note-titlebar-btn ${isEditing ? "active" : ""}`}
              title={isEditing ? "预览 Markdown" : "编辑内容"}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? <Eye size={13} strokeWidth={2} /> : <Edit3 size={13} strokeWidth={2} />}
            </button>

            {/* New Note */}
            <button
              type="button"
              className="note-titlebar-btn"
              title="新建便笺"
              onClick={handleCreateAnother}
            >
              <Plus size={14} strokeWidth={2.2} />
            </button>

            {/* Delete Note */}
            <button
              type="button"
              className="note-titlebar-btn"
              title="删除便笺"
              onClick={handleDelete}
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>

            {/* Close Window Button (Red Hover) */}
            <button
              type="button"
              className="note-titlebar-btn note-btn-close"
              title="关闭 (保存)"
              onClick={handleClose}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

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
                __html: parsedMarkdownHtml || '<div class="note-empty-hint">双击此处或点击右上角编辑图标输入内容</div>',
              }}
            />
          )}

          {/* Custom Fluent Scrollbar */}
          <FluentScrollbar scrollContainer={scrollHostEl} />
        </div>
      </div>

      {/* Windows 11 Fluent Context Menu (Flyout) */}
      {contextMenu && (
        <div
          className="note-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Always on top toggle */}
          <div className="note-menu-item" onClick={handleTogglePin}>
            <span className="note-menu-check">{isAlwaysOnTop ? "✓" : ""}</span>
            <span>始终置顶</span>
          </div>

          <div className="note-menu-separator" />

          {/* Backdrop Material & Palette Picker */}
          <div className="note-menu-header">背景材质与颜色</div>
          <div className="note-menu-palette">
            {NOTE_THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                className={`note-palette-swatch ${backdrop === th.id ? "active" : ""}`}
                title={th.name}
                onClick={() => handleSelectBackdrop(th.id)}
              >
                <span
                  className="swatch-color"
                  style={{
                    backgroundColor: isDarkMode ? th.dotColorDark : th.dotColorLight,
                  }}
                />
              </button>
            ))}
          </div>

          <div className="note-menu-separator" />

          {/* New note */}
          <div className="note-menu-item" onClick={handleCreateAnother}>
            <Plus size={14} strokeWidth={2} />
            <span>新建便笺</span>
          </div>

          {/* Delete note */}
          <div className="note-menu-item text-danger" onClick={handleDelete}>
            <Trash2 size={14} strokeWidth={2} />
            <span>删除便笺</span>
          </div>

          {/* Close note */}
          <div className="note-menu-item" onClick={handleClose}>
            <X size={14} strokeWidth={2} />
            <span>关闭便笺</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StickyNoteWindow;
