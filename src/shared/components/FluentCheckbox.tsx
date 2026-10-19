import { Checkbox, type CheckboxProps } from "@fluentui/react-components";
export default function FluentCheckbox(props: Omit<CheckboxProps, "checked"> & { checked?: boolean }) {
  return <Checkbox {...props} />;
}
