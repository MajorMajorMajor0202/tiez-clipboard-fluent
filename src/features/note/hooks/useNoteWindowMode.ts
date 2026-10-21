import { useCallback, useEffect, useRef, useState } from 'react';
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

type Mode = 'expanded' | 'collapsed' | 'docked';
type Bounds = { x: number; y: number; width: number; height: number };
export function noteTitle(content: string) {
  return content.split(/\r?\n/).map(line => line.trim()).find(Boolean)?.replace(/^#{1,6}\s+|^[-*+]\s+(?:\[[ xX]\]\s*)?/, '').replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim() || '空白便笺';
}

export function dockNoteBounds(area: Bounds, scale: number, y: number, titleWidth = 220) {
  const visible = Math.min(Math.round(Math.max(80, Math.min(220, titleWidth)) * scale), area.width);
  // The close button and trailing corner stay beyond the edge until hovered.
  const width = visible + Math.round(44 * scale);
  const height = Math.min(Math.round(38 * scale), area.height);
  return { x: area.x + area.width - visible, y: Math.max(area.y, Math.min(y, area.y + area.height - height)), width, height };
}

export function useNoteWindowMode(title: string, onError: (message: string) => void, onPinned: () => void) {
  const titleRef = useRef(title); titleRef.current = title;
  const pinnedRef = useRef(onPinned); pinnedRef.current = onPinned;
  const docked = useRef<(Bounds & { reveal: number }) | null>(null);
  const peekQueue = useRef(Promise.resolve());
  const peekRevision = useRef(0);
  const peekX = useRef(0);
  const peek = useCallback((hovered: boolean) => {
    const revision = ++peekRevision.current;
    peekQueue.current = peekQueue.current.then(async () => {
      const bounds = docked.current;
      if (revision !== peekRevision.current || busy.current || modeRef.current !== "docked" || !bounds) return;
      const from = peekX.current;
      const target = bounds.x - (hovered ? bounds.reveal : 0);
      if (from === target) return;
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
      const started = performance.now();
      // Await each native move so slow IPC cannot leave stale frames after restoring.
      do {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (revision !== peekRevision.current || busy.current) return;
        const progress = duration ? Math.min(1, (now - started) / duration) : 1;
        const x = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
        await getCurrentWindow().setPosition(new PhysicalPosition(x, bounds.y));
        peekX.current = x;
        if (progress === 1) return;
      } while (true);
    }).catch(error => errorRef.current(`停靠调整失败：${String(error)}`));
  }, []);
  useEffect(() => () => { ++peekRevision.current; }, []);
  const [mode, setMode] = useState<Mode>('expanded');
  const modeRef = useRef<Mode>('expanded');
  const normal = useRef<Bounds | null>(null);
  const beforeDock = useRef<Mode>('expanded');
  const busy = useRef(false);
  const snapAfter = useRef(0);
  const errorRef = useRef(onError); errorRef.current = onError;
  const set = (value: Mode) => { modeRef.current = value; setMode(value); };
  const change = useCallback(async (action: 'collapse' | 'dock' | 'restore') => {
    if (busy.current) return;
    busy.current = true;
    ++peekRevision.current;
    snapAfter.current = Date.now() + 800;
    const win = getCurrentWindow();
    const previousMode = modeRef.current;
    let previous: Bounds | undefined;
    try {
      await peekQueue.current;
      const [size, position, scale] = await Promise.all([win.innerSize(), win.innerPosition(), win.scaleFactor()]);
      previous = { x: position.x, y: position.y, width: size.width, height: size.height };
      if (previousMode === 'expanded') normal.current = previous;
      else if (previousMode === 'collapsed' && normal.current) normal.current = { ...previous, height: normal.current.height };
      const restoringDock = previousMode === 'docked' && action !== 'collapse';
      const next: Mode = action === 'restore' ? 'expanded' : action === 'dock' ? (restoringDock ? beforeDock.current : 'docked') : previousMode === 'expanded' ? 'collapsed' : 'expanded';
      const saved = normal.current || previous;
      await win.setMaxSize(null);
      if (next === 'docked') {
        const monitor = await currentMonitor();
        if (!monitor) throw new Error('无法获取当前屏幕');
        await win.setAlwaysOnTop(true);
        pinnedRef.current();
        beforeDock.current = previousMode;
        const area = monitor.workArea;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) context.font = '12px "Segoe UI", sans-serif';
        const titleWidth = (context?.measureText(titleRef.current).width ?? 160) + 24;
        const dock = dockNoteBounds({ x: area.position.x, y: area.position.y, width: area.size.width, height: area.size.height }, monitor.scaleFactor, position.y, titleWidth);
        peekX.current = dock.x;
        docked.current = { ...dock, reveal: Math.round(32 * monitor.scaleFactor) };
        await win.setMinSize(new LogicalSize(80, 34));
        await win.setSize(new PhysicalSize(dock.width, dock.height));
        await win.setPosition(new PhysicalPosition(dock.x, dock.y));
        await win.setMinSize(new PhysicalSize(dock.width, dock.height));
        await win.setMaxSize(new PhysicalSize(dock.width, dock.height));
      } else if (next === 'collapsed') {
        await win.setMinSize(new LogicalSize(220, 34));
        await win.setSize(new PhysicalSize(saved.width, Math.round(34 * scale)));
        await win.setMaxSize(new LogicalSize(10000, 34));
        if (previousMode === 'docked') await win.setPosition(new PhysicalPosition(saved.x, saved.y));
      } else {
        await win.setMinSize(new LogicalSize(220, 180));
        await win.setSize(new PhysicalSize(saved.width, saved.height));
        if (previousMode === 'docked') await win.setPosition(new PhysicalPosition(saved.x, saved.y));
      }
      if (next !== "docked") docked.current = null;
      set(next);
    } catch (error) {
      if (previous) {
        await win.setMaxSize(null).catch(() => {});
        await win.setMinSize(new LogicalSize(120, 34)).catch(() => {});
        await win.setSize(new PhysicalSize(previous.width, previous.height)).catch(() => {});
        await win.setPosition(new PhysicalPosition(previous.x, previous.y)).catch(() => {});
      }
      errorRef.current(`窗口调整失败：${String(error)}`);
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const moved = getCurrentWindow().onMoved(async ({ payload: position }) => {
      clearTimeout(timer);
      const requested = ++revision;
      if (disposed || busy.current || Date.now() < snapAfter.current || modeRef.current === 'docked') return;
      const [monitor, size] = await Promise.all([currentMonitor(), getCurrentWindow().innerSize()]).catch(() => [null, null] as const);
      if (disposed || requested !== revision || busy.current || (modeRef.current as Mode) === 'docked' || !monitor || !size) return;
      const right = monitor.workArea.position.x + monitor.workArea.size.width;
      if (Math.abs(position.x + size.width - right) <= 12 * monitor.scaleFactor) timer = setTimeout(() => { if (!disposed) void change('dock'); }, 200);
    });
    const actions = listen<string>('note-window-action', event => {
      if (event.payload === 'collapse' || event.payload === 'dock') void change(event.payload);
    });
    return () => { disposed = true; clearTimeout(timer); for (const pending of [moved, actions]) void pending.then(off => off()).catch(console.error); };
  }, [change]);
  return { mode, peek, toggleCollapse: () => change('collapse'), toggleDock: () => change('dock'), restore: () => change('restore') };
}
