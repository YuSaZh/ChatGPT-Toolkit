'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { eventEnvironment } = require('./audit-event-fixture.cjs');
const api = require('./chatgpt-pro-counter.user.js');
const source = fs.readFileSync(path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
function setup(options = {}) {
  let fetches = 0; const calls = [];
  const e = eventEnvironment({ ...options, fetch: options.fetch || (() => { fetches++; return Promise.resolve(new Response('{}')); }),
    gmRequest: options.gmRequest || (details => { calls.push(details); return { abort() {} }; }) });
  const click = action => { const b = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(b, action); e.dispatch(b, 'click'); };
  const q = id => e.ui().querySelector(`#${id}`);
  click('expand'); click('sync');
  const submit = () => e.dispatch(q('webdav'), 'submit');
  const reply = (i, status = 404) => { const req = calls[i]; req.onload({ status, finalUrl: req.url, responseText: '', responseHeaders: '' }); };
  return { ...e, q, click, submit, calls, reply, fetches: () => fetches };
}
function hostHandlers(e, type) {
  const hits = [];
  for (const name of ['win', 'document']) for (const capture of [true, false]) e[name].addEventListener(type, event => {
    hits.push([name, capture, event.target]); event.preventDefault();
  }, capture);
  return hits;
}

for (const id of ['dav-url', 'dav-user', 'dav-pass', 'dav-mode', 'dav-interval', 'dav-approved']) {
  test(`v1110: ${id} isolates keyboard, clipboard, input and composition from later page capture/bubble`, () => {
    const e = setup(), input = e.q(id); input.focus();
    const types = ['keydown', 'keypress', 'keyup', 'paste', 'copy', 'cut', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend'];
    for (const type of types) {
      const hits = hostHandlers(e, type); let defaults = 0;
      const event = e.dispatch(input, type, { key: 'v', ctrlKey: true, clipboardData: { getData() { throw Error('must not read clipboard'); } } }, () => defaults++);
      assert.equal(event.defaultPrevented, false, type); assert.equal(defaults, 1, type); assert.deepEqual(hits, [], type);
    }
    assert.equal(e.fetches(), 0); assert.equal(e.calls.length, 0); assert.deepEqual(e.errors, []);
  });
}

test('v1110: synthetic default typing/paste stays in focused field, never redirects composer or persists the draft', () => {
  const e = setup(), field = e.q('dav-pass'), composer = e.document.createElement('textarea'); e.document.body.append(composer);
  field.focus(); composer.value = 'existing composer';
  e.document.addEventListener('paste', event => { composer.focus(); composer.value += 'WRONG'; event.preventDefault(); }, true);
  e.win.addEventListener('keydown', () => composer.focus(), true);
  e.dispatch(field, 'keydown', { key: 'x' }, () => e.ui().activeElement.value += 'x');
  e.dispatch(field, 'paste', {}, () => e.ui().activeElement.value += 'SYNTHETIC-PASSWORD');
  assert.equal(field.value, 'xSYNTHETIC-PASSWORD'); assert.equal(composer.value, 'existing composer');
  assert.equal(e.ui().activeElement, field); assert.doesNotMatch(JSON.stringify([...e.store]), /SYNTHETIC-PASSWORD/);
});

test('v1110: outside composer, another closed shadow, buttons and hidden file input keep page events', () => {
  const e = setup(); e.q('dav-pass').focus();
  const composer = e.document.createElement('textarea'); e.document.body.append(composer);
  const foreign = e.document.createElement('div'); e.document.body.append(foreign); const shadow = foreign.attachShadow({ mode: 'closed' });
  const otherInput = e.document.createElement('input'); shadow.append(otherInput);
  for (const field of [composer, otherInput, e.ui().querySelector('[data-action="home"]'), e.q('import')]) {
    if (field !== composer && field !== otherInput) field.focus(); // Outside routing must ignore even stale toolkit activeElement.
    const hits = hostHandlers(e, 'paste'); const event = e.dispatch(field, 'paste');
    assert.equal(hits.length, 4); assert.equal(event.defaultPrevented, true);
  }
});

test('v1110: guard cannot undo a window capture handler registered earlier; no false guarantee', () => {
  let earlier = 0; const e = setup({ beforeRun({ win }) { win.addEventListener('paste', () => earlier++, true); } });
  e.q('dav-user').focus(); const hits = hostHandlers(e, 'paste');
  e.dispatch(e.q('dav-user'), 'paste'); assert.equal(earlier, 1); assert.deepEqual(hits, []);
});

test('v1110: listener installs before body arrives and survives reattachment without multiplying', () => {
  const e = eventEnvironment({ bodyAbsent: true }); assert.equal(e.win.listeners.paste.length, 1);
  e.document.body = e.document.createElement('body'); e.document.documentElement.append(e.document.body); e.mutate();
  e.emit(e.ui(), 'click', { target: e.ui().querySelector('[data-action="expand"]') });
  e.emit(e.ui(), 'click', { target: e.ui().querySelector('[data-action="sync"]') });
  const input = e.ui().querySelector('#dav-pass'); input.focus(); const hits = hostHandlers(e, 'paste');
  e.host().remove(); e.mutate(); e.dispatch(input, 'paste'); assert.deepEqual(hits, []);
  assert.equal(e.win.listeners.paste.length, 3); // Guard plus two test page handlers.
});

test('v1110: IME Escape and legacy 229 do not close, normal Escape and panel hotkey still close', () => {
  for (const details of [{ key: 'Escape', isComposing: true }, { key: 'Escape', keyCode: 229 }, { altKey: true, shiftKey: true, code: 'KeyP', isComposing: true }]) {
    const e = setup(); const input = e.q('dav-pass'); input.focus(); input.value = 'DRAFT';
    const event = e.dispatch(input, 'keydown', details); assert.ok(e.q('webdav')); assert.equal(event.defaultPrevented, false);
  }
  for (const details of [{ key: 'Escape' }, { altKey: true, shiftKey: true, code: 'KeyP' }]) {
    const e = setup(); const input = e.q('dav-pass'); input.focus(); input.value = 'DRAFT';
    e.dispatch(input, 'keydown', details); assert.equal(e.q('webdav'), null); e.click('expand'); assert.equal(e.q('dav-pass').value, 'DRAFT');
    assert.equal(e.calls.length, 0); assert.doesNotMatch(JSON.stringify([...e.store]), /DRAFT/);
  }
});

test('v1110: outside click closes and preserves draft; ordinary typing never changes native submit/selection defaults', () => {
  const e = setup(), input = e.q('dav-user'); input.focus(); input.value = 'user draft';
  for (const details of [{ key: 'Enter' }, { key: 'Tab' }, { key: 'ArrowLeft', shiftKey: true }, { key: 'a', ctrlKey: true }, { key: 'z', metaKey: true }]) {
    assert.equal(e.dispatch(input, 'keydown', details).defaultPrevented, false);
  }
  e.dispatch(e.document.body, 'pointerdown'); assert.equal(e.q('webdav'), null); e.click('expand'); assert.equal(e.q('dav-user').value, 'user draft');
});

test('v1110: sync validation/status paints retain live form, focus, selection and draft without storage writes', () => {
  const e = setup(), form = e.q('webdav'), input = e.q('dav-pass'); input.value = 'SYNTHETIC-SECRET'; input.focus(); input.selectionStart = 3; input.selectionEnd = 8;
  e.q('dav-url').value = 'https://dav.example/'; e.q('dav-user').value = 'test'; e.submit();
  assert.equal(e.q('webdav'), form); assert.equal(e.q('dav-pass'), input); assert.equal(e.ui().activeElement, input);
  assert.equal(input.selectionStart, 3); assert.equal(input.selectionEnd, 8); assert.equal(input.value, 'SYNTHETIC-SECRET');
  assert.match(e.q('sync-status').textContent, /请先勾选/); assert.equal(e.calls.length, 0);
  e.intervals[0](); e.emit(e.win, 'focus'); assert.equal(e.q('webdav'), form); assert.equal(e.q('dav-pass'), input);
  assert.doesNotMatch(JSON.stringify([...e.store]), /SYNTHETIC-SECRET/);
});

test('v1110: async save preserves newer edits and form identity while saving only submitted approved config', async () => {
  const e = setup(); const form = e.q('webdav'); e.q('dav-url').value = 'https://dav.example'; e.q('dav-user').value = 'initial';
  e.q('dav-pass').value = 'SUBMITTED-SECRET'; e.q('dav-approved').checked = true; e.submit();
  assert.equal(e.q('webdav'), form); assert.match(e.q('sync-status').textContent, /正在处理/);
  const input = e.q('dav-pass'); input.value = 'NEW-UNSAVED-SECRET'; input.focus(); e.q('dav-user').value = 'new draft';
  e.reply(0, 201); await settle(); e.reply(1); await settle();
  assert.equal(e.q('webdav'), form); assert.equal(e.q('dav-pass'), input); assert.equal(e.ui().activeElement, input);
  assert.equal(input.value, 'NEW-UNSAVED-SECRET'); assert.equal(e.q('dav-user').value, 'new draft');
  assert.equal(e.store.get('gpc.v1.webdav').password, 'SUBMITTED-SECRET'); assert.equal(e.store.get('gpc.v1.webdav').username, 'initial');
  assert.doesNotMatch(JSON.stringify([...e.store]), /NEW-UNSAVED-SECRET/); assert.equal(e.fetches(), 0);
});

test('v1110: successful inactive submitted password clears without replacing controls; failure keeps draft', async () => {
  for (const status of [201, 409]) {
    const e = setup(); const input = e.q('dav-pass'); e.q('dav-url').value = 'https://dav.example'; input.value = 'SECRET'; e.q('dav-approved').checked = true;
    e.submit(); e.reply(0, status); await settle(); if (status === 201) { e.reply(1); await settle(); }
    assert.equal(e.q('dav-pass'), input); assert.equal(input.value, status === 201 ? '' : 'SECRET');
  }
});

test('v1110: manual sync and sync-off preserve other drafts; clear and explicit navigation reset them', async () => {
  const cfg = { version: 2, mode: 'file', url: 'https://dav.example/data.json', username: 'saved', password: 'saved', approved: true, enabled: true, tested: true, interval: 5 };
  const e = setup({ entries: [['gpc.v1.webdav', cfg]] }); const form = e.q('webdav'), field = e.q('dav-user'); field.value = 'draft'; field.focus();
  e.click('sync-now'); assert.equal(e.q('webdav'), form); e.reply(0, 500); await settle(); assert.equal(e.q('webdav'), form); assert.equal(field.value, 'draft');
  e.click('sync-off'); assert.equal(e.q('dav-interval').value, '0'); assert.equal(e.q('dav-user'), field); assert.equal(field.value, 'draft');
  e.click('sync'); assert.notEqual(e.q('webdav'), form); assert.equal(e.q('dav-user').value, 'saved');
  e.click('sync-clear'); assert.equal(e.q('dav-url').value, ''); assert.equal(e.q('dav-user').value, ''); assert.equal(e.q('dav-pass').value, '');
});

test('v1110: late save completion after navigation or close/reopen never steals focus or overwrites new form', async () => {
  for (const action of ['navigate', 'close']) {
    const e = setup(); e.q('dav-url').value = 'https://dav.example'; e.q('dav-pass').value = 'SUBMITTED'; e.q('dav-approved').checked = true; e.submit();
    if (action === 'navigate') { e.click('settings'); const input = e.q('cap'); input.value = '321'; input.focus(); }
    else { e.click('collapse'); e.click('expand'); e.q('dav-pass').value = 'REOPENED-DRAFT'; e.q('dav-pass').focus(); }
    const active = e.ui().activeElement; e.reply(0, 201); await settle(); e.reply(1); await settle();
    assert.equal(e.ui().activeElement, active); assert.equal(active.value, action === 'navigate' ? '321' : 'REOPENED-DRAFT');
  }
});

test('v1110: retained settings form does not refresh its stale-settings snapshot', async () => {
  const e = setup(); e.q('dav-url').value = 'https://dav.example'; e.q('dav-approved').checked = true; e.submit(); e.click('settings');
  const form = e.q('settings'), cap = e.q('cap'); cap.value = '777'; cap.focus();
  const fresh = { ...api.defaultSettings(), id: 'external', cap: 222, updated: Date.now() }; e.store.set('gpc.v1.settings.external', fresh);
  e.intervals[0](); e.reply(0, 409); await settle(); assert.equal(e.q('settings'), form); assert.equal(e.q('cap'), cap);
  e.dispatch(form, 'submit'); assert.match(e.ui().textContent, /另一个标签页修改了设置/); assert.equal([...e.store.values()].filter(v => v?.cap === 777).length, 0);
});

test('v1110: input fix adds no clipboard API, editing emulation, active ChatGPT request or new storage schema', () => {
  assert.doesNotMatch(source, /navigator\.clipboard|clipboardData\.(?:getData|setData)|execCommand\(|new (?:InputEvent|KeyboardEvent|ClipboardEvent)/);
  assert.match(source, /@name\s+ChatGPT Toolkit/); assert.match(source, /@version\s+1\.1\.15/); assert.equal(api.PREFIX, 'gpc.v1.');
});

test('v1110: Window-targeted synthetic events remain untouched without passing a non-Node to contains', () => {
  const e = setup(); e.q('dav-pass').focus(); const root = e.ui(), contains = root.contains;
  root.contains = function (node) { if (!node?.nodeType) throw TypeError('not a DOM Node'); return contains.call(this, node); };
  let hits = 0; e.win.addEventListener('keydown', () => hits++, true);
  assert.equal(e.dispatch(e.win, 'keydown', { key: 'a' }).defaultPrevented, false); assert.equal(hits, 1);
});


