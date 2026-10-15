'use strict';
// DOM/event regression tests only. This fixture does not implement real CSS,
// browser retargeting, extension injection, or a live ChatGPT account.
const test = require('node:test');
const assert = require('node:assert/strict');
const { environment } = require('./audit-dom-fixture.cjs');

function setup(options = {}) {
  const e = environment(options), d = e.document;
  const composer = d.createElement('div'); composer.setAttribute('data-testid', 'composer'); d.body.appendChild(composer);
  const model = d.createElement('button'); model.setAttribute('data-codex-intelligence-trigger', 'true'); model.textContent = 'Pro'; composer.appendChild(model);
  function sender(parent = composer) {
    const button = d.createElement('button');
    button.setAttribute('type', 'submit'); button.setAttribute('aria-label', '发送');
    button.className = 'size-token-button-composer bg-composer-primary';
    const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = d.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path); button.appendChild(svg); parent.appendChild(button);
    button._rect = { left: 990, right: 1030, top: 680, bottom: 720, width: 40, height: 40 };
    return { button, svg, path };
  }
  const send = sender(); e.mutate();
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const click = action => {
    const target = e.ui().querySelector(`[data-action="${action}"]`); assert.ok(target, action);
    return e.emit(e.ui(), 'click', { target, composedPath: () => [target, e.ui(), e.host(), d.body, d] });
  };
  const showDirect = (button = send.button) => { e.emit(button, 'pointerenter', { target: button }); e.flush(150); };
  const panelOpen = () => !!e.ui().querySelector('.panel');
  const outside = () => {
    const target = d.createElement('button'); target.textContent = 'Outside native action'; d.body.appendChild(target);
    return target;
  };
  const outsideClick = target => e.emit(d, 'click', { target, composedPath: () => [target, d.body, d] });
  return { ...e, ...send, sender, hover, click, showDirect, panelOpen, outside, outsideClick };
}

test('v114: exact Chinese submit button binds directly with selected Pro but without an editor or form ancestor', () => {
  const e = setup();
  assert.equal(e.button.hasAttribute('data-testid'), false);
  assert.equal(e.button.closest('form'), null);
  assert.equal(e.document.querySelector('#prompt-textarea'), null);
  e.showDirect();
  assert.equal(e.hover().hidden, false);
  assert.match(e.hover().shadow.textContent, /剩余/);
  assert.deepEqual(e.errors, []);
});

test('v114: direct send hover works while the persistent panel is already open', () => {
  const e = setup(); e.click('expand'); assert.equal(e.panelOpen(), true);
  e.showDirect(); assert.equal(e.hover().hidden, false, 'expanded-panel state must not silently veto send hover');
  assert.deepEqual(e.errors, []);
});

test('v114: direct hover neither relies on document propagation nor changes the native send DOM', () => {
  const e = setup(); const before = e.button.outerHTML;
  const event = e.emit(e.button, 'pointerenter', { target: e.path, stopPropagation() { this.propagationStopped = true; } });
  e.flush(150);
  assert.equal(e.hover().hidden, false);
  assert.equal(event.defaultPrevented, undefined); assert.equal(event.propagationStopped, undefined);
  assert.equal(e.button.outerHTML, before);
});

test('v114: replacing sender binds the new node once and retires the detached hover', () => {
  const e = setup(); e.showDirect(); assert.equal(e.hover().hidden, false);
  e.button.remove(); const next = e.sender(); e.mutate();
  assert.equal(e.hover().hidden, true);
  e.showDirect(next.button); assert.equal(e.hover().hidden, false);
  e.mutate(); e.mutate();
  assert.equal(next.button.listeners.pointerenter.length, 1);
  assert.deepEqual(e.errors, []);
});

test('v114: directly bound send changing into stop or dictation does not retain hover', () => {
  for (const label of ['Stop generating', 'Voice mode', '停止生成', '开始听写']) {
    const e = setup(); e.showDirect();
    e.button.setAttribute('aria-label', label); e.mutate();
    e.showDirect(); assert.equal(e.hover().hidden, true, label);
    assert.deepEqual(e.errors, []);
  }
});

test('v114: generic unrelated Chinese submit button without composer tokens is not a sender', () => {
  const e = setup(); e.button.remove(); e.mutate();
  const form = e.document.createElement('form'), button = e.document.createElement('button');
  button.setAttribute('type', 'submit'); button.setAttribute('aria-label', '发送');
  form.appendChild(button); e.document.body.appendChild(form); e.mutate();
  e.emit(button, 'pointerenter', { target: button });
  e.emit(e.document, 'pointerover', { target: button }); e.flush(150);
  assert.equal(e.hover().hidden, true);
});

