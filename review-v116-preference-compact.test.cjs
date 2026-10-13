'use strict';
// Independent synthetic regressions. No live ChatGPT, account, or WebDAV calls.
// CSS assertions below inspect declarations; they do not prove rendered pixels.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const KEY = 'gpc.v1.ui.hoverMode';

function setup(options = {}) {
  const e = environment(options), d = e.document;
  function composer(text = 'Thinking', parent = d.body) {
    const scope = d.createElement('form'); parent.appendChild(scope);
    const model = d.createElement('button'); model.setAttribute('type', 'button');
    model.setAttribute('aria-label', '选择 ChatGPT 模型'); model.setAttribute('data-codex-intelligence-trigger', 'true');
    model.setAttribute('data-composer-navigation-target', 'reasoning');
    const hidden = d.createElement('span'); hidden.setAttribute('aria-hidden', 'true'); hidden.textContent = '思考强度Pro';
    const label = d.createElement('span'); label.textContent = text; model.append(hidden, label); scope.append(model);
    model._rect = { left: 820, right: 920, top: 650, bottom: 690, width: 100, height: 40 };
    const send = d.createElement('button'); send.setAttribute('type', 'submit'); send.setAttribute('aria-label', '发送');
    send.className = 'size-token-button-composer bg-composer-primary';
    const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = d.createElementNS('http://www.w3.org/2000/svg', 'path'); svg.append(path); send.append(svg); scope.append(send);
    send._rect = { left: 990, right: 1030, top: 650, bottom: 690, width: 40, height: 40 };
    return { scope, model, label, send, svg, path };
  }
  const current = composer(options.modelText ?? 'Thinking'); e.mutate();
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const show = (type = 'pointerenter', control = current.send, target = control) => {
    const delegated = ['pointerover', 'focusin'].includes(type);
    const event = e.emit(delegated ? d : control, type, { target, currentTarget: delegated ? d : control }); e.flush(150); return event;
  };
  const click = action => {
    const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, `UI action ${action}`);
    return e.emit(e.ui(), 'click', { target, composedPath: () => [target, e.ui(), e.host(), d.body, d] });
  };
  const settings = () => { if (!e.ui().querySelector('.panel')) click('expand'); click('settings'); };
  return { ...e, ...current, composer, hover, show, click, settings };
}
const all = (options = {}) => setup({ ...options, entries: [[KEY, 'all'], ...(options.entries || [])] });
const ledgerOnly = store => JSON.stringify([...store].filter(([key]) => key !== KEY));

test('v116: old v1 data defaults to Pro-only without rewriting the existing ledger', () => {
  const original = { ...api.defaultSettings(), id: 'existing', cap: 271, updated: 100 };
  const store = new Map([['gpc.v1.settings.existing', original]]), before = JSON.stringify([...store]);
  const e = setup({ store }); e.show(); assert.equal(e.hover().hidden, true);
  e.settings(); assert.equal(e.ui().querySelector('#hover-pro').getAttribute('aria-pressed'), 'true');
  assert.equal(e.ui().querySelector('#hover-all').getAttribute('aria-pressed'), 'false');
  assert.equal(JSON.stringify([...store]), before); assert.deepEqual(e.errors, []);
});

