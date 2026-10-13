'use strict';
// Real Chromium events on a synthetic page. No live ChatGPT or WebDAV traffic.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.abort());
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{font:16px sans-serif}#sender{position:fixed;left:700px;bottom:130px}#send{width:42px;height:42px}.outside{position:absolute;left:20px;top:20px}</style><input class="outside" aria-label="Other field"><form id="sender"><button id="send" type="submit" class="cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-composer-primary p-0.5 focus-visible:outline-background-composer-primary" aria-label="发送"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-primary-action text-composer-primary"><path d="M9.33467 16.6663V4.93978L4.6374 9.63704L4.1667 9.16634L3.69599 8.69661L9.52998 2.86263L9.63447 2.77767C9.8925 2.60753 10.2433 2.63564 10.4704 2.86263L16.3034 8.69661L16.3884 8.80111C16.5588 9.05922 16.5306 9.40982 16.3034 9.63704C16.0762 9.89642 15.7255 9.89242 15.4675 9.722L15.363 9.63704L10.6647 4.9388V16.6663C10.6647 17.0336 10.367 17.3314 9.99971 17.3314C9.63259 17.3312 9.33467 17.0335 9.33467 16.6663Z" fill="currentColor"></path></svg></button></form>`);
    await page.evaluate(() => {
      window.unsafeWindow = window;
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) { return attach.call(this, { ...options, mode: 'open' }); }; // test inspection only
      window.__store = new Map(); window.__submits = 0;
      window.GM_getValue = (key, fallback) => __store.has(key) ? structuredClone(__store.get(key)) : fallback;
      window.GM_setValue = (key, value) => __store.set(key, structuredClone(value));
      window.GM_listValues = () => [...__store.keys()]; window.GM_registerMenuCommand = () => {};
      window.GM_info = { scriptHandler: 'Tampermonkey', version: '5.5.1' };
      window.GM_xmlhttpRequest = () => { throw Error('Unexpected network call'); };
      document.querySelector('#sender').addEventListener('submit', event => { window.__submits++; event.preventDefault(); });
    });
    await page.addScriptTag({ content: fs.readFileSync(require('node:path').join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8') });
    const host = page.locator('#chatgpt-pro-local-counter'), hover = page.locator('#chatgpt-pro-local-hover');
    await page.locator('#send').hover(); await hover.locator('.hover-card').waitFor({ state: 'visible' });
    assert.match(await hover.innerText(), /100\s*次剩余/);
    assert.deepEqual(await hover.evaluate(el => { const c = getComputedStyle(el); return [c.display, c.visibility, c.opacity, c.position]; }), ['block', 'visible', '1', 'fixed']);
    await hover.locator('[data-action="manage"]').click(); await host.locator('.panel').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape'); await page.waitForTimeout(160);
    assert.equal(await hover.isVisible(), false, 'focus restoration after Escape must not reopen hover');
    await host.locator('[data-action="expand"]').click(); await host.locator('nav [data-action="settings"]').click();
    await host.locator('#cap').fill('123'); await page.locator('.outside').click();
    assert.equal(await host.locator('.panel').count(), 0); assert.equal(await page.locator('.outside').evaluate(el => document.activeElement === el), true);
    await host.locator('[data-action="expand"]').click(); assert.equal(await host.locator('#cap').inputValue(), '123');
    await host.locator('nav [data-action="sync"]').click(); await host.locator('#dav-pass').fill('SYNTHETIC-UNSAVED');
    await page.locator('.outside').click(); await host.locator('[data-action="expand"]').click();
    assert.equal(await host.locator('#dav-pass').inputValue(), 'SYNTHETIC-UNSAVED');
    assert.equal(await page.evaluate(() => JSON.stringify([...__store]).includes('SYNTHETIC-UNSAVED')), false);
    await page.locator('#send').hover(); await hover.locator('.hover-card').waitFor({ state: 'visible' });
    await page.locator('#send').click(); assert.equal(await page.evaluate(() => __submits), 1); assert.equal(await host.locator('.panel').count(), 0);
    await page.locator('.outside').hover();
    await page.evaluate(() => { const old = document.querySelector('#send'); const next = old.cloneNode(true); next.setAttribute('aria-label', 'Send'); old.replaceWith(next); });
    await page.waitForTimeout(30); await page.locator('#send').hover(); await hover.locator('.hover-card').waitFor({ state: 'visible' });
    await page.evaluate(() => document.querySelector('#send').setAttribute('aria-label', 'Stop generating'));
    await page.waitForTimeout(30); assert.equal(await hover.isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS Chromium synthetic Send: supplied DOM without editor ancestry; computed styles; outside-click sequencing; draft memory; keyboard Escape; native submit; panel-open hover; SPA replacement; Send-to-Stop. No live traffic.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
