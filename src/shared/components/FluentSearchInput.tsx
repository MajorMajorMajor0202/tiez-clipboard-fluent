import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@fluentui/react-components";
import { Search } from "lucide-react";

/** Preserve native events/ref for IME and the app's keyboard navigation. */
type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "size" | "value" | "defaultValue"> & {
  value?: string;
  defaultValue?: string;
};

const FluentSearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = "", value, defaultValue, onChange, ...inputProps }, ref) => (
    <Input
      className="tiez-official-search"
      size="small"
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event)}
      contentBefore={<Search size={14} aria-hidden="true" />}
      input={{ ...inputProps, className }}
    />
  ),
);
FluentSearchInput.displayName = "FluentSearchInput";
export default FluentSearchInput;
