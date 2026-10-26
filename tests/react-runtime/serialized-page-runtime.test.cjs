'use strict';
// Execute the serialized production runtime in a fresh JavaScript page realm.
// The wrapping fetch property is a controlled model, not a claim about the live
// site's implementation. Requests below are explicit local test stubs only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { buildSync } = require('esbuild');
const { pageMetadataRuntime } = require('../../src/metadata/metadata-page-runtime.cjs');
const transformer = fs.readFileSync(path.join(__dirname, '../../src/metadata/module-metadata-transform.browser.js'), 'utf8');
const bundle = buildSync({ entryPoints: [path.join(__dirname, './module-fixture.cjs')], bundle: true, write: false, platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' } }).outputFiles[0].text;
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
function setup({ wrapped = false, locked = false } = {}) {
  const dom = new JSDOM('<html><head><meta id="bridge-test_status"></head><body><div id="app"></div></body></html>', { url: 'https://fixture.invalid/c/chat-a', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, status = w.document.getElementById('bridge-test_status'), calls = [];
  const answer = Promise.resolve({ local: true });
  let assigned = function (...args) { calls.push({ receiver: this, args }); return answer; };
  if (wrapped) Object.defineProperty(w, 'fetch', { configurable: true, get() { return new Proxy(assigned, {}); }, set(value) { assigned = value; } });
  else Object.defineProperty(w, 'fetch', { value: assigned, writable: !locked, configurable: true });
  w.eval('(' + pageMetadataRuntime.toString() + ')({key:"bridge-test",statusId:"bridge-test_status",eventName:"control",enabled:true},(' + transformer + '));');
  return { w, calls, answer, read: key => status.getAttribute('data-' + key), run() { w.eval(bundle); }, event(value) { w.document.dispatchEvent(new w.CustomEvent('control', { detail: value })); }, close() { w.moduleFixture?.unmount(); dom.window.close(); } };
}

test('serialized page runtime preserves undefined/null/object this for strict original components', () => {
  const e = setup();
  try {
    e.w.eval(`
      const R={createElement(type,props,...children){return {type,props:props||{},children}},createContext(){return {}},useContext(){},useSyncExternalStore(){},useLayoutEffect(){},Component:class{},Fragment:Symbol()};
      const p={conversationId:'chat-a',item:{type:'user-message',messageId:'question'}};
      let received; function Original(){'use strict';received=this;return {props:{}}}
      const user=window['bridge-test'].message(Original,R,false), boundary=window['bridge-test'].boundary(Original,R);
      window.results=[];for(const expected of [undefined,null,{}])for(const wrapped of [user,boundary]){wrapped.call(expected,p);results.push(received===expected)};
    `);
    assert.equal(e.w.results.length, 6); assert.ok(Array.from(e.w.results).every(Boolean)); assert.equal(e.calls.length, 0);
  } finally { e.close(); }
});

test('serialized observeCall executes exactly one original call with original argument ordering and exception', () => {
  const e = setup();
  try {
    e.w.eval(`
      let cid='before', log=[], count=0, result={};
      const selector={get mapping(){log.push('selector');cid='after';return 'mapping'}};
      function get(which,id){'use strict';log.push('get');count++;if(this!==undefined||which!=='mapping'||id!=='after')throw Error('changed invocation');cid='changed-in-get';return result}
      const returned=window['bridge-test'].observeCall(get,selector.mapping,cid);
      const error={native:true};let sameError=false;try{window['bridge-test'].observeCall(()=>{throw error},'s','chat-a')}catch(value){sameError=value===error}
      window.callResult={same:returned===result,count,log,sameError};
    `);
    assert.equal(e.w.callResult.same, true); assert.equal(e.w.callResult.count, 1); assert.deepEqual(Array.from(e.w.callResult.log), ['selector', 'get']); assert.equal(e.w.callResult.sameError, true); assert.equal(e.calls.length, 0);
  } finally { e.close(); }
});

test('serialized recompiled factory retains strictness inherited from its original script', () => {
  const e = setup();
  try {
    e.w.eval(`"use strict";
      window.req=function req(id){if(req.c[id])return req.c[id].exports;const m={id,exports:{}};req.c[id]=m;req.m[id].call(m.exports,m,m.exports,req);return m.exports};
      req.C=()=>{};req.c={};req.m={
        content(m,e,r){var S=r('selectors');e.thisValue=()=>function(){return this};e.read=(get,cid)=>{let value=get(S.mapping,cid);return{mapping:value,context_truncation_continuation:null,getRenderTelemetry:null,isStreaming:false}}},
        selectors(m,e,r){e.mapping={}}
      };
      window.beforeSource=String(req.m.content);window.strictResult=req('content').thisValue().call(undefined);
    `);
    assert.equal(e.w.beforeSource.includes('use strict'), false);
    assert.equal(e.read('factories'), '1'); assert.equal(e.w.strictResult, undefined); assert.equal(e.calls.length, 0);
  } finally { e.close(); }
});

test('a wrapping fetch getter can prove natural reachability without any probe request or native rerender', async () => {
  const e = setup({ wrapped: true });
  try {
    assert.equal(e.read('account-fence'), 'unconfirmed'); assert.equal(e.read('account'), 'waiting-fence'); assert.equal(e.calls.length, 0);
    e.run(); await settle();
    assert.equal(e.w.moduleFixture.inspect().labels.length, 0); assert.equal(e.w.moduleFixture.inspect().nativeCalls, 2);
    const input='/backend-api/conversation/chat-a', init={method:'GET'}, receiver={};
    assert.equal(Reflect.apply(e.w.fetch,receiver,[input,init]),e.answer); await settle();
    assert.equal(e.calls.length,1); assert.equal(e.calls[0].receiver,receiver); assert.equal(e.calls[0].args[0],input); assert.equal(e.calls[0].args[1],init);
    assert.equal(e.read('account-fence'),'observed'); assert.equal(e.read('account'),'ready');
    assert.equal(e.w.moduleFixture.inspect().labels.length,2); assert.equal(e.w.moduleFixture.inspect().nativeCalls,2);
  } finally { e.close(); }
});

test('natural fetch reachability never reopens a genuine hard account pause', async () => {
  const e=setup({wrapped:true});
  try {
    e.run();await settle();e.event('invalidate');
    e.w.fetch('/backend-api/conversation/chat-a');await settle();
    assert.equal(e.read('account-fence'),'observed');assert.equal(e.read('account'),'paused-account');
    e.w.moduleFixture.fresh();await settle();assert.equal(e.w.moduleFixture.inspect().labels.length,0);assert.equal(e.read('rows'),'0');assert.equal(e.calls.length,1);
  } finally {e.close();}
});

test('an unreachable non-writable fetch keeps real React labels closed without an automatic request',async()=>{
  const e=setup({locked:true});
  try{
    e.run();await settle();assert.equal(e.w.moduleFixture.inspect().labels.length,0);assert.equal(e.read('account'),'waiting-fence');assert.equal(e.calls.length,0);
    e.w.fetch('/backend-api/conversation/chat-a');await settle();assert.equal(e.calls.length,1);assert.equal(e.read('account-fence'),'unconfirmed');assert.equal(e.w.moduleFixture.inspect().labels.length,0);
  }finally{e.close();}
});
