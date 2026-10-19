import { useId, useLayoutEffect, useState, type RefObject } from "react";

/** Associate standalone setting controls with their visible card heading. */
export function useSettingsControlLabel(ref: RefObject<HTMLElement | null>, explicit?: string) {
  const id = useId();
  const [labelledBy, setLabelledBy] = useState<string>();
  useLayoutEffect(() => {
    if (explicit) return;
    const row = ref.current?.closest(".fluent-setting-card, .tiez-expander-heading, .tiez-setting-row");
    const title = row?.querySelector<HTMLElement>(".fluent-setting-title");
    if (title) {
      if (!title.id) title.id = `setting-${id}`;
      setLabelledBy(title.id);
    }
  }, [explicit, id, ref]);
  return labelledBy;
}
