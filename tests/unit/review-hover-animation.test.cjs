'use strict';
// Independent DOM/VM regressions. These exercise synthetic DOM and mocked responses;
// they do not claim real ChatGPT, Tampermonkey injection, or browser layout coverage.
const test = require('node:test');
const assert = require('node:assert/strict');
const { environment } = require('../fixtures/audit-dom-fixture.cjs');

function setup(options = {}) {
  const now = Date.now();
  const settings = { v: 1, id: 'hover-review', updated: now, cap: 100, mode: 'fixed', anchor: now - 3600000, ledger: 'default', label: '默认账本' };
  const e = environment({ entries: [['gpc.v1.settings.hover-review', settings]], ...options });
  const { document: d } = e;
  const form = d.createElement('form');
  const editor = d.createElement('div');
  editor.id = 'prompt-textarea';
  editor.setAttribute('contenteditable', 'true');
  editor._rect = { top: 550, bottom: 640, left: 200, right: 1100, width: 900, height: 90 };
  form.appendChild(editor);
  d.body.appendChild(form);
  const control = (label, attributes = {}, tag = 'button', parent = form) => {
    const el = d.createElement(tag);
    if (label) el.textContent = label;
    for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
    el._rect = { top: 660, bottom: 700, left: 850, right: 950, width: 100, height: 40 };
    parent.appendChild(el);
    return el;
  };
  const selectPro = (parent = form) => control('Pro', { 'data-codex-intelligence-trigger': 'true' }, 'button', parent);
  if (options.selectedPro !== false) selectPro();
  const nested = parent => {
    const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = d.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path); parent.appendChild(svg);
    return { svg, path };
  };
  const hover = () => d.getElementById('chatgpt-pro-local-hover');
  const show = target => { e.emit(d, 'pointerover', { target }); e.flush(150); };
  const hide = () => e.emit(d, 'keydown', { key: 'Escape' });
  const expectShown = () => { assert.equal(hover().hidden, false); assert.deepEqual(e.errors, []); };
  return { ...e, form, editor, control, selectPro, nested, hover, show, hide, expectShown, settings };
}

test('review: send-button SVG/path retargets to the whole native button', () => {
  const e = setup();
  const send = e.control('', { 'data-testid': 'send-button', 'aria-label': 'Send prompt' });
  const { svg, path } = e.nested(send);
  e.show(path); e.expectShown();
  const card = e.hover();
  e.emit(e.document, 'pointerout', { target: path, relatedTarget: svg });
  e.emit(e.document, 'pointerover', { target: svg, relatedTarget: path });
  e.flush(300);
  assert.equal(card.hidden, false, 'moving within native button must not dismiss the card');
  e.emit(e.document, 'pointerout', { target: svg, relatedTarget: send });
  e.emit(e.document, 'pointerover', { target: send, relatedTarget: svg });
  e.flush(300);
  assert.equal(card.hidden, false, 'the blank hit area around the SVG remains part of the trigger');
});

test('review: semantic composer send anchors work without visible send text', () => {
  for (const attrs of [
    { id: 'composer-submit-button' },
    { 'data-testid': 'send-button' },
    { 'aria-label': 'Send prompt' },
    { 'aria-label': '发送提示' },
  ]) {
    const e = setup(); const send = e.control('', attrs); const { path } = e.nested(send);
    e.show(path); e.expectShown();
  }
});

test('review: a native non-button Pro dropdown never opens the card from label, chevron or focus', () => {
  const e = setup({ selectedPro: false });
  const pro = e.control('', { tabindex: '0', 'aria-haspopup': 'menu' }, 'div');
  const label = e.document.createElement('span'); label.textContent = 'Pro'; pro.appendChild(label);
  const { path } = e.nested(pro);
  e.show(label); assert.equal(e.hover().hidden, true);
  e.show(path); assert.equal(e.hover().hidden, true);
  e.emit(e.document, 'focusin', { target: pro }); e.flush(150); assert.equal(e.hover().hidden, true);
});

test('review: control ancestors are checked when an inner role-button has no label', () => {
  const e = setup(); const send = e.control('', { 'data-testid': 'send-button' });
  const inner = e.control('', { role: 'button' }, 'span', send);
  const { path } = e.nested(inner);
  e.show(path); e.expectShown();
  e.emit(e.document, 'pointerout', { target: inner, relatedTarget: send });
  e.flush(300);
  assert.equal(e.hover().hidden, false, 'the verified send ancestor is the complete trigger');
});

