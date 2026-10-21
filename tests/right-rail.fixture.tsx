import { createRoot } from "react-dom/client";
import { useState } from "react";
import TieZFluentProvider from "../src/shared/components/TieZFluentProvider";
import FluentRightRail from "../src/features/app/components/FluentRightRail";
import RailAssignmentFlyout, { type RailAssignmentTarget } from "../src/features/app/components/RailAssignmentFlyout";
import type { MouseEvent } from 'react';
import "../src/index.css";
import "../src/styles/components/index.css";
import "../src/styles/themes/load";

function Fixture() {
  const [last, setLast] = useState("");
  const [assignment, setAssignment] = useState<RailAssignmentTarget | null>(null);
  const [tags, setTags] = useState<string[]>(['已有标签']);
  const [assignedTabs, setAssignedTabs] = useState<string[]>([]);
  const [tabs, setTabs] = useState([{ id: 'test', name: '测试工作区' }]);
  const assign = (kind: 'tag' | 'tab') => (event: MouseEvent<HTMLButtonElement>) => setAssignment({ kind, itemId: 1, trigger: event.currentTarget, rect: event.currentTarget.getBoundingClientRect() });
  const action = (name: string) => () => setLast(name);
  const selected = new URLSearchParams(location.search).get("disabled") !== "1";
  return <TieZFluentProvider><div style={{ display: "flex", height: "100vh" }}>
    <main style={{ flex: 1 }}><button>外部按钮</button><output>{last}</output></main>
    <FluentRightRail onOpenAddEntry={action("add")} clearHistory={action("clear")}
      hasSelectedItem={selected} canEditContent onCopySelectedItem={action("paste")} onEditContent={action("edit")}
      onOpenContent={action("open")} onAssignTab={assign('tab')} onAssignTag={assign('tag')}
      onTogglePin={action("pin")} isPinned={false} onPinToDesktop={action("desktop")} onToggleLock={action("lock")} isLocked={false}
      onMoveUp={action("up")} onMoveDown={action("down")} onToggleReveal={action("reveal")} hasSensitiveTag
      onAIAction={action("ai")} canAI onDeleteSelectedItem={event => { event?.stopPropagation(); setLast("delete"); }}
      showTagManager={false} setShowTagManager={action("tags")} tagManagerEnabled
      showNoteManager={false} setShowNoteManager={action("notes")} noteManagerEnabled
      showEmojiPanel={false} setShowEmojiPanel={action("emoji")} emojiPanelEnabled
      chatMode={false} fileServerEnabled onToggleChat={action("chat")} onOpenSettings={action("settings")} t={() => ""} />
    {assignment && <RailAssignmentFlyout key={assignment.kind} target={assignment} tags={tags} allTags={['已有标签', '另一个标签', 'sensitive']} tagLabels={{ sensitive: '敏感' }} tabs={tabs} assignedTabIds={assignedTabs}
      onClose={() => setAssignment(null)} onToggleTag={name => setTags(previous => previous.includes(name) ? previous.filter(tag => tag !== name) : [...previous, name])}
      onToggleTab={id => setAssignedTabs(previous => previous.includes(id) ? previous.filter(tab => tab !== id) : [...previous, id])}
      onCreateTab={name => setTabs(previous => [...previous, { id: name, name }])} onDeleteTab={id => setTabs(previous => previous.filter(tab => tab.id !== id))} />}
  </div></TieZFluentProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
