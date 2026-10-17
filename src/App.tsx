import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Trash2, FolderPlus, X, Folder } from "lucide-react";
import ToastContainer from "./shared/components/ToastContainer";
import ConfirmDialog from "./shared/components/ConfirmDialog";
import FluentTooltip from "./shared/components/FluentTooltip";

import { translations } from "./locales";
import AppHeader from "./features/app/components/AppHeader";
import AppMainContent from "./features/app/components/AppMainContent";
import { useAppState } from "./features/app/hooks/useAppState";
import { useDebounce } from "./shared/hooks/useDebounce";
import { useHistoryFetch } from "./shared/hooks/useHistoryFetch";
import { useInputFocus } from "./shared/hooks/useInputFocus";
import { useSearchScroll } from "./shared/hooks/useSearchScroll";
import { useSettingsApply } from "./shared/hooks/useSettingsApply";
import { useSettingsInit } from "./shared/hooks/useSettingsInit";
import { useSettingsPostInit } from "./shared/hooks/useSettingsPostInit";
import { useSettingsSync } from "./shared/hooks/useSettingsSync";
import { useTagColors } from "./shared/hooks/useTagColors";
import { useClipboardEvents } from "./shared/hooks/useClipboardEvents";
import { useClipboardActions } from "./shared/hooks/useClipboardActions";
import { useMqttListener } from "./shared/hooks/useMqttListener";
import { useSoundEffects } from "./shared/hooks/useSoundEffects";
import { useWindowPinnedListener } from "./shared/hooks/useWindowPinnedListener";
import { useCustomBackground } from "./shared/hooks/useCustomBackground";
import { useToastListener } from "./shared/hooks/useToastListener";
import { useAppBootstrap } from "./shared/hooks/useAppBootstrap";
import { useAppActions } from "./shared/hooks/useAppActions";
import { useNavigationSync } from "./shared/hooks/useNavigationSync";
import { useContextMenuBlock } from "./shared/hooks/useContextMenuBlock";
import { useSettingsPanelReset } from "./shared/hooks/useSettingsPanelReset";
import { useTagManagerRefresh } from "./shared/hooks/useTagManagerRefresh";
import { useAiActions } from "./shared/hooks/useAiActions";
import { matchesHotkey } from "./shared/hooks/useHotkeyMatching";
import { usePinnedSort } from "./shared/hooks/usePinnedSort";
import { useFilteredHistory } from "./shared/hooks/useFilteredHistory";
import { useKeyboardNavigation } from "./shared/hooks/useKeyboardNavigation";
import { useListSelectionReset } from "./shared/hooks/useListSelectionReset";
import { useSearchFetchTrigger } from "./shared/hooks/useSearchFetchTrigger";
import { useScrollToSelection } from "./shared/hooks/useScrollToSelection";
import { useClipboardItemRenderer } from "./shared/hooks/useClipboardItemRenderer";
import { useAnnouncements } from "./shared/hooks/useAnnouncements";
import { useOverlays } from "./shared/hooks/useOverlays";
import { useAutoUpdate } from "./shared/hooks/useAutoUpdate";
import UpdateDialog from "./shared/components/UpdateDialog";
import type { ClipboardEntry } from "./shared/types";
import type { QuickPasteHint, VirtualClipboardListHandle } from "./features/clipboard/types";


import type { QuickPasteModifier, TabItem } from "./features/app/types";
import {
  forceHideCompactPreviewWindow,
  isCompactPreviewWindowSupported,
  isCompactPreviewWarmupSupported,
  warmupCompactPreviewWindow
} from "./features/clipboard/lib/compactPreviewControls";
import { isMacPlatform } from "./shared/lib/platform";
import { isTauriRuntime } from "./shared/lib/tauriRuntime";

const insertHistoryItem = (list: ClipboardEntry[], item: ClipboardEntry) => {
  const next = list.slice();
  const isPinned = !!item.is_pinned;
  let insertIndex = 0;

  if (isPinned) {
    while (insertIndex < next.length) {
      const current = next[insertIndex];
      if (!current.is_pinned) break;
      if (current.timestamp < item.timestamp) break;
      insertIndex++;
    }
  } else {
    while (insertIndex < next.length && next[insertIndex].is_pinned) {
      insertIndex++;
    }
    while (insertIndex < next.length) {
      const current = next[insertIndex];
      if (current.is_pinned) {
        insertIndex++;
        continue;
      }
      if (current.timestamp < item.timestamp) break;
      insertIndex++;
    }
  }

  next.splice(insertIndex, 0, item);
  return next;
};

const QUICK_PASTE_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

const buildQuickPasteHintsById = (
  items: ClipboardEntry[],
  quickPasteModifier: QuickPasteModifier
): Record<number, QuickPasteHint> => {
  if (quickPasteModifier === "disabled") {
    return {};
  }

  const modifierLabels: Record<Exclude<QuickPasteModifier, "disabled">, string> = isMacPlatform()
    ? {
        ctrl: "⌃",
        alt: "⌥",
        shift: "⇧",
        win: "⌘"
      }
    : {
        ctrl: "Ctrl+",
        alt: "Alt+",
        shift: "Shift+",
        win: "Win+"
      };
  const pinnedItems = items.filter((item) => item.is_pinned).slice(0, QUICK_PASTE_KEYS.length);

  return pinnedItems.reduce<Record<number, QuickPasteHint>>((acc, item, index) => {
    acc[item.id] = {
      slot: index + 1,
      combo: `${modifierLabels[quickPasteModifier]}${QUICK_PASTE_KEYS[index]}`
    };
    return acc;
  }, {});
};

