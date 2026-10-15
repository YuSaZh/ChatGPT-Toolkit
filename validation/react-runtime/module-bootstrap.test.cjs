'use strict';
// Real jsdom DOM, page-realm JavaScript, and source transformer; CSP outcomes
// and webpack's documented factory/cache contract are controlled test inputs.
// No live site, request, extension, or hand-made React Fiber is used here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { startPageMetadataBridge } = require('../../metadata-page-bootstrap.cjs');
const { pageMetadataRuntime } = require('../../metadata-page-runtime.cjs');
const transformerSource = fs.readFileSync(path.join(__dirname, '../../module-metadata-transform.browser.js'), 'utf8');
async function settle() { await new Promise(resolve => setImmediate(resolve)); }
function setup({ requiredNonce = null } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://chatgpt.com/c/chat-a', runScripts: 'outside-only' });
  const w = dom.window, d = w.document, timers = new Map(), attempts = [];
  let timerId = 0, requests = 0;
  w.fetch = () => { requests++; throw Error('Unexpected network'); };
  w.XMLHttpRequest = class { constructor() { requests++; throw Error('Unexpected XHR'); } };
  w.setTimeout = fn => { const id = ++timerId; timers.set(id, fn); return id; };
  w.clearTimeout = id => timers.delete(id);
  const nativeAppend = w.Node.prototype.appendChild;
  w.Node.prototype.appendChild = function (node) {
    const result = Reflect.apply(nativeAppend, this, [node]);
    if (node.tagName === 'SCRIPT' && node.textContent) {
      const allowed = requiredNonce === null || node.nonce === requiredNonce;
      attempts.push({ nonce: node.nonce, allowed });
      if (allowed) w.eval(node.textContent);
    }
    return result;
  };
  w.bootstrapOptions = { key: '__audit_metadata_bridge', runtimeSource: pageMetadataRuntime.toString(), transformerSource, enabled: true };
  w.eval('window.bridgeControl=(' + startPageMetadataBridge.toString() + ')(window,document,bootstrapOptions)');
  const control = w.bridgeControl;
  function nonce(value) { const node = d.createElement('script'); node.nonce = value; d.head.appendChild(node); return node; }
  function fireTimers() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } }
  function webpack({ cached = false } = {}) {
    w.eval(`
      window.executions=0;window.getCalls=0;
      window.req=function req(id){if(req.c[id])return req.c[id].exports;const m={id,exports:{}};req.c[id]=m;req.m[id].call(m.exports,m,m.exports,req);return m.exports;};
      req.C=function(){};req.c={};req.m={
        entry:function(m,e,r){window.executions++;e.ok=true;},
        mapping:function(m,e,r){var S=r("selectors");e.read=(get,cid)=>{let value=get(S.mapping,cid);return {mapping:value,context_truncation_continuation:null,getRenderTelemetry:null,isStreaming:false}};},
        selectors:function(m,e,r){e.mapping={};}
      };
      ${cached ? 'req.c.mapping={id:"mapping",exports:{cached:true}};' : ''}
      window.originalMapping=req.m.mapping;
      req('entry');
    `);
  }
  return { w, d, control, attempts, timers, nonce, fireTimers, webpack, requests: () => requests, close() { control.destroy(); dom.window.close(); } };
}

