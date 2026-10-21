import assert from 'node:assert/strict';
import { createServer, build, preview } from 'vite';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const production = process.argv.includes('--release');
const config = { cacheDir: 'node_modules/.cache/rail-assignment-tests-vite', build: { outDir: 'artifacts/rail-assignment-production', rollupOptions: { input: resolve('tests/right-rail.fixture.html') } } };
if (production) await build(config);
const server = production ? await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } }) : await createServer({ ...config, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  if (!production) await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  page.setDefaultTimeout(10000);
  if (production) await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace(/<style\b/g, '<style nonce="tiez-release-test"');
    await route.fulfill({ response, body, headers: { ...response.headers(), 'content-security-policy': "style-src 'self' 'unsafe-inline' 'nonce-tiez-release-test'" } });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/right-rail.fixture.html`);
  const popup = page.locator('.rail-assignment-flyout');
  const open = async (button, overflow = false) => {
    if (overflow) await page.getByRole('button', { name: '更多工具', exact: true }).click();
    const trigger = page.getByRole('button', { name: button, exact: true });
    const anchor = await trigger.boundingBox();
    await trigger.click(); await popup.waitFor({ state: 'visible' });
    const bounds = await popup.boundingBox();
    const viewport = page.viewportSize();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, 'entire popup stays inside window');
    assert.ok(Math.abs(bounds.y - anchor.y) < bounds.height + 16, 'popup stays near the clicked tool');
  };
  await open('Set tags');
  await popup.getByRole('button', { name: '另一个标签', exact: true }).click();
  assert.equal(await popup.getByRole('button', { name: '另一个标签', exact: true }).getAttribute('aria-pressed'), 'true');
  await popup.getByRole('button', { name: '敏感', exact: true }).click();
  assert.equal(await popup.getByRole('button', { name: '敏感', exact: true }).getAttribute('aria-pressed'), 'true');
  const tagInput = popup.getByRole('textbox', { name: '标签名称' });
  await tagInput.fill('新增标签'); await tagInput.press('Enter');
  assert.equal(await popup.getByRole('button', { name: '新增标签', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' });
  await open('Assign to tab');
  await popup.getByRole('button', { name: '测试工作区', exact: true }).click();
  assert.equal(await popup.getByRole('button', { name: '测试工作区', exact: true }).getAttribute('aria-pressed'), 'true');
  const tabInput = popup.getByRole('textbox', { name: '标签页名称' });
  await tabInput.fill('新工作区'); await tabInput.press('Enter');
  await popup.getByRole('button', { name: '新工作区', exact: true }).waitFor();
  await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 352, height: 300 });
  for (const tool of ['Set tags', 'Assign to tab']) {
    await open(tool, true);
    assert.equal(await page.locator('.rail-overflow-surface').count(), 0, 'assignment popup survives its original overflow trigger unmounting');
    await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' });
  }
  assert.deepEqual(errors, []);
  console.log('Rail assignment: independent of list items, trigger positioning, tag/tab assignment, creation and overflow trigger removal passed.');
} finally { await browser?.close(); await server.close(); }
