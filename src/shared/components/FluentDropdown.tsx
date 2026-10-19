import type { CSSProperties, ReactNode } from "react";
import { Dropdown, Option } from "@fluentui/react-components";
import { ChevronDown } from "lucide-react";

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
  return (
    <Dropdown
      className="fluent-dropdown-container tiez-official-dropdown"
      style={style}
      size="small"
      aria-label={ariaLabel || selected?.label}
      value={selected?.label || ""}
      selectedOptions={selected ? [selected.id] : []}
      disabled={!options.length}
      button={{
        className: `fluent-dropdown-trigger-btn ${triggerClassName}`.trim(),
        children: <>{selected?.icon}<span>{selected?.label}</span></>,
      }}
      expandIcon={<ChevronDown size={12} />}
      listbox={{ className: `tiez-official-listbox ${menuClassName}`.trim() }}
      onOptionSelect={(_event, data) => {
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
          {option.label}
        </Option>
      ))}
    </Dropdown>
  );
};
export default FluentDropdown;
