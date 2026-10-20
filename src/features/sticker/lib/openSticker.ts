import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { ClipboardEntry } from "../../../shared/types";
import { stickerCardSize } from './stickerPresentation';

export async function openDesktopSticker(item: ClipboardEntry) {
  const label = `sticker-${item.id}`;
  try {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }
  } catch {
    // Label not found, proceed to create
  }

  const { width, height } = stickerCardSize(item);

  // Pre-seed entry data in localStorage so sticker window displays instantly on mount
  try {
    localStorage.setItem(`sticker_entry_${item.id}`, JSON.stringify(item));
  } catch {}

  const isDark =
    document.documentElement.classList.contains("dark-mode") ||
    document.body.classList.contains("dark-mode");
  const colorModeParam = isDark ? "&color_mode=dark" : "&color_mode=light";
  const currentAccent = document.documentElement.style.getPropertyValue("--accent-color") || "";
  const accentParam = currentAccent ? `&accent=${encodeURIComponent(currentAccent)}` : "";
  const savedTheme = localStorage.getItem("tiez_theme") || "mica";
  const themeParam = `&theme=${encodeURIComponent(savedTheme)}`;

  const sticker = new WebviewWindow(label, {
    url: `index.html?window=sticker&id=${item.id}${accentParam}${themeParam}${colorModeParam}`,
    title: item.preview?.slice(0, 30) || "桌面便签",
    width,
    height,
    minWidth: 200,
    minHeight: 40,
    resizable: true,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    shadow: false,
    focus: true,
    dragDropEnabled: false
  });

  sticker.once("tauri://created", () => {
    sticker.show();
    sticker.setFocus();
  });
}
