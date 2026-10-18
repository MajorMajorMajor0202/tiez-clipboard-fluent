import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { ClipboardEntry } from "../../../shared/types/clipboard";

export async function openStickyNote(item: ClipboardEntry, tabId?: string) {
  const label = `note-${item.id}`;
  try {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }
  } catch {
    // Window doesn't exist yet, proceed to create
  }

  // Pre-seed entry data in localStorage for instant rendering
  try {
    localStorage.setItem(`note_entry_${item.id}`, JSON.stringify(item));
  } catch {}

  const isDark =
    document.documentElement.classList.contains("dark-mode") ||
    document.body.classList.contains("dark-mode");
  const colorModeParam = isDark ? "&color_mode=dark" : "&color_mode=light";
  const currentAccent = document.documentElement.style.getPropertyValue("--accent-color") || "";
  const accentParam = currentAccent ? `&accent=${encodeURIComponent(currentAccent)}` : "";
  const savedTheme = localStorage.getItem("tiez_theme") || "mica";
  const themeParam = `&theme=${encodeURIComponent(savedTheme)}`;
  const tabParam = tabId ? `&tabId=${encodeURIComponent(tabId)}` : "";

  const noteWindow = new WebviewWindow(label, {
    url: `index.html?window=note&id=${item.id}${tabParam}${accentParam}${themeParam}${colorModeParam}`,
    title: item.preview?.slice(0, 30) || "便笺",
    width: 320,
    height: 380,
    minWidth: 220,
    minHeight: 180,
    resizable: true,
    decorations: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    shadow: false,
    focus: true
  });

  noteWindow.once("tauri://created", () => {
    noteWindow.show();
    noteWindow.setFocus();
  });
}
