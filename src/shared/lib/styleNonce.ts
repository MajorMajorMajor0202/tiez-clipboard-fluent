/** Tauri adds a per-response nonce to the startup style in release assets. */
export function getStyleNonce(targetDocument: Document = document): string | undefined {
  const anchor = targetDocument.getElementById("tiez-style-nonce") as HTMLStyleElement | null;
  const fallback = targetDocument.querySelector<HTMLStyleElement>("style[nonce]");
  // Browsers hide nonce attribute values from getAttribute(); use the DOM property.
  return anchor?.nonce || fallback?.nonce || undefined;
}
