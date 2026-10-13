'use strict';
// Independent, synthetic tests. No live account, authentication, quota endpoint,
// image generation, or WebDAV requests are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { environment } = require('./audit-dom-fixture.cjs');

function setup(options = {}) {
  const e = environment(options), d = e.document;
  function composer(modelText = 'Pro', { editor = true, tag = 'form', parent = d.body } = {}) {
    const scope = d.createElement(tag); parent.appendChild(scope);
    if (editor) {
      const input = d.createElement('div'); input.id = 'prompt-textarea'; input.setAttribute('contenteditable', 'true');
      input._rect = { left: 200, right: 1100, top: 540, bottom: 640, width: 900, height: 100 };
      scope.appendChild(input);
    }
    const model = d.createElement('button'); model.setAttribute('type', 'button');
    model.setAttribute('aria-label', '选择 ChatGPT 模型'); model.setAttribute('aria-haspopup', 'menu');
    model.setAttribute('data-codex-intelligence-trigger', 'true'); model.setAttribute('data-composer-navigation-target', 'reasoning');
    const measure = d.createElement('span'); measure.setAttribute('aria-hidden', 'true'); measure.textContent = '思考强度';
    const label = d.createElement('span'); label.textContent = modelText;
    model.append(measure, label); scope.appendChild(model);
    model._rect = { left: 850, right: 950, top: 660, bottom: 700, width: 100, height: 40 };
    const send = d.createElement('button'); send.setAttribute('type', 'submit'); send.setAttribute('aria-label', '发送');
    send.className = 'size-token-button-composer bg-composer-primary';
    const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = d.createElementNS('http://www.w3.org/2000/svg', 'path'); svg.appendChild(path); send.appendChild(svg); scope.appendChild(send);
    send._rect = { left: 990, right: 1030, top: 660, bottom: 700, width: 40, height: 40 };
    return { scope, model, measure, label, send, svg, path };
  }
  const current = composer(options.modelText ?? 'Pro', options.composerOptions || {});
  e.mutate();
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const show = (button = current.send) => { e.emit(button, 'pointerenter', { target: button, currentTarget: button }); e.flush(150); };
  return { ...e, ...current, composer, hover, show };
}

test('v115: send hover follows the current visible Pro selection in its composer', () => {
  const e = setup(); e.show(); assert.equal(e.hover().hidden, false);
  assert.match(e.hover().shadow.textContent, /剩余/);
  e.label.textContent = 'Thinking'; e.mutate();
  assert.equal(e.hover().hidden, true, 'switching away from Pro immediately hides an open card');
  e.show(); assert.equal(e.hover().hidden, true);
  e.label.textContent = 'Pro'; e.mutate(); e.show(); assert.equal(e.hover().hidden, false);
  assert.deepEqual(e.errors, []);
});

test('v115: Auto, Thinking, other, blank and absent model selection all fail closed', () => {
  for (const text of ['Auto', 'Thinking', 'GPT-5', '', 'Unknown']) {
    const e = setup({ modelText: text }); e.show(); assert.equal(e.hover().hidden, true, JSON.stringify(text));
  }
  const e = setup(); e.model.remove(); e.mutate(); e.show(); assert.equal(e.hover().hidden, true);
});

test('v115: hidden Pro measurement, aria labels and subscription text cannot override visible Thinking', () => {
  const e = setup({ modelText: 'Thinking' });
  e.measure.textContent = 'Pro'; e.model.setAttribute('aria-label', 'Pro 订阅');
  const plan = e.document.createElement('span'); plan.textContent = 'ChatGPT Pro'; e.scope.appendChild(plan);
  e.show(); assert.equal(e.hover().hidden, true);
});

test('v115: hidden Thinking measurement does not override visible Pro', () => {
  const e = setup(); e.measure.textContent = 'Thinking'; e.show(); assert.equal(e.hover().hidden, false);
});

