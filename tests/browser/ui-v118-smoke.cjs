'use strict';
// Optional real-browser checks, with synthetic responses only. All browser
// network is intercepted; no account, live ChatGPT or WebDAV requests occur.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fixtureURL = 'https://chatgpt.com/__toolkit_synthetic_v118__';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } }), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (route.request().url() === fixtureURL && route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><form><textarea id="prompt-textarea"></textarea><button type="button" data-composer-navigation-target="reasoning">Pro</button></form>' });
      requests.push(route.request().url()); return route.abort();
    });
    await page.goto(fixtureURL);
    await page.evaluate(() => {
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) { return attach.call(this, { ...options, mode: 'open' }); };
      window.unsafeWindow = window; window.__store = new Map(); window.__calls = 0;
      window.GM_getValue = (key, fallback) => window.__store.has(key) ? structuredClone(window.__store.get(key)) : fallback;
      window.GM_setValue = (key, value) => window.__store.set(key, structuredClone(value));
      window.GM_listValues = () => [...window.__store.keys()]; window.GM_registerMenuCommand = () => {};
      window.GM_xmlhttpRequest = () => { throw Error('Unexpected WebDAV request'); };
      window.fetch = url => {
        window.__calls++;
        const data = url === '/api/auth/session' ? { user: { id: 'user-SYNTHETIC', email: 'SYNTHETIC-EMAIL' }, accessToken: 'SYNTHETIC-TOKEN' } : { proofofwork: { difficulty: '0'.repeat(120) + 'AbCd', required: true, seed: 'SYNTHETIC-SEED' } };
        return Promise.resolve(new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } }));
      };
    });
    await page.addScriptTag({ path: path.join(__dirname, '../../chatgpt-pro-counter.user.js') });
    const root = page.locator('#chatgpt-pro-local-counter');
    await root.locator('[data-action="expand"]').click(); await root.locator('[data-action="settings"]').click();
    assert.equal(await root.locator('#account-off').getAttribute('aria-pressed'), 'true');
    await root.locator('#account-on').click(); assert.match(await root.locator('#account-status').textContent(), /待识别/);
    assert.equal(await page.evaluate(() => window.__calls), 0);
    await page.evaluate(() => window.fetch('/api/auth/session'));
    await page.waitForFunction(() => document.querySelector('#chatgpt-pro-local-counter').shadowRoot.querySelector('#account-status').textContent.includes('已识别'));
    await root.locator('[data-action="log"]').click();
    await page.evaluate(() => window.fetch('/backend-api/sentinel/chat-requirements/prepare', { method: 'POST' }));
    await page.waitForFunction(() => document.querySelector('#chatgpt-pro-local-counter').shadowRoot.querySelector('#pow-status').textContent.includes('AbCd'));
    for (const width of [900, 320, 240, 180]) {
      await page.setViewportSize({ width, height: 800 });
      assert.equal(await root.locator('.panel').evaluate(element => element.scrollWidth <= element.clientWidth), true, `no horizontal overflow at ${width}`);
      assert.match(await root.locator('#pow-status').textContent(), /是否要求：是/);
    }
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForFunction(() => document.querySelector('#chatgpt-pro-local-counter').hasAttribute('data-dark'));
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify([...window.__store])), /user-SYNTHETIC|SYNTHETIC-EMAIL|SYNTHETIC-TOKEN|SYNTHETIC-SEED|AbCd/);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('#chatgpt-pro-local-counter').shadowRoot.querySelector('#pow-status').textContent.includes('暂未捕获'));
    assert.match(await root.locator('.panel').textContent(), /待识别/);
    assert.equal(await page.evaluate(() => window.__calls), 2); assert.deepEqual(requests, []); assert.deepEqual(errors, []);
    console.log('PASS Chromium synthetic v1.1.8: account opt-in and isolation, PoW leading zeros, narrow/dark layout, lifecycle clearing and zero extra traffic.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
