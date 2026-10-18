'use strict';
// Independent adversarial tests. All HTTP requests below are mocked; no live
// session, account, challenge or conversation request is sent.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');

const response = (data, meta = {}) => {
  const result = new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  for (const [key, value] of Object.entries(meta)) Object.defineProperty(result, key, { value });
  return result;
};
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const challenge = difficulty => ({ proofofwork: { difficulty, required: true, seed: 'SYNTHETIC-SEED-PRIVATE', nonce: 'SYNTHETIC-NONCE-PRIVATE' }, token: 'SYNTHETIC-TOKEN-PRIVATE' });
test('v122 PoW retains last capture until new valid data or an account fence', () => {
  let now=1000;const pow=api.createPowState({clock:()=>now});
  pow.accept(pow.invalidate(),challenge('00ab'));const pending=pow.invalidate(false);
  now=100000;assert.equal(pow.accept(pending,{}),false);assert.deepEqual(pow.current(),{difficulty:'00ab',required:true,observedAt:1000});
  pow.accept(pending,challenge('00cd'));assert.equal(pow.current().difficulty,'00cd');
  pow.invalidate();assert.equal(pow.current(),null);assert.equal(pow.accept(pending,challenge('00ff')),false);
});
function observe(fetch, extra = {}) {
  const saved = [], win = { location: { href: 'https://chatgpt.com/' }, fetch };
  const observer = api.installObserver(win, { save: row => saved.push(row), ledger: () => 'default', ...extra });
  return { saved, win, observer };
}

test('v118 audit: PoW parses only strict bounded hex and does not interpret a risk rating', () => {
  for (const difficulty of ['', ' 00ab', '00ab ', '0x00ab', '-1', 'NaN', 'Infinity', '0.01', '00\nab', 'g0', 'a'.repeat(129), 1, null, {}]) assert.equal(api.parsePow(challenge(difficulty)), null, String(difficulty));
  for (const difficulty of ['0', '0000', '000aBc', 'F'.repeat(128)]) {
    const value = api.parsePow(challenge(difficulty));
    assert.deepEqual(value, { difficulty, required: true });
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE|seed|nonce|token|risk|rating/i);
  }
  assert.deepEqual(api.parsePow({ proofofwork: { difficulty: '00', required: false } }), { difficulty: '00', required: false });
  for (const required of ['true', 0, 1, null, undefined]) assert.equal(api.parsePow({ proofofwork: { difficulty: '00', required } }).required, null);
});

test('v118 audit: only same-origin POST exact prepare/legacy PoW endpoints qualify', () => {
  const base = 'https://chatgpt.com/c/synthetic';
  for (const url of ['/backend-api/sentinel/chat-requirements/prepare', '/backend-api/sentinel/chat-requirements', '/backend-anon/sentinel/chat-requirements/prepare']) {
    assert.equal(api.powRequest(url, { method: 'POST' }, base), 'pow');
    assert.notEqual(api.powRequest(url, { method: 'GET' }, base), 'pow');
    assert.notEqual(api.powRequest('https://other.invalid' + url, { method: 'POST' }, base), 'pow');
  }
  for (const url of ['/backend-api/sentinel/chat-requirements/prepare/extra', '/backend-api/sentinel/chat-requirementsX', '/other', 'https://chatgpt.com.invalid/backend-api/sentinel/chat-requirements']) assert.notEqual(api.powRequest(url, { method: 'POST' }, base), 'pow');
});

test('v118 audit: PoW newer request wins even if older response arrives last', async () => {
  const a = deferred(), b = deferred(), pow = api.createPowState(); let calls = 0;
  const e = observe(() => (++calls === 1 ? a.promise : b.promise), { pow });
  assert.equal(e.win.fetch('/backend-api/sentinel/chat-requirements', { method: 'POST' }), a.promise);
  assert.equal(e.win.fetch('/backend-api/sentinel/chat-requirements/prepare', { method: 'POST' }), b.promise);
  b.resolve(response(challenge('0002'))); await new Promise(resolve => setImmediate(resolve));
  a.resolve(response(challenge('0001'))); await e.observer.idle();
  assert.equal(pow.current().difficulty, '0002'); assert.equal(calls, 2); assert.deepEqual(e.saved, []);
});

