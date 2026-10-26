'use strict';
// Synthetic localhost fixture only. No ChatGPT account or real WebDAV requests.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Pro Counter Synthetic Fixture</title><style>body{background:#f4f5f3;font-family:sans-serif;margin:55px;color:#56605a}h2{font-weight:500}p{max-width:440px;line-height:1.8}</style><body><form style="position:fixed;bottom:120px;left:25%;width:50%;background:white;border:1px solid #ddd;border-radius:20px;padding:20px"><div id="prompt-textarea" contenteditable="true" style="height:60px">合成输入框</div><button id="native-pro" type="button" aria-label="思考强度">Pro</button></form><h2>本地 UI 验证页</h2><p>此页面使用合成请求和模拟存储。没有连接 ChatGPT 账号，也没有向真实 WebDAV 服务器发送数据。</p></body></html>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1180, height: 920 }, acceptDownloads: true });
  const errors = [];
  await context.addInitScript(() => {
    window.unsafeWindow = window;
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (opts) { return attach.call(this, { ...opts, mode: 'open' }); }; // test inspection only
    window.GM_getValue = (key, fallback) => localStorage.getItem(key) == null ? fallback : JSON.parse(localStorage.getItem(key));
    window.GM_setValue = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    window.GM_listValues = () => Object.keys(localStorage).filter(k => k.startsWith('gpc.v1.'));
    window.GM_registerMenuCommand = () => {};
    window.GM_info = { scriptHandler: 'Tampermonkey', version: '5.5.1' };
    window.__calls = []; window.__davDelay = 1; window.__davStatus = 0;
    window.GM_xmlhttpRequest = opts => {
      window.__calls.push({ method: opts.method, headers: opts.headers, data: opts.data, url: opts.url });
      const timer = setTimeout(() => {
        const raw = localStorage.getItem('__davRemote');
        const status = window.__davStatus || (opts.method === 'GET' ? (raw ? 200 : 404) : 201);
        if (opts.method === 'PUT' && status < 300) localStorage.setItem('__davRemote', opts.data);
        const text = opts.method === 'GET' && status === 200 ? raw : '';
        opts.onloadstart({ status, finalUrl: opts.url, responseHeaders: 'ETag: "fixture-etag"', response: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } }) });
      }, window.__davDelay);
      return { abort() { clearTimeout(timer); opts.onabort(); } };
    };
    window.fetch = function (input, init) {
      let obj = {}; try { obj = JSON.parse(init?.body || '{}'); } catch {}
      if (obj.fail) return Promise.resolve(new Response('{"error":"fixture"}', { status: 429, headers: { 'content-type': 'application/json' } }));
      const data = `data: ${JSON.stringify({ message: { author: { role: 'assistant' }, metadata: { model_slug: obj.model, resolved_model_slug: obj.model } } })}\n\ndata: [DONE]\n\n`;
      return Promise.resolve(new Response(data, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    };
  });
  async function open() { const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(base); await page.addScriptTag({ path: require('node:path').join(__dirname, '../../chatgpt-pro-counter.user.js') }); await page.locator('#chatgpt-pro-local-counter [data-action="expand"]').click(); return page; }
  const page = await open();
  const panel = page.locator('#chatgpt-pro-local-counter');
  async function used(p = page) { return Number((await p.locator('#chatgpt-pro-local-counter .number').innerText()).split('/')[0].trim()); }
  async function send(p, id, model = 'gpt-5-4-pro', fail = false) { await p.evaluate(async ({ id, model, fail }) => { const r = await fetch('/backend-api/f/conversation', { method: 'POST', body: JSON.stringify({ action: 'next', model, fail, messages: [{ id, author: { role: 'user' }, content: { parts: ['SYNTHETIC ONLY'] } }] }) }); await r.text(); }, { id, model, fail }); await p.waitForTimeout(200); }
  assert.equal(await used(), 0);
  await send(page, 'message-a'); assert.equal(await used(), 1);
  await send(page, 'message-a'); assert.equal(await used(), 1);
  await send(page, 'message-thinking', 'gpt-5-thinking'); assert.equal(await used(), 1);
  await send(page, 'message-fail', 'gpt-5-pro', true); assert.equal(await used(), 1);
  await page.evaluate(() => fetch('/backend-api/conversation/history')); assert.equal(await used(), 1);
  await panel.locator('[data-action="plus"]').click(); assert.equal(await used(), 2);
  await panel.locator('[data-action="minus"]').click(); assert.equal(await used(), 1);
  await panel.locator('nav [data-action="settings"]').click();
  await panel.locator('#calibrate').fill('12'); await panel.locator('button[type="submit"]').click(); assert.equal(await used(), 12);
  await panel.locator('[data-action="collapse"]').click(); assert.equal(await panel.locator('.chip').count(), 1);
  await page.locator('#native-pro').hover();
  await page.locator('#chatgpt-pro-local-hover .hover-card').waitFor({ state: 'visible' });
  assert.match(await page.locator('#chatgpt-pro-local-hover .number').innerText(), /88\s*次剩余/);
  assert.match(await page.locator('#chatgpt-pro-local-hover .hover-footer').innerText(), /12\s*\/\s*100/);
  fs.mkdirSync('artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: 'artifacts/screenshots/hover-light.png', fullPage: true });
  await page.locator('#native-pro').click();
  assert.equal(await page.locator('#chatgpt-pro-local-hover').isVisible(), false);
  await panel.locator('[data-action="expand"]').click(); assert.equal(await used(), 12);
  const page2 = await open(); assert.equal(await used(page2), 12);
  await Promise.all([send(page, 'tab-one'), send(page2, 'tab-two')]);
  await panel.locator('nav [data-action="log"]').click(); await panel.locator('nav [data-action="home"]').click(); assert.equal(await used(), 14);
  await panel.locator('nav [data-action="sync"]').click();
  await panel.locator('#dav-url').fill('https://dav.invalid/private/pro-counter.json');
  await panel.locator('#dav-user').fill('fixture-user'); await panel.locator('#dav-pass').fill('TEST-ONLY-NOT-REAL'); await panel.locator('#dav-approved').check();
  await panel.locator('button[type="submit"]').click(); await page.waitForTimeout(100);
  assert.match(await panel.innerText(), /读取测试通过/);
  await panel.locator('[data-action="sync-now"]').click(); await page.waitForTimeout(100); assert.match(await panel.innerText(), /同步成功/);
  const remote = await page.evaluate(() => localStorage.getItem('__davRemote'));
  assert.equal(remote.includes('TEST-ONLY-NOT-REAL'), false); assert.equal(remote.includes('fixture-user'), false); assert.equal(remote.includes('SYNTHETIC ONLY'), false);
  // Clear during delayed read must cancel without restoring credentials or doing a PUT.
  await page.evaluate(() => { window.__davDelay = 500; });
  await panel.locator('button[type="submit"]').click();
  page.once('dialog', d => d.accept()); await panel.locator('[data-action="sync-clear"]').click(); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => GM_getValue('gpc.v1.webdav').password), '');
  assert.equal(await page.evaluate(() => GM_getValue('gpc.v1.webdav').enabled), false);
  await panel.locator('nav [data-action="home"]').click();
  const downloadPromise = page.waitForEvent('download'); await panel.locator('[data-action="export"]').click(); const download = await downloadPromise;
  const exported = fs.readFileSync(await download.path(), 'utf8'); assert.equal(exported.includes('TEST-ONLY-NOT-REAL'), false);
  fs.mkdirSync('artifacts/screenshots', { recursive: true });
  await page.screenshot({ path: 'artifacts/screenshots/overview-light.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' }); await page.evaluate(() => { document.body.style.background = '#171a1e'; document.body.style.color = '#a5afa8'; });
  await page.screenshot({ path: 'artifacts/screenshots/overview-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.locator('nav [data-action="settings"]').click();
  assert.equal(await panel.locator('.panel').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
  await page.screenshot({ path: 'artifacts/screenshots/settings-mobile.png', fullPage: true });
  await panel.locator('nav [data-action="sync"]').click(); await page.screenshot({ path: 'artifacts/screenshots/sync-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS UI: fresh install; Pro/retry/Thinking/error/history; +/-; calibration; collapse; two-tab merge; WebDAV configure/sync/secret exclusion; clear during pending read; native JSON export; light/dark/mobile layout. No live requests.');
  await browser.close(); await new Promise(resolve => server.close(resolve));
})().catch(e => { console.error(e); process.exit(1); });
