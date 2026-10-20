import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { useNavigationSync } from "../src/shared/hooks/useNavigationSync";
import { listQuickPasteModifiers } from "../src/shared/lib/listQuickPasteModifier";
import FluentDropdown from "../src/shared/components/FluentDropdown";
import TieZFluentProvider from "../src/shared/components/TieZFluentProvider";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useListQuickPaste } from "../src/shared/hooks/useListQuickPaste";
import { useFilteredHistory } from "../src/shared/hooks/useFilteredHistory";
import ListKeyTip from "../src/shared/components/ListKeyTip";
import { writeContentDragData } from "../src/shared/lib/contentDrag";
import type { ClipboardEntry } from "../src/shared/types";
import "../src/index.css";
import "../src/styles/components/index.css";
import "../src/styles/components/compact-mode.css";
import "../src/styles/themes/load";

const nativeFixture = new URLSearchParams(location.search).has('native');
const nativeLog: boolean[] = [];
let resolveVisibility: ((visible: boolean) => void) | undefined;
let nextHeldSnapshot: string | null = null;
let deferHeldSnapshot = false;
let resolveHeldSnapshot: ((action: string) => void) | undefined;
if (nativeFixture) {
  mockWindows('main');
  mockIPC((command, payload) => {
    if (command === 'plugin:window|is_visible') return new Promise<boolean>(resolve => { resolveVisibility = resolve; });
    if (command === 'set_navigation_enabled') nativeLog.push((payload as { enabled: boolean }).enabled);
    if (command === 'get_list_quick_paste_state') {
      if (deferHeldSnapshot) { deferHeldSnapshot = false; return new Promise<string>(resolve => { resolveHeldSnapshot = resolve; }); }
      const action = nextHeldSnapshot; nextHeldSnapshot = null; return action;
    }
    return null;
  }, { shouldMockEvents: true });
}
function NativeSync({ blocked }: { blocked: boolean }) {
  useNavigationSync({ showSettings: blocked, showTagManager: false, showNoteManager: false, chatMode: false, showEmojiPanel: false });
  return null;
}

function Fixture() {
  const [modifier, setModifier] = useState("alt");
  const [workspace, setWorkspace] = useState(false);
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [pasted, setPasted] = useState<number[]>([]);
  const [dragPayload, setDragPayload] = useState('');
  const items = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i + 1, content: `Entry ${i + 1}`, content_type: "text", timestamp: 100 - i,
    is_pinned: i === 2, pinned_order: 0,
  } as ClipboardEntry)), []);
  const filtered = useFilteredHistory({ history: items, search, typeFilter: null,
    activeTabId: workspace ? "work" : "clipboard", tabAssignments: { work: [5, 8, 11] } });
  const hints = useListQuickPaste(filtered, enabled, async id => { setPasted(prev => [...prev, id]); }, modifier);
  return <TieZFluentProvider><main style={{ padding: 20 }}>
    <button onClick={() => {
      const contents = [
        { content_type: 'image', content: 'C:\\Pictures\\测试 #100%.png' },
        { content_type: 'file', content: 'C:\\one.txt\r\nD:\\Folder\\two.txt' },
        { content_type: 'text', content: 'C:\\one.txt' },
      ];
      setDragPayload(JSON.stringify(contents.map(item => {
        const data = new DataTransfer();
        writeContentDragData(data, { id: 1, ...item } as ClipboardEntry);
        return { plain: data.getData('text/plain'), uri: data.getData('text/uri-list'), id: data.getData('application/x-tiez-item') };
      })));
    }}>Inspect drag payloads</button>
    <output data-testid="drag-payload">{dragPayload}</output>
    <div className="home-search-wrapper"><input aria-label="Search" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <FluentDropdown aria-label="Quick paste modifier" options={[...listQuickPasteModifiers]} value={modifier} onChange={setModifier} />
    <textarea aria-label="Note" />
    <div hidden><div role="menu">Retained hidden menu</div></div>
    <div role="listbox" style={{ visibility: 'hidden' }}>Retained hidden listbox</div>
    {nativeFixture && <>
      <NativeSync blocked={!enabled} />
      <button onClick={() => void emit('window-shown')}>Native show</button>
      <button onClick={() => void emit('window-hidden')}>Native hide</button>
      <button onClick={() => { nextHeldSnapshot = 'show'; void emit('window-shown'); }}>Native show held</button>
      <button onClick={() => { deferHeldSnapshot = true; void emit('window-shown'); }}>Native slow show</button>
      <button onClick={() => { resolveHeldSnapshot?.('show'); }}>Resolve stale held</button>
      <button onClick={() => { resolveVisibility?.(false); }}>Resolve stale hidden</button>
      <button onClick={() => void emit('list-quick-paste', 'show')}>Native modifier</button>
      <button onClick={() => void emit('list-quick-paste', 'show-focused')}>Native focused modifier</button>
      <button onClick={() => void emit('list-quick-paste', '1')}>Native digit</button>
      <button onClick={() => void emit('list-quick-paste', 'hide')}>Native handoff</button>
      <button onClick={() => void emit('list-quick-paste', 'released')}>Native release</button>
      <button onClick={() => { document.querySelector('output[data-testid="native-log"]')!.textContent = JSON.stringify(nativeLog); }}>Read native log</button>
      <output data-testid="native-log" />
    </>}
    <button onClick={() => setWorkspace(v => !v)}>Workspace</button>
    <button onClick={() => setCompact(v => !v)}>Compact</button>
    <button onClick={() => setDialog(v => !v)}>Dialog</button>
    <button onClick={() => setEnabled(v => !v)}>Enabled</button>
    {dialog && <div role="dialog">Dialog open</div>}
    <output data-testid="pasted">{JSON.stringify(pasted)}</output>
    {filtered.map(item => <div key={item.id} style={{ height: compact ? 36 : 76, marginBottom: 4 }}><div data-id={item.id}
      className={`history-item ${compact ? "compact" : ""}`} style={{ position: "relative" }}>
      <ListKeyTip hint={hints[item.id]} />
      <div className="item-meta"><span>Source</span><span>10:00</span></div>
      <div className="content-preview">{item.content}</div>
    </div></div>)}
  </main></TieZFluentProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