test('v118 audit: auth/session invalidation rejects late PoW without issuing extra fetches', async () => {
  for (const url of ['/api/auth/session', '/api/auth/signout', '/backend-api/me', '/backend-api/accounts/check']) {
    const pending = deferred(), pow = api.createPowState(); let calls = 0;
    const e = observe(() => (++calls === 1 ? pending.promise : Promise.resolve(response({}))), { pow });
    e.win.fetch('/backend-api/sentinel/chat-requirements/prepare', { method: 'POST' });
    e.win.fetch(url);
    pending.resolve(response(challenge('0000'))); await e.observer.idle();
    assert.equal(pow.current(), null, url); assert.equal(calls, 2, url);
  }
});

test('v118 audit: redirect and final response provenance rejection leaves original response readable', async () => {
  for (const meta of [
    { redirected: true, url: 'https://chatgpt.com/backend-api/sentinel/chat-requirements/prepare' },
    { redirected: false, url: 'https://other.invalid/backend-api/sentinel/chat-requirements/prepare' },
    { redirected: false, url: 'https://chatgpt.com/api/auth/session' },
  ]) {
    const pow = api.createPowState(), output = response(challenge('0000'), meta), native = Promise.resolve(output);
    const e = observe(() => native, { pow });
    assert.equal(e.win.fetch('/backend-api/sentinel/chat-requirements/prepare', { method: 'POST' }), native);
    assert.equal(await native, output); await e.observer.idle();
    assert.equal(pow.current(), null); assert.equal(output.bodyUsed, false); assert.match(await output.text(), /SYNTHETIC-SEED-PRIVATE/);
  }
});

test('v118 audit: PoW keeps exact native invocation, this, arguments, Promise, Response and AbortSignal', async () => {
  const pow = api.createPowState(), output = response(challenge('00')), native = Promise.resolve(output), calls = [], receiver = {}, abort = new AbortController();
  const init = { method: 'POST', body: 'SYNTHETIC-REQUEST-PRIVATE', signal: abort.signal };
  const e = observe(function (...args) { calls.push({ receiver: this, args }); return native; }, { pow });
  const result = e.win.fetch.call(receiver, '/backend-api/sentinel/chat-requirements/prepare', init);
  assert.equal(result, native); assert.equal(await result, output); await e.observer.idle();
  assert.equal(calls.length, 1); assert.equal(calls[0].receiver, receiver); assert.equal(calls[0].args[1], init); assert.equal(calls[0].args[1].signal, abort.signal); assert.equal(abort.signal.aborted, false);
  assert.equal(output.bodyUsed, false); assert.deepEqual(e.saved, []);
});

test('v118 audit: PoW helper and clone failures never replace the native result or native error', async () => {
  for (const helper of ['invalidate', 'accept']) {
    const pow = api.createPowState(); pow[helper] = () => { throw Error('Synthetic optional failure'); };
    const output = response(challenge('00')), native = Promise.resolve(output), e = observe(() => native, { pow });
    assert.equal(e.win.fetch('/backend-api/sentinel/chat-requirements', { method: 'POST' }), native); await e.observer.idle(); assert.equal(await native, output);
  }
  for (const synchronous of [false, true]) {
    const error = new DOMException('Synthetic abort', 'AbortError'), native = synchronous ? null : Promise.reject(error); native?.catch(() => {});
    const e = observe(() => { if (synchronous) throw error; return native; }, { pow: { invalidate() { throw Error('Optional failure'); } } });
    if (synchronous) assert.throws(() => e.win.fetch('/backend-api/sentinel/chat-requirements', { method: 'POST' }), actual => actual === error);
    else { const result = e.win.fetch('/backend-api/sentinel/chat-requirements', { method: 'POST' }); assert.equal(result, native); await assert.rejects(result, actual => actual === error); }
    await e.observer.idle();
  }
});

