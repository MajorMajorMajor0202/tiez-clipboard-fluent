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
