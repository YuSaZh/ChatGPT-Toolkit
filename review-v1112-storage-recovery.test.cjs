'use strict';
// Synthetic storage/transport fault-injection regressions. No live account or endpoint.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const now = Date.now();
const settings = { ...api.defaultSettings(now), id: 'initial', anchor: now - 1000 };
const event = (id, extra = {}) => ({ v: 1, id, key: `key-${id}`, ledger: 'default', at: now - 10, updated: now, state: 'accepted', observation: 'done', delta: 0, requested: 'gpt-5-pro', route: '', label: '', conflict: false, stable: true, http: 200, ...extra });
const config = { url: 'https://dav.invalid/counter.json', username: 'PRIVATE-USER', password: 'PRIVATE-PASSWORD', enabled: true, tested: true, approved: true, interval: 0 };
const entries = rows => [['gpc.v1.settings.initial', settings], ...rows.map(row => [`gpc.v1.event.${row.id}`, row])];
const click = (e, action) => e.emit(e.ui(), 'click', { target: e.ui().querySelector(`[data-action="${action}"]`) });
const inspect = store => api.inspectLocalStorage({ keys: () => [...store.keys()], get: key => store.get(key) });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('inventory is read-only, covers all ledgers/windows/backups, and never reads credentials', () => {
  const rows = [event('local'), event('old', { at: now - api.WEEK - 100 }), event('acct', { ledger: 'a_PRIVATEHASH' }), event('unknown', { ledger: 'unassigned:PRIVATEID:1' })];
  const store = new Map([...entries(rows), ['gpc.v1.webdav', config], ['gpc.v1.backup.0', { ...api.snapshot(settings, rows), unexpected: 'PRIVATE-CONTENT' }]]);
  const before = structuredClone([...store]), reads = [];
  const report = api.inspectLocalStorage({ keys: () => [...store.keys()], get: key => { reads.push(key); assert.notEqual(key, 'gpc.v1.webdav'); return store.get(key); } });
  assert.equal(report.recordKeys, 4); assert.equal(report.backupKeys, 1); assert.equal(report.backups[0].count, 4);
  const text = api.storageSummary(report, { ...settings, label: 'PRIVATE-LABEL' }, { now });
  assert.match(text, /默认账本（当前显示）：记录 2，去重 2，周期内 1，周期外 1/);
  assert.match(text, /账号账本 1/); assert.match(text, /未分配账本 1/);
  assert.doesNotMatch(text, /PRIVATE|https:|counter\.json/); assert.doesNotMatch(JSON.stringify(report.backups[0].snapshot), /unexpected|PRIVATE-CONTENT/);
  assert.deepEqual([...store], before);
});

test('an individual read failure is not silently converted into zero records or a valid empty load', () => {
  let fail = false;
  const e = environment({ entries: entries([event('saved')]), beforeRun({ context }) { const get = context.GM_getValue; context.GM_getValue = (key, value) => { if (fail && key === 'gpc.v1.event.saved') throw Error('PRIVATE-ERROR'); return get(key, value); }; } });
  click(e, 'expand'); assert.match(e.ui().querySelector('.chip').textContent, /1\/100/);
  const before = structuredClone([...e.store]); fail = true; e.tick();
  assert.match(e.ui().querySelector('.chip').textContent, /待核对/); assert.match(e.ui().textContent, /保留本页已知记录/);
  assert.deepEqual([...e.store], before);
  e.menus.find(m => m.label === '检查本机计数数据').fn();
  assert.match(e.alerts.at(-1), /记录键 1；有效记录 0/); assert.match(e.alerts.at(-1), /读取失败 1/); assert.doesNotMatch(e.alerts.at(-1), /PRIVATE-ERROR/);
});

test('malformed existing settings or records are preserved and block initialization or writes', () => {
  for (const row of [['gpc.v1.settings.broken', { v: 99 }], ['gpc.v1.event.broken', { v: 99 }]]) {
    const store = new Map([row]); const before = structuredClone([...store]);
    const e = environment({ store }); click(e, 'expand'); click(e, 'plus');
    assert.deepEqual([...store], before); assert.match(e.ui().textContent, /待核对/);
    assert.equal(api.completeStorage(inspect(store)), false);
  }
});

