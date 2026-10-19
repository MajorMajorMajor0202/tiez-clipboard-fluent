import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedWriter } from "./debouncedWriter";
afterEach(() => vi.useRealTimers());
describe("note save queue", () => {
  it("flushes the last keystroke immediately before close", async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedWriter(write, vi.fn());
    writer.schedule("old"); writer.schedule("last edit");
    await writer.flush();
    expect(write).toHaveBeenCalledExactlyOnceWith("last edit");
    expect(writer.dirty).toBe(false);
  });
  it("serializes edits arriving while a write is still in flight", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const writes: string[] = [];
    const writer = createDebouncedWriter(async (text: string) => {
      writes.push(text);
      if (text === "first") await new Promise<void>((resolve) => { finish = resolve; });
    }, vi.fn());
    writer.schedule("first");
    const closing = writer.flush();
    writer.schedule("latest"); finish(); await closing;
    expect(writes).toEqual(["first", "latest"]);
  });
  it("keeps failed content dirty and allows a retry", async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockRejectedValueOnce(Error("disk full")).mockResolvedValue(undefined);
    const writer = createDebouncedWriter(write, vi.fn());
    writer.schedule("precious draft");
    await expect(writer.flush()).rejects.toThrow("disk full");
    expect(writer.dirty).toBe(true);
    await writer.flush();
    expect(writer.dirty).toBe(false);
  });
});
