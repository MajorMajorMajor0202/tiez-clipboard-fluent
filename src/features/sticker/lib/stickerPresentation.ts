import { convertFileSrc } from '@tauri-apps/api/core';
import type { ClipboardEntry } from '../../../shared/types';

export const STICKER_IMAGE_LIMIT = 640;
export const isStickerFile = (item: ClipboardEntry) => ['image', 'file', 'video'].includes(item.content_type);

export function stickerFilePaths(item: ClipboardEntry) {
  return item.content_type === 'image' ? [item.content] : item.content.split(/\r?\n/).map(path => path.trim()).filter(Boolean);
}

export function stickerImageSource(item: ClipboardEntry): string | null {
  const paths = stickerFilePaths(item);
  if (item.content_type !== 'image' && !(item.content_type === 'file' && paths.length === 1 && /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i.test(paths[0]))) return null;
  const path = paths[0];
  if (/^(data:|https?:|asset:|blob:)/i.test(path)) return path;
  if (item.content_type === 'image' && /^(iVBOR|\/9j\/|R0lG|UklGR)/.test(path)) return `data:image/${path.startsWith('R0lG') ? 'gif' : path.startsWith('/9j/') ? 'jpeg' : path.startsWith('UklGR') ? 'webp' : 'png'};base64,${path}`;
  if (!/^(file:|[a-z]:[\\/]|\/)/i.test(path)) return `data:image/${path.startsWith('R0lG') ? 'gif' : path.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${path}`;
  if (path.startsWith('file:')) {
    const url = new URL(path);
    const decoded = decodeURIComponent(url.pathname).replace(/^\/([a-z]:)/i, '$1');
    return convertFileSrc(url.hostname ? `//${url.hostname}${decoded}` : decoded);
  }
  return convertFileSrc(path);
}

export function stickerFileName(item: ClipboardEntry) {
  const paths = stickerFilePaths(item);
  if (item.content_type === 'image' && /^(data:|iVBOR|\/9j\/|R0lG|UklGR)/.test(item.content)) {
    const mime = /^data:image\/([\w+.-]+)/.exec(item.content)?.[1];
    const extension = mime === 'svg+xml' ? 'svg' : mime === 'jpeg' || item.content.startsWith('/9j/') ? 'jpg'
      : mime || (item.content.startsWith('R0lG') ? 'gif' : item.content.startsWith('UklGR') ? 'webp' : 'png');
    return `图片-${item.id}.${extension}`;
  }
  const path = paths[0] || '';
  const name = /^(file:|https?:)/i.test(path) ? decodeURIComponent(new URL(path).pathname.split('/').pop() || '文件') : path.split(/[\\/]/).pop() || '文件';
  return paths.length > 1 ? `${name} 等 ${paths.length} 个文件` : name;
}

export function fitStickerImage(width: number, height: number, availableWidth = 800, availableHeight = 800) {
  const limitWidth = Math.min(STICKER_IMAGE_LIMIT, Math.max(64, availableWidth * .8));
  const limitHeight = Math.min(STICKER_IMAGE_LIMIT, Math.max(64, availableHeight * .8));
  const maximumScale = Math.min(limitWidth / Math.max(1, width), limitHeight / Math.max(1, height));
  const minimumScale = Math.max(64 / Math.max(1, width), 64 / Math.max(1, height));
  const scale = Math.min(maximumScale, Math.max(Math.min(1, maximumScale), minimumScale));
  return { width: Math.max(64, Math.round(width * scale)), height: Math.max(64, Math.round(height * scale)) };
}

export function stickerCardSize(item: ClipboardEntry) {
  if (isStickerFile(item)) return { width: 320, height: 140 };
  return item.content_type === 'code' || item.content.length > 200 ? { width: 340, height: 240 } : { width: 260, height: 150 };
}