test('review: hover is scoped to the composer, never a nearby header or upgrade label', () => {
  const e = setup();
  const header = e.document.createElement('header'); e.document.body.appendChild(header);
  for (const [text, attrs] of [
    ['Pro', {}], ['Thinking', { 'data-testid': 'model-switcher-dropdown-button' }],
    ['', { 'data-testid': 'send-button', 'aria-label': 'Send prompt' }], ['Upgrade Pro', {}],
  ]) {
    const el = e.control(text, attrs, 'button', header);
    // Deliberately use the same geometry as a legitimate composer button.
    e.show(el);
    assert.equal(e.hover().hidden, true, `unrelated control must not match: ${text || JSON.stringify(attrs)}`);
  }
  assert.deepEqual(e.errors, []);
});

test('review: stop, microphone and voice controls are never send triggers', () => {
  for (const attrs of [
    { 'data-testid': 'stop-button', 'aria-label': 'Stop generating' },
    { 'data-testid': 'send-button', 'aria-label': 'Stop generating' },
    { id: 'composer-submit-button', 'aria-label': 'Start voice mode' },
    { 'data-testid': 'voice-mode-button', 'aria-label': 'Voice' },
    { 'aria-label': 'Dictate' }, { 'aria-label': '停止生成' }, { 'aria-label': '使用麦克风' },
  ]) {
    const e = setup(); const button = e.control('', attrs); const { path } = e.nested(button);
    e.show(path);
    assert.equal(e.hover().hidden, true, `not a send anchor: ${JSON.stringify(attrs)}`);
    assert.deepEqual(e.errors, []);
  }
});

test('review: keyboard send focus does not alter native send activation', () => {
  const e = setup(); const send = e.control('', { 'data-testid': 'send-button' });
  const original = send.outerHTML;
  e.emit(e.document, 'focusin', { target: send }); e.flush(150); e.expectShown();
  const key = e.emit(e.document, 'keydown', { target: send, key: 'Enter', code: 'Enter' });
  assert.equal(key.defaultPrevented, undefined); assert.equal(key.propagationStopped, undefined);
  const click = e.emit(e.document, 'click', { target: send });
  assert.equal(click.defaultPrevented, undefined); assert.equal(click.propagationStopped, undefined);
  assert.equal(send.outerHTML, original, 'native DOM is not restyled, replaced, or annotated');
});

test('review: composer replacement discards a detached anchor and recognizes the new send button', () => {
  const e = setup(); const first = e.control('', { 'data-testid': 'send-button' });
  e.show(first); e.expectShown();
  e.form.remove(); e.mutate();
  assert.equal(e.hover().hidden, true, 'a removed composer must hide its stale hover without waiting for the five-second refresh');
  const nextForm = e.document.createElement('form');
  const editor = e.document.createElement('div'); editor.id = 'prompt-textarea'; nextForm.appendChild(editor);
  e.document.body.appendChild(nextForm);
  e.selectPro(nextForm);
  const next = e.control('', { 'data-testid': 'send-button' }, 'button', nextForm);
  e.show(e.nested(next).path); e.expectShown();
  assert.equal(e.document.listeners.pointerover.length, 1);
});

test('review: remaining amount is primary and negative remaining never renders', () => {
  const e = setup();
  const now = Date.now();
  const manual = { v: 1, id: 'manual-review', key: 'm:manual-review', ledger: 'default', at: now - 1000, updated: now - 1000, state: 'manual', observation: 'manual', delta: 11, requested: '', route: '', label: '', conflict: false, stable: true, http: 0 };
  e.store.set('gpc.v1.event.manual-review', manual);
  const send = e.control('', { 'data-testid': 'send-button' });
  e.show(send); e.expectShown();
  assert.match(e.hover().shadow.querySelector('.number').textContent, /89/);
  assert.match(e.hover().shadow.textContent, /11\s*\/\s*100/);
  assert.match(e.hover().shadow.textContent, /本机估算/);
  e.hide(); e.store.set('gpc.v1.event.manual-review', { ...manual, delta: 110 }); e.show(send);
  assert.match(e.hover().shadow.querySelector('.number').textContent, /^0\b/);
});

