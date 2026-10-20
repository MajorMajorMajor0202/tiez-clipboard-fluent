import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEntry } from "../types";
import type { QuickPasteHint } from "../../features/clipboard/types";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../lib/tauriRuntime";
import { hasVisibleKeyboardOverlay } from "../lib/keyboardOverlay";

import { normalizeListQuickPasteModifier, matchesListQuickPasteModifier, listQuickPasteModifierLabel } from "../lib/listQuickPasteModifier";

export const QUICK_PASTE_KEYS = "1234567890";

/** List shortcuts use the displayed order; global pinned shortcuts are separate. */
export function useListQuickPaste(
  items: ClipboardEntry[],
  enabled: boolean,
  paste: (id: number, content: string, contentType: string) => Promise<void>,
  modifierValue = "alt",
) {
  const modifier = normalizeListQuickPasteModifier(modifierValue);
  const [held, setHeld] = useState(false);
  const current = useRef({ items, enabled: enabled && modifier !== "disabled", paste, modifier });
  current.current = { items, enabled: enabled && modifier !== "disabled", paste, modifier };


  useEffect(() => {
    const nativeRuntime = isTauriRuntime();
    let busy = false;
    let consumed = false;
    let disposed = false;
    let domModifierHeld = false;
    let stateRevision = 0;
    const reset = () => { ++stateRevision; setHeld(false); consumed = false; domModifierHeld = false; };
    const allowed = (target: EventTarget | null, native = false) => {
      // A native event is already gated by IsWindowVisible. WebView visibility
      // and activeElement can lag after a non-activating hide/show cycle.
      if (!current.current.enabled || (!native && document.hidden)) return false;
      if (hasVisibleKeyboardOverlay()) return false;
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
      // Window activation injects VK_FF to suppress the Start/menu action. It
      // becomes an Unidentified DOM key, not a user cancellation of KeyTips.
      if (event.key === 'Unidentified') return;
      if (event.defaultPrevented || event.isComposing || !allowed(event.target)) { setHeld(false); return; }
      const matches = matchesListQuickPasteModifier(event, current.current.modifier);
      if (!matches) { setHeld(false); return; }
      if (['Alt', 'Control', 'Shift'].includes(event.key)) {
        ++stateRevision;
        domModifierHeld = true;
        event.preventDefault(); // Keep WebView's menu activation out of the list.
        if (!event.repeat) consumed = false; // Recover if the previous modifier keyup was intercepted.
        if (!consumed) setHeld(true);
        return;
      }
      const digit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
      if (!digit) { setHeld(false); consumed = true; return; }
      event.preventDefault();
      event.stopPropagation();
      pasteDigit(digit, event.repeat);
    };
    const up = (event: KeyboardEvent) => { if (!matchesListQuickPasteModifier(event, current.current.modifier)) reset(); };
    const focus = (event: FocusEvent) => { if (!allowed(event.target)) reset(); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', reset);
    window.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', reset);
    const refreshNativeHeld = () => {
      const revision = stateRevision;
      void invoke<string | null>('get_list_quick_paste_state').then(payload => {
        if (disposed || revision !== stateRevision || !payload) return;
        if (payload === 'released') { reset(); return; }
        const target = payload === 'show-focused' ? document.activeElement : null;
        if (allowed(target, true)) { consumed = false; setHeld(true); }
      }).catch(console.error);
    };
    // The native popup can remain visible without taking focus from the paste target.
    const subscriptions = nativeRuntime ? [
      listen<string>('list-quick-paste', ({ payload }) => {
        if (disposed) return;
        ++stateRevision;
        // A physical modifier release is authoritative, even when WebView
        // focus/keyup delivery lags. Only focus handoff hides may be ignored.
        if (payload === 'released') { reset(); return; }
        if (payload === 'hide') {
          // The native hook relinquishes ownership when the WebView takes
          // focus; its queued hide must not erase a newer focused DOM press.
          if (domModifierHeld && document.hasFocus()) return;
          reset(); return;
        }
        // Only focused native events may consult activeElement. On the
        // non-activating path, WebView's hasFocus/activeElement can be stale.
        const target = payload === 'show-focused' ? document.activeElement : null;
        if (!allowed(target, true)) { reset(); return; }
        if (payload === 'show' || payload === 'show-focused') { consumed = false; setHeld(true); }
        else if (/^[0-9]$/.test(payload)) pasteDigit(payload);
      }),
      listen('window-hidden', reset),
      listen('window-shown', () => {
        // Focusing an already visible search field also emits window-shown.
        if (!domModifierHeld || !document.hasFocus()) { reset(); refreshNativeHeld(); }
      }),
    ].map(subscription => subscription.catch(error => { console.error(error); return () => {}; })) : [];
    if (nativeRuntime) void Promise.all(subscriptions).then(() => { if (!disposed) refreshNativeHeld(); });
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

  useEffect(() => { setHeld(false); }, [enabled, modifier]);
  return useMemo(() => {
    const hints: Record<number, QuickPasteHint> = {};
    if (held && enabled && modifier !== "disabled") items.slice(0, 10).forEach((item, index) => {
      hints[item.id] = { slot: index + 1, combo: `${listQuickPasteModifierLabel(modifier)}+${QUICK_PASTE_KEYS[index]}` };
    });
    return hints;
  }, [held, enabled, items, modifier]);
}
