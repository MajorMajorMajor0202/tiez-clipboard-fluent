import React, { useEffect, useState, useRef, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import {
  Copy,
  Check,
  X,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  File,
  Video,
  Move,
  Edit3,
  ExternalLink,
  FolderOpen,
  AppWindow
} from "lucide-react";
import type { ClipboardEntry } from "../../../shared/types";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import "../../../styles/components/sticker-window.css";

export const DesktopStickerWindow: React.FC = () => {
  const [item, setItem] = useState<ClipboardEntry | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isOpenMenuVisible, setIsOpenMenuVisible] = useState(false);

  const previousHeightRef = useRef<number>(180);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const id = Number(idParam);

    // 1. Try instant load from localStorage
    try {
      const cached = localStorage.getItem(`sticker_entry_${id}`);
      if (cached) {
        const parsed = JSON.parse(cached) as ClipboardEntry;
        setItem(parsed);
        setEditContent(parsed.content);
      }
    } catch {}

    // 2. Load from DB
    invoke<ClipboardEntry>("get_clipboard_entry_by_id", { id })
      .then((entry) => {
        setItem(entry);
        setEditContent(entry.content);
        try {
          localStorage.setItem(`sticker_entry_${id}`, JSON.stringify(entry));
        } catch {}
      })
      .catch((err) => {
        console.error("Failed to load sticker entry:", err);
      });
  }, []);

  useEffect(() => {
    const handleThemeEvent = (event: { payload: string }) => {
      const isDark = event.payload === "dark";
      document.documentElement.classList.toggle("dark-mode", isDark);
      document.body.classList.toggle("dark-mode", isDark);
      document.documentElement.classList.toggle("light-mode", !isDark);
      document.body.classList.toggle("light-mode", !isDark);
    };

    const unlistenPromise = listen<string>("system-theme-changed", handleThemeEvent);

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
      unlistenPromise.then((off) => off());
      mql.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      setBodyEl(bodyRef.current);
    }
  }, [item, isEditing, isCollapsed]);

  // Adaptive window sizing on load
  useEffect(() => {
    if (!item) return;
    const adjustSize = async () => {
      try {
        const win = getCurrentWindow();
        let w = 280;
        let h = 180;
        if (item.content_type === "image") {
          w = 340;
          h = 260;
        } else if (item.content_type === "file" || item.content_type === "video") {
          w = 280;
          h = 120;
        } else if (item.content_type === "code" || item.content.length > 200) {
          w = 340;
          h = 240;
        } else {
          w = 260;
          h = 150;
        }
        previousHeightRef.current = h;
        await win.setSize(new LogicalSize(w, h));
      } catch (err) {
        console.error("Failed to set sticker window size", err);
      }
    };
    adjustSize();
  }, [item]);

  // Close open-with menu when clicking outside
  useEffect(() => {
    if (!isOpenMenuVisible) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".sticker-openwith-popover, .btn-openwith")) {
        setIsOpenMenuVisible(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpenMenuVisible]);

  // Header window drag handler
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest(".window-no-drag, .sticker-btn, input, textarea, button")) {
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.error("Failed to start dragging window", err);
      }
    }
  }, []);

  const handleCopy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!item) return;
    try {
      await invoke("copy_to_clipboard", {
        content: item.content,
        contentType: item.content_type,
        paste: false,
        id: item.id,
        deleteAfterUse: false,
        moveToTop: false
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const win = getCurrentWindow();
      await invoke("close_window_by_label", { label: win.label });
    } catch {
      try {
        await getCurrentWindow().close();
      } catch (err) {
        console.error("Failed to close window", err);
      }
    }
  };

  const handleDoubleClickHeader = async () => {
    const win = getCurrentWindow();
    if (!isCollapsed) {
      setIsCollapsed(true);
      await win.setSize(new LogicalSize(260, 48));
    } else {
      setIsCollapsed(false);
      await win.setSize(new LogicalSize(280, previousHeightRef.current || 180));
    }
  };

  // Open button: single-click opens menu, double-click directly opens
  const handleOpenButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setIsOpenMenuVisible(false);
      handleDefaultOpen();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        setIsOpenMenuVisible((prev) => !prev);
      }, 230);
    }
  };

  const handleDefaultOpen = async () => {
    if (!item) return;
    try {
      await invoke("open_content", {
        id: item.id,
        content: item.content,
        contentType: item.content_type
      });
    } catch (err) {
      console.error("Failed to open content", err);
    }
  };

  const handleOpenWithSystemDialog = async () => {
    if (!item) return;
    setIsOpenMenuVisible(false);
    try {
      if (item.content_type === "file" || item.content_type === "video" || item.content_type === "image") {
        const firstLine = item.content.split("\n")[0].trim();
        if (!firstLine.startsWith("data:")) {
          await invoke("open_file_with_picker", { filePath: firstLine });
          return;
        }
      }
      await invoke("open_content_with_picker", { content: item.content, contentType: item.content_type });
    } catch (err) {
      console.error("Failed to open with system dialog", err);
    }
  };

  const handleStartEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!item) return;
    setEditContent(item.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!item) return;
    try {
      await invoke("update_item_content", { id: item.id, newContent: editContent });
      const updated = { ...item, content: editContent, preview: editContent.slice(0, 500) };
      setItem(updated);
      try {
        localStorage.setItem(`sticker_entry_${item.id}`, JSON.stringify(updated));
      } catch {}
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save edit", err);
    }
  };

  const handleCancelEdit = () => {
    if (item) {
      setEditContent(item.content);
    }
    setIsEditing(false);
  };

  // Drag-out handler to drag content directly to external applications
  const handleDragStart = (e: React.DragEvent) => {
    if (!item) return;
    e.stopPropagation();
    if (item.content_type === "file" || item.content_type === "video" || item.content_type === "image") {
      e.dataTransfer.setData("text/plain", item.content);
      const uri = item.content.startsWith("data:")
        ? item.content
        : `file:///${item.content.replace(/\\/g, "/")}`;
      e.dataTransfer.setData("text/uri-list", uri);
    } else {
      e.dataTransfer.setData("text/plain", item.content);
      if (item.html_content) {
        e.dataTransfer.setData("text/html", item.html_content);
      }
    }
  };

  if (!item) {
    return (
      <div className="sticker-window-root">
        <div className="sticker-card" style={{ padding: 12, fontSize: 12, color: "#888" }}>
          加载中...
        </div>
      </div>
    );
  }

  const isEditable = item.content_type === "text" || item.content_type === "code" || item.content_type === "markdown" || item.content_type === "url";

  const renderIcon = () => {
    switch (item.content_type) {
      case "image":
        return <ImageIcon size={14} />;
      case "file":
        return <File size={14} />;
      case "video":
        return <Video size={14} />;
      case "url":
        return <LinkIcon size={14} />;
      case "code":
        return <Code size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  const renderBody = () => {
    if (isEditing) {
      return (
        <div className="sticker-edit-container">
          <textarea
            className="sticker-edit-textarea window-no-drag"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSaveEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancelEdit();
              }
            }}
            autoFocus
          />
          <div className="sticker-edit-footer window-no-drag">
            <button type="button" className="sticker-cancel-btn" onClick={handleCancelEdit}>
              取消 (Esc)
            </button>
            <button type="button" className="sticker-save-btn" onClick={handleSaveEdit}>
              保存 (Ctrl+↵)
            </button>
          </div>
        </div>
      );
    }

    if (item.content_type === "image") {
      const src = item.content.startsWith("data:") ? item.content : convertFileSrc(item.content);
      return (
        <div className="sticker-image-container">
          <img
            src={src}
            alt="sticker"
            className="sticker-image"
            draggable
            onDragStart={handleDragStart}
          />
        </div>
      );
    }

    if (item.content_type === "file" || item.content_type === "video") {
      const filename = item.content.split(/[\\/]/).pop() || item.content;
      return (
        <div
          className="sticker-file-card"
          draggable
          onDragStart={handleDragStart}
          title="按住内容拖出至外部应用"
        >
          <File size={24} color="var(--accent-color, #0078d4)" />
          <div className="sticker-file-info">
            <div className="sticker-file-name">{filename}</div>
            <div className="sticker-file-path">{item.content}</div>
          </div>
        </div>
      );
    }

    if (item.content_type === "code") {
      return (
        <pre
          className="sticker-code-content"
          draggable
          onDragStart={handleDragStart}
          title="双击复制，按住内容拖出"
          onDoubleClick={handleCopy}
        >
          {item.content}
        </pre>
      );
    }

    return (
      <div
        className="sticker-text-content"
        draggable
        onDragStart={handleDragStart}
        title="双击复制，按住内容拖出"
        onDoubleClick={handleCopy}
      >
        {item.content}
      </div>
    );
  };

  return (
    <div className="sticker-window-root">
      <div className="sticker-card">
        {/* Header with drag region */}
        <div
          className="sticker-header window-drag-region"
          data-tauri-drag-region
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClickHeader}
        >
          <div className="sticker-meta window-drag-region" data-tauri-drag-region>
            <div className="sticker-type-icon">{renderIcon()}</div>
            <div className="sticker-title window-drag-region" data-tauri-drag-region>
              {item.source_app || "便签"}
            </div>
          </div>

          <div className="sticker-actions window-no-drag">
            {/* Edit Button for Text */}
            {isEditable && (
              <button
                type="button"
                className={`sticker-btn window-no-drag ${isEditing ? "active" : ""}`}
                onClick={isEditing ? handleSaveEdit : handleStartEditing}
                title={isEditing ? "保存修改 (Ctrl+Enter)" : "编辑文本"}
              >
                {isEditing ? <Check size={13} color="#107c41" /> : <Edit3 size={13} />}
              </button>
            )}

            {/* Open With App Button: single-click popover, double-click direct open */}
            <button
              type="button"
              className="sticker-btn btn-openwith window-no-drag"
              onClick={handleOpenButtonClick}
              title="双击直接打开 / 单击选择打开方式"
            >
              <ExternalLink size={13} />
            </button>

            {/* Copy Button */}
            <button
              type="button"
              className="sticker-btn window-no-drag"
              onClick={handleCopy}
              title={copied ? "已复制" : "复制"}
            >
              {copied ? <Check size={13} color="#107c41" /> : <Copy size={13} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              className="sticker-btn btn-close window-no-drag"
              onClick={handleClose}
              title="关闭浮窗"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Open With Popover Menu */}
        {isOpenMenuVisible && (
          <div className="sticker-openwith-popover window-no-drag">
            <button
              type="button"
              className="sticker-openwith-item"
              onClick={() => {
                setIsOpenMenuVisible(false);
                handleDefaultOpen();
              }}
            >
              <AppWindow size={13} />
              <span>默认应用打开</span>
            </button>
            <button
              type="button"
              className="sticker-openwith-item"
              onClick={handleOpenWithSystemDialog}
            >
              <FolderOpen size={13} />
              <span>系统打开方式...</span>
            </button>
          </div>
        )}

        {/* Body content with FluentScrollbar */}
        {!isCollapsed && (
          <div
            ref={bodyRef}
            className="sticker-body fluent-scrollbar-host"
          >
            {renderBody()}
            <FluentScrollbar scrollContainer={bodyEl} />
          </div>
        )}

        {/* Drag Hint Footer */}
        {!isCollapsed && !isEditing && (
          <div className="sticker-drag-hint">
            <Move size={10} />
            <span>按住内容拖出</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopStickerWindow;
