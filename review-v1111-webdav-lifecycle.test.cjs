'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');

// All network responses and credentials are synthetic. No requests leave Node.
const manager = { scriptHandler: 'Tampermonkey', version: '5.5.1' };
const config = { version: 2, mode: 'base', url: 'https://dav.example/dav', username: 'SYNTHETIC-USER', password: 'SYNTHETIC-PASS', approved: true };
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(method = 'MKCOL', timeout = 200, signal) {
  let options, aborts = 0, settled = false;
  const tx = api.createDavTransport(value => { options = value; return { abort() { aborts++; } }; }, manager, timeout);
  const pending = tx(config, method, {}, undefined, signal);
  pending.then(() => { settled = true; }, () => { settled = true; });
  const load = (status, extras = {}) => options.onload({ status, readyState: 4, finalUrl: options.url, responseHeaders: '', ...extras });
  const start = (text = '', extras = {}, close = true) => {
    let controller;
    const response = new ReadableStream({ start(value) { controller = value; if (text) value.enqueue(new TextEncoder().encode(text)); if (close) value.close(); } });
    options.onloadstart({ status: 0, readyState: 1, finalUrl: '', responseHeaders: '', response, ...extras });
    return controller;
  };
  return { pending, options, load, start, get aborts() { return aborts; }, get settled() { return settled; } };
}

test('v1111: empty MKCOL stream EOF waits for final 201 or existing-collection 405', async () => {
  for (const status of [201, 405]) {
    const h = harness(); h.start(); await flush();
    assert.equal(h.settled, false, 'EOF is not an HTTP response');
    h.load(status); const result = await h.pending;
    assert.equal(result.status, status); assert.equal(result.responseText, '');
    assert.equal(result.finalUrl, 'https://dav.example/dav/ChatGPT-Toolkit/');
  }
});

test('v1111: final onload before stream EOF waits for complete bounded body', async () => {
  const h = harness('GET'); const c = h.start('{"ok":', {}, false);
  h.load(200, { responseHeaders: 'ETag: "final"' }); await flush();
  assert.equal(h.settled, false); c.enqueue(new TextEncoder().encode('true}')); c.close();
  const result = await h.pending;
  assert.equal(result.status, 200); assert.equal(result.responseText, '{"ok":true}'); assert.equal(api.etagOf(result), '"final"');
});

test('v1111: EOF before onload uses final metadata and never the starting ETag', async () => {
  const h = harness('GET'); h.start('{}', { status: 200, responseHeaders: 'ETag: "stale"' }); await flush();
  assert.equal(h.settled, false); h.load(200, { responseHeaders: 'ETag: "new"', statusText: 'OK' });
  const result = await h.pending; assert.equal(api.etagOf(result), '"new"'); assert.equal(result.statusText, 'OK');
});

test('v1111: actual final HTTP errors are retained rather than replaced with startup zero', async () => {
  for (const status of [401, 403, 409, 500]) {
    const h = harness(); h.start('error'); h.load(status); assert.equal((await h.pending).status, status);
  }
});

test('v1111: actual final zero or missing HTTP status is a transport error in both paths', async () => {
  for (const stream of [false, true]) for (const status of [0, undefined, NaN, '201']) {
    const h = harness(); if (stream) h.start('', { status: 201 });
    h.load(status, { responseText: '' });
    await assert.rejects(h.pending, /未收到有效 HTTP 响应/); assert.equal(h.aborts, 1);
  }
});

test('v1111: EOF without final onload never succeeds and independent timer aborts', async () => {
  const h = harness('MKCOL', 15); h.start('', { status: 201 });
  await assert.rejects(h.pending, /超时/); assert.equal(h.aborts, 1);
});

test('v1111: error, abort and timeout after EOF but before final load still reject', async () => {
  for (const [event, message] of [['onerror', /连接失败/], ['onabort', /取消/], ['ontimeout', /超时/]]) {
    const h = harness(); h.start('', { status: 201 }); await flush();
    assert.equal(h.settled, false); h.options[event]({ status: 0 }); h.load(201);
    await assert.rejects(h.pending, message);
  }
});

test('v1111: signal cancellation while awaiting final metadata aborts and ignores later success', async () => {
  const ctrl = new AbortController(), h = harness('MKCOL', 200, ctrl.signal);
  h.start(); await flush(); ctrl.abort(); h.load(201);
  await assert.rejects(h.pending, /取消/); assert.equal(h.aborts, 1);
});

