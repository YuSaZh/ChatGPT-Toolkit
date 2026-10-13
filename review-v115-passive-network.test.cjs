'use strict';
// Adversarial passive-observer audit. Every response and destination here is
// mocked. No account, quota, auth, image, or WebDAV request is transmitted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const body = JSON.stringify({ action: 'next', model: 'gpt-5-pro', messages: [{ id: 'synthetic-passive-id', author: { role: 'user' }, content: { parts: ['PRIVATE-SYNTHETIC-TEXT'] } }] });
const response = () => new Response('{}', { headers: { 'content-type': 'application/json' } });

function attach(fetch, extras = {}) {
  const saved = [];
  const win = { location: { href: 'https://chatgpt.com/' }, fetch };
  const observer = api.installObserver(win, { save: row => saved.push(row), ledger: () => 'default', ...extras });
  return { win, observer, saved };
}

test('passive audit: every route forwards once with unchanged this, args, promise, Response, and AbortSignal', async () => {
  for (const [url, method] of [['/backend-api/conversation', 'POST'], ['/backend-api/f/conversation', 'POST'], ['/backend-api/conversation/init', 'POST'], ['/api/auth/session', 'GET'], ['/unrelated', 'GET']]) {
    const output = response(), native = Promise.resolve(output), controller = new AbortController(), calls = [];
    const init = { method, body: method === 'POST' ? body : undefined, signal: controller.signal, headers: { 'X-Synthetic': 'unchanged' } };
    const original = { ...init }, owner = {};
    const e = attach(function (...args) { calls.push({ receiver: this, args }); return native; }, { imageQuota: api.createImageQuotaState() });
    const returned = e.win.fetch.call(owner, url, init);
    assert.equal(returned, native); assert.equal(await returned, output);
    await e.observer.idle();
    assert.equal(calls.length, 1, url); assert.equal(calls[0].receiver, owner); assert.equal(calls[0].args[0], url); assert.equal(calls[0].args[1], init);
    assert.deepEqual(init, original); assert.equal(init.signal, controller.signal); assert.equal(controller.signal.aborted, false);
  }
});

test('passive audit: poisoned observer helpers cannot stop or replace a successful page request', async () => {
  for (const helper of ['random', 'clock', 'ledger', 'save', 'changed', 'hash', 'inspect']) {
    const trace = [], output = response(), native = Promise.resolve(output);
    const extras = { [helper]() { trace.push(helper); throw new Error(`Synthetic ${helper} failure`); } };
    const e = attach(() => { trace.push('native'); return native; }, extras);
    let returned;
    assert.doesNotThrow(() => { returned = e.win.fetch('/backend-api/conversation', { method: 'POST', body }); }, helper);
    assert.equal(returned, native, helper); assert.equal(await returned, output); await e.observer.idle();
    assert.equal(trace[0], 'native', helper); assert.equal(trace.filter(value => value === 'native').length, 1, helper);
  }
});

test('passive audit: quota state failures do not prevent the native init call', async () => {
  const output = response(), native = Promise.resolve(output); let calls = 0;
  const e = attach(() => { calls++; return native; }, { imageQuota: { invalidate() { throw new Error('Synthetic quota state failure'); } } });
  const returned = e.win.fetch('/backend-api/conversation/init', { method: 'POST' });
  assert.equal(returned, native); assert.equal(await returned, output); assert.equal(calls, 1);
});

test('passive audit: poisoned helpers do not replace native synchronous throws or asynchronous rejections', async () => {
  for (const synchronous of [false, true]) {
    const nativeError = new DOMException('Synthetic native abort', 'AbortError');
    const native = synchronous ? null : Promise.reject(nativeError); native?.catch(() => {}); let calls = 0;
    const e = attach(() => { calls++; if (synchronous) throw nativeError; return native; }, { ledger() { throw new Error('Observer must not replace native failure'); } });
    const invoke = () => e.win.fetch('/backend-api/conversation', { method: 'POST', body });
    if (synchronous) assert.throws(invoke, error => error === nativeError);
    else { const returned = invoke(); assert.equal(returned, native); await assert.rejects(returned, error => error === nativeError); }
    await e.observer.idle(); assert.equal(calls, 1);
  }
});

test('passive audit: Response clone failures leave the original readable and do not leak exceptions', async () => {
  for (const url of ['/backend-api/conversation', '/backend-api/conversation/init']) {
    const output = new Response('ORIGINAL-SYNTHETIC-BODY', { headers: { 'content-type': 'application/json' } });
    output.clone = () => { throw new TypeError('Synthetic clone failure'); };
    const native = Promise.resolve(output); let calls = 0;
    const e = attach(() => { calls++; return native; }, { imageQuota: api.createImageQuotaState() });
    const returned = e.win.fetch(url, { method: 'POST', body });
    assert.equal(returned, native); assert.equal(await returned, output); await e.observer.idle();
    assert.equal(output.bodyUsed, false); assert.equal(await output.text(), 'ORIGINAL-SYNTHETIC-BODY'); assert.equal(calls, 1);
  }
});