const records = e => [...e.store.entries()].filter(([key]) => key.startsWith('gpc.v1.event.')).map(([, value]) => value);
async function until(predicate, label = 'asynchronous mocked response') {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  assert.fail(`Timed out waiting for ${label}`);
}
function visiblePulses(e) {
  const result = [];
  function walk(node, hidden = false) {
    hidden ||= node.hidden === true;
    if (!hidden && node.nodeType === 1 && node.textContent.trim() === '+1' && !node.children.some(child => child.nodeType === 1)) result.push(node);
    for (const child of node.children || []) walk(child, hidden);
    if (node.shadow) walk(node.shadow, hidden);
  }
  walk(e.document.documentElement);
  return result;
}
function streamResponse() {
  let controller;
  const response = new Response(new ReadableStream({ start(c) { controller = c; } }), { headers: { 'content-type': 'text/event-stream' } });
  return {
    response,
    frame(value) { controller.enqueue(new TextEncoder().encode(`data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`)); },
    close() { controller.close(); },
  };
}
function request(e, id, model = 'gpt-5-pro') {
  return e.win.fetch('/backend-api/conversation', { method: 'POST', body: JSON.stringify({ action: 'next', model, messages: [{ id, author: { role: 'user' }, content: { parts: ['SYNTHETIC PRIVATE TEXT'] } }] }) });
}
function prepareAnimation(options = {}) {
  const e = setup(options);
  const send = e.control('', { 'data-testid': 'send-button', 'aria-label': 'Send prompt' });
  e.nested(send);
  return { ...e, send };
}

test('review: accepted Pro request animates while its response is still streaming, only once', async () => {
  const stream = streamResponse();
  const e = prepareAnimation({ fetch: () => Promise.resolve(stream.response) });
  await request(e, 'review-live-pro');
  await until(() => records(e).some(row => row.state === 'accepted'), 'HTTP acceptance');
  e.flush(150);
  assert.equal(visiblePulses(e).length, 1, 'locally counted HTTP acceptance produces +1 before answer completion');
  assert.match(e.ui().textContent, /1\/100/);
  stream.frame({ resolved_model_slug: 'gpt-5-pro' });
  await until(() => records(e).some(row => row.observation === 'metadata'), 'route metadata');
  e.flush(150);
  assert.equal(visiblePulses(e).length, 1, 'metadata must not add another effect');
  stream.frame('[DONE]'); stream.close();
  await until(() => records(e).some(row => row.observation === 'done'), 'response completion');
  e.flush(150);
  assert.equal(visiblePulses(e).length, 1, 'completion must not add another effect');
  e.flush(5000);
  assert.equal(visiblePulses(e).length, 0, 'feedback is transient');
  assert.deepEqual(e.errors, []);
  assert(!JSON.stringify(records(e)).includes('SYNTHETIC PRIVATE TEXT'));
});

test('review: unknown request animates when response metadata first resolves it to Pro', async () => {
  const stream = streamResponse();
  const e = prepareAnimation({ fetch: () => Promise.resolve(stream.response) });
  await request(e, 'review-unknown-to-pro', 'auto');
  await until(() => records(e).some(row => row.state === 'accepted'));
  e.flush(150); assert.equal(visiblePulses(e).length, 0);
  stream.frame({ resolved_model_slug: 'gpt-5-pro' });
  await until(() => records(e).some(row => row.route === 'gpt-5-pro'));
  e.flush(150); assert.equal(visiblePulses(e).length, 1);
  e.flush(5000);
  stream.frame({ resolved_model_slug: 'gpt-5-pro' });
  stream.frame('[DONE]'); stream.close();
  await until(() => records(e).some(row => row.observation === 'done'));
  e.flush(150); assert.equal(visiblePulses(e).length, 0, 'the same counted event does not replay after metadata/completion');
  assert.deepEqual(e.errors, []);
});

test('review: delayed structured error retracts the same request feedback and count', async () => {
  const stream = streamResponse();
  const e = prepareAnimation({ fetch: () => Promise.resolve(stream.response) });
  await request(e, 'review-delayed-error');
  await until(() => records(e).some(row => row.state === 'accepted'));
  e.flush(150); assert.equal(visiblePulses(e).length, 1);
  stream.frame({ error: { message: 'SYNTHETIC ERROR MUST NOT BE STORED' } });
  stream.close();
  await until(() => records(e).some(row => row.state === 'failed'));
  e.flush(150);
  assert.equal(visiblePulses(e).length, 0, 'failed request must not retain visible success feedback');
  assert.match(e.ui().textContent, /0\/100/);
  assert(!JSON.stringify(records(e)).includes('SYNTHETIC ERROR'));
  assert.deepEqual(e.errors, []);
});

