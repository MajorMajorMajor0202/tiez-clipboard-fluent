import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("loadEmojiData", () => {
  it("shares preload and panel requests, and caches the complete result", async () => {
    const data = { groups: [{ name: "表情", emojis: ["😀"] }], dictionary: { "😀": { zh: { name: "笑脸", keywords: [] } } } };
    const fetchData = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetchData);
    const { loadEmojiData, getCachedEmojiData } = await import("./emojiData");

    const preload = loadEmojiData();
    const panel = loadEmojiData();
    expect(panel).toBe(preload);
    expect(await panel).toEqual(data);
    expect(await loadEmojiData()).toBe(getCachedEmojiData());
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a failed request or invalid data", async () => {
    const fetchData = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ groups: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ groups: [{ name: "表情", emojis: ["😀"] }] }) });
    vi.stubGlobal("fetch", fetchData);
    const { loadEmojiData, getCachedEmojiData } = await import("./emojiData");

    await expect(loadEmojiData()).rejects.toThrow("Failed to load");
    await expect(loadEmojiData()).rejects.toThrow("Invalid emoji data");
    expect(getCachedEmojiData()).toBeUndefined();
    await expect(loadEmojiData()).resolves.toEqual({ groups: [{ name: "表情", emojis: ["😀"] }], dictionary: {} });
    expect(fetchData).toHaveBeenCalledTimes(3);
  });
});