test('v116: malformed local hover preferences fail closed to Pro-only', () => {
  for (const value of [null, true, 1, '', 'ALL', 'always', ['all'], { hoverMode: 'all' }]) {
    const e = setup({ entries: [[KEY, value]] }); e.show(); assert.equal(e.hover().hidden, true, JSON.stringify(value));
    e.settings(); assert.equal(e.ui().querySelector('#hover-pro').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(e.errors, []);
  }
});

test('v116: all-model preference saves immediately and never writes accounting settings or backups', () => {
  const e = setup(); e.settings(); const before = ledgerOnly(e.store);
  const toggle = e.ui().querySelector('#hover-all'); assert.equal(toggle.closest('form'), null);
  e.click('hover-all'); assert.equal(e.store.get(KEY), 'all'); assert.equal(ledgerOnly(e.store), before);
  assert.equal(e.ui().querySelector('#hover-all').getAttribute('aria-pressed'), 'true');
  e.show(); assert.equal(e.hover().hidden, false); assert.deepEqual(e.errors, []);
});

test('v116: all-model mode covers every direct and delegated pointer or keyboard entry', () => {
  for (const type of ['pointerenter', 'mouseenter', 'focus', 'pointerover', 'focusin']) {
    const e = all(); const event = e.show(type, e.send, ['pointerover', 'focusin'].includes(type) ? e.path : e.send);
    assert.equal(e.hover().hidden, false, type); assert.equal(event.defaultPrevented, undefined); assert.equal(event.propagationStopped, undefined);
    assert.deepEqual(e.errors, []);
  }
});

test('v116: Pro-only mode consistently gates every pointer and keyboard entry', () => {
  for (const type of ['pointerenter', 'mouseenter', 'focus', 'pointerover', 'focusin']) {
    const e = setup(); e.show(type, e.send, e.path); assert.equal(e.hover().hidden, true, type);
    e.label.textContent = 'Pro'; e.mutate(); e.show(type, e.send, e.path); assert.equal(e.hover().hidden, false, type);
  }
});

test('v116: switching an open Thinking hover to Pro-only hides it immediately', () => {
  const e = all(); e.settings(); e.show(); assert.equal(e.hover().hidden, false);
  e.click('hover-pro'); assert.equal(e.hover().hidden, true); assert.equal(e.store.get(KEY), 'pro');
  e.click('hover-all'); e.show(); assert.equal(e.hover().hidden, false); assert.deepEqual(e.errors, []);
});

test('v116: all-model hover survives model changes, missing selectors and periodic revalidation', () => {
  const e = all({ modelText: 'Pro' }); e.show();
  for (const text of ['Thinking', 'Auto', 'Instant', 'Unknown', '']) {
    e.label.textContent = text; e.mutate(); e.flush(150); assert.equal(e.hover().hidden, false, text);
  }
  e.model.remove(); e.mutate(); assert.equal(e.hover().hidden, false);
  // Invoke interval callbacks without advancing a queued pointer-leave timer.
  for (const interval of e.intervals) interval(); e.flush(150);
  assert.equal(e.hover().hidden, false); assert.deepEqual(e.errors, []);
});

test('v116: all-model send needs no current selector or editor ancestry', () => {
  const e = all(); e.document.body.append(e.send); e.scope.remove(); e.mutate(); e.show();
  assert.equal(e.hover().hidden, false); assert.equal(e.send.closest('form'), null); assert.deepEqual(e.errors, []);
});

test('v116: all-model preference still excludes stop, voice and hidden controls', () => {
  for (const change of [
    e => e.send.setAttribute('aria-label', 'Stop generating'), e => e.send.setAttribute('aria-label', '开始语音'),
    e => e.send.setAttribute('aria-hidden', 'true'), e => e.send.setAttribute('hidden', ''),
  ]) {
    const e = all(); e.show(); assert.equal(e.hover().hidden, false); change(e); e.mutate(); e.show(); assert.equal(e.hover().hidden, true);
  }
});

test('v116: all-model preference does not authorize header or unrelated form controls', () => {
  const e = all();
  const header = e.document.createElement('header'); e.document.body.append(header); const other = e.composer('Pro', header);
  e.mutate(); e.show('pointerenter', other.send); assert.equal(e.hover().hidden, true);
  const button = e.document.createElement('button'); button.setAttribute('type', 'submit'); button.setAttribute('aria-label', '发送');
  const form = e.document.createElement('form'); form.append(button); e.document.body.append(form); e.mutate();
  e.show('pointerenter', button); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
});

test('v116: all-model SPA replacement closes the detached card and binds one listener to its successor', () => {
  const e = all(); e.show(); e.send.remove(); const next = e.composer('Auto'); e.mutate(); assert.equal(e.hover().hidden, true);
  e.show('pointerenter', next.send); assert.equal(e.hover().hidden, false); e.mutate(); e.mutate();
  assert.equal(next.send.listeners.pointerenter.length, 1); assert.deepEqual(e.errors, []);
});

test('v116: saved local preference survives reload and another local tab sees it on refresh', () => {
  const shared = new Map(), first = setup({ store: shared }), second = setup({ store: shared });
  first.settings(); first.click('hover-all');
  const reloaded = setup({ store: shared }); reloaded.show(); assert.equal(reloaded.hover().hidden, false);
  second.emit(second.win, 'focus'); second.show(); assert.equal(second.hover().hidden, false);
  first.click('hover-pro'); second.emit(second.win, 'focus'); assert.equal(second.hover().hidden, true);
  assert.deepEqual(first.errors, []); assert.deepEqual(second.errors, []);
});

test('v116: toggling hover mode preserves unsaved accounting fields without submitting them', () => {
  const e = setup(); e.settings();
  e.ui().querySelector('#cap').value = '731'; e.ui().querySelector('#calibrate').value = '17'; e.ui().querySelector('#mode').value = 'rolling';
  const before = ledgerOnly(e.store); e.click('hover-all');
  assert.equal(e.ui().querySelector('#cap').value, '731'); assert.equal(e.ui().querySelector('#calibrate').value, '17');
  assert.equal(e.ui().querySelector('#mode').value, 'rolling'); assert.equal(ledgerOnly(e.store), before);
  assert.equal(e.ui().querySelector('#hover-pro').getAttribute('type'), 'button'); assert.equal(e.ui().querySelector('#hover-all').getAttribute('type'), 'button');
});

test('v116: outside close preserves draft and saved preference without applying calibration', () => {
  const e = setup(); e.settings(); e.ui().querySelector('#cap').value = '731'; e.ui().querySelector('#calibrate').value = '17';
  e.click('hover-all'); const before = JSON.stringify([...e.store]);
  const target = e.document.createElement('input'); e.document.body.append(target);
  const event = e.emit(e.document, 'pointerdown', { target, composedPath: () => [target, e.document.body, e.document] });
  assert.equal(e.ui().querySelector('.panel'), null); assert.equal(event.defaultPrevented, undefined);
  e.click('expand'); assert.equal(e.ui().querySelector('#cap').value, '731'); assert.equal(e.ui().querySelector('#calibrate').value, '17');
  assert.equal(e.ui().querySelector('#hover-all').getAttribute('aria-pressed'), 'true'); assert.equal(JSON.stringify([...e.store]), before);
  assert.deepEqual(e.errors, []);
});

test('v116: preference changes never reset the accounting draft conflict guard', () => {
  const e = setup(); e.settings(); e.ui().querySelector('#cap').value = '731';
  const old = [...e.store.values()].find(value => value?.cap);
  e.store.set('gpc.v1.settings.newer-tab', { ...old, id: 'newer-tab', updated: Date.now() + 50, cap: 892 });
  e.click('hover-all'); e.emit(e.ui(), 'submit', { target: e.ui().querySelector('#settings') });
  assert.match(e.ui().textContent, /另一个标签页修改了设置/);
  assert.equal([...e.store.values()].some(value => value?.cap === 731), false);
  assert.equal(e.store.get(KEY), 'all'); assert.deepEqual(e.errors, []);
});

test('v116: changing to Pro-only during the delayed show cannot reopen Thinking hover', () => {
  const e = all(); e.settings();
  e.emit(e.send, 'pointerenter', { target: e.send, currentTarget: e.send });
  e.click('hover-pro'); e.flush(150); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
});

test('v116: all-model mode retains Escape dismissal without canceling native Send interaction', () => {
  const e = all(); e.click('expand'); e.show();
  const before = e.send.outerHTML, native = e.emit(e.document, 'click', { target: e.path });
  assert.equal(native.defaultPrevented, undefined); assert.equal(native.propagationStopped, undefined); assert.equal(e.send.outerHTML, before);
  e.show(); e.emit(e.document, 'keydown', { key: 'Escape' }); e.flush(150);
  assert.equal(e.ui().querySelector('.panel'), null); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
});

test('v116: absent GM storage permits only a temporary preference and keeps the permission warning', () => {
  const e = setup({ noGM: true }); e.settings(); e.click('hover-all'); e.show();
  assert.equal(e.hover().hidden, false); assert.equal(e.store.has(KEY), false);
  assert.match(e.ui().textContent, /存储权限未就绪|当前仅临时显示/);
  const reloaded = setup({ noGM: true }); reloaded.show(); assert.equal(reloaded.hover().hidden, true);
  assert.deepEqual(e.errors, []);
});

test('v116: preference write failure leaves mode and draft intact and reports failure', () => {
  const e = setup({ beforeRun({ context }) { const write = context.GM_setValue; context.GM_setValue = (key, value) => { if (key === KEY) throw Error('Synthetic preference write denied'); write(key, value); }; } });
  e.settings(); e.ui().querySelector('#cap').value = '731'; e.click('hover-all');
  assert.equal(e.store.has(KEY), false); assert.equal(e.ui().querySelector('#cap').value, '731');
  assert.equal(e.ui().querySelector('#hover-pro').getAttribute('aria-pressed'), 'true');
  assert.match(e.ui().querySelector('#hover-status').textContent, /失败|未保存|异常|无法/);
  e.show(); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
});

test('v116: display preference is excluded from exported files, backup snapshots and imported settings', async () => {
  const blobs = [], e = all({ beforeRun({ context }) { context.URL = class extends URL { static createObjectURL(blob) { blobs.push(blob); return 'blob:synthetic-local-export'; } static revokeObjectURL() {} }; } });
  e.click('expand'); e.click('export'); assert.equal(blobs.length, 1);
  const text = await blobs[0].text(); assert.doesNotMatch(text, /hoverMode|hover-pro|hover-all|gpc\.v1\.ui/);
  e.settings(); e.emit(e.ui(), 'submit', { target: e.ui().querySelector('#settings') });
  for (const [key, value] of e.store) if (key.startsWith('gpc.v1.backup.')) assert.doesNotMatch(JSON.stringify(value), /hoverMode|hover-pro|hover-all|gpc\.v1\.ui/);
  const data = JSON.parse(text); data.hoverMode = 'pro'; data.settings.hoverMode = 'pro'; data.ui = { hoverMode: 'pro' };
  const input = e.ui().querySelector('#import'); input.files = [{ size: 500, text: async () => JSON.stringify(data) }];
  e.emit(e.ui(), 'change', { target: input }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(e.store.get(KEY), 'all'); assert.deepEqual(e.errors, []);
});

test('v116: every preference and compact-UI interaction remains network passive', () => {
  let network = 0;
  const e = setup({ fetch() { network++; return Promise.resolve(new Response('{}')); }, gmRequest() { network++; throw Error('Unexpected active request'); } });
  e.settings(); e.click('hover-all'); e.show(); e.click('hover-pro'); e.click('home'); e.click('plus'); e.click('minus');
  e.emit(e.document, 'keydown', { key: 'Escape' }); e.tick(); e.emit(e.win, 'focus'); e.mutate();
  assert.equal(network, 0); assert.deepEqual(e.errors, []);
});

test('v116: all-model visibility never counts actual Thinking requests as Pro', async () => {
  let calls = 0;
  const e = all({ fetch() { calls++; return Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })); } });
  e.show(); assert.equal(e.hover().hidden, false);
  for (const [id, model] of [['synthetic-thinking-v116', 'gpt-5-thinking'], ['synthetic-pro-v116', 'gpt-5-pro']]) {
    await e.win.fetch('/backend-api/conversation', { method: 'POST', body: JSON.stringify({ action: 'next', model, messages: [{ id, author: { role: 'user' } }] }) });
  }
  for (let i = 0; i < 100; i++) {
    if ([...e.store.values()].filter(value => value?.observation === 'done').length === 2) break;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  const events = [...e.store.values()].filter(value => value?.v === 1 && value.state);
  const settings = [...e.store.values()].find(value => value?.v === 1 && value.cap);
  assert.equal(api.summarize(events, settings).pro, 1); assert.equal(calls, 2); assert.deepEqual(e.errors, []);
});

