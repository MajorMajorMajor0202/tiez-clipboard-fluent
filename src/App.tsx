import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Trash2, FolderPlus, X, Folder } from "lucide-react";
import ToastContainer from "./shared/components/ToastContainer";
import ConfirmDialog from "./shared/components/ConfirmDialog";
import FluentTooltip from "./shared/components/FluentTooltip";
import FluentModal from "./shared/components/FluentModal";
import FluentButton from "./shared/components/FluentButton";

import { translations } from "./locales";
import AppHeader from "./features/app/components/AppHeader";
import AppMainContent from "./features/app/components/AppMainContent";
import FluentRightRail from "./features/app/components/FluentRightRail";
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
import { openDesktopSticker } from "./features/sticker/lib/openSticker";
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

const resolveDropPaths = (payload: unknown): string[] => {
  if (Array.isArray(payload)) {
    return payload.filter((p): p is string => typeof p === "string");
  }
  if (payload && typeof payload === "object" && "paths" in payload) {
    const maybePaths = (payload as { paths?: unknown }).paths;
    if (Array.isArray(maybePaths)) {
      return maybePaths.filter((p): p is string => typeof p === "string");
    }
  }
  return [];
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
    setSequentialModeState,
    isRecording,
    isRecordingSequential,
    isRecordingRich,
    isRecordingSearch,
    isRecordingPinWindow,
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
    setEditingTabFlyoutId,
    doubleClickToPaste,
    setDoubleClickToPaste,
    editingContentId,
    setEditingContentId
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
  const [pastedPulseId, setPastedPulseId] = useState<number | null>(null);

  // Edit Item Modal
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClipboardEntry | null>(null);
  const [editEntryContent, setEditEntryContent] = useState("");

  useEffect(() => {
    (window as any).__tiezSelectedItemIds = selectedItemIds;
  }, [selectedItemIds]);

  useEffect(() => {
    if (selectedItemIds.size > 0 || isAddEntryModalOpen || isEditEntryModalOpen) {
      invoke("set_ignore_blur", { ignore: true }).catch(() => {});
    } else {
      invoke("set_ignore_blur", { ignore: false }).catch(() => {});
    }
  }, [selectedItemIds.size, isAddEntryModalOpen, isEditEntryModalOpen]);

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
        if (isEditEntryModalOpen) {
          setIsEditEntryModalOpen(false);
          setEditingItem(null);
          setEditEntryContent("");
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
      if (isRecording || isRecordingSequential || isRecordingRich || isRecordingSearch || isRecordingPinWindow) return;

      if (pinWindowHotkey && matchesHotkey(event, pinWindowHotkey)) {
        event.preventDefault();
        const nextVal = !isWindowPinned;
        setIsWindowPinned(nextVal);
        invoke("set_window_pinned", { pinned: nextVal }).catch(console.error);
        return;
      }

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
  }, [hotkey, pinWindowHotkey, isRecording, isRecordingSequential, isRecordingRich, isRecordingSearch, isRecordingPinWindow, isWindowPinned, setIsWindowPinned, t]);


  const { toasts, pushToast, confirmDialog, openConfirm, closeConfirm } = useOverlays();

  useSoundEffects({ soundEnabled, pasteSoundEnabled, soundVolume });

  const fetchEffectiveTransferPath = useCallback(() => {
    invoke<string>("get_active_file_transfer_path")
      .then(setFileTransferPath)
      .catch(console.error);
  }, [setFileTransferPath]);

  useAnnouncements();

  const tagManagerSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastCopiedItemIdRef = useRef<number | null>(null);
  const lastCopiedTimestampRef = useRef<number>(0);

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
    setPinWindowHotkey,
    setQuickPasteModifier,
    setQuickTabAssignEnabled,
    setQuickTabAssignSeconds,
    setQuickTabAssignModifier,
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
    setDoubleClickToPaste,
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
      lastCopiedItemIdRef.current = updatedItem.id;
      lastCopiedTimestampRef.current = Date.now();
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
      virtualListRef,
      activeTabId,
      onPastedItem: (id: number) => {
        setPastedPulseId(id);
        setTimeout(() => setPastedPulseId(null), 700);
      }
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
      invoke("save_setting", { key: "app.custom_tabs", value: JSON.stringify(nextTabs) }).catch(console.error);
    } catch (e) {
      console.error("Failed to save tabs", e);
    }
    pushToast(t("tab_created").replace("{name}", trimmed));
  }, [tabs, setTabs, setActiveTabId, t, pushToast]);

  const handleReorderTabs = useCallback((nextTabs: TabItem[]) => {
    setTabs(nextTabs);
    try {
      localStorage.setItem("tiez_custom_tabs", JSON.stringify(nextTabs));
      invoke("save_setting", { key: "app.custom_tabs", value: JSON.stringify(nextTabs) }).catch(console.error);
    } catch (e) {
      console.error("Failed to save tabs", e);
    }
  }, [setTabs]);

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
      invoke("save_setting", { key: "app.custom_tabs", value: JSON.stringify(nextTabs) }).catch(console.error);
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
        invoke("save_setting", { key: "app.custom_tabs", value: JSON.stringify(nextTabs) }).catch(console.error);
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

  const handleDropExternalFilesOnTab = useCallback(async (paths: string[], targetTabIdOrName: string) => {
    if (!paths || paths.length === 0) return;
    const targetTab = tabs.find((t) => t.id === targetTabIdOrName || t.name === targetTabIdOrName) || tabs[0];
    if (!targetTab) return;

    const isBuiltinClipboard = targetTab.id === "clipboard" || targetTab.id === t("clipboard");
    const createdIds: number[] = [];

    for (const filePath of paths) {
      const trimmed = filePath.trim();
      if (!trimmed) continue;

      const ext = trimmed.split(".").pop()?.toLowerCase() || "";
      const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"].includes(ext);
      const isVideo = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm"].includes(ext);
      const contentType = isImage ? "image" : isVideo ? "video" : "file";

      try {
        const newId = await invoke<number>("add_manual_item", {
          content: trimmed,
          contentType,
          tags: []
        });
        if (typeof newId === "number") {
          createdIds.push(newId);
        }
      } catch (err) {
        console.error("Failed to add dropped file item:", err);
      }
    }

    if (createdIds.length > 0) {
      if (!isBuiltinClipboard) {
        setTabAssignments((prev) => {
          const currentList = prev[targetTab.id] || [];
          const toAdd = createdIds.filter((id) => !currentList.includes(id));
          const nextList = [...toAdd, ...currentList];
          const next = { ...prev, [targetTab.id]: nextList };
          saveTabAssignments(next);
          return next;
        });
      }

      fetchHistory(true);

      if (soundEnabled) {
        emit("play-sound", "paste").catch(() => {});
      }

      if (createdIds.length > 1) {
        pushToast(t("batch_added_to_tab") ? t("batch_added_to_tab").replace("{count}", String(createdIds.length)).replace("{name}", targetTab.name) : `已批量添加 ${createdIds.length} 项至「${targetTab.name}」`);
      } else {
        pushToast(t("tab_added") ? t("tab_added").replace("{name}", targetTab.name) : `已加入「${targetTab.name}」`);
      }
    }
  }, [tabs, saveTabAssignments, fetchHistory, soundEnabled, pushToast, t]);

  const handleDropExternalTextOnTab = useCallback(async (text: string, targetTabIdOrName: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const targetTab = tabs.find((t) => t.id === targetTabIdOrName || t.name === targetTabIdOrName) || tabs[0];
    if (!targetTab) return;

    const isBuiltinClipboard = targetTab.id === "clipboard" || targetTab.id === t("clipboard");

    try {
      const newId = await invoke<number>("add_manual_item", {
        content: trimmed,
        contentType: "text",
        tags: []
      });

      if (typeof newId === "number") {
        if (!isBuiltinClipboard) {
          setTabAssignments((prev) => {
            const currentList = prev[targetTab.id] || [];
            if (currentList.includes(newId)) return prev;
            const next = { ...prev, [targetTab.id]: [newId, ...currentList] };
            saveTabAssignments(next);
            return next;
          });
        }

        fetchHistory(true);

        if (soundEnabled) {
          emit("play-sound", "paste").catch(() => {});
        }

        pushToast(t("tab_added") ? t("tab_added").replace("{name}", targetTab.name) : `已加入「${targetTab.name}」`);
      }
    } catch (err) {
      console.error("Failed to add dropped text item:", err);
    }
  }, [tabs, saveTabAssignments, fetchHistory, soundEnabled, pushToast, t]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const lastHandledRef = { sig: "", time: 0 };

    const resolveTargetTab = (pos: { x: number; y: number } | null): TabItem | null => {
      if (pos) {
        let el = document.elementFromPoint(pos.x, pos.y);
        let btn = el?.closest(".fluent-tab-item") as HTMLElement | null;
        if (!btn && window.devicePixelRatio && window.devicePixelRatio !== 1) {
          el = document.elementFromPoint(pos.x / window.devicePixelRatio, pos.y / window.devicePixelRatio);
          btn = el?.closest(".fluent-tab-item") as HTMLElement | null;
        }
        if (btn) {
          const tabId = btn.getAttribute("data-tab-id");
          const found = tabs.find((t) => t.id === tabId);
          if (found) return found;
        }
      }
      return tabs.find((t) => t.id === activeTabId) || tabs[0] || null;
    };

    const handleDropPayload = (payload: unknown) => {
      const paths = resolveDropPaths(payload);
      if (!paths || paths.length === 0) return;

      let pos: { x: number; y: number } | null = null;
      if (payload && typeof payload === "object" && "position" in payload) {
        const rawPos = (payload as { position?: { x: number; y: number } }).position;
        if (rawPos && typeof rawPos.x === "number" && typeof rawPos.y === "number") {
          pos = rawPos;
        }
      }

      const targetTab = resolveTargetTab(pos);
      if (!targetTab) return;

      const sig = `${paths.join("|")}@${targetTab.id}`;
      const now = Date.now();
      if (sig === lastHandledRef.sig && now - lastHandledRef.time < 1500) {
        return;
      }
      lastHandledRef.sig = sig;
      lastHandledRef.time = now;

      handleDropExternalFilesOnTab(paths, targetTab.id);
    };

    const handleTextDropPayload = (payload: unknown) => {
      let text = "";
      let pos: { x: number; y: number } | null = null;
      if (typeof payload === "string") {
        text = payload;
      } else if (payload && typeof payload === "object") {
        if ("text" in payload && typeof (payload as any).text === "string") {
          text = (payload as any).text;
        }
        if ("position" in payload) {
          const rawPos = (payload as any).position;
          if (rawPos && typeof rawPos.x === "number" && typeof rawPos.y === "number") {
            pos = rawPos;
          }
        }
      }
      const trimmed = text.trim();
      if (!trimmed) return;

      const targetTab = resolveTargetTab(pos);
      if (!targetTab) return;

      const sig = `text:${trimmed.slice(0, 50)}@${targetTab.id}`;
      const now = Date.now();
      if (sig === lastHandledRef.sig && now - lastHandledRef.time < 1500) {
        return;
      }
      lastHandledRef.sig = sig;
      lastHandledRef.time = now;

      handleDropExternalTextOnTab(trimmed, targetTab.id);
    };

    const unlistenDrop = appWindow.listen("tauri://drag-drop", (e) => {
      handleDropPayload(e.payload);
    });
    const unlistenFileDrop = appWindow.listen("tauri://file-drop", (e) => {
      handleDropPayload(e.payload);
    });
    const unlistenTextDrop = appWindow.listen("tauri://text-drop", (e) => {
      handleTextDropPayload(e.payload);
    });
    const unlistenDragDropText = appWindow.listen("tauri://drag-drop-text", (e) => {
      handleTextDropPayload(e.payload);
    });

    return () => {
      unlistenDrop.then((f) => f());
      unlistenFileDrop.then((f) => f());
      unlistenTextDrop.then((f) => f());
      unlistenDragDropText.then((f) => f());
    };
  }, [tabs, activeTabId, handleDropExternalFilesOnTab, handleDropExternalTextOnTab]);

  const handleQuickAssignToTab = useCallback((tabIndex: number, specificItemId?: number) => {
    if (!quickTabAssignEnabled) return;
    const customTabs = tabs.filter((t) => !t.isBuiltin && t.id !== "clipboard").slice(0, 10);
    if (tabIndex < 0 || tabIndex >= customTabs.length) {
      return;
    }
    const targetTab = customTabs[tabIndex];
    const targetItemId = specificItemId ?? lastCopiedItemIdRef.current ?? history[0]?.id;
    if (!targetItemId) return;

    setTabAssignments((prev) => {
      const currentList = prev[targetTab.id] || [];
      if (currentList.includes(targetItemId)) {
        pushToast(t("quick_tab_already_in_toast") ? t("quick_tab_already_in_toast").replace("{name}", targetTab.name) : `条目已在「${targetTab.name}」中`);
        return prev;
      }
      const nextList = [...currentList, targetItemId];
      const next = { ...prev, [targetTab.id]: nextList };
      saveTabAssignments(next);
      pushToast(t("quick_tab_assigned_toast") ? t("quick_tab_assigned_toast").replace("{name}", targetTab.name) : `已快速归类至「${targetTab.name}」`);
      if (soundEnabled) {
        emit("play-sound", "paste").catch(() => {});
      }
      return next;
    });
  }, [quickTabAssignEnabled, tabs, history, saveTabAssignments, pushToast, t, soundEnabled]);

  useEffect(() => {
    const unlistenPromise = listen<{ index: number; itemId?: number | null }>("quick-assign-tab", (event) => {
      handleQuickAssignToTab(event.payload.index, event.payload.itemId ?? undefined);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [handleQuickAssignToTab]);

  useEffect(() => {
    if (!quickTabAssignEnabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
        return;
      }
      const elapsed = Date.now() - lastCopiedTimestampRef.current;
      if (elapsed > quickTabAssignSeconds * 1000) return;

      const m = (quickTabAssignModifier || "ctrl+alt").trim().toLowerCase().replace(/\s+/g, "");
      let modMatched = false;
      if (m === "ctrl+alt" || m === "control+alt" || m === "alt+ctrl") {
        modMatched = e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey;
      } else if (m === "alt+shift" || m === "shift+alt") {
        modMatched = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey;
      } else if (m === "ctrl+shift" || m === "control+shift" || m === "shift+ctrl") {
        modMatched = e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
      } else if (m === "win+alt" || m === "alt+win") {
        modMatched = e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey;
      }

      if (!modMatched) return;

      let index: number | null = null;
      if (e.code === "Digit1" || e.code === "Numpad1") index = 0;
      else if (e.code === "Digit2" || e.code === "Numpad2") index = 1;
      else if (e.code === "Digit3" || e.code === "Numpad3") index = 2;
      else if (e.code === "Digit4" || e.code === "Numpad4") index = 3;
      else if (e.code === "Digit5" || e.code === "Numpad5") index = 4;
      else if (e.code === "Digit6" || e.code === "Numpad6") index = 5;
      else if (e.code === "Digit7" || e.code === "Numpad7") index = 6;
      else if (e.code === "Digit8" || e.code === "Numpad8") index = 7;
      else if (e.code === "Digit9" || e.code === "Numpad9") index = 8;
      else if (e.code === "Digit0" || e.code === "Numpad0") index = 9;

      if (index !== null) {
        e.preventDefault();
        e.stopPropagation();
        handleQuickAssignToTab(index);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [quickTabAssignEnabled, quickTabAssignSeconds, quickTabAssignModifier, handleQuickAssignToTab]);

  const handleConfirmAddEntry = useCallback(async () => {
    const trimmed = addEntryContent.trim();
    if (!trimmed) {
      return;
    }
    try {
      const newId = await invoke<number>("add_manual_item", {
        content: trimmed,
        contentType: "text",
        tags: []
      });

      const currentTabId = activeTabId || activeTab?.id || "clipboard";
      if (currentTabId !== "clipboard" && typeof newId === "number") {
        setTabAssignments((prev) => {
          const list = prev[currentTabId] || [];
          const nextList = [newId, ...list.filter((id) => id !== newId)];
          const next = { ...prev, [currentTabId]: nextList };
          saveTabAssignments(next);
          return next;
        });
      }

      if (typeof newId === "number") {
        const optimisticEntry: ClipboardEntry = {
          id: newId,
          content_type: "text",
          content: trimmed,
          source_app: "Manual",
          source_app_path: undefined,
          timestamp: Date.now(),
          preview: trimmed.length > 200 ? trimmed.slice(0, 200) + "..." : trimmed,
          is_pinned: false,
          tags: [],
          use_count: 0,
          is_external: false,
          pinned_order: 0,
          file_preview_exists: true
        };
        setHistory((prev) => [optimisticEntry, ...prev.filter((item) => item.id !== newId)]);
      }

      pushToast(t("entry_added") || "已添加条目");
      setIsAddEntryModalOpen(false);
      setAddEntryContent("");
      setSearch("");
      fetchHistory(true);
    } catch (err) {
      console.error("Failed to add entry:", err);
    }
  }, [addEntryContent, activeTabId, activeTab, saveTabAssignments, pushToast, t, fetchHistory, setHistory, setSearch]);

  const handleStartEditEntry = useCallback((item: ClipboardEntry) => {
    if (item.content_type === "image" || item.content_type === "files") return;
    setEditingItem(item);
    setEditEntryContent(item.content);
    setIsEditEntryModalOpen(true);
  }, []);

  const handleConfirmEditEntry = useCallback(async () => {
    if (!editingItem) return;
    const trimmed = editEntryContent;
    if (trimmed === editingItem.content) {
      setIsEditEntryModalOpen(false);
      setEditingItem(null);
      setEditEntryContent("");
      return;
    }
    try {
      await invoke("update_item_content", { id: editingItem.id, newContent: trimmed });
      handleItemContentUpdated(editingItem.id, trimmed);
      setIsEditEntryModalOpen(false);
      setEditingItem(null);
      setEditEntryContent("");
    } catch (err) {
      console.error("Failed to update item content:", err);
    }
  }, [editingItem, editEntryContent, handleItemContentUpdated]);

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
    doubleClickToPaste,
    editingContentId,
    onStartContentEdit: handleStartEditEntry,
    onSaveContentEdit: (id, newContent) => {
      handleItemContentUpdated(id, newContent);
      setEditingContentId(null);
    },
    onCancelContentEdit: () => setEditingContentId(null),
    pastedPulseId,
    onPinToDesktop: openDesktopSticker,
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

  const selectedItem = useMemo(() => {
    if (selectedIndex >= 0 && selectedIndex < filteredHistory.length) {
      return filteredHistory[selectedIndex];
    }
    return null;
  }, [selectedIndex, filteredHistory]);

  const isSelectedItemLocked = useMemo(() => {
    return !!selectedItem?.tags?.some(tag => tag.toLowerCase() === "locked" || tag === "已锁定");
  }, [selectedItem]);

  const handleOpenSettings = useCallback(async () => {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const existing = await WebviewWindow.getByLabel("settings");
      if (existing) {
        await invoke("hide_window_cmd", { restore_focus: false }).catch(console.error);
        await existing.setAlwaysOnTop(isWindowPinned);
        await existing.show();
        await existing.setFocus();
      } else {
        const currentAccent = document.documentElement.style.getPropertyValue("--accent-color") || "";
        const accentParam = currentAccent ? `&accent=${encodeURIComponent(currentAccent)}` : "";
        const isDark = document.documentElement.classList.contains("dark-mode");
        const themeParam = `&theme=${encodeURIComponent(theme || "retro")}`;
        const colorModeParam = `&color_mode=${isDark ? "dark" : "light"}`;
        const win = new WebviewWindow("settings", {
          url: `index.html?window=settings${accentParam}${themeParam}${colorModeParam}`,
          title: t('settings') || "Settings",
          width: 780,
          height: 560,
          resizable: true,
          decorations: true,
          transparent: true,
          backgroundColor: "#00000000",
          skipTaskbar: false,
          visible: false,
          alwaysOnTop: isWindowPinned,
        });
        win.once("tauri://created", () => {
          invoke("hide_window_cmd", { restore_focus: false })
            .then(() => win.show())
            .then(() => win.setFocus())
            .catch(console.error);
        });
      }
    } catch (err) {
      console.error("Failed to open settings window:", err);
    }
  }, [t, isWindowPinned, theme]);

  const handleRailTogglePin = useCallback((e: React.MouseEvent) => {
    if (!selectedItem) {
      pushToast(t("select_item_first") || "请先在列表中选中一个条目");
      return;
    }
    togglePin(e, selectedItem.id, selectedItem.is_pinned);
  }, [selectedItem, togglePin, pushToast, t]);

  const handleRailToggleLock = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedItem) {
      pushToast(t("select_item_first") || "请先在列表中选中一个条目");
      return;
    }
    const currentTags = selectedItem.tags || [];
    const isCurrentlyLocked = currentTags.some(tg => tg.toLowerCase() === "locked" || tg === "已锁定");
    let nextTags: string[];
    if (isCurrentlyLocked) {
      nextTags = currentTags.filter(tg => tg.toLowerCase() !== "locked" && tg !== "已锁定");
      pushToast("已解除锁定保护");
    } else {
      nextTags = [...currentTags, "已锁定"];
      if (!selectedItem.is_pinned) {
        await invoke("toggle_clipboard_pin", { id: selectedItem.id, isPinned: true }).catch(console.error);
      }
      pushToast("已锁定并保护条目 (防清空/防删除)");
    }
    handleUpdateTags(selectedItem.id, nextTags);
  }, [selectedItem, handleUpdateTags, pushToast, t]);

  const handleRailMoveUp = useCallback(() => {
    if (selectedIndex <= 0 || !filteredHistory.length) return;
    const targetIndex = selectedIndex - 1;
    const currentItem = filteredHistory[selectedIndex];
    const targetItem = filteredHistory[targetIndex];

    if (currentItem.is_pinned && targetItem.is_pinned) {
      const pinnedIds = pinnedItems.map(item => item.id);
      const cIdx = pinnedIds.indexOf(currentItem.id);
      const tIdx = pinnedIds.indexOf(targetItem.id);
      if (cIdx !== -1 && tIdx !== -1) {
        const newOrder = [...pinnedIds];
        [newOrder[cIdx], newOrder[tIdx]] = [newOrder[tIdx], newOrder[cIdx]];
        handlePinnedReorder(newOrder);
      }
    } else {
      setHistory(prev => {
        const next = [...prev];
        const idxA = next.findIndex(item => item.id === currentItem.id);
        const idxB = next.findIndex(item => item.id === targetItem.id);
        if (idxA !== -1 && idxB !== -1) {
          [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
        }
        return next;
      });
    }
    setSelectedIndex(targetIndex);
  }, [selectedIndex, filteredHistory, pinnedItems, handlePinnedReorder, setHistory, setSelectedIndex]);

  const handleRailMoveDown = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= filteredHistory.length - 1) return;
    const targetIndex = selectedIndex + 1;
    const currentItem = filteredHistory[selectedIndex];
    const targetItem = filteredHistory[targetIndex];

    if (currentItem.is_pinned && targetItem.is_pinned) {
      const pinnedIds = pinnedItems.map(item => item.id);
      const cIdx = pinnedIds.indexOf(currentItem.id);
      const tIdx = pinnedIds.indexOf(targetItem.id);
      if (cIdx !== -1 && tIdx !== -1) {
        const newOrder = [...pinnedIds];
        [newOrder[cIdx], newOrder[tIdx]] = [newOrder[tIdx], newOrder[cIdx]];
        handlePinnedReorder(newOrder);
      }
    } else {
      setHistory(prev => {
        const next = [...prev];
        const idxA = next.findIndex(item => item.id === currentItem.id);
        const idxB = next.findIndex(item => item.id === targetItem.id);
        if (idxA !== -1 && idxB !== -1) {
          [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
        }
        return next;
      });
    }
    setSelectedIndex(targetIndex);
  }, [selectedIndex, filteredHistory, pinnedItems, handlePinnedReorder, setHistory, setSelectedIndex]);

  const isSelectedItemSensitive = useMemo(() => {
    if (!selectedItem) return false;
    return (selectedItem.tags || []).some((tg) => {
      const lower = tg.toLowerCase();
      return lower === "sensitive" || lower === "敏感" || lower === "password" || lower === "密码";
    });
  }, [selectedItem]);

  const isSelectedItemTabAssigned = useMemo(() => {
    if (!selectedItem) return false;
    return Object.values(tabAssignments).some((ids) => ids.includes(selectedItem.id));
  }, [selectedItem, tabAssignments]);

  const handleRailCopy = useCallback(() => {
    if (!selectedItem) return;
    copyToClipboard(
      selectedItem.id,
      selectedItem.content,
      selectedItem.content_type,
      false
    );
  }, [selectedItem, copyToClipboard]);

  const handleRailEditContent = useCallback(() => {
    if (!selectedItem) return;
    handleStartEditEntry(selectedItem);
  }, [selectedItem, handleStartEditEntry]);

  const handleRailOpenContent = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedItem) return;
    openContent(selectedItem);
  }, [selectedItem, openContent]);

  const handleRailAssignTab = useCallback(() => {
    if (!selectedItem) return;
    setEditingTabFlyoutId((prev) => (prev === selectedItem.id ? null : selectedItem.id));
    setEditingTagsId(null);
  }, [selectedItem, setEditingTabFlyoutId, setEditingTagsId]);

  const handleRailAssignTag = useCallback(() => {
    if (!selectedItem) return;
    setEditingTagsId((prev) => (prev === selectedItem.id ? null : selectedItem.id));
    setEditingTabFlyoutId(null);
    setTagInput("");
  }, [selectedItem, setEditingTagsId, setEditingTabFlyoutId, setTagInput]);

  const handleRailToggleReveal = useCallback(() => {
    if (!selectedItem) return;
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedItem.id)) {
        next.delete(selectedItem.id);
      } else {
        next.add(selectedItem.id);
      }
      return next;
    });
  }, [selectedItem, setRevealedIds]);

  const handleRailAIAction = useCallback(() => {
    if (!selectedItem) return;
    setAiOptionsOpenId((prev) => (prev === selectedItem.id ? null : selectedItem.id));
  }, [selectedItem, setAiOptionsOpenId]);

  const handleRailDeleteSelectedItem = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedItem) return;
    if (isSelectedItemLocked) {
      pushToast("已锁定的条目受保护，无法删除。请先解锁。");
      return;
    }
    deleteEntry(e || ({ stopPropagation: () => {} } as any), selectedItem.id);
  }, [selectedItem, isSelectedItemLocked, pushToast, deleteEntry]);

  const handleWindowHtml5Drop = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-tiez-item") || (window as any).__tiezDraggedItemId) {
      return;
    }
    if ((e.target as HTMLElement)?.closest(".fluent-tab-item")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const targetTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
    if (!targetTab) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths = Array.from(e.dataTransfer.files)
        .map((f: any) => f.path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (paths.length > 0) {
        handleDropExternalFilesOnTab(paths, targetTab.id);
        return;
      }
    }

    let text = "";
    try {
      text = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    } catch {}
    if (text && text.trim()) {
      handleDropExternalTextOnTab(text.trim(), targetTab.id);
    }
  }, [tabs, activeTabId, handleDropExternalFilesOnTab, handleDropExternalTextOnTab]);

  const shouldShowRightRail = !effectiveShowTagManager && !effectiveShowEmojiPanel && !chatMode && !showSettings;

  return (
    <div
      className={`app-container ${entranceActive ? "window-entrance" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("application/x-tiez-item")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleWindowHtml5Drop}
    >
      <AppHeader
        t={t}
        showSettings={showSettings}
        showTagManager={effectiveShowTagManager}
        tagManagerEnabled={tagManagerEnabled}
        showEmojiPanel={effectiveShowEmojiPanel}
        chatMode={chatMode}
        isWindowPinned={isWindowPinned}
        setIsWindowPinned={setIsWindowPinned}
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
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onAddTab={handleAddTab}
        onDeleteTab={handleDeleteTab}
        onReorderTabs={handleReorderTabs}
        onDropItemOnTab={handleDropItemOnTab}
        onDropExternalFilesOnTab={handleDropExternalFilesOnTab}
        onDropExternalTextOnTab={handleDropExternalTextOnTab}
      />

      <div className="app-body-container">
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

        {shouldShowRightRail && (
          <FluentRightRail
            onOpenAddEntry={() => {
              invoke("activate_window_focus").catch(() => {});
              setIsAddEntryModalOpen(true);
              setAddEntryContent("");
            }}
            clearHistory={clearHistory}
            hasSelectedItem={!!selectedItem}
            canEditContent={selectedItem ? selectedItem.content_type !== "image" && selectedItem.content_type !== "files" : false}
            onCopySelectedItem={handleRailCopy}
            onEditContent={handleRailEditContent}
            isEditingContent={isEditEntryModalOpen}
            onOpenContent={handleRailOpenContent}
            onAssignTab={handleRailAssignTab}
            isTabFlyoutOpen={selectedItem ? editingTabFlyoutId === selectedItem.id : false}
            isTabAssigned={isSelectedItemTabAssigned}
            onAssignTag={handleRailAssignTag}
            isEditingTags={selectedItem ? editingTagsId === selectedItem.id : false}
            hasTags={Boolean(selectedItem?.tags && selectedItem.tags.length > 0)}
            onTogglePin={handleRailTogglePin}
            isPinned={!!selectedItem?.is_pinned}
            onPinToDesktop={() => {
              if (selectedItem) {
                openDesktopSticker(selectedItem);
              } else {
                pushToast(t("select_item_first") || "请先在列表中选中一个条目");
              }
            }}
            onToggleLock={handleRailToggleLock}
            isLocked={isSelectedItemLocked}
            onMoveUp={handleRailMoveUp}
            onMoveDown={handleRailMoveDown}
            onToggleReveal={handleRailToggleReveal}
            isRevealed={selectedItem ? revealedIds.has(selectedItem.id) : false}
            hasSensitiveTag={isSelectedItemSensitive}
            onAIAction={handleRailAIAction}
            isAIOpen={selectedItem ? aiOptionsOpenId === selectedItem.id : false}
            isAIProcessing={selectedItem ? processingAiId === selectedItem.id : false}
            canAI={aiEnabled && !!selectedItem && selectedItem.content_type === "text"}
            onDeleteSelectedItem={handleRailDeleteSelectedItem}
            showTagManager={effectiveShowTagManager}
            setShowTagManager={setShowTagManager}
            tagManagerEnabled={tagManagerEnabled}
            showEmojiPanel={effectiveShowEmojiPanel}
            setShowEmojiPanel={setShowEmojiPanel}
            emojiPanelEnabled={emojiPanelEnabled}
            chatMode={chatMode}
            fileServerEnabled={fileServerEnabled}
            onToggleChat={handleToggleHeaderChat}
            onOpenSettings={handleOpenSettings}
            t={t}
          />
        )}
      </div>

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
      <FluentModal
        open={isAddEntryModalOpen}
        onClose={() => {
          setIsAddEntryModalOpen(false);
          setAddEntryContent("");
        }}
        title={t("add_item") || "添加条目"}
        width={420}
        theme={theme}
        footer={
          <>
            <FluentButton
              variant="secondary"
              onClick={() => {
                setIsAddEntryModalOpen(false);
                setAddEntryContent("");
              }}
            >
              {t("cancel") || "取消"}
            </FluentButton>
            <FluentButton
              variant="primary"
              disabled={!addEntryContent.trim()}
              onClick={handleConfirmAddEntry}
            >
              {t("confirm") || "确定"}
            </FluentButton>
          </>
        }
      >
        <textarea
          className="fluent-modal-textarea"
          value={addEntryContent}
          onChange={(e) => setAddEntryContent(e.target.value)}
          placeholder={t("input_content_placeholder") || "在此处输入条目内容... (Ctrl+Enter 保存)"}
          autoFocus
          onFocus={() => invoke("activate_window_focus").catch(() => {})}
          onMouseDown={() => invoke("activate_window_focus").catch(() => {})}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleConfirmAddEntry();
            }
          }}
        />
      </FluentModal>

      {/* Edit Entry Modal */}
      <FluentModal
        open={isEditEntryModalOpen}
        onClose={() => {
          setIsEditEntryModalOpen(false);
          setEditingItem(null);
          setEditEntryContent("");
        }}
        title={t("edit_content") || "编辑条目"}
        width={420}
        theme={theme}
        footer={
          <>
            <FluentButton
              variant="secondary"
              onClick={() => {
                setIsEditEntryModalOpen(false);
                setEditingItem(null);
                setEditEntryContent("");
              }}
            >
              {t("cancel") || "取消"}
            </FluentButton>
            <FluentButton
              variant="primary"
              disabled={!editEntryContent.trim()}
              onClick={handleConfirmEditEntry}
            >
              {t("save") || "保存"}
            </FluentButton>
          </>
        }
      >
        <textarea
          className="fluent-modal-textarea"
          value={editEntryContent}
          onChange={(e) => setEditEntryContent(e.target.value)}
          placeholder={t("input_content_placeholder") || "在此处输入条目内容... (Ctrl+Enter 保存)"}
          autoFocus
          onFocus={() => invoke("activate_window_focus").catch(() => {})}
          onMouseDown={() => invoke("activate_window_focus").catch(() => {})}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleConfirmEditEntry();
            }
          }}
        />
      </FluentModal>

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
