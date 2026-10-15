'use strict';
// This fixture runs the genuine React production reconciler. It never writes
// Fiber objects or their private fields; it only renders ordinary components.
const React = require('react');
const { createRoot } = require('react-dom/client');
const { flushSync } = require('react-dom');
const api = window.toolkitApi;
let bump, suspend, cancel, renderCount = 0, boundaryCount = 0, snapshotCalls = 0;
const mapping = {
  question: { message: { id: 'question', author: { role: 'user' }, recipient: 'all', create_time: 1770000000, metadata: {} } },
  answer: { message: { id: 'answer', author: { role: 'assistant' }, recipient: 'all', create_time: 1770000000, metadata: { resolved_model_slug: 'real-react-model' } } }
};
function Message(props) {
  return React.createElement('div', {
    id: props.item ? 'question' : 'answer',
    'data-user-message-bubble': props.item ? '' : undefined
  }, props.item ? 'Synthetic question' : 'Synthetic answer');
}
const messages = [
  React.createElement(Message, { key: 'q', conversationId: 'local-a', item: { type: 'user-message', messageId: 'question' } }),
  React.createElement(Message, { key: 'a', conversationId: 'local-a', assistantItem: { type: 'assistant-message', messageId: 'answer' } })
];
const Boundary = React.memo(function Boundary() {
  boundaryCount++;
  if (window.cacheKind === 'external') React.useSyncExternalStore(
    () => () => {}, () => { snapshotCalls++; return mapping; }, () => mapping
  );
  else React.useState({ data: { conversation_id: 'chat-a', mapping } });
  return React.createElement('main', { 'data-app-action-timeline-scroll': '' }, messages);
});
const boundaryProps = { conversationId: 'local-a', browserConversationId: 'chat-a', renderedTurns: [] };
const pending = new Promise(() => {});
function Suspend({ active }) { if (active) throw pending; return null; }
function App() {
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  bump = () => setCount(value => value + 1);
  suspend = () => React.startTransition(() => setLoading(true));
  cancel = () => { setLoading(false); setCount(value => value + 1); };
  renderCount++;
  return React.createElement('div', null,
    React.createElement('p', { id: 'count' }, count),
    React.createElement(Boundary, boundaryProps),
    React.createElement(Suspend, { active: loading }));
}
const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(React.createElement(App)));
const state = api.createMessageInfoState({ page: () => 'https://chatgpt.com/c/chat-a' });
const badges = new Map();
const mountedHost = document.getElementById('answer');
function inspect() {
  const host = document.getElementById('answer');
  const before = snapshotCalls;
  const index = api.createCommittedMessageIndex(document);
  const result = {
    reactVersion: React.version, renderCount, boundaryCount,
    sameConnectedHost: host === mountedHost && host.isConnected,
    // Retained 1.1.15 strict-return algorithm, unchanged in production source.
    oldAncestors: api.currentMessageAncestors(host).length,
    canonicalAncestors: index.chain(host).length,
    targets: api.currentItemTargets(document, 'chat-a', index).length,
    labels: api.renderMessageInfo(document, state, badges).messageBadges,
    text: host.querySelector('.chatgpt-toolkit-message-info')?.textContent
  };
  result.inspectionSnapshotCalls = snapshotCalls - before;
  return result;
}
window.fixtureApi = {
  inspect,
  bump() { flushSync(() => bump()); return inspect(); },
  suspend() { suspend(); },
  cancel() { flushSync(() => cancel()); return inspect(); },
  unmount() { flushSync(() => root.unmount()); }
};
