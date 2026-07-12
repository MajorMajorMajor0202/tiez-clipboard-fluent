import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CompactPreviewWindow from "./features/clipboard/components/CompactPreviewWindow";
import AdvancedSettingsWindow from "./features/settings/components/AdvancedSettingsWindow";
import SettingsWindow from "./features/settings/components/SettingsWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
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

// ── Canvas 边框叠加层 ─────────────────────────────────────────────────
// 针对 Windows OS 在无边框 resizable 状态下的裁剪特性进行的终极物理像素级适配方案：
//
// 1. 真实物理尺寸：
//    放弃使用 window.innerWidth (容易受 Chromium 四舍五入取整影响导致 1px 误差)，
//    直接调用 Tauri 的 getCurrentWindow().innerSize() 获取 OS 底层无误差的真实窗口物理像素宽 w 和高 h。
//
// 2. 物理像素内缩 (Padding Offset)：
//    Windows DWM 边框和大小调整管理器会无情裁剪掉最外侧的第 0 像素(左/上)和第 w-1/h-1 像素(右/下)。
//    我们将边框矩形的所有绘制路径统一向内平移 1 个物理像素：
//      - 起始位置设为 x=1.5, y=1.5 (线宽 1px 刚好覆盖物理像素 index 1)
//      - 宽度设为 w - 3, 高度设为 h - 3 (右/下边界落在 index w-2 / h-2)
//    这样，边框线处于 100% 不会被系统裁剪的内部安全区，且在四边表现出完美的物理对称。
// ─────────────────────────────────────────────────────────────────────
if (!isSettingsWindow && !isAdvancedSettingsWindow && !isCompactPreview) {
  const canvas = document.createElement("canvas");
  canvas.id = "window-border-overlay";
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    pointerEvents: "none",
    zIndex: "2147483647",
    imageRendering: "pixelated",
  });

  const appWindow = getCurrentWindow();
  let physicalWidth = Math.round(window.innerWidth * (window.devicePixelRatio || 1));
  let physicalHeight = Math.round(window.innerHeight * (window.devicePixelRatio || 1));
  let currentDpr = window.devicePixelRatio || 1;

  const draw = () => {
    const w = physicalWidth;
    const h = physicalHeight;
    const dpr = currentDpr;

    if (w <= 0 || h <= 0) return;

    // 动态调整 canvas 像素大小和 CSS 显示大小，保证 1:1 无形变映射
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const cssW = w / dpr;
    const cssH = h / dpr;
    if (canvas.style.width !== `${cssW}px` || canvas.style.height !== `${cssH}px`) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // 读取当前主题的边框颜色和圆角（CSS 变量）
    const style = getComputedStyle(document.documentElement);
    const color = style.getPropertyValue("--shell-border-color").trim();
    const radiusCss = parseFloat(style.getPropertyValue("--shell-radius") || "8");

    if (!color) return;

    // 1. 绘制外侧 1px 阴影（线宽 1px，位于 index 0，半透明度 0.45）
    const radiusOuter = Math.max(radiusCss * dpr - 0.5, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(0.5, 0.5, w - 1, h - 1, radiusOuter);
    } else {
      ctx.rect(0.5, 0.5, w - 1, h - 1);
    }
    ctx.stroke();

    // 2. 绘制主 1px 边框线（线宽 1px，位于 index 1，全透明度）
    const radiusMain = Math.max(radiusCss * dpr - 1.5, 0);
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(1.5, 1.5, w - 3, h - 3, radiusMain);
    } else {
      ctx.rect(1.5, 1.5, w - 3, h - 3);
    }
    ctx.stroke();

    // 3. 绘制内侧 1px 阴影（线宽 1px，位于 index 2，半透明度 0.45）
    const radiusInner = Math.max(radiusCss * dpr - 2.5, 0);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(2.5, 2.5, w - 5, h - 5, radiusInner);
    } else {
      ctx.rect(2.5, 2.5, w - 5, h - 5);
    }
    ctx.stroke();

    // 恢复画布全局透明度设置
    ctx.globalAlpha = 1.0;
  };

  document.body.appendChild(canvas);

  // 初始化获取精确 OS 尺寸
  appWindow.innerSize().then((size) => {
    if (size.width > 0 && size.height > 0) {
      physicalWidth = size.width;
      physicalHeight = size.height;
      draw();
    }
  });

  appWindow.scaleFactor().then((factor) => {
    if (factor > 0) {
      currentDpr = factor;
      draw();
    }
  });

  // 监听 Tauri 窗口原生 resize 和 DPI 改变事件，确保尺寸完全同步
  appWindow.onResized(({ payload: size }) => {
    if (size.width > 0 && size.height > 0) {
      physicalWidth = size.width;
      physicalHeight = size.height;
      draw();
    }
  });

  appWindow.onScaleChanged(({ payload }) => {
    if (payload.scaleFactor > 0) {
      currentDpr = payload.scaleFactor;
      draw();
    }
  });

  // 主题切换时重绘
  new MutationObserver(() => draw()).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ["class", "style"] }
  );

  // 默认首帧同步绘制
  draw();
}
// ─────────────────────────────────────────────────────────────────────

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
