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
      try {
        await presentSettingsWindow({
          applyTheme: () => invoke("set_theme", { theme: current.current.theme, colorMode: current.current.colorMode }),
          paint: waitForSettingsPaint,
          show: () => win.show(),
          hideMain: () => invoke("hide_window_cmd", { restoreFocus: false }),
          focus: () => win.setFocus(),
          cancelled: () => disposed,
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
