// ==UserScript==
// @name         ChatGPT Toolkit
// @namespace    local.chatgpt.pro-counter
// @version      1.1.17
// @homepageURL  https://github.com/YuSaZh/ChatGPT-Toolkit
// @supportURL   https://github.com/YuSaZh/ChatGPT-Toolkit/issues
// @updateURL    https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js
// @downloadURL  https://raw.githubusercontent.com/YuSaZh/ChatGPT-Toolkit/main/chatgpt-pro-counter.user.js
// @description  ChatGPT Toolkit：Pro 本机统计、被动 PoW/图片状态、消息时间/模型、可选账号分账与 WebDAV 同步。非官方工具。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-start
// @sandbox      raw
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

/* Namespace, filename and v1 storage keys stay stable; see README for safe rename upgrades. */
/* Original implementation; bundles MIT Acorn for local module parsing. No ChatGPT API polling. WebDAV is explicitly opt-in. */
(function (factory) {
  'use strict';
  // Register recovery/diagnostic commands before the application factory runs.
  // A missing command can then be distinguished from a failure inside boot().
  const browser = typeof window !== 'undefined' && typeof document !== 'undefined';
  let diagnostics;
  if (browser) {
    const state = { version: '1.1.17', phase: 'entry', frame: 'unchecked', storage: 'unchecked', ui: 'not-started', observer: 'not-started', menu: 'unavailable', hoverListeners: 'not-started', hoverEvent: 'none', hoverMatch: 'unchecked', hoverScope: 'unchecked', hoverCard: 'hidden', hoverPaint: 'unchecked', hoverEditors: 0, hoverMarkers: 0, hoverSends: 0, errors: [] };
    diagnostics = {
      state, open: null, inspectHover: null, inspectStorage: null, inspectMessageInfo: null,
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
        try { Object.assign(state, diagnostics.inspectMessageInfo?.()); } catch (error) { diagnostics.fail('message-diagnostics', error); }
        const text = ['Pro 计数器启动诊断', `脚本版本: ${state.version}`, `启动阶段: ${state.phase}`, `页面检查: ${state.frame}`, `存储接口: ${state.storage}`, `界面状态: ${state.ui}`, `观察器: ${state.observer}`, `消息信息: ${state.messageEnabled || 'unchecked'}`, `只读模块注入: ${state.messageInjection || 'not-started'}`, `注入目标模块: ${state.messageInjectionFactories || 0}`, `自然读取 mapping: ${state.messageObservedMappings || 0}`, `原生挂载回执: ${state.messageRendererCommits || 0}`, `注入消息标签: ${state.messageInjectedLabels || 0}`, `注入账号边界: ${state.messageInjectionAccount || 'not-started'}`, `消息节点: ${state.messageNodes || 0}`, `网络消息元数据: ${state.messageCached || 0}`, `原生已提交路径: ${state.messageFiberPaths || 0}`, `原生消息属性: ${state.messagePropSources || 0}`, `消息页面范围: ${state.messagePage || 'unchecked'}`, `原始页面锚点: ${state.messageDomAnchors || 0}`, `React 属性宿主: ${state.messageReactHosts || 0}`, `React 提交根: ${state.messageReactRoots || 0}`, `已提交结构节点: ${state.messageCommittedFibers || 0}`, `新版消息组件: ${state.messageItemSources || 0}`, `已加载消息快照: ${state.messageStoreSources || 0}`, `原生消息元数据: ${state.messageNative || 0}`, `账号边界隔离节点: ${state.messageFenced || 0}`, `消息标签: ${state.messageBadges || 0}`, `菜单接口: ${state.menu}`, `悬停监听: ${state.hoverListeners}`, `可见输入框: ${state.hoverEditors}`, `可见模型标记: ${state.hoverMarkers}`, `可见发送锚点: ${state.hoverSends}`, `原始模型标记: ${state.hoverRawMarkers || 0}`, `原始发送按钮: ${state.hoverRawSends || 0}`, `原始语音开始按钮: ${state.hoverRawVoices || 0}`, `最近悬停事件: ${state.hoverEvent}`, `最近控件匹配: ${state.hoverMatch}`, `最近输入框范围: ${state.hoverScope}`, `浮卡状态: ${state.hoverCard}`, `最近显示检查: ${state.hoverPaint}`, `document.readyState: ${document.readyState}`, `近期错误: ${state.errors.length ? state.errors.join('\n') : '无'}`, '此报告不读取聊天内容、计数记录或 WebDAV 凭据。'].join('\n');
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
        GM_registerMenuCommand('检查本机计数数据', () => {
          const text = diagnostics.inspectStorage ? diagnostics.inspectStorage() : '计数存储尚未初始化。请先查看启动诊断；不要删除或重装脚本。';
          if (typeof window.alert === 'function') window.alert(text);
        });
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
  const MAX_EVENTS = 20000;
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
  // Read-only inventory. Only count/settings/backup namespaces are read; never
  // inspect WebDAV configuration, credentials, unrelated values or chat content.
  function inspectLocalStorage({ keys, get, includeBackups = true }) {
    const report = { keysReadable: false, recordKeys: 0, settingsKeys: 0, backupKeys: 0, invalidRecords: 0, invalidSettings: 0, invalidBackups: 0, readErrors: 0, dataReadErrors: 0, records: [], settings: [], backups: [] };
    let names;
    try { names = keys(); if (!Array.isArray(names) || names.some(k => typeof k !== 'string')) throw Error('invalid keys'); report.keysReadable = true; }
    catch { report.readErrors++; report.dataReadErrors++; return report; }
    for (const key of names) {
      const type = key.startsWith(`${PREFIX}event.`) ? 'record' : key.startsWith(`${PREFIX}settings.`) ? 'settings' : key.startsWith(`${PREFIX}backup.`) ? 'backup' : '';
      if (!type) continue;
      report[type === 'record' ? 'recordKeys' : type === 'settings' ? 'settingsKeys' : 'backupKeys']++;
      if (type === 'backup' && !includeBackups) continue;
      let value;
      try { value = get(key); } catch { report.readErrors++; if (type !== 'backup') report.dataReadErrors++; if (type === 'backup') report.backups.push({ key, valid: false, count: null, exportedAt: '' }); continue; }
      try {
        if (type === 'record') { const clean = validEvent(value); if (key !== `${PREFIX}event.${clean.id}`) throw Error('key mismatch'); report.records.push(clean); }
        else if (type === 'settings') { const clean = validSettings(value); if (key !== `${PREFIX}settings.${clean.id}`) throw Error('key mismatch'); report.settings.push(clean); }
        else {
          if (value?.format !== 'chatgpt-pro-counter' || value.version !== 1 || !Array.isArray(value.events)) throw Error('invalid backup');
          const clean = snapshot(value.settings, value.events);
          clean.exportedAt = finiteDate(Date.parse(value.exportedAt)) ? new Date(value.exportedAt).toISOString() : '';
          report.backups.push({ key, valid: true, count: clean.events.length, exportedAt: clean.exportedAt, snapshot: clean });
        }
      } catch {
        report[type === 'record' ? 'invalidRecords' : type === 'settings' ? 'invalidSettings' : 'invalidBackups']++;
        if (type === 'backup') report.backups.push({ key, valid: false, count: Array.isArray(value?.events) ? value.events.length : null, exportedAt: '' });
      }
    }
    return report;
  }
  function storageSummary(report, settings, { now = Date.now(), pending = false, persistent = true } = {}) {
    const lines = ['本机计数数据检查（只读）', `存储来源：${persistent ? '当前 Tampermonkey 脚本条目' : '临时内存，刷新后不保留'}`, `存储键：${report.keysReadable ? '可读取' : '读取失败'}`, `记录键 ${report.recordKeys}；有效记录 ${report.records.length}；异常记录 ${report.invalidRecords}`, `设置键 ${report.settingsKeys}；有效设置 ${report.settings.length}；异常设置 ${report.invalidSettings}`, `读取失败 ${report.readErrors}；备份 ${report.backupKeys}；异常备份 ${report.invalidBackups}`, `显示范围：${settings.mode === 'rolling' ? '滚动七天' : '固定七天'}；账号状态：${pending ? '待识别' : '手动或已识别'}`];
    const ledgers = [...new Set([...report.records.map(e => e.ledger), settings.ledger])].sort();
    const indexes = { account: 0, unassigned: 0, manual: 0 };
    for (const ledger of ledgers) {
      const label = ledger === 'default' ? '默认账本' : ledger.startsWith('a_') ? `账号账本 ${++indexes.account}` : ledger.startsWith('unassigned:') ? `未分配账本 ${++indexes.unassigned}` : `独立账本 ${++indexes.manual}`;
      const rows = report.records.filter(e => e.ledger === ledger), groups = grouped(rows, ledger), total = summarize(rows, { ...settings, ledger }, now);
      lines.push(`${label}${ledger === settings.ledger ? '（当前显示）' : ''}：记录 ${rows.length}，去重 ${groups.length}，周期内 ${total.rows.length}，周期外 ${groups.length - total.rows.length}，已接收 Pro ${total.pro}，校准 ${total.adjustment}`);
    }
    report.backups.forEach((b, index) => lines.push(`备份 ${index + 1}：${b.valid ? `${b.exportedAt || '时间未知'}，${b.count} 条` : '读取失败或格式异常，原值保留'}`));
    lines.push('仅检查当前安装条目的本机存储；不能据此判断旧安装、其他浏览器或远端文件是否还有记录。此检查不写入、不恢复、不删除、不联网，也不读取 WebDAV 凭据。');
    return lines.join('\n');
  }
  function completeStorage(report) { return report.keysReadable && !report.dataReadErrors && !report.invalidRecords && !report.invalidSettings; }
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
        try { const data = JSON.parse(body); parseMetadata(data, state); try { opts.onFrame?.(data); } catch { /* optional display */ } } catch { /* malformed frame is ignored */ }
      };
      while (true) {
        const part = await Promise.race([reader.read(), timeout]);
        if (part.done) {
          if (/json/i.test(type)) { try { const data = JSON.parse(json + decoder.decode()); parseMetadata(data, state); try { opts.onFrame?.(data); } catch { /* optional display */ } } catch { report('unreadable'); return; } }
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
  function accountRequest(input, init, base, includeReads = false) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      if (url.origin !== new URL(base).origin) return '';
      if (method === 'GET' && /^\/api\/auth\/session\/?$/.test(url.pathname)) return 'session';
      if (includeReads && method === 'GET' && /^\/backend-api\/(?:accounts?|me)(?:\/|$)/.test(url.pathname)) return 'read';
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
  // Per-message display reads protocol metadata and bounded current-message
  // React props/store snapshots only. No message text, app functions, clipboard or history fetches.
  function conversationPage(url) {
    try { return shortId(new URL(url).pathname.match(/\/c\/([^/]+)\/?$/)?.[1]); } catch { return ''; }
  }
  function conversationHistoryRequest(input, init, base) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      if (method !== 'GET' || url.origin !== new URL(base).origin) return '';
      const id = shortId(url.pathname.match(/^\/backend-api\/conversation\/([^/]+)\/?$/)?.[1]);
      return ['init', 'prepare', 'resume'].includes(id) ? '' : id;
    } catch { return ''; }
  }
  function messageInfo(message, conversation) {
    if (!message || typeof message !== 'object') return null;
    const id = shortId(message.id), role = message.author?.role, metadata = message.metadata;
    if (!id || !['user', 'assistant'].includes(role) || (message.recipient && message.recipient !== 'all') || metadata?.is_visually_hidden_from_conversation) return null;
    const createdAt = typeof message.create_time === 'number' && finiteDate(message.create_time * 1000) ? message.create_time * 1000 : null;
    const resolved = role === 'assistant' ? slug(metadata?.resolved_model_slug) || slug(metadata?.server_ste_metadata?.model_slug) : '';
    const label = role === 'assistant' ? slug(metadata?.model_slug) : '';
    return { id, conversation, role, createdAt, model: resolved || label, rank: resolved ? 2 : label ? 1 : 0 };
  }
  function createMessageInfoState({ page, changed = () => {}, enabled = true, limit = 500 } = {}) {
    let active = !!enabled, epoch = 0, path = '', provisional = '', transition = null, nativeReader = null, moduleBridge = null;
    const rows = new Map(), bound = Math.max(1, Math.min(500, Number.isInteger(limit) ? limit : 500));
    const currentPath = () => { try { const u = new URL(page()); return u.origin + u.pathname; } catch { return ''; } };
    const notify = () => { try { changed(); } catch { /* display only */ } };
    const invalidate = (fence = true, reason = 'invalidate') => { try { if (fence) moduleBridge?.invalidate(reason); else moduleBridge?.route(); } catch {} if (fence) { try { nativeReader?.invalidate(); } catch { /* remain fail closed for owned rows */ } } epoch++; provisional = ''; transition = null; rows.clear(); notify(); };
    function syncPage() {
      const next = currentPath();
      if (next !== path) {
        // A new chat gets its URL after the response supplies its conversation ID.
        // This is the only navigation allowed to retain an in-flight generation.
        if (!(path && !conversationPage(path) && provisional && conversationPage(next) === provisional)) {
          const pending = path && !conversationPage(path) && conversationPage(next) ? { epoch, path, conversation: conversationPage(next) } : null;
          invalidate(false); transition = pending;
        }
        path = next;
      }
    }
    function valid(token, conversation) {
      syncPage();
      if (!active || !token || !conversation) return false;
      // The site may change the URL before our cloned stream receives its first frame.
      // Admit that single new-chat transition only once its exact response ID matches.
      if (token.epoch !== epoch && transition && token.epoch === transition.epoch && token.path === transition.path && !token.conversation && conversation === transition.conversation) token.epoch = epoch;
      if (token.epoch !== epoch) return false;
      const current = conversationPage(path);
      if (token.conversation && token.conversation !== conversation) return false;
      if (current && current !== conversation) return false;
      if (!current && token.path !== path) return false;
      if (provisional && provisional !== conversation) return false;
      if (!current) provisional = conversation;
      return true;
    }
    const forget = id => { if (rows.delete(id)) notify(); };
    function remember(row) {
      if (!row) return;
      const prior = rows.get(row.id);
      if (prior && prior.conversation === row.conversation && prior.role === row.role) {
        row = { ...row, createdAt: row.createdAt ?? prior.createdAt, ...(row.rank < prior.rank ? { model: prior.model, rank: prior.rank } : {}) };
      }
      if (JSON.stringify(prior) === JSON.stringify(row)) return;
      rows.delete(row.id); rows.set(row.id, row);
      while (rows.size > bound) rows.delete(rows.keys().next().value);
      notify();
    }
    return {
      enabled: () => active,
      nativeReader(doc) { if (!nativeReader) nativeReader = createNativeMessageReader(doc, { page }); return nativeReader; },
      moduleBridge(bridge) { moduleBridge = bridge; bridge?.setEnabled(active); },
      setEnabled(value) { if (active !== !!value) { active = !!value; moduleBridge?.setEnabled(active); invalidate(false); } },
      invalidate, syncPage,
      capture(conversation = '') {
        syncPage();
        const current = conversationPage(path);
        if (!active || !path || (conversation && conversation !== current)) return null;
        return { epoch, path, conversation: conversation || current };
      },
      history(token, data) {
        const conversation = shortId(data?.conversation_id) || shortId(data?.id) || token?.conversation;
        if (!valid(token, conversation) || !data?.mapping || typeof data.mapping !== 'object' || Array.isArray(data.mapping)) return;
        let count = 0;
        for (const key in data.mapping) {
          if (!own(data.mapping, key)) continue;
          if (++count > 5000) break;
          const message = data.mapping[key]?.message, row = messageInfo(message, conversation);
          if (row) remember(row); else forget(shortId(message?.id));
        }
      },
      frame(token, data, context = {}) {
        // Context holds only scalar IDs/roles, never a response/message object.
        const visit = (value, depth = 0) => {
          if (!value || typeof value !== 'object' || depth > 6) return;
          if (Array.isArray(value)) { for (const item of value.slice(0, 100)) visit(item, depth + 1); return; }
          const supplied = shortId(value.conversation_id);
          if (supplied) {
            if (context.conversation && context.conversation !== supplied) { context.id = ''; context.role = ''; }
            context.conversation = supplied;
          }
          const conversation = context.conversation || token?.conversation;
          if (value.message && typeof value.message === 'object' && valid(token, conversation)) {
            const row = messageInfo(value.message, conversation);
            if (!row) forget(shortId(value.message.id));
            context.id = row?.id || ''; context.role = row?.role || '';
            remember(row);
          }
          // Only explicit metadata patches after an identified visible message.
          // Unknown/compact/content paths are deliberately not reconstructed.
          if (typeof value.p === 'string') {
            const prior = rows.get(context.id);
            const identityChange = /^\/message\/(?:id|author(?:\/|$)|recipient(?:\/|$))/.test(value.p);
            const visibilityChange = value.p === '/message/metadata/is_visually_hidden_from_conversation';
            if (identityChange || visibilityChange || (value.p.startsWith('/message') && value.o === 'remove')) {
              if (valid(token, conversation)) forget(context.id);
              context.id = ''; context.role = ''; return;
            }
            if (value.p === '/message/metadata') {
              if (prior && valid(token, conversation) && value.v && typeof value.v === 'object' && ['add', 'replace', 'append'].includes(value.o)) {
                const row = messageInfo({ id: prior.id, author: { role: prior.role }, create_time: prior.createdAt === null ? null : prior.createdAt / 1000, metadata: value.v }, conversation);
                if (row) remember(row); else { forget(context.id); context.id = ''; context.role = ''; }
              } else { if (valid(token, conversation)) forget(context.id); context.id = ''; context.role = ''; }
              return;
            }
            if (prior && valid(token, conversation) && prior.conversation === conversation && ['add', 'replace'].includes(value.o)) {
              if (value.p === '/message/create_time' && typeof value.v === 'number' && finiteDate(value.v * 1000)) remember({ ...prior, createdAt: value.v * 1000 });
              if (prior.role === 'assistant' && ['/message/metadata/model_slug', '/message/metadata/resolved_model_slug', '/message/metadata/server_ste_metadata/model_slug'].includes(value.p)) {
                const model = slug(value.v), rank = value.p === '/message/metadata/model_slug' ? 1 : 2;
                if (model) remember({ ...prior, model, rank });
              }
            }
            if (value.p !== '' && value.p !== '/message') return;
            if (value.p === '/message' && value.v && typeof value.v === 'object' && valid(token, conversation)) {
              const row = messageInfo(value.v, conversation); if (!row) forget(shortId(value.v.id)); context.id = row?.id || ''; context.role = row?.role || ''; remember(row); return;
            }
          }
          for (const key of ['data', 'payload', 'v']) if (value[key] && typeof value[key] === 'object') visit(value[key], depth + 1);
        };
        visit(data);
      },
      get(id, role) {
        syncPage(); const row = active && rows.get(id), conversation = conversationPage(path) || provisional;
        return row && row.role === role && row.conversation === conversation ? { ...row } : null;
      },
      size: () => rows.size
    };
  }
  // Read only data properties: getters, component functions, stores and signals
  // are never invoked. Raw messages/props remain page-owned and are not cached.
  function dataProperty(object, key) {
    if (!object || typeof object !== 'object') return undefined;
    try { const property = Object.getOwnPropertyDescriptor(object, key); return property && own(property, 'value') ? property.value : undefined; }
    catch { return undefined; }
  }
  function currentMessageAncestors(element) {
    let attached;
    try {
      const keys = Object.getOwnPropertyNames(element);
      if (keys.length > 200) return [];
      const key = keys.find(key => key.startsWith('__reactFiber$'));
      attached = key && dataProperty(element, key);
    } catch { return []; }
    // React may leave the original Fiber on a host node after a commit. Only
    // inspect a branch that reaches the committed root, never both versions.
    for (const start of [attached, dataProperty(attached, 'alternate')]) {
      const chain = [], visited = new Set();
      let node = start, steps = 0;
      while (node && typeof node === 'object' && chain.length < 80 && !visited.has(node)) {
        visited.add(node); chain.push(node);
        const parent = dataProperty(node, 'return');
        if (!parent) {
          const root = dataProperty(node, 'stateNode');
          if (dataProperty(root, 'current') === node) return chain;
          break;
        }
        // Both alternates can point at the same committed parent after a
        // bailout. Root equality alone then accepts stale props. Verify each
        // edge is actually present in that parent's child/sibling list.
        let child = dataProperty(parent, 'child'), linked = false;
        const siblings = new Set();
        while (child && typeof child === 'object' && !siblings.has(child) && ++steps <= 500) {
          if (child === node) { linked = true; break; }
          siblings.add(child); child = dataProperty(child, 'sibling');
        }
        if (!linked) break;
        node = parent;
      }
    }
    return [];
  }
  // React bailouts may reuse a child list without rewriting each child's return
  // pointer. Return links can locate the root, but cannot prove current ancestry.
  // Build canonical parent links by walking root.current forward exactly once.
  function createCommittedMessageIndex(doc) {
    const parents = new WeakMap(), hosts = new WeakMap(), members = new WeakSet(), fibers = [];
    const anchors = '[data-message-id],[data-turn-key],[data-user-message-bubble],[data-content-search-turn-key],[data-chatgpt-conversation-selection-target],[data-app-action-timeline-scroll],main';
    const marked = Array.from(doc.querySelectorAll(anchors)).slice(-600);
    // The page can mount independent React roots. A widget's root must not hide
    // the conversation root, and a non-React <main> must not disable fallback.
    const seeds = [...new Set([...marked, ...Array.from(doc.querySelectorAll('div,article,section')).slice(0,1500)])];
    const roots = new Set(), located = new WeakMap();
    let attachedCount = 0;
    for (const element of seeds) {
      let attached;
      try {
        const keys = Object.getOwnPropertyNames(element);
        if (keys.length > 200) continue;
        const key = keys.find(key => key.startsWith('__reactFiber$') || key.startsWith('__reactContainer$'));
        attached = key && dataProperty(element, key);
      } catch { continue; }
      if (!attached || typeof attached !== 'object') continue;
      attachedCount++;
      const seen = new Set(), path = [];
      let current = null;
      for (let node = attached, depth = 0; node && typeof node === 'object' && depth < 256 && !seen.has(node); node = dataProperty(node, 'return'), depth++) {
        if (located.has(node)) { current = located.get(node); break; }
        seen.add(node); path.push(node);
        const root = dataProperty(node, 'stateNode'), candidate = dataProperty(root, 'current');
        if (dataProperty(node, 'tag') === 3 && candidate && dataProperty(candidate, 'stateNode') === root) { current = candidate; break; }
      }
      // An unresolved truncated path may be resolved from a shallower host later.
      if (current) { for (const node of path) located.set(node, current); roots.add(current); }
      if (roots.size >= 24) break;
    }
    const stack = [...roots].reverse().map(fiber => ({ fiber, parent: null, depth: 0 }));
    let steps = 0;
    while (stack.length && ++steps <= 24000) {
      const { fiber, parent, depth } = stack.pop();
      if (!fiber || typeof fiber !== 'object' || members.has(fiber) || depth > 256) continue;
      members.add(fiber); parents.set(fiber, parent); fibers.push(fiber);
      const sibling = dataProperty(fiber, 'sibling'); if (sibling && parent) stack.push({ fiber: sibling, parent, depth });
      const props = dataProperty(fiber, 'memoizedProps'), tag = dataProperty(fiber, 'tag');
      if (([22,23].includes(tag) && dataProperty(fiber, 'memoizedState') != null) || dataProperty(props, 'mode') === 'hidden') continue;
      const element = dataProperty(fiber, 'stateNode');
      if (tag === 5 && element?.nodeType === 1 && element.isConnected) hosts.set(element, fiber);
      const child = dataProperty(fiber, 'child'); if (child) stack.push({ fiber: child, parent: fiber, depth: depth + 1 });
    }
    return {
      count: fibers.length, anchors: marked.length, attached: attachedCount, roots: roots.size,
      has: fiber => members.has(fiber),
      boundaries(conversation) {
        const found = fibers.filter(fiber => {
          const props = dataProperty(fiber, 'memoizedProps');
          return Array.isArray(dataProperty(props, 'renderedTurns')) && (!conversation || [dataProperty(props, 'conversationId'), dataProperty(props, 'browserConversationId')].includes(conversation));
        });
        return found.length ? found : [...roots];
      },
      chain(element) {
        const chain = [];
        for (let fiber = hosts.get(element); fiber && chain.length <= 256; fiber = parents.get(fiber)) chain.push(fiber);
        return roots.has(chain.at(-1)) ? chain : [];
      }
    };
  }
  // The current frontend renders item/assistantItem components rather than the
  // old DOM ID/role pair. Discover their committed host nodes, then read only
  // materialized React store snapshots. No getSnapshot, scope.get, watch,
  // component, module factory, signal or other application function is called.
  function currentItemTargets(doc, conversation = '', index = createCommittedMessageIndex(doc)) {
    const roots = new Set(index.boundaries(conversation)), targets = new Map();
    const hidden = fiber => ([22,23].includes(dataProperty(fiber, 'tag')) && dataProperty(fiber, 'memoizedState') != null) || dataProperty(dataProperty(fiber, 'memoizedProps'), 'mode') === 'hidden';
    function hostOf(component, id, role) {
      const stack = [dataProperty(component, 'child')], seen = new Set();
      let count = 0;
      while (stack.length && ++count <= 300) {
        const fiber = stack.pop();
        if (!fiber || typeof fiber !== 'object' || seen.has(fiber) || !index.has(fiber)) continue;
        seen.add(fiber);
        const sibling = dataProperty(fiber, 'sibling'); if (sibling) stack.push(sibling);
        if (hidden(fiber)) continue;
        const nestedProps = dataProperty(fiber, 'memoizedProps');
        const nestedItem = dataProperty(nestedProps, 'item') || dataProperty(nestedProps, 'assistantItem');
        const nestedType = dataProperty(nestedItem, 'type');
        if (['user-message','assistant-message'].includes(nestedType)) {
          const nestedId = shortId(dataProperty(nestedItem, 'latestMessageId')) || (role === 'user' ? shortId(dataProperty(nestedItem, 'serverMessageId')) : '') || shortId(dataProperty(nestedItem, 'messageId'));
          if (nestedType !== role + '-message' || nestedId !== id) continue;
        }
        const element = dataProperty(fiber, 'stateNode');
        if (dataProperty(fiber, 'tag') === 5 && element?.nodeType === 1 && element.isConnected && ['DIV','ARTICLE','SECTION','LI','P','SPAN'].includes(element.tagName) && !element.closest?.('[hidden],[aria-hidden="true"],[inert],[role="dialog"],[role="menu"],aside,nav,button,a')) return element;
        const child = dataProperty(fiber, 'child'); if (child) stack.push(child);
      }
      return null;
    }
    let count = 0;
    const seen = new Set(), stack = [...roots];
    while (stack.length && ++count <= 24000) {
      const fiber = stack.pop();
      if (!fiber || typeof fiber !== 'object' || seen.has(fiber) || !index.has(fiber)) continue;
      seen.add(fiber);
      const sibling = dataProperty(fiber, 'sibling'); if (sibling && !roots.has(fiber)) stack.push(sibling);
      if (hidden(fiber)) continue;
      const child = dataProperty(fiber, 'child'); if (child) stack.push(child);
      const props = dataProperty(fiber, 'memoizedProps');
      const assistant = dataProperty(props, 'assistantItem'), item = assistant || dataProperty(props, 'item');
      const type = dataProperty(item, 'type');
      if (!['user-message','assistant-message'].includes(type)) continue;
      const role = type === 'user-message' ? 'user' : 'assistant';
      if (assistant && role !== 'assistant') continue;
      // Match the actual returned action-row identity before the item's fallback.
      const rendered = assistant ? dataProperty(dataProperty(child, 'memoizedProps'), 'messageId') : '';
      const id = shortId(rendered) || shortId(dataProperty(item, 'latestMessageId')) || (role === 'user' ? shortId(dataProperty(item, 'serverMessageId')) : '') || shortId(dataProperty(item, 'messageId'));
      const conversation = shortId(dataProperty(props, 'conversationId'));
      if (!id || !conversation) continue;
      const element = hostOf(fiber, id, role);
      if (!element) continue;
      const chain = index.chain(element);
      if (!chain.includes(fiber)) continue;
      const key = [conversation, id, role].join('\0'), prior = targets.get(key);
      if (prior && (prior.assistant || !assistant)) continue;
      targets.set(key, { element, id, role, props, item, chain, conversation, assistant: !!assistant });
      if (targets.size >= 500) break;
    }
    return [...targets.values()];
  }
  function createNativeMessageReader(doc, { page } = {}) {
    let sourceEpoch = 0;
    const sourceEpochs = new WeakMap(), blockedNodes = new WeakMap();
    const observedSources = { add(value) { if (!sourceEpochs.has(value)) sourceEpochs.set(value, sourceEpoch); } };
    const blockedSources = { has: value => sourceEpochs.has(value) && sourceEpochs.get(value) < sourceEpoch };
    function fenceNode(element, id, role) {
      let identities = blockedNodes.get(element);
      if (!identities) { identities = new Set(); blockedNodes.set(element, identities); }
      identities.add([id, role].join('\0'));
    }
    let report = {}, itemTargets = [], index = null;
    const path = () => { try { return new URL(page()).origin + new URL(page()).pathname; } catch { return ''; } };
    function sources(element) {
      const result = [];
      const chain = index?.chain(element) || currentMessageAncestors(element);
      if (chain.length) report.messageFiberPaths = (report.messageFiberPaths || 0) + 1;
      for (const fiber of chain) {
        const props = dataProperty(fiber, 'memoizedProps');
        const messages = dataProperty(props, 'messages'), conversation = dataProperty(props, 'conversation');
        // Source facts: ChatGPT's message renderer receives these props and
        // emits the DOM identity from messages[0]. No whole-app tree traversal.
        if (Array.isArray(messages) && messages.length <= 100 && conversation && typeof conversation === 'object') {
          observedSources.add(props);
          result.push({ props, messages, conversation });
          report.messagePropSources = (report.messagePropSources || 0) + 1;
          break; // nearest message boundary only
        }
      }
      return result;
    }
    function scalarMessage(value) {
      const author = dataProperty(value, 'author'), metadata = dataProperty(value, 'metadata'), route = dataProperty(metadata, 'server_ste_metadata');
      return {
        id: dataProperty(value, 'id'), author: { role: dataProperty(author, 'role') }, recipient: dataProperty(value, 'recipient'), create_time: dataProperty(value, 'create_time'),
        metadata: { is_visually_hidden_from_conversation: dataProperty(metadata, 'is_visually_hidden_from_conversation'), model_slug: dataProperty(metadata, 'model_slug'), resolved_model_slug: dataProperty(metadata, 'resolved_model_slug'), server_ste_metadata: { model_slug: dataProperty(route, 'model_slug') } }
      };
    }
    return {
      begin(enabled = true) {
        report = { messageFiberPaths: 0, messagePropSources: 0, messageFenced: 0, messageItemSources: 0, messageStoreSources: 0, messagePage: conversationPage(path()) ? 'conversation' : 'not-conversation', messageCommittedFibers: 0, messageDomAnchors: 0, messageReactHosts: 0, messageReactRoots: 0 };
        index = enabled && conversationPage(path()) ? createCommittedMessageIndex(doc) : null;
        report.messageCommittedFibers = index?.count || 0;
        report.messageDomAnchors = index?.anchors || 0; report.messageReactHosts = index?.attached || 0; report.messageReactRoots = index?.roots || 0;
        itemTargets = enabled && conversationPage(path()) ? currentItemTargets(doc, conversationPage(path()), index) : [];
      },
      targets: () => itemTargets,
      end() { index = null; itemTargets = itemTargets.map(({ element, id, role }) => ({ element, id, role })); },
      report: () => ({ ...report }),
      invalidate() {
        sourceEpoch++;
        // Auth requests fence scalar node identities before native fetch. The
        // Fiber scan remains on the deferred display path, not the request path.
        for (const element of Array.from(doc.querySelectorAll('[data-message-id][data-message-author-role]')).slice(-500)) {
          fenceNode(element, element.getAttribute('data-message-id'), element.getAttribute('data-message-author-role'));
        }
        // New-frontend hosts were already discovered on the display path. Keep
        // request-time account invalidation scalar and bounded as before.
        for (const target of itemTargets) fenceNode(target.element, target.id, target.role);
      },
      read(element, id, role, observedConversation = '', target = null) {
        const currentPath = path(), conversation = conversationPage(currentPath);
        if (!conversation || !shortId(id) || !['user', 'assistant'].includes(role)) return null;
        if (blockedNodes.get(element)?.has([id, role].join('\0'))) { report.messageFenced = (report.messageFenced || 0) + 1; return null; }
        if (target) {
          report.messageFiberPaths++; report.messageItemSources++;
          observedSources.add(target.props);
          if (blockedSources.has(target.props)) { report.messageFenced++; return { rejected: true }; }
          // A browser/server ID and internal ID are linked only when the native
          // boundary supplies both. Never substitute the URL for missing proof.
          let bound = target.conversation === conversation, conflict = false;
          for (const fiber of target.chain) {
            const props = dataProperty(fiber, 'memoizedProps');
            const internal = shortId(dataProperty(props, 'conversationId'));
            const browser = shortId(dataProperty(props, 'browserConversationId'));
            if (internal === target.conversation && browser) {
              if (browser === conversation) bound = true; else conflict = true;
            }
          }
          if (conflict) return { rejected: true };
          const checked = new Set();
          function fromSnapshot(value, external = false) {
            if (!value || typeof value !== 'object' || Array.isArray(value) || checked.has(value)) return null;
            checked.add(value);
            const explicit = shortId(dataProperty(value, 'conversation_id'));
            const mapping = explicit ? dataProperty(value, 'mapping') : external && bound ? value : null;
            if (explicit && explicit !== conversation) return null;
            if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return null;
            const message = dataProperty(dataProperty(mapping, id), 'message');
            if (!message) return null;
            observedSources.add(value); observedSources.add(mapping); observedSources.add(message);
            if (blockedSources.has(value) || blockedSources.has(mapping) || blockedSources.has(message)) { report.messageFenced++; return { rejected: true }; }
            if (dataProperty(message, 'id') !== id || dataProperty(dataProperty(message, 'author'), 'role') !== role) return { rejected: true };
            report.messageStoreSources++;
            const row = messageInfo(scalarMessage(message), conversation);
            return row ? { ...row, source: 'native-store' } : { rejected: true };
          }
          const liveSnapshots = [], querySnapshots = [];
          for (const fiber of target.chain) {
            let hook = dataProperty(fiber, 'memoizedState'), steps = 0;
            const visited = new Set();
            while (hook && typeof hook === 'object' && ++steps <= 160 && !visited.has(hook)) {
              visited.add(hook);
              const value = dataProperty(hook, 'memoizedState'), queue = dataProperty(hook, 'queue');
              // React useSyncExternalStore caches the committed snapshot in both
              // locations. Inspect it; do not invoke the snapshot callback.
              const external = value === dataProperty(queue, 'value') && typeof dataProperty(queue, 'getSnapshot') === 'function';
              if (external) liveSnapshots.push(value);
              querySnapshots.push(value, dataProperty(value, 'data'));
              hook = dataProperty(hook, 'next');
            }
          }
          // Register every eligible candidate for account fencing, including
          // lower-priority query snapshots that could become visible later.
          let selected = null;
          for (const value of liveSnapshots) { const row = fromSnapshot(value, true); selected ||= row; }
          for (const value of querySnapshots) { const row = fromSnapshot(value); selected ||= row; }
          if (selected) return selected;
          // A proven component identity also lets a naturally observed network
          // row attach on the new frontend even when its raw store is absent.
          return bound ? null : { rejected: true };
        }
        const candidates = sources(element);
        for (const source of candidates) {
          if (blockedSources.has(source.props)) { report.messageFenced = (report.messageFenced || 0) + 1; return null; }
          if (shortId(dataProperty(source.conversation, 'id')) !== conversation) return { rejected: true };
          // The group's first message is the exact host identity; other group
          // members can be reasoning/tool records and must not be mislabeled.
          const first = dataProperty(source.messages, '0');
          if (dataProperty(first, 'id') !== id || dataProperty(dataProperty(first, 'author'), 'role') !== role) return { rejected: true };
          const row = messageInfo(scalarMessage(first), conversation);
          return row ? { ...row, source: 'native-props' } : { rejected: true };
        }
        // This attribute is emitted by the native renderer from model_slug.
        // It is only a label fallback; never a selected/requested model guess.
        const model = role === 'assistant' ? slug(element.getAttribute('data-message-model-slug')) : '';
        // The attribute alone cannot prove which conversation a recycled node
        // belongs to. Require an independently observed exact current ID.
        if (!model || observedConversation !== conversation) return null;
        return { id, conversation, role, createdAt: null, model, rank: 1, source: 'native-attribute' };
      }
    };
  }
  const messageBadgeCache = new WeakMap();
  function renderMessageInfo(doc, state, badges, nativeReader) {
    state.syncPage();
    nativeReader ||= state.nativeReader?.(doc);
    nativeReader?.begin(state.enabled());
    const found = new Set(), report = { messageEnabled: state.enabled() ? 'on' : 'off', messageNodes: 0, messageCached: state.size(), messageNative: 0, messageBadges: 0 };
    const targets = Array.from(doc.querySelectorAll('[data-message-id][data-message-author-role]')).slice(-500).map(element => ({ element, id: element.getAttribute('data-message-id'), role: element.getAttribute('data-message-author-role') }));
    const legacyIds = new Set(targets.map(target => [target.id, target.role].join('\0')));
    for (const target of nativeReader?.targets?.() || []) if (!legacyIds.has([target.id, target.role].join('\0'))) targets.push(target);
    if (state.enabled()) for (const target of targets) {
      const { element, id, role } = target;
      report.messageNodes++;
      let row = state.get(id, role);
      if (nativeReader) {
        const native = nativeReader.read(element, id, role, row?.conversation, target.props ? target : null);
        if (native?.rejected) row = null;
        else if (native) { report.messageNative++; row = row ? { ...native, createdAt: native.createdAt ?? row.createdAt, model: row.rank > native.rank ? row.model : native.model } : native; }
      }
      if (!row || (!row.createdAt && !row.model)) continue;
      found.add(element);
      let badge = badges.get(element);
      if (!badge || badge.parentNode !== element) {
        badge?.remove(); badge = doc.createElement('span'); badge.className = 'chatgpt-toolkit-message-info';
        badge.style.cssText = 'display:block;max-width:100%;margin-top:6px;font:11px/1.5 system-ui,sans-serif;color:inherit;opacity:.65;overflow-wrap:anywhere;user-select:text;';
        element.appendChild(badge); badges.set(element, badge);
      }
      const renderKey = JSON.stringify([row.id, row.conversation, row.role, row.createdAt, row.model]);
      if (messageBadgeCache.get(badge) === renderKey) continue;
      messageBadgeCache.set(badge, renderKey);
      const date = row.createdAt ? new Date(row.createdAt) : null;
      const text = [date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), row.model].filter(Boolean).join(' · ');
      const title = [date ? `消息创建时间（本地）：${date.toLocaleString()} (${date.toISOString()})` : '', row.model ? `响应模型：${row.model}` : ''].filter(Boolean).join('\n');
      if (badge.textContent !== text) badge.textContent = text;
      if (badge.getAttribute('title') !== title) badge.setAttribute('title', title);
      if (badge.getAttribute('aria-label') !== title) badge.setAttribute('aria-label', title);
    }
    for (const [element, badge] of badges) if (!found.has(element)) { badge.remove(); badges.delete(element); }
    report.messageBadges = found.size;
    nativeReader?.end?.();
    return { ...report, ...nativeReader?.report() };
  }
  function installObserver(win, { save, ledger, changed = () => {}, clock = Date.now, random = uuid, hash = digest, inspect = inspectResponse, imageQuota, pow, account, captureLedger, messageInfoState }) {
    const original = win.fetch;
    let observed = 0;
    const tasks = new Set();
    const run = promise => { tasks.add(promise); promise.catch(() => {}).finally(() => tasks.delete(promise)); };
    function wrapper(...args) {
      let metaPromise, quotaKind = '', powKind = '', accountKind = '', accountToken, quotaToken, powToken, quotaBase = '', capturedLedger, historyId = '', messageToken;
      // Capture a cached scalar before native fetch can re-enter page code.
      // No storage read or hashing here; a failed snapshot never falls back.
      if (captureLedger) { try { capturedLedger = captureLedger(); } catch { capturedLedger = null; } }
      // Identity fences cannot be skipped by failures in optional display work.
      try {
        // Display privacy fences apply even with manual account-ledger mode.
        if (messageInfoState) { const reason = accountRequest(args[0], args[1], win.location.href, true); if (reason) messageInfoState.invalidate(true, 'request:' + reason); }
      } catch { /* optional display cannot block identity/account checks */ }
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
      try {
        if (messageInfoState?.enabled()) {
          historyId = conversationHistoryRequest(args[0], args[1], win.location.href);
          if (historyId || metaPromise) messageToken = messageInfoState.capture(historyId);
        }
      } catch { /* optional metadata display */ }
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
        if (historyId && messageToken && !nativeThrew) run(Promise.resolve(result).then(async response => {
          if (!response.ok || response.redirected || !/json/i.test(response.headers.get('content-type') || '')) return;
          if (response.url && conversationHistoryRequest(response.url, { method: 'GET' }, quotaBase) !== historyId) return;
          const text = await readBounded(response.clone().body, MAX_BODY, 1500);
          messageInfoState.history(messageToken, JSON.parse(text));
        }));
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
          const id = random(), at = clock();
          let book; try { book = captureLedger ? capturedLedger : ledger(); } catch { book = null; }
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
              let counted = null;
              try { counted = await meta; } catch { /* display still works if accounting fails */ }
              if (!counted && !messageToken) return;
              const safePatch = data => { try { patch(data); } catch { /* accounting cannot stop display parsing */ } };
              safePatch({ state: response.ok ? 'accepted' : 'failed', http: response.status, observation: response.ok ? 'http' : 'error' });
              const streamContext = {};
              const displayAllowed = messageToken && response.ok && !response.redirected && (!response.url || targetRequest(response.url, { method: 'POST' }, quotaBase));
              if (copy) await inspect(copy, safePatch, { alreadyClone: true, onFrame: displayAllowed ? data => messageInfoState.frame(messageToken, data, streamContext) : undefined });
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
    if (obj?.format !== 'chatgpt-pro-counter' || obj.version !== 1 || !Array.isArray(obj.events) || obj.events.length > MAX_EVENTS) throw Error('不是兼容的计数器备份');
    return { settings: validSettings(obj.settings), events: mergeEvents([], obj.events) };
  }
  function webDavConfig(v) {
    if (!v || typeof v.url !== 'string' || !v.url.trim()) throw Error('请填写 WebDAV HTTPS 地址');
    // Versionless saved configs are exact-file destinations, including extensionless files.
    // Never infer a migration from a suffix or silently point existing users at a new file.
    if (v.version !== undefined && v.version !== 2) throw Error('不支持此 WebDAV 配置版本，请重新配置');
    const mode = v.version === undefined ? 'file' : v.mode;
    if (!['base', 'file'].includes(mode)) throw Error('WebDAV 地址模式不正确');
    const raw = v.url.trim();
    if (/[\u0000-\u0020\u007f\\?#]/.test(raw)) throw Error('HTTPS 地址不能包含空白、反斜杠、查询参数或片段');
    const parts = /^https:\/\/[^/]+(\/.*)?$/i.exec(raw);
    if (!parts) throw Error('须使用 HTTPS 地址');
    const path = parts[1] || '/';
    const segments = path.split('/');
    // Check before URL parsing: WHATWG URL would otherwise erase dot traversal.
    for (const segment of segments) {
      let decoded; try { decoded = decodeURIComponent(segment); } catch { throw Error('地址路径编码不正确'); }
      if (decoded === '.' || decoded === '..' || /[\u0000-\u001f\u007f\\/%?#]/.test(decoded)) throw Error('地址路径不能包含点路径、编码分隔符或多重编码');
    }
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw Error('须使用 HTTPS 地址，不含用户名、密码、查询参数或片段');
    if (mode === 'file' && u.pathname.endsWith('/')) throw Error('旧文件模式须填写完整文件地址；目录请改选基础目录模式');
    if (mode === 'base' && path.includes('//')) throw Error('基础目录路径不能包含重复斜杠，请填写准确的目录地址');
    if (mode === 'base' && !u.pathname.endsWith('/')) u.pathname += '/';
    const username = String(v.username || ''), password = String(v.password || '');
    if (username.includes(':') || username.length > 512 || password.length > 4096) throw Error('用户名或密码格式不正确');
    const interval = Number(v.interval || 0);
    if (![0, 5, 15, 30, 60].includes(interval)) throw Error('同步间隔不正确');
    return { version: 2, mode, url: u.href, username, password, interval, enabled: !!v.enabled, tested: !!v.tested, approved: !!v.approved };
  }
  function webDavTargets(config) {
    const cfg = webDavConfig(config);
    const directoryUrl = cfg.mode === 'base' ? cfg.url + 'ChatGPT-Toolkit/' : '';
    return { directoryUrl, fileUrl: directoryUrl ? directoryUrl + 'data.json' : cfg.url };
  }
  function supportedManager(info) {
    // Conservative minimum: includes documented redirect control and later request-abort fixes.
    if (info?.scriptHandler !== 'Tampermonkey') return false;
    const parts = String(info.version || '').split('.').map(Number);
    return parts[0] > 5 || (parts[0] === 5 && (parts[1] > 5 || (parts[1] === 5 && (parts[2] || 0) >= 1)));
  }
  function createDavTransport(gmRequest, info, timeout = 20000, trace = () => {}) {
    return (config, method, headers = {}, data, signal) => new Promise((resolve, reject) => {
      if (!supportedManager(info)) { reject(Error('WebDAV 需要 Tampermonkey 5.5.1 或更新版；当前仅本机计数')); return; }
      let cfg, target;
      try {
        cfg = webDavConfig(config);
        const paths = webDavTargets(cfg);
        if (!['GET', 'PUT', 'MKCOL'].includes(method) || method === 'MKCOL' && !paths.directoryUrl) throw Error('不支持此 WebDAV 操作');
        if (method === 'MKCOL' && !cfg.approved) throw Error('请先确认在基础目录下建立同步目录');
        target = method === 'MKCOL' ? paths.directoryUrl : paths.fileUrl;
      } catch (e) { reject(e); return; }
      let ended = false, handle, timer, streaming = false, streamText, loadedResponse, finalSeen = false, finalStatus = 0;
      const startedAt = Date.now();
      const cancel = () => { end(Error('WebDAV 操作已取消')); try { handle?.abort(); } catch {} };
      const end = (err, result) => {
        if (ended) return; ended = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
        // Fixed fields only. Never retain config, headers, URLs, bodies, or errors.
        const entry = { method, startedAt, elapsedMs: Math.max(0, Date.now() - startedAt), streamStarted: streaming, streamEOF: streamText !== undefined, finalSeen, status: finalStatus, outcome: err ? 'failed' : 'completed' };
        try { trace(entry); } catch { /* diagnostics must not affect transport */ }
        const progress = `${method}；HTTP ${finalStatus || '未取得'}；最终回调${finalSeen ? '已到达' : '未到达'}；流${!streaming ? '未开始' : streamText === undefined ? '未结束' : '已结束'}`;
        err ? reject(Error(`${err.message}（${progress}）`)) : resolve(result);
      };
      // onloadstart can expose the stream before status/headers are available.
      // Its snapshot is never authoritative, even after the stream reaches EOF.
      const finishStream = () => { if (loadedResponse && streamText !== undefined) end(null, { ...loadedResponse, responseText: streamText }); };
      if (signal?.aborted) { cancel(); return; }
      signal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => { end(Error('WebDAV 请求超时，本机记录已保留')); try { handle?.abort(); } catch { /* ignore */ } }, timeout);
      const auth = cfg.username || cfg.password ? 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(cfg.username + ':' + cfg.password))) : '';
      try {
        handle = gmRequest({ method, url: target, headers: { ...headers, ...(auth ? { Authorization: auth } : {}) }, data,
          anonymous: true, redirect: 'error', fetch: true, nocache: true, responseType: 'stream',
          onloadstart: response => {
            if (ended || streaming) return;
            if (!response.response || typeof response.response.getReader !== 'function') return;
            streaming = true;
            if ((response.finalUrl && response.finalUrl !== target) || response.status >= 300 && response.status < 400) { end(Error('拒绝重定向；请填写最终 HTTPS 地址')); try { handle?.abort(); } catch {} return; }
            readBounded(response.response, MAX_IMPORT, timeout).then(text => { streamText = text; finishStream(); }, () => { end(Error('WebDAV 响应超时或超过 5 MB；本机记录已保留')); try { handle?.abort(); } catch {} });
          },
          onload: response => {
            if (ended) return;
            finalSeen = true; finalStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 0;
            if ((response.finalUrl && response.finalUrl !== target) || response.status >= 300 && response.status < 400) { end(Error('拒绝重定向；请填写最终 HTTPS 地址')); try { handle?.abort(); } catch {} return; }
            if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) { end(Error('WebDAV 未收到有效 HTTP 响应；请检查 Tampermonkey 网络权限、网络连接或被拒绝的重定向，本机记录已保留')); try { handle?.abort(); } catch {} return; }
            if (streaming) { loadedResponse = response; finishStream(); return; }
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
    if (!cfg.approved && (!options.testOnly || cfg.mode === 'base')) throw Error('请先确认允许建立同步目录并同步计数记录和周期设置');
    const check = () => { if (options.signal?.aborted) throw Error('WebDAV 操作已取消'); options.check?.(); };
    if (cfg.mode === 'base') {
      check();
      const created = await request(cfg, 'MKCOL', {}, undefined, options.signal);
      check();
      if (created.status === 409) throw Error('基础目录不存在或不是目录，请检查填写的 WebDAV 基础目录；只会在该地址下建立 ChatGPT-Toolkit 同步目录');
      if (![201, 405].includes(created.status)) throw Error(`建立同步目录失败 HTTP ${created.status}；请检查基础目录和创建权限，本机记录已保留`);
      // 405 commonly means the collection exists. It is not proof of access:
      // the following GET still must validate the file and (when present) ETag.
    }
    let backedUp = false;
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
      if (!events.length) throw Error('没有可同步的记录，已停止空文件上传；请先检查所有本机账本和备份。');
      if (events.length > MAX_EVENTS) throw Error('合并记录超过 20,000 条上限，未上传；本机与远端均未改写，请先导出留存并人工整理');
      const merged = snapshot(remote ? newestSettings(here.settings, remote.settings) : here.settings, events);
      if (new TextEncoder().encode(JSON.stringify(merged)).byteLength > MAX_IMPORT) throw Error('合并文件超过 5 MB，未上传；请导出备份');
      check();
      if (!backedUp) { await makeBackup(); backedUp = true; } // Preserve the pre-sync snapshot across conflict retries.
      check();
      const result = await request(cfg, 'PUT', { 'Content-Type': 'application/json; charset=utf-8', ...(tag ? { 'If-Match': tag } : { 'If-None-Match': '*' }) }, JSON.stringify(merged), options.signal);
      check();
      if (result.status === 409) throw Error('WebDAV PUT 返回 HTTP 409（资源或目录冲突）；不能据此判断其他设备正在写入。本机记录保留，未导入本轮远端记录。');
      if (result.status === 412) continue;
      if (![200, 201, 204].includes(result.status)) throw Error(`WebDAV 写入失败 HTTP ${result.status}；本机记录已保留`);
      // Include local events arriving during the network round-trip. They remain queued for next sync.
      apply(merged);
      return { count: merged.events.length, settings: merged.settings, attempts: attempt + 1 };
    }
    throw Error('同步失败（HTTP 412）。本机记录已保留。');
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
  // BEGIN GENERATED PASSIVE METADATA RUNTIME
  // Bundles Acorn 8.17.0, MIT; see vendor/acorn/LICENSE. No external runtime downloads.
  const metadataTransformerSource = "/*\n * Acorn 8.17.0; bundled without modification.\n * MIT License\n * \n * Copyright (C) 2012-2022 by various contributors (see AUTHORS)\n * \n * Permission is hereby granted, free of charge, to any person obtaining a copy\n * of this software and associated documentation files (the \"Software\"), to deal\n * in the Software without restriction, including without limitation the rights\n * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n * copies of the Software, and to permit persons to whom the Software is\n * furnished to do so, subject to the following conditions:\n * \n * The above copyright notice and this permission notice shall be included in\n * all copies or substantial portions of the Software.\n * \n * THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\n * THE SOFTWARE.\n * \n */\n(function () {\n  const exports = {};\n  const module = { exports };\n(function (global, factory) {\n  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :\n  typeof define === 'function' && define.amd ? define(['exports'], factory) :\n  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.acorn = {}));\n})(this, (function (exports) { 'use strict';\n\n  // This file was generated. Do not modify manually!\n  var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 78, 5, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2, 0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 199, 7, 137, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 55, 9, 266, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9, 470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 245, 1, 2, 9, 233, 0, 3, 0, 8, 1, 6, 0, 475, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];\n\n  // This file was generated. Do not modify manually!\n  var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 7, 25, 39, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 5, 57, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0, 45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 200, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 24, 43, 261, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 26, 3994, 6, 582, 6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 433, 44, 212, 63, 33, 24, 3, 24, 45, 74, 6, 0, 67, 12, 65, 1, 2, 0, 15, 4, 10, 7381, 42, 31, 98, 114, 8702, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 229, 29, 3, 0, 208, 30, 2, 2, 2, 1, 2, 6, 3, 4, 10, 1, 225, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4381, 3, 5773, 3, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 8489];\n\n  // This file was generated. Do not modify manually!\n  var nonASCIIidentifierChars = \"\\u200c\\u200d\\xb7\\u0300-\\u036f\\u0387\\u0483-\\u0487\\u0591-\\u05bd\\u05bf\\u05c1\\u05c2\\u05c4\\u05c5\\u05c7\\u0610-\\u061a\\u064b-\\u0669\\u0670\\u06d6-\\u06dc\\u06df-\\u06e4\\u06e7\\u06e8\\u06ea-\\u06ed\\u06f0-\\u06f9\\u0711\\u0730-\\u074a\\u07a6-\\u07b0\\u07c0-\\u07c9\\u07eb-\\u07f3\\u07fd\\u0816-\\u0819\\u081b-\\u0823\\u0825-\\u0827\\u0829-\\u082d\\u0859-\\u085b\\u0897-\\u089f\\u08ca-\\u08e1\\u08e3-\\u0903\\u093a-\\u093c\\u093e-\\u094f\\u0951-\\u0957\\u0962\\u0963\\u0966-\\u096f\\u0981-\\u0983\\u09bc\\u09be-\\u09c4\\u09c7\\u09c8\\u09cb-\\u09cd\\u09d7\\u09e2\\u09e3\\u09e6-\\u09ef\\u09fe\\u0a01-\\u0a03\\u0a3c\\u0a3e-\\u0a42\\u0a47\\u0a48\\u0a4b-\\u0a4d\\u0a51\\u0a66-\\u0a71\\u0a75\\u0a81-\\u0a83\\u0abc\\u0abe-\\u0ac5\\u0ac7-\\u0ac9\\u0acb-\\u0acd\\u0ae2\\u0ae3\\u0ae6-\\u0aef\\u0afa-\\u0aff\\u0b01-\\u0b03\\u0b3c\\u0b3e-\\u0b44\\u0b47\\u0b48\\u0b4b-\\u0b4d\\u0b55-\\u0b57\\u0b62\\u0b63\\u0b66-\\u0b6f\\u0b82\\u0bbe-\\u0bc2\\u0bc6-\\u0bc8\\u0bca-\\u0bcd\\u0bd7\\u0be6-\\u0bef\\u0c00-\\u0c04\\u0c3c\\u0c3e-\\u0c44\\u0c46-\\u0c48\\u0c4a-\\u0c4d\\u0c55\\u0c56\\u0c62\\u0c63\\u0c66-\\u0c6f\\u0c81-\\u0c83\\u0cbc\\u0cbe-\\u0cc4\\u0cc6-\\u0cc8\\u0cca-\\u0ccd\\u0cd5\\u0cd6\\u0ce2\\u0ce3\\u0ce6-\\u0cef\\u0cf3\\u0d00-\\u0d03\\u0d3b\\u0d3c\\u0d3e-\\u0d44\\u0d46-\\u0d48\\u0d4a-\\u0d4d\\u0d57\\u0d62\\u0d63\\u0d66-\\u0d6f\\u0d81-\\u0d83\\u0dca\\u0dcf-\\u0dd4\\u0dd6\\u0dd8-\\u0ddf\\u0de6-\\u0def\\u0df2\\u0df3\\u0e31\\u0e34-\\u0e3a\\u0e47-\\u0e4e\\u0e50-\\u0e59\\u0eb1\\u0eb4-\\u0ebc\\u0ec8-\\u0ece\\u0ed0-\\u0ed9\\u0f18\\u0f19\\u0f20-\\u0f29\\u0f35\\u0f37\\u0f39\\u0f3e\\u0f3f\\u0f71-\\u0f84\\u0f86\\u0f87\\u0f8d-\\u0f97\\u0f99-\\u0fbc\\u0fc6\\u102b-\\u103e\\u1040-\\u1049\\u1056-\\u1059\\u105e-\\u1060\\u1062-\\u1064\\u1067-\\u106d\\u1071-\\u1074\\u1082-\\u108d\\u108f-\\u109d\\u135d-\\u135f\\u1369-\\u1371\\u1712-\\u1715\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17b4-\\u17d3\\u17dd\\u17e0-\\u17e9\\u180b-\\u180d\\u180f-\\u1819\\u18a9\\u1920-\\u192b\\u1930-\\u193b\\u1946-\\u194f\\u19d0-\\u19da\\u1a17-\\u1a1b\\u1a55-\\u1a5e\\u1a60-\\u1a7c\\u1a7f-\\u1a89\\u1a90-\\u1a99\\u1ab0-\\u1abd\\u1abf-\\u1add\\u1ae0-\\u1aeb\\u1b00-\\u1b04\\u1b34-\\u1b44\\u1b50-\\u1b59\\u1b6b-\\u1b73\\u1b80-\\u1b82\\u1ba1-\\u1bad\\u1bb0-\\u1bb9\\u1be6-\\u1bf3\\u1c24-\\u1c37\\u1c40-\\u1c49\\u1c50-\\u1c59\\u1cd0-\\u1cd2\\u1cd4-\\u1ce8\\u1ced\\u1cf4\\u1cf7-\\u1cf9\\u1dc0-\\u1dff\\u200c\\u200d\\u203f\\u2040\\u2054\\u20d0-\\u20dc\\u20e1\\u20e5-\\u20f0\\u2cef-\\u2cf1\\u2d7f\\u2de0-\\u2dff\\u302a-\\u302f\\u3099\\u309a\\u30fb\\ua620-\\ua629\\ua66f\\ua674-\\ua67d\\ua69e\\ua69f\\ua6f0\\ua6f1\\ua802\\ua806\\ua80b\\ua823-\\ua827\\ua82c\\ua880\\ua881\\ua8b4-\\ua8c5\\ua8d0-\\ua8d9\\ua8e0-\\ua8f1\\ua8ff-\\ua909\\ua926-\\ua92d\\ua947-\\ua953\\ua980-\\ua983\\ua9b3-\\ua9c0\\ua9d0-\\ua9d9\\ua9e5\\ua9f0-\\ua9f9\\uaa29-\\uaa36\\uaa43\\uaa4c\\uaa4d\\uaa50-\\uaa59\\uaa7b-\\uaa7d\\uaab0\\uaab2-\\uaab4\\uaab7\\uaab8\\uaabe\\uaabf\\uaac1\\uaaeb-\\uaaef\\uaaf5\\uaaf6\\uabe3-\\uabea\\uabec\\uabed\\uabf0-\\uabf9\\ufb1e\\ufe00-\\ufe0f\\ufe20-\\ufe2f\\ufe33\\ufe34\\ufe4d-\\ufe4f\\uff10-\\uff19\\uff3f\\uff65\";\n\n  // This file was generated. Do not modify manually!\n  var nonASCIIidentifierStartChars = \"\\xaa\\xb5\\xba\\xc0-\\xd6\\xd8-\\xf6\\xf8-\\u02c1\\u02c6-\\u02d1\\u02e0-\\u02e4\\u02ec\\u02ee\\u0370-\\u0374\\u0376\\u0377\\u037a-\\u037d\\u037f\\u0386\\u0388-\\u038a\\u038c\\u038e-\\u03a1\\u03a3-\\u03f5\\u03f7-\\u0481\\u048a-\\u052f\\u0531-\\u0556\\u0559\\u0560-\\u0588\\u05d0-\\u05ea\\u05ef-\\u05f2\\u0620-\\u064a\\u066e\\u066f\\u0671-\\u06d3\\u06d5\\u06e5\\u06e6\\u06ee\\u06ef\\u06fa-\\u06fc\\u06ff\\u0710\\u0712-\\u072f\\u074d-\\u07a5\\u07b1\\u07ca-\\u07ea\\u07f4\\u07f5\\u07fa\\u0800-\\u0815\\u081a\\u0824\\u0828\\u0840-\\u0858\\u0860-\\u086a\\u0870-\\u0887\\u0889-\\u088f\\u08a0-\\u08c9\\u0904-\\u0939\\u093d\\u0950\\u0958-\\u0961\\u0971-\\u0980\\u0985-\\u098c\\u098f\\u0990\\u0993-\\u09a8\\u09aa-\\u09b0\\u09b2\\u09b6-\\u09b9\\u09bd\\u09ce\\u09dc\\u09dd\\u09df-\\u09e1\\u09f0\\u09f1\\u09fc\\u0a05-\\u0a0a\\u0a0f\\u0a10\\u0a13-\\u0a28\\u0a2a-\\u0a30\\u0a32\\u0a33\\u0a35\\u0a36\\u0a38\\u0a39\\u0a59-\\u0a5c\\u0a5e\\u0a72-\\u0a74\\u0a85-\\u0a8d\\u0a8f-\\u0a91\\u0a93-\\u0aa8\\u0aaa-\\u0ab0\\u0ab2\\u0ab3\\u0ab5-\\u0ab9\\u0abd\\u0ad0\\u0ae0\\u0ae1\\u0af9\\u0b05-\\u0b0c\\u0b0f\\u0b10\\u0b13-\\u0b28\\u0b2a-\\u0b30\\u0b32\\u0b33\\u0b35-\\u0b39\\u0b3d\\u0b5c\\u0b5d\\u0b5f-\\u0b61\\u0b71\\u0b83\\u0b85-\\u0b8a\\u0b8e-\\u0b90\\u0b92-\\u0b95\\u0b99\\u0b9a\\u0b9c\\u0b9e\\u0b9f\\u0ba3\\u0ba4\\u0ba8-\\u0baa\\u0bae-\\u0bb9\\u0bd0\\u0c05-\\u0c0c\\u0c0e-\\u0c10\\u0c12-\\u0c28\\u0c2a-\\u0c39\\u0c3d\\u0c58-\\u0c5a\\u0c5c\\u0c5d\\u0c60\\u0c61\\u0c80\\u0c85-\\u0c8c\\u0c8e-\\u0c90\\u0c92-\\u0ca8\\u0caa-\\u0cb3\\u0cb5-\\u0cb9\\u0cbd\\u0cdc-\\u0cde\\u0ce0\\u0ce1\\u0cf1\\u0cf2\\u0d04-\\u0d0c\\u0d0e-\\u0d10\\u0d12-\\u0d3a\\u0d3d\\u0d4e\\u0d54-\\u0d56\\u0d5f-\\u0d61\\u0d7a-\\u0d7f\\u0d85-\\u0d96\\u0d9a-\\u0db1\\u0db3-\\u0dbb\\u0dbd\\u0dc0-\\u0dc6\\u0e01-\\u0e30\\u0e32\\u0e33\\u0e40-\\u0e46\\u0e81\\u0e82\\u0e84\\u0e86-\\u0e8a\\u0e8c-\\u0ea3\\u0ea5\\u0ea7-\\u0eb0\\u0eb2\\u0eb3\\u0ebd\\u0ec0-\\u0ec4\\u0ec6\\u0edc-\\u0edf\\u0f00\\u0f40-\\u0f47\\u0f49-\\u0f6c\\u0f88-\\u0f8c\\u1000-\\u102a\\u103f\\u1050-\\u1055\\u105a-\\u105d\\u1061\\u1065\\u1066\\u106e-\\u1070\\u1075-\\u1081\\u108e\\u10a0-\\u10c5\\u10c7\\u10cd\\u10d0-\\u10fa\\u10fc-\\u1248\\u124a-\\u124d\\u1250-\\u1256\\u1258\\u125a-\\u125d\\u1260-\\u1288\\u128a-\\u128d\\u1290-\\u12b0\\u12b2-\\u12b5\\u12b8-\\u12be\\u12c0\\u12c2-\\u12c5\\u12c8-\\u12d6\\u12d8-\\u1310\\u1312-\\u1315\\u1318-\\u135a\\u1380-\\u138f\\u13a0-\\u13f5\\u13f8-\\u13fd\\u1401-\\u166c\\u166f-\\u167f\\u1681-\\u169a\\u16a0-\\u16ea\\u16ee-\\u16f8\\u1700-\\u1711\\u171f-\\u1731\\u1740-\\u1751\\u1760-\\u176c\\u176e-\\u1770\\u1780-\\u17b3\\u17d7\\u17dc\\u1820-\\u1878\\u1880-\\u18a8\\u18aa\\u18b0-\\u18f5\\u1900-\\u191e\\u1950-\\u196d\\u1970-\\u1974\\u1980-\\u19ab\\u19b0-\\u19c9\\u1a00-\\u1a16\\u1a20-\\u1a54\\u1aa7\\u1b05-\\u1b33\\u1b45-\\u1b4c\\u1b83-\\u1ba0\\u1bae\\u1baf\\u1bba-\\u1be5\\u1c00-\\u1c23\\u1c4d-\\u1c4f\\u1c5a-\\u1c7d\\u1c80-\\u1c8a\\u1c90-\\u1cba\\u1cbd-\\u1cbf\\u1ce9-\\u1cec\\u1cee-\\u1cf3\\u1cf5\\u1cf6\\u1cfa\\u1d00-\\u1dbf\\u1e00-\\u1f15\\u1f18-\\u1f1d\\u1f20-\\u1f45\\u1f48-\\u1f4d\\u1f50-\\u1f57\\u1f59\\u1f5b\\u1f5d\\u1f5f-\\u1f7d\\u1f80-\\u1fb4\\u1fb6-\\u1fbc\\u1fbe\\u1fc2-\\u1fc4\\u1fc6-\\u1fcc\\u1fd0-\\u1fd3\\u1fd6-\\u1fdb\\u1fe0-\\u1fec\\u1ff2-\\u1ff4\\u1ff6-\\u1ffc\\u2071\\u207f\\u2090-\\u209c\\u2102\\u2107\\u210a-\\u2113\\u2115\\u2118-\\u211d\\u2124\\u2126\\u2128\\u212a-\\u2139\\u213c-\\u213f\\u2145-\\u2149\\u214e\\u2160-\\u2188\\u2c00-\\u2ce4\\u2ceb-\\u2cee\\u2cf2\\u2cf3\\u2d00-\\u2d25\\u2d27\\u2d2d\\u2d30-\\u2d67\\u2d6f\\u2d80-\\u2d96\\u2da0-\\u2da6\\u2da8-\\u2dae\\u2db0-\\u2db6\\u2db8-\\u2dbe\\u2dc0-\\u2dc6\\u2dc8-\\u2dce\\u2dd0-\\u2dd6\\u2dd8-\\u2dde\\u3005-\\u3007\\u3021-\\u3029\\u3031-\\u3035\\u3038-\\u303c\\u3041-\\u3096\\u309b-\\u309f\\u30a1-\\u30fa\\u30fc-\\u30ff\\u3105-\\u312f\\u3131-\\u318e\\u31a0-\\u31bf\\u31f0-\\u31ff\\u3400-\\u4dbf\\u4e00-\\ua48c\\ua4d0-\\ua4fd\\ua500-\\ua60c\\ua610-\\ua61f\\ua62a\\ua62b\\ua640-\\ua66e\\ua67f-\\ua69d\\ua6a0-\\ua6ef\\ua717-\\ua71f\\ua722-\\ua788\\ua78b-\\ua7dc\\ua7f1-\\ua801\\ua803-\\ua805\\ua807-\\ua80a\\ua80c-\\ua822\\ua840-\\ua873\\ua882-\\ua8b3\\ua8f2-\\ua8f7\\ua8fb\\ua8fd\\ua8fe\\ua90a-\\ua925\\ua930-\\ua946\\ua960-\\ua97c\\ua984-\\ua9b2\\ua9cf\\ua9e0-\\ua9e4\\ua9e6-\\ua9ef\\ua9fa-\\ua9fe\\uaa00-\\uaa28\\uaa40-\\uaa42\\uaa44-\\uaa4b\\uaa60-\\uaa76\\uaa7a\\uaa7e-\\uaaaf\\uaab1\\uaab5\\uaab6\\uaab9-\\uaabd\\uaac0\\uaac2\\uaadb-\\uaadd\\uaae0-\\uaaea\\uaaf2-\\uaaf4\\uab01-\\uab06\\uab09-\\uab0e\\uab11-\\uab16\\uab20-\\uab26\\uab28-\\uab2e\\uab30-\\uab5a\\uab5c-\\uab69\\uab70-\\uabe2\\uac00-\\ud7a3\\ud7b0-\\ud7c6\\ud7cb-\\ud7fb\\uf900-\\ufa6d\\ufa70-\\ufad9\\ufb00-\\ufb06\\ufb13-\\ufb17\\ufb1d\\ufb1f-\\ufb28\\ufb2a-\\ufb36\\ufb38-\\ufb3c\\ufb3e\\ufb40\\ufb41\\ufb43\\ufb44\\ufb46-\\ufbb1\\ufbd3-\\ufd3d\\ufd50-\\ufd8f\\ufd92-\\ufdc7\\ufdf0-\\ufdfb\\ufe70-\\ufe74\\ufe76-\\ufefc\\uff21-\\uff3a\\uff41-\\uff5a\\uff66-\\uffbe\\uffc2-\\uffc7\\uffca-\\uffcf\\uffd2-\\uffd7\\uffda-\\uffdc\";\n\n  // These are a run-length and offset encoded representation of the\n  // >0xffff code points that are a valid part of identifiers. The\n  // offset starts at 0x10000, and each pair of numbers represents an\n  // offset to the next range, and then a size of the range.\n\n  // Reserved word lists for various dialects of the language\n\n  var reservedWords = {\n    3: \"abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile\",\n    5: \"class enum extends super const export import\",\n    6: \"enum\",\n    strict: \"implements interface let package private protected public static yield\",\n    strictBind: \"eval arguments\"\n  };\n\n  // And the keywords\n\n  var ecma5AndLessKeywords = \"break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this\";\n\n  var keywords$1 = {\n    5: ecma5AndLessKeywords,\n    \"5module\": ecma5AndLessKeywords + \" export import\",\n    6: ecma5AndLessKeywords + \" const class extends export import super\"\n  };\n\n  var keywordRelationalOperator = /^in(stanceof)?$/;\n\n  // ## Character categories\n\n  var nonASCIIidentifierStart = new RegExp(\"[\" + nonASCIIidentifierStartChars + \"]\");\n  var nonASCIIidentifier = new RegExp(\"[\" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + \"]\");\n\n  // This has a complexity linear to the value of the code. The\n  // assumption is that looking up astral identifier characters is\n  // rare.\n  function isInAstralSet(code, set) {\n    var pos = 0x10000;\n    for (var i = 0; i < set.length; i += 2) {\n      pos += set[i];\n      if (pos > code) { return false }\n      pos += set[i + 1];\n      if (pos >= code) { return true }\n    }\n    return false\n  }\n\n  // Test whether a given character code starts an identifier.\n\n  function isIdentifierStart(code, astral) {\n    if (code < 65) { return code === 36 }\n    if (code < 91) { return true }\n    if (code < 97) { return code === 95 }\n    if (code < 123) { return true }\n    if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code)) }\n    if (astral === false) { return false }\n    return isInAstralSet(code, astralIdentifierStartCodes)\n  }\n\n  // Test whether a given character is part of an identifier.\n\n  function isIdentifierChar(code, astral) {\n    if (code < 48) { return code === 36 }\n    if (code < 58) { return true }\n    if (code < 65) { return false }\n    if (code < 91) { return true }\n    if (code < 97) { return code === 95 }\n    if (code < 123) { return true }\n    if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code)) }\n    if (astral === false) { return false }\n    return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes)\n  }\n\n  // ## Token types\n\n  // The assignment of fine-grained, information-carrying type objects\n  // allows the tokenizer to store the information it has about a\n  // token in a way that is very cheap for the parser to look up.\n\n  // All token type variables start with an underscore, to make them\n  // easy to recognize.\n\n  // The `beforeExpr` property is used to disambiguate between regular\n  // expressions and divisions. It is set on all token types that can\n  // be followed by an expression (thus, a slash after them would be a\n  // regular expression).\n  //\n  // The `startsExpr` property is used to check if the token ends a\n  // `yield` expression. It is set on all token types that either can\n  // directly start an expression (like a quotation mark) or can\n  // continue an expression (like the body of a string).\n  //\n  // `isLoop` marks a keyword as starting a loop, which is important\n  // to know when parsing a label, in order to allow or disallow\n  // continue jumps to that label.\n\n  var TokenType = function TokenType(label, conf) {\n    if ( conf === void 0 ) conf = {};\n\n    this.label = label;\n    this.keyword = conf.keyword;\n    this.beforeExpr = !!conf.beforeExpr;\n    this.startsExpr = !!conf.startsExpr;\n    this.isLoop = !!conf.isLoop;\n    this.isAssign = !!conf.isAssign;\n    this.prefix = !!conf.prefix;\n    this.postfix = !!conf.postfix;\n    this.binop = conf.binop || null;\n    this.updateContext = null;\n  };\n\n  function binop(name, prec) {\n    return new TokenType(name, {beforeExpr: true, binop: prec})\n  }\n  var beforeExpr = {beforeExpr: true}, startsExpr = {startsExpr: true};\n\n  // Map keyword names to token types.\n\n  var keywords = {};\n\n  // Succinct definitions of keyword token types\n  function kw(name, options) {\n    if ( options === void 0 ) options = {};\n\n    options.keyword = name;\n    return keywords[name] = new TokenType(name, options)\n  }\n\n  var types$1 = {\n    num: new TokenType(\"num\", startsExpr),\n    regexp: new TokenType(\"regexp\", startsExpr),\n    string: new TokenType(\"string\", startsExpr),\n    name: new TokenType(\"name\", startsExpr),\n    privateId: new TokenType(\"privateId\", startsExpr),\n    eof: new TokenType(\"eof\"),\n\n    // Punctuation token types.\n    bracketL: new TokenType(\"[\", {beforeExpr: true, startsExpr: true}),\n    bracketR: new TokenType(\"]\"),\n    braceL: new TokenType(\"{\", {beforeExpr: true, startsExpr: true}),\n    braceR: new TokenType(\"}\"),\n    parenL: new TokenType(\"(\", {beforeExpr: true, startsExpr: true}),\n    parenR: new TokenType(\")\"),\n    comma: new TokenType(\",\", beforeExpr),\n    semi: new TokenType(\";\", beforeExpr),\n    colon: new TokenType(\":\", beforeExpr),\n    dot: new TokenType(\".\"),\n    question: new TokenType(\"?\", beforeExpr),\n    questionDot: new TokenType(\"?.\"),\n    arrow: new TokenType(\"=>\", beforeExpr),\n    template: new TokenType(\"template\"),\n    invalidTemplate: new TokenType(\"invalidTemplate\"),\n    ellipsis: new TokenType(\"...\", beforeExpr),\n    backQuote: new TokenType(\"`\", startsExpr),\n    dollarBraceL: new TokenType(\"${\", {beforeExpr: true, startsExpr: true}),\n\n    // Operators. These carry several kinds of properties to help the\n    // parser use them properly (the presence of these properties is\n    // what categorizes them as operators).\n    //\n    // `binop`, when present, specifies that this operator is a binary\n    // operator, and will refer to its precedence.\n    //\n    // `prefix` and `postfix` mark the operator as a prefix or postfix\n    // unary operator.\n    //\n    // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as\n    // binary operators with a very low precedence, that should result\n    // in AssignmentExpression nodes.\n\n    eq: new TokenType(\"=\", {beforeExpr: true, isAssign: true}),\n    assign: new TokenType(\"_=\", {beforeExpr: true, isAssign: true}),\n    incDec: new TokenType(\"++/--\", {prefix: true, postfix: true, startsExpr: true}),\n    prefix: new TokenType(\"!/~\", {beforeExpr: true, prefix: true, startsExpr: true}),\n    logicalOR: binop(\"||\", 1),\n    logicalAND: binop(\"&&\", 2),\n    bitwiseOR: binop(\"|\", 3),\n    bitwiseXOR: binop(\"^\", 4),\n    bitwiseAND: binop(\"&\", 5),\n    equality: binop(\"==/!=/===/!==\", 6),\n    relational: binop(\"</>/<=/>=\", 7),\n    bitShift: binop(\"<</>>/>>>\", 8),\n    plusMin: new TokenType(\"+/-\", {beforeExpr: true, binop: 9, prefix: true, startsExpr: true}),\n    modulo: binop(\"%\", 10),\n    star: binop(\"*\", 10),\n    slash: binop(\"/\", 10),\n    starstar: new TokenType(\"**\", {beforeExpr: true}),\n    coalesce: binop(\"??\", 1),\n\n    // Keyword token types.\n    _break: kw(\"break\"),\n    _case: kw(\"case\", beforeExpr),\n    _catch: kw(\"catch\"),\n    _continue: kw(\"continue\"),\n    _debugger: kw(\"debugger\"),\n    _default: kw(\"default\", beforeExpr),\n    _do: kw(\"do\", {isLoop: true, beforeExpr: true}),\n    _else: kw(\"else\", beforeExpr),\n    _finally: kw(\"finally\"),\n    _for: kw(\"for\", {isLoop: true}),\n    _function: kw(\"function\", startsExpr),\n    _if: kw(\"if\"),\n    _return: kw(\"return\", beforeExpr),\n    _switch: kw(\"switch\"),\n    _throw: kw(\"throw\", beforeExpr),\n    _try: kw(\"try\"),\n    _var: kw(\"var\"),\n    _const: kw(\"const\"),\n    _while: kw(\"while\", {isLoop: true}),\n    _with: kw(\"with\"),\n    _new: kw(\"new\", {beforeExpr: true, startsExpr: true}),\n    _this: kw(\"this\", startsExpr),\n    _super: kw(\"super\", startsExpr),\n    _class: kw(\"class\", startsExpr),\n    _extends: kw(\"extends\", beforeExpr),\n    _export: kw(\"export\"),\n    _import: kw(\"import\", startsExpr),\n    _null: kw(\"null\", startsExpr),\n    _true: kw(\"true\", startsExpr),\n    _false: kw(\"false\", startsExpr),\n    _in: kw(\"in\", {beforeExpr: true, binop: 7}),\n    _instanceof: kw(\"instanceof\", {beforeExpr: true, binop: 7}),\n    _typeof: kw(\"typeof\", {beforeExpr: true, prefix: true, startsExpr: true}),\n    _void: kw(\"void\", {beforeExpr: true, prefix: true, startsExpr: true}),\n    _delete: kw(\"delete\", {beforeExpr: true, prefix: true, startsExpr: true})\n  };\n\n  // Matches a whole line break (where CRLF is considered a single\n  // line break). Used to count lines.\n\n  var lineBreak = /\\r\\n?|\\n|\\u2028|\\u2029/;\n  var lineBreakG = new RegExp(lineBreak.source, \"g\");\n\n  function isNewLine(code) {\n    return code === 10 || code === 13 || code === 0x2028 || code === 0x2029\n  }\n\n  function nextLineBreak(code, from, end) {\n    if ( end === void 0 ) end = code.length;\n\n    for (var i = from; i < end; i++) {\n      var next = code.charCodeAt(i);\n      if (isNewLine(next))\n        { return i < end - 1 && next === 13 && code.charCodeAt(i + 1) === 10 ? i + 2 : i + 1 }\n    }\n    return -1\n  }\n\n  var nonASCIIwhitespace = /[\\u1680\\u2000-\\u200a\\u202f\\u205f\\u3000\\ufeff]/;\n\n  var skipWhiteSpace = /(?:\\s|\\/\\/.*|\\/\\*[^]*?\\*\\/)*/g;\n\n  var ref = Object.prototype;\n  var hasOwnProperty = ref.hasOwnProperty;\n  var toString = ref.toString;\n\n  var hasOwn = Object.hasOwn || (function (obj, propName) { return (\n    hasOwnProperty.call(obj, propName)\n  ); });\n\n  var isArray = Array.isArray || (function (obj) { return (\n    toString.call(obj) === \"[object Array]\"\n  ); });\n\n  var regexpCache = Object.create(null);\n\n  function wordsRegexp(words) {\n    return regexpCache[words] || (regexpCache[words] = new RegExp(\"^(?:\" + words.replace(/ /g, \"|\") + \")$\"))\n  }\n\n  function codePointToString(code) {\n    // UTF-16 Decoding\n    if (code <= 0xFFFF) { return String.fromCharCode(code) }\n    code -= 0x10000;\n    return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00)\n  }\n\n  var loneSurrogate = /(?:[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?:[^\\uD800-\\uDBFF]|^)[\\uDC00-\\uDFFF])/;\n\n  // These are used when `options.locations` is on, for the\n  // `startLoc` and `endLoc` properties.\n\n  var Position = function Position(line, col) {\n    this.line = line;\n    this.column = col;\n  };\n\n  Position.prototype.offset = function offset (n) {\n    return new Position(this.line, this.column + n)\n  };\n\n  var SourceLocation = function SourceLocation(p, start, end) {\n    this.start = start;\n    this.end = end;\n    if (p.sourceFile !== null) { this.source = p.sourceFile; }\n  };\n\n  // The `getLineInfo` function is mostly useful when the\n  // `locations` option is off (for performance reasons) and you\n  // want to find the line/column position for a given character\n  // offset. `input` should be the code string that the offset refers\n  // into.\n\n  function getLineInfo(input, offset) {\n    for (var line = 1, cur = 0;;) {\n      var nextBreak = nextLineBreak(input, cur, offset);\n      if (nextBreak < 0) { return new Position(line, offset - cur) }\n      ++line;\n      cur = nextBreak;\n    }\n  }\n\n  // A second argument must be given to configure the parser process.\n  // These options are recognized (only `ecmaVersion` is required):\n\n  var defaultOptions = {\n    // `ecmaVersion` indicates the ECMAScript version to parse. Must be\n    // either 3, 5, 6 (or 2015), 7 (2016), 8 (2017), 9 (2018), 10\n    // (2019), 11 (2020), 12 (2021), 13 (2022), 14 (2023), or `\"latest\"`\n    // (the latest version the library supports). This influences\n    // support for strict mode, the set of reserved words, and support\n    // for new syntax features.\n    ecmaVersion: null,\n    // `sourceType` indicates the mode the code should be parsed in.\n    // Can be either `\"script\"`, `\"module\"` or `\"commonjs\"`. This influences global\n    // strict mode and parsing of `import` and `export` declarations.\n    sourceType: \"script\",\n    // When set to true, enable strict parsing mode even if `sourceType`\n    // is `\"script\"`.\n    strict: false,\n    // `onInsertedSemicolon` can be a callback that will be called when\n    // a semicolon is automatically inserted. It will be passed the\n    // position of the inserted semicolon as an offset, and if\n    // `locations` is enabled, it is given the location as a `{line,\n    // column}` object as second argument.\n    onInsertedSemicolon: null,\n    // `onTrailingComma` is similar to `onInsertedSemicolon`, but for\n    // trailing commas.\n    onTrailingComma: null,\n    // By default, reserved words are only enforced if ecmaVersion >= 5.\n    // Set `allowReserved` to a boolean value to explicitly turn this on\n    // an off. When this option has the value \"never\", reserved words\n    // and keywords can also not be used as property names.\n    allowReserved: null,\n    // When enabled, a return at the top level is not considered an\n    // error.\n    allowReturnOutsideFunction: false,\n    // When enabled, import/export statements are not constrained to\n    // appearing at the top of the program, and an import.meta expression\n    // in a script isn't considered an error.\n    allowImportExportEverywhere: false,\n    // By default, await identifiers are allowed to appear at the top-level scope only if ecmaVersion >= 2022.\n    // When enabled, await identifiers are allowed to appear at the top-level scope,\n    // but they are still not allowed in non-async functions.\n    allowAwaitOutsideFunction: null,\n    // When enabled, super identifiers are not constrained to\n    // appearing in methods and do not raise an error when they appear elsewhere.\n    allowSuperOutsideMethod: null,\n    // When enabled, hashbang directive in the beginning of file is\n    // allowed and treated as a line comment. Enabled by default when\n    // `ecmaVersion` >= 2023.\n    allowHashBang: false,\n    // By default, the parser will verify that private properties are\n    // only used in places where they are valid and have been declared.\n    // Set this to false to turn such checks off.\n    checkPrivateFields: true,\n    // When `locations` is on, `loc` properties holding objects with\n    // `start` and `end` properties in `{line, column}` form (with\n    // line being 1-based and column 0-based) will be attached to the\n    // nodes.\n    locations: false,\n    // A function can be passed as `onToken` option, which will\n    // cause Acorn to call that function with object in the same\n    // format as tokens returned from `tokenizer().getToken()`. Note\n    // that you are not allowed to call the parser from the\n    // callback—that will corrupt its internal state.\n    onToken: null,\n    // A function can be passed as `onComment` option, which will\n    // cause Acorn to call that function with `(block, text, start,\n    // end)` parameters whenever a comment is skipped. `block` is a\n    // boolean indicating whether this is a block (`/* */`) comment,\n    // `text` is the content of the comment, and `start` and `end` are\n    // character offsets that denote the start and end of the comment.\n    // When the `locations` option is on, two more parameters are\n    // passed, the full `{line, column}` locations of the start and\n    // end of the comments. Note that you are not allowed to call the\n    // parser from the callback—that will corrupt its internal state.\n    // When this option has an array as value, objects representing the\n    // comments are pushed to it.\n    onComment: null,\n    // Nodes have their start and end characters offsets recorded in\n    // `start` and `end` properties (directly on the node, rather than\n    // the `loc` object, which holds line/column data. To also add a\n    // [semi-standardized][range] `range` property holding a `[start,\n    // end]` array with the same numbers, set the `ranges` option to\n    // `true`.\n    //\n    // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678\n    ranges: false,\n    // It is possible to parse multiple files into a single AST by\n    // passing the tree produced by parsing the first file as\n    // `program` option in subsequent parses. This will add the\n    // toplevel forms of the parsed file to the `Program` (top) node\n    // of an existing parse tree.\n    program: null,\n    // When `locations` is on, you can pass this to record the source\n    // file in every node's `loc` object.\n    sourceFile: null,\n    // This value, if given, is stored in every node, whether\n    // `locations` is on or off.\n    directSourceFile: null,\n    // When enabled, parenthesized expressions are represented by\n    // (non-standard) ParenthesizedExpression nodes\n    preserveParens: false\n  };\n\n  // Interpret and default an options object\n\n  var warnedAboutEcmaVersion = false;\n\n  function getOptions(opts) {\n    var options = {};\n\n    for (var opt in defaultOptions)\n      { options[opt] = opts && hasOwn(opts, opt) ? opts[opt] : defaultOptions[opt]; }\n\n    if (options.ecmaVersion === \"latest\") {\n      options.ecmaVersion = 1e8;\n    } else if (options.ecmaVersion == null) {\n      if (!warnedAboutEcmaVersion && typeof console === \"object\" && console.warn) {\n        warnedAboutEcmaVersion = true;\n        console.warn(\"Since Acorn 8.0.0, options.ecmaVersion is required.\\nDefaulting to 2020, but this will stop working in the future.\");\n      }\n      options.ecmaVersion = 11;\n    } else if (options.ecmaVersion >= 2015) {\n      options.ecmaVersion -= 2009;\n    }\n\n    if (options.allowReserved == null)\n      { options.allowReserved = options.ecmaVersion < 5; }\n\n    if (!opts || opts.allowHashBang == null)\n      { options.allowHashBang = options.ecmaVersion >= 14; }\n\n    if (isArray(options.onToken)) {\n      var tokens = options.onToken;\n      options.onToken = function (token) { return tokens.push(token); };\n    }\n    if (isArray(options.onComment))\n      { options.onComment = pushComment(options, options.onComment); }\n\n    if (options.sourceType === \"commonjs\" && options.allowAwaitOutsideFunction)\n      { throw new Error(\"Cannot use allowAwaitOutsideFunction with sourceType: commonjs\") }\n\n    return options\n  }\n\n  function pushComment(options, array) {\n    return function(block, text, start, end, startLoc, endLoc) {\n      var comment = {\n        type: block ? \"Block\" : \"Line\",\n        value: text,\n        start: start,\n        end: end\n      };\n      if (options.locations)\n        { comment.loc = new SourceLocation(this, startLoc, endLoc); }\n      if (options.ranges)\n        { comment.range = [start, end]; }\n      array.push(comment);\n    }\n  }\n\n  // Each scope gets a bitset that may contain these flags\n  var\n      SCOPE_TOP = 1,\n      SCOPE_FUNCTION = 2,\n      SCOPE_ASYNC = 4,\n      SCOPE_GENERATOR = 8,\n      SCOPE_ARROW = 16,\n      SCOPE_SIMPLE_CATCH = 32,\n      SCOPE_SUPER = 64,\n      SCOPE_DIRECT_SUPER = 128,\n      SCOPE_CLASS_STATIC_BLOCK = 256,\n      SCOPE_CLASS_FIELD_INIT = 512,\n      SCOPE_SWITCH = 1024,\n      SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK;\n\n  function functionFlags(async, generator) {\n    return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0)\n  }\n\n  // Used in checkLVal* and declareName to determine the type of a binding\n  var\n      BIND_NONE = 0, // Not a binding\n      BIND_VAR = 1, // Var-style binding\n      BIND_LEXICAL = 2, // Let- or const-style binding\n      BIND_FUNCTION = 3, // Function declaration\n      BIND_SIMPLE_CATCH = 4, // Simple (identifier pattern) catch binding\n      BIND_OUTSIDE = 5; // Special case for function names as bound inside the function\n\n  var Parser = function Parser(options, input, startPos) {\n    this.options = options = getOptions(options);\n    this.sourceFile = options.sourceFile;\n    this.keywords = wordsRegexp(keywords$1[options.ecmaVersion >= 6 ? 6 : options.sourceType === \"module\" ? \"5module\" : 5]);\n    var reserved = \"\";\n    if (options.allowReserved !== true) {\n      reserved = reservedWords[options.ecmaVersion >= 6 ? 6 : options.ecmaVersion === 5 ? 5 : 3];\n      if (options.sourceType === \"module\") { reserved += \" await\"; }\n    }\n    this.reservedWords = wordsRegexp(reserved);\n    var reservedStrict = (reserved ? reserved + \" \" : \"\") + reservedWords.strict;\n    this.reservedWordsStrict = wordsRegexp(reservedStrict);\n    this.reservedWordsStrictBind = wordsRegexp(reservedStrict + \" \" + reservedWords.strictBind);\n    this.input = String(input);\n\n    // Used to signal to callers of `readWord1` whether the word\n    // contained any escape sequences. This is needed because words with\n    // escape sequences must not be interpreted as keywords.\n    this.containsEsc = false;\n\n    // Set up token state\n\n    // The current position of the tokenizer in the input.\n    if (startPos) {\n      this.pos = startPos;\n      this.lineStart = this.input.lastIndexOf(\"\\n\", startPos - 1) + 1;\n      this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;\n    } else {\n      this.pos = this.lineStart = 0;\n      this.curLine = 1;\n    }\n\n    // Properties of the current token:\n    // Its type\n    this.type = types$1.eof;\n    // For tokens that include more information than their type, the value\n    this.value = null;\n    // Its start and end offset\n    this.start = this.end = this.pos;\n    // And, if locations are used, the {line, column} object\n    // corresponding to those offsets\n    this.startLoc = this.endLoc = this.curPosition();\n\n    // Position information for the previous token\n    this.lastTokEndLoc = this.lastTokStartLoc = null;\n    this.lastTokStart = this.lastTokEnd = this.pos;\n\n    // The context stack is used to superficially track syntactic\n    // context to predict whether a regular expression is allowed in a\n    // given position.\n    this.context = this.initialContext();\n    this.exprAllowed = true;\n\n    // Figure out if it's a module code.\n    this.inModule = options.sourceType === \"module\";\n    this.strict = this.inModule || options.strict === true || this.strictDirective(this.pos);\n\n    // Used to signify the start of a potential arrow function\n    this.potentialArrowAt = -1;\n    this.potentialArrowInForAwait = false;\n\n    // Positions to delayed-check that yield/await does not exist in default parameters.\n    this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;\n    // Labels in scope.\n    this.labels = [];\n    // Thus-far undefined exports.\n    this.undefinedExports = Object.create(null);\n\n    // If enabled, skip leading hashbang line.\n    if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === \"#!\")\n      { this.skipLineComment(2); }\n\n    // Scope tracking for duplicate variable names (see scope.js)\n    this.scopeStack = [];\n    this.enterScope(\n      this.options.sourceType === \"commonjs\"\n        // In commonjs, the top-level scope behaves like a function scope\n        ? SCOPE_FUNCTION\n        : SCOPE_TOP\n    );\n\n    // For RegExp validation\n    this.regexpState = null;\n\n    // The stack of private names.\n    // Each element has two properties: 'declared' and 'used'.\n    // When it exited from the outermost class definition, all used private names must be declared.\n    this.privateNameStack = [];\n  };\n\n  var prototypeAccessors = { inFunction: { configurable: true },inGenerator: { configurable: true },inAsync: { configurable: true },canAwait: { configurable: true },allowReturn: { configurable: true },allowSuper: { configurable: true },allowDirectSuper: { configurable: true },treatFunctionsAsVar: { configurable: true },allowNewDotTarget: { configurable: true },allowUsing: { configurable: true },inClassStaticBlock: { configurable: true } };\n\n  Parser.prototype.parse = function parse () {\n      var this$1$1 = this;\n\n    var node = this.options.program || this.startNode();\n    this.nextToken();\n    return this.catchStackOverflow(function () { return this$1$1.parseTopLevel(node); })\n  };\n\n  prototypeAccessors.inFunction.get = function () { return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0 };\n\n  prototypeAccessors.inGenerator.get = function () { return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0 };\n\n  prototypeAccessors.inAsync.get = function () { return (this.currentVarScope().flags & SCOPE_ASYNC) > 0 };\n\n  prototypeAccessors.canAwait.get = function () {\n    for (var i = this.scopeStack.length - 1; i >= 0; i--) {\n      var ref = this.scopeStack[i];\n        var flags = ref.flags;\n      if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT)) { return false }\n      if (flags & SCOPE_FUNCTION) { return (flags & SCOPE_ASYNC) > 0 }\n    }\n    return (this.inModule && this.options.ecmaVersion >= 13) || this.options.allowAwaitOutsideFunction\n  };\n\n  prototypeAccessors.allowReturn.get = function () {\n    if (this.inFunction) { return true }\n    if (this.options.allowReturnOutsideFunction && this.currentVarScope().flags & SCOPE_TOP) { return true }\n    return false\n  };\n\n  prototypeAccessors.allowSuper.get = function () {\n    var ref = this.currentThisScope();\n      var flags = ref.flags;\n    return (flags & SCOPE_SUPER) > 0 || this.options.allowSuperOutsideMethod\n  };\n\n  prototypeAccessors.allowDirectSuper.get = function () { return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0 };\n\n  prototypeAccessors.treatFunctionsAsVar.get = function () { return this.treatFunctionsAsVarInScope(this.currentScope()) };\n\n  prototypeAccessors.allowNewDotTarget.get = function () {\n    for (var i = this.scopeStack.length - 1; i >= 0; i--) {\n      var ref = this.scopeStack[i];\n        var flags = ref.flags;\n      if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT) ||\n          ((flags & SCOPE_FUNCTION) && !(flags & SCOPE_ARROW))) { return true }\n    }\n    return false\n  };\n\n  prototypeAccessors.allowUsing.get = function () {\n    var ref = this.currentScope();\n      var flags = ref.flags;\n    if (flags & SCOPE_SWITCH) { return false }\n    if (!this.inModule && flags & SCOPE_TOP) { return false }\n    return true\n  };\n\n  prototypeAccessors.inClassStaticBlock.get = function () {\n    return (this.currentVarScope().flags & SCOPE_CLASS_STATIC_BLOCK) > 0\n  };\n\n  Parser.extend = function extend () {\n      var plugins = [], len = arguments.length;\n      while ( len-- ) plugins[ len ] = arguments[ len ];\n\n    var cls = this;\n    for (var i = 0; i < plugins.length; i++) { cls = plugins[i](cls); }\n    return cls\n  };\n\n  Parser.parse = function parse (input, options) {\n    return new this(options, input).parse()\n  };\n\n  Parser.parseExpressionAt = function parseExpressionAt (input, pos, options) {\n    var parser = new this(options, input, pos);\n    parser.nextToken();\n    return parser.parseExpression()\n  };\n\n  Parser.tokenizer = function tokenizer (input, options) {\n    return new this(options, input)\n  };\n\n  Object.defineProperties( Parser.prototype, prototypeAccessors );\n\n  var pp$9 = Parser.prototype;\n\n  // ## Parser utilities\n\n  var literal = /^(?:'((?:\\\\[^]|[^'\\\\])*?)'|\"((?:\\\\[^]|[^\"\\\\])*?)\")/;\n  pp$9.strictDirective = function(start) {\n    if (this.options.ecmaVersion < 5) { return false }\n    for (;;) {\n      // Try to find string literal.\n      skipWhiteSpace.lastIndex = start;\n      start += skipWhiteSpace.exec(this.input)[0].length;\n      var match = literal.exec(this.input.slice(start));\n      if (!match) { return false }\n      if ((match[1] || match[2]) === \"use strict\") {\n        skipWhiteSpace.lastIndex = start + match[0].length;\n        var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;\n        var next = this.input.charAt(end);\n        return next === \";\" || next === \"}\" ||\n          (lineBreak.test(spaceAfter[0]) &&\n           !(/[(`.[+\\-/*%<>=,?^&]/.test(next) || next === \"!\" && this.input.charAt(end + 1) === \"=\"))\n      }\n      start += match[0].length;\n\n      // Skip semicolon, if any.\n      skipWhiteSpace.lastIndex = start;\n      start += skipWhiteSpace.exec(this.input)[0].length;\n      if (this.input[start] === \";\")\n        { start++; }\n    }\n  };\n\n  // Predicate that tests whether the next token is of the given\n  // type, and if yes, consumes it as a side effect.\n\n  pp$9.eat = function(type) {\n    if (this.type === type) {\n      this.next();\n      return true\n    } else {\n      return false\n    }\n  };\n\n  // Tests whether parsed token is a contextual keyword.\n\n  pp$9.isContextual = function(name) {\n    return this.type === types$1.name && this.value === name && !this.containsEsc\n  };\n\n  // Consumes contextual keyword if possible.\n\n  pp$9.eatContextual = function(name) {\n    if (!this.isContextual(name)) { return false }\n    this.next();\n    return true\n  };\n\n  pp$9.catchStackOverflow = function(f) {\n    try {\n      return f()\n    } catch (e) {\n      if (e instanceof Error && (/\\bstack\\b.*\\b(exceeded|overflow)\\b/i.test(e.message) || /\\btoo much recursion\\b/i.test(e.message)))\n        { this.raise(this.start, \"Not enough stack space to parse input\"); }\n      else\n        { throw e }\n    }\n  };\n\n  // Asserts that following token is given contextual keyword.\n\n  pp$9.expectContextual = function(name) {\n    if (!this.eatContextual(name)) { this.unexpected(); }\n  };\n\n  // Test whether a semicolon can be inserted at the current position.\n\n  pp$9.canInsertSemicolon = function() {\n    return this.type === types$1.eof ||\n      this.type === types$1.braceR ||\n      lineBreak.test(this.input.slice(this.lastTokEnd, this.start))\n  };\n\n  pp$9.insertSemicolon = function() {\n    if (this.canInsertSemicolon()) {\n      if (this.options.onInsertedSemicolon)\n        { this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc); }\n      return true\n    }\n  };\n\n  // Consume a semicolon, or, failing that, see if we are allowed to\n  // pretend that there is a semicolon at this position.\n\n  pp$9.semicolon = function() {\n    if (!this.eat(types$1.semi) && !this.insertSemicolon()) { this.unexpected(); }\n  };\n\n  pp$9.afterTrailingComma = function(tokType, notNext) {\n    if (this.type === tokType) {\n      if (this.options.onTrailingComma)\n        { this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc); }\n      if (!notNext)\n        { this.next(); }\n      return true\n    }\n  };\n\n  // Expect a token of a given type. If found, consume it, otherwise,\n  // raise an unexpected token error.\n\n  pp$9.expect = function(type) {\n    this.eat(type) || this.unexpected();\n  };\n\n  // Raise an unexpected token error.\n\n  pp$9.unexpected = function(pos) {\n    this.raise(pos != null ? pos : this.start, \"Unexpected token\");\n  };\n\n  var DestructuringErrors = function DestructuringErrors() {\n    this.shorthandAssign =\n    this.trailingComma =\n    this.parenthesizedAssign =\n    this.parenthesizedBind =\n    this.doubleProto =\n      -1;\n  };\n\n  pp$9.checkPatternErrors = function(refDestructuringErrors, isAssign) {\n    if (!refDestructuringErrors) { return }\n    if (refDestructuringErrors.trailingComma > -1)\n      { this.raiseRecoverable(refDestructuringErrors.trailingComma, \"Comma is not permitted after the rest element\"); }\n    var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;\n    if (parens > -1) { this.raiseRecoverable(parens, isAssign ? \"Assigning to rvalue\" : \"Parenthesized pattern\"); }\n  };\n\n  pp$9.checkExpressionErrors = function(refDestructuringErrors, andThrow) {\n    if (!refDestructuringErrors) { return false }\n    var shorthandAssign = refDestructuringErrors.shorthandAssign;\n    var doubleProto = refDestructuringErrors.doubleProto;\n    if (!andThrow) { return shorthandAssign >= 0 || doubleProto >= 0 }\n    if (shorthandAssign >= 0)\n      { this.raise(shorthandAssign, \"Shorthand property assignments are valid only in destructuring patterns\"); }\n    if (doubleProto >= 0)\n      { this.raiseRecoverable(doubleProto, \"Redefinition of __proto__ property\"); }\n  };\n\n  pp$9.checkYieldAwaitInDefaultParams = function() {\n    if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos))\n      { this.raise(this.yieldPos, \"Yield expression cannot be a default value\"); }\n    if (this.awaitPos)\n      { this.raise(this.awaitPos, \"Await expression cannot be a default value\"); }\n  };\n\n  pp$9.isSimpleAssignTarget = function(expr) {\n    if (expr.type === \"ParenthesizedExpression\")\n      { return this.isSimpleAssignTarget(expr.expression) }\n    return expr.type === \"Identifier\" || expr.type === \"MemberExpression\"\n  };\n\n  var pp$8 = Parser.prototype;\n\n  // ### Statement parsing\n\n  // Parse a program. Initializes the parser, reads any number of\n  // statements, and wraps them in a Program node.  Optionally takes a\n  // `program` argument.  If present, the statements will be appended\n  // to its body instead of creating a new node.\n\n  pp$8.parseTopLevel = function(node) {\n    var exports$1 = Object.create(null);\n    if (!node.body) { node.body = []; }\n    while (this.type !== types$1.eof) {\n      var stmt = this.parseStatement(null, true, exports$1);\n      node.body.push(stmt);\n    }\n    if (this.inModule)\n      { for (var i = 0, list = Object.keys(this.undefinedExports); i < list.length; i += 1)\n        {\n          var name = list[i];\n\n          this.raiseRecoverable(this.undefinedExports[name].start, (\"Export '\" + name + \"' is not defined\"));\n        } }\n    this.adaptDirectivePrologue(node.body);\n    this.next();\n    node.sourceType = this.options.sourceType === \"commonjs\" ? \"script\" : this.options.sourceType;\n    return this.finishNode(node, \"Program\")\n  };\n\n  var loopLabel = {kind: \"loop\"}, switchLabel = {kind: \"switch\"};\n\n  pp$8.isLet = function(context) {\n    if (this.options.ecmaVersion < 6 || !this.isContextual(\"let\")) { return false }\n    skipWhiteSpace.lastIndex = this.pos;\n    var skip = skipWhiteSpace.exec(this.input);\n    var next = this.pos + skip[0].length, nextCh = this.fullCharCodeAt(next);\n    // For ambiguous cases, determine if a LexicalDeclaration (or only a\n    // Statement) is allowed here. If context is not empty then only a Statement\n    // is allowed. However, `let [` is an explicit negative lookahead for\n    // ExpressionStatement, so special-case it first.\n    if (nextCh === 91 || nextCh === 92) { return true } // '[', '\\'\n    if (context) { return false }\n\n    if (nextCh === 123) { return true } // '{'\n    if (isIdentifierStart(nextCh)) {\n      var start = next;\n      do { next += nextCh <= 0xffff ? 1 : 2; }\n      while (isIdentifierChar(nextCh = this.fullCharCodeAt(next)))\n      if (nextCh === 92) { return true }\n      var ident = this.input.slice(start, next);\n      if (!keywordRelationalOperator.test(ident)) { return true }\n    }\n    return false\n  };\n\n  // check 'async [no LineTerminator here] function'\n  // - 'async /*foo*/ function' is OK.\n  // - 'async /*\\n*/ function' is invalid.\n  pp$8.isAsyncFunction = function() {\n    if (this.options.ecmaVersion < 8 || !this.isContextual(\"async\"))\n      { return false }\n\n    skipWhiteSpace.lastIndex = this.pos;\n    var skip = skipWhiteSpace.exec(this.input);\n    var next = this.pos + skip[0].length, after;\n    return !lineBreak.test(this.input.slice(this.pos, next)) &&\n      this.input.slice(next, next + 8) === \"function\" &&\n      (next + 8 === this.input.length ||\n       !(isIdentifierChar(after = this.fullCharCodeAt(next + 8)) || after === 92 /* '\\' */))\n  };\n\n  pp$8.isUsingKeyword = function(isAwaitUsing, isFor) {\n    if (this.options.ecmaVersion < 17 || !this.isContextual(isAwaitUsing ? \"await\" : \"using\"))\n      { return false }\n\n    skipWhiteSpace.lastIndex = this.pos;\n    var skip = skipWhiteSpace.exec(this.input);\n    var next = this.pos + skip[0].length;\n\n    if (lineBreak.test(this.input.slice(this.pos, next))) { return false }\n\n    if (isAwaitUsing) {\n      var usingEndPos = next + 5 /* using */, after;\n      if (this.input.slice(next, usingEndPos) !== \"using\" ||\n        usingEndPos === this.input.length ||\n        isIdentifierChar(after = this.fullCharCodeAt(usingEndPos)) ||\n        after === 92 /* '\\' */\n      ) { return false }\n\n      skipWhiteSpace.lastIndex = usingEndPos;\n      var skipAfterUsing = skipWhiteSpace.exec(this.input);\n      next = usingEndPos + skipAfterUsing[0].length;\n      if (skipAfterUsing && lineBreak.test(this.input.slice(usingEndPos, next))) { return false }\n    }\n\n    var ch = this.fullCharCodeAt(next);\n    if (!isIdentifierStart(ch) && ch !== 92 /* '\\' */) { return false }\n    var idStart = next;\n    do { next += ch <= 0xffff ? 1 : 2; }\n    while (isIdentifierChar(ch = this.fullCharCodeAt(next)))\n    if (ch === 92) { return true }\n    var id = this.input.slice(idStart, next);\n    if (keywordRelationalOperator.test(id)) { return false }\n    if (isFor && !isAwaitUsing && id === \"of\") {\n      // Look ahead for using declaration with initializer, i.e., `for (using of = ...)`\n      skipWhiteSpace.lastIndex = next;\n      var skipAfterOf = skipWhiteSpace.exec(this.input);\n      next = next + skipAfterOf[0].length;\n      if (this.input.charCodeAt(next) !== 61 /* '=' */ ||\n        // Check for ==, === and => operators\n        (ch = this.input.charCodeAt(next + 1)) === 61 /* '=' */ || ch === 62 /* '>' */) {\n        return false\n      }\n    }\n    return true\n  };\n\n  pp$8.isAwaitUsing = function(isFor) {\n    return this.isUsingKeyword(true, isFor)\n  };\n\n  pp$8.isUsing = function(isFor) {\n    return this.isUsingKeyword(false, isFor)\n  };\n\n  // Parse a single statement.\n  //\n  // If expecting a statement and finding a slash operator, parse a\n  // regular expression literal. This is to handle cases like\n  // `if (foo) /blah/.exec(foo)`, where looking at the previous token\n  // does not help.\n\n  pp$8.parseStatement = function(context, topLevel, exports$1) {\n    var starttype = this.type, node = this.startNode(), kind;\n\n    if (this.isLet(context)) {\n      starttype = types$1._var;\n      kind = \"let\";\n    }\n\n    // Most types of statements are recognized by the keyword they\n    // start with. Many are trivial to parse, some require a bit of\n    // complexity.\n\n    switch (starttype) {\n    case types$1._break: case types$1._continue: return this.parseBreakContinueStatement(node, starttype.keyword)\n    case types$1._debugger: return this.parseDebuggerStatement(node)\n    case types$1._do: return this.parseDoStatement(node)\n    case types$1._for: return this.parseForStatement(node)\n    case types$1._function:\n      // Function as sole body of either an if statement or a labeled statement\n      // works, but not when it is part of a labeled statement that is the sole\n      // body of an if statement.\n      if ((context && (this.strict || context !== \"if\" && context !== \"label\")) && this.options.ecmaVersion >= 6) { this.unexpected(); }\n      return this.parseFunctionStatement(node, false, !context)\n    case types$1._class:\n      if (context) { this.unexpected(); }\n      return this.parseClass(node, true)\n    case types$1._if: return this.parseIfStatement(node)\n    case types$1._return: return this.parseReturnStatement(node)\n    case types$1._switch: return this.parseSwitchStatement(node)\n    case types$1._throw: return this.parseThrowStatement(node)\n    case types$1._try: return this.parseTryStatement(node)\n    case types$1._const: case types$1._var:\n      kind = kind || this.value;\n      if (context && kind !== \"var\") { this.unexpected(); }\n      return this.parseVarStatement(node, kind)\n    case types$1._while: return this.parseWhileStatement(node)\n    case types$1._with: return this.parseWithStatement(node)\n    case types$1.braceL: return this.parseBlock(true, node)\n    case types$1.semi: return this.parseEmptyStatement(node)\n    case types$1._export:\n    case types$1._import:\n      if (this.options.ecmaVersion > 10 && starttype === types$1._import) {\n        skipWhiteSpace.lastIndex = this.pos;\n        var skip = skipWhiteSpace.exec(this.input);\n        var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);\n        if (nextCh === 40 || nextCh === 46) // '(' or '.'\n          { return this.parseExpressionStatement(node, this.parseExpression()) }\n      }\n\n      if (!this.options.allowImportExportEverywhere) {\n        if (!topLevel)\n          { this.raise(this.start, \"'import' and 'export' may only appear at the top level\"); }\n        if (!this.inModule)\n          { this.raise(this.start, \"'import' and 'export' may appear only with 'sourceType: module'\"); }\n      }\n      return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports$1)\n\n      // If the statement does not start with a statement keyword or a\n      // brace, it's an ExpressionStatement or LabeledStatement. We\n      // simply start parsing an expression, and afterwards, if the\n      // next token is a colon and the expression was a simple\n      // Identifier node, we switch to interpreting it as a label.\n    default:\n      if (this.isAsyncFunction()) {\n        if (context) { this.unexpected(); }\n        this.next();\n        return this.parseFunctionStatement(node, true, !context)\n      }\n\n      var usingKind = this.isAwaitUsing(false) ? \"await using\" : this.isUsing(false) ? \"using\" : null;\n      if (usingKind) {\n        if (!this.allowUsing) {\n          this.raise(this.start, \"Using declaration cannot appear in the top level when source type is `script` or in the bare case statement\");\n        }\n        if (context) {\n          // Cases like `for (;;) using x = ...;`, `if (true) await using x = ...;`, etc. are not allowed.\n          this.raise(this.start, \"Using declaration is not allowed in single-statement positions\");\n        }\n        if (usingKind === \"await using\") {\n          if (!this.canAwait) {\n            this.raise(this.start, \"Await using cannot appear outside of async function\");\n          }\n          this.next();\n        }\n        this.next();\n        this.parseVar(node, false, usingKind);\n        this.semicolon();\n        return this.finishNode(node, \"VariableDeclaration\")\n      }\n\n      var maybeName = this.value, expr = this.parseExpression();\n      if (starttype === types$1.name && expr.type === \"Identifier\" && this.eat(types$1.colon))\n        { return this.parseLabeledStatement(node, maybeName, expr, context) }\n      else { return this.parseExpressionStatement(node, expr) }\n    }\n  };\n\n  pp$8.parseBreakContinueStatement = function(node, keyword) {\n    var isBreak = keyword === \"break\";\n    this.next();\n    if (this.eat(types$1.semi) || this.insertSemicolon()) { node.label = null; }\n    else if (this.type !== types$1.name) { this.unexpected(); }\n    else {\n      node.label = this.parseIdent();\n      this.semicolon();\n    }\n\n    // Verify that there is an actual destination to break or\n    // continue to.\n    var i = 0;\n    for (; i < this.labels.length; ++i) {\n      var lab = this.labels[i];\n      if (node.label == null || lab.name === node.label.name) {\n        if (lab.kind != null && (isBreak || lab.kind === \"loop\")) { break }\n        if (node.label && isBreak) { break }\n      }\n    }\n    if (i === this.labels.length) { this.raise(node.start, \"Unsyntactic \" + keyword); }\n    return this.finishNode(node, isBreak ? \"BreakStatement\" : \"ContinueStatement\")\n  };\n\n  pp$8.parseDebuggerStatement = function(node) {\n    this.next();\n    this.semicolon();\n    return this.finishNode(node, \"DebuggerStatement\")\n  };\n\n  pp$8.parseDoStatement = function(node) {\n    this.next();\n    this.labels.push(loopLabel);\n    node.body = this.parseStatement(\"do\");\n    this.labels.pop();\n    this.expect(types$1._while);\n    node.test = this.parseParenExpression();\n    if (this.options.ecmaVersion >= 6)\n      { this.eat(types$1.semi); }\n    else\n      { this.semicolon(); }\n    return this.finishNode(node, \"DoWhileStatement\")\n  };\n\n  // Disambiguating between a `for` and a `for`/`in` or `for`/`of`\n  // loop is non-trivial. Basically, we have to parse the init `var`\n  // statement or expression, disallowing the `in` operator (see\n  // the second parameter to `parseExpression`), and then check\n  // whether the next token is `in` or `of`. When there is no init\n  // part (semicolon immediately after the opening parenthesis), it\n  // is a regular `for` loop.\n\n  pp$8.parseForStatement = function(node) {\n    this.next();\n    var awaitAt = (this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual(\"await\")) ? this.lastTokStart : -1;\n    this.labels.push(loopLabel);\n    this.enterScope(0);\n    this.expect(types$1.parenL);\n    if (this.type === types$1.semi) {\n      if (awaitAt > -1) { this.unexpected(awaitAt); }\n      return this.parseFor(node, null)\n    }\n    var isLet = this.isLet();\n    if (this.type === types$1._var || this.type === types$1._const || isLet) {\n      var init$1 = this.startNode(), kind = isLet ? \"let\" : this.value;\n      this.next();\n      this.parseVar(init$1, true, kind);\n      this.finishNode(init$1, \"VariableDeclaration\");\n      return this.parseForAfterInit(node, init$1, awaitAt)\n    }\n    var startsWithLet = this.isContextual(\"let\"), isForOf = false;\n\n    var usingKind = this.isUsing(true) ? \"using\" : this.isAwaitUsing(true) ? \"await using\" : null;\n    if (usingKind) {\n      var init$2 = this.startNode();\n      this.next();\n      if (usingKind === \"await using\") {\n        if (!this.canAwait) {\n          this.raise(this.start, \"Await using cannot appear outside of async function\");\n        }\n        this.next();\n      }\n      this.parseVar(init$2, true, usingKind);\n      this.finishNode(init$2, \"VariableDeclaration\");\n      return this.parseForAfterInit(node, init$2, awaitAt)\n    }\n    var containsEsc = this.containsEsc;\n    var refDestructuringErrors = new DestructuringErrors;\n    var initPos = this.start;\n    var init = awaitAt > -1\n      ? this.parseExprSubscripts(refDestructuringErrors, \"await\")\n      : this.parseExpression(true, refDestructuringErrors);\n    if (this.type === types$1._in || (isForOf = this.options.ecmaVersion >= 6 && this.isContextual(\"of\"))) {\n      if (awaitAt > -1) { // implies `ecmaVersion >= 9` (see declaration of awaitAt)\n        if (this.type === types$1._in) { this.unexpected(awaitAt); }\n        node.await = true;\n      } else if (isForOf && this.options.ecmaVersion >= 8) {\n        if (init.start === initPos && !containsEsc && init.type === \"Identifier\" && init.name === \"async\") { this.unexpected(); }\n        else if (this.options.ecmaVersion >= 9) { node.await = false; }\n      }\n      if (startsWithLet && isForOf) { this.raise(init.start, \"The left-hand side of a for-of loop may not start with 'let'.\"); }\n      this.toAssignable(init, false, refDestructuringErrors);\n      this.checkLValPattern(init);\n      return this.parseForIn(node, init)\n    } else {\n      this.checkExpressionErrors(refDestructuringErrors, true);\n    }\n    if (awaitAt > -1) { this.unexpected(awaitAt); }\n    return this.parseFor(node, init)\n  };\n\n  // Helper method to parse for loop after variable initialization\n  pp$8.parseForAfterInit = function(node, init, awaitAt) {\n    if ((this.type === types$1._in || (this.options.ecmaVersion >= 6 && this.isContextual(\"of\"))) && init.declarations.length === 1) {\n      if (this.type === types$1._in) {\n        if ((init.kind === \"using\" || init.kind === \"await using\") && !init.declarations[0].init) {\n          this.raise(this.start, \"Using declaration is not allowed in for-in loops\");\n        }\n        if (this.options.ecmaVersion >= 9 && awaitAt > -1) { this.unexpected(awaitAt); }\n      } else if (this.options.ecmaVersion >= 9) { node.await = awaitAt > -1; }\n      return this.parseForIn(node, init)\n    }\n    if (awaitAt > -1) { this.unexpected(awaitAt); }\n    return this.parseFor(node, init)\n  };\n\n  pp$8.parseFunctionStatement = function(node, isAsync, declarationPosition) {\n    this.next();\n    return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync)\n  };\n\n  pp$8.parseIfStatement = function(node) {\n    this.next();\n    node.test = this.parseParenExpression();\n    // allow function declarations in branches, but only in non-strict mode\n    node.consequent = this.parseStatement(\"if\");\n    node.alternate = this.eat(types$1._else) ? this.parseStatement(\"if\") : null;\n    return this.finishNode(node, \"IfStatement\")\n  };\n\n  pp$8.parseReturnStatement = function(node) {\n    if (!this.allowReturn)\n      { this.raise(this.start, \"'return' outside of function\"); }\n    this.next();\n\n    // In `return` (and `break`/`continue`), the keywords with\n    // optional arguments, we eagerly look for a semicolon or the\n    // possibility to insert one.\n\n    if (this.eat(types$1.semi) || this.insertSemicolon()) { node.argument = null; }\n    else { node.argument = this.parseExpression(); this.semicolon(); }\n    return this.finishNode(node, \"ReturnStatement\")\n  };\n\n  pp$8.parseSwitchStatement = function(node) {\n    this.next();\n    node.discriminant = this.parseParenExpression();\n    node.cases = [];\n    this.expect(types$1.braceL);\n    this.labels.push(switchLabel);\n    this.enterScope(SCOPE_SWITCH);\n\n    // Statements under must be grouped (by label) in SwitchCase\n    // nodes. `cur` is used to keep the node that we are currently\n    // adding statements to.\n\n    var cur;\n    for (var sawDefault = false; this.type !== types$1.braceR;) {\n      if (this.type === types$1._case || this.type === types$1._default) {\n        var isCase = this.type === types$1._case;\n        if (cur) { this.finishNode(cur, \"SwitchCase\"); }\n        node.cases.push(cur = this.startNode());\n        cur.consequent = [];\n        this.next();\n        if (isCase) {\n          cur.test = this.parseExpression();\n        } else {\n          if (sawDefault) { this.raiseRecoverable(this.lastTokStart, \"Multiple default clauses\"); }\n          sawDefault = true;\n          cur.test = null;\n        }\n        this.expect(types$1.colon);\n      } else {\n        if (!cur) { this.unexpected(); }\n        cur.consequent.push(this.parseStatement(null));\n      }\n    }\n    this.exitScope();\n    if (cur) { this.finishNode(cur, \"SwitchCase\"); }\n    this.next(); // Closing brace\n    this.labels.pop();\n    return this.finishNode(node, \"SwitchStatement\")\n  };\n\n  pp$8.parseThrowStatement = function(node) {\n    this.next();\n    if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))\n      { this.raise(this.lastTokEnd, \"Illegal newline after throw\"); }\n    node.argument = this.parseExpression();\n    this.semicolon();\n    return this.finishNode(node, \"ThrowStatement\")\n  };\n\n  // Reused empty array added for node fields that are always empty.\n\n  var empty$1 = [];\n\n  pp$8.parseCatchClauseParam = function() {\n    var param = this.parseBindingAtom();\n    var simple = param.type === \"Identifier\";\n    this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);\n    this.checkLValPattern(param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);\n    this.expect(types$1.parenR);\n\n    return param\n  };\n\n  pp$8.parseTryStatement = function(node) {\n    this.next();\n    node.block = this.parseBlock();\n    node.handler = null;\n    if (this.type === types$1._catch) {\n      var clause = this.startNode();\n      this.next();\n      if (this.eat(types$1.parenL)) {\n        clause.param = this.parseCatchClauseParam();\n      } else {\n        if (this.options.ecmaVersion < 10) { this.unexpected(); }\n        clause.param = null;\n        this.enterScope(0);\n      }\n      clause.body = this.parseBlock(false);\n      this.exitScope();\n      node.handler = this.finishNode(clause, \"CatchClause\");\n    }\n    node.finalizer = this.eat(types$1._finally) ? this.parseBlock() : null;\n    if (!node.handler && !node.finalizer)\n      { this.raise(node.start, \"Missing catch or finally clause\"); }\n    return this.finishNode(node, \"TryStatement\")\n  };\n\n  pp$8.parseVarStatement = function(node, kind, allowMissingInitializer) {\n    this.next();\n    this.parseVar(node, false, kind, allowMissingInitializer);\n    this.semicolon();\n    return this.finishNode(node, \"VariableDeclaration\")\n  };\n\n  pp$8.parseWhileStatement = function(node) {\n    this.next();\n    node.test = this.parseParenExpression();\n    this.labels.push(loopLabel);\n    node.body = this.parseStatement(\"while\");\n    this.labels.pop();\n    return this.finishNode(node, \"WhileStatement\")\n  };\n\n  pp$8.parseWithStatement = function(node) {\n    if (this.strict) { this.raise(this.start, \"'with' in strict mode\"); }\n    this.next();\n    node.object = this.parseParenExpression();\n    node.body = this.parseStatement(\"with\");\n    return this.finishNode(node, \"WithStatement\")\n  };\n\n  pp$8.parseEmptyStatement = function(node) {\n    this.next();\n    return this.finishNode(node, \"EmptyStatement\")\n  };\n\n  pp$8.parseLabeledStatement = function(node, maybeName, expr, context) {\n    for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1)\n      {\n      var label = list[i$1];\n\n      if (label.name === maybeName)\n        { this.raise(expr.start, \"Label '\" + maybeName + \"' is already declared\");\n    } }\n    var kind = this.type.isLoop ? \"loop\" : this.type === types$1._switch ? \"switch\" : null;\n    for (var i = this.labels.length - 1; i >= 0; i--) {\n      var label$1 = this.labels[i];\n      if (label$1.statementStart === node.start) {\n        // Update information about previous labels on this node\n        label$1.statementStart = this.start;\n        label$1.kind = kind;\n      } else { break }\n    }\n    this.labels.push({name: maybeName, kind: kind, statementStart: this.start});\n    node.body = this.parseStatement(context ? context.indexOf(\"label\") === -1 ? context + \"label\" : context : \"label\");\n    this.labels.pop();\n    node.label = expr;\n    return this.finishNode(node, \"LabeledStatement\")\n  };\n\n  pp$8.parseExpressionStatement = function(node, expr) {\n    node.expression = expr;\n    this.semicolon();\n    return this.finishNode(node, \"ExpressionStatement\")\n  };\n\n  // Parse a semicolon-enclosed block of statements, handling `\"use\n  // strict\"` declarations when `allowStrict` is true (used for\n  // function bodies).\n\n  pp$8.parseBlock = function(createNewLexicalScope, node, exitStrict) {\n    if ( createNewLexicalScope === void 0 ) createNewLexicalScope = true;\n    if ( node === void 0 ) node = this.startNode();\n\n    node.body = [];\n    this.expect(types$1.braceL);\n    if (createNewLexicalScope) { this.enterScope(0); }\n    while (this.type !== types$1.braceR) {\n      var stmt = this.parseStatement(null);\n      node.body.push(stmt);\n    }\n    if (exitStrict) { this.strict = false; }\n    this.next();\n    if (createNewLexicalScope) { this.exitScope(); }\n    return this.finishNode(node, \"BlockStatement\")\n  };\n\n  // Parse a regular `for` loop. The disambiguation code in\n  // `parseStatement` will already have parsed the init statement or\n  // expression.\n\n  pp$8.parseFor = function(node, init) {\n    node.init = init;\n    this.expect(types$1.semi);\n    node.test = this.type === types$1.semi ? null : this.parseExpression();\n    this.expect(types$1.semi);\n    node.update = this.type === types$1.parenR ? null : this.parseExpression();\n    this.expect(types$1.parenR);\n    node.body = this.parseStatement(\"for\");\n    this.exitScope();\n    this.labels.pop();\n    return this.finishNode(node, \"ForStatement\")\n  };\n\n  // Parse a `for`/`in` and `for`/`of` loop, which are almost\n  // same from parser's perspective.\n\n  pp$8.parseForIn = function(node, init) {\n    var isForIn = this.type === types$1._in;\n    this.next();\n\n    if (\n      init.type === \"VariableDeclaration\" &&\n      init.declarations[0].init != null &&\n      (\n        !isForIn ||\n        this.options.ecmaVersion < 8 ||\n        this.strict ||\n        init.kind !== \"var\" ||\n        init.declarations[0].id.type !== \"Identifier\"\n      )\n    ) {\n      this.raise(\n        init.start,\n        ((isForIn ? \"for-in\" : \"for-of\") + \" loop variable declaration may not have an initializer\")\n      );\n    }\n    node.left = init;\n    node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();\n    this.expect(types$1.parenR);\n    node.body = this.parseStatement(\"for\");\n    this.exitScope();\n    this.labels.pop();\n    return this.finishNode(node, isForIn ? \"ForInStatement\" : \"ForOfStatement\")\n  };\n\n  // Parse a list of variable declarations.\n\n  pp$8.parseVar = function(node, isFor, kind, allowMissingInitializer) {\n    node.declarations = [];\n    node.kind = kind;\n    for (;;) {\n      var decl = this.startNode();\n      this.parseVarId(decl, kind);\n      if (this.eat(types$1.eq)) {\n        decl.init = this.parseMaybeAssign(isFor);\n      } else if (!allowMissingInitializer && kind === \"const\" && !(this.type === types$1._in || (this.options.ecmaVersion >= 6 && this.isContextual(\"of\")))) {\n        this.unexpected();\n      } else if (!allowMissingInitializer && (kind === \"using\" || kind === \"await using\") && this.options.ecmaVersion >= 17 && this.type !== types$1._in && !this.isContextual(\"of\")) {\n        this.raise(this.lastTokEnd, (\"Missing initializer in \" + kind + \" declaration\"));\n      } else if (!allowMissingInitializer && decl.id.type !== \"Identifier\" && !(isFor && (this.type === types$1._in || this.isContextual(\"of\")))) {\n        this.raise(this.lastTokEnd, \"Complex binding patterns require an initialization value\");\n      } else {\n        decl.init = null;\n      }\n      node.declarations.push(this.finishNode(decl, \"VariableDeclarator\"));\n      if (!this.eat(types$1.comma)) { break }\n    }\n    return node\n  };\n\n  pp$8.parseVarId = function(decl, kind) {\n    decl.id = kind === \"using\" || kind === \"await using\"\n      ? this.parseIdent()\n      : this.parseBindingAtom();\n\n    this.checkLValPattern(decl.id, kind === \"var\" ? BIND_VAR : BIND_LEXICAL, false);\n  };\n\n  var FUNC_STATEMENT = 1, FUNC_HANGING_STATEMENT = 2, FUNC_NULLABLE_ID = 4;\n\n  // Parse a function declaration or literal (depending on the\n  // `statement & FUNC_STATEMENT`).\n\n  // Remove `allowExpressionBody` for 7.0.0, as it is only called with false\n  pp$8.parseFunction = function(node, statement, allowExpressionBody, isAsync, forInit) {\n    this.initFunction(node);\n    if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {\n      if (this.type === types$1.star && (statement & FUNC_HANGING_STATEMENT))\n        { this.unexpected(); }\n      node.generator = this.eat(types$1.star);\n    }\n    if (this.options.ecmaVersion >= 8)\n      { node.async = !!isAsync; }\n\n    if (statement & FUNC_STATEMENT) {\n      node.id = (statement & FUNC_NULLABLE_ID) && this.type !== types$1.name ? null : this.parseIdent();\n      if (node.id && !(statement & FUNC_HANGING_STATEMENT))\n        // If it is a regular function declaration in sloppy mode, then it is\n        // subject to Annex B semantics (BIND_FUNCTION). Otherwise, the binding\n        // mode depends on properties of the current scope (see\n        // treatFunctionsAsVar).\n        { this.checkLValSimple(node.id, (this.strict || node.generator || node.async) ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION); }\n    }\n\n    var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;\n    this.yieldPos = 0;\n    this.awaitPos = 0;\n    this.awaitIdentPos = 0;\n    this.enterScope(functionFlags(node.async, node.generator));\n\n    if (!(statement & FUNC_STATEMENT))\n      { node.id = this.type === types$1.name ? this.parseIdent() : null; }\n\n    this.parseFunctionParams(node);\n    this.parseFunctionBody(node, allowExpressionBody, false, forInit);\n\n    this.yieldPos = oldYieldPos;\n    this.awaitPos = oldAwaitPos;\n    this.awaitIdentPos = oldAwaitIdentPos;\n    return this.finishNode(node, (statement & FUNC_STATEMENT) ? \"FunctionDeclaration\" : \"FunctionExpression\")\n  };\n\n  pp$8.parseFunctionParams = function(node) {\n    this.expect(types$1.parenL);\n    node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);\n    this.checkYieldAwaitInDefaultParams();\n  };\n\n  // Parse a class declaration or literal (depending on the\n  // `isStatement` parameter).\n\n  pp$8.parseClass = function(node, isStatement) {\n    this.next();\n\n    // ecma-262 14.6 Class Definitions\n    // A class definition is always strict mode code.\n    var oldStrict = this.strict;\n    this.strict = true;\n\n    this.parseClassId(node, isStatement);\n    this.parseClassSuper(node);\n    var privateNameMap = this.enterClassBody();\n    var classBody = this.startNode();\n    var hadConstructor = false;\n    classBody.body = [];\n    this.expect(types$1.braceL);\n    while (this.type !== types$1.braceR) {\n      var element = this.parseClassElement(node.superClass !== null);\n      if (element) {\n        classBody.body.push(element);\n        if (element.type === \"MethodDefinition\" && element.kind === \"constructor\") {\n          if (hadConstructor) { this.raiseRecoverable(element.start, \"Duplicate constructor in the same class\"); }\n          hadConstructor = true;\n        } else if (element.key && element.key.type === \"PrivateIdentifier\" && isPrivateNameConflicted(privateNameMap, element)) {\n          this.raiseRecoverable(element.key.start, (\"Identifier '#\" + (element.key.name) + \"' has already been declared\"));\n        }\n      }\n    }\n    this.strict = oldStrict;\n    this.next();\n    node.body = this.finishNode(classBody, \"ClassBody\");\n    this.exitClassBody();\n    return this.finishNode(node, isStatement ? \"ClassDeclaration\" : \"ClassExpression\")\n  };\n\n  pp$8.parseClassElement = function(constructorAllowsSuper) {\n    if (this.eat(types$1.semi)) { return null }\n\n    var ecmaVersion = this.options.ecmaVersion;\n    var node = this.startNode();\n    var keyName = \"\";\n    var isGenerator = false;\n    var isAsync = false;\n    var kind = \"method\";\n    var isStatic = false;\n\n    if (this.eatContextual(\"static\")) {\n      // Parse static init block\n      if (ecmaVersion >= 13 && this.eat(types$1.braceL)) {\n        this.parseClassStaticBlock(node);\n        return node\n      }\n      if (this.isClassElementNameStart() || this.type === types$1.star) {\n        isStatic = true;\n      } else {\n        keyName = \"static\";\n      }\n    }\n    node.static = isStatic;\n    if (!keyName && ecmaVersion >= 8 && this.eatContextual(\"async\")) {\n      if ((this.isClassElementNameStart() || this.type === types$1.star) && !this.canInsertSemicolon()) {\n        isAsync = true;\n      } else {\n        keyName = \"async\";\n      }\n    }\n    if (!keyName && (ecmaVersion >= 9 || !isAsync) && this.eat(types$1.star)) {\n      isGenerator = true;\n    }\n    if (!keyName && !isAsync && !isGenerator) {\n      var lastValue = this.value;\n      if (this.eatContextual(\"get\") || this.eatContextual(\"set\")) {\n        if (this.isClassElementNameStart()) {\n          kind = lastValue;\n        } else {\n          keyName = lastValue;\n        }\n      }\n    }\n\n    // Parse element name\n    if (keyName) {\n      // 'async', 'get', 'set', or 'static' were not a keyword contextually.\n      // The last token is any of those. Make it the element name.\n      node.computed = false;\n      node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);\n      node.key.name = keyName;\n      this.finishNode(node.key, \"Identifier\");\n    } else {\n      this.parseClassElementName(node);\n    }\n\n    // Parse element value\n    if (ecmaVersion < 13 || this.type === types$1.parenL || kind !== \"method\" || isGenerator || isAsync) {\n      var isConstructor = !node.static && checkKeyName(node, \"constructor\");\n      var allowsDirectSuper = isConstructor && constructorAllowsSuper;\n      // Couldn't move this check into the 'parseClassMethod' method for backward compatibility.\n      if (isConstructor && kind !== \"method\") { this.raise(node.key.start, \"Constructor can't have get/set modifier\"); }\n      node.kind = isConstructor ? \"constructor\" : kind;\n      this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);\n    } else {\n      this.parseClassField(node);\n    }\n\n    return node\n  };\n\n  pp$8.isClassElementNameStart = function() {\n    return (\n      this.type === types$1.name ||\n      this.type === types$1.privateId ||\n      this.type === types$1.num ||\n      this.type === types$1.string ||\n      this.type === types$1.bracketL ||\n      this.type.keyword\n    )\n  };\n\n  pp$8.parseClassElementName = function(element) {\n    if (this.type === types$1.privateId) {\n      if (this.value === \"constructor\") {\n        this.raise(this.start, \"Classes can't have an element named '#constructor'\");\n      }\n      element.computed = false;\n      element.key = this.parsePrivateIdent();\n    } else {\n      this.parsePropertyName(element);\n    }\n  };\n\n  pp$8.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {\n    // Check key and flags\n    var key = method.key;\n    if (method.kind === \"constructor\") {\n      if (isGenerator) { this.raise(key.start, \"Constructor can't be a generator\"); }\n      if (isAsync) { this.raise(key.start, \"Constructor can't be an async method\"); }\n    } else if (method.static && checkKeyName(method, \"prototype\")) {\n      this.raise(key.start, \"Classes may not have a static property named prototype\");\n    }\n\n    // Parse value\n    var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);\n\n    // Check value\n    if (method.kind === \"get\" && value.params.length !== 0)\n      { this.raiseRecoverable(value.start, \"getter should have no params\"); }\n    if (method.kind === \"set\" && value.params.length !== 1)\n      { this.raiseRecoverable(value.start, \"setter should have exactly one param\"); }\n    if (method.kind === \"set\" && value.params[0].type === \"RestElement\")\n      { this.raiseRecoverable(value.params[0].start, \"Setter cannot use rest params\"); }\n\n    return this.finishNode(method, \"MethodDefinition\")\n  };\n\n  pp$8.parseClassField = function(field) {\n    if (checkKeyName(field, \"constructor\")) {\n      this.raise(field.key.start, \"Classes can't have a field named 'constructor'\");\n    } else if (field.static && checkKeyName(field, \"prototype\")) {\n      this.raise(field.key.start, \"Classes can't have a static field named 'prototype'\");\n    }\n\n    if (this.eat(types$1.eq)) {\n      // To raise SyntaxError if 'arguments' exists in the initializer.\n      this.enterScope(SCOPE_CLASS_FIELD_INIT | SCOPE_SUPER);\n      field.value = this.parseMaybeAssign();\n      this.exitScope();\n    } else {\n      field.value = null;\n    }\n    this.semicolon();\n\n    return this.finishNode(field, \"PropertyDefinition\")\n  };\n\n  pp$8.parseClassStaticBlock = function(node) {\n    node.body = [];\n\n    var oldLabels = this.labels;\n    this.labels = [];\n    this.enterScope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);\n    while (this.type !== types$1.braceR) {\n      var stmt = this.parseStatement(null);\n      node.body.push(stmt);\n    }\n    this.next();\n    this.exitScope();\n    this.labels = oldLabels;\n\n    return this.finishNode(node, \"StaticBlock\")\n  };\n\n  pp$8.parseClassId = function(node, isStatement) {\n    if (this.type === types$1.name) {\n      node.id = this.parseIdent();\n      if (isStatement)\n        { this.checkLValSimple(node.id, BIND_LEXICAL, false); }\n    } else {\n      if (isStatement === true)\n        { this.unexpected(); }\n      node.id = null;\n    }\n  };\n\n  pp$8.parseClassSuper = function(node) {\n    node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(null, false) : null;\n  };\n\n  pp$8.enterClassBody = function() {\n    var element = {declared: Object.create(null), used: []};\n    this.privateNameStack.push(element);\n    return element.declared\n  };\n\n  pp$8.exitClassBody = function() {\n    var ref = this.privateNameStack.pop();\n    var declared = ref.declared;\n    var used = ref.used;\n    if (!this.options.checkPrivateFields) { return }\n    var len = this.privateNameStack.length;\n    var parent = len === 0 ? null : this.privateNameStack[len - 1];\n    for (var i = 0; i < used.length; ++i) {\n      var id = used[i];\n      if (!hasOwn(declared, id.name)) {\n        if (parent) {\n          parent.used.push(id);\n        } else {\n          this.raiseRecoverable(id.start, (\"Private field '#\" + (id.name) + \"' must be declared in an enclosing class\"));\n        }\n      }\n    }\n  };\n\n  function isPrivateNameConflicted(privateNameMap, element) {\n    var name = element.key.name;\n    var curr = privateNameMap[name];\n\n    var next = \"true\";\n    if (element.type === \"MethodDefinition\" && (element.kind === \"get\" || element.kind === \"set\")) {\n      next = (element.static ? \"s\" : \"i\") + element.kind;\n    }\n\n    // `class { get #a(){}; static set #a(_){} }` is also conflict.\n    if (\n      curr === \"iget\" && next === \"iset\" ||\n      curr === \"iset\" && next === \"iget\" ||\n      curr === \"sget\" && next === \"sset\" ||\n      curr === \"sset\" && next === \"sget\"\n    ) {\n      privateNameMap[name] = \"true\";\n      return false\n    } else if (!curr) {\n      privateNameMap[name] = next;\n      return false\n    } else {\n      return true\n    }\n  }\n\n  function checkKeyName(node, name) {\n    var computed = node.computed;\n    var key = node.key;\n    return !computed && (\n      key.type === \"Identifier\" && key.name === name ||\n      key.type === \"Literal\" && key.value === name\n    )\n  }\n\n  // Parses module export declaration.\n\n  pp$8.parseExportAllDeclaration = function(node, exports$1) {\n    if (this.options.ecmaVersion >= 11) {\n      if (this.eatContextual(\"as\")) {\n        node.exported = this.parseModuleExportName();\n        this.checkExport(exports$1, node.exported, this.lastTokStart);\n      } else {\n        node.exported = null;\n      }\n    }\n    this.expectContextual(\"from\");\n    if (this.type !== types$1.string) { this.unexpected(); }\n    node.source = this.parseExprAtom();\n    if (this.options.ecmaVersion >= 16)\n      { node.attributes = this.parseWithClause(); }\n    this.semicolon();\n    return this.finishNode(node, \"ExportAllDeclaration\")\n  };\n\n  pp$8.parseExport = function(node, exports$1) {\n    this.next();\n    // export * from '...'\n    if (this.eat(types$1.star)) {\n      return this.parseExportAllDeclaration(node, exports$1)\n    }\n    if (this.eat(types$1._default)) { // export default ...\n      this.checkExport(exports$1, \"default\", this.lastTokStart);\n      node.declaration = this.parseExportDefaultDeclaration();\n      return this.finishNode(node, \"ExportDefaultDeclaration\")\n    }\n    // export var|const|let|function|class ...\n    if (this.shouldParseExportStatement()) {\n      node.declaration = this.parseExportDeclaration(node);\n      if (node.declaration.type === \"VariableDeclaration\")\n        { this.checkVariableExport(exports$1, node.declaration.declarations); }\n      else\n        { this.checkExport(exports$1, node.declaration.id, node.declaration.id.start); }\n      node.specifiers = [];\n      node.source = null;\n      if (this.options.ecmaVersion >= 16)\n        { node.attributes = []; }\n    } else { // export { x, y as z } [from '...']\n      node.declaration = null;\n      node.specifiers = this.parseExportSpecifiers(exports$1);\n      if (this.eatContextual(\"from\")) {\n        if (this.type !== types$1.string) { this.unexpected(); }\n        node.source = this.parseExprAtom();\n        if (this.options.ecmaVersion >= 16)\n          { node.attributes = this.parseWithClause(); }\n      } else {\n        for (var i = 0, list = node.specifiers; i < list.length; i += 1) {\n          // check for keywords used as local names\n          var spec = list[i];\n\n          this.checkUnreserved(spec.local);\n          // check if export is defined\n          this.checkLocalExport(spec.local);\n\n          if (spec.local.type === \"Literal\") {\n            this.raise(spec.local.start, \"A string literal cannot be used as an exported binding without `from`.\");\n          }\n        }\n\n        node.source = null;\n        if (this.options.ecmaVersion >= 16)\n          { node.attributes = []; }\n      }\n      this.semicolon();\n    }\n    return this.finishNode(node, \"ExportNamedDeclaration\")\n  };\n\n  pp$8.parseExportDeclaration = function(node) {\n    return this.parseStatement(null)\n  };\n\n  pp$8.parseExportDefaultDeclaration = function() {\n    var isAsync;\n    if (this.type === types$1._function || (isAsync = this.isAsyncFunction())) {\n      var fNode = this.startNode();\n      this.next();\n      if (isAsync) { this.next(); }\n      return this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync)\n    } else if (this.type === types$1._class) {\n      var cNode = this.startNode();\n      return this.parseClass(cNode, \"nullableID\")\n    } else {\n      var declaration = this.parseMaybeAssign();\n      this.semicolon();\n      return declaration\n    }\n  };\n\n  pp$8.checkExport = function(exports$1, name, pos) {\n    if (!exports$1) { return }\n    if (typeof name !== \"string\")\n      { name = name.type === \"Identifier\" ? name.name : name.value; }\n    if (hasOwn(exports$1, name))\n      { this.raiseRecoverable(pos, \"Duplicate export '\" + name + \"'\"); }\n    exports$1[name] = true;\n  };\n\n  pp$8.checkPatternExport = function(exports$1, pat) {\n    var type = pat.type;\n    if (type === \"Identifier\")\n      { this.checkExport(exports$1, pat, pat.start); }\n    else if (type === \"ObjectPattern\")\n      { for (var i = 0, list = pat.properties; i < list.length; i += 1)\n        {\n          var prop = list[i];\n\n          this.checkPatternExport(exports$1, prop);\n        } }\n    else if (type === \"ArrayPattern\")\n      { for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {\n        var elt = list$1[i$1];\n\n          if (elt) { this.checkPatternExport(exports$1, elt); }\n      } }\n    else if (type === \"Property\")\n      { this.checkPatternExport(exports$1, pat.value); }\n    else if (type === \"AssignmentPattern\")\n      { this.checkPatternExport(exports$1, pat.left); }\n    else if (type === \"RestElement\")\n      { this.checkPatternExport(exports$1, pat.argument); }\n  };\n\n  pp$8.checkVariableExport = function(exports$1, decls) {\n    if (!exports$1) { return }\n    for (var i = 0, list = decls; i < list.length; i += 1)\n      {\n      var decl = list[i];\n\n      this.checkPatternExport(exports$1, decl.id);\n    }\n  };\n\n  pp$8.shouldParseExportStatement = function() {\n    return this.type.keyword === \"var\" ||\n      this.type.keyword === \"const\" ||\n      this.type.keyword === \"class\" ||\n      this.type.keyword === \"function\" ||\n      this.isLet() ||\n      this.isAsyncFunction()\n  };\n\n  // Parses a comma-separated list of module exports.\n\n  pp$8.parseExportSpecifier = function(exports$1) {\n    var node = this.startNode();\n    node.local = this.parseModuleExportName();\n\n    node.exported = this.eatContextual(\"as\") ? this.parseModuleExportName() : node.local;\n    this.checkExport(\n      exports$1,\n      node.exported,\n      node.exported.start\n    );\n\n    return this.finishNode(node, \"ExportSpecifier\")\n  };\n\n  pp$8.parseExportSpecifiers = function(exports$1) {\n    var nodes = [], first = true;\n    // export { x, y as z } [from '...']\n    this.expect(types$1.braceL);\n    while (!this.eat(types$1.braceR)) {\n      if (!first) {\n        this.expect(types$1.comma);\n        if (this.afterTrailingComma(types$1.braceR)) { break }\n      } else { first = false; }\n\n      nodes.push(this.parseExportSpecifier(exports$1));\n    }\n    return nodes\n  };\n\n  // Parses import declaration.\n\n  pp$8.parseImport = function(node) {\n    this.next();\n\n    // import '...'\n    if (this.type === types$1.string) {\n      node.specifiers = empty$1;\n      node.source = this.parseExprAtom();\n    } else {\n      node.specifiers = this.parseImportSpecifiers();\n      this.expectContextual(\"from\");\n      node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();\n    }\n    if (this.options.ecmaVersion >= 16)\n      { node.attributes = this.parseWithClause(); }\n    this.semicolon();\n    return this.finishNode(node, \"ImportDeclaration\")\n  };\n\n  // Parses a comma-separated list of module imports.\n\n  pp$8.parseImportSpecifier = function() {\n    var node = this.startNode();\n    node.imported = this.parseModuleExportName();\n\n    if (this.eatContextual(\"as\")) {\n      node.local = this.parseIdent();\n    } else {\n      this.checkUnreserved(node.imported);\n      node.local = node.imported;\n    }\n    this.checkLValSimple(node.local, BIND_LEXICAL);\n\n    return this.finishNode(node, \"ImportSpecifier\")\n  };\n\n  pp$8.parseImportDefaultSpecifier = function() {\n    // import defaultObj, { x, y as z } from '...'\n    var node = this.startNode();\n    node.local = this.parseIdent();\n    this.checkLValSimple(node.local, BIND_LEXICAL);\n    return this.finishNode(node, \"ImportDefaultSpecifier\")\n  };\n\n  pp$8.parseImportNamespaceSpecifier = function() {\n    var node = this.startNode();\n    this.next();\n    this.expectContextual(\"as\");\n    node.local = this.parseIdent();\n    this.checkLValSimple(node.local, BIND_LEXICAL);\n    return this.finishNode(node, \"ImportNamespaceSpecifier\")\n  };\n\n  pp$8.parseImportSpecifiers = function() {\n    var nodes = [], first = true;\n    if (this.type === types$1.name) {\n      nodes.push(this.parseImportDefaultSpecifier());\n      if (!this.eat(types$1.comma)) { return nodes }\n    }\n    if (this.type === types$1.star) {\n      nodes.push(this.parseImportNamespaceSpecifier());\n      return nodes\n    }\n    this.expect(types$1.braceL);\n    while (!this.eat(types$1.braceR)) {\n      if (!first) {\n        this.expect(types$1.comma);\n        if (this.afterTrailingComma(types$1.braceR)) { break }\n      } else { first = false; }\n\n      nodes.push(this.parseImportSpecifier());\n    }\n    return nodes\n  };\n\n  pp$8.parseWithClause = function() {\n    var nodes = [];\n    if (!this.eat(types$1._with)) {\n      return nodes\n    }\n    this.expect(types$1.braceL);\n    var attributeKeys = {};\n    var first = true;\n    while (!this.eat(types$1.braceR)) {\n      if (!first) {\n        this.expect(types$1.comma);\n        if (this.afterTrailingComma(types$1.braceR)) { break }\n      } else { first = false; }\n\n      var attr = this.parseImportAttribute();\n      var keyName = attr.key.type === \"Identifier\" ? attr.key.name : attr.key.value;\n      if (hasOwn(attributeKeys, keyName))\n        { this.raiseRecoverable(attr.key.start, \"Duplicate attribute key '\" + keyName + \"'\"); }\n      attributeKeys[keyName] = true;\n      nodes.push(attr);\n    }\n    return nodes\n  };\n\n  pp$8.parseImportAttribute = function() {\n    var node = this.startNode();\n    node.key = this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== \"never\");\n    this.expect(types$1.colon);\n    if (this.type !== types$1.string) {\n      this.unexpected();\n    }\n    node.value = this.parseExprAtom();\n    return this.finishNode(node, \"ImportAttribute\")\n  };\n\n  pp$8.parseModuleExportName = function() {\n    if (this.options.ecmaVersion >= 13 && this.type === types$1.string) {\n      var stringLiteral = this.parseLiteral(this.value);\n      if (loneSurrogate.test(stringLiteral.value)) {\n        this.raise(stringLiteral.start, \"An export name cannot include a lone surrogate.\");\n      }\n      return stringLiteral\n    }\n    return this.parseIdent(true)\n  };\n\n  // Set `ExpressionStatement#directive` property for directive prologues.\n  pp$8.adaptDirectivePrologue = function(statements) {\n    for (var i = 0; i < statements.length && this.isDirectiveCandidate(statements[i]); ++i) {\n      statements[i].directive = statements[i].expression.raw.slice(1, -1);\n    }\n  };\n  pp$8.isDirectiveCandidate = function(statement) {\n    return (\n      this.options.ecmaVersion >= 5 &&\n      statement.type === \"ExpressionStatement\" &&\n      statement.expression.type === \"Literal\" &&\n      typeof statement.expression.value === \"string\" &&\n      // Reject parenthesized strings.\n      (this.input[statement.start] === \"\\\"\" || this.input[statement.start] === \"'\")\n    )\n  };\n\n  var pp$7 = Parser.prototype;\n\n  // Convert existing expression atom to assignable pattern\n  // if possible.\n\n  pp$7.toAssignable = function(node, isBinding, refDestructuringErrors) {\n    if (this.options.ecmaVersion >= 6 && node) {\n      switch (node.type) {\n      case \"Identifier\":\n        if (this.inAsync && node.name === \"await\")\n          { this.raise(node.start, \"Cannot use 'await' as identifier inside an async function\"); }\n        break\n\n      case \"ObjectPattern\":\n      case \"ArrayPattern\":\n      case \"AssignmentPattern\":\n      case \"RestElement\":\n        break\n\n      case \"ObjectExpression\":\n        node.type = \"ObjectPattern\";\n        if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }\n        for (var i = 0, list = node.properties; i < list.length; i += 1) {\n          var prop = list[i];\n\n        this.toAssignable(prop, isBinding);\n          // Early error:\n          //   AssignmentRestProperty[Yield, Await] :\n          //     `...` DestructuringAssignmentTarget[Yield, Await]\n          //\n          //   It is a Syntax Error if |DestructuringAssignmentTarget| is an |ArrayLiteral| or an |ObjectLiteral|.\n          if (\n            prop.type === \"RestElement\" &&\n            (prop.argument.type === \"ArrayPattern\" || prop.argument.type === \"ObjectPattern\")\n          ) {\n            this.raise(prop.argument.start, \"Unexpected token\");\n          }\n        }\n        break\n\n      case \"Property\":\n        // AssignmentProperty has type === \"Property\"\n        if (node.kind !== \"init\") { this.raise(node.key.start, \"Object pattern can't contain getter or setter\"); }\n        this.toAssignable(node.value, isBinding);\n        break\n\n      case \"ArrayExpression\":\n        node.type = \"ArrayPattern\";\n        if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }\n        this.toAssignableList(node.elements, isBinding);\n        break\n\n      case \"SpreadElement\":\n        node.type = \"RestElement\";\n        this.toAssignable(node.argument, isBinding);\n        if (node.argument.type === \"AssignmentPattern\")\n          { this.raise(node.argument.start, \"Rest elements cannot have a default value\"); }\n        break\n\n      case \"AssignmentExpression\":\n        if (node.operator !== \"=\") { this.raise(node.left.end, \"Only '=' operator can be used for specifying default value.\"); }\n        node.type = \"AssignmentPattern\";\n        delete node.operator;\n        this.toAssignable(node.left, isBinding);\n        break\n\n      case \"ParenthesizedExpression\":\n        this.toAssignable(node.expression, isBinding, refDestructuringErrors);\n        break\n\n      case \"ChainExpression\":\n        this.raiseRecoverable(node.start, \"Optional chaining cannot appear in left-hand side\");\n        break\n\n      case \"MemberExpression\":\n        if (!isBinding) { break }\n\n      default:\n        this.raise(node.start, \"Assigning to rvalue\");\n      }\n    } else if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }\n    return node\n  };\n\n  // Convert list of expression atoms to binding list.\n\n  pp$7.toAssignableList = function(exprList, isBinding) {\n    var end = exprList.length;\n    for (var i = 0; i < end; i++) {\n      var elt = exprList[i];\n      if (elt) { this.toAssignable(elt, isBinding); }\n    }\n    if (end) {\n      var last = exprList[end - 1];\n      if (this.options.ecmaVersion === 6 && isBinding && last && last.type === \"RestElement\" && last.argument.type !== \"Identifier\")\n        { this.unexpected(last.argument.start); }\n    }\n    return exprList\n  };\n\n  // Parses spread element.\n\n  pp$7.parseSpread = function(refDestructuringErrors) {\n    var node = this.startNode();\n    this.next();\n    node.argument = this.parseMaybeAssign(false, refDestructuringErrors);\n    return this.finishNode(node, \"SpreadElement\")\n  };\n\n  pp$7.parseRestBinding = function() {\n    var node = this.startNode();\n    this.next();\n\n    // RestElement inside of a function parameter must be an identifier\n    if (this.options.ecmaVersion === 6 && this.type !== types$1.name)\n      { this.unexpected(); }\n\n    node.argument = this.parseBindingAtom();\n\n    return this.finishNode(node, \"RestElement\")\n  };\n\n  // Parses lvalue (assignable) atom.\n\n  pp$7.parseBindingAtom = function() {\n    if (this.options.ecmaVersion >= 6) {\n      switch (this.type) {\n      case types$1.bracketL:\n        var node = this.startNode();\n        this.next();\n        node.elements = this.parseBindingList(types$1.bracketR, true, true);\n        return this.finishNode(node, \"ArrayPattern\")\n\n      case types$1.braceL:\n        return this.parseObj(true)\n      }\n    }\n    return this.parseIdent()\n  };\n\n  pp$7.parseBindingList = function(close, allowEmpty, allowTrailingComma, allowModifiers) {\n    var elts = [], first = true;\n    while (!this.eat(close)) {\n      if (first) { first = false; }\n      else { this.expect(types$1.comma); }\n      if (allowEmpty && this.type === types$1.comma) {\n        elts.push(null);\n      } else if (allowTrailingComma && this.afterTrailingComma(close)) {\n        break\n      } else if (this.type === types$1.ellipsis) {\n        var rest = this.parseRestBinding();\n        this.parseBindingListItem(rest);\n        elts.push(rest);\n        if (this.type === types$1.comma) { this.raiseRecoverable(this.start, \"Comma is not permitted after the rest element\"); }\n        this.expect(close);\n        break\n      } else {\n        elts.push(this.parseAssignableListItem(allowModifiers));\n      }\n    }\n    return elts\n  };\n\n  pp$7.parseAssignableListItem = function(allowModifiers) {\n    var elem = this.parseMaybeDefault(this.start, this.startLoc);\n    this.parseBindingListItem(elem);\n    return elem\n  };\n\n  pp$7.parseBindingListItem = function(param) {\n    return param\n  };\n\n  // Parses assignment pattern around given atom if possible.\n\n  pp$7.parseMaybeDefault = function(startPos, startLoc, left) {\n    left = left || this.parseBindingAtom();\n    if (this.options.ecmaVersion < 6 || !this.eat(types$1.eq)) { return left }\n    var node = this.startNodeAt(startPos, startLoc);\n    node.left = left;\n    node.right = this.parseMaybeAssign();\n    return this.finishNode(node, \"AssignmentPattern\")\n  };\n\n  // The following three functions all verify that a node is an lvalue —\n  // something that can be bound, or assigned to. In order to do so, they perform\n  // a variety of checks:\n  //\n  // - Check that none of the bound/assigned-to identifiers are reserved words.\n  // - Record name declarations for bindings in the appropriate scope.\n  // - Check duplicate argument names, if checkClashes is set.\n  //\n  // If a complex binding pattern is encountered (e.g., object and array\n  // destructuring), the entire pattern is recursively checked.\n  //\n  // There are three versions of checkLVal*() appropriate for different\n  // circumstances:\n  //\n  // - checkLValSimple() shall be used if the syntactic construct supports\n  //   nothing other than identifiers and member expressions. Parenthesized\n  //   expressions are also correctly handled. This is generally appropriate for\n  //   constructs for which the spec says\n  //\n  //   > It is a Syntax Error if AssignmentTargetType of [the production] is not\n  //   > simple.\n  //\n  //   It is also appropriate for checking if an identifier is valid and not\n  //   defined elsewhere, like import declarations or function/class identifiers.\n  //\n  //   Examples where this is used include:\n  //     a += …;\n  //     import a from '…';\n  //   where a is the node to be checked.\n  //\n  // - checkLValPattern() shall be used if the syntactic construct supports\n  //   anything checkLValSimple() supports, as well as object and array\n  //   destructuring patterns. This is generally appropriate for constructs for\n  //   which the spec says\n  //\n  //   > It is a Syntax Error if [the production] is neither an ObjectLiteral nor\n  //   > an ArrayLiteral and AssignmentTargetType of [the production] is not\n  //   > simple.\n  //\n  //   Examples where this is used include:\n  //     (a = …);\n  //     const a = …;\n  //     try { … } catch (a) { … }\n  //   where a is the node to be checked.\n  //\n  // - checkLValInnerPattern() shall be used if the syntactic construct supports\n  //   anything checkLValPattern() supports, as well as default assignment\n  //   patterns, rest elements, and other constructs that may appear within an\n  //   object or array destructuring pattern.\n  //\n  //   As a special case, function parameters also use checkLValInnerPattern(),\n  //   as they also support defaults and rest constructs.\n  //\n  // These functions deliberately support both assignment and binding constructs,\n  // as the logic for both is exceedingly similar. If the node is the target of\n  // an assignment, then bindingType should be set to BIND_NONE. Otherwise, it\n  // should be set to the appropriate BIND_* constant, like BIND_VAR or\n  // BIND_LEXICAL.\n  //\n  // If the function is called with a non-BIND_NONE bindingType, then\n  // additionally a checkClashes object may be specified to allow checking for\n  // duplicate argument names. checkClashes is ignored if the provided construct\n  // is an assignment (i.e., bindingType is BIND_NONE).\n\n  pp$7.checkLValSimple = function(expr, bindingType, checkClashes) {\n    if ( bindingType === void 0 ) bindingType = BIND_NONE;\n\n    var isBind = bindingType !== BIND_NONE;\n\n    switch (expr.type) {\n    case \"Identifier\":\n      if (this.strict && this.reservedWordsStrictBind.test(expr.name))\n        { this.raiseRecoverable(expr.start, (isBind ? \"Binding \" : \"Assigning to \") + expr.name + \" in strict mode\"); }\n      if (isBind) {\n        if (bindingType === BIND_LEXICAL && expr.name === \"let\")\n          { this.raiseRecoverable(expr.start, \"let is disallowed as a lexically bound name\"); }\n        if (checkClashes) {\n          if (hasOwn(checkClashes, expr.name))\n            { this.raiseRecoverable(expr.start, \"Argument name clash\"); }\n          checkClashes[expr.name] = true;\n        }\n        if (bindingType !== BIND_OUTSIDE) { this.declareName(expr.name, bindingType, expr.start); }\n      }\n      break\n\n    case \"ChainExpression\":\n      this.raiseRecoverable(expr.start, \"Optional chaining cannot appear in left-hand side\");\n      break\n\n    case \"MemberExpression\":\n      if (isBind) { this.raiseRecoverable(expr.start, \"Binding member expression\"); }\n      break\n\n    case \"ParenthesizedExpression\":\n      if (isBind) { this.raiseRecoverable(expr.start, \"Binding parenthesized expression\"); }\n      return this.checkLValSimple(expr.expression, bindingType, checkClashes)\n\n    default:\n      this.raise(expr.start, (isBind ? \"Binding\" : \"Assigning to\") + \" rvalue\");\n    }\n  };\n\n  pp$7.checkLValPattern = function(expr, bindingType, checkClashes) {\n    if ( bindingType === void 0 ) bindingType = BIND_NONE;\n\n    switch (expr.type) {\n    case \"ObjectPattern\":\n      for (var i = 0, list = expr.properties; i < list.length; i += 1) {\n        var prop = list[i];\n\n      this.checkLValInnerPattern(prop, bindingType, checkClashes);\n      }\n      break\n\n    case \"ArrayPattern\":\n      for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {\n        var elem = list$1[i$1];\n\n      if (elem) { this.checkLValInnerPattern(elem, bindingType, checkClashes); }\n      }\n      break\n\n    default:\n      this.checkLValSimple(expr, bindingType, checkClashes);\n    }\n  };\n\n  pp$7.checkLValInnerPattern = function(expr, bindingType, checkClashes) {\n    if ( bindingType === void 0 ) bindingType = BIND_NONE;\n\n    switch (expr.type) {\n    case \"Property\":\n      // AssignmentProperty has type === \"Property\"\n      this.checkLValInnerPattern(expr.value, bindingType, checkClashes);\n      break\n\n    case \"AssignmentPattern\":\n      this.checkLValPattern(expr.left, bindingType, checkClashes);\n      break\n\n    case \"RestElement\":\n      this.checkLValPattern(expr.argument, bindingType, checkClashes);\n      break\n\n    default:\n      this.checkLValPattern(expr, bindingType, checkClashes);\n    }\n  };\n\n  // The algorithm used to determine whether a regexp can appear at a\n  // given point in the program is loosely based on sweet.js' approach.\n  // See https://github.com/mozilla/sweet.js/wiki/design\n\n\n  var TokContext = function TokContext(token, isExpr, preserveSpace, override, generator) {\n    this.token = token;\n    this.isExpr = !!isExpr;\n    this.preserveSpace = !!preserveSpace;\n    this.override = override;\n    this.generator = !!generator;\n  };\n\n  var types = {\n    b_stat: new TokContext(\"{\", false),\n    b_expr: new TokContext(\"{\", true),\n    b_tmpl: new TokContext(\"${\", false),\n    p_stat: new TokContext(\"(\", false),\n    p_expr: new TokContext(\"(\", true),\n    q_tmpl: new TokContext(\"`\", true, true, function (p) { return p.tryReadTemplateToken(); }),\n    f_stat: new TokContext(\"function\", false),\n    f_expr: new TokContext(\"function\", true),\n    f_expr_gen: new TokContext(\"function\", true, false, null, true),\n    f_gen: new TokContext(\"function\", false, false, null, true)\n  };\n\n  var pp$6 = Parser.prototype;\n\n  pp$6.initialContext = function() {\n    return [types.b_stat]\n  };\n\n  pp$6.curContext = function() {\n    return this.context[this.context.length - 1]\n  };\n\n  pp$6.braceIsBlock = function(prevType) {\n    var parent = this.curContext();\n    if (parent === types.f_expr || parent === types.f_stat)\n      { return true }\n    if (prevType === types$1.colon && (parent === types.b_stat || parent === types.b_expr))\n      { return !parent.isExpr }\n\n    // The check for `tt.name && exprAllowed` detects whether we are\n    // after a `yield` or `of` construct. See the `updateContext` for\n    // `tt.name`.\n    if (prevType === types$1._return || prevType === types$1.name && this.exprAllowed)\n      { return lineBreak.test(this.input.slice(this.lastTokEnd, this.start)) }\n    if (prevType === types$1._else || prevType === types$1.semi || prevType === types$1.eof || prevType === types$1.parenR || prevType === types$1.arrow)\n      { return true }\n    if (prevType === types$1.braceL)\n      { return parent === types.b_stat }\n    if (prevType === types$1._var || prevType === types$1._const || prevType === types$1.name)\n      { return false }\n    return !this.exprAllowed\n  };\n\n  pp$6.inGeneratorContext = function() {\n    for (var i = this.context.length - 1; i >= 1; i--) {\n      var context = this.context[i];\n      if (context.token === \"function\")\n        { return context.generator }\n    }\n    return false\n  };\n\n  pp$6.updateContext = function(prevType) {\n    var update, type = this.type;\n    if (type.keyword && prevType === types$1.dot)\n      { this.exprAllowed = false; }\n    else if (update = type.updateContext)\n      { update.call(this, prevType); }\n    else\n      { this.exprAllowed = type.beforeExpr; }\n  };\n\n  // Used to handle edge cases when token context could not be inferred correctly during tokenization phase\n\n  pp$6.overrideContext = function(tokenCtx) {\n    if (this.curContext() !== tokenCtx) {\n      this.context[this.context.length - 1] = tokenCtx;\n    }\n  };\n\n  // Token-specific context update code\n\n  types$1.parenR.updateContext = types$1.braceR.updateContext = function() {\n    if (this.context.length === 1) {\n      this.exprAllowed = true;\n      return\n    }\n    var out = this.context.pop();\n    if (out === types.b_stat && this.curContext().token === \"function\") {\n      out = this.context.pop();\n    }\n    this.exprAllowed = !out.isExpr;\n  };\n\n  types$1.braceL.updateContext = function(prevType) {\n    this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);\n    this.exprAllowed = true;\n  };\n\n  types$1.dollarBraceL.updateContext = function() {\n    this.context.push(types.b_tmpl);\n    this.exprAllowed = true;\n  };\n\n  types$1.parenL.updateContext = function(prevType) {\n    var statementParens = prevType === types$1._if || prevType === types$1._for || prevType === types$1._with || prevType === types$1._while;\n    this.context.push(statementParens ? types.p_stat : types.p_expr);\n    this.exprAllowed = true;\n  };\n\n  types$1.incDec.updateContext = function() {\n    // tokExprAllowed stays unchanged\n  };\n\n  types$1._function.updateContext = types$1._class.updateContext = function(prevType) {\n    if (prevType.beforeExpr && prevType !== types$1._else &&\n        !(prevType === types$1.semi && this.curContext() !== types.p_stat) &&\n        !(prevType === types$1._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) &&\n        !((prevType === types$1.colon || prevType === types$1.braceL) && this.curContext() === types.b_stat))\n      { this.context.push(types.f_expr); }\n    else\n      { this.context.push(types.f_stat); }\n    this.exprAllowed = false;\n  };\n\n  types$1.colon.updateContext = function() {\n    if (this.curContext().token === \"function\") { this.context.pop(); }\n    this.exprAllowed = true;\n  };\n\n  types$1.backQuote.updateContext = function() {\n    if (this.curContext() === types.q_tmpl)\n      { this.context.pop(); }\n    else\n      { this.context.push(types.q_tmpl); }\n    this.exprAllowed = false;\n  };\n\n  types$1.star.updateContext = function(prevType) {\n    if (prevType === types$1._function) {\n      var index = this.context.length - 1;\n      if (this.context[index] === types.f_expr)\n        { this.context[index] = types.f_expr_gen; }\n      else\n        { this.context[index] = types.f_gen; }\n    }\n    this.exprAllowed = true;\n  };\n\n  types$1.name.updateContext = function(prevType) {\n    var allowed = false;\n    if (this.options.ecmaVersion >= 6 && prevType !== types$1.dot) {\n      if (this.value === \"of\" && !this.exprAllowed ||\n          this.value === \"yield\" && this.inGeneratorContext())\n        { allowed = true; }\n    }\n    this.exprAllowed = allowed;\n  };\n\n  // A recursive descent parser operates by defining functions for all\n  // syntactic elements, and recursively calling those, each function\n  // advancing the input stream and returning an AST node. Precedence\n  // of constructs (for example, the fact that `!x[1]` means `!(x[1])`\n  // instead of `(!x)[1]` is handled by the fact that the parser\n  // function that parses unary prefix operators is called first, and\n  // in turn calls the function that parses `[]` subscripts — that\n  // way, it'll receive the node for `x[1]` already parsed, and wraps\n  // *that* in the unary operator node.\n  //\n  // Acorn uses an [operator precedence parser][opp] to handle binary\n  // operator precedence, because it is much more compact than using\n  // the technique outlined above, which uses different, nesting\n  // functions to specify precedence, for all of the ten binary\n  // precedence levels that JavaScript defines.\n  //\n  // [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser\n\n\n  var pp$5 = Parser.prototype;\n\n  // Check if property name clashes with already added.\n  // Object/class getters and setters are not allowed to clash —\n  // either with each other or with an init property — and in\n  // strict mode, init properties are also not allowed to be repeated.\n\n  pp$5.checkPropClash = function(prop, propHash, refDestructuringErrors) {\n    if (this.options.ecmaVersion >= 9 && prop.type === \"SpreadElement\")\n      { return }\n    if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))\n      { return }\n    var key = prop.key;\n    var name;\n    switch (key.type) {\n    case \"Identifier\": name = key.name; break\n    case \"Literal\": name = String(key.value); break\n    default: return\n    }\n    var kind = prop.kind;\n    if (this.options.ecmaVersion >= 6) {\n      if (name === \"__proto__\" && kind === \"init\") {\n        if (propHash.proto) {\n          if (refDestructuringErrors) {\n            if (refDestructuringErrors.doubleProto < 0) {\n              refDestructuringErrors.doubleProto = key.start;\n            }\n          } else {\n            this.raiseRecoverable(key.start, \"Redefinition of __proto__ property\");\n          }\n        }\n        propHash.proto = true;\n      }\n      return\n    }\n    name = \"$\" + name;\n    var other = propHash[name];\n    if (other) {\n      var redefinition;\n      if (kind === \"init\") {\n        redefinition = this.strict && other.init || other.get || other.set;\n      } else {\n        redefinition = other.init || other[kind];\n      }\n      if (redefinition)\n        { this.raiseRecoverable(key.start, \"Redefinition of property\"); }\n    } else {\n      other = propHash[name] = {\n        init: false,\n        get: false,\n        set: false\n      };\n    }\n    other[kind] = true;\n  };\n\n  // ### Expression parsing\n\n  // These nest, from the most general expression type at the top to\n  // 'atomic', nondivisible expression types at the bottom. Most of\n  // the functions will simply let the function(s) below them parse,\n  // and, *if* the syntactic construct they handle is present, wrap\n  // the AST node that the inner parser gave them in another node.\n\n  // Parse a full expression. The optional arguments are used to\n  // forbid the `in` operator (in for loops initalization expressions)\n  // and provide reference for storing '=' operator inside shorthand\n  // property assignment in contexts where both object expression\n  // and object pattern might appear (so it's possible to raise\n  // delayed syntax error at correct position).\n\n  pp$5.parseExpression = function(forInit, refDestructuringErrors) {\n    var this$1$1 = this;\n\n    return this.catchStackOverflow(function () {\n      var startPos = this$1$1.start, startLoc = this$1$1.startLoc;\n      var expr = this$1$1.parseMaybeAssign(forInit, refDestructuringErrors);\n      if (this$1$1.type === types$1.comma) {\n        var node = this$1$1.startNodeAt(startPos, startLoc);\n        node.expressions = [expr];\n        while (this$1$1.eat(types$1.comma)) { node.expressions.push(this$1$1.parseMaybeAssign(forInit, refDestructuringErrors)); }\n        return this$1$1.finishNode(node, \"SequenceExpression\")\n      }\n      return expr\n    })\n  };\n\n  // Parse an assignment expression. This includes applications of\n  // operators like `+=`.\n\n  pp$5.parseMaybeAssign = function(forInit, refDestructuringErrors, afterLeftParse) {\n    if (this.isContextual(\"yield\")) {\n      if (this.inGenerator) { return this.parseYield(forInit) }\n      // The tokenizer will assume an expression is allowed after\n      // `yield`, but this isn't that kind of yield\n      else { this.exprAllowed = false; }\n    }\n\n    var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;\n    if (refDestructuringErrors) {\n      oldParenAssign = refDestructuringErrors.parenthesizedAssign;\n      oldTrailingComma = refDestructuringErrors.trailingComma;\n      oldDoubleProto = refDestructuringErrors.doubleProto;\n      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;\n    } else {\n      refDestructuringErrors = new DestructuringErrors;\n      ownDestructuringErrors = true;\n    }\n\n    var startPos = this.start, startLoc = this.startLoc;\n    if (this.type === types$1.parenL || this.type === types$1.name) {\n      this.potentialArrowAt = this.start;\n      this.potentialArrowInForAwait = forInit === \"await\";\n    }\n    var left = this.parseMaybeConditional(forInit, refDestructuringErrors);\n    if (afterLeftParse) { left = afterLeftParse.call(this, left, startPos, startLoc); }\n    if (this.type.isAssign) {\n      var node = this.startNodeAt(startPos, startLoc);\n      node.operator = this.value;\n      if (this.type === types$1.eq)\n        { left = this.toAssignable(left, false, refDestructuringErrors); }\n      if (!ownDestructuringErrors) {\n        refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;\n      }\n      if (refDestructuringErrors.shorthandAssign >= left.start)\n        { refDestructuringErrors.shorthandAssign = -1; } // reset because shorthand default was used correctly\n      if (this.type === types$1.eq)\n        { this.checkLValPattern(left); }\n      else\n        { this.checkLValSimple(left); }\n      node.left = left;\n      this.next();\n      node.right = this.parseMaybeAssign(forInit);\n      if (oldDoubleProto > -1) { refDestructuringErrors.doubleProto = oldDoubleProto; }\n      return this.finishNode(node, \"AssignmentExpression\")\n    } else {\n      if (ownDestructuringErrors) { this.checkExpressionErrors(refDestructuringErrors, true); }\n    }\n    if (oldParenAssign > -1) { refDestructuringErrors.parenthesizedAssign = oldParenAssign; }\n    if (oldTrailingComma > -1) { refDestructuringErrors.trailingComma = oldTrailingComma; }\n    return left\n  };\n\n  // Parse a ternary conditional (`?:`) operator.\n\n  pp$5.parseMaybeConditional = function(forInit, refDestructuringErrors) {\n    var startPos = this.start, startLoc = this.startLoc;\n    var expr = this.parseExprOps(forInit, refDestructuringErrors);\n    if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }\n    if (!(expr.type === \"ArrowFunctionExpression\" && expr.start === startPos) && this.eat(types$1.question)) {\n      var node = this.startNodeAt(startPos, startLoc);\n      node.test = expr;\n      node.consequent = this.parseMaybeAssign();\n      this.expect(types$1.colon);\n      node.alternate = this.parseMaybeAssign(forInit);\n      return this.finishNode(node, \"ConditionalExpression\")\n    }\n    return expr\n  };\n\n  // Start the precedence parser.\n\n  pp$5.parseExprOps = function(forInit, refDestructuringErrors) {\n    var startPos = this.start, startLoc = this.startLoc;\n    var expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit);\n    if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }\n    return expr.start === startPos && expr.type === \"ArrowFunctionExpression\" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit)\n  };\n\n  // Parse binary operators with the operator precedence parsing\n  // algorithm. `left` is the left-hand side of the operator.\n  // `minPrec` provides context that allows the function to stop and\n  // defer further parser to one of its callers when it encounters an\n  // operator that has a lower precedence than the set it is parsing.\n\n  pp$5.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, forInit) {\n    var prec = this.type.binop;\n    if (prec != null && (!forInit || this.type !== types$1._in)) {\n      if (prec > minPrec) {\n        var logical = this.type === types$1.logicalOR || this.type === types$1.logicalAND;\n        var coalesce = this.type === types$1.coalesce;\n        if (coalesce) {\n          // Handle the precedence of `tt.coalesce` as equal to the range of logical expressions.\n          // In other words, `node.right` shouldn't contain logical expressions in order to check the mixed error.\n          prec = types$1.logicalAND.binop;\n        }\n        var op = this.value;\n        this.next();\n        var startPos = this.start, startLoc = this.startLoc;\n        var right = this.parseExprOp(this.parseMaybeUnary(null, false, false, forInit), startPos, startLoc, prec, forInit);\n        var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);\n        if ((logical && this.type === types$1.coalesce) || (coalesce && (this.type === types$1.logicalOR || this.type === types$1.logicalAND))) {\n          this.raiseRecoverable(this.start, \"Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses\");\n        }\n        return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit)\n      }\n    }\n    return left\n  };\n\n  pp$5.buildBinary = function(startPos, startLoc, left, right, op, logical) {\n    if (right.type === \"PrivateIdentifier\") { this.raise(right.start, \"Private identifier can only be left side of binary expression\"); }\n    var node = this.startNodeAt(startPos, startLoc);\n    node.left = left;\n    node.operator = op;\n    node.right = right;\n    return this.finishNode(node, logical ? \"LogicalExpression\" : \"BinaryExpression\")\n  };\n\n  // Parse unary operators, both prefix and postfix.\n\n  pp$5.parseMaybeUnary = function(refDestructuringErrors, sawUnary, incDec, forInit) {\n    var startPos = this.start, startLoc = this.startLoc, expr;\n    if (this.isContextual(\"await\") && this.canAwait) {\n      expr = this.parseAwait(forInit);\n      sawUnary = true;\n    } else if (this.type.prefix) {\n      var node = this.startNode(), update = this.type === types$1.incDec;\n      node.operator = this.value;\n      node.prefix = true;\n      this.next();\n      node.argument = this.parseMaybeUnary(null, true, update, forInit);\n      this.checkExpressionErrors(refDestructuringErrors, true);\n      if (update) { this.checkLValSimple(node.argument); }\n      else if (this.strict && node.operator === \"delete\" && isLocalVariableAccess(node.argument))\n        { this.raiseRecoverable(node.start, \"Deleting local variable in strict mode\"); }\n      else if (node.operator === \"delete\" && isPrivateFieldAccess(node.argument))\n        { this.raiseRecoverable(node.start, \"Private fields can not be deleted\"); }\n      else { sawUnary = true; }\n      expr = this.finishNode(node, update ? \"UpdateExpression\" : \"UnaryExpression\");\n    } else if (!sawUnary && this.type === types$1.privateId) {\n      if ((forInit || this.privateNameStack.length === 0) && this.options.checkPrivateFields) { this.unexpected(); }\n      expr = this.parsePrivateIdent();\n      // only could be private fields in 'in', such as #x in obj\n      if (this.type !== types$1._in) { this.unexpected(); }\n    } else {\n      expr = this.parseExprSubscripts(refDestructuringErrors, forInit);\n      if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }\n      while (this.type.postfix && !this.canInsertSemicolon()) {\n        var node$1 = this.startNodeAt(startPos, startLoc);\n        node$1.operator = this.value;\n        node$1.prefix = false;\n        node$1.argument = expr;\n        this.checkLValSimple(expr);\n        this.next();\n        expr = this.finishNode(node$1, \"UpdateExpression\");\n      }\n    }\n\n    if (!incDec && this.eat(types$1.starstar)) {\n      if (sawUnary)\n        { this.unexpected(this.lastTokStart); }\n      else\n        { return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false, false, forInit), \"**\", false) }\n    } else {\n      return expr\n    }\n  };\n\n  function isLocalVariableAccess(node) {\n    return (\n      node.type === \"Identifier\" ||\n      node.type === \"ParenthesizedExpression\" && isLocalVariableAccess(node.expression)\n    )\n  }\n\n  function isPrivateFieldAccess(node) {\n    return (\n      node.type === \"MemberExpression\" && node.property.type === \"PrivateIdentifier\" ||\n      node.type === \"ChainExpression\" && isPrivateFieldAccess(node.expression) ||\n      node.type === \"ParenthesizedExpression\" && isPrivateFieldAccess(node.expression)\n    )\n  }\n\n  // Parse call, dot, and `[]`-subscript expressions.\n\n  pp$5.parseExprSubscripts = function(refDestructuringErrors, forInit) {\n    var startPos = this.start, startLoc = this.startLoc;\n    var expr = this.parseExprAtom(refDestructuringErrors, forInit);\n    if (expr.type === \"ArrowFunctionExpression\" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== \")\")\n      { return expr }\n    var result = this.parseSubscripts(expr, startPos, startLoc, false, forInit);\n    if (refDestructuringErrors && result.type === \"MemberExpression\") {\n      if (refDestructuringErrors.parenthesizedAssign >= result.start) { refDestructuringErrors.parenthesizedAssign = -1; }\n      if (refDestructuringErrors.parenthesizedBind >= result.start) { refDestructuringErrors.parenthesizedBind = -1; }\n      if (refDestructuringErrors.trailingComma >= result.start) { refDestructuringErrors.trailingComma = -1; }\n    }\n    return result\n  };\n\n  pp$5.parseSubscripts = function(base, startPos, startLoc, noCalls, forInit) {\n    var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === \"Identifier\" && base.name === \"async\" &&\n        this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 &&\n        this.potentialArrowAt === base.start;\n    var optionalChained = false;\n\n    while (true) {\n      var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);\n\n      if (element.optional) { optionalChained = true; }\n      if (element === base || element.type === \"ArrowFunctionExpression\") {\n        if (optionalChained) {\n          var chainNode = this.startNodeAt(startPos, startLoc);\n          chainNode.expression = element;\n          element = this.finishNode(chainNode, \"ChainExpression\");\n        }\n        return element\n      }\n\n      base = element;\n    }\n  };\n\n  pp$5.shouldParseAsyncArrow = function() {\n    return !this.canInsertSemicolon() && this.eat(types$1.arrow)\n  };\n\n  pp$5.parseSubscriptAsyncArrow = function(startPos, startLoc, exprList, forInit) {\n    return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true, forInit)\n  };\n\n  pp$5.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {\n    var optionalSupported = this.options.ecmaVersion >= 11;\n    var optional = optionalSupported && this.eat(types$1.questionDot);\n    if (noCalls && optional) { this.raise(this.lastTokStart, \"Optional chaining cannot appear in the callee of new expressions\"); }\n\n    var computed = this.eat(types$1.bracketL);\n    if (computed || (optional && this.type !== types$1.parenL && this.type !== types$1.backQuote) || this.eat(types$1.dot)) {\n      var node = this.startNodeAt(startPos, startLoc);\n      node.object = base;\n      if (computed) {\n        node.property = this.parseExpression();\n        this.expect(types$1.bracketR);\n      } else if (this.type === types$1.privateId && base.type !== \"Super\") {\n        node.property = this.parsePrivateIdent();\n      } else {\n        node.property = this.parseIdent(this.options.allowReserved !== \"never\");\n      }\n      node.computed = !!computed;\n      if (optionalSupported) {\n        node.optional = optional;\n      }\n      base = this.finishNode(node, \"MemberExpression\");\n    } else if (!noCalls && this.eat(types$1.parenL)) {\n      var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;\n      this.yieldPos = 0;\n      this.awaitPos = 0;\n      this.awaitIdentPos = 0;\n      var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);\n      if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {\n        this.checkPatternErrors(refDestructuringErrors, false);\n        this.checkYieldAwaitInDefaultParams();\n        if (this.awaitIdentPos > 0)\n          { this.raise(this.awaitIdentPos, \"Cannot use 'await' as identifier inside an async function\"); }\n        this.yieldPos = oldYieldPos;\n        this.awaitPos = oldAwaitPos;\n        this.awaitIdentPos = oldAwaitIdentPos;\n        return this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit)\n      }\n      this.checkExpressionErrors(refDestructuringErrors, true);\n      this.yieldPos = oldYieldPos || this.yieldPos;\n      this.awaitPos = oldAwaitPos || this.awaitPos;\n      this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;\n      var node$1 = this.startNodeAt(startPos, startLoc);\n      node$1.callee = base;\n      node$1.arguments = exprList;\n      if (optionalSupported) {\n        node$1.optional = optional;\n      }\n      base = this.finishNode(node$1, \"CallExpression\");\n    } else if (this.type === types$1.backQuote) {\n      if (optional || optionalChained) {\n        this.raise(this.start, \"Optional chaining cannot appear in the tag of tagged template expressions\");\n      }\n      var node$2 = this.startNodeAt(startPos, startLoc);\n      node$2.tag = base;\n      node$2.quasi = this.parseTemplate({isTagged: true});\n      base = this.finishNode(node$2, \"TaggedTemplateExpression\");\n    }\n    return base\n  };\n\n  // Parse an atomic expression — either a single token that is an\n  // expression, an expression started by a keyword like `function` or\n  // `new`, or an expression wrapped in punctuation like `()`, `[]`,\n  // or `{}`.\n\n  pp$5.parseExprAtom = function(refDestructuringErrors, forInit, forNew) {\n    // If a division operator appears in an expression position, the\n    // tokenizer got confused, and we force it to read a regexp instead.\n    if (this.type === types$1.slash) { this.readRegexp(); }\n\n    var node, canBeArrow = this.potentialArrowAt === this.start;\n    switch (this.type) {\n    case types$1._super:\n      if (!this.allowSuper)\n        { this.raise(this.start, \"'super' keyword outside a method\"); }\n      node = this.startNode();\n      this.next();\n      if (this.type === types$1.parenL && !this.allowDirectSuper)\n        { this.raise(node.start, \"super() call outside constructor of a subclass\"); }\n      // The `super` keyword can appear at below:\n      // SuperProperty:\n      //     super [ Expression ]\n      //     super . IdentifierName\n      // SuperCall:\n      //     super ( Arguments )\n      if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL)\n        { this.unexpected(); }\n      return this.finishNode(node, \"Super\")\n\n    case types$1._this:\n      node = this.startNode();\n      this.next();\n      return this.finishNode(node, \"ThisExpression\")\n\n    case types$1.name:\n      var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;\n      var id = this.parseIdent(false);\n      if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === \"async\" && !this.canInsertSemicolon() && this.eat(types$1._function)) {\n        this.overrideContext(types.f_expr);\n        return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit)\n      }\n      if (canBeArrow && !this.canInsertSemicolon()) {\n        if (this.eat(types$1.arrow))\n          { return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false, forInit) }\n        if (this.options.ecmaVersion >= 8 && id.name === \"async\" && this.type === types$1.name && !containsEsc &&\n            (!this.potentialArrowInForAwait || this.value !== \"of\" || this.containsEsc)) {\n          id = this.parseIdent(false);\n          if (this.canInsertSemicolon() || !this.eat(types$1.arrow))\n            { this.unexpected(); }\n          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true, forInit)\n        }\n      }\n      return id\n\n    case types$1.regexp:\n      var value = this.value;\n      node = this.parseLiteral(value.value);\n      node.regex = {pattern: value.pattern, flags: value.flags};\n      return node\n\n    case types$1.num: case types$1.string:\n      return this.parseLiteral(this.value)\n\n    case types$1._null: case types$1._true: case types$1._false:\n      node = this.startNode();\n      node.value = this.type === types$1._null ? null : this.type === types$1._true;\n      node.raw = this.type.keyword;\n      this.next();\n      return this.finishNode(node, \"Literal\")\n\n    case types$1.parenL:\n      var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit);\n      if (refDestructuringErrors) {\n        if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr))\n          { refDestructuringErrors.parenthesizedAssign = start; }\n        if (refDestructuringErrors.parenthesizedBind < 0)\n          { refDestructuringErrors.parenthesizedBind = start; }\n      }\n      return expr\n\n    case types$1.bracketL:\n      node = this.startNode();\n      this.next();\n      node.elements = this.parseExprList(types$1.bracketR, true, true, refDestructuringErrors);\n      return this.finishNode(node, \"ArrayExpression\")\n\n    case types$1.braceL:\n      this.overrideContext(types.b_expr);\n      return this.parseObj(false, refDestructuringErrors)\n\n    case types$1._function:\n      node = this.startNode();\n      this.next();\n      return this.parseFunction(node, 0)\n\n    case types$1._class:\n      return this.parseClass(this.startNode(), false)\n\n    case types$1._new:\n      return this.parseNew()\n\n    case types$1.backQuote:\n      return this.parseTemplate()\n\n    case types$1._import:\n      if (this.options.ecmaVersion >= 11) {\n        return this.parseExprImport(forNew)\n      } else {\n        return this.unexpected()\n      }\n\n    default:\n      return this.parseExprAtomDefault()\n    }\n  };\n\n  pp$5.parseExprAtomDefault = function() {\n    this.unexpected();\n  };\n\n  pp$5.parseExprImport = function(forNew) {\n    var node = this.startNode();\n\n    // Consume `import` as an identifier for `import.meta`.\n    // Because `this.parseIdent(true)` doesn't check escape sequences, it needs the check of `this.containsEsc`.\n    if (this.containsEsc) { this.raiseRecoverable(this.start, \"Escape sequence in keyword import\"); }\n    this.next();\n\n    if (this.type === types$1.parenL && !forNew) {\n      return this.parseDynamicImport(node)\n    } else if (this.type === types$1.dot) {\n      var meta = this.startNodeAt(node.start, node.loc && node.loc.start);\n      meta.name = \"import\";\n      node.meta = this.finishNode(meta, \"Identifier\");\n      return this.parseImportMeta(node)\n    } else {\n      this.unexpected();\n    }\n  };\n\n  pp$5.parseDynamicImport = function(node) {\n    this.next(); // skip `(`\n\n    // Parse node.source.\n    node.source = this.parseMaybeAssign();\n\n    if (this.options.ecmaVersion >= 16) {\n      if (!this.eat(types$1.parenR)) {\n        this.expect(types$1.comma);\n        if (!this.afterTrailingComma(types$1.parenR)) {\n          node.options = this.parseMaybeAssign();\n          if (!this.eat(types$1.parenR)) {\n            this.expect(types$1.comma);\n            if (!this.afterTrailingComma(types$1.parenR)) {\n              this.unexpected();\n            }\n          }\n        } else {\n          node.options = null;\n        }\n      } else {\n        node.options = null;\n      }\n    } else {\n      // Verify ending.\n      if (!this.eat(types$1.parenR)) {\n        var errorPos = this.start;\n        if (this.eat(types$1.comma) && this.eat(types$1.parenR)) {\n          this.raiseRecoverable(errorPos, \"Trailing comma is not allowed in import()\");\n        } else {\n          this.unexpected(errorPos);\n        }\n      }\n    }\n\n    return this.finishNode(node, \"ImportExpression\")\n  };\n\n  pp$5.parseImportMeta = function(node) {\n    this.next(); // skip `.`\n\n    var containsEsc = this.containsEsc;\n    node.property = this.parseIdent(true);\n\n    if (node.property.name !== \"meta\")\n      { this.raiseRecoverable(node.property.start, \"The only valid meta property for import is 'import.meta'\"); }\n    if (containsEsc)\n      { this.raiseRecoverable(node.start, \"'import.meta' must not contain escaped characters\"); }\n    if (this.options.sourceType !== \"module\" && !this.options.allowImportExportEverywhere)\n      { this.raiseRecoverable(node.start, \"Cannot use 'import.meta' outside a module\"); }\n\n    return this.finishNode(node, \"MetaProperty\")\n  };\n\n  pp$5.parseLiteral = function(value) {\n    var node = this.startNode();\n    node.value = value;\n    node.raw = this.input.slice(this.start, this.end);\n    if (node.raw.charCodeAt(node.raw.length - 1) === 110)\n      { node.bigint = node.value != null ? node.value.toString() : node.raw.slice(0, -1).replace(/_/g, \"\"); }\n    this.next();\n    return this.finishNode(node, \"Literal\")\n  };\n\n  pp$5.parseParenExpression = function() {\n    this.expect(types$1.parenL);\n    var val = this.parseExpression();\n    this.expect(types$1.parenR);\n    return val\n  };\n\n  pp$5.shouldParseArrow = function(exprList) {\n    return !this.canInsertSemicolon()\n  };\n\n  pp$5.parseParenAndDistinguishExpression = function(canBeArrow, forInit) {\n    var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;\n    if (this.options.ecmaVersion >= 6) {\n      this.next();\n\n      var innerStartPos = this.start, innerStartLoc = this.startLoc;\n      var exprList = [], first = true, lastIsComma = false;\n      var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;\n      this.yieldPos = 0;\n      this.awaitPos = 0;\n      // Do not save awaitIdentPos to allow checking awaits nested in parameters\n      while (this.type !== types$1.parenR) {\n        first ? first = false : this.expect(types$1.comma);\n        if (allowTrailingComma && this.afterTrailingComma(types$1.parenR, true)) {\n          lastIsComma = true;\n          break\n        } else if (this.type === types$1.ellipsis) {\n          spreadStart = this.start;\n          exprList.push(this.parseParenItem(this.parseRestBinding()));\n          if (this.type === types$1.comma) {\n            this.raiseRecoverable(\n              this.start,\n              \"Comma is not permitted after the rest element\"\n            );\n          }\n          break\n        } else {\n          exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));\n        }\n      }\n      var innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;\n      this.expect(types$1.parenR);\n\n      if (canBeArrow && this.shouldParseArrow(exprList) && this.eat(types$1.arrow)) {\n        this.checkPatternErrors(refDestructuringErrors, false);\n        this.checkYieldAwaitInDefaultParams();\n        this.yieldPos = oldYieldPos;\n        this.awaitPos = oldAwaitPos;\n        return this.parseParenArrowList(startPos, startLoc, exprList, forInit)\n      }\n\n      if (!exprList.length || lastIsComma) { this.unexpected(this.lastTokStart); }\n      if (spreadStart) { this.unexpected(spreadStart); }\n      this.checkExpressionErrors(refDestructuringErrors, true);\n      this.yieldPos = oldYieldPos || this.yieldPos;\n      this.awaitPos = oldAwaitPos || this.awaitPos;\n\n      if (exprList.length > 1) {\n        val = this.startNodeAt(innerStartPos, innerStartLoc);\n        val.expressions = exprList;\n        this.finishNodeAt(val, \"SequenceExpression\", innerEndPos, innerEndLoc);\n      } else {\n        val = exprList[0];\n      }\n    } else {\n      val = this.parseParenExpression();\n    }\n\n    if (this.options.preserveParens) {\n      var par = this.startNodeAt(startPos, startLoc);\n      par.expression = val;\n      return this.finishNode(par, \"ParenthesizedExpression\")\n    } else {\n      return val\n    }\n  };\n\n  pp$5.parseParenItem = function(item) {\n    return item\n  };\n\n  pp$5.parseParenArrowList = function(startPos, startLoc, exprList, forInit) {\n    return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, false, forInit)\n  };\n\n  // New's precedence is slightly tricky. It must allow its argument to\n  // be a `[]` or dot subscript expression, but not a call — at least,\n  // not without wrapping it in parentheses. Thus, it uses the noCalls\n  // argument to parseSubscripts to prevent it from consuming the\n  // argument list.\n\n  var empty = [];\n\n  pp$5.parseNew = function() {\n    if (this.containsEsc) { this.raiseRecoverable(this.start, \"Escape sequence in keyword new\"); }\n    var node = this.startNode();\n    this.next();\n    if (this.options.ecmaVersion >= 6 && this.type === types$1.dot) {\n      var meta = this.startNodeAt(node.start, node.loc && node.loc.start);\n      meta.name = \"new\";\n      node.meta = this.finishNode(meta, \"Identifier\");\n      this.next();\n      var containsEsc = this.containsEsc;\n      node.property = this.parseIdent(true);\n      if (node.property.name !== \"target\")\n        { this.raiseRecoverable(node.property.start, \"The only valid meta property for new is 'new.target'\"); }\n      if (containsEsc)\n        { this.raiseRecoverable(node.start, \"'new.target' must not contain escaped characters\"); }\n      if (!this.allowNewDotTarget)\n        { this.raiseRecoverable(node.start, \"'new.target' can only be used in functions and class static block\"); }\n      return this.finishNode(node, \"MetaProperty\")\n    }\n    var startPos = this.start, startLoc = this.startLoc;\n    node.callee = this.parseSubscripts(this.parseExprAtom(null, false, true), startPos, startLoc, true, false);\n    if (node.callee.type === \"Super\")\n      { this.raiseRecoverable(startPos, \"Invalid use of 'super'\"); }\n    if (this.eat(types$1.parenL)) { node.arguments = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false); }\n    else { node.arguments = empty; }\n    return this.finishNode(node, \"NewExpression\")\n  };\n\n  // Parse template expression.\n\n  pp$5.parseTemplateElement = function(ref) {\n    var isTagged = ref.isTagged;\n\n    var elem = this.startNode();\n    if (this.type === types$1.invalidTemplate) {\n      if (!isTagged) {\n        this.raiseRecoverable(this.start, \"Bad escape sequence in untagged template literal\");\n      }\n      elem.value = {\n        raw: this.value.replace(/\\r\\n?/g, \"\\n\"),\n        cooked: null\n      };\n    } else {\n      elem.value = {\n        raw: this.input.slice(this.start, this.end).replace(/\\r\\n?/g, \"\\n\"),\n        cooked: this.value\n      };\n    }\n    this.next();\n    elem.tail = this.type === types$1.backQuote;\n    return this.finishNode(elem, \"TemplateElement\")\n  };\n\n  pp$5.parseTemplate = function(ref) {\n    if ( ref === void 0 ) ref = {};\n    var isTagged = ref.isTagged; if ( isTagged === void 0 ) isTagged = false;\n\n    var node = this.startNode();\n    this.next();\n    node.expressions = [];\n    var curElt = this.parseTemplateElement({isTagged: isTagged});\n    node.quasis = [curElt];\n    while (!curElt.tail) {\n      if (this.type === types$1.eof) { this.raise(this.pos, \"Unterminated template literal\"); }\n      this.expect(types$1.dollarBraceL);\n      node.expressions.push(this.parseExpression());\n      this.expect(types$1.braceR);\n      node.quasis.push(curElt = this.parseTemplateElement({isTagged: isTagged}));\n    }\n    this.next();\n    return this.finishNode(node, \"TemplateLiteral\")\n  };\n\n  pp$5.isAsyncProp = function(prop) {\n    return !prop.computed && prop.key.type === \"Identifier\" && prop.key.name === \"async\" &&\n      (this.type === types$1.name || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword || (this.options.ecmaVersion >= 9 && this.type === types$1.star)) &&\n      !lineBreak.test(this.input.slice(this.lastTokEnd, this.start))\n  };\n\n  // Parse an object literal or binding pattern.\n\n  pp$5.parseObj = function(isPattern, refDestructuringErrors) {\n    var node = this.startNode(), first = true, propHash = {};\n    node.properties = [];\n    this.next();\n    while (!this.eat(types$1.braceR)) {\n      if (!first) {\n        this.expect(types$1.comma);\n        if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types$1.braceR)) { break }\n      } else { first = false; }\n\n      var prop = this.parseProperty(isPattern, refDestructuringErrors);\n      if (!isPattern) { this.checkPropClash(prop, propHash, refDestructuringErrors); }\n      node.properties.push(prop);\n    }\n    return this.finishNode(node, isPattern ? \"ObjectPattern\" : \"ObjectExpression\")\n  };\n\n  pp$5.parseProperty = function(isPattern, refDestructuringErrors) {\n    var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;\n    if (this.options.ecmaVersion >= 9 && this.eat(types$1.ellipsis)) {\n      if (isPattern) {\n        prop.argument = this.parseIdent(false);\n        if (this.type === types$1.comma) {\n          this.raiseRecoverable(this.start, \"Comma is not permitted after the rest element\");\n        }\n        return this.finishNode(prop, \"RestElement\")\n      }\n      // Parse argument.\n      prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);\n      // To disallow trailing comma via `this.toAssignable()`.\n      if (this.type === types$1.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {\n        refDestructuringErrors.trailingComma = this.start;\n      }\n      // Finish\n      return this.finishNode(prop, \"SpreadElement\")\n    }\n    if (this.options.ecmaVersion >= 6) {\n      prop.method = false;\n      prop.shorthand = false;\n      if (isPattern || refDestructuringErrors) {\n        startPos = this.start;\n        startLoc = this.startLoc;\n      }\n      if (!isPattern)\n        { isGenerator = this.eat(types$1.star); }\n    }\n    var containsEsc = this.containsEsc;\n    this.parsePropertyName(prop);\n    if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {\n      isAsync = true;\n      isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);\n      this.parsePropertyName(prop);\n    } else {\n      isAsync = false;\n    }\n    this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);\n    return this.finishNode(prop, \"Property\")\n  };\n\n  pp$5.parseGetterSetter = function(prop) {\n    var kind = prop.key.name;\n    this.parsePropertyName(prop);\n    prop.value = this.parseMethod(false);\n    prop.kind = kind;\n    var paramCount = prop.kind === \"get\" ? 0 : 1;\n    if (prop.value.params.length !== paramCount) {\n      var start = prop.value.start;\n      if (prop.kind === \"get\")\n        { this.raiseRecoverable(start, \"getter should have no params\"); }\n      else\n        { this.raiseRecoverable(start, \"setter should have exactly one param\"); }\n    } else {\n      if (prop.kind === \"set\" && prop.value.params[0].type === \"RestElement\")\n        { this.raiseRecoverable(prop.value.params[0].start, \"Setter cannot use rest params\"); }\n    }\n  };\n\n  pp$5.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {\n    if ((isGenerator || isAsync) && this.type === types$1.colon)\n      { this.unexpected(); }\n\n    if (this.eat(types$1.colon)) {\n      prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);\n      prop.kind = \"init\";\n    } else if (this.options.ecmaVersion >= 6 && this.type === types$1.parenL) {\n      if (isPattern) { this.unexpected(); }\n      prop.method = true;\n      prop.value = this.parseMethod(isGenerator, isAsync);\n      prop.kind = \"init\";\n    } else if (!isPattern && !containsEsc &&\n               this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === \"Identifier\" &&\n               (prop.key.name === \"get\" || prop.key.name === \"set\") &&\n               (this.type !== types$1.comma && this.type !== types$1.braceR && this.type !== types$1.eq)) {\n      if (isGenerator || isAsync) { this.unexpected(); }\n      this.parseGetterSetter(prop);\n    } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === \"Identifier\") {\n      if (isGenerator || isAsync) { this.unexpected(); }\n      this.checkUnreserved(prop.key);\n      if (prop.key.name === \"await\" && !this.awaitIdentPos)\n        { this.awaitIdentPos = startPos; }\n      if (isPattern) {\n        prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));\n      } else if (this.type === types$1.eq && refDestructuringErrors) {\n        if (refDestructuringErrors.shorthandAssign < 0)\n          { refDestructuringErrors.shorthandAssign = this.start; }\n        prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));\n      } else {\n        prop.value = this.copyNode(prop.key);\n      }\n      prop.kind = \"init\";\n      prop.shorthand = true;\n    } else { this.unexpected(); }\n  };\n\n  pp$5.parsePropertyName = function(prop) {\n    if (this.options.ecmaVersion >= 6) {\n      if (this.eat(types$1.bracketL)) {\n        prop.computed = true;\n        prop.key = this.parseMaybeAssign();\n        this.expect(types$1.bracketR);\n        return prop.key\n      } else {\n        prop.computed = false;\n      }\n    }\n    return prop.key = this.type === types$1.num || this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== \"never\")\n  };\n\n  // Initialize empty function node.\n\n  pp$5.initFunction = function(node) {\n    node.id = null;\n    if (this.options.ecmaVersion >= 6) { node.generator = node.expression = false; }\n    if (this.options.ecmaVersion >= 8) { node.async = false; }\n  };\n\n  // Parse object or class method.\n\n  pp$5.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {\n    var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;\n\n    this.initFunction(node);\n    if (this.options.ecmaVersion >= 6)\n      { node.generator = isGenerator; }\n    if (this.options.ecmaVersion >= 8)\n      { node.async = !!isAsync; }\n\n    this.yieldPos = 0;\n    this.awaitPos = 0;\n    this.awaitIdentPos = 0;\n    this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));\n\n    this.expect(types$1.parenL);\n    node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);\n    this.checkYieldAwaitInDefaultParams();\n    this.parseFunctionBody(node, false, true, false);\n\n    this.yieldPos = oldYieldPos;\n    this.awaitPos = oldAwaitPos;\n    this.awaitIdentPos = oldAwaitIdentPos;\n    return this.finishNode(node, \"FunctionExpression\")\n  };\n\n  // Parse arrow function expression with given parameters.\n\n  pp$5.parseArrowExpression = function(node, params, isAsync, forInit) {\n    var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;\n\n    this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);\n    this.initFunction(node);\n    if (this.options.ecmaVersion >= 8) { node.async = !!isAsync; }\n\n    this.yieldPos = 0;\n    this.awaitPos = 0;\n    this.awaitIdentPos = 0;\n\n    node.params = this.toAssignableList(params, true);\n    this.parseFunctionBody(node, true, false, forInit);\n\n    this.yieldPos = oldYieldPos;\n    this.awaitPos = oldAwaitPos;\n    this.awaitIdentPos = oldAwaitIdentPos;\n    return this.finishNode(node, \"ArrowFunctionExpression\")\n  };\n\n  // Parse function body and check parameters.\n\n  pp$5.parseFunctionBody = function(node, isArrowFunction, isMethod, forInit) {\n    var isExpression = isArrowFunction && this.type !== types$1.braceL;\n    var oldStrict = this.strict, useStrict = false;\n\n    if (isExpression) {\n      node.body = this.parseMaybeAssign(forInit);\n      node.expression = true;\n      this.checkParams(node, false);\n    } else {\n      var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);\n      if (!oldStrict || nonSimple) {\n        useStrict = this.strictDirective(this.end);\n        // If this is a strict mode function, verify that argument names\n        // are not repeated, and it does not try to bind the words `eval`\n        // or `arguments`.\n        if (useStrict && nonSimple)\n          { this.raiseRecoverable(node.start, \"Illegal 'use strict' directive in function with non-simple parameter list\"); }\n      }\n      // Start a new scope with regard to labels and the `inFunction`\n      // flag (restore them to their old value afterwards).\n      var oldLabels = this.labels;\n      this.labels = [];\n      if (useStrict) { this.strict = true; }\n\n      // Add the params to varDeclaredNames to ensure that an error is thrown\n      // if a let/const declaration in the function clashes with one of the params.\n      this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));\n      // Ensure the function name isn't a forbidden identifier in strict mode, e.g. 'eval'\n      if (this.strict && node.id) { this.checkLValSimple(node.id, BIND_OUTSIDE); }\n      node.body = this.parseBlock(false, undefined, useStrict && !oldStrict);\n      node.expression = false;\n      this.adaptDirectivePrologue(node.body.body);\n      this.labels = oldLabels;\n    }\n    this.exitScope();\n  };\n\n  pp$5.isSimpleParamList = function(params) {\n    for (var i = 0, list = params; i < list.length; i += 1)\n      {\n      var param = list[i];\n\n      if (param.type !== \"Identifier\") { return false\n    } }\n    return true\n  };\n\n  // Checks function params for various disallowed patterns such as using \"eval\"\n  // or \"arguments\" and duplicate parameters.\n\n  pp$5.checkParams = function(node, allowDuplicates) {\n    var nameHash = Object.create(null);\n    for (var i = 0, list = node.params; i < list.length; i += 1)\n      {\n      var param = list[i];\n\n      this.checkLValInnerPattern(param, BIND_VAR, allowDuplicates ? null : nameHash);\n    }\n  };\n\n  // Parses a comma-separated list of expressions, and returns them as\n  // an array. `close` is the token type that ends the list, and\n  // `allowEmpty` can be turned on to allow subsequent commas with\n  // nothing in between them to be parsed as `null` (which is needed\n  // for array literals).\n\n  pp$5.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {\n    var elts = [], first = true;\n    while (!this.eat(close)) {\n      if (!first) {\n        this.expect(types$1.comma);\n        if (allowTrailingComma && this.afterTrailingComma(close)) { break }\n      } else { first = false; }\n\n      var elt = (void 0);\n      if (allowEmpty && this.type === types$1.comma)\n        { elt = null; }\n      else if (this.type === types$1.ellipsis) {\n        elt = this.parseSpread(refDestructuringErrors);\n        if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0)\n          { refDestructuringErrors.trailingComma = this.start; }\n      } else {\n        elt = this.parseMaybeAssign(false, refDestructuringErrors);\n      }\n      elts.push(elt);\n    }\n    return elts\n  };\n\n  pp$5.checkUnreserved = function(ref) {\n    var start = ref.start;\n    var end = ref.end;\n    var name = ref.name;\n\n    if (this.inGenerator && name === \"yield\")\n      { this.raiseRecoverable(start, \"Cannot use 'yield' as identifier inside a generator\"); }\n    if (this.inAsync && name === \"await\")\n      { this.raiseRecoverable(start, \"Cannot use 'await' as identifier inside an async function\"); }\n    if (!(this.currentThisScope().flags & SCOPE_VAR) && name === \"arguments\")\n      { this.raiseRecoverable(start, \"Cannot use 'arguments' in class field initializer\"); }\n    if (this.inClassStaticBlock && (name === \"arguments\" || name === \"await\"))\n      { this.raise(start, (\"Cannot use \" + name + \" in class static initialization block\")); }\n    if (this.keywords.test(name))\n      { this.raise(start, (\"Unexpected keyword '\" + name + \"'\")); }\n    if (this.options.ecmaVersion < 6 &&\n      this.input.slice(start, end).indexOf(\"\\\\\") !== -1) { return }\n    var re = this.strict ? this.reservedWordsStrict : this.reservedWords;\n    if (re.test(name)) {\n      if (!this.inAsync && name === \"await\")\n        { this.raiseRecoverable(start, \"Cannot use keyword 'await' outside an async function\"); }\n      this.raiseRecoverable(start, (\"The keyword '\" + name + \"' is reserved\"));\n    }\n  };\n\n  // Parse the next token as an identifier. If `liberal` is true (used\n  // when parsing properties), it will also convert keywords into\n  // identifiers.\n\n  pp$5.parseIdent = function(liberal) {\n    var node = this.parseIdentNode();\n    this.next(!!liberal);\n    this.finishNode(node, \"Identifier\");\n    if (!liberal) {\n      this.checkUnreserved(node);\n      if (node.name === \"await\" && !this.awaitIdentPos)\n        { this.awaitIdentPos = node.start; }\n    }\n    return node\n  };\n\n  pp$5.parseIdentNode = function() {\n    var node = this.startNode();\n    if (this.type === types$1.name) {\n      node.name = this.value;\n    } else if (this.type.keyword) {\n      node.name = this.type.keyword;\n\n      // To fix https://github.com/acornjs/acorn/issues/575\n      // `class` and `function` keywords push new context into this.context.\n      // But there is no chance to pop the context if the keyword is consumed as an identifier such as a property name.\n      // If the previous token is a dot, this does not apply because the context-managing code already ignored the keyword\n      if ((node.name === \"class\" || node.name === \"function\") &&\n        (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {\n        this.context.pop();\n      }\n      this.type = types$1.name;\n    } else {\n      this.unexpected();\n    }\n    return node\n  };\n\n  pp$5.parsePrivateIdent = function() {\n    var node = this.startNode();\n    if (this.type === types$1.privateId) {\n      node.name = this.value;\n    } else {\n      this.unexpected();\n    }\n    this.next();\n    this.finishNode(node, \"PrivateIdentifier\");\n\n    // For validating existence\n    if (this.options.checkPrivateFields) {\n      if (this.privateNameStack.length === 0) {\n        this.raise(node.start, (\"Private field '#\" + (node.name) + \"' must be declared in an enclosing class\"));\n      } else {\n        this.privateNameStack[this.privateNameStack.length - 1].used.push(node);\n      }\n    }\n\n    return node\n  };\n\n  // Parses yield expression inside generator.\n\n  pp$5.parseYield = function(forInit) {\n    if (!this.yieldPos) { this.yieldPos = this.start; }\n\n    var node = this.startNode();\n    this.next();\n    if (this.type === types$1.semi || this.canInsertSemicolon() || (this.type !== types$1.star && !this.type.startsExpr)) {\n      node.delegate = false;\n      node.argument = null;\n    } else {\n      node.delegate = this.eat(types$1.star);\n      node.argument = this.parseMaybeAssign(forInit);\n    }\n    return this.finishNode(node, \"YieldExpression\")\n  };\n\n  pp$5.parseAwait = function(forInit) {\n    if (!this.awaitPos) { this.awaitPos = this.start; }\n\n    var node = this.startNode();\n    this.next();\n    node.argument = this.parseMaybeUnary(null, true, false, forInit);\n    return this.finishNode(node, \"AwaitExpression\")\n  };\n\n  var pp$4 = Parser.prototype;\n\n  // This function is used to raise exceptions on parse errors. It\n  // takes an offset integer (into the current `input`) to indicate\n  // the location of the error, attaches the position to the end\n  // of the error message, and then raises a `SyntaxError` with that\n  // message.\n\n  pp$4.raise = function(pos, message) {\n    var loc = getLineInfo(this.input, pos);\n    message += \" (\" + loc.line + \":\" + loc.column + \")\";\n    if (this.sourceFile) {\n      message += \" in \" + this.sourceFile;\n    }\n    var err = new SyntaxError(message);\n    err.pos = pos; err.loc = loc; err.raisedAt = this.pos;\n    throw err\n  };\n\n  pp$4.raiseRecoverable = pp$4.raise;\n\n  pp$4.curPosition = function() {\n    if (this.options.locations) {\n      return new Position(this.curLine, this.pos - this.lineStart)\n    }\n  };\n\n  var pp$3 = Parser.prototype;\n\n  var Scope = function Scope(flags) {\n    this.flags = flags;\n    // A list of var-declared names in the current lexical scope\n    this.var = [];\n    // A list of lexically-declared names in the current lexical scope\n    this.lexical = [];\n    // A list of lexically-declared FunctionDeclaration names in the current lexical scope\n    this.functions = [];\n  };\n\n  // The functions in this module keep track of declared variables in the current scope in order to detect duplicate variable names.\n\n  pp$3.enterScope = function(flags) {\n    this.scopeStack.push(new Scope(flags));\n  };\n\n  pp$3.exitScope = function() {\n    this.scopeStack.pop();\n  };\n\n  // The spec says:\n  // > At the top level of a function, or script, function declarations are\n  // > treated like var declarations rather than like lexical declarations.\n  pp$3.treatFunctionsAsVarInScope = function(scope) {\n    return (scope.flags & SCOPE_FUNCTION) || !this.inModule && (scope.flags & SCOPE_TOP)\n  };\n\n  pp$3.declareName = function(name, bindingType, pos) {\n    var redeclared = false;\n    if (bindingType === BIND_LEXICAL) {\n      var scope = this.currentScope();\n      redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;\n      scope.lexical.push(name);\n      if (this.inModule && (scope.flags & SCOPE_TOP))\n        { delete this.undefinedExports[name]; }\n    } else if (bindingType === BIND_SIMPLE_CATCH) {\n      var scope$1 = this.currentScope();\n      scope$1.lexical.push(name);\n    } else if (bindingType === BIND_FUNCTION) {\n      var scope$2 = this.currentScope();\n      if (this.treatFunctionsAsVar)\n        { redeclared = scope$2.lexical.indexOf(name) > -1; }\n      else\n        { redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1; }\n      scope$2.functions.push(name);\n    } else {\n      for (var i = this.scopeStack.length - 1; i >= 0; --i) {\n        var scope$3 = this.scopeStack[i];\n        if (scope$3.lexical.indexOf(name) > -1 && !((scope$3.flags & SCOPE_SIMPLE_CATCH) && scope$3.lexical[0] === name) ||\n            !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {\n          redeclared = true;\n          break\n        }\n        scope$3.var.push(name);\n        if (this.inModule && (scope$3.flags & SCOPE_TOP))\n          { delete this.undefinedExports[name]; }\n        if (scope$3.flags & SCOPE_VAR) { break }\n      }\n    }\n    if (redeclared) { this.raiseRecoverable(pos, (\"Identifier '\" + name + \"' has already been declared\")); }\n  };\n\n  pp$3.checkLocalExport = function(id) {\n    // scope.functions must be empty as Module code is always strict.\n    if (this.scopeStack[0].lexical.indexOf(id.name) === -1 &&\n        this.scopeStack[0].var.indexOf(id.name) === -1) {\n      this.undefinedExports[id.name] = id;\n    }\n  };\n\n  pp$3.currentScope = function() {\n    return this.scopeStack[this.scopeStack.length - 1]\n  };\n\n  pp$3.currentVarScope = function() {\n    for (var i = this.scopeStack.length - 1;; i--) {\n      var scope = this.scopeStack[i];\n      if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK)) { return scope }\n    }\n  };\n\n  // Could be useful for `this`, `new.target`, `super()`, `super.property`, and `super[property]`.\n  pp$3.currentThisScope = function() {\n    for (var i = this.scopeStack.length - 1;; i--) {\n      var scope = this.scopeStack[i];\n      if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK) &&\n          !(scope.flags & SCOPE_ARROW)) { return scope }\n    }\n  };\n\n  var Node = function Node(parser, pos, loc) {\n    this.type = \"\";\n    this.start = pos;\n    this.end = 0;\n    if (parser.options.locations)\n      { this.loc = new SourceLocation(parser, loc); }\n    if (parser.options.directSourceFile)\n      { this.sourceFile = parser.options.directSourceFile; }\n    if (parser.options.ranges)\n      { this.range = [pos, 0]; }\n  };\n\n  // Start an AST node, attaching a start offset.\n\n  var pp$2 = Parser.prototype;\n\n  pp$2.startNode = function() {\n    return new Node(this, this.start, this.startLoc)\n  };\n\n  pp$2.startNodeAt = function(pos, loc) {\n    return new Node(this, pos, loc)\n  };\n\n  // Finish an AST node, adding `type` and `end` properties.\n\n  function finishNodeAt(node, type, pos, loc) {\n    node.type = type;\n    node.end = pos;\n    if (this.options.locations)\n      { node.loc.end = loc; }\n    if (this.options.ranges)\n      { node.range[1] = pos; }\n    return node\n  }\n\n  pp$2.finishNode = function(node, type) {\n    return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)\n  };\n\n  // Finish node at given position\n\n  pp$2.finishNodeAt = function(node, type, pos, loc) {\n    return finishNodeAt.call(this, node, type, pos, loc)\n  };\n\n  pp$2.copyNode = function(node) {\n    var newNode = new Node(this, node.start, this.startLoc);\n    for (var prop in node) { newNode[prop] = node[prop]; }\n    return newNode\n  };\n\n  // This file was generated by \"bin/generate-unicode-script-values.js\". Do not modify manually!\n  var scriptValuesAddedInUnicode = \"Berf Beria_Erfe Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sidetic Sidt Sunu Sunuwar Tai_Yo Tayo Todhri Todr Tolong_Siki Tols Tulu_Tigalari Tutg Unknown Zzzz\";\n\n  // This file contains Unicode properties extracted from the ECMAScript specification.\n  // The lists are extracted like so:\n  // $$('#table-binary-unicode-properties > figure > table > tbody > tr > td:nth-child(1) code').map(el => el.innerText)\n\n  // #table-binary-unicode-properties\n  var ecma9BinaryProperties = \"ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS\";\n  var ecma10BinaryProperties = ecma9BinaryProperties + \" Extended_Pictographic\";\n  var ecma11BinaryProperties = ecma10BinaryProperties;\n  var ecma12BinaryProperties = ecma11BinaryProperties + \" EBase EComp EMod EPres ExtPict\";\n  var ecma13BinaryProperties = ecma12BinaryProperties;\n  var ecma14BinaryProperties = ecma13BinaryProperties;\n\n  var unicodeBinaryProperties = {\n    9: ecma9BinaryProperties,\n    10: ecma10BinaryProperties,\n    11: ecma11BinaryProperties,\n    12: ecma12BinaryProperties,\n    13: ecma13BinaryProperties,\n    14: ecma14BinaryProperties\n  };\n\n  // #table-binary-unicode-properties-of-strings\n  var ecma14BinaryPropertiesOfStrings = \"Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji\";\n\n  var unicodeBinaryPropertiesOfStrings = {\n    9: \"\",\n    10: \"\",\n    11: \"\",\n    12: \"\",\n    13: \"\",\n    14: ecma14BinaryPropertiesOfStrings\n  };\n\n  // #table-unicode-general-category-values\n  var unicodeGeneralCategoryValues = \"Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu\";\n\n  // #table-unicode-script-values\n  var ecma9ScriptValues = \"Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb\";\n  var ecma10ScriptValues = ecma9ScriptValues + \" Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd\";\n  var ecma11ScriptValues = ecma10ScriptValues + \" Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho\";\n  var ecma12ScriptValues = ecma11ScriptValues + \" Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi\";\n  var ecma13ScriptValues = ecma12ScriptValues + \" Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith\";\n  var ecma14ScriptValues = ecma13ScriptValues + \" \" + scriptValuesAddedInUnicode;\n\n  var unicodeScriptValues = {\n    9: ecma9ScriptValues,\n    10: ecma10ScriptValues,\n    11: ecma11ScriptValues,\n    12: ecma12ScriptValues,\n    13: ecma13ScriptValues,\n    14: ecma14ScriptValues\n  };\n\n  var data = {};\n  function buildUnicodeData(ecmaVersion) {\n    var d = data[ecmaVersion] = {\n      binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + \" \" + unicodeGeneralCategoryValues),\n      binaryOfStrings: wordsRegexp(unicodeBinaryPropertiesOfStrings[ecmaVersion]),\n      nonBinary: {\n        General_Category: wordsRegexp(unicodeGeneralCategoryValues),\n        Script: wordsRegexp(unicodeScriptValues[ecmaVersion])\n      }\n    };\n    d.nonBinary.Script_Extensions = d.nonBinary.Script;\n\n    d.nonBinary.gc = d.nonBinary.General_Category;\n    d.nonBinary.sc = d.nonBinary.Script;\n    d.nonBinary.scx = d.nonBinary.Script_Extensions;\n  }\n\n  for (var i = 0, list = [9, 10, 11, 12, 13, 14]; i < list.length; i += 1) {\n    var ecmaVersion = list[i];\n\n    buildUnicodeData(ecmaVersion);\n  }\n\n  var pp$1 = Parser.prototype;\n\n  // Track disjunction structure to determine whether a duplicate\n  // capture group name is allowed because it is in a separate branch.\n  var BranchID = function BranchID(parent, base) {\n    // Parent disjunction branch\n    this.parent = parent;\n    // Identifies this set of sibling branches\n    this.base = base || this;\n  };\n\n  BranchID.prototype.separatedFrom = function separatedFrom (alt) {\n    // A branch is separate from another branch if they or any of\n    // their parents are siblings in a given disjunction\n    for (var self = this; self; self = self.parent) {\n      for (var other = alt; other; other = other.parent) {\n        if (self.base === other.base && self !== other) { return true }\n      }\n    }\n    return false\n  };\n\n  BranchID.prototype.sibling = function sibling () {\n    return new BranchID(this.parent, this.base)\n  };\n\n  var RegExpValidationState = function RegExpValidationState(parser) {\n    this.parser = parser;\n    this.validFlags = \"gim\" + (parser.options.ecmaVersion >= 6 ? \"uy\" : \"\") + (parser.options.ecmaVersion >= 9 ? \"s\" : \"\") + (parser.options.ecmaVersion >= 13 ? \"d\" : \"\") + (parser.options.ecmaVersion >= 15 ? \"v\" : \"\");\n    this.unicodeProperties = data[parser.options.ecmaVersion >= 14 ? 14 : parser.options.ecmaVersion];\n    this.source = \"\";\n    this.flags = \"\";\n    this.start = 0;\n    this.switchU = false;\n    this.switchV = false;\n    this.switchN = false;\n    this.pos = 0;\n    this.lastIntValue = 0;\n    this.lastStringValue = \"\";\n    this.lastAssertionIsQuantifiable = false;\n    this.numCapturingParens = 0;\n    this.maxBackReference = 0;\n    this.groupNames = Object.create(null);\n    this.backReferenceNames = [];\n    this.branchID = null;\n  };\n\n  RegExpValidationState.prototype.reset = function reset (start, pattern, flags) {\n    var unicodeSets = flags.indexOf(\"v\") !== -1;\n    var unicode = flags.indexOf(\"u\") !== -1;\n    this.start = start | 0;\n    this.source = pattern + \"\";\n    this.flags = flags;\n    if (unicodeSets && this.parser.options.ecmaVersion >= 15) {\n      this.switchU = true;\n      this.switchV = true;\n      this.switchN = true;\n    } else {\n      this.switchU = unicode && this.parser.options.ecmaVersion >= 6;\n      this.switchV = false;\n      this.switchN = unicode && this.parser.options.ecmaVersion >= 9;\n    }\n  };\n\n  RegExpValidationState.prototype.raise = function raise (message) {\n    this.parser.raiseRecoverable(this.start, (\"Invalid regular expression: /\" + (this.source) + \"/: \" + message));\n  };\n\n  // If u flag is given, this returns the code point at the index (it combines a surrogate pair).\n  // Otherwise, this returns the code unit of the index (can be a part of a surrogate pair).\n  RegExpValidationState.prototype.at = function at (i, forceU) {\n      if ( forceU === void 0 ) forceU = false;\n\n    var s = this.source;\n    var l = s.length;\n    if (i >= l) {\n      return -1\n    }\n    var c = s.charCodeAt(i);\n    if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l) {\n      return c\n    }\n    var next = s.charCodeAt(i + 1);\n    return next >= 0xDC00 && next <= 0xDFFF ? (c << 10) + next - 0x35FDC00 : c\n  };\n\n  RegExpValidationState.prototype.nextIndex = function nextIndex (i, forceU) {\n      if ( forceU === void 0 ) forceU = false;\n\n    var s = this.source;\n    var l = s.length;\n    if (i >= l) {\n      return l\n    }\n    var c = s.charCodeAt(i), next;\n    if (!(forceU || this.switchU) || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l ||\n        (next = s.charCodeAt(i + 1)) < 0xDC00 || next > 0xDFFF) {\n      return i + 1\n    }\n    return i + 2\n  };\n\n  RegExpValidationState.prototype.current = function current (forceU) {\n      if ( forceU === void 0 ) forceU = false;\n\n    return this.at(this.pos, forceU)\n  };\n\n  RegExpValidationState.prototype.lookahead = function lookahead (forceU) {\n      if ( forceU === void 0 ) forceU = false;\n\n    return this.at(this.nextIndex(this.pos, forceU), forceU)\n  };\n\n  RegExpValidationState.prototype.advance = function advance (forceU) {\n      if ( forceU === void 0 ) forceU = false;\n\n    this.pos = this.nextIndex(this.pos, forceU);\n  };\n\n  RegExpValidationState.prototype.eat = function eat (ch, forceU) {\n      if ( forceU === void 0 ) forceU = false;\n\n    if (this.current(forceU) === ch) {\n      this.advance(forceU);\n      return true\n    }\n    return false\n  };\n\n  RegExpValidationState.prototype.eatChars = function eatChars (chs, forceU) {\n      if ( forceU === void 0 ) forceU = false;\n\n    var pos = this.pos;\n    for (var i = 0, list = chs; i < list.length; i += 1) {\n      var ch = list[i];\n\n        var current = this.at(pos, forceU);\n      if (current === -1 || current !== ch) {\n        return false\n      }\n      pos = this.nextIndex(pos, forceU);\n    }\n    this.pos = pos;\n    return true\n  };\n\n  /**\n   * Validate the flags part of a given RegExpLiteral.\n   *\n   * @param {RegExpValidationState} state The state to validate RegExp.\n   * @returns {void}\n   */\n  pp$1.validateRegExpFlags = function(state) {\n    var validFlags = state.validFlags;\n    var flags = state.flags;\n\n    var u = false;\n    var v = false;\n\n    for (var i = 0; i < flags.length; i++) {\n      var flag = flags.charAt(i);\n      if (validFlags.indexOf(flag) === -1) {\n        this.raise(state.start, \"Invalid regular expression flag\");\n      }\n      if (flags.indexOf(flag, i + 1) > -1) {\n        this.raise(state.start, \"Duplicate regular expression flag\");\n      }\n      if (flag === \"u\") { u = true; }\n      if (flag === \"v\") { v = true; }\n    }\n    if (this.options.ecmaVersion >= 15 && u && v) {\n      this.raise(state.start, \"Invalid regular expression flag\");\n    }\n  };\n\n  function hasProp(obj) {\n    for (var _ in obj) { return true }\n    return false\n  }\n\n  /**\n   * Validate the pattern part of a given RegExpLiteral.\n   *\n   * @param {RegExpValidationState} state The state to validate RegExp.\n   * @returns {void}\n   */\n  pp$1.validateRegExpPattern = function(state) {\n    this.regexp_pattern(state);\n\n    // The goal symbol for the parse is |Pattern[~U, ~N]|. If the result of\n    // parsing contains a |GroupName|, reparse with the goal symbol\n    // |Pattern[~U, +N]| and use this result instead. Throw a *SyntaxError*\n    // exception if _P_ did not conform to the grammar, if any elements of _P_\n    // were not matched by the parse, or if any Early Error conditions exist.\n    if (!state.switchN && this.options.ecmaVersion >= 9 && hasProp(state.groupNames)) {\n      state.switchN = true;\n      this.regexp_pattern(state);\n    }\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-Pattern\n  pp$1.regexp_pattern = function(state) {\n    state.pos = 0;\n    state.lastIntValue = 0;\n    state.lastStringValue = \"\";\n    state.lastAssertionIsQuantifiable = false;\n    state.numCapturingParens = 0;\n    state.maxBackReference = 0;\n    state.groupNames = Object.create(null);\n    state.backReferenceNames.length = 0;\n    state.branchID = null;\n\n    this.regexp_disjunction(state);\n\n    if (state.pos !== state.source.length) {\n      // Make the same messages as V8.\n      if (state.eat(0x29 /* ) */)) {\n        state.raise(\"Unmatched ')'\");\n      }\n      if (state.eat(0x5D /* ] */) || state.eat(0x7D /* } */)) {\n        state.raise(\"Lone quantifier brackets\");\n      }\n    }\n    if (state.maxBackReference > state.numCapturingParens) {\n      state.raise(\"Invalid escape\");\n    }\n    for (var i = 0, list = state.backReferenceNames; i < list.length; i += 1) {\n      var name = list[i];\n\n      if (!state.groupNames[name]) {\n        state.raise(\"Invalid named capture referenced\");\n      }\n    }\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-Disjunction\n  pp$1.regexp_disjunction = function(state) {\n    var trackDisjunction = this.options.ecmaVersion >= 16;\n    if (trackDisjunction) { state.branchID = new BranchID(state.branchID, null); }\n    this.regexp_alternative(state);\n    while (state.eat(0x7C /* | */)) {\n      if (trackDisjunction) { state.branchID = state.branchID.sibling(); }\n      this.regexp_alternative(state);\n    }\n    if (trackDisjunction) { state.branchID = state.branchID.parent; }\n\n    // Make the same message as V8.\n    if (this.regexp_eatQuantifier(state, true)) {\n      state.raise(\"Nothing to repeat\");\n    }\n    if (state.eat(0x7B /* { */)) {\n      state.raise(\"Lone quantifier brackets\");\n    }\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-Alternative\n  pp$1.regexp_alternative = function(state) {\n    while (state.pos < state.source.length && this.regexp_eatTerm(state)) {}\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Term\n  pp$1.regexp_eatTerm = function(state) {\n    if (this.regexp_eatAssertion(state)) {\n      // Handle `QuantifiableAssertion Quantifier` alternative.\n      // `state.lastAssertionIsQuantifiable` is true if the last eaten Assertion\n      // is a QuantifiableAssertion.\n      if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {\n        // Make the same message as V8.\n        if (state.switchU) {\n          state.raise(\"Invalid quantifier\");\n        }\n      }\n      return true\n    }\n\n    if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {\n      this.regexp_eatQuantifier(state);\n      return true\n    }\n\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Assertion\n  pp$1.regexp_eatAssertion = function(state) {\n    var start = state.pos;\n    state.lastAssertionIsQuantifiable = false;\n\n    // ^, $\n    if (state.eat(0x5E /* ^ */) || state.eat(0x24 /* $ */)) {\n      return true\n    }\n\n    // \\b \\B\n    if (state.eat(0x5C /* \\ */)) {\n      if (state.eat(0x42 /* B */) || state.eat(0x62 /* b */)) {\n        return true\n      }\n      state.pos = start;\n    }\n\n    // Lookahead / Lookbehind\n    if (state.eat(0x28 /* ( */) && state.eat(0x3F /* ? */)) {\n      var lookbehind = false;\n      if (this.options.ecmaVersion >= 9) {\n        lookbehind = state.eat(0x3C /* < */);\n      }\n      if (state.eat(0x3D /* = */) || state.eat(0x21 /* ! */)) {\n        this.regexp_disjunction(state);\n        if (!state.eat(0x29 /* ) */)) {\n          state.raise(\"Unterminated group\");\n        }\n        state.lastAssertionIsQuantifiable = !lookbehind;\n        return true\n      }\n    }\n\n    state.pos = start;\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-Quantifier\n  pp$1.regexp_eatQuantifier = function(state, noError) {\n    if ( noError === void 0 ) noError = false;\n\n    if (this.regexp_eatQuantifierPrefix(state, noError)) {\n      state.eat(0x3F /* ? */);\n      return true\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-QuantifierPrefix\n  pp$1.regexp_eatQuantifierPrefix = function(state, noError) {\n    return (\n      state.eat(0x2A /* * */) ||\n      state.eat(0x2B /* + */) ||\n      state.eat(0x3F /* ? */) ||\n      this.regexp_eatBracedQuantifier(state, noError)\n    )\n  };\n  pp$1.regexp_eatBracedQuantifier = function(state, noError) {\n    var start = state.pos;\n    if (state.eat(0x7B /* { */)) {\n      var min = 0, max = -1;\n      if (this.regexp_eatDecimalDigits(state)) {\n        min = state.lastIntValue;\n        if (state.eat(0x2C /* , */) && this.regexp_eatDecimalDigits(state)) {\n          max = state.lastIntValue;\n        }\n        if (state.eat(0x7D /* } */)) {\n          // SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-term\n          if (max !== -1 && max < min && !noError) {\n            state.raise(\"numbers out of order in {} quantifier\");\n          }\n          return true\n        }\n      }\n      if (state.switchU && !noError) {\n        state.raise(\"Incomplete quantifier\");\n      }\n      state.pos = start;\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-Atom\n  pp$1.regexp_eatAtom = function(state) {\n    return (\n      this.regexp_eatPatternCharacters(state) ||\n      state.eat(0x2E /* . */) ||\n      this.regexp_eatReverseSolidusAtomEscape(state) ||\n      this.regexp_eatCharacterClass(state) ||\n      this.regexp_eatUncapturingGroup(state) ||\n      this.regexp_eatCapturingGroup(state)\n    )\n  };\n  pp$1.regexp_eatReverseSolidusAtomEscape = function(state) {\n    var start = state.pos;\n    if (state.eat(0x5C /* \\ */)) {\n      if (this.regexp_eatAtomEscape(state)) {\n        return true\n      }\n      state.pos = start;\n    }\n    return false\n  };\n  pp$1.regexp_eatUncapturingGroup = function(state) {\n    var start = state.pos;\n    if (state.eat(0x28 /* ( */)) {\n      if (state.eat(0x3F /* ? */)) {\n        if (this.options.ecmaVersion >= 16) {\n          var addModifiers = this.regexp_eatModifiers(state);\n          var hasHyphen = state.eat(0x2D /* - */);\n          if (addModifiers || hasHyphen) {\n            for (var i = 0; i < addModifiers.length; i++) {\n              var modifier = addModifiers.charAt(i);\n              if (addModifiers.indexOf(modifier, i + 1) > -1) {\n                state.raise(\"Duplicate regular expression modifiers\");\n              }\n            }\n            if (hasHyphen) {\n              var removeModifiers = this.regexp_eatModifiers(state);\n              if (!addModifiers && !removeModifiers && state.current() === 0x3A /* : */) {\n                state.raise(\"Invalid regular expression modifiers\");\n              }\n              for (var i$1 = 0; i$1 < removeModifiers.length; i$1++) {\n                var modifier$1 = removeModifiers.charAt(i$1);\n                if (\n                  removeModifiers.indexOf(modifier$1, i$1 + 1) > -1 ||\n                  addModifiers.indexOf(modifier$1) > -1\n                ) {\n                  state.raise(\"Duplicate regular expression modifiers\");\n                }\n              }\n            }\n          }\n        }\n        if (state.eat(0x3A /* : */)) {\n          this.regexp_disjunction(state);\n          if (state.eat(0x29 /* ) */)) {\n            return true\n          }\n          state.raise(\"Unterminated group\");\n        }\n      }\n      state.pos = start;\n    }\n    return false\n  };\n  pp$1.regexp_eatCapturingGroup = function(state) {\n    if (state.eat(0x28 /* ( */)) {\n      if (this.options.ecmaVersion >= 9) {\n        this.regexp_groupSpecifier(state);\n      } else if (state.current() === 0x3F /* ? */) {\n        state.raise(\"Invalid group\");\n      }\n      this.regexp_disjunction(state);\n      if (state.eat(0x29 /* ) */)) {\n        state.numCapturingParens += 1;\n        return true\n      }\n      state.raise(\"Unterminated group\");\n    }\n    return false\n  };\n  // RegularExpressionModifiers ::\n  //   [empty]\n  //   RegularExpressionModifiers RegularExpressionModifier\n  pp$1.regexp_eatModifiers = function(state) {\n    var modifiers = \"\";\n    var ch = 0;\n    while ((ch = state.current()) !== -1 && isRegularExpressionModifier(ch)) {\n      modifiers += codePointToString(ch);\n      state.advance();\n    }\n    return modifiers\n  };\n  // RegularExpressionModifier :: one of\n  //   `i` `m` `s`\n  function isRegularExpressionModifier(ch) {\n    return ch === 0x69 /* i */ || ch === 0x6d /* m */ || ch === 0x73 /* s */\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedAtom\n  pp$1.regexp_eatExtendedAtom = function(state) {\n    return (\n      state.eat(0x2E /* . */) ||\n      this.regexp_eatReverseSolidusAtomEscape(state) ||\n      this.regexp_eatCharacterClass(state) ||\n      this.regexp_eatUncapturingGroup(state) ||\n      this.regexp_eatCapturingGroup(state) ||\n      this.regexp_eatInvalidBracedQuantifier(state) ||\n      this.regexp_eatExtendedPatternCharacter(state)\n    )\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-InvalidBracedQuantifier\n  pp$1.regexp_eatInvalidBracedQuantifier = function(state) {\n    if (this.regexp_eatBracedQuantifier(state, true)) {\n      state.raise(\"Nothing to repeat\");\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-SyntaxCharacter\n  pp$1.regexp_eatSyntaxCharacter = function(state) {\n    var ch = state.current();\n    if (isSyntaxCharacter(ch)) {\n      state.lastIntValue = ch;\n      state.advance();\n      return true\n    }\n    return false\n  };\n  function isSyntaxCharacter(ch) {\n    return (\n      ch === 0x24 /* $ */ ||\n      ch >= 0x28 /* ( */ && ch <= 0x2B /* + */ ||\n      ch === 0x2E /* . */ ||\n      ch === 0x3F /* ? */ ||\n      ch >= 0x5B /* [ */ && ch <= 0x5E /* ^ */ ||\n      ch >= 0x7B /* { */ && ch <= 0x7D /* } */\n    )\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-PatternCharacter\n  // But eat eager.\n  pp$1.regexp_eatPatternCharacters = function(state) {\n    var start = state.pos;\n    var ch = 0;\n    while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {\n      state.advance();\n    }\n    return state.pos !== start\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedPatternCharacter\n  pp$1.regexp_eatExtendedPatternCharacter = function(state) {\n    var ch = state.current();\n    if (\n      ch !== -1 &&\n      ch !== 0x24 /* $ */ &&\n      !(ch >= 0x28 /* ( */ && ch <= 0x2B /* + */) &&\n      ch !== 0x2E /* . */ &&\n      ch !== 0x3F /* ? */ &&\n      ch !== 0x5B /* [ */ &&\n      ch !== 0x5E /* ^ */ &&\n      ch !== 0x7C /* | */\n    ) {\n      state.advance();\n      return true\n    }\n    return false\n  };\n\n  // GroupSpecifier ::\n  //   [empty]\n  //   `?` GroupName\n  pp$1.regexp_groupSpecifier = function(state) {\n    if (state.eat(0x3F /* ? */)) {\n      if (!this.regexp_eatGroupName(state)) { state.raise(\"Invalid group\"); }\n      var trackDisjunction = this.options.ecmaVersion >= 16;\n      var known = state.groupNames[state.lastStringValue];\n      if (known) {\n        if (trackDisjunction) {\n          for (var i = 0, list = known; i < list.length; i += 1) {\n            var altID = list[i];\n\n            if (!altID.separatedFrom(state.branchID))\n              { state.raise(\"Duplicate capture group name\"); }\n          }\n        } else {\n          state.raise(\"Duplicate capture group name\");\n        }\n      }\n      if (trackDisjunction) {\n        (known || (state.groupNames[state.lastStringValue] = [])).push(state.branchID);\n      } else {\n        state.groupNames[state.lastStringValue] = true;\n      }\n    }\n  };\n\n  // GroupName ::\n  //   `<` RegExpIdentifierName `>`\n  // Note: this updates `state.lastStringValue` property with the eaten name.\n  pp$1.regexp_eatGroupName = function(state) {\n    state.lastStringValue = \"\";\n    if (state.eat(0x3C /* < */)) {\n      if (this.regexp_eatRegExpIdentifierName(state) && state.eat(0x3E /* > */)) {\n        return true\n      }\n      state.raise(\"Invalid capture group name\");\n    }\n    return false\n  };\n\n  // RegExpIdentifierName ::\n  //   RegExpIdentifierStart\n  //   RegExpIdentifierName RegExpIdentifierPart\n  // Note: this updates `state.lastStringValue` property with the eaten name.\n  pp$1.regexp_eatRegExpIdentifierName = function(state) {\n    state.lastStringValue = \"\";\n    if (this.regexp_eatRegExpIdentifierStart(state)) {\n      state.lastStringValue += codePointToString(state.lastIntValue);\n      while (this.regexp_eatRegExpIdentifierPart(state)) {\n        state.lastStringValue += codePointToString(state.lastIntValue);\n      }\n      return true\n    }\n    return false\n  };\n\n  // RegExpIdentifierStart ::\n  //   UnicodeIDStart\n  //   `$`\n  //   `_`\n  //   `\\` RegExpUnicodeEscapeSequence[+U]\n  pp$1.regexp_eatRegExpIdentifierStart = function(state) {\n    var start = state.pos;\n    var forceU = this.options.ecmaVersion >= 11;\n    var ch = state.current(forceU);\n    state.advance(forceU);\n\n    if (ch === 0x5C /* \\ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {\n      ch = state.lastIntValue;\n    }\n    if (isRegExpIdentifierStart(ch)) {\n      state.lastIntValue = ch;\n      return true\n    }\n\n    state.pos = start;\n    return false\n  };\n  function isRegExpIdentifierStart(ch) {\n    return isIdentifierStart(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */\n  }\n\n  // RegExpIdentifierPart ::\n  //   UnicodeIDContinue\n  //   `$`\n  //   `_`\n  //   `\\` RegExpUnicodeEscapeSequence[+U]\n  //   <ZWNJ>\n  //   <ZWJ>\n  pp$1.regexp_eatRegExpIdentifierPart = function(state) {\n    var start = state.pos;\n    var forceU = this.options.ecmaVersion >= 11;\n    var ch = state.current(forceU);\n    state.advance(forceU);\n\n    if (ch === 0x5C /* \\ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {\n      ch = state.lastIntValue;\n    }\n    if (isRegExpIdentifierPart(ch)) {\n      state.lastIntValue = ch;\n      return true\n    }\n\n    state.pos = start;\n    return false\n  };\n  function isRegExpIdentifierPart(ch) {\n    return isIdentifierChar(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */ || ch === 0x200C /* <ZWNJ> */ || ch === 0x200D /* <ZWJ> */\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-AtomEscape\n  pp$1.regexp_eatAtomEscape = function(state) {\n    if (\n      this.regexp_eatBackReference(state) ||\n      this.regexp_eatCharacterClassEscape(state) ||\n      this.regexp_eatCharacterEscape(state) ||\n      (state.switchN && this.regexp_eatKGroupName(state))\n    ) {\n      return true\n    }\n    if (state.switchU) {\n      // Make the same message as V8.\n      if (state.current() === 0x63 /* c */) {\n        state.raise(\"Invalid unicode escape\");\n      }\n      state.raise(\"Invalid escape\");\n    }\n    return false\n  };\n  pp$1.regexp_eatBackReference = function(state) {\n    var start = state.pos;\n    if (this.regexp_eatDecimalEscape(state)) {\n      var n = state.lastIntValue;\n      if (state.switchU) {\n        // For SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-atomescape\n        if (n > state.maxBackReference) {\n          state.maxBackReference = n;\n        }\n        return true\n      }\n      if (n <= state.numCapturingParens) {\n        return true\n      }\n      state.pos = start;\n    }\n    return false\n  };\n  pp$1.regexp_eatKGroupName = function(state) {\n    if (state.eat(0x6B /* k */)) {\n      if (this.regexp_eatGroupName(state)) {\n        state.backReferenceNames.push(state.lastStringValue);\n        return true\n      }\n      state.raise(\"Invalid named reference\");\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-CharacterEscape\n  pp$1.regexp_eatCharacterEscape = function(state) {\n    return (\n      this.regexp_eatControlEscape(state) ||\n      this.regexp_eatCControlLetter(state) ||\n      this.regexp_eatZero(state) ||\n      this.regexp_eatHexEscapeSequence(state) ||\n      this.regexp_eatRegExpUnicodeEscapeSequence(state, false) ||\n      (!state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state)) ||\n      this.regexp_eatIdentityEscape(state)\n    )\n  };\n  pp$1.regexp_eatCControlLetter = function(state) {\n    var start = state.pos;\n    if (state.eat(0x63 /* c */)) {\n      if (this.regexp_eatControlLetter(state)) {\n        return true\n      }\n      state.pos = start;\n    }\n    return false\n  };\n  pp$1.regexp_eatZero = function(state) {\n    if (state.current() === 0x30 /* 0 */ && !isDecimalDigit(state.lookahead())) {\n      state.lastIntValue = 0;\n      state.advance();\n      return true\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-ControlEscape\n  pp$1.regexp_eatControlEscape = function(state) {\n    var ch = state.current();\n    if (ch === 0x74 /* t */) {\n      state.lastIntValue = 0x09; /* \\t */\n      state.advance();\n      return true\n    }\n    if (ch === 0x6E /* n */) {\n      state.lastIntValue = 0x0A; /* \\n */\n      state.advance();\n      return true\n    }\n    if (ch === 0x76 /* v */) {\n      state.lastIntValue = 0x0B; /* \\v */\n      state.advance();\n      return true\n    }\n    if (ch === 0x66 /* f */) {\n      state.lastIntValue = 0x0C; /* \\f */\n      state.advance();\n      return true\n    }\n    if (ch === 0x72 /* r */) {\n      state.lastIntValue = 0x0D; /* \\r */\n      state.advance();\n      return true\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-ControlLetter\n  pp$1.regexp_eatControlLetter = function(state) {\n    var ch = state.current();\n    if (isControlLetter(ch)) {\n      state.lastIntValue = ch % 0x20;\n      state.advance();\n      return true\n    }\n    return false\n  };\n  function isControlLetter(ch) {\n    return (\n      (ch >= 0x41 /* A */ && ch <= 0x5A /* Z */) ||\n      (ch >= 0x61 /* a */ && ch <= 0x7A /* z */)\n    )\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-RegExpUnicodeEscapeSequence\n  pp$1.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {\n    if ( forceU === void 0 ) forceU = false;\n\n    var start = state.pos;\n    var switchU = forceU || state.switchU;\n\n    if (state.eat(0x75 /* u */)) {\n      if (this.regexp_eatFixedHexDigits(state, 4)) {\n        var lead = state.lastIntValue;\n        if (switchU && lead >= 0xD800 && lead <= 0xDBFF) {\n          var leadSurrogateEnd = state.pos;\n          if (state.eat(0x5C /* \\ */) && state.eat(0x75 /* u */) && this.regexp_eatFixedHexDigits(state, 4)) {\n            var trail = state.lastIntValue;\n            if (trail >= 0xDC00 && trail <= 0xDFFF) {\n              state.lastIntValue = (lead - 0xD800) * 0x400 + (trail - 0xDC00) + 0x10000;\n              return true\n            }\n          }\n          state.pos = leadSurrogateEnd;\n          state.lastIntValue = lead;\n        }\n        return true\n      }\n      if (\n        switchU &&\n        state.eat(0x7B /* { */) &&\n        this.regexp_eatHexDigits(state) &&\n        state.eat(0x7D /* } */) &&\n        isValidUnicode(state.lastIntValue)\n      ) {\n        return true\n      }\n      if (switchU) {\n        state.raise(\"Invalid unicode escape\");\n      }\n      state.pos = start;\n    }\n\n    return false\n  };\n  function isValidUnicode(ch) {\n    return ch >= 0 && ch <= 0x10FFFF\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-IdentityEscape\n  pp$1.regexp_eatIdentityEscape = function(state) {\n    if (state.switchU) {\n      if (this.regexp_eatSyntaxCharacter(state)) {\n        return true\n      }\n      if (state.eat(0x2F /* / */)) {\n        state.lastIntValue = 0x2F; /* / */\n        return true\n      }\n      return false\n    }\n\n    var ch = state.current();\n    if (ch !== 0x63 /* c */ && (!state.switchN || ch !== 0x6B /* k */)) {\n      state.lastIntValue = ch;\n      state.advance();\n      return true\n    }\n\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalEscape\n  pp$1.regexp_eatDecimalEscape = function(state) {\n    state.lastIntValue = 0;\n    var ch = state.current();\n    if (ch >= 0x31 /* 1 */ && ch <= 0x39 /* 9 */) {\n      do {\n        state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);\n        state.advance();\n      } while ((ch = state.current()) >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */)\n      return true\n    }\n    return false\n  };\n\n  // Return values used by character set parsing methods, needed to\n  // forbid negation of sets that can match strings.\n  var CharSetNone = 0; // Nothing parsed\n  var CharSetOk = 1; // Construct parsed, cannot contain strings\n  var CharSetString = 2; // Construct parsed, can contain strings\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClassEscape\n  pp$1.regexp_eatCharacterClassEscape = function(state) {\n    var ch = state.current();\n\n    if (isCharacterClassEscape(ch)) {\n      state.lastIntValue = -1;\n      state.advance();\n      return CharSetOk\n    }\n\n    var negate = false;\n    if (\n      state.switchU &&\n      this.options.ecmaVersion >= 9 &&\n      ((negate = ch === 0x50 /* P */) || ch === 0x70 /* p */)\n    ) {\n      state.lastIntValue = -1;\n      state.advance();\n      var result;\n      if (\n        state.eat(0x7B /* { */) &&\n        (result = this.regexp_eatUnicodePropertyValueExpression(state)) &&\n        state.eat(0x7D /* } */)\n      ) {\n        if (negate && result === CharSetString) { state.raise(\"Invalid property name\"); }\n        return result\n      }\n      state.raise(\"Invalid property name\");\n    }\n\n    return CharSetNone\n  };\n\n  function isCharacterClassEscape(ch) {\n    return (\n      ch === 0x64 /* d */ ||\n      ch === 0x44 /* D */ ||\n      ch === 0x73 /* s */ ||\n      ch === 0x53 /* S */ ||\n      ch === 0x77 /* w */ ||\n      ch === 0x57 /* W */\n    )\n  }\n\n  // UnicodePropertyValueExpression ::\n  //   UnicodePropertyName `=` UnicodePropertyValue\n  //   LoneUnicodePropertyNameOrValue\n  pp$1.regexp_eatUnicodePropertyValueExpression = function(state) {\n    var start = state.pos;\n\n    // UnicodePropertyName `=` UnicodePropertyValue\n    if (this.regexp_eatUnicodePropertyName(state) && state.eat(0x3D /* = */)) {\n      var name = state.lastStringValue;\n      if (this.regexp_eatUnicodePropertyValue(state)) {\n        var value = state.lastStringValue;\n        this.regexp_validateUnicodePropertyNameAndValue(state, name, value);\n        return CharSetOk\n      }\n    }\n    state.pos = start;\n\n    // LoneUnicodePropertyNameOrValue\n    if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {\n      var nameOrValue = state.lastStringValue;\n      return this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue)\n    }\n    return CharSetNone\n  };\n\n  pp$1.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {\n    if (!hasOwn(state.unicodeProperties.nonBinary, name))\n      { state.raise(\"Invalid property name\"); }\n    if (!state.unicodeProperties.nonBinary[name].test(value))\n      { state.raise(\"Invalid property value\"); }\n  };\n\n  pp$1.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {\n    if (state.unicodeProperties.binary.test(nameOrValue)) { return CharSetOk }\n    if (state.switchV && state.unicodeProperties.binaryOfStrings.test(nameOrValue)) { return CharSetString }\n    state.raise(\"Invalid property name\");\n  };\n\n  // UnicodePropertyName ::\n  //   UnicodePropertyNameCharacters\n  pp$1.regexp_eatUnicodePropertyName = function(state) {\n    var ch = 0;\n    state.lastStringValue = \"\";\n    while (isUnicodePropertyNameCharacter(ch = state.current())) {\n      state.lastStringValue += codePointToString(ch);\n      state.advance();\n    }\n    return state.lastStringValue !== \"\"\n  };\n\n  function isUnicodePropertyNameCharacter(ch) {\n    return isControlLetter(ch) || ch === 0x5F /* _ */\n  }\n\n  // UnicodePropertyValue ::\n  //   UnicodePropertyValueCharacters\n  pp$1.regexp_eatUnicodePropertyValue = function(state) {\n    var ch = 0;\n    state.lastStringValue = \"\";\n    while (isUnicodePropertyValueCharacter(ch = state.current())) {\n      state.lastStringValue += codePointToString(ch);\n      state.advance();\n    }\n    return state.lastStringValue !== \"\"\n  };\n  function isUnicodePropertyValueCharacter(ch) {\n    return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch)\n  }\n\n  // LoneUnicodePropertyNameOrValue ::\n  //   UnicodePropertyValueCharacters\n  pp$1.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {\n    return this.regexp_eatUnicodePropertyValue(state)\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClass\n  pp$1.regexp_eatCharacterClass = function(state) {\n    if (state.eat(0x5B /* [ */)) {\n      var negate = state.eat(0x5E /* ^ */);\n      var result = this.regexp_classContents(state);\n      if (!state.eat(0x5D /* ] */))\n        { state.raise(\"Unterminated character class\"); }\n      if (negate && result === CharSetString)\n        { state.raise(\"Negated character class may contain strings\"); }\n      return true\n    }\n    return false\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassContents\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-ClassRanges\n  pp$1.regexp_classContents = function(state) {\n    if (state.current() === 0x5D /* ] */) { return CharSetOk }\n    if (state.switchV) { return this.regexp_classSetExpression(state) }\n    this.regexp_nonEmptyClassRanges(state);\n    return CharSetOk\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRanges\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRangesNoDash\n  pp$1.regexp_nonEmptyClassRanges = function(state) {\n    while (this.regexp_eatClassAtom(state)) {\n      var left = state.lastIntValue;\n      if (state.eat(0x2D /* - */) && this.regexp_eatClassAtom(state)) {\n        var right = state.lastIntValue;\n        if (state.switchU && (left === -1 || right === -1)) {\n          state.raise(\"Invalid character class\");\n        }\n        if (left !== -1 && right !== -1 && left > right) {\n          state.raise(\"Range out of order in character class\");\n        }\n      }\n    }\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtom\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtomNoDash\n  pp$1.regexp_eatClassAtom = function(state) {\n    var start = state.pos;\n\n    if (state.eat(0x5C /* \\ */)) {\n      if (this.regexp_eatClassEscape(state)) {\n        return true\n      }\n      if (state.switchU) {\n        // Make the same message as V8.\n        var ch$1 = state.current();\n        if (ch$1 === 0x63 /* c */ || isOctalDigit(ch$1)) {\n          state.raise(\"Invalid class escape\");\n        }\n        state.raise(\"Invalid escape\");\n      }\n      state.pos = start;\n    }\n\n    var ch = state.current();\n    if (ch !== 0x5D /* ] */) {\n      state.lastIntValue = ch;\n      state.advance();\n      return true\n    }\n\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassEscape\n  pp$1.regexp_eatClassEscape = function(state) {\n    var start = state.pos;\n\n    if (state.eat(0x62 /* b */)) {\n      state.lastIntValue = 0x08; /* <BS> */\n      return true\n    }\n\n    if (state.switchU && state.eat(0x2D /* - */)) {\n      state.lastIntValue = 0x2D; /* - */\n      return true\n    }\n\n    if (!state.switchU && state.eat(0x63 /* c */)) {\n      if (this.regexp_eatClassControlLetter(state)) {\n        return true\n      }\n      state.pos = start;\n    }\n\n    return (\n      this.regexp_eatCharacterClassEscape(state) ||\n      this.regexp_eatCharacterEscape(state)\n    )\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassSetExpression\n  // https://tc39.es/ecma262/#prod-ClassUnion\n  // https://tc39.es/ecma262/#prod-ClassIntersection\n  // https://tc39.es/ecma262/#prod-ClassSubtraction\n  pp$1.regexp_classSetExpression = function(state) {\n    var result = CharSetOk, subResult;\n    if (this.regexp_eatClassSetRange(state)) ; else if (subResult = this.regexp_eatClassSetOperand(state)) {\n      if (subResult === CharSetString) { result = CharSetString; }\n      // https://tc39.es/ecma262/#prod-ClassIntersection\n      var start = state.pos;\n      while (state.eatChars([0x26, 0x26] /* && */)) {\n        if (\n          state.current() !== 0x26 /* & */ &&\n          (subResult = this.regexp_eatClassSetOperand(state))\n        ) {\n          if (subResult !== CharSetString) { result = CharSetOk; }\n          continue\n        }\n        state.raise(\"Invalid character in character class\");\n      }\n      if (start !== state.pos) { return result }\n      // https://tc39.es/ecma262/#prod-ClassSubtraction\n      while (state.eatChars([0x2D, 0x2D] /* -- */)) {\n        if (this.regexp_eatClassSetOperand(state)) { continue }\n        state.raise(\"Invalid character in character class\");\n      }\n      if (start !== state.pos) { return result }\n    } else {\n      state.raise(\"Invalid character in character class\");\n    }\n    // https://tc39.es/ecma262/#prod-ClassUnion\n    for (;;) {\n      if (this.regexp_eatClassSetRange(state)) { continue }\n      subResult = this.regexp_eatClassSetOperand(state);\n      if (!subResult) { return result }\n      if (subResult === CharSetString) { result = CharSetString; }\n    }\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassSetRange\n  pp$1.regexp_eatClassSetRange = function(state) {\n    var start = state.pos;\n    if (this.regexp_eatClassSetCharacter(state)) {\n      var left = state.lastIntValue;\n      if (state.eat(0x2D /* - */) && this.regexp_eatClassSetCharacter(state)) {\n        var right = state.lastIntValue;\n        if (left !== -1 && right !== -1 && left > right) {\n          state.raise(\"Range out of order in character class\");\n        }\n        return true\n      }\n      state.pos = start;\n    }\n    return false\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassSetOperand\n  pp$1.regexp_eatClassSetOperand = function(state) {\n    if (this.regexp_eatClassSetCharacter(state)) { return CharSetOk }\n    return this.regexp_eatClassStringDisjunction(state) || this.regexp_eatNestedClass(state)\n  };\n\n  // https://tc39.es/ecma262/#prod-NestedClass\n  pp$1.regexp_eatNestedClass = function(state) {\n    var start = state.pos;\n    if (state.eat(0x5B /* [ */)) {\n      var negate = state.eat(0x5E /* ^ */);\n      var result = this.regexp_classContents(state);\n      if (state.eat(0x5D /* ] */)) {\n        if (negate && result === CharSetString) {\n          state.raise(\"Negated character class may contain strings\");\n        }\n        return result\n      }\n      state.pos = start;\n    }\n    if (state.eat(0x5C /* \\ */)) {\n      var result$1 = this.regexp_eatCharacterClassEscape(state);\n      if (result$1) {\n        return result$1\n      }\n      state.pos = start;\n    }\n    return null\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassStringDisjunction\n  pp$1.regexp_eatClassStringDisjunction = function(state) {\n    var start = state.pos;\n    if (state.eatChars([0x5C, 0x71] /* \\q */)) {\n      if (state.eat(0x7B /* { */)) {\n        var result = this.regexp_classStringDisjunctionContents(state);\n        if (state.eat(0x7D /* } */)) {\n          return result\n        }\n      } else {\n        // Make the same message as V8.\n        state.raise(\"Invalid escape\");\n      }\n      state.pos = start;\n    }\n    return null\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassStringDisjunctionContents\n  pp$1.regexp_classStringDisjunctionContents = function(state) {\n    var result = this.regexp_classString(state);\n    while (state.eat(0x7C /* | */)) {\n      if (this.regexp_classString(state) === CharSetString) { result = CharSetString; }\n    }\n    return result\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassString\n  // https://tc39.es/ecma262/#prod-NonEmptyClassString\n  pp$1.regexp_classString = function(state) {\n    var count = 0;\n    while (this.regexp_eatClassSetCharacter(state)) { count++; }\n    return count === 1 ? CharSetOk : CharSetString\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassSetCharacter\n  pp$1.regexp_eatClassSetCharacter = function(state) {\n    var start = state.pos;\n    if (state.eat(0x5C /* \\ */)) {\n      if (\n        this.regexp_eatCharacterEscape(state) ||\n        this.regexp_eatClassSetReservedPunctuator(state)\n      ) {\n        return true\n      }\n      if (state.eat(0x62 /* b */)) {\n        state.lastIntValue = 0x08; /* <BS> */\n        return true\n      }\n      state.pos = start;\n      return false\n    }\n    var ch = state.current();\n    if (ch < 0 || ch === state.lookahead() && isClassSetReservedDoublePunctuatorCharacter(ch)) { return false }\n    if (isClassSetSyntaxCharacter(ch)) { return false }\n    state.advance();\n    state.lastIntValue = ch;\n    return true\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassSetReservedDoublePunctuator\n  function isClassSetReservedDoublePunctuatorCharacter(ch) {\n    return (\n      ch === 0x21 /* ! */ ||\n      ch >= 0x23 /* # */ && ch <= 0x26 /* & */ ||\n      ch >= 0x2A /* * */ && ch <= 0x2C /* , */ ||\n      ch === 0x2E /* . */ ||\n      ch >= 0x3A /* : */ && ch <= 0x40 /* @ */ ||\n      ch === 0x5E /* ^ */ ||\n      ch === 0x60 /* ` */ ||\n      ch === 0x7E /* ~ */\n    )\n  }\n\n  // https://tc39.es/ecma262/#prod-ClassSetSyntaxCharacter\n  function isClassSetSyntaxCharacter(ch) {\n    return (\n      ch === 0x28 /* ( */ ||\n      ch === 0x29 /* ) */ ||\n      ch === 0x2D /* - */ ||\n      ch === 0x2F /* / */ ||\n      ch >= 0x5B /* [ */ && ch <= 0x5D /* ] */ ||\n      ch >= 0x7B /* { */ && ch <= 0x7D /* } */\n    )\n  }\n\n  // https://tc39.es/ecma262/#prod-ClassSetReservedPunctuator\n  pp$1.regexp_eatClassSetReservedPunctuator = function(state) {\n    var ch = state.current();\n    if (isClassSetReservedPunctuator(ch)) {\n      state.lastIntValue = ch;\n      state.advance();\n      return true\n    }\n    return false\n  };\n\n  // https://tc39.es/ecma262/#prod-ClassSetReservedPunctuator\n  function isClassSetReservedPunctuator(ch) {\n    return (\n      ch === 0x21 /* ! */ ||\n      ch === 0x23 /* # */ ||\n      ch === 0x25 /* % */ ||\n      ch === 0x26 /* & */ ||\n      ch === 0x2C /* , */ ||\n      ch === 0x2D /* - */ ||\n      ch >= 0x3A /* : */ && ch <= 0x3E /* > */ ||\n      ch === 0x40 /* @ */ ||\n      ch === 0x60 /* ` */ ||\n      ch === 0x7E /* ~ */\n    )\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassControlLetter\n  pp$1.regexp_eatClassControlLetter = function(state) {\n    var ch = state.current();\n    if (isDecimalDigit(ch) || ch === 0x5F /* _ */) {\n      state.lastIntValue = ch % 0x20;\n      state.advance();\n      return true\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence\n  pp$1.regexp_eatHexEscapeSequence = function(state) {\n    var start = state.pos;\n    if (state.eat(0x78 /* x */)) {\n      if (this.regexp_eatFixedHexDigits(state, 2)) {\n        return true\n      }\n      if (state.switchU) {\n        state.raise(\"Invalid escape\");\n      }\n      state.pos = start;\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalDigits\n  pp$1.regexp_eatDecimalDigits = function(state) {\n    var start = state.pos;\n    var ch = 0;\n    state.lastIntValue = 0;\n    while (isDecimalDigit(ch = state.current())) {\n      state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);\n      state.advance();\n    }\n    return state.pos !== start\n  };\n  function isDecimalDigit(ch) {\n    return ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigits\n  pp$1.regexp_eatHexDigits = function(state) {\n    var start = state.pos;\n    var ch = 0;\n    state.lastIntValue = 0;\n    while (isHexDigit(ch = state.current())) {\n      state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);\n      state.advance();\n    }\n    return state.pos !== start\n  };\n  function isHexDigit(ch) {\n    return (\n      (ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */) ||\n      (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) ||\n      (ch >= 0x61 /* a */ && ch <= 0x66 /* f */)\n    )\n  }\n  function hexToInt(ch) {\n    if (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) {\n      return 10 + (ch - 0x41 /* A */)\n    }\n    if (ch >= 0x61 /* a */ && ch <= 0x66 /* f */) {\n      return 10 + (ch - 0x61 /* a */)\n    }\n    return ch - 0x30 /* 0 */\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-LegacyOctalEscapeSequence\n  // Allows only 0-377(octal) i.e. 0-255(decimal).\n  pp$1.regexp_eatLegacyOctalEscapeSequence = function(state) {\n    if (this.regexp_eatOctalDigit(state)) {\n      var n1 = state.lastIntValue;\n      if (this.regexp_eatOctalDigit(state)) {\n        var n2 = state.lastIntValue;\n        if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {\n          state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;\n        } else {\n          state.lastIntValue = n1 * 8 + n2;\n        }\n      } else {\n        state.lastIntValue = n1;\n      }\n      return true\n    }\n    return false\n  };\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-OctalDigit\n  pp$1.regexp_eatOctalDigit = function(state) {\n    var ch = state.current();\n    if (isOctalDigit(ch)) {\n      state.lastIntValue = ch - 0x30; /* 0 */\n      state.advance();\n      return true\n    }\n    state.lastIntValue = 0;\n    return false\n  };\n  function isOctalDigit(ch) {\n    return ch >= 0x30 /* 0 */ && ch <= 0x37 /* 7 */\n  }\n\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-Hex4Digits\n  // https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigit\n  // And HexDigit HexDigit in https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence\n  pp$1.regexp_eatFixedHexDigits = function(state, length) {\n    var start = state.pos;\n    state.lastIntValue = 0;\n    for (var i = 0; i < length; ++i) {\n      var ch = state.current();\n      if (!isHexDigit(ch)) {\n        state.pos = start;\n        return false\n      }\n      state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);\n      state.advance();\n    }\n    return true\n  };\n\n  // Object type used to represent tokens. Note that normally, tokens\n  // simply exist as properties on the parser object. This is only\n  // used for the onToken callback and the external tokenizer.\n\n  var Token = function Token(p) {\n    this.type = p.type;\n    this.value = p.value;\n    this.start = p.start;\n    this.end = p.end;\n    if (p.options.locations)\n      { this.loc = new SourceLocation(p, p.startLoc, p.endLoc); }\n    if (p.options.ranges)\n      { this.range = [p.start, p.end]; }\n  };\n\n  // ## Tokenizer\n\n  var pp = Parser.prototype;\n\n  // Move to the next token\n\n  pp.next = function(ignoreEscapeSequenceInKeyword) {\n    if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc)\n      { this.raiseRecoverable(this.start, \"Escape sequence in keyword \" + this.type.keyword); }\n    if (this.options.onToken)\n      { this.options.onToken(new Token(this)); }\n\n    this.lastTokEnd = this.end;\n    this.lastTokStart = this.start;\n    this.lastTokEndLoc = this.endLoc;\n    this.lastTokStartLoc = this.startLoc;\n    this.nextToken();\n  };\n\n  pp.getToken = function() {\n    this.next();\n    return new Token(this)\n  };\n\n  // If we're in an ES6 environment, make parsers iterable\n  if (typeof Symbol !== \"undefined\")\n    { pp[Symbol.iterator] = function() {\n      var this$1$1 = this;\n\n      return {\n        next: function () {\n          var token = this$1$1.getToken();\n          return {\n            done: token.type === types$1.eof,\n            value: token\n          }\n        }\n      }\n    }; }\n\n  // Toggle strict mode. Re-reads the next number or string to please\n  // pedantic tests (`\"use strict\"; 010;` should fail).\n\n  // Read a single token, updating the parser object's token-related\n  // properties.\n\n  pp.nextToken = function() {\n    var curContext = this.curContext();\n    if (!curContext || !curContext.preserveSpace) { this.skipSpace(); }\n\n    this.start = this.pos;\n    if (this.options.locations) { this.startLoc = this.curPosition(); }\n    if (this.pos >= this.input.length) { return this.finishToken(types$1.eof) }\n\n    if (curContext.override) { return curContext.override(this) }\n    else { this.readToken(this.fullCharCodeAtPos()); }\n  };\n\n  pp.readToken = function(code) {\n    // Identifier or keyword. '\\uXXXX' sequences are allowed in\n    // identifiers, so '\\' also dispatches to that.\n    if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\\' */)\n      { return this.readWord() }\n\n    return this.getTokenFromCode(code)\n  };\n\n  pp.fullCharCodeAt = function(pos) {\n    var code = this.input.charCodeAt(pos);\n    if (code <= 0xd7ff || code >= 0xdc00) { return code }\n    var next = this.input.charCodeAt(pos + 1);\n    return next <= 0xdbff || next >= 0xe000 ? code : (code << 10) + next - 0x35fdc00\n  };\n\n  pp.fullCharCodeAtPos = function() {\n    return this.fullCharCodeAt(this.pos)\n  };\n\n  pp.skipBlockComment = function() {\n    var startLoc = this.options.onComment && this.curPosition();\n    var start = this.pos, end = this.input.indexOf(\"*/\", this.pos += 2);\n    if (end === -1) { this.raise(this.pos - 2, \"Unterminated comment\"); }\n    this.pos = end + 2;\n    if (this.options.locations) {\n      for (var nextBreak = (void 0), pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1;) {\n        ++this.curLine;\n        pos = this.lineStart = nextBreak;\n      }\n    }\n    if (this.options.onComment)\n      { this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos,\n                             startLoc, this.curPosition()); }\n  };\n\n  pp.skipLineComment = function(startSkip) {\n    var start = this.pos;\n    var startLoc = this.options.onComment && this.curPosition();\n    var ch = this.input.charCodeAt(this.pos += startSkip);\n    while (this.pos < this.input.length && !isNewLine(ch)) {\n      ch = this.input.charCodeAt(++this.pos);\n    }\n    if (this.options.onComment)\n      { this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos,\n                             startLoc, this.curPosition()); }\n  };\n\n  // Called at the start of the parse and after every token. Skips\n  // whitespace and comments, and.\n\n  pp.skipSpace = function() {\n    loop: while (this.pos < this.input.length) {\n      var ch = this.input.charCodeAt(this.pos);\n      switch (ch) {\n      case 32: case 160: // ' '\n        ++this.pos;\n        break\n      case 13:\n        if (this.input.charCodeAt(this.pos + 1) === 10) {\n          ++this.pos;\n        }\n      case 10: case 8232: case 8233:\n        ++this.pos;\n        if (this.options.locations) {\n          ++this.curLine;\n          this.lineStart = this.pos;\n        }\n        break\n      case 47: // '/'\n        switch (this.input.charCodeAt(this.pos + 1)) {\n        case 42: // '*'\n          this.skipBlockComment();\n          break\n        case 47:\n          this.skipLineComment(2);\n          break\n        default:\n          break loop\n        }\n        break\n      default:\n        if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {\n          ++this.pos;\n        } else {\n          break loop\n        }\n      }\n    }\n  };\n\n  // Called at the end of every token. Sets `end`, `val`, and\n  // maintains `context` and `exprAllowed`, and skips the space after\n  // the token, so that the next one's `start` will point at the\n  // right position.\n\n  pp.finishToken = function(type, val) {\n    this.end = this.pos;\n    if (this.options.locations) { this.endLoc = this.curPosition(); }\n    var prevType = this.type;\n    this.type = type;\n    this.value = val;\n\n    this.updateContext(prevType);\n  };\n\n  // ### Token reading\n\n  // This is the function that is called to fetch the next token. It\n  // is somewhat obscure, because it works in character codes rather\n  // than characters, and because operator parsing has been inlined\n  // into it.\n  //\n  // All in the name of speed.\n  //\n  pp.readToken_dot = function() {\n    var next = this.input.charCodeAt(this.pos + 1);\n    if (next >= 48 && next <= 57) { return this.readNumber(true) }\n    var next2 = this.input.charCodeAt(this.pos + 2);\n    if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) { // 46 = dot '.'\n      this.pos += 3;\n      return this.finishToken(types$1.ellipsis)\n    } else {\n      ++this.pos;\n      return this.finishToken(types$1.dot)\n    }\n  };\n\n  pp.readToken_slash = function() { // '/'\n    var next = this.input.charCodeAt(this.pos + 1);\n    if (this.exprAllowed) { ++this.pos; return this.readRegexp() }\n    if (next === 61) { return this.finishOp(types$1.assign, 2) }\n    return this.finishOp(types$1.slash, 1)\n  };\n\n  pp.readToken_mult_modulo_exp = function(code) { // '%*'\n    var next = this.input.charCodeAt(this.pos + 1);\n    var size = 1;\n    var tokentype = code === 42 ? types$1.star : types$1.modulo;\n\n    // exponentiation operator ** and **=\n    if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {\n      ++size;\n      tokentype = types$1.starstar;\n      next = this.input.charCodeAt(this.pos + 2);\n    }\n\n    if (next === 61) { return this.finishOp(types$1.assign, size + 1) }\n    return this.finishOp(tokentype, size)\n  };\n\n  pp.readToken_pipe_amp = function(code) { // '|&'\n    var next = this.input.charCodeAt(this.pos + 1);\n    if (next === code) {\n      if (this.options.ecmaVersion >= 12) {\n        var next2 = this.input.charCodeAt(this.pos + 2);\n        if (next2 === 61) { return this.finishOp(types$1.assign, 3) }\n      }\n      return this.finishOp(code === 124 ? types$1.logicalOR : types$1.logicalAND, 2)\n    }\n    if (next === 61) { return this.finishOp(types$1.assign, 2) }\n    return this.finishOp(code === 124 ? types$1.bitwiseOR : types$1.bitwiseAND, 1)\n  };\n\n  pp.readToken_caret = function() { // '^'\n    var next = this.input.charCodeAt(this.pos + 1);\n    if (next === 61) { return this.finishOp(types$1.assign, 2) }\n    return this.finishOp(types$1.bitwiseXOR, 1)\n  };\n\n  pp.readToken_plus_min = function(code) { // '+-'\n    var next = this.input.charCodeAt(this.pos + 1);\n    if (next === code) {\n      if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 &&\n          (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {\n        // A `-->` line comment\n        this.skipLineComment(3);\n        this.skipSpace();\n        return this.nextToken()\n      }\n      return this.finishOp(types$1.incDec, 2)\n    }\n    if (next === 61) { return this.finishOp(types$1.assign, 2) }\n    return this.finishOp(types$1.plusMin, 1)\n  };\n\n  pp.readToken_lt_gt = function(code) { // '<>'\n    var next = this.input.charCodeAt(this.pos + 1);\n    var size = 1;\n    if (next === code) {\n      size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;\n      if (this.input.charCodeAt(this.pos + size) === 61) { return this.finishOp(types$1.assign, size + 1) }\n      return this.finishOp(types$1.bitShift, size)\n    }\n    if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 &&\n        this.input.charCodeAt(this.pos + 3) === 45) {\n      // `<!--`, an XML-style comment that should be interpreted as a line comment\n      this.skipLineComment(4);\n      this.skipSpace();\n      return this.nextToken()\n    }\n    if (next === 61) { size = 2; }\n    return this.finishOp(types$1.relational, size)\n  };\n\n  pp.readToken_eq_excl = function(code) { // '=!'\n    var next = this.input.charCodeAt(this.pos + 1);\n    if (next === 61) { return this.finishOp(types$1.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2) }\n    if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) { // '=>'\n      this.pos += 2;\n      return this.finishToken(types$1.arrow)\n    }\n    return this.finishOp(code === 61 ? types$1.eq : types$1.prefix, 1)\n  };\n\n  pp.readToken_question = function() { // '?'\n    var ecmaVersion = this.options.ecmaVersion;\n    if (ecmaVersion >= 11) {\n      var next = this.input.charCodeAt(this.pos + 1);\n      if (next === 46) {\n        var next2 = this.input.charCodeAt(this.pos + 2);\n        if (next2 < 48 || next2 > 57) { return this.finishOp(types$1.questionDot, 2) }\n      }\n      if (next === 63) {\n        if (ecmaVersion >= 12) {\n          var next2$1 = this.input.charCodeAt(this.pos + 2);\n          if (next2$1 === 61) { return this.finishOp(types$1.assign, 3) }\n        }\n        return this.finishOp(types$1.coalesce, 2)\n      }\n    }\n    return this.finishOp(types$1.question, 1)\n  };\n\n  pp.readToken_numberSign = function() { // '#'\n    var ecmaVersion = this.options.ecmaVersion;\n    var code = 35; // '#'\n    if (ecmaVersion >= 13) {\n      ++this.pos;\n      code = this.fullCharCodeAtPos();\n      if (isIdentifierStart(code, true) || code === 92 /* '\\' */) {\n        return this.finishToken(types$1.privateId, this.readWord1())\n      }\n    }\n\n    this.raise(this.pos, \"Unexpected character '\" + codePointToString(code) + \"'\");\n  };\n\n  pp.getTokenFromCode = function(code) {\n    switch (code) {\n    // The interpretation of a dot depends on whether it is followed\n    // by a digit or another two dots.\n    case 46: // '.'\n      return this.readToken_dot()\n\n    // Punctuation tokens.\n    case 40: ++this.pos; return this.finishToken(types$1.parenL)\n    case 41: ++this.pos; return this.finishToken(types$1.parenR)\n    case 59: ++this.pos; return this.finishToken(types$1.semi)\n    case 44: ++this.pos; return this.finishToken(types$1.comma)\n    case 91: ++this.pos; return this.finishToken(types$1.bracketL)\n    case 93: ++this.pos; return this.finishToken(types$1.bracketR)\n    case 123: ++this.pos; return this.finishToken(types$1.braceL)\n    case 125: ++this.pos; return this.finishToken(types$1.braceR)\n    case 58: ++this.pos; return this.finishToken(types$1.colon)\n\n    case 96: // '`'\n      if (this.options.ecmaVersion < 6) { break }\n      ++this.pos;\n      return this.finishToken(types$1.backQuote)\n\n    case 48: // '0'\n      var next = this.input.charCodeAt(this.pos + 1);\n      if (next === 120 || next === 88) { return this.readRadixNumber(16) } // '0x', '0X' - hex number\n      if (this.options.ecmaVersion >= 6) {\n        if (next === 111 || next === 79) { return this.readRadixNumber(8) } // '0o', '0O' - octal number\n        if (next === 98 || next === 66) { return this.readRadixNumber(2) } // '0b', '0B' - binary number\n      }\n\n    // Anything else beginning with a digit is an integer, octal\n    // number, or float.\n    case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9\n      return this.readNumber(false)\n\n    // Quotes produce strings.\n    case 34: case 39: // '\"', \"'\"\n      return this.readString(code)\n\n    // Operators are parsed inline in tiny state machines. '=' (61) is\n    // often referred to. `finishOp` simply skips the amount of\n    // characters it is given as second argument, and returns a token\n    // of the type given by its first argument.\n    case 47: // '/'\n      return this.readToken_slash()\n\n    case 37: case 42: // '%*'\n      return this.readToken_mult_modulo_exp(code)\n\n    case 124: case 38: // '|&'\n      return this.readToken_pipe_amp(code)\n\n    case 94: // '^'\n      return this.readToken_caret()\n\n    case 43: case 45: // '+-'\n      return this.readToken_plus_min(code)\n\n    case 60: case 62: // '<>'\n      return this.readToken_lt_gt(code)\n\n    case 61: case 33: // '=!'\n      return this.readToken_eq_excl(code)\n\n    case 63: // '?'\n      return this.readToken_question()\n\n    case 126: // '~'\n      return this.finishOp(types$1.prefix, 1)\n\n    case 35: // '#'\n      return this.readToken_numberSign()\n    }\n\n    this.raise(this.pos, \"Unexpected character '\" + codePointToString(code) + \"'\");\n  };\n\n  pp.finishOp = function(type, size) {\n    var str = this.input.slice(this.pos, this.pos + size);\n    this.pos += size;\n    return this.finishToken(type, str)\n  };\n\n  pp.readRegexp = function() {\n    var escaped, inClass, start = this.pos;\n    for (;;) {\n      if (this.pos >= this.input.length) { this.raise(start, \"Unterminated regular expression\"); }\n      var ch = this.input.charAt(this.pos);\n      if (lineBreak.test(ch)) { this.raise(start, \"Unterminated regular expression\"); }\n      if (!escaped) {\n        if (ch === \"[\") { inClass = true; }\n        else if (ch === \"]\" && inClass) { inClass = false; }\n        else if (ch === \"/\" && !inClass) { break }\n        escaped = ch === \"\\\\\";\n      } else { escaped = false; }\n      ++this.pos;\n    }\n    var pattern = this.input.slice(start, this.pos);\n    ++this.pos;\n    var flagsStart = this.pos;\n    var flags = this.readWord1();\n    if (this.containsEsc) { this.unexpected(flagsStart); }\n\n    // Validate pattern\n    var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));\n    state.reset(start, pattern, flags);\n    this.validateRegExpFlags(state);\n    this.validateRegExpPattern(state);\n\n    // Create Literal#value property value.\n    var value = null;\n    try {\n      value = new RegExp(pattern, flags);\n    } catch (e) {\n      // ESTree requires null if it failed to instantiate RegExp object.\n      // https://github.com/estree/estree/blob/a27003adf4fd7bfad44de9cef372a2eacd527b1c/es5.md#regexpliteral\n    }\n\n    return this.finishToken(types$1.regexp, {pattern: pattern, flags: flags, value: value})\n  };\n\n  // Read an integer in the given radix. Return null if zero digits\n  // were read, the integer value otherwise. When `len` is given, this\n  // will return `null` unless the integer has exactly `len` digits.\n\n  pp.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {\n    // `len` is used for character escape sequences. In that case, disallow separators.\n    var allowSeparators = this.options.ecmaVersion >= 12 && len === undefined;\n\n    // `maybeLegacyOctalNumericLiteral` is true if it doesn't have prefix (0x,0o,0b)\n    // and isn't fraction part nor exponent part. In that case, if the first digit\n    // is zero then disallow separators.\n    var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;\n\n    var start = this.pos, total = 0, lastCode = 0;\n    for (var i = 0, e = len == null ? Infinity : len; i < e; ++i, ++this.pos) {\n      var code = this.input.charCodeAt(this.pos), val = (void 0);\n\n      if (allowSeparators && code === 95) {\n        if (isLegacyOctalNumericLiteral) { this.raiseRecoverable(this.pos, \"Numeric separator is not allowed in legacy octal numeric literals\"); }\n        if (lastCode === 95) { this.raiseRecoverable(this.pos, \"Numeric separator must be exactly one underscore\"); }\n        if (i === 0) { this.raiseRecoverable(this.pos, \"Numeric separator is not allowed at the first of digits\"); }\n        lastCode = code;\n        continue\n      }\n\n      if (code >= 97) { val = code - 97 + 10; } // a\n      else if (code >= 65) { val = code - 65 + 10; } // A\n      else if (code >= 48 && code <= 57) { val = code - 48; } // 0-9\n      else { val = Infinity; }\n      if (val >= radix) { break }\n      lastCode = code;\n      total = total * radix + val;\n    }\n\n    if (allowSeparators && lastCode === 95) { this.raiseRecoverable(this.pos - 1, \"Numeric separator is not allowed at the last of digits\"); }\n    if (this.pos === start || len != null && this.pos - start !== len) { return null }\n\n    return total\n  };\n\n  function stringToNumber(str, isLegacyOctalNumericLiteral) {\n    if (isLegacyOctalNumericLiteral) {\n      return parseInt(str, 8)\n    }\n\n    // `parseFloat(value)` stops parsing at the first numeric separator then returns a wrong value.\n    return parseFloat(str.replace(/_/g, \"\"))\n  }\n\n  function stringToBigInt(str) {\n    if (typeof BigInt !== \"function\") {\n      return null\n    }\n\n    // `BigInt(value)` throws syntax error if the string contains numeric separators.\n    return BigInt(str.replace(/_/g, \"\"))\n  }\n\n  pp.readRadixNumber = function(radix) {\n    var start = this.pos;\n    this.pos += 2; // 0x\n    var val = this.readInt(radix);\n    if (val == null) { this.raise(this.start + 2, \"Expected number in radix \" + radix); }\n    if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {\n      val = stringToBigInt(this.input.slice(start, this.pos));\n      ++this.pos;\n    } else if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, \"Identifier directly after number\"); }\n    return this.finishToken(types$1.num, val)\n  };\n\n  // Read an integer, octal integer, or floating-point number.\n\n  pp.readNumber = function(startsWithDot) {\n    var start = this.pos;\n    if (!startsWithDot && this.readInt(10, undefined, true) === null) { this.raise(start, \"Invalid number\"); }\n    var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;\n    if (octal && this.strict) { this.raise(start, \"Invalid number\"); }\n    var next = this.input.charCodeAt(this.pos);\n    if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {\n      var val$1 = stringToBigInt(this.input.slice(start, this.pos));\n      ++this.pos;\n      if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, \"Identifier directly after number\"); }\n      return this.finishToken(types$1.num, val$1)\n    }\n    if (octal && /[89]/.test(this.input.slice(start, this.pos))) { octal = false; }\n    if (next === 46 && !octal) { // '.'\n      ++this.pos;\n      this.readInt(10);\n      next = this.input.charCodeAt(this.pos);\n    }\n    if ((next === 69 || next === 101) && !octal) { // 'eE'\n      next = this.input.charCodeAt(++this.pos);\n      if (next === 43 || next === 45) { ++this.pos; } // '+-'\n      if (this.readInt(10) === null) { this.raise(start, \"Invalid number\"); }\n    }\n    if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, \"Identifier directly after number\"); }\n\n    var val = stringToNumber(this.input.slice(start, this.pos), octal);\n    return this.finishToken(types$1.num, val)\n  };\n\n  // Read a string value, interpreting backslash-escapes.\n\n  pp.readCodePoint = function() {\n    var ch = this.input.charCodeAt(this.pos), code;\n\n    if (ch === 123) { // '{'\n      if (this.options.ecmaVersion < 6) { this.unexpected(); }\n      var codePos = ++this.pos;\n      code = this.readHexChar(this.input.indexOf(\"}\", this.pos) - this.pos);\n      ++this.pos;\n      if (code > 0x10FFFF) { this.invalidStringToken(codePos, \"Code point out of bounds\"); }\n    } else {\n      code = this.readHexChar(4);\n    }\n    return code\n  };\n\n  pp.readString = function(quote) {\n    var out = \"\", chunkStart = ++this.pos;\n    for (;;) {\n      if (this.pos >= this.input.length) { this.raise(this.start, \"Unterminated string constant\"); }\n      var ch = this.input.charCodeAt(this.pos);\n      if (ch === quote) { break }\n      if (ch === 92) { // '\\'\n        out += this.input.slice(chunkStart, this.pos);\n        out += this.readEscapedChar(false);\n        chunkStart = this.pos;\n      } else if (ch === 0x2028 || ch === 0x2029) {\n        if (this.options.ecmaVersion < 10) { this.raise(this.start, \"Unterminated string constant\"); }\n        ++this.pos;\n        if (this.options.locations) {\n          this.curLine++;\n          this.lineStart = this.pos;\n        }\n      } else {\n        if (isNewLine(ch)) { this.raise(this.start, \"Unterminated string constant\"); }\n        ++this.pos;\n      }\n    }\n    out += this.input.slice(chunkStart, this.pos++);\n    return this.finishToken(types$1.string, out)\n  };\n\n  // Reads template string tokens.\n\n  var INVALID_TEMPLATE_ESCAPE_ERROR = {};\n\n  pp.tryReadTemplateToken = function() {\n    this.inTemplateElement = true;\n    try {\n      this.readTmplToken();\n    } catch (err) {\n      if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {\n        this.readInvalidTemplateToken();\n      } else {\n        throw err\n      }\n    }\n\n    this.inTemplateElement = false;\n  };\n\n  pp.invalidStringToken = function(position, message) {\n    if (this.inTemplateElement && this.options.ecmaVersion >= 9) {\n      throw INVALID_TEMPLATE_ESCAPE_ERROR\n    } else {\n      this.raise(position, message);\n    }\n  };\n\n  pp.readTmplToken = function() {\n    var out = \"\", chunkStart = this.pos;\n    for (;;) {\n      if (this.pos >= this.input.length) { this.raise(this.start, \"Unterminated template\"); }\n      var ch = this.input.charCodeAt(this.pos);\n      if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) { // '`', '${'\n        if (this.pos === this.start && (this.type === types$1.template || this.type === types$1.invalidTemplate)) {\n          if (ch === 36) {\n            this.pos += 2;\n            return this.finishToken(types$1.dollarBraceL)\n          } else {\n            ++this.pos;\n            return this.finishToken(types$1.backQuote)\n          }\n        }\n        out += this.input.slice(chunkStart, this.pos);\n        return this.finishToken(types$1.template, out)\n      }\n      if (ch === 92) { // '\\'\n        out += this.input.slice(chunkStart, this.pos);\n        out += this.readEscapedChar(true);\n        chunkStart = this.pos;\n      } else if (isNewLine(ch)) {\n        out += this.input.slice(chunkStart, this.pos);\n        ++this.pos;\n        switch (ch) {\n        case 13:\n          if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; }\n        case 10:\n          out += \"\\n\";\n          break\n        default:\n          out += String.fromCharCode(ch);\n          break\n        }\n        if (this.options.locations) {\n          ++this.curLine;\n          this.lineStart = this.pos;\n        }\n        chunkStart = this.pos;\n      } else {\n        ++this.pos;\n      }\n    }\n  };\n\n  // Reads a template token to search for the end, without validating any escape sequences\n  pp.readInvalidTemplateToken = function() {\n    for (; this.pos < this.input.length; this.pos++) {\n      switch (this.input[this.pos]) {\n      case \"\\\\\":\n        ++this.pos;\n        break\n\n      case \"$\":\n        if (this.input[this.pos + 1] !== \"{\") { break }\n        // fall through\n      case \"`\":\n        return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos))\n\n      case \"\\r\":\n        if (this.input[this.pos + 1] === \"\\n\") { ++this.pos; }\n        // fall through\n      case \"\\n\": case \"\\u2028\": case \"\\u2029\":\n        ++this.curLine;\n        this.lineStart = this.pos + 1;\n        break\n      }\n    }\n    this.raise(this.start, \"Unterminated template\");\n  };\n\n  // Used to read escaped characters\n\n  pp.readEscapedChar = function(inTemplate) {\n    var ch = this.input.charCodeAt(++this.pos);\n    ++this.pos;\n    switch (ch) {\n    case 110: return \"\\n\" // 'n' -> '\\n'\n    case 114: return \"\\r\" // 'r' -> '\\r'\n    case 120: return String.fromCharCode(this.readHexChar(2)) // 'x'\n    case 117: return codePointToString(this.readCodePoint()) // 'u'\n    case 116: return \"\\t\" // 't' -> '\\t'\n    case 98: return \"\\b\" // 'b' -> '\\b'\n    case 118: return \"\\u000b\" // 'v' -> '\\u000b'\n    case 102: return \"\\f\" // 'f' -> '\\f'\n    case 13: if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; } // '\\r\\n'\n    case 10: // ' \\n'\n      if (this.options.locations) { this.lineStart = this.pos; ++this.curLine; }\n      return \"\"\n    case 56:\n    case 57:\n      if (this.strict) {\n        this.invalidStringToken(\n          this.pos - 1,\n          \"Invalid escape sequence\"\n        );\n      }\n      if (inTemplate) {\n        var codePos = this.pos - 1;\n\n        this.invalidStringToken(\n          codePos,\n          \"Invalid escape sequence in template string\"\n        );\n      }\n    default:\n      if (ch >= 48 && ch <= 55) {\n        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];\n        var octal = parseInt(octalStr, 8);\n        if (octal > 255) {\n          octalStr = octalStr.slice(0, -1);\n          octal = parseInt(octalStr, 8);\n        }\n        this.pos += octalStr.length - 1;\n        ch = this.input.charCodeAt(this.pos);\n        if ((octalStr !== \"0\" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {\n          this.invalidStringToken(\n            this.pos - 1 - octalStr.length,\n            inTemplate\n              ? \"Octal literal in template string\"\n              : \"Octal literal in strict mode\"\n          );\n        }\n        return String.fromCharCode(octal)\n      }\n      if (isNewLine(ch)) {\n        // Unicode new line characters after \\ get removed from output in both\n        // template literals and strings\n        if (this.options.locations) { this.lineStart = this.pos; ++this.curLine; }\n        return \"\"\n      }\n      return String.fromCharCode(ch)\n    }\n  };\n\n  // Used to read character escape sequences ('\\x', '\\u', '\\U').\n\n  pp.readHexChar = function(len) {\n    var codePos = this.pos;\n    var n = this.readInt(16, len);\n    if (n === null) { this.invalidStringToken(codePos, \"Bad character escape sequence\"); }\n    return n\n  };\n\n  // Read an identifier, and return it as a string. Sets `this.containsEsc`\n  // to whether the word contained a '\\u' escape.\n  //\n  // Incrementally adds only escaped chars, adding other chunks as-is\n  // as a micro-optimization.\n\n  pp.readWord1 = function() {\n    this.containsEsc = false;\n    var word = \"\", first = true, chunkStart = this.pos;\n    var astral = this.options.ecmaVersion >= 6;\n    while (this.pos < this.input.length) {\n      var ch = this.fullCharCodeAtPos();\n      if (isIdentifierChar(ch, astral)) {\n        this.pos += ch <= 0xffff ? 1 : 2;\n      } else if (ch === 92) { // \"\\\"\n        this.containsEsc = true;\n        word += this.input.slice(chunkStart, this.pos);\n        var escStart = this.pos;\n        if (this.input.charCodeAt(++this.pos) !== 117) // \"u\"\n          { this.invalidStringToken(this.pos, \"Expecting Unicode escape sequence \\\\uXXXX\"); }\n        ++this.pos;\n        var esc = this.readCodePoint();\n        if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))\n          { this.invalidStringToken(escStart, \"Invalid Unicode escape\"); }\n        word += codePointToString(esc);\n        chunkStart = this.pos;\n      } else {\n        break\n      }\n      first = false;\n    }\n    return word + this.input.slice(chunkStart, this.pos)\n  };\n\n  // Read an identifier or keyword token. Will check for reserved\n  // words when necessary.\n\n  pp.readWord = function() {\n    var word = this.readWord1();\n    var type = types$1.name;\n    if (this.keywords.test(word)) {\n      type = keywords[word];\n    }\n    return this.finishToken(type, word)\n  };\n\n  // Acorn is a tiny, fast JavaScript parser written in JavaScript.\n  //\n  // Acorn was written by Marijn Haverbeke, Ingvar Stepanyan, and\n  // various contributors and released under an MIT license.\n  //\n  // Git repositories for Acorn are available at\n  //\n  //     http://marijnhaverbeke.nl/git/acorn\n  //     https://github.com/acornjs/acorn.git\n  //\n  // Please use the [github bug tracker][ghbt] to report issues.\n  //\n  // [ghbt]: https://github.com/acornjs/acorn/issues\n\n\n  var version = \"8.17.0\";\n\n  Parser.acorn = {\n    Parser: Parser,\n    version: version,\n    defaultOptions: defaultOptions,\n    Position: Position,\n    SourceLocation: SourceLocation,\n    getLineInfo: getLineInfo,\n    Node: Node,\n    TokenType: TokenType,\n    tokTypes: types$1,\n    keywordTypes: keywords,\n    TokContext: TokContext,\n    tokContexts: types,\n    isIdentifierChar: isIdentifierChar,\n    isIdentifierStart: isIdentifierStart,\n    Token: Token,\n    isNewLine: isNewLine,\n    lineBreak: lineBreak,\n    lineBreakG: lineBreakG,\n    nonASCIIwhitespace: nonASCIIwhitespace\n  };\n\n  // The main exported interface (under `self.acorn` when in the\n  // browser) is a `parse` function that takes a code string and returns\n  // an abstract syntax tree as specified by the [ESTree spec][estree].\n  //\n  // [estree]: https://github.com/estree/estree\n\n  function parse(input, options) {\n    return Parser.parse(input, options)\n  }\n\n  // This function tries to parse a single expression at a given\n  // offset in a string. Useful for parsing mixed-language formats\n  // that embed JavaScript expressions.\n\n  function parseExpressionAt(input, pos, options) {\n    return Parser.parseExpressionAt(input, pos, options)\n  }\n\n  // Acorn is organized as a tokenizer and a recursive-descent parser.\n  // The `tokenizer` export provides an interface to the tokenizer.\n\n  function tokenizer(input, options) {\n    return Parser.tokenizer(input, options)\n  }\n\n  exports.Node = Node;\n  exports.Parser = Parser;\n  exports.Position = Position;\n  exports.SourceLocation = SourceLocation;\n  exports.TokContext = TokContext;\n  exports.Token = Token;\n  exports.TokenType = TokenType;\n  exports.defaultOptions = defaultOptions;\n  exports.getLineInfo = getLineInfo;\n  exports.isIdentifierChar = isIdentifierChar;\n  exports.isIdentifierStart = isIdentifierStart;\n  exports.isNewLine = isNewLine;\n  exports.keywordTypes = keywords;\n  exports.lineBreak = lineBreak;\n  exports.lineBreakG = lineBreakG;\n  exports.nonASCIIwhitespace = nonASCIIwhitespace;\n  exports.parse = parse;\n  exports.parseExpressionAt = parseExpressionAt;\n  exports.tokContexts = types;\n  exports.tokTypes = types$1;\n  exports.tokenizer = tokenizer;\n  exports.version = version;\n\n}));\n\n  return (function createMetadataTransformer(acorn) {\n  const MAX_SOURCE_LENGTH = 1500000;\n  const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);\n  const REACT_HOOKS = new Set(['useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer', 'useSyncExternalStore']);\n  const CONTENT_KEYS = ['context_truncation_continuation', 'getRenderTelemetry', 'isStreaming'];\n  const MESSAGE_MARKERS = ['copyPlainTextFromSource', 'suppressCopyTurnToClipboardAnalytics', 'getCopyHtml'];\n  const USER_KEYS = ['item', 'items', 'isMostRecentTurn', 'isReadOnly'];\n  const ASSISTANT_KEYS = ['assistantItem', 'additionalTurnActions', 'actionRowRef'];\n  const OPTIONS = { ecmaVersion: 'latest', sourceType: 'script' };\n\n  function children(node) {\n    const result = [];\n    for (const key of Object.keys(node)) {\n      const value = node[key];\n      if (value && typeof value.type === 'string') result.push(value);\n      else if (Array.isArray(value)) for (const item of value) if (item && typeof item.type === 'string') result.push(item);\n    }\n    return result;\n  }\n\n  function parseFactory(source) {\n    for (const [prefix, suffix, method] of [['(', ')', false], ['({', '})', true]]) {\n      try {\n        const ast = acorn.parse(prefix + source + suffix, OPTIONS);\n        if (ast.body.length !== 1 || ast.body[0].type !== 'ExpressionStatement') continue;\n        let factory = ast.body[0].expression;\n        let methodKey = null;\n        if (method) {\n          if (factory.type !== 'ObjectExpression' || factory.properties.length !== 1) continue;\n          const property = factory.properties[0];\n          if (property.type !== 'Property' || !property.method || property.computed || property.kind !== 'init') continue;\n          methodKey = property.key.type === 'Identifier' ? property.key.name : property.key.value;\n          if (!['string', 'number'].includes(typeof methodKey)) continue;\n          factory = property.value;\n        }\n        if (!FUNCTION_TYPES.has(factory.type) || factory.async || factory.generator || factory.body.type !== 'BlockStatement') continue;\n        if (factory.params.length !== 3 || factory.params.some(param => param.type !== 'Identifier')) continue;\n        return { factory, offset: prefix.length, methodKey };\n      } catch (_) {\n        // Function#toString() can return either an expression or a method body.\n      }\n    }\n    return null;\n  }\n\n  function staticKey(node) {\n    if (!node) return null;\n    if ((node.type === 'Property' || node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') && !node.computed) {\n      return node.key.type === 'Identifier' ? node.key.name : typeof node.key.value === 'string' ? node.key.value : null;\n    }\n    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') return node.property.name;\n    if (node.type === 'MemberExpression' && node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') return node.property.value;\n    return null;\n  }\n\n  function plainCallee(node) {\n    if (node && node.type === 'SequenceExpression' && node.expressions.length === 2 && node.expressions[0].type === 'Literal' && node.expressions[0].value === 0) return node.expressions[1];\n    return node;\n  }\n\n  function analyze(factory) {\n    const scopes = new WeakMap();\n    const parents = new WeakMap();\n    const nodes = [];\n    const allBindings = [];\n    let unsafe = false;\n    function makeScope(parent, kind, owner) { return { parent, kind, owner, bindings: new Map() }; }\n    const root = makeScope(null, 'function', factory);\n    let bodyScope;\n    function bind(scope, identifier, kind, declaration, initializer) {\n      if (!identifier || identifier.type !== 'Identifier') return;\n      let binding = scope.bindings.get(identifier.name);\n      if (!binding) {\n        binding = { name: identifier.name, scope, kind, declaration, initializer, declarations: [], writes: [] };\n        scope.bindings.set(identifier.name, binding);\n        allBindings.push(binding);\n      }\n      binding.declarations.push({ identifier, kind, declaration, initializer });\n      scopes.set(identifier, scope);\n    }\n    function pattern(scope, node, kind, declaration, initializer) {\n      if (!node) return;\n      if (node.type === 'Identifier') bind(scope, node, kind, declaration, initializer);\n      else if (node.type === 'RestElement') pattern(scope, node.argument, kind, declaration, null);\n      else if (node.type === 'AssignmentPattern') pattern(scope, node.left, kind, declaration, null);\n      else if (node.type === 'ArrayPattern') for (const element of node.elements) pattern(scope, element, kind, declaration, null);\n      else if (node.type === 'ObjectPattern') for (const property of node.properties) pattern(scope, property.type === 'RestElement' ? property.argument : property.value, kind, declaration, null);\n    }\n    function visit(node, scope, parent) {\n      nodes.push(node);\n      parents.set(node, parent);\n      scopes.set(node, scope);\n      if (node.type === 'WithStatement' || node.type === 'ClassDeclaration' || node.type === 'ClassExpression') unsafe = true;\n      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'eval') unsafe = true;\n      if (FUNCTION_TYPES.has(node.type)) {\n        if (node !== factory && node.type === 'FunctionDeclaration' && node.id) bind(scope, node.id, 'function', node, node);\n        const inner = node === factory ? root : makeScope(scope, 'function', node);\n        scopes.set(node, inner);\n        if (node !== factory && node.type === 'FunctionExpression' && node.id) bind(inner, node.id, 'self', node, node);\n        for (const param of node.params) pattern(inner, param, 'param', node, null);\n        for (const param of node.params) visit(param, inner, node);\n        visit(node.body, inner, node);\n        return;\n      }\n      if (node.type === 'BlockStatement' || node.type === 'CatchClause' || node.type === 'SwitchStatement' || node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {\n        const inner = makeScope(scope, 'block', scope.owner);\n        scopes.set(node, inner);\n        if (node === factory.body) bodyScope = inner;\n        if (node.type === 'CatchClause') pattern(inner, node.param, 'catch', node, null);\n        for (const child of children(node)) visit(child, inner, node);\n        return;\n      }\n      if (node.type === 'VariableDeclaration') {\n        let target = scope;\n        if (node.kind === 'var') while (target.parent && target.kind !== 'function') target = target.parent;\n        for (const declaration of node.declarations) pattern(target, declaration.id, node.kind, declaration, declaration.init);\n      }\n      if (node.type === 'ClassDeclaration' && node.id) bind(scope, node.id, 'class', node, node);\n      for (const child of children(node)) visit(child, scope, node);\n    }\n    visit(factory, root, null);\n    function resolve(node) {\n      if (!node || node.type !== 'Identifier') return null;\n      return resolveName(scopes.get(node), node.name);\n    }\n    function resolveName(scope, name) {\n      for (let current = scope; current; current = current.parent) if (current.bindings.has(name)) return current.bindings.get(name);\n      return null;\n    }\n    function writePattern(node, write) {\n      if (!node) return;\n      if (node.type === 'Identifier') { const binding = resolve(node); if (binding) binding.writes.push(write); }\n      else if (node.type === 'ArrayPattern') for (const item of node.elements) writePattern(item, write);\n      else if (node.type === 'ObjectPattern') for (const property of node.properties) writePattern(property.type === 'RestElement' ? property.argument : property.value, write);\n      else if (node.type === 'AssignmentPattern') writePattern(node.left, write);\n      else if (node.type === 'RestElement') writePattern(node.argument, write);\n    }\n    for (const binding of allBindings) for (const declaration of binding.declarations) if (declaration.initializer) binding.writes.push({ node: declaration.declaration, value: declaration.initializer, kind: 'initial' });\n    for (const node of nodes) {\n      if (node.type === 'AssignmentExpression') writePattern(node.left, { node, value: node.right, kind: node.operator === '=' ? 'assign' : 'other' });\n      if (node.type === 'UpdateExpression') writePattern(node.argument, { node, value: null, kind: 'other' });\n      if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') if (node.left.type !== 'VariableDeclaration') writePattern(node.left, { node, value: null, kind: 'other' });\n    }\n    const requireBinding = resolve(factory.params[2]);\n    const exportsBinding = resolve(factory.params[1]);\n    function atFactory(binding) { return binding && (binding.scope === root || binding.scope === bodyScope); }\n    function directDeclaration(binding) {\n      const declaration = binding.declaration;\n      const statement = declaration.type === 'VariableDeclarator' ? parents.get(declaration) : declaration;\n      return statement && parents.get(statement) === factory.body;\n    }\n    function imported(binding) {\n      if (!atFactory(binding) || !directDeclaration(binding) || binding.declarations.length !== 1 || binding.writes.length !== 1) return false;\n      const call = binding.initializer;\n      return call && call.type === 'CallExpression' && !call.optional && call.callee.type === 'Identifier' && resolve(call.callee) === requireBinding && call.arguments.length === 1 && call.arguments[0].type === 'Literal' && ['string', 'number'].includes(typeof call.arguments[0].value);\n    }\n    function nativeFunction(binding) {\n      return atFactory(binding) && directDeclaration(binding) && binding.declarations.length === 1 && binding.writes.length === 1 && ['function', 'var', 'let'].includes(binding.kind) && binding.initializer && FUNCTION_TYPES.has(binding.initializer.type) && !binding.initializer.async && !binding.initializer.generator;\n    }\n    return { nodes, scopes, parents, root, bodyScope, resolve, resolveName, requireBinding, exportsBinding, atFactory, imported, nativeFunction, unsafe };\n  }\n\n  function objectProperties(node, keys) {\n    if (!node || node.type !== 'ObjectExpression') return false;\n    const properties = node.properties.filter(property => property.type === 'Property' && property.kind === 'init' && !property.computed);\n    return keys.every(key => properties.filter(property => staticKey(property) === key).length === 1);\n  }\n\n  function validateBridge(expression, info, insertionScopes) {\n    if (typeof expression !== 'string' || !expression || expression.length > 300) return null;\n    try {\n      const ast = acorn.parse('(' + expression + ')', OPTIONS);\n      if (ast.body.length !== 1 || ast.body[0].type !== 'ExpressionStatement') return null;\n      let node = ast.body[0].expression;\n      while (node.type === 'MemberExpression' && !node.optional) {\n        if (node.computed && !(node.property.type === 'Literal' && ['string', 'number'].includes(typeof node.property.value))) return null;\n        if (!node.computed && node.property.type !== 'Identifier') return null;\n        node = node.object;\n      }\n      if (node.type !== 'Identifier') return null;\n      // A module-local alias named like the bridge cannot redirect our calls.\n      if (insertionScopes.some(scope => info.resolveName(scope, node.name))) return null;\n      return '(' + expression + ')';\n    } catch (_) { return null; }\n  }\n\n  function uniqueReact(info, hookNames) {\n    const bindings = new Set();\n    for (const node of info.nodes) {\n      if (node.type !== 'CallExpression' || node.optional) continue;\n      const callee = plainCallee(node.callee);\n      if (!callee || callee.type !== 'MemberExpression' || callee.optional || !hookNames.has(staticKey(callee)) || callee.object.type !== 'Identifier') continue;\n      const binding = info.resolve(callee.object);\n      if (info.imported(binding)) bindings.add(binding);\n    }\n    return [...bindings];\n  }\n\n  function mappingPlan(info) {\n    const properties = info.nodes.filter(node => node.type === 'Property' && node.kind === 'init' && !node.computed && staticKey(node) === 'mapping' && info.parents.get(node).type === 'ObjectExpression');\n    if (properties.length !== 1 || properties[0].value.type !== 'Identifier') return { reason: 'ambiguous-mapping' };\n    const property = properties[0];\n    const binding = info.resolve(property.value);\n    if (!binding || binding.declarations.length !== 1 || binding.writes.length !== 1) return { reason: 'unsupported-mapping-binding' };\n    const write = binding.writes[0];\n    if (!['initial', 'assign'].includes(write.kind)) return { reason: 'unsupported-mapping-assignment' };\n    const call = write.value;\n    if (!call || call.type !== 'CallExpression' || call.optional || call.callee.type !== 'Identifier' || call.arguments.length !== 2 || !info.resolve(call.callee)) return { reason: 'unsupported-mapping-call' };\n    const [selector, conversation] = call.arguments;\n    if (selector.type !== 'MemberExpression' || selector.computed || selector.optional || selector.object.type !== 'Identifier' || selector.property.type !== 'Identifier' || !info.imported(info.resolve(selector.object))) return { reason: 'unsupported-mapping-selector' };\n    const conversationBinding = info.resolve(conversation);\n    if (conversation.type !== 'Identifier' || !conversationBinding || conversationBinding.kind !== 'param' || conversationBinding.declarations.length !== 1 || conversationBinding.writes.length || conversationBinding.scope.owner !== info.scopes.get(call).owner) return { reason: 'unsupported-conversation-argument' };\n    // Reading the identifier after get() is safe only if get cannot change its\n    // value through a captured assignment or sloppy-mode arguments aliasing.\n    const owner = conversationBinding.scope.owner;\n    if (info.nodes.some(node => node.start >= owner.start && node.end <= owner.end && node.type === 'Identifier' && node.name === 'arguments')) return { reason: 'unsupported-conversation-arguments-alias' };\n    if (info.scopes.get(property).owner !== info.scopes.get(call).owner) return { reason: 'mapping-crosses-function-boundary' };\n    return { kind: 'mapping', call, conversation, scopes: [info.scopes.get(call)], bindings: { mapping: binding.name, conversation: conversation.name } };\n  }\n\n  function messagePlan(info) {\n    const users = new Set();\n    const assistants = new Set();\n    for (const node of info.nodes) {\n      if (node.type !== 'CallExpression' || node.optional || node.arguments.length < 2) continue;\n      const callee = plainCallee(node.callee);\n      if (!callee || callee.type !== 'MemberExpression' || callee.optional || !['jsx', 'jsxs'].includes(staticKey(callee)) || callee.object.type !== 'Identifier' || !info.imported(info.resolve(callee.object))) continue;\n      const component = node.arguments[0];\n      if (component.type !== 'Identifier') continue;\n      if (objectProperties(node.arguments[1], USER_KEYS)) users.add(info.resolve(component));\n      if (objectProperties(node.arguments[1], ASSISTANT_KEYS)) assistants.add(info.resolve(component));\n    }\n    if (users.size !== 1 || assistants.size !== 1) return { reason: 'ambiguous-message-components' };\n    const [user] = users;\n    const [assistant] = assistants;\n    if (user === assistant || !info.nativeFunction(user) || !info.nativeFunction(assistant)) return { reason: 'unsupported-message-components' };\n    const react = uniqueReact(info, new Set(['useState']));\n    if (react.length > 1) return { reason: 'ambiguous-react-namespace' };\n    return { kind: 'message', user, assistant, react: react[0] || null, scopes: [info.bodyScope], bindings: { user: user.name, assistant: assistant.name, react: react[0] ? react[0].name : null } };\n  }\n\n  function boundaryPlan(info) {\n    const exports = new Set();\n    for (const node of info.nodes) {\n      if (node.type !== 'CallExpression' || node.optional || node.arguments.length < 2) continue;\n      const callee = node.callee;\n      if (callee.type !== 'MemberExpression' || callee.optional || staticKey(callee) !== 'd' || callee.object.type !== 'Identifier' || info.resolve(callee.object) !== info.requireBinding || info.resolve(node.arguments[0]) !== info.exportsBinding) continue;\n      const table = node.arguments[1];\n      if (table.type !== 'ObjectExpression') continue;\n      for (const property of table.properties) {\n        if (property.type !== 'Property' || property.computed || property.kind !== 'init') continue;\n        const getter = property.value;\n        if (!FUNCTION_TYPES.has(getter.type) || getter.async || getter.generator || getter.params.length) continue;\n        let value = getter.body;\n        if (value.type === 'BlockStatement' && value.body.length === 1 && value.body[0].type === 'ReturnStatement') value = value.body[0].argument;\n        const binding = info.resolve(value);\n        if (info.nativeFunction(binding)) exports.add(binding);\n      }\n    }\n    const candidates = [...exports].filter(binding => info.nodes.some(node => node.start >= binding.initializer.start && node.end <= binding.initializer.end && ((node.type === 'Identifier' && node.name === 'timestampSeparatorAtMs') || staticKey(node) === 'timestampSeparatorAtMs')));\n    if (candidates.length !== 1) return { reason: 'ambiguous-boundary-export' };\n    const boundary = candidates[0];\n    const react = uniqueReact(info, REACT_HOOKS);\n    if (react.length > 1) return { reason: 'ambiguous-react-namespace' };\n    return { kind: 'boundary', boundary, react: react[0] || null, scopes: [info.bodyScope], bindings: { boundary: boundary.name, react: react[0] ? react[0].name : null } };\n  }\n\n  function applyInsertions(source, insertions) {\n    let result = source;\n    for (const insertion of insertions.sort((a, b) => b.position - a.position)) result = result.slice(0, insertion.position) + insertion.text + result.slice(insertion.position);\n    return result;\n  }\n\n  function transformFactory(source, bridgeExpression) {\n    const unchanged = reason => ({ source, changed: false, kind: null, reason });\n    if (typeof source !== 'string' || source.length > MAX_SOURCE_LENGTH) return unchanged('unsupported-source');\n    if (!CONTENT_KEYS.every(key => source.includes(key)) && !MESSAGE_MARKERS.every(key => source.includes(key)) && !(source.includes('pending-chatgpt-submit') && source.includes('timestampSeparatorAtMs'))) return unchanged('unmatched');\n    try {\n      const parsed = parseFactory(source);\n      if (!parsed) return unchanged('unsupported-factory');\n      const { factory, offset } = parsed;\n      const info = analyze(factory);\n      if (info.unsafe || info.requireBinding.writes.length || info.exportsBinding.writes.length) return unchanged('unsupported-dynamic-scope');\n      // Structural markers only: comments and arbitrary string contents cannot\n      // qualify a module. The message markers may be identifier/member names.\n      const propertyKeys = new Set(info.nodes.filter(node => node.type === 'Property' && info.parents.get(node).type === 'ObjectExpression').map(staticKey));\n      const names = new Set(info.nodes.flatMap(node => node.type === 'Identifier' ? [node.name] : staticKey(node) ? [staticKey(node)] : []));\n      const content = CONTENT_KEYS.every(key => propertyKeys.has(key));\n      const message = MESSAGE_MARKERS.every(key => names.has(key));\n      const boundary = info.nodes.some(node => node.type === 'Property' && staticKey(node) === 'id' && node.value.type === 'Literal' && node.value.value === 'pending-chatgpt-submit' && info.parents.get(node).type === 'ObjectExpression') && names.has('timestampSeparatorAtMs');\n      const matches = [content && 'mapping', message && 'message', boundary && 'boundary'].filter(Boolean);\n      if (matches.length !== 1) return unchanged(matches.length ? 'ambiguous-module-kind' : 'unmatched');\n      const plan = content ? mappingPlan(info) : message ? messagePlan(info) : boundaryPlan(info);\n      if (!plan.kind) return unchanged(plan.reason);\n      if (plan.kind !== 'mapping' && info.nodes.some(node => node.type === 'ReturnStatement' && info.scopes.get(node).owner === factory)) return unchanged('unsupported-factory-return');\n      const bridge = validateBridge(bridgeExpression, info, plan.scopes);\n      if (!bridge) return unchanged('unsafe-bridge-expression');\n      let insertions;\n      if (plan.kind === 'mapping') {\n        insertions = [\n          { position: plan.call.start - offset, text: bridge + '.observe(' },\n          { position: plan.call.end - offset, text: ',' + plan.conversation.name + ')' },\n        ];\n      } else {\n        const addition = plan.kind === 'message'\n          ? ';' + plan.user.name + '=' + bridge + '.message(' + plan.user.name + ',' + (plan.react ? plan.react.name : 'void 0') + ',false);' + plan.assistant.name + '=' + bridge + '.message(' + plan.assistant.name + ',' + (plan.react ? plan.react.name : 'void 0') + ',true);'\n          : ';' + plan.boundary.name + '=' + bridge + '.boundary(' + plan.boundary.name + (plan.react ? ',' + plan.react.name : '') + ');';\n        insertions = [{ position: factory.body.end - offset - 1, text: '\\n' + addition + '\\n' }];\n      }\n      const result = applyInsertions(source, insertions);\n      const expression = parsed.methodKey === null ? '(' + result + ')' : '({' + result + '})[' + JSON.stringify(parsed.methodKey) + ']';\n      return { source: result, expression, changed: true, kind: plan.kind, reason: null, bindings: plan.bindings };\n    } catch (_) {\n      // A parser limit or unexpected newer syntax must not break the host app.\n      return unchanged('unsupported-syntax');\n    }\n  }\n  return transformFactory;\n})(module.exports);\n})()";
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
function startPageMetadataBridge(win, doc, { runtimeSource, transformerSource, enabled = true, changed = () => {}, key } = {}) {
  key ||= '__chatgptToolkitMetadata_' + Math.random().toString(36).slice(2);
  const statusId = key + '_status', eventName = key + '_control';
  let started = false, done = false, attempts = 0, observer, timer, status, source, lastAttempt;
  const pendingResets = [];
  const mark = (name, value) => { try { status?.setAttribute('data-' + name, String(value)); } catch {} };
  const checked = () => status?.getAttribute('data-page') === 'ready';
  const inspect = () => {
    const names = ['page','hook','runtime','registry','patch','react','enabled','mapping','renderer','labels','factories','rows','bootstrap','account','account-fence'];
    const result = {};
    const labels = new Set(['ready','on','off','installed','not-active','found','not-started','waiting-document','no-page-ack','needs-refresh-or-page-access','not-seen-refresh','failed','unsupported','ambiguous','needs-refresh','page-compile-failed','blocked','paused-account']);
    for (const name of names) { const value = status?.getAttribute('data-' + name) || (name === 'bootstrap' ? 'waiting-document' : 'not-started'); result[name] = /^(?:0|[1-9][0-9]{0,8})$/.test(value) || labels.has(value) ? value : 'unsupported'; }
    return result;
  };
  const event = command => {
    if (!status) return;
    try { doc.dispatchEvent(new win.CustomEvent(eventName, { detail: command })); } catch {}
  };
  function acknowledge() {
    for (const command of pendingResets.splice(0)) event(command);
    done = true; started = true; mark('bootstrap','ready'); observer?.disconnect(); clearTimeout(timer); changed();
  }
  function attempt() {
    if (done || checked()) { if (checked()) { acknowledge(); } return; }
    const parent = doc.head || doc.documentElement;
    if (!parent) return;
    if (!status) {
      status = doc.createElement('meta'); status.id = statusId; status.setAttribute('name','chatgpt-toolkit-message-runtime');
      parent.appendChild(status);
    }
    const nonce = doc.currentScript?.nonce || doc.querySelector('script[nonce]')?.nonce || '';
    // One immediate attempt supports pages without CSP; when a nonce appears,
    // retry before deferred application bundles. Never wait only for DOM ready.
    const signature = nonce || 'without-nonce';
    if (lastAttempt === signature || attempts >= 3) return;
    lastAttempt = signature; attempts++;
    source ||= '(' + runtimeSource + ')(' + JSON.stringify({ key,statusId,eventName,enabled }) + ',(' + transformerSource + '));';
    const script = doc.createElement('script'); if (nonce) script.nonce = nonce;
    try { script.textContent = source; parent.appendChild(script); }
    catch { mark('bootstrap','blocked'); }
    finally { script.remove(); }
    if (checked()) { acknowledge(); }
    else mark('bootstrap','no-page-ack');
  }
  try {
    observer = new win.MutationObserver(() => { attempt(); if (started) changed(); });
    observer.observe(doc, { childList: true, subtree: true });
  } catch {}
  attempt();
  if (!done) timer = win.setTimeout(() => { done = true; observer?.disconnect(); mark('bootstrap', checked() ? 'ready' : 'needs-refresh-or-page-access'); changed(); }, 15000);
  return {
    inspect,
    active: () => checked() && Number(status?.getAttribute('data-renderer')) > 0,
    setEnabled(value) { enabled = !!value; source = null; event(enabled ? 'on' : 'off'); },
    invalidate(reason) {
      const kind = reason?.startsWith('request:') ? reason.slice(8) : reason;
      const fixed = kind === 'session' || kind === 'read' ? kind : 'invalidate';
      if (checked()) event(reason?.startsWith('request:') ? 'request-' + fixed : fixed);
      else if (fixed === 'invalidate') { pendingResets.length = 0; pendingResets.push('invalidate'); }
      else if (!pendingResets.length) pendingResets.push(fixed);
    },
    route() { event('route'); },
    destroy() { done = true; observer?.disconnect(); clearTimeout(timer); event('invalidate'); status?.remove(); }
  };
}
  // END GENERATED PASSIVE METADATA RUNTIME
  function boot() {
    diagnostics?.mark('frame-check');
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (!win || win.top !== win.self) { diagnostics?.mark('skipped', { frame: win ? 'not-top-window' : 'missing-window' }); return; }
    // React expandos belong to the page's DOM realm. Use the same page document
    // as unsafeWindow; keep GM storage APIs inside this userscript closure.
    const document = win.document || window.document;
    // Public boolean guard only; never bridge storage or credentials across scripts.
    // It protects repeated v1.1.9 injections and an already-mounted older copy.
    if (win.__chatgptToolkitActiveV1 || document.getElementById('chatgpt-pro-local-counter')) { diagnostics?.mark('duplicate-skipped', { frame: 'top-window' }); return; }
    Object.defineProperty(win, '__chatgptToolkitActiveV1', { value: true, configurable: false });
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
    // Register at document-start, before mount/storage work. Closed Shadow DOM
    // retargets our fields to the non-editable host for page shortcut handlers.
    // Root bubbling alone is too late for document/window capture listeners.
    // Stop propagation only: native typing, paste, selection, undo and IME keep
    // their browser defaults. Never inspect clipboard contents or redispatch.
    const panelEditEvents = ['keydown', 'keypress', 'keyup', 'paste', 'copy', 'cut', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend'];
    function isolatePanelEdit(event) {
      if (collapsed || !root || !host || (event.target !== host && (!event.target?.nodeType || !root.contains(event.target)))) return;
      const field = root.activeElement;
      if (!field?.matches('input,textarea,select') || field.disabled || ['hidden', 'file', 'button', 'submit', 'reset'].includes(field.getAttribute('type'))) return;
      event.stopImmediatePropagation();
      // These panel shortcuts would otherwise be stopped before our document
      // handler. During composition Escape belongs to the IME, not the panel.
      if (event.type === 'keydown' && !event.isComposing && event.keyCode !== 229) {
        if (event.key === 'Escape') { closePanel(); hideHover(); }
        else if (event.altKey && event.shiftKey && event.code === 'KeyP') { event.preventDefault(); closePanel(); }
      }
    }
    for (const type of panelEditEvents) win.addEventListener(type, isolatePanelEdit, true);
    // Local appearance preference, deliberately outside the shared v1 ledger
    // schema: older sync peers cannot drop or overwrite it. Missing/invalid => Pro.
    let hoverMode = 'pro';
    let messageInfoTimer, messageInfoReadError = false, moduleMetadataBridge;
    const messageBadges = new Map();
    function refreshMessageInfo() {
      const injection = moduleMetadataBridge?.inspect();
      if (diagnostics && injection) Object.assign(diagnostics.state, { messageInjection: [injection.bootstrap, injection.hook, injection.runtime, injection.patch].join(' / '), messageInjectionFactories: injection.factories, messageObservedMappings: injection.mapping, messageRendererCommits: injection.renderer, messageInjectedLabels: injection.labels, messageInjectionAccount: injection.account + ' / ' + injection['account-fence'] });
      if (moduleMetadataBridge?.active() || injection?.account === 'paused-account') {
        for (const badge of messageBadges.values()) badge.remove(); messageBadges.clear();
        return { messageEnabled: messageInfoState.enabled() ? 'on' : 'off', messageBadges: Number(injection.labels) || 0, messageNative: Number(injection.rows) || 0 };
      }
      return renderMessageInfo(document, messageInfoState, messageBadges);
    }
    function scheduleMessageInfo() {
      if (messageInfoTimer) return;
      messageInfoTimer = setTimeout(() => {
        messageInfoTimer = null;
        try { const report = refreshMessageInfo(); if (diagnostics) Object.assign(diagnostics.state, report); } catch { /* unsupported page DOM: omit badges */ }
      }, 200);
    }
    const messageInfoState = createMessageInfoState({ page: () => win.location.href, changed: scheduleMessageInfo, enabled: false });
    messageInfoState.nativeReader(document);
    if (diagnostics) diagnostics.inspectMessageInfo = () => refreshMessageInfo();
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
      const empty = { version: 2, mode: 'base', url: '', username: '', password: '', interval: 0, enabled: false, tested: false, approved: false };
      try { const value = gmGet(`${PREFIX}webdav`, empty); return value && typeof value === 'object' ? value : empty; }
      catch { storageAvailable = false; storageError = '本机存储读取失败。请检查 Tampermonkey 权限再刷新；WebDAV 暂停。'; return empty; }
    };
    const verifiedSet = (key, value) => {
      if (hasStorage && !storageAvailable) throw Error('本机存储已暂停写入');
      try {
        gmSet(key, value);
        if (JSON.stringify(gmGet(key)) !== JSON.stringify(value)) throw Error('readback mismatch');
      } catch {
        storageAvailable = false;
        storageError = '本机写入未通过复核，已暂停修改和同步。请保留页面并导出已知记录，再检查本机数据。';
        throw Error(storageError);
      }
    };
    const inspectStorage = () => inspectLocalStorage({ keys: gmKeys, get: gmGet });
    let dataInspection = null;
    const syncDiagnostics = [];
    const syncDiagnosticText = () => {
      const manager = typeof GM_info === 'object' && GM_info.scriptHandler === 'Tampermonkey' ? 'Tampermonkey' : '未知管理器';
      const version = typeof GM_info === 'object' && /^[0-9.]{1,24}$/.test(String(GM_info.version || '')) ? String(GM_info.version) : '未知';
      return [`请求诊断：${manager} ${version}；仅本页内存，刷新后清空`, ...syncDiagnostics.map(row => `${new Date(row.startedAt).toISOString()} ${row.method} HTTP ${row.status || '未取得'}；${row.elapsedMs}ms；流开始 ${row.streamStarted ? '是' : '否'}，流结束 ${row.streamEOF ? '是' : '否'}，最终回调 ${row.finalSeen ? '是' : '否'}；${row.outcome === 'completed' ? '请求完成' : '请求失败'}`), ...(syncDiagnostics.length ? [] : ['本页尚无完成的 WebDAV 请求诊断。'])].join('\n');
    };
    const showStorageText = () => storageSummary(inspectStorage(), settings, { pending: accountPending(), persistent: hasStorage }) + '\n' + syncDiagnosticText();
    if (diagnostics) diagnostics.inspectStorage = showStorageText;
    const load = () => {
      // Respect the display preference independently of accounting/other UI reads.
      // An unreadable first preference leaves display disabled; later errors keep
      // the last known value rather than silently switching it back on.
      try {
        const next = gmGet(`${PREFIX}ui.messageInfo`, true) !== false;
        const changed = next !== messageInfoState.enabled() || messageInfoReadError;
        messageInfoReadError = false; messageInfoState.setEnabled(next);
        if (changed && uiReady) refreshMessageInfoPreference();
      } catch { messageInfoReadError = true; if (uiReady) refreshMessageInfoPreference(); }
      try {
        const nextHoverMode = gmGet(`${PREFIX}ui.hoverMode`, 'pro') === 'all' ? 'all' : 'pro';
        const nextAutoAccount = gmGet(`${PREFIX}ui.autoAccount`, false) === true;
        // Do not turn an unreadable individual value into an empty successful
        // load. Preserve the last known records and stop writes until reviewed.
        const inventory = inspectLocalStorage({ keys: gmKeys, get: gmGet, includeBackups: false });
        if (!completeStorage(inventory)) throw Error('不完整的本机记录读取');
        const nextIds = new Set(inventory.records.map(e => e.id));
        if (records.some(e => !nextIds.has(e.id))) throw Error('本机已知记录突然缺失');
        let nextSettings = inventory.settings.sort((a, b) => b.updated - a.updated || b.id.localeCompare(a.id))[0];
        if (!nextSettings) {
          nextSettings = { ...storedSettings, id: 'initial', updated: 0 };
          if (hasStorage && !storageAvailable) throw Error('存储已暂停');
          verifiedSet(`${PREFIX}settings.initial`, nextSettings);
        }
        storedSettings = nextSettings; records = inventory.records;
        const hoverChanged = nextHoverMode !== hoverMode; hoverMode = nextHoverMode;
        account.setEnabled(nextAutoAccount); applyAccountLedger();
        if (hoverChanged && uiReady) { refreshHoverPreference(); updateHover(); }
        records.forEach(rememberCount);
        lastKeys = inventory.recordKeys + ':' + inventory.settingsKeys + ':' + records.reduce((n, e) => n + e.updated, 0);
      } catch { storageAvailable = false; if (hasStorage) storageError = '本机存储读取不完整，已保留本页已知记录并暂停同步与修改。请打开“本机数据检查”；不要删除或重装脚本。'; }
    };
    const save = (event, strict = false) => {
      try {
        if (hasStorage && !storageAvailable) throw Error('存储已暂停');
        const clean = validEvent(event); verifiedSet(`${PREFIX}event.${clean.id}`, clean);
        const index = records.findIndex(e => e.id === clean.id); if (index < 0) records.push(clean); else records[index] = clean;
        rememberCount(clean);
      } catch { storageAvailable = false; storageError = '记录写入未通过复核，已暂停修改和同步。请保留页面并导出已知记录，再检查脚本存储。'; if (strict) throw Error(storageError); }
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
      if (!storageAvailable) throw Error('本机读取不完整，未改写任何备份；已取消修改。');
      try {
        const inventory = inspectStorage();
        if (!completeStorage(inventory) || inventory.readErrors || inventory.invalidBackups) throw Error('备份读取不完整');
        const data = exportObject(), ids = new Set(data.events.map(e => e.id));
        // Keep every older backup containing history absent from this snapshot.
        // Never replace a nonempty recovery copy with an empty snapshot.
        const occupied = new Set(inventory.backups.map(b => b.key));
        let key = Array.from({ length: 12 }, (_, n) => `${PREFIX}backup.${n}`).find(k => !occupied.has(k));
        if (!key) key = inventory.backups.filter(b => b.valid && b.snapshot.events.every(e => ids.has(e.id))).sort((a, b) => a.exportedAt.localeCompare(b.exportedAt))[0]?.key;
        if (!key) throw Error('现有备份包含缺失历史');
        verifiedSet(key, { ...data, reason });
      } catch { throw Error('安全备份未通过复核，已取消后续修改；请先导出并检查本机数据。'); }
    };
    const download = (obj, name) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    function scheduleRender() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { updateHover(); if (root) render(); flushIncrement(); }, 150); }
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
    function launcher(total) { return `<div class="launcher"><button type="button" data-action="expand" class="chip" aria-label="打开 Pro 计数器；${!storageAvailable ? '本机数据待核对' : accountPending() ? '账号待识别' : `本机估算 ${total.used}/${settings.cap}`}" aria-expanded="${!collapsed}" aria-controls="gpc-panel">Pro <strong>${!storageAvailable ? '待核对' : accountPending() ? '待识别' : `${total.used}/${settings.cap}`}</strong><small> ${storageAvailable ? '本机' : '权限异常'}</small></button></div>`; }
    function panelNotices() { return `${!storageAvailable ? '<div class="notice error">数据读取异常，下面的数字仅是本页已知记录，不能作为完整余额。</div>' : ''}${accountPending() ? `<div class="notice" role="status">当前账号待识别。新请求暂存未分配记录，不计入任何账号，也不上传 WebDAV；后续识别不会自动搬移。等待页面自然返回会话信息，或刷新页面。</div>` : ''}${account.enabled() && !accountPending() && records.some(event => event.ledger.startsWith('unassigned:')) ? `<div class="notice" role="status">另有 ${records.filter(event => event.ledger.startsWith('unassigned:')).length} 条未分配记录，未计入当前账号。可导出核对，或关闭自动识别后在设置中查看未分配账本；不会自动搬移。</div>` : ''}${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ''}${storageError ? `<div class="notice error" role="alert">${esc(storageError)}</div>` : ''}`; }
    function render(resetForm = false) {
      if (!root) return;
      const focusedAction = root.activeElement?.getAttribute('data-action');
      const total = summarize(records, settings);
      updateHover();
      // Keep the live form, focus, selection, native undo and composition state
      // during asynchronous status paints. Do not refresh settingsSnapshot:
      // saving an old form must still reject changed settings/account context.
      const liveForm = !collapsed && root.querySelector(tab === 'settings' ? '#settings' : tab === 'sync' ? '#webdav' : '#no-form');
      if (liveForm && !resetForm) {
        const notices = root.querySelector('#gpc-notices'); if (notices) renderMarkup(notices, panelNotices());
        const sync = root.querySelector('#sync-status'); if (sync) sync.textContent = `${syncStatus}${syncBusy ? ' · 正在处理…' : ''}`;
        refreshAccountPreference();
        const chip = root.querySelector('[data-action="expand"]');
        if (chip) {
          chip.setAttribute('aria-label', `打开 Pro 计数器；${!storageAvailable ? '本机数据待核对' : accountPending() ? '账号待识别' : `本机估算 ${total.used}/${settings.cap}`}`);
          chip.querySelector('strong').textContent = !storageAvailable ? '待核对' : accountPending() ? '待识别' : `${total.used}/${settings.cap}`;
          chip.querySelector('small').textContent = storageAvailable ? '本机' : '权限异常';
        }
        return;
      }
      if (collapsed) { renderMarkup(root, `<style>${style}</style>${launcher(total)}`); if (focusedAction) root.querySelector(`[data-action="${focusedAction}"]`)?.focus(); return; }
      let body = '';
      if (tab === 'settings') {
        const d = new Date(settings.anchor); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        settingsSnapshot = contextSnapshot();
        body = `<div class="display-setting"><label id="hover-label">悬浮卡显示</label><div class="segmented" role="group" aria-labelledby="hover-label"><button type="button" id="hover-pro" data-action="hover-pro" aria-pressed="${hoverMode === 'pro'}">仅选择 Pro 时</button><button type="button" id="hover-all" data-action="hover-all" aria-pressed="${hoverMode === 'all'}">所有模型</button></div><small id="hover-status" role="status">${hoverPreferenceHint()}</small></div><div class="display-setting"><label id="message-info-label">消息时间与模型</label><div class="segmented" role="group" aria-labelledby="message-info-label"><button type="button" id="message-info-on" data-action="message-info-on" aria-pressed="${messageInfoState.enabled()}">显示</button><button type="button" id="message-info-off" data-action="message-info-off" aria-pressed="${!messageInfoState.enabled()}">隐藏</button></div><small id="message-info-status" role="status">${messageInfoPreferenceHint()}</small></div><div class="display-setting"><label id="account-label">按当前账号自动切换账本</label><div class="segmented" role="group" aria-labelledby="account-label"><button type="button" data-action="account-off" id="account-off" aria-pressed="${!account.enabled()}">手动选择</button><button type="button" data-action="account-on" id="account-on" aria-pressed="${account.enabled()}">实验自动识别</button></div><small id="account-status" role="status">${accountPreferenceHint()}</small></div><form id="settings"><label for="cap">本周期上限（自定义，非官方额度）</label><input id="cap" type="number" min="1" max="1000000" value="${settings.cap}" required><label for="mode">统计方式</label><select id="mode"><option value="fixed"${settings.mode === 'fixed' ? ' selected' : ''}>固定七天周期</option><option value="rolling"${settings.mode === 'rolling' ? ' selected' : ''}>滚动最近七天</option></select><label for="anchor">固定周期锚点（你的浏览器当地时间）</label><input id="anchor" type="datetime-local" value="${local}" required><small>填入你确认的重置时间；每 168 小时一个周期。默认是安装当天零点。滚动模式忽略此项。</small><label for="calibrate">当前已用校准为（首次安装可填写）</label><input id="calibrate" type="number" min="0" max="1000000" placeholder="留空保留现值"><small>会添加一条校准记录，不删除历史；以保存后的统计方式计算差额。</small><label for="ledger">账本</label><select id="ledger"${account.enabled() ? ' disabled' : ''}>${[...new Set(['default', settings.ledger, ...records.map(e => e.ledger)])].map(id => `<option value="${esc(id)}"${id === settings.ledger ? ' selected' : ''}>${id === settings.ledger ? esc(settings.label) : id === 'default' ? '默认账本' : id.startsWith('unassigned:') ? `未分配 ${esc(id.slice(11, 19))}` : esc(id.slice(0, 16))}</option>`).join('')}<option value="__new">新建独立账本…</option></select><small>${account.enabled() ? '账本跟随本标签页识别到的登录用户。同一用户的不同工作区共用账本。' : '手动模式：换账号时请选择独立账本。'} 上限、统计方式和周期锚点仍是共用设置，需自行核对；不会自动推断各账号额度。</small><div class="actions"><button class="primary" type="submit">保存设置</button>${button('home', '取消')}</div></form><div class="foot">修改前自动保存本机备份。不同标签页设置冲突时会提醒刷新。</div>`;
      } else if (tab === 'sync') {
        const cfg = getDav(), davMode = cfg.version === 2 ? cfg.mode : cfg.url ? 'file' : 'base';
        body = `<form id="webdav"><div class="callout">可选：把计数记录、模型标记和周期设置存到你自己的 WebDAV 文件。密码仅在本机 Tampermonkey 存储，不随备份导出；不是加密保险箱。</div><label for="dav-mode">地址模式</label><select id="dav-mode"><option value="base"${davMode === 'base' ? ' selected' : ''}>基础目录（自动建立同步目录）</option><option value="file"${davMode === 'file' ? ' selected' : ''}>完整文件地址（兼容旧配置）</option></select><label id="dav-url-label" for="dav-url">${davMode === 'base' ? 'HTTPS 基础目录' : 'HTTPS 文件完整地址'}</label><input id="dav-url" type="url" value="${esc(cfg.url)}" placeholder="${davMode === 'base' ? 'https://你的服务器/dav/' : 'https://你的服务器/dav/pro-counter.json'}" required autocomplete="off"><small id="dav-path-hint">${davMode === 'base' ? '自动在此地址下建立 ChatGPT-Toolkit/，同步文件为 data.json。' : '保留原文件；切换基础目录前请先同步旧文件并导出备份，不自动搬移远端历史。'}</small><label for="dav-user">用户名</label><input id="dav-user" value="${esc(cfg.username)}" autocomplete="off"><label for="dav-pass">密码 / 专用应用密码</label><input id="dav-pass" type="password" placeholder="${cfg.password ? '已保存；留空保留（更换服务器时会清除）' : '建议使用专用应用密码'}" autocomplete="new-password"><label for="dav-interval">自动同步（仅页面打开时）</label><select id="dav-interval">${[0, 5, 15, 30, 60].map(n => `<option value="${n}"${cfg.interval === n ? ' selected' : ''}>${n ? `每 ${n} 分钟` : '关闭，仅手动'}</option>`).join('')}</select><label><input id="dav-approved" type="checkbox" style="width:auto" ${cfg.approved ? 'checked' : ''}> 我同意按所选模式建立同步目录、上传计数记录和周期设置，并在本机保存凭据。</label><div class="actions"><button type="submit" class="primary">测试并保存</button>${button('sync-now', '立即同步')}${button('sync-off', '关闭自动同步')}${button('sync-clear', '清除本机凭据')}</div></form><div id="sync-status" class="callout" role="status">${esc(syncStatus)}${syncBusy ? ' · 正在处理…' : ''}</div><div class="foot">需要 Tampermonkey 5.5.1+。安装时的任意域名网络权限仅用于你填写的 WebDAV。同步不包含聊天正文、Cookie、令牌或 WebDAV 密码。两台设备使用相同模式和地址。需支持强 ETag / 条件 PUT；不跟随重定向。周期设置按更新时间合并，请确保系统时间准确。</div>`;
      } else if (tab === 'storage') {
        const report = dataInspection || inspectStorage();
        const lines = (storageSummary(report, settings, { pending: accountPending(), persistent: hasStorage }) + '\n' + syncDiagnosticText()).split('\n');
        body = `<div id="storage-report" class="callout">${lines.map(line => `<div>${esc(line)}</div>`).join('')}</div><div class="actions">${button('storage', '重新检查')}${button('export', '导出本机记录')}${button('home', '返回概览')}</div><ul class="log">${report.backups.map((entry, index) => `<li>备份 ${index + 1} · ${entry.valid ? `${entry.count} 条` : '保留原值'}${entry.valid ? `<button type="button" data-action="backup-export" data-backup-index="${index}">导出此备份</button>` : ''}</li>`).join('')}</ul><div class="foot">此处导出只生成本机文件。不要公开分享记录备份；排障可只提供上方计数摘要。</div>`;
      } else if (tab === 'log') {
        const proof = pow.current();
        const powStatus = `<div id="pow-status" class="callout" role="status">PoW 难度：${proof ? `<span class="pow-difficulty">${esc(proof.difficulty)}</span><br>是否要求：${proof.required === null ? '未知' : proof.required ? '是' : '否'} · 最近捕获 ${fmt(proof.observedAt)}` : '暂未捕获'}</div>`;
        const rows = (accountPending() ? [...new Set(records.filter(event => event.ledger.startsWith('unassigned:')).map(event => event.ledger))].flatMap(ledger => grouped(records, ledger)).sort((a, b) => b.at - a.at) : grouped(records, settings.ledger)).slice(0, 80);
        body = `${powStatus}<div class="actions">${button('storage', '所有账本与备份')}</div><div class="row"><span class="eyebrow">${esc(settings.label)} · 最近 ${rows.length} 条</span>${button('export', '导出', 'ghost')}</div><ul class="log">${rows.length ? rows.map(e => `<li><div class="row"><strong class="badge ${e.state === 'failed' || e.state === 'aborted' ? 'warning' : ''}">${esc(status(e))}</strong><small>${fmt(e.at)}</small></div>${e.state === 'manual' ? '' : `<div class="model muted">请求：${esc(e.requested || '未知')}<br>响应路由：${esc(e.conflict ? '字段冲突' : e.route || '未取得')}${e.label ? `<br>回答标签：${esc(e.label)}` : ''}</div><small>${e.observation === 'handoff' ? '响应已转交其他通道；未监听 WebSocket' : e.observation === 'bounded' ? '达到观察上限；后续状态未知' : e.observation === 'unreadable' ? '未解析到响应元数据' : e.observation === 'http' ? '仅确认 HTTP 接收' : ''}${!e.stable ? ' · 缺少稳定 ID，重试可能重复' : ''}${e.attempts > 1 ? ` · ${e.attempts} 次尝试已合并` : ''}</small>`}</li>`).join('') : '<li class="empty">还没有记录<br><small>打开历史对话不会增加计数</small></li>'}</ul><div class="foot">已接收 ≠ 官方扣额。HTTP 失败/取消不计入，但也不能证明平台未扣额；可手动校准。</div>`;
      } else {
        body = `<div class="eyebrow">${settings.mode === 'fixed' ? '本周期' : '最近七天'}已用 · 本机估算</div><div class="number">${!storageAvailable ? '待核对' : accountPending() ? '待识别' : total.used}<span> / ${settings.cap}</span></div><div class="meter" role="progressbar" aria-label="本机估算已用" aria-valuemin="0" aria-valuemax="${Math.max(total.used, settings.cap)}" aria-valuenow="${accountPending() ? 0 : total.used}"><div class="fill" style="width:${accountPending() ? 0 : Math.min(100, total.used / settings.cap * 100)}%"></div></div><div class="row"><strong>估算剩余 ${!storageAvailable ? '待核对' : accountPending() ? '待识别' : total.remaining}</strong><span class="meta">待确认 ${total.pending} · 失败/取消 ${total.failed}</span></div><div class="callout">${settings.mode === 'fixed' ? `下个周期：${fmt(total.next)}<br>锚点由你设置，不是服务端重置时间。` : '每条记录在 168 小时后移出统计窗口。'}${total.raw < 0 ? '<br><span class="warning">校准合计为负，已用暂显示 0，请复核记录。</span>' : ''}</div><div class="meta">已接收 Pro ${!storageAvailable ? '待核对' : accountPending() ? '待识别' : total.pro} · 手动校准 ${total.adjustment >= 0 ? '+' : ''}${total.adjustment}</div><div class="actions calibration" role="group" aria-label="手动校准">${button('plus', '+1 校正')}${button('minus', '−1 校正')}${button('settings', '初始用量 / 设置', 'initial')}</div><div class="actions secondary">${button('export', '导出')}${button('import', '导入合并')}${button('backup', '最近备份', 'ghost')}${button('storage', '本机数据检查', 'ghost')}</div><div class="foot">本机优先 · ${getDav().enabled ? 'WebDAV 已配置' : 'WebDAV 未启用'} · 非官方余额<br>${esc(settings.label)} · ${observer?.healthy() ? (observer.observed() ? '观察器已捕获请求' : '观察器已安装，等待新请求') : '观察器可能被覆盖，请刷新页面'}${account.enabled() ? '<br>按登录用户分账；上限与周期设置共用。' : ''}${getDav().enabled ? `<br>${esc(syncStatus)}${Math.max(settings.updated, ...records.map(e => e.updated)) > Number(gmGet(`${PREFIX}lastSync`, 0)) ? '<br>有待同步的新记录；断网时保留在本机。' : ''}` : ''}</div>`;
      }
      renderMarkup(root, `<style>${style}</style><section id="gpc-panel" class="panel" role="dialog" aria-label="ChatGPT Toolkit"><header><h1>ChatGPT Toolkit<span>LOCAL</span></h1><button type="button" data-action="collapse" class="ghost close" aria-label="关闭计数器">×</button></header><nav>${button('home', '概览', tab === 'home' ? 'active' : '')}${button('log', '记录', tab === 'log' ? 'active' : '')}${button('settings', '设置', tab === 'settings' ? 'active' : '')}${button('sync', '同步', tab === 'sync' ? 'active' : '')}</nav><div id="gpc-notices">${panelNotices()}</div><div class="body">${body}</div><input type="file" id="import" accept="application/json,.json" hidden></section>${launcher(total)}`);
      if (focusedAction) root.querySelector(`[data-action="${focusedAction}"]`)?.focus();
    }
    function manual(delta, at = Date.now()) {
      if (accountPending()) throw Error('账号待识别，暂不能校准。可关闭自动识别后手动选择账本。');
      const id = uuid(); save({ v: 1, id, key: `m:${id}`, ledger: settings.ledger, at, updated: at, state: 'manual', observation: 'manual', delta, requested: '', route: '', label: '', stable: true, conflict: false, http: 0 });
    }
    function messageInfoPreferenceHint() { if (messageInfoReadError) return '显示设置读取失败，保留上次选择；首次加载时暂不显示。请检查本机存储。'; return '显示已加载消息的创建时间与响应模型；悬停查看完整时间。仅本机设置。'; }
    function refreshMessageInfoPreference(message = '') {
      for (const value of ['on', 'off']) root?.querySelector(`#message-info-${value}`)?.setAttribute('aria-pressed', String(messageInfoState.enabled() === (value === 'on')));
      const status = root?.querySelector('#message-info-status'); if (status) status.textContent = message || messageInfoPreferenceHint();
    }
    function setMessageInfoMode(value) {
      try { verifiedSet(`${PREFIX}ui.messageInfo`, !!value); messageInfoState.setEnabled(value); refreshMessageInfoPreference(); scheduleMessageInfo(); }
      catch { refreshMessageInfoPreference('未保存：本机存储写入失败，仍保留原显示方式。'); }
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
        verifiedSet(`${PREFIX}ui.autoAccount`, enabled); account.setEnabled(enabled); applyAccountLedger();
        // Switching account mode intentionally discards an unrelated form draft.
        panelDraft = null; render(true);
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
        verifiedSet(`${PREFIX}ui.hoverMode`, mode);
        hoverMode = mode; refreshHoverPreference(); updateHover();
      } catch { refreshHoverPreference('未保存：本机存储写入失败，仍保留原显示方式。'); }
    }
    function bind() {
      root.addEventListener('click', e => {
        const b = e.target.closest('button[data-action]'); if (!b) return;
        try {
          const action = b.dataset.action; notice = '';
          if (action === 'message-info-on' || action === 'message-info-off') { setMessageInfoMode(action === 'message-info-on'); return; }
          if (action === 'account-on' || action === 'account-off') { setAccountMode(action === 'account-on'); return; }
          if (action === 'hover-pro' || action === 'hover-all') { setHoverMode(action === 'hover-all' ? 'all' : 'pro'); return; }
          if (action === 'storage') { dataInspection = inspectStorage(); tab = 'storage'; collapsed = false; render(true); return; }
          if (action === 'backup-export') {
            const entry = dataInspection?.backups[Number(b.dataset.backupIndex)];
            if (!entry?.valid) throw Error('此备份无法安全导出，原值未改写。');
            download(entry.snapshot, `chatgpt-pro-counter-backup-${Number(b.dataset.backupIndex) + 1}.json`);
            notice = '已导出所选备份；尚未导入、恢复或修改任何记录。'; render(); return;
          }
          if (['home', 'log', 'settings', 'sync'].includes(action)) { load(); tab = action; collapsed = false; render(true); return; }
          if (action === 'collapse' || action === 'expand') { if (action === 'expand') openPanel(); else closePanel(); return; }
          if (action === 'plus' || action === 'minus') { load(); manual(action === 'plus' ? 1 : -1); render(); return; }
          if (action === 'sync-now') { void doSync(); return; }
          if (action === 'sync-off') { const cfg = getDav(); verifiedSet(`${PREFIX}webdav`, { ...cfg, interval: 0 }); syncStatus = '自动同步已关闭；仍可手动同步'; const interval = root.querySelector('#dav-interval'); if (interval) interval.value = '0'; }
          if (action === 'sync-clear') { if (!win.confirm('清除本机保存的 WebDAV 地址与凭据？远端文件和本机计数记录保留。')) return; configEpoch++; currentAbort?.abort(); verifiedSet(`${PREFIX}webdav`, { version: 2, mode: 'base', url: '', username: '', password: '', interval: 0, enabled: false, tested: false, approved: false, revision: uuid() }); syncStatus = '已清除本机 WebDAV 配置'; render(true); return; }
          if (action === 'export') { load(); download(exportObject(), `chatgpt-pro-counter-${new Date().toISOString().slice(0, 10)}.json`); notice = storageAvailable ? '已生成本机记录导出文件' : '已导出本页已知记录；存储读取不完整，此文件可能缺少记录。请保留全部备份并检查本机数据。'; }
          if (action === 'import') { root.querySelector('#import').click(); return; }
          if (action === 'backup') {
            const saved = inspectStorage().backups.filter(entry => entry.valid).sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))[0]?.snapshot;
            if (!saved) notice = '当前没有可安全导出的备份；请打开本机数据检查，异常备份原值未改写。';
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
          backup('修改设置前'); verifiedSet(`${PREFIX}settings.${next.id}`, next); storedSettings = next; applyAccountLedger();
          if (target !== '') manual(Number(target) - summarize(records, settings).raw);
          notice = '已保存；修改前的快照可从“最近备份”导出。'; tab = 'home'; render();
        } catch (error) { notice = error.message; tab = 'home'; render(); }
      });
      root.addEventListener('change', async e => {
        if (e.target.id === 'dav-mode') { refreshDavMode(); return; }
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
    function refreshDavMode() {
      const base = root.querySelector('#dav-mode')?.value === 'base';
      const label = root.querySelector('#dav-url-label'), hint = root.querySelector('#dav-path-hint'), url = root.querySelector('#dav-url');
      if (label) label.textContent = base ? 'HTTPS 基础目录' : 'HTTPS 文件完整地址';
      if (url) url.setAttribute('placeholder', base ? 'https://你的服务器/dav/' : 'https://你的服务器/dav/pro-counter.json');
      if (hint) hint.textContent = base ? '自动在此地址下建立 ChatGPT-Toolkit/，同步文件为 data.json。切换地址前请先同步旧文件并导出备份。' : '保留原文件；切换基础目录前请先同步旧文件并导出备份，不自动搬移远端历史。';
    }
    const transport = hasStorage && typeof GM_xmlhttpRequest === 'function' ? createDavTransport(GM_xmlhttpRequest, typeof GM_info === 'object' ? GM_info : {}, 20000, entry => { syncDiagnostics.push(entry); if (syncDiagnostics.length > 12) syncDiagnostics.shift(); }) : async () => { throw Error('当前脚本管理器没有 WebDAV 请求权限'); };
    async function configureDav() {
      if (syncBusy) return;
      try {
        if (!storageAvailable) throw Error('本机存储不可用，WebDAV 已停用。请检查 Tampermonkey 权限后刷新。');
        const submittedForm = root.querySelector('#webdav');
        const prev = getDav(), priorConfig = JSON.stringify(prev), q = id => root.querySelector(`#${id}`).value;
        const url = q('dav-url').trim(), username = q('dav-user'), mode = q('dav-mode');
        const approved = root.querySelector('#dav-approved').checked;
        if (!approved) throw Error('请先勾选同步数据和本机保存凭据的说明');
        const password = q('dav-pass') || (url === prev.url && username === prev.username ? prev.password : '');
        const cfg = webDavConfig({ version: 2, mode, url, username, password, interval: Number(q('dav-interval')), enabled: true, tested: false, approved });
        const epoch = configEpoch; currentAbort = new AbortController();
        syncBusy = true; syncStatus = cfg.mode === 'base' ? '正在准备同步目录并测试读取权限' : '正在测试 WebDAV 读取权限'; render();
        await syncWebDav(cfg, { request: transport }, { testOnly: true, signal: currentAbort.signal, check: () => { if (configEpoch !== epoch || JSON.stringify(getDav()) !== priorConfig) throw Error('配置已在本页或其他标签页改变；操作取消'); } });
        if (configEpoch !== epoch || JSON.stringify(getDav()) !== priorConfig) throw Error('配置已在本页或其他标签页改变；操作取消');
        verifiedSet(`${PREFIX}webdav`, { ...cfg, tested: true, revision: uuid() });
        // Do not erase newer edits or disturb an active edit/composition when a
        // delayed test completes. Successful, inactive submitted fields can be
        // normalized/cleared without replacing the live form.
        if (root.querySelector('#webdav') === submittedForm) {
          const urlField = root.querySelector('#dav-url'), passwordField = root.querySelector('#dav-pass');
          if (urlField.value.trim() === url && root.activeElement !== urlField) urlField.value = cfg.url;
          if (passwordField.value === password && root.activeElement !== passwordField) passwordField.value = '';
        }
        lastSyncAttempt = Date.now(); syncStatus = cfg.mode === 'base' ? '配置已保存；读取测试通过。首次同步将合并或建立 data.json，文件写权限在同步时验证。' : '读取测试通过；原文件配置已保存。首次同步将合并或建立文件，写权限在同步时验证。';
      } catch (error) { syncStatus = error.message; }
      finally { syncBusy = false; render(); }
    }
    async function doSync(auto = false) {
      if (syncBusy) return;
      let cfg;
      try {
        if (!storageAvailable) throw Error('本机存储不可用，WebDAV 已停用。请检查 Tampermonkey 权限后刷新。');
        const rawConfig = getDav();
        cfg = webDavConfig(rawConfig);
        if (!cfg.enabled || !cfg.tested || !cfg.approved) throw Error('请先在“同步”中测试并保存配置');
        const epoch = configEpoch, priorConfig = JSON.stringify(rawConfig); currentAbort = new AbortController();
        const sameDestination = () => { if (!storageAvailable) throw Error('本机存储不可用，已取消同步写入。'); const current = getDav(); if (epoch !== configEpoch || JSON.stringify(current) !== priorConfig || !current.enabled || !current.approved) throw Error('同步配置已改变；操作取消'); };
        syncBusy = true; lastSyncAttempt = Date.now(); syncStatus = '正在合并 WebDAV 记录'; render();
        const result = await syncWebDav(cfg, { request: transport,
          local: () => { load(); return syncObject(); }, backup: () => backup('同步前'),
          apply: merged => {
            load();
            for (const ev of mergeEvents(records, merged.events.filter(event => !event.ledger.startsWith('unassigned:')))) { const previous = records.find(x => x.id === ev.id); if (!previous || JSON.stringify(previous) !== JSON.stringify(ev)) save(ev, true); }
            const latest = newestSettings(storedSettings, merged.settings); verifiedSet(`${PREFIX}settings.${latest.id}`, latest); storedSettings = latest; applyAccountLedger();
          } }, { signal: currentAbort.signal, check: sameDestination });
        syncStatus = `同步成功 ${fmt(Date.now())} · 合并 ${result.count} 条记录`;
        verifiedSet(`${PREFIX}lastSync`, lastSyncAttempt);
      } catch (error) { syncStatus = error.message; }
      finally { syncBusy = false; render(); }
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
        if (next === 'sync') refreshDavMode();
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
    function voiceStartControl(el) {
      // The empty composer's conversation launcher is distinct from dictation,
      // recording and in-call controls. Do not match generic voice labels.
      return el.matches('button[type="button"].size-token-button-composer') && /^(?:start voice(?: mode| chat| conversation)?|开始语音(?:聊天|对话)?|開始語音(?:聊天|對話)?)$/i.test((el.getAttribute('aria-label') || '').trim());
    }
    function selectionScope(trigger) {
      const known = composerFor(trigger) || trigger.closest(composerSelector);
      if (known) return known;
      // A native Send/voice-start + explicit model marker can share a plain-div
      // shell even before an editor mounts. Never widen to the page/main region.
      for (let scope = trigger.parentElement, depth = 0; scope && depth < 4; scope = scope.parentElement, depth++) {
        if (scope === document.body || scope === document.documentElement || scope.matches('main,article,[role="main"]') || scope.closest(excludedRegion)) break;
        const markers = [...scope.querySelectorAll(modelMarkerSelector)].filter(el => visibleControl(el) && !el.closest(excludedRegion));
        const actions = [...scope.querySelectorAll('button,[role="button"]')].filter(el => visibleControl(el) && (/^(?:send-button|composer-send-button|composer-submit-button)$/.test(el.getAttribute('data-testid') || '') || el.id === 'composer-submit-button' || (el.matches('button[type="submit"].size-token-button-composer') && /^(?:send(?: message| prompt)?|发送(?:消息|提示)?|傳送(?:訊息|提示)?|送信)$/i.test(el.getAttribute('aria-label') || '')) || voiceStartControl(el)));
        if (markers.length !== 1 || actions.length !== 1 || [...scope.querySelectorAll(composerSelector)].length) continue;
        const model = markers[0].getBoundingClientRect(), send = actions[0].getBoundingClientRect();
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
        const startVoice = voiceStartControl(el);
        if (/microphone|(?:^|\W)mic(?:\W|$)|speech|audio|dictat|stop|pause|record|麦克风|麥克風|听写|聽寫|录音|錄音|朗读|朗讀|停止|暂停|暫停|upgrade|subscribe|升级|升級/i.test(label) || (!startVoice && /voice|语音|語音/i.test(label))) { detail.match = 'excluded-control'; return finish(null); }
        if (startVoice) { detail.match = 'voice-start-control'; detail.scope = 'direct-voice-start-anchor'; return finish(el); }
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
      diagnostics.state.hoverRawMarkers = document.querySelectorAll(modelMarkerSelector).length;
      diagnostics.state.hoverRawSends = [...document.querySelectorAll(controlSelector)].filter(el => /^(?:send-button|composer-send-button|composer-submit-button)$/.test(el.getAttribute('data-testid') || '') || el.id === 'composer-submit-button' || (el.matches('button[type="submit"].size-token-button-composer') && /^(?:send(?: message| prompt)?|发送(?:消息|提示)?|傳送(?:訊息|提示)?|送信)$/i.test((el.getAttribute('aria-label') || '').trim()))).length;
      diagnostics.state.hoverRawVoices = [...document.querySelectorAll('button')].filter(voiceStartControl).length;
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
      renderMarkup(hoverRoot, `<style>${style}</style><section class="hover-card" aria-label="Pro 用量，本机估算"><div class="hover-title"><span class="pro-label">✦ Pro</span><span>${settings.mode === 'fixed' ? '本周期' : '最近七天'} · 本机估算</span></div><div class="number">${!storageAvailable ? '待核对' : accountPending() ? '待识别' : total.remaining}<span> 次剩余</span></div><div class="image-quota" title="仅显示本页刚观察到的图片额度；最多保留 60 秒，不主动查询">${imageLine}</div><div class="meter" aria-hidden="true"><div class="fill" style="width:${accountPending() ? 0 : Math.min(100, total.used / settings.cap * 100)}%"></div></div><div class="hover-footer"><span>已用 ${!storageAvailable ? '待核对' : accountPending() ? '待识别' : total.used} / ${settings.cap}</span><button type="button" data-action="manage">管理用量 ↗</button></div>${storageError ? '<div class="hover-error">存储异常，请打开计数器检查</div>' : ''}</section>`);
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
        if (event.isComposing || event.keyCode === 229) return;
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
    try {
      moduleMetadataBridge = startPageMetadataBridge(win, document, { runtimeSource: pageMetadataRuntime.toString(), transformerSource: metadataTransformerSource, enabled: messageInfoState.enabled(), changed: scheduleMessageInfo });
      messageInfoState.moduleBridge(moduleMetadataBridge);
    } catch { if (diagnostics) diagnostics.state.messageInjection = 'bootstrap-failed'; }
    diagnostics?.mark('install-observer');
    try {
      observer = installObserver(win, { save: saveObserved, ledger: () => { load(); return settings.ledger; }, captureLedger: () => account.enabled() ? account.capture() : settings.ledger, imageQuota, pow, account, messageInfoState });
      if (diagnostics) diagnostics.state.observer = observer.healthy() ? 'installed' : 'not-active';
    } catch (error) {
      storageError = [storageError, '观察器未成功安装。仍可手动计数；请刷新并检查脚本权限。'].filter(Boolean).join(' ');
      if (diagnostics) diagnostics.state.observer = 'failed';
      diagnostics?.fail('install-observer', error);
    }
    diagnostics?.mark('mount');
    safeMount(); scheduleMessageInfo();
    win.addEventListener('popstate', () => { messageInfoState.syncPage(); scheduleMessageInfo(); });
    win.addEventListener('pagehide', () => messageInfoState.invalidate());
    document.addEventListener('DOMContentLoaded', safeMount, { once: true });
    // React navigation can replace the body or remove our host. Reattach the same roots.
    try { new MutationObserver(() => { scheduleMessageInfo(); if (quotaPage !== win.location.href) invalidateImageQuota(); if (document.body && (!host?.isConnected || !hoverHost?.isConnected)) safeMount(); if (activeTrigger && !nativeTrigger(activeTrigger)) hideHover(); scheduleNativeBindings(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['aria-label', 'aria-hidden', 'data-testid', 'type', 'class', 'style', 'hidden', 'inert', 'id', 'data-codex-intelligence-trigger', 'data-composer-navigation-target', 'data-message-id', 'data-message-author-role', 'data-message-model-slug', 'data-turn-key', 'data-user-message-bubble', 'data-content-search-turn-key', 'data-chatgpt-conversation-selection-target', 'data-app-action-timeline-scroll'] }); } catch { /* interval below also recovers */ }
    setInterval(() => {
      scheduleMessageInfo();
      const mounted = safeMount(); const before = lastKeys, s = settings.id; load();
      if (mounted) { if (before !== lastKeys || s !== settings.id || !document.hidden) render(); }
      bindNativeControls(); if (activeTrigger) updateHover(); else if (quotaPage !== win.location.href || document.hidden) invalidateImageQuota(); positionHover();
    }, 5000);
    setInterval(() => { try { const cfg = getDav(); const since = Math.max(lastSyncAttempt, Number(gmGet(`${PREFIX}lastSync`, 0))); if (storageAvailable && cfg.enabled && cfg.tested && cfg.approved && cfg.interval > 0 && Date.now() - since >= cfg.interval * 60000) void doSync(true); } catch { /* no optional-sync failure may remove the UI */ } }, 15000);
    win.addEventListener('focus', () => { const mounted = safeMount(); load(); if (mounted) render(); });
    diagnostics?.mark('ready');
  }
  return { WEEK, PREFIX, inspectLocalStorage, storageSummary, completeStorage, modelKind, defaultSettings, validSettings, validEvent, windowFor, kindFor, mergeEvents, grouped, summarize,
    conversationPage, conversationHistoryRequest, messageInfo, createMessageInfoState, createNativeMessageReader, createCommittedMessageIndex, currentItemTargets, currentMessageAncestors, renderMessageInfo, IMAGE_QUOTA_TTL, imageQuotaRequest, parseImageQuota, createImageQuotaState, powRequest, parsePow, createPowState, accountRequest, parseAccountId, createAccountState, requestMeta, digest, targetRequest, readBounded, prepareMeta, parseMetadata, inspectResponse, installObserver, decodeImport, webDavConfig, webDavTargets, supportedManager, createDavTransport, etagOf, newestSettings, snapshot, syncWebDav, renderMarkup, hoverPosition, boot };
});



