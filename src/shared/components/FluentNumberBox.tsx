import { useRef, type CSSProperties } from "react";
import { SpinButton } from "@fluentui/react-components";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../lib/tauriRuntime";
import { useSettingsControlLabel } from "./useSettingsControlLabel";

interface FluentNumberBoxProps {
  value: number | string;
  onChange: (value: number) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}
export default function FluentNumberBox({ value, onChange, onBlur, min = 0, max = 999999, step = 1, ...props }: FluentNumberBoxProps) {
  const ref = useRef<HTMLInputElement>(null);
  const labelledBy = useSettingsControlLabel(ref, props["aria-label"]);
  return <SpinButton {...props} ref={ref} className="tiez-official-number" size="small"
    value={Number(value) || 0} min={min} max={max} step={step} aria-labelledby={labelledBy}
    incrementButton={{ "aria-label": "增加" }} decrementButton={{ "aria-label": "减少" }}
    onChange={(_event, data) => {
      const parsed = data.value ?? Number(data.displayValue);
      onChange(Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : min)));
    }}
    onBlur={onBlur}
    onFocus={(event) => {
      event.target.select();
      if (isTauriRuntime()) invoke("focus_clipboard_window").catch(console.error);
    }} />;
}
