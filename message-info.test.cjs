'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const message = (id = 'answer', extras = {}) => ({ id, author: { role: 'assistant' }, recipient: 'all', create_time: 1770000000, metadata: { model_slug: 'gpt-5', resolved_model_slug: 'gpt-5-pro' }, ...extras });
const history = (id = 'chat-a', messages = [message()]) => ({ conversation_id: id, mapping: Object.fromEntries(messages.map(m => [m.id, { message: m }])) });
const frame = (m = message(), id = 'chat-a') => ({ conversation_id: id, message: m });
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const stream = frames => new Response(frames.map(f => `data: ${JSON.stringify(f)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
function setup(data, options = {}) {
  const nativeResponse = data, promise = Promise.resolve(data), calls = [];
  const win = { location: { href: 'https://chatgpt.com/c/chat-a' }, fetch(...args) { calls.push({ args, receiver: this }); return promise; } };
  const state = api.createMessageInfoState({ page: () => win.location.href });
  const events = [], observer = api.installObserver(win, { save: e => events.push(e), ledger: () => 'default', random: () => 'event-id', hash: async () => 'hash', messageInfoState: state, ...options });
  return { nativeResponse, promise, calls, win, state, events, observer };
}
test('history remains passive and preserves exact native promise, response, receiver and arguments', async () => {
  const s = setup(response(history())), input = new URL('https://chatgpt.com/backend-api/conversation/chat-a'), init = { signal: new AbortController().signal };
  assert.equal(s.win.fetch(input, init), s.promise);
  assert.equal(await s.promise, s.nativeResponse);
  assert.equal(s.calls.length, 1); assert.equal(s.calls[0].receiver, s.win); assert.equal(s.calls[0].args[0], input); assert.equal(s.calls[0].args[1], init);
  assert.deepEqual(await s.nativeResponse.json(), history());
  await s.observer.idle(); assert.equal(s.state.get('answer', 'assistant').model, 'gpt-5-pro'); assert.equal(s.events.length, 0);
});
test('SSE extraction shares existing clone and accepts full and explicit scalar patch frames', async () => {
  const s = setup(stream([frame(message('answer', { metadata: {} })), { p: '/message/metadata/model_slug', o: 'add', v: 'gpt-5' }, { p: '/message/metadata/resolved_model_slug', o: 'replace', v: 'gpt-5-pro' }]));
  let clones = 0; const original = s.nativeResponse.clone.bind(s.nativeResponse); s.nativeResponse.clone = () => { clones++; return original(); };
  s.win.fetch('/backend-api/f/conversation', { method: 'POST', body: JSON.stringify({ action: 'next', model: 'requested-other', messages: [{ id: 'user-one', author: { role: 'user' } }] }) });
  await s.observer.idle(); assert.equal(clones, 1); assert.equal(s.state.get('answer', 'assistant').model, 'gpt-5-pro'); assert.ok(s.events.some(e => e.state === 'accepted'));
});
test('metadata display survives skipped counts, null ledger and throwing storage writes', async () => {
  for (const options of [{ captureLedger: () => null }, { save() { throw Error('storage'); } }, {}]) {
    const s = setup(stream([frame()]), options);
    s.win.fetch('/backend-api/conversation', { method: 'POST', body: JSON.stringify({ action: Object.keys(options).length ? 'next' : 'continue' }) });
    await s.observer.idle(); assert.equal(s.state.get('answer', 'assistant').model, 'gpt-5-pro');
  }
});
test('account request clears metadata with manual ledger mode and rejects stale history', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const win = { location: { href: 'https://chatgpt.com/c/chat-a' }, fetch: () => pending };
  const state = api.createMessageInfoState({ page: () => win.location.href });
  state.history(state.capture('chat-a'), history());
  const observer = api.installObserver(win, { save() {}, ledger: () => 'default', messageInfoState: state });
  win.fetch('/backend-api/conversation/chat-a'); win.fetch('/api/auth/session');
  assert.equal(state.get('answer', 'assistant'), null); release(response(history())); await observer.idle(); assert.equal(state.size(), 0);
});
test('stream URL promotion can precede the observer receiving its first frame', () => {
  let page = 'https://chatgpt.com/'; const state = api.createMessageInfoState({ page: () => page }), token = state.capture();
  page = 'https://chatgpt.com/c/chat-a'; state.syncPage(); state.frame(token, frame());
  assert.equal(state.get('answer', 'assistant').model, 'gpt-5-pro');
  page = 'https://chatgpt.com/'; state.syncPage(); const old = state.capture(); page = 'https://chatgpt.com/c/chat-b'; state.syncPage(); state.frame(old, frame()); assert.equal(state.size(), 0);
});
test('history and streams remain bounded without consuming the site response', async () => {
  const s = setup(response({ ...history(), ignored: 'x'.repeat(1024 * 1024) })); s.win.fetch('/backend-api/conversation/chat-a'); await s.observer.idle(); assert.equal(s.state.size(), 0); assert.ok((await s.nativeResponse.text()).length > 1024 * 1024);
  const state = api.createMessageInfoState({ page: () => 'https://chatgpt.com/c/chat-a' });
  await api.inspectResponse(stream([frame()]), () => {}, { limit: 10, onFrame: data => state.frame(state.capture(), data) }); assert.equal(state.size(), 0);
});
test('GET observation ignores disabled display, unrelated conversation, failed response and redirect', async () => {
  for (const mode of ['disabled', 'unrelated', 'failed', 'redirected']) {
    const res = mode === 'failed' ? new Response('{}', { status: 403, headers: { 'content-type': 'application/json' } }) : response(history());
    if (mode === 'redirected') Object.defineProperty(res, 'redirected', { value: true });
    const s = setup(res); if (mode === 'disabled') s.state.setEnabled(false);
    s.win.fetch('/backend-api/conversation/' + (mode === 'unrelated' ? 'chat-b' : 'chat-a')); await s.observer.idle(); assert.equal(s.state.size(), 0);
  }
});
test('DOM matches message IDs and roles, updates without duplication and survives recycled nodes', () => {
  const env = environment(), doc = env.document, state = api.createMessageInfoState({ page: () => 'https://chatgpt.com/c/chat-a' }), badges = new Map();
  const assistant = doc.createElement('div'); assistant.setAttribute('data-message-id', 'answer'); assistant.setAttribute('data-message-author-role', 'assistant'); doc.body.appendChild(assistant);
  const user = doc.createElement('div'); user.setAttribute('data-message-id', 'question'); user.setAttribute('data-message-author-role', 'user'); doc.body.appendChild(user);
  state.history(state.capture('chat-a'), history('chat-a', [message(), message('question', { author: { role: 'user' } })]));
  api.renderMessageInfo(doc, state, badges); api.renderMessageInfo(doc, state, badges);
  assert.equal(doc.querySelectorAll('.chatgpt-toolkit-message-info').length, 2); assert.match(assistant.textContent, /gpt-5-pro/); assert.doesNotMatch(user.textContent, /gpt/);
  const original = badges.get(assistant); assert.match(original.getAttribute('title'), /2026/);
  assistant.setAttribute('data-message-id', 'branch-two'); api.renderMessageInfo(doc, state, badges); assert.equal(assistant.textContent, '');
  assistant.setAttribute('data-message-id', 'answer'); api.renderMessageInfo(doc, state, badges); assert.match(assistant.textContent, /gpt-5-pro/);
  badges.get(assistant).remove(); api.renderMessageInfo(doc, state, badges); assert.match(assistant.textContent, /gpt-5-pro/);
  assistant.remove(); api.renderMessageInfo(doc, state, badges); assert.equal(badges.size, 1);
  state.setEnabled(false); api.renderMessageInfo(doc, state, badges); assert.equal(badges.size, 0); assert.equal(user.textContent, '');
});
test('safety-paused display preserves default preference without storing changes or requests', () => {
  let calls = 0;
  const env = environment({ fetch() { calls++; return Promise.resolve(response({})); } });
  env.flush(100); env.tick(); assert.equal(calls, 0);
  env.emit(env.ui(), 'click', { target: env.ui().querySelector('[data-action="expand"]') });
  const button = env.ui().querySelector('[data-action="settings"]'); env.emit(env.ui(), 'click', { target: button });
  const off = env.ui().querySelector('[data-action="message-info-off"]'); assert.ok(off); env.emit(env.ui(), 'click', { target: off });
  assert.equal(env.store.has('gpc.v1.ui.messageInfo'), false); assert.equal(calls, 0);
  assert.notEqual(off.getAttribute('disabled'), null); assert.match(env.ui().querySelector('#message-info-status').textContent, /本版因页面兼容问题暂停/);
  assert.equal(env.ui().querySelector('#message-info-off').getAttribute('aria-pressed'), 'false');
  assert.equal(api.snapshot(api.defaultSettings(), []).messageInfo, undefined);
});
test('unchanged DOM badges skip date formatting during unrelated streaming mutations', () => {
  const env = environment(), state = api.createMessageInfoState({ page: () => 'https://chatgpt.com/c/chat-a' }), badges = new Map();
  const element = env.document.createElement('div'); element.setAttribute('data-message-id', 'answer'); element.setAttribute('data-message-author-role', 'assistant'); env.document.body.appendChild(element);
  state.history(state.capture('chat-a'), history());
  const original = Date.prototype.toLocaleTimeString; let calls = 0;
  Date.prototype.toLocaleTimeString = function (...args) { calls++; return original.apply(this, args); };
  try { api.renderMessageInfo(env.document, state, badges); api.renderMessageInfo(env.document, state, badges); assert.equal(calls, 1); }
  finally { Date.prototype.toLocaleTimeString = original; }
});