test('passive audit: Request metadata reads only a clone and keeps original body/signal for native fetch', async () => {
  const controller = new AbortController();
  const input = new Request('https://chatgpt.com/backend-api/conversation', { method: 'POST', body, signal: controller.signal });
  let actual, nativeText; const output = response();
  const e = attach(request => { actual = request; nativeText = request.text(); return Promise.resolve(output); });
  const returned = e.win.fetch(input); assert.equal(await returned, output); await e.observer.idle();
  assert.equal(actual, input); assert.equal(await nativeText, body); assert.equal(controller.signal.aborted, false);
  assert.ok(e.saved.some(row => row.state === 'accepted'));
  assert.doesNotMatch(JSON.stringify(e.saved), /PRIVATE-SYNTHETIC-TEXT/);
});

test('passive audit: Request clone failure never consumes or prevents the native request', async () => {
  const input = new Request('https://chatgpt.com/backend-api/conversation', { method: 'POST', body });
  input.clone = () => { throw new Error('Synthetic Request clone failure'); };
  let seen, text; const output = response();
  const e = attach(request => { seen = request; text = request.text(); return Promise.resolve(output); });
  assert.equal(await e.win.fetch(input), output); await e.observer.idle();
  assert.equal(seen, input); assert.equal(await text, body);
});

test('passive audit: bounded quota clone cancellation never cancels the original stream', async () => {
  let source, canceled = false;
  const payload = 'x'.repeat(66000);
  const output = new Response(new ReadableStream({ start(controller) { source = controller; controller.enqueue(new TextEncoder().encode(payload)); }, cancel() { canceled = true; } }), { headers: { 'content-type': 'application/json' } });
  const e = attach(() => Promise.resolve(output), { imageQuota: api.createImageQuotaState() });
  assert.equal(await e.win.fetch('/backend-api/conversation/init', { method: 'POST' }), output);
  await e.observer.idle();
  assert.equal(canceled, false); assert.equal(output.bodyUsed, false);
  source.close(); assert.equal(await output.text(), payload); assert.equal(canceled, false);
});

test('passive audit: startup, timers, hover, diagnostics and local UI make zero network requests', () => {
  let fetchCalls = 0, davCalls = 0;
  const e = environment({ fetch() { fetchCalls++; return Promise.resolve(response()); }, gmRequest() { davCalls++; throw new Error('Unexpected automatic network'); } });
  const form = e.document.createElement('form'), model = e.document.createElement('button'), send = e.document.createElement('button');
  model.textContent = 'Pro'; model.setAttribute('data-composer-navigation-target', 'reasoning');
  send.setAttribute('type', 'submit'); send.setAttribute('aria-label', '发送'); send.className = 'size-token-button-composer';
  form.append(model, send); e.document.body.appendChild(form); e.mutate();
  e.emit(send, 'pointerenter', { target: send, currentTarget: send }); e.flush(150);
  for (const menu of e.menus) menu.fn();
  for (const action of ['settings', 'home', 'plus', 'minus', 'sync', 'home', 'collapse']) {
    const target = e.ui().querySelector(`[data-action="${action}"]`); if (target) e.emit(e.ui(), 'click', { target });
  }
  e.tick(); e.tick(); e.emit(e.win, 'focus'); e.emit(e.win, 'resize'); e.emit(e.document, 'visibilitychange'); e.flush();
  assert.equal(fetchCalls, 0); assert.equal(davCalls, 0); assert.deepEqual(e.errors, []);
});

test('passive audit: source has one native forwarding site and no alternate in-page network APIs or remote resources', () => {
  const source = fs.readFileSync(path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
  assert.equal((source.match(/Reflect\.apply\(original, this, args\)/g) || []).length, 1);
  assert.doesNotMatch(source, /\b(?:window|win|unsafeWindow)\.fetch\s*\(/);
  assert.doesNotMatch(source, /new\s+(?:XMLHttpRequest|WebSocket|EventSource)|\.sendBeacon\s*\(/);
  assert.doesNotMatch(source, /createElement\(['"](?:script|img|iframe|link|audio|video)['"]\)|\bimport\s*\(|@import\b|url\(https?:/);
  assert.doesNotMatch(source, /\b(?:window|win)\.location\s*=|location\.(?:assign|replace)\s*\(/);
  assert.equal((source.match(/handle = gmRequest\(/g) || []).length, 1, 'the separate opt-in WebDAV transport is explicit');
});

test('passive audit: redirected or mismatched response provenance never becomes image quota', async () => {
  for (const metadata of [
    { redirected: true, url: 'https://chatgpt.com/backend-api/conversation/init' },
    { redirected: false, url: 'https://other.invalid/backend-api/conversation/init' },
    { redirected: false, url: 'https://chatgpt.com/unrelated-response' },
  ]) {
    const output = new Response('{"limits_progress":[{"feature_name":"image_gen","remaining":44}]}', { headers: { 'content-type': 'application/json' } });
    Object.defineProperty(output, 'redirected', { value: metadata.redirected });
    Object.defineProperty(output, 'url', { value: metadata.url });
    const q = api.createImageQuotaState(), native = Promise.resolve(output); let calls = 0;
    const e = attach(() => { calls++; return native; }, { imageQuota: q });
    const returned = e.win.fetch('/backend-api/conversation/init', { method: 'POST' });
    assert.equal(returned, native); assert.equal(await returned, output); await e.observer.idle();
    assert.equal(q.current(), null, metadata.url); assert.equal(calls, 1); assert.equal(output.bodyUsed, false);
  }
});
