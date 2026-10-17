import { useMemo } from "react";
import type { ClipboardEntry } from "../types";

interface UseFilteredHistoryOptions {
  history: ClipboardEntry[];
  search: string;
  typeFilter: string | null;
  activeTabId?: string;
  tabName?: string;
}

export const useFilteredHistory = ({
  history,
  search,
  typeFilter,
  activeTabId,
  tabName
}: UseFilteredHistoryOptions) => {
  return useMemo(() => {
    const lowerSearch = search.toLowerCase();

    const filtered = history.filter((item) => {
      // Filter by active Tab if selected
      if (activeTabId && activeTabId !== "clipboard") {
        const matchesTab =
          item.tab_id === activeTabId ||
          (tabName && item.tags?.some((t) => t.toLowerCase() === tabName.toLowerCase()));
        if (!matchesTab) return false;
      }

      if (typeFilter && item.content_type !== typeFilter) {
        return false;
      }

      let effectiveSearch = lowerSearch;
      const isTagSearch = effectiveSearch.startsWith("tag:");
      if (isTagSearch) {
        effectiveSearch = effectiveSearch.slice(4).trim();
      }

      if (!effectiveSearch) return true;

      const matchesTag = (tag: string, term: string) => {
        const lowerTag = tag.toLowerCase();
        const displayZh = lowerTag === "sensitive"
          ? "敏感"
          : lowerTag === "password"
          ? "密码"
          : tag;
        const displayTc = lowerTag === "sensitive"
          ? "敏感"
          : lowerTag === "password"
          ? "密碼"
          : tag;
        const displayEn = lowerTag === "sensitive"
          ? "sensitive"
          : lowerTag === "password"
          ? "password"
          : tag;
        return (
          displayZh.toLowerCase().includes(term) ||
          displayTc.toLowerCase().includes(term) ||
          displayEn.toLowerCase().includes(term)
        );
      };

      if (isTagSearch) {
        return item.tags?.some((tag) => matchesTag(tag, effectiveSearch)) ?? false;
      }

      return (
        item.content?.toLowerCase().includes(effectiveSearch) ||
        item.source_app?.toLowerCase().includes(effectiveSearch) ||
        item.tags?.some((tag) => matchesTag(tag, effectiveSearch))
      );
    });

    return filtered.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      if (a.is_pinned) {
        if ((a.pinned_order || 0) !== (b.pinned_order || 0)) {
          return (b.pinned_order || 0) - (a.pinned_order || 0);
        }
        return b.timestamp - a.timestamp;
      }
      return b.timestamp - a.timestamp;
    });
  }, [history, search, typeFilter, activeTabId, tabName]);
};