const App = () => {
  type FileTransferSourceView = "clipboard" | "settings" | "tag_manager" | "emoji_panel";

  const appState = useAppState();
  const {
    showSettings,
    setShowSettings,
    settingsSubpage,
    setSettingsSubpage,
    showTagManager,
    setShowTagManager,
    tagManagerEnabled,
    setTagManagerEnabled,
    setCollapsedGroups,
    history,
    setHistory,
    search,
    setSearch,
    isComposing,
    setIsComposing,
    searchIsFocused,
    setSearchIsFocused,
    showTagFilter,
    setShowTagFilter,
    tagInput,
    setTagInput,
    showEmojiPanel,
    setShowEmojiPanel,
    emojiFavorites,
    setEmojiFavorites,
    aiOptionsOpenId,
    setAiOptionsOpenId,
    editingTagsId,
    setEditingTagsId,
    revealedIds,
    setRevealedIds,
    setAutoStart,
    deduplicate,
    setDeduplicate,
    persistent,
    setPersistent,
    persistentLimitEnabled,
    setPersistentLimitEnabled,
    persistentLimit,
    setPersistentLimit,
    appSettings,
    setAppSettings,
    setDefaultApps,
    chatMode,
    setChatMode,
    setInstalledApps,
    setDataPath,
    hotkey,
    setHotkey,
    setSequentialHotkey,
    richPasteHotkey,
    setRichPasteHotkey,
    setSearchHotkey,
    setStripNewlineHotkey,
    quickPasteModifier,
    setQuickPasteModifier,
    setSequentialModeState,
    isRecording,
    isRecordingSequential,
    isRecordingRich,
    isRecordingSearch,
    deleteAfterPaste,
    setDeleteAfterPaste,
    moveToTopAfterPaste,
    setMoveToTopAfterPaste,
    privacyProtection,
    setPrivacyProtection,
    sensitiveMaskPrefixVisible,
    setSensitiveMaskPrefixVisible,
    sensitiveMaskSuffixVisible,
    setSensitiveMaskSuffixVisible,
    sensitiveMaskEmailDomain,
    setSensitiveMaskEmailDomain,
    setPrivacyProtectionKinds,
    setPrivacyProtectionCustomRules,
    setCleanupRules,
    setAppCleanupPolicies,
    captureFiles,
    setCaptureFiles,
    captureRichText,
    setCaptureRichText,
    richTextSnapshotPreview,
    setRichTextSnapshotPreview,
    setSilentStart,
    followMouse: _followMouse,
    setFollowMouse,
    showAppBorder,
    setShowAppBorder,
    winClipboardDisabled: _winClipboardDisabled,
    setWinClipboardDisabled,
    registryWinVEnabled: _registryWinVEnabled,
    setRegistryWinVEnabled,
    pasteMethod: _pasteMethod,
    setPasteMethod,
    theme,
    setTheme,
    colorMode,
    setColorMode,
    showSourceAppIcon,
    setShowSourceAppIcon,

    compactMode,
    setCompactMode,
    clipboardItemFontSize,
    setClipboardItemFontSize,
    clipboardTagFontSize,
    setClipboardTagFontSize,
    emojiPanelEnabled,
    setEmojiPanelEnabled,
    emojiPanelTab,
    setEmojiPanelTab,
    language,
    setLanguage,
    settingsLoaded,
    setSettingsLoaded,
    isWindowPinned,
    setIsWindowPinned,
    showSearchBox,
    setShowSearchBox,
    setScrollTopButtonEnabled,
    arrowKeySelection,
    setArrowKeySelection,
    setHideTrayIcon,
    setHideDockIcon,
    setEdgeDocking,
    customBackground,
    setCustomBackground,
    customBackgroundOpacity,
    setCustomBackgroundOpacity,
    surfaceOpacity,
    setSurfaceOpacity,
    selectedIndex,
    setSelectedIndex,
    isKeyboardMode,
    setIsKeyboardMode,
    isLoadingMore,
    setIsLoadingMore,
    hasMore,
    setHasMore,
    currentOffset,
    setCurrentOffset,
    mqttEnabled,
    setMqttEnabled,
    setMqttServer,
    setMqttPort,
    setMqttUser,
    setMqttPass,
    setMqttTopic,
    setMqttProtocol,
    setMqttWsPath,
    mqttNotificationEnabled,
    setMqttNotificationEnabled,
    cloudSyncEnabled,
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
    setCloudSyncContentPrefs,
    fileServerEnabled,
    setFileServerEnabled,
    setFileServerPort,
    localIp,
    setLocalIp,
    setAvailableIps,
    actualPort,
    setActualPort,
    setFileTransferPath,
    setFileTransferAutoOpen,
    setFileTransferAutoCopy,
    setFileServerAutoClose,
    fileTransferAutoOpen,
    fileTransferAutoCopy,
    fileServerAutoClose,
    soundEnabled,
    setSoundEnabled,
    pasteSoundEnabled,
    setPasteSoundEnabled,
    soundVolume,
    setSoundVolume,
    aiEnabled,
    setAiEnabled,
    setAiTargetLang,
    setAiThinkingBudget,
    aiProfiles,
    setAiProfiles,
    setAiAssignedProfileTask,
    setAiAssignedProfileMouthpiece,
    setAiAssignedProfileTranslate,
    processingAiId,
    setProcessingAiId,
    typeFilter,
    setTypeFilter,
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    editingTabFlyoutId,
    setEditingTabFlyoutId
  } = appState;

  // --- Auto Update Logic ---
  const {
    isOpen: isUpdateOpen,
    status: updateStatus,
    version: updateVersion,
    notes: updateNotes,
    downloadProgress: updateProgress,
    onStartDownload,
    onApplyUpdate,
    onClose: closeUpdateDialog,
  } = useAutoUpdate();
  // -------------------------

  const effectiveShowEmojiPanel = showEmojiPanel && emojiPanelEnabled;
  const effectiveShowTagManager = showTagManager && tagManagerEnabled;
  const [fileTransferSourceView, setFileTransferSourceView] =
    useState<FileTransferSourceView>("clipboard");

  const debouncedSearch = useDebounce(search, 400);
  const searchInputRef = useInputFocus<HTMLInputElement>();
  const tagColors = useTagColors();
  const [dbTags, setDbTags] = useState<string[]>([]);
  const [entranceActive, setEntranceActive] = useState(false);

  // Multi-select & Batch Operations
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [isBatchTabDropdownOpen, setIsBatchTabDropdownOpen] = useState(false);
  const lastSelectedIndexRef = useRef<number | null>(null);

  // Manual Item Add Modal
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [addEntryContent, setAddEntryContent] = useState("");

  useEffect(() => {
    (window as any).__tiezSelectedItemIds = selectedItemIds;
  }, [selectedItemIds]);

  useEffect(() => {
    if (selectedItemIds.size > 0 || isAddEntryModalOpen) {
      invoke("set_ignore_blur", { ignore: true }).catch(() => {});
    } else {
      invoke("set_ignore_blur", { ignore: false }).catch(() => {});
    }
  }, [selectedItemIds.size, isAddEntryModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedItemIds.size > 0) {
          setSelectedItemIds(new Set());
          lastSelectedIndexRef.current = null;
          setIsBatchTabDropdownOpen(false);
        }
        if (isAddEntryModalOpen) {
          setIsAddEntryModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemIds.size, isAddEntryModalOpen]);

  useEffect(() => {
    // Initial entrance on mount
    setEntranceActive(true);

    // Preload emoji data to cache it in memory
    fetch("/emoji-data.json")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data && Array.isArray(data.groups)) {
          (window as any).__EMOJI_CACHE__ = data.groups;
        }
        if (data && data.dictionary) {
          (window as any).__EMOJI_DICT_CACHE__ = data.dictionary;
        }
      })
      .catch(() => {});

    if (!isTauriRuntime()) return;

    const unlistenShown = listen("window-shown", () => {
      setEntranceActive(true);
      setSelectedItemIds(new Set());
      lastSelectedIndexRef.current = null;
      setIsBatchTabDropdownOpen(false);
    });

    const unlistenHidden = listen("window-hidden", () => {
      setEntranceActive(false);
      setSelectedItemIds(new Set());
      lastSelectedIndexRef.current = null;
      setIsBatchTabDropdownOpen(false);
    });

    return () => {
      unlistenShown.then((off) => off());
      unlistenHidden.then((off) => off());
    };
  }, []);

  useEffect(() => {
    if (effectiveShowTagManager || showTagFilter || editingTagsId !== null) {
      invoke<Record<string, number>>('get_all_tags_info')
        .then((tagMap) => {
          setDbTags(Object.keys(tagMap));
        })
        .catch(console.error);
    }
  }, [effectiveShowTagManager, showTagFilter, editingTagsId, history]);
  const virtualListRef = useRef<VirtualClipboardListHandle | null>(null);
  const [quickPasteHintsById, setQuickPasteHintsById] = useState<Record<number, QuickPasteHint>>(
    {}
  );
  // Use a larger page size when filtering by type, since filtered results
  // are sparser and the user expects to browse more items at once.
  const PAGE_SIZE = typeFilter ? 200 : 80;
  const { fetchHistory, loadMoreHistory } = useHistoryFetch({
    debouncedSearch,
    typeFilter,
    persistentLimitEnabled,
    persistentLimit,
    pageSize: PAGE_SIZE,
    currentOffset,
    historyLength: history.length,
    setHistory,
    setCurrentOffset,
    setHasMore,
    isLoadingMore,
    hasMore,
    setIsLoadingMore
  });

  const t = useCallback((key: string) => {
    const k = key as keyof typeof translations['zh'];
    return translations[language][k] || translations['en'][k] || key;
  }, [language]);

  const { handleListScroll: handleSearchScroll, handleMainWheel } = useSearchScroll({
    showSearchBox,
    setShowSearchBox,
    search,
    showSettings,
    showTagManager: effectiveShowTagManager,
    appSettings,
    searchInputRef
  });

  const getCurrentSourceView = useCallback((): FileTransferSourceView => {
    if (effectiveShowTagManager) return "tag_manager";
    if (effectiveShowEmojiPanel) return "emoji_panel";
    if (showSettings) return "settings";
    return "clipboard";
  }, [effectiveShowEmojiPanel, effectiveShowTagManager, showSettings]);

  const restoreViewAfterChat = useCallback(
    (sourceView: FileTransferSourceView) => {
      setShowTagManager(sourceView === "tag_manager");
      setShowEmojiPanel(sourceView === "emoji_panel");
      setShowSettings(sourceView === "settings");
    },
    [setShowEmojiPanel, setShowSettings, setShowTagManager]
  );

  const openFileTransfer = useCallback(() => {
    const sourceView = getCurrentSourceView();
    setFileTransferSourceView(sourceView);
    setShowTagManager(false);
    setShowEmojiPanel(false);
    setShowSettings(true);
    setChatMode(true);
  }, [getCurrentSourceView, setChatMode, setShowEmojiPanel, setShowSettings, setShowTagManager]);

  const closeFileTransfer = useCallback(() => {
    setChatMode(false);
    restoreViewAfterChat(fileTransferSourceView);
  }, [fileTransferSourceView, restoreViewAfterChat, setChatMode]);

  const handleHeaderBack = useCallback(() => {
    if (chatMode) {
      closeFileTransfer();
      return;
    }
    if (effectiveShowEmojiPanel) {
      setShowEmojiPanel(false);
      return;
    }
    if (effectiveShowTagManager) {
      setShowTagManager(false);
      return;
    }
    if (showSettings) {
      if (settingsSubpage !== "home") {
        setSettingsSubpage("home");
        return;
      }
      setShowSettings(false);
    }
  }, [
    chatMode,
    closeFileTransfer,
    effectiveShowEmojiPanel,
    effectiveShowTagManager,
    setShowEmojiPanel,
    setShowSettings,
    setSettingsSubpage,
    setShowTagManager,
    settingsSubpage,
    showSettings
  ]);

  const handleToggleHeaderChat = useCallback(() => {
    if (chatMode) {
      closeFileTransfer();
      return;
    }
    openFileTransfer();
  }, [chatMode, closeFileTransfer, openFileTransfer]);

  const handleListScroll = useCallback((offset: number) => {
    handleSearchScroll(offset);
  }, [handleSearchScroll]);


  // Compute all tags when tag manager / tag filter is open, or while editing an item's tags (quick-pick list)
  const allTags = useMemo(() => {
    if (!effectiveShowTagManager && !showTagFilter && editingTagsId === null) return [];

    const set = new Set<string>();
    // Localized builtin tags
    set.add(t("tag_builtin_sensitive"));
    set.add(t("tag_builtin_password"));

    // Helper to map system tag key to display tag name
    const toDisplayTag = (tag: string) => {
      const lower = tag.toLowerCase();
      if (lower === "sensitive") return t("tag_builtin_sensitive");
      if (lower === "password" || lower === "密码" || lower === "密碼") return t("tag_builtin_password");
      return tag;
    };

    // Add custom tags from DB
    dbTags.forEach((tag) => {
      set.add(toDisplayTag(tag));
    });

    // Add tags from history
    history.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        set.add(toDisplayTag(tag));
      });
    });
    const customTabNames = new Set(tabs.filter((t) => t.id !== "clipboard").map((t) => t.name.toLowerCase()));
    return Array.from(set).filter((tag) => !customTabNames.has(tag.toLowerCase())).sort((a, b) => a.localeCompare(b));
  }, [history, dbTags, effectiveShowTagManager, showTagFilter, editingTagsId, tabs, t]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (isRecording || isRecordingSequential || isRecordingRich || isRecordingSearch) return;
      if (!hotkey || hotkey === t('not_set')) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isEditable = !!activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      );

      if (matchesHotkey(event, hotkey)) {
        event.preventDefault();
        invoke("toggle_window_cmd").catch(console.error);
        return;
      }

      if (!isEditable && hotkey.toUpperCase().includes('WIN') && matchesHotkey(event, hotkey, { ignoreWin: true })) {
        event.preventDefault();
        invoke("toggle_window_cmd").catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [hotkey, isRecording, isRecordingSequential, isRecordingRich, isRecordingSearch, t]);


  const { toasts, pushToast, confirmDialog, openConfirm, closeConfirm } = useOverlays();

  useSoundEffects({ soundEnabled, pasteSoundEnabled, soundVolume });

  const fetchEffectiveTransferPath = useCallback(() => {
    invoke<string>("get_active_file_transfer_path")
      .then(setFileTransferPath)
      .catch(console.error);
  }, [setFileTransferPath]);

  useAnnouncements();

  const tagManagerSizeRef = useRef<{ width: number; height: number } | null>(null);

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
    setClipboardItemFontSize,
    setClipboardTagFontSize,
    setEmojiPanelEnabled,
    setTagManagerEnabled,
    setEmojiPanelTab,
    setEmojiFavorites,
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
    setRegistryWinVEnabled,
    setPasteMethod,
    setShowSourceAppIcon,

    setDeleteAfterPaste,
    setMoveToTopAfterPaste,
    setHideTrayIcon,
    setHideDockIcon,
    setEdgeDocking,
    setShowSearchBox,
    setScrollTopButtonEnabled,
    setArrowKeySelection,
    setMqttEnabled,
    setMqttServer,
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
    setCloudSyncContentPrefs,
    setFileServerAutoClose,
    setFileTransferAutoOpen,
    setFileTransferAutoCopy,
    setFileServerPort,
    setSequentialHotkey,
    setRichPasteHotkey,
    setSearchHotkey,
    setStripNewlineHotkey,
    setQuickPasteModifier,
    setSequentialModeState,
    setSoundEnabled,
    setPasteSoundEnabled,
    setSoundVolume,
    setAiEnabled,
    setAiTargetLang,
    setAiThinkingBudget,
    setIsWindowPinned,
    setAiProfiles,
    setAiAssignedProfileTask,
    setAiAssignedProfileMouthpiece,
    setAiAssignedProfileTranslate,
    setSettingsLoaded
  });

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const unlisten = listen("focus-search-input", () => {
      setShowSettings(false);
      setShowTagManager(false);
      setChatMode(false);
      setShowEmojiPanel(false);
      setShowSearchBox(true);
      setSearchIsFocused(true);
      invoke("activate_window_focus")
        .catch(console.error)
        .finally(() => {
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
          });
        });
    });

    return () => {
      unlisten.then((off) => off());
    };
  }, [
    setShowSettings,
    setShowTagManager,
    setChatMode,
    setShowEmojiPanel,
    setShowSearchBox,
    setSearchIsFocused,
  ]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const hasOverlay = document.querySelector(".modal-overlay") !== null;
      if (hasOverlay) {
        document.documentElement.classList.add("has-modal");
      } else {
        document.documentElement.classList.remove("has-modal");
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const hasOverlay = document.querySelector(".modal-overlay") !== null;
    if (hasOverlay) {
      document.documentElement.classList.add("has-modal");
    }

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("has-modal");
    };
  }, []);

  useEffect(() => {
    if (!emojiPanelEnabled && showEmojiPanel) {
      setShowEmojiPanel(false);
    }
  }, [emojiPanelEnabled, showEmojiPanel, setShowEmojiPanel]);

  useEffect(() => {
    if (!tagManagerEnabled && showTagManager) {
      setShowTagManager(false);
    }
  }, [tagManagerEnabled, showTagManager, setShowTagManager]);

  useAppBootstrap({
    fetchEffectiveTransferPath,
    setDataPath,
    setInstalledApps,
    setAutoStart,
    setDefaultApps,
    setFileServerEnabled,
    setActualPort,
    setLocalIp,
    setAvailableIps,
    setWinClipboardDisabled
  });

  useWindowPinnedListener({
    onPinnedChange: setIsWindowPinned
  });

  useContextMenuBlock();

  useSettingsApply({
    theme,
    colorMode,

    compactMode,
    settingsLoaded,
    clipboardItemFontSize,
    clipboardTagFontSize,
    surfaceOpacity,
    showAppBorder
  });

  // Apply Windows system accent color.
  // Inject directly onto body.style — priority higher than any CSS rule,
  // and all descendants (including pseudo-elements) inherit normally.
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

  // Pre-warm compact preview window only where warmup is safe.
  // macOS keeps hover preview enabled but skips warmup to reduce UI stalls.
  useEffect(() => {
    if (!compactMode || !isCompactPreviewWindowSupported() || !isCompactPreviewWarmupSupported()) return;
    const timer = setTimeout(() => {
      warmupCompactPreviewWindow();
    }, 2000); // 2s delay: avoids impacting app startup performance
    return () => clearTimeout(timer);
  }, [compactMode]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const unlisten = listen("force-hide-compact-preview", () => {
      forceHideCompactPreviewWindow();
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, []);

  useCustomBackground({ customBackground, customBackgroundOpacity, theme });

  useClipboardEvents({
    onUpdated: (updatedItem) => {
      setHistory(prev => {
        const withoutItem = prev.filter(item => item.id !== updatedItem.id);
        return insertHistoryItem(withoutItem, updatedItem);
      });
    },
    onRemoved: (id) => {
      setHistory(prev => prev.filter(item => item.id !== id));
    },
    onChanged: () => {
      fetchHistory(true);
    }
  });

  useMqttListener({ enabled: mqttNotificationEnabled, t });

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const seededHints = buildQuickPasteHintsById(history, quickPasteModifier);
    setQuickPasteHintsById(seededHints);

    if (quickPasteModifier === "disabled") {
      return () => {
        cancelled = true;
      };
    }

    invoke<ClipboardEntry[]>("get_clipboard_history", {
      limit: 256,
      offset: 0,
      contentType: null
    })
      .then((items) => {
        if (!cancelled) {
          setQuickPasteHintsById(buildQuickPasteHintsById(items, quickPasteModifier));
        }
      })
      .catch((error) => {
        console.error("Failed to refresh quick paste hints:", error);
        if (!cancelled) {
          setQuickPasteHintsById(seededHints);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [history, quickPasteModifier]);

  useToastListener({ pushToast });

  useSettingsPanelReset({ showSettings, setCollapsedGroups, setSettingsSubpage });

  useTagManagerRefresh({
    showTagManager: effectiveShowTagManager,
    settingsLoaded,
    persistentLimitEnabled,
    persistentLimit,
    fetchHistory
  });

  const saveAppSetting = useCallback(async (type: string, path: string) => {
    const key = `app.${type}`;
    console.log(`[THEME DEBUG] saveAppSetting called: key=${key}, value=${path}`);
    setAppSettings(prev => ({ ...prev, [key]: path }));

    // Sync theme-related settings to localStorage for instant startup (prevents flash)
    try {
      if (type === 'theme') localStorage.setItem('tiez_theme', path);
      if (type === 'color_mode') localStorage.setItem('tiez_color_mode', path);
      if (type === 'compact_mode') localStorage.setItem('tiez_compact_mode', path);
    } catch (e) {
      // Ignore localStorage errors
    }

    try {
      await invoke("save_setting", { key, value: path });
      console.log(`[THEME DEBUG] saveAppSetting success: key=${key}`);
    } catch (err) {
      console.error("保存设置失败", err);
    }
  }, [setAppSettings]);

  const saveSetting = useCallback((key: string, val: string) => {
    invoke("save_setting", { key, value: val })
      .then(() => {
        if (key === "app.emoji_favorites") {
          return invoke("request_cloud_sync");
        }
        return undefined;
      })
      .catch(console.error);
  }, []);

  useSettingsSync({
    settingsLoaded,
    deduplicate,
    saveAppSetting,
    captureFiles,
    captureRichText,
    fileTransferAutoCopy,
    fileServerAutoClose,
    fileTransferAutoOpen,
    persistent,
    arrowKeySelection,
    soundVolume,
    setIsKeyboardMode,
    setSelectedIndex
  });

  const { clearHistory } = useAppActions({
    t,
    mqttEnabled,
    cloudSyncEnabled,
    openConfirm,
    closeConfirm,
    pushToast,
    fetchHistory
  });

  useNavigationSync({ showSettings, showTagManager: effectiveShowTagManager, chatMode, showEmojiPanel: effectiveShowEmojiPanel });

  const { copyToClipboard, openContent, deleteEntry, togglePin, handleUpdateTags } =
    useClipboardActions({
      t,
      pushToast,
      deleteAfterPaste,
      moveToTopAfterPaste,
      setSearch,
      setHistory,
      virtualListRef
    });

  const { handleAIAction } = useAiActions({
    aiProfiles,
    language,
    pushToast,
    setShowSettings,
    setProcessingAiId,
    setHistory
  });

  /* 
  const updateItemContent = async (id: number, newContent: string) => {
    try {
      await invoke("update_item_content", { id, newContent });
      // Local state will be refreshed by fetchHistory triggered by clipboard-changed event
    } catch (err) {
      console.error("Failed to update item content", err);
    }
  };
  */

  const [tabAssignments, setTabAssignments] = useState<Record<string, number[]>>(() => {
    try {
      const saved = localStorage.getItem("tiez_tab_assignments");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load tab assignments", e);
    }
    return {};
  });

  const saveTabAssignments = useCallback((next: Record<string, number[]>) => {
    try {
      const str = JSON.stringify(next);
      localStorage.setItem("tiez_tab_assignments", str);
      invoke("save_setting", { key: "app.tab_assignments", val: str }).catch(console.error);
    } catch (e) {
      console.error("Failed to save tab assignments", e);
    }
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const filteredHistory = useFilteredHistory({
    history,
    search,
    typeFilter,
    activeTabId,
    tabAssignments
  });

  // One-time cleanup & migration: migrate any tags matching tab names to tabAssignments, and remove the tag
  useEffect(() => {
    const customTabs = tabs.filter((t) => !t.isBuiltin && t.id !== "clipboard");
    if (customTabs.length === 0 || history.length === 0) return;

    let hasUpdates = false;
    const nextAssignments = { ...tabAssignments };

    customTabs.forEach((ct) => {
      const matched = history.filter((h) => h.tags?.includes(ct.name));
      if (matched.length > 0) {
        const existingIds = new Set(nextAssignments[ct.id] || []);
        matched.forEach((m) => existingIds.add(m.id));
        nextAssignments[ct.id] = Array.from(existingIds);
        hasUpdates = true;

        matched.forEach((m) => {
          const cleanTags = (m.tags || []).filter((tg) => tg !== ct.name);
          handleUpdateTags(m.id, cleanTags);
        });
      }
      invoke("delete_tag", { name: ct.name }).catch(() => {});
    });

    if (hasUpdates) {
      setTabAssignments(nextAssignments);
      saveTabAssignments(nextAssignments);
    }
  }, [tabs, history.length]);

  const effectiveHasMore = hasMore && filteredHistory.length >= PAGE_SIZE;

  const { pinnedItems, unpinnedItems, handlePinnedReorder } = usePinnedSort({
    filteredHistory,
    history,
    setHistory
  });

  useListSelectionReset({ filteredHistory, setSelectedIndex });

  useSearchFetchTrigger({ debouncedSearch, isComposing, typeFilter, fetchHistory });

  useScrollToSelection({
    filteredHistory,
    selectedIndex,
    isKeyboardMode,
    pinnedCount: pinnedItems.length,
    virtualListRef
  });

  useKeyboardNavigation({
    filteredHistory,
    selectedIndex,
    setSelectedIndex,
    isKeyboardMode,
    setIsKeyboardMode,
    showSettings,
    showTagManager: effectiveShowTagManager,
    chatMode,
    editingTagsId,
    arrowKeySelection,
    richPasteHotkey,
    searchInputRef,
    copyToClipboard,
    setSearch
  });

  const handleAddTab = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = tabs.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const newTab: TabItem = {
      id: `tab_${Date.now()}`,
      name: trimmed
    };
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newTab.id);
    try {
      localStorage.setItem("tiez_custom_tabs", JSON.stringify(nextTabs));
      invoke("save_setting", { key: "app.custom_tabs", val: JSON.stringify(nextTabs) }).catch(console.error);
    } catch (e) {
      console.error("Failed to save tabs", e);
    }
    pushToast(t("tab_created").replace("{name}", trimmed));
  }, [tabs, setTabs, setActiveTabId, t, pushToast]);

  const handleDeleteTab = useCallback((tabId: string) => {
    const tabToDelete = tabs.find((t) => t.id === tabId);
    if (!tabToDelete || tabToDelete.isBuiltin) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId("clipboard");
    }
    setTabAssignments((prev) => {
      const next = { ...prev };
      delete next[tabId];
      saveTabAssignments(next);
      return next;
    });
    try {
      localStorage.setItem("tiez_custom_tabs", JSON.stringify(nextTabs));
      invoke("save_setting", { key: "app.custom_tabs", val: JSON.stringify(nextTabs) }).catch(console.error);
    } catch (e) {
      console.error("Failed to save tabs", e);
    }
    pushToast(t("tab_deleted").replace("{name}", tabToDelete.name));
  }, [tabs, setTabs, activeTabId, setActiveTabId, saveTabAssignments, t, pushToast]);

  const handleToggleItemInTab = useCallback((itemId: number, tabIdOrName: string) => {
    const targetTab = tabs.find((t) => t.id === tabIdOrName || t.name === tabIdOrName);
    if (!targetTab) return;
    const actualTabId = targetTab.id;
    setTabAssignments((prev) => {
      const list = prev[actualTabId] || [];
      const exists = list.includes(itemId);
      const nextList = exists ? list.filter((id) => id !== itemId) : [...list, itemId];
      const next = { ...prev, [actualTabId]: nextList };
      saveTabAssignments(next);
      if (exists) {
        pushToast(t("tab_removed").replace("{name}", targetTab.name));
      } else {
        pushToast(t("tab_added").replace("{name}", targetTab.name));
      }
      return next;
    });
  }, [tabs, saveTabAssignments, pushToast, t]);

  const handleAddNewTabAndAssign = useCallback((itemId: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let targetTab = tabs.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    let nextTabs = tabs;
    if (!targetTab) {
      targetTab = {
        id: `tab_${Date.now()}`,
        name: trimmed
      };
      nextTabs = [...tabs, targetTab];
      setTabs(nextTabs);
      try {
        localStorage.setItem("tiez_custom_tabs", JSON.stringify(nextTabs));
        invoke("save_setting", { key: "app.custom_tabs", val: JSON.stringify(nextTabs) }).catch(console.error);
      } catch (e) {
        console.error("Failed to save tabs", e);
      }
    }
    const finalTab = targetTab;
    setTabAssignments((prev) => {
      const list = prev[finalTab.id] || [];
      if (list.includes(itemId)) return prev;
      const next = { ...prev, [finalTab.id]: [...list, itemId] };
      saveTabAssignments(next);
      return next;
    });
    pushToast(t("tab_created_and_assigned").replace("{name}", trimmed));
  }, [tabs, setTabs, saveTabAssignments, pushToast, t]);

  const handleMultiSelect = useCallback((id: number, index: number, modifiers: { ctrl: boolean; shift: boolean }) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (modifiers.shift && lastSelectedIndexRef.current !== null) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        for (let i = start; i <= end; i++) {
          const item = filteredHistory[i];
          if (item) next.add(item.id);
        }
      } else if (modifiers.ctrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        lastSelectedIndexRef.current = index;
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        lastSelectedIndexRef.current = index;
      }
      return next;
    });
  }, [filteredHistory]);

  const handleItemContentUpdated = useCallback((id: number, newContent: string) => {
    setHistory(prev =>
      prev.map(item =>
        item.id === id ? { ...item, content: newContent, preview: newContent.slice(0, 500) } : item
      )
    );
    pushToast(t("item_updated"));
  }, [setHistory, pushToast, t]);

  const handleBatchDelete = useCallback(() => {
    const count = selectedItemIds.size;
    if (count === 0) return;
    openConfirm({
      title: t("delete_selected"),
      message: (t("batch_delete_confirm") || "确定要删除选中的 {count} 个条目吗？").replace("{count}", String(count)),
      onConfirm: async () => {
        for (const id of selectedItemIds) {
          try {
            await invoke("delete_clipboard_entry", { id });
          } catch (e) {
            console.error("Failed to delete item", id, e);
          }
        }
        setHistory((prev) => prev.filter((item) => !selectedItemIds.has(item.id)));
        pushToast(t("batch_deleted").replace("{count}", String(count)));
        setSelectedItemIds(new Set());
        lastSelectedIndexRef.current = null;
      }
    });
  }, [selectedItemIds, openConfirm, t, setHistory, pushToast]);

  const handleBatchAddToTab = useCallback((tabIdOrName: string) => {
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;
    const targetTab = tabs.find((t) => t.id === tabIdOrName || t.name === tabIdOrName);
    if (!targetTab) return;
    setTabAssignments((prev) => {
      const currentList = prev[targetTab.id] || [];
      const toAdd = ids.filter((id) => !currentList.includes(id));
      const nextList = [...currentList, ...toAdd];
      const next = { ...prev, [targetTab.id]: nextList };
      saveTabAssignments(next);
      return next;
    });
    pushToast(t("batch_added_to_tab").replace("{count}", String(ids.length)).replace("{name}", targetTab.name));
    setSelectedItemIds(new Set());
    lastSelectedIndexRef.current = null;
    setIsBatchTabDropdownOpen(false);
  }, [selectedItemIds, tabs, saveTabAssignments, pushToast, t]);

  const handleDropItemOnTab = useCallback((itemId: number, targetTabIdOrName: string) => {
    const draggedList = (window as any).__tiezDraggedItemIds;
    const itemsToAdd: number[] = (Array.isArray(draggedList) && draggedList.length > 0)
      ? draggedList
      : (selectedItemIds.has(itemId) && selectedItemIds.size > 1
          ? Array.from(selectedItemIds)
          : [itemId]);

    const isClipboardTab = targetTabIdOrName === "clipboard" || targetTabIdOrName === t("clipboard") || targetTabIdOrName === "剪贴板";
    if (isClipboardTab) {
      if (activeTabId && activeTabId !== "clipboard") {
        const currentTab = tabs.find((t) => t.id === activeTabId);
        setTabAssignments((prev) => {
          const currentList = prev[activeTabId] || [];
          const nextList = currentList.filter((id) => !itemsToAdd.includes(id));
          const next = { ...prev, [activeTabId]: nextList };
          saveTabAssignments(next);
          return next;
        });
        pushToast(t("tab_removed").replace("{name}", currentTab?.name || ""));
        if (itemsToAdd.length > 1) {
          setSelectedItemIds(new Set());
          lastSelectedIndexRef.current = null;
        }
      }
      (window as any).__tiezDraggedItemIds = null;
      (window as any).__tiezDraggedItemId = null;
      return;
    }

    const targetTab = tabs.find((t) => t.id === targetTabIdOrName || t.name === targetTabIdOrName);
    if (!targetTab) return;

    setTabAssignments((prev) => {
      const currentList = prev[targetTab.id] || [];
      const toAdd = itemsToAdd.filter((id) => !currentList.includes(id));
      const nextList = [...currentList, ...toAdd];
      const next = { ...prev, [targetTab.id]: nextList };
      saveTabAssignments(next);
      return next;
    });

    if (itemsToAdd.length > 1) {
      pushToast(t("batch_added_to_tab").replace("{count}", String(itemsToAdd.length)).replace("{name}", targetTab.name));
      setSelectedItemIds(new Set());
      lastSelectedIndexRef.current = null;
    } else {
      pushToast(t("tab_added").replace("{name}", targetTab.name));
    }
    (window as any).__tiezDraggedItemIds = null;
    (window as any).__tiezDraggedItemId = null;
  }, [selectedItemIds, tabs, activeTabId, saveTabAssignments, pushToast, t]);

  useEffect(() => {
    const handleCardDrop = (e: Event) => {
      const customE = e as CustomEvent<{ itemId: number; tabId?: string; tabName?: string }>;
      if (customE.detail) {
        handleDropItemOnTab(customE.detail.itemId, customE.detail.tabId || customE.detail.tabName || "");
      }
    };
    window.addEventListener("tiez-card-dropped-on-tab", handleCardDrop);
    return () => {
      window.removeEventListener("tiez-card-dropped-on-tab", handleCardDrop);
    };
  }, [handleDropItemOnTab]);

  const handleConfirmAddEntry = useCallback(async () => {
    const trimmed = addEntryContent.trim();
    if (!trimmed) {
      setIsAddEntryModalOpen(false);
      return;
    }
    try {
      const newId = await invoke<number>("add_manual_item", {
        content: trimmed,
        contentType: "text",
        tags: []
      });
      if (activeTab && activeTab.id !== "clipboard" && typeof newId === "number") {
        setTabAssignments((prev) => {
          const list = prev[activeTab.id] || [];
          const next = { ...prev, [activeTab.id]: [newId, ...list] };
          saveTabAssignments(next);
          return next;
        });
      }
      pushToast(t("entry_added"));
      setIsAddEntryModalOpen(false);
      setAddEntryContent("");
      fetchHistory(true);
    } catch (err) {
      console.error("Failed to add entry:", err);
    }
  }, [addEntryContent, activeTab, saveTabAssignments, pushToast, t, fetchHistory]);

  const { renderItemContent } = useClipboardItemRenderer({
    privacyProtection,
    revealedIds,
    isKeyboardMode,
    selectedIndex,
    isWindowPinned,
    editingTagsId,
    tagInput,
    allTags,
    tagColors,
    tabs,
    tabAssignments,
    activeTabId,
    editingTabFlyoutId,
    setEditingTabFlyoutId,
    onToggleItemTab: handleToggleItemInTab,
    onAddNewTabAndAssign: handleAddNewTabAndAssign,
    onDeleteTab: handleDeleteTab,
    selectedItemIds,
    onMultiSelect: handleMultiSelect,
    onItemContentUpdated: handleItemContentUpdated,
    theme,
    language,
    t,
    showSourceAppIcon,
    compactMode,
    richTextSnapshotPreview,
    sensitiveMaskPrefixVisible,
    sensitiveMaskSuffixVisible,
    sensitiveMaskEmailDomain,
    quickPasteHintsById,
    processingAiId,
    aiEnabled,
    aiOptionsOpenId,
    setAiOptionsOpenId,
    copyToClipboard,
    setSelectedIndex,
    setRevealedIds,
    openContent,
    togglePin,
    deleteEntry,
    setEditingTagsId,
    setTagInput,
    handleUpdateTags,
    handleAIAction
  });


  return (
    <div
      className={`app-container ${entranceActive ? "window-entrance" : ""}`}
    >
      <AppHeader
        t={t}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        showTagManager={effectiveShowTagManager}
        setShowTagManager={setShowTagManager}
        tagManagerEnabled={tagManagerEnabled}
        showEmojiPanel={effectiveShowEmojiPanel}
        setShowEmojiPanel={setShowEmojiPanel}
        emojiPanelEnabled={emojiPanelEnabled}
        chatMode={chatMode}
        fileServerEnabled={fileServerEnabled}
        isWindowPinned={isWindowPinned}
        setIsWindowPinned={setIsWindowPinned}
        clearHistory={clearHistory}
        showSearchBox={showSearchBox}
        search={search}
        setSearch={setSearch}
        setIsComposing={setIsComposing}
        searchInputRef={searchInputRef}
        showTagFilter={showTagFilter}
        setShowTagFilter={setShowTagFilter}
        allTags={allTags}
        tagColors={tagColors}
        searchIsFocused={searchIsFocused}
        setSearchIsFocused={setSearchIsFocused}
        setEditingTagsId={setEditingTagsId}
        theme={theme}
        settingsTitle={showSettings && settingsSubpage === "advanced" ? t("advanced_settings") : t("settings")}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        onBack={handleHeaderBack}
        onToggleChat={handleToggleHeaderChat}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onAddTab={handleAddTab}
        onDeleteTab={handleDeleteTab}
        onDropItemOnTab={handleDropItemOnTab}
        onOpenAddEntry={() => {
          setIsAddEntryModalOpen(true);
          setAddEntryContent("");
        }}
      />


      <main
        className={`main-content${chatMode ? " file-transfer-mode" : ""}${effectiveShowTagManager ? " tag-manager-mode" : ""}`}
        style={{ 
          overflow: 'hidden',
          padding: effectiveShowTagManager ? '0' : undefined
        }}
        onWheel={handleMainWheel}
      >
        <AppMainContent
          t={t}
          theme={theme}
          showTagManager={effectiveShowTagManager}
          tagManagerEnabled={tagManagerEnabled}
          showEmojiPanel={effectiveShowEmojiPanel}
          chatMode={chatMode}
          localIp={localIp}
          actualPort={actualPort}
          emojiFavorites={emojiFavorites}
          setEmojiFavorites={setEmojiFavorites}
          emojiPanelTab={emojiPanelTab}
          setEmojiPanelTab={setEmojiPanelTab}
          saveSetting={saveSetting}
          filteredHistory={filteredHistory}
          search={search}
          typeFilter={typeFilter}
          pinnedItems={pinnedItems}
          unpinnedItems={unpinnedItems}
          compactMode={compactMode}
          selectedIndex={selectedIndex}
          isKeyboardMode={isKeyboardMode}
          virtualListRef={virtualListRef}
          handlePinnedReorder={handlePinnedReorder}
          renderItemContent={renderItemContent}
          loadMoreHistory={loadMoreHistory}
          handleListScroll={handleListScroll}
          hasMore={effectiveHasMore}
          isLoadingMore={isLoadingMore}
          language={language}
        />
      </main>

      {/* Floating Batch Action Bar (Pure icons, strictly no button boxes/text, no copy option) */}
      {selectedItemIds.size > 0 && (
        <div className="fluent-batch-bar">
          <span className="fluent-batch-bar-count">
            {selectedItemIds.size}
          </span>
          <div style={{ position: "relative" }}>
            <FluentTooltip text={t("add_to_tab")}>
              <button
                type="button"
                className="fluent-batch-icon-btn"
                onClick={() => setIsBatchTabDropdownOpen((prev) => !prev)}
              >
                <FolderPlus size={15} />
              </button>
            </FluentTooltip>
            {isBatchTabDropdownOpen && (
              <div className="fluent-batch-dropdown">
                {tabs.filter((tab) => !tab.isBuiltin && tab.id !== "clipboard").length === 0 ? (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", padding: "4px 8px" }}>
                    {t("no_custom_tabs")}
                  </div>
                ) : (
                  tabs
                    .filter((tab) => !tab.isBuiltin && tab.id !== "clipboard")
                    .map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className="fluent-batch-dropdown-item"
                        onClick={() => handleBatchAddToTab(tab.id)}
                      >
                        <Folder size={11} />
                        <span>{tab.name}</span>
                      </button>
                    ))
                )}
              </div>
            )}
          </div>
          <FluentTooltip text={t("delete_selected")}>
            <button
              type="button"
              className="fluent-batch-icon-btn danger"
              onClick={handleBatchDelete}
            >
              <Trash2 size={15} />
            </button>
          </FluentTooltip>
          <FluentTooltip text={t("abort") || "取消"}>
            <button
              type="button"
              className="fluent-batch-icon-btn"
              onClick={() => {
                setSelectedItemIds(new Set());
                lastSelectedIndexRef.current = null;
                setIsBatchTabDropdownOpen(false);
              }}
            >
              <X size={15} />
            </button>
          </FluentTooltip>
        </div>
      )}

      {/* Manual Entry Creation Modal */}
      {isAddEntryModalOpen && (
        <div
          className="fluent-modal-overlay"
          onClick={() => setIsAddEntryModalOpen(false)}
        >
          <div
            className="fluent-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fluent-modal-header">
              <span>{t("add_item")}</span>
              <button
                type="button"
                className="btn-icon-ghost"
                onClick={() => setIsAddEntryModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              autoFocus
              className="fluent-modal-textarea"
              placeholder={t("add_entry_placeholder") || "输入要添加的内容..."}
              value={addEntryContent}
              onChange={(e) => setAddEntryContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleConfirmAddEntry();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setIsAddEntryModalOpen(false);
                }
              }}
            />
            <div className="fluent-modal-footer">
              <button
                type="button"
                className="fluent-btn-secondary"
                onClick={() => setIsAddEntryModalOpen(false)}
              >
                {t("cancel") || "取消"}
              </button>
              <button
                type="button"
                className="fluent-btn-primary"
                onClick={handleConfirmAddEntry}
              >
                {t("create_btn") || "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />

      <ConfirmDialog
        open={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        theme={theme}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
        onClose={closeConfirm}
        onConfirm={confirmDialog.onConfirm}
      />

      <UpdateDialog
        isOpen={isUpdateOpen}
        version={updateVersion}
        notes={updateNotes}
        downloadProgress={updateProgress}
        status={updateStatus}
        onUpdate={updateStatus === "ready" ? onApplyUpdate : onStartDownload}
        onClose={closeUpdateDialog}
      />
    </div >
  );
}

export default App;
