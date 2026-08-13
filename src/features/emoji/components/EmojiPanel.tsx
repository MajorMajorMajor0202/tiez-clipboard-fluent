import { useEffect, useMemo, useState, useRef } from "react";
import type { DragEvent } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, X, Pencil, Search } from "lucide-react";
import { motion, LayoutGroup } from "framer-motion";
import { createPortal } from "react-dom";
import FluentTooltip from "../../../shared/components/FluentTooltip";

interface EmojiPanelProps {
  t: (key: string) => string;
  favorites: string[];
  setFavorites: (val: string[] | ((prev: string[]) => string[])) => void;
  activeTab: "emoji" | "favorites";
  setActiveTab: (val: "emoji" | "favorites") => void;
  saveSetting: (key: string, val: string) => void;
  language?: string;
}

type EmojiGroup = { name: string; emojis: string[] };

type EmojiDictEntry = {
  zh: { name: string; keywords: string[] };
  tc: { name: string; keywords: string[] };
  en: { name: string; keywords: string[] };
};

type EmojiData = {
  version?: number;
  groups?: EmojiGroup[];
  dictionary?: Record<string, EmojiDictEntry>;
};

const FALLBACK_GROUPS: EmojiGroup[] = [
  {
    name: "常用",
    emojis: ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅", "😭", "😡", "👍", "👎", "🙏", "👏", "🎉", "🔥", "💯", "✨", "👌", "😴", "🥳", "🤩", "😬", "😇", "🤝", "🙌"]
  },
  {
    name: "表情",
    emojis: ["🙂", "😇", "🙃", "😉", "😌", "🤗", "🤩", "🥳", "😴", "😪", "😤", "😱", "🤯", "😵", "🤐", "🫠", "🫡", "🫣", "😐", "😑", "😶", "🙄", "😮", "😯", "😲", "🥺", "😢", "😥", "😓", "😕"]
  },
  {
    name: "手势",
    emojis: ["👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👊", "✊", "🤚", "🖐️", "✋", "👋", "🫶", "👉", "👈", "👇", "👆", "🫵", "🤝", "🙌", "🤲", "🤜", "🤛", "🫰", "🤌"]
  },
  {
    name: "人物",
    emojis: ["👨‍💻", "👩‍💻", "👨‍🎨", "👩‍🎨", "👨‍🚀", "👩‍🚀", "👨‍🍳", "👩‍🍳", "👨‍⚕️", "👩‍⚕️", "👨‍🏫", "👩‍🏫", "🧑‍💼", "🧑‍🔧", "🧑‍🎧", "🧑‍🚒"]
  },
  {
    name: "动物",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🐺", "🦄"]
  },
  {
    name: "美食",
    emojis: ["🍎", "🍐", "🍊", "🍋", "🍉", "🍇", "🍓", "🍒", "🍍", "🥭", "🍔", "🍟", "🍕", "🌭", "🍣", "🍤", "🍜", "🍲", "🍰", "🍩"]
  },
  {
    name: "活动",
    emojis: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "🏸", "🥊", "🏆", "🎯", "🎮", "🎲", "🎹", "🎸", "🎤", "🎧", "🏃", "🚴", "🧘"]
  },
  {
    name: "旅行",
    emojis: ["🚗", "🚕", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚀", "✈️", "🛫", "🛬", "🚢", "⛵", "🗺️", "🧭", "🏝️", "⛰️", "🌋", "🏜️"]
  },
  {
    name: "物品",
    emojis: ["📱", "💻", "🖥️", "键盘", "🖱️", "📷", "🎥", "📺", "🔦", "💡", "🔋", "🔌", "📦", "📌", "✏️", "📚", "🧰", "🧲", "🧯", "🧪"]
  },
  {
    name: "符号",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❗", "❓", "✅", "❌", "⚠️", "⭕", "💯", "✨", "⭐", "🌟"]
  }
];

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

const normalizePath = (path: string) => path.trim();

const isImagePath = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTS.has(ext);
};

