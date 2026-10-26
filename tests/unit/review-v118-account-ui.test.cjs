'use strict';
// Synthetic implementation regressions. No real ChatGPT/session/WebDAV calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../chatgpt-pro-counter.user.js');
const { environment } = require('../fixtures/audit-dom-fixture.cjs');
const AUTO = 'gpc.v1.ui.autoAccount';
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const messages = id => JSON.stringify({ action: 'next', model: 'gpt-5-pro', messages: [{ id, author: { role: 'user' }, content: { parts: ['SYNTHETIC-CONTENT-NEVER-SAVED'] } }] });
function setup(options = {}) {
  let user = 'user-SyntheticA', calls = 0;
  const e = environment({ ...options, fetch(input, init) { calls++; return options.fetch ? options.fetch(input, init) : Promise.resolve(String(input).startsWith('/api/auth/session') ? json({ user: { id: user, email: 'NEVER-SAVE@example.invalid', name: 'NEVER-SAVE-NAME' }, accessToken: 'NEVER-SAVE-TOKEN' }) : json({})); } });
  const click = action => { const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action); return e.emit(e.ui(), 'click', { target }); };
  const settle = async () => { await wait(35); e.flush(150); };
  const session = async next => { user = next || user; await e.win.fetch('/api/auth/session'); await settle(); };
  const send = async id => { await e.win.fetch('/backend-api/conversation', { method: 'POST', body: messages(id) }); await settle(); };
  const records = () => [...e.store].filter(([key]) => key.startsWith('gpc.v1.event.')).map(([, value]) => value);
  return { ...e, click, settle, session, send, records, calls: () => calls };
}

test('v118 UI: account recognition defaults off and never inspects or persists session identity', async () => {
  const e = setup(); await e.session(); await e.send('default-send');
  assert.equal(e.records()[0].ledger, 'default'); assert.equal(e.store.has(AUTO), false);
  assert.doesNotMatch(JSON.stringify([...e.store]), /user-SyntheticA|NEVER-SAVE/);
  e.click('expand'); e.click('settings'); assert.equal(e.ui().querySelector('#account-off').getAttribute('aria-pressed'), 'true');
  assert.equal(e.calls(), 2); assert.deepEqual(e.errors, []);
});

test('v118 UI: opt-in waits passively, preserves old history and uses a stable hashed account ledger', async () => {
  const e = setup(); await e.send('old-default'); const original = structuredClone(e.records()[0]);
  e.click('expand'); e.click('settings'); const before = e.calls(); e.click('account-on');
  assert.equal(e.store.get(AUTO), true); assert.equal(e.calls(), before); assert.match(e.ui().textContent, /待识别/);
  await e.session();
  e.emit(e.document, 'pointerdown', { target: e.host() });
  e.emit(e.document, 'keydown', { target: e.host(), key: 'Tab' });
  await e.send('new-account');
  const id = `a_${await api.digest('chatgpt-toolkit/account-ledger/v1\0user-SyntheticA')}`;
  assert.ok(e.records().some(row => row.ledger === id)); assert.deepEqual(e.records().find(row => row.id === original.id), original);
  assert.equal(e.store.get('gpc.v1.settings.initial').ledger, 'default');
  assert.match(e.ui().querySelector('#account-status').textContent, /已识别/);
  assert.ok(e.ui().querySelector('#ledger').hasAttribute('disabled'));
  assert.match(e.ui().textContent, /上限、统计方式和周期锚点仍是共用设置/);
  assert.doesNotMatch(JSON.stringify([...e.store]), /user-SyntheticA|NEVER-SAVE|SYNTHETIC-CONTENT/);
});

test('v118 UI: unknown submissions remain visibly unassigned after later identification', async () => {
  const e = setup({ entries: [[AUTO, true]] }); await e.send('unknown-before-session');
  const unknown = e.records()[0]; assert.match(unknown.ledger, /^unassigned:/);
  e.click('expand'); e.click('log'); assert.match(e.ui().textContent, /待识别/); assert.equal(e.ui().querySelectorAll('.log li').length, 1);
  e.click('home'); e.click('plus'); assert.match(e.ui().textContent, /暂不能校准/); assert.equal(e.records().length, 1);
  await e.session(); await e.send('known-after-session'); e.click('log');
  assert.equal(e.records().find(row => row.id === unknown.id).ledger, unknown.ledger);
  assert.match(e.ui().textContent, /另有 1 条未分配记录/); assert.equal(e.ui().querySelectorAll('.log li').length, 1);
  e.click('settings'); e.click('account-off'); assert.ok(e.ui().querySelectorAll('#ledger option').some(option => option.value === unknown.ledger));
});

