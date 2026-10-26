'use strict';
// Synthetic DOM/event regressions. These do not claim live ChatGPT, browser
// layout, microphone permission or Tampermonkey extension-injection coverage.
const test = require('node:test');
const assert = require('node:assert/strict');
const { eventEnvironment } = require('../fixtures/audit-event-fixture.cjs');
const HOVER_MODE = 'gpc.v1.ui.hoverMode';
const REPORTED_VOICE_START_DOM = '<button type="button" class="cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-composer-primary p-0.5 focus-visible:outline-background-composer-primary relative after:absolute after:inset-0 after:-start-1" aria-label="开始语音" data-state="closed"><svg aria-hidden="true" class="Icon-X4VkKC icon-primary-action text-composer-primary" focusable="false" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg"><use href="/cdn/assets/icons-e77f79274ed3cb3b.svg#voice-regular-20" fill="currentColor"></use></svg></button>';

function setup(options = {}) {
  let nativeClicks = 0, networkCalls = 0;
  const e = eventEnvironment({ entries: options.mode ? [[HOVER_MODE, options.mode]] : [],
    fetch() { networkCalls++; return Promise.resolve(new Response('{}')); },
    gmRequest() { networkCalls++; throw Error('Unexpected voice-hover request'); },
  });
  const d = e.document, scope = d.createElement(options.plainScope ? 'div' : 'form');
  d.body.append(scope);
  const editor = d.createElement('textarea'); editor.id = 'prompt-textarea';
  if (!options.noEditor) scope.append(editor);
  const model = d.createElement('button'); model.setAttribute('data-codex-intelligence-trigger', 'true');
  model.textContent = options.modelText ?? 'Pro'; scope.append(model);
  model._rect = { left: 820, right: 920, top: 650, bottom: 690, width: 100, height: 40 };
  function voice(parent = scope) {
    const button = d.createElement('button');
    // Preserve every attribute of the reported native DOM, including the
    // aria-hidden SVG and nested <use> target reached by real pointer events.
    for (const [name, value] of Object.entries({ type: 'button', class: 'cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-composer-primary p-0.5 focus-visible:outline-background-composer-primary relative after:absolute after:inset-0 after:-start-1', 'aria-label': '开始语音', 'data-state': 'closed' })) button.setAttribute(name, value);
    const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ 'aria-hidden': 'true', class: 'Icon-X4VkKC icon-primary-action text-composer-primary', focusable: 'false', height: '20', viewBox: '0 0 20 20', width: '20', xmlns: 'http://www.w3.org/2000/svg' })) svg.setAttribute(name, value);
    const use = d.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '/cdn/assets/icons-e77f79274ed3cb3b.svg#voice-regular-20'); use.setAttribute('fill', 'currentColor');
    svg.append(use); button.append(svg); parent.append(button);
    button._rect = { left: 990, right: 1030, top: 650, bottom: 690, width: 40, height: 40 };
    button.click = () => { nativeClicks++; };
    return { button, svg, use };
  }
  const current = voice(); e.mutate();
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const show = (type = 'pointerenter', target = current.button) => {
    const event = e.dispatch(target, type, { bubbles: ['pointerover', 'focusin'].includes(type) });
    e.flush(150); return event;
  };
  const dismiss = () => { e.dispatch(d.body, 'keydown', { key: 'Escape' }); e.flush(150); };
  const click = action => {
    const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action);
    e.dispatch(target, 'click');
  };
  return { ...e, ...current, scope, editor, model, voice, hover, show, dismiss, click,
    nativeClicks: () => nativeClicks, networkCalls: () => networkCalls };
}

test('voice-start: the exact empty-composer button and nested SVG/use show the existing usage card', () => {
  const e = setup(); assert.equal(e.button.outerHTML, REPORTED_VOICE_START_DOM);
  assert.equal(e.editor.value, '');
  for (const target of [e.button, e.svg, e.use]) {
    e.show('pointerover', target); assert.equal(e.hover().hidden, false);
    assert.match(e.hover().shadow.textContent, /次剩余/); e.dismiss();
  }
  assert.deepEqual(e.errors, []);
});

