'use strict';
// Production hover regressions against the unchanged userscript. The extracted
// functions are evaluated verbatim, with no source replacements or old-failure
// expectations. Synthetic DOM coverage is not live browser/extension coverage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { eventEnvironment } = require('./audit-event-fixture.cjs');
const source = fs.readFileSync(process.env.AUDIT_SOURCE || path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
const start = source.indexOf('    const editorSelector =');
const end = source.indexOf('    function showIncrement(key)', start);
assert.ok(start > 0 && end > start);
const matcher = source.slice(start, end);
const MODE_KEY = 'gpc.v1.ui.hoverMode';

function setup(options = {}) {
  const effects = { clicks: 0, requests: 0, microphone: 0 };
  const e = eventEnvironment({ entries: [[MODE_KEY, options.mode || 'pro']],
    fetch() { effects.requests++; throw Error('Unexpected hover fetch'); },
    gmRequest() { effects.requests++; throw Error('Unexpected hover GM request'); },
    beforeRun({ win, Node }) {
      Node.prototype.click = () => { effects.clicks++; };
      win.navigator = { mediaDevices: { getUserMedia() { effects.microphone++; throw Error('Unexpected microphone access'); } } };
    }
  });
  const d = e.document;
  const form = d.createElement('form'); form.setAttribute('data-type', 'unified-composer'); d.body.append(form);
  const model = d.createElement('button'); model.setAttribute('data-codex-intelligence-trigger', 'true');
  model.textContent = options.modelText ?? 'Pro'; form.append(model);
  model._rect = { left: 820, right: 920, top: 650, bottom: 690, width: 100, height: 40 };
  const voice = d.createElement('button'); form.append(voice);
  voice._rect = { left: 990, right: 1030, top: 650, bottom: 690, width: 40, height: 40 };
  if (options.legacy) {
    voice.setAttribute('type', 'button'); voice.setAttribute('aria-label', '开始语音');
    voice.className = 'size-token-button-composer bg-composer-primary';
  } else {
    // The current public button has this exact identity/label, no type="button"
    // and no old size-token-button-composer class. Cosmetic classes are irrelevant.
    voice.setAttribute('data-testid', 'composer-speech-button');
    voice.setAttribute('aria-label', 'Start Voice');
    voice.className = 'relative flex h-9 items-center justify-center rounded-full w-9 composer-submit-button-color';
  }
  const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true');
  const use = d.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '/cdn/assets/icons.svg#voice-regular-20'); svg.append(use); voice.append(svg);
  const diagnostics = { state: {} };
  const api = vm.runInNewContext(`(() => { let hoverMode = ${JSON.stringify(options.mode || 'pro')}; const host = null, hoverHost = null, incrementHost = null; ${matcher}; return { nativeTrigger, visibleControl, composerFor, selectionScope, selectedPro, voiceStartControl, inspect: diagnostics.inspectHover }; })()`, { document: d, win: e.win, diagnostics });
  e.mutate();
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const report = () => { const menu = e.menus.find(item => item.label === '诊断 Pro 计数器'); assert.ok(menu); menu.fn(); return e.alerts.at(-1); };
  return { ...e, ...api, diagnostics, form, model, voice, svg, use, effects, hover, report };
}

const quiet = e => {
  assert.deepEqual(e.effects, { clicks: 0, requests: 0, microphone: 0 });
  assert.deepEqual(e.errors, []);
};
const audit = (e, target) => { const detail = {}; const anchor = e.nativeTrigger(target, false, detail); return { anchor, detail }; };

test('current hover: exact public speech ID and start-voice label work without old type/class', () => {
  const e = setup();
  assert.equal(e.voice.hasAttribute('type'), false);
  assert.equal(e.voice.classList.contains('size-token-button-composer'), false);
  assert.equal(e.voiceStartControl(e.voice), true);
  for (const target of [e.voice, e.svg, e.use]) {
    assert.equal(e.nativeTrigger(target), e.voice);
    e.dispatch(target, 'pointerover'); e.flush(150); assert.equal(e.hover().hidden, false);
    e.dispatch(e.document.body, 'keydown', { key: 'Escape' });
  }
  quiet(e);
});

