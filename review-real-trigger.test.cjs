'use strict';
// User-reported trigger semantics in a synthetic DOM. Surrounding layouts below
// are deliberate regression variations, not a claim about the live page tree.
const test = require('node:test');
const assert = require('node:assert/strict');
const { environment } = require('./audit-dom-fixture.cjs');

function setup(layout = 'form', overrides = {}) {
  const e = environment();
  const d = e.document;
  const outer = d.createElement(['outer-known', 'outer-generic'].includes(layout) ? 'div' : 'form');
  if (layout === 'outer-known') outer.setAttribute('data-type', 'unified-composer');
  const editorParent = d.createElement(['outer-known', 'outer-generic'].includes(layout) ? 'form' : 'div');
  if (layout === 'inner-background') editorParent.id = 'composer-background';
  if (layout === 'inner-known') editorParent.setAttribute('data-testid', 'composer');
  const editor = d.createElement('div'); editor.id = 'prompt-textarea'; editor.setAttribute('contenteditable', 'true');
  editor._rect = { left: 200, right: 1100, top: 550, bottom: 640, width: 900, height: 90 };
  editorParent.appendChild(editor); outer.appendChild(editorParent); d.body.appendChild(outer);
  function makeTrigger(parent = outer) {
    const button = d.createElement('button');
    for (const [key, value] of Object.entries({
      'type': 'button',
      'aria-label': '选择 ChatGPT 模型',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'data-state': 'closed',
      'data-codex-intelligence-trigger': 'true',
      'data-composer-navigation-target': 'reasoning',
      'data-selected-reasoning-effort': 'medium',
      ...overrides,
    })) button.setAttribute(key, value);
    const wrapper = d.createElement('span');
    const content = d.createElement('span'); content.className = 'ModelPickerTriggerContent-MFmRQj';
    const hiddenLabel = d.createElement('span'); hiddenLabel.setAttribute('aria-hidden', 'true'); hiddenLabel.className = 'ModelPickerTriggerMeasurement-w4XXF6';
    const measurement = d.createElement('span'); measurement.textContent = '思考强度'; hiddenLabel.appendChild(measurement);
    const visibleLabel = d.createElement('span'); visibleLabel.className = 'ModelPickerTriggerLabel-xR9gDc';
    const group = d.createElement('span'); group.className = 'ModelPickerTriggerModelGroup-uBOG5R';
    const label = d.createElement('span'); label.className = 'min-w-0 truncate'; label.textContent = 'Pro';
    group.appendChild(label); visibleLabel.appendChild(group); content.append(hiddenLabel, visibleLabel); wrapper.appendChild(content);
    const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true');
    const path = d.createElementNS('http://www.w3.org/2000/svg', 'use'); path.setAttribute('href', '/cdn/assets/icons-9453d99f50597150.svg#chevron-down-md-light-16'); svg.appendChild(path);
    button.append(wrapper, svg); parent.appendChild(button);
    button._rect = { left: 850, right: 950, top: 660, bottom: 700, width: 100, height: 40 };
    return { button, hiddenLabel, visibleLabel, svg, path };
  }
  const trigger = makeTrigger();
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const show = (target = trigger.button) => { e.emit(d, 'pointerover', { target }); e.flush(150); };
  const hide = () => e.emit(d, 'keydown', { key: 'Escape' });
  const shown = () => { assert.equal(hover().hidden, false); assert.equal(e.ui().querySelector('.panel'), null, 'persistent panel is closed'); assert.deepEqual(e.errors, []); };
  return { ...e, ...trigger, outer, editorParent, editor, makeTrigger, hover, show, hide, shown };
}

test('actual trigger: hidden 思考强度 and visible Pro remain concatenated in the fixture', () => {
  const e = setup();
  assert.equal(e.button.textContent, '思考强度Pro');
  assert.equal(e.button.getAttribute('aria-label'), '选择 ChatGPT 模型');
  assert.equal(e.button.getAttribute('data-codex-intelligence-trigger'), 'true');
  assert.equal(e.button.getAttribute('data-composer-navigation-target'), 'reasoning');
  assert.equal(e.hiddenLabel.getAttribute('aria-hidden'), 'true');
  e.show(e.visibleLabel); e.shown();
  assert.match(e.hover().shadow.textContent, /剩余/);
});

