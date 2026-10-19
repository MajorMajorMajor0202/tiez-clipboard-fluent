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
});
