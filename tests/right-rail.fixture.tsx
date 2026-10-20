import { createRoot } from "react-dom/client";
import { useState } from "react";
import TieZFluentProvider from "../src/shared/components/TieZFluentProvider";
import FluentRightRail from "../src/features/app/components/FluentRightRail";
import "../src/index.css";
import "../src/styles/components/index.css";
import "../src/styles/themes/load";

function Fixture() {
  const [last, setLast] = useState("");
  const action = (name: string) => () => setLast(name);
  const selected = new URLSearchParams(location.search).get("disabled") !== "1";
  return <TieZFluentProvider><div style={{ display: "flex", height: "100vh" }}>
    <main style={{ flex: 1 }}><button>外部按钮</button><output>{last}</output></main>
    <FluentRightRail onOpenAddEntry={action("add")} onOpenAddNote={action("note")} clearHistory={action("clear")}
      hasSelectedItem={selected} canEditContent onCopySelectedItem={action("paste")} onEditContent={action("edit")}
      onOpenContent={action("open")} onAssignTab={action("tab")} onAssignTag={action("tag")}
      onTogglePin={action("pin")} isPinned={false} onPinToDesktop={action("desktop")} onToggleLock={action("lock")} isLocked={false}
      onMoveUp={action("up")} onMoveDown={action("down")} onToggleReveal={action("reveal")} hasSensitiveTag
      onAIAction={action("ai")} canAI onDeleteSelectedItem={event => { event?.stopPropagation(); setLast("delete"); }}
      showTagManager={false} setShowTagManager={action("tags")} tagManagerEnabled
      showNoteManager={false} setShowNoteManager={action("notes")} noteManagerEnabled
      showEmojiPanel={false} setShowEmojiPanel={action("emoji")} emojiPanelEnabled
      chatMode={false} fileServerEnabled onToggleChat={action("chat")} onOpenSettings={action("settings")} t={() => ""} />
  </div></TieZFluentProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
