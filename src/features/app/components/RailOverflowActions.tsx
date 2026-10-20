import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState, type ReactNode, type MouseEventHandler } from "react";
import { Popover, PopoverSurface, PopoverTrigger } from "@fluentui/react-components";
import { ChevronLeft } from "lucide-react";

const GAP = 3;
const BUTTON_HEIGHT = 32;
const isDivider = (child: ReactNode) => isValidElement<{ className?: string }>(child) && child.props.className === "rail-divider";
const trimDividers = (items: ReactNode[]) => {
  let start = 0, end = items.length;
  while (start < end && isDivider(items[start])) start++;
  while (end > start && isDivider(items[end - 1])) end--;
  return items.slice(start, end);
};
const heightOf = (items: ReactNode[]) => items.reduce<number>((height, child) => height + (isDivider(child) ? 9 : BUTTON_HEIGHT), 0) + Math.max(0, items.length - 1) * GAP;

/** Keep a fixed button pitch; only the trailing actions move into the flyout. */
export default function RailOverflowActions({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [open, setOpen] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const items = trimDividers(Children.toArray(children));
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setHeight(element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  let count = items.length;
  if (heightOf(items) > height) {
    count = 0;
    for (let index = 1; index <= items.length; index++) {
      if (heightOf(trimDividers(items.slice(0, index))) + GAP + BUTTON_HEIGHT > height) break;
      count = index;
    }
  }
  const visible = trimDividers(items.slice(0, count));
  const hidden = trimDividers(items.slice(count));
  useLayoutEffect(() => {
    if (!hidden.length) setOpen(false);
  }, [hidden.length]);

  const overflowAction = (child: ReactNode) => {
    if (!isValidElement<{ children?: ReactNode }>(child) || isDivider(child)) return child;
    const button = child.props.children;
    if (!isValidElement<{ onClick?: MouseEventHandler<HTMLButtonElement> }>(button)) return child;
    return cloneElement(child, { children: cloneElement(button, { onClick: event => {
      // Run the action before unmounting, including actions that stop propagation.
      button.props.onClick?.(event);
      setOpen(false);
    } }) });
  };

  return <div ref={container} className="rail-actions-overflow">
    {visible.map((child, index) => <div className={isDivider(child) ? "rail-action-separator" : "rail-action-slot"} key={index}>{child}</div>)}
    {hidden.length > 0 && <Popover open={open} onOpenChange={(_event, data) => {
      setPositioned(false);
      setOpen(data.open);
    }} positioning={{ position: "before", align: "end", offset: 8, autoSize: "height", overflowBoundaryPadding: 8,
      onPositioningEnd: () => setPositioned(true),
    }}>
      <PopoverTrigger disableButtonEnhancement>
        <button type="button" className={`rail-btn rail-overflow-trigger ${open ? "active" : ""}`} aria-label="更多工具" title="更多工具" aria-expanded={open}>
          <ChevronLeft size={16} />
        </button>
      </PopoverTrigger>
      <PopoverSurface className="rail-overflow-surface window-no-drag" aria-label="更多工具" style={{ visibility: positioned ? "visible" : "hidden" }}>
        <div className="rail-overflow-tools">
          {hidden.map((child, index) => <div className={isDivider(child) ? "rail-action-separator" : "rail-action-slot"} key={index}>{overflowAction(child)}</div>)}
        </div>
      </PopoverSurface>
    </Popover>}
  </div>;
}
