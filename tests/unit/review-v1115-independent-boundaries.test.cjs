'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../chatgpt-pro-counter.user.js');
const { setup, raw } = require('../fixtures/current-frontend-fixture.cjs');

function remountOldSources(s) {
  for (const c of s.components) {
    const fresh = s.doc.createElement('div');
    c.element.parentNode.appendChild(fresh);
    c.element.remove(); c.element = fresh; c.host.stateNode = fresh;
    fresh.setAttribute(c.role==='user'?'data-user-message-bubble':'data-message-author-role',c.role==='user'?'':c.role);
    Object.defineProperty(fresh, '__reactFiber$independent', { value: c.host });
    c.fiber.memoizedProps = { ...c.props };
  }
}

test('independent: account fence survives navigating away and back to retained old state', () => {
  const s = setup(); s.render(); assert.ok(s.badge());
  s.state.invalidate(); s.render(); assert.equal(s.badges.size, 0);
  s.page('https://chatgpt.com/c/chat-b'); s.render();
  s.page('https://chatgpt.com/c/chat-a'); s.render();
  assert.equal(s.badges.size, 0, 'account-fenced old source must remain fenced after SPA return');
});

test('independent: repeated auth fences cannot release an older mapping after remount', () => {
  const s = setup(); s.render(); s.state.invalidate(); s.render();
  s.state.invalidate(); remountOldSources(s); s.render();
  assert.equal(s.badges.size, 0, 'second invalidation cannot forget first fenced source');
});

test('independent: an outer message cannot claim a nested different message host', () => {
  const s = setup(); const [user, assistant] = s.components;
  user.fiber.child = assistant.fiber; user.fiber.sibling = null;
  assistant.fiber.return = user.fiber;
  user.element.remove();
  const targets = api.currentItemTargets(s.doc);
  assert.equal(targets.filter(t => t.id === user.id).length, 0);
  assert.equal(targets.filter(t => t.id === assistant.id).length, 1);
});

test('independent: disabled display does not inspect current item trees', () => {
  const s = setup(); s.state.setEnabled(false);
  s.render();
  assert.equal(s.state.nativeReader(s.doc).targets().length, 0);
});

test('independent: missing anchors do not trigger a generic page scan', () => {
  const s = setup({ noAnchor: true });
  s.mainHost.stateNode.tagName = 'SECTION';
  assert.equal(s.doc.querySelectorAll('main,[data-turn-key],[data-user-message-bubble],[data-chatgpt-conversation-selection-target],[data-app-action-timeline-scroll]').length, 0);
  s.render(); assert.equal(s.badges.size, 0);
});

test('independent: query fallback cannot reveal a previously unselected pre-auth snapshot', () => {
  const s = setup({ external: true });
  const oldQuery = s.boundary.memoizedState.next;
  oldQuery.memoizedState.data = { ...s.data, mapping: {
    question: { message: raw('question', 'user') }, answer: { message: raw('answer', 'assistant', { metadata: { model_slug: 'old-query' } }) }
  } };
  s.render(); assert.ok(s.badge());
  s.state.invalidate(); remountOldSources(s);
  s.boundary.memoizedState = oldQuery;
  s.render(); assert.equal(s.badges.size, 0);
});

test('independent: cloned cache wrappers cannot free a pre-auth message object', () => {
  const s = setup(); s.render(); s.state.invalidate(); remountOldSources(s);
  s.boundary.memoizedState = { memoizedState: { data: { ...s.data, mapping: { ...s.data.mapping } } } };
  s.render(); assert.equal(s.badges.size, 0);
});

test('independent: conversation boundary beats earlier broad main/root fallback and preview duplicates',()=>{
 const s=setup();const {root,boundary,mainHost,turnHost}=s;
 // Actual layout shell precedes and contains the conversation producer.
 root.child=mainHost;mainHost.return=root;mainHost.child=boundary;
 boundary.return=mainHost;boundary.child=turnHost;turnHost.return=boundary;
 const element=s.doc.createElement('div');mainHost.stateNode.appendChild(element);
 const preview={tag:0,return:mainHost,memoizedProps:{conversationId:'local-a',assistantItem:{type:'assistant-message',messageId:'answer'}},sibling:boundary};
 const host={tag:5,return:preview,stateNode:element,memoizedProps:{messageId:'answer'}};preview.child=host;
 Object.defineProperty(element,'__reactFiber$independent',{value:host});mainHost.child=preview;
 const targets=api.currentItemTargets(s.doc,'chat-a');
 assert.equal(targets.filter(t=>t.id==='answer').length,1);
 assert.equal(targets.find(t=>t.id==='answer').element,s.components[1].element);
 s.render();assert.equal(s.badges.size,2);assert.equal(element.querySelector('.chatgpt-toolkit-message-info'),null);
});
