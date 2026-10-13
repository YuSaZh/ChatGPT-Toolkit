// ==UserScript==
// @name         ChatGPT Pro 本机计数器
// @namespace    local.chatgpt.pro-counter
// @version      1.1.1
// @homepageURL  https://github.com/YuSaZh/GPT-Pro-Counter
// @supportURL   https://github.com/YuSaZh/GPT-Pro-Counter/issues
// @updateURL    https://raw.githubusercontent.com/YuSaZh/GPT-Pro-Counter/main/chatgpt-pro-counter.user.js
// @downloadURL  https://raw.githubusercontent.com/YuSaZh/GPT-Pro-Counter/main/chatgpt-pro-counter.user.js
// @description  记录本机观察到的 Pro 请求；七天统计、校准、导入导出、可选 WebDAV 同步。非官方额度。
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

/* Original implementation. No third-party runtime or ChatGPT API polling. WebDAV is explicitly opt-in. */
(function (factory) {
  'use strict';
  // Register recovery/diagnostic commands before the application factory runs.
  // A missing command can then be distinguished from a failure inside boot().
  const browser = typeof window !== 'undefined' && typeof document !== 'undefined';
  let diagnostics;
  if (browser) {
    const state = { version: '1.1.1', phase: 'entry', frame: 'unchecked', storage: 'unchecked', ui: 'not-started', observer: 'not-started', menu: 'unavailable', errors: [] };
    diagnostics = {
      state, open: null,
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
        const text = ['Pro 计数器启动诊断', `脚本版本: ${state.version}`, `启动阶段: ${state.phase}`, `页面检查: ${state.frame}`, `存储接口: ${state.storage}`, `界面状态: ${state.ui}`, `观察器: ${state.observer}`, `菜单接口: ${state.menu}`, `document.readyState: ${document.readyState}`, `近期错误: ${state.errors.length ? state.errors.join('\n') : '无'}`, '此报告不读取聊天内容、计数记录或 WebDAV 凭据。'].join('\n');
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
        if (typeof init.body === 'string' && init.body.length <= MAX_BODY) return Promise.resolve(requestMeta(JSON.parse(init.body)));
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
  function installObserver(win, { save, ledger, changed = () => {}, clock = Date.now, random = uuid, hash = digest, inspect = inspectResponse }) {
    const original = win.fetch;
    let observed = 0;
    const tasks = new Set();
    const run = promise => { tasks.add(promise); promise.catch(() => {}).finally(() => tasks.delete(promise)); };
    function wrapper(...args) {
      if (!targetRequest(args[0], args[1], win.location.href)) return Reflect.apply(original, this, args);
      const metaPromise = prepareMeta(args[0], args[1]); // Clone before native fetch can lock a Request body.
      const id = random(), at = clock(), book = ledger();
      let event;
      const meta = metaPromise.then(async m => {
        if (m.skip) return null;
        const key = m.seed ? `h:${await hash(m.seed)}` : `u:${id}`;
        event = { v: 1, id, key, ledger: book, at, updated: clock(), state: 'pending', observation: 'pending', delta: 0, requested: m.requested || '', route: '', label: '', conflict: false, stable: !!m.seed, http: 0 };
        save(event); observed++; changed(); return event;
      });
      const patch = data => { if (!event) return; event = { ...event, ...data, updated: Math.max(clock(), event.updated + 1) }; save(event); changed(); };
      let result;
      try { result = Reflect.apply(original, this, args); }
      catch (error) { run(meta.then(() => patch({ state: 'failed', observation: 'error' }))); throw error; }
      // Return the exact native promise and original Response; side inspection never delays the page.
      run(Promise.resolve(result).then(async response => {
        // Clone synchronously in the fulfillment callback, before the caller can consume its Response.
        let copy; if (response.ok) { try { copy = response.clone(); } catch { /* captured as unreadable below */ } }
        if (!(await meta)) { if (copy?.body) Promise.resolve(copy.body.cancel()).catch(() => {}); return; }
        patch({ state: response.ok ? 'accepted' : 'failed', http: response.status, observation: response.ok ? 'http' : 'error' });
        if (copy) await inspect(copy, patch, { alreadyClone: true });
        else if (response.ok) patch({ observation: 'unreadable' });
      }, async error => {
        if (!(await meta)) return;
        patch({ state: error?.name === 'AbortError' ? 'aborted' : 'failed', observation: 'error' });
      }));
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
      const merged = snapshot(remote ? newestSettings(here.settings, remote.settings) : here.settings, remote ? mergeEvents(here.events, remote.events) : here.events);
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
    // Leave room immediately above the control for ChatGPT's own shortcut tooltip.
    const gap = 62, edge = 12;
    const left = Math.max(edge, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - edge));
    let top = rect.top - height - gap;
    if (top < edge) top = rect.bottom + 12;
    top = Math.max(edge, Math.min(top, viewportHeight - height - edge));
    return { left, top };
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
    let settings = defaultSettings(), records = [], root, host, hoverRoot, hoverHost, activeTrigger, collapsed = true, tab = 'home', notice = '', storageError = hasStorage ? '' : 'Tampermonkey 存储权限未就绪：当前仅临时显示，刷新后不会保留。请检查脚本权限再刷新。', observer;
    let hoverTimer, hoverHideTimer, panelReturnFocus, storageAvailable = hasStorage, uiBound = false, uiReady = false;
    let refreshTimer, lastKeys = '', settingsSnapshot = '', syncBusy = false, syncStatus = '未启用 WebDAV', lastSyncAttempt = 0, configEpoch = 0, currentAbort = null;
    const getDav = () => {
      const empty = { url: '', username: '', password: '', interval: 0, enabled: false, tested: false, approved: false };
      try { const value = gmGet(`${PREFIX}webdav`, empty); return value && typeof value === 'object' ? value : empty; }
      catch { storageAvailable = false; storageError = '本机存储读取失败。请检查 Tampermonkey 权限再刷新；WebDAV 暂停。'; return empty; }
    };
    const load = () => {
      try {
        const keys = gmKeys();
        const allSettings = keys.filter(k => k.startsWith(`${PREFIX}settings.`)).map(k => { try { return validSettings(gmGet(k)); } catch { return null; } }).filter(Boolean);
        if (allSettings.length) settings = allSettings.sort((a, b) => b.updated - a.updated || b.id.localeCompare(a.id))[0];
        else { settings = { ...settings, id: 'initial', updated: 0 }; gmSet(`${PREFIX}settings.initial`, settings); }
        records = keys.filter(k => k.startsWith(`${PREFIX}event.`)).map(k => { try { return validEvent(gmGet(k)); } catch { return null; } }).filter(Boolean);
        lastKeys = keys.length + ':' + records.reduce((n, e) => n + e.updated, 0);
      } catch { storageAvailable = false; storageError = '本机存储不可用，当前计数可能未保存。请先导出并检查 Tampermonkey 权限。'; }
    };
    const save = (event, strict = false) => {
      try {
        const clean = validEvent(event); gmSet(`${PREFIX}event.${clean.id}`, clean);
        const index = records.findIndex(e => e.id === clean.id); if (index < 0) records.push(clean); else records[index] = clean;
      } catch { storageAvailable = false; storageError = '记录写入失败，请导出备份并检查脚本存储。'; if (strict) throw Error(storageError); }
      scheduleRender();
    };
    const exportObject = () => ({ format: 'chatgpt-pro-counter', version: 1, exportedAt: new Date().toISOString(), settings, events: records });
    const backup = reason => {
      load();
      try { gmSet(`${PREFIX}backup.${Math.floor(Date.now() / 60000) % 12}`, { ...exportObject(), reason }); }
      catch { throw Error('安全备份失败，已取消修改；请先导出记录。'); }
    };
    const download = (obj, name) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    function scheduleRender() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { updateHover(); if (root && (collapsed || !['settings', 'sync'].includes(tab))) render(); }, 150); }
    const fmt = ms => new Date(ms).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const esc = str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const button = (action, label, klass = '') => `<button type="button" data-action="${action}" class="${klass}">${label}</button>`;
    function status(e) {
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
      *{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer;border:1px solid var(--line);background:var(--bg);color:var(--fg);padding:7px 11px;border-radius:10px}button:hover{background:var(--soft)}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #ac8df9;outline-offset:2px}button.primary{background:var(--accent-bg);color:var(--accent);border-color:transparent;font-weight:650}button.ghost{border:none;background:transparent;padding:4px 7px;color:var(--muted)}
      .panel{width:min(356px,calc(100vw - 24px));max-height:calc(100dvh - 94px);overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow)}header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px}h1{font-size:15px;margin:0;font-weight:700;letter-spacing:.1px}h1 span{font-size:10px;color:var(--accent);background:var(--accent-bg);padding:3px 6px;margin-left:6px;border-radius:5px;vertical-align:middle}.body{padding:8px 18px 18px}.muted,small{color:var(--muted)}small{font-size:11px}.eyebrow{color:var(--muted);font-size:12px}.number{font-size:42px;letter-spacing:-1.5px;font-weight:700;line-height:1.25;margin-top:5px}.number span{font-size:17px;letter-spacing:0;color:var(--muted);font-weight:400}.meter{height:7px;border-radius:9px;background:var(--soft);overflow:hidden;margin:12px 0}.fill{height:100%;background:linear-gradient(90deg,#3e4ee9,#9766f7,#c995ff);border-radius:9px}.row{display:flex;align-items:center;justify-content:space-between;gap:8px}.meta{font-size:12px;color:var(--muted)}.callout{font-size:11px;color:var(--muted);background:var(--soft);padding:10px 11px;border-radius:10px;margin:12px 0}.warning{color:var(--warn)}.actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.foot{border-top:1px solid var(--line);padding-top:11px;margin-top:12px;font-size:10px;color:var(--muted)}.chip{padding:9px 13px;border-radius:30px;box-shadow:0 3px 20px #31245c18;font-size:12px;display:flex;align-items:center;gap:4px}.chip strong{color:var(--accent);margin:0 5px}nav{display:flex;gap:5px;padding:0 18px 6px}nav button{font-size:12px;border:none;padding:5px 8px}nav button.active{background:var(--accent-bg);color:var(--accent)}label{display:block;font-size:12px;margin:12px 0 4px}input,select{width:100%;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--fg)}.log{list-style:none;margin:0;padding:0}.log li{padding:10px 0;border-bottom:1px solid var(--line)}.log .model{font-size:11px;word-break:break-all;margin-top:3px}.badge{font-size:10px}.empty{padding:25px 0;text-align:center;color:var(--muted)}p{margin:7px 0}.notice{margin:0 18px 8px;padding:8px;background:var(--accent-bg);color:var(--accent);font-size:11px;border-radius:8px} .error{background:var(--soft);color:var(--warn)}
      .launcher{display:flex;justify-content:flex-end;margin-top:10px}.chip:before{content:'✦';color:var(--accent);font-size:15px;margin-right:3px}.chip small{font-size:10px}.hover-card{width:266px;padding:16px 18px;background:var(--bg);border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 42px #35245c24;color:var(--fg)}.hover-title{font-size:12px;color:var(--muted);display:flex;justify-content:space-between;align-items:center}.pro-label{font-weight:650;letter-spacing:.2px;color:var(--accent)}.hover-card .number{font-size:34px;line-height:1.2;margin:8px 0 0}.hover-card .number span{font-size:16px}.hover-card .meter{margin:10px 0;height:5px}.hover-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--muted)}.hover-footer button{font-size:11px;color:var(--accent);border:none;background:transparent;padding:3px 0}.hover-error{font-size:11px;color:var(--warn);margin-top:8px}.panel{animation:appear .16s ease-out}.close{font-size:18px;line-height:1}.chip strong{font-variant-numeric:tabular-nums}.number{font-variant-numeric:tabular-nums}.fill{transition:width .22s ease}@keyframes appear{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}@media(max-width:460px){.hover-card{width:min(266px,calc(100vw - 24px))}.panel{border-radius:18px}}
    `;
    function launcher(total) { return `<div class="launcher"><button type="button" data-action="expand" class="chip" aria-label="打开 Pro 计数器；本机估算 ${total.used}/${settings.cap}" aria-expanded="${!collapsed}" aria-controls="gpc-panel">Pro <strong>${total.used}/${settings.cap}</strong><small> ${storageAvailable ? '本机' : '权限异常'}</small></button></div>`; }
    function render() {
      if (!root) return;
      const focusedAction = root.activeElement?.getAttribute('data-action');
      const total = summarize(records, settings);
      updateHover();
      if (collapsed) { renderMarkup(root, `<style>${style}</style>${launcher(total)}`); if (focusedAction) root.querySelector(`[data-action="${focusedAction}"]`)?.focus(); return; }
      let body = '';
      if (tab === 'settings') {
        const d = new Date(settings.anchor); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        settingsSnapshot = settings.id;
        body = `<form id="settings"><label for="cap">本周期上限（自定义，非官方额度）</label><input id="cap" type="number" min="1" max="1000000" value="${settings.cap}" required><label for="mode">统计方式</label><select id="mode"><option value="fixed"${settings.mode === 'fixed' ? ' selected' : ''}>固定七天周期</option><option value="rolling"${settings.mode === 'rolling' ? ' selected' : ''}>滚动最近七天</option></select><label for="anchor">固定周期锚点（你的浏览器当地时间）</label><input id="anchor" type="datetime-local" value="${local}" required><small>填入你确认的重置时间；每 168 小时一个周期。默认是安装当天零点。滚动模式忽略此项。</small><label for="calibrate">当前已用校准为（首次安装可填写）</label><input id="calibrate" type="number" min="0" max="1000000" placeholder="留空保留现值"><small>会添加一条校准记录，不删除历史；以保存后的统计方式计算差额。</small><label for="ledger">账本</label><select id="ledger">${[...new Set(['default', settings.ledger, ...records.map(e => e.ledger)])].map(id => `<option value="${esc(id)}"${id === settings.ledger ? ' selected' : ''}>${id === settings.ledger ? esc(settings.label) : id === 'default' ? '默认账本' : esc(id.slice(0, 16))}</option>`).join('')}<option value="__new">新建独立账本…</option></select><small>不会识别账号。换账号时请选择独立账本。</small><div class="actions"><button class="primary" type="submit">保存设置</button>${button('home', '取消')}</div></form><div class="foot">修改前自动保存本机备份。不同标签页设置冲突时会提醒刷新。</div>`;
      } else if (tab === 'sync') {
        const cfg = getDav();
        body = `<form id="webdav"><div class="callout">可选：把计数记录、模型标记和周期设置存到你自己的 WebDAV 文件。密码仅在本机 Tampermonkey 存储，不随备份导出；不是加密保险箱。</div><label for="dav-url">HTTPS 文件完整地址</label><input id="dav-url" type="url" value="${esc(cfg.url)}" placeholder="https://你的服务器/dav/pro-counter.json" required autocomplete="off"><small>请先建立父目录。必须支持强 ETag 和条件 PUT；不跟随重定向。</small><label for="dav-user">用户名</label><input id="dav-user" value="${esc(cfg.username)}" autocomplete="off"><label for="dav-pass">密码 / 专用应用密码</label><input id="dav-pass" type="password" placeholder="${cfg.password ? '已保存；留空保留（更换服务器时会清除）' : '建议使用专用应用密码'}" autocomplete="new-password"><label for="dav-interval">自动同步（仅页面打开时）</label><select id="dav-interval">${[0, 5, 15, 30, 60].map(n => `<option value="${n}"${cfg.interval === n ? ' selected' : ''}>${n ? `每 ${n} 分钟` : '关闭，仅手动'}</option>`).join('')}</select><label><input id="dav-approved" type="checkbox" style="width:auto" ${cfg.approved ? 'checked' : ''}> 我同意将计数记录和周期设置上传到上述文件，并在本机保存凭据。</label><div class="actions"><button type="submit" class="primary">测试并保存</button>${button('sync-now', '立即同步')}${button('sync-off', '关闭自动同步')}${button('sync-clear', '清除本机凭据')}</div></form><div class="callout" role="status">${esc(syncStatus)}${syncBusy ? ' · 正在处理…' : ''}</div><div class="foot">需要 Tampermonkey 5.5.1+。安装时的任意域名网络权限仅用于你填写的 WebDAV。同步不包含聊天正文、Cookie、令牌或 WebDAV 密码。两台设备使用同一文件地址；周期设置按更新时间合并，请确保系统时间准确。</div>`;
      } else if (tab === 'log') {
        const rows = grouped(records, settings.ledger).slice(0, 80);
        body = `<div class="row"><span class="eyebrow">${esc(settings.label)} · 最近 ${rows.length} 条</span>${button('export', '导出', 'ghost')}</div><ul class="log">${rows.length ? rows.map(e => `<li><div class="row"><strong class="badge ${e.state === 'failed' || e.state === 'aborted' ? 'warning' : ''}">${esc(status(e))}</strong><small>${fmt(e.at)}</small></div>${e.state === 'manual' ? '' : `<div class="model muted">请求：${esc(e.requested || '未知')}<br>响应路由：${esc(e.conflict ? '字段冲突' : e.route || '未取得')}${e.label ? `<br>回答标签：${esc(e.label)}` : ''}</div><small>${e.observation === 'handoff' ? '响应已转交其他通道；未监听 WebSocket' : e.observation === 'bounded' ? '达到观察上限；后续状态未知' : e.observation === 'unreadable' ? '未解析到响应元数据' : e.observation === 'http' ? '仅确认 HTTP 接收' : ''}${!e.stable ? ' · 缺少稳定 ID，重试可能重复' : ''}${e.attempts > 1 ? ` · ${e.attempts} 次尝试已合并` : ''}</small>`}</li>`).join('') : '<li class="empty">还没有记录<br><small>打开历史对话不会增加计数</small></li>'}</ul><div class="foot">已接收 ≠ 官方扣额。HTTP 失败/取消不计入，但也不能证明平台未扣额；可手动校准。</div>`;
      } else {
        body = `<div class="eyebrow">${settings.mode === 'fixed' ? '本周期' : '最近七天'}已用 · 本机估算</div><div class="number">${total.used}<span> / ${settings.cap}</span></div><div class="meter" role="progressbar" aria-label="本机估算已用" aria-valuemin="0" aria-valuemax="${Math.max(total.used, settings.cap)}" aria-valuenow="${total.used}"><div class="fill" style="width:${Math.min(100, total.used / settings.cap * 100)}%"></div></div><div class="row"><strong>估算剩余 ${total.remaining}</strong><span class="meta">待确认 ${total.pending} · 失败/取消 ${total.failed}</span></div><div class="callout">${settings.mode === 'fixed' ? `下个周期：${fmt(total.next)}<br>锚点由你设置，不是服务端重置时间。` : '每条记录在 168 小时后移出统计窗口。'}${total.raw < 0 ? '<br><span class="warning">校准合计为负，已用暂显示 0，请复核记录。</span>' : ''}</div><div class="meta">已接收 Pro ${total.pro} · 手动校准 ${total.adjustment >= 0 ? '+' : ''}${total.adjustment}</div><div class="actions">${button('plus', '+1 校正')}${button('minus', '−1 校正')}${button('settings', '设置 / 初始用量', 'primary')}</div><div class="actions">${button('export', '导出')}${button('import', '导入合并')}${button('backup', '最近备份', 'ghost')}</div><div class="foot">本机优先 · ${getDav().enabled ? 'WebDAV 已配置' : 'WebDAV 未启用'} · 非官方余额<br>${esc(settings.label)} · ${observer?.healthy() ? (observer.observed() ? '观察器已捕获请求' : '观察器已安装，等待新请求') : '观察器可能被覆盖，请刷新页面'}<br>只按实际请求模型/响应路由判断，订阅名称不会计数。${getDav().enabled ? `<br>${esc(syncStatus)}${Math.max(settings.updated, ...records.map(e => e.updated)) > Number(gmGet(`${PREFIX}lastSync`, 0)) ? '<br>有待同步的新记录；断网时保留在本机。' : ''}` : ''}</div>`;
      }
      renderMarkup(root, `<style>${style}</style><section id="gpc-panel" class="panel" role="dialog" aria-label="ChatGPT Pro 本机计数器"><header><h1>Pro 计数器<span>LOCAL</span></h1><button type="button" data-action="collapse" class="ghost close" aria-label="关闭计数器">×</button></header><nav>${button('home', '概览', tab === 'home' ? 'active' : '')}${button('log', '记录', tab === 'log' ? 'active' : '')}${button('settings', '设置', tab === 'settings' ? 'active' : '')}${button('sync', '同步', tab === 'sync' ? 'active' : '')}</nav>${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ''}${storageError ? `<div class="notice error" role="alert">${esc(storageError)}</div>` : ''}<div class="body">${body}</div><input type="file" id="import" accept="application/json,.json" hidden></section>${launcher(total)}`);
      if (focusedAction) root.querySelector(`[data-action="${focusedAction}"]`)?.focus();
    }
    function manual(delta, at = Date.now()) {
      const id = uuid(); save({ v: 1, id, key: `m:${id}`, ledger: settings.ledger, at, updated: at, state: 'manual', observation: 'manual', delta, requested: '', route: '', label: '', stable: true, conflict: false, http: 0 });
    }
    function bind() {
      root.addEventListener('click', e => {
        const b = e.target.closest('button[data-action]'); if (!b) return;
        try {
          const action = b.dataset.action; notice = '';
          if (['home', 'log', 'settings', 'sync'].includes(action)) { load(); tab = action; collapsed = false; render(); return; }
          if (action === 'collapse' || action === 'expand') { if (action === 'expand') openPanel('home'); else closePanel(); return; }
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
          load(); if (settings.id !== settingsSnapshot) throw Error('另一个标签页修改了设置。请重新打开设置后再保存。');
          const ledger = selected === '__new' ? `book-${uuid().slice(0, 8)}` : selected;
          const label = ledger === settings.ledger ? settings.label : ledger === 'default' ? '默认账本' : ledger;
          const next = validSettings({ v: 1, id: uuid(), updated: Date.now(), cap, mode, anchor, ledger, label });
          if (target !== '' && (!Number.isInteger(Number(target)) || Number(target) < 0 || Number(target) > 1000000)) throw Error('当前已用请填写 0–1000000 的整数');
          backup('修改设置前'); settings = next; gmSet(`${PREFIX}settings.${next.id}`, next);
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
          local: () => { load(); return exportObject(); }, backup: () => backup('同步前'),
          apply: merged => {
            load();
            for (const ev of mergeEvents(records, merged.events)) { const previous = records.find(x => x.id === ev.id); if (!previous || JSON.stringify(previous) !== JSON.stringify(ev)) save(ev, true); }
            const latest = newestSettings(settings, merged.settings); settings = latest; gmSet(`${PREFIX}settings.${latest.id}`, latest);
          } }, { signal: currentAbort.signal, check: sameDestination });
        syncStatus = `同步成功 ${fmt(Date.now())} · 合并 ${result.count} 条记录`;
        gmSet(`${PREFIX}lastSync`, lastSyncAttempt);
      } catch (error) { syncStatus = error.message; }
      finally { syncBusy = false; if (!auto || !['settings', 'sync'].includes(tab)) render(); }
    }
    function closePanel() {
      collapsed = true; render();
      if (panelReturnFocus?.isConnected) panelReturnFocus.focus(); else root?.querySelector('[data-action="expand"]')?.focus();
    }
    function openPanel(next = 'home') {
      panelReturnFocus = activeTrigger?.isConnected ? activeTrigger : null;
      hideHover(); load(); tab = next; collapsed = false; render();
      root?.querySelector('[data-action="collapse"]')?.focus();
    }
    function nativeTrigger(target) {
      if (!target || typeof target.closest !== 'function') return null;
      const el = target.closest('button,[role="button"]'); if (!el || host?.contains(el) || hoverHost?.contains(el)) return null;
      const label = [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid')].filter(Boolean).join(' ').trim();
      if (!/(^|\s)Pro(?:\s|$)|思考强度|思考時間|思考强度|Thinking|reasoning[- ]?effort|thinking[- ]?(?:level|effort|time)/i.test(label)) return null;
      const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) return null;
      const editor = document.querySelector('#prompt-textarea,textarea[name="prompt-textarea"],[contenteditable="true"][data-placeholder],form textarea');
      if (!editor) return null;
      // Locate the control around the live composer; exclude subscription/sidebar Pro labels.
      let ancestor = editor;
      for (let i = 0; ancestor && i < 6; i++, ancestor = ancestor.parentElement) {
        if (ancestor === document.body || ancestor === document.documentElement) break;
        if (ancestor.contains(el)) return el;
      }
      const inputRect = editor.getBoundingClientRect();
      return rect.top >= inputRect.top - 180 && rect.top <= inputRect.bottom + 130 && rect.left >= inputRect.left - 24 && rect.right <= inputRect.right + 180 ? el : null;
    }
    function updateHover() {
      if (!hoverRoot || !activeTrigger || !collapsed || !activeTrigger.isConnected) { if (hoverHost) hoverHost.hidden = true; return; }
      const hadFocus = !!hoverRoot.activeElement;
      const total = summarize(records, settings);
      renderMarkup(hoverRoot, `<style>${style}</style><section class="hover-card" aria-label="Pro 用量，本机估算"><div class="hover-title"><span class="pro-label">✦ Pro</span><span>${settings.mode === 'fixed' ? '本周期' : '最近七天'} · 本机估算</span></div><div class="number">${total.used}<span> / ${settings.cap}</span></div><div class="meter" aria-hidden="true"><div class="fill" style="width:${Math.min(100, total.used / settings.cap * 100)}%"></div></div><div class="hover-footer"><span>估算剩余 ${total.remaining}</span><button type="button" data-action="manage">管理用量 ↗</button></div>${storageError ? '<div class="hover-error">存储异常，请打开计数器检查</div>' : ''}</section>`);
      hoverHost.hidden = false; positionHover();
      if (hadFocus) hoverRoot.querySelector('[data-action="manage"]')?.focus();
    }
    function positionHover() {
      if (!activeTrigger || !hoverHost || hoverHost.hidden) return;
      if (!activeTrigger.isConnected) { hideHover(); return; }
      const rect = activeTrigger.getBoundingClientRect(), size = hoverHost.getBoundingClientRect();
      const pos = hoverPosition(rect, size.width || 266, size.height || 148, win.innerWidth, win.innerHeight);
      hoverHost.style.left = `${pos.left}px`; hoverHost.style.top = `${pos.top}px`;
    }
    function showHover(el) {
      clearTimeout(hoverHideTimer); clearTimeout(hoverTimer);
      if (!collapsed) return;
      activeTrigger = el; hoverTimer = setTimeout(() => { load(); updateHover(); }, 100);
    }
    function hideHover() { clearTimeout(hoverTimer); clearTimeout(hoverHideTimer); activeTrigger = null; if (hoverHost) hoverHost.hidden = true; }
    function queueHide() { clearTimeout(hoverHideTimer); hoverHideTimer = setTimeout(hideHover, 280); }
    function setupHover() {
      document.addEventListener('pointerover', event => { const el = nativeTrigger(event.target); if (el && el !== activeTrigger) showHover(el); else if (el) clearTimeout(hoverHideTimer); }, true);
      document.addEventListener('pointerout', event => { if (activeTrigger && activeTrigger.contains(event.target) && !activeTrigger.contains(event.relatedTarget)) queueHide(); }, true);
      document.addEventListener('focusin', event => { const el = nativeTrigger(event.target); if (el) showHover(el); }, true);
      document.addEventListener('focusout', event => { if (activeTrigger?.contains(event.target)) queueHide(); }, true);
      hoverHost.addEventListener('pointerenter', () => clearTimeout(hoverHideTimer));
      hoverHost.addEventListener('pointerleave', queueHide);
      hoverRoot.addEventListener('focusin', () => clearTimeout(hoverHideTimer));
      hoverRoot.addEventListener('focusout', queueHide);
      hoverRoot.addEventListener('click', event => { if (event.target.closest('[data-action="manage"]')) openPanel('home'); });
      // The native trigger's click/keyboard events are never canceled or replaced.
      document.addEventListener('click', event => { if (nativeTrigger(event.target)) hideHover(); }, true);
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') { hideHover(); if (!collapsed) closePanel(); }
        if (event.altKey && event.shiftKey && event.code === 'KeyP') { event.preventDefault(); if (collapsed) openPanel(); else closePanel(); }
      });
      win.addEventListener('resize', positionHover, { passive: true });
      win.addEventListener('scroll', positionHover, { passive: true, capture: true });
    }
    function theme() {
      if (!host) return;
      let dark = document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark';
      try { if (!dark && !document.documentElement.classList.contains('light') && document.documentElement.dataset.theme !== 'light') dark = win.matchMedia('(prefers-color-scheme: dark)').matches; } catch { /* theme is optional */ }
      host.toggleAttribute('data-dark', dark); hoverHost?.toggleAttribute('data-dark', dark);
    }
    function mount() {
      if (!document.body) return false;
      if (!host) {
        // Commit only after both Shadow DOM roots exist. A one-shot failure must
        // not leave host assigned while root/hoverHost are still missing.
        const nextHost = document.createElement('div'); nextHost.id = 'chatgpt-pro-local-counter';
        nextHost.style.cssText = 'all:initial;position:fixed!important;right:16px!important;bottom:18px!important;z-index:2147483646!important;display:block!important;';
        const nextRoot = nextHost.attachShadow({ mode: 'closed' });
        const nextHoverHost = document.createElement('div'); nextHoverHost.id = 'chatgpt-pro-local-hover'; nextHoverHost.hidden = true;
        nextHoverHost.style.cssText = 'position:fixed;z-index:2147483645;';
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
      observer = installObserver(win, { save, ledger: () => { load(); return settings.ledger; } });
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
    try { new MutationObserver(() => { if (document.body && (!host?.isConnected || !hoverHost?.isConnected)) safeMount(); }).observe(document.documentElement, { childList: true, subtree: true }); } catch { /* interval below also recovers */ }
    setInterval(() => {
      const mounted = safeMount(); const before = lastKeys, s = settings.id; load();
      if (mounted && (collapsed || !['settings', 'sync'].includes(tab))) { if (before !== lastKeys || s !== settings.id || !document.hidden) render(); }
      positionHover();
    }, 5000);
    setInterval(() => { try { const cfg = getDav(); const since = Math.max(lastSyncAttempt, Number(gmGet(`${PREFIX}lastSync`, 0))); if (storageAvailable && cfg.enabled && cfg.tested && cfg.approved && cfg.interval > 0 && Date.now() - since >= cfg.interval * 60000) void doSync(true); } catch { /* no optional-sync failure may remove the UI */ } }, 15000);
    win.addEventListener('focus', () => { const mounted = safeMount(); load(); if (mounted && (collapsed || !['settings', 'sync'].includes(tab))) render(); });
    diagnostics?.mark('ready');
  }
  return { WEEK, PREFIX, modelKind, defaultSettings, validSettings, validEvent, windowFor, kindFor, mergeEvents, grouped, summarize,
    requestMeta, digest, targetRequest, readBounded, prepareMeta, parseMetadata, inspectResponse, installObserver, decodeImport, webDavConfig, supportedManager, createDavTransport, etagOf, newestSettings, snapshot, syncWebDav, renderMarkup, hoverPosition, boot };
});