test('voice-start: every direct pointer/mouse/focus and delegated keyboard entry remains passive', () => {
  for (const type of ['pointerenter', 'mouseenter', 'focus', 'focusin']) {
    const e = setup(), before = e.button.outerHTML, storage = JSON.stringify([...e.store]);
    const event = e.show(type);
    assert.equal(e.hover().hidden, false, type); assert.equal(event.defaultPrevented, false);
    assert.equal(e.button.outerHTML, before); assert.equal(JSON.stringify([...e.store]), storage);
    assert.equal(e.nativeClicks(), 0); assert.equal(e.networkCalls(), 0);
    assert.deepEqual(Object.keys(e.button.listeners).sort(), ['blur', 'focus', 'mouseenter', 'mouseleave', 'pointerenter', 'pointerleave']);
    assert.deepEqual(e.errors, []);
  }
});

test('voice-start: localized start-conversation labels are recognized without broad voice matching', () => {
  for (const label of ['开始语音', '開始語音', '开始语音对话', '開始語音對話', 'Start voice', 'Start voice mode', 'Start voice chat', 'Start voice conversation']) {
    const e = setup(); e.button.setAttribute('aria-label', label); e.show();
    assert.equal(e.hover().hidden, false, label); assert.deepEqual(e.errors, []);
  }
});

test('voice-start: Pro-only still requires this composer to have one visible selected Pro model', () => {
  for (const type of ['pointerenter', 'mouseenter', 'focus', 'pointerover', 'focusin']) {
    for (const label of ['Thinking', 'Instant', 'Auto', 'Unknown', '']) {
      const e = setup({ modelText: label }); e.show(type); assert.equal(e.hover().hidden, true, `${type}: ${label}`);
      e.model.textContent = 'Pro'; e.mutate(); e.show(type); assert.equal(e.hover().hidden, false, type);
      e.model.remove(); e.mutate(); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
    }
  }
});

test('voice-start: all-model mode works with unknown models or no editor/model ancestry', () => {
  for (const type of ['pointerenter', 'mouseenter', 'focus', 'pointerover', 'focusin']) {
    const e = setup({ mode: 'all', modelText: 'Thinking' }); e.show(type); assert.equal(e.hover().hidden, false, type);
    e.document.body.append(e.button); e.scope.remove(); e.mutate(); e.show(type);
    assert.equal(e.hover().hidden, false, type); assert.deepEqual(e.errors, []);
  }
});

test('voice-start: the existing nearby plain-div model scope works before an editor mounts', () => {
  const e = setup({ plainScope: true, noEditor: true }); e.show(); assert.equal(e.hover().hidden, false);
  e.model.textContent = 'Thinking'; e.mutate(); assert.equal(e.hover().hidden, true);
  assert.deepEqual(e.errors, []);
});

test('voice-start: a Pro selection in another composer never unlocks the voice launcher', () => {
  const e = setup({ modelText: 'Thinking' });
  const other = e.document.createElement('form'), pro = e.document.createElement('button');
  pro.setAttribute('data-codex-intelligence-trigger', 'true'); pro.textContent = 'Pro'; other.append(pro); e.document.body.append(other);
  e.show(); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
});

test('voice-start: switching to Pro-only immediately hides a visible non-Pro hover', () => {
  const e = setup({ mode: 'all', modelText: 'Thinking' }); e.click('expand'); e.click('settings');
  e.show(); assert.equal(e.hover().hidden, false);
  e.click('hover-pro'); assert.equal(e.hover().hidden, true); assert.equal(e.store.get(HOVER_MODE), 'pro');
  e.click('hover-all'); e.show(); assert.equal(e.hover().hidden, false); assert.deepEqual(e.errors, []);
});

test('voice-start: dictation, microphone, generic voice and in-call controls remain excluded in all-model mode', () => {
  for (const label of ['Voice mode', 'Voice', 'Start dictation', 'Dictate', 'Start recording', 'Microphone', 'Use microphone', 'Start voice recognition', 'Stop generating', 'Stop voice', 'Pause audio', 'Read aloud', '开始听写', '听写', '使用麦克风', '开始录音', '停止语音', '暂停语音', '朗读']) {
    const e = setup({ mode: 'all' }); e.button.setAttribute('aria-label', label); e.mutate();
    e.show(); assert.equal(e.hover().hidden, true, label);
    e.show('pointerover', e.use); assert.equal(e.hover().hidden, true, label); assert.deepEqual(e.errors, []);
  }
});

