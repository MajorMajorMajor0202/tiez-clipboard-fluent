import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Plus,
  Code,
  FileText,
  Pin,
  PinOff,
  Trash2,
  X,
  Palette, ChevronUp, ChevronDown, PanelRightClose
} from "lucide-react";
import type { ClipboardEntry } from "../../../shared/types/clipboard";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import { openStickyNote } from "../lib/openStickyNote";
import MilkdownEditor from "./MilkdownEditor";
import { createDebouncedWriter } from "../../../shared/lib/debouncedWriter";
import { noteTitle, useNoteWindowMode } from '../hooks/useNoteWindowMode';
import "../../../styles/components/note-window.css";

export type NoteBackdrop =
  | "mica"
  | "acrylic"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "charcoal"
  | "orange"
  | "cyan";

export interface NoteThemeOption {
  id: NoteBackdrop;
  name: string;
  dotColorLight: string;
  dotColorDark: string;
}

export const SOLID_NOTE_COLORS: NoteBackdrop[] = [
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "charcoal",
  "orange",
  "cyan"
];

export const NOTE_THEMES: NoteThemeOption[] = [
  { id: "mica", name: "云母 (Mica)", dotColorLight: "rgba(255,255,255,0.85)", dotColorDark: "rgba(32,32,32,0.85)" },
  { id: "acrylic", name: "亚克力 (Acrylic)", dotColorLight: "rgba(245,245,245,0.7)", dotColorDark: "rgba(24,24,24,0.7)" },
  { id: "yellow", name: "便笺黄 (Yellow)", dotColorLight: "#FFF9C4", dotColorDark: "#3B331A" },
  { id: "green", name: "薄荷绿 (Mint)", dotColorLight: "#E8F5E9", dotColorDark: "#1B3523" },
  { id: "blue", name: "天空蓝 (Sky Blue)", dotColorLight: "#E3F2FD", dotColorDark: "#182B44" },
  { id: "purple", name: "薰衣草 (Lavender)", dotColorLight: "#F3E5F5", dotColorDark: "#311C3B" },
  { id: "pink", name: "樱花粉 (Rose)", dotColorLight: "#FCE4EC", dotColorDark: "#3C1B27" },
  { id: "charcoal", name: "石板灰 (Slate)", dotColorLight: "#ECEFF1", dotColorDark: "#272B2E" },
  { id: "orange", name: "暖阳橙 (Orange)", dotColorLight: "#FFE0B2", dotColorDark: "#3E2415" },
  { id: "cyan", name: "湖水青 (Cyan)", dotColorLight: "#E0F7FA", dotColorDark: "#103238" },
];