const isImageFile = (file: File) => {
  if (file.type && file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTS.has(ext);
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Invalid file result"));
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });

const parseSrcset = (srcset: string) => {
  const first = srcset.split(",")[0]?.trim() || "";
  if (!first) return "";
  return first.split(/\s+/)[0] || "";
};

const collectImageUrlsFromHtml = (html: string) => {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const urls: string[] = [];
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const srcset = img.getAttribute("srcset") || "";
      if (src) urls.push(src);
      const srcsetUrl = parseSrcset(srcset);
      if (srcsetUrl) urls.push(srcsetUrl);
    });
    doc.querySelectorAll("source").forEach((source) => {
      const src = source.getAttribute("src") || "";
      const srcset = source.getAttribute("srcset") || "";
      if (src) urls.push(src);
      const srcsetUrl = parseSrcset(srcset);
      if (srcsetUrl) urls.push(srcsetUrl);
    });
    doc.querySelectorAll("a[href]").forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (href) urls.push(href);
    });
    return urls;
  } catch {
    return [];
  }
};

const getDropUrls = (dt: DataTransfer | null) => {
  if (!dt) return [];
  const urls: string[] = [];
  const uriList = dt.getData("text/uri-list");
  if (uriList) {
    uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .forEach((line) => urls.push(line));
  }
  const html = dt.getData("text/html");
  if (html) {
    urls.push(...collectImageUrlsFromHtml(html));
  }
  const plain = dt.getData("text/plain");
  if (plain) {
    urls.push(plain.trim());
  }
  return Array.from(
    new Set(
      urls
        .map((u) => u.trim())
        .filter((u) => u.length > 0)
    )
  );
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

const dedupeFavoritePaths = (paths: string[]) =>
  Array.from(
    new Set(
      paths
        .map(normalizePath)
        .filter((path) => path && isImagePath(path))
    )
  );

const getPreloadedEmojis = () => {
  return (window as any).__EMOJI_CACHE__ as EmojiGroup[] | undefined;
};

const SKIN_TONE_SUPPORTED_BASE = new Set(
  [
    // Hands & Gestures
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👊", "✊", "🤚", "🖐️", "✋", "👋", "👉", "👈", "👇", "👆", "🫵", "🤝", "🙌", "🤲", "🤜", "🤛", "🫰", "🤌", "✍️", "💅", "🤳", "💪", "👂", "👃", "🖖", "🤏", "🫱", "🫲", "🫳", "🫴", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "☝️", "🫶",
    // People, Roles, Fantasy, Sports
    "👶", "👦", "👧", "👨", "👩", "🧑", "👱", "👴", "👵", "🧔", "🤵", "👰", "🤰", "🤱", "👼", "🎅", "🤶", "🧙", "🧚", "🧛", "🧜", "🧝", "🧞", "🧟", "🕴️", "🏃", "🚶", "🕺", "💃", "🧘", "🧗", "🏌️", "🏄", "🏊", "🏋️", "🚴", "🚵", "🤸", "🤼", "🤽", "🤾", "🤹",
    "👮", "🕵️", "💂", "👷", "🤴", "👸", "👳", "👲", "🧕", "🦸", "🦹", "💆", "💇", "🏇", "🏂", "🚣", "⛹️", "🛌", "🧖", "🧒", "🧓"
  ].map(emoji => Array.from(emoji)[0])
);

const emojiSupportCache = new Map<string, boolean>();

const isEmojiSupported = (emoji: string): boolean => {
  if (emojiSupportCache.has(emoji)) {
    return emojiSupportCache.get(emoji)!;
  }
  
  if (emoji.length <= 2 && emoji.codePointAt(0)! < 0x1f000) {
    emojiSupportCache.set(emoji, true);
    return true;
  }
  
  if (typeof document === 'undefined') return true;
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      emojiSupportCache.set(emoji, true);
      return true;
    }
    
    ctx.clearRect(0, 0, 16, 16);
    ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textBaseline = 'top';
    
    ctx.fillText('\uFFFF', 0, 0); 
    const tofuData = ctx.getImageData(0, 0, 16, 16).data;
    
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillText(emoji, 0, 0);
    const emojiData = ctx.getImageData(0, 0, 16, 16).data;
    
    const isSameData = (d1: Uint8ClampedArray, d2: Uint8ClampedArray): boolean => {
      for (let i = 0; i < d1.length; i++) {
        if (d1[i] !== d2[i]) return false;
      }
      return true;
    };
    
    const isBlank = (d: Uint8ClampedArray): boolean => {
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] !== 0) return false;
      }
      return true;
    };
    
    const isSupported = !isSameData(emojiData, tofuData) && !isBlank(emojiData);
    emojiSupportCache.set(emoji, isSupported);
    return isSupported;
  } catch (e) {
    emojiSupportCache.set(emoji, true);
    return true;
  }
};