test('page bootstrap: no-nonce CSP block retries on a later native nonce and requires real acknowledgement', async () => {
  const e = setup({ requiredNonce: 'valid-nonce' });
  try {
    assert.equal(e.control.inspect().page, 'not-started');
    assert.equal(e.control.inspect().bootstrap, 'no-page-ack');
    e.nonce('valid-nonce'); await settle();
    assert.equal(e.control.inspect().page, 'ready');
    assert.equal(e.control.inspect().bootstrap, 'ready');
    assert.equal(e.control.inspect().hook, 'installed');
    assert.deepEqual(e.attempts.map(x => x.allowed), [false, true]);
    assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page bootstrap: absent acknowledgement never becomes successful after timeout', async () => {
  const e = setup({ requiredNonce: 'unavailable' });
  try {
    await settle(); e.fireTimers();
    assert.equal(e.control.inspect().bootstrap, 'needs-refresh-or-page-access');
    assert.equal(e.control.active(), false);
    assert.equal(e.w.__audit_metadata_bridge, undefined);
    assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page bootstrap: display preference changes before delayed acknowledgement are preserved', async () => {
  const e = setup({ requiredNonce: 'valid' });
  try {
    e.control.setEnabled(false); e.nonce('valid'); await settle();
    assert.equal(e.control.inspect().enabled, 'off');
    e.control.setEnabled(true); assert.equal(e.control.inspect().enabled, 'on');
    assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page bootstrap: explicit account invalidation before delayed acknowledgement cannot disappear', async () => {
  const e = setup({ requiredNonce: 'valid' });
  try {
    e.control.invalidate('account'); e.control.invalidate('session');
    e.nonce('valid'); await settle();
    assert.equal(e.control.inspect().account, 'paused-account');
    const value = { a: { message: { id: 'a', author: { role: 'assistant' }, create_time: 1770000000, metadata: { model_slug: 'old' } } } };
    assert.equal(e.w.__audit_metadata_bridge.observe(value, 'chat-a'), value);
    assert.notEqual(e.control.inspect().rows, '1');
  } finally { e.close(); }
});

test('page bootstrap: any number of ordinary startup identity GETs before acknowledgement remains a soft reset', async () => {
  const e = setup({ requiredNonce: 'valid' });
  try {
    for (const reason of ['request:session', 'request:read', 'request:read', 'request:session']) e.control.invalidate(reason);
    e.nonce('valid'); await settle();
    assert.notEqual(e.control.inspect().account, 'paused-account');
    const value = { a: { message: { id: 'a', author: { role: 'assistant' }, create_time: 1770000000, metadata: { model_slug: 'current' } } } };
    assert.equal(e.w.__audit_metadata_bridge.observe(value, 'chat-a'), value);
    assert.equal(e.control.inspect().rows, '1'); assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page bootstrap: a write between startup identity reads stays hard before acknowledgement', async () => {
  const e = setup({ requiredNonce: 'valid' });
  try {
    for (const reason of ['request:read', 'request:invalidate', 'request:session', 'request:read']) e.control.invalidate(reason);
    e.nonce('valid'); await settle();
    assert.equal(e.control.inspect().account, 'paused-account'); assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page runtime: already cached factory without loaded flag is never re-executed or falsely patched', () => {
  const e = setup();
  try {
    e.webpack({ cached: true });
    assert.equal(e.w.executions, 1);
    assert.equal(e.w.req.m.mapping, e.w.originalMapping);
    assert.equal(e.control.inspect().patch, 'needs-refresh');
    assert.equal(e.w.req('mapping').cached, true);
    assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page runtime: natural mapping evaluation retains exact result and native call count', () => {
  const e = setup();
  try {
    e.webpack();
    e.w.eval(`window.value={answer:{message:{id:'answer',author:{role:'assistant'},create_time:1770000000,metadata:{model_slug:'known'}}}};window.result=req('mapping').read((selector,cid)=>{getCalls++;if(cid!=='chat-a')throw Error('wrong cid');return value;},'chat-a');`);
    assert.equal(e.w.result.mapping, e.w.value);
    assert.equal(e.w.getCalls, 1);
    assert.equal(e.w.executions, 1);
    assert.equal(e.control.inspect().mapping, '1');
    assert.equal(e.control.inspect().rows, '1');
    assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page runtime: timeout cannot remove a later independently installed Function.call hook', () => {
  const e = setup();
  try {
    e.w.eval('window.ours=Function.prototype.call;window.later=new Proxy(ours,{apply(t,receiver,args){return Reflect.apply(t,receiver,args)}});Function.prototype.call=later;');
    e.fireTimers();
    assert.equal(e.w.Function.prototype.call, e.w.later);
    assert.equal(e.control.inspect().runtime, 'not-seen-refresh');
    assert.equal(e.requests(), 0);
  } finally { e.close(); }
});

test('page runtime: acquiring webpack preserves an independently installed later call hook', () => {
  const e = setup();
  try {
    e.w.eval('window.ours=Function.prototype.call;window.later=new Proxy(ours,{apply(t,receiver,args){return Reflect.apply(t,receiver,args)}});Function.prototype.call=later;');
    e.webpack();
    assert.equal(e.w.Function.prototype.call, e.w.later);
    assert.equal(e.control.inspect().runtime, 'found');
    assert.equal(e.w.executions, 1);
    assert.equal(e.requests(), 0);
  } finally { e.close(); }
});
