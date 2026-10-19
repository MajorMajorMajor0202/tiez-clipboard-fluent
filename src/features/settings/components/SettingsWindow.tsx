import { listQuickPasteModifiers, normalizeListQuickPasteModifier } from "../../../shared/lib/listQuickPasteModifier";
import FluentSettingsExpander from "../../../shared/components/FluentSettingsExpander";
import FluentCheckbox from "../../../shared/components/FluentCheckbox";
import FluentButton from "../../../shared/components/FluentButton";
import FluentSlider from "../../../shared/components/FluentSlider";
import FluentSwitch from "../../../shared/components/FluentSwitch";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import {
  Sliders,
  Shield,
  Wifi,
  Cpu,
  Palette,
  Settings,
  Edit3,
  Activity,
  Trash2,
  Plus
} from "lucide-react";
import { translations } from "../../../locales";
import { useAppState } from "../../app/hooks/useAppState";
import { useSettingsInit } from "../../../shared/hooks/useSettingsInit";
import { useSettingsPostInit } from "../../../shared/hooks/useSettingsPostInit";
import { useAppBootstrap } from "../../../shared/hooks/useAppBootstrap";
import { useSettingsApply } from "../../../shared/hooks/useSettingsApply";
import { useSettingsWindowPresentation } from "../../../shared/hooks/useSettingsWindowPresentation";
import { useCustomBackground } from "../../../shared/hooks/useCustomBackground";
import { useHotkeyConfig } from "../../../shared/hooks/useHotkeyConfig";
import { getHotkeyDisplayTokens } from "../../../shared/lib/hotkeyDisplay";
import { isMacPlatform } from "../../../shared/lib/platform";
import FluentDropdown from "../../../shared/components/FluentDropdown";
import { CLOUD_SYNC_ENABLED } from "../../../shared/config/edition";
import { THEMES, getThemeLabel, supportsCustomBackground, supportsSurfaceOpacity } from "../../../shared/config/themes";

import type { Locale } from "../../../shared/types";
import type { QuickPasteModifier } from "../../app/types";
import type { AiProfile, EditableAiProfile, AiProfileStatusMap, CloudSyncStatusPayload } from "../../settings/types";