const EmojiItem = ({ emoji }: { emoji: string }) => {
  const supported = isEmojiSupported(emoji);
  if (supported) {
    return <>{emoji}</>;
  }
  
  const hex = Array.from(emoji)
    .map(c => c.codePointAt(0)!)
    .filter(cp => cp !== 0xfe0f)
    .map(cp => cp.toString(16))
    .join('-');
  
  const url = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/" + hex + ".svg";
  
  return (
    <img 
      src={url} 
      alt={emoji} 
      style={{ width: '1em', height: '1em', verticalAlign: 'middle', objectFit: 'contain' }} 
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        img.style.display = 'none';
        const parent = img.parentNode;
        if (parent) {
          const textNode = document.createTextNode(emoji);
          parent.appendChild(textNode);
        }
      }}
    />
  );
};

const SKIN_TONES = [
  { value: "", color: "#FFC83B" },      // Default Yellow
  { value: "🏻", color: "#F9DEC9" },    // Light
  { value: "🏼", color: "#E1B899" },    // Medium-Light
  { value: "🏽", color: "#C09374" },    // Medium
  { value: "🏾", color: "#98684D" },    // Medium-Dark
  { value: "🏿", color: "#5B3C2A" }     // Dark
];

const isSkinToneSupported = (emojiChar: string): boolean => {
  const base = Array.from(emojiChar)[0];
  return SKIN_TONE_SUPPORTED_BASE.has(base);
};

const applySkinTone = (emojiChar: string, toneModifier: string): string => {
  if (!toneModifier) return emojiChar;
  
  const base = Array.from(emojiChar)[0];
  if (SKIN_TONE_SUPPORTED_BASE.has(base)) {
    if (emojiChar.includes("\u200D")) {
      const parts = emojiChar.split("\u200D");
      parts[0] = parts[0].replace(/\uFE0F/g, "") + toneModifier;
      return parts.join("\u200D");
    }
    return emojiChar.replace(/\uFE0F/g, "") + toneModifier;
  }
  return emojiChar;
};

const SkinToneSelector = ({ selected, onChange }: { selected: string; onChange: (val: string) => void }) => (
  <div className="emoji-skin-tone-bar">
    {SKIN_TONES.map((tone) => (
      <button
        key={tone.value}
        style={{ backgroundColor: tone.color }}
        className={`skin-tone-dot ${selected === tone.value ? "active" : ""}`}
        onClick={() => onChange(tone.value)}
        title={
          tone.value === "" ? "默认" :
          tone.value === "🏻" ? "浅肤色" :
          tone.value === "🏼" ? "中浅肤色" :
          tone.value === "🏽" ? "中等肤色" :
          tone.value === "🏾" ? "中深肤色" : "深肤色"
        }
      />
    ))}
  </div>
);

