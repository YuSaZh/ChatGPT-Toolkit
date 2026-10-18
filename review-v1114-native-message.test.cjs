'use strict';
// Independent public-asset-derived acceptance checks. No live user data or requests.
// Public build a55478c3: _mn receives { conversation, messages } and renders
// DOM ID/role from messages[0]; hydration N0 preserves {...message, clientMetadata}.
// This fixture models React's committed root and alternate graph, not collector helpers.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const created = 1770000000;
function raw(id = 'answer', role = 'assistant', extras = {}) {
  const result = { id, author: { role }, recipient: 'all', create_time: created,
    metadata: { model_slug: 'model-label', resolved_model_slug: 'model-resolved' }, ...extras };
  Object.defineProperty(result, 'content', { enumerable: true, get() { throw Error('chat content must not be inspected'); } });
  return result;
}
function setup({ message = raw(), id = 'answer', role = 'assistant', conversation = 'chat-a', withConversation = true } = {}) {
  let page = 'https://chatgpt.com/c/chat-a';
  let requests = 0;
  const env = environment({ fetch() { requests++; throw Error('no requests permitted'); } });
  const doc = env.document, state = api.createMessageInfoState({ page: () => page }), badges = new Map();
  const element = doc.createElement('div');
  element.setAttribute('data-message-id', id);
  element.setAttribute('data-message-author-role', role);
  doc.body.appendChild(element);
  const root = { tag: 3, return: null, alternate: null };
  root.stateNode = { current: root };
  const props = { messages: [message], ...(withConversation ? { conversation: { id: conversation } } : {}) };
  const component = { tag: 0, memoizedProps: props, return: root, alternate: null };
  const host = { tag: 5, stateNode: element, memoizedProps: { 'data-message-id': id, 'data-message-author-role': role }, return: component, alternate: null };
  root.child = component; component.child = host;
  Object.defineProperty(element, '__reactFiber$fixture', { configurable: true, value: host });
  function commit(nextProps) {
    const nextRoot = { ...root, alternate: root }, nextComponent = { ...component, memoizedProps: nextProps, return: nextRoot, alternate: component };
    const nextHost = { ...host, return: nextComponent, alternate: host };
    root.alternate = nextRoot; component.alternate = nextComponent; host.alternate = nextHost;
    nextRoot.child = nextComponent; nextComponent.child = nextHost; root.stateNode.current = nextRoot;
    return { root: nextRoot, component: nextComponent, host: nextHost };
  }
  return { env, doc, state, badges, element, props, component, host, root, commit,
    page(value) { page = value; }, requests: () => requests,
    render() { api.renderMessageInfo(doc, state, badges); }, badge() { return element.querySelector('.chatgpt-toolkit-message-info'); } };
}