test('v118 UI: two tabs share records but never each other\'s effective account selection', async () => {
  const store = new Map([[AUTO, true]]), a = setup({ store }), b = setup({ store });
  await a.session('user-SyntheticA'); await b.session('user-SyntheticB');
  await a.send('a-first'); await b.send('b-first');
  const settings = { ...api.defaultSettings(), id: 'remote-settings', updated: Date.now() + 1000, ledger: 'manual-other-tab', label: 'Other manual book' };
  store.set('gpc.v1.settings.remote-settings', settings); a.tick(); b.tick();
  await a.send('a-second'); await b.send('b-second');
  const aLedger = `a_${await api.digest('chatgpt-toolkit/account-ledger/v1\0user-SyntheticA')}`;
  const bLedger = `a_${await api.digest('chatgpt-toolkit/account-ledger/v1\0user-SyntheticB')}`;
  assert.equal(a.records().filter(row => row.ledger === aLedger).length, 2);
  assert.equal(a.records().filter(row => row.ledger === bLedger).length, 2);
  assert.equal(a.records().filter(row => row.ledger === 'manual-other-tab').length, 0);
});

test('v118 UI: lifecycle and outside-composer fences clear account identity without sending a query', async () => {
  for (const type of ['blur', 'pagehide', 'pageshow', 'popstate', 'hashchange', 'visibilitychange', 'outside', 'url']) {
    const e = setup({ entries: [[AUTO, true]] }); await e.session(); const before = e.calls();
    if (type === 'outside') e.emit(e.document, 'pointerdown', { target: e.document.body });
    else if (type === 'url') { e.win.location.href += 'c/synthetic'; e.mutate(); }
    else e.emit(type === 'visibilitychange' ? e.document : e.win, type);
    await e.settle(); assert.equal(e.calls(), before, type); assert.match(e.ui().textContent, /待识别/, type);
    await e.send(`after-${type}`); assert.match(e.records()[0].ledger, /^unassigned:/, type); assert.deepEqual(e.errors, []);
  }
});

test('v118 UI: hidden pending tab does not continually reschedule a render loop', async () => {
  const e = setup({ entries: [[AUTO, true]] }); await e.session(); e.document.hidden = true;
  e.emit(e.document, 'visibilitychange'); e.flush(150);
  const count = () => [...e.timeouts.values()].filter(timer => timer.ms === 150).length;
  assert.equal(count(), 0); e.flush(150); assert.equal(count(), 0);
});

test('v118 UI: changed account rejects a stale calibration form instead of calibrating the new account', async () => {
  const e = setup({ entries: [[AUTO, true]] }); await e.session(); e.click('expand'); e.click('settings');
  e.ui().querySelector('#calibrate').value = '12';
  await e.session('user-SyntheticB');
  e.emit(e.ui(), 'submit', { target: e.ui().querySelector('#settings') });
  assert.equal(e.records().length, 0); assert.match(e.ui().textContent, /账号上下文已改变/);
});

test('v118 UI: PoW records header is RAM-only, preserves leading zeros, and uses neutral wording', async () => {
  const e = setup({ fetch: () => Promise.resolve(json({ proofofwork: { difficulty: '000Ab0', required: false, seed: 'NEVER-SAVE-SEED' }, token: 'NEVER-SAVE-TOKEN' })) });
  await e.win.fetch('/backend-api/sentinel/chat-requirements/prepare', { method: 'POST' }); await e.settle();
  e.click('expand'); e.click('log');
  const status = e.ui().querySelector('#pow-status'); assert.match(status.textContent, /PoW 难度：000Ab0/); assert.match(status.textContent, /是否要求：否/); assert.match(status.textContent, /最近捕获/); assert.doesNotMatch(status.textContent, /优秀|降智|健康评分/);
  assert.doesNotMatch(JSON.stringify([...e.store]), /000Ab0|proofofwork|NEVER-SAVE/);
  e.emit(e.win, 'blur'); e.flush(150); assert.match(e.ui().querySelector('#pow-status').textContent, /暂未捕获/);
});
