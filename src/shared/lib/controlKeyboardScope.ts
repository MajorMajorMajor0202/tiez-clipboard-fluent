/** History shortcuts must not consume a focused control's own interaction keys. */
export function isControlKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(".home-search-wrapper")) return false;
  return !!target.closest(`button, a[href], input, textarea, select, [contenteditable="true"],
    [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"],
    [role="slider"], [role="switch"], [role="spinbutton"], [role="tab"], [role="dialog"]`);
}
