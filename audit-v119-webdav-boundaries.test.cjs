'use strict';
// Independent adversarial review of our own implementation. All transport calls
// are synthetic. This suite never contacts ChatGPT or a real WebDAV service.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const now = Date.UTC(2026, 9, 13, 6);
const settings = { ...api.defaultSettings(now), anchor: now - 1000 };
const config = extra => ({ version: 2, mode: 'base', url: 'https://dav.example/existing/base/', username: 'USER', password: 'PRIVATE-SECRET', interval: 0, enabled: true, tested: true, approved: true, ...extra });
const event = id => ({ v: 1, id, key: `key-${id}`, ledger: 'default', at: now - 10, updated: now, state: 'accepted', observation: 'done', delta: 0, requested: 'gpt-5-pro', route: '', label: '', conflict: false, stable: true, http: 200 });
const snapshot = events => api.snapshot(settings, events);
const response = (status, value, tag) => ({ status, responseText: value === undefined ? '' : JSON.stringify(value), responseHeaders: tag ? `ETag: ${tag}` : '' });
const ops = (request, events = [event('local')]) => {
  const calls = [], applied = []; let backups = 0;
  return { calls, applied, get backups() { return backups; }, deps: {
    request: async (...args) => { calls.push(args); return request(...args); },
    local: () => snapshot(events), apply: value => applied.push(value), backup: () => { backups++; }
  } };
};
const manager = { scriptHandler: 'Tampermonkey', version: '5.5.1' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('v119 audit: base URL normalization remains inside its exact configured base', () => {
  for (const url of ['https://dav.example', 'https://dav.example/', 'https://dav.example/existing/base', 'https://dav.example/existing/base/', 'https://dav.example/space%20folder/', 'https://dav.example/目录/']) {
    const cfg = api.webDavConfig(config({ url }));
    const target = api.webDavTargets(cfg);
    assert.ok(cfg.url.endsWith('/'));
    assert.equal(target.directoryUrl, cfg.url + 'ChatGPT-Toolkit/');
    assert.equal(target.fileUrl, target.directoryUrl + 'data.json');
    assert.equal(new URL(target.fileUrl).origin, new URL(cfg.url).origin);
  }
});

test('v119 audit: repeated path slashes cannot silently select a different configured directory', () => {
  for (const url of ['https://dav.example/a//b/', 'https://dav.example//base/', 'https://dav.example/base//']) {
    let cfg;
    try { cfg = api.webDavConfig(config({ url })); } catch { continue; }
    assert.equal(cfg.url, url, 'Preserve the HTTP path exactly or reject ambiguity; do not silently collapse it.');
    assert.equal(api.webDavTargets(cfg).directoryUrl, url + 'ChatGPT-Toolkit/');
  }
});

test('v119 audit: insecure, credential, query, fragment and traversal-like base URLs fail closed', () => {
  for (const url of [
    'http://dav.example/base/', 'https://user:pass@dav.example/base/',
    'https://dav.example/base/?token=private', 'https://dav.example/base/#private',
    'https://dav.example/base/../outside/', 'https://dav.example/base/./',
    'https://dav.example/base/%2e%2e/outside/', 'https://dav.example/base/.%2e/outside/',
    'https://dav.example/base/%2E/outside/', 'https://dav.example/base/%2foutside/',
    'https://dav.example/base/%5coutside/', 'https://dav.example/base/\\outside/',
    'https://dav.example/base/%252e%252e/', 'https://dav.example/base/%252foutside/',
    'https://dav.example/base/%00/', 'https://dav.example/base/\nother/'
  ]) assert.throws(() => api.webDavConfig(config({ url })), url);
});

test('v119 audit: versionless full-file targets preserve arbitrary old filename and never create a directory', async () => {
  for (const url of ['https://dav.example/legacy/no-extension', 'https://dav.example/legacy/custom.json']) {
    const cfg = { url, username: 'USER', password: 'PRIVATE-SECRET', approved: true };
    assert.equal(api.webDavConfig(cfg).mode, 'file');
    assert.deepEqual(api.webDavTargets(cfg), { directoryUrl: '', fileUrl: url });
    const o = ops((_, method) => response(method === 'GET' ? 404 : 201));
    await api.syncWebDav(cfg, o.deps);
    assert.deepEqual(o.calls.map(call => call[1]), ['GET', 'PUT']);
    assert.ok(o.calls.every(call => call[0].url === url));
  }
});

test('v119 audit: unknown versions and modes fail without network requests', async () => {
  for (const extra of [{ version: 1 }, { version: 3 }, { version: '2' }, { version: null }, { mode: 'directory' }, { mode: '' }]) {
    const o = ops(() => response(201));
    await assert.rejects(api.syncWebDav(config(extra), o.deps));
    assert.equal(o.calls.length, 0);
  }
});

test('v119 audit: directory creation requires opt-in even during connection testing', async () => {
  for (const options of [{}, { testOnly: true }]) {
    const o = ops(() => response(201));
    await assert.rejects(api.syncWebDav(config({ approved: false }), o.deps, options));
    assert.equal(o.calls.length, 0);
  }
  const o = ops(() => response(404));
  await api.syncWebDav({ url: 'https://dav.example/old.json', approved: false }, o.deps, { testOnly: true });
  assert.deepEqual(o.calls.map(call => call[1]), ['GET']);
});

test('v119 audit: MKCOL status failures stop before GET/PUT and never create parent directories', async () => {
  for (const status of [200, 204, 301, 302, 307, 308, 400, 401, 403, 404, 409, 412, 423, 500, 507]) {
    const o = ops(() => response(status));
    await assert.rejects(api.syncWebDav(config(), o.deps), status === 409 ? /409|父目录|基础目录|基础路径/ : undefined);
    assert.deepEqual(o.calls.map(call => call[1]), ['MKCOL'], String(status));
    assert.equal(o.backups, 0); assert.equal(o.applied.length, 0);
  }
});

test('v119 audit: created/existing directory is followed by guarded file GET before conditional PUT', async () => {
  for (const status of [201, 405]) {
    const o = ops((_, method) => response(method === 'MKCOL' ? status : method === 'GET' ? 404 : 201));
    await api.syncWebDav(config(), o.deps);
    assert.deepEqual(o.calls.map(call => call[1]), ['MKCOL', 'GET', 'PUT']);
    assert.equal(o.calls[2][2]['If-None-Match'], '*');
    assert.equal(o.calls[2][2]['If-Match'], undefined);
    assert.doesNotMatch(o.calls[2][3], /PRIVATE-SECRET|dav\.example|"username"|"password"|"approved"/);
    assert.equal(o.backups, 1); assert.equal(o.applied.length, 1);
  }
});

test('v119 audit: malformed, future schema and missing/weak ETag files cannot be overwritten after MKCOL 405', async () => {
  for (const read of [
    { status: 200, responseText: 'not-json', responseHeaders: 'ETag: "v1"' },
    response(200, { ...snapshot([]), version: 2 }, '"v1"'),
    response(200, snapshot([])), response(200, snapshot([]), 'W/"weak"'),
    response(401), response(403), response(500)
  ]) {
    const o = ops((_, method) => method === 'MKCOL' ? response(405) : read);
    await assert.rejects(api.syncWebDav(config(), o.deps));
    assert.deepEqual(o.calls.map(call => call[1]), ['MKCOL', 'GET']);
    assert.equal(o.backups, 0); assert.equal(o.applied.length, 0);
  }
});

test('v119 audit: two clients racing collection and file creation preserve both sets of history', async () => {
  let directoryExists = false, remote = null, revision = 0, missingReads = 0;
  const bothReadMissing = deferred(), requests = [];
  const request = async (cfg, method, headers, data) => {
    requests.push({ method, headers, data });
    if (method === 'MKCOL') { const existed = directoryExists; directoryExists = true; return response(existed ? 405 : 201); }
    if (method === 'GET') {
      if (remote === null) { if (++missingReads === 2) bothReadMissing.resolve(); await bothReadMissing.promise; return response(404); }
      return response(200, remote, `"${revision}"`);
    }
    assert.equal(method, 'PUT');
    if (headers['If-None-Match'] === '*') { if (remote) return response(412); }
    else if (headers['If-Match'] !== `"${revision}"`) return response(412);
    remote = JSON.parse(data); revision++; return response(201);
  };
  const a = ops(request, [event('client-a')]), b = ops(request, [event('client-b')]);
  await Promise.all([api.syncWebDav(config(), a.deps), api.syncWebDav(config(), b.deps)]);
  assert.deepEqual(remote.events.map(row => row.id).sort(), ['client-a', 'client-b']);
  assert.equal(a.applied.length, 1); assert.equal(b.applied.length, 1);
  assert.ok(requests.some(row => row.method === 'PUT' && row.headers['If-Match']));
  assert.equal(requests.filter(row => row.method === 'MKCOL').length, 2);
});

test('v119 audit: cancellation or changed settings after MKCOL prevents file access', async () => {
  for (const scenario of ['cancel', 'config']) {
    const ctrl = new AbortController(); let changed = false;
    const o = ops(() => { changed = true; if (scenario === 'cancel') ctrl.abort(); return response(201); });
    await assert.rejects(api.syncWebDav(config(), o.deps, { signal: ctrl.signal, check() { if (scenario === 'config' && changed) throw Error('settings changed'); } }));
    assert.deepEqual(o.calls.map(call => call[1]), ['MKCOL']);
    assert.equal(o.backups, 0); assert.equal(o.applied.length, 0);
  }
});

test('v119 audit: transport maps only MKCOL to the dedicated directory and GET/PUT to fixed data file', async () => {
  const sent = [];
  const transport = api.createDavTransport(options => { sent.push(options); queueMicrotask(() => options.onload({ status: 201, finalUrl: options.url, responseText: '' })); return { abort() {} }; }, manager);
  for (const method of ['MKCOL', 'GET', 'PUT']) await transport(config(), method);
  assert.deepEqual(sent.map(row => row.url), [
    'https://dav.example/existing/base/ChatGPT-Toolkit/',
    'https://dav.example/existing/base/ChatGPT-Toolkit/data.json',
    'https://dav.example/existing/base/ChatGPT-Toolkit/data.json'
  ]);
  for (const row of sent) { assert.equal(row.anonymous, true); assert.equal(row.redirect, 'error'); assert.equal(row.headers.Authorization, 'Basic ' + btoa('USER:PRIVATE-SECRET')); }
  const before = sent.length;
  await assert.rejects(transport({ url: 'https://dav.example/old.json', approved: true }, 'MKCOL'));
  for (const method of ['DELETE', 'PROPFIND', 'POST', 'COPY', 'MOVE']) await assert.rejects(transport(config(), method));
  assert.equal(sent.length, before);
});

test('v119 audit: transport rejects same-origin and cross-origin redirects including streaming paths', async () => {
  for (const method of ['MKCOL', 'GET', 'PUT']) for (const target of ['https://dav.example/other/', 'https://other.invalid/']) for (const stream of [false, true]) {
    const tx = api.createDavTransport(options => {
      queueMicrotask(() => options[stream ? 'onloadstart' : 'onload']({ status: 200, finalUrl: target, responseText: '{}', response: stream ? new ReadableStream({ start(c) { c.close(); } }) : undefined }));
      return { abort() {} };
    }, manager);
    await assert.rejects(tx(config(), method), /重定向/);
  }
});

test('v119 audit: unsupported managers, timeout and pre-cancel protect MKCOL as well as GET', async () => {
  for (const info of [{ scriptHandler: 'Tampermonkey', version: '5.5.0' }, { scriptHandler: 'Other', version: '99' }, { scriptHandler: 'Tampermonkey', version: 'bad' }]) {
    let calls = 0; const tx = api.createDavTransport(() => { calls++; }, info, 5);
    await assert.rejects(tx(config(), 'MKCOL')); assert.equal(calls, 0);
  }
  let aborted = false; const tx = api.createDavTransport(() => ({ abort() { aborted = true; } }), manager, 5);
  await assert.rejects(tx(config(), 'MKCOL'), /超时/); assert.equal(aborted, true);
  const ctrl = new AbortController(); ctrl.abort(); let calls = 0;
  const cancelled = api.createDavTransport(() => { calls++; }, manager, 5);
  await assert.rejects(cancelled(config(), 'MKCOL', {}, undefined, ctrl.signal)); assert.equal(calls, 0);
});

test('v119 audit: passive observer has one unchanged native invocation and only one GM transport call site', () => {
  const source = fs.readFileSync(path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
  assert.equal((source.match(/Reflect\.apply\(original, this, args\)/g) || []).length, 1);
  assert.equal((source.match(/\bgmRequest\(\{/g) || []).length, 1);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon\s*\(/);
  assert.match(source, /\/\/ @name\s+ChatGPT Toolkit\s*\n/);
  assert.match(source, /\/\/ @namespace\s+local\.chatgpt\.pro-counter\s*\n/);
  assert.equal(api.PREFIX, 'gpc.v1.');
  assert.equal(api.snapshot(settings, []).format, 'chatgpt-pro-counter');
  assert.equal(api.snapshot(settings, []).version, 1);
});

test('v119 audit: unconfigured/unapproved/disabled/untested automatic sync never creates directories', async () => {
  for (const cfg of [undefined, config({ approved: false, interval: 5 }), config({ enabled: false, interval: 5 }), config({ tested: false, interval: 5 }), config({ interval: 0 })]) {
    const calls = []; const e = environment({ entries: cfg ? [['gpc.v1.webdav', cfg]] : [], gmRequest: args => { calls.push(args); return { abort() {} }; } });
    e.tick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 0); assert.deepEqual(e.errors, []);
  }
});

function uiSession(cfg = config(), handler) {
  const calls = [];
  const e = environment({ entries: [['gpc.v1.webdav', cfg]], gmRequest: options => {
    calls.push(options); handler?.(options, calls.length);
    return { abort() { options.abortedByTest = true; } };
  } });
  const click = action => { const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action); e.emit(e.ui(), 'click', { target }); };
  const settle = async () => { for (let index = 0; index < 4; index++) await new Promise(resolve => setImmediate(resolve)); };
  const reply = (index, status, data, tag) => { const options = calls[index]; assert.ok(options, `call ${index}`); options.onload({ ...response(status, data, tag), finalUrl: options.url }); };
  click('expand'); click('sync');
  return { ...e, calls, click, settle, reply };
}

test('v119 audit UI: clearing credentials aborts in-flight directory creation without configuration resurrection', async () => {
  const e = uiSession(); e.click('sync-now');
  assert.deepEqual(e.calls.map(row => row.method), ['MKCOL']);
  e.click('sync-clear'); await e.settle();
  assert.equal(e.calls[0].abortedByTest, true);
  assert.equal(e.store.get('gpc.v1.webdav').enabled, false);
  assert.equal(e.store.get('gpc.v1.webdav').password, '');
  e.reply(0, 201); await e.settle();
  assert.deepEqual(e.calls.map(row => row.method), ['MKCOL']);
  assert.equal(e.store.get('gpc.v1.webdav').password, '');
  assert.deepEqual(e.errors, []);
});

test('v119 audit UI: same-URL mode/version/revision changes in another tab abort before PUT', async () => {
  for (const change of [{ mode: 'file' }, { version: 3 }, { revision: 'new-tab-revision' }, { password: 'OTHER-SECRET' }, { enabled: false }, { approved: false }]) {
    const e = uiSession(config({ revision: 'original-revision' })); e.click('sync-now');
    e.reply(0, 201); await e.settle();
    assert.deepEqual(e.calls.map(row => row.method), ['MKCOL', 'GET']);
    e.store.set('gpc.v1.webdav', { ...e.store.get('gpc.v1.webdav'), ...change });
    e.reply(1, 404); await e.settle();
    assert.deepEqual(e.calls.map(row => row.method), ['MKCOL', 'GET'], JSON.stringify(change));
    assert.equal(e.store.has('gpc.v1.lastSync'), false);
    assert.deepEqual(e.errors, []);
  }
});

test('v119 audit UI: MKCOL failure releases busy state and a second manual sync can finish', async () => {
  const e = uiSession(); e.click('sync-now'); e.reply(0, 409); await e.settle();
  assert.match(e.ui().textContent, /409|父目录|基础目录|基础路径/);
  e.click('sync-now'); assert.equal(e.calls[1].method, 'MKCOL');
  e.reply(1, 201); await e.settle(); e.reply(2, 404); await e.settle();
  assert.equal(e.calls[3].method, 'PUT'); assert.equal(e.calls[3].headers['If-None-Match'], '*');
  e.reply(3, 201); await e.settle();
  assert.match(e.ui().textContent, /同步成功/);
  assert.ok(e.store.has('gpc.v1.lastSync')); assert.deepEqual(e.errors, []);
});

test('v119 audit UI: explicitly enabled tested base mode can perform scheduled MKCOL and guarded sync', async () => {
  const e = uiSession(config({ interval: 5 }));
  // Invoke only the schedule callback; do not run the fixture's synthetic timeout queue.
  e.intervals.at(-1)();
  assert.deepEqual(e.calls.map(row => row.method), ['MKCOL']);
  e.reply(0, 405); await e.settle(); e.reply(1, 404); await e.settle(); e.reply(2, 201); await e.settle();
  assert.deepEqual(e.calls.map(row => row.method), ['MKCOL', 'GET', 'PUT']);
  assert.ok(e.store.has('gpc.v1.lastSync')); assert.deepEqual(e.errors, []);
});

test('v119 audit UI: configuration and cancellation snapshot must come from the same storage read', async () => {
  const key = 'gpc.v1.webdav', calls = [];
  let armed = false;
  class RacingStore extends Map {
    get(name) {
      const value = super.get(name);
      if (armed && name === key) {
        armed = false;
        super.set(key, config({ url: 'https://dav.example/new-base/', password: 'NEW-PRIVATE-SECRET', revision: 'other-tab' }));
      }
      return value;
    }
  }
  const store = new RacingStore([[key, config({ revision: 'old-tab' })]]);
  const e = environment({ store, gmRequest: options => { calls.push(options); return { abort() {} }; } });
  const click = action => { const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action); e.emit(e.ui(), 'click', { target }); };
  click('expand'); click('sync'); armed = true; click('sync-now');
  for (let index = 0; index < 4; index++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 0, 'No request may use stale destination A while comparing against newer configuration B.');
  assert.match(e.ui().textContent, /配置已改变/); assert.deepEqual(e.errors, []);
});
