'use strict';
// Optional browser checks on synthetic data only. The fixture document is
// fulfilled locally, all other browser traffic is blocked, and fetch is mocked.
// No account, live request, real quota, WebDAV service, or screenshot is used.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

const fixtureUrl = 'https://chatgpt.com/__toolkit_synthetic_v117__';
const fixture = `<!doctype html><meta charset="utf-8"><style>
  body{font:18px serif;background:#fafafa;margin:0}
  #composer{position:fixed;bottom:80px;left:24px;right:24px}
  #prompt-textarea{height:48px}#controls{display:flex;justify-content:space-between}
  #native-send{width:40px;height:40px}
</style><form id="composer"><div id="prompt-textarea" contenteditable="true"></div>
<div id="controls"><button type="button" id="model" data-composer-navigation-target="reasoning">Pro</button>
<button id="native-send" type="submit" class="size-token-button-composer" aria-label="发送">↑</button></div></form>`;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox'],
  });
  try {
    for (const used of [0, 1000000, 2000000]) {
      const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, locale: 'zh-CN' });
      const errors = [], unexpectedRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        if (route.request().url() === fixtureUrl && route.request().isNavigationRequest()) {
          return route.fulfill({ status: 200, contentType: 'text/html', body: fixture });
        }
        unexpectedRequests.push(route.request().url());
        return route.abort();
      });
      await page.goto(fixtureUrl);
      await page.evaluate(used => {
        window.unsafeWindow = window;
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (options) {
          return attach.call(this, { ...options, mode: 'open' }); // test inspection only
        };
        const RealDate = Date;
        window.__now = RealDate.now();
        window.Date = class extends RealDate {
          constructor(...args) { super(...(args.length ? args : [window.__now])); }
          static now() { return window.__now; }
        };
        const now = window.__now;
        window.__store = new Map([['gpc.v1.settings.synthetic', {
          v: 1, id: 'synthetic', updated: now, cap: 1000000, mode: 'rolling',
          anchor: now - 1000, ledger: 'default', label: '合成测试账本',
        }]]);
        for (let i = 0; i < used / 1000000; i++) {
          const id = `synthetic-calibration-${i}`;
          window.__store.set(`gpc.v1.event.${id}`, {
            v: 1, id, key: `m:${id}`, ledger: 'default', at: now, updated: now,
            state: 'manual', observation: 'manual', delta: 1000000,
            requested: '', route: '', label: '', conflict: false, stable: false, http: 0,
          });
        }
        window.GM_getValue = (key, fallback) => window.__store.has(key) ? structuredClone(window.__store.get(key)) : fallback;
        window.GM_setValue = (key, value) => window.__store.set(key, structuredClone(value));
        window.GM_listValues = () => [...window.__store.keys()];
        window.GM_registerMenuCommand = () => {};
        window.__fetches = 0; window.__davCalls = 0; window.__quotaRemaining = 0;
        window.fetch = (url, init) => {
          window.__fetches++;
          if (url !== '/backend-api/conversation/init' || init?.method !== 'POST') {
            throw Error('Unexpected synthetic fetch');
          }
          return Promise.resolve(new Response(JSON.stringify({
            limits_progress: [{ feature_name: 'image_gen', remaining: window.__quotaRemaining }],
          }), { headers: { 'content-type': 'application/json' } }));
        };
        window.GM_xmlhttpRequest = () => { window.__davCalls++; throw Error('Unexpected WebDAV call'); };
        document.querySelector('#composer').addEventListener('submit', event => event.preventDefault());
      }, used);
      await page.addScriptTag({ path: path.join(__dirname, '../../chatgpt-pro-counter.user.js') });
      const panel = page.locator('#chatgpt-pro-local-counter');
      const hover = page.locator('#chatgpt-pro-local-hover');
      const card = hover.locator('.hover-card');
      const quota = hover.locator('.image-quota');
      await panel.locator('[data-action="expand"]').click();
      assert.equal(await panel.locator('.panel').getAttribute('aria-label'), 'ChatGPT Toolkit');
      assert.equal(await panel.locator('h1').evaluate(el => el.firstChild.textContent.trim()), 'ChatGPT Toolkit');
      assert.equal(await panel.locator('h1 span').textContent(), 'LOCAL');
      assert.equal(await panel.locator('.panel').evaluate(el => el.getBoundingClientRect().width), 310);
      await page.locator('#native-send').dispatchEvent('pointerenter');
      await hover.waitFor({ state: 'visible' });
      assert.equal((await hover.locator('.number').textContent()).trim(), `${Math.max(0, 1000000 - used)} 次剩余`);
      assert.equal(await hover.locator('.hover-footer > span').textContent(), `已用 ${used} / 1000000`);
      assert.equal(await quota.textContent(), '图片剩余：暂未获取');
      assert.equal(await page.evaluate(() => window.__fetches + window.__davCalls), 0);

      const checkGeometry = async width => {
        await page.setViewportSize({ width, height: 900 });
        const geometry = await card.evaluate(el => {
          const r = el.getBoundingClientRect(), css = getComputedStyle(el);
          const number = el.querySelector('.number'), unit = number.querySelector('span');
          const image = el.querySelector('.image-quota'), manage = el.querySelector('[data-action="manage"]');
          const m = manage.getBoundingClientRect();
          return {
            width: r.width, left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            fits: el.scrollWidth <= el.clientWidth, padding: [css.paddingTop, css.paddingRight],
            radius: css.borderRadius, transform: css.transform,
            numberFont: getComputedStyle(number).fontSize, unitFont: getComputedStyle(unit).fontSize,
            imageFont: getComputedStyle(image).fontSize, imageColor: getComputedStyle(image).color,
            mutedColor: css.getPropertyValue('--muted').trim(),
            manageWidth: m.width, manageHeight: m.height,
          };
        });
        assert.equal(geometry.width, Math.min(248, width - 24), `hover width at ${width}px, used=${used}`);
        assert.equal(geometry.fits, true, `hover overflow at ${width}px, used=${used}`);
        assert.ok(geometry.left >= 11.9 && geometry.right <= width - 11.9, JSON.stringify(geometry));
        assert.ok(geometry.top >= 11.9 && geometry.bottom <= 888.1, JSON.stringify(geometry));
        assert.deepEqual(geometry.padding, ['10px', '12px']);
        assert.equal(geometry.radius, '16px'); assert.equal(geometry.transform, 'none');
        assert.equal(geometry.numberFont, '28px'); assert.equal(geometry.unitFont, '14px');
        assert.equal(geometry.imageFont, '11px');
        assert.ok(geometry.manageWidth > 0 && geometry.manageHeight >= 28);
        assert.equal(await quota.evaluate(el => el.previousElementSibling.classList.contains('number')), true);
        const headingFits = await panel.locator('header').evaluate(el => {
          const h = el.querySelector('h1').getBoundingClientRect();
          const close = el.querySelector('[data-action="collapse"]').getBoundingClientRect();
          const area = el.getBoundingClientRect();
          return h.left >= area.left && h.right <= close.left + 1 && close.right <= area.right;
        });
        assert.equal(headingFits, true, `Toolkit title overlaps close at ${width}px`);
      };
      for (const width of [1180, 320, 272, 240, 180]) await checkGeometry(width);

      // These are explicit fixture calls to an in-memory fetch mock, not traffic.
      for (const remaining of [0, Number.MAX_SAFE_INTEGER]) {
        await page.evaluate(async remaining => {
          window.__quotaRemaining = remaining;
          await window.fetch('/backend-api/conversation/init', { method: 'POST' });
        }, remaining);
        await page.waitForFunction(value => document.querySelector('#chatgpt-pro-local-hover')?.shadowRoot
          ?.querySelector('.image-quota')?.textContent.startsWith(`图片剩余 ${value} 次`), remaining);
        assert.match(await quota.textContent(), /次 · .+ 读取$/);
        assert.doesNotMatch(await quota.textContent(), /无限|unlimited|重置|\/\s*1000000/);
        for (const width of [320, 240, 180]) await checkGeometry(width);
      }
      // Advance only the fixture clock, then switch anchors to rerender the card.
      await page.evaluate(() => { window.__now += 60000; });
      await page.locator('#model').dispatchEvent('pointerenter');
      await page.waitForFunction(() => document.querySelector('#chatgpt-pro-local-hover')?.shadowRoot
        ?.querySelector('.image-quota')?.textContent === '图片剩余：暂未获取');
      assert.doesNotMatch(await quota.textContent(), /读取|9007199254740991/);
      await page.evaluate(() => { document.documentElement.className = 'dark'; });
      await page.waitForFunction(() => document.querySelector('#chatgpt-pro-local-hover')?.hasAttribute('data-dark'));
      await checkGeometry(240);
      assert.equal(await quota.evaluate(el => getComputedStyle(el).color), 'rgb(170, 178, 191)');

      await page.setViewportSize({ width: 240, height: 300 });
      assert.equal(await card.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await hover.locator('[data-action="manage"]').scrollIntoViewIfNeeded();
      await hover.locator('[data-action="manage"]').click();
      assert.equal(await panel.locator('.panel').isVisible(), true);
      assert.equal(await page.evaluate(() => window.__fetches), 2);
      assert.equal(await page.evaluate(() => window.__davCalls), 0);
      assert.deepEqual(unexpectedRequests, []);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS Chromium synthetic v1.1.7: exact Toolkit heading, 248px hover, narrow and short viewports, large counts, fresh/zero/large/stale image labels, dark theme, and zero external traffic.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