test('actual trigger: an inner composer-background does not hide the outer form relationship', () => {
  const e = setup('inner-background');
  assert.equal(e.editor.closest('#composer-background').contains(e.button), false);
  assert.equal(e.editor.closest('form').contains(e.button), true);
  e.show(e.path); e.shown();
});

test('actual trigger: an inner composer marker does not hide the outer form relationship', () => {
  const e = setup('inner-known'); e.show(e.visibleLabel); e.shown();
});

test('actual trigger: a nearest editor-only form does not hide a containing unified composer', () => {
  const e = setup('outer-known');
  assert.equal(e.editor.closest('form').contains(e.button), false);
  assert.equal(e.editor.closest('[data-type="unified-composer"]').contains(e.button), true);
  e.show(); e.shown();
});

test('actual trigger: an editor-only form still allows its nearby sibling trigger in a generic composer', () => {
  const e = setup('outer-generic');
  assert.equal(e.editor.closest('form').contains(e.button), false);
  e.show(e.path); e.shown();
});

test('actual trigger: stable semantic markers identify the control without localized text', () => {
  const e = setup();
  e.hiddenLabel.textContent = 'Model selector'; e.visibleLabel.textContent = 'GPT';
  e.show(e.path); e.shown();
});

test('actual trigger: hidden descendants are clickable descendants, but a hidden whole trigger is excluded', () => {
  const e = setup();
  e.show(e.hiddenLabel); e.shown(); e.hide();
  e.button.setAttribute('aria-hidden', 'true'); e.show(e.path);
  assert.equal(e.hover().hidden, true);
});

test('actual trigger: pointer movement across the Pro text, chevron and whole button keeps the card', () => {
  const e = setup('inner-background'); e.show(e.visibleLabel); e.shown();
  for (const [target, relatedTarget] of [[e.visibleLabel, e.path], [e.path, e.button], [e.button, e.svg]]) {
    e.emit(e.document, 'pointerout', { target, relatedTarget });
    e.emit(e.document, 'pointerover', { target: relatedTarget, relatedTarget: target });
    e.flush(300); e.shown();
  }
});

test('actual trigger: keyboard focus works and the native model shortcut/click stays intact', () => {
  const e = setup('inner-background');
  const before = e.button.outerHTML;
  e.emit(e.document, 'focusin', { target: e.button }); e.flush(150); e.shown();
  const key = e.emit(e.document, 'keydown', { key: 'M', code: 'KeyM', ctrlKey: true, shiftKey: true });
  assert.equal(key.defaultPrevented, undefined); assert.equal(key.propagationStopped, undefined);
  const click = e.emit(e.document, 'click', { target: e.path });
  assert.equal(click.defaultPrevented, undefined); assert.equal(click.propagationStopped, undefined);
  assert.equal(e.button.outerHTML, before);
});

test('actual trigger: the native shortcut tooltip below Pro is left untouched', () => {
  const e = setup('inner-background');
  const tooltip = e.document.createElement('div'); tooltip.setAttribute('role', 'tooltip');
  tooltip.textContent = '思考强度 ⌃⇧M';
  tooltip._rect = { left: 800, right: 1066, top: 710, bottom: 770, width: 266, height: 60 };
  e.document.body.appendChild(tooltip);
  const before = tooltip.outerHTML;
  e.show(); e.shown();
  assert.equal(tooltip.outerHTML, before);
  assert.equal(tooltip.hidden, undefined);
  assert.equal(tooltip.isConnected, true);
  const own = e.hover(), top = Number.parseFloat(own.style.top);
  assert.ok(top + own.getBoundingClientRect().height < e.button.getBoundingClientRect().top, 'counter card goes above a lower-page trigger');
});

test('actual trigger: identical attributes outside the composer still do not qualify', () => {
  const e = setup('inner-background');
  for (const tag of ['header', 'nav', 'aside']) {
    const outside = e.document.createElement(tag); e.document.body.appendChild(outside);
    const copied = e.makeTrigger(outside);
    e.show(copied.path);
    assert.equal(e.hover().hidden, true, `${tag} trigger must remain excluded`);
  }
  const detachedSibling = e.document.createElement('section'); e.document.body.appendChild(detachedSibling);
  const copied = e.makeTrigger(detachedSibling); e.show(copied.path);
  assert.equal(e.hover().hidden, true, 'shared document body is not a composer');
  assert.deepEqual(e.errors, []);
});

