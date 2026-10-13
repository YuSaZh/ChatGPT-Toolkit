'use strict';
// Optional real-browser checks on a fully synthetic fixture. All traffic is
// blocked. No ChatGPT login, quota query, live message, or WebDAV call is used.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><meta charset="utf-8"><style>body{font:18px serif;background:#fafafa}form#composer{position:fixed;bottom:140px;left:500px;width:420px}#prompt-textarea{height:90px}#native-send{float:right;width:40px;height:40px}</style><form id="composer"><div id="prompt-textarea" contenteditable="true"></div><button type="button" id="model" data-composer-navigation-target="reasoning">Thinking</button><button id="native-send" type="submit" class="size-token-button-composer" aria-label="发送">↑</button></form>');
    await page.evaluate(() => {
      window.unsafeWindow = window;
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (opts) { return attach.call(this, { ...opts, mode: 'open' }); }; // inspection only
      window.__store = new Map();
      window.GM_getValue = (key, fallback) => window.__store.has(key) ? window.__store.get(key) : fallback;
      window.GM_setValue = (key, value) => window.__store.set(key, value);
      window.GM_listValues = () => [...window.__store.keys()];
      window.GM_registerMenuCommand = () => {};
      window.__fetches = 0; window.__davCalls = 0;
      window.fetch = () => { window.__fetches++; return Promise.resolve(new Response('{}')); };
      window.GM_xmlhttpRequest = () => { window.__davCalls++; throw Error('Unexpected external request'); };
      document.querySelector('#composer').addEventListener('submit', event => event.preventDefault());
    });
    await page.addScriptTag({ path: 'chatgpt-pro-counter.user.js' });
    const panel = page.locator('#chatgpt-pro-local-counter'), hover = page.locator('#chatgpt-pro-local-hover');
    await panel.locator('[data-action="expand"]').click();
    assert.equal(await panel.locator('.panel').evaluate(el => el.getBoundingClientRect().width), 310);
    assert.equal(await panel.locator('.panel').evaluate(el => getComputedStyle(el).fontSize), '12px');
    assert.equal(await panel.locator('[data-action="minus"]').evaluate(el => getComputedStyle(el).fontSize), '11px');
    assert.equal(await panel.locator('[data-action="minus"]').evaluate(el => el.getBoundingClientRect().width), 56);
    fs.mkdirSync('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/v116-compact-light.png' });
    await panel.locator('nav [data-action="settings"]').click();
    await panel.locator('#cap').fill('321');
    await panel.locator('#hover-all').click();
    assert.equal(await panel.locator('#cap').inputValue(), '321');
    assert.equal(await panel.locator('#hover-all').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.__store.get('gpc.v1.ui.hoverMode')), 'all');
    await page.locator('#native-send').hover(); await hover.waitFor({ state: 'visible' });
    await panel.locator('#hover-pro').click(); await hover.waitFor({ state: 'hidden' });
    await page.locator('#native-send').hover(); await page.waitForTimeout(150); assert.equal(await hover.isVisible(), false);
    // Clicks on the preference do not submit or recreate the accounting form.
    assert.equal(await panel.locator('#cap').inputValue(), '321');
    await panel.locator('#hover-all').press('Enter');
    await page.locator('#native-send').focus(); await hover.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape'); await hover.waitFor({ state: 'hidden' });
    await panel.locator('[data-action="expand"]').click();
    assert.equal(await panel.locator('#cap').inputValue(), '321');
    await panel.locator('nav [data-action="home"]').click();
    for (const width of [320, 240]) {
      await page.setViewportSize({ width, height: 720 });
      assert.equal(await panel.locator('.panel').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await panel.locator('.calibration').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await panel.locator('.calibration').evaluate(el => getComputedStyle(el).transform), 'none');
    }
    await page.evaluate(() => document.documentElement.className = 'dark');
    await page.screenshot({ path: 'screenshots/v116-compact-narrow-dark.png' });
    assert.equal(await page.evaluate(() => window.__fetches + window.__davCalls), 0);
    assert.deepEqual(errors, []);
    console.log('PASS Chromium synthetic v1.1.6: compact geometry, explicit fonts, local toggle and draft retention, keyboard, all-model hover, narrow layout and zero traffic.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
