import assert from 'node:assert/strict';
import { createServer, build, preview } from 'vite';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
const production = process.argv.includes('--release');
const config = { cacheDir: 'node_modules/.cache/tag-tests-vite', build: { outDir: 'artifacts/tag-production', rollupOptions: { input: resolve('tests/tag-manager.fixture.html') } } };
if (production) await build(config);
const server = production ? await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } }) : await createServer({ ...config, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  if (!production) await server.listen();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.setDefaultTimeout(10000);
  if (production) await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace(/<style\b/g, '<style nonce="tiez-release-test"');
    await route.fulfill({ response, body, headers: { ...response.headers(), 'content-security-policy': "style-src 'self' 'unsafe-inline' 'nonce-tiez-release-test'" } });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/tag-manager.fixture.html`);
  const row = page.locator('.tag-scroll .tag-item').filter({ hasText: '工作标签' });
  await row.hover();
  const remove = row.getByRole('button', { name: '删除标签', exact: true });
  await remove.waitFor({ state: 'visible' });
  const geometry = await remove.evaluate(el => {
    const icon = el.querySelector('svg').getBoundingClientRect();
    const area = el.closest('.tag-name-area').getBoundingClientRect();
    return { icon: { x: icon.x, right: icon.right, width: icon.width }, area: { x: area.x, right: area.right } };
  });
  assert.equal(geometry.icon.width, 13);
  assert.ok(geometry.icon.x >= geometry.area.x && geometry.icon.right <= geometry.area.right, 'delete SVG fits inside the clipping area');
  await remove.click();
  const dialog = page.getByRole('dialog', { name: '要删除标签吗？' });
  await dialog.waitFor();
  const height = await dialog.evaluate(el => el.offsetHeight);
  await dialog.getByRole('button', { name: '删除', exact: true }).click();
  assert.equal(await dialog.evaluate(el => el.offsetHeight), height, 'pending deletion retains dialog height');
  assert.ok((await dialog.textContent()).includes('工作标签'));
  await page.evaluate(() => {
    window.tagHeights = [];
    const sample = () => { const el = document.querySelector('[role="dialog"]'); if (!el) return; window.tagHeights.push(el.offsetHeight); requestAnimationFrame(sample); };
    sample(); window.tagTest.finishDelete();
  });
  await dialog.waitFor({ state: 'hidden' });
  assert.ok((await page.evaluate(() => window.tagHeights)).every(value => value === height), 'closing cannot collapse content height');
  const add = page.getByRole('button', { name: '添加标签', exact: true });
  assert.equal(await add.evaluate(el => el === [...el.closest('.tag-scroll').querySelectorAll('.tag-item')].at(-1)), true, 'create action is last in the tag list');
  await add.click();
  const create = page.getByRole('dialog', { name: '添加标签', exact: true });
  const name = create.getByRole('textbox', { name: '标签名称' });
  await name.fill('新标签');
  await name.press('Enter');
  await create.waitFor({ state: 'hidden' });
  await page.locator('.tag-scroll .tag-item').filter({ hasText: '新标签' }).waitFor();
  await add.click(); await name.fill('新标签'); await name.press('Enter');
  await create.getByText('该标签已存在').waitFor();
  await name.fill('保存失败的标签');
  await page.evaluate(() => window.tagTest.failCreate(true));
  await name.press('Enter');
  await create.getByRole('alert').filter({ hasText: '添加失败' }).waitFor();
  assert.equal(await name.inputValue(), '保存失败的标签');
  await page.keyboard.press('Escape'); await create.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 360, height: 600 });
  await add.click(); await name.waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.tag-search-box input, .sidebar-search input').first().click();
  const suggestion = page.locator('.tag-suggestions-dropdown .tag-item').filter({ hasText: '其他标签' });
  await suggestion.hover();
  for (const label of ['重命名标签', '删除标签']) {
    const action = suggestion.getByRole('button', { name: label, exact: true });
    await action.waitFor();
    assert.ok(await action.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'narrow suggestion action must be hit-testable: ' + label);
  }
  assert.deepEqual(errors, []);
  console.log('Tags: visible hover delete icon, stable confirmation height, add/duplicate/failure flows and narrow layout passed.');
} finally { await browser?.close(); await server.close(); }
