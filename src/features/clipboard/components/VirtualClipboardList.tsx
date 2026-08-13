import React, { useRef, useImperativeHandle, useCallback, useMemo, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { ListRange } from 'react-virtuoso';
import type { ClipboardEntry } from "../../../shared/types";
import type { VirtualClipboardListHandle, VirtualClipboardListProps } from "../types";
import FluentScrollbar from '../../../shared/components/FluentScrollbar';

type VirtuosoListContext = {
    header?: React.ReactNode;
    hasMore: boolean;
    isLoading: boolean;
    compactMode: boolean;
};

const ListHeader = ({ context }: { context?: VirtuosoListContext }) => {
    const header = context?.header;
    return (
        <div className="list-header-wrapper">
            <div style={{ height: '8px' }} />
            {header ? <div className="list-header">{header}</div> : null}
        </div>
    );
};

const ListFooter = ({ context }: { context?: VirtuosoListContext }) => {
    if (!context) return null;
    const { isLoading, hasMore, compactMode } = context;
    const showFooterContent = isLoading || hasMore;
    const spacerHeight = compactMode ? 6 : 2;

    return (
        <div className="list-footer-wrapper">
            {showFooterContent ? (
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    opacity: 0.6,
                    fontSize: '12px',
                    color: 'var(--text-secondary)'
                }}>
                    {isLoading ? '加载中...' : '加载更多...'}
                </div>
            ) : null}
            <div style={{ height: `${spacerHeight}px` }} />
        </div>
    );
};

const VirtualClipboardList = React.forwardRef<VirtualClipboardListHandle, VirtualClipboardListProps>(
    (props, ref) => {
        const {
            items,
            renderItem,
            onLoadMore,
            hasMore,
            isLoading,
            selectedIndex,
            isKeyboardMode,
            onScroll,
            compactMode,
            header
        } = props;

        const virtuosoRef = useRef<VirtuosoHandle>(null);
        const visibleRangeRef = useRef<ListRange | null>(null);
        // Custom scroll parent — the outer div that we hide the native scrollbar on
        const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

        // Use a callback ref so scrollEl is set synchronously on first mount
        const scrollParentRef = useCallback((el: HTMLDivElement | null) => {
            setScrollEl(el);
        }, []);

        useImperativeHandle(ref, () => ({
            scrollToItem: (index: number) => {
                virtuosoRef.current?.scrollIntoView({
                    index,
                    behavior: 'smooth',
                    align: 'center',
                });
            },
            scrollToTop: () => {
                virtuosoRef.current?.scrollTo({
                    top: 0,
                    behavior: 'auto'
                });
            },
            resetAfterIndex: (_index: number) => {
                // Not needed with Virtuoso as it handles dynamic heights automatically
            }
        }));

        // Keep keyboard selection visible even when the item is only in overscan
        React.useEffect(() => {
            if (!isKeyboardMode || selectedIndex < 0) return;

            const range = visibleRangeRef.current;
            const edgeBuffer = 1;

            if (!range) {
                virtuosoRef.current?.scrollToIndex({
                    index: selectedIndex,
                    behavior: 'auto',
                    align: 'center',
                });
                return;
            }

            if (selectedIndex < range.startIndex + edgeBuffer) {
                virtuosoRef.current?.scrollToIndex({
                    index: selectedIndex,
                    behavior: 'auto',
                    align: 'start',
                });
                return;
            }

            if (selectedIndex > range.endIndex - edgeBuffer) {
                virtuosoRef.current?.scrollToIndex({
                    index: selectedIndex,
                    behavior: 'auto',
                    align: 'end',
                });
            }
        }, [selectedIndex, isKeyboardMode]);


        // Handle scroll events
        const handleScroll = useCallback((scrollTop: number) => {
            onScroll?.(scrollTop);
        }, [onScroll]);

        // Handle end reached for infinite loading
        const handleEndReached = useCallback(() => {
            if (hasMore && !isLoading && onLoadMore) {
                onLoadMore();
            }
        }, [hasMore, isLoading, onLoadMore]);

        const handleRangeChanged = useCallback((range: ListRange) => {
            visibleRangeRef.current = range;
        }, []);

        // Memoized item renderer for Virtuoso
        const itemContent = useCallback((index: number, item: ClipboardEntry) => {
            return (
                <div style={{ paddingBottom: compactMode ? 4 : 8 }}>
                    {renderItem(item, index, index === 0)}
                </div>
            );
        }, [renderItem, compactMode]);

        const components = useMemo(() => ({
            Header: ListHeader,
            Footer: ListFooter
        }), []);

        const context = useMemo(() => ({
            header,
            hasMore,
            isLoading,
            compactMode
        }), [header, hasMore, isLoading, compactMode]);

        return (
            <div className="virtual-list-wrapper" style={{ height: '100%', width: '100%' }}>
                {/* Custom scroll parent: hides native scrollbar, provides scroll events */}
                <div
                    ref={scrollParentRef}
                    style={{
                        height: '100%',
                        overflow: 'auto',
                        // Hide native scrollbar while keeping scroll functionality
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                    }}
                    className="fluent-scrollbar-host"
                >
                    <Virtuoso
                        ref={virtuosoRef}
                        customScrollParent={scrollEl ?? undefined}
                        data={items}
                        itemContent={itemContent}
                        components={components}
                        context={context}
                        style={{ height: '100%' }}
                        onScroll={(e) => handleScroll((e.currentTarget as HTMLElement).scrollTop)}
                        endReached={handleEndReached}
                        rangeChanged={handleRangeChanged}
                        overscan={200} // Pre-render 200px of content for smoother scrolling
                    />
                </div>
                {/* Fluent Design custom scrollbar overlay */}
                <FluentScrollbar scrollContainer={scrollEl} />
            </div>
        );
    }
);

VirtualClipboardList.displayName = 'VirtualClipboardList';

export { VirtualClipboardList };
export default VirtualClipboardList;
