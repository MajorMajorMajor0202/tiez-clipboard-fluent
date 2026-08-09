import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DefaultAppsMap, InstalledAppOption } from "../../features/app/types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "../lib/tauriRuntime";

interface UseAppBootstrapOptions {
  fetchEffectiveTransferPath: () => void;
  setDataPath: Dispatch<SetStateAction<string>>;
  setInstalledApps: Dispatch<SetStateAction<InstalledAppOption[]>>;
  setAutoStart: Dispatch<SetStateAction<boolean>>;
  setDefaultApps: Dispatch<SetStateAction<DefaultAppsMap>>;
  setFileServerEnabled: Dispatch<SetStateAction<boolean>>;
  setActualPort: Dispatch<SetStateAction<string>>;
  setLocalIp: Dispatch<SetStateAction<string>>;
  setAvailableIps: Dispatch<SetStateAction<string[]>>;
  setWinClipboardDisabled: Dispatch<SetStateAction<boolean>>;
}

interface FileServerStatusPayload {
  enabled: boolean;
  port: number;
  ip: string;
}

// Module-level singleton: only run the expensive app scan once per session,
// even if multiple components call useAppBootstrap (e.g. App.tsx, SettingsWindow, AdvancedSettingsWindow).
let appScanPromise: Promise<InstalledAppOption[]> | null = null;

const getInstalledApps = (): Promise<InstalledAppOption[]> => {
  if (!appScanPromise) {
    appScanPromise = invoke<{ name: string; path: string }[]>("scan_installed_apps")
      .then((apps) => {
        if (apps && apps.length > 0) {
          return apps
            .map((a) => ({ label: a.name, value: a.path }))
            .sort((a, b) => a.label.localeCompare(b.label));
        }
        console.warn("No apps found by scan_installed_apps");
        return [];
      })
      .catch((err) => {
        console.error("Failed to scan apps:", err);
        appScanPromise = null; // allow retry on next mount if it failed
        return [];
      });
  }
  return appScanPromise;
};

export const useAppBootstrap = ({
  fetchEffectiveTransferPath,
  setDataPath,
  setInstalledApps,
  setAutoStart,
  setDefaultApps,
  setFileServerEnabled,
  setActualPort,
  setLocalIp,
  setAvailableIps,
  setWinClipboardDisabled: _setWinClipboardDisabled
}: UseAppBootstrapOptions) => {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    fetchEffectiveTransferPath();

    invoke<string>("get_data_path").then(setDataPath).catch(console.error);

    // Use the singleton so scan_installed_apps is only called once per session
    getInstalledApps().then((apps) => {
      if (apps.length > 0) setInstalledApps(apps);
    });

    invoke<boolean>("is_autostart_enabled").then(setAutoStart).catch(console.error);


    const types = ["text", "rich_text", "image", "video", "code", "url"];
    types.forEach(async (type) => {
      try {
        const name = await invoke<string>("get_system_default_app", { contentType: type });
        setDefaultApps((prev) => ({ ...prev, [type]: name }));
      } catch (err) {
        console.error(`Failed to get default for ${type}`, err);
      }
    });

    const setupServerListener = async () => {
      const unlisten = await listen<FileServerStatusPayload>("file-server-status-changed", (event) => {
        const payload = event.payload;
        setFileServerEnabled(payload.enabled);
        setActualPort(payload.port === 0 ? "" : payload.port.toString());
        setLocalIp(payload.ip);
      });
      return unlisten;
    };

    let unlistenServer: (() => void) | undefined;
    setupServerListener().then((u) => {
      unlistenServer = u;
    });

    invoke<FileServerStatusPayload>("get_file_server_status")
      .then((status) => {
        setFileServerEnabled(status.enabled);
        setActualPort(status.port === 0 ? "" : status.port.toString());
        setLocalIp(status.ip);
      })
      .catch(console.error);

    invoke<string[]>("get_available_ips")
      .then((ips) => {
        if (ips && ips.length > 0) setAvailableIps(ips);
      })
      .catch(console.error);

    return () => {
      if (unlistenServer) unlistenServer();
    };
  }, [
    fetchEffectiveTransferPath,
    setActualPort,
    setAutoStart,
    setAvailableIps,
    setDataPath,
    setDefaultApps,
    setFileServerEnabled,
    setInstalledApps,
    setLocalIp,
  ]);
};
