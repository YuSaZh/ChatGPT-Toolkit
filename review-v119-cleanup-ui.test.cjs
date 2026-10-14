'use strict';
// Synthetic DOM and mocked WebDAV only. No extension or live-service claims.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { environment } = require('./audit-dom-fixture.cjs');
const api = require('./chatgpt-pro-counter.user.js');
const source = fs.readFileSync(path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
function setup(options = {}) {
  const calls = [], e = environment({ ...options, gmRequest: options.gmRequest || (details => { calls.push(details); return { abort() {} }; }) });
  const click = action => { const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action); e.emit(e.ui(), 'click', { target }); };
  const reply = (index, status) => { const q = calls[index]; q.onload({ status, finalUrl: q.url, responseText: '', responseHeaders: '' }); };
  const submit = () => e.emit(e.ui(), 'submit', { target: e.ui().querySelector('#webdav') });
  click('expand');
  return { ...e, calls, click, reply, submit };
}

test('v119 cleanup: removes precisely requested PoW paragraph and overview sentence', () => {
  const e = setup();
  const footer = e.ui().querySelector('.foot').textContent;
  assert.match(footer, /本机优先.*WebDAV 未启用.*非官方余额/);
  assert.match(footer, /默认账本.*观察器/);
  assert.doesNotMatch(footer, /只按实际请求模型|订阅名称不会计数/);
  assert.match(e.ui().textContent, /锚点由你设置，不是服务端重置时间/);
  e.click('log');
  assert.equal(e.ui().querySelector('#pow-status').textContent, 'PoW 难度：暂未捕获');
  assert.doesNotMatch(source, /仅为本页最近响应快照，不代表模型能力或账号健康/);
  assert.match(fs.readFileSync(path.join(__dirname, 'SECURITY.md'), 'utf8'), /不计算健康等级或模型能力/);
});

test('v119 cleanup: captured PoW still shows raw leading zero difficulty, requirement and timestamp', async () => {
  const e = setup({ fetch: () => Promise.resolve(new Response(JSON.stringify({ proofofwork: { difficulty: '000aB0', required: false, seed: 'SYNTHETIC-SECRET' } }), { headers: { 'content-type': 'application/json' } })) });
  e.click('log'); await e.win.fetch('/backend-api/sentinel/chat-requirements/prepare', { method: 'POST' });
  await new Promise(resolve => setTimeout(resolve, 35)); e.flush(150);
  assert.match(e.ui().querySelector('#pow-status').textContent, /PoW 难度：000aB0是否要求：否 · 最近捕获/);
  assert.doesNotMatch(JSON.stringify([...e.store]), /000aB0|SYNTHETIC-SECRET/);
});

test('v119 new UI: defaults to base, makes only the dedicated directory, saves then syncs data.json', async () => {
  const e = setup(); e.click('home'); e.click('plus'); e.click('sync');
  assert.equal(e.ui().querySelector('#dav-mode').value, 'base');
  assert.equal(e.ui().querySelector('#dav-url-label').textContent, 'HTTPS 基础目录');
  assert.doesNotMatch(e.ui().textContent, /请先建立父目录/);
  e.ui().querySelector('#dav-url').value = 'https://dav.example/dav';
  e.ui().querySelector('#dav-user').value = 'fixture-user'; e.ui().querySelector('#dav-pass').value = 'fixture-pass';
  e.submit(); assert.equal(e.calls.length, 0); assert.equal(e.store.has('gpc.v1.webdav'), false);
  // Invalid submission re-renders: fill the explicit consented form again.
  e.ui().querySelector('#dav-url').value = 'https://dav.example/dav';
  e.ui().querySelector('#dav-user').value = 'fixture-user'; e.ui().querySelector('#dav-pass').value = 'fixture-pass';
  e.ui().querySelector('#dav-approved').checked = true; e.submit();
  assert.equal(e.calls[0].method, 'MKCOL'); assert.equal(e.calls[0].url, 'https://dav.example/dav/ChatGPT-Toolkit/');
  e.reply(0, 201); await settle(); assert.equal(e.calls[1].method, 'GET');
  assert.equal(e.calls[1].url, 'https://dav.example/dav/ChatGPT-Toolkit/data.json');
  e.reply(1, 404); await settle();
  const saved = e.store.get('gpc.v1.webdav');
  assert.equal(saved.version, 2); assert.equal(saved.mode, 'base'); assert.equal(saved.url, 'https://dav.example/dav/');
  assert.equal(saved.tested, true); assert.equal(saved.interval, 0); assert.equal(e.calls.length, 2);
  assert.match(e.ui().textContent, /写权限/);
  e.click('sync-now'); e.reply(2, 405); await settle(); e.reply(3, 404); await settle();
  assert.equal(e.calls[4].method, 'PUT'); assert.equal(e.calls[4].headers['If-None-Match'], '*');
  assert.doesNotMatch(e.calls[4].data, /fixture-pass|fixture-user|dav.example/);
  e.reply(4, 201); await settle(); assert.match(e.ui().textContent, /同步成功/); assert.deepEqual(e.errors, []);
});