test('v114: outside click closes an open panel without canceling the native action or stealing focus', () => {
  const e = setup(); e.click('expand'); assert.equal(e.panelOpen(), true);
  const target = e.outside(); target.focus();
  const event = e.outsideClick(target);
  assert.equal(e.panelOpen(), false);
  assert.equal(event.defaultPrevented, undefined); assert.equal(event.propagationStopped, undefined);
  assert.equal(e.document.activeElement, target);
  assert.deepEqual(e.errors, []);
});

test('v114: the launcher opening click is not immediately interpreted as an outside click', () => {
  const e = setup();
  const target = e.ui().querySelector('[data-action="expand"]');
  e.emit(e.ui(), 'click', { target, composedPath: () => [target, e.ui(), e.host(), e.document] });
  e.emit(e.document, 'click', { target: e.host(), composedPath: () => [e.host(), e.document.body, e.document] });
  assert.equal(e.panelOpen(), true);
});

test('v114: a retargeted closed-shadow click within the panel never closes it', () => {
  const e = setup(); e.click('expand'); e.click('settings');
  const input = e.ui().querySelector('#cap'); input.value = '321';
  // At an outer listener a closed shadow root exposes only its host in the path.
  e.emit(e.document, 'click', { target: e.host(), composedPath: () => [e.host(), e.document.body, e.document] });
  assert.equal(e.panelOpen(), true);
  assert.equal(e.ui().querySelector('#cap').value, '321');
  // Also cover tools/browser wrappers that report a retargeted target but keep
  // the real protected host in their composedPath.
  e.emit(e.document, 'click', { target: e.document.body, composedPath: () => [input, e.ui(), e.host(), e.document.body, e.document] });
  assert.equal(e.panelOpen(), true);
});

test('v114: hover-card manage click is protected from outside-close after opening the panel', () => {
  const e = setup(); e.showDirect();
  const manage = e.hover().shadow.querySelector('[data-action="manage"]'); assert.ok(manage);
  e.emit(e.hover().shadow, 'click', { target: manage, composedPath: () => [manage, e.hover().shadow, e.hover(), e.document] });
  e.emit(e.document, 'click', { target: e.hover(), composedPath: () => [e.hover(), e.document.body, e.document] });
  assert.equal(e.panelOpen(), true);
  assert.deepEqual(e.errors, []);
});

test('v114: send click closes the panel but leaves native submission untouched', () => {
  const e = setup(); e.click('expand');
  const event = e.emit(e.document, 'click', { target: e.path, composedPath: () => [e.path, e.svg, e.button, e.document.body, e.document] });
  assert.equal(e.panelOpen(), false);
  assert.equal(event.defaultPrevented, undefined); assert.equal(event.propagationStopped, undefined);
});

test('v114: an outside close preserves unsaved settings without saving them', () => {
  const e = setup(); e.click('expand'); e.click('settings');
  e.ui().querySelector('#cap').value = '321'; e.ui().querySelector('#calibrate').value = '27';
  const store = [...e.store.entries()];
  e.outsideClick(e.outside()); assert.equal(e.panelOpen(), false);
  e.click('expand');
  assert.ok(e.ui().querySelector('#cap'), 'reopening resumes the settings draft');
  assert.equal(e.ui().querySelector('#cap').value, '321');
  assert.equal(e.ui().querySelector('#calibrate').value, '27');
  assert.deepEqual([...e.store.entries()], store);
});

test('v114: an outside close keeps unsaved WebDAV fields transient and restores them on reopen', () => {
  const e = setup(); e.click('expand'); e.click('sync');
  e.ui().querySelector('#dav-url').value = 'https://synthetic.invalid/counter.json';
  e.ui().querySelector('#dav-user').value = 'SYNTHETIC-UNSAVED-USER';
  e.ui().querySelector('#dav-pass').value = 'SYNTHETIC-UNSAVED-PASSWORD';
  const store = [...e.store.entries()];
  e.outsideClick(e.outside()); e.click('expand');
  assert.ok(e.ui().querySelector('#dav-pass'), 'reopening resumes the WebDAV draft');
  assert.equal(e.ui().querySelector('#dav-pass').value, 'SYNTHETIC-UNSAVED-PASSWORD');
  assert.equal(e.ui().querySelector('#dav-user').value, 'SYNTHETIC-UNSAVED-USER');
  assert.deepEqual([...e.store.entries()], store);
  assert(!JSON.stringify([...e.store.entries()]).includes('SYNTHETIC-UNSAVED-PASSWORD'));
});

test('v114: Escape does not reopen hover when native focus is restored by closing the panel', () => {
  const e = setup({ beforeRun({ Node, document }) {
    const focus = Node.prototype.focus;
    Node.prototype.focus = function () {
      focus.call(this);
      const event = { type: 'focus', target: this, currentTarget: this };
      for (const listener of this.listeners.focus || []) listener(event);
      for (const listener of document.listeners.focusin || []) listener({ ...event, type: 'focusin', currentTarget: document });
    };
  } });
  e.showDirect();
  const manage = e.hover().shadow.querySelector('[data-action="manage"]');
  e.emit(e.hover().shadow, 'click', { target: manage }); assert.equal(e.panelOpen(), true);
  e.emit(e.document, 'keydown', { key: 'Escape' }); e.flush(150);
  assert.equal(e.panelOpen(), false);
  assert.equal(e.document.activeElement, e.button);
  assert.equal(e.hover().hidden, true, 'Escape must cancel the focus-induced timer as well as the old hover');
  assert.deepEqual(e.errors, []);
});