test('v115: a Pro selector in another composer or header cannot authorize this sender', () => {
  const e = setup({ modelText: 'Thinking' });
  const other = e.composer('Pro');
  const header = e.document.createElement('header'); e.document.body.appendChild(header);
  e.composer('Pro', { editor: false, tag: 'div', parent: header });
  e.mutate(); e.show(); assert.equal(e.hover().hidden, true);
  e.show(other.send); assert.equal(e.hover().hidden, false);
  e.label.textContent = ''; e.mutate(); e.show(); assert.equal(e.hover().hidden, true);
});

test('v115: old conversation text and model menu options do not provide current selection', () => {
  const e = setup({ modelText: 'Auto' });
  const old = e.document.createElement('article'); old.textContent = 'Pro'; e.scope.appendChild(old);
  const menu = e.document.createElement('div'); menu.setAttribute('role', 'menu'); e.scope.appendChild(menu);
  const choice = e.document.createElement('button'); choice.textContent = 'Pro'; choice.setAttribute('data-composer-navigation-target', 'reasoning'); menu.appendChild(choice);
  e.show(); assert.equal(e.hover().hidden, true);
});

test('v115: a nearby same-scope Pro selector works without an editor ancestor dependency', () => {
  const e = setup({ composerOptions: { editor: false, tag: 'div' } });
  assert.equal(e.send.closest('form'), null); assert.equal(e.document.querySelector('#prompt-textarea'), null);
  e.show(); assert.equal(e.hover().hidden, false);
});

test('v115: selector removal or hidden state immediately closes an active hover', () => {
  for (const action of [e => e.model.remove(), e => e.model.setAttribute('hidden', ''), e => e.model.setAttribute('aria-hidden', 'true')]) {
    const e = setup(); e.show(); assert.equal(e.hover().hidden, false);
    action(e); e.mutate(); assert.equal(e.hover().hidden, true);
  }
});

test('v115: multiple conflicting current selectors in one composer fail closed', () => {
  const e = setup();
  const second = e.document.createElement('button'); second.setAttribute('data-codex-intelligence-trigger', 'true');
  second.setAttribute('aria-label', '选择 ChatGPT 模型'); second.textContent = 'Thinking'; e.scope.appendChild(second);
  e.show(); assert.equal(e.hover().hidden, true);
});

test('v115: selected-model gating does not change request-based Pro accounting', async () => {
  const e = setup({ modelText: 'Thinking', fetch: () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })) });
  await e.win.fetch('/backend-api/conversation', { method: 'POST', body: JSON.stringify({ action: 'next', model: 'gpt-5-pro', messages: [{ id: 'synthetic-requested-pro', author: { role: 'user' } }] }) });
  for (let i = 0; i < 100; i++) {
    if ([...e.store.values()].some(value => value?.observation === 'done')) break;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  e.flush(150);
  assert.match(e.ui().textContent, /1\/100/);
  e.show(); assert.equal(e.hover().hidden, true, 'UI gate stays independent of the request model counted');
  assert.deepEqual(e.errors, []);
});

const api = require('./chatgpt-pro-counter.user.js');
const quotaData = (remaining, extra = {}) => ({ limits_progress: [{ feature_name: 'image_gen', remaining, reset_after: '2030-01-01T00:00:00Z', ...extra }] });
const jsonResponse = (data, options = {}) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' }, ...options });
function observer(fetch, imageQuota = api.createImageQuotaState()) {
  const saved = [], win = { location: { href: 'https://chatgpt.com/' }, fetch };
  const instrument = api.installObserver(win, { imageQuota, save: row => saved.push(row), ledger: () => 'default' });
  return { win, instrument, saved, imageQuota };
}

test('v115 quota: only the documented image_gen remaining field is used, including zero', () => {
  assert.deepEqual(api.parseImageQuota(quotaData(0)), { remaining: 0 });
  assert.deepEqual(api.parseImageQuota(quotaData(37, { cap: 500, token: 'PRIVATE-TOKEN', arbitrary: 'PRIVATE-BODY' })), { remaining: 37 });
  assert.deepEqual(api.parseImageQuota({ limits_progress: [{ feature_name: 'file_upload', remaining: 1 }, { feature_name: 'image_gen', remaining: 9 }] }), { remaining: 9 });
  assert.deepEqual(api.parseImageQuota(quotaData(Number.MAX_SAFE_INTEGER)), { remaining: Number.MAX_SAFE_INTEGER });
});

