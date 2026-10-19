import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useListQuickPaste } from "../src/shared/hooks/useListQuickPaste";
import { useFilteredHistory } from "../src/shared/hooks/useFilteredHistory";
import ListKeyTip from "../src/shared/components/ListKeyTip";
import type { ClipboardEntry } from "../src/shared/types";
import "../src/index.css";
import "../src/styles/components/index.css";
import "../src/styles/themes/mica.css";

function Fixture() {
  const [workspace, setWorkspace] = useState(false);
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [pasted, setPasted] = useState<number[]>([]);
  const items = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i + 1, content: `Entry ${i + 1}`, content_type: "text", timestamp: 100 - i,
    is_pinned: i === 2, pinned_order: 0,
  } as ClipboardEntry)), []);
  const filtered = useFilteredHistory({ history: items, search, typeFilter: null,
    activeTabId: workspace ? "work" : "clipboard", tabAssignments: { work: [5, 8, 11] } });
  const hints = useListQuickPaste(filtered, enabled, async id => { setPasted(prev => [...prev, id]); });
  return <main style={{ padding: 20 }}>
    <div className="home-search-wrapper"><input aria-label="Search" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <textarea aria-label="Note" />
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
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
