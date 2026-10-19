import { describe, expect, it, vi } from "vitest";
import { presentSettingsWindow } from "./settingsWindowPresentation";

describe("settings window readiness", () => {
  it("never reveals a created but unpainted/unmaterialized window", async () => {
    const order: string[] = [];
    let material!: () => void;
    const theme = new Promise<void>((resolve) => { material = resolve; });
    const task = presentSettingsWindow({
      applyTheme: () => theme,
      paint: async () => { order.push("paint"); },
      show: async () => { order.push("show"); },
      hideMain: async () => { order.push("hide-main"); },
      focus: async () => { order.push("focus"); },
    });
    await Promise.resolve();
    expect(order).toEqual([]);
    material();
    await task;
    expect(order).toEqual(["paint", "show", "hide-main", "focus"]);
  });
  it("keeps the main window usable on preparation failure or unmount", async () => {
    const show = vi.fn();
    const hideMain = vi.fn();
    const steps = { applyTheme: async () => { throw Error("material failed"); }, paint: vi.fn(), show, hideMain, focus: vi.fn() };
    await expect(presentSettingsWindow(steps)).rejects.toThrow("material failed");
    await presentSettingsWindow({ ...steps, applyTheme: async () => {}, cancelled: () => true });
    expect(show).not.toHaveBeenCalled();
    expect(hideMain).not.toHaveBeenCalled();
  });
  it("keeps the opaque fallback until post-show material composition finishes", async () => {
    let finish!: () => void;
    const releaseFallback = vi.fn();
    const order: string[] = [];
    const task = presentSettingsWindow({
      applyTheme: async () => { order.push("prepare"); },
      paint: async () => {},
      show: async () => { order.push("show"); },
      hideMain: async () => {}, focus: async () => {},
      settle: () => new Promise<void>(resolve => { finish = resolve; }),
      releaseFallback,
    });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(order).toEqual(["prepare", "show"]);
    expect(releaseFallback).not.toHaveBeenCalled();
    finish(); await task;
    expect(releaseFallback).toHaveBeenCalledOnce();
  });
  it("preserves the solid fallback if the visible-window material step fails", async () => {
    const releaseFallback = vi.fn();
    await expect(presentSettingsWindow({
      applyTheme: async () => {}, paint: async () => {}, show: async () => {},
      hideMain: async () => {}, focus: async () => {},
      settle: async () => { throw Error("DWM failed"); }, releaseFallback,
    })).rejects.toThrow("DWM failed");
    expect(releaseFallback).not.toHaveBeenCalled();
  });

});
