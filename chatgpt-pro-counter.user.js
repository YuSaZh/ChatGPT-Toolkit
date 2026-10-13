// ==UserScript==
// @name         ChatGPT Pro 本机计数器
// @namespace    local.chatgpt.pro-counter
// @version      1.1.8
// @homepageURL  https://github.com/YuSaZh/ChatGPT-Toolkit
// @supportURL   https://github.com/YuSaZh/ChatGPT-Toolkit/issues
// @updateURL    https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js
// @downloadURL  https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js
// @description  ChatGPT Toolkit：Pro 本机统计、被动 PoW/图片状态、可选账号分账与 WebDAV 同步。非官方工具。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-start
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @connect      *
// @grant        GM_registerMenuCommand
// @noframes
// @license      MIT
// ==/UserScript==

/* Legacy @name/@namespace and filename intentionally preserve existing installs and storage. */
/* Original implementation. No third-party runtime or ChatGPT API polling. WebDAV is explicitly opt-in. */
(function (factory) {
  'use strict';
  // Register recovery/diagnostic commands before the application factory runs.
  // A missing command can then be distinguished from a failure inside boot().
  const browser = typeof window !== 'undefined' && typeof document !== 'undefined';
  let diagnostics;
  if (browser) {
    const state = { version: '1.1.8', phase: 'entry', frame: 'unchecked', storage: 'unchecked', ui: 'not-started', observer: 'not-started', menu: 'unavailable', hoverListeners: 'not-started', hoverEvent: 'none', hoverMatch: 'unchecked', hoverScope: 'unchecked', hoverCard: 'hidden', hoverPaint: 'unchecked', hoverEditors: 0, hoverMarkers: 0, hoverSends: 0, errors: [] };
    diagnostics = {
      state, open: null, inspectHover: null,
      mark(phase, details = {}) { Object.assign(state, details, { phase }); },
      fail(phase, error) {
        const names = ['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'SecurityError', 'InvalidStateError', 'NotSupportedError', 'QuotaExceededError', 'AbortError'];
        const name = names.includes(error?.name) ? error.name : 'Error';
        // The shareable report contains only our phase labels and error types.
        // Full exception details stay in the local developer console.
        const detail = `${phase}: ${name}`;
        if (!state.errors.includes(detail)) { state.errors.push(detail); if (state.errors.length > 5) state.errors.shift(); }
        try { console.error('[Pro Counter]', detail, error); } catch { /* diagnostic logging is optional */ }
      },
      show() {
        try { diagnostics.inspectHover?.(); } catch (error) { diagnostics.fail('hover-diagnostics', error); }
        const text = ['Pro 计数器启动诊断', `脚本版本: ${state.version}`, `启动阶段: ${state.phase}`, `页面检查: ${state.frame}`, `存储接口: ${state.storage}`, `界面状态: ${state.ui}`, `观察器: ${state.observer}`, `菜单接口: ${state.menu}`, `悬停监听: ${state.hoverListeners}`, `可见输入框: ${state.hoverEditors}`, `可见模型标记: ${state.hoverMarkers}`, `可见发送锚点: ${state.hoverSends}`, `最近悬停事件: ${state.hoverEvent}`, `最近控件匹配: ${state.hoverMatch}`, `最近输入框范围: ${state.hoverScope}`, `浮卡状态: ${state.hoverCard}`, `最近显示检查: ${state.hoverPaint}`, `document.readyState: ${document.readyState}`, `近期错误: ${state.errors.length ? state.errors.join('\n') : '无'}`, '此报告不读取聊天内容、计数记录或 WebDAV 凭据。'].join('\n');
        try { if (typeof window.alert === 'function') window.alert(text); else console.info(text); } catch { /* retain the return value for diagnostics */ }
        return text;
      }
    };
    try {
      if (typeof GM_info === 'object' && GM_info?.script?.version) state.version = String(GM_info.script.version);
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('显示 Pro 计数器', () => {
          try { if (diagnostics.open) diagnostics.open(); else diagnostics.show(); }
          catch (error) { diagnostics.fail('menu-open', error); diagnostics.show(); }
        });
        GM_registerMenuCommand('诊断 Pro 计数器', () => diagnostics.show());
        state.menu = 'registered';
      }
    } catch (error) { state.menu = 'failed'; diagnostics.fail('menu-register', error); }
  }
  try {
    diagnostics?.mark('factory');
    const api = factory(diagnostics);
    // A page may expose a CommonJS-looking global. Only export in a non-browser runtime.
    if (typeof window === 'undefined' && typeof module === 'object' && module.exports) module.exports = api;
    else if (browser) { diagnostics.mark('boot'); api.boot(); }
  } catch (error) {
    if (!diagnostics) throw error;
    diagnostics.fail(diagnostics.state.phase, error);
    diagnostics.mark('failed');
  }
})(function (diagnostics) {
  'use strict';
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const PREFIX = 'gpc.v1.';
  const MAX_BODY = 1024 * 1024;
  const MAX_STREAM = 256 * 1024;
  const MAX_IMPORT = 5 * 1024 * 1024;
  const STATES = new Set(['pending', 'accepted', 'failed', 'aborted', 'unknown', 'manual']);
  const OBSERVATIONS = new Set(['pending', 'http', 'metadata', 'done', 'handoff', 'bounded', 'unreadable', 'error', 'manual']);
  const uuid = () => crypto.randomUUID();
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const slug = v => typeof v === 'string' && /^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(v) ? v : '';
  const shortId = v => typeof v === 'string' && /^[a-z0-9:_-]{1,180}$/i.test(v) ? v : '';
  const modelKind = value => {
    const s = slug(value).toLowerCase();
    if (!s || ['auto', 'default', 'unknown'].includes(s)) return 'unknown';
    // Token boundaries prevent project/profile/proxy from becoming Pro.
    if (/(^|[-_:])pro($|[-_:])/.test(s)) return 'pro';
    if (/(^|[-_:])(thinking|reasoning)($|[-_:])/.test(s)) return 'thinking';
    return 'other';
  };
  const finiteDate = n => Number.isFinite(n) && n > 0 && n < 4102444800000;
  function defaultSettings(now = Date.now()) {
    const day = new Date(now); day.setHours(0, 0, 0, 0);
    return { v: 1, id: 'default', updated: 0, cap: 100, mode: 'fixed', anchor: day.getTime(), ledger: 'default', label: '默认账本' };
  }
  function validSettings(v) {
    if (!v || v.v !== 1 || !shortId(v.id) || !Number.isFinite(v.updated) || !Number.isInteger(v.cap) || v.cap < 1 || v.cap > 1000000 || !['fixed', 'rolling'].includes(v.mode) || !finiteDate(v.anchor) || !shortId(v.ledger)) throw Error('设置格式不正确');
    return { v: 1, id: v.id, updated: v.updated, cap: v.cap, mode: v.mode, anchor: v.anchor, ledger: v.ledger, label: String(v.label || '账本').slice(0, 40) };
  }
  function validEvent(v) {
    if (!v || v.v !== 1 || !shortId(v.id) || !shortId(v.key) || !shortId(v.ledger) || !finiteDate(v.at) || !finiteDate(v.updated) || !STATES.has(v.state) || !OBSERVATIONS.has(v.observation)) throw Error('记录格式不正确');
    if (!Number.isInteger(v.delta) || Math.abs(v.delta) > 1000000 || (v.state !== 'manual' && v.delta !== 0)) throw Error('校准数字不正确');
    return { v: 1, id: v.id, key: v.key, ledger: v.ledger, at: v.at, updated: v.updated,
      state: v.state, observation: v.observation, delta: v.delta,
      requested: slug(v.requested), route: slug(v.route), label: slug(v.label),
      conflict: !!v.conflict, stable: !!v.stable, http: Number.isInteger(v.http) && v.http >= 100 && v.http <= 599 ? v.http : 0 };
  }
  function windowFor(settings, now = Date.now()) {
    if (settings.mode === 'rolling') return { start: now - WEEK, end: now, next: null };
    const start = settings.anchor + Math.floor((now - settings.anchor) / WEEK) * WEEK;
    return { start, end: start + WEEK, next: start + WEEK };
  }
  function kindFor(e) { return modelKind(e.requested) === 'unknown' ? (e.conflict ? 'unknown' : modelKind(e.route)) : modelKind(e.requested); }
  function mergeEvents(a, b) {
    const out = new Map();
    for (const item of [...a, ...b]) {
      const v = validEvent(item), prev = out.get(v.id);
      if (!prev || v.updated > prev.updated || (v.updated === prev.updated && JSON.stringify(v) > JSON.stringify(prev))) out.set(v.id, v);
    }
    return [...out.values()];
  }
  function grouped(events, ledger) {
    const groups = new Map();
    for (const e of events) {
      if (e.ledger !== ledger) continue;
      const key = e.state === 'manual' ? e.id : e.key;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    return [...groups.values()].map(list => {
      // A retry failure must not erase an earlier received request with the same stable ID.
      const accepted = list.filter(e => e.state === 'accepted');
      const candidates = accepted.length ? accepted : list;
      const e = candidates.reduce((a, b) => a.updated > b.updated ? a : b);
      return { ...e, at: Math.min(...candidates.map(x => x.at)), attempts: list.length };
    }).sort((a, b) => b.at - a.at);
  }
  function summarize(events, settings, now = Date.now()) {
    const w = windowFor(settings, now);
    const rows = grouped(events, settings.ledger).filter(e => e.at >= w.start && e.at <= now && (settings.mode === 'rolling' || e.at < w.end));
    const pro = rows.filter(e => e.state === 'accepted' && kindFor(e) === 'pro');
    const adjustment = rows.filter(e => e.state === 'manual').reduce((n, e) => n + e.delta, 0);
    const raw = pro.length + adjustment;
    const pending = rows.filter(e => ['pending', 'unknown'].includes(e.state) || (e.state === 'accepted' && kindFor(e) === 'unknown'));
    const failed = rows.filter(e => ['failed', 'aborted'].includes(e.state));
    return { ...w, rows, pro: pro.length, adjustment, raw, used: Math.max(0, raw), remaining: Math.max(0, settings.cap - Math.max(0, raw)), pending: pending.length, failed: failed.length };
  }
  function requestMeta(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { requested: '', seed: '', action: '', known: false };
    const requested = slug(obj.model);
    const action = typeof obj.action === 'string' ? obj.action : '';
    // Do not count continue/tool background/control requests as new user submissions.
    if (action && !['next', 'variant', 'retry', 'regenerate'].includes(action)) return { skip: true };
    const messages = Array.isArray(obj.messages) ? obj.messages : [];
    const user = [...messages].reverse().find(m => m && m.author && m.author.role === 'user');
    if ((!action || action === 'next' || action === 'retry') && messages.length && !user) return { skip: true };
    const explicit = shortId(obj.client_request_id) || shortId(obj.request_id);
    const mid = user && shortId(user.id);
    const stable = ['variant', 'regenerate'].includes(action) ? explicit : (mid || explicit);
    return { requested, seed: stable ? `${action === 'next' || action === 'retry' || !action ? 'send' : action}:${stable}:${requested}` : '', action, known: true };
  }
  async function digest(s) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function targetRequest(input, init, base) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      return method === 'POST' && url.origin === new URL(base).origin && /^\/backend-api\/(?:f\/)?conversation\/?$/.test(url.pathname);
    } catch { return false; }
  }
  async function readBounded(stream, limit = MAX_BODY, timeout = 1500) {
    if (!stream) return '';
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = '', bytes = 0, timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('bounded')), timeout); });
    try {
      while (true) {
        const part = await Promise.race([reader.read(), deadline]);
        if (part.done) return text + decoder.decode();
        bytes += part.value.byteLength;
        if (bytes > limit) throw Error('bounded');
        text += decoder.decode(part.value, { stream: true });
      }
    } finally {
      clearTimeout(timer);
      // A tee branch cancellation may wait for the site branch. Never await it.
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* no site side effects */ }
    }
  }
  function prepareMeta(input, init) {
    try {
      if (init && own(init, 'body') && init.body != null) {
        if (typeof init.body === 'string' && init.body.length <= MAX_BODY) {
          const body = init.body;
          return Promise.resolve().then(() => requestMeta(JSON.parse(body))).catch(() => ({ requested: '', seed: '', known: false }));
        }
        return Promise.resolve({ requested: '', seed: '', known: false });
      }
      if (input && typeof input.clone === 'function') {
        const clone = input.clone();
        return readBounded(clone.body).then(t => requestMeta(JSON.parse(t))).catch(() => ({ requested: '', seed: '', known: false }));
      }
    } catch { /* Parsing must never stop a user request. */ }
    return Promise.resolve({ requested: '', seed: '', known: false });
  }
  function parseMetadata(obj, state, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 9) return;
    if (Array.isArray(obj)) { for (const part of obj.slice(0, 100)) parseMetadata(part, state, depth + 1); return; }
    // Only structured metadata paths. Never traverse message content, text, tokens, or headers.
    if ((own(obj, 'error') && obj.error) || obj.type === 'error') state.error = true;
    const route = slug(obj.resolved_model_slug);
    if (route) state.routes.add(route);
    if (obj.server_ste_metadata && typeof obj.server_ste_metadata === 'object') {
      const actual = slug(obj.server_ste_metadata.model_slug); if (actual) state.routes.add(actual);
    }
    if (obj.author?.role === 'assistant' && obj.metadata) state.label = slug(obj.metadata.model_slug) || state.label;
    if (obj.type === 'stream_handoff' || obj.type === 'resume_conversation_token' || obj.type === 'resume_sse_endpoint' || obj.type === 'subscribe_ws_topic' || own(obj, 'resume_sse_endpoint')) state.handoff = true;
    for (const key of ['message', 'metadata', 'data', 'payload', 'v']) if (obj[key] && typeof obj[key] === 'object') parseMetadata(obj[key], state, depth + 1);
    // ChatGPT patch events may carry metadata values at an explicit path.
    if (typeof obj.p === 'string' && /(?:^|\/)resolved_model_slug$/.test(obj.p)) { const r = slug(obj.v); if (r) state.routes.add(r); }
    if (typeof obj.p === 'string' && /(?:^|\/)server_ste_metadata\/model_slug$/.test(obj.p)) { const r = slug(obj.v); if (r) state.routes.add(r); }
  }
  async function inspectResponse(response, update, opts = {}) {
    let reader, timer;
    const state = { routes: new Set(), label: '', error: false, handoff: false };
    const report = observation => update({ route: state.routes.values().next().value || '', conflict: state.routes.size > 1, label: state.label,
      observation: state.error ? 'error' : observation, ...(state.error ? { state: 'failed' } : {}) });
    try {
      const type = response.headers.get('content-type') || '';
      if (!/(event-stream|json)/i.test(type)) { report('unreadable'); return; }
      const clone = opts.alreadyClone ? response : response.clone();
      if (!clone.body) { report('unreadable'); return; }
      reader = clone.body.getReader();
      const decoder = new TextDecoder();
      const limit = opts.limit || MAX_STREAM;
      let bytes = 0, buffer = '', json = '', doneMarker = false;
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Error('bounded')), opts.timeout || 30000); });
      const consume = block => {
        const body = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n').trim();
        if (body === '[DONE]') { doneMarker = true; return; }
        if (!body) return;
        try { parseMetadata(JSON.parse(body), state); } catch { /* malformed frame is ignored */ }
      };
      while (true) {
        const part = await Promise.race([reader.read(), timeout]);
        if (part.done) {
          if (/json/i.test(type)) { try { parseMetadata(JSON.parse(json + decoder.decode()), state); } catch { report('unreadable'); return; } }
          else if (buffer) consume(buffer);
          report(state.handoff ? 'handoff' : 'done'); return;
        }
        bytes += part.value.byteLength;
        if (bytes > limit) { report('bounded'); return; }
        const text = decoder.decode(part.value, { stream: true });
        if (/json/i.test(type) && !/event-stream/i.test(type)) json += text;
        else {
          buffer += text;
          let match;
          while ((match = /\r?\n\r?\n/.exec(buffer))) { consume(buffer.slice(0, match.index).replace(/\r\n/g, '\n')); buffer = buffer.slice(match.index + match[0].length); }
          if (state.error) { report('error'); return; }
          if (state.routes.size || state.handoff) report(state.handoff ? 'handoff' : 'metadata');
          if (doneMarker) { report(state.handoff ? 'handoff' : 'done'); return; }
        }
      }
    } catch { report('bounded'); }
    finally { clearTimeout(timer); if (reader) { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* ignore */ } } }
  }
  // Protocol facts only: conversation/init -> limits_progress -> image_gen.
  // Reference: zetaloop/chatgpt-checker-next @ 0d7bf4a (AGPL-3.0).
  // This bounded parser/observer is independently implemented; no source is reused.
  const IMAGE_QUOTA_TTL = 60000;
  function imageQuotaRequest(input, init, base) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      if (url.origin !== new URL(base).origin) return '';
      if (method === 'POST' && /^\/backend-api\/conversation\/init\/?$/.test(url.pathname)) return 'quota';
      // Invalidate on account/session reads and state-changing requests. Never
      // inspect headers, cookies, credentials, or request bodies for this feature.
      if (/^\/(?:api\/auth(?:\/|$)|backend-api\/(?:accounts?|me)(?:\/|$))/.test(url.pathname) || !['GET', 'HEAD', 'OPTIONS'].includes(method)) return 'invalidate';
    } catch { /* an unknown request cannot supply quota */ }
    return '';
  }
  function parseImageQuota(data) {
    if (!data || !Array.isArray(data.limits_progress) || data.limits_progress.length > 100) return null;
    const entries = data.limits_progress.filter(entry => entry && entry.feature_name === 'image_gen');
    if (entries.length !== 1 || !Number.isSafeInteger(entries[0].remaining) || entries[0].remaining < 0) return null;
    // No reset-period, cap, or unlimited inference from undocumented fields.
    return { remaining: entries[0].remaining };
  }
  function createImageQuotaState({ clock = Date.now, changed = () => {} } = {}) {
    let epoch = 0, value = null;
    const notify = () => { try { changed(); } catch { /* optional UI must never disrupt native fetch */ } };
    return {
      invalidate() { epoch++; const hadValue = value !== null; value = null; if (hadValue) notify(); return epoch; },
      accept(token, data) {
        if (token !== epoch) return false;
        const parsed = parseImageQuota(data);
        value = parsed ? { ...parsed, observedAt: clock() } : null;
        notify(); return value !== null;
      },
      current() {
        if (!value) return null;
        const now = clock();
        if (now < value.observedAt || now - value.observedAt >= IMAGE_QUOTA_TTL) { value = null; epoch++; return null; }
        return { ...value };
      }
    };
  }
  // Independently implemented from public protocol facts. Only the challenge
  // difficulty and an actual boolean flag survive parsing, never seed/token.
  function powRequest(input, init, base) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      if (url.origin !== new URL(base).origin) return '';
      if (method === 'POST' && /^\/backend-(?:api|anon)\/sentinel\/chat-requirements(?:\/prepare)?\/?$/.test(url.pathname)) return 'pow';
      if (/^\/(?:api\/auth(?:\/|$)|backend-api\/(?:accounts?|me)(?:\/|$))/.test(url.pathname)) return 'invalidate';
    } catch { /* unknown requests cannot supply a challenge */ }
    return '';
  }
  function parsePow(data) {
    const value = data?.proofofwork;
    if (!value || Array.isArray(value) || typeof value.difficulty !== 'string' || !/^[0-9a-f]{1,128}$/i.test(value.difficulty)) return null;
    return { difficulty: value.difficulty, required: typeof value.required === 'boolean' ? value.required : null };
  }
  function createPowState({ clock = Date.now, changed = () => {} } = {}) {
    let epoch = 0, value = null;
    const notify = () => { try { changed(); } catch { /* UI only */ } };
    return {
      invalidate() { epoch++; const previous = value; value = null; if (previous) notify(); return epoch; },
      accept(token, data) {
        if (token !== epoch) return false;
        const parsed = parsePow(data);
        value = parsed ? { ...parsed, observedAt: clock() } : null;
        notify(); return !!value;
      },
      current() { return value ? { ...value } : null; }
    };
  }
  // Only this authenticated session response is a supported identity source.
  // Account/workspace objects, conversations, DOM names and email are not IDs.
  function accountRequest(input, init, base) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      if (url.origin !== new URL(base).origin) return '';
      if (method === 'GET' && /^\/api\/auth\/session\/?$/.test(url.pathname)) return 'session';
      if (/^\/(?:api\/auth(?:\/|$)|backend-api\/(?:accounts?|me)(?:\/|$))/.test(url.pathname)) return 'invalidate';
    } catch { /* fail closed */ }
    return '';
  }
  function parseAccountId(data) {
    const id = data?.user?.id;
    return typeof id === 'string' && /^[a-z0-9_-]{1,180}$/i.test(id) ? id : '';
  }
  function createAccountState({ enabled = false, hash = digest, random = uuid, changed = () => {} } = {}) {
    let active = !!enabled, epoch = 0, ledger = '', unknown = '';
    const notify = () => { try { changed(); } catch { /* UI only */ } };
    const invalidate = () => { epoch++; const hadIdentity = !!ledger; ledger = ''; unknown = ''; if (hadIdentity) notify(); return epoch; };
    return {
      enabled: () => active,
      setEnabled(value) { if (active !== !!value) { active = !!value; invalidate(); notify(); } },
      invalidate,
      async accept(token, data) {
        if (!active || token !== epoch) return false;
        const id = parseAccountId(data);
        if (!id) return false;
        // Domain separation is fixed across devices and the two supported hosts.
        // This is pseudonymization, not anonymity or a secret authenticator.
        const key = await hash(`chatgpt-toolkit/account-ledger/v1\0${id}`);
        if (!active || token !== epoch || typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return false;
        ledger = `a_${key}`; notify(); return true;
      },
      capture() {
        if (!active) return null;
        if (ledger) return ledger;
        if (!unknown) unknown = `unassigned:${random()}:${epoch}`;
        return unknown;
      },
      current() { return { enabled: active, epoch, ledger, recognized: !!ledger }; }
    };
  }
  function installObserver(win, { save, ledger, changed = () => {}, clock = Date.now, random = uuid, hash = digest, inspect = inspectResponse, imageQuota, pow, account, captureLedger }) {
    const original = win.fetch;
    let observed = 0;
    const tasks = new Set();
    const run = promise => { tasks.add(promise); promise.catch(() => {}).finally(() => tasks.delete(promise)); };
    function wrapper(...args) {
      let metaPromise, quotaKind = '', powKind = '', accountKind = '', accountToken, quotaToken, powToken, quotaBase = '', capturedLedger;
      // Capture a cached scalar before native fetch can re-enter page code.
      // No storage read or hashing here; a failed snapshot never falls back.
      if (captureLedger) { try { capturedLedger = captureLedger(); } catch { capturedLedger = null; } }
      // Identity fences cannot be skipped by failures in optional display work.
      try {
        if (account?.enabled()) {
          accountKind = accountRequest(args[0], args[1], win.location.href);
          if (accountKind) accountToken = account.invalidate();
        }
      } catch { /* original fetch must still run */ }
      try {
        quotaBase = win.location.href;
        quotaKind = imageQuota ? imageQuotaRequest(args[0], args[1], quotaBase) : '';
        powKind = pow ? powRequest(args[0], args[1], quotaBase) : '';
        // Request cloning must precede native fetch locking its body.
        // String parsing, storage reads and all response work happen afterwards.
        if (targetRequest(args[0], args[1], win.location.href)) metaPromise = prepareMeta(args[0], args[1]);
      } catch { /* observation setup may not stop a page request */ }
      // Reserve generations before native fetch can synchronously trigger an
      // account/navigation fence. Old challenges must not acquire a new epoch.
      try { if (quotaKind) quotaToken = imageQuota.invalidate(); } catch { /* optional display */ }
      try { if (powKind) powToken = pow.invalidate(); } catch { /* optional display */ }
      let result, nativeError, nativeThrew = false;
      try { result = Reflect.apply(original, this, args); }
      catch (error) { nativeError = error; nativeThrew = true; }
      // Every invocation reaches native fetch exactly once with the same this,
      // input/init objects and signal. Optional observer failures are isolated.
      try {
        if (quotaKind) {
          if (quotaKind === 'quota' && !nativeThrew) run(Promise.resolve(result).then(async response => {
            if (!response.ok || response.redirected || !/json/i.test(response.headers.get('content-type') || '')) return;
            if (response.url && imageQuotaRequest(response.url, { method: 'POST' }, quotaBase) !== 'quota') return;
            const copy = response.clone();
            const text = await readBounded(copy.body, 65536, 1500);
            imageQuota.accept(quotaToken, JSON.parse(text));
          }));
        }
        if (powKind) {
          if (powKind === 'pow' && !nativeThrew) run(Promise.resolve(result).then(async response => {
            if (!response.ok || response.redirected || !/json/i.test(response.headers.get('content-type') || '')) return;
            if (response.url && powRequest(response.url, { method: 'POST' }, quotaBase) !== 'pow') return;
            const text = await readBounded(response.clone().body, 65536, 1500);
            pow.accept(powToken, JSON.parse(text));
          }));
        }
        if (accountKind === 'session' && !nativeThrew) run(Promise.resolve(result).then(async response => {
          if (!response.ok || response.redirected || !/json/i.test(response.headers.get('content-type') || '')) return;
          if (response.url && accountRequest(response.url, { method: 'GET' }, quotaBase) !== 'session') return;
          const text = await readBounded(response.clone().body, 65536, 1500);
          await account.accept(accountToken, JSON.parse(text));
        }));
        if (metaPromise) {
          const id = random(), at = clock(), book = captureLedger ? capturedLedger : ledger();
          let event;
          const meta = metaPromise.then(async m => {
            if (m.skip || !shortId(book)) return null;
            const key = m.seed ? `h:${await hash(m.seed)}` : `u:${id}`;
            event = { v: 1, id, key, ledger: book, at, updated: clock(), state: 'pending', observation: 'pending', delta: 0, requested: m.requested || '', route: '', label: '', conflict: false, stable: !!m.seed, http: 0 };
            save(event); observed++; changed(); return event;
          });
          const patch = data => { if (!event) return; event = { ...event, ...data, updated: Math.max(clock(), event.updated + 1) }; save(event); changed(); };
          if (nativeThrew) run(meta.then(() => patch({ state: 'failed', observation: 'error' })));
          else run(Promise.resolve(result).then(async response => {
            // Clone before the caller can consume its original Response.
            let copy; if (response.ok) { try { copy = response.clone(); } catch { /* unreadable below */ } }
            try {
              if (!(await meta)) return;
              patch({ state: response.ok ? 'accepted' : 'failed', http: response.status, observation: response.ok ? 'http' : 'error' });
              if (copy) await inspect(copy, patch, { alreadyClone: true });
              else if (response.ok) patch({ observation: 'unreadable' });
            } finally {
              if (copy?.body && !copy.body.locked) { try { Promise.resolve(copy.body.cancel()).catch(() => {}); } catch { /* clone cleanup only */ } }
            }
          }, async error => {
            if (!(await meta)) return;
            patch({ state: error?.name === 'AbortError' ? 'aborted' : 'failed', observation: 'error' });
          }));
        }
      } catch { /* no optional count/quota failure changes native completion */ }
      if (nativeThrew) throw nativeError;
      return result;
    }
    const exposed = typeof exportFunction === 'function' ? exportFunction(wrapper, win) : wrapper;
    win.fetch = exposed;
    return { wrapper: exposed, original, healthy: () => win.fetch === exposed, observed: () => observed, idle: async () => { while (tasks.size) await Promise.allSettled([...tasks]); } };
  }
  function decodeImport(text) {
    if (typeof text !== 'string' || text.length > MAX_IMPORT) throw Error('文件过大，最多 5 MB');
    const obj = JSON.parse(text);
    if (obj?.format !== 'chatgpt-pro-counter' || obj.version !== 1 || !Array.isArray(obj.events) || obj.events.length > 20000) throw Error('不是兼容的计数器备份');
    return { settings: validSettings(obj.settings), events: mergeEvents([], obj.events) };
  }
  function webDavConfig(v) {
    if (!v || typeof v.url !== 'string') throw Error('请填写 WebDAV 文件完整地址');
    const u = new URL(v.url.trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname.endsWith('/')) throw Error('须使用 HTTPS 文件地址，不含用户名、密码、查询参数或片段；不能只填目录');
    const username = String(v.username || ''), password = String(v.password || '');
    if (username.includes(':') || username.length > 512 || password.length > 4096) throw Error('用户名或密码格式不正确');
    const interval = Number(v.interval || 0);
    if (![0, 5, 15, 30, 60].includes(interval)) throw Error('同步间隔不正确');
    return { url: u.href, username, password, interval, enabled: !!v.enabled, tested: !!v.tested, approved: !!v.approved };
  }
  function supportedManager(info) {
    // Conservative minimum: includes documented redirect control and later request-abort fixes.
    if (info?.scriptHandler !== 'Tampermonkey') return false;
    const parts = String(info.version || '').split('.').map(Number);
    return parts[0] > 5 || (parts[0] === 5 && (parts[1] > 5 || (parts[1] === 5 && (parts[2] || 0) >= 1)));
  }
  function createDavTransport(gmRequest, info, timeout = 20000) {
    return (config, method, headers = {}, data, signal) => new Promise((resolve, reject) => {
      if (!supportedManager(info)) { reject(Error('WebDAV 需要 Tampermonkey 5.5.1 或更新版；当前仅本机计数')); return; }
      let cfg; try { cfg = webDavConfig(config); } catch (e) { reject(e); return; }
      let ended = false, handle, timer, streaming = false;
      const cancel = () => { end(Error('WebDAV 操作已取消')); try { handle?.abort(); } catch {} };
      const end = (err, result) => { if (ended) return; ended = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); err ? reject(err) : resolve(result); };
      if (signal?.aborted) { cancel(); return; }
      signal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => { end(Error('WebDAV 请求超时，本机记录已保留')); try { handle?.abort(); } catch { /* ignore */ } }, timeout);
      const auth = cfg.username || cfg.password ? 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(cfg.username + ':' + cfg.password))) : '';
      try {
        handle = gmRequest({ method, url: cfg.url, headers: { ...headers, ...(auth ? { Authorization: auth } : {}) }, data,
          anonymous: true, redirect: 'error', fetch: true, nocache: true, responseType: 'stream',
          onloadstart: response => {
            if (!response.response || typeof response.response.getReader !== 'function') return;
            streaming = true;
            if ((response.finalUrl && response.finalUrl !== cfg.url) || response.status >= 300 && response.status < 400) { end(Error('拒绝重定向；请填最终 HTTPS 文件地址')); try { handle?.abort(); } catch {} return; }
            readBounded(response.response, MAX_IMPORT, timeout).then(text => end(null, { ...response, responseText: text }), () => { end(Error('WebDAV 响应超时或超过 5 MB；本机记录已保留')); try { handle?.abort(); } catch {} });
          },
          onload: response => {
            if (streaming) return;
            if ((response.finalUrl && response.finalUrl !== cfg.url) || response.status >= 300 && response.status < 400) { end(Error('拒绝重定向；请填最终 HTTPS 文件地址')); return; }
            if (typeof response.responseText === 'string' && new TextEncoder().encode(response.responseText).byteLength > MAX_IMPORT) { end(Error('远端文件超过 5 MB，已停止同步')); return; }
            if (response.status === 200 && typeof response.responseText !== 'string') { end(Error('脚本管理器未提供可读响应；请更新 Tampermonkey')); return; }
            end(null, response);
          }, onerror: () => end(Error('WebDAV 连接失败（可能是权限、网络或被拒绝的重定向）')),
          onabort: () => end(Error('WebDAV 请求已取消')), ontimeout: () => end(Error('WebDAV 请求超时')) });
      } catch { end(Error('WebDAV 请求无法发出，请检查 Tampermonkey 权限')); }
    });
  }
  const etagOf = response => {
    const match = String(response.responseHeaders || '').match(/^etag:\s*(.+?)\s*$/im);
    const tag = match?.[1] || '';
    return /^"[^"\r\n]+"$/.test(tag) ? tag : ''; // Weak ETags cannot protect If-Match PUTs.
  };
  function newestSettings(a, b) {
    if (a.updated !== b.updated) return a.updated > b.updated ? a : b;
    if (a.id !== b.id) return a.id > b.id ? a : b;
    return JSON.stringify(validSettings(a)) >= JSON.stringify(validSettings(b)) ? a : b;
  }
  function snapshot(settings, events) { return { format: 'chatgpt-pro-counter', version: 1, exportedAt: new Date().toISOString(), settings: validSettings(settings), events: mergeEvents([], events) }; }
  async function syncWebDav(config, { request, local, apply, backup: makeBackup }, options = {}) {
    const cfg = webDavConfig(config);
    if (!cfg.approved && !options.testOnly) throw Error('请先确认允许将计数记录和周期设置同步到此 WebDAV 文件');
    const check = () => { if (options.signal?.aborted) throw Error('WebDAV 操作已取消'); options.check?.(); };
    for (let attempt = 0; attempt < 3; attempt++) {
      check();
      const response = await request(cfg, 'GET', { Accept: 'application/json', 'Cache-Control': 'no-cache' }, undefined, options.signal);
      check();
      if (![200, 404].includes(response.status)) throw Error(`WebDAV 读取失败 HTTP ${response.status}；本机记录已保留`);
      let remote = null, tag = '';
      if (response.status === 200) {
        try { remote = decodeImport(response.responseText); } catch { throw Error('远端不是有效的计数器备份；未覆盖该文件'); }
        tag = etagOf(response);
        if (!tag) throw Error('服务器没有提供强 ETag，已停止写入以避免覆盖其他设备；请换支持 ETag / If-Match 的服务');
      }
      if (options.testOnly) return { missing: response.status === 404, status: response.status };
      const here = local();
      const events = mergeEvents(here.events, remote?.events || []).filter(event => !event.ledger.startsWith('unassigned:'));
      const merged = snapshot(remote ? newestSettings(here.settings, remote.settings) : here.settings, events);
      if (new TextEncoder().encode(JSON.stringify(merged)).byteLength > MAX_IMPORT) throw Error('合并文件超过 5 MB，未上传；请导出备份');
      check();
      await makeBackup(); // Back up locally before either remote write or local settings import.
      check();
      const result = await request(cfg, 'PUT', { 'Content-Type': 'application/json; charset=utf-8', ...(tag ? { 'If-Match': tag } : { 'If-None-Match': '*' }) }, JSON.stringify(merged), options.signal);
      check();
      if ([409, 412].includes(result.status)) continue;
      if (![200, 201, 204].includes(result.status)) throw Error(`WebDAV 写入失败 HTTP ${result.status}；本机记录已保留`);
      // Include local events arriving during the network round-trip. They remain queued for next sync.
      apply(merged);
      return { count: merged.events.length, settings: merged.settings, attempts: attempt + 1 };
    }
    throw Error('其他设备正在同时写入；已保留本机记录，请稍后再同步');
  }
  // Render only our own fixed templates without an HTML injection sink. This also works
  // on pages enforcing Trusted Types; no permissive policy or page-global API is created.
  function renderMarkup(target, markup, doc = document) {
    const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39|#x[0-9a-f]+|#[0-9]+);/gi, v => {
      const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
      if (own(named, v)) return named[v];
      const code = v[2].toLowerCase() === 'x' ? parseInt(v.slice(3, -1), 16) : parseInt(v.slice(2, -1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : v;
    });
    const tags = new Set(['style', 'section', 'header', 'h1', 'h2', 'div', 'span', 'strong', 'small', 'p', 'br', 'button', 'nav', 'label', 'input', 'select', 'option', 'form', 'ul', 'li']);
    const attrs = /^(?:id|class|type|for|role|tabindex|title|value|min|max|placeholder|autocomplete|accept|hidden|required|selected|checked|disabled|style|data-[a-z-]+|aria-[a-z-]+)$/;
    const fragment = doc.createDocumentFragment(), stack = [fragment];
    const tokens = markup.match(/<style>[\s\S]*?<\/style>|<[^>]*>|[^<]+/g) || [];
    for (const token of tokens) {
      const parent = stack[stack.length - 1];
      if (token.startsWith('<style>')) { const node = doc.createElement('style'); node.textContent = token.slice(7, -8); parent.appendChild(node); continue; }
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (token.startsWith('<')) {
        const found = /^<([a-z][a-z0-9-]*)\b([^>]*)>/i.exec(token); if (!found || !tags.has(found[1])) throw Error('计数器界面模板错误');
        const node = doc.createElement(found[1]);
        for (const match of found[2].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) {
          if (!attrs.test(match[1])) throw Error('计数器界面属性错误');
          node.setAttribute(match[1], decode(match[2] || ''));
        }
        parent.appendChild(node); if (!['input', 'br'].includes(found[1])) stack.push(node);
      } else parent.appendChild(doc.createTextNode(decode(token)));
    }
    target.replaceChildren(fragment);
  }
  function hoverPosition(rect, width, height, viewportWidth, viewportHeight) {
    // The observed native shortcut tooltip is below the Pro button. Prefer
    // above; if the viewport forces us below, leave a separate tooltip lane.
    const edge = 12, aboveGap = 12, belowGap = 62;
    const above = Math.max(0, rect.top - aboveGap - edge);
    const below = Math.max(0, viewportHeight - rect.bottom - belowGap - edge);
    const placement = height <= above || (height > below && above >= below) ? 'above' : 'below';
    const maxHeight = placement === 'above' ? above : below;
    const drawnHeight = Math.min(height, maxHeight);
    const left = Math.max(edge, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - edge));
    const top = placement === 'above' ? rect.top - aboveGap - drawnHeight : rect.bottom + belowGap;
    return { left, top: Math.max(edge, top), maxHeight, placement };
  }
  function boot() {
    diagnostics?.mark('frame-check');
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (!win || win.top !== win.self) { diagnostics?.mark('skipped', { frame: win ? 'not-top-window' : 'missing-window' }); return; }
    diagnostics?.mark('storage-init', { frame: 'top-window' });
    const hasStorage = typeof GM_getValue === 'function' && typeof GM_setValue === 'function' && typeof GM_listValues === 'function';
    if (diagnostics) diagnostics.state.storage = hasStorage ? 'available' : 'temporary-mode';
    const volatile = new Map();
    const gmGet = hasStorage ? GM_getValue : (key, fallback) => volatile.has(key) ? volatile.get(key) : fallback;
    const gmSet = hasStorage ? GM_setValue : (key, value) => volatile.set(key, value);
    const gmKeys = hasStorage ? GM_listValues : () => [...volatile.keys()];
    let storedSettings = defaultSettings(), settings = storedSettings, records = [], root, host, hoverRoot, hoverHost, activeTrigger, collapsed = true, tab = 'home', notice = '', storageError = hasStorage ? '' : 'Tampermonkey 存储权限未就绪：当前仅临时显示，刷新后不会保留。请检查脚本权限再刷新。', observer;
    let hoverTimer, hoverHideTimer, panelDraft, nativeBindingTimer, panelReturnFocus, lastNativeAnchor, incrementHost, incrementTimer, incrementKey, storageAvailable = hasStorage, uiBound = false, uiReady = false;
    let refreshTimer, lastKeys = '', settingsSnapshot = '', syncBusy = false, syncStatus = '未启用 WebDAV', lastSyncAttempt = 0, configEpoch = 0, currentAbort = null;
    // Local appearance preference, deliberately outside the shared v1 ledger
    // schema: older sync peers cannot drop or overwrite it. Missing/invalid => Pro.
    let hoverMode = 'pro';
    // Transient UI state; never persisted or included in backups/sync.
    const knownCountKeys = new Set(), queuedIncrements = new Map();
    let quotaExpiryTimer;
    const imageQuota = createImageQuotaState({ changed: () => {
      clearTimeout(quotaExpiryTimer);
      const current = imageQuota.current();
      if (current) quotaExpiryTimer = setTimeout(() => imageQuota.invalidate(), IMAGE_QUOTA_TTL);
      if (uiReady) updateHover();
    } });
    const pow = createPowState({ changed: () => { if (uiReady) scheduleRender(); } });
    const account = createAccountState({ changed: () => {
      imageQuota.invalidate(); pow.invalidate();
      if (uiReady) { applyAccountLedger(); clearIncrement(); queuedIncrements.clear(); scheduleRender(); refreshAccountPreference(); }
    } });
    function applyAccountLedger() {
      const current = account.current();
      settings = current.enabled ? { ...storedSettings, ledger: account.capture(), label: current.recognized ? `账号账本 ${current.ledger.slice(2, 10)}` : '待识别 · 未分配记录' } : storedSettings;
    }
    const accountPending = () => account.enabled() && !account.current().recognized;
    const contextSnapshot = () => `${settings.id}:${account.enabled()}:${account.current().epoch}:${settings.ledger}`;
    const invalidateAccount = () => { if (account.enabled()) account.invalidate(); };
    let quotaPage = win.location.href;
    const invalidateImageQuota = () => { imageQuota.invalidate(); pow.invalidate(); invalidateAccount(); quotaPage = win.location.href; };

    const countKey = event => JSON.stringify([event.ledger, event.key]);
    const isProCount = event => event.state === 'accepted' && kindFor(event) === 'pro';
    const rememberCount = event => { if (isProCount(event)) knownCountKeys.add(countKey(event)); };
    const getDav = () => {
      const empty = { url: '', username: '', password: '', interval: 0, enabled: false, tested: false, approved: false };
      try { const value = gmGet(`${PREFIX}webdav`, empty); return value && typeof value === 'object' ? value : empty; }
      catch { storageAvailable = false; storageError = '本机存储读取失败。请检查 Tampermonkey 权限再刷新；WebDAV 暂停。'; return empty; }
    };
    const load = () => {
      try {
        const nextHoverMode = gmGet(`${PREFIX}ui.hoverMode`, 'pro') === 'all' ? 'all' : 'pro';
        const hoverChanged = nextHoverMode !== hoverMode;
        hoverMode = nextHoverMode;
        if (hoverChanged && uiReady) { refreshHoverPreference(); updateHover(); }
        account.setEnabled(gmGet(`${PREFIX}ui.autoAccount`, false) === true);
        const keys = gmKeys();
        const allSettings = keys.filter(k => k.startsWith(`${PREFIX}settings.`)).map(k => { try { return validSettings(gmGet(k)); } catch { return null; } }).filter(Boolean);
        if (allSettings.length) storedSettings = allSettings.sort((a, b) => b.updated - a.updated || b.id.localeCompare(a.id))[0];
        else { storedSettings = { ...storedSettings, id: 'initial', updated: 0 }; gmSet(`${PREFIX}settings.initial`, storedSettings); }
        applyAccountLedger();
        records = keys.filter(k => k.startsWith(`${PREFIX}event.`)).map(k => { try { return validEvent(gmGet(k)); } catch { return null; } }).filter(Boolean);
        records.forEach(rememberCount);
        lastKeys = keys.length + ':' + records.reduce((n, e) => n + e.updated, 0);
      } catch { storageAvailable = false; storageError = '本机存储不可用，当前计数可能未保存。请先导出并检查 Tampermonkey 权限。'; }
    };
    const save = (event, strict = false) => {
      try {
        const clean = validEvent(event); gmSet(`${PREFIX}event.${clean.id}`, clean);
        const index = records.findIndex(e => e.id === clean.id); if (index < 0) records.push(clean); else records[index] = clean;
        rememberCount(clean);
      } catch { storageAvailable = false; storageError = '记录写入失败，请导出备份并检查脚本存储。'; if (strict) throw Error(storageError); }
      scheduleRender();
    };
    function saveObserved(event) {
      // Only this tab's observer may create an animation. Imports, calibration,
      // storage refresh and WebDAV use save/load directly.
      load();
      const key = countKey(event), known = knownCountKeys.has(key), before = summarize(records, settings);
      save(event);
      const after = summarize(records, settings);
      const included = !event.ledger.startsWith('unassigned:') && !accountPending() && after.rows.some(row => countKey(row) === key && isProCount(row));
      if (!known && isProCount(event) && included && after.pro > before.pro) queuedIncrements.set(key, true);
      // A later stream error can undo HTTP acceptance. Remove queued or visible
      // feedback immediately when the group no longer contributes to the count.
      if (!included) {
        // If a provisional count failed before any paint, a later successful
        // retry still deserves its first visible +1. Already shown or imported
        // groups never enter this queue and remain deduplicated.
        if (queuedIncrements.has(key)) knownCountKeys.delete(key);
        queuedIncrements.delete(key);
        if (incrementKey === key) clearIncrement();
      }
    }
    function clearIncrement() {
      clearTimeout(incrementTimer); incrementHost?.remove(); incrementHost = null; incrementKey = null;
    }
    function flushIncrement() {
      if (incrementHost) return;
      const current = new Set(summarize(records, settings).rows.filter(isProCount).map(countKey));
      for (const [key] of queuedIncrements) {
        queuedIncrements.delete(key);
        if (!current.has(key)) continue;
        try { showIncrement(key); } catch (error) { diagnostics?.fail('count-animation', error); }
        break;
      }
    }
    const exportObject = () => ({ format: 'chatgpt-pro-counter', version: 1, exportedAt: new Date().toISOString(), settings: storedSettings, events: records });
    const syncObject = () => ({ ...exportObject(), events: records.filter(event => !event.ledger.startsWith('unassigned:')) });
    const backup = reason => {
      load();
      try { gmSet(`${PREFIX}backup.${Math.floor(Date.now() / 60000) % 12}`, { ...exportObject(), reason }); }
      catch { throw Error('安全备份失败，已取消修改；请先导出记录。'); }
    };
    const download = (obj, name) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    function scheduleRender() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { updateHover(); if (root && (collapsed || !['settings', 'sync'].includes(tab))) render(); flushIncrement(); }, 150); }
    const fmt = ms => new Date(ms).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const esc = str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const button = (action, label, klass = '') => `<button type="button" data-action="${action}" class="${klass}">${label}</button>`;
    function status(e) {
      if (e.ledger.startsWith('unassigned:')) return `未分配 · ${status({ ...e, ledger: '' }).replace('已计入', '未计入账号')}`;
      if (e.state === 'manual') return `手动校准 ${e.delta > 0 ? '+' : ''}${e.delta}`;
      if (e.state === 'pending') return Date.now() - e.at > 120000 ? '未确认（中断或离页）' : '等待接收';
      if (e.state === 'aborted') return '已取消 · 未计入';
      if (e.state === 'failed') return `失败${e.http ? ` HTTP ${e.http}` : ''} · 未计入`;
      if (e.state !== 'accepted' || kindFor(e) === 'unknown') return '模型未知 · 未计入';
      return kindFor(e) === 'pro' ? 'Pro 请求已接收 · 已计入' : `${kindFor(e) === 'thinking' ? 'Thinking' : '其他模型'} · 未计入`;
    }
    const style = `
      :host{all:initial;color-scheme:light dark;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.55;color:var(--fg);--bg:#fff;--fg:#20252c;--muted:#68717e;--line:#e6e9ed;--soft:#f6f8fa;--accent:#7652e8;--accent-bg:#f1edff;--warn:#985b1b;--shadow:0 10px 45px #172d4126}
      :host([hidden]){display:none!important}
      :host([data-dark]){--bg:#202329;--fg:#f0f2f5;--muted:#aab2bf;--line:#3a4049;--soft:#2a2e35;--accent:#bca7ff;--accent-bg:#34294d;--warn:#f4c078;--shadow:0 12px 45px #0007}
      *{box-sizing:border-box}.panel,.launcher,.hover-card{font:12px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:var(--fg)}button,input,select{font:inherit}button{cursor:pointer;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:12px;line-height:1.4;min-height:28px;padding:5px 8px;border-radius:8px}button:hover{background:var(--soft)}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #ac8df9;outline-offset:2px}button.primary{background:var(--accent-bg);color:var(--accent);border-color:transparent;font-weight:650}button.ghost{border:none;background:transparent;padding:4px 7px;color:var(--muted)}
      .panel{width:min(310px,calc(100vw - 24px));max-height:calc(100dvh - 94px);overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 7px}h1{font-size:13px;margin:0;font-weight:700;letter-spacing:.1px;display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;min-width:0}h1 span{font-size:10px;color:var(--accent);background:var(--accent-bg);padding:3px 6px;margin-left:0;border-radius:5px;vertical-align:middle}.body{padding:6px 14px 14px}.muted,small{color:var(--muted)}small{font-size:11px}.eyebrow{color:var(--muted);font-size:12px}.number{font-size:34px;letter-spacing:-1px;font-weight:700;line-height:1.25;margin-top:5px}.number span{font-size:15px;letter-spacing:0;color:var(--muted);font-weight:400}.meter{height:5px;border-radius:9px;background:var(--soft);overflow:hidden;margin:9px 0}.fill{height:100%;background:linear-gradient(90deg,#3e4ee9,#9766f7,#c995ff);border-radius:9px}.row{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap}.meta{font-size:11px;color:var(--muted)}.callout{font-size:11px;color:var(--muted);background:var(--soft);padding:8px 9px;border-radius:8px;margin:9px 0}.warning{color:var(--warn)}.actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.calibration{display:grid;grid-template-columns:56px 56px minmax(0,1fr);gap:6px}.calibration button{font-size:11px;min-width:0;padding:5px 4px;white-space:nowrap}.calibration .initial{background:var(--soft);color:var(--muted);font-weight:500}.secondary{gap:4px;margin-top:6px}.secondary button{font-size:11px;min-height:26px;padding:4px 6px;color:var(--muted);border-color:transparent;background:transparent}.secondary button:hover{background:var(--soft)}.foot{border-top:1px solid var(--line);padding-top:9px;margin-top:9px;font-size:10px;color:var(--muted)}.chip{padding:6px 10px;border-radius:30px;box-shadow:0 3px 20px #31245c18;font-size:12px;display:flex;align-items:center;gap:4px}.chip strong{color:var(--accent);margin:0 5px}nav{display:flex;gap:4px;padding:0 14px 4px}nav button{font-size:11px;border:none;padding:4px 7px}nav button.active{background:var(--accent-bg);color:var(--accent)}label{display:block;font-size:11px;margin:10px 0 4px}input,select{width:100%;min-width:0;padding:6px 7px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--fg)}.log{list-style:none;margin:0;padding:0}.log li{padding:10px 0;border-bottom:1px solid var(--line)}.log .model{font-size:11px;word-break:break-all;margin-top:3px}.badge{font-size:10px}.empty{padding:25px 0;text-align:center;color:var(--muted)}p{margin:7px 0}.notice{margin:0 14px 7px;padding:8px;background:var(--accent-bg);color:var(--accent);font-size:11px;border-radius:8px} .error{background:var(--soft);color:var(--warn)}
      .pow-difficulty{overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.display-setting{padding-bottom:10px;margin-bottom:8px;border-bottom:1px solid var(--line)}.display-setting>label{margin-top:0}.segmented{display:flex;gap:3px;background:var(--soft);padding:3px;border:1px solid var(--line);border-radius:9px}.segmented button{flex:1;font-size:11px;border-color:transparent;background:transparent;color:var(--muted)}.segmented button[aria-pressed="true"]{background:var(--bg);color:var(--accent);border-color:var(--line);box-shadow:0 1px 3px #00000008}.display-setting small{display:block;font-size:10px;margin-top:5px}
      .count-increment{display:grid;place-items:center;min-width:44px;height:32px;border:1px solid var(--line);border-radius:18px;background:var(--accent-bg);color:var(--accent);font-size:19px;font-weight:750;box-shadow:var(--shadow);animation:count-rise 1.1s ease-out both;pointer-events:none}@keyframes count-rise{0%{opacity:0;transform:translateY(8px) scale(.88)}20%,65%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-16px) scale(1)}}
      .launcher{display:flex;justify-content:flex-end;margin-top:10px}.chip:before{content:'✦';color:var(--accent);font-size:15px;margin-right:3px}.chip small{font-size:10px}.hover-card{width:min(248px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;overflow-wrap:anywhere;padding:10px 12px;background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 42px #35245c24;color:var(--fg)}.hover-title{gap:4px 8px;font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center}.pro-label{font-weight:650;letter-spacing:.2px;color:var(--accent)}.hover-card .number{font-size:28px;line-height:1.2;margin:6px 0 0}.hover-card .number span{font-size:14px}.image-quota{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5;font-variant-numeric:tabular-nums}.hover-card .meter{margin:8px 0;height:5px}.hover-title>span,.hover-footer>span{min-width:0}.hover-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 8px;font-size:11px;color:var(--muted)}.hover-footer button{flex-shrink:0;font-size:11px;color:var(--accent);border:none;background:transparent;padding:3px 0}.hover-error{font-size:11px;color:var(--warn);margin-top:8px}.panel{animation:appear .16s ease-out}.close{font-size:18px;line-height:1}.chip strong{font-variant-numeric:tabular-nums}.number{font-variant-numeric:tabular-nums}.fill{transition:width .22s ease}@keyframes appear{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}@media(max-width:460px){.hover-card{width:min(248px,calc(100vw - 24px))}.panel{border-radius:14px}}@media(max-width:300px){.calibration{grid-template-columns:1fr 1fr}.calibration .initial{grid-column:1/-1;white-space:normal}.hover-title{flex-wrap:wrap}}
    `;
    function launcher(total) { return `<div class="launcher"><button type="button" data-action="expand" class="chip" aria-label="打开 Pro 计数器；${accountPending() ? '账号待识别' : `本机估算 ${total.used}/${settings.cap}`}" aria-expanded="${!collapsed}" aria-controls="gpc-panel">Pro <strong>${accountPending() ? '待识别' : `${total.used}/${settings.cap}`}</strong><small> ${storageAvailable ? '本机' : '权限异常'}</small></button></div>`; }
    function render() {
      if (!root) return;
      const focusedAction = root.activeElement?.getAttribute('data-action');
      const total = summarize(records, settings);
      updateHover();
      if (collapsed) { renderMarkup(root, `<style>${style}</style>${launcher(total)}`); if (focusedAction) root.querySelector(`[data-action="${focusedAction}"]`)?.focus(); return; }
      let body = '';
      if (tab === 'settings') {
        const d = new Date(settings.anchor); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        settingsSnapshot = contextSnapshot();
        body = `<div class="display-setting"><label id="hover-label">悬浮卡显示</label><div class="segmented" role="group" aria-labelledby="hover-label"><button type="button" id="hover-pro" data-action="hover-pro" aria-pressed="${hoverMode === 'pro'}">仅选择 Pro 时</button><button type="button" id="hover-all" data-action="hover-all" aria-pressed="${hoverMode === 'all'}">所有模型</button></div><small id="hover-status" role="status">${hoverPreferenceHint()}</small></div><div class="display-setting"><label id="account-label">按当前账号自动切换账本</label><div class="segmented" role="group" aria-labelledby="account-label"><button type="button" data-action="account-off" id="account-off" aria-pressed="${!account.enabled()}">手动选择</button><button type="button" data-action="account-on" id="account-on" aria-pressed="${account.enabled()}">实验自动识别</button></div><small id="account-status" role="status">${accountPreferenceHint()}</small></div><form id="settings"><label for="cap">本周期上限（自定义，非官方额度）</label><input id="cap" type="number" min="1" max="1000000" value="${settings.cap}" required><label for="mode">统计方式</label><select id="mode"><option value="fixed"${settings.mode === 'fixed' ? ' selected' : ''}>固定七天周期</option><option value="rolling"${settings.mode === 'rolling' ? ' selected' : ''}>滚动最近七天</option></select><label for="anchor">固定周期锚点（你的浏览器当地时间）</label><input id="anchor" type="datetime-local" value="${local}" required><small>填入你确认的重置时间；每 168 小时一个周期。默认是安装当天零点。滚动模式忽略此项。</small><label for="calibrate">当前已用校准为（首次安装可填写）</label><input id="calibrate" type="number" min="0" max="1000000" placeholder="留空保留现值"><small>会添加一条校准记录，不删除历史；以保存后的统计方式计算差额。</small><label for="ledger">账本</label><select id="ledger"${account.enabled() ? ' disabled' : ''}>${[...new Set(['default', settings.ledger, ...records.map(e => e.ledger)])].map(id => `<option value="${esc(id)}"${id === settings.ledger ? ' selected' : ''}>${id === settings.ledger ? esc(settings.label) : id === 'default' ? '默认账本' : id.startsWith('unassigned:') ? `未分配 ${esc(id.slice(11, 19))}` : esc(id.slice(0, 16))}</option>`).join('')}<option value="__new">新建独立账本…</option></select><small>${account.enabled() ? '账本跟随本标签页识别到的登录用户。同一用户的不同工作区共用账本。' : '手动模式：换账号时请选择独立账本。'} 上限、统计方式和周期锚点仍是共用设置，需自行核对；不会自动推断各账号额度。</small><div class="actions"><button class="primary" type="submit">保存设置</button>${button('home', '取消')}</div></form><div class="foot">修改前自动保存本机备份。不同标签页设置冲突时会提醒刷新。</div>`;
      } else if (tab === 'sync') {
        const cfg = getDav();
        body = `<form id="webdav"><div class="callout">可选：把计数记录、模型标记和周期设置存到你自己的 WebDAV 文件。密码仅在本机 Tampermonkey 存储，不随备份导出；不是加密保险箱。</div><label for="dav-url">HTTPS 文件完整地址</label><input id="dav-url" type="url" value="${esc(cfg.url)}" placeholder="https://你的服务器/dav/pro-counter.json" required autocomplete="off"><small>请先建立父目录。必须支持强 ETag 和条件 PUT；不跟随重定向。</small><label for="dav-user">用户名</label><input id="dav-user" value="${esc(cfg.username)}" autocomplete="off"><label for="dav-pass">密码 / 专用应用密码</label><input id="dav-pass" type="password" placeholder="${cfg.password ? '已保存；留空保留（更换服务器时会清除）' : '建议使用专用应用密码'}" autocomplete="new-password"><label for="dav-interval">自动同步（仅页面打开时）</label><select id="dav-interval">${[0, 5, 15, 30, 60].map(n => `<option value="${n}"${cfg.interval === n ? ' selected' : ''}>${n ? `每 ${n} 分钟` : '关闭，仅手动'}</option>`).join('')}</select><label><input id="dav-approved" type="checkbox" style="width:auto" ${cfg.approved ? 'checked' : ''}> 我同意将计数记录和周期设置上传到上述文件，并在本机保存凭据。</label><div class="actions"><button type="submit" class="primary">测试并保存</button>${button('sync-now', '立即同步')}${button('sync-off', '关闭自动同步')}${button('sync-clear', '清除本机凭据')}</div></form><div class="callout" role="status">${esc(syncStatus)}${syncBusy ? ' · 正在处理…' : ''}</div><div class="foot">需要 Tampermonkey 5.5.1+。安装时的任意域名网络权限仅用于你填写的 WebDAV。同步不包含聊天正文、Cookie、令牌或 WebDAV 密码。两台设备使用同一文件地址；周期设置按更新时间合并，请确保系统时间准确。</div>`;
      } else if (tab === 'log') {
        const proof = pow.current();
        const powStatus = `<div id="pow-status" class="callout" role="status">PoW 难度：${proof ? `<span class="pow-difficulty">${esc(proof.difficulty)}</span><br>是否要求：${proof.required === null ? '未知' : proof.required ? '是' : '否'} · 最近捕获 ${fmt(proof.observedAt)}` : '暂未捕获'}<br>仅为本页最近响应快照，不代表模型能力或账号健康。</div>`;
        const rows = (accountPending() ? [...new Set(records.filter(event => event.ledger.startsWith('unassigned:')).map(event => event.ledger))].flatMap(ledger => grouped(records, ledger)).sort((a, b) => b.at - a.at) : grouped(records, settings.ledger)).slice(0, 80);
        body = `${powStatus}<div class="row"><span class="eyebrow">${esc(settings.label)} · 最近 ${rows.length} 条</span>${button('export', '导出', 'ghost')}</div><ul class="log">${rows.length ? rows.map(e => `<li><div class="row"><strong class="badge ${e.state === 'failed' || e.state === 'aborted' ? 'warning' : ''}">${esc(status(e))}</strong><small>${fmt(e.at)}</small></div>${e.state === 'manual' ? '' : `<div class="model muted">请求：${esc(e.requested || '未知')}<br>响应路由：${esc(e.conflict ? '字段冲突' : e.route || '未取得')}${e.label ? `<br>回答标签：${esc(e.label)}` : ''}</div><small>${e.observation === 'handoff' ? '响应已转交其他通道；未监听 WebSocket' : e.observation === 'bounded' ? '达到观察上限；后续状态未知' : e.observation === 'unreadable' ? '未解析到响应元数据' : e.observation === 'http' ? '仅确认 HTTP 接收' : ''}${!e.stable ? ' · 缺少稳定 ID，重试可能重复' : ''}${e.attempts > 1 ? ` · ${e.attempts} 次尝试已合并` : ''}</small>`}</li>`).join('') : '<li class="empty">还没有记录<br><small>打开历史对话不会增加计数</small></li>'}</ul><div class="foot">已接收 ≠ 官方扣额。HTTP 失败/取消不计入，但也不能证明平台未扣额；可手动校准。</div>`;
      } else {
        body = `<div class="eyebrow">${settings.mode === 'fixed' ? '本周期' : '最近七天'}已用 · 本机估算</div><div class="number">${accountPending() ? '待识别' : total.used}<span> / ${settings.cap}</span></div><div class="meter" role="progressbar" aria-label="本机估算已用" aria-valuemin="0" aria-valuemax="${Math.max(total.used, settings.cap)}" aria-valuenow="${accountPending() ? 0 : total.used}"><div class="fill" style="width:${accountPending() ? 0 : Math.min(100, total.used / settings.cap * 100)}%"></div></div><div class="row"><strong>估算剩余 ${accountPending() ? '待识别' : total.remaining}</strong><span class="meta">待确认 ${total.pending} · 失败/取消 ${total.failed}</span></div><div class="callout">${settings.mode === 'fixed' ? `下个周期：${fmt(total.next)}<br>锚点由你设置，不是服务端重置时间。` : '每条记录在 168 小时后移出统计窗口。'}${total.raw < 0 ? '<br><span class="warning">校准合计为负，已用暂显示 0，请复核记录。</span>' : ''}</div><div class="meta">已接收 Pro ${accountPending() ? '待识别' : total.pro} · 手动校准 ${total.adjustment >= 0 ? '+' : ''}${total.adjustment}</div><div class="actions calibration" role="group" aria-label="手动校准">${button('plus', '+1 校正')}${button('minus', '−1 校正')}${button('settings', '初始用量 / 设置', 'initial')}</div><div class="actions secondary">${button('export', '导出')}${button('import', '导入合并')}${button('backup', '最近备份', 'ghost')}</div><div class="foot">本机优先 · ${getDav().enabled ? 'WebDAV 已配置' : 'WebDAV 未启用'} · 非官方余额<br>${esc(settings.label)} · ${observer?.healthy() ? (observer.observed() ? '观察器已捕获请求' : '观察器已安装，等待新请求') : '观察器可能被覆盖，请刷新页面'}<br>${account.enabled() ? '按登录用户分账；上限与周期设置共用。<br>' : ''}只按实际请求模型/响应路由判断，订阅名称不会计数。${getDav().enabled ? `<br>${esc(syncStatus)}${Math.max(settings.updated, ...records.map(e => e.updated)) > Number(gmGet(`${PREFIX}lastSync`, 0)) ? '<br>有待同步的新记录；断网时保留在本机。' : ''}` : ''}</div>`;
      }
      renderMarkup(root, `<style>${style}</style><section id="gpc-panel" class="panel" role="dialog" aria-label="ChatGPT Toolkit"><header><h1>ChatGPT Toolkit<span>LOCAL</span></h1><button type="button" data-action="collapse" class="ghost close" aria-label="关闭计数器">×</button></header><nav>${button('home', '概览', tab === 'home' ? 'active' : '')}${button('log', '记录', tab === 'log' ? 'active' : '')}${button('settings', '设置', tab === 'settings' ? 'active' : '')}${button('sync', '同步', tab === 'sync' ? 'active' : '')}</nav>${accountPending() ? `<div class="notice" role="status">当前账号待识别。新请求暂存未分配记录，不计入任何账号，也不上传 WebDAV；后续识别不会自动搬移。等待页面自然返回会话信息，或刷新页面。</div>` : ''}${account.enabled() && !accountPending() && records.some(event => event.ledger.startsWith('unassigned:')) ? `<div class="notice" role="status">另有 ${records.filter(event => event.ledger.startsWith('unassigned:')).length} 条未分配记录，未计入当前账号。可导出核对，或关闭自动识别后在设置中查看未分配账本；不会自动搬移。</div>` : ''}${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ''}${storageError ? `<div class="notice error" role="alert">${esc(storageError)}</div>` : ''}<div class="body">${body}</div><input type="file" id="import" accept="application/json,.json" hidden></section>${launcher(total)}`);
      if (focusedAction) root.querySelector(`[data-action="${focusedAction}"]`)?.focus();
    }
    function manual(delta, at = Date.now()) {
      if (accountPending()) throw Error('账号待识别，暂不能校准。可关闭自动识别后手动选择账本。');
      const id = uuid(); save({ v: 1, id, key: `m:${id}`, ledger: settings.ledger, at, updated: at, state: 'manual', observation: 'manual', delta, requested: '', route: '', label: '', stable: true, conflict: false, http: 0 });
    }
    function accountPreferenceHint() {
      return account.enabled() ? `${accountPending() ? '待识别，等待页面自己的会话响应。' : `已识别：${settings.label}。`} 实验功能：失焦、导航或输入区外操作会清除识别；须等网页新的会话响应。不额外查询；散列账本编号随记录导出/同步。旧历史不搬移。` : '实验功能，默认关闭。被动读取用户 ID，生成可跨设备关联的散列账本编号；不提取邮箱或令牌。失焦/导航等操作后可能持续待识别。';
    }
    function refreshAccountPreference() {
      for (const mode of ['on', 'off']) root?.querySelector(`#account-${mode}`)?.setAttribute('aria-pressed', String(account.enabled() === (mode === 'on')));
      const status = root?.querySelector('#account-status'); if (status) status.textContent = accountPreferenceHint();
    }
    function setAccountMode(enabled) {
      try {
        gmSet(`${PREFIX}ui.autoAccount`, enabled); account.setEnabled(enabled); applyAccountLedger();
        // Switching account mode intentionally discards an unrelated form draft.
        panelDraft = null; render();
      } catch { notice = '自动识别设置未保存：本机存储不可用。'; render(); }
    }
    function hoverPreferenceHint() { return hasStorage ? '悬停或聚焦时显示，非始终展开。立即保存，仅本机生效。' : '悬停或聚焦时显示，非始终展开。存储不可用，仅本页临时生效。'; }
    function refreshHoverPreference(message = '') {
      for (const mode of ['pro', 'all']) root?.querySelector(`#hover-${mode}`)?.setAttribute('aria-pressed', String(hoverMode === mode));
      const status = root?.querySelector('#hover-status');
      if (status) { status.textContent = message || hoverPreferenceHint(); status.classList.toggle('warning', !!message); }
    }
    function setHoverMode(mode) {
      try {
        gmSet(`${PREFIX}ui.hoverMode`, mode);
        hoverMode = mode; refreshHoverPreference(); updateHover();
      } catch { refreshHoverPreference('未保存：本机存储写入失败，仍保留原显示方式。'); }
    }
    function bind() {
      root.addEventListener('click', e => {
        const b = e.target.closest('button[data-action]'); if (!b) return;
        try {
          const action = b.dataset.action; notice = '';
          if (action === 'account-on' || action === 'account-off') { setAccountMode(action === 'account-on'); return; }
          if (action === 'hover-pro' || action === 'hover-all') { setHoverMode(action === 'hover-all' ? 'all' : 'pro'); return; }
          if (['home', 'log', 'settings', 'sync'].includes(action)) { load(); tab = action; collapsed = false; render(); return; }
          if (action === 'collapse' || action === 'expand') { if (action === 'expand') openPanel(); else closePanel(); return; }
          if (action === 'plus' || action === 'minus') { load(); manual(action === 'plus' ? 1 : -1); render(); return; }
          if (action === 'sync-now') { void doSync(); return; }
          if (action === 'sync-off') { const cfg = getDav(); gmSet(`${PREFIX}webdav`, { ...cfg, interval: 0 }); syncStatus = '自动同步已关闭；仍可手动同步'; }
          if (action === 'sync-clear') { if (!win.confirm('清除本机保存的 WebDAV 地址与凭据？远端文件和本机计数记录保留。')) return; configEpoch++; currentAbort?.abort(); gmSet(`${PREFIX}webdav`, { url: '', username: '', password: '', interval: 0, enabled: false, tested: false, approved: false, revision: uuid() }); syncStatus = '已清除本机 WebDAV 配置'; }
          if (action === 'export') { load(); download(exportObject(), `chatgpt-pro-counter-${new Date().toISOString().slice(0, 10)}.json`); notice = '已生成本机记录导出文件'; }
          if (action === 'import') { root.querySelector('#import').click(); return; }
          if (action === 'backup') {
            const saved = gmKeys().filter(k => k.startsWith(`${PREFIX}backup.`)).map(k => gmGet(k)).filter(Boolean).sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)))[0];
            if (!saved) notice = '还没有备份；导出可立即生成一份。';
            else { download(saved, 'chatgpt-pro-counter-backup.json'); notice = '已导出最近备份；导入只合并记录，不自动覆盖当前设置。'; }
          }
          render();
        } catch (error) { notice = error.message; render(); }
      });
      root.addEventListener('submit', e => {
        if (e.target.id === 'webdav') { e.preventDefault(); void configureDav(); return; }
        if (e.target.id !== 'settings') return; e.preventDefault();
        try {
          const q = id => root.querySelector(`#${id}`).value;
          const cap = Number(q('cap')), mode = q('mode'), anchor = new Date(q('anchor')).getTime(), target = q('calibrate'), selected = q('ledger');
          load(); if (contextSnapshot() !== settingsSnapshot) throw Error('另一个标签页修改了设置，或本页账号上下文已改变。请重新打开设置后再保存。');
          const ledger = account.enabled() ? storedSettings.ledger : selected === '__new' ? `book-${uuid().slice(0, 8)}` : selected;
          const label = ledger === storedSettings.ledger ? storedSettings.label : ledger === 'default' ? '默认账本' : ledger;
          const next = validSettings({ v: 1, id: uuid(), updated: Date.now(), cap, mode, anchor, ledger, label });
          if (target !== '' && (!Number.isInteger(Number(target)) || Number(target) < 0 || Number(target) > 1000000)) throw Error('当前已用请填写 0–1000000 的整数');
          if (target !== '' && accountPending()) throw Error('账号待识别，暂不能校准。');
          backup('修改设置前'); gmSet(`${PREFIX}settings.${next.id}`, next); storedSettings = next; applyAccountLedger();
          if (target !== '') manual(Number(target) - summarize(records, settings).raw);
          notice = '已保存；修改前的快照可从“最近备份”导出。'; tab = 'home'; render();
        } catch (error) { notice = error.message; tab = 'home'; render(); }
      });
      root.addEventListener('change', async e => {
        if (e.target.id !== 'import') return;
        const file = e.target.files?.[0]; if (!file) return;
        try {
          if (file.size > MAX_IMPORT) throw Error('文件过大，最多 5 MB');
          const data = decodeImport(await file.text());
          if (!win.confirm(`将合并 ${data.events.length} 条记录（已有记录按 ID 去重），保留本机设置。导入前会自动备份。继续？`)) return;
          backup('导入前'); const before = records.length;
          const merged = mergeEvents(records, data.events);
          for (const ev of merged) { const previous = records.find(x => x.id === ev.id); if (!previous || JSON.stringify(previous) !== JSON.stringify(ev)) save(ev, true); }
          notice = `合并完成：新增 ${records.length - before} 条；设置保留不变。请确认两端周期、上限和账本相同。`; render();
        } catch (error) { notice = `导入未完成：${error.message}`; render(); }
      });
    }
    const transport = hasStorage && typeof GM_xmlhttpRequest === 'function' ? createDavTransport(GM_xmlhttpRequest, typeof GM_info === 'object' ? GM_info : {}) : async () => { throw Error('当前脚本管理器没有 WebDAV 请求权限'); };
    async function configureDav() {
      if (syncBusy) return;
      try {
        if (!storageAvailable) throw Error('本机存储不可用，WebDAV 已停用。请检查 Tampermonkey 权限后刷新。');
        const prev = getDav(), priorConfig = JSON.stringify(prev), q = id => root.querySelector(`#${id}`).value;
        const url = q('dav-url').trim(), username = q('dav-user');
        const approved = root.querySelector('#dav-approved').checked;
        if (!approved) throw Error('请先勾选同步数据和本机保存凭据的说明');
        const password = q('dav-pass') || (url === prev.url && username === prev.username ? prev.password : '');
        const cfg = webDavConfig({ url, username, password, interval: Number(q('dav-interval')), enabled: true, tested: false, approved });
        const epoch = configEpoch; currentAbort = new AbortController();
        syncBusy = true; syncStatus = '正在测试 WebDAV 读取权限'; render();
        await syncWebDav(cfg, { request: transport }, { testOnly: true, signal: currentAbort.signal, check: () => { if (configEpoch !== epoch || JSON.stringify(getDav()) !== priorConfig) throw Error('配置已在本页或其他标签页改变；操作取消'); } });
        if (configEpoch !== epoch || JSON.stringify(getDav()) !== priorConfig) throw Error('配置已在本页或其他标签页改变；操作取消');
        gmSet(`${PREFIX}webdav`, { ...cfg, tested: true, revision: uuid() });
        lastSyncAttempt = Date.now(); syncStatus = '读取测试通过；保存成功。首次同步将合并或建立文件，写权限在同步时验证。';
      } catch (error) { syncStatus = error.message; }
      finally { syncBusy = false; render(); }
    }
    async function doSync(auto = false) {
      if (syncBusy) return;
      let cfg;
      try {
        if (!storageAvailable) throw Error('本机存储不可用，WebDAV 已停用。请检查 Tampermonkey 权限后刷新。');
        cfg = webDavConfig(getDav());
        if (!cfg.enabled || !cfg.tested || !cfg.approved) throw Error('请先在“同步”中测试并保存配置');
        const epoch = configEpoch; currentAbort = new AbortController();
        const sameDestination = () => { if (!storageAvailable) throw Error('本机存储不可用，已取消同步写入。'); const current = getDav(); if (epoch !== configEpoch || !current.enabled || !current.approved || current.url !== cfg.url || current.username !== cfg.username || current.password !== cfg.password) throw Error('同步配置已改变；操作取消'); };
        syncBusy = true; lastSyncAttempt = Date.now(); syncStatus = '正在合并 WebDAV 记录'; if (!auto) render();
        const result = await syncWebDav(cfg, { request: transport,
          local: () => { load(); return syncObject(); }, backup: () => backup('同步前'),
          apply: merged => {
            load();
            for (const ev of mergeEvents(records, merged.events.filter(event => !event.ledger.startsWith('unassigned:')))) { const previous = records.find(x => x.id === ev.id); if (!previous || JSON.stringify(previous) !== JSON.stringify(ev)) save(ev, true); }
            const latest = newestSettings(storedSettings, merged.settings); gmSet(`${PREFIX}settings.${latest.id}`, latest); storedSettings = latest; applyAccountLedger();
          } }, { signal: currentAbort.signal, check: sameDestination });
        syncStatus = `同步成功 ${fmt(Date.now())} · 合并 ${result.count} 条记录`;
        gmSet(`${PREFIX}lastSync`, lastSyncAttempt);
      } catch (error) { syncStatus = error.message; }
      finally { syncBusy = false; if (!auto || !['settings', 'sync'].includes(tab)) render(); }
    }
    function closePanel(restoreFocus = true) {
      if (collapsed) return;
      const form = root?.querySelector(tab === 'settings' ? '#settings' : tab === 'sync' ? '#webdav' : '#no-draft');
      // Keep a dismissed form only in this page's memory, including an unsaved
      // password. Closing never saves, tests, syncs, or uploads any field.
      panelDraft = form ? { tab, snapshot: settingsSnapshot, fields: [...form.querySelectorAll('input,select')].map(el => ({ id: el.id, value: el.value, checked: el.checked })) } : null;
      collapsed = true; render();
      if (restoreFocus) {
        if (panelReturnFocus?.isConnected) panelReturnFocus.focus(); else root?.querySelector('[data-action="expand"]')?.focus();
      }
    }
    function openPanel(next = panelDraft?.tab || 'home') {
      panelReturnFocus = activeTrigger?.isConnected ? activeTrigger : null;
      hideHover(); load(); tab = next; collapsed = false; render();
      if (panelDraft?.tab === next) {
        for (const field of panelDraft.fields) {
          const el = root.querySelector(`#${field.id}`);
          if (el) { el.value = field.value; if (el.getAttribute('type') === 'checkbox') el.checked = field.checked; }
        }
        if (next === 'settings') settingsSnapshot = panelDraft.snapshot;
      }
      panelDraft = null;
      root?.querySelector('[data-action="collapse"]')?.focus();
    }
    function eventInside(event, container) {
      return !!container && (event.composedPath?.().includes(container) || event.target === container || container.contains(event.target));
    }
    function dismissOutside(event) {
      if (!collapsed && !eventInside(event, host) && !eventInside(event, hoverHost)) closePanel(false);
    }
    const editorSelector = '#prompt-textarea,textarea[name="prompt-textarea"],[contenteditable="true"][data-placeholder],form textarea';
    const composerSelector = 'form,[data-type="unified-composer"],[data-testid="composer"],[data-testid="conversation-composer"],#composer-background';
    const modelMarkerSelector = '[data-codex-intelligence-trigger="true"],[data-composer-navigation-target="reasoning"]';
    const controlSelector = 'button,[role="button"],[aria-haspopup],[data-testid="send-button"],[data-testid="composer-send-button"],[data-testid="composer-submit-button"],#composer-submit-button,[data-codex-intelligence-trigger="true"],[data-composer-navigation-target="reasoning"]';
    const excludedRegion = 'header,nav,aside,[role="menu"],[role="dialog"],[role="listbox"]';
    function visibleControl(el) {
      if (!el?.isConnected || el.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= win.innerHeight || rect.right <= 0 || rect.left >= win.innerWidth) return false;
      try {
        for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
          const css = win.getComputedStyle(node);
          if (css.display === 'none' || /^(?:hidden|collapse)$/.test(css.visibility) || css.opacity === '0') return false;
        }
      } catch { /* geometry remains available */ }
      return true;
    }
    function composerFor(el, detail = {}) {
      detail.scope = 'no-composer';
      if (!el || el.closest(excludedRegion)) { detail.scope = 'excluded-region'; return null; }
      for (const editor of document.querySelectorAll(editorSelector)) {
        if (!visibleControl(editor) || editor.contains(el) || editor.closest(excludedRegion)) continue;
        // Inspect every recognized enclosing composer, not only the nearest
        // form/background. A toolbar may be its sibling inside an outer shell.
        const ancestors = [];
        for (let ancestor = editor.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (ancestor === document.body || ancestor === document.documentElement || ancestor.matches('main,article,[role="main"]')) break;
          ancestors.push(ancestor);
          if (ancestor.matches(composerSelector) && ancestor.contains(el)) { detail.scope = 'explicit-composer'; return ancestor; }
        }
        // Plain-div shells also occur around a nested editor form. Keep this
        // fallback nearby, bounded, and out of a different composer's controls.
        const ownComposer = el.closest(composerSelector);
        if (ownComposer && !ownComposer.contains(editor)) continue;
        for (const ancestor of ancestors.slice(0, 8)) {
          if (!ancestor.contains(el)) continue;
          const input = editor.getBoundingClientRect(), rect = el.getBoundingClientRect();
          if (rect.top >= input.top - 100 && rect.bottom <= input.bottom + 160 && rect.left >= input.left - 24 && rect.right <= input.right + 180) { detail.scope = 'nearby-composer'; return ancestor; }
          break;
        }
      }
      return null;
    }
    function controlText(el) {
      // Measurement/accessibility duplicates are not the visible model label.
      // Read only a bounded control subtree; never retain DOM/text in diagnostics.
      let text = '', visited = 0;
      const visit = node => {
        if (++visited > 160 || text.length >= 256) return;
        if (node.nodeType === 3) { text += (node.data || '').slice(0, 256 - text.length); return; }
        if (node.nodeType !== 1 || node.matches('[hidden],[aria-hidden="true"],[inert],svg,script,style,[contenteditable="true"],textarea')) return;
        try { const css = win.getComputedStyle(node); if (css.display === 'none' || /^(?:hidden|collapse)$/.test(css.visibility) || css.opacity === '0') return; } catch { /* semantic visibility is still available */ }
        for (const child of node.childNodes || []) visit(child);
      };
      visit(el);
      return text.replace(/\s+/g, ' ').trim();
    }
    function selectionScope(trigger) {
      const known = composerFor(trigger) || trigger.closest(composerSelector);
      if (known) return known;
      // A reported native Send + explicit model marker can share a plain-div
      // shell even before an editor mounts. Never widen to the page/main region.
      for (let scope = trigger.parentElement, depth = 0; scope && depth < 4; scope = scope.parentElement, depth++) {
        if (scope === document.body || scope === document.documentElement || scope.matches('main,article,[role="main"]') || scope.closest(excludedRegion)) break;
        const markers = [...scope.querySelectorAll(modelMarkerSelector)].filter(el => visibleControl(el) && !el.closest(excludedRegion));
        const sends = [...scope.querySelectorAll('button,[role="button"]')].filter(el => visibleControl(el) && (/^(?:send-button|composer-send-button|composer-submit-button)$/.test(el.getAttribute('data-testid') || '') || el.id === 'composer-submit-button' || (el.matches('button[type="submit"].size-token-button-composer') && /^(?:send(?: message| prompt)?|发送(?:消息|提示)?|傳送(?:訊息|提示)?|送信)$/i.test(el.getAttribute('aria-label') || ''))));
        if (markers.length !== 1 || sends.length !== 1 || [...scope.querySelectorAll(composerSelector)].length) continue;
        const model = markers[0].getBoundingClientRect(), send = sends[0].getBoundingClientRect();
        if (Math.abs(model.top - send.top) <= 80 && Math.abs(model.right - send.left) <= 240) return scope;
      }
      return null;
    }
    function selectedPro(trigger) {
      if (!trigger || trigger.closest(excludedRegion)) return false;
      const scope = selectionScope(trigger);
      if (!scope || scope === document.body || scope === document.documentElement) return false;
      // Only the selected label in this composer's visible control matters.
      // Explicit markers outrank legacy labels; hidden measurement text, plan
      // names, request history, menu options and default-model metadata do not.
      const inScope = el => visibleControl(el) && !el.closest(excludedRegion) &&
        (composerFor(el) === scope || (!composerFor(el) && (el.closest(composerSelector) === scope || (!el.closest(composerSelector) && scope.contains(el)))));
      let choices = [...scope.querySelectorAll(modelMarkerSelector)].filter(inScope);
      if (!choices.length) choices = [...scope.querySelectorAll(controlSelector)].filter(el => inScope(el) && /^(?:Pro|Thinking|Instant|Auto|思考强度|思考強度)(?:\s*[⌄⌃▾▿∨])?$/i.test(controlText(el)));
      choices = choices.filter(el => !choices.some(other => other !== el && other.contains(el)));
      return choices.length === 1 && /^Pro(?:\s*[⌄⌃▾▿∨])?$/i.test(controlText(choices[0]));
    }
    function nativeTrigger(target, report = false) {
      const detail = { match: 'no-control', scope: 'unchecked' };
      const finish = el => {
        if (el && hoverMode !== 'all' && !selectedPro(el)) { el = null; detail.match = 'selected-model-not-pro-or-unknown'; }
        if (report && diagnostics) { diagnostics.state.hoverMatch = detail.match; diagnostics.state.hoverScope = detail.scope; }
        return el;
      };
      if (!target || typeof target.closest !== 'function' || host?.contains(target) || hoverHost?.contains(target) || incrementHost?.contains(target)) return finish(null);
      const candidates = [];
      let control = target.closest(controlSelector);
      for (let i = 0; control && i < 4; i++, control = control.parentElement?.closest(controlSelector)) candidates.push(control);
      // SVG/use events retarget to the entire native button, without annotation
      // or hitbox changes. Keep the unmarked Pro-dropdown fallback for old UIs.
      if (!candidates.length) for (let node = target, i = 0; node && i < 4; node = node.parentElement, i++) {
        if (/^Pro(?:\s*[⌄⌃▾▿∨])?$/i.test(controlText(node))) candidates.push(node);
      }
      for (const el of candidates) {
        if (!visibleControl(el)) { detail.match = 'not-visible'; continue; }
        if (el.closest(excludedRegion)) { detail.match = 'outside-composer'; detail.scope = 'excluded-region'; continue; }
        const text = controlText(el);
        const label = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid'), text].filter(Boolean).join(' ').trim();
        if (/voice|microphone|(?:^|\W)mic(?:\W|$)|speech|audio|dictat|stop|pause|record|语音|語音|麦克风|麥克風|听写|聽寫|录音|錄音|朗读|朗讀|停止|暂停|暫停|upgrade|subscribe|升级|升級/i.test(label)) { detail.match = 'excluded-control'; return finish(null); }
        const testId = el.getAttribute('data-testid') || '';
        // The reported Send button is an authoritative anchor by itself. Do
        // not make it depend on discovering the editor or its current parents.
        const sendLabel = /^(?:send(?: message| prompt)?|发送(?:消息|提示)?|傳送(?:訊息|提示)?|送信)$/i.test((el.getAttribute('aria-label') || '').trim());
        const explicitSend = /^(?:send-button|composer-send-button|composer-submit-button)$/.test(testId) || el.id === 'composer-submit-button';
        const observedSend = el.matches('button[type="submit"].size-token-button-composer') && sendLabel;
        if (explicitSend || observedSend) { detail.match = 'send-control'; detail.scope = 'direct-send-anchor'; return finish(el); }
        if (!composerFor(el, detail)) { detail.match = 'outside-composer'; continue; }
        const send = /^(?:send-button|composer-send-button|composer-submit-button)$/.test(testId) || el.id === 'composer-submit-button' || /^(?:send(?: message| prompt)?|submit(?: message| prompt)?|发送(?:消息|提示)?|傳送(?:訊息|提示)?|送信)(?:[\s(（]|$)/i.test(label);
        const modelMarker = el.getAttribute('data-composer-navigation-target') === 'reasoning' || el.getAttribute('data-codex-intelligence-trigger') === 'true';
        const pro = /\bPro\b|思考强度|思考強度|思考時間|Thinking|reasoning[- ]?effort|thinking[- ]?(?:level|effort|time)/i.test(label);
        if (send || modelMarker || pro) { detail.match = send ? 'send-control' : modelMarker ? 'model-marker' : 'model-label'; return finish(el); }
        detail.match = 'unrecognized-control';
      }
      return finish(null);
    }
    if (diagnostics) diagnostics.inspectHover = () => {
      diagnostics.state.hoverEditors = [...document.querySelectorAll(editorSelector)].filter(el => visibleControl(el) && !el.closest(excludedRegion)).length;
      diagnostics.state.hoverMarkers = [...document.querySelectorAll(modelMarkerSelector)].filter(el => visibleControl(el) && composerFor(el)).length;
      diagnostics.state.hoverSends = [...document.querySelectorAll(controlSelector)].filter(el => { const trigger = nativeTrigger(el); return trigger === el && (/send|submit/.test(el.getAttribute('data-testid') || el.id) || /^(?:send(?: message| prompt)?|发送(?:消息|提示)?|傳送(?:訊息|提示)?|送信)$/i.test((el.getAttribute('aria-label') || '').trim())); }).length;
      // Counts and fixed reason labels only: no URLs, attributes, chat text or DOM.
    };
    function showIncrement(key) {
      clearTimeout(incrementTimer); incrementHost?.remove();
      const anchor = nativeTrigger(lastNativeAnchor) ? lastNativeAnchor : [...document.querySelectorAll(controlSelector)].find(el => nativeTrigger(el));
      const rect = anchor?.getBoundingClientRect() || host?.getBoundingClientRect();
      if (!rect || !document.body) return;
      const next = document.createElement('div'); next.id = 'chatgpt-pro-local-increment';
      next.style.cssText = 'all:initial;position:fixed;z-index:2147483647;pointer-events:none!important;user-select:none;';
      next.style.left = `${Math.max(12, Math.min(rect.left + rect.width / 2 - 22, win.innerWidth - 56))}px`;
      next.style.top = `${Math.max(12, Math.min(rect.top - 40, win.innerHeight - 44))}px`;
      next.toggleAttribute('data-dark', host?.hasAttribute('data-dark'));
      const shadow = next.attachShadow({ mode: 'closed' });
      renderMarkup(shadow, `<style>${style}</style><div class="count-increment" role="status" aria-label="本机 Pro 已记录加一">+1</div>`);
      incrementHost = next; incrementKey = key; document.body.appendChild(next);
      incrementTimer = setTimeout(() => { if (incrementHost === next) clearIncrement(); flushIncrement(); }, 1100);
    }
    function updateHover() {
      if (!hoverRoot || !activeTrigger || !nativeTrigger(activeTrigger)) { setHoverVisible(false); if (diagnostics) diagnostics.state.hoverCard = 'hidden'; return; }
      if (quotaPage !== win.location.href || document.hidden) invalidateImageQuota();
      const quota = imageQuota.current();
      const imageLine = quota ? `图片剩余 ${quota.remaining} 次 · ${esc(new Date(quota.observedAt).toLocaleTimeString())} 读取` : '图片剩余：暂未获取';
      const hadFocus = !!hoverRoot.activeElement;
      const total = summarize(records, settings);
      renderMarkup(hoverRoot, `<style>${style}</style><section class="hover-card" aria-label="Pro 用量，本机估算"><div class="hover-title"><span class="pro-label">✦ Pro</span><span>${settings.mode === 'fixed' ? '本周期' : '最近七天'} · 本机估算</span></div><div class="number">${accountPending() ? '待识别' : total.remaining}<span> 次剩余</span></div><div class="image-quota" title="仅显示本页刚观察到的图片额度；最多保留 60 秒，不主动查询">${imageLine}</div><div class="meter" aria-hidden="true"><div class="fill" style="width:${accountPending() ? 0 : Math.min(100, total.used / settings.cap * 100)}%"></div></div><div class="hover-footer"><span>已用 ${accountPending() ? '待识别' : total.used} / ${settings.cap}</span><button type="button" data-action="manage">管理用量 ↗</button></div>${storageError ? '<div class="hover-error">存储异常，请打开计数器检查</div>' : ''}</section>`);
      setHoverVisible(true); positionHover();
      if (hadFocus) hoverRoot.querySelector('[data-action="manage"]')?.focus();
    }
    function positionHover() {
      if (!activeTrigger || !hoverHost || hoverHost.hidden) return;
      if (!nativeTrigger(activeTrigger)) { hideHover(); return; }
      const rect = activeTrigger.getBoundingClientRect();
      const card = hoverRoot.querySelector('.hover-card');
      if (card) card.style.maxHeight = 'calc(100dvh - 24px)';
      const size = hoverHost.getBoundingClientRect();
      const pos = hoverPosition(rect, size.width || 248, size.height || 140, win.innerWidth, win.innerHeight);
      if (pos.maxHeight < 56) { hideHover(); if (diagnostics) diagnostics.state.hoverCard = 'no-viewport-space'; return; }
      if (card) card.style.maxHeight = `${pos.maxHeight}px`;
      hoverHost.style.left = `${pos.left}px`; hoverHost.style.top = `${pos.top}px`;
      if (diagnostics) {
        diagnostics.state.hoverCard = `visible-${pos.placement}`;
        try {
          const css = win.getComputedStyle(hoverHost), bounds = hoverHost.getBoundingClientRect();
          diagnostics.state.hoverPaint = [hoverHost.hidden ? 'hidden-attribute' : 'unhidden', css.display === 'none' ? 'display-none' : 'display-present', /^(?:hidden|collapse)$/.test(css.visibility) ? 'visibility-hidden' : 'visibility-visible', css.opacity === '0' ? 'opacity-zero' : 'opacity-present', bounds.width > 0 && bounds.height > 0 ? 'nonzero-bounds' : 'zero-bounds'].join(' / ');
        } catch { diagnostics.state.hoverPaint = 'unavailable'; }
      }
    }
    function setHoverVisible(visible) {
      if (!hoverHost) return;
      hoverHost.hidden = !visible;
      // Be explicit at the outer host boundary; page styles and Shadow DOM
      // resets must not leave an unhidden card with display:none or opacity:0.
      hoverHost.style.setProperty('display', visible ? 'block' : 'none', 'important');
    }
    function showHover(el) {
      clearTimeout(hoverHideTimer);
      if (el === activeTrigger && (hoverTimer || !hoverHost?.hidden)) return;
      clearTimeout(hoverTimer);
      activeTrigger = el; lastNativeAnchor = el;
      hoverTimer = setTimeout(() => { hoverTimer = null; load(); updateHover(); }, 100);
    }
    function hideHover() { clearTimeout(hoverTimer); hoverTimer = null; clearTimeout(hoverHideTimer); activeTrigger = null; setHoverVisible(false); if (diagnostics) diagnostics.state.hoverCard = 'hidden'; }
    function queueHide() { clearTimeout(hoverHideTimer); hoverHideTimer = setTimeout(hideHover, 280); }
    function enterNative(event) {
      if (diagnostics) diagnostics.state.hoverEvent = event.type;
      const el = nativeTrigger(event.currentTarget || event.target, true);
      if (el) showHover(el); else if (activeTrigger) hideHover();
    }
    const boundNativeControls = new WeakSet();
    function bindNativeControls() {
      for (const el of document.querySelectorAll(controlSelector)) {
        if (boundNativeControls.has(el)) continue;
        boundNativeControls.add(el);
        // Direct non-bubbling listeners also work when a page stops delegated
        // pointer events. Evaluate labels again on entry after Send -> Stop.
        for (const type of ['pointerenter', 'mouseenter', 'focus']) el.addEventListener(type, enterNative);
        for (const type of ['pointerleave', 'mouseleave', 'blur']) el.addEventListener(type, () => { if (activeTrigger === el) queueHide(); });
      }
    }
    function scheduleNativeBindings() {
      if (nativeBindingTimer) return;
      nativeBindingTimer = setTimeout(() => { nativeBindingTimer = null; bindNativeControls(); }, 0);
    }
    function setupHover() {
      bindNativeControls();
      // Drop transient account data before possible account/navigation actions.
      // These listeners never cancel or change native interaction.
      const invalidateOutsideComposer = event => {
        const target = event.target;
        if (host?.contains(target) || hoverHost?.contains(target)) return;
        if (target?.closest && (composerFor(target) || target.closest(composerSelector) || selectionScope(target))) return;
        invalidateImageQuota();
      };
      document.addEventListener('pointerdown', invalidateOutsideComposer, true);
      document.addEventListener('keydown', invalidateOutsideComposer, true);
      document.addEventListener('visibilitychange', invalidateImageQuota);
      for (const type of ['pagehide', 'pageshow', 'popstate', 'hashchange', 'blur']) win.addEventListener(type, invalidateImageQuota);
      document.addEventListener('pointerdown', dismissOutside, true);
      document.addEventListener('click', dismissOutside, true);
      document.addEventListener('pointerover', event => { if (diagnostics) diagnostics.state.hoverEvent = 'pointerover'; const el = nativeTrigger(event.target, true); if (el && el !== activeTrigger) showHover(el); else if (el) clearTimeout(hoverHideTimer); else if (activeTrigger && !hoverHost.contains(event.target) && event.target?.closest?.(controlSelector)) hideHover(); }, true);
      document.addEventListener('pointerout', event => { if (activeTrigger && activeTrigger.contains(event.target) && !activeTrigger.contains(event.relatedTarget)) queueHide(); }, true);
      document.addEventListener('focusin', event => { if (diagnostics) diagnostics.state.hoverEvent = 'focusin'; const el = nativeTrigger(event.target, true); if (el) showHover(el); }, true);
      document.addEventListener('focusout', event => { if (activeTrigger?.contains(event.target)) queueHide(); }, true);
      hoverHost.addEventListener('pointerenter', () => clearTimeout(hoverHideTimer));
      hoverHost.addEventListener('pointerleave', queueHide);
      hoverRoot.addEventListener('focusin', () => clearTimeout(hoverHideTimer));
      hoverRoot.addEventListener('focusout', queueHide);
      hoverRoot.addEventListener('click', event => { if (event.target.closest('[data-action="manage"]')) openPanel('home'); });
      // The native trigger's click/keyboard events are never canceled or replaced.
      document.addEventListener('click', event => { const el = nativeTrigger(event.target); if (el) { lastNativeAnchor = el; hideHover(); } }, true);
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') { if (!collapsed) closePanel(); hideHover(); }
        if (event.altKey && event.shiftKey && event.code === 'KeyP') { event.preventDefault(); if (collapsed) openPanel(); else closePanel(); }
      });
      win.addEventListener('resize', positionHover, { passive: true });
      win.addEventListener('scroll', positionHover, { passive: true, capture: true });
      if (diagnostics) diagnostics.state.hoverListeners = 'installed';
    }
    function theme() {
      if (!host) return;
      let dark = document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark';
      try { if (!dark && !document.documentElement.classList.contains('light') && document.documentElement.dataset.theme !== 'light') dark = win.matchMedia('(prefers-color-scheme: dark)').matches; } catch { /* theme is optional */ }
      host.toggleAttribute('data-dark', dark); hoverHost?.toggleAttribute('data-dark', dark); incrementHost?.toggleAttribute('data-dark', dark);
    }
    function mount() {
      if (!document.body) return false;
      if (!host) {
        // Commit only after both Shadow DOM roots exist. A one-shot failure must
        // not leave host assigned while root/hoverHost are still missing.
        const nextHost = document.createElement('div'); nextHost.id = 'chatgpt-pro-local-counter';
        nextHost.style.cssText = 'all:initial;position:fixed!important;right:12px!important;bottom:14px!important;z-index:2147483646!important;display:block!important;';
        const nextRoot = nextHost.attachShadow({ mode: 'closed' });
        const nextHoverHost = document.createElement('div'); nextHoverHost.id = 'chatgpt-pro-local-hover'; nextHoverHost.hidden = true;
        nextHoverHost.style.cssText = 'position:fixed!important;z-index:2147483647!important;display:none!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;';
        const nextHoverRoot = nextHoverHost.attachShadow({ mode: 'closed' });
        host = nextHost; root = nextRoot; hoverHost = nextHoverHost; hoverRoot = nextHoverRoot;
      }
      if (!host.isConnected) document.body.appendChild(host);
      if (!hoverHost.isConnected) document.body.appendChild(hoverHost);
      if (uiReady) return true;
      if (!uiBound) { bind(); uiBound = true; }
      // Retry first paint on the next mount if the previous render failed.
      render(); uiReady = true;
      try { theme(); } catch (error) { diagnostics?.fail('theme', error); }
      try { setupHover(); } catch (error) { diagnostics?.fail('hover-listeners', error); }
      try {
        new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
        const media = win.matchMedia('(prefers-color-scheme: dark)');
        if (media.addEventListener) media.addEventListener('change', theme); else if (media.addListener) media.addListener(theme);
      } catch (error) { diagnostics?.fail('theme-listeners', error); }
      return true;
    }
    const safeMount = () => {
      try {
        const mounted = mount();
        if (diagnostics) diagnostics.state.ui = mounted ? 'ready' : 'waiting-body';
        return mounted;
      } catch (error) {
        if (diagnostics) diagnostics.state.ui = 'failed';
        diagnostics?.fail('mount', error);
        return false;
      }
    };
    if (diagnostics) diagnostics.open = () => { if (safeMount()) openPanel(); else diagnostics.show(); };
    diagnostics?.mark('load-storage');
    load();
    try { if (getDav().enabled) { const last = Number(gmGet(`${PREFIX}lastSync`, 0)); syncStatus = last ? `上次同步 ${fmt(last)}` : 'WebDAV 已配置，尚未完成同步'; } } catch { /* show storage diagnosis */ }
    diagnostics?.mark('install-observer');
    try {
      observer = installObserver(win, { save: saveObserved, ledger: () => { load(); return settings.ledger; }, captureLedger: () => account.enabled() ? account.capture() : settings.ledger, imageQuota, pow, account });
      if (diagnostics) diagnostics.state.observer = observer.healthy() ? 'installed' : 'not-active';
    } catch (error) {
      storageError = [storageError, '观察器未成功安装。仍可手动计数；请刷新并检查脚本权限。'].filter(Boolean).join(' ');
      if (diagnostics) diagnostics.state.observer = 'failed';
      diagnostics?.fail('install-observer', error);
    }
    diagnostics?.mark('mount');
    safeMount();
    document.addEventListener('DOMContentLoaded', safeMount, { once: true });
    // React navigation can replace the body or remove our host. Reattach the same roots.
    try { new MutationObserver(() => { if (quotaPage !== win.location.href) invalidateImageQuota(); if (document.body && (!host?.isConnected || !hoverHost?.isConnected)) safeMount(); if (activeTrigger && !nativeTrigger(activeTrigger)) hideHover(); scheduleNativeBindings(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['aria-label', 'aria-hidden', 'data-testid', 'type', 'class', 'style', 'hidden', 'inert', 'id', 'data-codex-intelligence-trigger', 'data-composer-navigation-target'] }); } catch { /* interval below also recovers */ }
    setInterval(() => {
      const mounted = safeMount(); const before = lastKeys, s = settings.id; load();
      if (mounted && (collapsed || !['settings', 'sync'].includes(tab))) { if (before !== lastKeys || s !== settings.id || !document.hidden) render(); }
      bindNativeControls(); if (activeTrigger) updateHover(); else if (quotaPage !== win.location.href || document.hidden) invalidateImageQuota(); positionHover();
    }, 5000);
    setInterval(() => { try { const cfg = getDav(); const since = Math.max(lastSyncAttempt, Number(gmGet(`${PREFIX}lastSync`, 0))); if (storageAvailable && cfg.enabled && cfg.tested && cfg.approved && cfg.interval > 0 && Date.now() - since >= cfg.interval * 60000) void doSync(true); } catch { /* no optional-sync failure may remove the UI */ } }, 15000);
    win.addEventListener('focus', () => { const mounted = safeMount(); load(); if (mounted && (collapsed || !['settings', 'sync'].includes(tab))) render(); });
    diagnostics?.mark('ready');
  }
  return { WEEK, PREFIX, modelKind, defaultSettings, validSettings, validEvent, windowFor, kindFor, mergeEvents, grouped, summarize,
    IMAGE_QUOTA_TTL, imageQuotaRequest, parseImageQuota, createImageQuotaState, powRequest, parsePow, createPowState, accountRequest, parseAccountId, createAccountState, requestMeta, digest, targetRequest, readBounded, prepareMeta, parseMetadata, inspectResponse, installObserver, decodeImport, webDavConfig, supportedManager, createDavTransport, etagOf, newestSettings, snapshot, syncWebDav, renderMarkup, hoverPosition, boot };
});
