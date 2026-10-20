import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface UseNavigationSyncOptions {
  showSettings: boolean;
  showTagManager: boolean;
  showNoteManager?: boolean;
  chatMode: boolean;
  showEmojiPanel: boolean;
}

export const useNavigationSync = ({
  showSettings,
  showTagManager,
  showNoteManager,
  chatMode,
  showEmojiPanel
}: UseNavigationSyncOptions) => {
  useEffect(() => {
    const shouldDisableNavigation = showSettings || showTagManager || showNoteManager || chatMode || showEmojiPanel;
    let disposed = false;
    let revision = 0;
    const update = (visible: boolean) => {
      if (!disposed) invoke("set_navigation_enabled", { enabled: visible && !shouldDisableNavigation }).catch(console.error);
    };
    if (shouldDisableNavigation) update(false);
    const subscriptions = [
      listen("window-shown", () => { ++revision; update(true); }),
      listen("window-hidden", () => { ++revision; update(false); }),
    ];
    // Subscribe first. A slow initial isVisible response must not overwrite a
    // newer show/hide event (tray restore and returning from settings included).
    void Promise.all(subscriptions).then(async () => {
      if (shouldDisableNavigation || disposed) return;
      const requestedRevision = revision;
      try {
        const visible = await getCurrentWindow().isVisible();
        if (requestedRevision === revision) update(visible);
      } catch {
        if (requestedRevision === revision) update(false);
      }
    }).catch(console.error);
    return () => {
      disposed = true;
      subscriptions.forEach(subscription => { void subscription.then(off => off()).catch(console.error); });
    };
  }, [showSettings, showTagManager, showNoteManager, chatMode, showEmojiPanel]);
};
