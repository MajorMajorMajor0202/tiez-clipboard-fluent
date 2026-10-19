import { useRef, type MouseEventHandler, type InputHTMLAttributes } from "react";
import { Switch } from "@fluentui/react-components";
import { useSettingsControlLabel } from "./useSettingsControlLabel";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "children" | "onClick"> & { onClick?: MouseEventHandler<HTMLDivElement> };
export default function FluentSwitch({ className = "", style, onClick, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const labelledBy = useSettingsControlLabel(ref, props["aria-label"] || props["aria-labelledby"]);
  return <Switch {...props} ref={ref} className={`tiez-official-switch ${className}`} style={style}
    aria-labelledby={props["aria-labelledby"] || labelledBy}
    root={{ onClick }} onChange={(event) => props.onChange?.(event)} />;
}