test('v118 audit: over-limit PoW clone never cancels or consumes original response stream', async () => {
  let source, canceled = false;
  const payload = JSON.stringify(challenge('00')) + ' '.repeat(65536);
  const output = new Response(new ReadableStream({ start(controller) { source = controller; controller.enqueue(new TextEncoder().encode(payload)); }, cancel() { canceled = true; } }), { headers: { 'content-type': 'application/json' } });
  const pow = api.createPowState(), e = observe(() => Promise.resolve(output), { pow });
  assert.equal(await e.win.fetch('/backend-api/sentinel/chat-requirements', { method: 'POST' }), output); await e.observer.idle();
  assert.equal(pow.current(), null); assert.equal(canceled, false); assert.equal(output.bodyUsed, false);
  source.close(); assert.equal(await output.text(), payload); assert.equal(canceled, false);
});

test('v118 audit: PoW transient state is excluded from portable snapshot schema', () => {
  const pow = api.createPowState(), token = pow.invalidate(); pow.accept(token, challenge('000000abcd'));
  const settings = { ...api.defaultSettings(), ...pow.current(), token: 'SYNTHETIC-TOKEN-PRIVATE' };
  const snapshot = api.snapshot(settings, []);
  assert.doesNotMatch(JSON.stringify(snapshot), /difficulty|proofofwork|required|observedAt|000000abcd|PRIVATE/);
});

const session = id => ({ user: { id, email: 'SYNTHETIC-EMAIL-PRIVATE@example.invalid', name: 'SYNTHETIC-NAME-PRIVATE' }, accessToken: 'SYNTHETIC-ACCESS-TOKEN-PRIVATE' });
const sendBody = id => JSON.stringify({ action: 'next', model: 'gpt-5-pro', messages: [{ id, author: { role: 'user' }, content: { parts: ['SYNTHETIC-CONTENT-PRIVATE'] } }] });
const identify = async (account, id) => { const token = account.invalidate(); assert.equal(await account.accept(token, session(id)), true); return account.capture(); };

test('v118 audit: own session user.id only, with strict same-origin GET endpoint', () => {
  assert.equal(api.parseAccountId(session('user-A')), 'user-A');
  for (const data of [{ id: 'user-A' }, { account: { id: 'user-A' } }, { message: { author: { id: 'user-A', role: 'user' } } }, { user: { email: 'user-A' } }, { user: { id: 'a@example.invalid' } }, { user: { id: '' } }, { user: { id: 123 } }, null]) assert.equal(api.parseAccountId(data), '');
  assert.equal(api.accountRequest('/api/auth/session', undefined, 'https://chatgpt.com/'), 'session');
  for (const [url, method] of [['/api/auth/session', 'POST'], ['/api/auth/session/extra', 'GET'], ['/backend-api/me', 'GET'], ['https://other.invalid/api/auth/session', 'GET'], ['/backend-api/conversation', 'POST']]) assert.notEqual(api.accountRequest(url, { method }, 'https://chatgpt.com/'), 'session');
});

test('v118 audit: account auto mode defaults off and SHA-256 identity is deterministic but pseudonymous', async () => {
  const off = api.createAccountState(); assert.equal(off.enabled(), false); assert.equal(off.capture(), null); assert.equal(await off.accept(off.invalidate(), session('user-A')), false);
  const a = api.createAccountState({ enabled: true }), b = api.createAccountState({ enabled: true });
  const aBook = await identify(a, 'user-A'), bBook = await identify(b, 'user-A');
  assert.equal(aBook, bBook); assert.match(aBook, /^a_[a-f0-9]{64}$/); assert.notEqual(await identify(b, 'user-B'), aBook);
  assert.doesNotMatch(JSON.stringify(a.current()), /user-A|PRIVATE|email|token/i);
});

test('v118 audit: pending identities remain distinct unassigned ledgers and never become known retrospectively', async () => {
  const a = api.createAccountState({ enabled: true }), b = api.createAccountState({ enabled: true });
  const unknown = a.capture(); assert.match(unknown, /^unassigned:/); assert.equal(a.capture(), unknown); assert.notEqual(b.capture(), unknown);
  const known = await identify(a, 'user-A'); assert.notEqual(known, unknown);
  a.invalidate(); assert.notEqual(a.capture(), unknown); assert.notEqual(a.capture(), known);
});