test('silent storage write drops are detected and no false success or count animation is shown', () => {
  let attempts = 0;
  const e = environment({ entries: entries([]), beforeRun({ context }) { const set = context.GM_setValue; context.GM_setValue = (key, value) => { if (key.startsWith('gpc.v1.event.')) { attempts++; return; } set(key, value); }; } });
  click(e, 'expand'); click(e, 'plus'); click(e, 'plus');
  assert.equal(attempts, 1); assert.equal(inspect(e.store).records.length, 0); assert.match(e.ui().textContent, /待核对/); assert.match(e.ui().textContent, /未通过复核/);
});

test('missing-history backups are never replaced by an empty snapshot', () => {
  const history = api.snapshot(settings, [event('only-in-backup')]);
  const store = new Map([...entries([]), ...Array.from({ length: 12 }, (_, n) => [`gpc.v1.backup.${n}`, history])]);
  const e = environment({ store }); click(e, 'expand'); click(e, 'settings');
  const before = structuredClone([...store]); e.ui().querySelector('#cap').value = '123'; e.emit(e.ui(), 'submit', { target: e.ui().querySelector('#settings') });
  assert.deepEqual([...store], before); assert.match(e.ui().textContent, /安全备份未通过复核/);
});

test('diagnostic menu and view cause no writes or network requests and show every backup', () => {
  const store = new Map([...entries([event('saved')]), ['gpc.v1.backup.0', api.snapshot(settings, [event('b1')])], ['gpc.v1.backup.1', api.snapshot(settings, [event('b2'), event('b3')])]]);
  const e = environment({ store }); const before = structuredClone([...store]);
  e.menus.find(m => m.label === '检查本机计数数据').fn(); click(e, 'expand'); click(e, 'storage');
  assert.match(e.ui().querySelector('#storage-report').textContent, /备份 2/); assert.equal(e.ui().querySelectorAll('[data-action="backup-export"]').length, 2);
  assert.deepEqual([...store], before); assert.deepEqual(e.errors, []);
});

test('empty local+remote payload stops after GET, while positive remote history can still merge', async () => {
  for (const remote of [null, api.snapshot(settings, []), api.snapshot(settings, [event('remote')])]) {
    const methods = []; let backups = 0, applied;
    const deps = { local: () => api.snapshot(settings, []), backup() { backups++; }, apply(value) { applied = value; }, async request(c, method) { methods.push(method); return method === 'GET' ? { status: remote ? 200 : 404, responseText: JSON.stringify(remote), responseHeaders: 'ETag: "real"' } : { status: 204 }; } };
    if (!remote?.events.length) { await assert.rejects(api.syncWebDav(config, deps), /空文件上传/); assert.deepEqual(methods, ['GET']); assert.equal(backups, 0); assert.equal(applied, undefined); }
    else { await api.syncWebDav(config, deps); assert.deepEqual(methods, ['GET', 'PUT']); assert.equal(applied.events.length, 1); }
  }
});

test('412 diagnostics do not invent a competing device and conflict retries take only one backup', async () => {
  let backups = 0, puts = 0;
  await assert.rejects(api.syncWebDav(config, { local: () => api.snapshot(settings, [event('saved')]), backup() { backups++; }, apply() { assert.fail('must not apply'); }, async request(c, method) { if (method === 'GET') return { status: 404 }; puts++; return { status: 412 }; } }), /同步失败（HTTP 412）。本机记录已保留。/);
  assert.equal(puts, 3); assert.equal(backups, 1);
});

test('PUT409 is reported as a resource conflict without repeated writes', async () => {
  let puts = 0;
  await assert.rejects(api.syncWebDav(config, { local: () => api.snapshot(settings, [event('saved')]), backup() {}, apply() { assert.fail('must not apply'); }, async request(c, method) { if (method === 'GET') return { status: 404 }; puts++; return { status: 409 }; } }), /PUT 返回 HTTP 409/);
  assert.equal(puts, 1);
});