test('already hydrated raw message props render both protocol time and response model with no intercepted fetch', () => {
  const s = setup(); s.render(); assert.ok(s.badge());
  assert.match(s.badge().textContent, /model-resolved/); assert.match(s.badge().getAttribute('title'), /2026-02-02T02:40:00.000Z/);
  assert.equal(s.requests(), 0);
});
test('hide then show restores already hydrated metadata without a reload or new request', () => {
  const s = setup(); s.render(); assert.ok(s.badge()); s.state.setEnabled(false); s.render(); assert.equal(s.badge(), null);
  s.state.setEnabled(true); s.render(); assert.ok(s.badge()); assert.equal(s.requests(), 0);
});
test('native user message shows time but never response model', () => {
  const s = setup({ message: raw('answer', 'user'), role: 'user' }); s.render(); assert.ok(s.badge());
  assert.doesNotMatch(s.badge().textContent, /model-/);
});
test('committed alternate supplies metadata rather than stale attached fiber', () => {
  const s = setup(); s.commit({ ...s.props, messages: [raw('answer', 'assistant', { metadata: { resolved_model_slug: 'current-model' } })] });
  s.render(); assert.ok(s.badge()); assert.match(s.badge().textContent, /current-model/); assert.doesNotMatch(s.badge().textContent, /model-resolved/);
});
test('shared-parent alternates use committed child membership rather than root identity alone', () => {
  const s = setup();
  const component = { ...s.component, memoizedProps: { ...s.props, messages: [raw('answer', 'assistant', { metadata: { resolved_model_slug: 'current-model' } })] }, return: s.root, alternate: s.component };
  const host = { ...s.host, return: component, alternate: s.host };
  component.child = host; s.component.alternate = component; s.host.alternate = host; s.root.child = component;
  // React's own current-fiber resolver handles alternates whose return is shared
  // by checking the parent's child lists; both roots alone are indistinguishable.
  s.render(); assert.ok(s.badge()); assert.match(s.badge().textContent, /current-model/); assert.doesNotMatch(s.badge().textContent, /model-resolved/);
});
test('committed hidden alternate removes prior label even if old attached fiber still looks visible', () => {
  const s = setup(); s.render(); assert.ok(s.badge());
  s.commit({ ...s.props, messages: [raw('answer', 'assistant', { metadata: { is_visually_hidden_from_conversation: true, resolved_model_slug: 'hidden-model' } })] });
  s.render(); assert.equal(s.badge(), null);
});
test('authoritative hidden native metadata vetoes an older visible network-cache record', () => {
  const s = setup();
  s.state.history(s.state.capture('chat-a'), { conversation_id: 'chat-a', mapping: { answer: { message: raw() } } });
  s.render(); assert.ok(s.badge());
  s.commit({ ...s.props, messages: [raw('answer', 'assistant', { metadata: { is_visually_hidden_from_conversation: true, resolved_model_slug: 'hidden-model' } })] });
  s.render(); assert.equal(s.badge(), null);
});
test('current resolved native model supersedes same-rank stale network-cache model', () => {
  const s = setup();
  s.state.history(s.state.capture('chat-a'), { conversation_id: 'chat-a', mapping: { answer: { message: raw() } } });
  s.commit({ ...s.props, messages: [raw('answer', 'assistant', { metadata: { resolved_model_slug: 'current-model' } })] });
  s.render(); assert.ok(s.badge()); assert.match(s.badge().textContent, /current-model/); assert.doesNotMatch(s.badge().textContent, /model-resolved/);
});
test('exact DOM message ID is required, with no position or first-message fallback', () => {
  const s = setup({ id: 'other-message' }); s.render(); assert.equal(s.badge(), null);
});
test('exact role is required and cannot be borrowed from another rendered message', () => {
  const s = setup({ role: 'user' }); s.render(); assert.equal(s.badge(), null);
});
test('another conversation raw props cannot hydrate the current page', () => {
  const s = setup({ conversation: 'other-chat' }); s.render(); assert.equal(s.badge(), null);
});
test('missing conversation identity is not filled from the URL by assumption', () => {
  const s = setup({ withConversation: false }); s.render(); assert.equal(s.badge(), null);
});
test('new page navigation cannot reuse old native message metadata', () => {
  const s = setup(); s.render(); assert.ok(s.badge()); s.page('https://chatgpt.com/c/chat-b'); s.render(); assert.equal(s.badge(), null);
});
test('recycled DOM node cannot retain the previous message label', () => {
  const s = setup(); s.render(); assert.ok(s.badge()); s.element.setAttribute('data-message-id', 'other-answer'); s.render(); assert.equal(s.badge(), null);
});
test('grouped display uses its exact first representative and never the final grouped message', () => {
  const s = setup(); s.props.messages = [raw(), raw('also-not-this', 'assistant', { metadata: { model_slug: 'wrong-last' } })];
  s.render(); assert.ok(s.badge()); assert.match(s.badge().textContent, /model-resolved/); assert.doesNotMatch(s.badge().textContent, /wrong-/);
});
test('repeated renders do not create duplicate native metadata badges', () => {
  const s = setup(); s.render(); s.render(); s.render(); assert.equal(s.element.querySelectorAll('.chatgpt-toolkit-message-info').length, 1);
});
test('metadata-only display never evaluates chat content, server-ID signals, or app callbacks', () => {
  const s = setup(); s.props.conversation.serverId$ = () => assert.fail('must not execute native signal'); s.props.onEditMessage = () => assert.fail('must not execute app callback');
  s.render(); assert.ok(s.badge()); assert.equal(s.requests(), 0);
});
test('metadata accessors do not execute while scanning native state', () => {
  const message = raw(); Object.defineProperty(message, 'metadata', { get() { assert.fail('metadata getter executed'); } });
  const s = setup({ message }); assert.doesNotThrow(() => s.render());
  if (s.badge()) assert.doesNotMatch(s.badge().textContent, /model-/);
});
test('client-only conversation identity mismatch is not guessed by invoking serverId$ signal', () => {
  const s = setup({ conversation: 'new-client-conversation' });
  s.props.conversation.serverId$ = () => assert.fail('must not execute native signal'); s.render(); assert.equal(s.badge(), null);
});
test('account fence cannot be bypassed by replacing only props on the same message node and identity', () => {
  const s = setup(); s.render(); assert.ok(s.badge()); s.state.invalidate(); s.render(); assert.equal(s.badge(), null);
  s.commit({ ...s.props, messages: [raw()] }); s.render(); assert.equal(s.badge() === null, true);
});
test('natural network data may repopulate after account fence without unblocking stale native props', () => {
  const s = setup(); s.render(); assert.ok(s.badge()); s.state.invalidate();
  s.state.history(s.state.capture('chat-a'), { conversation_id: 'chat-a', mapping: { answer: { message: raw('answer', 'assistant', { metadata: { resolved_model_slug: 'fresh-network' } }) } } });
  s.render(); assert.ok(s.badge()); assert.match(s.badge().textContent, /fresh-network/);
});

