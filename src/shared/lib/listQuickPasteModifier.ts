export const listQuickPasteModifiers = [
  { id: "alt", label: "Alt" },
  { id: "ctrl", label: "Ctrl" },
  { id: "shift", label: "Shift" },
  { id: "ctrl+alt", label: "Ctrl + Alt" },
  { id: "ctrl+shift", label: "Ctrl + Shift" },
  { id: "alt+shift", label: "Alt + Shift" },
  { id: "ctrl+alt+shift", label: "Ctrl + Alt + Shift" },
  { id: "disabled", label: "关闭" },
] as const;

export function normalizeListQuickPasteModifier(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return listQuickPasteModifiers.find(option => option.id === normalized)?.id ?? "alt";
}

export function matchesListQuickPasteModifier(event: KeyboardEvent, modifier: string) {
  return modifier !== "disabled" && !event.metaKey && !event.getModifierState("AltGraph") &&
    event.ctrlKey === modifier.includes("ctrl") && event.altKey === modifier.includes("alt") &&
    event.shiftKey === modifier.includes("shift");
}

export function listQuickPasteModifierLabel(modifier: string) {
  return listQuickPasteModifiers.find(option => option.id === modifier)?.label ?? "Alt";
}
