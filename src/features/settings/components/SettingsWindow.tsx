import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import {
  ChevronDown,
  Sliders,
  Shield,
  Wifi,
  Cpu,
  Palette,
  Settings
} from "lucide-react";
import { translations } from "../../../locales";
import { useAppState } from "../../app/hooks/useAppState";
import { useSettingsInit } from "../../../shared/hooks/useSettingsInit";
import { useSettingsPostInit } from "../../../shared/hooks/useSettingsPostInit";
import { useAppBootstrap } from "../../../shared/hooks/useAppBootstrap";
import { useSettingsApply } from "../../../shared/hooks/useSettingsApply";
import { useCustomBackground } from "../../../shared/hooks/useCustomBackground";
import { useHotkeyConfig } from "../../../shared/hooks/useHotkeyConfig";
import { getHotkeyDisplayTokens } from "../../../shared/lib/hotkeyDisplay";
import { isMacPlatform } from "../../../shared/lib/platform";
import { CLOUD_SYNC_ENABLED } from "../../../shared/config/edition";
import { THEMES, getThemeLabel, supportsCustomBackground, supportsSurfaceOpacity } from "../../../shared/config/themes";

import type { Locale } from "../../../shared/types";
import type { QuickPasteModifier } from "../../app/types";
import type { AiProfile, EditableAiProfile, AiProfileStatusMap } from "../../settings/types";
import type { CloudSyncStatusPayload } from "./groups/CloudSyncSettingsGroup";

// Modals & Panels
import AppSelectorModal from "./AppSelectorModal";
import AiProfileModal from "./AiProfileModal";
import ThemeStorePanel from "../../theme-store/components/ThemeStorePanel";
import AdvancedSettingsGroup from "./groups/AdvancedSettingsGroup";