test('timeout trace distinguishes EOF-without-final from final-without-EOF and never stores secrets', async () => {
  for (const mode of ['no-final', 'no-eof']) {
    const trace = []; let controller;
    const tx = api.createDavTransport(opts => { queueMicrotask(() => { opts.onloadstart({ status: 0, response: new ReadableStream({ start(c) { controller = c; if (mode === 'no-final') c.close(); } }) }); if (mode === 'no-eof') opts.onload({ status: 200, finalUrl: opts.url, responseHeaders: 'Authorization: PRIVATE-HEADER' }); }); return { abort() { if (mode === 'no-eof') try { controller.close(); } catch {} } }; }, { scriptHandler: 'Tampermonkey', version: '5.5.1' }, 25, row => trace.push(row));
    await assert.rejects(tx(config, 'GET'), /GET；HTTP/);
    assert.equal(trace.length, 1); assert.equal(trace[0].finalSeen, mode === 'no-eof'); assert.equal(trace[0].streamEOF, mode === 'no-final');
    assert.doesNotMatch(JSON.stringify(trace), /PRIVATE|https:|Authorization|counter.json/);
  }
});

test('a storage read failure after PUT prevents settings apply and lastSync success', async () => {
  let fail = false; const calls = [], row = event('saved');
  const store = new Map([...entries([row]), ['gpc.v1.webdav', config]]);
  const e = environment({ store, gmRequest(opts) { calls.push(opts); return { abort() {} }; }, beforeRun({ context }) { const get = context.GM_getValue; context.GM_getValue = (key, value) => { if (fail && key === 'gpc.v1.event.saved') throw Error('broken'); return get(key, value); }; } });
  click(e, 'expand'); click(e, 'sync'); click(e, 'sync-now');
  const remote = api.snapshot({ ...settings, id: 'remote', updated: now + 100 }, [row]);
  calls[0].onload({ status: 200, finalUrl: calls[0].url, responseHeaders: 'ETag: "remote"', responseText: JSON.stringify(remote) }); await tick();
  assert.equal(calls[1].method, 'PUT'); fail = true; calls[1].onload({ status: 204, finalUrl: calls[1].url, responseText: '' }); await tick();
  assert.equal(store.has('gpc.v1.settings.remote'), false); assert.equal(store.has('gpc.v1.lastSync'), false); assert.match(e.ui().textContent, /本机存储已暂停写入/);
});

test('settings readback failure latches write protection and leaves existing events unchanged', () => {
  let eventWrites = 0;
  const e = environment({ entries: entries([event('saved')]), beforeRun({ context }) { const set = context.GM_setValue; context.GM_setValue = (key, value) => { if (key.startsWith('gpc.v1.settings.') && key !== 'gpc.v1.settings.initial') return; if (key.startsWith('gpc.v1.event.')) eventWrites++; set(key, value); }; } });
  click(e, 'expand'); click(e, 'settings'); e.ui().querySelector('#cap').value = '234';
  e.emit(e.ui(), 'submit', { target: e.ui().querySelector('#settings') });
  assert.match(e.ui().textContent, /未通过复核/); assert.match(e.ui().querySelector('.chip').textContent, /待核对/);
  click(e, 'plus'); assert.equal(eventWrites, 0); assert.equal(inspect(e.store).records.length, 1);
});

test('open form refresh preserves the form and shows uncertainty rather than a false number', () => {
  let fail = false;
  const e = environment({ entries: entries([event('saved')]), beforeRun({ context }) { const get = context.GM_getValue; context.GM_getValue = (key, value) => { if (fail && key === 'gpc.v1.event.saved') throw Error('fault'); return get(key, value); }; } });
  click(e, 'expand'); click(e, 'settings'); const form = e.ui().querySelector('#settings'); fail = true; e.tick();
  assert.equal(e.ui().querySelector('#settings'), form); assert.match(e.ui().querySelector('.chip').textContent, /待核对/);
  assert.match(e.ui().querySelector('.chip').getAttribute('aria-label'), /待核对/);
});

test('legacy recent-backup export uses the same whitelist as individual recovery exports', async () => {
  const blobs = [];
  const backup = { ...api.snapshot(settings, [event('backed-up')]), password: 'PRIVATE-PASSWORD', responseText: 'PRIVATE-CONTENT' };
  const e = environment({ entries: [...entries([]), ['gpc.v1.backup.0', backup]], beforeRun({ context }) { context.URL = class extends URL { static createObjectURL(blob) { blobs.push(blob); return 'blob:synthetic'; } static revokeObjectURL() {} }; } });
  click(e, 'expand'); click(e, 'backup');
  assert.equal(blobs.length, 1); const exported = await blobs[0].text(); assert.doesNotMatch(exported, /PRIVATE|password|responseText/);
  assert.equal(JSON.parse(exported).events.length, 1); assert.deepEqual(e.store.get('gpc.v1.backup.0'), backup);
});