test('review: ambiguous conflicting routes retract unknown-to-Pro feedback', async () => {
  const stream = streamResponse();
  const e = prepareAnimation({ fetch: () => Promise.resolve(stream.response) });
  await request(e, 'review-conflicting-routes', 'auto');
  await until(() => records(e).some(row => row.state === 'accepted'));
  stream.frame({ resolved_model_slug: 'gpt-5-pro' });
  await until(() => records(e).some(row => row.route === 'gpt-5-pro'));
  e.flush(150); assert.equal(visiblePulses(e).length, 1);
  stream.frame({ resolved_model_slug: 'gpt-5-thinking' });
  await until(() => records(e).some(row => row.conflict));
  e.flush(150); assert.equal(visiblePulses(e).length, 0);
  assert.match(e.ui().textContent, /0\/100/);
  stream.frame('[DONE]'); stream.close();
  await until(() => records(e).some(row => row.observation === 'done'));
  assert.deepEqual(e.errors, []);
});

test('review: same stable request retries do not animate or increase the count twice', async () => {
  const e = prepareAnimation({ fetch: () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })) });
  await request(e, 'review-stable-id');
  await until(() => records(e).some(row => row.observation === 'done'));
  e.flush(150); assert.equal(visiblePulses(e).length, 1);
  e.flush(5000); assert.equal(visiblePulses(e).length, 0);
  await request(e, 'review-stable-id');
  await until(() => records(e).length === 2 && records(e).every(row => row.observation === 'done'));
  e.flush(150);
  assert.equal(visiblePulses(e).length, 0, 'duplicate grouped count must not animate');
  assert.match(e.ui().textContent, /1\/100/);
  assert.deepEqual(e.errors, []);
});

test('review: already stored/imported/synced counted records are never replayed on observer retry', async () => {
  const api = require('../../chatgpt-pro-counter.user.js');
  const id = 'review-existing-group';
  const key = `h:${await api.digest(api.requestMeta({ action: 'next', model: 'gpt-5-pro', messages: [{ id, author: { role: 'user' } }] }).seed)}`;
  const now = Date.now();
  const existing = { v: 1, id: 'already-stored', key, ledger: 'default', at: now - 100, updated: now - 100, state: 'accepted', observation: 'done', delta: 0, requested: 'gpt-5-pro', route: '', label: '', conflict: false, stable: true, http: 200 };
  const e = prepareAnimation({ fetch: () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })) });
  e.store.set('gpc.v1.event.already-stored', existing);
  e.tick(); assert.equal(visiblePulses(e).length, 0);
  await request(e, id);
  await until(() => records(e).length === 2 && records(e).every(row => row.observation === 'done'));
  e.flush(150);
  assert.equal(visiblePulses(e).length, 0);
  assert.match(e.ui().textContent, /1\/100/);
  assert.deepEqual(e.errors, []);
});

test('review: manual adjustments and failed/Thinking/unknown HTTP requests never create +1 feedback', async () => {
  const responses = [
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
    () => new Response('{}', { status: 429, headers: { 'content-type': 'application/json' } }),
  ];
  const e = prepareAnimation({ fetch: () => Promise.resolve(responses.shift()()) });
  for (const [id, model] of [['review-thinking', 'gpt-5-thinking'], ['review-unknown', 'auto'], ['review-rejected', 'gpt-5-pro']]) {
    await request(e, id, model);
  }
  await until(() => records(e).length === 3 && records(e).every(row => row.state !== 'pending'));
  e.flush(150); assert.equal(visiblePulses(e).length, 0);
  e.emit(e.ui(), 'click', { target: e.ui().querySelector('[data-action="expand"]') });
  e.emit(e.ui(), 'click', { target: e.ui().querySelector('[data-action="plus"]') });
  e.flush(150); assert.equal(visiblePulses(e).length, 0);
  assert.deepEqual(e.errors, []);
});

