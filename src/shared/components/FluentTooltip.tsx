import { isValidElement, type ReactNode } from "react";
import { Tooltip } from "@fluentui/react-components";

interface FluentTooltipProps {
  text: string;
  children: ReactNode;
}

/** Fluent handles Escape, keyboard focus, ARIA and collision-aware placement. */
export default function FluentTooltip({ text, children }: FluentTooltipProps) {
  // Native disabled buttons do not reliably emit pointer events in WebView2.
  const needsWrapper = !isValidElement(children) ||
    (isValidElement<{ disabled?: boolean }>(children) && children.props.disabled);
  return (
    <Tooltip
      content={{ children: text, className: "tiez-official-tooltip" }}
      relationship="description"
      showDelay={200}
      hideDelay={0}
      positioning={{ position: "below", align: "center", offset: 8 }}
      withArrow
    >
      {needsWrapper ? <span style={{ display: "inline-flex" }}>{children}</span> : children}
    </Tooltip>
  );
}
