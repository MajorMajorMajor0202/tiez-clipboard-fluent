import { mockIPC, mockWindows, mockConvertFileSrc } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';
import { createRoot } from 'react-dom/client';
import DesktopStickerWindow from '../src/features/sticker/components/DesktopStickerWindow';
import TieZFluentProvider from '../src/shared/components/TieZFluentProvider';
import { fitStickerImage } from '../src/features/sticker/lib/stickerPresentation';
import type { ClipboardEntry } from '../src/shared/types';
import '../src/index.css';
import '../src/styles/themes/load';

const kind = new URLSearchParams(location.search).get('kind') || 'text';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#387ca4"/><circle cx="800" cy="450" r="180" fill="#ecddab"/></svg>';
let item: ClipboardEntry = { id: 1, content: kind === 'image' ? `data:image/svg+xml,${encodeURIComponent(svg)}` : kind === 'file' ? 'C:\\Documents\\测试文档.pdf' : '第一行文本\n第二行文本', content_type: kind, timestamp: 1, is_pinned: false } as ClipboardEntry;
let settings: Record<string, string> = { 'app.theme': 'mica', 'app.color_mode': 'light' };
const commands: { command: string; payload: any }[] = [];
let failSave = false;
let failMaterial = false;
mockWindows('sticker-1'); mockConvertFileSrc('windows');
mockIPC((command, payload) => {
  commands.push({ command, payload: JSON.parse(JSON.stringify(payload || {})) });
  if (command === 'get_settings') return { ...settings };
  if (command === 'get_clipboard_entry_by_id') return { ...item };
  if (command === 'get_file_icon') return null;
  if (command === 'set_sticker_backdrop' && failMaterial) throw new Error('fixture material failure');
  if (command === 'plugin:window|inner_size') return { width: innerWidth, height: innerHeight };
  if (command === 'plugin:window|scale_factor') return 1;
  if (command === 'update_item_content') {
    if (failSave) throw new Error('fixture save failure');
    item = { ...item, content: (payload as { newContent: string }).newContent }; return null;
  }
  return null;
}, { shouldMockEvents: true });
document.documentElement.classList.add('is-sticker-window'); document.body.classList.add('is-sticker-window');
Object.assign(window, { stickerTest: { commands, fitStickerImage,
  settings: async (next: Record<string, string>) => { settings = next; await emit('settings-changed'); },
  failSave: (value: boolean) => { failSave = value; },
  failMaterial: (value: boolean) => { failMaterial = value; },
} });
createRoot(document.getElementById('root')!).render(<TieZFluentProvider><DesktopStickerWindow /></TieZFluentProvider>);