test('v118 audit: async account hashes cannot restore stale identity after switch, logout or disable/re-enable', async () => {
  const pending = [], a = api.createAccountState({ enabled: true, hash: () => { const d = deferred(); pending.push(d); return d.promise; } });
  const tokenA = a.invalidate(), first = a.accept(tokenA, session('user-A'));
  const tokenB = a.invalidate(), second = a.accept(tokenB, session('user-B'));
  pending[1].resolve('b'.repeat(64)); assert.equal(await second, true); pending[0].resolve('a'.repeat(64)); assert.equal(await first, false); assert.equal(a.capture(), 'a_' + 'b'.repeat(64));
  const tokenC = a.invalidate(), third = a.accept(tokenC, session('user-C')); a.invalidate(); pending[2].resolve('c'.repeat(64)); assert.equal(await third, false); assert.equal(a.current().recognized, false);
  const tokenD = a.invalidate(), fourth = a.accept(tokenD, session('user-D')); a.setEnabled(false); a.setEnabled(true); pending[3].resolve('d'.repeat(64)); assert.equal(await fourth, false); assert.equal(a.current().recognized, false);
});

test('v118 audit: malformed or failed session response stays unknown, never preserves prior account', async () => {
  for (const data of [{}, { user: null }, { user: { id: false } }, { account: { id: 'user-B' } }]) {
    const account = api.createAccountState({ enabled: true }); const before = await identify(account, 'user-A');
    const e = observe(() => Promise.resolve(response(data)), { account, captureLedger: () => account.capture() });
    e.win.fetch('/api/auth/session'); await e.observer.idle();
    assert.equal(account.current().recognized, false); assert.notEqual(account.capture(), before);
  }
});

test('v118 audit: rejected session provenance stays unknown and display failures cannot preserve stale identity', async () => {
  for (const meta of [{ redirected: true }, { url: 'https://other.invalid/api/auth/session' }, { url: 'https://chatgpt.com/backend-api/me' }]) {
    const account = api.createAccountState({ enabled: true }); await identify(account, 'user-A');
    const output = response(session('user-B'), meta), e = observe(() => Promise.resolve(output), { account, captureLedger: () => account.capture() });
    e.win.fetch('/api/auth/session'); await e.observer.idle();
    assert.equal(account.current().recognized, false); assert.equal(output.bodyUsed, false);
  }
  const account = api.createAccountState({ enabled: true }); const oldLedger = await identify(account, 'user-A');
  const e = observe(() => Promise.resolve(response(session('user-B'))), { account, captureLedger: () => account.capture(), imageQuota: { invalidate() { throw Error('Synthetic quota failure'); } } });
  e.win.fetch('/api/auth/session'); await e.observer.idle(); assert.notEqual(account.capture(), oldLedger); assert.equal(account.capture(), 'a_' + await api.digest('chatgpt-toolkit/account-ledger/v1\0user-B'));
});

test('v118 audit: late session response cannot resurrect account after logout', async () => {
  const pending = deferred(), account = api.createAccountState({ enabled: true }); let calls = 0;
  const e = observe(() => (++calls === 1 ? pending.promise : Promise.resolve(response({}))), { account, captureLedger: () => account.capture() });
  e.win.fetch('/api/auth/session'); e.win.fetch('/api/auth/signout', { method: 'POST' }); pending.resolve(response(session('user-A'))); await e.observer.idle();
  assert.equal(account.current().recognized, false); assert.equal(calls, 2); assert.deepEqual(e.saved, []);
});

test('v118 audit: in-flight account A event is immutable across later account B identification', async () => {
  const pending = deferred(), account = api.createAccountState({ enabled: true }); const a = await identify(account, 'user-A'); let calls = 0;
  const e = observe(url => { calls++; return url === '/api/auth/session' ? Promise.resolve(response(session('user-B'))) : pending.promise; }, { account, captureLedger: () => account.capture() });
  e.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-account-A') });
  e.win.fetch('/api/auth/session'); pending.resolve(response({})); await e.observer.idle();
  assert.equal(account.current().recognized, true); assert.notEqual(account.capture(), a); assert.ok(e.saved.length); assert.ok(e.saved.every(row => row.ledger === a)); assert.equal(calls, 2);
  assert.doesNotMatch(JSON.stringify(e.saved), /user-A|user-B|PRIVATE/);
});

