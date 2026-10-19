import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../lib/tauriRuntime";
import { presentSettingsWindow, waitForSettingsPaint } from "../lib/settingsWindowPresentation";

export function useSettingsWindowPresentation(ready: boolean, theme: string, colorMode: string) {
  const current = useRef({ ready, theme, colorMode });
  current.current = { ready, theme, colorMode };
  const presented = useRef(false);
  const show = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let running = false;
    const reveal = async () => {
      if (disposed || running || !current.current.ready) return;
      running = true;
      const win = getCurrentWindow();
      const root = document.documentElement;
      const dark = current.current.colorMode === "dark" || (current.current.colorMode === "system" && root.classList.contains("dark-mode"));
      root.style.setProperty("--settings-startup-background", dark ? "#202020" : "#f3f3f3");
      root.classList.add("settings-startup");
      let materialReady = false;
      const applyTheme = async () => {
        try {
          await invoke("set_theme", { theme: current.current.theme, colorMode: current.current.colorMode });
          materialReady = true;
        } catch (error) {
          materialReady = false;
          console.error("Settings material unavailable; keeping opaque fallback", error);
        }
      };
      try {
        await presentSettingsWindow({
          applyTheme,
          paint: waitForSettingsPaint,
          show: () => win.show(),
          hideMain: () => invoke("hide_window_cmd", { restoreFocus: false }),
          focus: () => win.setFocus(),
          cancelled: () => disposed,
          settle: async () => {
            // DWM may discard material applied while hidden. Reapply after show
            // messages have been composed; retain the solid first-frame surface.
            await new Promise(resolve => setTimeout(resolve, 150));
            if (disposed) return;
            await applyTheme();
            await waitForSettingsPaint();
          },
          releaseFallback: () => { if (materialReady) root.classList.remove("settings-startup"); },
        });
        if (!disposed) presented.current = true;
      } catch (error) {
        console.error("Failed to prepare settings window", error);
        // Keep the main window usable instead of revealing an unprepared window.
      } finally { running = false; }
    };
    show.current = () => { void reveal(); };
    const subscription = listen("settings-show-request", show.current);
    if (current.current.ready && !presented.current) show.current();
    return () => {
      disposed = true;
      show.current = () => {};
      void subscription.then((off) => off()).catch(console.error);
    };
  }, []);

  useEffect(() => {
    if (ready && !presented.current) show.current();
  }, [ready]);
}
