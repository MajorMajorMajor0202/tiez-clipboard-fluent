import React, { useEffect, useState, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import {
  Copy,
  Check,
  Pin,
  X,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  File,
  Video,
  Move
} from "lucide-react";
import type { ClipboardEntry } from "../../../shared/types";
import "../../../styles/components/sticker-window.css";

export const DesktopStickerWindow: React.FC = () => {
  const [item, setItem] = useState<ClipboardEntry | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const previousHeightRef = useRef<number>(180);

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
      }
    } catch {}

    // 2. Load from DB
    invoke<ClipboardEntry>("get_clipboard_entry_by_id", { id })
      .then((entry) => {
        setItem(entry);
        try {
          localStorage.setItem(`sticker_entry_${id}`, JSON.stringify(entry));
        } catch {}
      })
      .catch((err) => {
        console.error("Failed to load sticker entry:", err);
      });
  }, []);

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

  const handleCopy = async () => {
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

  const handleTogglePin = async () => {
    const next = !isPinned;
    setIsPinned(next);
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.error(e);
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
          title="按住可直接拖出至外部应用"
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
          title="双击复制，按住可直接拖出"
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
        title="双击复制，按住可直接拖出"
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
          className="sticker-header"
          data-tauri-drag-region
          onDoubleClick={handleDoubleClickHeader}
        >
          <div className="sticker-meta" data-tauri-drag-region>
            <div className="sticker-type-icon">{renderIcon()}</div>
            <div className="sticker-title" data-tauri-drag-region>
              {item.source_app || "便签"}
            </div>
          </div>

          <div className="sticker-actions">
            <button
              type="button"
              className="sticker-btn"
              onClick={handleCopy}
              title={copied ? "已复制" : "复制"}
            >
              {copied ? <Check size={13} color="#107c41" /> : <Copy size={13} />}
            </button>
            <button
              type="button"
              className={`sticker-btn ${isPinned ? "pinned" : ""}`}
              onClick={handleTogglePin}
              title={isPinned ? "取消置顶" : "置顶显示"}
            >
              <Pin size={13} fill={isPinned ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              className="sticker-btn btn-close"
              onClick={handleClose}
              title="关闭浮窗"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Body content */}
        {!isCollapsed && <div className="sticker-body">{renderBody()}</div>}

        {/* Drag Hint Footer */}
        {!isCollapsed && (
          <div className="sticker-drag-hint">
            <Move size={10} />
            <span>支持按住内容拖出</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopStickerWindow;