test('v118 audit: account snapshot precedes native synchronous reentrancy and a failed snapshot never falls back', async () => {
  const account = api.createAccountState({ enabled: true }); const a = await identify(account, 'user-A');
  const e = observe(() => { account.invalidate(); return Promise.resolve(response({})); }, { account, captureLedger: () => account.capture(), ledger() { throw Error('Must not re-read after request start'); } });
  e.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-reentrancy') }); await e.observer.idle(); assert.ok(e.saved.length); assert.ok(e.saved.every(row => row.ledger === a));
  let calls = 0, fallbacks = 0;
  const bad = observe(() => { calls++; return Promise.resolve(response({})); }, { captureLedger() { throw Error('Snapshot failed'); }, ledger() { fallbacks++; return a; } });
  bad.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-failed-snapshot') }); await bad.observer.idle(); assert.equal(calls, 1); assert.equal(fallbacks, 0); assert.deepEqual(bad.saved, []);
});

test('v118 audit: pending-account request never acquires a subsequently discovered account', async () => {
  const account = api.createAccountState({ enabled: true }), pending = deferred(), e = observe(() => pending.promise, { account, captureLedger: () => account.capture() });
  const unknown = account.capture(); e.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-unassigned') });
  await identify(account, 'user-A'); pending.resolve(response({})); await e.observer.idle(); assert.ok(e.saved.length); assert.ok(e.saved.every(row => row.ledger === unknown)); assert.match(unknown, /^unassigned:/);
});

const click = (e, action) => {
  const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action); e.emit(e.ui(), 'click', { target });
};
const rows = store => [...store.entries()].filter(([key]) => key.startsWith(api.PREFIX + 'event.')).map(([, value]) => value);
async function until(e, predicate, description) {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) { await new Promise(resolve => setImmediate(resolve)); e.flush(200); }
  assert.ok(predicate(), description); assert.deepEqual(e.errors, []);
}
function tabVM(store, identity, extra = {}) {
  const calls = [];
  const e = environment({ store, fetch(url, init) { calls.push([url, init]); return Promise.resolve(response(url === '/api/auth/session' ? session(identity) : {})); }, ...extra });
  e.menus[0].fn(); click(e, 'settings');
  return { ...e, calls };
}
async function identifyVM(e) {
  await e.win.fetch('/api/auth/session');
  await until(e, () => e.ui().querySelector('#account-status')?.textContent.includes('已识别'), 'own session identifies this tab');
}

test('v118 audit: two real boot states share storage yet independently route different accounts', async () => {
  const store = new Map([[api.PREFIX + 'ui.autoAccount', true]]), a = tabVM(store, 'user-A'), b = tabVM(store, 'user-B');
  await identifyVM(a); await identifyVM(b);
  const aExpected = 'a_' + await api.digest('chatgpt-toolkit/account-ledger/v1\0user-A'), bExpected = 'a_' + await api.digest('chatgpt-toolkit/account-ledger/v1\0user-B');
  await a.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-boot-A1') });
  await until(a, () => rows(store).some(row => row.state === 'accepted' && row.ledger === aExpected), 'A event stays in A ledger');
  await b.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-boot-B1') });
  await until(b, () => rows(store).some(row => row.state === 'accepted' && row.ledger === bExpected), 'B event stays in B ledger');
  a.emit(a.win, 'focus'); b.emit(b.win, 'focus'); a.tick(); b.tick();
  await a.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-boot-A2') });
  await until(a, () => rows(store).filter(row => row.state === 'accepted').length === 3, 'A still records after B/shared storage refresh');
  assert.equal(rows(store).filter(row => row.ledger === aExpected).length, 2); assert.equal(rows(store).filter(row => row.ledger === bExpected).length, 1);
  const settings = [...store.entries()].filter(([key]) => key.startsWith(api.PREFIX + 'settings.')).map(([, value]) => value);
  assert.ok(settings.every(value => value.ledger === 'default'), 'effective automatic selection is never global');
  assert.doesNotMatch(JSON.stringify([...store]), /user-A|user-B|SYNTHETIC-EMAIL|SYNTHETIC-ACCESS|SYNTHETIC-CONTENT/);
  assert.equal(a.calls.length, 3); assert.equal(b.calls.length, 2);
});