test('v1111: final redirect status or changed URL rejects even after successful stream start', async () => {
  for (const extras of [{ status: 301 }, { finalUrl: 'https://dav.example/other/' }, { finalUrl: 'https://other.invalid/' }]) {
    const h = harness(); h.start('', { status: 201, finalUrl: h.options.url }); await flush();
    h.load(201, extras); await assert.rejects(h.pending, /重定向/); assert.equal(h.aborts, 1);
  }
});

test('v1111: anonymous cookies and no-redirect fetch safeguards remain on every method', async () => {
  for (const method of ['GET', 'PUT', 'MKCOL']) {
    const h = harness(method);
    assert.equal(h.options.anonymous, true); assert.equal(h.options.redirect, 'error'); assert.equal(h.options.fetch, true);
    assert.equal(h.options.responseType, 'stream'); assert.equal(h.options.headers.Authorization, 'Basic ' + btoa('SYNTHETIC-USER:SYNTHETIC-PASS'));
    h.start(); h.load(method === 'MKCOL' ? 201 : 204); await h.pending;
  }
});

test('v1111: byte cap and stream rejection remain fatal after final onload', async () => {
  for (const oversized of [false, true]) {
    const h = harness('GET'), c = h.start('', {}, false); h.load(200, { responseHeaders: 'ETag: "final"' });
    if (oversized) { c.enqueue(new Uint8Array(5 * 1024 * 1024 + 1)); c.close(); } else c.error(Error('synthetic stream failure'));
    await assert.rejects(h.pending, /5 MB/); assert.equal(h.aborts, 1);
  }
});

test('v1111: managers without a stream retain bounded text and empty response fallback', async () => {
  for (const [method, status, body] of [['GET', 200, '{}'], ['GET', 404, undefined], ['MKCOL', 201, undefined], ['PUT', 204, undefined]]) {
    const h = harness(method); h.options.onloadstart({ status: 0 }); h.load(status, { responseText: body });
    assert.equal((await h.pending).status, status);
  }
  const h = harness('GET'); h.load(200); await assert.rejects(h.pending, /未提供可读响应/);
});

test('v1111: stream HTTP metadata drives real sync MKCOL, GET ETag and conditional PUT', async () => {
  const settings = api.defaultSettings(Date.UTC(2026, 9, 14)), remote = api.snapshot(settings, []);
  const calls = []; let backups = 0, applies = 0;
  const tx = api.createDavTransport(options => {
    calls.push(options);
    queueMicrotask(() => {
      const text = options.method === 'GET' ? JSON.stringify(remote) : '';
      options.onloadstart({ status: 0, readyState: 1, finalUrl: '', responseHeaders: '', response: new ReadableStream({ start(c) { if (text) c.enqueue(new TextEncoder().encode(text)); c.close(); } }) });
      setImmediate(() => options.onload({ status: options.method === 'MKCOL' ? 405 : options.method === 'GET' ? 200 : 204, readyState: 4, finalUrl: options.url, responseHeaders: 'ETag: "final-etag"' }));
    });
    return { abort() {} };
  }, manager, 200);
  await api.syncWebDav(config, { request: tx, local: () => remote, backup() { backups++; }, apply() { applies++; } });
  assert.deepEqual(calls.map(c => c.method), ['MKCOL', 'GET', 'PUT']);
  assert.equal(calls[2].headers['If-Match'], '"final-etag"'); assert.equal(backups, 1); assert.equal(applies, 1);
});

test('v1111: MKCOL final network-zero, auth or directory error never reaches GET or PUT', async () => {
  for (const status of [0, 401, 403, 409]) {
    let requests = 0;
    const tx = api.createDavTransport(options => {
      requests++; queueMicrotask(() => { options.onloadstart({ status: 0, response: new ReadableStream({ start(c) { c.close(); } }) }); options.onload({ status, finalUrl: options.url }); });
      return { abort() {} };
    }, manager, 200);
    await assert.rejects(api.syncWebDav(config, { request: tx, local() { assert.fail('no local merge'); }, backup() { assert.fail('no backup'); }, apply() { assert.fail('no apply'); } }), status ? status === 409 ? /基础目录不存在/ : new RegExp(`HTTP ${status}`) : /未收到有效 HTTP 响应/);
    assert.equal(requests, 1);
  }
});