const SettingsWindow = () => {
  const appState = useAppState();
  const {
    setAppSettings,
    setHotkey,
    theme,
    setTheme,
    colorMode,
    setColorMode,
    compactMode,
    setCompactMode,
    language,
    setLanguage,
    customBackground,
    setCustomBackground,
    customBackgroundOpacity,
    setCustomBackgroundOpacity,
    surfaceOpacity,
    setSurfaceOpacity,
    persistent,
    setPersistent,
    persistentLimitEnabled,
    setPersistentLimitEnabled,
    persistentLimit,
    setPersistentLimit,
    deduplicate,
    setDeduplicate,
    captureFiles,
    setCaptureFiles,
    captureRichText,
    setCaptureRichText,
    richTextSnapshotPreview,
    setRichTextSnapshotPreview,
    privacyProtection,
    setPrivacyProtection,
    privacyProtectionKinds,
    setPrivacyProtectionKinds,
    privacyProtectionCustomRules,
    setPrivacyProtectionCustomRules,
    sensitiveMaskPrefixVisible,
    setSensitiveMaskPrefixVisible,
    sensitiveMaskSuffixVisible,
    setSensitiveMaskSuffixVisible,
    sensitiveMaskEmailDomain,
    setSensitiveMaskEmailDomain,
    cleanupRules,
    setCleanupRules,
    appCleanupPolicies,
    setAppCleanupPolicies,
    silentStart,
    setSilentStart,
    showSourceAppIcon,
    setShowSourceAppIcon,
    deleteAfterPaste,
    setDeleteAfterPaste,
    moveToTopAfterPaste,
    setMoveToTopAfterPaste,
    hideTrayIcon,
    setHideTrayIcon,
    hideDockIcon,
    setHideDockIcon,
    edgeDocking,
    setEdgeDocking,
    showSearchBox,
    setShowSearchBox,
    scrollTopButtonEnabled,
    setScrollTopButtonEnabled,
    arrowKeySelection,
    setArrowKeySelection,
    mqttEnabled,
    setMqttEnabled,
    mqttServer,
    setMqttServer,
    mqttPort,
    setMqttPort,
    mqttUser,
    setMqttUser,
    mqttPass,
    setMqttPass,
    mqttTopic,
    setMqttTopic,
    mqttProtocol,
    setMqttProtocol,
    mqttWsPath,
    setMqttWsPath,
    mqttNotificationEnabled,
    setMqttNotificationEnabled,
    cloudSyncEnabled,
    setCloudSyncEnabled,
    cloudSyncAuto,
    setCloudSyncAuto,
    cloudSyncIntervalSec,
    setCloudSyncIntervalSec,
    cloudSyncSnapshotIntervalMin,
    setCloudSyncSnapshotIntervalMin,
    cloudSyncWebdavUrl,
    setCloudSyncWebdavUrl,
    cloudSyncWebdavUsername,
    setCloudSyncWebdavUsername,
    cloudSyncWebdavPassword,
    setCloudSyncWebdavPassword,
    cloudSyncWebdavBasePath,
    setCloudSyncWebdavBasePath,
    setCloudSyncContentPrefs,
    fileServerEnabled,
    setFileServerEnabled,
    fileServerPort,
    setFileServerPort,
    fileServerAutoClose,
    setFileServerAutoClose,
    fileTransferAutoOpen,
    setFileTransferAutoOpen,
    fileTransferAutoCopy,
    setFileTransferAutoCopy,
    fileTransferPath,
    setFileTransferPath,
    actualPort,
    setActualPort,
    localIp,
    setLocalIp,
    availableIps,
    setAvailableIps,
    dataPath,
    setDataPath,
    installedApps,
    setInstalledApps,
    aiEnabled,
    setAiEnabled,
    aiTargetLang,
    setAiTargetLang,
    aiThinkingBudget,
    setAiThinkingBudget,
    aiProfiles,
    setAiProfiles,
    aiAssignedProfileTask,
    setAiAssignedProfileTask,
    aiAssignedProfileMouthpiece,
    setAiAssignedProfileMouthpiece,
    aiAssignedProfileTranslate,
    setAiAssignedProfileTranslate,
    soundEnabled,
    setSoundEnabled,
    soundVolume,
    setSoundVolume,
    pasteSoundEnabled,
    setPasteSoundEnabled,
    hotkey,
    sequentialHotkey,
    setSequentialHotkey,
    richPasteHotkey,
    setRichPasteHotkey,
    searchHotkey,
    setSearchHotkey,
    quickPasteModifier,
    setQuickPasteModifier,
    sequentialMode,
    setSequentialModeState,
    isRecording,
    setIsRecording,
    isRecordingSequential,
    setIsRecordingSequential,
    isRecordingRich,
    setIsRecordingRich,
    isRecordingSearch,
    setIsRecordingSearch,
    emojiPanelEnabled,
    setEmojiPanelEnabled,
    tagManagerEnabled,
    setTagManagerEnabled,
    appSettings,
    defaultApps,
    autoStart,
    setAutoStart,
    setCloudSyncServer,
    clipboardItemFontSize,
    setClipboardItemFontSize,
    clipboardTagFontSize,
    setClipboardTagFontSize,
    setDefaultApps,
    settingsLoaded,
    setSettingsLoaded,
    setFollowMouse,
    showAppBorder,
    setShowAppBorder,
    setWinClipboardDisabled,
    setRegistryWinVEnabled,
    setPasteMethod,
    setIsWindowPinned,
    setEmojiPanelTab,
    setEmojiFavorites,
    setCloudSyncProvider,
    setCloudSyncApiKey
  } = appState;

  // Local state for UI navigation and overlays
  const [activeTab, setActiveTab] = useState<string>("general");
  const [settingsSubpage, setSettingsSubpage] = useState<"home" | "theme-store" | "advanced">("home");
  const [toast, setToast] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("0.3.0");
  const [mqttStatus, setMqttStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatusPayload>({
    state: "disabled",
    running: false,
    last_sync_at: null,
    last_error: null,
    uploaded_items: 0,
    received_items: 0
  });
  const [cloudSyncNowRunning, setCloudSyncNowRunning] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EditableAiProfile | null>(null);
  const [profileStatuses, setProfileStatuses] = useState<AiProfileStatusMap>({});
  const [showAppSelector, setShowAppSelector] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const tagManagerSizeRef = useRef<{ width: number; height: number } | null>(null);

  const pushToast = useCallback((msg: string, duration?: number) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, duration || 2500);
    return Date.now();
  }, []);

  const t = useCallback((key: string) => {
    const k = key as keyof typeof translations["zh"];
    return translations[language][k] || translations["en"][k] || key;
  }, [language]);

  // Load and bootstrap settings
  const settings = useSettingsInit({
    setAppSettings,
    setHotkey,
    setTheme,
    setColorMode,
    setCompactMode,
    setLanguage
  });

  useSettingsPostInit({
    settings,
    tagManagerSizeRef,
    setCustomBackground,
    setCustomBackgroundOpacity,
    setSurfaceOpacity,
    setPersistent,
    setPersistentLimitEnabled,
    setPersistentLimit,
    setDeduplicate,
    setCaptureFiles,
    setCaptureRichText,
    setRichTextSnapshotPreview,
    setPrivacyProtection,
    setPrivacyProtectionKinds,
    setPrivacyProtectionCustomRules,
    setSensitiveMaskPrefixVisible,
    setSensitiveMaskSuffixVisible,
    setSensitiveMaskEmailDomain,
    setCleanupRules,
    setAppCleanupPolicies,
    setSilentStart,
    setFollowMouse,
    setShowAppBorder,
    setShowSourceAppIcon,
    setDeleteAfterPaste,
    setMoveToTopAfterPaste,
    setHideTrayIcon,
    setEdgeDocking,
    setShowSearchBox,
    setScrollTopButtonEnabled,
    setArrowKeySelection,
    setMqttEnabled,
    setMqttServer,
    setRegistryWinVEnabled,
    setMqttPort,
    setMqttUser,
    setMqttPass,
    setMqttTopic,
    setMqttProtocol,
    setMqttWsPath,
    setMqttNotificationEnabled,
    setCloudSyncEnabled,
    setCloudSyncAuto,
    setCloudSyncProvider,
    setCloudSyncServer,
    setCloudSyncApiKey,
    setCloudSyncIntervalSec,
    setCloudSyncSnapshotIntervalMin,
    setCloudSyncWebdavUrl,
    setCloudSyncWebdavUsername,
    setCloudSyncWebdavPassword,
    setCloudSyncWebdavBasePath,
    setFileServerAutoClose,
    setFileTransferAutoOpen,
    setFileTransferAutoCopy,
    setFileServerPort,
    setSequentialHotkey,
    setRichPasteHotkey,
    setSearchHotkey,
    setQuickPasteModifier,
    setSequentialModeState,
    setSoundEnabled,
    setSoundVolume,
    setPasteSoundEnabled,
    setPasteMethod,
    setAiEnabled,
    setAiTargetLang,
    setAiThinkingBudget,
    setIsWindowPinned,
    setAiProfiles,
    setAiAssignedProfileTask,
    setAiAssignedProfileMouthpiece,
    setAiAssignedProfileTranslate,
    setSettingsLoaded,
    setClipboardItemFontSize,
    setClipboardTagFontSize,
    setEmojiPanelEnabled,
    setTagManagerEnabled,
    setEmojiPanelTab,
    setEmojiFavorites,
    setHideDockIcon,
    setCloudSyncContentPrefs
  });

  const fetchEffectiveTransferPath = useCallback(() => {
    invoke<string>("get_active_file_transfer_path")
      .then(setFileTransferPath)
      .catch(console.error);
  }, [setFileTransferPath]);

  useAppBootstrap({
    fetchEffectiveTransferPath,
    setDataPath,
    setInstalledApps,
    setAutoStart,
    setWinClipboardDisabled,
    setDefaultApps,
    setFileServerEnabled,
    setActualPort,
    setLocalIp,
    setAvailableIps
  });

  useSettingsApply({
    theme,
    colorMode,
    showAppBorder,
    compactMode,
    settingsLoaded,
    clipboardItemFontSize,
    clipboardTagFontSize,
    surfaceOpacity
  });

  useCustomBackground({
    customBackground,
    customBackgroundOpacity,
    theme
  });

  // Accent color loader and active tab indicator vertical slider
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [indicatorRect, setIndicatorRect] = useState<{ top: number; height: number } | null>(null);

  const updateIndicator = useCallback(() => {
    if (!sidebarRef.current || !activeTab) {
      setIndicatorRect(null);
      return;
    }
    const activeBtn = sidebarRef.current.querySelector('.fluent-sidebar-item.active') as HTMLElement | null;
    if (!activeBtn) {
      setIndicatorRect(null);
      return;
    }
    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    setIndicatorRect({
      top: btnRect.top - sidebarRect.top + (btnRect.height - 20) / 2,
      height: 20,
    });
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Re-measure on resize
  useEffect(() => {
    if (!sidebarRef.current) return;
    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    observer.observe(sidebarRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlColorMode = params.get("color_mode");
    const urlTheme = params.get("theme") || "retro";
    if (urlColorMode) {
      invoke("set_theme", {
        theme: urlTheme,
        color_mode: urlColorMode
      }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    const applyAccent = (hex: string) => {
      const raw = hex.replace("#", "");
      const r = parseInt(raw.substring(0, 2), 16);
      const g = parseInt(raw.substring(2, 4), 16);
      const b = parseInt(raw.substring(4, 6), 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return;

      const root = document.documentElement;
      root.style.setProperty("--accent-color", hex);
      root.style.setProperty("--accent-color-rgb", `${r}, ${g}, ${b}`);
    };

    const updateAccent = () => {
      invoke<string | null>("get_system_accent_color")
        .then((color) => {
          if (color) applyAccent(color);
        })
        .catch(() => {});
    };

    updateAccent();
    const interval = setInterval(updateAccent, 3000);
    return () => clearInterval(interval);
  }, [settingsLoaded]);

  const saveAppSetting = useCallback(async (type: string, path: string) => {
    const key = `app.${type}`;
    setAppSettings(prev => ({ ...prev, [key]: path }));
    try {
      if (type === 'theme') localStorage.setItem('tiez_theme', path);
      if (type === 'color_mode') localStorage.setItem('tiez_color_mode', path);
      if (type === 'compact_mode') localStorage.setItem('tiez_compact_mode', path);
    } catch (e) {}

    try {
      await invoke("save_setting", { key, value: path });
    } catch (err) {
      console.error("Failed to save settings", err);
    }
  }, [setAppSettings]);

  const saveSetting = useCallback((key: string, val: string) => {
    invoke("save_setting", { key, value: val }).catch(console.error);
  }, []);

  const saveMqtt = useCallback(async (key: string, value: string) => {
    try {
      await invoke("save_setting", { key, value });
      const mqttKeys = ["mqtt_enabled", "mqtt_server", "mqtt_port", "mqtt_username", "mqtt_password", "mqtt_topic", "mqtt_protocol", "mqtt_client_id"];
      if (key === "mqtt_enabled" && value === "true") {
        await invoke("restart_mqtt_client");
      } else if (mqttKeys.includes(key) && mqttEnabled) {
        await invoke("restart_mqtt_client");
      }
    } catch (err) {
      console.error("MQTT Set save failed", err);
    }
  }, [mqttEnabled]);

  const saveCloudSync = useCallback(async (key: string, value: string) => {
    try {
      if (key === "cloud_sync_enabled" && value === "false") {
        await invoke("stop_cloud_sync_client");
      }
      await invoke("save_setting", { key, value });
      const cloudKeys = [
        "cloud_sync_enabled", "cloud_sync_auto", "cloud_sync_provider", "cloud_sync_server", "cloud_sync_api_key",
        "cloud_sync_interval_sec", "cloud_sync_snapshot_interval_min", "cloud_sync_webdav_url",
        "cloud_sync_webdav_username", "cloud_sync_webdav_password", "cloud_sync_webdav_base_path", "cloud_sync_content_prefs"
      ];
      if (key === "cloud_sync_enabled") {
        if (value !== "false") {
          await invoke("restart_cloud_sync_client");
        }
      } else if (cloudKeys.includes(key) && cloudSyncEnabled) {
        await invoke("restart_cloud_sync_client");
      }
    } catch (err) {
      console.error("Cloud sync setting save failed", err);
    }
  }, [cloudSyncEnabled]);

  const handleResetSettings = useCallback(async () => {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    const confirm = await ask(t("reset_confirm"), { title: t("reset_confirm"), kind: "warning" });
    if (confirm) {
      try {
        await invoke("reset_settings");
        window.location.reload();
      } catch (err) {
        pushToast(t("reset_failed") + (err?.toString() || ""));
      }
    }
  }, [pushToast, t]);

  const handleCloudSyncNow = async () => {
    if (!CLOUD_SYNC_ENABLED) return;
    setCloudSyncNowRunning(true);
    try {
      const status = await invoke<CloudSyncStatusPayload>("cloud_sync_now");
      setCloudSyncStatus(status);
      pushToast("云同步任务执行完毕");
    } catch (err) {
      console.error("Cloud sync now failed:", err);
      pushToast("同步失败");
    } finally {
      setCloudSyncNowRunning(false);
    }
  };

  const applyFileServerPort = async (portStr: string) => {
    const port = Number(portStr);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return;
    if (!fileServerEnabled) return;
    try {
      await invoke("toggle_file_server", { enabled: false });
      await invoke("toggle_file_server", { enabled: true, port });
    } catch (e) {
      console.error(e);
    }
  };

  // Hotkeys handling
  const {
    updateHotkey,
    updateSequentialHotkey,
    updateRichPasteHotkey,
    updateSearchHotkey
  } = useHotkeyConfig({
    hotkey,
    setHotkey,
    sequentialHotkey,
    setSequentialHotkey,
    richPasteHotkey,
    setRichPasteHotkey,
    searchHotkey,
    setSearchHotkey,
    sequentialMode,
    isRecording,
    setIsRecording,
    isRecordingSequential,
    setIsRecordingSequential,
    isRecordingRich,
    setIsRecordingRich,
    isRecordingSearch,
    setIsRecordingSearch,
    saveAppSetting,
    t,
    pushToast
  });

  // Listeners for system status (MQTT/Cloud)
  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("0.3.0"));

    const unlistenMqtt = listen<string>("mqtt-status", (event) => {
      setMqttStatus(event.payload as "connected" | "disconnected" | "connecting");
    });

    let unlistenCloud: Promise<() => void> | null = null;
    if (CLOUD_SYNC_ENABLED) {
      unlistenCloud = listen<CloudSyncStatusPayload>("cloud-sync-status", (event) => {
        setCloudSyncStatus(event.payload);
      });
      invoke<CloudSyncStatusPayload>("get_cloud_sync_status")
        .then(setCloudSyncStatus)
        .catch(console.error);
    }

    Promise.all([
      invoke<boolean>("get_mqtt_status"),
      invoke<boolean>("get_mqtt_running")
    ]).then(([connected, running]) => {
      if (connected) setMqttStatus("connected");
      else if (running) setMqttStatus("connecting");
    }).catch(console.error);

    return () => {
      unlistenMqtt.then(f => f());
      if (unlistenCloud) unlistenCloud.then(f => f());
    };
  }, []);

  // AI model actions
  const checkModelStatus = async (profile: AiProfile) => {
    setProfileStatuses(prev => ({ ...prev, [profile.id]: 'loading' }));
    try {
      const result = await invoke<string>("check_ai_connectivity", {
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: profile.model
      });
      if (result === "success") {
        setProfileStatuses(prev => ({ ...prev, [profile.id]: 'success' }));
      }
    } catch (e) {
      setProfileStatuses(prev => ({ ...prev, [profile.id]: 'error' }));
    }
  };

  const handleSaveProfile = (profile: EditableAiProfile) => {
    let newProfiles: AiProfile[];
    if (profile.isNew) {
      const { isNew, id: _id, ...rest } = profile;
      newProfiles = [...aiProfiles, { ...rest, id: Date.now().toString() }];
    } else {
      if (!profile.id) return;
      const { isNew, ...rest } = profile;
      const updatedProfile: AiProfile = { ...rest, id: profile.id };
      newProfiles = aiProfiles.map(p => p.id === profile.id ? updatedProfile : p);
    }
    setAiProfiles(newProfiles);
    saveSetting('ai_profiles', JSON.stringify(newProfiles));
    setEditingProfile(null);
  };

  const handleDeleteProfile = (id: string) => {
    if (['lc_flash_v1', 'lc_think_v1', 'lc_think_2601_v1'].includes(id)) return;
    const newProfiles = aiProfiles.filter(p => p.id !== id);
    setAiProfiles(newProfiles);
    saveSetting('ai_profiles', JSON.stringify(newProfiles));
  };

  // Toggle helper for Settings Expander
  const toggleExpander = (key: string) => {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderHotkeyCaps = (hk: string) => {
    const tokens = getHotkeyDisplayTokens(hk, { preferMacSymbols: true });
    if (tokens.length === 0) return <span style={{ opacity: 0.5 }}>{t('not_set')}</span>;
    return <span className="fluent-value-display">{tokens.map(t => t.label).join("")}</span>;
  };

  // Return Theme Store subpage if open
  if (settingsSubpage === "theme-store") {
    return (
      <div style={{ height: "100vh", overflow: "auto", background: "var(--bg-body)", padding: "16px" }}>
        <ThemeStorePanel
          t={t}
          theme={theme}
          setTheme={setTheme}
          saveAppSetting={saveAppSetting}
          language={language}
          onBack={() => setSettingsSubpage("home")}
        />
      </div>
    );
  }

  // Sidebar items
  const menuItems = [
    { id: "general", label: t("general_settings") || "常规与系统", icon: <Settings size={16} /> },
    { id: "clipboard", label: t("clipboard_settings") || "剪贴板与热键", icon: <Sliders size={16} /> },
    { id: "privacy", label: t("privacy_protection") || "隐私与过滤", icon: <Shield size={16} /> },
    { id: "sync", label: t("sync_settings") || "同步与传输", icon: <Wifi size={16} /> },
    { id: "ai", label: t("ai_settings") || "AI 智能助手", icon: <Cpu size={16} /> },
    { id: "appearance", label: t("appearance_settings") || "个性化外观", icon: <Palette size={16} /> },
    { id: "advanced", label: t("advanced_settings") || "高级设置", icon: <Sliders size={16} /> }
  ];

  return (
    <div className="fluent-settings-layout">
      {/* Sidebar Navigation */}
      <div ref={sidebarRef} className="fluent-sidebar">
        <div style={{ padding: "8px 12px 16px", fontSize: "16px", fontWeight: 700 }}>设置</div>
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setSettingsSubpage("home");
            }}
            className={`fluent-sidebar-item ${activeTab === item.id ? "active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        {indicatorRect && (
          <div
            className="fluent-sidebar-indicator"
            style={{ transform: `translateY(${indicatorRect.top}px)` }}
          >
            <div key={activeTab} className="fluent-sidebar-indicator-inner" />
          </div>
        )}
        <div style={{ marginTop: "auto", padding: "8px 12px", fontSize: "11px", color: "var(--text-secondary)" }}>
          TieZ v{appVersion}
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="fluent-settings-content">
        {toast && <div className="fluent-toast">{toast}</div>}

        {/* Tab 1: General & System */}
        {activeTab === "general" && (
          <div>
            <h2 className="fluent-page-header">常规与系统</h2>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">开机自启动</span>
                <span className="fluent-setting-description">允许程序随操作系统一同启动</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    invoke("toggle_autostart", { enabled }).catch(console.error);
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">静默启动</span>
                <span className="fluent-setting-description">随开机启动时隐藏主窗口，仅在后台托盘静默运行</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={silentStart}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setSilentStart(enabled);
                    invoke("set_silent_start", { enabled }).catch(console.error);
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">隐藏系统托盘图标</span>
                <span className="fluent-setting-description">隐藏右下角通知区域的图标 (需要重启应用以完全应用)</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={hideTrayIcon}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setHideTrayIcon(val);
                    invoke("set_tray_visible", { visible: !val }).catch(console.error);
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            {isMacPlatform() && (
              <div className="fluent-setting-card">
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">隐藏 macOS Dock 图标</span>
                  <span className="fluent-setting-description">隐藏 Dock 上的图标</span>
                </div>
                <label className="fluent-switch">
                  <input
                    type="checkbox"
                    checked={hideDockIcon}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setHideDockIcon(val);
                      invoke("set_dock_visible", { visible: !val }).catch(console.error);
                    }}
                  />
                  <span className="fluent-slider" />
                </label>
              </div>
            )}

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">边缘贴边停靠</span>
                <span className="fluent-setting-description">窗口悬浮停靠在屏幕边缘时自动吸附隐藏</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={edgeDocking}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setEdgeDocking(val);
                    invoke("set_edge_docking", { enabled: val }).catch(console.error);
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">显示快捷搜索框</span>
                <span className="fluent-setting-description">展示主界面底部的全局搜索输入框</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={showSearchBox}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setShowSearchBox(enabled);
                    saveAppSetting('show_search_box', String(enabled));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">显示回到顶部浮动按钮</span>
                <span className="fluent-setting-description">当剪贴板列表滚动较深时，展示一键回到顶部的悬浮按钮</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={scrollTopButtonEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setScrollTopButtonEnabled(enabled);
                    saveAppSetting('show_scroll_top_button', String(enabled));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">启用标签管理器</span>
                <span className="fluent-setting-description">开启后可以为剪贴板项分配多色分类标签</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={tagManagerEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setTagManagerEnabled(enabled);
                    saveAppSetting('tag_manager_enabled', String(enabled));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">启用表情包栏面板</span>
                <span className="fluent-setting-description">开启后允许在主界面头部快速插入常用表情包和GIF图片</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={emojiPanelEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setEmojiPanelEnabled(enabled);
                    saveAppSetting('emoji_panel_enabled', String(enabled));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">启用快捷键选择</span>
                <span className="fluent-setting-description">允许在列表里使用方向键移动和选中项目</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={arrowKeySelection}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setArrowKeySelection(enabled);
                    saveAppSetting('arrow_key_selection', String(enabled));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            {/* Audio Feedback Expander */}
            <div className={`fluent-setting-expander ${!soundEnabled ? 'disabled' : ''}`}>
              <div
                className={`fluent-setting-expander-header ${expandedCards['audio'] && soundEnabled ? 'expanded' : ''} ${!soundEnabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (soundEnabled) toggleExpander('audio');
                }}
              >
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">按键与粘贴音效</span>
                  <span className="fluent-setting-description">开启软件按键交互音效及成功粘贴提示声</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <label className="fluent-switch" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setSoundEnabled(enabled);
                        invoke("set_sound_enabled", { enabled }).catch(console.error);
                      }}
                    />
                    <span className="fluent-slider" />
                  </label>
                  <ChevronDown size={16} className={`fluent-chevron ${expandedCards['audio'] && soundEnabled ? 'expanded' : ''}`} />
                </div>
              </div>
              {expandedCards['audio'] && soundEnabled && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">粘贴音效</span>
                      <span className="fluent-setting-description">当成功模拟粘贴完成后播放提示音</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={pasteSoundEnabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setPasteSoundEnabled(enabled);
                          invoke("save_setting", { key: 'app.sound_paste_enabled', value: String(enabled) }).catch(console.error);
                        }}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="fluent-setting-title">音量大小</span>
                      <span style={{ fontSize: "11px" }}>{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      className="fluent-range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={soundVolume}
                      onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Default Apps Expander */}
            <div className="fluent-setting-expander">
              <div
                className={`fluent-setting-expander-header ${expandedCards['apps'] ? 'expanded' : ''}`}
                onClick={() => toggleExpander('apps')}
              >
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">默认打开程序</span>
                  <span className="fluent-setting-description">配置剪贴板中不同格式条目的默认双击打开软件</span>
                </div>
                <ChevronDown size={16} className={`fluent-chevron ${expandedCards['apps'] ? 'expanded' : ''}`} />
              </div>
              {expandedCards['apps'] && (
                <div className="fluent-setting-expander-content">
                  {['text', 'rich_text', 'image', 'video', 'code', 'url'].map(type => (
                    <div key={type} className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title" style={{ textTransform: "uppercase" }}>{t(`type_${type}`) || type}</span>
                        <span className="fluent-setting-description">
                          {appSettings[`app.${type}`]
                            ? (() => {
                              const path = appSettings[`app.${type}`];
                              const found = installedApps.find(app => app.value === path);
                              if (found) return found.label;
                              const filename = path.split(/[/\\]/).pop() || path;
                              return filename.replace(/\.exe$/i, '');
                            })()
                            : (defaultApps[type] ? `${t('system_default')} (${defaultApps[type].replace(/\.exe$/i, '')})` : t('not_configured'))}
                        </span>
                      </div>
                      <button className="fluent-button" onClick={() => setShowAppSelector(type)}>更改程序</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Data storage Card */}
            <h3 className="fluent-section-title">存储与数据库</h3>
            <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">数据库物理路径</span>
                  <span className="fluent-setting-description">存储所有本地历史数据的文件路径</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="fluent-button"
                    onClick={async () => {
                      const { open, ask, message } = await import("@tauri-apps/plugin-dialog");
                      open({ directory: true, multiple: false, title: t('change_data_path') })
                        .then(async (selected) => {
                          if (selected) {
                            const newPath = selected as string;
                            const confirm = await ask(
                              t('data_move_confirm').replace('{path}', newPath),
                              { title: t('change_data_path'), kind: 'warning' }
                            );
                            if (confirm) {
                              try {
                                await invoke("set_data_path", { newPath });
                                await message(t('data_move_success'), { title: t('notice'), kind: 'info' });
                                await invoke("relaunch");
                              } catch (e) {
                                pushToast(String(e));
                              }
                            }
                          }
                        });
                    }}
                  >
                    搬迁数据库
                  </button>
                  <button className="fluent-button" onClick={() => invoke("open_data_folder").catch(console.error)}>
                    打开数据目录
                  </button>
                </div>
              </div>
              <div className="fluent-value-display" style={{ wordBreak: "break-all" }}>{dataPath}</div>
            </div>
            
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">出厂重置所有设置</span>
                <span className="fluent-setting-description">清除所有设置并恢复默认，这不会清空您的剪贴板数据库</span>
              </div>
              <button className="fluent-button" onClick={handleResetSettings} style={{ color: "#f44336", borderColor: "rgba(244,67,54,0.3)" }}>重置设置</button>
            </div>
          </div>
        )}

        {/* Tab 2: Clipboard & Hotkeys */}
        {activeTab === "clipboard" && (
          <div>
            <h2 className="fluent-page-header">剪贴板与热键</h2>

            {/* Hotkey Recorders expander */}
            <div className="fluent-setting-expander">
              <div
                className={`fluent-setting-expander-header ${expandedCards['hotkeys'] ? 'expanded' : ''}`}
                onClick={() => toggleExpander('hotkeys')}
              >
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">全局与核心热键</span>
                  <span className="fluent-setting-description">设置各种唤起主界面和快捷粘贴的热键</span>
                </div>
                <ChevronDown size={16} className={`fluent-chevron ${expandedCards['hotkeys'] ? 'expanded' : ''}`} />
              </div>
              {expandedCards['hotkeys'] && (
                <div className="fluent-setting-expander-content">
                  {/* Global hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">主程序全局呼出快捷键</span>
                      <span className="fluent-setting-description">
                        {isRecording ? "等待输入... 请直接按下键盘组合键，Esc键取消，退格键清空" : "全局任意地方快速调出主界面的快捷键"}
                      </span>
                    </div>
                    <div
                      className={`fluent-value-display ${isRecording ? 'recording' : ''}`}
                      style={{ cursor: "pointer", border: isRecording ? "1px solid var(--accent-color)" : undefined }}
                      onClick={() => setIsRecording(true)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (!isRecording) return;
                        e.preventDefault(); e.stopPropagation();
                        if (e.key === 'Escape') { setIsRecording(false); return; }
                        if (e.key === 'Backspace' || e.key === 'Delete') { updateHotkey(''); setIsRecording(false); return; }
                        const modifiers = [];
                        if (e.ctrlKey) modifiers.push('Ctrl');
                        if (e.shiftKey) modifiers.push('Shift');
                        if (e.altKey) modifiers.push('Alt');
                        if (e.metaKey) modifiers.push('Command');
                        const key = e.key.toUpperCase();
                        if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return;
                        updateHotkey([...modifiers, key].join('+'));
                      }}
                    >
                      {isRecording ? "等待按键..." : renderHotkeyCaps(hotkey)}
                    </div>
                  </div>

                  {/* Search hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">直接进入搜索热键</span>
                      <span className="fluent-setting-description">激活后主窗口立即进入搜索状态</span>
                    </div>
                    <div
                      className={`fluent-value-display ${isRecordingSearch ? 'recording' : ''}`}
                      style={{ cursor: "pointer", border: isRecordingSearch ? "1px solid var(--accent-color)" : undefined }}
                      onClick={() => setIsRecordingSearch(true)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (!isRecordingSearch) return;
                        e.preventDefault(); e.stopPropagation();
                        if (e.key === 'Escape') { setIsRecordingSearch(false); return; }
                        if (e.key === 'Backspace' || e.key === 'Delete') { updateSearchHotkey(''); setIsRecordingSearch(false); return; }
                        const modifiers = [];
                        if (e.ctrlKey) modifiers.push('Ctrl');
                        if (e.shiftKey) modifiers.push('Shift');
                        if (e.altKey) modifiers.push('Alt');
                        if (e.metaKey) modifiers.push('Command');
                        const key = e.key.toUpperCase();
                        if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return;
                        updateSearchHotkey([...modifiers, key].join('+'));
                      }}
                    >
                      {isRecordingSearch ? "等待按键..." : renderHotkeyCaps(searchHotkey)}
                    </div>
                  </div>

                  {/* Rich text paste hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">强制富文本粘贴热键</span>
                      <span className="fluent-setting-description">双击条目时模拟带格式粘贴的按键</span>
                    </div>
                    <div
                      className={`fluent-value-display ${isRecordingRich ? 'recording' : ''}`}
                      style={{ cursor: "pointer", border: isRecordingRich ? "1px solid var(--accent-color)" : undefined }}
                      onClick={() => setIsRecordingRich(true)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (!isRecordingRich) return;
                        e.preventDefault(); e.stopPropagation();
                        if (e.key === 'Escape') { setIsRecordingRich(false); return; }
                        if (e.key === 'Backspace' || e.key === 'Delete') { updateRichPasteHotkey(''); setIsRecordingRich(false); return; }
                        const modifiers = [];
                        if (e.ctrlKey) modifiers.push('Ctrl');
                        if (e.shiftKey) modifiers.push('Shift');
                        if (e.altKey) modifiers.push('Alt');
                        if (e.metaKey) modifiers.push('Command');
                        const key = e.key.toUpperCase();
                        if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return;
                        updateRichPasteHotkey([...modifiers, key].join('+'));
                      }}
                    >
                      {isRecordingRich ? "等待按键..." : renderHotkeyCaps(richPasteHotkey)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Storage controls expander */}
            <div className="fluent-setting-expander">
              <div
                className={`fluent-setting-expander-header ${expandedCards['storage'] ? 'expanded' : ''}`}
                onClick={() => toggleExpander('storage')}
              >
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">数据捕获与持久化限制</span>
                  <span className="fluent-setting-description">开启与设置数据库的最大存储限额和过滤策略</span>
                </div>
                <ChevronDown size={16} className={`fluent-chevron ${expandedCards['storage'] ? 'expanded' : ''}`} />
              </div>
              {expandedCards['storage'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">持久化历史记录</span>
                      <span className="fluent-setting-description">若关闭，剪贴板历史只会在当前运行期间生效，重启后清空</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={persistent}
                        onChange={(e) => setPersistent(e.target.checked)}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  {persistent && (
                    <>
                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">启用条目存储数量上限</span>
                          <span className="fluent-setting-description">限制数据库内的最大条目数</span>
                        </div>
                        <label className="fluent-switch">
                          <input
                            type="checkbox"
                            checked={persistentLimitEnabled}
                            onChange={(e) => {
                              setPersistentLimitEnabled(e.target.checked);
                              saveAppSetting('persistent_limit_enabled', e.target.checked.toString());
                            }}
                          />
                          <span className="fluent-slider" />
                        </label>
                      </div>

                      {persistentLimitEnabled && (
                        <div className="fluent-setting-card">
                          <div className="fluent-setting-info">
                            <span className="fluent-setting-title">存储最大记录数限制</span>
                            <span className="fluent-setting-description">历史超出此上限后会自动清理最旧的历史（范围：50-99999）</span>
                          </div>
                          <input
                            type="number"
                            className="fluent-input"
                            style={{ width: "90px", textAlign: "right" }}
                            value={persistentLimit}
                            onChange={(e) => {
                              const v = Math.max(50, Math.min(99999, parseInt(e.target.value) || 50));
                              setPersistentLimit(v);
                              saveAppSetting('persistent_limit', v.toString());
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">重复内容合并去重</span>
                      <span className="fluent-setting-description">再次复制已有内容时，不再创建新条目而是将已有条目移动到第一名</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={deduplicate}
                        onChange={(e) => setDeduplicate(e.target.checked)}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">捕获剪贴板复制的文件</span>
                      <span className="fluent-setting-description">是否收集并记录复制的操作系统文件</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={captureFiles}
                        onChange={(e) => setCaptureFiles(e.target.checked)}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">捕获富文本 (HTML/格式化文本)</span>
                      <span className="fluent-setting-description">支持收集富文本并在双击条目时恢复格式粘贴</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={captureRichText}
                        onChange={(e) => setCaptureRichText(e.target.checked)}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  {captureRichText && (
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">富文本快照预览</span>
                        <span className="fluent-setting-description">将 HTML 富文本转换为底板快照预览，提升显示稳定性但会占用更多内存</span>
                      </div>
                      <label className="fluent-switch">
                        <input
                          type="checkbox"
                          checked={richTextSnapshotPreview}
                          onChange={(e) => {
                            setRichTextSnapshotPreview(e.target.checked);
                            saveAppSetting('rich_text_snapshot_preview', e.target.checked.toString());
                          }}
                        />
                        <span className="fluent-slider" />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Paste behavior expander */}
            <div className="fluent-setting-expander">
              <div
                className={`fluent-setting-expander-header ${expandedCards['paste'] ? 'expanded' : ''}`}
                onClick={() => toggleExpander('paste')}
              >
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">智能粘贴行为</span>
                  <span className="fluent-setting-description">双击条目粘贴后的软件自动化执行行为</span>
                </div>
                <ChevronDown size={16} className={`fluent-chevron ${expandedCards['paste'] ? 'expanded' : ''}`} />
              </div>
              {expandedCards['paste'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">双击条目后自动模拟回车/粘贴</span>
                      <span className="fluent-setting-description">在主界面双击内容后，自动退回原焦点输入框并模拟快捷键粘贴</span>
                    </div>
                    <select
                      className="fluent-select"
                      value={quickPasteModifier}
                      onChange={(e) => {
                        const val = e.target.value as QuickPasteModifier;
                        setQuickPasteModifier(val);
                        invoke("set_quick_paste_modifier", { modifier: val }).catch(console.error);
                      }}
                    >
                      <option value="disabled">{t("quick_paste_modifier_disabled")}</option>
                      <option value="ctrl">Control (⌃)</option>
                      <option value="alt">Option (⌥)</option>
                      <option value="shift">Shift (⇧)</option>
                      <option value="win">Command (⌘)</option>
                    </select>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">粘贴后自动销毁删除条目</span>
                      <span className="fluent-setting-description">普通条目粘贴一次后立即在数据库自动删除，已置顶或带标签的除外</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={deleteAfterPaste}
                        onChange={(e) => {
                          setDeleteAfterPaste(e.target.checked);
                          saveAppSetting('delete_after_paste', e.target.checked.toString());
                        }}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">粘贴条目后置顶到第一名</span>
                      <span className="fluent-setting-description">成功粘贴后，该历史记录自动移回列表首位，便于后续连续复制</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={moveToTopAfterPaste}
                        onChange={(e) => {
                          setMoveToTopAfterPaste(e.target.checked);
                          saveAppSetting('move_to_top_after_paste', e.target.checked.toString());
                        }}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">启用顺次粘贴模式</span>
                      <span className="fluent-setting-description">按压设定热键时，将收集好的队列内容按顺序进行依次粘贴</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={sequentialMode}
                        onChange={(e) => {
                          setSequentialModeState(e.target.checked);
                          invoke('set_sequential_mode', { enabled: e.target.checked }).catch(console.error);
                        }}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  {sequentialMode && (
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">顺次粘贴专属快捷键</span>
                        <span className="fluent-setting-description">
                          {isRecordingSequential ? "等待输入..." : "专门触发下一顺位粘贴组合键"}
                        </span>
                      </div>
                      <div
                        className={`fluent-value-display ${isRecordingSequential ? 'recording' : ''}`}
                        style={{ cursor: "pointer", border: isRecordingSequential ? "1px solid var(--accent-color)" : undefined }}
                        onClick={() => setIsRecordingSequential(true)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (!isRecordingSequential) return;
                          e.preventDefault(); e.stopPropagation();
                          if (e.key === 'Escape') { setIsRecordingSequential(false); return; }
                          if (e.key === 'Backspace' || e.key === 'Delete') { updateSequentialHotkey(''); setIsRecordingSequential(false); return; }
                          const modifiers = [];
                          if (e.ctrlKey) modifiers.push('Ctrl');
                          if (e.shiftKey) modifiers.push('Shift');
                          if (e.altKey) modifiers.push('Alt');
                          if (e.metaKey) modifiers.push('Command');
                          const key = e.key.toUpperCase();
                          if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return;
                          updateSequentialHotkey([...modifiers, key].join('+'));
                        }}
                      >
                        {isRecordingSequential ? "等待按键..." : renderHotkeyCaps(sequentialHotkey)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Privacy & Masking */}
        {activeTab === "privacy" && (
          <div>
            <h2 className="fluent-page-header">隐私与过滤</h2>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">启用全局隐私内容脱敏保护</span>
                <span className="fluent-setting-description">自动在首页界面遮罩掩盖密码、手机号、验证码、链接等敏感文本</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={privacyProtection}
                  onChange={(e) => {
                    setPrivacyProtection(e.target.checked);
                    invoke('set_privacy_protection', { enabled: e.target.checked }).catch(console.error);
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            {privacyProtection && (
              <>
                {/* Privacy types expander */}
                <div className="fluent-setting-expander">
                  <div
                    className={`fluent-setting-expander-header ${expandedCards['privKinds'] ? 'expanded' : ''}`}
                    onClick={() => toggleExpander('privKinds')}
                  >
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">受保护的敏感信息种类</span>
                      <span className="fluent-setting-description">只有勾选的信息种类才会在首页界面被自动遮罩</span>
                    </div>
                    <ChevronDown size={16} className={`fluent-chevron ${expandedCards['privKinds'] ? 'expanded' : ''}`} />
                  </div>
                  {expandedCards['privKinds'] && (
                    <div className="fluent-setting-expander-content" style={{ padding: "16px 24px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                        {[
                          { id: 'url', label: '链接 / URL' },
                          { id: 'phone', label: t('privacy_kind_phone') || '手机号' },
                          { id: 'idcard', label: t('privacy_kind_idcard') || '身份证号' },
                          { id: 'email', label: t('privacy_kind_email') || '电子邮件' },
                          { id: 'secret', label: t('privacy_kind_secret') || '密钥 Token' },
                          { id: 'password', label: t('privacy_kind_password') || '高强度密码' },
                        ].map(opt => {
                          const checked = privacyProtectionKinds.includes(opt.id);
                          return (
                            <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: "pointer", fontSize: "13px" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...privacyProtectionKinds, opt.id]
                                    : privacyProtectionKinds.filter(t => t !== opt.id);
                                  setPrivacyProtectionKinds(next);
                                  invoke('set_privacy_protection_kinds', { kinds: next }).catch(console.error);
                                }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mask offsets expander */}
                <div className="fluent-setting-expander">
                  <div
                    className={`fluent-setting-expander-header ${expandedCards['maskSettings'] ? 'expanded' : ''}`}
                    onClick={() => toggleExpander('maskSettings')}
                  >
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">脱敏遮罩显示控制</span>
                      <span className="fluent-setting-description">配置前后明文显露位数及特殊邮箱后缀过滤</span>
                    </div>
                    <ChevronDown size={16} className={`fluent-chevron ${expandedCards['maskSettings'] ? 'expanded' : ''}`} />
                  </div>
                  {expandedCards['maskSettings'] && (
                    <div className="fluent-setting-expander-content">
                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">前部显露字符数</span>
                          <span className="fluent-setting-description">敏感字符串开头不遮盖的字符位数 (0-20)</span>
                        </div>
                        <input
                          type="number"
                          className="fluent-input"
                          style={{ width: "60px", textAlign: "center" }}
                          min={0} max={20}
                          value={sensitiveMaskPrefixVisible}
                          onChange={(e) => {
                            const val = Math.min(20, Math.max(0, parseInt(e.target.value) || 0));
                            setSensitiveMaskPrefixVisible(val);
                            invoke('save_setting', { key: 'app.sensitive_mask_prefix_visible', value: val.toString() }).catch(console.error);
                          }}
                        />
                      </div>

                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">后部显露字符数</span>
                          <span className="fluent-setting-description">敏感字符串结尾不遮盖的字符位数 (0-20)</span>
                        </div>
                        <input
                          type="number"
                          className="fluent-input"
                          style={{ width: "60px", textAlign: "center" }}
                          min={0} max={20}
                          value={sensitiveMaskSuffixVisible}
                          onChange={(e) => {
                            const val = Math.min(20, Math.max(0, parseInt(e.target.value) || 0));
                            setSensitiveMaskSuffixVisible(val);
                            invoke('save_setting', { key: 'app.sensitive_mask_suffix_visible', value: val.toString() }).catch(console.error);
                          }}
                        />
                      </div>

                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">遮盖邮箱域名后缀</span>
                          <span className="fluent-setting-description">开启后，邮箱 @ 后面的服务器域名部分也会被星号脱敏</span>
                        </div>
                        <label className="fluent-switch">
                          <input
                            type="checkbox"
                            checked={sensitiveMaskEmailDomain}
                            onChange={(e) => {
                              setSensitiveMaskEmailDomain(e.target.checked);
                              invoke('save_setting', { key: 'app.sensitive_mask_email_domain', value: e.target.checked.toString() }).catch(console.error);
                            }}
                          />
                          <span className="fluent-slider" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Rules */}
                <div className="fluent-setting-expander">
                  <div
                    className={`fluent-setting-expander-header ${expandedCards['customPriv'] ? 'expanded' : ''}`}
                    onClick={() => toggleExpander('customPriv')}
                  >
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">自定义敏感信息正则表达式</span>
                      <span className="fluent-setting-description">根据自行编写的正则规则对特定字符组合进行匹配遮罩</span>
                    </div>
                    <ChevronDown size={16} className={`fluent-chevron ${expandedCards['customPriv'] ? 'expanded' : ''}`} />
                  </div>
                  {expandedCards['customPriv'] && (
                    <div className="fluent-setting-expander-content" style={{ padding: "12px" }}>
                      <textarea
                        className="fluent-textarea"
                        style={{ width: "100%", minHeight: "120px", boxSizing: "border-box" }}
                        placeholder="每行输入一条正则表达式，示例：\n(?i)password\\s*[:=]\\s*.+\n[0-9]{18}"
                        value={privacyProtectionCustomRules}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrivacyProtectionCustomRules(val);
                          invoke('set_privacy_protection_custom_rules', { rules: val }).catch(console.error);
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 4: Sync & Transfer */}
        {activeTab === "sync" && (
          <div>
            <h2 className="fluent-page-header">同步与传输</h2>

            {/* LAN File Server Expander */}
            {/* LAN File Server Expander */}
            <div className={`fluent-setting-expander ${!fileServerEnabled ? 'disabled' : ''}`}>
              <div
                className={`fluent-setting-expander-header ${expandedCards['lan'] && fileServerEnabled ? 'expanded' : ''} ${!fileServerEnabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (fileServerEnabled) toggleExpander('lan');
                }}
              >
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">局域网极速文件传输 (LAN)</span>
                  <span className="fluent-setting-description">开启本地网页文件接收端，允许局域网手机/电脑扫码上传文件和聊天</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <label className="fluent-switch" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={fileServerEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setFileServerEnabled(val);
                        const port = Number(fileServerPort);
                        invoke("toggle_file_server", { enabled: val, port: Number.isInteger(port) ? port : undefined });
                      }}
                    />
                    <span className="fluent-slider" />
                  </label>
                  <ChevronDown size={16} className={`fluent-chevron ${expandedCards['lan'] && fileServerEnabled ? 'expanded' : ''}`} />
                </div>
              </div>
              {expandedCards['lan'] && fileServerEnabled && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">服务端口</span>
                      <span className="fluent-setting-description">局域网接收端运行的端口号，默认 18888</span>
                    </div>
                    <input
                      type="text"
                      className="fluent-input"
                      style={{ width: "80px", textAlign: "center" }}
                      value={fileServerPort}
                      onChange={e => setFileServerPort(e.target.value)}
                      onBlur={() => applyFileServerPort(fileServerPort)}
                    />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">服务局域网 IP</span>
                      <span className="fluent-setting-description">在浏览器里访问的地址，同局域网设备可用</span>
                    </div>
                    <div className="fluent-value-display">
                      {availableIps && availableIps.length > 1 && setLocalIp ? (
                        <select
                          className="fluent-select"
                          style={{ border: "none", background: "transparent", minWidth: "0", padding: "0" }}
                          value={localIp}
                          onChange={(e) => {
                            setLocalIp(e.target.value);
                            invoke("set_display_ip", { ip: e.target.value }).catch(console.error);
                          }}
                        >
                          {availableIps.map(ip => <option key={ip} value={ip}>{ip}</option>)}
                        </select>
                      ) : (
                        <span>{localIp}</span>
                      )}
                      <span>:{actualPort || fileServerPort}</span>
                    </div>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">自动打开接收网页</span>
                      <span className="fluent-setting-description">接收到文件后，主窗口自动显示传输列表</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={fileTransferAutoOpen}
                        onChange={(e) => setFileTransferAutoOpen(e.target.checked)}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">服务自动关闭机制</span>
                      <span className="fluent-setting-description">若检测到无任务且接收网页关闭后自动休眠关闭服务</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={fileServerAutoClose}
                        onChange={(e) => setFileServerAutoClose(e.target.checked)}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">自动复制接收的文件</span>
                      <span className="fluent-setting-description">文件接收完毕后自动放进您的剪贴板首位</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={fileTransferAutoCopy}
                        onChange={(e) => setFileTransferAutoCopy(e.target.checked)}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>

                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span className="fluent-setting-title">传输文件保存路径</span>
                      <button
                        className="fluent-button"
                        onClick={async () => {
                          const { open } = await import("@tauri-apps/plugin-dialog");
                          try {
                            const selected = await open({ directory: true, multiple: false });
                            if (selected) {
                              saveSetting('file_transfer_path', selected as string);
                              setTimeout(fetchEffectiveTransferPath, 100);
                            }
                          } catch (e) {}
                        }}
                      >
                        更改路径
                      </button>
                    </div>
                    <div
                      className="fluent-value-display"
                      style={{ cursor: "pointer", wordBreak: "break-all" }}
                      onClick={() => {
                        if (fileTransferPath) invoke("open_folder", { path: fileTransferPath }).catch(console.error);
                      }}
                    >
                      {fileTransferPath || "未设置，默认下载路径"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MQTT Sync Expander */}
            {/* MQTT Sync Expander */}
            <div className={`fluent-setting-expander ${!mqttEnabled ? 'disabled' : ''}`}>
              <div
                className={`fluent-setting-expander-header ${expandedCards['mqtt'] && mqttEnabled ? 'expanded' : ''} ${!mqttEnabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (mqttEnabled) toggleExpander('mqtt');
                }}
              >
                <div className="fluent-setting-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="fluent-setting-title">多端剪贴板/验证码同步 (MQTT)</span>
                    {mqttEnabled && (
                      <span
                        style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: mqttStatus === 'connected' ? '#4CAF50' : mqttStatus === 'connecting' ? '#FF9800' : '#F44336'
                        }}
                      />
                    )}
                  </div>
                  <span className="fluent-setting-description">基于 MQTT 代理服务器实现云端剪贴板历史和短信验证码的低延迟同步</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <label className="fluent-switch" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={mqttEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setMqttEnabled(val);
                        saveMqtt('mqtt_enabled', String(val));
                      }}
                    />
                    <span className="fluent-slider" />
                  </label>
                  <ChevronDown size={16} className={`fluent-chevron ${expandedCards['mqtt'] && mqttEnabled ? 'expanded' : ''}`} />
                </div>
              </div>
              {expandedCards['mqtt'] && mqttEnabled && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">连接协议</span>
                      <span className="fluent-setting-description">mqtt:// 默认(1883), mqtts:// 安全加密(8883), ws:// websocket(8083)</span>
                    </div>
                    <select
                      className="fluent-select"
                      value={mqttProtocol}
                      onChange={(e) => {
                        const protocol = e.target.value;
                        setMqttProtocol(protocol);
                        saveMqtt('mqtt_protocol', protocol);
                        invoke('save_setting', { key: 'mqtt_ssl', value: String(protocol === 'mqtts://' || protocol === 'wss://') }).catch(console.error);
                        let defaultPort = '1883';
                        if (protocol === 'mqtts://') defaultPort = '8883';
                        else if (protocol === 'ws://') defaultPort = '8083';
                        else if (protocol === 'wss://') defaultPort = '8084';
                        setMqttPort(defaultPort);
                        saveMqtt('mqtt_port', defaultPort);
                      }}
                    >
                      <option value="mqtt://">mqtt://</option>
                      <option value="mqtts://">mqtts://</option>
                      <option value="ws://">ws://</option>
                      <option value="wss://">wss://</option>
                    </select>
                  </div>

                  { (mqttProtocol === 'ws://' || mqttProtocol === 'wss://') && (
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">WS Path 路径</span>
                        <span className="fluent-setting-description">网页同步服务特定的路径，默认 /mqtt</span>
                      </div>
                      <input
                        type="text"
                        className="fluent-input"
                        value={mqttWsPath}
                        onChange={(e) => { setMqttWsPath(e.target.value); saveMqtt('mqtt_ws_path', e.target.value); }}
                        placeholder="/mqtt"
                      />
                    </div>
                  )}

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">服务器主机地址</span>
                      <span className="fluent-setting-description">MQTT 代理服务器的 IP 或域名</span>
                    </div>
                    <input
                      type="text"
                      className="fluent-input"
                      value={mqttServer}
                      onChange={(e) => { setMqttServer(e.target.value); saveMqtt('mqtt_server', e.target.value); }}
                    />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">端口号</span>
                      <span className="fluent-setting-description">MQTT 连接端口，默认 18883/1883</span>
                    </div>
                    <input
                      type="text"
                      className="fluent-input"
                      style={{ width: "80px", textAlign: "center" }}
                      value={mqttPort}
                      onChange={(e) => { setMqttPort(e.target.value); saveMqtt('mqtt_port', e.target.value); }}
                    />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">用户名</span>
                      <span className="fluent-setting-description">连接服务器所需的用户名，选填</span>
                    </div>
                    <input
                      type="text"
                      className="fluent-input"
                      value={mqttUser}
                      onChange={(e) => { setMqttUser(e.target.value); saveMqtt('mqtt_username', e.target.value); }}
                    />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">密码</span>
                      <span className="fluent-setting-description">连接所需的密码，选填</span>
                    </div>
                    <input
                      type="password"
                      className="fluent-input"
                      value={mqttPass}
                      onChange={(e) => { setMqttPass(e.target.value); saveMqtt('mqtt_password', e.target.value); }}
                    />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">同步 Topic 订阅名</span>
                      <span className="fluent-setting-description">所有端必须使用一致的主题名才可以实现互相通讯</span>
                    </div>
                    <input
                      type="text"
                      className="fluent-input"
                      value={mqttTopic}
                      onChange={(e) => { setMqttTopic(e.target.value); saveMqtt('mqtt_topic', e.target.value); }}
                    />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">接收同步提醒推送通知</span>
                      <span className="fluent-setting-description">当别的电脑或手机同步新验证码时发出系统弹窗通知</span>
                    </div>
                    <label className="fluent-switch">
                      <input
                        type="checkbox"
                        checked={mqttNotificationEnabled}
                        onChange={(e) => {
                          setMqttNotificationEnabled(e.target.checked);
                          saveMqtt('mqtt_notification_enabled', String(e.target.checked));
                        }}
                      />
                      <span className="fluent-slider" />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Cloud sync WebDAV expander */}
            {CLOUD_SYNC_ENABLED && (
              <div className={`fluent-setting-expander ${!cloudSyncEnabled ? 'disabled' : ''}`}>
                <div
                  className={`fluent-setting-expander-header ${expandedCards['cloud'] && cloudSyncEnabled ? 'expanded' : ''} ${!cloudSyncEnabled ? 'disabled' : ''}`}
                  onClick={() => {
                    if (cloudSyncEnabled) toggleExpander('cloud');
                  }}
                >
                  <div className="fluent-setting-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="fluent-setting-title">云端文件自动同步 (WebDAV)</span>
                      {cloudSyncEnabled && (
                        <span
                          style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: cloudSyncStatus.state === "idle" ? '#4CAF50' : cloudSyncStatus.state === "syncing" ? '#FF9800' : '#F44336'
                          }}
                        />
                      )}
                    </div>
                    <span className="fluent-setting-description">支持将本地剪贴板数据加密同步备份至坚果云、Nextcloud 等 WebDAV 云盘</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <label className="fluent-switch" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={cloudSyncEnabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setCloudSyncEnabled(val);
                          saveCloudSync('cloud_sync_enabled', String(val));
                        }}
                      />
                      <span className="fluent-slider" />
                    </label>
                    <ChevronDown size={16} className={`fluent-chevron ${expandedCards['cloud'] && cloudSyncEnabled ? 'expanded' : ''}`} />
                  </div>
                </div>
                {expandedCards['cloud'] && cloudSyncEnabled && (
                  <div className="fluent-setting-expander-content">
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">定时自动静默同步</span>
                        <span className="fluent-setting-description">自动在后台检测更新并同步备份</span>
                      </div>
                      <label className="fluent-switch">
                        <input
                          type="checkbox"
                          checked={cloudSyncAuto}
                          onChange={(e) => {
                            setCloudSyncAuto(e.target.checked);
                            saveCloudSync('cloud_sync_auto', String(e.target.checked));
                          }}
                        />
                        <span className="fluent-slider" />
                      </label>
                    </div>

                    {cloudSyncAuto && (
                      <>
                        <div className="fluent-setting-card">
                          <div className="fluent-setting-info">
                            <span className="fluent-setting-title">同步扫描周期 (秒)</span>
                            <span className="fluent-setting-description">检查同步内容变化的频率 (5 - 3600)</span>
                          </div>
                          <input
                            type="number"
                            className="fluent-input"
                            style={{ width: "70px", textAlign: "right" }}
                            value={cloudSyncIntervalSec}
                            onChange={e => setCloudSyncIntervalSec(e.target.value)}
                            onBlur={() => {
                              const v = Math.min(3600, Math.max(5, parseInt(cloudSyncIntervalSec) || 120));
                              setCloudSyncIntervalSec(v.toString());
                              saveCloudSync('cloud_sync_interval_sec', v.toString());
                            }}
                          />
                        </div>

                        <div className="fluent-setting-card">
                          <div className="fluent-setting-info">
                            <span className="fluent-setting-title">全量物理快照间隔 (分钟)</span>
                            <span className="fluent-setting-description">执行强力校准合并与垃圾清理的间隔</span>
                          </div>
                          <input
                            type="number"
                            className="fluent-input"
                            style={{ width: "70px", textAlign: "right" }}
                            value={cloudSyncSnapshotIntervalMin}
                            onChange={e => setCloudSyncSnapshotIntervalMin(e.target.value)}
                            onBlur={() => {
                              const v = Math.min(1440, Math.max(5, parseInt(cloudSyncSnapshotIntervalMin) || 720));
                              setCloudSyncSnapshotIntervalMin(v.toString());
                              saveCloudSync('cloud_sync_snapshot_interval_min', v.toString());
                            }}
                          />
                        </div>
                      </>
                    )}

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">WebDAV 服务商链接 URL</span>
                        <span className="fluent-setting-description">提供 WebDAV 接口的服务商网络地址</span>
                      </div>
                      <input
                        type="text"
                        className="fluent-input"
                        value={cloudSyncWebdavUrl}
                        onChange={e => setCloudSyncWebdavUrl(e.target.value)}
                        onBlur={() => saveCloudSync('cloud_sync_webdav_url', cloudSyncWebdavUrl.trim())}
                      />
                    </div>

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">WebDAV 登录用户名</span>
                        <span className="fluent-setting-description">您的云盘登录账户名</span>
                      </div>
                      <input
                        type="text"
                        className="fluent-input"
                        value={cloudSyncWebdavUsername}
                        onChange={e => setCloudSyncWebdavUsername(e.target.value)}
                        onBlur={() => saveCloudSync('cloud_sync_webdav_username', cloudSyncWebdavUsername.trim())}
                      />
                    </div>

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">WebDAV 专属应用授权密码</span>
                        <span className="fluent-setting-description">推荐在云盘后台生成一个特定“应用密码”填写于此</span>
                      </div>
                      <input
                        type="password"
                        className="fluent-input"
                        value={cloudSyncWebdavPassword}
                        onChange={e => setCloudSyncWebdavPassword(e.target.value)}
                        onBlur={() => saveCloudSync('cloud_sync_webdav_password', cloudSyncWebdavPassword)}
                      />
                    </div>

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">同步根目录文件夹名称</span>
                        <span className="fluent-setting-description">云盘中保存备份数据的根目录，默认 tiez-sync</span>
                      </div>
                      <input
                        type="text"
                        className="fluent-input"
                        value={cloudSyncWebdavBasePath}
                        onChange={e => setCloudSyncWebdavBasePath(e.target.value)}
                        onBlur={() => saveCloudSync('cloud_sync_webdav_base_path', cloudSyncWebdavBasePath.trim() || 'tiez-sync')}
                      />
                    </div>

                    {/* Cloud Status Box */}
                    <div style={{ background: "rgba(0,0,0,0.03)", padding: "12px", borderRadius: "4px", margin: "8px 0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>云端同步状态</div>
                      <div style={{ fontSize: "12px", display: "flex", gap: "16px" }}>
                        <span>上传项: {cloudSyncStatus.uploaded_items ?? 0}</span>
                        <span>接收项: {cloudSyncStatus.received_items ?? 0}</span>
                        <span>状态: {cloudSyncStatus.state === 'syncing' ? '同步中...' : cloudSyncStatus.state === 'idle' ? '就绪' : '错误/未启动'}</span>
                      </div>
                      {cloudSyncStatus.last_sync_at && (
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          上次同步: {new Date(cloudSyncStatus.last_sync_at).toLocaleString()}
                        </div>
                      )}
                      {cloudSyncStatus.last_error && (
                        <div style={{ fontSize: "10px", color: "#f44336", marginTop: "4px" }}>
                          上次错误: {cloudSyncStatus.last_error}
                        </div>
                      )}
                    </div>

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">立即触发数据强制同步</span>
                        <span className="fluent-setting-description">手动强制执行一次云端数据同步比对</span>
                      </div>
                      <button
                        className="fluent-button"
                        disabled={cloudSyncNowRunning || cloudSyncStatus.state === "syncing"}
                        onClick={handleCloudSyncNow}
                      >
                        {cloudSyncNowRunning ? "同步中..." : "立即同步"}
                      </button>
                    </div>
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {/* Tab 5: AI Assistant */}
        {activeTab === "ai" && (
          <div>
            <h2 className="fluent-page-header">AI 智能助手</h2>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">启用内置 AI 智能菜单</span>
                <span className="fluent-setting-description">开启后对条目鼠标右键或点击菜单，可触发快速AI翻译、多端嘴替和智能任务润色</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => {
                    setAiEnabled(e.target.checked);
                    saveSetting('ai_enabled', String(e.target.checked));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            {aiEnabled && (
              <>
                {/* Model Profiles Management */}
                <div className="fluent-setting-expander">
                  <div
                    className={`fluent-setting-expander-header ${expandedCards['aiModels'] ? 'expanded' : ''}`}
                    onClick={() => toggleExpander('aiModels')}
                  >
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">AI 连接模型库管理</span>
                      <span className="fluent-setting-description">管理与测试第三方 OpenAI / Claude 兼容的模型端点和 API 密钥</span>
                    </div>
                    <ChevronDown size={16} className={`fluent-chevron ${expandedCards['aiModels'] ? 'expanded' : ''}`} />
                  </div>
                  {expandedCards['aiModels'] && (
                    <div className="fluent-setting-expander-content" style={{ padding: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>当前模型配置列表</span>
                        <button
                          className="fluent-button"
                          style={{ padding: "2px 8px", fontSize: "11px" }}
                          onClick={() => setEditingProfile({ isNew: true, baseUrl: 'https://api.longcat.chat/openai/v1', apiKey: '', model: '', enableThinking: false })}
                        >
                          + 添加模型
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {aiProfiles.map(profile => (
                          <div
                            key={profile.id}
                            className="fluent-setting-card"
                            style={{ padding: "8px 12px", marginBottom: "0", background: "rgba(0,0,0,0.01)" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                              <span
                                style={{
                                  width: '8px', height: '8px', borderRadius: '50%',
                                  backgroundColor:
                                    profileStatuses[profile.id] === 'success' ? '#4CAF50' :
                                      profileStatuses[profile.id] === 'error' ? '#F44336' :
                                        profileStatuses[profile.id] === 'loading' ? '#FF9800' : '#999',
                                }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: "13px", fontWeight: "600", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                  {profile.model}
                                </div>
                                <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                                  {profile.baseUrl}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button className="fluent-button" style={{ padding: "4px 8px" }} onClick={() => checkModelStatus(profile)}>测试</button>
                              <button className="fluent-button" style={{ padding: "4px 8px" }} onClick={() => setEditingProfile(profile)}>编辑</button>
                              {!['lc_flash_v1', 'lc_think_v1', 'lc_think_2601_v1'].includes(profile.id) && (
                                <button className="fluent-button" style={{ padding: "4px 8px", color: "#f44336" }} onClick={() => handleDeleteProfile(profile.id)}>删除</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Strategy binding */}
                <div className="fluent-setting-expander">
                  <div
                    className={`fluent-setting-expander-header ${expandedCards['aiStrategy'] ? 'expanded' : ''}`}
                    onClick={() => toggleExpander('aiStrategy')}
                  >
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">应用功能场景的模型绑定</span>
                      <span className="fluent-setting-description">配置智能任务润色、嘴替多策略调用的首选执行模型</span>
                    </div>
                    <ChevronDown size={16} className={`fluent-chevron ${expandedCards['aiStrategy'] ? 'expanded' : ''}`} />
                  </div>
                  {expandedCards['aiStrategy'] && (
                    <div className="fluent-setting-expander-content">
                      {[
                        { label: '智能任务执行模型', value: aiAssignedProfileTask, setter: setAiAssignedProfileTask, key: 'ai_assigned_profile_task' },
                        { label: '对话及多端嘴替模型', value: aiAssignedProfileMouthpiece, setter: setAiAssignedProfileMouthpiece, key: 'ai_assigned_profile_mouthpiece' },
                        { label: '智能快速翻译模型', value: aiAssignedProfileTranslate, setter: setAiAssignedProfileTranslate, key: 'ai_assigned_profile_translate' },
                      ].map(strategy => (
                        <div key={strategy.key} className="fluent-setting-card">
                          <span className="fluent-setting-title">{strategy.label}</span>
                          <select
                            className="fluent-select"
                            value={strategy.value}
                            onChange={(e) => {
                              strategy.setter(e.target.value);
                              saveSetting(strategy.key, e.target.value);
                            }}
                          >
                            <option value="none" disabled>{aiProfiles.length > 0 ? "选择绑定模型" : "请先添加模型配置"}</option>
                            {aiProfiles.map(p => <option key={p.id} value={p.id}>{p.model}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Translations and budget */}
                <div className="fluent-setting-card">
                  <div className="fluent-setting-info">
                    <span className="fluent-setting-title">默认智能翻译目标语言</span>
                    <span className="fluent-setting-description">AI 翻译快捷菜单执行后输出的偏好语言</span>
                  </div>
                  <select
                    className="fluent-select"
                    value={aiTargetLang}
                    onChange={(e) => {
                      setAiTargetLang(e.target.value);
                      saveSetting('ai_target_lang', e.target.value);
                    }}
                  >
                    <option value="auto_zh_en">中英自动互译</option>
                    <option value="zh">简体中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <div className="fluent-setting-card">
                  <div className="fluent-setting-info">
                    <span className="fluent-setting-title">AI 模型深度思考 Token 限制</span>
                    <span className="fluent-setting-description">允许推理模型执行思考链条的最大上限 Token 数</span>
                  </div>
                  <input
                    type="number"
                    className="fluent-input"
                    style={{ width: "90px", textAlign: "right" }}
                    min="1024" max="10000"
                    value={aiThinkingBudget}
                    onChange={(e) => {
                      setAiThinkingBudget(e.target.value);
                      saveSetting('ai_thinking_budget', e.target.value);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 6: Appearance */}
        {activeTab === "appearance" && (
          <div>
            <h2 className="fluent-page-header">个性化外观</h2>

            {/* Visual theme cards */}
            <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">视觉设计主题风格</span>
                <span className="fluent-setting-description">切换界面预设的主题和底板配色</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {THEMES.map(tOption => (
                  <button
                    key={tOption.id}
                    className={`fluent-button ${theme === tOption.id ? 'fluent-button-primary' : ''}`}
                    onClick={() => {
                      setTheme(tOption.id);
                      saveAppSetting('theme', tOption.id);
                    }}
                  >
                    {getThemeLabel(tOption.id, language)}
                  </button>
                ))}
              </div>
              <button
                className="fluent-button"
                style={{ width: "100%", fontSize: "12px", borderStyle: "dashed" }}
                onClick={() => setSettingsSubpage("theme-store")}
              >
                🎨 主题商店 (获取更多设计风格)
              </button>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">色彩显示模式</span>
                <span className="fluent-setting-description">支持暗黑、明亮或自动跟随操作系统变化</span>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {[
                  { id: 'system', name: '系统默认' },
                  { id: 'light', name: '浅色明亮' },
                  { id: 'dark', name: '深色暗黑' }
                ].map(modeItem => (
                  <button
                    key={modeItem.id}
                    className={`fluent-button ${colorMode === modeItem.id ? 'fluent-button-primary' : ''}`}
                    onClick={() => {
                      setColorMode(modeItem.id);
                      saveAppSetting('color_mode', modeItem.id);
                    }}
                  >
                    {modeItem.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">应用显示界面语言</span>
                <span className="fluent-setting-description">更改所有菜单的文案显示语种</span>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {[
                  { id: 'zh', name: '简体中文' },
                  { id: 'tw', name: '繁體中文' },
                  { id: 'en', name: 'English' }
                ].map(langItem => (
                  <button
                    key={langItem.id}
                    className={`fluent-button ${language === langItem.id ? 'fluent-button-primary' : ''}`}
                    onClick={() => {
                      setLanguage(langItem.id as Locale);
                      saveAppSetting('language', langItem.id);
                    }}
                  >
                    {langItem.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">显示条目来源图标</span>
                <span className="fluent-setting-description">在剪贴板条目左侧展示其所属的原程序图标</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={showSourceAppIcon}
                  onChange={(e) => {
                    setShowSourceAppIcon(e.target.checked);
                    saveAppSetting('show_source_app_icon', String(e.target.checked));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">紧凑排列列表模式</span>
                <span className="fluent-setting-description">缩减条目的边距，大幅增加单屏所能展示的记录条数</span>
              </div>
              <label className="fluent-switch">
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => {
                    setCompactMode(e.target.checked);
                    saveAppSetting('compact_mode', String(e.target.checked));
                  }}
                />
                <span className="fluent-slider" />
              </label>
            </div>

            {/* Font slider expander */}
            <div className="fluent-setting-expander">
              <div
                className={`fluent-setting-expander-header ${expandedCards['fonts'] ? 'expanded' : ''}`}
                onClick={() => toggleExpander('fonts')}
              >
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">字体字号偏好调整</span>
                  <span className="fluent-setting-description">微调主界面和标签中文字的可读性字号</span>
                </div>
                <ChevronDown size={16} className={`fluent-chevron ${expandedCards['fonts'] ? 'expanded' : ''}`} />
              </div>
              {expandedCards['fonts'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="fluent-setting-title">条目文字大小</span>
                      <span style={{ fontSize: "11px" }}>{clipboardItemFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      className="fluent-range"
                      min="11" max="18" step="1"
                      value={clipboardItemFontSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setClipboardItemFontSize(val);
                        saveAppSetting('clipboard_item_font_size', String(val));
                      }}
                    />
                  </div>

                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="fluent-setting-title">标签字号大小</span>
                      <span style={{ fontSize: "11px" }}>{clipboardTagFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      className="fluent-range"
                      min="8" max="14" step="1"
                      value={clipboardTagFontSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setClipboardTagFontSize(val);
                        saveAppSetting('clipboard_tag_font_size', String(val));
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Window background transparent expander */}
            {(supportsCustomBackground(theme) || supportsSurfaceOpacity(theme)) && (
              <div className="fluent-setting-expander">
                <div
                  className={`fluent-setting-expander-header ${expandedCards['transparent'] ? 'expanded' : ''}`}
                  onClick={() => toggleExpander('transparent')}
                >
                  <div className="fluent-setting-info">
                    <span className="fluent-setting-title">亚克力玻璃与背景自定义</span>
                    <span className="fluent-setting-description">自定义半透明玻璃板的磨砂值或选定壁纸大图</span>
                  </div>
                  <ChevronDown size={16} className={`fluent-chevron ${expandedCards['transparent'] ? 'expanded' : ''}`} />
                </div>
                {expandedCards['transparent'] && (
                  <div className="fluent-setting-expander-content">
                    {supportsCustomBackground(theme) && (
                      <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="fluent-setting-title">自定义背景壁纸图片</span>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              className="fluent-button"
                              onClick={async () => {
                                const { open, message } = await import("@tauri-apps/plugin-dialog");
                                try {
                                  const selected = await open({
                                    multiple: false,
                                    filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
                                  });
                                  if (selected && typeof selected === 'string') {
                                    try {
                                      const stats = await invoke<{ size: number }>('get_file_size', { path: selected });
                                      if (stats.size > 10 * 1024 * 1024) {
                                        await message("图片文件太大，请选择小于 10MB 的图片。", { title: "限制提示", kind: "error" });
                                        return;
                                      }
                                    } catch (e) {}
                                    setCustomBackground(selected);
                                    saveAppSetting('custom_background', selected);
                                  }
                                } catch (err) {}
                              }}
                            >
                              {customBackground ? "更换背景" : "选择背景"}
                            </button>
                            {customBackground && (
                              <button
                                className="fluent-button"
                                style={{ color: "#f44336" }}
                                onClick={() => {
                                  setCustomBackground('');
                                  saveAppSetting('custom_background', '');
                                }}
                              >
                                清除
                              </button>
                            )}
                          </div>
                        </div>
                        {customBackground && (
                          <>
                            <div className="fluent-value-display" style={{ wordBreak: "break-all" }}>
                              {customBackground.split(/[/\\]/).pop()}
                            </div>
                            <div className="fluent-setting-card" style={{ padding: "10px 0", border: "none", flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span className="fluent-setting-title">壁纸图片不透明度</span>
                                <span style={{ fontSize: "11px" }}>{customBackgroundOpacity}%</span>
                              </div>
                              <input
                                type="range"
                                className="fluent-range"
                                min="0" max="100"
                                value={customBackgroundOpacity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setCustomBackgroundOpacity(val);
                                  saveAppSetting('custom_background_opacity', String(val));
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {supportsSurfaceOpacity(theme) && (
                      <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="fluent-setting-title">主程序界面底板不透明度</span>
                          <span style={{ fontSize: "11px" }}>{surfaceOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          className="fluent-range"
                          min="0" max="100"
                          value={surfaceOpacity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setSurfaceOpacity(val);
                            saveAppSetting('surface_opacity', String(val));
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Advanced Rules */}
        {activeTab === "advanced" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <h2 className="fluent-page-header">高级设置与策略</h2>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <AdvancedSettingsGroup
                t={t}
                cleanupRules={cleanupRules}
                setCleanupRules={setCleanupRules}
                appCleanupPolicies={appCleanupPolicies}
                setAppCleanupPolicies={setAppCleanupPolicies}
                installedApps={installedApps}
                theme={theme}
              />
            </div>
          </div>
        )}
      </div>

      {/* Selector Modals */}
      <AppSelectorModal
        show={showAppSelector}
        installedApps={installedApps}
        theme={theme}
        colorMode={colorMode}
        t={t}
        onClose={() => setShowAppSelector(null)}
        onSave={saveAppSetting}
      />

      <AiProfileModal
        editingProfile={editingProfile}
        t={t}
        onClose={() => setEditingProfile(null)}
        onSave={handleSaveProfile}
        setEditingProfile={setEditingProfile}
      />
    </div>
  );
};

export default SettingsWindow;