test('current hover: only the exact speech ID and exact start-conversation label get the fallback', () => {
  for (const testId of ['composer-speech-button-container', 'composer-speech-button-extra', 'speech-button', 'composer-dictation-button', '']) {
    const e = setup({ mode: 'all' }); e.voice.setAttribute('data-testid', testId);
    assert.equal(e.voiceStartControl(e.voice), false, testId); assert.equal(e.nativeTrigger(e.voice), null, testId); quiet(e);
  }
  for (const label of ['Start Voice', 'Start voice mode', '开始语音', '開始語音']) {
    const e = setup(); e.voice.setAttribute('aria-label', label); assert.equal(e.nativeTrigger(e.voice), e.voice, label); quiet(e);
  }
});

test('current hover: public and legacy anchors retain Pro-only/all-model gates without an editor', () => {
  for (const legacy of [false, true]) for (const mode of ['pro', 'all']) for (const modelText of ['Pro', 'Thinking', 'Unknown', '']) {
    const e = setup({ legacy, mode, modelText });
    assert.equal(e.document.querySelector('#prompt-textarea'), null);
    assert.equal(e.nativeTrigger(e.voice), mode === 'all' || modelText === 'Pro' ? e.voice : null);
    e.model.remove(); assert.equal(e.nativeTrigger(e.voice), mode === 'all' ? e.voice : null); quiet(e);
  }
});

test('current hover: pointer/mouse/focus entry is passive for the current public button', () => {
  for (const type of ['pointerenter', 'mouseenter', 'focus', 'pointerover', 'focusin']) {
    const e = setup(), before = e.voice.outerHTML, storage = JSON.stringify([...e.store]);
    const event = e.dispatch(e.voice, type, { bubbles: ['pointerover', 'focusin'].includes(type) }); e.flush(150);
    assert.equal(e.hover().hidden, false, type); assert.equal(event.defaultPrevented, false);
    assert.equal(e.voice.outerHTML, before); assert.equal(JSON.stringify([...e.store]), storage); quiet(e);
  }
});

test('current hover: dictation, stop, microphone and conflicting labels remain excluded', () => {
  for (const label of ['Dictate', 'Voice mode', 'Start dictation', 'Stop voice', 'Microphone', 'Pause audio', 'Start Voice dictation', 'Start recording', '开始听写', '停止语音', '使用麦克风']) {
    const e = setup({ mode: 'all' }); e.voice.setAttribute('aria-label', label);
    assert.equal(e.nativeTrigger(e.voice), null, label); quiet(e);
  }
  for (const title of ['Stop generating', 'Dictation', 'Microphone', 'Speech recognition', 'Pause audio']) {
    const e = setup({ mode: 'all' }); e.voice.setAttribute('title', title);
    assert.equal(audit(e, e.voice).detail.match, 'excluded-control', title); quiet(e);
  }
  const e = setup({ mode: 'all' }); e.voice.append('Stop generating');
  assert.equal(e.nativeTrigger(e.voice), null); quiet(e);
});

