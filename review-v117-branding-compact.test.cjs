'use strict';
// Independent branding and CSS declaration checks. Synthetic DOM is not a
// browser layout engine. No live ChatGPT or WebDAV traffic is used here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const source = fs.readFileSync(path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
const meta = key => source.match(new RegExp('^// @' + key + '\\s+(.+)$', 'm'))?.[1].trim();
const raw = 'https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js';

function setup(options = {}) {
  const e = environment(options), d = e.document;
  const form = d.createElement('form'), model = d.createElement('button'), send = d.createElement('button');
  model.textContent = 'Pro'; model.setAttribute('type', 'button'); model.setAttribute('data-composer-navigation-target', 'reasoning');
  send.setAttribute('type', 'submit'); send.setAttribute('aria-label', '发送'); send.className = 'size-token-button-composer';
  send._rect = { left: 990, right: 1030, top: 650, bottom: 690, width: 40, height: 40 };
  form.append(model, send); d.body.append(form); e.mutate();
  const click = action => { const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action); return e.emit(e.ui(), 'click', { target }); };
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const show = () => { e.emit(send, 'pointerenter', { target: send }); e.flush(150); };
  return { ...e, model, send, hover, show, click };
}

test('v119: requested rename preserves namespace and data format', () => {
  assert.equal(meta('name'), 'ChatGPT Toolkit'); assert.equal(meta('namespace'), 'local.chatgpt.pro-counter');
  assert.equal(api.PREFIX, 'gpc.v1.'); assert.equal(meta('version'), '1.1.20');
  const data = api.snapshot(api.defaultSettings(), []);
  assert.equal(data.format, 'chatgpt-pro-counter'); assert.equal(data.version, 1);
  assert.ok(fs.existsSync(path.join(__dirname, 'chatgpt-pro-counter.user.js')));
});

test('v117: update and support metadata target the renamed existing repository', () => {
  assert.equal(meta('homepageURL'), 'https://github.com/YuSaZh/ChatGPT-Toolkit');
  assert.equal(meta('supportURL'), 'https://github.com/YuSaZh/ChatGPT-Toolkit/issues');
  assert.equal(meta('updateURL'), raw); assert.equal(meta('downloadURL'), raw);
  assert.equal(meta('require'), undefined);
});

test('v117: every panel tab displays the Toolkit brand with its local status badge', () => {
  const e = setup(); e.click('expand');
  for (const tab of ['home', 'log', 'settings', 'sync']) {
    e.click(tab); const title = e.ui().querySelector('h1');
    assert.equal(title.children.filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim(), 'ChatGPT Toolkit');
    assert.equal(title.querySelector('span').textContent, 'LOCAL');
    assert.equal(e.ui().querySelectorAll('h1').length, 1); assert.equal(e.ui().querySelectorAll('[data-action="collapse"]').length, 1);
    assert.match(e.ui().querySelector('.panel').getAttribute('aria-label'), /ChatGPT Toolkit/);
  }
  assert.deepEqual(e.errors, []);
});

test('v117: compact hover declares 248px responsive width and smaller spacing and number', () => {
  const e = setup(); e.show(); assert.equal(e.hover().hidden, false);
  const css = e.hover().shadow.querySelector('style').textContent;
  assert.match(css, /\.hover-card\{width:min\(248px,calc\(100vw - 24px\)\);[^}]*overflow:auto;[^}]*padding:10px 12px/);
  assert.match(css, /\.hover-card \.number\{font-size:28px;/);
  assert.match(css, /@media\(max-width:460px\)\{\.hover-card\{width:min\(248px,/);
  assert.doesNotMatch(css, /266px/); assert.match(source, /hoverPosition\(rect, size\.width \|\| 248,/);
  assert.equal(e.hover().style.display, 'block'); assert.deepEqual(e.errors, []);
});

test('v117: image quota remains a readable small line underneath the main number', () => {
  const e = setup(); e.show();
  const card = e.hover().shadow.querySelector('.hover-card'), line = card.querySelector('.image-quota'), number = card.querySelector('.number');
  const css = e.hover().shadow.querySelector('style').textContent;
  assert.match(css, /\.image-quota\{font-size:11px;color:var\(--muted\);/);
  assert.equal(card.children.indexOf(line), card.children.indexOf(number) + 1);
  assert.match(line.textContent, /暂未获取/); assert.equal(line.hasAttribute('hidden'), false);
});

test('v117: compact layout preserves large configured counts rather than truncating data', () => {
  const settings = { ...api.defaultSettings(), id: 'legacy-large', cap: 1000000, updated: 1 };
  const e = setup({ entries: [['gpc.v1.settings.legacy-large', settings]] });
  e.show(); assert.match(e.hover().shadow.querySelector('.number').textContent, /^1000000\s*次剩余$/);
  assert.match(e.hover().shadow.querySelector('.hover-footer').textContent, /已用 0 \/ 1000000/);
  e.click('expand'); assert.match(e.ui().querySelector('.number').textContent, /0 \/ 1000000/);
  assert.deepEqual(e.store.get('gpc.v1.settings.legacy-large'), settings); assert.deepEqual(e.errors, []);
});

test('v117: rebranded UI preserves default Pro-only and saved all-model behavior', () => {
  const e = setup(); e.model.textContent = 'Thinking'; e.mutate(); e.show(); assert.equal(e.hover().hidden, true);
  e.click('expand'); e.click('settings'); e.click('hover-all'); e.show(); assert.equal(e.hover().hidden, false);
  e.click('hover-pro'); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
});

test('v117: renamed UI and compact hover perform no active network calls', () => {
  let calls = 0;
  const e = setup({ fetch() { calls++; return Promise.resolve(new Response('{}')); }, gmRequest() { calls++; throw Error('Unexpected network'); } });
  e.show(); e.click('expand'); e.click('settings'); e.click('hover-all'); e.click('home'); e.click('plus'); e.click('minus'); e.click('collapse');
  e.tick(); e.mutate(); e.emit(e.win, 'focus'); assert.equal(calls, 0); assert.deepEqual(e.errors, []);
});

test('v117: installation documentation brands Toolkit while explaining upgrade identity continuity', () => {
  for (const name of ['README.md', 'README.zh-CN.md']) {
    const text = fs.readFileSync(path.join(__dirname, name), 'utf8');
    assert.match(text.split('\n')[0], /ChatGPT[ -]Toolkit/); assert.ok(text.includes(raw), name);
    assert.ok(text.includes('ChatGPT Pro 本机计数器'), name); assert.ok(text.includes('gpc.v1.'), name);
    assert.match(text, /旧脚本|原脚本|原来的|重复副本/); assert.match(text, /被动|不主动查询/);
    assert.doesNotMatch(text, /counter_compact|CleanShot 2026|\/workspace\/scratch|截屏2026/);
  }
});