test('v115 quota: unknown, unlimited, malformed and ambiguous values never become a guessed cap', () => {
  for (const remaining of [undefined, null, -1, -500, Infinity, NaN, 0.5, '37', 'unlimited', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(api.parseImageQuota(quotaData(remaining)), null, String(remaining));
  }
  for (const data of [null, {}, { image_gen: { remaining: 500 } }, { data: quotaData(5) }, { limits_progress: [{ feature_name: 'image_gen', unlimited: true }] }, { limits_progress: [...quotaData(1).limits_progress, ...quotaData(2).limits_progress] }]) {
    assert.equal(api.parseImageQuota(data), null);
  }
});

test('v115 quota: exact same-origin init POST only; account/session reads invalidate', () => {
  const base = 'https://chatgpt.com/';
  assert.equal(api.imageQuotaRequest('/backend-api/conversation/init', { method: 'POST' }, base), 'quota');
  assert.equal(api.imageQuotaRequest('/backend-api/conversation/init/?x=1', { method: 'POST' }, base), 'quota');
  assert.equal(api.imageQuotaRequest('/backend-api/conversation/init', { method: 'GET' }, base), '');
  for (const path of ['/backend-api/conversation/init-malicious', '/backend-api/conversation', '/backend-api/f/conversation']) {
    assert.equal(api.imageQuotaRequest(path, { method: 'POST' }, base), 'invalidate');
  }
  for (const path of ['/api/auth/session', '/api/auth/signout', '/backend-api/me', '/backend-api/accounts/check/v4']) {
    assert.equal(api.imageQuotaRequest(path, { method: 'GET' }, base), 'invalidate', path);
  }
  assert.equal(api.imageQuotaRequest('https://evil.invalid/backend-api/conversation/init', { method: 'POST' }, base), '');
});

test('v115 quota: TTL, account epoch, and independent-tab state prevent stale reuse', () => {
  let now = 100000;
  const a = api.createImageQuotaState({ clock: () => now }), b = api.createImageQuotaState({ clock: () => now });
  const token = a.invalidate(); assert.equal(a.accept(token, quotaData(17)), true);
  assert.equal(a.current().remaining, 17); assert.equal(b.current(), null);
  now += api.IMAGE_QUOTA_TTL - 1; assert.equal(a.current().remaining, 17);
  now += 1; assert.equal(a.current(), null);
  const fresh = a.invalidate(); a.accept(fresh, quotaData(19));
  a.invalidate(); assert.equal(a.accept(fresh, quotaData(99)), false); assert.equal(a.current(), null);
});

test('v115 quota: an expired snapshot never revives after a wall-clock rollback', () => {
  let now = 100000;
  const q = api.createImageQuotaState({ clock: () => now });
  q.accept(q.invalidate(), quotaData(17));
  now += api.IMAGE_QUOTA_TTL; assert.equal(q.current(), null);
  now = 100001; assert.equal(q.current(), null);
});

test('v115 quota: passive inspection preserves exact native promise, response and arguments', async () => {
  const response = jsonResponse({ ...quotaData(7), accessToken: 'PRIVATE-TOKEN', messages: ['PRIVATE-CHAT'] });
  const native = Promise.resolve(response), calls = [];
  const init = { method: 'POST', body: 'PRIVATE-REQUEST-BODY' };
  Object.defineProperty(init, 'headers', { get() { throw Error('Quota must not inspect authentication headers'); } });
  const e = observer(function (...args) { calls.push({ thisValue: this, args }); return native; });
  const returned = e.win.fetch('/backend-api/conversation/init', init);
  assert.equal(returned, native); assert.equal(await returned, response);
  assert.equal(calls.length, 1); assert.equal(calls[0].args[1], init); assert.equal(calls[0].thisValue, e.win);
  assert.match(await response.text(), /PRIVATE-CHAT/);
  await e.instrument.idle();
  assert.equal(e.imageQuota.current().remaining, 7);
  assert.deepEqual(e.saved, []); assert.equal(e.instrument.observed(), 0); assert.equal(e.instrument.healthy(), true);
  assert.doesNotMatch(JSON.stringify(e.imageQuota.current()), /PRIVATE/);
});

test('v115 quota: rejected or synchronously throwing native fetch retains native failure identity', async () => {
  for (const sync of [false, true]) {
    const error = new TypeError('SYNTHETIC-NATIVE-FAILURE');
    const native = sync ? null : Promise.reject(error); native?.catch(() => {});
    const e = observer(() => { if (sync) throw error; return native; });
    const call = () => e.win.fetch('/backend-api/conversation/init', { method: 'POST' });
    if (sync) assert.throws(call, value => value === error);
    else { const returned = call(); assert.equal(returned, native); await assert.rejects(returned, value => value === error); }
    await e.instrument.idle(); assert.equal(e.imageQuota.current(), null); assert.deepEqual(e.saved, []);
  }
});

test('v115 quota: old in-flight init cannot repopulate after an account or logout request', async () => {
  for (const boundary of ['/backend-api/accounts/check/v4', '/api/auth/signout']) {
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const e = observer(url => url === '/backend-api/conversation/init' ? pending : Promise.resolve(jsonResponse({ accessToken: 'PRIVATE-AUTH-RESPONSE' })));
    const first = e.win.fetch('/backend-api/conversation/init', { method: 'POST' });
    await e.win.fetch(boundary, { method: 'GET' });
    resolve(jsonResponse(quotaData(100))); await first; await e.instrument.idle();
    assert.equal(e.imageQuota.current(), null, boundary);
  }
});

test('v115 quota: newer init wins even when an old account response resolves later', async () => {
  let resolve;
  const first = new Promise(done => { resolve = done; }); let call = 0;
  const e = observer(() => ++call === 1 ? first : Promise.resolve(jsonResponse(quotaData(4))));
  const old = e.win.fetch('/backend-api/conversation/init', { method: 'POST' });
  await e.win.fetch('/backend-api/conversation/init', { method: 'POST' });
  resolve(jsonResponse(quotaData(100))); await old; await e.instrument.idle();
  assert.equal(e.imageQuota.current().remaining, 4);
});

test('v115 quota: missing schema, HTTP failure, non-JSON, and oversize response clear earlier data', async () => {
  for (const make of [
    () => jsonResponse({ limits_progress: [] }),
    () => jsonResponse(quotaData(22), { status: 429 }),
    () => new Response(JSON.stringify(quotaData(22)), { headers: { 'content-type': 'text/html' } }),
    () => new Response(JSON.stringify({ ...quotaData(22), padding: 'x'.repeat(66000) }), { headers: { 'content-type': 'application/json' } }),
  ]) {
    const q = api.createImageQuotaState(); q.accept(q.invalidate(), quotaData(8));
    const e = observer(() => Promise.resolve(make()), q);
    await e.win.fetch('/backend-api/conversation/init', { method: 'POST' }); await e.instrument.idle();
    assert.equal(q.current(), null); assert.deepEqual(e.saved, []);
  }
});

test('v115 quota: a failing UI notification never blocks or replaces native fetch', async () => {
  let shouldThrow = false;
  const q = api.createImageQuotaState({ changed() { if (shouldThrow) throw new Error('Synthetic hover render failure'); } });
  q.accept(q.invalidate(), quotaData(8)); shouldThrow = true;
  const native = Promise.resolve(jsonResponse(quotaData(9))); let calls = 0;
  const e = observer(() => { calls++; return native; }, q);
  let returned;
  assert.doesNotThrow(() => { returned = e.win.fetch('/backend-api/conversation/init', { method: 'POST' }); });
  assert.equal(returned, native); assert.equal(calls, 1);
  await returned; await e.instrument.idle();
});

async function until(predicate, label = 'mocked quota update') {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  assert.fail(`Timed out waiting for ${label}`);
}
const quotaLine = e => e.hover().shadow?.querySelector('.image-quota')?.textContent || '';
async function captureQuota(e) {
  const response = await e.win.fetch('/backend-api/conversation/init', { method: 'POST', body: '{"synthetic":"PRIVATE-REQUEST"}' });
  await until(() => /图片剩余 \d+ 次/.test(quotaLine(e)));
  return response;
}

test('v115 quota UI: small line follows Pro count and shows observed zero without a fabricated maximum', async () => {
  let calls = 0;
  const e = setup({ fetch: () => { calls++; return Promise.resolve(jsonResponse(quotaData(0))); } });
  e.show(); assert.match(quotaLine(e), /暂未获取/);
  const before = [...e.store.entries()];
  await captureQuota(e);
  assert.match(quotaLine(e), /图片剩余 0 次.*读取/);
  assert.doesNotMatch(quotaLine(e), /500|无限|unlimited|\/\s*100/);
  const card = e.hover().shadow.querySelector('.hover-card');
  const numberIndex = card.children.findIndex(child => child.classList.contains('number'));
  assert.equal(card.children[numberIndex + 1].classList.contains('image-quota'), true);
  assert.deepEqual([...e.store.entries()], before); assert.equal(calls, 1, 'only the page-initiated mocked request ran');
  assert.deepEqual(e.errors, []);
});

test('v115 quota UI: ordinary composer typing preserves a snapshot; outside/account/lifecycle boundaries clear it', async () => {
  for (const boundary of ['outside', 'auth', 'blur', 'pagehide', 'visibility']) {
    const e = setup({ fetch: () => Promise.resolve(jsonResponse(quotaData(23))) });
    e.show(); await captureQuota(e);
    const input = e.document.querySelector('#prompt-textarea');
    e.emit(e.document, 'keydown', { target: input, key: 'a', composedPath: () => [input, e.scope, e.document.body, e.document] });
    assert.match(quotaLine(e), /图片剩余 23 次/);
    if (boundary === 'outside') e.emit(e.document, 'pointerdown', { target: e.document.body, composedPath: () => [e.document.body, e.document] });
    if (boundary === 'auth') await e.win.fetch('/api/auth/session', { method: 'GET' });
    if (boundary === 'blur' || boundary === 'pagehide') e.emit(e.win, boundary);
    if (boundary === 'visibility') { e.document.hidden = true; e.emit(e.document, 'visibilitychange'); }
    assert.match(quotaLine(e), /暂未获取/, boundary);
    assert.deepEqual(e.errors, []);
  }
});

test('v115 quota UI: an exact-expiry timer clears a shown image snapshot', async () => {
  let now = Date.now();
  const e = setup({
    fetch: () => Promise.resolve(jsonResponse(quotaData(23))),
    beforeRun({ context }) { context.Date = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }; },
  });
  e.show(); await captureQuota(e);
  now += api.IMAGE_QUOTA_TTL; e.flush(api.IMAGE_QUOTA_TTL);
  assert.match(quotaLine(e), /暂未获取/);
  assert.deepEqual(e.errors, []);
});

test('v115 quota UI: account-private quota is not shared with another tab or included in an export', async () => {
  const shared = new Map(), blobs = [];
  const first = setup({ store: shared, fetch: () => Promise.resolve(jsonResponse({ ...quotaData(23), access_token: 'PRIVATE-TOKEN' })), beforeRun({ context }) {
    context.URL = class extends URL { static createObjectURL(blob) { blobs.push(blob); return 'blob:synthetic-export'; } static revokeObjectURL() {} };
  } });
  first.show(); await captureQuota(first);
  const second = setup({ store: shared }); second.show();
  assert.match(quotaLine(second), /暂未获取/);
  first.emit(first.ui(), 'click', { target: first.ui().querySelector('[data-action="expand"]') });
  first.emit(first.ui(), 'click', { target: first.ui().querySelector('[data-action="export"]') });
  assert.equal(blobs.length, 1);
  const exported = await blobs[0].text();
  assert.doesNotMatch(exported, /image_gen|remaining|PRIVATE-TOKEN|observedAt/);
  assert.doesNotMatch(JSON.stringify([...shared.entries()]), /image_gen|remaining|PRIVATE-TOKEN|observedAt/);
  assert.deepEqual(first.errors, []); assert.deepEqual(second.errors, []);
});