test('v116: compact overview keeps calibration actions operational and accessible', () => {
  const e = all(); e.click('expand');
  const css = e.ui().querySelector('style').textContent;
  assert.match(css, /\.panel\{width:min\(310px,calc\(100vw - 24px\)\);max-height:[^}]*overflow:auto/);
  assert.match(css, /\.panel,\.launcher,\.hover-card\{font:12px\/1\.5/);
  assert.match(css, /\.calibration\{display:grid;grid-template-columns:56px 56px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:300px\)\{\.calibration\{grid-template-columns:1fr 1fr\}\.calibration \.initial\{grid-column:1\/-1;white-space:normal\}/);
  const group = e.ui().querySelector('.calibration'); assert.equal(group.getAttribute('role'), 'group'); assert.equal(group.getAttribute('aria-label'), '手动校准');
  assert.equal(e.ui().querySelector('[data-action="minus"]').closest('.calibration'), group);
  assert.ok(e.ui().querySelector('.secondary'));
  for (const action of ['plus', 'minus', 'settings', 'export', 'import', 'backup']) {
    const button = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(button, action);
    assert.equal(button.getAttribute('type'), 'button'); assert.ok(button.textContent.trim() || button.getAttribute('aria-label'), action);
  }
  e.click('plus'); e.click('minus');
  const manual = [...e.store.values()].filter(value => value?.state === 'manual');
  assert.equal(manual.length, 2); assert.equal(manual.reduce((n, value) => n + value.delta, 0), 0);
  assert.equal(e.document.getElementById('chatgpt-pro-local-increment'), null);
  assert.ok(e.ui().querySelector('.panel')); assert.deepEqual(e.errors, []);
});
