import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Dropdown, Option, type DropdownProps } from "@fluentui/react-components";
import { ChevronDown } from "lucide-react";
import { useSettingsControlLabel } from "./useSettingsControlLabel";

export interface FluentDropdownOption {
  id: string;
  label: string;
  icon?: ReactNode;
}
interface FluentDropdownProps {
  options: FluentDropdownOption[];
  value: string;
  onChange: (id: string) => void;
  triggerClassName?: string;
  menuClassName?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

/** Keep the app API; Fluent owns keyboard selection, focus and positioning. */
export const FluentDropdown = ({
  options, value, onChange, triggerClassName = "", menuClassName = "", style,
  "aria-label": ariaLabel,
}: FluentDropdownProps) => {
  const selected = options.find((option) => option.id === value) || options[0];
  const [open, setOpen] = useState(false);
  const isOpen = useRef(open);
  isOpen.current = open;
  const trigger = useRef<HTMLButtonElement>(null);
  const labelledBy = useSettingsControlLabel(trigger, ariaLabel);
  const listbox = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex(option => option.id === selected?.id));
  useLayoutEffect(() => {
    listbox.current?.removeAttribute("data-positioned");
  }, [open, selectedIndex]);
  const positioning = useMemo<DropdownProps["positioning"]>(() => ({
    position: "below", align: "start", fallbackPositions: [],
    // The scale-in animation owns transform; positioning must use top/left.
    useTransform: false,
    shiftToCoverTarget: true, overflowBoundaryPadding: 8, autoSize: "height",
    onPositioningEnd: (event) => {
      // Fluent mounts at (0, 0) before asynchronous computePosition resolves.
      // Reveal only once its actual coordinates have been written.
      if (isOpen.current) (event.target as HTMLElement).dataset.positioned = "true";
    },
    offset: ({ targetRect }) => {
      const row = listbox.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      const center = row ? row.offsetTop - (listbox.current?.scrollTop || 0) + row.offsetHeight / 2 : 20 + selectedIndex * 36;
      return { mainAxis: -(targetRect.height / 2 + center), crossAxis: -4 };
    },
  }), [selectedIndex]);
  return (
    <Dropdown
      className="fluent-dropdown-container tiez-official-dropdown"
      style={{ width: 160, maxWidth: "100%", ...style }}
      size="small"
      aria-label={ariaLabel || (labelledBy ? undefined : selected?.label)}
      aria-labelledby={labelledBy}
      value={selected?.label || ""}
      selectedOptions={selected ? [selected.id] : []}
      disabled={!options.length}
      open={open}
      onOpenChange={(_event, data) => {
        if (!data.open) listbox.current?.removeAttribute("data-positioned");
        setOpen(data.open);
      }}
      positioning={positioning}
      button={{
        ref: trigger,
        className: `fluent-dropdown-trigger-btn ${triggerClassName}`.trim(),
        children: <span className="tiez-dropdown-label">{selected?.icon}<span>{selected?.label}</span></span>,
      }}
      expandIcon={<ChevronDown size={12} />}
      listbox={{ ref: listbox, className: `tiez-official-listbox ${menuClassName}`.trim(),
        style: { width: trigger.current ? trigger.current.offsetWidth + 8 : 168,
          minWidth: 0, maxWidth: "calc(100vw - 16px)", boxSizing: "border-box",
          transformOrigin: `center ${20 + selectedIndex * 36}px` } }}
      onOptionSelect={(_event, data) => {
        listbox.current?.removeAttribute("data-positioned");
        if (data.optionValue !== undefined) onChange(data.optionValue);
      }}
    >
      {options.map((option) => (
        <Option
          key={option.id}
          value={option.id}
          text={option.label}
          checkIcon={null}
          className={`fluent-dropdown-item ${option.id === selected?.id ? "active" : ""}`}
        >
          {option.icon}
          <span className="tiez-dropdown-option-label">{option.label}</span>
        </Option>
      ))}
    </Dropdown>
  );
};
export default FluentDropdown;
