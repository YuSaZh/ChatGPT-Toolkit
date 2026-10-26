'use strict';
// Optional Chromium test, entirely synthetic and offline. The actual Shadow DOM
// stays closed; fixture-only references let assertions inspect our own controls.
// Keyboard editing uses browser defaults. Clipboard/IME routing uses synthetic
// events and does NOT prove native clipboard integration or a real IME session.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), requests = [], errors = [];
    await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><textarea id="prompt-textarea"></textarea><button id="outside">outside</button>');
    await page.evaluate(() => {
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) { const root = attach.call(this, options); if (this.id === 'chatgpt-pro-local-counter') window.__toolkitRoot = root; return root; };
      const store = new Map(); window.__store = store; window.__fetches = 0; window.__dav = 0;
      window.unsafeWindow = window;
      window.GM_getValue = (key, fallback) => store.has(key) ? structuredClone(store.get(key)) : fallback;
      window.GM_setValue = (key, value) => store.set(key, structuredClone(value)); window.GM_listValues = () => [...store.keys()];
      window.GM_registerMenuCommand = () => {}; window.GM_info = { scriptHandler: 'Tampermonkey', version: '5.5.1' };
      window.GM_xmlhttpRequest = () => { window.__dav++; throw Error('Unexpected WebDAV call'); };
      window.fetch = () => { window.__fetches++; throw Error('Unexpected fetch'); };
    });
    await page.addScriptTag({ path: path.join(__dirname, '../../chatgpt-pro-counter.user.js') });
    await page.evaluate(() => {
      window.__toolkitRoot.querySelector('[data-action="expand"]').click(); window.__toolkitRoot.querySelector('[data-action="sync"]').click();
      window.__siteHits = [];
      for (const type of ['keydown', 'keypress', 'keyup', 'paste', 'copy', 'cut', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend']) {
        for (const target of [window, document]) for (const capture of [true, false]) target.addEventListener(type, event => {
          window.__siteHits.push([type, event.target.id, capture]);
          // Emulate the site's mistaken treatment of our noneditable host.
          if (event.target.id === 'chatgpt-pro-local-counter') { document.querySelector('#prompt-textarea').focus(); event.preventDefault(); }
        }, capture);
      }
      window.__toolkitRoot.querySelector('#dav-user').focus();
    });
    await page.keyboard.type('alpha beta');
    assert.equal(await page.evaluate(() => window.__toolkitRoot.querySelector('#dav-user').value), 'alpha beta');
    await page.keyboard.press('Control+A'); await page.keyboard.type('replacement');
    assert.equal(await page.evaluate(() => window.__toolkitRoot.querySelector('#dav-user').value), 'replacement');
    await page.keyboard.press('Control+Z');
    assert.equal(await page.evaluate(() => window.__toolkitRoot.querySelector('#dav-user').value), 'alpha beta');
    assert.equal(await page.evaluate(() => window.__toolkitRoot.activeElement.id), 'dav-user');
    await page.evaluate(() => window.__toolkitRoot.querySelector('#dav-pass').focus());
    await page.keyboard.type('fixture password'); await page.keyboard.press('Shift+ArrowLeft');
    const before = await page.evaluate(() => { const input = window.__toolkitRoot.querySelector('#dav-pass'); window.__originalInput = input; return [input.value, input.selectionStart, input.selectionEnd]; });
    await page.evaluate(() => window.__toolkitRoot.querySelector('#webdav').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.deepEqual(await page.evaluate(() => { const input = window.__toolkitRoot.querySelector('#dav-pass'); return [input.value, input.selectionStart, input.selectionEnd]; }), before);
    assert.equal(await page.evaluate(() => window.__toolkitRoot.querySelector('#dav-pass') === window.__originalInput && window.__toolkitRoot.activeElement === window.__originalInput), true);
    await page.evaluate(() => {
      const field = window.__toolkitRoot.querySelector('#dav-pass');
      for (const type of ['paste', 'copy', 'cut']) { const event = new ClipboardEvent(type, { bubbles: true, composed: true, cancelable: true }); if (!field.dispatchEvent(event)) throw Error(type + ' default canceled'); }
      field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true, data: '中' }));
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, key: 'Escape', isComposing: true }));
      field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '中' }));
      if (!window.__toolkitRoot.querySelector('#webdav')) throw Error('IME closed panel');
    });
    assert.deepEqual(await page.evaluate(() => window.__siteHits), []);
    assert.equal(await page.locator('#prompt-textarea').inputValue(), '');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => !!window.__toolkitRoot.querySelector('#webdav')), false);
    await page.evaluate(() => window.__toolkitRoot.querySelector('[data-action="expand"]').click());
    assert.equal(await page.evaluate(() => window.__toolkitRoot.querySelector('#dav-pass').value), before[0]);
    await page.locator('#outside').click();
    assert.equal(await page.evaluate(() => !!window.__toolkitRoot.querySelector('#webdav')), false);
    await page.locator('#prompt-textarea').focus(); await page.keyboard.type('ordinary composer');
    assert.equal(await page.locator('#prompt-textarea').inputValue(), 'ordinary composer');
    assert.ok((await page.evaluate(() => window.__siteHits)).length > 0);
    assert.equal(await page.evaluate(() => window.__fetches + window.__dav), 0);
    assert.equal(await page.evaluate(() => JSON.stringify([...window.__store]).includes('fixture password')), false);
    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
    console.log('PASS: closed-shadow routing, native keyboard editing, stable forms, local shortcuts and untouched outside composer. Native clipboard/IME and Tampermonkey still require real-user acceptance.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
