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

// ── Canvas 边框叠加层 ─────────────────────────────────────────────────
// 历史上所有 CSS 方案都失败的根本原因（最终诊断）：
//
//   CSS 边框渲染在非整数 DPR（125%/150%/175%）下存在亚像素取整问题：
//   position:fixed; inset:0; border:1px solid 的右/下边框的外边缘恰好落在
//   viewport 的物理像素边界外，Chromium 把超出部分裁掉，右/下边框消失。
//
//   PROOF（以 175% DPR，窗口 615 物理像素宽为例）：
//     window.innerWidth = floor(615/1.75) = 351 CSS px
//     右边框外边缘 = 351 * 1.75 = 614.25 物理像素
//     但窗口只有 615 物理像素（0-614），614.25 落在最后一个像素的外侧，被裁切！
//
//   Canvas 方案：直接在物理像素坐标系绘制，绕过所有 CSS 亚像素计算：
//     canvas.width = Math.round(innerWidth * dpr)   ← 精确物理像素数
//     strokeRect(0.5, 0.5, w-1, h-1)               ← 1px 笔触始终在 canvas 内
//     左边框：物理像素 0（100% 在界内），右边框：物理像素 w-1（同上）
//     四边完全一致，无任何 CSS 数学计算参与。
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
    // 防止 canvas 元素自身被拉伸变形
    imageRendering: "pixelated",
  });

  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    // 用 Math.round 而非 floor/ceil，尽量接近真实物理像素数
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);

    // 仅在尺寸变化时重置 canvas 像素缓冲（避免闪烁）
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

    // 将 CSS px 圆角转换为物理像素圆角，再减去 0.5（因为笔触从 0.5 开始）
    const radius = Math.max(radiusCss * dpr - 0.5, 0);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1; // 1 物理像素

    // strokeRect(0.5, 0.5, w-1, h-1) 确保：
    //   - 左边框笔触中心 x=0.5 → 覆盖物理像素 [0, 1)，完全在界内 ✓
    //   - 右边框笔触中心 x=w-0.5 → 覆盖物理像素 [w-1, w)，canvas 裁切到 w-1 ✓
    //   四边均为完整的 1 物理像素，无任何边被裁切
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(0.5, 0.5, w - 1, h - 1, radius);
    } else {
      ctx.rect(0.5, 0.5, w - 1, h - 1);
    }
    ctx.stroke();
  };

  document.body.appendChild(canvas);

  // 首帧绘制（requestAnimationFrame 确保 CSS 变量已计算完毕）
  requestAnimationFrame(draw);

  // 窗口大小变化时重绘（Tauri 窗口 resize）
  window.addEventListener("resize", () => requestAnimationFrame(draw));

  // DPI 变化时重绘（窗口移到不同 DPI 的显示器）
  const listenDpi = () => {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener("change", () => { requestAnimationFrame(draw); listenDpi(); }, { once: true });
  };
  listenDpi();

  // 主题切换时重绘（:root class/style 变化意味着颜色变量改变）
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
