import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { createRoot } from 'react-dom/client';
import StickyNoteWindow from '../src/features/note/components/StickyNoteWindow';
import NoteManager from '../src/features/note/components/NoteManager';
import TieZFluentProvider from '../src/shared/components/TieZFluentProvider';
import '../src/index.css';
import '../src/styles/components/index.css';
import '../src/styles/themes/load';

const params = new URLSearchParams(location.search);
const manager = params.has('manager');
let failMaterial = params.has('failMaterial');
let content = '# 测试便笺\n\n正文保持在原来的位置。\n\n- [ ] 待办事项';
const entry = () => ({ id: 1, content, content_type: 'note', preview: '测试便笺', timestamp: Date.now(), tags: [] });
const commands: { command: string; payload: any }[] = [];
mockWindows('note-1');
mockIPC((command, payload) => {
  commands.push({ command, payload });
  if (command === 'get_clipboard_entry_by_id') return entry();
  if (command === 'get_clipboard_history') return [entry()];
  if (command === 'set_note_backdrop' && failMaterial) throw new Error('material unavailable');
  if (command === 'update_item_content') content = (payload as { newContent: string }).newContent;
  return null;
}, { shouldMockEvents: true });
if (!manager) for (const target of [document.documentElement, document.body]) target.classList.add('is-note-window', 'is-sticker-window');
localStorage.setItem('tiez_color_mode', 'light');
localStorage.setItem('note_backdrop_1', 'acrylic');
Object.assign(window, { noteTest: { commands, failMaterial: (value: boolean) => { failMaterial = value; } } });
createRoot(document.getElementById('root')!).render(<TieZFluentProvider>{manager ? <div style={{ height: '100vh' }}><NoteManager t={() => ''} onCreateNote={() => commands.push({ command: 'create', payload: null })} /></div> : <StickyNoteWindow />}</TieZFluentProvider>);
