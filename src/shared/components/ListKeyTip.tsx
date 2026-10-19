import type { QuickPasteHint } from "../../features/clipboard/types";

export default function ListKeyTip({ hint }: { hint?: QuickPasteHint }) {
  if (!hint) return null;
  return <span className="quick-paste-hint" aria-hidden="true" title={hint.combo}>
    {hint.slot === 10 ? '0' : hint.slot}
  </span>;
}
