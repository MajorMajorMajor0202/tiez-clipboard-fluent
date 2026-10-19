import { useRef, type InputHTMLAttributes } from "react";
import { Slider } from "@fluentui/react-components";
import { useSettingsControlLabel } from "./useSettingsControlLabel";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "children" | "value" | "defaultValue"> & { value: number };
export default function FluentSlider({ className = "", min = 0, max = 100, step = 1, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const labelledBy = useSettingsControlLabel(ref, props["aria-label"] || props["aria-labelledby"]);
  return <Slider {...props} ref={ref} min={Number(min)} max={Number(max)} step={Number(step)}
    className={`tiez-official-slider ${className}`} aria-labelledby={props["aria-labelledby"] || labelledBy}
    onChange={(event) => props.onChange?.(event)} />;
}
