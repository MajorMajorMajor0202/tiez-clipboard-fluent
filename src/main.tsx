import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CompactPreviewWindow from "./features/clipboard/components/CompactPreviewWindow";
import AdvancedSettingsWindow from "./features/settings/components/AdvancedSettingsWindow";
import SettingsWindow from "./features/settings/components/SettingsWindow";
import "./index.css";
import "./styles/components/index.css";
import "./styles/themes/load";

const params = new URLSearchParams(window.location.search);
const accent = params.get("accent");
if (accent) {
  const hex = decodeURIComponent(accent);
  const raw = hex.replace("#", "");
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);
  if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
    document.documentElement.style.setProperty("--accent-color", hex);
    document.documentElement.style.setProperty("--accent-color-rgb", `${r}, ${g}, ${b}`);
  }
}

// ── 精确物理像素边框：注入 devicePixelRatio 并持续监听变化 ────────────
// 当窗口移动到不同 DPI 的显示器时，matchMedia 会触发回调，动态更新 CSS 变量，
// 确保 #root::after 的 transform-scale 边框始终精确为 1 个物理像素。
function applyDevicePixelRatio() {
  document.documentElement.style.setProperty(
    "--device-pixel-ratio",
    String(window.devicePixelRatio)
  );
}
applyDevicePixelRatio();
// matchMedia 监听高分辨率媒体查询变化（跨显示器 DPI 切换时触发）
const dpiMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
function onDpiChange() {
  applyDevicePixelRatio();
  // 重新注册监听器（旧版浏览器不支持 EventListener 形式，用 onchange 更安全）
  dpiMediaQuery.removeEventListener("change", onDpiChange);
  window
    .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener("change", onDpiChange);
}
dpiMediaQuery.addEventListener("change", onDpiChange);
// ─────────────────────────────────────────────────────────────────────

const isCompactPreview = params.get("window") === "compact-preview";
const isAdvancedSettingsWindow = params.get("window") === "advanced-settings";
const isSettingsWindow = params.get("window") === "settings";

if (isSettingsWindow || isAdvancedSettingsWindow) {
  document.body.classList.add("is-settings-window");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isCompactPreview
      ? <CompactPreviewWindow />
      : isAdvancedSettingsWindow
        ? <AdvancedSettingsWindow />
        : isSettingsWindow
          ? <SettingsWindow />
          : <App />}
  </React.StrictMode>,
);
