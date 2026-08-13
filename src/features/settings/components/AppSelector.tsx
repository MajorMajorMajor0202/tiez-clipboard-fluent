import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search } from "lucide-react";
import type { InstalledAppOption } from "../../app/types";

const AppSelector = ({
    type,
    installedApps,
    onSelect,
    t
}: {
    type: string | null;
    installedApps: InstalledAppOption[];
    onSelect: (val: string) => void;
    t: (key: string) => string;
}) => {
    const [recommended, setRecommended] = useState<InstalledAppOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!type) {
            setRecommended([]);
            return;
        }

        const fetchRecommended = async () => {
            setLoading(true);
            try {
                let ext = "";
                let keywords: string[] = [];

                switch (type) {
                    case "image":
                        ext = ".png";
                        keywords = ["photo", "paint", "image", "adobe", "picture", "snip", "viewer", "画图", "照片", "看图"];
                        break;
                    case "text": case "code":
                        ext = ".txt";
                        keywords = ["text", "note", "code", "edit", "write", "office", "word", "记事本", "文档"];
                        break;
                    case "rich_text":
                        ext = ".html";
                        keywords = ["word", "office", "write", "writer", "wps", "browser", "chrome", "edge", "firefox", "document", "html"];
                        break;
                    case "html": case "link": case "url":
                        ext = ".html";
                        keywords = ["browser", "chrome", "edge", "firefox", "web", "internet"];
                        break;
                    case "rtf":
                        ext = ".rtf";
                        keywords = ["word", "office", "write"];
                        break;
                    case "file":
                        ext = ".txt";
                        break;
                    default: ext = "";
                }

                let recApps: InstalledAppOption[] = [];

                if (ext) {
                    try {
                        const rec = await invoke<{ name: string; path: string }[]>("get_associated_apps", { extension: ext });
                        recApps = rec.map((app) => ({ label: app.name, value: app.path }));
                    } catch (e) {
                        // Silent fail
                    }
                }

                const localMatches = installedApps.filter(app => {
                    const lower = app.label.toLowerCase();
                    const isMatch = keywords.some(k => lower.includes(k));
                    const alreadyIn = recApps.some(r => r.value === app.value);
                    return isMatch && !alreadyIn;
                });

                setRecommended([...recApps, ...localMatches]);

            } catch (e) {
                // Silent fail
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchRecommended();
        }, 50);

        return () => clearTimeout(timer);
    }, [type, installedApps]);

    // Filter other apps
    const otherApps = useMemo(() => {
        let others = installedApps.filter(app => !recommended.some(r => r.value === app.value));

        if (type) {
            const n_type = type;
            others = others.filter(app => {
                const name = app.label.toLowerCase();
                if (n_type === 'image') {
                    const block = ["music", "player", "sound", "video", "audio", "code", "terminal", "powershell", "cmd"];
                    if (block.some(k => name.includes(k))) return false;
                }
                else if (n_type === 'audio' || n_type === 'video') {
                    const block = ["photo", "image", "paint", "text", "note", "code", "word", "excel"];
                    if (block.some(k => name.includes(k))) return false;
                }
                return true;
            });
        }
        return others;
    }, [installedApps, recommended, type]);

    // Filter recommended and other apps based on search keyword
    const filteredRecommended = useMemo(() => {
        if (!search.trim()) return recommended;
        return recommended.filter(app =>
            app.label.toLowerCase().includes(search.toLowerCase()) ||
            app.value.toLowerCase().includes(search.toLowerCase())
        );
    }, [recommended, search]);

    const filteredOtherApps = useMemo(() => {
        if (!search.trim()) return otherApps;
        return otherApps.filter(app =>
            app.label.toLowerCase().includes(search.toLowerCase()) ||
            app.value.toLowerCase().includes(search.toLowerCase())
        );
    }, [otherApps, search]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const hasRecommended = filteredRecommended.length > 0;
    const hasOthers = filteredOtherApps.length > 0;

    return (
        <div ref={containerRef} className="app-selector-wrapper">
            <div className={`fluent-search-box app-selector-input-wrapper ${isOpen ? 'dropdown-open' : ''}`}>
                <Search size={14} className="fluent-search-icon search-icon" />
                <input
                    type="text"
                    className="fluent-search-input app-selector-input"
                    placeholder={loading ? t('searching_apps') : t('search_apps_placeholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => {
                        setIsOpen(true);
                        invoke("focus_clipboard_window").catch(console.error);
                    }}
                />
            </div>

            {isOpen && (hasRecommended || hasOthers) && (
                <div className="app-selector-dropdown">
                    {hasRecommended && (
                        <div>
                            <div className="app-selector-group-heading">{t('system_recommended')}</div>
                            {filteredRecommended.map(app => (
                                <button
                                    key={app.value}
                                    className="app-selector-option"
                                    onClick={() => {
                                        onSelect(app.value);
                                        setIsOpen(false);
                                    }}
                                >
                                    {app.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {hasOthers && (
                        <div>
                            <div className="app-selector-group-heading">{t('all_apps')}</div>
                            {filteredOtherApps.map(app => (
                                <button
                                    key={app.value}
                                    className="app-selector-option"
                                    onClick={() => {
                                        onSelect(app.value);
                                        setIsOpen(false);
                                    }}
                                >
                                    {app.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AppSelector;