test('actual trigger: stale semantic model attributes never override stop or microphone labels', () => {
  for (const label of ['Stop generating', 'Voice mode', 'Microphone', '停止生成', '使用麦克风']) {
    const e = setup('inner-background', { 'aria-label': label }); e.show(e.path);
    assert.equal(e.hover().hidden, true, label);
  }
});

test('actual trigger: replacement of the observed composer requires no new listener registration', () => {
  const e = setup('inner-background'); e.show(); e.shown();
  e.outer.remove(); e.mutate(); assert.equal(e.hover().hidden, true);
  const replacement = e.document.createElement('form');
  const inner = e.document.createElement('div'); inner.id = 'composer-background';
  const editor = e.document.createElement('div'); editor.id = 'prompt-textarea';
  inner.appendChild(editor); replacement.appendChild(inner); e.document.body.appendChild(replacement);
  const fresh = e.makeTrigger(replacement); e.show(fresh.path); e.shown();
  assert.equal(e.document.listeners.pointerover.length, 1);
  assert.equal(e.document.listeners.focusin.length, 1);
});

test('actual trigger: diagnostics contain fixed reasons and counts, not DOM text or URLs', () => {
  const e = setup('inner-background');
  e.button.setAttribute('title', 'PRIVATE-CONTROL-TITLE');
  e.button.setAttribute('data-private-url', 'https://private.invalid/PRIVATE-URL');
  e.editor.textContent = 'PRIVATE-CHAT-TEXT';
  e.hiddenLabel.textContent = 'PRIVATE-HIDDEN-MEASUREMENT';
  e.show(e.path); e.shown();
  e.menus.find(menu => menu.label === '诊断 Pro 计数器').fn();
  const diagnostic = e.alerts.at(-1);
  assert.match(diagnostic, /悬停监听: installed/);
  assert.match(diagnostic, /可见输入框: 1/);
  assert.match(diagnostic, /可见模型标记: 1/);
  assert.match(diagnostic, /最近悬停事件: pointerover/);
  assert.match(diagnostic, /最近控件匹配: model-marker/);
  assert.match(diagnostic, /最近输入框范围: explicit-composer/);
  assert.match(diagnostic, /浮卡状态: visible-above/);
  assert.doesNotMatch(diagnostic, /PRIVATE|private\.invalid|ModelPicker|<button|radix-/);
});

test('actual trigger: hidden measurement text cannot disguise a different visible control', () => {
  const e = setup();
  e.button.removeAttribute('data-codex-intelligence-trigger');
  e.button.removeAttribute('data-composer-navigation-target');
  e.button.setAttribute('aria-label', 'More options');
  e.hiddenLabel.textContent = 'Pro';
  e.visibleLabel.textContent = 'Other action';
  e.show(e.path);
  assert.equal(e.hover().hidden, true);
  assert.deepEqual(e.errors, []);
});

test('actual trigger: a shared nearby shell does not join separate composer forms', () => {
  const e = setup('outer-generic');
  e.button.remove();
  const otherForm = e.document.createElement('form'); e.outer.appendChild(otherForm);
  const other = e.makeTrigger(otherForm);
  e.show(other.path);
  assert.equal(e.hover().hidden, true);
  assert.deepEqual(e.errors, []);
});

test('actual trigger: placement prefers available room above and reserves the native tooltip lane below', () => {
  const { hoverPosition } = require('./chatgpt-pro-counter.user.js');
  const upper = hoverPosition({ left: 200, width: 100, top: 190, bottom: 230 }, 266, 148, 800, 800);
  assert.equal(upper.placement, 'above');
  assert.equal(upper.top + 148, 178);
  const lower = hoverPosition({ left: 200, width: 100, top: 20, bottom: 60 }, 266, 148, 800, 800);
  assert.equal(lower.placement, 'below');
  assert.ok(lower.top >= 122, 'leave 62px for the existing below-button native shortcut tooltip');
  const constrained = hoverPosition({ left: 200, width: 100, top: 110, bottom: 150 }, 266, 220, 800, 250);
  assert.equal(constrained.placement, 'above');
  assert.ok(constrained.maxHeight < 220);
  assert.equal(constrained.top, 12);
});
