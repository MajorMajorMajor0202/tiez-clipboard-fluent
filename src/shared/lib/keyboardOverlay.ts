/** Retained/closing popup DOM must not disable the list after the popup is hidden. */
export function hasVisibleKeyboardOverlay(): boolean {
  return [...document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [role="listbox"], [role="menu"], .fluent-modal-overlay',
  )].some(element => {
    if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
      element.getClientRects().length > 0;
  });
}
