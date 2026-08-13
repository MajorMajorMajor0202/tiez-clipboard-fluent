import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import {
    Edit2, Trash2, X, ChevronRight, LayoutGrid, List,
    Clock, MousePointer2, ChevronLeft, Plus, Search, ExternalLink, CheckSquare, Copy,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { getTagColor } from "../../../shared/lib/utils";
import FluentTooltip from "../../../shared/components/FluentTooltip";
import FluentScrollbar from "../../../shared/components/FluentScrollbar";
import type { ClipboardEntry } from "../../../shared/types";

interface TagManagerProps {
    t: (key: string) => string;
    theme: string;
}

interface TagInfo {
    name: string;
    count: number;
}

export default function TagManager({ t, theme }: TagManagerProps) {
    const isBuiltinSensitiveTag = (tag: string) => {
        const l = tag.toLowerCase();
        return l === 'sensitive' || l === '敏感' || l === 'password' || l === '密码' || l === '密碼';
    };

    const TAG_MANAGER_VIEW_MODE_KEY = "tiez_tag_manager_view_mode";
    const [tags, setTags] = useState<TagInfo[]>([]);
    const [tagSearch, setTagSearch] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [tagItems, setTagItems] = useState<ClipboardEntry[]>([]);
    const [tagColors, setTagColors] = useState<Record<string, string>>({});
    const [itemsAreaEl, setItemsAreaEl] = useState<HTMLDivElement | null>(null);
    const itemsAreaRef = useCallback((el: HTMLDivElement | null) => {
        setItemsAreaEl(el);
    }, []);
    const [editingTag, setEditingTag] = useState<string | null>(null);
    const [newTagName, setNewTagName] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        try {
            const saved = window.localStorage.getItem(TAG_MANAGER_VIEW_MODE_KEY);
            return saved === 'list' ? 'list' : 'grid';
        } catch {
            return 'grid';
        }
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean, tagName: string | null }>({ show: false, tagName: null });
    const [itemDeleteConfirmation, setItemDeleteConfirmation] = useState<{ show: boolean, id: number | null }>({ show: false, id: null });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [sortBy, setSortBy] = useState<'time' | 'count'>('time');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: number, content: string } | null>(null);
    const [newItemContent, setNewItemContent] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(128);
    const [sidebarHeight, setSidebarHeight] = useState(180);
    const [isResizing, setIsResizing] = useState(false);
    const [isStacked, setIsStacked] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [suggestSearch, setSuggestSearch] = useState('');
    const [isManageMode, setIsManageMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const effectiveIsCollapsed = isStacked ? true : isCollapsed;

    const selectedTagRef = useRef<string | null>(null);
    useEffect(() => { selectedTagRef.current = selectedTag; }, [selectedTag]);

    useEffect(() => {
        try {
            window.localStorage.setItem(TAG_MANAGER_VIEW_MODE_KEY, viewMode);
        } catch {
            // Ignore storage write failures and keep UI functional.
        }
    }, [viewMode]);

    useEffect(() => {
        let unlisteners: (() => void)[] = [];
        const setupListeners = async () => {
            const handleUpdate = () => {
                // Don't refresh if we're in the middle of a delete operation
                if (isDeleting) return;
                fetchTags();
                if (selectedTagRef.current) loadTagItems(selectedTagRef.current);
            };
            unlisteners.push(await listen('clipboard-changed', handleUpdate));
            unlisteners.push(await listen('clipboard-updated', handleUpdate));
            unlisteners.push(await listen('clipboard-removed', handleUpdate));
        };
        setupListeners();
        return () => unlisteners.forEach(f => f());
    }, [isDeleting]);

    useEffect(() => { fetchTags(); }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 480px)");
        const updateLayoutMode = () => {
            const matches = mediaQuery.matches;
            setIsStacked(matches);
            if (matches) {
                setIsCollapsed(true);
            }
        };

        updateLayoutMode();
        mediaQuery.addEventListener("change", updateLayoutMode);

        return () => mediaQuery.removeEventListener("change", updateLayoutMode);
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (event: MouseEvent) => {
            const container = containerRef.current;
            if (!container) return;
            const bounds = container.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(container);
            const isVertical = computedStyle.flexDirection === 'column';

            if (isVertical) {
                const maxHeight = Math.max(140, bounds.height - 180);
                const nextHeight = Math.min(Math.max(event.clientY - bounds.top, 120), maxHeight);
                setSidebarHeight(nextHeight);
                return;
            }

            const dragPos = event.clientX - bounds.left;
            
            // Auto collapse threshold: 108px
            if (dragPos < 108) {
                if (!isCollapsed) setIsCollapsed(true);
                setSidebarWidth(48);
            } else {
                if (isCollapsed) setIsCollapsed(false);
                const nextWidth = Math.min(dragPos, 320);
                setSidebarWidth(nextWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        const container = containerRef.current;
        const isVertical = container && window.getComputedStyle(container).flexDirection === 'column';
        document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isResizing, effectiveIsCollapsed]);

    const fetchTags = async () => {
        try {
            const [tagMap, colors] = await Promise.all([
                invoke<Record<string, number>>('get_all_tags_info'),
                invoke<Record<string, string>>('get_tag_colors')
            ]);

            const tagArray = Object.entries(tagMap).map(([name, count]) => ({ name, count }));
            tagArray.sort((a, b) => b.count - a.count);
            setTags(tagArray);
            setTagColors(colors || {});

            const activeTag = selectedTagRef.current;
            if (tagArray.length === 0) {
                setSelectedTag(null);
                setTagItems([]);
                return;
            }
            if (!activeTag || !tagArray.some(tag => tag.name === activeTag)) {
                loadTagItems(tagArray[0].name);
            }
        } catch (err) { console.error(err); }
    };

    const loadTagItems = async (tagName: string) => {
        setLoading(true);
        setSelectedTag(tagName);
        try {
            const items = await invoke<ClipboardEntry[]>('get_tag_items', { tag: tagName });
            setTagItems(items || []);
        } catch (err) { console.error(err); setTagItems([]); }
        finally { setLoading(false); }
    };

    const createTag = async (rawName: string) => {
        const rawTrimmed = rawName.trim();
        if (!rawTrimmed) return;

        const lower = rawTrimmed.toLowerCase();
        let trimmed = rawTrimmed;
        if (lower === "敏感" || lower === "sensitive") {
            trimmed = "sensitive";
        } else if (lower === "密码" || lower === "密碼" || lower === "password") {
            trimmed = "password";
        }

        try {
            await invoke('create_new_tag', { tagName: trimmed });
            setNewTagName('');
            setTagSearch('');
            await fetchTags();
            await loadTagItems(trimmed);
        } catch (err) { console.error(err); }
    };

    const handleRenameTag = async (oldName: string) => {
        const trimmed = newTagName.trim();
        if (!trimmed || trimmed === oldName) { setEditingTag(null); return; }

        if (isBuiltinSensitiveTag(oldName)) {
            setEditingTag(null);
            return;
        }

        try {
            await invoke('rename_tag_globally', { oldName, newName: trimmed });
            if (selectedTag === oldName) setSelectedTag(trimmed);
            await fetchTags();
            await loadTagItems(trimmed);
            setEditingTag(null);
            setNewTagName('');
        } catch (err) { console.error(err); }
    };

    const handleDeleteTag = async (tagName: string) => {
        if (isBuiltinSensitiveTag(tagName)) return;
        setIsDeleting(true);
        try {
            await invoke('delete_tag_from_all', { tagName });
            await emit('clipboard-changed'); // Notify App.tsx to refresh
            await fetchTags();
        } catch (err) { console.error(err); }
        finally {
            setIsDeleting(false);
        }
    };

    const handleAddManualItem = async () => {
        if (!newItemContent.trim() || !selectedTag) return;
        try {
            await invoke('add_manual_item', {
                content: newItemContent,
                contentType: 'text',
                tags: [selectedTag]
            });
            setNewItemContent('');
            setIsCreatingItem(false);
            await loadTagItems(selectedTag);
        } catch (err) { console.error(err); }
    };

    const handleUpdateItemContent = async () => {
        if (!editingItem || !editingItem.content.trim()) return;
        try {
            await invoke('update_item_content', {
                id: editingItem.id,
                newContent: editingItem.content
            });
            setEditingItem(null);
            if (selectedTag) await loadTagItems(selectedTag);
        } catch (err) { console.error(err); }
    };

    const copyToClipboard = async (id: number, content: string, type: string) => {
        try {
            await invoke('copy_to_clipboard', { content, contentType: type, paste: true, id, deleteAfterUse: false });
        } catch (err) { console.error(err); }
    };

    const filteredTags = useMemo(() => {
        return tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [tags, tagSearch]);

    const filteredSuggestTags = useMemo(() => {
        return tags.filter(t => t.name.toLowerCase().includes(suggestSearch.toLowerCase()));
    }, [tags, suggestSearch]);

    const currentMainTags = isStacked ? tags : filteredTags;
    const selectedIndex = currentMainTags.findIndex(tag => tag.name === selectedTag);


    const normalizedSuggestSearch = suggestSearch.trim().toLowerCase();
    const canCreateSuggestTag = normalizedSuggestSearch.length > 0
        && !tags.some(tag => tag.name.toLowerCase() === normalizedSuggestSearch);

    const sortedItems = [...tagItems].sort((a, b) => {
        if (sortBy === 'count') return (b.use_count || 0) - (a.use_count || 0);
        return b.timestamp - a.timestamp;
    });

    const formatItemDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    return (
        <div
            ref={containerRef}
            className={`themed-tag-manager theme-${theme} ${effectiveIsCollapsed ? 'sidebar-collapsed' : ''} ${isStacked ? 'stacked-layout' : ''}`}
            style={{ 
                ["--tm-sidebar-width" as any]: effectiveIsCollapsed ? '50px' : `${sidebarWidth}px`,
                ["--tm-sidebar-height" as any]: `${sidebarHeight}px`
            } as any}
            onMouseDown={() => invoke('activate_window_focus').catch(console.error)}
        >
            <div className="tag-sidebar">
                {(!effectiveIsCollapsed || isStacked) && (
                    <div className={`tag-search-box ${isStacked && effectiveIsCollapsed && isSearchFocused ? 'suggestions-open' : ''}`}>
                        <div className="search-input-wrapper">
                            <Search size={12} className="search-icon-placeholder" />
                            <input
                                placeholder={t('find_or_create')}
                                value={isStacked && effectiveIsCollapsed ? suggestSearch : tagSearch}
                                onMouseDown={() => invoke('activate_window_focus').catch(console.error)}
                                onFocus={() => {
                                    invoke('activate_window_focus').catch(console.error);
                                    setIsSearchFocused(true);
                                }}
                                onBlur={() => {
                                    setTimeout(() => setIsSearchFocused(false), 200);
                                }}
                                onChange={e => {
                                    if (isStacked && effectiveIsCollapsed) {
                                        setSuggestSearch(e.target.value);
                                    } else {
                                        setTagSearch(e.target.value);
                                    }
                                }}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        const currentVal = isStacked && effectiveIsCollapsed ? suggestSearch : tagSearch;
                                        const currentValTrim = currentVal.trim();
                                        if (currentValTrim) {
                                            const exactMatch = tags.find(t => t.name.toLowerCase() === currentValTrim.toLowerCase());
                                            if (exactMatch) {
                                                loadTagItems(exactMatch.name);
                                            } else {
                                                await createTag(currentVal);
                                            }
                                        }
                                    }
                                }}
                            />
                            {(isStacked && effectiveIsCollapsed ? suggestSearch : tagSearch) ? (
                                <div className="action-icons">
                                    <X size={12} className="action-icon clear" onClick={() => {
                                        if (isStacked && effectiveIsCollapsed) {
                                            setSuggestSearch('');
                                        } else {
                                            setTagSearch('');
                                        }
                                    }} />
                                </div>
                            ) : null}
                        </div>
                        {isStacked && effectiveIsCollapsed && isSearchFocused && (
                            <div className="tag-suggestions-dropdown custom-scrollbar" onMouseDown={e => e.preventDefault()}>
                                {filteredSuggestTags.map(tag => (
                                    <div
                                        key={tag.name}
                                        className={`tag-item ${selectedTag === tag.name ? 'active' : ''} ${!isBuiltinSensitiveTag(tag.name) ? 'has-actions' : ''}`}
                                        onClick={() => {
                                            loadTagItems(tag.name);
                                            setIsSearchFocused(false);
                                        }}
                                    >
                                        <div className="tag-color-wrapper">
                                            <svg
                                                className="tag-color-dot tag-color-icon"
                                                style={{ color: tagColors[tag.name] || getTagColor(tag.name, theme) }}
                                                onContextMenu={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    document.getElementById(`color-picker-suggest-${tag.name}`)?.click();
                                                }}
                                                viewBox="0 0 20 20"
                                            >
                                                <path fill="currentColor" d="M18.007 4.033a2 2 0 0 0-1.987-1.997l-4.89-.032a2 2 0 0 0-1.426.584L3.022 9.252a2 2 0 0 0-.002 2.83l4.949 4.95a2 2 0 0 0 2.828 0l6.631-6.63a2 2 0 0 0 .586-1.417zM14 7a1 1 0 1 1 0-2a1 1 0 0 1 0 2" />
                                            </svg>
                                            <input
                                                type="color"
                                                id={`color-picker-suggest-${tag.name}`}
                                                style={{ display: 'none' }}
                                                value={tagColors[tag.name] || '#888888'}
                                                onChange={async (e) => {
                                                    const newColor = e.target.value;
                                                    setTagColors(prev => ({ ...prev, [tag.name]: newColor }));
                                                    await invoke('set_tag_color', { name: tag.name, color: newColor });
                                                    await emit('tag-colors-updated');
                                                }}
                                            />
                                        </div>
                                        {editingTag === tag.name ? (
                                            <input
                                                className="inline-tag-edit"
                                                value={newTagName}
                                                onMouseDown={() => invoke('activate_window_focus').catch(console.error)}
                                                onFocus={() => invoke('activate_window_focus').catch(console.error)}
                                                onChange={(e) => setNewTagName(e.target.value)}
                                                autoFocus
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        await handleRenameTag(tag.name);
                                                    } else if (e.key === 'Escape') {
                                                        setEditingTag(null);
                                                    }
                                                }}
                                                onBlur={() => setEditingTag(null)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="tag-name-area">
                                                <span className="tag-name">
                                                    {tag.name.toLowerCase() === "sensitive"
                                                        ? t("tag_builtin_sensitive")
                                                        : (tag.name.toLowerCase() === "password" || tag.name === "密码" || tag.name === "密碼")
                                                        ? t("tag_builtin_password")
                                                        : tag.name}
                                                </span>
                                                {!isBuiltinSensitiveTag(tag.name) && (
                                                    <div className="tag-hover-actions">
                                                        <FluentTooltip text={t('rename') || '重命名'}>
                                                            <span
                                                                style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingTag(tag.name);
                                                                    setNewTagName(tag.name);
                                                                }}
                                                            >
                                                                <Edit2 size={13} />
                                                            </span>
                                                        </FluentTooltip>
                                                        <FluentTooltip text={t('delete') || '删除'}>
                                                            <span
                                                                style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    setDeleteConfirmation({ show: true, tagName: tag.name });
                                                                }}
                                                            >
                                                                <Trash2 size={13} />
                                                            </span>
                                                        </FluentTooltip>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {filteredSuggestTags.length === 0 && !suggestSearch.trim() && (
                                    <div className="sidebar-status">{t('no_tags')}</div>
                                )}
                                {canCreateSuggestTag && filteredSuggestTags.length === 0 && (
                                    <div className="tag-item create-hint" onClick={() => createTag(suggestSearch)}>
                                        <svg
                                            className="tag-color-dot tag-color-icon create-hint-icon"
                                            style={{ color: 'currentColor', opacity: 0.6 }}
                                            viewBox="0 0 20 20"
                                        >
                                            <path fill="currentColor" d="M14 7a1 1 0 1 0 0-2a1 1 0 0 0 0 2m-2.87-5a2 2 0 0 0-1.426.584L3.022 9.249a2 2 0 0 0-.002 2.83l4.949 4.948a2 2 0 0 0 2.828 0l6.631-6.63a2 2 0 0 0 .586-1.418l-.008-4.95a2 2 0 0 0-1.986-1.997zm-.72 1.292A1 1 0 0 1 11.123 3l4.89.032a1 1 0 0 1 .993.999l.008 4.95a1 1 0 0 1-.293.708l-6.63 6.631a1 1 0 0 1-1.415 0l-4.949-4.948a1 1 0 0 1 .001-1.415z" />
                                        </svg>
                                        <span className="tag-name" style={{ opacity: 0.7 }}>{t('create_tag_hint').replace('{tag}', suggestSearch.trim())}</span>
                                        <Plus size={10} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="tag-scroll custom-scrollbar">
                    {selectedIndex !== -1 && (
                        <div
                            className="tag-selection-indicator"
                            style={{
                                transform: isStacked && effectiveIsCollapsed
                                    ? `translateX(${selectedIndex * 36}px)`
                                    : `translateY(${16 + selectedIndex * 36}px)`,
                            }}
                        >
                            <div key={selectedTag} className="tag-selection-indicator-inner" />
                        </div>
                    )}
                    {currentMainTags.map(tag => {
                        const tagItemContent = (
                            <div
                                className={`tag-item ${selectedTag === tag.name ? 'active' : ''} ${!isBuiltinSensitiveTag(tag.name) ? 'has-actions' : ''}`}
                                onClick={() => loadTagItems(tag.name)}
                            >
                                <div className="tag-color-wrapper">
                                    <svg
                                        className="tag-color-dot tag-color-icon"
                                        style={{ color: tagColors[tag.name] || getTagColor(tag.name, theme) }}
                                        onContextMenu={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            document.getElementById(`color-picker-${tag.name}`)?.click();
                                        }}
                                        viewBox="0 0 20 20"
                                    >
                                        <path fill="currentColor" d="M18.007 4.033a2 2 0 0 0-1.987-1.997l-4.89-.032a2 2 0 0 0-1.426.584L3.022 9.252a2 2 0 0 0-.002 2.83l4.949 4.95a2 2 0 0 0 2.828 0l6.631-6.63a2 2 0 0 0 .586-1.417zM14 7a1 1 0 1 1 0-2a1 1 0 0 1 0 2" />
                                    </svg>
                                    <input
                                        type="color"
                                        id={`color-picker-${tag.name}`}
                                        style={{ display: 'none' }}
                                        value={tagColors[tag.name] || '#888888'}
                                        onChange={async (e) => {
                                            const newColor = e.target.value;
                                            setTagColors(prev => ({ ...prev, [tag.name]: newColor }));
                                            await invoke('set_tag_color', { name: tag.name, color: newColor });
                                            await emit('tag-colors-updated');
                                        }}
                                    />
                                </div>
                                {!effectiveIsCollapsed && (
                                    editingTag === tag.name ? (
                                        <input
                                            className="inline-tag-edit"
                                            value={newTagName}
                                            onMouseDown={() => invoke('activate_window_focus').catch(console.error)}
                                            onFocus={() => invoke('activate_window_focus').catch(console.error)}
                                            onChange={(e) => setNewTagName(e.target.value)}
                                            autoFocus
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                    await handleRenameTag(tag.name);
                                                } else if (e.key === 'Escape') {
                                                    setEditingTag(null);
                                                }
                                            }}
                                            onBlur={() => setEditingTag(null)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <div className="tag-name-area">
                                            <span className="tag-name">
                                                {tag.name.toLowerCase() === "sensitive"
                                                    ? t("tag_builtin_sensitive")
                                                    : (tag.name.toLowerCase() === "password" || tag.name === "密码" || tag.name === "密碼")
                                                    ? t("tag_builtin_password")
                                                    : tag.name}
                                            </span>
                                            {!isBuiltinSensitiveTag(tag.name) && (
                                                <div className="tag-hover-actions">
                                                    <FluentTooltip text={t('rename') || '重命名'}>
                                                        <span
                                                            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingTag(tag.name);
                                                                setNewTagName(tag.name);
                                                            }}
                                                        >
                                                            <Edit2 size={13} />
                                                        </span>
                                                    </FluentTooltip>
                                                    <FluentTooltip text={t('delete') || '删除'}>
                                                        <span
                                                            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                setDeleteConfirmation({ show: true, tagName: tag.name });
                                                            }}
                                                        >
                                                            <Trash2 size={13} />
                                                        </span>
                                                    </FluentTooltip>
                                                </div>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        );

                        return effectiveIsCollapsed ? (
                            <FluentTooltip
                                key={tag.name}
                                text={tag.name.toLowerCase() === "sensitive"
                                    ? t("tag_builtin_sensitive")
                                    : (tag.name.toLowerCase() === "password" || tag.name === "密码" || tag.name === "密碼")
                                    ? t("tag_builtin_password")
                                    : tag.name}
                            >
                                {tagItemContent}
                            </FluentTooltip>
                        ) : (
                            <span key={tag.name} style={{ display: 'contents' }}>
                                {tagItemContent}
                            </span>
                        );
                    })}
                    {currentMainTags.length === 0 && (
                        <div className="sidebar-status">{t('no_tags')}</div>
                    )}
                </div>

                {!isStacked && (
                    <div className="sidebar-header">
                        <FluentTooltip text={effectiveIsCollapsed ? (t('open') || '展开') : (t('collapse') || '收起')}>
                            <button
                                className="collapse-toggle"
                                onClick={() => {
                                    const newCollapsed = !effectiveIsCollapsed;
                                    setIsCollapsed(newCollapsed);
                                    if (!newCollapsed && sidebarWidth < 108) {
                                        setSidebarWidth(160);
                                    }
                                }}
                            >
                                {isStacked ? (
                                    effectiveIsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                                ) : (
                                    effectiveIsCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />
                                )}
                            </button>
                        </FluentTooltip>
                    </div>
                )}
            </div>

            {!effectiveIsCollapsed && (
                <div 
                    className={`tag-divider ${isResizing ? 'active' : ''} ${isStacked ? 'stacked-divider' : ''}`}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                    }}
                >
                    <div className="tag-divider-handle" />
                </div>
            )}

            {/* Right Main Area */}
            <div className="tag-content">
                <div className="content-toolbar">
                    {/* Row 1: tag name + count (left), actions (right) */}
                    <div className="toolbar-row">
                        <div className="toolbar-row-left">
                            <span className="breadcrumb-text">{selectedTag || t('tags')}</span>
                            {selectedTag && <span className="item-count">({tagItems.length})</span>}
                        </div>
                        <div className="toolbar-row-right">
                            {selectedTag && (
                                <>
                                    {isManageMode ? (
                                        <>
                                            <button className="toolbar-btn ghost" onClick={() => { setIsManageMode(false); setSelectedItemIds(new Set()); }}>
                                                {t('cancel') || '取消'}
                                            </button>
                                            <button className="toolbar-btn neutral manage-btn" disabled={selectedItemIds.size === 0} onClick={() => setItemDeleteConfirmation({ show: true, id: -1 })}>
                                                <Trash2 size={14} /> <span>{t('delete') || '删除'}</span>
                                            </button>
                                            <button className="toolbar-btn neutral manage-btn" disabled={selectedItemIds.size === 0} onClick={async () => {
                                                const selectedItems = tagItems.filter(item => selectedItemIds.has(item.id));
                                                if (selectedItems.length > 0) {
                                                    await invoke('copy_to_clipboard', { content: selectedItems.map(i => i.content).join('\n'), contentType: 'text', paste: true, id: -1, deleteAfterUse: false });
                                                    setIsManageMode(false); setSelectedItemIds(new Set());
                                                }
                                            }}>
                                                <Copy size={14} /> <span>{t('copy') || '复制'}</span>
                                            </button>
                                        </>
                                    ) : (
                                        <button className="toolbar-btn ghost" onClick={() => setIsManageMode(true)}>
                                            <CheckSquare size={14} /> <span>{t('manage') || '管理'}</span>
                                        </button>
                                    )}
                                    {!isManageMode && (
                                        <button className="toolbar-btn primary" onClick={() => setIsCreatingItem(true)}>
                                            <Plus size={15} /> <span>{t('add_item') || '新建条目'}</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    {/* Row 2: sort (left) + view toggle (right) */}
                    <div className="toolbar-row" style={{ marginTop: '4px' }}>
                        <div className="sort-dropdown">
                            <button
                                className="toolbar-btn neutral sort-trigger-btn"
                                onClick={() => setShowSortMenu(prev => !prev)}
                                onBlur={() => setTimeout(() => setShowSortMenu(false), 150)}
                            >
                                {sortBy === 'time' ? <Clock size={14} /> : <MousePointer2 size={14} />}
                                <span>{sortBy === 'time' ? (t('sort_time') || '时间') : (t('sort_usage') || '频率')}</span>
                                <ChevronRight size={12} className="chevron-icon" />
                            </button>
                            {showSortMenu && (
                                <div
                                    className="sort-menu"
                                    style={{
                                        top: sortBy === 'time' ? '-4px' : '-40px',
                                        transformOrigin: sortBy === 'time' ? 'top center' : 'bottom center'
                                    }}
                                >
                                    <button className={sortBy === 'time' ? 'active' : ''} onMouseDown={() => { setSortBy('time'); setShowSortMenu(false); }}>
                                        <Clock size={14} /> <span>{t('sort_time') || '时间'}</span>
                                    </button>
                                    <button className={sortBy === 'count' ? 'active' : ''} onMouseDown={() => { setSortBy('count'); setShowSortMenu(false); }}>
                                        <MousePointer2 size={14} /> <span>{t('sort_usage') || '频率'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="view-split-dropdown">
                            <div className="view-split-button">
                                <FluentTooltip text={viewMode === 'list' ? (t('list_view') || '列表视图') : (t('grid_view') || '卡片视图')}>
                                    <div className="view-split-left">
                                        {viewMode === 'list' ? <List size={14} /> : <LayoutGrid size={14} />}
                                    </div>
                                </FluentTooltip>
                                <button 
                                    className={`view-split-right ${showViewMenu ? 'active' : ''}`}
                                    onClick={() => setShowViewMenu(prev => !prev)}
                                    onBlur={() => setTimeout(() => setShowViewMenu(false), 150)}
                                >
                                    <ChevronDown size={12} className="chevron-icon" />
                                </button>
                            </div>
                            {showViewMenu && (
                                <div className="view-menu" style={{ transformOrigin: 'top right' }}>
                                    <FluentTooltip text={t('list_view') || '列表视图'}>
                                        <button 
                                            className={viewMode === 'list' ? 'active' : ''} 
                                            onMouseDown={() => { setViewMode('list'); setShowViewMenu(false); }}
                                        >
                                            <List size={14} />
                                        </button>
                                    </FluentTooltip>
                                    <FluentTooltip text={t('grid_view') || '卡片视图'}>
                                        <button 
                                            className={viewMode === 'grid' ? 'active' : ''} 
                                            onMouseDown={() => { setViewMode('grid'); setShowViewMenu(false); }}
                                        >
                                            <LayoutGrid size={14} />
                                        </button>
                                    </FluentTooltip>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="items-area-wrapper" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible', minHeight: 0 }}>
                    <div className="items-area fluent-scrollbar-host" ref={itemsAreaRef}>
                        {loading ? <div className="status-msg">{t('processing')}</div> : sortedItems.length === 0 ? (
                            <div className="status-msg">{selectedTag ? t('no_items') : t('select_tag_to_begin')}</div>
                        ) : (
                            <div className={`items-${viewMode} ${isManageMode ? 'manage-mode' : ''}`}>
                                {sortedItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`themed-card ${selectedItemIds.has(item.id) ? 'selected' : ''}`}
                                        onClick={() => {
                                            if (isManageMode) {
                                                setSelectedItemIds(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(item.id)) next.delete(item.id);
                                                    else next.add(item.id);
                                                    return next;
                                                });
                                            } else {
                                                copyToClipboard(item.id, item.content, item.content_type);
                                            }
                                        }}
                                    >
                                        <div className="card-top-row">
                                            <div className="card-actions-left">
                                                {isManageMode ? (
                                                    <div className={`selection-indicator ${selectedItemIds.has(item.id) ? 'checked' : ''}`}>
                                                        <div className="inner-check" />
                                                    </div>
                                                ) : (
                                                    <>
                                                        {(item.content_type === 'text' || item.content_type === 'code') && (
                                                            <FluentTooltip text={t('edit') || '编辑'}>
                                                                <button className="card-action-btn" onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingItem({ id: item.id, content: item.content });
                                                                }}>
                                                                    <Edit2 size={10} />
                                                                </button>
                                                            </FluentTooltip>
                                                        )}
                                                        <FluentTooltip text={t('open') || '打开'}>
                                                            <button
                                                                className="card-action-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    invoke('open_content', {
                                                                        id: item.id,
                                                                        content: item.content,
                                                                        contentType: item.content_type
                                                                    });
                                                                }}
                                                            >
                                                                    <ExternalLink size={10} />
                                                            </button>
                                                        </FluentTooltip>
                                                    </>
                                                )}
                                            </div>
                                            {!isManageMode && (
                                                <FluentTooltip text={t('delete') || '删除'}>
                                                    <button className="del-btn" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setItemDeleteConfirmation({ show: true, id: item.id });
                                                    }}>
                                                        <X size={10} />
                                                    </button>
                                                </FluentTooltip>
                                            )}
                                        </div>

                                        {item.content_type === 'image' ? (
                                            <div className="card-media">
                                                <img
                                                    src={item.content.startsWith('data:') ? item.content : convertFileSrc(item.content)}
                                                    alt=""
                                                    className="image-preview"
                                                    loading="lazy"
                                                />
                                            </div>
                                        ) : (
                                            <div className="card-body-text">{item.preview || item.content}</div>
                                        )}

                                        <div className="card-divider" />
                                        <div className="card-footer">
                                            <span className="meta-time">{formatItemDate(item.timestamp)}</span>
                                            <div className="meta-usage"><MousePointer2 size={8} /> {item.use_count || 0}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <FluentScrollbar scrollContainer={itemsAreaEl} arrowsOutside={true} />
                </div>
            </div>

            {/* Modals for Create (Rename is handled inline now) */}
            {/* Kept minimal if needed for future extensions, but currently inline handles rename */}

            {/* Tag Delete Confirmation Modal */}
            {deleteConfirmation.show && createPortal(
                <div className="modal-overlay" onClick={() => setDeleteConfirmation({ show: false, tagName: null })}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-dialog-upper">
                            <h3 className="confirm-dialog-title">要删除标签吗？</h3>
                            <p className="confirm-dialog-message">
                                此操作将永久删除该标签及其下的所有条目。
                                <br />
                                <span className="tag-highlight" style={{ marginTop: '8px', display: 'inline-block' }}>
                                    {deleteConfirmation.tagName}
                                </span>
                            </p>
                        </div>
                        <div className="confirm-dialog-lower">
                            <div className="confirm-dialog-buttons">
                                <button className="confirm-dialog-button" onClick={() => setDeleteConfirmation({ show: false, tagName: null })}>
                                    {t('cancel')}
                                </button>
                                <button className="confirm-dialog-button primary danger" onClick={() => {
                                    if (deleteConfirmation.tagName) {
                                        handleDeleteTag(deleteConfirmation.tagName);
                                    }
                                    setDeleteConfirmation({ show: false, tagName: null });
                                }}>
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Item Delete Confirmation Modal */}
            {itemDeleteConfirmation.show && createPortal(
                <div className="modal-overlay" onClick={() => setItemDeleteConfirmation({ show: false, id: null })}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={e => e.stopPropagation()}>
                        <div className="confirm-dialog-upper">
                            <h3 className="confirm-dialog-title">要删除记录吗？</h3>
                            <p className="confirm-dialog-message">此操作无法撤回。</p>
                        </div>
                        <div className="confirm-dialog-lower">
                            <div className="confirm-dialog-buttons">
                                <button className="confirm-dialog-button" onClick={() => setItemDeleteConfirmation({ show: false, id: null })}>
                                    {t('cancel')}
                                </button>
                                <button className="confirm-dialog-button primary" onClick={async () => {
                                    if (itemDeleteConfirmation.id === -1) {
                                        // Bulk delete
                                        try {
                                            for (const id of Array.from(selectedItemIds)) {
                                                await invoke('delete_clipboard_entry', { id });
                                            }
                                            setIsManageMode(false);
                                            setSelectedItemIds(new Set());
                                            if (selectedTag) await loadTagItems(selectedTag);
                                            emit('clipboard-changed');
                                        } catch (err) { console.error(err); }
                                    } else if (itemDeleteConfirmation.id) {
                                        await invoke('delete_clipboard_entry', { id: itemDeleteConfirmation.id });
                                        loadTagItems(selectedTag!);
                                        emit('clipboard-changed');
                                    }
                                    setItemDeleteConfirmation({ show: false, id: null });
                                }}>
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Item Modal */}
            {isCreatingItem && createPortal(
                <div className="modal-overlay" onClick={() => setIsCreatingItem(false)}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={e => e.stopPropagation()}>
                        <div className="confirm-dialog-upper">
                            <h3 className="confirm-dialog-title">{t('add_item')}</h3>
                            <div className="modal-input-field" style={{ marginTop: '12px' }}>
                                <textarea
                                    className="tag-manager-textarea"
                                    value={newItemContent}
                                    onChange={e => setNewItemContent(e.target.value)}
                                    placeholder={t('input_content_placeholder')}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="confirm-dialog-lower">
                            <div className="confirm-dialog-buttons">
                                <button className="confirm-dialog-button" onClick={() => setIsCreatingItem(false)}>
                                    {t('cancel')}
                                </button>
                                <button className="confirm-dialog-button primary" onClick={handleAddManualItem}>
                                    {t('confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit Item Modal */}
            {editingItem && createPortal(
                <div className="modal-overlay" onClick={() => setEditingItem(null)}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={e => e.stopPropagation()}>
                        <div className="confirm-dialog-upper">
                            <h3 className="confirm-dialog-title">{t('edit_item')}</h3>
                            <div className="modal-input-field" style={{ marginTop: '12px' }}>
                                <textarea
                                    className="tag-manager-textarea"
                                    value={editingItem.content}
                                    onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="confirm-dialog-lower">
                            <div className="confirm-dialog-buttons">
                                <button className="confirm-dialog-button" onClick={() => setEditingItem(null)}>
                                    {t('cancel')}
                                </button>
                                <button className="confirm-dialog-button primary" onClick={handleUpdateItemContent}>
                                    {t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <style>{`
                .themed-tag-manager {
                    display: grid;
                    grid-template-columns: var(--tag-sidebar-width, 130px) auto 1fr;
                    height: 100%;
                    background: var(--bg-content);
                    font-family: var(--font-main, ui-monospace, monospace);
                    color: var(--text-primary);
                    gap: 12px;
                    padding: 8px 12px 12px;
                }

                /* Sidebar */
                .tag-sidebar {
                    width: var(--tag-sidebar-width, 130px);
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    background: transparent;
                    border-radius: 0;
                    box-shadow: none;
                    overflow: visible;
                    border: none;
                }
                .sidebar-collapsed .tag-sidebar { width: 50px; }
                
                .sidebar-header {
                    padding: 0 10px;
                    border-top: 1px solid var(--panel-divider-color);
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    height: 36px;
                    min-height: 36px;
                    background: transparent;
                    color: var(--text-secondary);
                }
                .header-actions { display: flex; align-items: center; gap: 8px; }
                .action-btn { background: transparent; border: none; color: inherit; cursor: pointer; padding: 2px; opacity: 0.7; transition: opacity 0.2s; }
                .action-btn:hover { opacity: 1; }
                .collapse-toggle {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    opacity: 0.6;
                    transition: opacity 0.15s, color 0.15s;
                }
                .collapse-toggle:hover { opacity: 1; color: var(--accent-color); }

                /* Tag Search Box */
                .tag-search-box {
                    padding: 0 8px 0 4px;
                    display: flex; align-items: center; gap: 4px;
                    background: transparent;
                    border-bottom: 1px solid var(--panel-divider-color);
                    margin: 8px 8px 0;
                    height: 32px;
                    min-height: 32px;
                    position: relative;
                }
                .tag-search-box::after {
                    content: "";
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: var(--accent-color);
                    transform: scaleX(0);
                    transition: transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1);
                    border-radius: 0 0 2px 2px;
                    z-index: 2;
                }
                .tag-search-box:focus-within::after {
                    transform: scaleX(1);
                }
                .tag-search-box .search-input-wrapper {
                    flex: 1;
                    position: relative;
                    min-width: 0;
                }
                .tag-search-box .search-icon-placeholder {
                    position: absolute;
                    left: 4px;
                    top: 50%;
                    transform: translateY(-50%);
                    opacity: 0.45;
                    color: var(--text-secondary);
                    pointer-events: none;
                    z-index: 0;
                }
                .tag-search-box input {
                    width: 100%;
                    background: var(--bg-main);
                    border: 1px solid var(--border);
                    outline: none;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text-primary);
                    padding: 0 8px 0 24px;
                    height: 30px;
                    border-radius: 4px;
                    transition: all 0.2s;
                    position: relative;
                    z-index: 1;
                }
                .tag-search-box input:focus {
                    background: var(--bg-panel);
                }
                .tag-search-box input::placeholder { color: var(--text-muted); opacity: 0.7; font-style: normal; font-size: 13px; }

                .action-icons {
                    position: absolute;
                    right: 6px;
                    top: 50%;
                    transform: translateY(-50%);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    z-index: 2;
                }
                .action-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                    opacity: 0.5;
                    color: var(--text-primary);
                    border-radius: 4px;
                    transition: all 0.15s;
                }
                .action-icon:hover { opacity: 1; background: rgba(128,128,128,0.12); transform: none; }
                .action-icon.create { color: var(--accent-color); opacity: 0.8; }
                .action-icon.create:hover { opacity: 1; background: rgba(var(--accent-color-rgb), 0.12); }

                .tag-scroll { flex: 1; overflow-y: auto; padding: 8px; overflow-x: hidden; position: relative; }
                .tag-selection-indicator {
                    position: absolute;
                    left: 8px;
                    top: 0;
                    width: 3px;
                    height: 16px;
                    z-index: 10;
                    pointer-events: none;
                    background: transparent;
                    transition: transform 0.22s cubic-bezier(0.85, 0, 0.15, 1);
                }
                .tag-selection-indicator-inner {
                    width: 100%;
                    height: 100%;
                    border-radius: 1.5px;
                    background: var(--accent-color);
                    transform-origin: center;
                    animation: fluent-stretch 0.22s cubic-bezier(0.85, 0, 0.15, 1);
                }
                @keyframes fluent-stretch {
                    0% { transform: scaleY(1); }
                    45% { transform: scaleY(1.35); }
                    100% { transform: scaleY(1); }
                }
                .theme-mica:not(.sidebar-collapsed) .tag-selection-indicator,
                .theme-acrylic:not(.sidebar-collapsed) .tag-selection-indicator {
                    left: 12px;
                }
                /* Tag Item Layout: [Color] [Name (Flex)] [Actions (Hover)] [Badge] */
                .tag-item {
                    display: flex; 
                    align-items: center; 
                    gap: 10px;
                    height: 32px;
                    min-height: 32px;
                    padding: 0 10px; 
                    cursor: pointer;
                    margin-bottom: 4px; 
                    border: 1px solid transparent;
                    border-radius: 4px;
                    transition: all 0.15s;
                    position: relative;
                    width: 100%;
                }
                .tag-item:hover { background: rgba(0, 0, 0, 0.06); }
                .dark-mode .tag-item:hover { background: rgba(255, 255, 255, 0.08); }
                .tag-item.active { 
                    background: rgba(0, 0, 0, 0.06); 
                    border-color: transparent;
                    box-shadow: none;
                }
                .dark-mode .tag-item.active {
                    background: rgba(255, 255, 255, 0.08);
                }
                .tag-item.create-hint { border: 1px dashed var(--border); opacity: 0.8; }
                .tag-item.create-hint:hover { background: var(--bg-main); border-style: solid; }

                .sidebar-collapsed .tag-scroll .tag-item { justify-content: center; align-items: center; height: 32px; min-height: 32px; width: 32px; padding: 0; margin-left: auto; margin-right: auto; gap: 0; }
                .sidebar-collapsed .tag-scroll .tag-name,
                .sidebar-collapsed .tag-scroll .tag-name-area,
                .sidebar-collapsed .tag-scroll .tag-hover-actions { display: none !important; }
                .sidebar-collapsed .tag-scroll .tag-color-wrapper { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; margin: 0; }
                .tag-color-wrapper { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; }
                .tag-color-dot { 
                    width: 18px; 
                    height: 18px; 
                    flex-shrink: 0; 
                    cursor: pointer; 
                    border: none;
                    transition: transform 0.2s; 
                }
                .tag-color-dot:hover { transform: scale(1.15); }
                /* Tag name area — relative container for overlay hover */
                .tag-name-area {
                    flex: 1;
                    position: relative;
                    display: flex;
                    align-items: center;
                    min-width: 0;
                    overflow: hidden;
                    transition: padding-right 0.15s ease;
                }
                .tag-item.has-actions:hover .tag-name-area {
                    padding-right: 52px;
                }
                .tag-name {
                    font-size: 13px;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }

                /* Inline Edit Input */
                .inline-tag-edit {
                    flex: 1;
                    border: 1px solid var(--border);
                    background: var(--bg-main);
                    color: var(--text-primary);
                    font-size: 13px;
                    font-weight: 500;
                    padding: 6px 10px;
                    border-radius: var(--radius-sm);
                    outline: none;
                    box-shadow: 0 0 0 3px var(--accent-light);
                }

                /* Hover actions — absolute right, smart overlay with fade-in edge */
                .tag-hover-actions {
                    position: absolute;
                    right: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    display: none;
                    gap: 4px;
                    align-items: center;
                    padding: 0;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    z-index: 2;
                    box-shadow: none;
                    backdrop-filter: none;
                }
                .tag-item:hover .tag-hover-actions { display: flex; }
                .tag-item.active:not(:hover) .tag-hover-actions { display: none !important; }

                .tag-hover-actions > span {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    border-radius: 4px;
                    color: var(--text-secondary);
                    transition: background 0.15s, color 0.15s;
                }
                .tag-hover-actions > span:hover {
                    background: rgba(var(--accent-color-rgb), 0.12);
                    color: var(--accent-color);
                }
                .dark-mode .tag-hover-actions > span:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: var(--text-primary) !important;
                }

                /* Content Area */
                .tag-content { flex: 1; min-width: 320px; display: flex; flex-direction: column; overflow: visible; position: relative; }
                .content-toolbar {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    border-bottom: none;
                    background: transparent;
                    padding: 8px 8px;
                    flex-shrink: 0;
                }
                .toolbar-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    flex-wrap: nowrap;
                }
                .toolbar-row-left {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--text-primary);
                    flex-shrink: 0;
                    flex-wrap: nowrap;
                    overflow: hidden;
                    margin-left: 4px;
                }
                .toolbar-row-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: auto;
                    flex-shrink: 0;
                    flex-wrap: nowrap;
                }
                .breadcrumb-marker { color: var(--accent-color); }
                .item-count { font-weight: 400; color: var(--text-secondary); font-size: 13px; }

                /* Toolbar buttons */
                .toolbar-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    height: 32px !important;
                    min-height: 32px !important;
                    box-sizing: border-box !important;
                    padding: 0 12px !important;
                    font-size: 12px;
                    font-weight: 500;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .toolbar-btn.ghost {
                    background: transparent;
                    border-color: transparent;
                    color: var(--text-primary);
                    opacity: 0.85;
                }
                .toolbar-btn.ghost:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: var(--text-primary);
                    opacity: 1;
                }
                .dark-mode .toolbar-btn.ghost:hover {
                    background: rgba(255, 255, 255, 0.08);
                }
                .toolbar-btn.ghost:active {
                    background: rgba(0, 0, 0, 0.09);
                }
                .dark-mode .toolbar-btn.ghost:active {
                    background: rgba(255, 255, 255, 0.12);
                }
                .toolbar-btn.primary {
                    background: var(--accent-color);
                    color: #ffffff;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14), inset 0 -1px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                }
                .toolbar-btn.primary:hover:not(:disabled) {
                    background: linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08)), var(--accent-color);
                }
                .toolbar-btn.primary:active:not(:disabled) {
                    background: linear-gradient(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.08)), var(--accent-color);
                    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.3);
                }
                .toolbar-btn.accent {
                    background: rgba(var(--accent-color-rgb), 0.12);
                    color: var(--accent-color);
                }
                .toolbar-btn.accent:hover { background: rgba(var(--accent-color-rgb), 0.2); }
                .toolbar-btn.danger {
                    background: transparent;
                    color: #d32f2f;
                }
                .toolbar-btn.danger:hover { background: rgba(211,47,47,0.08); }
                .toolbar-btn.neutral {
                    background: rgba(0, 0, 0, 0.04);
                    border: 1px solid var(--line-soft);
                    color: var(--text-primary);
                    gap: 6px;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.015), inset 0 -1px 0 rgba(0, 0, 0, 0.05);
                }
                .toolbar-btn.neutral.manage-btn {
                    width: 72px !important;
                    justify-content: center !important;
                    background: #ffffff !important;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.02), inset 0 -1px 0 rgba(0, 0, 0, 0.08) !important;
                }
                .toolbar-btn.neutral.manage-btn:hover:not(:disabled) {
                    background: #fafafa !important;
                    border-color: var(--line-strong) !important;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.02), inset 0 -1px 0 rgba(0, 0, 0, 0.08) !important;
                }
                .toolbar-btn.neutral.manage-btn:active:not(:disabled) {
                    background: #f0f0f0 !important;
                    box-shadow: none !important;
                }
                .dark-mode .toolbar-btn.neutral.manage-btn {
                    background: #2d2d2d !important;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05), inset 0 -1px 0 rgba(255, 255, 255, 0.05) !important;
                }
                .dark-mode .toolbar-btn.neutral.manage-btn:hover:not(:disabled) {
                    background: #323232 !important;
                    border-color: var(--line-strong) !important;
                }
                .dark-mode .toolbar-btn.neutral.manage-btn:active:not(:disabled) {
                    background: #202020 !important;
                }
                .dark-mode .toolbar-btn.neutral {
                    background: rgba(255, 255, 255, 0.05);
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05), inset 0 -1px 0 rgba(255, 255, 255, 0.02);
                }
                .toolbar-btn.neutral:hover:not(:disabled) {
                    background: rgba(0, 0, 0, 0.08);
                    border-color: var(--line-strong);
                }
                .dark-mode .toolbar-btn.neutral:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.08);
                }
                .toolbar-btn.neutral:active:not(:disabled) {
                    background: rgba(0, 0, 0, 0.12);
                }
                .dark-mode .toolbar-btn.neutral:active:not(:disabled) {
                    background: rgba(255, 255, 255, 0.12);
                }
                .toolbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                /* Sort dropdown — in-place overlay, equal overhang on both sides */
                .sort-dropdown { position: relative; flex-shrink: 0; }
                .sort-dropdown > .toolbar-btn.neutral.sort-trigger-btn {
                    background: #ffffff !important;
                    border-color: var(--line-soft) !important;
                    padding: 0 12px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 4px !important;
                    width: auto !important;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.015), inset 0 -1px 0 rgba(0, 0, 0, 0.05) !important;
                }
                .sort-dropdown > .toolbar-btn.neutral.sort-trigger-btn:hover {
                    background: #fafafa !important;
                    border-color: var(--line-strong) !important;
                }
                .sort-dropdown > .toolbar-btn.neutral.sort-trigger-btn:active {
                    background: #f0f0f0 !important;
                }
                .dark-mode .sort-dropdown > .toolbar-btn.neutral.sort-trigger-btn {
                    background: #2d2d2d !important;
                    border-color: var(--line-soft) !important;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05), inset 0 -1px 0 rgba(255, 255, 255, 0.02) !important;
                }
                .dark-mode .sort-dropdown > .toolbar-btn.neutral.sort-trigger-btn:hover {
                    background: #323232 !important;
                    border-color: var(--line-strong) !important;
                }
                .dark-mode .sort-dropdown > .toolbar-btn.neutral.sort-trigger-btn:active {
                    background: #202020 !important;
                }
                .sort-trigger-btn .chevron-icon {
                    margin-left: 12px !important;
                    transform: rotate(90deg);
                    flex-shrink: 0;
                }
                .sort-menu {
                    position: absolute;
                    top: -4px;
                    left: 0;
                    right: -4px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    background: #fafafa;
                    border: var(--flyout-border);
                    border-radius: 4px;
                    box-shadow: var(--flyout-shadow);
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    padding: 4px;
                    z-index: 100;
                    animation: sortMenuIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .dark-mode .sort-menu {
                    background: #2d2d2d;
                }
                @keyframes sortMenuIn {
                    from { opacity: 0; transform: scale(1, 0.85); }
                    to   { opacity: 1; transform: scale(1, 1); }
                }
                .sort-menu button {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    width: 100%;
                    height: 32px;
                    box-sizing: border-box;
                    padding: 0 12px;
                    font-size: 12px;
                    font-weight: 500;
                    border: none;
                    border-radius: 4px;
                    background: transparent;
                    color: var(--text-primary);
                    cursor: pointer;
                    transition: background 0.15s ease, color 0.15s ease;
                }
                .sort-menu button:hover {
                    background: #f0f0f0;
                }
                .dark-mode .sort-menu button:hover {
                    background: rgba(255, 255, 255, 0.04);
                }
                .sort-menu button.active {
                    color: var(--text-primary);
                    background: #f0f0f0;
                }
                .dark-mode .sort-menu button.active {
                    background: rgba(255, 255, 255, 0.08);
                }
                .sort-menu button.active::before {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 16px;
                    border-radius: 0 1.5px 1.5px 0;
                    background: var(--accent-color);
                }

                /* View Split Dropdown Control */
                .view-split-dropdown {
                    position: relative;
                    flex-shrink: 0;
                }
                .view-split-button {
                    display: flex;
                    align-items: stretch;
                    height: 32px;
                    border: 1px solid var(--line-soft);
                    border-radius: 4px;
                    background: #ffffff;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.02), inset 0 -1px 0 rgba(0, 0, 0, 0.08) !important;
                }
                /* FluentTooltip injects a <span> — make it stretch full height */
                .view-split-button > span {
                    display: flex !important;
                    align-items: stretch;
                    height: 100%;
                }
                .dark-mode .view-split-button {
                    background: #2d2d2d;
                    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05), inset 0 -1px 0 rgba(255, 255, 255, 0.05) !important;
                }
                .view-split-left {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 0 12px;
                    border-right: 1px solid var(--line-soft);
                    border-top-left-radius: 3px;
                    border-bottom-left-radius: 3px;
                    color: var(--text-secondary);
                    transition: background 0.15s ease, color 0.15s ease;
                }
                .view-split-left:hover {
                    background: rgba(0, 0, 0, 0.04);
                    color: var(--text-primary);
                }
                .dark-mode .view-split-left:hover {
                    background: rgba(255, 255, 255, 0.06);
                }
                .view-split-right {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 0 8px;
                    border: none;
                    background: transparent;
                    border-top-right-radius: 3px;
                    border-bottom-right-radius: 3px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    outline: none !important;
                    transition: background 0.15s ease, color 0.15s ease;
                }
                .view-split-right:hover {
                    background: rgba(0, 0, 0, 0.04);
                    color: var(--text-primary);
                }
                .dark-mode .view-split-right:hover {
                    background: rgba(255, 255, 255, 0.06);
                }
                .view-split-right.active {
                    background: rgba(0, 0, 0, 0.06) !important;
                    color: var(--text-primary) !important;
                }
                .dark-mode .view-split-right.active {
                    background: rgba(255, 255, 255, 0.08) !important;
                }
                
                /* Popover view menu */
                .view-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 4px;
                    width: 120px;
                    height: 64px;
                    background: #fafafa;
                    border: 1px solid var(--line-soft);
                    border-radius: 4px;
                    padding: 8px 12px;
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    z-index: 100;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    box-sizing: border-box;
                    animation: view-menu-pop 0.15s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes view-menu-pop {
                    0% { transform: scale(0.95) translateY(-4px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                .dark-mode .view-menu {
                    background: #333333;
                    border-color: rgba(255,255,255,0.1);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
                .view-menu button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border: 1px solid rgba(0, 0, 0, 0.12);
                    background: #ffffff;
                    border-radius: 4px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    outline: none !important;
                    transition: background 0.15s ease;
                    flex-shrink: 0;
                }
                .dark-mode .view-menu button {
                    background: #444444;
                    border-color: rgba(255, 255, 255, 0.1);
                    color: var(--text-secondary);
                }
                .view-menu button:hover {
                    background: #fafafa;
                }
                .dark-mode .view-menu button:hover {
                    background: rgba(255, 255, 255, 0.12);
                }
                .view-menu button.active {
                    background: #ffffff;
                    color: var(--text-secondary);
                }
                .dark-mode .view-menu button.active {
                    background: #444444;
                    color: var(--text-secondary);
                }
                .view-menu button.active:hover {
                    background: #fafafa;
                }
                .dark-mode .view-menu button.active:hover {
                    background: rgba(255, 255, 255, 0.12);
                }

                .items-area-wrapper {
                    position: relative;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: visible;
                    min-height: 0;
                }
                .items-area { 
                    flex: 1; 
                    overflow-y: auto; 
                    overflow-x: hidden;
                    padding: 8px 8px 8px 8px; 
                    scrollbar-width: none !important;
                    scrollbar-gutter: auto;
                    background: var(--bg-content); 
                    position: relative;
                }
                .themed-tag-manager .fluent-scrollbar {
                    top: 8px !important;
                    right: -10px !important;
                    bottom: 4px !important;
                }

                .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
                .items-list { display: flex; flex-direction: column; gap: 12px; }

                .themed-card {
                    background: var(--bg-element);
                    border: 1px solid var(--border);
                    padding: 12px; cursor: pointer;
                    position: relative;
                    border-radius: var(--radius-md);
                    transition: all 0.15s ease;
                }
                .themed-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px var(--shadow); border-color: var(--accent-color); }
                .dark-mode .themed-card:hover { border-color: var(--line-strong, rgba(255, 255, 255, 0.16)) !important; }

                .del-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; opacity: 0.4; transition: opacity 0.15s; }
                .del-btn:hover { opacity: 1; color: #ff4d4f; }

                .card-media { min-height: 60px; border-radius: var(--radius-sm); margin: 8px 0; overflow: hidden; background: var(--bg-main); display: flex; justify-content: center; align-items: center; }
                .card-media img { max-width: 100%; max-height: 140px; object-fit: contain; border-radius: var(--radius-sm); }
                
                .card-body-text { font-size: 13px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; color: var(--text-primary); }
                .card-footer { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: var(--text-secondary); opacity: 0.8; }
                .meta-usage { display: flex; align-items: center; gap: 4px; }
                
                .add-item-btn {
                    margin-left: 12px;
                }

                .card-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .card-actions-left { display: flex; gap: 4px; }
                .card-action-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    padding: 4px;
                    border-radius: var(--radius-sm);
                    opacity: 0.6;
                    transition: all 0.15s;
                }
                .card-action-btn:hover { opacity: 1; color: var(--accent-color); background: var(--bg-main); }

                /* Overlay */
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(255, 255, 255, 0.4) !important;
                    backdrop-filter: blur(2px) !important;
                    -webkit-backdrop-filter: blur(2px) !important;
                    display: flex; align-items: center; justify-content: center;
                    grid-column: 1 / -1 !important;
                    grid-row: 1 / -1 !important;
                    z-index: 9999 !important;
                    border-radius: var(--shell-radius);
                    clip-path: inset(0 round var(--shell-radius));
                    -webkit-clip-path: inset(0 round var(--shell-radius));
                }
                .dark-mode .modal-overlay {
                    background: rgba(0, 0, 0, 0.4) !important;
                }

                /* Confirm Dialog - Modern Style */
                .modal-overlay .confirm-dialog {
                    background: #ffffff !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                    border: 1px solid var(--line-strong) !important;
                    box-shadow: 0 32px 64px rgba(0, 0, 0, 0.24), 0 2px 4px rgba(0, 0, 0, 0.16) !important;
                    border-radius: 8px !important;
                    width: 280px !important;
                    max-width: 90% !important;
                    animation: modal-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                }

                @keyframes modal-pop {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .confirm-dialog-upper {
                    padding: 24px 24px 20px !important;
                    text-align: left !important;
                    background: #ffffff !important;
                    border-top-left-radius: 8px !important;
                    border-top-right-radius: 8px !important;
                }

                .confirm-dialog-lower {
                    padding: 16px 24px !important;
                    background: #f5f5f5 !important;
                    border-top: 1px solid var(--line-soft) !important;
                    border-bottom-left-radius: 8px !important;
                    border-bottom-right-radius: 8px !important;
                }

                .modal-overlay .confirm-dialog h3 {
                    margin: 0 0 12px 0 !important;
                    font-size: 16px !important;
                    font-weight: 600 !important;
                    background: transparent !important;
                    color: var(--text-primary) !important;
                    padding: 0 !important;
                    display: block !important;
                    text-transform: none !important;
                }

                .modal-overlay .confirm-dialog p {
                    margin: 12px 0 0 0 !important;
                    font-size: 13px !important;
                    font-weight: 400 !important;
                    line-height: 1.5 !important;
                    color: var(--text-secondary) !important;
                }

                .modal-overlay .confirm-dialog-buttons {
                    display: flex !important;
                    justify-content: center !important;
                    gap: 8px !important;
                    width: 100% !important;
                }

                /* Modern Theme Polishes for Confirm Dialog */
                .theme-mica .confirm-dialog,
                .theme-acrylic .confirm-dialog {
                    background: #ffffff !important;
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    padding: 0 !important;
                    border-radius: 8px !important;
                    box-shadow: 0 32px 64px rgba(0,0,0,0.24), 0 2px 4px rgba(0,0,0,0.16) !important;
                    border: 1px solid var(--line-strong) !important;
                    animation: modal-pop-modern 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                }
                
                @keyframes modal-pop-modern {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .theme-mica .confirm-dialog-upper,
                .theme-acrylic .confirm-dialog-upper {
                    background: #ffffff !important;
                    border-top-left-radius: 8px !important;
                    border-top-right-radius: 8px !important;
                }

                .theme-mica .confirm-dialog-lower,
                .theme-acrylic .confirm-dialog-lower {
                    background: #f5f5f5 !important;
                    border-top: 1px solid var(--line-soft) !important;
                    border-bottom-left-radius: 8px !important;
                    border-bottom-right-radius: 8px !important;
                }

                .theme-mica .confirm-dialog h3,
                .theme-acrylic .confirm-dialog h3 {
                    background: transparent !important;
                    color: var(--text-primary) !important;
                    font-size: 16px !important;
                    font-weight: 700 !important;
                    text-transform: none !important;
                    padding: 0 !important;
                }

                .theme-mica .confirm-dialog-button,
                .theme-acrylic .confirm-dialog-button {
                    border-radius: 4px !important;
                    font-weight: 600 !important;
                }
                .theme-mica .confirm-dialog-button:active,
                .theme-acrylic .confirm-dialog-button:active {
                    transform: scale(0.985) !important;
                }

                /* Dark Mode Adaptation */
                .dark-mode .modal-overlay .confirm-dialog {
                    background: #2c2c2c !important;
                    border-color: #000 !important;
                }
                .dark-mode .confirm-dialog-upper {
                    background: #2c2c2c !important;
                    border-top-left-radius: 8px !important;
                    border-top-right-radius: 8px !important;
                }
                .dark-mode .confirm-dialog-lower {
                    background: #202020 !important;
                    border-top: 1px solid rgba(255, 255, 255, 0.09) !important;
                    border-bottom-left-radius: 8px !important;
                    border-bottom-right-radius: 8px !important;
                }
                .dark-mode .modal-overlay .confirm-dialog h3 {
                    color: #fff !important;
                }
                .dark-mode .modal-overlay .confirm-dialog p {
                    color: #d1d1d1 !important;
                }
                .dark-mode .theme-mica .confirm-dialog,
                .dark-mode .theme-acrylic .confirm-dialog {
                    background: #2c2c2c !important;
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    border-color: rgba(255,255,255,0.1) !important;
                }
                .dark-mode .theme-mica .confirm-dialog-upper,
                .dark-mode .theme-acrylic .confirm-dialog-upper {
                    background: #2c2c2c !important;
                    border-top-left-radius: 8px !important;
                    border-top-right-radius: 8px !important;
                }
                .dark-mode .theme-mica .confirm-dialog-lower,
                .dark-mode .theme-acrylic .confirm-dialog-lower {
                    background: #202020 !important;
                    border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
                    border-bottom-left-radius: 8px !important;
                    border-bottom-right-radius: 8px !important;
                }

                .modal-input-field input {
                    width: 100%; 
                    background: var(--bg-main);
                    border: 1px solid var(--border);
                    padding: 12px; 
                    color: var(--text-primary);
                    font-family: inherit; 
                    font-size: 14px; 
                    font-weight: 400;
                    outline: none; 
                    margin-bottom: 20px;
                    border-radius: var(--radius-sm);
                    transition: all 0.2s;
                }
                .modal-input-field input:focus {
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 3px var(--accent-light);
                }
                .modal-buttons { display: flex; gap: 8px; justify-content: flex-end; }
                .modal-buttons button {
                    padding: 8px 16px; 
                    cursor: pointer;
                    font-size: 13px; 
                    font-weight: 500;
                    border: 1px solid var(--border);
                    background: var(--bg-main);
                    color: var(--text-primary);
                    box-shadow: none;
                    transition: all 0.15s;
                    border-radius: var(--radius-sm);
                }
                .modal-buttons button:active { transform: scale(0.98); }
                .btn-save { background: var(--accent-color); color: white; border: none; }
                .btn-save:hover { background: var(--accent-color-dark); }
                
                /* Modern Theme Polishes */
                .theme-mica.themed-tag-manager,
                .theme-acrylic.themed-tag-manager {
                    gap: 12px;
                    padding: 8px 12px 12px;
                    background: transparent !important;
                    overflow: hidden;
                }

                .theme-mica .tag-sidebar,
                .theme-acrylic .tag-sidebar {
                    width: clamp(196px, 24%, 248px);
                    border: none;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                    overflow: visible;
                }

                .theme-mica.sidebar-collapsed .tag-sidebar,
                .theme-acrylic.sidebar-collapsed .tag-sidebar {
                    width: 50px;
                }
                .theme-mica .sidebar-header,
                .theme-acrylic .sidebar-header {
                    min-height: 36px;
                    height: 36px;
                    padding: 0 10px;
                    background: transparent;
                    border-top: 1px solid var(--panel-divider-color);
                    border-bottom: none;
                }

                .theme-mica .collapse-toggle,
                .theme-acrylic .collapse-toggle {
                    background: transparent;
                    border: none;
                    border-radius: 4px;
                    opacity: 0.55;
                }

                .theme-mica .collapse-toggle:hover,
                .theme-acrylic .collapse-toggle:hover {
                    opacity: 1;
                    color: var(--accent-color);
                }

                .theme-mica .tag-search-box,
                .theme-acrylic .tag-search-box {
                    margin: 8px 8px 0;
                    height: 32px;
                    min-height: 32px;
                    padding: 0 8px 0 4px;
                    gap: 12px;
                    border: var(--input-border);
                    border-radius: 4px;
                    background: transparent;
                    box-shadow: var(--input-shadow);
                    transition: background 0.18s ease;
                }
                .theme-mica .tag-search-box:focus-within,
                .theme-acrylic .tag-search-box:focus-within {
                    background: var(--bg-input);
                }

                .theme-mica .tag-search-box .search-icon-placeholder,
                .theme-acrylic .tag-search-box .search-icon-placeholder {
                    opacity: 0.5;
                    color: var(--text-secondary);
                }

                 .theme-mica .tag-search-box input,
                .theme-acrylic .tag-search-box input {
                    padding: 0 8px 0 24px;
                    font-size: 14px;
                    font-weight: 500;
                    background: transparent;
                    border: none;
                    flex: 1;
                    height: 30px;
                }
                .theme-mica .tag-search-box .search-input-wrapper,
                .theme-acrylic .tag-search-box .search-input-wrapper {
                    flex: 1;
                    min-width: 0;
                    position: relative;
                }

                .theme-mica .tag-search-box input::placeholder,
                .theme-acrylic .tag-search-box input::placeholder {
                    font-size: 15px;
                    font-style: normal;
                    opacity: 0.72;
                }

                .theme-mica .action-icons,
                .theme-acrylic .action-icons {
                    gap: 4px;
                    flex-shrink: 0;
                }

                .theme-mica .action-icon,
                .theme-acrylic .action-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    color: var(--text-secondary);
                    opacity: 0.7;
                    background: transparent;
                }

                .theme-mica .action-icon:hover,
                .theme-acrylic .action-icon:hover {
                    opacity: 1;
                    color: var(--accent-color);
                    background: rgba(var(--accent-color-rgb), 0.1);
                    transform: none;
                }

                .theme-mica .tag-scroll,
                .theme-acrylic .tag-scroll {
                    padding: 4px 12px 16px;
                }

                .theme-mica .tag-item,
                .theme-acrylic .tag-item {
                    min-height: 60px;
                    padding: 14px 16px;
                    margin-bottom: 6px;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    background: transparent;
                }

                .theme-mica .tag-item:hover,
                .theme-acrylic .tag-item:hover {
                    background: rgba(0, 0, 0, 0.06);
                    border-color: transparent;
                }
                .dark-mode .theme-mica .tag-item:hover,
                .dark-mode .theme-acrylic .tag-item:hover {
                    background: rgba(255, 255, 255, 0.08);
                }

                .theme-mica .tag-item.active,
                .theme-acrylic .tag-item.active {
                    background: rgba(0, 0, 0, 0.06);
                    border-color: transparent;
                    box-shadow: none;
                }
                .dark-mode .theme-mica .tag-item.active,
                .dark-mode .theme-acrylic .tag-item.active {
                    background: rgba(255, 255, 255, 0.08);
                }

                .theme-mica .tag-color-dot,
                .theme-acrylic .tag-color-dot {
                    width: 18px;
                    height: 18px;
                    border: none;
                    box-shadow: none;
                }

                .theme-mica .tag-name,
                .theme-acrylic .tag-name {
                    font-size: 15px;
                    font-weight: 700;
                }

                .theme-mica .tag-hover-actions,
                .theme-acrylic .tag-hover-actions {
                    gap: 4px;
                }

                .theme-mica .tag-hover-actions > span,
                .theme-acrylic .tag-hover-actions > span {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    color: var(--text-secondary);
                }

                .theme-mica .tag-hover-actions > span:hover,
                .theme-acrylic .tag-hover-actions > span:hover {
                    background: rgba(var(--accent-color-rgb), 0.12);
                    color: var(--accent-color);
                }

                .theme-mica .tag-item.active:not(:hover) .tag-hover-actions,
                .theme-acrylic .tag-item.active:not(:hover) .tag-hover-actions {
                    display: none !important;
                }
                .theme-mica .tag-item.active .tag-hover-actions > span,
                .theme-acrylic .tag-item.active .tag-hover-actions > span {
                    color: var(--text-primary);
                }
                .theme-mica .tag-item.active .tag-hover-actions > span:hover,
                .theme-acrylic .tag-item.active .tag-hover-actions > span:hover {
                    background: rgba(var(--accent-color-rgb), 0.14);
                    color: var(--accent-color);
                }
                .dark-mode .theme-mica .tag-item.active .tag-hover-actions > span:hover,
                .dark-mode .theme-acrylic .tag-item.active .tag-hover-actions > span:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: var(--text-primary) !important;
                }

                .theme-mica .tag-content,
                .theme-acrylic .tag-content {
                    min-width: 180px;
                    border: none;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                }

                .theme-mica .content-toolbar,
                .theme-acrylic .content-toolbar {
                    padding: 8px 8px;
                    gap: 8px;
                    border-bottom: none;
                    background: transparent;
                    flex-shrink: 0;
                }

                .theme-mica .toolbar-btn,
                .theme-acrylic .toolbar-btn {
                    padding: 6px 12px;
                    font-size: 13px;
                    border-radius: 4px;
                }
                .theme-mica .sort-menu button,
                .theme-acrylic .sort-menu button {
                    padding: 0 12px;
                    font-size: 13px;
                }
                .theme-mica .toolbar-btn.primary,
                .theme-acrylic .toolbar-btn.primary {
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14), inset 0 -1px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                    border-color: rgba(0, 0, 0, 0.08);
                }

                /* Removed theme overrides for view-toggle to let the standard style apply */

                .theme-mica .items-area,
                .theme-acrylic .items-area {
                    padding: 8px 8px 8px 8px;
                    scrollbar-gutter: auto;
                    background: transparent;
                }

                .theme-mica .status-msg,
                .theme-acrylic .status-msg {
                    padding: 36px 12px;
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 14px;
                }

                .theme-mica .items-grid,
                .theme-acrylic .items-grid {
                    grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
                    gap: 8px;
                }

                .theme-mica .items-list,
                .theme-acrylic .items-list {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 8px;
                }

                .theme-mica .themed-card,
                .theme-acrylic .themed-card {
                    position: relative;
                    min-height: 244px;
                    padding: 24px 22px 18px;
                    border: 1px solid rgba(var(--accent-color-rgb), 0.08);
                    border-radius: 22px;
                    background: var(--bg-input);
                    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
                }

                .theme-mica .themed-card:hover,
                .theme-acrylic .themed-card:hover {
                    transform: translateY(-2px);
                    border-color: rgba(var(--accent-color-rgb), 0.14);
                    box-shadow: 0 18px 34px rgba(15, 23, 42, 0.1);
                    background: var(--bg-input);
                }
                .dark-mode .theme-mica .themed-card:hover,
                .dark-mode .theme-acrylic .themed-card:hover {
                    border-color: rgba(255, 255, 255, 0.12) !important;
                }

                .theme-mica .items-list .themed-card,
                .theme-acrylic .items-list .themed-card {
                    min-height: 180px;
                }

                .theme-mica .card-top-row,
                .theme-acrylic .card-top-row {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    opacity: 0;
                    transition: opacity 0.18s ease;
                    z-index: 1;
                }

                .theme-mica .themed-card:hover .card-top-row,
                .theme-acrylic .themed-card:hover .card-top-row {
                    opacity: 1;
                }

                .theme-mica .card-actions-left,
                .theme-acrylic .card-actions-left {
                    gap: 4px;
                }

                .theme-mica .card-action-btn,
                .theme-mica .del-btn,
                .theme-acrylic .card-action-btn,
                .theme-acrylic .del-btn {
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    border: 1px solid rgba(var(--accent-color-rgb), 0.08);
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.88);
                    color: var(--text-secondary);
                    box-shadow: none;
                    opacity: 1;
                }

                .theme-mica .card-action-btn:hover,
                .theme-mica .del-btn:hover,
                .theme-acrylic .card-action-btn:hover,
                .theme-acrylic .del-btn:hover {
                    background: rgba(var(--accent-color-rgb), 0.12);
                    color: var(--accent-color);
                }

                .theme-mica .card-body-text,
                .theme-acrylic .card-body-text {
                    flex: 1;
                    padding-top: 12px;
                    font-size: 15px;
                    line-height: 1.7;
                    font-weight: 500;
                    color: var(--text-primary);
                    -webkit-line-clamp: 5;
                    min-height: 122px;
                }

                .theme-mica .items-list .card-body-text,
                .theme-acrylic .items-list .card-body-text {
                    -webkit-line-clamp: 3;
                    min-height: 84px;
                }

                .theme-mica .card-media,
                .theme-acrylic .card-media {
                    flex: 1;
                    min-height: 190px;
                    margin-top: 14px;
                    border: none;
                    border-radius: 18px;
                    background: rgba(127, 140, 160, 0.12);
                    align-items: center;
                }

                .theme-mica .card-media img,
                .theme-acrylic .card-media img {
                    max-width: 100%;
                    max-height: 190px;
                    object-fit: contain;
                    border-radius: 14px;
                }

                .theme-mica .card-divider,
                .theme-acrylic .card-divider {
                    height: 1px;
                    margin: 18px 0 14px;
                    background: var(--panel-divider-color);
                }

                .theme-mica .card-footer,
                .theme-acrylic .card-footer {
                    margin-top: auto;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-secondary);
                    opacity: 1;
                }

                .theme-mica .meta-usage,
                .theme-acrylic .meta-usage {
                    gap: 4px;
                }

                .theme-mica .inline-tag-edit,
                .theme-acrylic .inline-tag-edit,
                .theme-mica .modal-input-field input,
                .theme-acrylic .modal-input-field input {
                    border: var(--input-border);
                    border-radius: var(--input-radius);
                    box-shadow: var(--input-shadow);
                    padding: 8px 10px;
                    outline: none;
                }

                .theme-mica .modal-input-field textarea,
                .theme-acrylic .modal-input-field textarea {
                    background: var(--bg-input) !important;
                    border: var(--input-border) !important;
                    border-radius: 4px !important;
                    box-shadow: var(--input-shadow) !important;
                    color: var(--text-primary) !important;
                }

                .theme-mica .modal-buttons button,
                .theme-acrylic .modal-buttons button {
                    border: var(--button-border);
                    border-radius: var(--button-radius);
                    box-shadow: var(--button-shadow);
                }

                .dark-mode .theme-mica .tag-search-box,
                .dark-mode .theme-acrylic .tag-search-box,
                .dark-mode .theme-mica .tag-sidebar,
                .dark-mode .theme-acrylic .tag-sidebar,
                .dark-mode .theme-mica .tag-content,
                .dark-mode .theme-acrylic .tag-content {
                    border-color: rgba(255, 255, 255, 0.08);
                }

                .dark-mode .theme-mica .card-action-btn,
                .dark-mode .theme-mica .del-btn,
                .dark-mode .theme-acrylic .card-action-btn,
                .dark-mode .theme-acrylic .del-btn {
                    background: rgba(22, 28, 39, 0.92);
                    border-color: rgba(255, 255, 255, 0.08);
                }

                .custom-scrollbar::-webkit-scrollbar { width: var(--scrollbar-size-thin); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb-color); border-radius: var(--scrollbar-radius); }

                @media (max-width: 480px) {
                    .themed-tag-manager {
                        flex-direction: column;
                        padding: 8px 12px 12px;
                        gap: 0px;
                    }
                    .tag-sidebar {
                        width: 100% !important;
                        height: var(--tm-sidebar-height, 180px);
                        flex-shrink: 0;
                        margin-bottom: 6px;
                    }
                    .tag-content {
                        min-height: 200px;
                        margin-top: 6px;
                    }
                }

                .tag-divider {
                    width: 12px;
                    height: 100%;
                    cursor: col-resize;
                    margin: 0 -12px;
                    background: transparent;
                    transition: background 0.2s;
                    position: relative;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                @media (max-width: 480px) {
                    .tag-divider {
                        width: 100% !important;
                        height: 12px !important;
                        cursor: row-resize !important;
                        margin: -6px 0 !important;
                        background: rgba(0, 0, 0, 0) !important;
                        z-index: 1000 !important;
                        position: relative !important;
                        pointer-events: auto !important;
                    }
                }
                .tag-divider:hover, .tag-divider.active {
                    background: rgba(var(--accent-color-rgb), 0.1);
                }
                .tag-divider-handle {
                    width: 1px;
                    height: 32px;
                    background: var(--accent-color);
                    opacity: 0.22;
                    border-radius: 2px;
                    transition: opacity 0.2s, height 0.2s, width 0.2s;
                }
                @media (max-width: 480px) {
                    .tag-divider-handle {
                        width: 32px !important;
                        height: 1px !important;
                    }
                }
                .tag-divider:hover .tag-divider-handle, .tag-divider.active .tag-divider-handle {
                    opacity: 0.6;
                }
                .tag-divider:not(.stacked-divider):hover .tag-divider-handle, 
                .tag-divider:not(.stacked-divider).active .tag-divider-handle {
                    height: 48px;
                }
                @media (max-width: 480px) {
                    .tag-divider:hover .tag-divider-handle, .tag-divider.active .tag-divider-handle {
                        width: 48px !important;
                    }
                }

                /* Multi-selection Management Styles */
                .toolbar-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }



                .selection-indicator {
                    width: 12px;
                    height: 12px;
                    border: 2px solid var(--border);
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    background: var(--bg-main);
                }
                .selection-indicator.checked {
                    background: var(--accent-color);
                    border-color: var(--accent-color);
                }
                .inner-check {
                    width: 6px;
                    height: 3px;
                    border-left: 2px solid white;
                    border-bottom: 2px solid white;
                    transform: rotate(-45deg);
                    opacity: 0;
                    transition: opacity 0.2s;
                    margin-top: -1px;
                }
                .selection-indicator.checked .inner-check {
                    opacity: 1;
                }

                .manage-mode .themed-card {
                    border-color: var(--border);
                }
                .manage-mode .themed-card:hover {
                    border-color: var(--accent-light);
                    transform: none;
                    box-shadow: none;
                }
                .manage-mode .themed-card.selected {
                    background: rgba(var(--accent-color-rgb), 0.05);
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 1px var(--accent-color);
                }

                /* Ensure card top row shows up in manage mode to hold selection indicator */
                .manage-mode .themed-card .card-top-row {
                    opacity: 1 !important;
                }
                .manage-mode .card-actions-left {
                    display: flex !important;
                }
                .manage-mode .card-top-row {
                    right: auto !important;
                    left: 14px !important;
                }


                .theme-mica .selection-indicator, .theme-acrylic .selection-indicator {
                    border-radius: 2px;
                    border-color: rgba(var(--accent-color-rgb), 0.2);
                }
                
                .theme-mica .manage-mode .themed-card.selected,
                .theme-acrylic .manage-mode .themed-card.selected {
                    background: rgba(var(--accent-color-rgb), 0.08);
                    box-shadow: 0 12px 28px rgba(var(--accent-color-rgb), 0.15);
                }

                /* Ensure tag-content is the anchor for positioning */
                .tag-content {
                    position: relative;
                }

                .tag-manager-textarea {
                    display: block !important;
                    width: 100% !important;
                    max-width: 232px !important;
                    height: 96px !important;
                    min-height: 96px !important;
                    margin: 0 auto !important;
                    padding: 8px 12px 9px 12px !important;
                    border-radius: 4px !important;
                    border: 1px solid var(--line-soft) !important;
                    border-bottom: 1px solid var(--text-secondary) !important;
                    background: var(--bg-input) !important;
                    box-shadow: var(--input-shadow) !important;
                    color: var(--text-primary) !important;
                    font-family: inherit !important;
                    font-size: 14px !important;
                    line-height: 20px !important;
                    outline: none !important;
                    resize: vertical !important;
                    box-sizing: border-box !important;
                    transition: border-color 0.15s ease, border-bottom-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease !important;
                }

                .tag-manager-textarea:hover {
                    border-color: var(--text-secondary) !important;
                    background: var(--bg-input-hover, var(--bg-input)) !important;
                }

                .tag-manager-textarea:focus {
                    border-color: var(--line-soft) !important;
                    border-bottom: 2px solid var(--accent-color) !important;
                    padding-bottom: 8px !important;
                    box-shadow: 0 0 0 1px var(--accent-color) !important;
                }

                .tag-search-box {
                    overflow: visible !important;
                }
                .tag-search-box.suggestions-open {
                    border-bottom-left-radius: 0 !important;
                    border-bottom-right-radius: 0 !important;
                }
                .tag-suggestions-dropdown {
                    position: absolute;
                    top: 100% !important;
                    left: 0 !important;
                    right: 0 !important;
                    margin-top: 0 !important;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    background: rgba(252, 252, 252, 0.99) !important;
                    border: 1px solid rgba(0,0,0,0.08) !important;
                    border-top: none !important;
                    border-radius: 0 0 4px 4px !important;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.14) !important;
                    padding: 4px;
                    z-index: 1000;
                    max-height: 240px;
                    overflow-y: auto;
                    animation: suggestMenuIn 0.20s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .dark-mode .tag-suggestions-dropdown {
                    background: rgba(36, 36, 36, 0.99) !important;
                    border-color: rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3) !important;
                }
                .tag-suggestions-dropdown .tag-item {
                    position: relative !important;
                    display: flex !important;
                    align-items: center !important;
                    width: auto !important;
                    height: 32px !important;
                    min-height: 32px !important;
                    padding: 0 10px !important;
                    margin: 0 !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                    background: transparent !important;
                    border: 1px solid transparent !important;
                    gap: 10px !important;
                    box-sizing: border-box !important;
                    transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease !important;
                }
                .tag-suggestions-dropdown .tag-item:hover {
                    background: rgba(0, 0, 0, 0.06) !important;
                    border-color: transparent !important;
                }
                .dark-mode .tag-suggestions-dropdown .tag-item:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                }
                .tag-suggestions-dropdown .tag-item.active {
                    background: rgba(0, 0, 0, 0.06) !important;
                    border-color: transparent !important;
                    box-shadow: none !important;
                }
                .dark-mode .tag-suggestions-dropdown .tag-item.active {
                    background: rgba(255, 255, 255, 0.08) !important;
                }
                .tag-suggestions-dropdown .tag-item.active::before {
                    content: "" !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 50% !important;
                    transform: translateY(-50%) !important;
                    width: 3px !important;
                    height: 16px !important;
                    border-radius: 1.5px !important;
                    background: var(--accent-color) !important;
                }
                .tag-suggestions-dropdown .tag-item .tag-color-wrapper {
                    width: 18px !important;
                    height: 18px !important;
                    margin: 0 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .tag-suggestions-dropdown .tag-item .tag-name-area,
                .tag-suggestions-dropdown .tag-item .tag-name {
                    display: flex !important;
                    align-items: center !important;
                    font-size: 13px !important;
                    color: var(--text-primary) !important;
                }
                @keyframes suggestMenuIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div >
    );
}
