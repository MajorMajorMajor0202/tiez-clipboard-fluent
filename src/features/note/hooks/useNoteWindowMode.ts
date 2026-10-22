import { useCallback, useEffect, useRef, useState } from 'react';
import { currentMonitor, getCurrentWindow, LogicalSize, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { flushSync } from 'react-dom';
import type { PointerEvent as ReactPointerEvent } from 'react';
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

async function animateBounds(from: Bounds, to: Bounds) {
  const win = getCurrentWindow();
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
  const started = performance.now();
  do {
    const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
    const progress = duration ? Math.min(1, (now - started) / duration) : 1;
    const ease = 1 - (1 - progress) ** 3;
    const value = (key: keyof Bounds) => Math.round(from[key] + (to[key] - from[key]) * ease);
    await Promise.all([win.setSize(new PhysicalSize(value('width'), value('height'))), win.setPosition(new PhysicalPosition(value('x'), value('y')))]);
    if (progress === 1) return;
  } while (true);
}

type DockBounds = Bounds & { reveal: number; scale: number; top: number; bottom: number };
export function useNoteWindowMode(title: string, onError: (message: string) => void, onPinned: () => void) {
  const titleRef = useRef(title); titleRef.current = title;
  const pinnedRef = useRef(onPinned); pinnedRef.current = onPinned;
  const errorRef = useRef(onError); errorRef.current = onError;
  const [mode, setMode] = useState<Mode>('expanded');
  const [transitioning, setTransitioning] = useState(false);
  const modeRef = useRef<Mode>('expanded');
  const normal = useRef<Bounds | null>(null);
  const beforeDock = useRef<Mode>('expanded');
  const busy = useRef(false);
  const docked = useRef<DockBounds | null>(null);
  const motion = useRef(Promise.resolve());
  const revision = useRef(0);
  const hoveredRef = useRef(false);
  const pendingY = useRef<number | null>(null);
  const drag = useRef<{ screenY: number; y: number; targetY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const set = (value: Mode) => { modeRef.current = value; setMode(value); };

  const slide = useCallback((hovered: boolean, slotY?: number) => {
    hoveredRef.current = hovered;
    if (slotY !== undefined && docked.current) docked.current.y = slotY;
    const requested = ++revision.current;
    motion.current = motion.current.then(async () => {
      const bounds = docked.current;
      if (requested !== revision.current || busy.current || modeRef.current !== 'docked' || !bounds || drag.current) return;
      const win = getCurrentWindow();
      const from = await win.innerPosition();
      const targetX = bounds.x - (hovered ? bounds.reveal : 0);
      const targetY = bounds.y;
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
      const started = performance.now();
      do {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        if (requested !== revision.current || busy.current) return;
        const progress = duration ? Math.min(1, (now - started) / duration) : 1;
        const ease = 1 - (1 - progress) ** 3;
        await win.setPosition(new PhysicalPosition(Math.round(from.x + (targetX - from.x) * ease), Math.round(from.y + (targetY - from.y) * ease)));
        if (progress === 1) return;
      } while (true);
    }).catch(error => errorRef.current(`停靠调整失败：${String(error)}`));
  }, []);
  useEffect(() => () => { ++revision.current; }, []);

  const change = useCallback(async (action: 'collapse' | 'dock' | 'restore') => {
    if (busy.current || drag.current) return;
    busy.current = true;
    // Remove the editor from layout before any native resize, without unmounting its draft.
    flushSync(() => setTransitioning(true));
    ++revision.current;
    const win = getCurrentWindow();
    const previousMode = modeRef.current;
    let previous: Bounds | undefined;
    let joined = false;
    try {
      await motion.current;
      const [size, position, scale] = await Promise.all([win.innerSize(), win.innerPosition(), win.scaleFactor()]);
      previous = { x: position.x, y: position.y, width: size.width, height: size.height };
      if (previousMode === 'expanded') normal.current = previous;
      else if (previousMode === 'collapsed' && normal.current) normal.current = { ...previous, height: normal.current.height };
      const next: Mode = action === 'restore' ? 'expanded' : action === 'dock' ? (previousMode === 'docked' ? beforeDock.current : 'docked') : previousMode === 'expanded' ? 'collapsed' : 'expanded';
      const saved = normal.current || previous;
      await win.setMaxSize(null);
      await win.setMinSize(new LogicalSize(80, 34));
      if (next === 'docked') {
        const monitor = await currentMonitor();
        if (!monitor) throw new Error('无法获取当前屏幕');
        await win.setAlwaysOnTop(true); pinnedRef.current();
        beforeDock.current = previousMode;
        const area = monitor.workArea;
        const context = document.createElement('canvas').getContext('2d');
        if (context) context.font = '12px "Segoe UI", sans-serif';
        const bounds = dockNoteBounds({ x: area.position.x, y: area.position.y, width: area.size.width, height: area.size.height }, monitor.scaleFactor, position.y, (context?.measureText(titleRef.current).width ?? 160) + 24);
        const top = area.position.y, bottom = top + area.size.height;
        bounds.y = await invoke<number>('dock_note', { area: { edge: area.position.x + area.size.width, top, bottom, scale: monitor.scaleFactor } });
        joined = true;
        docked.current = { ...bounds, reveal: Math.round(32 * monitor.scaleFactor), scale: monitor.scaleFactor, top, bottom };
        set(next);
        await animateBounds(previous, bounds);
        await win.setMinSize(new PhysicalSize(bounds.width, bounds.height));
        await win.setMaxSize(new PhysicalSize(bounds.width, bounds.height));
      } else {
        const target = { ...saved, height: next === 'collapsed' ? Math.round(34 * scale) : saved.height };
        if (previousMode !== 'docked') { target.x = previous.x; target.y = previous.y; }
        set(next);
        if (previousMode === 'docked') {
          await invoke('undock_note');
          await animateBounds(previous, target);
        } else await win.setSize(new PhysicalSize(target.width, target.height));
        await win.setMinSize(new LogicalSize(220, next === 'collapsed' ? 34 : 180));
        if (next === 'collapsed') await win.setMaxSize(new LogicalSize(10000, 34));
        docked.current = null;
      }
    } catch (error) {
      if (joined) await invoke('undock_note').catch(() => {});
      set(previousMode);
      if (previous) {
        await win.setMaxSize(null).catch(() => {});
        await win.setMinSize(new LogicalSize(80, 34)).catch(() => {});
        await win.setSize(new PhysicalSize(previous.width, previous.height)).catch(() => {});
        await win.setPosition(new PhysicalPosition(previous.x, previous.y)).catch(() => {});
      }
      errorRef.current(`窗口调整失败：${String(error)}`);
    } finally {
      // Native resize completion can precede the WebView receiving its final viewport.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      setTransitioning(false);
      busy.current = false;
      if (pendingY.current !== null && docked.current && modeRef.current === 'docked') {
        const y = pendingY.current; pendingY.current = null; slide(hoveredRef.current, y);
      }
    }
  }, [slide]);

  useEffect(() => {
    const actions = listen<string>('note-window-action', event => {
      if (event.payload === 'collapse' || event.payload === 'dock') void change(event.payload);
    });
    const positions = listen<number>('note-dock-position', event => {
      if (busy.current || drag.current) pendingY.current = event.payload;
      else if (modeRef.current === 'docked') slide(hoveredRef.current, event.payload);
    });
    return () => { for (const pending of [actions, positions]) void pending.then(off => off()).catch(console.error); };
  }, [change, slide]);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || busy.current || !docked.current) return;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { screenY: event.screenY, y: docked.current.y, targetY: docked.current.y, moved: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = drag.current, bounds = docked.current;
    if (!active || !bounds) return;
    const delta = (event.screenY - active.screenY) * bounds.scale;
    if (!active.moved && Math.abs(delta) < 4 * bounds.scale) return;
    active.moved = true; suppressClick.current = true;
    const requested = ++revision.current;
    const y = Math.round(Math.max(bounds.top, Math.min(bounds.bottom - bounds.height, active.y + delta)));
    active.targetY = y;
    motion.current = motion.current.then(async () => {
      if (requested === revision.current && drag.current) await getCurrentWindow().setPosition(new PhysicalPosition(bounds.x - bounds.reveal, y));
    }).catch(error => errorRef.current(`拖动失败：${String(error)}`));
  };
  const finishDrag = () => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    void motion.current.then(async () => {
      if (active.moved) {
        const y = await invoke<number>('move_docked_note', { y: active.targetY });
        pendingY.current = null;
        slide(hoveredRef.current, y);
      } else if (pendingY.current !== null) {
        const y = pendingY.current; pendingY.current = null; slide(hoveredRef.current, y);
      }
    }).catch(error => { drag.current = null; errorRef.current(`排序失败：${String(error)}`); });
  };
  return {
    mode, transitioning, peek: (hovered: boolean) => { hoveredRef.current = hovered; if (!drag.current) slide(hovered); },
    toggleCollapse: () => change('collapse'), toggleDock: () => change('dock'), restore: () => change('restore'),
    dockTitleProps: { onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag, onLostPointerCapture: finishDrag,
      onClick: () => { if (!suppressClick.current) void change('restore'); } }
  };
}