test('review: response handoff retains the accepted local-count feedback', async () => {
  const e = prepareAnimation({ fetch: () => Promise.resolve(new Response('data: {"type":"stream_handoff"}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })) });
  await request(e, 'review-handoff');
  await until(() => records(e).some(row => row.observation === 'handoff'));
  e.flush(150);
  assert.equal(visiblePulses(e).length, 1, 'counted handoff is still a local +1, without claiming a completed answer');
  assert.match(e.ui().textContent, /1\/100/);
  assert.deepEqual(e.errors, []);
});

test('review: an immediate structured error cancels queued +1 before its first paint', async () => {
  const e = prepareAnimation({ fetch: () => Promise.resolve(new Response('{"error":{"code":"limit"}}', { headers: { 'content-type': 'application/json' } })) });
  await request(e, 'review-immediate-error');
  await until(() => records(e).some(row => row.state === 'failed'));
  e.flush(150);
  assert.equal(visiblePulses(e).length, 0);
  assert.match(e.ui().textContent, /0\/100/);
  assert.deepEqual(e.errors, []);
});

test('review: increment feedback is non-interactive, accessible, and has a reduced-motion override', async () => {
  const e = prepareAnimation({ fetch: () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })) });
  await request(e, 'review-feedback-accessibility');
  await until(() => records(e).some(row => row.observation === 'done'));
  e.flush(150);
  const host = e.document.getElementById('chatgpt-pro-local-increment');
  assert.ok(host);
  assert.match(host.style.cssText, /pointer-events\s*:\s*none\s*!important/);
  const status = host.shadow.querySelector('[role="status"]');
  assert.ok(status); assert.match(status.getAttribute('aria-label'), /本机/);
  assert.equal(host.shadow.querySelector('button,input,[tabindex]'), null);
  assert.match(host.shadow.querySelector('style').textContent, /prefers-reduced-motion:reduce.*animation:none!important/);
  e.flush(5000); assert.equal(e.document.getElementById('chatgpt-pro-local-increment'), null);
});

test('review: simultaneous distinct counted requests each receive one transient effect', async () => {
  const e = prepareAnimation({ fetch: () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })) });
  await Promise.all([request(e, 'review-parallel-one'), request(e, 'review-parallel-two')]);
  await until(() => records(e).length === 2 && records(e).every(row => row.observation === 'done'));
  e.flush(150); assert.equal(visiblePulses(e).length, 1);
  const first = e.document.getElementById('chatgpt-pro-local-increment');
  e.flush(1100); assert.equal(visiblePulses(e).length, 1);
  assert.notEqual(e.document.getElementById('chatgpt-pro-local-increment'), first);
  e.flush(1100); assert.equal(visiblePulses(e).length, 0);
  e.tick(); assert.equal(visiblePulses(e).length, 0, 'refresh never replays effects');
  assert.match(e.ui().textContent, /2\/100/);
  assert.deepEqual(e.errors, []);
});

test('review: failed event storage never announces a count that was not saved', async () => {
  let triedAcceptedWrite = false;
  const e = prepareAnimation({
    fetch: () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })),
    beforeRun({ context }) {
      const set = context.GM_setValue;
      context.GM_setValue = (key, value) => {
        if (key.startsWith('gpc.v1.event.')) {
          if (value.state === 'accepted') triedAcceptedWrite = true;
          throw new Error('Synthetic failed write');
        }
        set(key, value);
      };
    },
  });
  await request(e, 'review-failed-storage');
  await until(() => { e.flush(150); return /待核对/.test(e.ui().textContent); });
  e.flush(150);
  assert.equal(triedAcceptedWrite, false, 'stop later writes after the first failed persistence attempt');
  assert.equal(visiblePulses(e).length, 0);
  assert.match(e.ui().textContent, /待核对/);
  assert.equal(records(e).length, 0);
  assert.deepEqual(e.errors, []);
});

test('review: immediate-error attempt does not consume the first +1 for a later successful stable retry', async () => {
  let attempt = 0;
  const e = prepareAnimation({ fetch: () => Promise.resolve(new Response(attempt++ ? '{}' : '{"error":{"code":"temporary"}}', { headers: { 'content-type': 'application/json' } })) });
  await request(e, 'review-error-then-retry');
  await until(() => records(e).length === 1 && records(e)[0].state === 'failed');
  e.flush(150); assert.equal(visiblePulses(e).length, 0);
  assert.match(e.ui().textContent, /0\/100/);
  await request(e, 'review-error-then-retry');
  await until(() => records(e).length === 2 && records(e).some(row => row.state === 'accepted' && row.observation === 'done'));
  e.flush(150);
  assert.equal(visiblePulses(e).length, 1, 'the canceled, never-shown effect must not suppress the first successful count');
  assert.match(e.ui().textContent, /1\/100/);
  assert.deepEqual(e.errors, []);
});

