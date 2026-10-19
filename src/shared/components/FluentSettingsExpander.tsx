import { useId, type ReactNode } from "react";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel } from "@fluentui/react-components";

interface Props {
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  header: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}
/** Keep row actions outside the disclosure button: no nested interactive controls. */
export default function FluentSettingsExpander({ expanded, onToggle, disabled, header, actions, children, className = "" }: Props) {
  const panelId = useId();
  const headingId = useId();
  return <Accordion className={`fluent-setting-expander tiez-official-expander ${className}`} collapsible
    openItems={expanded ? ["content"] : []} onToggle={onToggle}>
    <AccordionItem value="content" disabled={disabled}>
      <div className={`fluent-setting-expander-header tiez-expander-heading ${expanded ? "expanded" : ""}`}>
        <AccordionHeader expandIconPosition="end" className="tiez-expander-header"
          button={{ id: headingId, "aria-controls": panelId }}>
          {header}
        </AccordionHeader>
        {actions && <div className="tiez-expander-actions">{actions}</div>}
      </div>
      <AccordionPanel id={panelId} aria-labelledby={headingId} className="tiez-expander-panel">{children}</AccordionPanel>
    </AccordionItem>
  </Accordion>;
}