test('v118 audit: default-off boot preserves manual historical ledger and never silently migrates it', async () => {
  const setting = { ...api.defaultSettings(), id: 'synthetic-manual-settings', ledger: 'manual-old', label: 'Existing manual book' };
  const historical = { v: 1, id: 'synthetic-history', key: 'm:synthetic-history', ledger: 'manual-old', at: Date.now(), updated: Date.now(), state: 'manual', observation: 'manual', delta: 7, requested: '', route: '', label: '', stable: true, conflict: false, http: 0 };
  const store = new Map([[api.PREFIX + 'settings.' + setting.id, setting], [api.PREFIX + 'event.' + historical.id, historical]]), e = tabVM(store, 'user-A');
  assert.equal(e.ui().querySelector('#account-off').getAttribute('aria-pressed'), 'true');
  await e.win.fetch('/api/auth/session'); await e.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-before-optin') });
  await until(e, () => rows(store).length === 2 && rows(store).some(row => row.state === 'accepted'), 'manual event captured'); assert.ok(rows(store).every(row => row.ledger === 'manual-old'));
  click(e, 'account-on'); await identifyVM(e);
  assert.deepEqual(store.get(api.PREFIX + 'event.' + historical.id), historical); assert.equal(rows(store).filter(row => row.ledger === 'manual-old').length, 2);
});

test('v118 audit: hidden-page logout uncertainty fences a late session response at boot', async () => {
  const pending = deferred(), store = new Map([[api.PREFIX + 'ui.autoAccount', true]]), e = tabVM(store, 'user-A', { fetch(url) { return url === '/api/auth/session' ? pending.promise : Promise.resolve(response({})); } });
  e.win.fetch('/api/auth/session'); e.document.hidden = true; e.emit(e.document, 'visibilitychange');
  pending.resolve(response(session('user-A'))); await new Promise(resolve => setTimeout(resolve, 30)); e.flush(200);
  assert.doesNotMatch(e.ui().querySelector('#account-status').textContent, /已识别/);
  await e.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-after-hidden') });
  await until(e, () => rows(store).some(row => row.state === 'accepted'), 'unassigned event captured after hidden signal');
  assert.ok(rows(store).every(row => row.ledger.startsWith('unassigned:')));
});

test('v118 audit: PoW invalidation during native fetch cannot resurrect a pre-switch challenge', async () => {
  const pow = api.createPowState();
  const e = observe(() => { pow.invalidate(); return Promise.resolve(response(challenge('0000'))); }, { pow });
  e.win.fetch('/backend-api/sentinel/chat-requirements/prepare', { method: 'POST' }); await e.observer.idle();
  assert.equal(pow.current(), null, 'request-time generation must not be minted after a reentrant account/ledger switch');
});

test('v118 audit: WebDAV merge preserves per-tab account routing and strips all unassigned events', async () => {
  const aBook = 'a_' + await api.digest('chatgpt-toolkit/account-ledger/v1\0user-A'), bBook = 'a_' + await api.digest('chatgpt-toolkit/account-ledger/v1\0user-B');
  const makeEvent = (id, ledger) => ({ v: 1, id, key: 'm:' + id, ledger, at: Date.now(), updated: Date.now(), state: 'manual', observation: 'manual', delta: 1, requested: '', route: '', label: '', stable: true, conflict: false, http: 0 });
  const unknown = makeEvent('synthetic-local-unknown', 'unassigned:local'), remoteUnknown = makeEvent('synthetic-remote-unknown', 'unassigned:remote');
  const config = { url: 'https://example.invalid/counter.json', username: '', password: '', interval: 0, enabled: true, tested: true, approved: true };
  const store = new Map([[api.PREFIX + 'ui.autoAccount', true], [api.PREFIX + 'webdav', config], [api.PREFIX + 'event.' + unknown.id, unknown]]);
  const remote = api.snapshot({ ...api.defaultSettings(), id: 'synthetic-remote-settings', updated: Date.now() + 1000, ledger: bBook, label: 'Remote manual selection', cap: 99 }, [makeEvent('synthetic-remote-B', bBook), remoteUnknown]);
  const davCalls = [];
  const e = tabVM(store, 'user-A', { gmRequest(options) {
    davCalls.push(options);
    queueMicrotask(() => options.onload({ status: options.method === 'GET' ? 200 : 204, responseHeaders: 'ETag: "synthetic-etag"', responseText: options.method === 'GET' ? JSON.stringify(remote) : '', finalUrl: config.url }));
    return { abort() {} };
  } });
  await identifyVM(e); click(e, 'sync'); click(e, 'sync-now');
  await until(e, () => store.has(api.PREFIX + 'lastSync'), 'mocked WebDAV merge completed');
  assert.equal(davCalls.length, 2); assert.equal(davCalls[0].method, 'GET'); assert.equal(davCalls[1].method, 'PUT');
  const payload = JSON.parse(davCalls[1].data); assert.ok(payload.events.every(row => !row.ledger.startsWith('unassigned:')));
  assert.equal(store.get(api.PREFIX + 'event.' + unknown.id).ledger, unknown.ledger); assert.equal(store.has(api.PREFIX + 'event.' + remoteUnknown.id), false);
  await e.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-after-sync-A') });
  await until(e, () => rows(store).some(row => row.state === 'accepted'), 'own request after remote B selection');
  assert.ok(rows(store).filter(row => row.state === 'accepted').every(row => row.ledger === aBook));
  assert.equal(store.get(api.PREFIX + 'ui.autoAccount'), true); assert.doesNotMatch(davCalls[1].data, /ui\.autoAccount|SYNTHETIC-EMAIL|SYNTHETIC-ACCESS|user-A|user-B/);
});

