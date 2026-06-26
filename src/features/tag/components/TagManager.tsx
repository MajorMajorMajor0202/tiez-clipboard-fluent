import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import {
    Edit2, Trash2, X, ChevronRight, LayoutGrid, List,
    Clock, MousePointer2, ChevronLeft, Plus, Search, ExternalLink, CheckSquare, Copy
} from 'lucide-react';
import { getTagColor } from "../../../shared/lib/utils";
import FluentTooltip from "../../../shared/components/FluentTooltip";
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
    const TAG_MANAGER_VIEW_MODE_KEY = "tiez_tag_manager_view_mode";
    const [tags, setTags] = useState<TagInfo[]>([]);
    const [tagSearch, setTagSearch] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [tagItems, setTagItems] = useState<ClipboardEntry[]>([]);
    const [tagColors, setTagColors] = useState<Record<string, string>>({});
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
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: number, content: string } | null>(null);
    const [newItemContent, setNewItemContent] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(128);
    const [sidebarHeight, setSidebarHeight] = useState(180);
    const [isResizing, setIsResizing] = useState(false);
    const [isStacked, setIsStacked] = useState(false);
    const [isManageMode, setIsManageMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

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
        const mediaQuery = window.matchMedia("(max-width: 340px)");
        const updateLayoutMode = () => {
            setIsStacked(mediaQuery.matches);
        };

        updateLayoutMode();
        mediaQuery.addEventListener("change", updateLayoutMode);

        return () => mediaQuery.removeEventListener("change", updateLayoutMode);
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (event: MouseEvent) => {
            const bounds = containerRef.current?.getBoundingClientRect();
            if (!bounds) return;
            if (isStacked) {
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

        document.body.style.cursor = isStacked ? "row-resize" : "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isResizing, isStacked]);

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
        const trimmed = rawName.trim();
        if (!trimmed) return;

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

        if (oldName === 'sensitive' || oldName === '密码') {
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
        if (tagName === 'sensitive' || tagName === '密码') return;
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

    const normalizedTagSearch = tagSearch.trim().toLowerCase();
    const canCreateTag = normalizedTagSearch.length > 0
        && !tags.some(tag => tag.name.toLowerCase() === normalizedTagSearch);

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
            className={`themed-tag-manager theme-${theme} ${isCollapsed ? 'sidebar-collapsed' : ''} ${isStacked ? 'stacked-layout' : ''}`}
            style={{ 
                ["--tm-sidebar-width" as any]: isCollapsed ? '48px' : `${sidebarWidth}px`,
                ["--tm-sidebar-height" as any]: `${sidebarHeight}px`
            } as any}
            onMouseDown={() => invoke('activate_window_focus').catch(console.error)}
        >
            {/* Sidebar with CRUD support */}
            {/* Sidebar with Unified Search & Create */}
            <div className="tag-sidebar">

                {!isCollapsed && (
                    <div className="tag-search-box">
                        <div className="search-input-wrapper">
                            <Search size={12} className="search-icon-placeholder" />
                            <input
                                placeholder={t('find_or_create')}
                                value={tagSearch}
                            onMouseDown={() => invoke('activate_window_focus').catch(console.error)}
                            onFocus={() => invoke('activate_window_focus').catch(console.error)}
                            onChange={e => setTagSearch(e.target.value)}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter' && tagSearch.trim()) {
                                    // If exact match exists, select it. If not, create new.
                                    const exactMatch = tags.find(t => t.name.toLowerCase() === normalizedTagSearch);
                                    if (exactMatch) {
                                        loadTagItems(exactMatch.name);
                                    } else {
                                        await createTag(tagSearch);
                                    }
                                }
                            }}
                        />
                            {tagSearch ? (
                                <div className="action-icons">
                                    {canCreateTag ? (
                                        <span
                                            title={t('create_new_tag_tooltip')}
                                            className="action-icon create"
                                            onClick={() => createTag(tagSearch)}
                                        >
                                            <Plus size={12} />
                                        </span>
                                    ) : null}
                                    <X size={12} className="action-icon clear" onClick={() => setTagSearch('')} />
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                <div className="tag-scroll custom-scrollbar">
                    {filteredTags.map(tag => (
                        <div
                            key={tag.name}
                            className={`tag-item ${selectedTag === tag.name ? 'active' : ''} ${(tag.name !== 'sensitive' && tag.name !== '密码') ? 'has-actions' : ''}`}
                            onClick={() => loadTagItems(tag.name)}
                            title={tag.name}
                        >
                            <div className="tag-color-wrapper" onClick={(e) => e.stopPropagation()}>
                                <div
                                    className="tag-color-dot"
                                    style={{ background: tagColors[tag.name] || getTagColor(tag.name, theme) }}
                                    onClick={() => document.getElementById(`color-picker-${tag.name}`)?.click()}
                                />
                                <input
                                    type="color"
                                    id={`color-picker-${tag.name}`}
                                    style={{ display: 'none' }}
                                    value={tagColors[tag.name] || '#888888'} // Approximation if not set, or maybe convert HSL to Hex?
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
                                    <span className="tag-name">{tag.name}</span>
                                    {(tag.name !== 'sensitive' && tag.name !== '密码') && (
                                        <div className="tag-hover-actions">
                                            <span title="重命名" onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTag(tag.name);
                                                setNewTagName(tag.name);
                                            }}>
                                                <Edit2 size={13} />
                                            </span>
                                            <span title="删除" onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setDeleteConfirmation({ show: true, tagName: tag.name });
                                            }}>
                                                <Trash2 size={13} />
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredTags.length === 0 && !tagSearch.trim() && (
                        <div className="sidebar-status">{t('no_tags')}</div>
                    )}
                    {/* Visual cue for creating new tag when filtering shows no results */}
                    {!isCollapsed && canCreateTag && filteredTags.length === 0 && (
                        <div className="tag-item create-hint" onClick={() => createTag(tagSearch)}>
                            <div className="tag-color-dot" style={{ border: '1px dashed currentColor', background: 'transparent' }} />
                            <span className="tag-name" style={{ opacity: 0.7 }}>{t('create_tag_hint').replace('{tag}', tagSearch.trim())}</span>
                            <Plus size={10} />
                        </div>
                    )}
                </div>

                <div className="sidebar-header">
                    <button
                        className="collapse-toggle"
                        title={isCollapsed ? (t('open') || '展开') : (t('collapse') || '收起')}
                        onClick={() => {
                            const newCollapsed = !isCollapsed;
                            setIsCollapsed(newCollapsed);
                            if (!newCollapsed && sidebarWidth < 108) {
                                setSidebarWidth(160);
                            }
                        }}
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div 
                    className={`tag-divider ${isResizing ? 'active' : ''} ${isStacked ? 'stacked' : ''}`}
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
                            <span className="breadcrumb-marker">#</span>
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
                                            <button className="toolbar-btn danger" disabled={selectedItemIds.size === 0} onClick={() => setItemDeleteConfirmation({ show: true, id: -1 })}>
                                                <Trash2 size={14} /> <span>{t('delete_selected') || '删除'}</span>
                                            </button>
                                            <button className="toolbar-btn accent" disabled={selectedItemIds.size === 0} onClick={async () => {
                                                const selectedItems = tagItems.filter(item => selectedItemIds.has(item.id));
                                                if (selectedItems.length > 0) {
                                                    await invoke('copy_to_clipboard', { content: selectedItems.map(i => i.content).join('\n'), contentType: 'text', paste: true, id: -1, deleteAfterUse: false });
                                                    setIsManageMode(false); setSelectedItemIds(new Set());
                                                }
                                            }}>
                                                <Copy size={14} /> <span>{t('copy_selected') || '复制'}</span>
                                            </button>
                                        </>
                                    ) : (
                                        <button className="toolbar-btn ghost" onClick={() => setIsManageMode(true)} title={t('manage_items') || '管理条目'}>
                                            <CheckSquare size={14} /> <span>{t('manage') || '管理'}</span>
                                        </button>
                                    )}
                                    {!isManageMode && (
                                        <button className="toolbar-btn primary" onClick={() => setIsCreatingItem(true)} title={t('add_item') || '新建条目'}>
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
                            <button className="toolbar-btn ghost" onClick={() => setShowSortMenu(prev => !prev)} onBlur={() => setTimeout(() => setShowSortMenu(false), 150)}>
                                {sortBy === 'time' ? <Clock size={14} /> : <MousePointer2 size={14} />}
                                <span>{sortBy === 'time' ? (t('sort_time') || '时间') : (t('sort_usage') || '频率')}</span>
                                <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} />
                            </button>
                            {showSortMenu && (
                                <div className="sort-menu" style={{ top: sortBy === 'time' ? '-4px' : '-32px' }}>
                                    <button className={sortBy === 'time' ? 'active' : ''} onMouseDown={() => { setSortBy('time'); setShowSortMenu(false); }}>
                                        <Clock size={14} /> <span>{t('sort_time') || '时间'}</span>
                                    </button>
                                    <button className={sortBy === 'count' ? 'active' : ''} onMouseDown={() => { setSortBy('count'); setShowSortMenu(false); }}>
                                        <MousePointer2 size={14} /> <span>{t('sort_usage') || '频率'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="view-toggle">
                            <FluentTooltip text={t('list_view') || '列表视图'}>
                                <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                                    <List size={14} />
                                </button>
                            </FluentTooltip>
                            <FluentTooltip text={t('grid_view') || '卡片视图'}>
                                <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                                    <LayoutGrid size={14} />
                                </button>
                            </FluentTooltip>
                        </div>
                    </div>
                </div>

                <div className="items-area custom-scrollbar">
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
                                                        <button className="card-action-btn" title="编辑" onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingItem({ id: item.id, content: item.content });
                                                        }}>
                                                            <Edit2 size={10} />
                                                        </button>
                                                    )}
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
                                                        title={t('open')}
                                                    >
                                                        <ExternalLink size={10} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        {!isManageMode && (
                                            <button className="del-btn" title="删除" onClick={(e) => {
                                                e.stopPropagation();
                                                setItemDeleteConfirmation({ show: true, id: item.id });
                                            }}>
                                                <X size={10} />
                                            </button>
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
            </div>

            {/* Modals for Create (Rename is handled inline now) */}
            {/* Kept minimal if needed for future extensions, but currently inline handles rename */}

            {/* Tag Delete Confirmation Modal */}
            {deleteConfirmation.show && (
                <div className="modal-overlay" onClick={() => setDeleteConfirmation({ show: false, tagName: null })}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={(e) => e.stopPropagation()}>
                        <h3>{t('confirm_delete')}</h3>
                        <p>
                            {t('confirm_delete_tag')}
                            <br />
                            <span className="tag-highlight" style={{ marginTop: '8px', display: 'inline-block' }}>
                                {deleteConfirmation.tagName}
                            </span>
                        </p>
                        <div className="confirm-dialog-buttons">
                            <button className="confirm-dialog-button" onClick={() => setDeleteConfirmation({ show: false, tagName: null })}>
                                {t('cancel')}
                            </button>
                            <button className="confirm-dialog-button primary" onClick={() => {
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
            )}

            {/* Item Delete Confirmation Modal */}
            {itemDeleteConfirmation.show && (
                <div className="modal-overlay" onClick={() => setItemDeleteConfirmation({ show: false, id: null })}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={e => e.stopPropagation()}>
                        <h3>{t('confirm_delete')}</h3>
                        <p>{t('confirm_delete_desc') || "确定要删除这条记录吗？"}</p>
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
            )}

            {/* Create Item Modal */}
            {isCreatingItem && (
                <div className="modal-overlay" onClick={() => setIsCreatingItem(false)}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={e => e.stopPropagation()}>
                        <h3>{t('add_item')}</h3>
                        <div className="modal-input-field">
                            <textarea
                                className="tag-manager-textarea"
                                value={newItemContent}
                                onChange={e => setNewItemContent(e.target.value)}
                                placeholder={t('input_content_placeholder')}
                                autoFocus
                            />
                        </div>
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
            )}

            {/* Edit Item Modal */}
            {editingItem && (
                <div className="modal-overlay" onClick={() => setEditingItem(null)}>
                    <div className={`confirm-dialog tag-manager-dialog theme-${theme}`} onClick={e => e.stopPropagation()}>
                        <h3>{t('edit_item')}</h3>
                        <div className="modal-input-field">
                            <textarea
                                className="tag-manager-textarea"
                                value={editingItem.content}
                                onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                                autoFocus
                            />
                        </div>
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
            )}
            <style>{`
                .themed-tag-manager {
                    display: grid;
                    grid-template-columns: var(--tag-sidebar-width, 130px) auto 1fr;
                    height: 100%;
                    background: var(--bg-content);
                    font-family: var(--font-main, ui-monospace, monospace);
                    color: var(--text-primary);
                    gap: 0;
                    padding: 0;
                }

                /* Sidebar */
                .tag-sidebar {
                    width: var(--tag-sidebar-width, 130px);
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-panel);
                    border-radius: 0;
                    box-shadow: none;
                    overflow: hidden;
                    border: var(--panel-border);
                }
                .sidebar-collapsed .tag-sidebar { width: 48px; }
                
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
                    padding: 0 10px;
                    display: flex; align-items: center; gap: 4px;
                    background: transparent;
                    border-bottom: 1px solid var(--panel-divider-color);
                    margin: 8px 8px 0;
                    height: 32px;
                    min-height: 32px;
                }
                .tag-search-box .search-input-wrapper {
                    flex: 1;
                    position: relative;
                    min-width: 0;
                }
                .tag-search-box .search-icon-placeholder {
                    position: absolute;
                    left: 0;
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
                    padding: 0 8px 0 12px;
                    height: 30px;
                    border-radius: 4px;
                    transition: all 0.2s;
                    position: relative;
                    z-index: 1;
                }
                .tag-search-box input:focus {
                    border-color: var(--accent-color);
                    background: var(--bg-panel);
                    box-shadow: 0 0 0 3px var(--accent-light);
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

                .tag-scroll { flex: 1; overflow-y: auto; padding: 8px; overflow-x: hidden; }
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

                .sidebar-collapsed .tag-item { justify-content: center; padding: 0 6px; gap: 0; height: 32px; min-height: 32px; }
                .sidebar-collapsed .tag-name,
                .sidebar-collapsed .tag-name-area,
                .sidebar-collapsed .tag-hover-actions { display: none; }
                .sidebar-collapsed .tag-color-wrapper { width: 100%; justify-content: center; }
                .tag-color-wrapper { display: flex; align-items: center; justify-content: center; }
                .tag-color-dot { 
                    width: 10px; 
                    height: 10px; 
                    border-radius: 50%; 
                    flex-shrink: 0; 
                    cursor: pointer; 
                    border: none;
                    transition: transform 0.2s; 
                }
                .tag-color-dot:hover { transform: scale(1.2); }
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
                .tag-item:hover .tag-name-area {
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
                .tag-item.active .tag-hover-actions { display: none !important; }

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

                /* Content Area */
                .tag-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
                .content-toolbar {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    border-bottom: 1px solid var(--panel-divider-color);
                    background: var(--bg-panel);
                    padding: 12px 16px;
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
                    padding: 5px 12px;
                    font-size: 12px;
                    font-weight: 500;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.15s ease, color 0.15s ease;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .toolbar-btn.ghost {
                    background: transparent;
                    border-color: transparent;
                    color: var(--text-secondary);
                }
                .toolbar-btn.ghost:hover { background: rgba(128,128,128,0.1); color: var(--text-primary); }
                .toolbar-btn.primary {
                    background: var(--accent-color);
                    color: #fff;
                    border-color: var(--line-strong);
                }
                .toolbar-btn.primary:hover { filter: brightness(1.1); }
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
                .toolbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                /* Sort dropdown — in-place overlay, equal overhang on both sides */
                .sort-dropdown { position: relative; flex-shrink: 0; }
                .sort-dropdown > .toolbar-btn {
                    border-color: var(--line-soft);
                }
                .sort-dropdown > .toolbar-btn:hover {
                    border-color: var(--line-strong);
                }
                .sort-menu {
                    position: absolute;
                    top: -4px;
                    left: 0;
                    right: -4px;
                    background: var(--flyout-background, var(--bg-panel));
                    border: var(--flyout-border);
                    border-radius: 4px;
                    box-shadow: var(--flyout-shadow);
                    backdrop-filter: var(--flyout-backdrop-filter);
                    -webkit-backdrop-filter: var(--flyout-backdrop-filter);
                    padding: 4px;
                    z-index: 100;
                    animation: sortMenuIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
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
                    padding: 5px 16px;
                    font-size: 12px;
                    font-weight: 500;
                    border: none;
                    border-radius: 4px;
                    background: transparent;
                    color: var(--text-primary);
                    cursor: pointer;
                }
                .sort-menu button:hover { background: rgba(128,128,128,0.08); }
                .sort-menu button.active {
                    color: var(--accent-color);
                    background: rgba(128,128,128,0.06);
                }
                /* Accent indicator pill on selected item — inside the gray rect */
                .sort-menu button.active::before {
                    content: "";
                    position: absolute;
                    left: 4px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 12px;
                    border-radius: 2px;
                    background: var(--accent-color);
                }

                /* Segmented Control — view toggle (List / Grid) */
                .view-toggle {
                    display: inline-flex;
                    gap: 0;
                    padding: 0;
                    border: 1px solid var(--line-strong);
                    border-radius: 4px;
                    background: var(--bg-input);
                    flex-shrink: 0;
                    overflow: hidden;
                }
                .toggle-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 30px;
                    padding: 0;
                    border: none;
                    border-radius: 0;
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: background 0.15s ease;
                }
                .toggle-btn:hover { background: rgba(128,128,128,0.08); }
                .toggle-btn.active { background: var(--accent-color); color: #fff; }
                .toggle-btn.active:hover { background: linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)), var(--accent-color); }

                .items-area { 
                    flex: 1; 
                    overflow-y: auto; 
                    padding: 16px 16px 80px 16px; 
                    background: var(--bg-content); 
                    position: relative;
                }

                .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
                .items-list { display: flex; flex-direction: column; gap: 8px; }

                .themed-card {
                    background: var(--bg-element);
                    border: 1px solid var(--border);
                    padding: 12px; cursor: pointer;
                    position: relative;
                    border-radius: var(--radius-md);
                    transition: all 0.15s ease;
                }
                .themed-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px var(--shadow); border-color: var(--accent-color); }

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
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 2000;
                }


                /* Confirm Dialog - Modern Style */
                .modal-overlay .confirm-dialog {
                    background: var(--bg-panel) !important;
                    padding: 24px;
                    border: 1px solid var(--border) !important;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.15) !important;
                    border-radius: var(--radius-lg) !important;
                    width: 400px;
                    max-width: 90%;
                    animation: modal-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                @keyframes modal-pop {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .modal-overlay .confirm-dialog h3 {
                    margin: 0 0 16px 0;
                    font-size: 17px;
                    font-weight: 600;
                    background: transparent !important;
                    color: var(--text-primary) !important;
                    padding: 0;
                    display: block;
                    text-transform: none;
                }

                .modal-overlay .confirm-dialog p {
                    margin: 12px 0 24px 0;
                    font-size: 14px;
                    font-weight: 400;
                    line-height: 1.5;
                    color: var(--text-secondary);
                }

                .modal-overlay .confirm-dialog-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }

                .modal-overlay .confirm-dialog-button {
                    padding: 8px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    background: var(--bg-main) !important;
                    border: 1px solid var(--border) !important;
                    color: var(--text-primary) !important;
                    box-shadow: none !important;
                    transition: all 0.15s;
                    border-radius: var(--radius-sm);
                }
                .modal-overlay .confirm-dialog-button:hover {
                    background: var(--border-light) !important;
                }
                .modal-overlay .confirm-dialog-button:active {
                    transform: scale(0.98);
                    box-shadow: none !important;
                }

                .modal-overlay .confirm-dialog-button.primary {
                    background: var(--accent-color) !important;
                    color: #fff !important;
                    border: none !important;
                }
                .modal-overlay .confirm-dialog-button.primary:hover {
                    background: var(--accent-color-dark) !important;
                }

                /* Modern Theme Polishes for Confirm Dialog */
                .theme-mica .confirm-dialog,
                .theme-acrylic .confirm-dialog {
                    background: rgba(255, 255, 255, 0.8) !important;
                    backdrop-filter: blur(20px);
                    padding: 24px !important;
                    border-radius: 4px !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important;
                    border: 1px solid rgba(255,255,255,0.4) !important;
                    animation: modal-pop-modern 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                }
                
                @keyframes modal-pop-modern {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .theme-mica .confirm-dialog h3,
                .theme-acrylic .confirm-dialog h3 {
                    background: transparent !important;
                    color: var(--text-primary) !important;
                    font-size: 18px !important;
                    font-weight: 700 !important;
                    text-transform: none !important;
                    padding: 0 !important;
                }

                .theme-mica .confirm-dialog-button,
                .theme-acrylic .confirm-dialog-button {
                    border-radius: 4px !important;
                    border: none !important;
                    box-shadow: none !important;
                    font-weight: 600 !important;
                    background: rgba(0,0,0,0.05) !important;
                }
                .theme-mica .confirm-dialog-button:active,
                .theme-acrylic .confirm-dialog-button:active {
                    transform: scale(0.95);
                }

                .theme-mica .confirm-dialog-button.primary,
                .theme-acrylic .confirm-dialog-button.primary {
                    background: var(--accent-color) !important;
                }

                /* Dark Mode Adaptation */
                .dark-mode .modal-overlay .confirm-dialog {
                    background: #1f1f1f !important;
                    border-color: #000 !important;
                }
                .dark-mode .modal-overlay .confirm-dialog h3 {
                    color: #fff !important;
                }
                .dark-mode .modal-overlay .confirm-dialog p {
                    color: #d1d1d1 !important;
                }
                .dark-mode .theme-mica .confirm-dialog,
                .dark-mode .theme-acrylic .confirm-dialog {
                    background: rgba(30,30,30,0.8) !important;
                    border-color: rgba(255,255,255,0.1) !important;
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
                    gap: 14px;
                    padding: 14px;
                    background: transparent !important;
                    overflow: hidden;
                }

                .theme-mica .tag-sidebar,
                .theme-acrylic .tag-sidebar {
                    width: clamp(196px, 24%, 248px);
                    border: var(--panel-border);
                    border-radius: 4px;
                    background: var(--bg-panel);
                    box-shadow: var(--panel-shadow);
                    overflow: hidden;
                }

                .theme-mica.sidebar-collapsed .tag-sidebar,
                .theme-acrylic.sidebar-collapsed .tag-sidebar {
                    width: 64px;
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
                    padding: 0 10px;
                    gap: 12px;
                    border: var(--input-border);
                    border-radius: 4px;
                    background: var(--bg-input);
                    box-shadow: var(--input-shadow);
                }

                .theme-mica .tag-search-box .search-icon-placeholder,
                .theme-acrylic .tag-search-box .search-icon-placeholder {
                    opacity: 0.5;
                    color: var(--text-secondary);
                }

                 .theme-mica .tag-search-box input,
                .theme-acrylic .tag-search-box input {
                    padding: 0 8px 0 12px;
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
                    width: 10px;
                    height: 10px;
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

                .theme-mica .tag-item.active .tag-hover-actions,
                .theme-acrylic .tag-item.active .tag-hover-actions {
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

                .theme-mica .tag-content,
                .theme-acrylic .tag-content {
                    min-width: 0;
                    border: var(--panel-border);
                    border-radius: 4px;
                    background: var(--bg-panel);
                    box-shadow: var(--panel-shadow);
                }

                .theme-mica .content-toolbar,
                .theme-acrylic .content-toolbar {
                    padding: 14px 20px;
                    gap: 10px;
                    border-bottom: 1px solid var(--panel-divider-color);
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
                    padding: 6px 16px;
                    font-size: 13px;
                }
                .theme-mica .toolbar-btn.primary,
                .theme-acrylic .toolbar-btn.primary {
                    box-shadow: 0 4px 12px rgba(var(--accent-color-rgb), 0.28);
                    border-color: rgba(var(--accent-color-rgb), 0.18);
                }

                .theme-mica .view-toggle,
                .theme-acrylic .view-toggle {
                    border: 1px solid var(--line-strong);
                    border-radius: 4px;
                    background: var(--bg-input);
                    padding: 0;
                    overflow: hidden;
                }

                .theme-mica .toggle-btn,
                .theme-acrylic .toggle-btn {
                    width: 36px;
                    height: 30px;
                    border-radius: 0;
                    border: none;
                    background: transparent;
                }

                .theme-mica .toggle-btn.active,
                .theme-acrylic .toggle-btn.active {
                    background: var(--accent-color);
                    color: #fff;
                }
                    box-shadow: none;
                }

                .theme-mica .items-area,
                .theme-acrylic .items-area {
                    padding: 28px;
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
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 22px;
                }

                .theme-mica .items-list,
                .theme-acrylic .items-list {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 18px;
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

                @media (max-width: 320px) {
                    .themed-tag-manager {
                        flex-direction: column;
                        padding: 8px;
                        gap: 12px;
                        overflow-y: auto;
                    }
                    .tag-sidebar {
                        width: 100% !important;
                        height: 240px;
                        flex-shrink: 0;
                    }
                    .tag-content {
                        min-height: 300px;
                    }
                }

                .tag-divider {
                    width: 4px;
                    height: 100%;
                    cursor: col-resize;
                    margin: 0;
                    background: transparent;
                    transition: background 0.2s;
                    position: relative;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    justify-content: center;
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
                    transition: opacity 0.2s, height 0.2s;
                }
                .tag-divider:hover .tag-divider-handle, .tag-divider.active .tag-divider-handle {
                    opacity: 0.6;
                    height: 48px;
                }

                /* Multi-selection Management Styles */
                .toolbar-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .sort-dropdown .sort-menu button.sort-option-active {
                    color: var(--accent-color);
                    background: rgba(var(--accent-color-rgb), 0.08);
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

            `}</style>
        </div >
    );
}
