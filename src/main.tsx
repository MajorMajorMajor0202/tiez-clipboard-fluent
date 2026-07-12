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
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "2147483647",
    imageRendering: "pixelated",
  });

  const draw = async () => {
    const dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;

    try {
      const size = await getCurrentWindow().innerSize();
      w = size.width;
      h = size.height;
    } catch (e) {
      // 容错回退机制
      w = Math.round(window.innerWidth * dpr);
      h = Math.round(window.innerHeight * dpr);
    }

    if (w <= 0 || h <= 0) return;

    // 仅在尺寸变化时重置 canvas 像素缓冲，防止画面闪烁
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // 读取当前主题的边框颜色和圆角（CSS 变量）
    const style = getComputedStyle(document.documentElement);
    const color = style.getPropertyValue("--shell-border-color").trim();
    const radiusCss = parseFloat(style.getPropertyValue("--shell-radius") || "8");

    if (!color) return;

    // 物理像素圆角转换为适配内缩后的值，再减去 1.5（因为从 1.5 坐标开始绘制）
    const radius = Math.max(radiusCss * dpr - 1.5, 0);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1; // 1 物理像素

    // 绘制内缩 1 物理像素的边框线：
    //   - 起始点 (1.5, 1.5)：刚好着色 index 1 像素
    //   - 尺寸 (w - 3, h - 3)：终点 (w - 1.5, h - 1.5) 刚好着色 index w - 2 像素
    // 留下 index 0 和 index w-1 作为外部保护边，从而免疫 DWM 裁剪
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(1.5, 1.5, w - 3, h - 3, radius);
    } else {
      ctx.rect(1.5, 1.5, w - 3, h - 3);
    }
    ctx.stroke();
  };

  document.body.appendChild(canvas);

  // 首帧绘制
  requestAnimationFrame(draw);

  // 窗口大小变化时重绘
  window.addEventListener("resize", () => requestAnimationFrame(draw));

  // DPI 变化时重绘
  const listenDpi = () => {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener("change", () => { requestAnimationFrame(draw); listenDpi(); }, { once: true });
  };
  listenDpi();

  // 主题切换时重绘
  new MutationObserver(() => requestAnimationFrame(draw)).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ["class", "style"] }
  );
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
