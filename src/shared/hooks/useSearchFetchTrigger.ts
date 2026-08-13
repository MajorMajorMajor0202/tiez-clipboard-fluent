import { useEffect, useRef } from "react";

interface UseSearchFetchTriggerOptions {
  debouncedSearch: string;
  isComposing: boolean;
  typeFilter?: string | null;
  fetchHistory: (reset?: boolean) => void;
}

export const useSearchFetchTrigger = ({
  debouncedSearch,
  isComposing,
  typeFilter,
  fetchHistory
}: UseSearchFetchTriggerOptions) => {
  // Keep a stable ref to fetchHistory so effect deps don't need it,
  // avoiding double-fires when both search text and typeFilter change.
  const fetchHistoryRef = useRef(fetchHistory);
  fetchHistoryRef.current = fetchHistory;

  useEffect(() => {
    if (!isComposing) {
      fetchHistoryRef.current(true);
    }
  }, [debouncedSearch, isComposing]);

  useEffect(() => {
    fetchHistoryRef.current(true);
  }, [typeFilter]);
};
