import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
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
  const headerInsets = await page.getByTestId("main-header").evaluate(el => {
    const header = el.querySelector('.header-top').getBoundingClientRect();
    const title = el.querySelector('.header-title').getBoundingClientRect();
    const paths = [...el.querySelectorAll('.header-actions .lucide-x path')];
    const visibleRight = Math.max(...paths.map(path => path.getBoundingClientRect().right +
      parseFloat(getComputedStyle(path).strokeWidth) * Math.abs(path.getScreenCTM().a) / 2));
    return { left: title.left - header.left, right: header.right - visibleRight };

  });
  assert.ok(Math.abs(headerInsets.left - headerInsets.right) < 1, "close icon and title have equal visible edge insets: " + JSON.stringify(headerInsets));
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
  const triggerWidth = (await dropdown.boundingBox()).width;
  assert.equal(triggerWidth, 160, "default dropdown width is fixed");
  await page.evaluate(() => {
    window.__dropdownFrames = [];
    window.__sampleDropdown = true;
    const sample = () => {
      const popup = document.querySelector('[role="listbox"]');
      const trigger = document.querySelector('[role="combobox"]');
      const selected = popup?.querySelector('[aria-selected="true"]');
      if (popup && trigger && selected) {
        const style = getComputedStyle(popup);
        if (style.visibility === "visible" && Number(style.opacity) > 0) {
          const a = selected.getBoundingClientRect(), b = trigger.getBoundingClientRect();
          window.__dropdownFrames.push({ selected: selected.textContent, y: popup.getBoundingClientRect().top, x: popup.getBoundingClientRect().left,
            error: Math.abs(a.top + a.height / 2 - b.top - b.height / 2) });
        }
      }
      if (window.__sampleDropdown) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await dropdown.click();
  await page.getByRole("option", { name: "Alt", exact: true }).waitFor({ state: "visible", timeout: 3000 }).catch(async (error) => {
    await mkdir("artifacts/fluent-components", { recursive: true });
    await page.screenshot({ path: "artifacts/fluent-components/popup-failure.png" });
    throw error;
  });
  await page.getByRole("option", { name: "Alt", exact: true }).click();
  await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('.home-search-wrapper'), '::after').transform).a === 0);
  assert.equal(await page.getByTestId("selected-value").textContent(), "alt");
  const frames = await page.evaluate(() => { window.__sampleDropdown = false; return window.__dropdownFrames; });
  assert.ok(frames.length > 0, "sample visible frames throughout opening animation");
  assert.ok(frames.every(frame => frame.x > 8 && frame.error < 3), "every visible frame is anchored, including during scale-in: " + JSON.stringify(frames.filter(frame => frame.x <= 8 || frame.error >= 3).slice(0, 3)));
  assert.equal((await dropdown.boundingBox()).width, triggerWidth, "selection does not resize trigger");
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
  assert.equal(await page.getByRole("listbox").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(45, 45, 45)", "popup matches Tag Manager's dark Fluent surface");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 600 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "narrow window fits");
  await dropdown.click();
  await page.getByRole("listbox").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const row = document.querySelector('[role="option"][aria-selected="true"]');
    const trigger = document.querySelector('[role="combobox"]');
    if (!row || !trigger) return false;
    const a = row.getBoundingClientRect(), b = trigger.getBoundingClientRect();
    return Math.abs(a.top + a.height / 2 - b.top - b.height / 2) < 3;
  });
  // A pointer action waits for the scale-in animation to settle before capture.
  await page.getByRole("option", { name: "Alt", exact: true }).hover();
  const popupBounds = await page.getByRole("listbox").boundingBox();
  assert.ok(popupBounds.x >= 0 && popupBounds.x + popupBounds.width <= 321, "popup fits narrow window");
  await mkdir("artifacts/fluent-components", { recursive: true });
  await page.screenshot({ path: "artifacts/fluent-components/dark-narrow.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 480, height: 700 });
  await page.evaluate(() => document.documentElement.style.setProperty("--accent-color", "#d13a80"));
  const keep = page.getByRole("switch", { name: "保留工作区材料" });
  await keep.focus(); await page.keyboard.press("Space");
  assert.equal(await keep.isChecked(), true, "Space toggles a labelled setting switch");
  await keep.hover();
  await page.waitForFunction(() => {
    const input = document.querySelector('[role="switch"]');
    const color = getComputedStyle(input.parentElement.querySelector('.fui-Switch__indicator')).backgroundColor;
    return color !== "rgb(15, 108, 189)" && color !== "rgb(98, 171, 245)";
  });
  const assertAccent = async () => {
    await page.waitForFunction(input => {
      const probe = document.createElement("span");
      const mix = document.documentElement.classList.contains("dark-mode") ? "white" : "black";
      probe.style.color = `color-mix(in srgb, var(--accent-color) 88%, ${mix})`;
      input.parentElement.appendChild(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return getComputedStyle(input.parentElement.querySelector('.fui-Switch__indicator')).backgroundColor === expected;
    }, await keep.elementHandle());
  };
  await assertAccent();
  await page.getByRole("button", { name: "切换主题" }).click();
  await keep.hover(); await assertAccent();
  await page.getByRole("button", { name: "切换主题" }).click();
  await keep.focus(); await page.keyboard.press("Space");
  assert.equal(await keep.isChecked(), false);
  assert.equal(await page.getByRole("switch", { name: "禁用开关" }).isDisabled(), true);
  const checkbox = page.getByRole("checkbox", { name: "包括标签" });
  await checkbox.check(); assert.equal(await keep.isChecked(), true);
  const slider = page.getByRole("slider", { name: "提示音量" });
  await slider.focus(); await page.keyboard.press("Home");
  assert.equal(await slider.inputValue(), "0");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByTestId("volume").textContent(), "0.01");
  await page.keyboard.press("End");
  assert.equal(await slider.inputValue(), "1");
  const bounds = await slider.boundingBox();
  await slider.click({ position: { x: bounds.width * 0.75, y: bounds.height / 2 } });
  assert.ok(Number(await slider.inputValue()) > 0.6 && Number(await slider.inputValue()) < 0.9, "pointer adjusts slider");
  const spin = page.getByRole("spinbutton", { name: "历史容量" });
  await spin.fill("99"); await spin.press("Tab");
  assert.equal(await spin.inputValue(), "10", "numeric commit clamps max");
  await spin.fill(""); await spin.press("Tab");
  assert.equal(await spin.inputValue(), "1", "blank numeric commit falls back to min");
  await spin.focus(); await spin.press("ArrowUp");
  assert.equal(await spin.inputValue(), "2");
  await page.getByRole("button", { name: "增加", exact: true }).click();
  assert.equal(await spin.inputValue(), "3", "official spin buttons adjust value");
  const expander = page.getByRole("button", { name: "高级选项" });
  await expander.focus(); await expander.press("Enter");
  assert.equal(await expander.getAttribute("aria-expanded"), "true");
  await page.getByRole("button", { name: "展开后的操作" }).waitFor({ state: "visible" });
  await expander.press("Space");
  assert.equal(await expander.getAttribute("aria-expanded"), "false");
  const soundHeader = page.getByRole("button", { name: "提示音设置" });
  assert.equal(await soundHeader.isDisabled(), true);
  const soundSwitch = page.getByRole("switch", { name: "提示音设置" });
  await soundSwitch.focus(); await soundSwitch.press("Space");
  assert.equal(await soundHeader.isDisabled(), false);
  assert.equal(await soundHeader.getAttribute("aria-expanded"), "false", "switch does not also expand its row");
  assert.equal(await page.locator("button button, button input").count(), 0, "no nested interactive controls");
  assert.equal(await page.getByRole("button", { name: "正在保存" }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "正在保存" }).getAttribute("aria-busy"), "true");
  const fixed = page.getByRole("combobox", { name: "固定宽度测试" });
  const shortWidth = (await fixed.boundingBox()).width;
  await fixed.click();
  const shortPopupWidth = (await page.getByRole("listbox").boundingBox()).width;
  await page.getByRole("option", { name: "这是一项很长的修饰键选项文字", exact: true }).click();
  assert.equal((await fixed.boundingBox()).width, shortWidth, "long selection does not grow trigger");
  await fixed.click();
  const longPopup = page.getByRole("listbox");
  assert.equal((await longPopup.boundingBox()).width, shortPopupWidth, "long selection does not grow popup");
  assert.equal(shortPopupWidth, shortWidth + 8, "popup has fixed frame padding around trigger width");
  assert.equal(await longPopup.locator('.tiez-dropdown-option-label').last().evaluate(el => getComputedStyle(el).textOverflow), "ellipsis");
  await page.keyboard.press("Escape");
  const frameRadius = () => page.locator('#root').evaluate(el => getComputedStyle(el).borderTopLeftRadius);
  const normalRadius = await frameRadius();
  assert.notEqual(normalRadius, "0px");
  for (const action of ["模拟最大化", "模拟吸附"]) {
    await page.getByRole("button", { name: action }).click();
    assert.equal(await frameRadius(), "0px", "native square state removes the DOM shell radius");
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--shell-radius').trim()), "0px", "Canvas reads zero from the same radius token");
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el, '::before').clipPath), "none", "background clipping also becomes square");
    await page.getByRole("button", { name: "模拟还原" }).click();
    assert.equal(await frameRadius(), normalRadius, "restoring recovers the theme's normal radius");
  }
  const danger = page.getByRole("button", { name: "删除材料", exact: true });
  assert.equal(await danger.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(196, 43, 28)", "danger button remains red");
  assert.equal(await danger.evaluate(el => getComputedStyle(el).color), "rgb(255, 255, 255)");
  const opener = page.getByRole("button", { name: "打开对话框", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "处理材料", exact: true });
  await dialog.waitFor({ state: "visible" });
  assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, "opening moves focus into dialog");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, "Tab stays inside modal");
  }
  await page.keyboard.press("Shift+Tab");
  assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
  await page.getByRole("combobox", { name: "输出格式" }).click();
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true, "first Escape closes only dropdown");
  assert.equal(await page.getByRole("listbox").count(), 0);
  await page.getByRole("button", { name: "打开子对话框" }).click();
  await page.getByRole("dialog", { name: "子对话框", exact: true }).waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "子对话框", exact: true }).waitFor({ state: "hidden" });
  assert.equal(await dialog.isVisible(), true, "nested Escape preserves parent dialog");
  await page.waitForFunction(() => document.activeElement?.textContent === "打开子对话框");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.textContent === "打开对话框");
  await page.getByRole("button", { name: "打开受限对话框" }).click();
  await dialog.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true, "closeOnEscape=false retained");
  await page.locator(".fluent-modal-overlay").click({ position: { x: 2, y: 2 } });
  assert.equal(await dialog.isVisible(), true, "closeOnOverlayClick=false retained");
  await page.getByRole("button", { name: "取消处理" }).click();
  await dialog.waitFor({ state: "hidden" });
  await opener.click(); await dialog.waitFor({ state: "visible" });
  await page.screenshot({ path: "artifacts/fluent-components/dialog-dark.png", animations: "disabled" });
  await page.locator(".fluent-modal-overlay").click({ position: { x: 2, y: 2 } });
  await dialog.waitFor({ state: "hidden" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedDuration = await page.locator(".home-search-wrapper").evaluate((el) => getComputedStyle(el, "::after").transitionDuration);
  assert.ok(parseFloat(reducedDuration) < 0.001, "reduced motion respected");
  const startup = await browser.newPage();
  await startup.route("**/src/main.tsx", route => route.abort());
  await startup.goto(`http://127.0.0.1:${address.port}/?window=settings&color_mode=dark`);
  assert.equal(await startup.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), "rgb(32, 32, 32)", "settings is opaque before React loads");
  await startup.addStyleTag({ content: await readFile("src/styles/components/fluent-settings.css", "utf8") });
  await startup.addStyleTag({ content: await readFile("src/styles/themes/mica.css", "utf8") });
  await startup.evaluate(() => {
    document.documentElement.classList.add("theme-mica", "dark-mode");
    document.body.className = "is-settings-window theme-mica dark-mode";
  });
  for (const selector of ["html", "body", "#root"]) {
    assert.equal(await startup.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor), "rgb(32, 32, 32)", "startup fallback wins over transparent settings layers");
  }
  await startup.close();
  const quick = await browser.newPage({ viewport: { width: 480, height: 900 } });
  quick.on("pageerror", error => errors.push(error.message));
  await quick.goto(`http://127.0.0.1:${address.port}/tests/list-quick-paste.fixture.html`);
  const tips = quick.locator('.quick-paste-hint');
  const pasteLog = () => quick.getByTestId('pasted').textContent().then(JSON.parse);
  const geometry = () => quick.locator('.history-item').evaluateAll(items => items.map(item => {
    const r = item.getBoundingClientRect();
    const c = item.querySelector('.content-preview').getBoundingClientRect();
    return [r.x, r.y, r.width, r.height, c.x, c.y, c.width, c.height];
  }));
  for (const compact of [false, true]) {
    if (compact) await quick.getByRole('button', { name: 'Compact', exact: true }).click();
    const before = await geometry();
    await quick.keyboard.down('Alt');
    await tips.first().waitFor();
    assert.equal(await tips.count(), 10);
    assert.deepEqual(await tips.allTextContents(), ['1','2','3','4','5','6','7','8','9','0']);
    assert.deepEqual(await geometry(), before, 'KeyTips leave item and content geometry unchanged');
    await quick.screenshot({ path: `artifacts/fluent-components/list-keytips-${compact ? 'compact' : 'normal'}.png` });
    await quick.keyboard.up('Alt');
    await tips.first().waitFor({ state: 'hidden' });
    assert.deepEqual(await geometry(), before);
  }
  await quick.keyboard.press('Alt+1');
  assert.deepEqual(await pasteLog(), [3], 'pinned first matches displayed order');
  await quick.keyboard.press('Alt+0');
  assert.deepEqual(await pasteLog(), [3, 10], 'zero selects tenth entry');
  await quick.keyboard.down('Alt'); await quick.keyboard.down('2'); await quick.keyboard.down('2');
  await quick.keyboard.up('2'); await quick.keyboard.up('Alt');
  assert.deepEqual(await pasteLog(), [3, 10, 1], 'auto repeat pastes once');
  await quick.getByRole('button', { name: 'Workspace', exact: true }).click();
  await quick.keyboard.down('Alt');
  await tips.first().waitFor();
  assert.equal(await tips.count(), 3, 'workspace only numbers its own entries');
  await quick.keyboard.press('2'); await quick.keyboard.up('Alt');
  assert.deepEqual(await pasteLog(), [3, 10, 1, 8]);
  await quick.getByRole('button', { name: 'Workspace', exact: true }).click();
  await quick.getByRole('textbox', { name: 'Search', exact: true }).fill('Entry 12');
  await quick.keyboard.press('Alt+1');
  assert.deepEqual(await pasteLog(), [3, 10, 1, 8, 12], 'search uses filtered order');
  await quick.getByRole('textbox', { name: 'Search', exact: true }).fill('');
  await quick.getByRole('textbox', { name: 'Note', exact: true }).focus();
  await quick.keyboard.press('Alt+1');
  assert.equal((await pasteLog()).length, 5, 'note editing owns its keys');
  await quick.getByRole('button', { name: 'Dialog', exact: true }).click();
  await quick.keyboard.press('Alt+1');
  assert.equal((await pasteLog()).length, 5, 'dialogs block list paste');
  await quick.getByRole('button', { name: 'Dialog', exact: true }).click();
  await quick.keyboard.press('Control+Alt+1'); await quick.keyboard.press('Alt+Shift+1');
  assert.equal((await pasteLog()).length, 5, 'other modifier combinations stay available');
  await quick.keyboard.down('Alt'); await tips.first().waitFor();
  await quick.evaluate(() => window.dispatchEvent(new Event('blur')));
  await tips.first().waitFor({ state: 'hidden' });
  await quick.keyboard.up('Alt');
  await quick.getByRole('button', { name: 'Enabled', exact: true }).click();
  await quick.keyboard.press('Alt+1');
  assert.equal((await pasteLog()).length, 5, 'non-list views disable paste');
  await quick.getByRole('button', { name: 'Enabled', exact: true }).click();
  for (const [id, label, keys] of [
    ['ctrl', 'Ctrl', ['Control']], ['shift', 'Shift', ['Shift']],
    ['ctrl+alt', 'Ctrl + Alt', ['Control', 'Alt']],
    ['ctrl+shift', 'Ctrl + Shift', ['Control', 'Shift']],
    ['alt+shift', 'Alt + Shift', ['Alt', 'Shift']],
    ['ctrl+alt+shift', 'Ctrl + Alt + Shift', ['Control', 'Alt', 'Shift']],
  ]) {
    await quick.getByRole('combobox', { name: 'Quick paste modifier', exact: true }).click();
    await quick.getByRole('option', { name: label, exact: true }).click();
    await quick.getByRole('textbox', { name: 'Search', exact: true }).focus();
    const count = (await pasteLog()).length;
    const before = await geometry();
    for (const key of keys) await quick.keyboard.down(key);
    await tips.first().waitFor();
    assert.deepEqual(await geometry(), before, `${id} KeyTips do not move content`);
    await quick.keyboard.press('1');
    for (const key of [...keys].reverse()) await quick.keyboard.up(key);
    await tips.first().waitFor({ state: 'hidden' });
    assert.equal((await pasteLog()).length, count + 1, `${id} pastes exactly once`);
    assert.equal((await pasteLog()).at(-1), 3);
    await quick.keyboard.press('Alt+1');
    assert.equal((await pasteLog()).length, count + 1, 'old modifier no longer active');
  }
  await quick.getByRole('combobox', { name: 'Quick paste modifier', exact: true }).click();
  await quick.getByRole('option', { name: '关闭', exact: true }).click();
  await quick.getByRole('textbox', { name: 'Search', exact: true }).focus();
  const disabledCount = (await pasteLog()).length;
  await quick.keyboard.press('Alt+1'); await quick.keyboard.press('Control+Alt+Shift+1');
  assert.equal((await pasteLog()).length, disabledCount, 'shortcut can be disabled');
  await quick.close();
  assert.deepEqual(errors, []);
  console.log("Fluent browser checks passed: input/IME, dropdown, tooltip, labelled switches, slider pointer/keys, spin bounds, accordion, button states, modal focus/trap/restore, nested dismissal and dark portals.");
} finally {
  await browser?.close();
  await server.close();
}
