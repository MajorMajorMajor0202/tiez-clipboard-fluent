import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { createRoot } from 'react-dom/client';
import TagManager from '../src/features/tag/components/TagManager';
import TieZFluentProvider from '../src/shared/components/TieZFluentProvider';
import '../src/index.css';
import '../src/styles/components/index.css';
import '../src/styles/themes/load';
const tags: Record<string, number> = { '工作标签': 3, '其他标签': 1 };
let finishDelete: (() => void) | undefined;
let failCreate = false;
const commands: { command: string; payload: any }[] = [];
mockWindows('main');
mockIPC((command, payload) => {
  commands.push({ command, payload });
  if (command === 'get_all_tags_info') return { ...tags };
  if (command === 'get_tag_colors') return {};
  if (command === 'get_tag_items') return [];
  if (command === 'create_new_tag') {
    if (failCreate) throw new Error('fixture create failure');
    tags[(payload as { tagName: string }).tagName] = 0;
  }
  if (command === 'delete_tag_from_all') return new Promise(resolve => {
    finishDelete = () => { delete tags[(payload as { tagName: string }).tagName]; resolve(null); };
  });
  return null;
}, { shouldMockEvents: true });
Object.assign(window, { tagTest: { commands, finishDelete: () => finishDelete?.(), failCreate: (value: boolean) => { failCreate = value; } } });
const translations: Record<string, string> = { delete: '删除', cancel: '取消', no_tags: '暂无标签' };
createRoot(document.getElementById('root')!).render(<TieZFluentProvider><div style={{ height: '100vh' }}><TagManager t={key => translations[key] || ''} theme="mica" /></div></TieZFluentProvider>);
