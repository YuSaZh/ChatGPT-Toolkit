'use strict';
// Full userscript execution in a fresh page realm, not a direct call to a mock
// bridge. All requests below are explicitly issued by this test to local stubs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '../../chatgpt-pro-counter.user.js'), 'utf8');
const sleep = () => new Promise(resolve => setTimeout(resolve, 300));
function setup(saved) {
  const dom = new JSDOM('<html><head><script nonce="local-test"></script></head><body><main><div data-message-id="m1" data-message-author-role="assistant">Synthetic unchanged message</div></main></body></html>', {url:'https://chatgpt.com/c/test-chat',runScripts:'dangerously',pretendToBeVisual:true});
  const observers=[], errors=[], shadowRoots=[], alerts=[];
  const w=dom.window, nativeCall=w.Function.prototype.call, originalMain=w.document.querySelector('main').innerHTML;
  const attachShadow=w.Element.prototype.attachShadow;w.Element.prototype.attachShadow=function(options){const root=Reflect.apply(attachShadow,this,[options]);shadowRoots.push({host:this,root});return root};
  const NativeObserver=w.MutationObserver;w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this)}};w.addEventListener('error',event=>errors.push(event.error));
  const settings={v:1,id:'rollback-fixture',updated:1770000000000,cap:100,mode:'fixed',anchor:1770000000000,ledger:'default',label:'Synthetic ledger'};
  const store=new Map([['gpc.v1.settings.rollback-fixture',settings],['gpc.v1.ui.messageInfo',saved]]), before=JSON.stringify([...store]), writes=[], menus=[], added=[], scans=[], requests=[];
  const create=w.document.createElement.bind(w.document);w.document.createElement=function(name,...args){if(['script','meta'].includes(String(name).toLowerCase()))added.push(String(name));return create(name,...args)};
  const query=w.document.querySelectorAll.bind(w.document);w.document.querySelectorAll=function(selector){scans.push(selector);return query(selector)};
  let clones=0;const response=new Response(JSON.stringify({conversation_id:'test-chat',mapping:{m1:{message:{id:'m1',author:{role:'assistant'},create_time:1770000000,metadata:{model_slug:'synthetic-model'}}}}}),{headers:{'content-type':'application/json'}});
  const clone=response.clone.bind(response);response.clone=()=>{clones++;return clone()};const answer=Promise.resolve(response);
  let fetchValue=function(...args){requests.push({receiver:this,args});return answer}, assignments=0;
  Object.defineProperty(w,'fetch',{configurable:true,get(){return fetchValue},set(value){assignments++;fetchValue=value}});
  w.GM_getValue=(key,fallback)=>store.has(key)?store.get(key):fallback;
  w.GM_setValue=(key,value)=>{writes.push(key);store.set(key,value)};
  w.GM_listValues=()=>[...store.keys()];w.GM_registerMenuCommand=(name,fn)=>menus.push({name,fn});
  w.GM_info={scriptHandler:'Tampermonkey',script:{version:'1.1.19'}};
  w.unsafeWindow=w;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.alert=text=>alerts.push(text);
  w.eval(source);
  return {w,store,before,writes,menus,added,scans,requests,errors,shadowRoots,alerts,nativeCall,originalMain,answer,get clones(){return clones},get assignments(){return assignments},close(){for(const observer of observers)observer.disconnect();dom.window.close()}};
}
for(const saved of [true,false]) test(`safety rollback preserves saved ${saved} while leaving native message markup and module entry untouched`,async()=>{
 const e=setup(saved);
 try{
  await sleep();
  assert.deepEqual(e.errors,[]);
  assert.ok(e.w.document.getElementById('chatgpt-pro-local-counter'),'existing counter still mounts');
  assert.equal(e.w.Function.prototype.call,e.nativeCall,'no global call hook');
  assert.deepEqual(e.added,[],'no metadata bridge script or status meta');
  assert.equal(e.assignments,1,'only the pre-existing counter fetch observer is installed');
  assert.equal(e.requests.length,0,'boot does not issue requests');
  e.menus.find(menu=>menu.name==='显示 Pro 计数器').fn();
  const root=e.shadowRoots.find(entry=>entry.host.id==='chatgpt-pro-local-counter').root;
  root.querySelector('[data-action="settings"]').click();
  const on=root.querySelector('#message-info-on'),off=root.querySelector('#message-info-off');
  assert.equal(on.disabled,true);assert.equal(off.disabled,true);assert.equal(on.getAttribute('aria-pressed'),String(saved));
  assert.match(root.querySelector('#message-info-status').textContent,/暂停/);
  on.dispatchEvent(new e.w.MouseEvent('click',{bubbles:true}));off.dispatchEvent(new e.w.MouseEvent('click',{bubbles:true}));
  e.menus.find(menu=>menu.name==='诊断 Pro 计数器').fn();assert.match(e.alerts.at(-1),/消息信息: paused-safety/);assert.match(e.alerts.at(-1),/只读模块注入: paused-safety/);
  assert.equal(JSON.stringify([...e.store]),e.before,'all pre-existing persistent values are preserved');
  assert.deepEqual(e.writes,[],'no stored preference is silently overwritten');
  assert.equal(e.w.document.querySelector('main').innerHTML,e.originalMain,'no fallback labels or native markup changes');
  assert.equal(e.w.document.querySelector('[data-chatgpt-toolkit-info],.chatgpt-toolkit-message-info'),null);
  assert.ok(!e.scans.some(s=>String(s).includes('[data-message-id]')),'no legacy/native metadata scan');
  const receiver={},input='/backend-api/conversation/test-chat',init={method:'GET'};
  assert.equal(Reflect.apply(e.w.fetch,receiver,[input,init]),e.answer,'counter observer preserves promise identity');
  await sleep();
  assert.equal(e.requests.length,1);assert.equal(e.requests[0].receiver,receiver);assert.equal(e.requests[0].args[0],input);assert.equal(e.requests[0].args[1],init);
  assert.equal(e.clones,0,'history-only responses are not consumed by paused metadata');
  e.w.history.replaceState(null,'','/c/second-chat');e.w.dispatchEvent(new e.w.PopStateEvent('popstate'));await sleep();
  assert.deepEqual(e.added,[]);assert.equal(e.w.Function.prototype.call,e.nativeCall);assert.equal(e.assignments,1);assert.equal(e.requests.length,1);assert.equal(e.w.document.querySelector('main').innerHTML,e.originalMain);assert.equal(JSON.stringify([...e.store]),e.before);assert.deepEqual(e.errors,[]);
 }finally{e.close()}
});
