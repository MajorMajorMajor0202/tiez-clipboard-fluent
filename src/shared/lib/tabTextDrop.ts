type Position = { x: number; y: number };
export type DropStamp = { sig: string; time: number; ids?: string };
export function rememberTabTextDrop(stamp: DropStamp, text: string, tabId: string, ids: number[] = []) {
  stamp.sig = `text:${text.trim()}@${tabId}`;
  stamp.time = Date.now();
  stamp.ids = ids.join(",");
}

// WebView2 can report one text drag through both DOM and native drop events.
// Keep identity separate from text: equal text is not proof of equal entries.
export function routeTabTextDrop(payload: unknown, options: {
  stamp: DropStamp;
  draggedIds: () => number[];
  resolveTarget: (position: Position | null, fallback: boolean) => string | null;
  assignExisting: (ids: number[], tabId: string) => void;
  importText: (text: string, tabId: string) => void;
}) {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const text = typeof payload === 'string' ? payload : typeof data.text === 'string' ? data.text : '';
  if (!text.trim()) return;
  const raw = data.position as Partial<Position> | undefined;
  const position = raw && typeof raw.x === 'number' && typeof raw.y === 'number' ? { x:raw.x, y:raw.y } : null;
  const ids = (Array.isArray(data.itemIds) ? data.itemIds : options.draggedIds()).filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id));
  const tabId = options.resolveTarget(position, ids.length === 0);
  if (!tabId) return;
  const sig = `text:${text.trim()}@${tabId}`;
  if (options.stamp.sig === sig && Date.now() - options.stamp.time < 1500 && (!ids.length || options.stamp.ids === ids.join(','))) return;
  rememberTabTextDrop(options.stamp, text, tabId, ids);
  if (ids.length) options.assignExisting(ids, tabId);
  else options.importText(text.trim(), tabId);
}
