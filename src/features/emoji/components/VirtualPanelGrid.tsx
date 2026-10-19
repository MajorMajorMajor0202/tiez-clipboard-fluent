import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Virtuoso } from "react-virtuoso";

interface GridSection<Item> {
  key: string;
  header?: ReactNode;
  items: Item[];
}

interface VirtualPanelGridProps<Item> {
  sections: GridSection<Item>[];
  minItemWidth: number;
  gap: number;
  renderItem: (item: Item) => ReactNode;
  className: string;
  active: boolean;
}

function VirtualPanelGrid<Item>({ sections, minItemWidth, gap, renderItem, className, active }: VirtualPanelGridProps<Item>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visited, setVisited] = useState(active);

  useEffect(() => {
    if (active) setVisited(true);
  }, [active]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setWidth(container.clientWidth));
    observer.observe(container);
    setWidth(container.clientWidth);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((width + gap) / (minItemWidth + gap)));
  const rows = useMemo(() => sections.flatMap((section) => {
    const sectionRows: { key: string; header?: ReactNode; items?: Item[] }[] = [];
    if (section.header) sectionRows.push({ key: `${section.key}-header`, header: section.header });
    for (let index = 0; index < section.items.length; index += columns) {
      sectionRows.push({ key: `${section.key}-${index}`, items: section.items.slice(index, index + columns) });
    }
    return sectionRows;
  }), [sections, columns]);

  return (
    <div ref={containerRef} className={`emoji-virtual-grid ${className}`}>
      {(active || visited) && width > 0 && (
        <Virtuoso
          style={{ height: "100%" }}
          data={rows}
          computeItemKey={(_index, row) => row.key}
          increaseViewportBy={100}
          itemContent={(_index, row) => row.items ? (
            <div
              className="emoji-virtual-row"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, paddingBottom: gap }}
            >
              {row.items.map(renderItem)}
            </div>
          ) : row.header}
        />
      )}
    </div>
  );
}

export default memo(VirtualPanelGrid) as typeof VirtualPanelGrid;
