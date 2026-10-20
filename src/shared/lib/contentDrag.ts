import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './tauriRuntime';
import type { ClipboardEntry } from '../types';

export const isFileContent = (item: Pick<ClipboardEntry, 'content_type'>) =>
  ['image', 'file', 'video'].includes(item.content_type);

export const canDragNativeFiles = () => isTauriRuntime() && /Win/i.test(navigator.platform);

export const startNativeContentDrag = (item: ClipboardEntry) => {
  const ids = (window as Window & { __tiezDraggedItemIds?: number[] }).__tiezDraggedItemIds;
  return invoke<void>('start_content_drag', {
    content: item.content, contentType: item.content_type, itemIds: ids?.length ? ids : [item.id],
  });
};

export function writeContentDragData(data: DataTransfer, item: ClipboardEntry) {
  data.setData('application/x-tiez-item', String(item.id));
  data.setData('text/tiez-item-id', String(item.id));
  data.effectAllowed = 'copy';
  if (isFileContent(item)) {
    // A path string is not a dragged file. Keep the HTML fallback as URIs only;
    // Windows uses the native Shell data object instead of this fallback.
    const paths = item.content_type === 'image' ? [item.content] : item.content.split(/\r?\n/);
    const uris = paths.map(path => path.trim()).filter(path => path && !path.startsWith('data:')).map(path => {
      if (path.startsWith('file:')) return new URL(path).href;
      const normalized = path.replace(/\\/g, '/');
      const encoded = normalized.split('/').map((segment, index) => index === 0 && /^[a-z]:$/i.test(segment) ? segment : encodeURIComponent(segment)).join('/');
      return new URL(encoded.startsWith('//') ? `file:${encoded}` : encoded.startsWith('/') ? `file://${encoded}` : `file:///${encoded}`).href;
    });
    if (uris.length) data.setData('text/uri-list', uris.join('\r\n'));
    return;
  }
  data.setData('text/plain', item.content_type === 'rich_text' ? item.preview || item.content : item.content);
  if (item.html_content) data.setData('text/html', item.html_content);
}