const EmojiPanel = ({ t, favorites, setFavorites, activeTab, setActiveTab, saveSetting, language }: EmojiPanelProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [emojiGroups, setEmojiGroups] = useState<EmojiGroup[]>(() => getPreloadedEmojis() ?? FALLBACK_GROUPS);
  const [emojiDict, setEmojiDict] = useState<Record<string, EmojiDictEntry>>(() => (window as any).__EMOJI_DICT_CACHE__ ?? {});
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [favNames, setFavNames] = useState<Record<string, string>>({});
  const [renameTarget, setRenameTarget] = useState<{ path: string; rect: DOMRect } | null>(null);

  const [selectedSkinTone, setSelectedSkinTone] = useState("");

  // Fetch favorite names on mount
  useEffect(() => {
    invoke<Record<string, string>>("get_settings")
      .then((settings) => {
        if (settings["app.emoji_favorite_names"]) {
          try {
            setFavNames(JSON.parse(settings["app.emoji_favorite_names"]));
          } catch (e) {
            console.error("Failed to parse emoji favorite names", e);
          }
        }
        if (settings["app.emoji_selected_skin_tone"]) {
          setSelectedSkinTone(settings["app.emoji_selected_skin_tone"]);
        }
      })
      .catch(console.error);
  }, []);

  const handleSkinToneChange = (tone: string) => {
    setSelectedSkinTone(tone);
    saveSetting("app.emoji_selected_skin_tone", tone);
  };

  const handleRenameFavorite = (path: string, newName: string) => {
    const updated = { ...favNames, [path]: newName.trim() };
    setFavNames(updated);
    saveSetting("app.emoji_favorite_names", JSON.stringify(updated));
    setRenameTarget(null);
  };

  const currentLang = (language || "zh") as "zh" | "tc" | "en";

  const getEmojiName = (emojiChar: string): string => {
    const entry = emojiDict[emojiChar];
    if (!entry) return emojiChar;
    return entry[currentLang]?.name || entry["zh"]?.name || emojiChar;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationCompleted(true);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const hasFavorites = favorites.length > 0;

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSearchQuery("");
  }, [activeTab]);

  const filteredEmojiGroups = useMemo(() => {
    if (!searchQuery.trim()) return emojiGroups;
    const q = searchQuery.trim().toLowerCase();
    return emojiGroups
      .map((group) => ({
        ...group,
        emojis: group.emojis.filter((emoji) => getEmojiName(emoji).toLowerCase().includes(q)),
      }))
      .filter((group) => group.emojis.length > 0);
  }, [emojiGroups, searchQuery, emojiDict, currentLang]);

  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return favorites;
    const q = searchQuery.trim().toLowerCase();
    return favorites.filter((path) => {
      const name = path.split(/[/\\]/).pop() || path;
      const customName = favNames[path] || name;
      return customName.toLowerCase().includes(q);
    });
  }, [favorites, searchQuery, favNames]);

  const searchResultHasToneSupported = useMemo(() => {
    if (!searchQuery.trim()) return false;
    return filteredEmojiGroups.some((group) =>
      group.emojis.some((emoji) => isSkinToneSupported(emoji))
    );
  }, [filteredEmojiGroups, searchQuery]);

  const persistFavorites = (updater: string[] | ((prev: string[]) => string[])) => {
    setFavorites((prev) => {
      const next = dedupeFavoritePaths(typeof updater === "function" ? updater(prev) : updater);
      saveSetting("app.emoji_favorites", JSON.stringify(next));
      return next;
    });
  };

  const removeFavoritePath = (path: string) => {
    persistFavorites((prev) => prev.filter((p) => p !== path));
    invoke("remove_emoji_favorite", { path }).catch(console.error);
  };

  useEffect(() => {
    if (activeTab !== "favorites") return;

    let cancelled = false;
    invoke<string[]>("list_emoji_favorites")
      .then((diskPaths) => {
        if (cancelled) return;
        const merged = dedupeFavoritePaths([...favorites, ...(Array.isArray(diskPaths) ? diskPaths : [])]);
        const current = dedupeFavoritePaths(favorites);
        if (
          merged.length === current.length &&
          merged.every((path, index) => path === current[index])
        ) {
          return;
        }
        persistFavorites(merged);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [activeTab, favorites]);

  const addFavoritePaths = async (paths: string[]) => {
    const normalized = paths.map(normalizePath).filter((p) => p && isImagePath(p));
    if (normalized.length === 0) return;
    const saved = await Promise.all(
      normalized.map(async (path) => {
        try {
          return await invoke<string>("save_emoji_favorite", { sourcePath: path });
        } catch (e) {
          console.warn("Failed to save emoji favorite:", e);
          return null;
        }
      })
    );
    const valid = saved.filter((p): p is string => typeof p === "string" && p.length > 0);
    if (valid.length === 0) return;
    persistFavorites((prev) => Array.from(new Set([...prev, ...valid])));
  };

  const addFavoriteFiles = async (files: FileList | File[]) => {
    const fileList = files instanceof FileList ? Array.from(files) : files;
    const paths: string[] = [];
    const dataUrlFiles: { dataUrl: string; fileName: string }[] = [];

    for (const file of fileList) {
      if (!isImageFile(file)) continue;
      const filePath = (file as { path?: string }).path;
      if (filePath) {
        paths.push(filePath);
      } else {
        try {
          const dataUrl = await fileToDataUrl(file);
          dataUrlFiles.push({ dataUrl, fileName: file.name });
        } catch (e) {
          console.warn("Failed to read dropped file:", e);
        }
      }
    }

    if (paths.length > 0) {
      await addFavoritePaths(paths);
    }

    if (dataUrlFiles.length > 0) {
      const saved = await Promise.all(
        dataUrlFiles.map(async ({ dataUrl, fileName }) => {
          try {
            return await invoke<string>("save_emoji_favorite_data_url", { dataUrl, fileName });
          } catch (e) {
            console.warn("Failed to save dropped data url:", e);
            return null;
          }
        })
      );
      const valid = saved.filter((p): p is string => typeof p === "string" && p.length > 0);
      if (valid.length > 0) {
        persistFavorites((prev) => Array.from(new Set([...prev, ...valid])));
      }
    }
  };

  const addFavoriteDataUrls = async (dataUrls: string[]) => {
    const normalized = dataUrls.map((url) => url.trim()).filter((url) => url.startsWith("data:"));
    if (normalized.length === 0) return;
    const saved = await Promise.all(
      normalized.map(async (dataUrl) => {
        try {
          return await invoke<string>("save_emoji_favorite_data_url", { dataUrl });
        } catch (e) {
          console.warn("Failed to save dropped data url:", e);
          return null;
        }
      })
    );
    const valid = saved.filter((p): p is string => typeof p === "string" && p.length > 0);
    if (valid.length > 0) {
      persistFavorites((prev) => Array.from(new Set([...prev, ...valid])));
    }
  };

  const addFavoriteUrls = async (urls: string[]) => {
    const normalized = urls
      .map((url) => url.trim())
      .filter((url) => url.startsWith("http://") || url.startsWith("https://"));
    if (normalized.length === 0) return;
    const saved = await Promise.all(
      normalized.map(async (url) => {
        try {
          return await invoke<string>("save_emoji_favorite_url", { url });
        } catch (e) {
          console.warn("Failed to save emoji favorite url:", e);
          return null;
        }
      })
    );
    const valid = saved.filter((p): p is string => typeof p === "string" && p.length > 0);
    if (valid.length > 0) {
      persistFavorites((prev) => Array.from(new Set([...prev, ...valid])));
    }
  };

  const handleSend = async (content: string, contentType: string) => {
    if (contentType === "text") {
      await invoke("paste_text_directly", { content });
      return;
    }

    if (contentType === "image") {
      await invoke("paste_content_transiently", {
        content,
        contentType,
        id: 0,
        pasteWithFormat: false
      });
      return;
    }

    await invoke("copy_to_clipboard", {
      content,
      contentType,
      paste: true,
      id: 0,
      deleteAfterUse: false,
      pasteWithFormat: false
    });
  };

  const handleTabChange = (tab: "emoji" | "favorites") => {
    if (tab !== activeTab) {
      setIsSwitching(true);
      setActiveTab(tab);
      saveSetting("app.emoji_panel_tab", tab);
      setTimeout(() => {
        setIsSwitching(false);
      }, 260);
    }
  };

  const handleSelectFiles = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    void addFavoritePaths(paths);
  };

  const getFilesFromDataTransfer = (dt: DataTransfer | null): File[] => {
    if (!dt) return [];
    if (dt.files && dt.files.length > 0) {
      return Array.from(dt.files);
    }
    const files: File[] = [];
    if (dt.items) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
    }
    return files;
  };

  const handleDomFiles = async (files: File[] | FileList | null | undefined) => {
    if (!files) return;
    const fileList = files instanceof FileList ? Array.from(files) : files;
    if (fileList.length === 0) return;
    await addFavoriteFiles(fileList);
  };

  const handleDomDropDataTransfer = async (dt: DataTransfer | null) => {
    const files = getFilesFromDataTransfer(dt);
    if (files.length > 0) {
      await handleDomFiles(files);
      return;
    }
    const urls = getDropUrls(dt);
    if (urls.length === 0) return;
    const dataUrls = urls.filter((url) => url.startsWith("data:"));
    const httpUrls = urls.filter((url) => url.startsWith("http://") || url.startsWith("https://"));
    if (dataUrls.length > 0) {
      await addFavoriteDataUrls(dataUrls);
    }
    if (httpUrls.length > 0) {
      await addFavoriteUrls(httpUrls);
    }
  };

  const handleDomDrop = async (event: DragEvent<HTMLDivElement>) => {
    await handleDomDropDataTransfer(event.dataTransfer);
  };

  useEffect(() => {
    const cachedDict = (window as any).__EMOJI_DICT_CACHE__;
    if (cachedDict) {
      setEmojiDict(cachedDict);
    }

    if (getPreloadedEmojis() && (window as any).__EMOJI_DICT_CACHE__) return;

    let alive = true;
    fetch("/emoji-data.json")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load emoji data"))))
      .then((data: EmojiData) => {
        if (!alive) return;
        const groups = Array.isArray(data?.groups) ? data.groups.filter((g) => g && Array.isArray(g.emojis)) : [];
        if (groups.length > 0) {
          (window as any).__EMOJI_CACHE__ = groups;
          setEmojiGroups(groups);
        }
        if (data.dictionary) {
          (window as any).__EMOJI_DICT_CACHE__ = data.dictionary;
          setEmojiDict(data.dictionary);
        }
      })
      .catch(() => {
        if (alive) setEmojiGroups(FALLBACK_GROUPS);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!animationCompleted) return;
    const appWindow = getCurrentWindow();

    const unlistenDrop = appWindow.listen("tauri://file-drop", (e) => {
      const paths = resolveDropPaths(e.payload);
      if (paths.length > 0) void addFavoritePaths(paths);
      setIsDragging(false);
    });
    const unlistenHover = appWindow.listen("tauri://file-drop-hover", () => {
      setIsDragging(true);
    });
    const unlistenCancel = appWindow.listen("tauri://file-drop-cancelled", () => {
      setIsDragging(false);
    });
    const unlistenV2Drop = appWindow.listen("tauri://drag-drop", (e) => {
      const paths = resolveDropPaths(e.payload);
      if (paths.length > 0) void addFavoritePaths(paths);
      setIsDragging(false);
    });
    const unlistenV2Enter = appWindow.listen("tauri://drag-enter", () => {
      setIsDragging(true);
    });
    const unlistenV2Leave = appWindow.listen("tauri://drag-leave", () => {
      setIsDragging(false);
    });
    const unlistenNativeEmoji = appWindow.listen("emoji-favorite-drop", (e) => {
      const payload = e.payload as unknown;
      const paths = resolveDropPaths(payload);
      if (paths.length === 0) return;
      const alreadySaved =
        typeof payload === "object" &&
        payload !== null &&
        "alreadySaved" in payload &&
        Boolean((payload as { alreadySaved?: boolean }).alreadySaved);
      if (alreadySaved) {
        persistFavorites((prev) => Array.from(new Set([...prev, ...paths])));
      } else {
        void addFavoritePaths(paths);
      }
      setIsDragging(false);
    });

    return () => {
      unlistenDrop.then((f) => f());
      unlistenHover.then((f) => f());
      unlistenCancel.then((f) => f());
      unlistenV2Drop.then((f) => f());
      unlistenV2Enter.then((f) => f());
      unlistenV2Leave.then((f) => f());
      unlistenNativeEmoji.then((f) => f());
    };
  }, [animationCompleted, favorites]);

  useEffect(() => {
    const handleDragOver = (event: globalThis.DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (event: globalThis.DragEvent) => {
      if (event.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDrop = (event: globalThis.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      void handleDomDropDataTransfer(event.dataTransfer);
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [isDragging]);

  return (
    <div className={`emoji-panel ${isSwitching ? "is-switching" : ""}`}>
      {/* LayoutGroup scopes layoutId so the indicator springs correctly between tabs */}
      <LayoutGroup id="emoji-tabs">
        <div className="emoji-tabs">
          <button
            className={`emoji-tab ${activeTab === "emoji" ? "active" : ""}`}
            onClick={() => handleTabChange("emoji")}
          >
            <span className="emoji-tab-text">{t("emoji_tab") || "Emoji"}</span>
            {activeTab === "emoji" && (
              <>
                <motion.div
                  layoutId="active-bg"
                  className="active-tab-bg"
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                />
                <motion.div
                  layoutId="active-indicator"
                  className="active-tab-indicator"
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                />
              </>
            )}
          </button>
          <button
            className={`emoji-tab ${activeTab === "favorites" ? "active" : ""}`}
            onClick={() => handleTabChange("favorites")}
          >
            <span className="emoji-tab-text">{t("emoji_favorites") || "收藏"}</span>
            {activeTab === "favorites" && (
              <>
                <motion.div
                  layoutId="active-bg"
                  className="active-tab-bg"
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                />
                <motion.div
                  layoutId="active-indicator"
                  className="active-tab-indicator"
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                />
              </>
            )}
          </button>
        </div>
      </LayoutGroup>

      <div className="emoji-search-container">
        <div className="fluent-search-box emoji-search-wrapper">
          <Search size={14} className="fluent-search-icon emoji-search-icon" />
          <input
            type="text"
            className="fluent-search-input emoji-search-input"
            placeholder={t("search") || "搜索..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            onMouseDown={() => {
              invoke("activate_window_focus").catch(console.error);
            }}
          />
        </div>
        {searchResultHasToneSupported && (
          <SkinToneSelector selected={selectedSkinTone} onChange={handleSkinToneChange} />
        )}
      </div>

      {/* Sliding track — both panels always in DOM, shifted with translateX */}
      <div className="emoji-content-wrapper">
        {animationCompleted && (
          <div className={`emoji-panels-track${activeTab === "favorites" ? " show-favorites" : ""}`}>
            
            {/* Panel 0 — Emoji grid */}
            <div className="emoji-content">
              {filteredEmojiGroups.map((group) => (
                <div key={group.name} className="emoji-group">
                  <div className="emoji-group-title">{group.name}</div>
                  {!searchQuery && (group.name === "人物" || group.name === "手势") && (
                    <SkinToneSelector selected={selectedSkinTone} onChange={handleSkinToneChange} />
                  )}
                  <div className="emoji-grid">
                    {group.emojis.map((emoji) => {
                      const finalEmoji = applySkinTone(emoji, selectedSkinTone);
                      return (
                        <FluentTooltip key={`${group.name}-${emoji}`} text={getEmojiName(emoji)}>
                          <button
                            className="emoji-btn"
                            onClick={() => handleSend(finalEmoji, "text")}
                          >
                            <EmojiItem emoji={finalEmoji} />
                          </button>
                        </FluentTooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredEmojiGroups.length === 0 && (
                <div className="emoji-empty">{t("emoji_empty") || "暂无表情"}</div>
              )}
            </div>

            {/* Panel 1 — Favorites */}
            <div
              className="emoji-fav-container"
              onClick={() => setDeleteTarget(null)}
              onContextMenu={(e) => {
                if ((e.target as HTMLElement).closest(".emoji-fav-card")) return;
                setDeleteTarget(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isDragging) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleDomDrop(e);
              }}
            >
              <div className="emoji-fav-grid">
                {filteredFavorites.map((path) => {
                  const name = path.split(/[/\\]/).pop() || path;
                  const isDeleteVisible = deleteTarget === path;
                  return (
                    <motion.div
                      key={path}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0 }}
                      className="emoji-fav-card"
                      data-delete-visible={isDeleteVisible}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTarget(path);
                      }}
                    >
                      <FluentTooltip text={t("delete") || "删除"}>
                        <button
                          className="emoji-fav-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavoritePath(path);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </FluentTooltip>
                      <FluentTooltip text={t("rename") || "重命名"}>
                        <button
                          className="emoji-fav-rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.closest(".emoji-fav-card")?.getBoundingClientRect();
                            if (rect) {
                              setRenameTarget({ path, rect });
                            }
                          }}
                        >
                          <Pencil size={11} />
                        </button>
                      </FluentTooltip>
                      <FluentTooltip text={favNames[path] || name}>
                        <button
                          className="emoji-fav-preview"
                          onClick={() => handleSend(path, "image")}
                        >
                          <img
                            src={convertFileSrc(path)}
                            alt={name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              removeFavoritePath(path);
                            }}
                          />
                        </button>
                      </FluentTooltip>
                    </motion.div>
                  );
                })}

                {!searchQuery && (
                  <div className="emoji-fav-card emoji-fav-add">
                    <FluentTooltip text={t("emoji_add_files") || "添加表情"}>
                      <button
                        className="emoji-fav-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleSelectFiles();
                        }}
                      >
                        <div className="add-icon-wrapper">
                          <Plus size={22} strokeWidth={2.5} />
                        </div>
                      </button>
                    </FluentTooltip>
                  </div>
                )}
              </div>

              {filteredFavorites.length === 0 && (
                <div className="emoji-fav-empty">
                  <span>
                    {searchQuery
                      ? (t("no_records") || "无匹配记录")
                      : (t("emoji_fav_hint") || "点击添加按钮、或拖拽图片到这里")}
                  </span>
                </div>
              )}
              {hasFavorites && !searchQuery && (
                <div className="emoji-fav-tip">{t("emoji_fav_tip") || "可直接拖拽图片添加"}</div>
              )}

              {isDragging && (
                <div className="drop-overlay">
                  <p>{t("emoji_drop_hint") || "松开鼠标即可添加"}</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
      {renameTarget && (
        <EmojiFavRenameFlyout
          initialValue={favNames[renameTarget.path] || renameTarget.path.split(/[/\\]/).pop() || renameTarget.path}
          targetRect={renameTarget.rect}
          onConfirm={(val) => handleRenameFavorite(renameTarget.path, val)}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </div>
  );
};

interface RenameFlyoutProps {
  initialValue: string;
  targetRect: DOMRect;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}

const EmojiFavRenameFlyout = ({ initialValue, targetRect, onConfirm, onCancel }: RenameFlyoutProps) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const isRenameBtn = (e.target as HTMLElement).closest(".emoji-fav-rename");
        if (!isRenameBtn) {
          onCancel();
        }
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

  const top = targetRect.bottom + window.scrollY + 8;
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 800;
  const preferredLeft = targetRect.left + targetRect.width / 2 - 96; // 96 is half of 192
  const flyoutLeft = Math.max(8, Math.min(preferredLeft, windowWidth - 8 - 192));

  return createPortal(
    <div
      ref={containerRef}
      className="emoji-fav-rename-flyout"
      style={{
        position: "absolute",
        top: `${top}px`,
        left: `${flyoutLeft}px`,
        zIndex: 100000,
      }}
    >
      <form onSubmit={handleSubmit} className="rename-flyout-search-wrapper">
        <Pencil size={12} className="rename-flyout-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="rename-flyout-search-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="重命名表情..."
        />
      </form>
    </div>,
    document.body
  );
};

export default EmojiPanel;
