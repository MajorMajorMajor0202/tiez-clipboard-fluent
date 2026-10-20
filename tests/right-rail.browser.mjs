import assert from 'node:assert/strict';
import { createServer, build, preview } from 'vite';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const production = process.argv.includes('--release');
const config = { cacheDir: 'node_modules/.cache/rail-tests-vite', build: { outDir: 'artifacts/rail-production', rollupOptions: { input: resolve('tests/right-rail.fixture.html') } } };
if (production) await build(config);
const server = production
  ? await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } })
  : await createServer({ ...config, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  if (!production) await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (production) await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace(/<style\b/g, '<style nonce="tiez-release-test"');
    await route.fulfill({ response, body, headers: { ...response.headers(), 'content-security-policy': "style-src 'self' 'unsafe-inline' 'nonce-tiez-release-test'" } });
  });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/tests/right-rail.fixture.html`;
  await page.goto(url);
  const more = page.getByRole('button', { name: '更多工具', exact: true });
  await page.getByRole('button', { name: 'Clear all history', exact: true }).waitFor();
  assert.equal(await more.count(), 0, 'tall rail shows every action');
  for (const height of [650, 480, 300]) {
    await page.setViewportSize({ width: 480, height });
    await more.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.rail-actions-overflow .rail-action-slot')].every(el => el.getBoundingClientRect().height === 32));
    const geometry = await page.locator('aside').evaluate(el => {
      const actions = el.querySelector('.rail-actions-overflow');
      const slots = [...actions.querySelectorAll('.rail-action-slot')];
      const last = actions.querySelector('.rail-overflow-trigger').getBoundingClientRect();
      return { slots: slots.map(s => ({ height: s.getBoundingClientRect().height, top: s.getBoundingClientRect().top })), gap: getComputedStyle(actions).gap, bottom: el.querySelector('.rail-bottom-section').getBoundingClientRect().bottom,
        end: last.bottom, limit: actions.getBoundingClientRect().bottom };
    });
    assert.ok(geometry.end <= geometry.limit + 1, 'overflow trigger is fully visible');
    assert.equal(geometry.gap, '3px', 'button spacing stays fixed at every window height');
    assert.ok(Math.abs(geometry.bottom - (height - 8)) < 1, 'bottom navigation stays anchored');
    const bottomBefore = await page.getByRole('button', { name: 'Settings', exact: true }).boundingBox();
    await more.click();
    const popup = page.locator('.rail-overflow-surface');
    await popup.waitFor({ state: 'visible' });
    assert.ok((await popup.boundingBox()).x < (await more.boundingBox()).x, 'flyout opens left');
    assert.deepEqual(await page.getByRole('button', { name: 'Settings', exact: true }).boundingBox(), bottomBefore);
    assert.equal(await page.getByRole('button', { name: 'Clear all history', exact: true }).count(), 1, 'each action has only one live instance');
    await page.getByRole('button', { name: 'Clear all history', exact: true }).click();
    await popup.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('output').textContent(), 'clear');
    await more.click(); await popup.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' });
    assert.equal(await more.evaluate(el => el === document.activeElement), true, 'Escape restores trigger focus');
    await more.click(); await popup.waitFor({ state: 'visible' });
    await page.getByRole('button', { name: '外部按钮' }).click(); await popup.waitFor({ state: 'hidden' });
  }
  await more.click();
  await page.setViewportSize({ width: 480, height: 900 });
  await more.waitFor({ state: 'detached' });
  assert.equal(await page.locator('.rail-overflow-surface').count(), 0, 'growing window closes obsolete flyout');
  await page.setViewportSize({ width: 480, height: 300 });
  await more.click();
  const deleteButton = page.getByRole('button', { name: 'Delete selected item', exact: true });
  await deleteButton.focus();
  await page.keyboard.press('Enter');
  await page.locator('.rail-overflow-surface').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('output').textContent(), 'delete', 'keyboard action that stops propagation still executes and closes the flyout');
  await page.goto(url + '?disabled=1');
  await more.click();
  assert.equal(await page.getByRole('button', { name: 'Move item down', exact: true }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('Right rail: fixed button spacing, responsive overflow, left flyout, callbacks, disabled states, Escape and anchored navigation passed.');
} finally {
  await browser?.close();
  await server.close();
}
