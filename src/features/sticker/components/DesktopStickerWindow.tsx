import React, { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  AppWindow, Maximize2, PanelsTopLeft, Undo2
} from "lucide-react";
import type { ClipboardEntry } from "../../../shared/types";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import { canDragNativeFiles, isFileContent, startNativeContentDrag, writeContentDragData } from "../../../shared/lib/contentDrag";
import { fitStickerImage, isStickerFile, stickerCardSize, stickerFileName, stickerFilePaths, stickerImageSource } from '../lib/stickerPresentation';
import { useStickerTheme } from '../hooks/useStickerTheme';
import { getFileIcon } from '../../../shared/lib/fileIcon';
import InlineStickerText from './InlineStickerText';
import "../../../styles/components/sticker-window.css";

export const DesktopStickerWindow: React.FC = () => {
  const [item, setItem] = useState<ClipboardEntry | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const draftRef = useRef("");
  const [isOpenMenuVisible, setIsOpenMenuVisible] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [fileIcon, setFileIcon] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const sizedRef = useRef('');
  const previousSizeRef = useRef({ width: 260, height: 150 });
  useStickerTheme();
  const imageSource = item ? stickerImageSource(item) : null;
  const fileLike = !!item && isStickerFile(item);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const id = Number(idParam);
    let disposed = false;

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
        if (disposed) return;
        setItem(entry);
        setLoaded(true);
        try {
          localStorage.setItem(`sticker_entry_${id}`, JSON.stringify(entry));
        } catch {}
      })
      .catch((err) => {
        if (disposed) return;
        console.error("Failed to load sticker entry:", err);
        setError(`读取失败：${String(err)}`);
      });
    return () => { disposed = true; };
  }, []);

  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }, []);

  useEffect(() => {
    if (!item || !fileLike || imageSource) { setFileIcon(null); return; }
    let disposed = false;
    void getFileIcon(stickerFilePaths(item)[0]).then(icon => { if (!disposed) setFileIcon(icon); });
    return () => { disposed = true; };
  }, [item?.id, fileLike, imageSource]);

  useEffect(() => {
    if (bodyRef.current) {
      setBodyEl(bodyRef.current);
    }
  }, [item, isEditing, isCollapsed]);

  // Size once per presentation, never after text edits or manual resizing.
  useEffect(() => {
    if (!item) return;
    const key = `${item.id}:${imageMode ? 'image' : 'card'}`;
    if (sizedRef.current === key || (imageMode && !imageDimensions)) return;
    let disposed = false;
    const adjustSize = async () => {
      try {
        const win = getCurrentWindow();
        const size = imageMode && imageDimensions
          ? fitStickerImage(imageDimensions.width, imageDimensions.height, screen.availWidth || 800, screen.availHeight || 800)
          : stickerCardSize(item);
        await win.setMinSize(new LogicalSize(imageMode ? 64 : 200, imageMode ? 64 : 40));
        if (disposed) return;
        await win.setMaxSize(null);
        if (disposed) return;
        await win.setSize(new LogicalSize(size.width, size.height));
        if (!disposed) { sizedRef.current = key; previousSizeRef.current = size; }
      } catch (err) {
        console.error("Failed to set sticker window size", err);
      }
    };
    void adjustSize();
    return () => { disposed = true; };
  }, [item?.id, imageMode, imageDimensions]);

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
      const [size, scale] = await Promise.all([win.innerSize(), win.scaleFactor()]);
      previousSizeRef.current = { width: size.width / scale, height: size.height / scale };
      setIsCollapsed(true);
      await win.setMinSize(new LogicalSize(64, 34));
      await win.setSize(new LogicalSize(previousSizeRef.current.width, 34));
    } else {
      setIsCollapsed(false);
      await win.setMinSize(new LogicalSize(imageMode ? 64 : 200, imageMode ? 64 : 40));
      await win.setSize(new LogicalSize(previousSizeRef.current.width, previousSizeRef.current.height));
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
    if (!item || !loaded) return;
    draftRef.current = item.content;
    setError('');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!item || saving) return;
    setSaving(true);
    try {
      const content = draftRef.current;
      await invoke("update_item_content", { id: item.id, newContent: content });
      const updated = { ...item, content, preview: content.slice(0, 500) };
      setItem(updated);
      try {
        localStorage.setItem(`sticker_entry_${item.id}`, JSON.stringify(updated));
      } catch {}
      setIsEditing(false);
      setError('');
    } catch (err) {
      console.error("Failed to save edit", err);
      setError(`保存失败，修改仍保留在窗口中：${String(err)}`);
    } finally { setSaving(false); }
  };

  const handleCancelEdit = () => {
    if (saving) return;
    if (item) draftRef.current = item.content;
    setError('');
    setIsEditing(false);
  };

  // Drag-out handler to drag content directly to external applications
  const handleDragStart = (e: React.DragEvent) => {
    if (!item) return;
    e.stopPropagation();
    if (isFileContent(item) && canDragNativeFiles()) {
      e.preventDefault();
      void startNativeContentDrag(item).catch(console.error);
    } else { writeContentDragData(e.dataTransfer, item); }
  };

  if (!item) {
    return (
      <div className="sticker-window-root">
        <div className="sticker-card" style={{ padding: 12, fontSize: 12, color: "#888" }}>
          {error || '加载中...'}
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
    const image = imageSource && !imageError ? <img src={imageSource} alt={stickerFileName(item)}
      className="sticker-image" draggable={!isCollapsed} onDragStart={handleDragStart}
      onLoad={event => {
        const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
        setImageDimensions(previous => previous?.width === width && previous.height === height ? previous : { width, height });
      }} onError={() => { setImageError(true); setImageMode(false); }} /> : null;
    if (imageMode && image) return <div className="sticker-image-container">{image}</div>;
    if (fileLike) return <div className="sticker-file-card" draggable onDragStart={handleDragStart}>
      <div className="sticker-thumbnail">{image || (fileIcon ? <img src={fileIcon} alt="" /> : renderIcon())}</div>
      <div className="sticker-file-info">
        <div className="sticker-file-name" title={stickerFileName(item)}>{stickerFileName(item)}</div>
        <div className="sticker-file-detail">{imageDimensions ? `${imageDimensions.width} × ${imageDimensions.height}` : item.content_type === 'video' ? '视频' : '文件'}</div>
      </div>
    </div>;
    return <InlineStickerText value={item.content} editing={isEditing} code={item.content_type === 'code'}
      onDraft={value => { draftRef.current = value; }} onSave={handleSaveEdit} onCancel={handleCancelEdit}
      onCopy={handleCopy} onDragStart={handleDragStart} />;
  };

  return (
    <div className={`sticker-window-root${imageMode ? ' sticker-image-mode' : ''}${isCollapsed ? ' is-collapsed' : ''}${isOpenMenuVisible ? ' has-open-menu' : ''}`}>
      <div className="sticker-card">
        {/* Header with drag region */}
        <div
          className="sticker-header window-drag-region"
          data-tauri-drag-region
          onMouseDown={handleMouseDown}
          onDoubleClick={event => { if (!(event.target as HTMLElement).closest('button')) void handleDoubleClickHeader(); }}
        >
          <div className="sticker-meta window-drag-region" data-tauri-drag-region>
            <div className="sticker-type-icon">{renderIcon()}</div>
            <div className="sticker-title window-drag-region" data-tauri-drag-region>
              {fileLike ? stickerFileName(item) : item.source_app || "贴图"}
            </div>
          </div>

          <div className="sticker-actions window-no-drag">
            {/* Edit Button for Text */}
            {isEditable && (
              <button
                type="button"
                className={`sticker-btn window-no-drag ${isEditing ? "active" : ""}`}
                onClick={isEditing ? handleSaveEdit : handleStartEditing}
                disabled={!loaded || saving}
                aria-label={isEditing ? '保存修改' : '编辑文本'}
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
              onClick={isEditing ? handleCancelEdit : handleCopy}
              disabled={saving}
              aria-label={isEditing ? '取消编辑' : '复制'}
              title={isEditing ? '取消编辑 (Esc)' : copied ? "已复制" : "复制"}
            >
              {isEditing ? <Undo2 size={13} /> : copied ? <Check size={13} color="#107c41" /> : <Copy size={13} />}
            </button>

            {imageSource && !imageError && <button type="button" className="sticker-btn window-no-drag"
              aria-label={imageMode ? '切换为文件卡片' : '切换为整张图片'} aria-pressed={imageMode}
              title={imageMode ? '显示缩略图和文件名' : '显示整张图片'}
              onClick={() => { setIsCollapsed(false); setImageMode(value => !value); }}>
              {imageMode ? <PanelsTopLeft size={13} /> : <Maximize2 size={13} />}
            </button>}

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
          <div className="sticker-body-wrapper">
            <div
              ref={bodyRef}
              className="sticker-body fluent-scrollbar-host"
            >
              {renderBody()}
            </div>
            <FluentScrollbar scrollContainer={bodyEl} />
          </div>
        )}

        {/* Drag Hint Footer */}
        {!isCollapsed && !imageMode && (
          <div className="sticker-drag-hint">
            {error ? <span role="alert">{error}</span> : isEditing ? <span>Ctrl+Enter 保存 · Esc 取消</span> : <><Move size={10} /><span>按住内容拖出</span></>}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopStickerWindow;
