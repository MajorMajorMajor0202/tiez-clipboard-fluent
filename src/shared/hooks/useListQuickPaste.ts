import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEntry } from "../types";
import type { QuickPasteHint } from "../../features/clipboard/types";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "../lib/tauriRuntime";

export const QUICK_PASTE_KEYS = "1234567890";

/** Alt is local to the list; global pinned-item shortcuts are handled separately. */
export function useListQuickPaste(
  items: ClipboardEntry[],
  enabled: boolean,
  paste: (id: number, content: string, contentType: string) => Promise<void>,
) {
  const [held, setHeld] = useState(false);
  const current = useRef({ items, enabled, paste });
  current.current = { items, enabled, paste };

  useEffect(() => {
    let busy = false;
    let consumed = false;
    let disposed = false;
    const reset = () => { setHeld(false); consumed = false; };
    const allowed = (target: EventTarget | null) => {
      if (!current.current.enabled || document.hidden) return false;
      if (document.querySelector('[role="dialog"], [role="listbox"], [role="menu"], .fluent-modal-overlay')) return false;
      if (!(target instanceof Element)) return true;
      return !target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"]') ||
        !!target.closest('.home-search-wrapper');
    };
    const pasteDigit = (digit: string, repeat = false) => {
      const item = current.current.items[QUICK_PASTE_KEYS.indexOf(digit)];
      if (!item || repeat || busy || consumed) return;
      busy = true;
      void current.current.paste(item.id, item.content, item.content_type)
        .catch(console.error)
        .finally(() => { busy = false; });
    };
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !allowed(event.target)) { setHeld(false); return; }
      const altOnly = event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && !event.getModifierState('AltGraph');
      if (!altOnly) { setHeld(false); return; }
      if (event.key === 'Alt') {
        event.preventDefault(); // Keep WebView's menu activation out of the list.
        if (!consumed) setHeld(true);
        return;
      }
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
      if (!digit) { setHeld(false); consumed = true; return; }
      event.preventDefault();
      event.stopPropagation();
      pasteDigit(digit, event.repeat);
    };
    const up = (event: KeyboardEvent) => { if (event.key === 'Alt' || !event.altKey) reset(); };
    const focus = (event: FocusEvent) => { if (!allowed(event.target)) reset(); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', reset);
    window.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', reset);
    // The native popup can remain visible without taking focus from the paste target.
    const subscriptions = isTauriRuntime() ? [
      listen<string>('list-quick-paste', ({ payload }) => {
        if (disposed) return;
        if (payload === 'hide') { reset(); return; }
        if (!allowed(document.activeElement)) { reset(); return; }
        if (payload === 'show') { if (!consumed) setHeld(true); }
        else if (/^[0-9]$/.test(payload)) pasteDigit(payload);
      }),
      listen('window-hidden', reset),
    ].map(subscription => subscription.catch(error => { console.error(error); return () => {}; })) : [];
    return () => {
      disposed = true;
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', reset);
      subscriptions.forEach(subscription => { void subscription.then(off => off()).catch(console.error); });
    };
  }, []);

  useEffect(() => { if (!enabled) setHeld(false); }, [enabled]);
  return useMemo(() => {
    const hints: Record<number, QuickPasteHint> = {};
    if (held && enabled) items.slice(0, 10).forEach((item, index) => {
      hints[item.id] = { slot: index + 1, combo: `Alt+${QUICK_PASTE_KEYS[index]}` };
    });
    return hints;
  }, [held, enabled, items]);
}