test('current hover: hidden, offscreen and excluded-region anchors stay rejected', () => {
  const changes = [
    e => e.voice.setAttribute('hidden', ''), e => e.voice.setAttribute('aria-hidden', 'true'),
    e => e.form.setAttribute('inert', ''), e => e.form.setAttribute('aria-hidden', 'true'),
    e => { e.voice._rect = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }; },
    e => { e.voice._rect.top = e.win.innerHeight + 1; },
    e => { e.win.getComputedStyle = node => ({ display: node === e.form ? 'none' : 'block', visibility: 'visible' }); },
  ];
  for (const change of changes) {
    const e = setup({ mode: 'all' }); change(e);
    assert.equal(audit(e, e.voice).detail.match, 'not-visible'); assert.equal(e.nativeTrigger(e.voice), null); quiet(e);
  }
  for (const [tag, role] of [['header'], ['nav'], ['aside'], ['div', 'dialog'], ['div', 'menu'], ['div', 'listbox']]) {
    const e = setup({ mode: 'all' }), region = e.document.createElement(tag);
    if (role) region.setAttribute('role', role); e.document.body.append(region); region.append(e.form);
    for (const target of [e.voice, e.model]) {
      const { anchor, detail } = audit(e, target); assert.equal(anchor, null);
      assert.deepEqual(detail, { match: 'outside-composer', scope: 'excluded-region' });
    }
    quiet(e);
  }
});

test('current hover: explicit model markers no longer depend on a visible editor', () => {
  for (const mode of ['pro', 'all']) for (const modelText of ['Pro', 'Thinking']) {
    const e = setup({ mode, modelText }), allowed = mode === 'all' || modelText === 'Pro';
    assert.equal(e.composerFor(e.model), null); assert.equal(e.selectionScope(e.model), e.form);
    const { anchor, detail } = audit(e, e.model);
    assert.equal(anchor, allowed ? e.model : null);
    assert.equal(detail.match, allowed ? 'model-marker' : 'selected-model-not-pro-or-unknown');
    assert.equal(detail.scope, 'explicit-marker-composer');
    e.dispatch(e.model, 'pointerenter', { bubbles: false }); e.flush(150); assert.equal(e.hover().hidden, !allowed);
    quiet(e);
  }
});

test('current hover: editor-independent model fallback does not accept detached/page-wide/plain labels', () => {
  const e = setup(); e.document.body.append(e.model); assert.equal(e.nativeTrigger(e.model), null);
  e.form.append(e.model); e.model.removeAttribute('data-codex-intelligence-trigger');
  assert.equal(e.nativeTrigger(e.model), null, 'plain Pro text without an editor or explicit marker');
  e.model.setAttribute('data-codex-intelligence-trigger', 'true'); e.model.setAttribute('hidden', '');
  assert.equal(e.nativeTrigger(e.model), null); quiet(e);
});

test('current hover: a Pro marker in a second form cannot unlock the first form voice or its own empty form', () => {
  for (const mode of ['pro', 'all']) {
    const e = setup({ mode }), second = e.document.createElement('form');
    e.document.body.append(second); second.append(e.model);
    assert.equal(e.nativeTrigger(e.voice), mode === 'all' ? e.voice : null, `${mode}: separate form must not supply Pro`);
    assert.equal(e.nativeTrigger(e.model), null, `${mode}: a marker without its own native action is insufficient`);
    quiet(e);
  }
});

test('current hover: no-editor diagnostics report accepted voice/model separately from zero sends', () => {
  const e = setup(); e.inspect();
  assert.equal(e.diagnostics.state.hoverEditors, 0); assert.equal(e.diagnostics.state.hoverSends, 0);
  assert.equal(e.diagnostics.state.hoverMarkers, 1); assert.equal(e.diagnostics.state.hoverRawMarkers, 1);
  assert.equal(e.diagnostics.state.hoverRawVoices, 1);
  assert.equal(e.diagnostics.state.hoverVoiceCheck, 'voice-start-control/direct-voice-start-anchor');
  assert.equal(e.diagnostics.state.hoverModelCheck, 'model-marker/explicit-marker-composer'); quiet(e);
});

