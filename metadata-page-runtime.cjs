'use strict';
// Independent page-world metadata bridge. No GM API, application getter,
// module import, network API, or request payload is reachable from this closure.
function pageMetadataRuntime(config, transformFactory) {
  const win = window, doc = document, status = doc.getElementById(config.statusId);
  if (!status || win[config.key]) return;
  const descriptor = (object, key) => {
    if (!object || !['object', 'function'].includes(typeof object)) return undefined;
    try { const d = Object.getOwnPropertyDescriptor(object, key); return d && 'value' in d ? d.value : undefined; } catch { return undefined; }
  };
  const id = value => typeof value === 'string' && /^[a-z0-9:_-]{1,180}$/i.test(value) ? value : '';
  const model = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(value) ? value : '';
  const pageId = () => { try { return id(new URL(win.location.href).pathname.match(/\/c\/([^/]+)\/?$/)?.[1]); } catch { return ''; } };
  const mark = (name, value) => { try { status.setAttribute('data-' + name, String(value)); } catch {} };
  const counts = { mapping: 0, renderer: 0, labels: 0, factories: 0 };
  const count = name => mark(name, ++counts[name]);
  let enabled = !!config.enabled, epoch = 0, accountPaused = false, accountBoundarySeen = false, everObserved = false, accountFence = false, React, Context, LabelGuard, nativeRuntime, pendingFactory, accepting = false, queued = false;
  const rows = new Map(), listeners = new Set(), epochs = new WeakMap(), leases = new Set();
  const seen = object => { if (!epochs.has(object)) epochs.set(object, epoch); return epochs.get(object) === epoch; };
  function notify() {
    if (queued) return; queued = true;
    queueMicrotask(() => { queued = false; for (const listener of [...listeners]) { try { listener(); } catch {} } });
  }
  function scalar(message, conversation, key) {
    if (!message || typeof message !== 'object' || !seen(message)) return null;
    const messageId = id(descriptor(message, 'id')), author = descriptor(message, 'author'), role = descriptor(author, 'role');
    if (messageId !== key || !['user', 'assistant'].includes(role)) return null;
    const metadata = descriptor(message, 'metadata'), recipient = descriptor(message, 'recipient');
    if ((recipient && recipient !== 'all') || descriptor(metadata, 'is_visually_hidden_from_conversation')) return null;
    const value = descriptor(message, 'create_time'), milliseconds = typeof value === 'number' ? value * 1000 : NaN;
    const createdAt = Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 8640000000000000 ? milliseconds : null;
    const route = descriptor(metadata, 'server_ste_metadata');
    const responseModel = role === 'assistant' ? model(descriptor(metadata, 'resolved_model_slug')) || model(descriptor(route, 'model_slug')) || model(descriptor(metadata, 'model_slug')) : '';
    return { id: messageId, conversation, role, createdAt, model: responseModel, epoch };
  }
  function observe(value, conversation) {
    // This function runs only around a value the page itself already computed.
    // Auxiliary failures must not alter the original selector value or throw.
    try {
      if (accountPaused || !id(conversation) || !value || typeof value !== 'object' || Array.isArray(value)) return value;
      everObserved = true; count('mapping');
      // Replace this conversation's whitelist snapshot, including removals and
      // hidden/tool messages. Never retain the original mapping/message object.
      for (const [key, row] of rows) if (row.conversation === conversation) rows.delete(key);
      if (seen(value)) {
        const keys = Object.keys(value);
        for (const key of keys.slice(-5000)) {
          const node = descriptor(value, key), message = descriptor(node, 'message');
          const row = scalar(message, conversation, key);
          if (!row) continue;
          rows.set(conversation + '\0' + row.id + '\0' + row.role, row);
          while (rows.size > 500) rows.delete(rows.keys().next().value);
        }
      }
      mark('rows', rows.size); notify();
    } catch { mark('read', 'unsupported'); }
    return value;
  }
  function snapshot(identity, lease) {
    if (accountPaused || !enabled || !lease?.committed || !leases.has(lease) || lease.epoch !== epoch || !identity || identity.hidden) return '';
    const current = pageId();
    if (!current || identity.conversation !== lease.internal || (lease.browser || lease.internal) !== current) return '';
    const row = rows.get(identity.conversation + '\0' + identity.id + '\0' + identity.role);
    return row && row.epoch === epoch ? JSON.stringify([row.createdAt, row.model]) : '';
  }
  const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  function Label({ identity }) {
    const lease = React.useContext(Context);
    const data = React.useSyncExternalStore(subscribe, () => snapshot(identity, lease), () => '');
    const values = data ? JSON.parse(data) : [], createdAt = values[0], responseModel = values[1];
    const visible = !!(createdAt || responseModel);
    React.useLayoutEffect(() => {
      count('renderer');
      if (!visible) return undefined;
      mark('labels', ++counts.labels);
      return () => { mark('labels', counts.labels = Math.max(0, counts.labels - 1)); };
    }, [visible]);
    if (!visible) return null;
    try {
    const date = createdAt ? new Date(createdAt) : null;
    const text = [date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), responseModel].filter(Boolean).join(' · ');
    const title = [date ? '消息创建时间（本地）：' + date.toLocaleString() + ' (' + date.toISOString() + ')' : '', responseModel ? '响应模型：' + responseModel : ''].filter(Boolean).join('\n');
    return React.createElement('span', { className: 'chatgpt-toolkit-module-message-info', 'data-chatgpt-toolkit-info': '', title, 'aria-label': title,
      style: { display: 'block', maxWidth: '100%', marginTop: 6, font: '11px/1.5 system-ui,sans-serif', color: 'inherit', opacity: 0.65, overflowWrap: 'anywhere', userSelect: 'text' } }, text);
    } catch { mark('render', 'unsupported'); return null; }
  }
  function Lease({ value, children }) {
    React.useLayoutEffect(() => {
      everObserved = true; value.committed = true; leases.add(value); count('renderer'); notify();
      return () => { value.committed = false; leases.delete(value); notify(); };
    }, [value]);
    return children;
  }
  function ready(react) {
    const api = {};
    if (React) return true;
    for (const key of ['createElement', 'createContext', 'useContext', 'useSyncExternalStore', 'useLayoutEffect', 'Component', 'Fragment']) api[key] = descriptor(react, key);
    if (!['createElement', 'createContext', 'useContext', 'useSyncExternalStore', 'useLayoutEffect', 'Component'].every(key => typeof api[key] === 'function') || !api.Fragment) return false;
    React = api; Context = React.createContext(null);
    LabelGuard = class extends React.Component {
      constructor(props) { super(props); this.state = { failed: false }; }
      static getDerivedStateFromError() { return { failed: true }; }
      componentDidCatch() { mark('render', 'unsupported'); }
      render() { return this.state.failed ? null : this.props.children; }
    };
    mark('react', 'ready'); return true;
  }
  function loadedReact(preferred) {
    if (React || ready(preferred)) return true;
    // Inspect exports that native webpack has already initialized. Never invoke
    // require, export getters, lazy loaders, or application hooks to obtain them.
    const cache = descriptor(nativeRuntime, 'c');
    if (!cache) return false;
    for (const key of Object.keys(cache).slice(0, 20000)) {
      const exports = descriptor(descriptor(cache, key), 'exports');
      if (ready(exports) || ready(descriptor(exports, 'default'))) return true;
    }
    return false;
  }
  const ownLabel = identity => React.createElement(LabelGuard, null, React.createElement(Label, { identity }));
  function message(original, react, assistant) {
    if (typeof original !== 'function') return original;
    return function () {
      let usable = false, identity = null, renderArgs = arguments;
      try {
        usable = loadedReact(react);
        const props = arguments[0], item = descriptor(props, assistant ? 'assistantItem' : 'item');
        const role = assistant ? 'assistant' : 'user', conversation = id(descriptor(props, 'conversationId'));
        const messageId = id(descriptor(item, 'latestMessageId')) || (!assistant && id(descriptor(item, 'serverMessageId'))) || id(descriptor(item, 'messageId'));
        identity = descriptor(item, 'type') === role + '-message' && messageId && conversation ? { id: messageId, role, conversation } : null;
        if (usable && assistant) {
          // The native action-row slot owns visibility and placement. Only this
          // presentation prop is extended; original action objects stay intact.
          const sourcesAction = descriptor(props, 'sourcesAction');
          const descriptors = Object.getOwnPropertyDescriptors(props);
          descriptors.sourcesAction = { value: React.createElement(React.Fragment, null, sourcesAction, ownLabel(identity)), enumerable: true, configurable: true, writable: true };
          renderArgs = Array.from(arguments); renderArgs[0] = Object.create(Object.getPrototypeOf(props), descriptors);
        }
      } catch { usable = false; renderArgs = arguments; mark('render', 'unsupported'); }
      const result = Reflect.apply(original, this, renderArgs);
      if (!usable) return result;
      try {
        const resultProps = descriptor(result, 'props'), style = descriptor(resultProps, 'style');
        const hidden = result == null || result === false || descriptor(resultProps, 'hidden') || descriptor(resultProps, 'inert') || descriptor(resultProps, 'aria-hidden') === true || descriptor(resultProps, 'aria-hidden') === 'true' || descriptor(style, 'display') === 'none' || ['hidden','collapse'].includes(descriptor(style, 'visibility'));
        if (assistant) {
          const representative = id(descriptor(resultProps, 'messageId'));
          if (identity) { if (representative) identity.id = representative; identity.hidden = !!hidden; }
          return result;
        }
        // The own label subtree remains stable while the display preference
        // changes. Store notifications never re-execute the native renderer.
        return React.createElement(React.Fragment, null, result, ownLabel(hidden ? null : identity));
      } catch { mark('render', 'unsupported'); return result; }
    };
  }
  function boundary(original, react) {
    if (typeof original !== 'function') return original;
    return function () {
      const result = Reflect.apply(original, this, arguments);
      try {
        if (!loadedReact(react)) { mark('react', 'unsupported'); return result; }
        const props = arguments[0];
        const value = { internal: id(descriptor(props, 'conversationId')), browser: id(descriptor(props, 'browserConversationId')), epoch, committed: false };
        return React.createElement(Context.Provider, { value }, React.createElement(Lease, { value }, result));
      } catch { mark('render', 'unsupported'); return result; }
    };
  }
  const bridge = Object.freeze({ observe, message, boundary, accept(factory) { if (accepting && typeof factory === 'function') pendingFactory = factory; } });
  Object.defineProperty(win, config.key, { value: bridge, configurable: true });
  mark('page', 'ready'); mark('enabled', enabled ? 'on' : 'off');
  function resetAccount(kind) {
    const startup = (kind === 'session' || kind === 'read') && !accountBoundarySeen && !everObserved;
    if (!startup) accountBoundarySeen = true; epoch++; rows.clear(); mark('rows', 0);
    if (!startup) { accountPaused = true; mark('account', 'paused-account'); }
    else mark('account', 'ready');
    notify();
  }
  function accountKind(input, init) {
    try {
      let address = typeof input === 'string' ? input : descriptor(input, 'url');
      let method = descriptor(init, 'method') || descriptor(input, 'method');
      if (typeof address !== 'string' && input && typeof input === 'object') {
        const requestPrototype = win.Request?.prototype;
        const requestUrl = requestPrototype && Object.getOwnPropertyDescriptor(requestPrototype, 'url')?.get;
        const requestMethod = requestPrototype && Object.getOwnPropertyDescriptor(requestPrototype, 'method')?.get;
        try { if (requestUrl) { address = Reflect.apply(requestUrl, input, []); if (!method && requestMethod) method = Reflect.apply(requestMethod, input, []); } } catch {}
        if (typeof address !== 'string') { const href = Object.getOwnPropertyDescriptor(win.URL.prototype, 'href')?.get; if (href) address = Reflect.apply(href, input, []); }
      }
      if (typeof address !== 'string') return '';
      const url = new URL(address, win.location.href);
      if (url.origin !== win.location.origin || !/^\/(?:api\/auth(?:\/|$)|backend-api\/(?:accounts?|me)(?:\/|$))/.test(url.pathname)) return '';
      // Never invoke arbitrary init accessors or coercion methods. An opaque
      // method on an auth URL is a conservative account boundary.
      const methodProperty = init && Object.getOwnPropertyDescriptor(init, 'method');
      if (methodProperty && !('value' in methodProperty)) return 'invalidate';
      if (init && !methodProperty) {
        let prototype = Object.getPrototypeOf(init), depth = 0;
        while (prototype && depth++ < 8) { if (Object.getOwnPropertyDescriptor(prototype, 'method')) return 'invalidate'; prototype = Object.getPrototypeOf(prototype); }
        if (prototype) return 'invalidate';
      }
      if ((!method || typeof method === 'string' && method.toUpperCase() === 'GET') && /^\/api\/auth\/session\/?$/.test(url.pathname)) return 'session';
      if ((!method || typeof method === 'string' && method.toUpperCase() === 'GET') && /^\/backend-api\/(?:accounts?|me)(?:\/|$)/.test(url.pathname)) return 'read';
      return 'invalidate';
    } catch { return ''; }
  }
  try {
    const fetch = win.fetch;
    if (typeof fetch === 'function') {
      const observedFetch = new Proxy(fetch, { apply(target, receiver, argumentsList) {
        try { const kind = accountKind(argumentsList[0], argumentsList[1]); if (kind) resetAccount(kind); } catch {}
        return Reflect.apply(target, receiver, argumentsList);
      } });
      win.fetch = observedFetch; accountFence = win.fetch === observedFetch;
    }
  } catch {}
  mark('account-fence', accountFence ? 'installed' : 'not-active');
  if (!accountFence) { accountPaused = true; mark('account', 'paused-account'); }
  doc.addEventListener(config.eventName, event => {
    if (typeof event.detail !== 'string') return;
    if (event.detail === 'on' || event.detail === 'off') {
      enabled = event.detail === 'on'; mark('enabled', enabled ? 'on' : 'off'); notify();
    } else if (event.detail === 'invalidate' || event.detail === 'session' || event.detail === 'read') resetAccount(event.detail);
    else if (event.detail === 'request-session' || event.detail === 'request-read' || event.detail === 'request-invalidate') { if (!accountFence) resetAccount(event.detail.slice(8)); }
    else if (event.detail === 'route') notify();
  });
  win.addEventListener('popstate', notify);
  win.addEventListener('pagehide', () => { epoch++; rows.clear(); accountPaused = true; mark('account', 'paused-account'); notify(); });
  function compile(expression) {
    const script = doc.createElement('script');
    script.nonce = doc.currentScript?.nonce || doc.querySelector('script[nonce]')?.nonce || '';
    script.textContent = 'globalThis[' + JSON.stringify(config.key) + '].accept((' + expression + '));';
    pendingFactory = undefined; accepting = true;
    try { (doc.head || doc.documentElement).appendChild(script); return pendingFactory; }
    finally { accepting = false; pendingFactory = undefined; script.remove(); }
  }
  function install(require, enteringModuleId) {
    nativeRuntime = require;
    const table = descriptor(require, 'm'), processed = new WeakMap(), matched = new Map();
    const patch = (moduleId, factory) => {
      if (typeof factory !== 'function') return factory;
      if (processed.has(factory)) return processed.get(factory);
      let next = factory;
      try {
        const source = Function.prototype.toString.call(factory);
        const transformed = transformFactory(source, 'globalThis[' + JSON.stringify(config.key) + ']');
        if (transformed.changed) {
          if (matched.has(transformed.kind) && matched.get(transformed.kind) !== String(moduleId)) { mark('patch', 'ambiguous'); return factory; }
          // Never force a module that the page already initialized to execute.
          if (descriptor(descriptor(require, 'c'), moduleId) && String(moduleId) !== String(enteringModuleId)) { mark('patch', 'needs-refresh'); return factory; }
          next = compile(transformed.expression);
          if (typeof next !== 'function') { next = factory; mark('patch', 'page-compile-failed'); }
          else { matched.set(transformed.kind, String(moduleId)); count('factories'); mark('patch', 'installed'); }
        }
      } catch { mark('patch', 'unsupported'); }
      processed.set(factory, next); return next;
    };
    for (const moduleId of Object.keys(table).slice(0, 50000)) {
      const factory = descriptor(table, moduleId), patched = patch(moduleId, factory);
      if (factory !== patched) Reflect.set(table, moduleId, patched);
    }
    const proxy = new Proxy(table, { set(target, moduleId, factory, receiver) { return Reflect.set(target, moduleId, patch(moduleId, factory), receiver); } });
    Reflect.set(require, 'm', proxy);
    mark('registry', descriptor(require, 'm') === proxy ? 'installed' : 'not-active');
    return table;
  }
  const prototype = win.Function.prototype, original = prototype.call;
  let runtime = null, timer;
  const hook = new Proxy(original, { apply(target, receiver, args) {
    const module = args[1], exports = args[2], require = args[3], moduleId = descriptor(module, 'id');
    if (!runtime && typeof require === 'function' && typeof descriptor(require, 'C') === 'function' && descriptor(descriptor(require, 'm'), moduleId) === receiver && descriptor(descriptor(require, 'c'), moduleId) === module && args[0] === exports && descriptor(module, 'exports') === exports) {
      runtime = require; if (prototype.call === hook) prototype.call = original; clearTimeout(timer); mark('runtime', 'found');
      let factory = receiver;
      try { const table = install(require, moduleId); factory = descriptor(table, moduleId) || receiver; } catch { mark('patch', 'unsupported'); }
      return Reflect.apply(factory, args[0], args.slice(1));
    }
    return Reflect.apply(target, receiver, args);
  } });
  try { prototype.call = hook; mark('hook', prototype.call === hook ? 'installed' : 'not-active'); }
  catch { mark('hook', 'failed'); }
  timer = setTimeout(() => { if (!runtime) { if (prototype.call === hook) prototype.call = original; mark('runtime', 'not-seen-refresh'); } }, 15000);
}
module.exports = { pageMetadataRuntime };
