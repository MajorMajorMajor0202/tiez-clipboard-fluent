import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FluentProvider, webDarkTheme, webLightTheme, type Theme } from "@fluentui/react-components";

/** Bridge the existing window theme without adding an opaque page surface. */
export default function TieZFluentProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark-mode"));
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark-mode"));
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => observer.disconnect();
  }, []);
  const theme = useMemo<Theme>(() => ({
    ...(dark ? webDarkTheme : webLightTheme),
    fontFamilyBase: '"Segoe UI Variable", "Segoe UI", "Microsoft YaHei", sans-serif',
    fontSizeBase300: "13px",
    colorBrandBackground: "var(--accent-color)",
    colorBrandForeground1: "var(--accent-color)",
    colorBrandStroke1: "var(--accent-color)",
    colorCompoundBrandStroke: "var(--accent-color)",
    colorCompoundBrandStrokeHover: "var(--accent-color)",
    colorCompoundBrandStrokePressed: "var(--accent-color)",
    colorNeutralForeground1: "var(--text-primary)",
    colorNeutralForeground2: "var(--text-secondary)",
    colorNeutralBackground1: "var(--bg-input)",
    colorNeutralStroke1: "var(--line-soft)",
    colorNeutralStroke1Hover: "var(--line-strong)",
  }), [dark]);
  return (
    <FluentProvider className="tiez-fluent-provider" theme={theme} style={{ display: "contents", backgroundColor: "transparent" }}>
      {children}
    </FluentProvider>
  );
}