test('v119 legacy UI: a versionless extensionless URL stays exact file when resaved', async () => {
  const cfg = { url: 'https://dav.example/private/ledger', username: 'saved-user', password: 'saved-pass', enabled: true, approved: true, tested: true, interval: 0 };
  const e = setup({ entries: [['gpc.v1.webdav', cfg]] }); e.click('sync');
  assert.equal(e.ui().querySelector('#dav-mode').value, 'file');
  assert.equal(e.ui().querySelector('#dav-url').value, cfg.url); assert.match(e.ui().querySelector('#dav-path-hint').textContent, /不自动搬移/);
  e.submit(); assert.equal(e.calls[0].method, 'GET'); assert.equal(e.calls[0].url, cfg.url);
  e.reply(0, 404); await settle();
  assert.equal(e.store.get('gpc.v1.webdav').mode, 'file'); assert.equal(e.store.get('gpc.v1.webdav').password, cfg.password);
  assert.equal(e.calls.length, 1);
});

test('v119 mode selection updates labels and preserves an unsaved draft across outside dismissal', () => {
  const e = setup(); e.click('sync'); const mode = e.ui().querySelector('#dav-mode');
  mode.value = 'file'; e.emit(e.ui(), 'change', { target: mode });
  assert.equal(e.ui().querySelector('#dav-url-label').textContent, 'HTTPS 文件完整地址');
  e.ui().querySelector('#dav-url').value = 'https://dav.example/old.json';
  e.ui().querySelector('#dav-pass').value = 'ONLY-IN-DRAFT';
  e.emit(e.document, 'pointerdown', { target: e.document.body }); e.click('expand');
  assert.equal(e.ui().querySelector('#dav-mode').value, 'file');
  assert.equal(e.ui().querySelector('#dav-url-label').textContent, 'HTTPS 文件完整地址');
  assert.equal(e.ui().querySelector('#dav-pass').value, 'ONLY-IN-DRAFT');
  assert.equal(e.calls.length, 0); assert.doesNotMatch(JSON.stringify([...e.store]), /ONLY-IN-DRAFT/);
});

test('v119 migration: explicit switch never carries a password to a changed server', async () => {
  const e = setup({ entries: [['gpc.v1.webdav', { url: 'https://old.example/old.json', username: 'saved-user', password: 'OLD-SECRET', enabled: true, approved: true, tested: true }]] }); e.click('sync');
  e.ui().querySelector('#dav-mode').value = 'base'; e.ui().querySelector('#dav-url').value = 'https://new.example/dav/'; e.submit();
  assert.equal(e.calls[0].method, 'MKCOL');
  assert.equal(e.calls[0].headers.Authorization, 'Basic ' + btoa('saved-user:'));
  assert.doesNotMatch(JSON.stringify(e.calls[0]), /OLD-SECRET/);
});

test('v119 duplicate injection guard stops second observers, timers, UI and GM state access', async () => {
  let nativeCalls = 0; const e = environment({ fetch: () => { nativeCalls++; return Promise.resolve(new Response('{}')); } });
  const originalWrapper = e.win.fetch, timers = e.intervals.length, host = e.host(), stored = JSON.stringify([...e.store]);
  vm.runInNewContext(source, e.context);
  assert.equal(e.win.fetch, originalWrapper); assert.equal(e.intervals.length, timers);
  assert.equal(e.host(), host); assert.equal(e.document.querySelectorAll('#chatgpt-pro-local-counter').length, 1);
  assert.equal(JSON.stringify([...e.store]), stored); assert.equal(e.win.__chatgptToolkitActiveV1, true);
  await e.win.fetch('/ordinary-page-request'); assert.equal(nativeCalls, 1); assert.deepEqual(e.errors, []);
});

test('v119 duplicate guard also covers injections before body and an already-mounted legacy host', () => {
  const e = environment({ bodyAbsent: true }); const wrapper = e.win.fetch, count = e.intervals.length;
  vm.runInNewContext(source, e.context); assert.equal(e.win.fetch, wrapper); assert.equal(e.intervals.length, count);
  let oldFetch; const old = environment({ beforeRun({ document, win }) { oldFetch = win.fetch; const host = document.createElement('div'); host.id = 'chatgpt-pro-local-counter'; document.body.append(host); } });
  assert.equal(old.win.fetch, oldFetch); assert.equal(old.store.size, 0); assert.equal(old.intervals.length, 0);
});

test('v119 identity: old ledger/settings keys and import format remain readable after rename', () => {
  const s = { ...api.defaultSettings(), id: 'saved', cap: 500, updated: Date.now() };
  const e = setup({ entries: [['gpc.v1.settings.saved', s]] });
  assert.match(e.ui().querySelector('.number').textContent, /0 \/ 500/);
  assert.equal(e.store.get('gpc.v1.settings.saved').id, 'saved');
  const backup = api.snapshot(s, []); assert.equal(api.decodeImport(JSON.stringify(backup)).settings.cap, 500);
  assert.match(source, /^\/\/ @name\s+ChatGPT Toolkit$/m); assert.deepEqual(e.errors, []);
});

