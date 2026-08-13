import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject, ReactNode } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import type { DragControls } from "framer-motion";
import { Clipboard } from "lucide-react";
import FileTransferChatView from "../../file-transfer/components/FileTransferChatView";
import TagManager from "../../tag/components/TagManager";
import EmojiPanel from "../../emoji/components/EmojiPanel";
import { VirtualClipboardList } from "../../clipboard/components/VirtualClipboardList";
import type { ClipboardEntry } from "../../../shared/types";
import type { VirtualClipboardListHandle } from "../../clipboard/types";


type RenderItem = (
  item: ClipboardEntry,
  index: number,
  dragControls?: DragControls,
  disableLayout?: boolean
) => ReactNode;

interface AppMainContentProps {
  t: (key: string) => string;
  theme: string;
  showTagManager: boolean;
  tagManagerEnabled: boolean;
  showEmojiPanel: boolean;
  chatMode: boolean;
  localIp: string;
  actualPort: string;

  emojiFavorites: string[];
  setEmojiFavorites: (val: string[] | ((prev: string[]) => string[])) => void;
  emojiPanelTab: "emoji" | "favorites";
  setEmojiPanelTab: (val: "emoji" | "favorites") => void;
  saveSetting: (key: string, val: string) => void;
  filteredHistory: ClipboardEntry[];
  search: string;
  typeFilter: string | null;
  pinnedItems: ClipboardEntry[];
  unpinnedItems: ClipboardEntry[];
  compactMode: boolean;
  selectedIndex: number;
  isKeyboardMode: boolean;
  virtualListRef: RefObject<VirtualClipboardListHandle | null>;
  handlePinnedReorder: (newOrderIds: number[]) => void;
  renderItemContent: RenderItem;
  loadMoreHistory: () => void;
  handleListScroll: (offset: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  language: string;
}

const SortableItem = ({
  item,
  index,
  renderItem,
  isFirst,
  compactMode,
  onDragStart,
  onDragEnd
}: {
  item: ClipboardEntry;
  index: number;
  renderItem: RenderItem;
  isFirst?: boolean;
  compactMode: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={isFirst ? "first-virtual-item" : undefined}
      style={{
        listStyle: "none",
        overflow: "visible",
        paddingTop: isFirst ? "4px" : undefined
      }}
    >
      <div style={{ paddingBottom: compactMode ? "4px" : "8px" }}>
        {renderItem(item, index, controls, true)}
      </div>
    </Reorder.Item>
  );
};

const AppMainContent = ({
  t,
  theme,
  showTagManager,
  tagManagerEnabled,
  showEmojiPanel,
  chatMode,
  localIp,
  actualPort,

  emojiFavorites,
  setEmojiFavorites,
  emojiPanelTab,
  setEmojiPanelTab,
  saveSetting,
  filteredHistory,
  search,
  typeFilter,
  pinnedItems,
  unpinnedItems,
  compactMode,
  selectedIndex,
  isKeyboardMode,
  virtualListRef,
  handlePinnedReorder,
  renderItemContent,
  loadMoreHistory,
  handleListScroll,
  hasMore,
  isLoadingMore,
  language
}: AppMainContentProps) => {
  const [pinnedOrderIds, setPinnedOrderIds] = useState<number[]>(
    () => pinnedItems.map((item) => item.id)
  );
  const pinnedOrderRef = useRef<number[]>(pinnedItems.map((item) => item.id));
  const [isDraggingPinned, setIsDraggingPinned] = useState(false);

  useEffect(() => {
    if (isDraggingPinned) return;
    const next = pinnedItems.map((item) => item.id);
    setPinnedOrderIds(next);
    pinnedOrderRef.current = next;
  }, [pinnedItems, isDraggingPinned]);

  const orderedPinnedItems = useMemo(() => {
    if (pinnedItems.length === 0) return [];
    const map = new Map<number, ClipboardEntry>();
    pinnedItems.forEach((item) => map.set(item.id, item));

    const ordered: ClipboardEntry[] = [];
    const seen = new Set<number>();

    pinnedOrderIds.forEach((id) => {
      const item = map.get(id);
      if (!item) return;
      ordered.push(item);
      seen.add(id);
    });

    pinnedItems.forEach((item) => {
      if (!seen.has(item.id)) {
        ordered.push(item);
      }
    });

    return ordered;
  }, [pinnedItems, pinnedOrderIds]);

  const orderedPinnedIds = useMemo(
    () => orderedPinnedItems.map((item) => item.id),
    [orderedPinnedItems]
  );

  const handlePinnedIdsReorder = useCallback((nextIds: number[]) => {
    setPinnedOrderIds(nextIds);
    pinnedOrderRef.current = nextIds;
  }, []);

  const handlePinnedDragStart = useCallback(() => {
    setIsDraggingPinned(true);
  }, []);

  const handlePinnedDragEnd = useCallback(() => {
    setIsDraggingPinned(false);
    const finalIds = pinnedOrderRef.current;
    const currentIds = pinnedItems.map((item) => item.id);
    if (
      finalIds.length === currentIds.length &&
      finalIds.every((id, idx) => id === currentIds[idx])
    ) {
      return;
    }
    handlePinnedReorder(finalIds);
  }, [handlePinnedReorder, pinnedItems]);

  if (showTagManager && tagManagerEnabled) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{ height: "100%" }}
      >
        <TagManager t={t} theme={theme} />
      </motion.div>
    );
  }

  if (showEmojiPanel) {
    return (
      <div className="emoji-panel-mount-wrapper">
        <EmojiPanel
          t={t}
          favorites={emojiFavorites}
          setFavorites={setEmojiFavorites}
          activeTab={emojiPanelTab}
          setActiveTab={setEmojiPanelTab}
          saveSetting={saveSetting}
          language={language}
        />
      </div>
    );
  }

  if (chatMode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ height: "100%", overflow: "hidden" }}
      >
        <FileTransferChatView t={t} localIp={localIp} actualPort={actualPort} />
      </motion.div>
    );
  }

  const filterKey = typeFilter || 'all';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={filterKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{ height: "100%" }}
      >
        {filteredHistory.length === 0 ? (
          <div className="empty-state">
            <Clipboard size={40} opacity={0.2} style={{ marginBottom: "12px" }} />
            {search ? (
              <p>{t("no_records")}</p>
            ) : (
              <>
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: "bold",
                    color: "var(--text-primary)",
                    marginBottom: "4px"
                  }}
                >
                  {t("empty_title")}
                </p>
                <p style={{ fontSize: "12px", opacity: 0.6 }}>{t("empty_desc")}</p>
              </>
            )}
          </div>
        ) : (
          <div className="history-list-container">
            <VirtualClipboardList
              ref={virtualListRef}
              items={unpinnedItems}
              compactMode={compactMode}
              selectedIndex={selectedIndex - pinnedItems.length}
              isKeyboardMode={isKeyboardMode}
              header={
                pinnedItems.length > 0 ? (
                  <Reorder.Group
                    axis="y"
                    values={orderedPinnedIds}
                    onReorder={handlePinnedIdsReorder}
                    className={isDraggingPinned ? "pinned-reorder dragging" : "pinned-reorder"}
                    style={{ listStyle: "none", padding: 0 }}
                  >
                    {orderedPinnedItems.map((item, index) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        index={index}
                        renderItem={renderItemContent}
                        isFirst={index === 0}
                        compactMode={compactMode}
                        onDragStart={handlePinnedDragStart}
                        onDragEnd={handlePinnedDragEnd}
                      />
                    ))}
                  </Reorder.Group>
                ) : null
              }
              renderItem={(item, index, isFirst?: boolean) => {
                const el = renderItemContent(item, pinnedItems.length + index, undefined, true);
                if (isFirst && pinnedItems.length === 0) {
                  return (
                    <div className="first-virtual-item" style={{ height: "100%", paddingTop: "4px" }}>
                      {el}
                    </div>
                  );
                }
                return el;
              }}
              onLoadMore={loadMoreHistory}
              onScroll={handleListScroll}
              hasMore={hasMore}
              isLoading={isLoadingMore}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AppMainContent;

