'use strict';
// Real page-realm runtime. Requests are caller-initiated local stubs, never HTTP.
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { pageMetadataRuntime } = require('../../src/metadata/metadata-page-runtime.cjs');

function setup({ locked = false, implementation = () => undefined } = {}) {
  const dom = new JSDOM('<html><head><meta id="status"></head><body></body></html>', { url: 'https://chatgpt.com/c/chat-a', runScripts: 'outside-only' });
  const w = dom.window, calls = [], status = w.document.getElementById('status');
  const original = function (...args) { calls.push({ receiver: this, args }); return Reflect.apply(implementation, this, args); };
  Object.defineProperty(w, 'fetch', { value: original, writable: !locked, configurable: true });
  w.eval('(' + pageMetadataRuntime.toString() + ')({key:"__fence",statusId:"status",eventName:"fence-control",enabled:true},()=>({changed:false}));');
  const event = command => w.document.dispatchEvent(new w.CustomEvent('fence-control', { detail: command }));
  const read = name => status.getAttribute('data-' + name);
  const observe = () => { const mapping = { answer: { message: { id: 'answer', author: { role: 'assistant' }, create_time: 1770000000, metadata: { model_slug: 'known' } } } }; assert.equal(w.__fence.observe(mapping, 'chat-a'), mapping); return read('rows'); };
  return { w, calls, original, read, observe, event, close() { dom.window.close(); } };
}

test('page account fence: installation makes no request and forwards exact this, arguments and promise', () => {
  const promise = Promise.resolve({ token: true });
  const e = setup({ implementation: () => promise });
  try {
    assert.equal(e.calls.length, 0); assert.equal(e.read('account-fence'), 'installed');
    const receiver = {}, input = '/backend-api/conversation/chat-a', init = { method: 'GET', signal: {} }, extra = {};
    assert.equal(Reflect.apply(e.w.fetch, receiver, [input, init, extra]), promise);
    assert.equal(e.calls.length, 1); assert.equal(e.calls[0].receiver, receiver);
    assert.equal(e.calls[0].args[0], input); assert.equal(e.calls[0].args[1], init); assert.equal(e.calls[0].args[2], extra);
  } finally { e.close(); }
});

test('page account fence: native synchronous exception is unchanged and called once', () => {
  const error = new Error('native fetch failure'), e = setup({ implementation: () => { throw error; } });
  try { assert.throws(() => e.w.fetch('/api/auth/session'), value => value === error); assert.equal(e.calls.length, 1); } finally { e.close(); }
});

test('page account fence: initial session/accounts/me GET sequence permits the first natural metadata', () => {
  const e = setup();
  try {
    for (const url of ['/api/auth/session', '/backend-api/accounts/check/v4', '/backend-api/me', '/api/auth/session']) e.w.fetch(url);
    assert.equal(e.calls.length, 4); assert.notEqual(e.read('account'), 'paused-account'); assert.equal(e.observe(), '1');
    e.w.fetch('/api/auth/session'); assert.equal(e.read('account'), 'paused-account'); assert.equal(e.read('rows'), '0');
    assert.equal(e.observe(), '0');
  } finally { e.close(); }
});

test('page account fence: an account write before initial metadata closes the startup exemption', () => {
  const e = setup();
  try {
    e.w.fetch('/backend-api/accounts/choose', { method: 'POST' });
    e.w.fetch('/api/auth/session'); assert.equal(e.calls.length, 2); assert.equal(e.read('account'), 'paused-account'); assert.equal(e.observe(), '0');
  } finally { e.close(); }
});

test('page account fence: arbitrary URL, method and coercion getters are never evaluated by inspection', () => {
  const e = setup(); let reads = 0;
  try {
    const url = { get url() { reads++; return '/api/auth/session'; }, toString() { reads++; return '/api/auth/session'; } };
    const init = { get method() { reads++; return 'POST'; } };
    e.w.fetch(url, init); assert.equal(reads, 0); assert.equal(e.calls.length, 1);
    e.w.fetch('/api/auth/session', init); assert.equal(reads, 0); assert.equal(e.calls.length, 2); assert.equal(e.read('account'), 'paused-account');
  } finally { e.close(); }
});

test('page account fence: native URL input is recognized without arbitrary toString', () => {
  const e = setup();
  try {
    e.observe(); const url = new e.w.URL('/api/auth/session', e.w.location.href);
    Object.defineProperty(url, 'toString', { value() { throw Error('must not coerce'); } });
    e.w.fetch(url); assert.equal(e.calls[0].args[0], url); assert.equal(e.read('account'), 'paused-account');
  } finally { e.close(); }
});

test('page account fence: an inherited method cannot receive the startup GET exemption', () => {
  const e = setup(); let reads = 0;
  try {
    const init = Object.create({ get method() { reads++; return 'POST'; } });
    e.w.fetch('/api/auth/session', init);
    assert.equal(reads, 0); assert.equal(e.calls[0].args[1], init); assert.equal(e.calls.length, 1);
    assert.equal(e.read('account'), 'paused-account'); assert.equal(e.observe(), '0');
  } finally { e.close(); }
});

test('page account fence: other-origin identity-like paths do not clear current metadata', () => {
  const e = setup();
  try { e.observe(); e.w.fetch('https://example.invalid/api/auth/session'); assert.equal(e.read('rows'), '1'); assert.notEqual(e.read('account'), 'paused-account'); } finally { e.close(); }
});

test('page account fence: outer request notifications are deduplicated but explicit resets are retained', () => {
  const e = setup();
  try {
    e.w.fetch('/api/auth/session'); e.event('request-session'); e.event('request-invalidate'); assert.notEqual(e.read('account'), 'paused-account');
    assert.equal(e.observe(), '1'); e.event('invalidate'); assert.equal(e.read('rows'), '0'); assert.equal(e.read('account'), 'paused-account');
  } finally { e.close(); }
});

test('page account fence: non-writable fetch fails closed without changing the native function', () => {
  const e = setup({ locked: true });
  try { assert.equal(e.w.fetch, e.original); assert.equal(e.read('account-fence'), 'unconfirmed'); assert.equal(e.read('account'), 'waiting-fence'); assert.equal(e.observe(), '1'); assert.equal(e.read('fetches'), '0'); assert.equal(e.calls.length, 0); } finally { e.close(); }
});