test('uncommitted or detached Fiber metadata is omitted', () => {
  const s = setup(); s.root.stateNode.current = {}; s.render(); assert.equal(s.badge(), null);
});
test('native prop getters and message array getters are never evaluated', () => {
  for (const mode of ['props', 'index']) {
    const s = setup();
    if (mode === 'props') Object.defineProperty(s.props, 'messages', { get() { assert.fail('props getter'); } });
    else Object.defineProperty(s.props.messages, '0', { get() { assert.fail('array getter'); } });
    s.render(); assert.equal(s.badge(), null);
  }
});
test('a native non-all recipient vetoes a previously cached visible message', () => {
  const s = setup(); s.state.history(s.state.capture('chat-a'), { conversation_id: 'chat-a', mapping: { answer: { message: raw() } } });
  s.props.messages = [raw('answer', 'assistant', { recipient: 'python' })]; s.render(); assert.equal(s.badge(), null);
});
test('project-prefixed conversation URL uses the same exact conversation fence', () => {
  const s = setup(); s.page('https://chatgpt.com/g/g-p-project/project/c/chat-a'); s.render(); assert.ok(s.badge());
  s.page('https://chatgpt.com/g/g-p-project/project/c/chat-b'); s.render(); assert.equal(s.badge(), null);
});
test('new chat native props wait for a matching canonical conversation URL', () => {
  const s = setup(); s.page('https://chatgpt.com/'); s.render(); assert.equal(s.badge(), null);
  s.page('https://chatgpt.com/c/chat-a'); s.render(); assert.ok(s.badge());
});
test('native DOM model attribute alone never guesses conversation membership', () => {
  const s = setup(); delete s.element.__reactFiber$fixture;
  s.element.setAttribute('data-message-model-slug', 'native-attribute-model'); s.render(); assert.equal(s.badge(), null);
  s.state.history(s.state.capture('chat-a'), { conversation_id: 'chat-a', mapping: { answer: { message: raw('answer', 'assistant', { create_time: null, metadata: {} }) } } });
  s.render(); assert.match(s.badge().textContent, /native-attribute-model/);
  s.page('https://chatgpt.com/c/chat-b'); s.render(); assert.equal(s.badge(), null);
});
test('ordinary hide/show clears owned cache and restores direct props without persisting them', () => {
  const s = setup(); s.render(); assert.equal(s.state.size(), 0);
  s.state.setEnabled(false); s.render(); s.state.setEnabled(true); s.render(); assert.ok(s.badge());
  assert.equal(s.state.size(), 0); assert.equal(s.env.store.has('gpc.v1.messageInfo'), false);
});
test('bounded parent traversal omits excessive depth rather than scanning whole state', () => {
  const s = setup(); let previous = s.component;
  for (let i = 0; i < 1100; i++) { const parent = { return: s.root, child: previous, memoizedProps: {} }; previous.return = parent; previous = parent; }
  s.root.child = previous; s.render(); assert.equal(s.badge(), null);
});
test('bounded committed-tree index omits nodes beyond its total traversal budget', () => {
  const s = setup(); let first = s.component;
  for (let i = 0; i < 24001; i++) first = { return: s.root, sibling: first };
  s.root.child = first; s.render(); assert.equal(s.badge(), null);
});
test('render diagnostic reports only fixed labels and counts', () => {
  const s = setup(), report = api.renderMessageInfo(s.doc, s.state, s.badges);
  assert.equal(report.messageNodes, 1); assert.equal(report.messageNative, 1); assert.equal(report.messageBadges, 1);
  assert.equal(report.messageFiberPaths, 1); assert.equal(report.messagePropSources, 1);
  assert.doesNotMatch(JSON.stringify(report), /chat-a|answer|model-resolved|1770000000/);
});
test('normal diagnostic menu exposes message-path counts without a console snippet', () => {
  const env = environment(); env.flush();
  env.menus.find(menu => menu.label === '诊断 Pro 计数器').fn();
  const text = env.alerts.at(-1); assert.match(text, /原生已提交路径:/); assert.match(text, /原生消息属性:/); assert.match(text, /账号边界隔离节点:/); assert.match(text, /消息标签:/);
  assert.equal(env.errors.length, 0);
});