test('v114: direct keyboard focus on the sender displays the same remaining amount', () => {
  const e = setup();
  e.emit(e.button, 'focus', { target: e.button, currentTarget: e.button }); e.flush(150);
  assert.equal(e.hover().hidden, false);
  assert.match(e.hover().shadow.textContent, /剩余/);
});

test('v114: explicit show/hide transitions retain strong host CSS without overriding hidden state', () => {
  const e = setup(); const host = e.hover();
  assert.equal(host.hidden, true);
  assert.match(host.style.cssText, /position:fixed!important/);
  assert.match(host.style.cssText, /visibility:visible!important/);
  assert.match(host.style.cssText, /opacity:1!important/);
  e.showDirect(); assert.equal(host.hidden, false); assert.equal(host.style.display, 'block');
  e.emit(e.document, 'keydown', { key: 'Escape' });
  assert.equal(host.hidden, true); assert.equal(host.style.display, 'none');
  assert.match(host.shadow.querySelector('style').textContent, /:host\(\[hidden\]\)\{display:none!important\}/);
});

test('v114: outside pointerdown followed by click closes once and keeps the saved draft', () => {
  const e = setup(); e.click('expand'); e.click('settings');
  e.ui().querySelector('#cap').value = '432';
  const target = e.outside();
  const pointer = e.emit(e.document, 'pointerdown', { target, composedPath: () => [target, e.document.body, e.document] });
  assert.equal(e.panelOpen(), false); assert.equal(pointer.defaultPrevented, undefined);
  e.outsideClick(target); e.click('expand');
  assert.equal(e.ui().querySelector('#cap').value, '432');
});

test('v114: restored settings draft still rejects a conflicting newer settings revision', () => {
  const e = setup(); e.click('expand'); e.click('settings');
  e.ui().querySelector('#cap').value = '432'; e.outsideClick(e.outside());
  const old = [...e.store.entries()].find(([key]) => key.startsWith('gpc.v1.settings.'))[1];
  e.store.set('gpc.v1.settings.other-tab', { ...old, id: 'other-tab', updated: Date.now() + 10, cap: 987 });
  e.click('expand');
  e.emit(e.ui(), 'submit', { target: e.ui().querySelector('#settings') });
  assert.match(e.ui().textContent, /另一个标签页修改了设置/);
  assert.equal([...e.store.values()].filter(value => value?.cap === 432).length, 0);
  assert.deepEqual(e.errors, []);
});

test('v114: direct mouseenter supports the English Send variant without document propagation', () => {
  const e = setup(); e.button.setAttribute('aria-label', 'Send'); e.mutate();
  e.emit(e.button, 'mouseenter', { target: e.button, currentTarget: e.button }); e.flush(150);
  assert.equal(e.hover().hidden, false);
  assert.deepEqual(e.errors, []);
});

test('v114: computed diagnostics expose classifications rather than private style or DOM values', () => {
  const e = setup();
  e.button.setAttribute('title', 'PRIVATE-NATIVE-TITLE');
  e.path.setAttribute('data-private-url', 'https://private.invalid/PRIVATE-PATH');
  const ordinary = e.win.getComputedStyle;
  e.win.getComputedStyle = el => el === e.hover()
    ? { display: 'PRIVATE-DISPLAY', visibility: 'PRIVATE-VISIBILITY', opacity: 'PRIVATE-OPACITY' }
    : ordinary(el);
  e.showDirect();
  e.menus.find(menu => menu.label === '诊断 Pro 计数器').fn();
  let text = e.alerts.at(-1);
  assert.match(text, /可见发送锚点: 1/);
  assert.match(text, /最近显示检查: unhidden \/ display-present \/ visibility-visible \/ opacity-present \/ nonzero-bounds/);
  assert.doesNotMatch(text, /PRIVATE|private\.invalid|<button|size-token-button/);
  // This is a simulated conflict to verify diagnostic classification, not a
  // claim that the synthetic fixture computes a CSS cascade.
  e.win.getComputedStyle = el => el === e.hover()
    ? { display: 'none', visibility: 'hidden', opacity: '0' }
    : ordinary(el);
  e.emit(e.win, 'resize');
  e.menus.find(menu => menu.label === '诊断 Pro 计数器').fn(); text = e.alerts.at(-1);
  assert.match(text, /display-none \/ visibility-hidden \/ opacity-zero/);
  assert.deepEqual(e.errors, []);
});