export const StickyNoteWindow: React.FC = () => {
  const [item, setItem] = useState<ClipboardEntry | null>(null);
  const [content, setContent] = useState("");
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [backdrop, setBackdrop] = useState<NoteBackdrop>("mica");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollHostEl, setScrollHostEl] = useState<HTMLElement | null>(null);
  const [saveError, setSaveError] = useState("");
  const title = noteTitle(content);
  const { mode: windowMode, transitioning, peek, toggleCollapse, toggleDock, dockTitleProps } = useNoteWindowMode(title, setSaveError, () => setIsAlwaysOnTop(true));
  const compact = windowMode !== 'expanded';
  const [loaded, setLoaded] = useState(false);
  const closeApproved = useRef(false);
  const itemRef = useRef(item);
  itemRef.current = item;
  const writer = useMemo(() => createDebouncedWriter<{ id: number; text: string }>(async ({ id, text }) => {
    await invoke("update_item_content", { id, newContent: text });
    setItem((previous) => previous?.id === id ? { ...previous, content: text, preview: text.slice(0, 200) } : previous);
    setSaveError("");
  }, (error) => setSaveError(`保存失败，内容仍保留在窗口中：${String(error)}`)), []);

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
    } else if (colorModeParam === "light") {
      isDark = false;
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
      const backdropMode = localStorage.getItem("tiez_note_backdrop_mode") || "sync";
      let chosen: NoteBackdrop = "mica";
      if (backdropMode === "sync") {
        const appTheme = localStorage.getItem("tiez_theme");
        chosen = appTheme === "acrylic" ? "acrylic" : "mica";
      } else if (backdropMode === "mica") {
        chosen = "mica";
      } else if (backdropMode === "acrylic") {
        chosen = "acrylic";
      } else if (backdropMode === "solid") {
        const defaultColor = localStorage.getItem("tiez_note_default_solid_color") || "random";
        if (defaultColor !== "random" && SOLID_NOTE_COLORS.includes(defaultColor as NoteBackdrop)) {
          chosen = defaultColor as NoteBackdrop;
        } else {
          const randomIndex = Math.floor(Math.random() * SOLID_NOTE_COLORS.length);
          chosen = SOLID_NOTE_COLORS[randomIndex];
        }
      }
      setBackdrop(chosen);
      try {
        localStorage.setItem(`note_backdrop_${id}`, chosen);
      } catch {}
    }

    // DB is authoritative: never mount an editor with a stale cached draft.
    let disposed = false;
    invoke<ClipboardEntry>("get_clipboard_entry_by_id", { id })
      .then((entry) => {
        if (disposed) return;
        setItem(entry);
        setContent(entry.content);
        setLoaded(true);
        localStorage.removeItem(`note_entry_${id}`);
      })
      .catch((err) => {
        console.error("Failed to load note entry:", err);
        if (!disposed) setSaveError(`读取便笺失败：${String(err)}`);
      });
    return () => { disposed = true; };
  }, []);

  // 2. Track Window Focus State for Auto-Hiding Controls
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlistenFocus: (() => void) | undefined;

    const syncPin = () => { void appWindow.isAlwaysOnTop().then(setIsAlwaysOnTop).catch(console.error); };
    syncPin();
    appWindow.onFocusChanged(({ payload: focused }) => {
      setIsFocused(focused);
      if (focused) syncPin();
    }).then((unlisten) => {
      unlistenFocus = unlisten;
    }).catch(() => {});

    const handleFocus = () => { setIsFocused(true); syncPin(); };
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
      const mode = localStorage.getItem("tiez_color_mode") || "system";
      const isDark = mode === "dark" || (mode !== "light" && event.payload === "dark");
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

  // CSS cannot blur the desktop behind a WebView: apply the native material.
  useEffect(() => {
    let disposed = false;
    delete document.documentElement.dataset.noteNativeBackdrop;
    const theme = backdrop === "mica" || backdrop === "acrylic" ? backdrop : "solid";
    void invoke("set_note_backdrop", { theme, colorMode: isDarkMode ? "dark" : "light" }).then(() => {
      if (!disposed && theme !== "solid") document.documentElement.dataset.noteNativeBackdrop = "true";
    }).catch(() => {}); // Keep the readable CSS fallback if the material is unavailable.
    return () => { disposed = true; delete document.documentElement.dataset.noteNativeBackdrop; };
  }, [backdrop, isDarkMode]);

  // 4. Debounced, serialized writes; close awaits this same queue.
  const saveContent = useCallback((newText: string) => {
    if (!itemRef.current || !loaded) return;
    writer.schedule({ id: itemRef.current.id, text: newText });
  }, [loaded, writer]);

  useEffect(() => {
    let disposed = false;
    const subscription = getCurrentWindow().onCloseRequested(async (event) => {
      if (closeApproved.current) return;
      event.preventDefault();
      try {
        await writer.flush();
        if (!disposed) { closeApproved.current = true; await getCurrentWindow().close(); }
      } catch (error) { setSaveError(`保存失败，窗口未关闭：${String(error)}`); }
    });
    return () => { disposed = true; void subscription.then((off) => off()).catch(console.error); };
  }, [writer]);

  // Handle Milkdown WYSIWYG text update
  const handleMilkdownChange = useCallback((newText: string) => {
    setContent(newText);
    saveContent(newText);
  }, [saveContent]);

  // Handle Source Mode textarea update
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    saveContent(val);
  };

  // 5. Window Dragging Handler
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanup.current?.(), []);
  const handleMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".window-no-drag, button, input, textarea, .ProseMirror")) return;
    e.stopPropagation();
    dragCleanup.current?.();
    const { clientX, clientY } = e;
    const cleanup = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", cleanup);
      dragCleanup.current = null;
    };
    const move = (event: MouseEvent) => {
      if (!(event.buttons & 1)) { cleanup(); return; }
      if (Math.hypot(event.clientX - clientX, event.clientY - clientY) < 4) return;
      cleanup();
      void getCurrentWindow().startDragging().catch(console.error);
    };
    dragCleanup.current = cleanup;
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", cleanup);
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
      await writer.flush();
      closeApproved.current = true;
      const win = getCurrentWindow();
      await invoke("close_window_by_label", { label: win.label });
    } catch (error) {
      closeApproved.current = false;
      setSaveError(`保存失败，窗口未关闭：${String(error)}`);
    }
  };

  // 8. Delete Note
  const handleDelete = async () => {
    if (!item) return;
    try {
      await writer.flush();
      await invoke("delete_clipboard_entry", { id: item.id });
      writer.cancel();
      localStorage.removeItem(`note_entry_${item.id}`);
      localStorage.removeItem(`note_backdrop_${item.id}`);
      await handleClose();
    } catch (err) {
      console.error("Failed to delete note", err);
      setSaveError(`删除失败：${String(err)}`);
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
              await invoke("save_setting", { key: "app.tab_assignments", value: str });
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
    // If inside text editing area, allow default OS text context menu
    if ((e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).closest(".ProseMirror")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 205;
    const menuHeight = 280;
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

  // Sync scroll host element for FluentScrollbar
  useEffect(() => {
    if (isSourceMode && textareaRef.current) {
      setScrollHostEl(textareaRef.current);
    }
  }, [isSourceMode]);

  // Controls are visible when window is focused, hovered, or context menu is active
  const isControlsVisible = isFocused || isHovered || Boolean(contextMenu);

  return (
    <div
      aria-busy={transitioning}
      className={`note-window-root note-mode-${windowMode} ${isControlsVisible || compact ? "is-controls-visible" : ""}`}
      onMouseEnter={() => { setIsHovered(true); peek(true); }}
      onMouseLeave={() => { setIsHovered(false); peek(false); }}
      onContextMenu={handleContextMenu}
    >
      <div className={`sticky-note-surface note-theme-${backdrop}`} onMouseDown={handleMouseDownDrag}>
        {/* Windows 11 Fluent 32px Square-Button TitleBar (Auto-hiding) */}
        {windowMode === 'docked' ? <div className="note-dock-capsule">
          <button type="button" className="note-dock-title" title={title} aria-label="展开便笺" {...dockTitleProps} onFocus={() => peek(true)}>{title}</button>
          <button type="button" className="note-titlebar-btn note-btn-close" title="关闭 (保存)" onClick={handleClose} onFocus={() => peek(true)}><X size={14} /></button>
        </div> : <div className="note-titlebar" onMouseDown={handleMouseDownDrag} onDoubleClick={event => {
          if (!(event.target as Element).closest('button')) void toggleCollapse();
        }}>
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
          <div className="note-titlebar-drag" onMouseDown={handleMouseDownDrag} title={compact ? title : undefined}>{compact && <span className="note-compact-title">{title}</span>}</div>

          {/* Right: Action Buttons (32x32 each) */}
          <div className="note-titlebar-right window-no-drag">
            {/* Toggle Typora Live WYSIWYG / Raw Source Mode */}
            {!compact && <button
              type="button"
              className={`note-titlebar-btn ${isSourceMode ? "active" : ""}`}
              title={isSourceMode ? "切换为即时渲染模式 (Typora)" : "切换为 Markdown 源码模式"}
              onClick={() => setIsSourceMode(!isSourceMode)}
            >
              {isSourceMode ? <FileText size={13} strokeWidth={2} /> : <Code size={13} strokeWidth={2} />}
            </button>}

            {/* Change Theme / Palette */}
            {!compact && <button
              type="button"
              className={`note-titlebar-btn ${contextMenu ? "active" : ""}`}
              title="便笺设置与背景颜色"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setContextMenu({
                  x: Math.max(8, rect.left - 160),
                  y: rect.bottom + 4
                });
              }}
            >
              <Palette size={13} strokeWidth={2} />
            </button>}

            <button type="button" className="note-titlebar-btn" title={compact ? '展开便笺' : '折叠便笺'} onClick={toggleCollapse}>{compact ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
            <button type="button" className="note-titlebar-btn" title="停靠到屏幕右侧" onClick={toggleDock}><PanelRightClose size={14} /></button>

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
        </div>}

        {/* Content Body */}
        <div className="note-body" hidden={compact || transitioning}>
          {!loaded ? <div role="status">正在读取便笺…</div> : isSourceMode ? (
            <textarea
              ref={textareaRef}
              className="note-editor-textarea window-no-drag"
              value={content}
              onChange={handleTextareaChange}
              placeholder="在此输入 Markdown 源码..."
              autoFocus
            />
          ) : (
            <MilkdownEditor
              key={`milkdown-${item?.id}`}
              initialContent={content}
              onChange={handleMilkdownChange}
              onFocus={() => setIsFocused(true)}
              onScrollHostReady={setScrollHostEl}
            />
          )}

          {/* Custom Fluent Scrollbar */}
          <FluentScrollbar scrollContainer={scrollHostEl} />
          {saveError && <div role="alert">{saveError}</div>}
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

          {/* Source mode toggle */}
          <div className="note-menu-item" onClick={() => { setIsSourceMode(!isSourceMode); setContextMenu(null); }}>
            <span className="note-menu-check">{isSourceMode ? "✓" : ""}</span>
            <span>源码编辑模式</span>
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