test('v118 audit: unassigned accepted rows do not claim account credit or show a +1 animation', async () => {
  const store = new Map([[api.PREFIX + 'ui.autoAccount', true]]), e = tabVM(store, 'user-A');
  await e.win.fetch('/backend-api/conversation', { method: 'POST', body: sendBody('synthetic-unassigned-display') });
  await until(e, () => rows(store).some(row => row.state === 'accepted'), 'unassigned request is captured');
  e.flush(200);
  assert.equal(e.document.getElementById('chatgpt-pro-local-increment'), null, 'unknown identity must not animate account credit');
  click(e, 'log'); const badges = e.ui().querySelectorAll('.log .badge').map(node => node.textContent);
  assert.ok(badges.length); assert.ok(badges.every(text => text.includes('未分配'))); assert.ok(badges.every(text => !text.includes('已计入')));
});

test('v118 audit: session observation preserves native fetch contract and disabled mode never clones identity', async () => {
  for (const enabled of [false, true]) {
    const account = api.createAccountState({ enabled }), output = response(session('user-A')), native = Promise.resolve(output), owner = {}, controller = new AbortController(), calls = [];
    const clone = output.clone.bind(output); let clones = 0; output.clone = () => { clones++; return clone(); };
    const init = { method: 'GET', signal: controller.signal, headers: { 'X-Synthetic': 'unchanged' } };
    const e = observe(function (...args) { calls.push({ owner: this, args }); return native; }, { account, imageQuota: api.createImageQuotaState(), pow: api.createPowState(), captureLedger: () => account.capture() });
    const result = e.win.fetch.call(owner, '/api/auth/session', init);
    assert.equal(result, native); assert.equal(await result, output); await e.observer.idle();
    assert.equal(calls.length, 1); assert.equal(calls[0].owner, owner); assert.equal(calls[0].args[0], '/api/auth/session'); assert.equal(calls[0].args[1], init); assert.equal(init.signal, controller.signal); assert.equal(controller.signal.aborted, false);
    assert.equal(output.bodyUsed, false); assert.equal(clones, enabled ? 1 : 0); assert.deepEqual(e.saved, []);
  }
});

test('v118 audit: reversed session response order cannot overwrite the newest request identity', async () => {
  const a = deferred(), b = deferred(), account = api.createAccountState({ enabled: true }); let calls = 0;
  const e = observe(() => (++calls === 1 ? a.promise : b.promise), { account, captureLedger: () => account.capture() });
  e.win.fetch('/api/auth/session'); e.win.fetch('/api/auth/session');
  b.resolve(response(session('user-B'))); a.resolve(response(session('user-A'))); await e.observer.idle();
  assert.equal(account.capture(), 'a_' + await api.digest('chatgpt-toolkit/account-ledger/v1\0user-B')); assert.equal(calls, 2);
});
