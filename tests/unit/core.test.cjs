'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../../chatgpt-pro-counter.user.js');
const now = Date.UTC(2026, 9, 12, 12);
const base = (id, more = {}) => ({ v: 1, id, key: `h:${id}`, ledger: 'default', at: now, updated: now, state: 'accepted', observation: 'http', delta: 0, requested: 'gpt-5-4-pro', route: '', label: '', conflict: false, stable: true, http: 200, ...more });
const config = { ...c.defaultSettings(now), anchor: now - c.WEEK / 2 };
test('subscription plan and assistant label never identify a Pro request', () => {
  assert.equal(c.kindFor(base('x', { requested: '', label: 'gpt-5-pro' })), 'unknown');
  const state = { routes: new Set(), label: '', error: false, handoff: false };
  c.parseMetadata({ plan_type: 'pro', default_model_slug: 'gpt-5-pro', content: { resolved_model_slug: 'gpt-5-pro' } }, state);
  assert.equal(state.routes.size, 0);
});
test('response-only route can resolve an unknown request, conflicts remain unknown', () => {
  assert.equal(c.kindFor(base('x', { requested: 'auto', route: 'gpt-5-pro' })), 'pro');
  assert.equal(c.kindFor(base('x', { requested: 'auto', route: 'gpt-5-pro', conflict: true })), 'unknown');
  assert.equal(c.kindFor(base('x', { requested: 'gpt-5-thinking', route: 'gpt-5-pro' })), 'thinking');
});
test('pending, failed, unknown, non-Pro and future events are excluded from used', () => {
  const events = [base('a'), base('b', { state: 'pending' }), base('c', { state: 'failed' }), base('d', { requested: 'auto' }), base('e', { requested: 'gpt-5-thinking' }), base('f', { at: now + 1 })];
  const s = c.summarize(events, config, now);
  assert.equal(s.used, 1); assert.equal(s.pending, 2); assert.equal(s.failed, 1);
});
test('manual calibration adjusts count and ages out with its own timestamp', () => {
  const events = [base('a'), base('m', { state: 'manual', observation: 'manual', delta: 16 })];
  assert.equal(c.summarize(events, config, now).used, 17);
  assert.equal(c.summarize(events, { ...config, mode: 'rolling' }, now + c.WEEK + 1).used, 0);
});
test('ledger isolation and stable retry dedup survive array merges', () => {
  const events = [base('a'), base('b', { key: 'h:a' }), base('c', { ledger: 'other' })];
  assert.equal(c.summarize(events, config, now).used, 1);
  assert.equal(c.mergeEvents(events, events).length, 3);
});
test('SHA256 stable ID never stores raw source message identifier', async () => {
  const meta = c.requestMeta({ action: 'next', model: 'gpt-5-pro', messages: [{ id: 'private-message-id', author: { role: 'user' }, content: { parts: ['secret chat'] } }] });
  const hash = await c.digest(meta.seed);
  assert.match(hash, /^[a-f0-9]{64}$/); assert.equal(hash.includes('private'), false);
});
test('Request input clone and init body override preserve original body and signal', async () => {
  const controller = new AbortController();
  const request = new Request('https://chatgpt.com/backend-api/f/conversation', { method: 'POST', body: JSON.stringify({ model: 'gpt-5-pro', action: 'next' }), signal: controller.signal });
  const meta = await c.prepareMeta(request);
  assert.equal(meta.requested, 'gpt-5-pro'); assert.equal(request.bodyUsed, false);
  const override = await c.prepareMeta(request, { body: JSON.stringify({ model: 'gpt-5-thinking' }) });
  assert.equal(override.requested, 'gpt-5-thinking'); assert.match(await request.text(), /gpt-5-pro/);
});
test('aborted and HTTP-error fetches preserve exact rejection/response', async () => {
  const events = new Map(); const boom = new DOMException('abort', 'AbortError');
  const promise = Promise.reject(boom); promise.catch(() => {});
  const win = { location: { href: 'https://chatgpt.com/' }, fetch: () => promise };
  const obs = c.installObserver(win, { save: e => events.set(e.id, e), ledger: () => 'default' });
  assert.equal(win.fetch('/backend-api/conversation', { method: 'POST', body: '{"model":"gpt-5-pro"}' }), promise);
  await obs.idle(); assert.equal([...events.values()][0].state, 'aborted');
  const w2 = { location: win.location, fetch: () => Promise.resolve(new Response('denied', { status: 429 })) };
  const o2 = c.installObserver(w2, { save: e => events.set(e.id, e), ledger: () => 'default' });
  const response = await w2.fetch('/backend-api/conversation', { method: 'POST', body: '{"model":"gpt-5-pro"}' });
  assert.equal(await response.text(), 'denied'); await o2.idle();
  assert.ok([...events.values()].some(e => e.http === 429 && e.state === 'failed'));
});
test('SSE application error overrides HTTP acceptance, no raw error/body persisted', async () => {
  const updates = [];
  await c.inspectResponse(new Response('data: {"error":{"message":"private data"}}\n\n', { headers: { 'content-type': 'text/event-stream' } }), u => updates.push(u));
  assert.equal(updates.at(-1).state, 'failed'); assert.equal(JSON.stringify(updates).includes('private data'), false);
});
test('SSE handoff is explicit and bounded reader terminates a stalled stream', async () => {
  const updates = [];
  await c.inspectResponse(new Response('data: {"type":"stream_handoff"}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }), u => updates.push(u));
  assert.equal(updates.at(-1).observation, 'handoff');
  const stalled = new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/event-stream' } });
  const stalledUpdates = [];
  await c.inspectResponse(stalled, u => stalledUpdates.push(u), { timeout: 10 });
  assert.equal(stalledUpdates.at(-1).observation, 'bounded');
});
test('bounded streams stop at byte cap', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20)); controller.close(); } });
  await assert.rejects(c.readBounded(stream, 10, 100), /bounded/);
});
test('unknown/malformed JSON is harmless and explicit continue is skipped', async () => {
  assert.equal((await c.prepareMeta('/x', { body: 'oops' })).known, false);
  assert.equal(c.requestMeta({ model: 'gpt-5-pro', action: 'continue' }).skip, true);
});
test('merge records strips unexpected credentials, headers and chat content', () => {
  const clean = c.mergeEvents([], [base('a', { password: 'SECRET', content: 'CHAT', cookie: 'cookie' })]);
  assert.equal(JSON.stringify(clean).includes('SECRET'), false); assert.equal(JSON.stringify(clean).includes('CHAT'), false);
});
