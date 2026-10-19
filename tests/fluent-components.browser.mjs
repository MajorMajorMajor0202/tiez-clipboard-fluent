import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

// Run with node tests/fluent-components.browser.mjs. Override the browser binary
// with PLAYWRIGHT_EXECUTABLE_PATH where the bundled Chromium is unavailable.
const server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 600 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/tests/fluent-components.fixture.html`);
  const input = page.getByRole("textbox", { name: "搜索工作区" });
  await input.fill("工作记忆");
  await page.waitForFunction(() => document.querySelector('[data-testid="search-value"]').textContent === "工作记忆");
  await page.getByRole("button", { name: "清空搜索" }).click();
  assert.equal(await input.inputValue(), "", "external state changes must reach the native input");
  await page.getByRole("button", { name: "聚焦搜索" }).click();
  assert.equal(await input.evaluate((el) => el === document.activeElement), true, "forwarded ref targets native input");
  await input.dispatchEvent("compositionstart", { data: "中" });
  assert.equal(await page.getByTestId("composing").textContent(), "true");
  await input.dispatchEvent("compositionend", { data: "中" });
  assert.equal(await page.getByTestId("composing").textContent(), "false");
  await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('.home-search-wrapper'), '::after').transform).a === 1);
  const animation = await page.locator(".home-search-wrapper").evaluate((el) => {
    const style = getComputedStyle(el, "::after");
    return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
  });
  assert.equal(animation.duration, "0.25s");
  assert.equal(animation.easing, "cubic-bezier(0.1, 0.9, 0.2, 1)");
  const dropdown = page.getByRole("combobox", { name: "粘贴修饰键" });
  assert.ok((await dropdown.boundingBox()).width < 200, "short dropdown retains compact desktop width");
  await dropdown.click();
  await page.getByRole("option", { name: "Alt", exact: true }).waitFor({ state: "visible", timeout: 3000 }).catch(async (error) => {
    await mkdir("artifacts/fluent-components", { recursive: true });
    await page.screenshot({ path: "artifacts/fluent-components/popup-failure.png" });
    throw error;
  });
  await page.getByRole("option", { name: "Alt", exact: true }).click();
  await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('.home-search-wrapper'), '::after').transform).a === 0);
  assert.equal(await page.getByTestId("selected-value").textContent(), "alt");
  await dropdown.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  assert.equal(await page.getByTestId("selected-value").textContent(), "shift", "keyboard option selection");
  await dropdown.click();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("listbox").count(), 0, "Escape closes the menu");
  await page.getByRole("button", { name: "复制", exact: true }).focus();
  await page.getByRole("tooltip").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("tooltip").textContent(), "复制所选材料");
  await page.keyboard.press("Escape");
  await page.getByRole("tooltip").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "删除", exact: true }).hover();
  await page.getByRole("tooltip").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("tooltip").textContent(), "请先选择材料");
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "切换主题" }).click();
  await dropdown.click();
  await page.getByRole("listbox").waitFor({ state: "visible" });
  // Normalize theme hex and computed RGB before comparing the portaled surface.
  assert.equal(await page.getByRole("listbox").evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--bg-input");
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return getComputedStyle(el).backgroundColor === expected;
  }), true, "portaled options inherit the active theme");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 600 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "narrow window fits");
  await dropdown.click();
  await page.getByRole("listbox").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const popup = document.querySelector('[role="listbox"]');
    const trigger = document.querySelector('[role="combobox"]');
    return popup && trigger && popup.getBoundingClientRect().top >= trigger.getBoundingClientRect().bottom - 2;
  });
  // A pointer action waits for the scale-in animation to settle before capture.
  await page.getByRole("option", { name: "Alt", exact: true }).hover();
  const popupBounds = await page.getByRole("listbox").boundingBox();
  assert.ok(popupBounds.x >= 0 && popupBounds.x + popupBounds.width <= 321, "popup fits narrow window");
  await mkdir("artifacts/fluent-components", { recursive: true });
  await page.screenshot({ path: "artifacts/fluent-components/dark-narrow.png" });
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedDuration = await page.locator(".home-search-wrapper").evaluate((el) => getComputedStyle(el, "::after").transitionDuration);
  assert.ok(parseFloat(reducedDuration) < 0.001, "reduced motion respected");
  assert.deepEqual(errors, []);
  console.log("Fluent browser checks passed: controlled input, IME, ref, motion, dropdown mouse/keyboard, Tooltip focus/Escape, dark portals, narrow layout.");
} finally {
  await browser?.close();
  await server.close();
}
