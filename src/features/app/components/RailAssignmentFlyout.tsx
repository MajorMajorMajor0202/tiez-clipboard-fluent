import { useEffect, useRef, useState } from 'react';
import { Input, Popover, PopoverSurface } from '@fluentui/react-components';
import { Check, Folder, Plus, Tag, Trash2 } from 'lucide-react';
import type { TabItem } from '../types';

export interface RailAssignmentTarget { kind: 'tag' | 'tab'; itemId: number; rect: DOMRect; trigger: HTMLElement }
interface Props {
  target: RailAssignmentTarget;
  tags: string[];
  allTags: string[];
  tagLabels?: Record<string, string>;
  tabs: TabItem[];
  assignedTabIds: string[];
  onClose: () => void;
  onToggleTag: (name: string) => void;
  onToggleTab: (id: string) => void;
  onCreateTab: (name: string) => void;
  onDeleteTab: (id: string) => void;
}

/** Mounted outside the virtual list: rail commands remain usable for offscreen items. */
export default function RailAssignmentFlyout({ target, tags, allTags, tagLabels = {}, tabs, assignedTabIds, onClose, onToggleTag, onToggleTab, onCreateTab, onDeleteTab }: Props) {
  const [query, setQuery] = useState('');
  const [positioned, setPositioned] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!positioned) return;
    // The overflow menu restores its own focus when it unmounts. Hand focus to
    // this replacement popup after that commit, once positioning has finished.
    const frame = requestAnimationFrame(() => surface.current?.querySelector('input')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [positioned]);
  const tagMode = target.kind === 'tag';
  const options = tagMode ? [...new Set([...tags, ...allTags])].map(id => ({ id, name: tagLabels[id] || id })) : tabs.filter(tab => !tab.isBuiltin && tab.id !== 'clipboard');
  const filtered = options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()));
  const exact = options.find(option => option.name.toLowerCase() === query.trim().toLowerCase());
  const applyQuery = () => {
    const name = query.trim();
    if (!name) return;
    if (tagMode) onToggleTag(exact?.id || name);
    else if (exact) onToggleTab(exact.id);
    else onCreateTab(name);
    setQuery('');
  };
  return <Popover open onOpenChange={(_event, data) => { if (!data.open) onClose(); }} positioning={{
    position: 'before', align: 'start', offset: 8, autoSize: 'height', overflowBoundaryPadding: 8,
    target: { getBoundingClientRect: () => target.trigger.isConnected ? target.trigger.getBoundingClientRect() : target.rect },
    onPositioningEnd: () => setPositioned(true),
  }}>
    <PopoverSurface ref={surface} className="rail-assignment-flyout window-no-drag" aria-label={tagMode ? '设置标签' : '归入标签页'} style={{ visibility: positioned ? 'visible' : 'hidden' }}>
      <Input aria-label={tagMode ? '标签名称' : '标签页名称'} placeholder={tagMode ? '搜索或新建标签' : '搜索或新建标签页'} value={query}
        onChange={event => setQuery(event.target.value)} contentBefore={tagMode ? <Tag size={14} /> : <Folder size={14} />}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); applyQuery(); } }} />
      <div className="rail-assignment-options">
        {filtered.map(option => {
          const assigned = (tagMode ? tags : assignedTabIds).includes(option.id);
          return <div className="rail-assignment-option" key={option.id}>
            <button type="button" className="rail-assignment-choice" aria-pressed={assigned} onClick={() => tagMode ? onToggleTag(option.id) : onToggleTab(option.id)}>
              {tagMode ? <Tag size={14} /> : <Folder size={14} />}<span>{option.name}</span>{assigned && <Check size={14} />}
            </button>
            {!tagMode && <button type="button" className="rail-assignment-delete" aria-label={`删除标签页 ${option.name}`} onClick={() => onDeleteTab(option.id)}><Trash2 size={13} /></button>}
          </div>;
        })}
        {query.trim() && !exact && <button type="button" className="rail-assignment-choice" onClick={applyQuery}><Plus size={14} /><span>新建“{query.trim()}”</span></button>}
        {!filtered.length && !query.trim() && <div className="rail-assignment-empty">{tagMode ? '暂无标签，输入名称即可添加' : '暂无自定义标签页'}</div>}
      </div>
    </PopoverSurface>
  </Popover>;
}
