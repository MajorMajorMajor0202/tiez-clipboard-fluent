import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { applyThemeClasses, normalizeThemeId } from "../config/themes";

interface UseSettingsApplyOptions {
  theme: string;
  colorMode: string;

  compactMode: boolean;
  settingsLoaded: boolean;
  clipboardItemFontSize: number;
  clipboardTagFontSize: number;
  surfaceOpacity: number;
  showAppBorder: boolean;
}

export const useSettingsApply = ({
  theme,
  colorMode,

  compactMode,
  settingsLoaded,
  clipboardItemFontSize,
  clipboardTagFontSize,
  surfaceOpacity,
  showAppBorder: _showAppBorder
}: UseSettingsApplyOptions) => {
  useEffect(() => {
    if (!settingsLoaded) return;

    const root = document.documentElement;
    const body = document.body;

    let disposed = false;
    const normalizedTheme = normalizeThemeId(theme);

    const applyExplicitMode = (mode: "light" | "dark") => {
      if (disposed) return;
      root.classList.remove("light-mode", "dark-mode");
      body.classList.remove("light-mode", "dark-mode");
      if (mode === "dark") {
        root.classList.add("dark-mode");
        body.classList.add("dark-mode");
      } else {
        root.classList.add("light-mode");
        body.classList.add("light-mode");
      }
    };

    const applySystemMode = async () => {
      try {
        const current = await getCurrentWindow().theme();
        if (disposed) return;
        applyExplicitMode(current === "dark" ? "dark" : "light");
      } catch {
        if (disposed) return;
        const isDark =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        applyExplicitMode(isDark ? "dark" : "light");
      }
    };

    applyThemeClasses(normalizedTheme, root, body);

    if (compactMode) {
      body.classList.add("compact-mode");
    } else {
      body.classList.remove("compact-mode");
    }

    if (colorMode === "light") {
      applyExplicitMode("light");
    } else if (colorMode === "dark") {
      applyExplicitMode("dark");
    } else {
      applySystemMode();
    }

    invoke("set_theme", {
      theme: normalizedTheme,
      color_mode: colorMode,
    }).catch(console.error);

    let unlisten: (() => void) | null = null;
    let cleanupMedia: (() => void) | null = null;
    let unlistenSystemTheme: (() => void) | null = null;

    if (colorMode === "system") {
      getCurrentWindow()
        .onThemeChanged((event) => {
          if (disposed) return;
          const next = event?.payload === "dark" ? "dark" : "light";
          applyExplicitMode(next);
          invoke("set_theme", {
            theme: normalizedTheme,
            color_mode: "system",
          }).catch(console.error);
        })
        .then((f) => {
          if (disposed) {
            f();
            return;
          }
          unlisten = f;
        });

      if (window.matchMedia) {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => {
          const next = media.matches ? "dark" : "light";
          applyExplicitMode(next);
          invoke("set_theme", {
            theme: normalizedTheme,
            color_mode: "system",
          }).catch(console.error);
        };
        if (media.addEventListener) {
          media.addEventListener("change", onChange);
          cleanupMedia = () => media.removeEventListener("change", onChange);
        } else {
          media.addListener(onChange);
          cleanupMedia = () => media.removeListener(onChange);
        }
      }

      // Listen for system-theme-changed event emitted by the Rust backend
      // (watch_system_theme polls Windows registry for PowerToys Light Switch etc.)
      listen<string>("system-theme-changed", (event) => {
        if (disposed) return;
        const next = event.payload === "dark" ? "dark" : "light";
        applyExplicitMode(next);
        invoke("set_theme", {
          theme: normalizedTheme,
          color_mode: "system",
        }).catch(console.error);
      })
        .then((f) => {
          if (disposed) {
            f();
            return;
          }
          unlistenSystemTheme = f;
        })
        .catch(console.error);
    }

    return () => {
      disposed = true;
      if (unlisten) unlisten();
      if (cleanupMedia) cleanupMedia();
      if (unlistenSystemTheme) unlistenSystemTheme();
    };
  }, [theme, colorMode, settingsLoaded, compactMode]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const root = document.documentElement;
    root.style.setProperty("--clipboard-item-font-size", `${clipboardItemFontSize}px`);
    root.style.setProperty("--clipboard-tag-font-size", `${clipboardTagFontSize}px`);
    const scale = Math.min(2, Math.max(0, surfaceOpacity / 50));
    root.style.setProperty("--surface-opacity-scale", scale.toString());
  }, [clipboardItemFontSize, clipboardTagFontSize, surfaceOpacity, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const root = document.documentElement;
    const body = document.body;
    if (_showAppBorder) {
      root.classList.remove("hide-app-border");
      body.classList.remove("hide-app-border");
    } else {
      root.classList.add("hide-app-border");
      body.classList.add("hide-app-border");
    }
  }, [_showAppBorder, settingsLoaded]);
};