test('current hover: candidate rejection audits preserve the latest event match/scope', () => {
  const cases = [
    [e => e.voice.setAttribute('hidden', ''), 'not-visible/unchecked'],
    [e => e.voice.setAttribute('title', 'Stop generating'), 'excluded-control/unchecked'],
    [e => { e.model.textContent = 'Thinking'; }, 'selected-model-not-pro-or-unknown/direct-voice-start-anchor'],
    [e => { const header = e.document.createElement('header'); e.document.body.append(header); header.append(e.form); }, 'outside-composer/excluded-region'],
  ];
  for (const [change, expected] of cases) {
    const e = setup(); change(e);
    Object.assign(e.diagnostics.state, { hoverEvent: 'pointerover', hoverMatch: 'no-control', hoverScope: 'unchecked' });
    e.inspect(); assert.equal(e.diagnostics.state.hoverVoiceCheck, expected);
    assert.equal(e.diagnostics.state.hoverEvent, 'pointerover'); assert.equal(e.diagnostics.state.hoverMatch, 'no-control');
    assert.equal(e.diagnostics.state.hoverScope, 'unchecked'); quiet(e);
  }
});

test('current hover: audits cap candidate details and omit absent candidate classes', () => {
  const e = setup({ mode: 'all' });
  for (let i = 0; i < 4; i++) {
    const voice = e.document.createElement('button'); voice.setAttribute('data-testid', 'composer-speech-button'); voice.setAttribute('aria-label', 'Start Voice'); e.form.append(voice);
    const model = e.document.createElement('button'); model.setAttribute('data-codex-intelligence-trigger', 'true'); model.textContent = 'Pro'; e.form.append(model);
  }
  e.inspect(); assert.equal(e.diagnostics.state.hoverRawVoices, 5); assert.equal(e.diagnostics.state.hoverRawMarkers, 5);
  assert.equal(e.diagnostics.state.hoverVoiceCheck.split(', ').length, 3); assert.equal(e.diagnostics.state.hoverModelCheck.split(', ').length, 3);
  e.form.remove(); e.inspect(); assert.equal(e.diagnostics.state.hoverVoiceCheck, 'none'); assert.equal(e.diagnostics.state.hoverModelCheck, 'none'); quiet(e);
});

test('current hover: actual menu report contains only fixed reasons and preserves native/persistent/UI state', () => {
  const e = setup({ mode: 'all', modelText: 'SYNTHETIC_PRIVATE_MODEL' });
  e.voice.setAttribute('title', 'SYNTHETIC_PRIVATE_VOICE'); e.voice.setAttribute('data-private', 'https://private.invalid/credential');
  const chat = e.document.createElement('textarea'); chat.setAttribute('hidden', ''); chat.textContent = 'SYNTHETIC_PRIVATE_CHAT'; e.form.append(chat);
  e.dispatch(e.use, 'pointerover'); e.flush(150); assert.equal(e.hover().hidden, false);
  const outside = e.document.createElement('div'); outside.textContent = 'Other page area'; e.document.body.append(outside);
  e.dispatch(outside, 'pointerover');
  const native = e.form.outerHTML, stored = JSON.stringify([...e.store]), focus = e.document.activeElement;
  const card = e.hover().shadow.innerHTML, shown = e.hover().hidden;
  const timerKeys = [...e.timeouts.keys()], ui = e.ui().innerHTML;
  const report = e.report();
  assert.match(report, /语音锚点检查: voice-start-control\/direct-voice-start-anchor/);
  assert.match(report, /模型锚点检查: model-marker\/explicit-marker-composer/);
  assert.match(report, /最近悬停事件: pointerover/); assert.match(report, /最近控件匹配: no-control/); assert.match(report, /最近输入框范围: unchecked/);
  assert.doesNotMatch(report, /SYNTHETIC_PRIVATE|private\.invalid|credential|<button|data-testid|composer-speech-button/);
  assert.equal(e.form.outerHTML, native); assert.equal(JSON.stringify([...e.store]), stored);
  assert.equal(e.document.activeElement, focus); assert.equal(e.hover().hidden, shown); assert.equal(e.hover().shadow.innerHTML, card);
  assert.equal(e.ui().innerHTML, ui); assert.deepEqual([...e.timeouts.keys()], timerKeys); quiet(e);
});