test('voice-start: start-voice labels do not override conflicting stop/dictation/audio metadata', () => {
  for (const [name, value] of [['title', 'Stop generating'], ['data-testid', 'dictation-button'], ['title', 'Pause audio']]) {
    const e = setup({ mode: 'all' }); e.button.setAttribute(name, value); e.show();
    assert.equal(e.hover().hidden, true, `${name}: ${value}`); assert.deepEqual(e.errors, []);
  }
});

test('voice-start: generic buttons, stale submit controls, excluded regions and hidden launchers stay excluded', () => {
  for (const change of [
    e => e.button.classList.remove('size-token-button-composer'), e => e.button.setAttribute('type', 'submit'),
    e => e.button.setAttribute('hidden', ''), e => e.button.setAttribute('aria-hidden', 'true'),
    e => { const header = e.document.createElement('header'); e.document.body.append(header); header.append(e.button); },
    e => { const dialog = e.document.createElement('div'); dialog.setAttribute('role', 'dialog'); e.document.body.append(dialog); dialog.append(e.button); },
  ]) {
    const e = setup({ mode: 'all' }); change(e); e.mutate(); e.show(); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
  }
});

test('voice-start: the same button can switch Send to voice-start to dictation without accumulating handlers', () => {
  const e = setup();
  e.button.setAttribute('type', 'submit'); e.button.setAttribute('aria-label', '发送'); e.mutate(); e.show(); assert.equal(e.hover().hidden, false);
  e.button.setAttribute('type', 'button'); e.button.setAttribute('aria-label', '开始语音'); e.mutate(); e.show(); assert.equal(e.hover().hidden, false);
  e.button.setAttribute('aria-label', '开始听写'); e.mutate(); assert.equal(e.hover().hidden, true); e.show(); assert.equal(e.hover().hidden, true);
  e.button.setAttribute('aria-label', '开始语音'); e.mutate(); e.show(); assert.equal(e.hover().hidden, false);
  e.button.setAttribute('aria-label', 'Stop generating'); e.mutate(); assert.equal(e.hover().hidden, true);
  for (const type of Object.keys(e.button.listeners)) assert.equal(e.button.listeners[type].length, 1, type);
  assert.deepEqual(e.errors, []);
});

test('voice-start: replacing a hovered launcher retires the old card and binds its successor once', () => {
  const e = setup(); e.show(); assert.equal(e.hover().hidden, false);
  e.button.remove(); const next = e.voice(); e.mutate(); assert.equal(e.hover().hidden, true);
  e.show('pointerenter', next.button); assert.equal(e.hover().hidden, false); e.mutate(); e.mutate();
  assert.equal(next.button.listeners.pointerenter.length, 1); assert.deepEqual(e.errors, []);
});

test('voice-start: pointer and focus exit preserve dismissal delay and Escape closes the card', () => {
  for (const [entry, exit] of [['pointerenter', 'pointerleave'], ['focus', 'blur'], ['focusin', 'focusout']]) {
    const e = setup(); e.show(entry); assert.equal(e.hover().hidden, false);
    e.dispatch(e.button, exit); e.flush(150); assert.equal(e.hover().hidden, false);
    e.flush(300); assert.equal(e.hover().hidden, true);
    e.show(entry); e.dismiss(); assert.equal(e.hover().hidden, true); assert.deepEqual(e.errors, []);
  }
});

test('voice-start: hovering never activates voice and a user click retains native event propagation', () => {
  const e = setup(), before = e.button.outerHTML;
  let buttonClicks = 0, documentClicks = 0, defaultActions = 0;
  e.button.addEventListener('click', () => buttonClicks++);
  e.document.addEventListener('click', () => documentClicks++);
  e.show('pointerover', e.use); assert.equal(e.nativeClicks(), 0); assert.equal(buttonClicks, 0);
  const event = e.dispatch(e.use, 'click', {}, () => defaultActions++);
  assert.equal(event.defaultPrevented, false); assert.equal(buttonClicks, 1); assert.equal(documentClicks, 1); assert.equal(defaultActions, 1);
  assert.equal(e.hover().hidden, true); assert.equal(e.button.outerHTML, before);
  assert.equal(e.nativeClicks(), 0); assert.equal(e.networkCalls(), 0); assert.deepEqual(e.errors, []);
});
