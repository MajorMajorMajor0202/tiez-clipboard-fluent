import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createDOMRenderer, RendererProvider, FluentProvider, webDarkTheme, webLightTheme, type Theme } from "@fluentui/react-components";
import { getStyleNonce } from "../lib/styleNonce";

/** Bridge the existing window theme without adding an opaque page surface. */
export default function TieZFluentProvider({ children }: { children: ReactNode }) {
  const [renderer] = useState(() => {
    const nonce = getStyleNonce();
    return createDOMRenderer(document, { styleElementAttributes: nonce ? { nonce } : undefined });
  });
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark-mode"));
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark-mode"));
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => observer.disconnect();
  }, []);
  const theme = useMemo<Theme>(() => {
    const base = dark ? webDarkTheme : webLightTheme;
    const accent = "var(--accent-color)";
    const hover = `color-mix(in srgb, ${accent} 88%, ${dark ? "white" : "black"})`;
    const pressed = `color-mix(in srgb, ${accent} 76%, ${dark ? "white" : "black"})`;
    const tint = `color-mix(in srgb, ${accent} 14%, var(--bg-input))`;
    // Cover the full family, including neutral foregrounds' branded interaction
    // states. Keep on-brand contrast colors and neutral shadows from Fluent.
    const brandColors = Object.fromEntries(Object.keys(base)
      .filter(key => key.startsWith("color") && key.includes("Brand") &&
        !key.startsWith("colorNeutralForegroundOnBrand") && !key.startsWith("colorNeutralStrokeOnBrand") &&
        !key.includes("Shadow") && key !== "colorBrandBackgroundInverted")
      .map(key => [key, key.includes("Background2") || key.includes("BackgroundInverted") ? tint :
        key.includes("Stroke2") ? `color-mix(in srgb, ${accent} 50%, var(--bg-input))` :
        key.endsWith("Hover") ? hover : key.endsWith("Pressed") || key.endsWith("Selected") ? pressed : accent]));
    return {
      ...base,
      ...brandColors,
      fontFamilyBase: '\"Segoe UI Variable\", \"Segoe UI\", \"Microsoft YaHei\", sans-serif',
      fontSizeBase300: "13px",
      colorNeutralForeground1: "var(--text-primary)",
      colorNeutralForeground2: "var(--text-secondary)",
      colorNeutralBackground1: "var(--bg-input)",
      colorNeutralStroke1: "var(--line-soft)",
      colorNeutralStroke1Hover: "var(--line-strong)",
    };
  }, [dark]);
  return (
    <RendererProvider renderer={renderer}>
      <FluentProvider className="tiez-fluent-provider" theme={theme} style={{ display: "contents", backgroundColor: "transparent" }}>
        {children}
      </FluentProvider>
    </RendererProvider>
  );
}
