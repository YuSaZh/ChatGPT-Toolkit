'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const { setup } = require('./current-frontend-fixture.cjs');
function bailout(s) {
  const root = { ...s.root }, boundary = { ...s.boundary, return: root };
  root.child = boundary; root.alternate = s.root; s.root.alternate = root;
  boundary.alternate = s.boundary; s.boundary.alternate = boundary;
  s.root.stateNode.current = root;
  return { root, boundary };
}
test('committed index: React shared-child bailout uses forward current ancestry', () => {
  const s = setup(), next = bailout(s);
  assert.equal(next.boundary.child, s.boundary.child);
  assert.equal(next.boundary.child.return, s.boundary);
  assert.equal(api.currentMessageAncestors(s.components[1].element).length, 0, 'published strict return proof fails this valid bailout');
  const index = api.createCommittedMessageIndex(s.doc);
  assert.equal(index.chain(s.components[1].element)[4], next.boundary);
  const r = s.render(); assert.equal(r.messageBadges, 2); assert.equal(r.messageItemSources, 2);
  assert.equal(s.requests(), 0); assert.equal(s.calls(), 0);
});
test('committed index: shared children read only the new parent snapshot', () => {
  const s = setup(), next = bailout(s);
  next.boundary.memoizedState = { memoizedState: { data: { ...s.data, mapping: {
    ...s.data.mapping, answer: { message: { ...s.data.mapping.answer.message, metadata: { resolved_model_slug: 'committed-model' } } }
  } } } };
  s.render(); assert.match(s.badge().textContent, /committed-model/);
  assert.doesNotMatch(s.badge().textContent, /current-model/);
});
test('committed index: history switch rejects reused hosts until matching committed boundary', () => {
  const s = setup(), next = bailout(s); s.render();
  s.page('https://chatgpt.com/c/chat-b'); s.render(); assert.equal(s.badges.size, 0);
  next.boundary.memoizedProps = { ...next.boundary.memoizedProps, browserConversationId: 'chat-b' };
  next.boundary.memoizedState = { memoizedState: { data: { ...s.data, conversation_id: 'chat-b' } } };
  s.render(); assert.equal(s.badges.size, 2); s.render(); assert.equal(s.badges.size, 2);
});
test('committed index: unrelated earlier React root cannot hide conversation root', () => {
  const s = setup(); const widget = s.doc.createElement('main');
  s.doc.body.children.unshift(widget); widget.parentNode = s.doc.body;
  const root = { tag: 3, return: null }; root.stateNode = { current: root };
  const host = { tag: 5, stateNode: widget, return: root }; root.child = host;
  Object.defineProperty(widget, '__reactFiber$widget', { value: host });
  const index = api.createCommittedMessageIndex(s.doc); assert.equal(index.roots, 2);
  s.render(); assert.equal(s.badges.size, 2);
});
test('committed index: non-React main does not disable generic container discovery', () => {
  const s = setup({ noAnchor: true }); s.mainHost.stateNode.tagName = 'SECTION';
  s.doc.body.appendChild(s.doc.createElement('main'));
  s.render(); assert.equal(s.badges.size, 2);
});
test('committed index: hidden committed subtree cannot borrow stale visible parent chain', () => {
  const s = setup(), next = bailout(s);
  next.boundary.tag = 22; next.boundary.memoizedState = {};
  s.render(); assert.equal(s.badges.size, 0);
});
test('committed index: discarded alternate props and getters are never evaluated', () => {
  const s = setup(), next = bailout(s);
  Object.defineProperty(s.boundary, 'memoizedProps', { get() { throw Error('stale props read'); } });
  Object.defineProperty(s.boundary, 'memoizedState', { get() { throw Error('stale hooks read'); } });
  Object.defineProperty(next.boundary.memoizedProps, 'pendingProps', { get() { throw Error('pending read'); } });
  s.render(); assert.equal(s.badges.size, 2);
});
test('committed index: diagnostics expose only discovery counts', () => {
  const s = setup(), r = s.render();
  assert.ok(r.messageDomAnchors > 0); assert.ok(r.messageReactHosts > 0);
  assert.equal(r.messageReactRoots, 1); assert.ok(r.messageCommittedFibers > 0);
  assert.doesNotMatch(JSON.stringify(r), /chat-a|local-a|answer|current-model/);
});
test('page realm: bootstrap reads page-owned elements when sandbox document view omits them', () => {
  const { environment } = require('./audit-dom-fixture.cjs');
  const e = environment({ beforeRun({ context, win, document }) {
    win.location.href = 'https://chatgpt.com/c/chat-a';
    // Same page, deliberately incomplete wrapper view. No injection/eval bridge
    // is needed: boot should choose the existing unsafeWindow.document.
    context.document = Object.assign({}, document, { querySelectorAll() { return []; }, getElementById() { return null; } });
  } });
  e.flush(); assert.equal(e.rendered(), true); assert.deepEqual(e.errors, []);
  e.menus.find(m => m.label === '诊断 Pro 计数器').fn();
  assert.match(e.alerts.at(-1), /消息页面范围: conversation/);
  assert.match(e.alerts.at(-1), /原始页面锚点:/);
});