// Modals & Panels
import AppSelectorModal from "./AppSelectorModal";
import AiProfileModal from "./AiProfileModal";
import HotkeySelectorModal from "./HotkeySelectorModal";
import AdvancedSettingsGroup from "./groups/AdvancedSettingsGroup";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import FluentNumberBox from "../../../shared/components/FluentNumberBox";

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
    doubleClickToPaste,
    setDoubleClickToPaste,
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
    stripNewlineHotkey,
    setStripNewlineHotkey,
    pinWindowHotkey,
    setPinWindowHotkey,
    quickPasteModifier,
    setQuickPasteModifier,
    quickTabAssignEnabled,
    setQuickTabAssignEnabled,
    quickTabAssignSeconds,
    setQuickTabAssignSeconds,
    quickTabAssignModifier,
    setQuickTabAssignModifier,
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
    isRecordingStripNewline,
    setIsRecordingStripNewline,
    isRecordingPinWindow,
    setIsRecordingPinWindow,
    emojiPanelEnabled,
    setEmojiPanelEnabled,
    tagManagerEnabled,
    setTagManagerEnabled,
    noteManagerEnabled,
    setNoteManagerEnabled,
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
  const [showHotkeyModal, setShowHotkeyModal] = useState<'main' | 'search' | 'rich' | 'sequential' | 'strip_newline' | 'pin_window' | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [noteBackdropMode, setNoteBackdropMode] = useState<string>(() => {
    return localStorage.getItem("tiez_note_backdrop_mode") || "sync";
  });
  const [noteDefaultSolidColor, setNoteDefaultSolidColor] = useState<string>(() => {
    return localStorage.getItem("tiez_note_default_solid_color") || "random";
  });

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
    setStripNewlineHotkey,
    setQuickPasteModifier,
    setQuickTabAssignEnabled,
    setQuickTabAssignSeconds,
    setQuickTabAssignModifier,
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
    setNoteManagerEnabled,
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
  useSettingsWindowPresentation(settingsLoaded, theme, colorMode);

  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setContentEl(node);
    }
  }, []);

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
      if (type === 'note_backdrop_mode') localStorage.setItem('tiez_note_backdrop_mode', path);
      if (type === 'note_default_solid_color') localStorage.setItem('tiez_note_default_solid_color', path);
      if (type === 'note_manager_enabled') localStorage.setItem('tiez_note_manager_enabled', path);
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
    updateSearchHotkey,
    updateStripNewlineHotkey,
    updatePinWindowHotkey
  } = useHotkeyConfig({
    hotkey,
    setHotkey,
    sequentialHotkey,
    setSequentialHotkey,
    richPasteHotkey,
    setRichPasteHotkey,
    searchHotkey,
    setSearchHotkey,
    stripNewlineHotkey,
    setStripNewlineHotkey,
    pinWindowHotkey,
    setPinWindowHotkey,
    sequentialMode,
    isRecording,
    setIsRecording,
    isRecordingSequential,
    setIsRecordingSequential,
    isRecordingRich,
    setIsRecordingRich,
    isRecordingSearch,
    setIsRecordingSearch,
    isRecordingStripNewline,
    setIsRecordingStripNewline,
    isRecordingPinWindow,
    setIsRecordingPinWindow,
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
    const tokens = getHotkeyDisplayTokens(hk, { preferMacSymbols: false });
    if (tokens.length === 0) {
      return <span className="fluent-hotkey-not-set">{t('not_set') || "未设置"}</span>;
    }
    return (
      <div className="fluent-hotkey-caps-list">
        {tokens.map((token, index) => (
          <span key={`cap-${index}`} className="fluent-hotkey-cap">
            {token.label}
          </span>
        ))}
      </div>
    );
  };

  // Sidebar items
  const menuItems = [
    { id: "general", label: t("general_settings") || "常规设置", icon: <Settings size={16} /> },
    { id: "clipboard", label: t("clipboard_settings") || "剪贴板与热键", icon: <Sliders size={16} /> },
    { id: "privacy", label: t("privacy_protection") || "隐私保护", icon: <Shield size={16} /> },
    { id: "sync", label: t("sync_and_transfer") || "同步与传输", icon: <Wifi size={16} /> },
    { id: "ai", label: t("ai_settings") || "AI 智能助手", icon: <Cpu size={16} /> },
    { id: "appearance", label: t("appearance_settings") || "个性化外观", icon: <Palette size={16} /> },
    { id: "advanced", label: t("advanced_settings") || "数据清洗与过滤", icon: <Sliders size={16} /> }
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

      {/* Main Settings Panel Wrapper */}
      <div style={{ flex: 1, position: "relative", height: "100%", overflow: "hidden" }}>
        <div className="fluent-settings-content" ref={contentRef}>
        {toast && <div className="fluent-toast">{toast}</div>}

        {/* Tab 1: General & System */}
        {activeTab === "general" && (
          <div>
            <h2 className="fluent-page-header">{t("general_settings") || "常规设置"}</h2>
            <h3 className="fluent-section-title">启动与窗口</h3>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">开机自启动</span>
                <span className="fluent-setting-description">
                  登录系统后自动启动
                </span>
              </div>
              <FluentSwitch checked={autoStart} onChange={(e) => {
                    const enabled = e.target.checked;
                    setAutoStart(enabled);
                    invoke("toggle_autostart", { enabled }).catch(console.error);
                  }}   />
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">静默启动</span>
                <span className="fluent-setting-description">启动后在后台运行</span>
              </div>
              <FluentSwitch checked={silentStart} onChange={(e) => {
                    const enabled = e.target.checked;
                    setSilentStart(enabled);
                    invoke("set_silent_start", { enabled }).catch(console.error);
                  }}   />
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">隐藏系统托盘图标</span>
                <span className="fluent-setting-description">不在任务栏通知区域显示图标，仅可通过快捷键呼出</span>
              </div>
              <FluentSwitch checked={hideTrayIcon} onChange={(e) => {
                    const val = e.target.checked;
                    setHideTrayIcon(val);
                    invoke("set_tray_visible", { visible: !val }).catch(console.error);
                  }}   />
            </div>

            {isMacPlatform() && (
              <div className="fluent-setting-card">
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">隐藏程序坞 Dock 图标</span>
                  <span className="fluent-setting-description">在 macOS 程序坞中隐去应用图标，保持桌面整洁</span>
                </div>
                <FluentSwitch checked={hideDockIcon} onChange={(e) => {
                      const val = e.target.checked;
                      setHideDockIcon(val);
                      invoke("set_dock_visible", { visible: !val }).catch(console.error);
                    }}   />
              </div>
            )}

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">贴边自动收纳</span>
                <span className="fluent-setting-description">窗口贴边后自动隐藏，鼠标移到边缘时展开</span>
              </div>
              <FluentSwitch checked={edgeDocking} onChange={(e) => {
                    const val = e.target.checked;
                    setEdgeDocking(val);
                    invoke("set_edge_docking", { enabled: val }).catch(console.error);
                  }}   />
            </div>

            {/* Audio Feedback Expander */}
            <h3 className="fluent-section-title">面板入口</h3>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">标签分类</span>
                <span className="fluent-setting-description">使用标签归类和筛选条目</span>
              </div>
              <FluentSwitch checked={tagManagerEnabled} onChange={(e) => {
                    const enabled = e.target.checked;
                    setTagManagerEnabled(enabled);
                    saveAppSetting('tag_manager_enabled', String(enabled));
                  }}   />
            </div>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">表情收藏</span>
                <span className="fluent-setting-description">收藏图片和 GIF，拖动即可使用</span>
              </div>
              <FluentSwitch checked={emojiPanelEnabled} onChange={(e) => {
                    const enabled = e.target.checked;
                    setEmojiPanelEnabled(enabled);
                    saveAppSetting('emoji_panel_enabled', String(enabled));
                  }}   />
            </div>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">便笺管理</span>
                <span className="fluent-setting-description">在侧边栏显示便笺管理入口</span>
              </div>
              <FluentSwitch checked={noteManagerEnabled} onChange={(e) => {
                    const enabled = e.target.checked;
                    setNoteManagerEnabled?.(enabled);
                    saveAppSetting('note_manager_enabled', String(enabled));
                  }}   />
            </div>
            <h3 className="fluent-section-title">声音与打开方式</h3>
            <FluentSettingsExpander className={`fluent-setting-expander ${!soundEnabled ? 'disabled' : ''}`} expanded={!!(expandedCards['audio'] && soundEnabled)} onToggle={() => {
                  if (soundEnabled) toggleExpander('audio');
                }} disabled={!soundEnabled} header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">音效反馈</span>
                  <span className="fluent-setting-description">设置操作提示音</span>
                </div>} actions={<><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><FluentSwitch checked={soundEnabled} onChange={(e) => {
                        const enabled = e.target.checked;
                        setSoundEnabled(enabled);
                        invoke("set_sound_enabled", { enabled }).catch(console.error);
                      }} onClick={e => e.stopPropagation()}  /></div></>}>

              {expandedCards['audio'] && soundEnabled && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">粘贴成功提示音</span>
                      <span className="fluent-setting-description">当系统模拟粘贴指令完成后播放反馈音效</span>
                    </div>
                    <FluentSwitch checked={pasteSoundEnabled} onChange={(e) => {
                          const enabled = e.target.checked;
                          setPasteSoundEnabled(enabled);
                          invoke("save_setting", { key: 'app.sound_paste_enabled', value: String(enabled) }).catch(console.error);
                        }}   />
                  </div>

                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="fluent-setting-title">音量大小</span>
                      <span style={{ fontSize: "11px" }}>{Math.round(soundVolume * 100)}%</span>
                    </div>
                    <FluentSlider min="0" max="1" step="0.01" value={soundVolume} onChange={(e) => setSoundVolume(parseFloat(e.target.value))} style={{
                        ['--range-progress' as any]: `${soundVolume * 100}%`
                      }} />
                  </div>
                </div>
              )}
            </FluentSettingsExpander>

            {/* Default Apps Expander */}
            <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['apps'])} onToggle={() => toggleExpander('apps')}  header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">配置格式关联程序</span>
                  <span className="fluent-setting-description">自定义双击不同格式历史条目时的默认打开应用</span>
                </div>} >

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
                      <FluentButton className="fluent-button" onClick={() => setShowAppSelector(type)}>更改程序</FluentButton>
                    </div>
                  ))}
                </div>
              )}
            </FluentSettingsExpander>

            <h3 className="fluent-section-title">重置</h3>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">重置应用配置</span>
                <span className="fluent-setting-description">清除所有自定义设置，恢复初始状态；这不会清空您的历史记录数据库</span>
              </div>
              <FluentButton className="fluent-button" onClick={handleResetSettings} style={{ color: "#f44336", borderColor: "rgba(244,67,54,0.3)" }}>重置设置</FluentButton>
            </div>
          </div>
        )}

        {/* Tab 2: Clipboard & Hotkeys */}
        {activeTab === "clipboard" && (
          <div>
            <h2 className="fluent-page-header">{t("clipboard_settings") || "剪贴板"}</h2>
            <h3 className="fluent-section-title">快捷键</h3>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">列表快速粘贴</span>
                <span className="fluent-setting-description">按住修饰键显示编号，搭配 1–9、0 粘贴当前列表的前十项。</span>
              </div>
              <FluentDropdown
                aria-label="快速粘贴修饰键"
                options={[...listQuickPasteModifiers]}
                value={normalizeListQuickPasteModifier(appSettings['app.list_quick_paste_modifier'])}
                onChange={value => saveAppSetting('list_quick_paste_modifier', value)}
              />
            </div>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">键盘方向键导航</span>
                <span className="fluent-setting-description">用 ↑ / ↓ 选择条目，按 Enter 粘贴</span>
              </div>
              <FluentSwitch checked={arrowKeySelection} onChange={(e) => {
                    const enabled = e.target.checked;
                    setArrowKeySelection(enabled);
                    saveAppSetting('arrow_key_selection', String(enabled));
                  }}   />
            </div>
            <h3 className="fluent-section-title">全局快捷键</h3>
            <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">置顶条目全局粘贴</span>
                      <span className="fluent-setting-description">在任意窗口用修饰键 + 1–9、0 粘贴前十个置顶条目。</span>
                    </div>
                    <FluentDropdown
                      options={[
                        { id: "disabled", label: t("quick_paste_modifier_disabled") || "已禁用" },
                        { id: "ctrl", label: "Ctrl" },
                        { id: "alt", label: "Alt" },
                        { id: "shift", label: "Shift" },
                        { id: "win", label: "Win" }
                      ]}
                      value={quickPasteModifier}
                      onChange={(val) => {
                        const castVal = val as QuickPasteModifier;
                        setQuickPasteModifier(castVal);
                        invoke("set_quick_paste_modifier", { modifier: castVal }).catch(console.error);
                      }}
                    />
                  </div>
            <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['hotkeys'])} onToggle={() => toggleExpander('hotkeys')}  header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">快捷键分配</span>
                  <span className="fluent-setting-description">配置用于快速唤起窗口、启动搜索或特殊粘贴的全局热键</span>
                </div>} >

              {expandedCards['hotkeys'] && (
                <div className="fluent-setting-expander-content">
                  {/* Global hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">唤起主窗口</span>
                      <span className="fluent-setting-description">显示或隐藏主窗口</span>
                    </div>
                    <div
                      className="fluent-hotkey-recorder"
                      onClick={() => setShowHotkeyModal('main')}
                      style={{ cursor: 'pointer' }}
                    >
                      {renderHotkeyCaps(hotkey)}
                      <Edit3 size={14} className="fluent-hotkey-edit-icon" />
                    </div>
                  </div>

                  {/* Search hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">唤起并直接搜索</span>
                      <span className="fluent-setting-description">打开主窗口并聚焦搜索框</span>
                    </div>
                    <div
                      className="fluent-hotkey-recorder"
                      onClick={() => setShowHotkeyModal('search')}
                      style={{ cursor: 'pointer' }}
                    >
                      {renderHotkeyCaps(searchHotkey)}
                      <Edit3 size={14} className="fluent-hotkey-edit-icon" />
                    </div>
                  </div>

                  {/* Rich text paste hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">强制富文本粘贴</span>
                      <span className="fluent-setting-description">保留原始排版粘贴</span>
                    </div>
                    <div
                      className="fluent-hotkey-recorder"
                      onClick={() => setShowHotkeyModal('rich')}
                      style={{ cursor: 'pointer' }}
                    >
                      {renderHotkeyCaps(richPasteHotkey)}
                      <Edit3 size={14} className="fluent-hotkey-edit-icon" />
                    </div>
                  </div>

                  {/* Strip newline copy hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">{t('strip_newline_hotkey_label') || '无换行复制'}</span>
                      <span className="fluent-setting-description">
                        {t('strip_newline_hotkey_desc') || '选中文本后触发此快捷键，自动复制并清除内容中的全部换行符'}
                      </span>
                    </div>
                    <div
                      className="fluent-hotkey-recorder"
                      onClick={() => setShowHotkeyModal('strip_newline')}
                      style={{ cursor: 'pointer' }}
                    >
                      {renderHotkeyCaps(stripNewlineHotkey)}
                      <Edit3 size={14} className="fluent-hotkey-edit-icon" />
                    </div>
                  </div>

                  {/* Pin window hotkey */}
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">{t('pin_window_hotkey_label') || '固定剪贴板窗口'}</span>
                      <span className="fluent-setting-description">
                        {t('pin_window_hotkey_desc') || '切换主窗口的固定置顶状态，防止失去焦点时自动隐藏'}
                      </span>
                    </div>
                    <div
                      className="fluent-hotkey-recorder"
                      onClick={() => setShowHotkeyModal('pin_window')}
                      style={{ cursor: 'pointer' }}
                    >
                      {renderHotkeyCaps(pinWindowHotkey)}
                      <Edit3 size={14} className="fluent-hotkey-edit-icon" />
                    </div>
                  </div>
                </div>
              )}
            </FluentSettingsExpander>
            <h3 className="fluent-section-title">快捷归类</h3>
            <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['quickTabAssign'])} onToggle={() => toggleExpander('quickTabAssign')}  header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">{t('quick_tab_assign_title') || '复制后归类到工作区'}</span>
                  <span className="fluent-setting-description">
                    {t('quick_tab_assign_desc') || '复制后按修饰键 + 1–9、0，将条目加入对应位置的工作区。'}
                  </span>
                </div>} actions={<><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><FluentSwitch checked={quickTabAssignEnabled} onChange={(e) => {
                        const val = e.target.checked;
                        setQuickTabAssignEnabled(val);
                        saveAppSetting('quick_tab_assign_enabled', String(val));
                      }} onClick={(e) => e.stopPropagation()}  /></div></>}>

              {expandedCards['quickTabAssign'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">{t('quick_tab_assign_seconds_label') || '快捷键有效时长（秒）'}</span>
                      <span className="fluent-setting-description">
                        {t('quick_tab_assign_seconds_desc') || '复制后可使用归类快捷键的时长（1–30 秒）'}
                      </span>
                    </div>
                    <FluentNumberBox
                      value={quickTabAssignSeconds}
                      min={1}
                      max={30}
                      step={1}
                      onChange={(v) => {
                        const clamped = Math.min(30, Math.max(1, v));
                        setQuickTabAssignSeconds(clamped);
                        saveAppSetting('quick_tab_assign_seconds', String(clamped));
                      }}
                    />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">{t('quick_tab_assign_modifier_label') || '快捷键修饰键'}</span>
                      <span className="fluent-setting-description">
                        {t('quick_tab_assign_modifier_desc') || '搭配 1–9、0，按工作区的排列顺序归类'}
                      </span>
                    </div>
                    <FluentDropdown
                      options={[
                        { id: "ctrl+alt", label: "Ctrl + Alt" },
                        { id: "alt+shift", label: "Alt + Shift" },
                        { id: "ctrl+shift", label: "Ctrl + Shift" },
                        { id: "win+alt", label: "Win + Alt" }
                      ]}
                      value={quickTabAssignModifier}
                      onChange={(val) => {
                        setQuickTabAssignModifier(val);
                        saveAppSetting('quick_tab_assign_modifier', val);
                      }}
                    />
                  </div>
                </div>
              )}
            </FluentSettingsExpander>

            <h3 className="fluent-section-title">采集、存储与粘贴</h3>


            {/* Storage controls expander */}
            <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['dbPath'])} onToggle={() => toggleExpander('dbPath')}  header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">数据位置</span>
                  <span className="fluent-setting-description">查看或更改剪贴板历史的存储目录</span>
                </div>} >

              {expandedCards['dbPath'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card" style={{ padding: "8px 12px", gap: "12px", alignItems: "center" }}>
                    <div className="fluent-input-wrapper" style={{ flex: 1, minWidth: 0 }}>
                      <input
                        type="text"
                        className="fluent-input"
                        value={dataPath}
                        readOnly
                        onClick={(e) => e.currentTarget.select()}
                        style={{ flex: 1, minWidth: 0, textOverflow: "ellipsis" }}
                      />
                    </div>
                    <FluentButton
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
                      style={{
                        flexShrink: 0,
                        background: "var(--bg-button)",
                        boxShadow: "none"
                      }}
                    >
                      搬迁数据库
                    </FluentButton>
                  </div>
                </div>
              )}
            </FluentSettingsExpander>
            <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['storage'])} onToggle={() => toggleExpander('storage')}  header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">采集与存储</span>
                  <span className="fluent-setting-description">设置保存数量、内容类型和去重方式</span>
                </div>} >

              {expandedCards['storage'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">持久化历史记录</span>
                      <span className="fluent-setting-description">若关闭，剪贴板历史只会在当前运行期间生效，重启后清空</span>
                    </div>
                    <FluentSwitch checked={persistent} onChange={(e) => {
                          const val = e.target.checked;
                          setPersistent(val);
                          invoke('set_persistence', { enabled: val }).catch(console.error);
                        }}   />
                  </div>

                  {persistent && (
                    <>
                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">启用最大存储上限</span>
                          <span className="fluent-setting-description">限制本地数据库中允许保留的历史记录总条数</span>
                        </div>
                        <FluentSwitch checked={persistentLimitEnabled} onChange={(e) => {
                              setPersistentLimitEnabled(e.target.checked);
                              saveAppSetting('persistent_limit_enabled', e.target.checked.toString());
                            }}   />
                      </div>

                      {persistentLimitEnabled && (
                        <div className="fluent-setting-card">
                          <div className="fluent-setting-info">
                            <span className="fluent-setting-title">配置最大记录条数</span>
                            <span className="fluent-setting-description">设定允许保留的上限数 (50-99999)；超出时将按时间顺序覆盖最旧记录</span>
                          </div>
                          <FluentNumberBox
                            value={persistentLimit}
                            min={50}
                            max={99999}
                            onChange={(v) => {
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
                      <span className="fluent-setting-title">合并重复记录</span>
                      <span className="fluent-setting-description">再次复制已存在的内容时，将其移至列表首位并删除旧副本，防止列表重复</span>
                    </div>
                    <FluentSwitch checked={deduplicate} onChange={(e) => {
                          const val = e.target.checked;
                          setDeduplicate(val);
                          invoke('set_deduplication', { enabled: val }).catch(console.error);
                        }}   />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">捕获文件路径</span>
                      <span className="fluent-setting-description">允许将复制的文件、文件夹及视频文件路径录入剪贴板历史列表</span>
                    </div>
                    <FluentSwitch checked={captureFiles} onChange={(e) => {
                          const val = e.target.checked;
                          setCaptureFiles(val);
                          invoke('set_capture_files', { enabled: val }).catch(console.error);
                        }}   />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">收集富文本排版</span>
                      <span className="fluent-setting-description">捕获文本的加粗、颜色等样式；双击可通过右键菜单粘回带格式文本</span>
                    </div>
                    <FluentSwitch checked={captureRichText} onChange={(e) => {
                          const val = e.target.checked;
                          setCaptureRichText(val);
                          invoke('set_capture_rich_text', { enabled: val }).catch(console.error);
                        }}   />
                  </div>

                  {captureRichText && (
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">富文本快照预览</span>
                        <span className="fluent-setting-description">将捕获的 HTML 渲染为临时内存图像以加快主列表显示速度，稍微增加内存占用</span>
                      </div>
                      <FluentSwitch checked={richTextSnapshotPreview} onChange={(e) => {
                            setRichTextSnapshotPreview(e.target.checked);
                            saveAppSetting('rich_text_snapshot_preview', e.target.checked.toString());
                          }}   />
                    </div>
                  )}
                </div>
              )}
            </FluentSettingsExpander>

            {/* Paste behavior expander */}
            <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['paste'])} onToggle={() => toggleExpander('paste')}  header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">粘贴</span>
                  <span className="fluent-setting-description">配置双击历史条目后，应用与系统输入焦点之间的交互策略</span>
                </div>} >

              {expandedCards['paste'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">双击粘贴</span>
                      <span className="fluent-setting-description">开启后，单击条目仅高亮选中并激活右侧工具栏操作，双击直接执行粘贴；关闭则恢复单击直接粘贴</span>
                    </div>
                    <FluentSwitch checked={doubleClickToPaste} onChange={(e) => {
                          const val = e.target.checked;
                          setDoubleClickToPaste(val);
                          saveAppSetting('double_click_to_paste', val.toString());
                        }}   />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">粘贴后删除</span>
                      <span className="fluent-setting-description">粘贴后删除条目，保留置顶和带标签的内容</span>
                    </div>
                    <FluentSwitch checked={deleteAfterPaste} onChange={(e) => {
                          setDeleteAfterPaste(e.target.checked);
                          saveAppSetting('delete_after_paste', e.target.checked.toString());
                        }}   />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">粘贴后移到顶部</span>
                      <span className="fluent-setting-description">将刚粘贴的条目移到列表顶部</span>
                    </div>
                    <FluentSwitch checked={moveToTopAfterPaste} onChange={(e) => {
                          setMoveToTopAfterPaste(e.target.checked);
                          saveAppSetting('move_to_top_after_paste', e.target.checked.toString());
                        }}   />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">顺序粘贴</span>
                      <span className="fluent-setting-description">按复制时间依次粘贴条目</span>
                    </div>
                    <FluentSwitch checked={sequentialMode} onChange={(e) => {
                          setSequentialModeState(e.target.checked);
                          invoke('set_sequential_mode', { enabled: e.target.checked }).catch(console.error);
                        }}   />
                  </div>

                  {sequentialMode && (
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">粘贴下一项</span>
                        <span className="fluent-setting-description">粘贴队列中的下一项</span>
                      </div>
                      <div
                        className="fluent-hotkey-recorder"
                        onClick={() => setShowHotkeyModal('sequential')}
                        style={{ cursor: 'pointer' }}
                      >
                        {renderHotkeyCaps(sequentialHotkey)}
                        <Edit3 size={14} className="fluent-hotkey-edit-icon" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </FluentSettingsExpander>

          </div>
        )}



        {/* Tab 3: Privacy & Masking */}
        {activeTab === "privacy" && (
          <div>
            <h2 className="fluent-page-header">{t("privacy_protection") || "隐私与过滤"}</h2>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">敏感信息自动脱敏</span>
                <span className="fluent-setting-description">自动在主窗口列表中模糊遮蔽密码、手机号、验证码、链接等敏感文本</span>
              </div>
              <FluentSwitch checked={privacyProtection} onChange={(e) => {
                    setPrivacyProtection(e.target.checked);
                    invoke('set_privacy_protection', { enabled: e.target.checked }).catch(console.error);
                  }}   />
            </div>

            {privacyProtection && (
              <>
                {/* Privacy types expander */}
                <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['privKinds'])} onToggle={() => toggleExpander('privKinds')}  header={<div className="fluent-setting-info">
                      <span className="fluent-setting-title">脱敏信息识别类型</span>
                      <span className="fluent-setting-description">勾选触发自动脱敏过滤的内置字段；未勾选的种类将维持明文显示</span>
                    </div>} >

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
                              <FluentCheckbox checked={checked} onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...privacyProtectionKinds, opt.id]
                                    : privacyProtectionKinds.filter(t => t !== opt.id);
                                  setPrivacyProtectionKinds(next);
                                  invoke('set_privacy_protection_kinds', { kinds: next }).catch(console.error);
                                }} />
                              <span>{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </FluentSettingsExpander>

                {/* Mask offsets expander */}
                <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['maskSettings'])} onToggle={() => toggleExpander('maskSettings')}  header={<div className="fluent-setting-info">
                      <span className="fluent-setting-title">脱敏遮罩显示控制</span>
                      <span className="fluent-setting-description">配置敏感文本前后的明文保留位数，以及邮箱域名的脱敏策略</span>
                    </div>} >

                  {expandedCards['maskSettings'] && (
                    <div className="fluent-setting-expander-content">
                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">头部明文保留字数</span>
                          <span className="fluent-setting-description">敏感文本开头不执行遮蔽的字符长度，支持设置 0 至 20 个字符</span>
                        </div>
                        <FluentNumberBox
                          value={sensitiveMaskPrefixVisible}
                          min={0}
                          max={20}
                          onChange={(val) => {
                            setSensitiveMaskPrefixVisible(val);
                            invoke('save_setting', { key: 'app.sensitive_mask_prefix_visible', value: val.toString() }).catch(console.error);
                          }}
                        />
                      </div>

                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">尾部明文保留字数</span>
                          <span className="fluent-setting-description">敏感文本结尾不执行遮蔽的字符长度，支持设置 0 至 20 个字符</span>
                        </div>
                        <FluentNumberBox
                          value={sensitiveMaskSuffixVisible}
                          min={0}
                          max={20}
                          onChange={(val) => {
                            setSensitiveMaskSuffixVisible(val);
                            invoke('save_setting', { key: 'app.sensitive_mask_suffix_visible', value: val.toString() }).catch(console.error);
                          }}
                        />
                      </div>

                      <div className="fluent-setting-card">
                        <div className="fluent-setting-info">
                          <span className="fluent-setting-title">电子邮箱后缀脱敏</span>
                          <span className="fluent-setting-description">开启后将同步模糊电子邮箱中 @ 符号后的域名部分，进一步保障隐私</span>
                        </div>
                        <FluentSwitch checked={sensitiveMaskEmailDomain} onChange={(e) => {
                              setSensitiveMaskEmailDomain(e.target.checked);
                              invoke('save_setting', { key: 'app.sensitive_mask_email_domain', value: e.target.checked.toString() }).catch(console.error);
                            }}   />
                      </div>
                    </div>
                  )}
                </FluentSettingsExpander>

                {/* Custom Rules */}
                <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['customPriv'])} onToggle={() => toggleExpander('customPriv')}  header={<div className="fluent-setting-info">
                      <span className="fluent-setting-title">自定义正则屏蔽规则</span>
                      <span className="fluent-setting-description">使用正则表达式定义需保护的私有内容格式；凡命中规则的字符都将被自动遮罩</span>
                    </div>} >

                  {expandedCards['customPriv'] && (
                    <div className="fluent-setting-expander-content" style={{ padding: "12px" }}>
                      <textarea
                        className="fluent-dialog-textarea"
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
                </FluentSettingsExpander>
              </>
            )}
          </div>
        )}

        {/* Tab 4: Sync & Transfer */}
        {activeTab === "sync" && (
          <div>
            <h2 className="fluent-page-header">{t("sync_and_transfer") || "同步与传输"}</h2>

            {/* LAN File Server Expander */}
            {/* LAN File Server Expander */}
            <FluentSettingsExpander className={`fluent-setting-expander ${!fileServerEnabled ? 'disabled' : ''}`} expanded={!!(expandedCards['lan'] && fileServerEnabled)} onToggle={() => {
                  if (fileServerEnabled) toggleExpander('lan');
                }} disabled={!fileServerEnabled} header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">局域网文件传输</span>
                  <span className="fluent-setting-description">开启本地文件传输网页，允许处于同一局域网的设备通过浏览器上传文件或聊天</span>
                </div>} actions={<><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><FluentSwitch checked={fileServerEnabled} onChange={(e) => {
                        const val = e.target.checked;
                        setFileServerEnabled(val);
                        const port = Number(fileServerPort);
                        invoke("toggle_file_server", { enabled: val, port: Number.isInteger(port) ? port : undefined });
                      }} onClick={e => e.stopPropagation()}  /></div></>}>

              {expandedCards['lan'] && fileServerEnabled && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">服务监听端口</span>
                      <span className="fluent-setting-description">配置本地传输服务占用的网络通信端口，默认使用 18888</span>
                    </div>
                    <div className="fluent-input-wrapper" style={{ width: "80px" }}>
                      <input
                        type="text"
                        className="fluent-input"
                        style={{ width: "100%", textAlign: "center" }}
                        value={fileServerPort}
                        onChange={e => setFileServerPort(e.target.value)}
                        onBlur={() => applyFileServerPort(fileServerPort)}
                      />
                    </div>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">本地网络 IP 访问点</span>
                      <span className="fluent-setting-description">提供给其他同局域网设备进行连接的浏览器访问基准地址</span>
                    </div>
                    {availableIps && availableIps.length > 1 && setLocalIp ? (
                      <FluentDropdown
                        options={availableIps.map(ip => ({ id: ip, label: ip }))}
                        value={localIp}
                        onChange={(val) => {
                          setLocalIp(val);
                          invoke("set_display_ip", { ip: val }).catch(console.error);
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{localIp}</span>
                    )}
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">接收文件后展示列表</span>
                      <span className="fluent-setting-description">当本机接收到传输文件时，主界面自动弹窗展现局域网传输列表</span>
                    </div>
                    <FluentSwitch checked={fileTransferAutoOpen} onChange={(e) => {
                          const val = e.target.checked;
                          setFileTransferAutoOpen(val);
                          invoke('set_file_transfer_auto_open', { enabled: val }).catch(console.error);
                        }}   />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">空闲时自动关闭</span>
                      <span className="fluent-setting-description">若连续 5 分钟没有任何文件接收活动且传输网页关闭，将自动关闭服务以节省资源</span>
                    </div>
                    <FluentSwitch checked={fileServerAutoClose} onChange={(e) => {
                          const val = e.target.checked;
                          setFileServerAutoClose(val);
                          invoke('set_file_server_auto_close', { enabled: val }).catch(console.error);
                        }}   />
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">文件接收完毕自动复制</span>
                      <span className="fluent-setting-description">局域网文件传输完成后，自动将该文件存入剪贴板首位以备随时粘贴</span>
                    </div>
                    <FluentSwitch checked={fileTransferAutoCopy} onChange={(e) => {
                          const val = e.target.checked;
                          setFileTransferAutoCopy(val);
                          invoke('set_auto_copy_file', { enabled: val }).catch(console.error);
                        }}   />
                  </div>

                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span className="fluent-setting-title">传输文件存储目录</span>
                      <FluentButton
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
                      </FluentButton>
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
            </FluentSettingsExpander>

            {/* MQTT Sync Expander */}
            {/* MQTT Sync Expander */}
            <FluentSettingsExpander className={`fluent-setting-expander ${!mqttEnabled ? 'disabled' : ''}`} expanded={!!(expandedCards['mqtt'] && mqttEnabled)} onToggle={() => {
                  if (mqttEnabled) toggleExpander('mqtt');
                }} disabled={!mqttEnabled} header={<div className="fluent-setting-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="fluent-setting-title">MQTT 跨端同步服务</span>
                    {mqttEnabled && (
                      <span
                        style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: mqttStatus === 'connected' ? '#4CAF50' : mqttStatus === 'connecting' ? '#FF9800' : '#F44336'
                        }}
                      />
                    )}
                  </div>
                  <span className="fluent-setting-description">基于 MQTT 代理服务器，在多端设备间进行剪贴板历史及短信验证码的低延迟同步</span>
                </div>} actions={<><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><FluentSwitch checked={mqttEnabled} onChange={(e) => {
                        const val = e.target.checked;
                        setMqttEnabled(val);
                        saveMqtt('mqtt_enabled', String(val));
                      }} onClick={e => e.stopPropagation()}  /></div></>}>

              {expandedCards['mqtt'] && mqttEnabled && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">服务器通信协议</span>
                      <span className="fluent-setting-description">支持基于 TCP 的 mqtt(s) 标准协议或基于浏览器的 ws(s) 网络套接字协议</span>
                    </div>
                    <FluentDropdown
                      options={[
                        { id: "mqtt://", label: "mqtt://" },
                        { id: "mqtts://", label: "mqtts://" },
                        { id: "ws://", label: "ws://" },
                        { id: "wss://", label: "wss://" }
                      ]}
                      value={mqttProtocol}
                      onChange={(val) => {
                        const protocol = val;
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
                    />
                  </div>

                  { (mqttProtocol === 'ws://' || mqttProtocol === 'wss://') && (
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">WebSocket 访问路径</span>
                        <span className="fluent-setting-description">当选用 ws:// 或 wss:// 协议时所需的特定服务器终端路由路径</span>
                      </div>
                      <div className="fluent-input-wrapper">
                        <input
                          type="text"
                          className="fluent-input"
                          value={mqttWsPath}
                          onChange={(e) => { setMqttWsPath(e.target.value); saveMqtt('mqtt_ws_path', e.target.value); }}
                          placeholder="/mqtt"
                        />
                      </div>
                    </div>
                  )}

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">代理服务器主机地址</span>
                      <span className="fluent-setting-description">MQTT 代理服务器的 IP 地址或网络域名</span>
                    </div>
                    <div className="fluent-input-wrapper">
                      <input
                        type="text"
                        className="fluent-input"
                        value={mqttServer}
                        onChange={(e) => { setMqttServer(e.target.value); saveMqtt('mqtt_server', e.target.value); }}
                      />
                    </div>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">通信端口号</span>
                      <span className="fluent-setting-description">代理服务占用的端口，标准端口为 1883 (非加密) 或 8883 (SSL 加密)</span>
                    </div>
                    <div className="fluent-input-wrapper" style={{ width: "80px" }}>
                      <input
                        type="text"
                        className="fluent-input"
                        style={{ width: "100%", textAlign: "center" }}
                        value={mqttPort}
                        onChange={(e) => { setMqttPort(e.target.value); saveMqtt('mqtt_port', e.target.value); }}
                      />
                    </div>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">认证用户名</span>
                      <span className="fluent-setting-description">可选；连接公共或私有代理服务器时所需的账户名称</span>
                    </div>
                    <div className="fluent-input-wrapper">
                      <input
                        type="text"
                        className="fluent-input"
                        value={mqttUser}
                        onChange={(e) => { setMqttUser(e.target.value); saveMqtt('mqtt_username', e.target.value); }}
                      />
                    </div>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">认证密码</span>
                      <span className="fluent-setting-description">可选；与上述用户名配套使用的连接鉴权密码</span>
                    </div>
                    <div className="fluent-input-wrapper">
                      <input
                        type="password"
                        className="fluent-input"
                        value={mqttPass}
                        onChange={(e) => { setMqttPass(e.target.value); saveMqtt('mqtt_password', e.target.value); }}
                      />
                    </div>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">订阅主题 (Topic)</span>
                      <span className="fluent-setting-description">所有需互通的多端设备必须使用完全相同的订阅主题名称来进行广播</span>
                    </div>
                    <div className="fluent-input-wrapper">
                      <input
                        type="text"
                        className="fluent-input"
                        value={mqttTopic}
                        onChange={(e) => { setMqttTopic(e.target.value); saveMqtt('mqtt_topic', e.target.value); }}
                      />
                    </div>
                  </div>

                  <div className="fluent-setting-card">
                    <div className="fluent-setting-info">
                      <span className="fluent-setting-title">同步成功系统通知</span>
                      <span className="fluent-setting-description">当其他设备成功同步了新短信验证码或文本时，在系统右下角弹出气泡提醒</span>
                    </div>
                    <FluentSwitch checked={mqttNotificationEnabled} onChange={(e) => {
                          setMqttNotificationEnabled(e.target.checked);
                          saveMqtt('mqtt_notification_enabled', String(e.target.checked));
                        }}   />
                  </div>
                </div>
              )}
            </FluentSettingsExpander>

            {/* Cloud sync WebDAV expander */}
            {CLOUD_SYNC_ENABLED && (
              <FluentSettingsExpander className={`fluent-setting-expander ${!cloudSyncEnabled ? 'disabled' : ''}`} expanded={!!(expandedCards['cloud'] && cloudSyncEnabled)} onToggle={() => {
                    if (cloudSyncEnabled) toggleExpander('cloud');
                  }} disabled={!cloudSyncEnabled} header={<div className="fluent-setting-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="fluent-setting-title">WebDAV 跨端数据云同步</span>
                      {cloudSyncEnabled && (
                        <span
                          style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: cloudSyncStatus.state === "idle" ? '#4CAF50' : cloudSyncStatus.state === "syncing" ? '#FF9800' : '#F44336'
                          }}
                        />
                      )}
                    </div>
                    <span className="fluent-setting-description">支持将本地剪贴板数据加密上传备份至坚果云、Nextcloud 等 WebDAV 云盘，并在多端同步</span>
                  </div>} actions={<><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><FluentSwitch checked={cloudSyncEnabled} onChange={(e) => {
                          const val = e.target.checked;
                          setCloudSyncEnabled(val);
                          saveCloudSync('cloud_sync_enabled', String(val));
                        }} onClick={e => e.stopPropagation()}  /></div></>}>

                {expandedCards['cloud'] && cloudSyncEnabled && (
                  <div className="fluent-setting-expander-content">
                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">定时同步</span>
                        <span className="fluent-setting-description">在后台周期性自动执行本地历史记录与云端备份数据库的合并校准</span>
                      </div>
                      <FluentSwitch checked={cloudSyncAuto} onChange={(e) => {
                            setCloudSyncAuto(e.target.checked);
                            saveCloudSync('cloud_sync_auto', String(e.target.checked));
                          }}   />
                    </div>

                    {cloudSyncAuto && (
                      <>
                        <div className="fluent-setting-card">
                          <div className="fluent-setting-info">
                            <span className="fluent-setting-title">增量同步间隔</span>
                            <span className="fluent-setting-description">在后台轮询检查本地剪贴板内容变化并自动上传的频率 (范围：5 至 3600 秒)</span>
                          </div>
                          <FluentNumberBox
                            value={cloudSyncIntervalSec}
                            min={5}
                            max={3600}
                            onChange={(v) => {
                              setCloudSyncIntervalSec(v.toString());
                              saveCloudSync('cloud_sync_interval_sec', v.toString());
                            }}
                          />
                        </div>

                        <div className="fluent-setting-card">
                          <div className="fluent-setting-info">
                            <span className="fluent-setting-title">完整同步间隔</span>
                            <span className="fluent-setting-description">执行深层双向数据校准合并与云端过期历史清理的间隔频率</span>
                          </div>
                          <FluentNumberBox
                            value={cloudSyncSnapshotIntervalMin}
                            min={5}
                            max={1440}
                            onChange={(v) => {
                              setCloudSyncSnapshotIntervalMin(v.toString());
                              saveCloudSync('cloud_sync_snapshot_interval_min', v.toString());
                            }}
                          />
                        </div>
                      </>
                    )}

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">WebDAV 服务器地址</span>
                        <span className="fluent-setting-description">您的云盘提供商提供的 WebDAV 访问端点网络地址</span>
                      </div>
                      <div className="fluent-input-wrapper">
                        <input
                          type="text"
                          className="fluent-input"
                          value={cloudSyncWebdavUrl}
                          onChange={e => setCloudSyncWebdavUrl(e.target.value)}
                          onBlur={() => saveCloudSync('cloud_sync_webdav_url', cloudSyncWebdavUrl.trim())}
                        />
                      </div>
                    </div>

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">WebDAV 用户名</span>
                        <span className="fluent-setting-description">用于登录 WebDAV 服务商的云端账户名</span>
                      </div>
                      <div className="fluent-input-wrapper">
                        <input
                          type="text"
                          className="fluent-input"
                          value={cloudSyncWebdavUsername}
                          onChange={e => setCloudSyncWebdavUsername(e.target.value)}
                          onBlur={() => saveCloudSync('cloud_sync_webdav_username', cloudSyncWebdavUsername.trim())}
                        />
                      </div>
                    </div>

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">应用专用授权密码</span>
                        <span className="fluent-setting-description">多数云盘服务商为保障安全，要求并推荐在后台生成“应用专用密码”填写在此</span>
                      </div>
                      <div className="fluent-input-wrapper">
                        <input
                          type="password"
                          className="fluent-input"
                          value={cloudSyncWebdavPassword}
                          onChange={e => setCloudSyncWebdavPassword(e.target.value)}
                          onBlur={() => saveCloudSync('cloud_sync_webdav_password', cloudSyncWebdavPassword)}
                        />
                      </div>
                    </div>

                    <div className="fluent-setting-card">
                      <div className="fluent-setting-info">
                        <span className="fluent-setting-title">同步数据根目录</span>
                        <span className="fluent-setting-description">在您的云盘中存放此应用同步数据的专用目录名称</span>
                      </div>
                      <div className="fluent-input-wrapper">
                        <input
                          type="text"
                          className="fluent-input"
                          value={cloudSyncWebdavBasePath}
                          onChange={e => setCloudSyncWebdavBasePath(e.target.value)}
                          onBlur={() => saveCloudSync('cloud_sync_webdav_base_path', cloudSyncWebdavBasePath.trim() || 'tiez-sync')}
                        />
                      </div>
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
                        <span className="fluent-setting-title">强制全量数据同步</span>
                        <span className="fluent-setting-description">立即手动触发一次本地数据与云端备份文件的强力合并与比对</span>
                      </div>
                      <FluentButton
                        className="fluent-button"
                        disabled={cloudSyncNowRunning || cloudSyncStatus.state === "syncing"}
                        onClick={handleCloudSyncNow}
                      >
                        {cloudSyncNowRunning ? "同步中..." : "立即同步"}
                      </FluentButton>
                    </div>
                </div>
              )}
            </FluentSettingsExpander>
          )}
          </div>
        )}

        {/* Tab 5: AI Assistant */}
        {activeTab === "ai" && (
          <div>
            <h2 className="fluent-page-header">{t("ai_settings") || "AI 智能助手"}</h2>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">AI 助手</span>
                <span className="fluent-setting-description">在条目右键菜单中加入大模型处理入口，支持对剪贴板内容进行快速翻译、解释或润色</span>
              </div>
              <FluentSwitch checked={aiEnabled} onChange={(e) => {
                    setAiEnabled(e.target.checked);
                    saveSetting('ai_enabled', String(e.target.checked));
                  }}   />
            </div>

            {aiEnabled && (
              <>
                {/* Model Profiles Management */}
                <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['aiModels'])} onToggle={() => toggleExpander('aiModels')}  header={<div className="fluent-setting-info">
                      <span className="fluent-setting-title">模型</span>
                      <span className="fluent-setting-description">添加、修改并测试第三方兼容 OpenAI/Claude 的大模型连接端点和 API 密钥</span>
                    </div>} >

                  {expandedCards['aiModels'] && (
                    <div className="fluent-setting-expander-content">
                      <div className="fluent-model-list">
                        {aiProfiles.map(profile => {
                          const status = profileStatuses[profile.id] || 'idle';
                          return (
                            <div key={profile.id} className="fluent-model-item">
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                                <span className={`status-indicator-dot ${status}`} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                    {profile.model}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                    {profile.baseUrl}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <button
                                  className="fluent-model-action-btn"
                                  title="测试连接"
                                  onClick={() => checkModelStatus(profile)}
                                >
                                  <Activity size={14} />
                                </button>
                                <button
                                  className="fluent-model-action-btn"
                                  title="编辑配置"
                                  onClick={() => setEditingProfile(profile)}
                                >
                                  <Edit3 size={14} />
                                </button>
                                {!['lc_flash_v1', 'lc_think_v1', 'lc_think_2601_v1'].includes(profile.id) && (
                                  <button
                                    className="fluent-model-action-btn delete-btn"
                                    title="删除配置"
                                    onClick={() => handleDeleteProfile(profile.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div
                        className="fluent-model-add-card"
                        onClick={() => setEditingProfile({ isNew: true, baseUrl: 'https://api.longcat.chat/openai/v1', apiKey: '', model: '', enableThinking: false })}
                      >
                        <Plus size={14} />
                        <span>添加自定义 AI 模型配置</span>
                      </div>
                    </div>
                  )}
                </FluentSettingsExpander>

                {/* Strategy binding */}
                <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['aiStrategy'])} onToggle={() => toggleExpander('aiStrategy')}  header={<div className="fluent-setting-info">
                      <span className="fluent-setting-title">各功能使用的模型</span>
                      <span className="fluent-setting-description">分别为智能任务执行、对话多端嘴替、快速翻译三个场景分配专属的模型配置</span>
                    </div>} >

                  {expandedCards['aiStrategy'] && (
                    <div className="fluent-setting-expander-content">
                      {[
                        { label: '智能任务执行模型', value: aiAssignedProfileTask, setter: setAiAssignedProfileTask, key: 'ai_assigned_profile_task' },
                        { label: '对话及多端嘴替模型', value: aiAssignedProfileMouthpiece, setter: setAiAssignedProfileMouthpiece, key: 'ai_assigned_profile_mouthpiece' },
                        { label: '智能快速翻译模型', value: aiAssignedProfileTranslate, setter: setAiAssignedProfileTranslate, key: 'ai_assigned_profile_translate' },
                      ].map(strategy => (
                        <div key={strategy.key} className="fluent-setting-card">
                          <span className="fluent-setting-title">{strategy.label}</span>
                          <FluentDropdown
                            options={
                              aiProfiles.length > 0
                                ? aiProfiles.map(p => ({ id: p.id, label: p.model }))
                                : [{ id: "none", label: "请先添加模型配置" }]
                            }
                            value={strategy.value || "none"}
                            onChange={(val) => {
                              if (val !== "none") {
                                strategy.setter(val);
                                saveSetting(strategy.key, val);
                              }
                            }}
                            style={{ width: "240px" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </FluentSettingsExpander>

                {/* Translations and budget */}
                <div className="fluent-setting-card">
                  <div className="fluent-setting-info">
                    <span className="fluent-setting-title">默认智能翻译语言</span>
                    <span className="fluent-setting-description">执行 AI 翻译快捷功能后，偏好输出的译文目标语种</span>
                  </div>
                  <FluentDropdown
                    options={[
                      { id: "auto_zh_en", label: "中英自动互译" },
                      { id: "zh", label: "简体中文" },
                      { id: "en", label: "English" },
                      { id: "ja", label: "日本語" },
                      { id: "de", label: "Deutsch" },
                      { id: "fr", label: "Français" }
                    ]}
                    value={aiTargetLang}
                    onChange={(val) => {
                      setAiTargetLang(val);
                      saveSetting('ai_target_lang', val);
                    }}
                  />
                </div>

                <div className="fluent-setting-card">
                  <div className="fluent-setting-info">
                    <span className="fluent-setting-title">推理深度思考限制</span>
                    <span className="fluent-setting-description">支持推理大模型思考链条的最大上限 Token 预算，合理控制处理时长与成本</span>
                  </div>
                  <FluentNumberBox
                    value={aiThinkingBudget}
                    min={1024}
                    max={10000}
                    onChange={(v) => {
                      setAiThinkingBudget(v.toString());
                      saveSetting('ai_thinking_budget', v.toString());
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
            <h2 className="fluent-page-header">{t("appearance_settings") || "个性化外观"}</h2>
            <h3 className="fluent-section-title">主题与语言</h3>
            {/* Visual theme dropdown */}
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">主题</span>
                <span className="fluent-setting-description">切换界面预设的主题和底板配色</span>
              </div>
              <FluentDropdown
                options={THEMES.map(tOption => ({
                  id: tOption.id,
                  label: getThemeLabel(tOption.id, language)
                }))}
                value={theme}
                onChange={(val) => {
                  setTheme(val);
                  saveAppSetting('theme', val);
                }}
              />
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">色彩显示模式</span>
                <span className="fluent-setting-description">支持暗黑、明亮或自动跟随操作系统变化</span>
              </div>
              <FluentDropdown
                options={[
                  { id: 'system', label: '系统默认' },
                  { id: 'light', label: '浅色明亮' },
                  { id: 'dark', label: '深色暗黑' }
                ]}
                value={colorMode}
                onChange={(val) => {
                  setColorMode(val);
                  saveAppSetting('color_mode', val);
                }}
              />
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">界面语言</span>
                <span className="fluent-setting-description">更改所有菜单的文案显示语种</span>
              </div>
              <FluentDropdown
                options={[
                  { id: 'zh', label: '简体中文' },
                  { id: 'tw', label: '繁體中文' },
                  { id: 'en', label: 'English' }
                ]}
                value={language}
                onChange={(val) => {
                  setLanguage(val as Locale);
                  saveAppSetting('language', val);
                }}
              />
            </div>

            <h3 className="fluent-section-title">列表</h3>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">常驻主页搜索栏</span>
                <span className="fluent-setting-description">在主窗口固定显示搜索框，关闭后可通过向上滚动列表唤出</span>
              </div>
              <FluentSwitch checked={showSearchBox} onChange={(e) => {
                    const enabled = e.target.checked;
                    setShowSearchBox(enabled);
                    saveAppSetting('show_search_box', String(enabled));
                  }}   />
            </div>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">回到顶部悬浮钮</span>
                <span className="fluent-setting-description">向下滚动后显示回到顶部按钮</span>
              </div>
              <FluentSwitch checked={scrollTopButtonEnabled} onChange={(e) => {
                    const enabled = e.target.checked;
                    setScrollTopButtonEnabled(enabled);
                    saveAppSetting('show_scroll_top_button', String(enabled));
                  }}   />
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">显示条目来源图标</span>
                <span className="fluent-setting-description">在剪贴板条目左侧展示其所属的原程序图标</span>
              </div>
              <FluentSwitch checked={showSourceAppIcon} onChange={(e) => {
                    setShowSourceAppIcon(e.target.checked);
                    saveAppSetting('show_source_app_icon', String(e.target.checked));
                  }}   />
            </div>

            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">紧凑列表</span>
                <span className="fluent-setting-description">减少条目间距，显示更多内容</span>
              </div>
              <FluentSwitch checked={compactMode} onChange={(e) => {
                    setCompactMode(e.target.checked);
                    saveAppSetting('compact_mode', String(e.target.checked));
                  }}   />
            </div>

            {/* Font slider expander */}
            <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['fonts'])} onToggle={() => toggleExpander('fonts')}  header={<div className="fluent-setting-info">
                  <span className="fluent-setting-title">字号</span>
                  <span className="fluent-setting-description">微调主界面和标签中文字的可读性字号</span>
                </div>} >

              {expandedCards['fonts'] && (
                <div className="fluent-setting-expander-content">
                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="fluent-setting-title">条目文字大小</span>
                      <span style={{ fontSize: "11px" }}>{clipboardItemFontSize}px</span>
                    </div>
                    <FluentSlider min="11" max="18" step="1" value={clipboardItemFontSize} onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setClipboardItemFontSize(val);
                        saveAppSetting('clipboard_item_font_size', String(val));
                      }} style={{
                        ['--range-progress' as any]: `${((clipboardItemFontSize - 11) / 7) * 100}%`
                      }} />
                  </div>

                  <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="fluent-setting-title">标签字号大小</span>
                      <span style={{ fontSize: "11px" }}>{clipboardTagFontSize}px</span>
                    </div>
                    <FluentSlider min="8" max="14" step="1" value={clipboardTagFontSize} onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setClipboardTagFontSize(val);
                        saveAppSetting('clipboard_tag_font_size', String(val));
                      }} style={{
                        ['--range-progress' as any]: `${((clipboardTagFontSize - 8) / 6) * 100}%`
                      }} />
                  </div>
                </div>
              )}
            </FluentSettingsExpander>

            {/* Window background transparent expander */}
            {(supportsCustomBackground(theme) || supportsSurfaceOpacity(theme)) && (
              <FluentSettingsExpander className="fluent-setting-expander" expanded={!!(expandedCards['transparent'])} onToggle={() => toggleExpander('transparent')}  header={<div className="fluent-setting-info">
                    <span className="fluent-setting-title">亚克力玻璃与背景自定义</span>
                    <span className="fluent-setting-description">自定义半透明玻璃板的磨砂值或选定壁纸大图</span>
                  </div>} >

                {expandedCards['transparent'] && (
                  <div className="fluent-setting-expander-content">
                    {supportsCustomBackground(theme) && (
                      <div className="fluent-setting-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="fluent-setting-title">自定义背景壁纸图片</span>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <FluentButton
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
                            </FluentButton>
                            {customBackground && (
                              <FluentButton
                                className="fluent-button"
                                style={{ color: "#f44336" }}
                                onClick={() => {
                                  setCustomBackground('');
                                  saveAppSetting('custom_background', '');
                                }}
                              >
                                清除
                              </FluentButton>
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
                              <FluentSlider min="0" max="100" value={customBackgroundOpacity} onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setCustomBackgroundOpacity(val);
                                  saveAppSetting('custom_background_opacity', String(val));
                                }} style={{
                                  ['--range-progress' as any]: `${customBackgroundOpacity}%`
                                }} />
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
                        <FluentSlider min="0" max="100" value={surfaceOpacity} onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setSurfaceOpacity(val);
                            saveAppSetting('surface_opacity', String(val));
                          }} style={{
                            ['--range-progress' as any]: `${surfaceOpacity}%`
                          }} />
                      </div>
                    )}
                  </div>
                )}
              </FluentSettingsExpander>
            )}
            <h3 className="fluent-section-title">便笺外观</h3>
            <div className="fluent-setting-card">
              <div className="fluent-setting-info">
                <span className="fluent-setting-title">便笺窗口背景材质</span>
                <span className="fluent-setting-description">选择便笺窗口的背景效果</span>
              </div>
              <FluentDropdown
                options={[
                  { id: 'sync', label: '跟随主窗口' },
                  { id: 'mica', label: '云母材质 (Mica)' },
                  { id: 'acrylic', label: '亚克力材质 (Acrylic)' },
                  { id: 'solid', label: '纯色便笺纸' }
                ]}
                value={noteBackdropMode}
                onChange={(val) => {
                  setNoteBackdropMode(val);
                  saveAppSetting('note_backdrop_mode', val);
                }}
              />
            </div>

            {noteBackdropMode === 'solid' && (
              <div className="fluent-setting-card">
                <div className="fluent-setting-info">
                  <span className="fluent-setting-title">便笺默认底色</span>
                  <span className="fluent-setting-description">新建纯色便笺时使用的颜色</span>
                </div>
                <FluentDropdown
                  options={[
                    { id: 'random', label: '🎲 随机色彩分配' },
                    { id: 'yellow', label: '🟨 便笺黄 (Yellow)' },
                    { id: 'green', label: '🟩 薄荷绿 (Mint)' },
                    { id: 'blue', label: '🟦 天空蓝 (Sky Blue)' },
                    { id: 'purple', label: '🟪 薰衣草 (Lavender)' },
                    { id: 'pink', label: '🌸 樱花粉 (Rose)' },
                    { id: 'charcoal', label: '⬜ 石板灰 (Slate)' },
                    { id: 'orange', label: '🟧 暖阳橙 (Orange)' },
                    { id: 'cyan', label: '🟦 湖水青 (Cyan)' }
                  ]}
                  value={noteDefaultSolidColor}
                  onChange={(val) => {
                    setNoteDefaultSolidColor(val);
                    saveAppSetting('note_default_solid_color', val);
                  }}
                />
              </div>
            )}

          </div>
        )}

        {/* Tab 7: Advanced Rules */}
        {activeTab === "advanced" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <h2 className="fluent-page-header">{t("advanced_settings") || "数据清洗与过滤"}</h2>
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
        <FluentScrollbar scrollContainer={contentEl} />
      </div>

      {/* Selector Modals */}
      <AppSelectorModal
        show={showAppSelector}
        installedApps={installedApps}
        t={t}
        onClose={() => setShowAppSelector(null)}
        onSave={saveAppSetting}
      />

      <HotkeySelectorModal
        show={showHotkeyModal}
        currentValue={
          showHotkeyModal === 'main' ? hotkey :
          showHotkeyModal === 'search' ? searchHotkey :
          showHotkeyModal === 'rich' ? richPasteHotkey :
          showHotkeyModal === 'sequential' ? sequentialHotkey :
          showHotkeyModal === 'strip_newline' ? stripNewlineHotkey :
          showHotkeyModal === 'pin_window' ? pinWindowHotkey : ""
        }
        defaultValue={
          showHotkeyModal === 'main' ? "Alt+C" :
          showHotkeyModal === 'search' ? "Alt+F" :
          showHotkeyModal === 'rich' ? "Ctrl+Shift+Z" :
          showHotkeyModal === 'sequential' ? "Alt+V" :
          showHotkeyModal === 'strip_newline' ? "Alt+Shift+C" :
          showHotkeyModal === 'pin_window' ? "Alt+P" : ""
        }
        t={t}
        onClose={() => setShowHotkeyModal(null)}
        onSave={(val) => {
          if (showHotkeyModal === 'main') updateHotkey(val);
          if (showHotkeyModal === 'search') updateSearchHotkey(val);
          if (showHotkeyModal === 'rich') updateRichPasteHotkey(val);
          if (showHotkeyModal === 'sequential') updateSequentialHotkey(val);
          if (showHotkeyModal === 'strip_newline') updateStripNewlineHotkey(val);
          if (showHotkeyModal === 'pin_window') updatePinWindowHotkey(val);
        }}
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
