'use strict';
// Genuine SSR/hydration, deep committed Fibers and external-store updates.
// No app modules or component functions are replaced by Toolkit.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom'), { buildSync } = require('esbuild');
const source = fs.readFileSync(path.join(__dirname, '../../chatgpt-pro-counter.user.js'), 'utf8');
const bundle = buildSync({ stdin: { resolveDir: __dirname, sourcefile: 'passive-inline-fixture.cjs', contents: `
const React=require('react'),{renderToString}=require('./node_modules/react-dom/cjs/react-dom-server-legacy.browser.production.js'),{hydrateRoot}=require('react-dom/client'),{flushSync}=require('react-dom');
let renders=0,snapshots=0,book='chat-a',listeners=new Set(),bump;
const make=model=>({question:{message:{id:'question',author:{role:'user'},create_time:1770000000,metadata:{}}},answer:{message:{id:'answer',author:{role:'assistant'},recipient:'all',create_time:1770000001,metadata:{resolved_model_slug:model,thinking_effort:'max'}}}});
let mapping=make('passive-actual-model');
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)},get=()=>{snapshots++;return mapping};
function User(){renders++;const id=React.useId();return React.createElement('section',{id:'question'},React.createElement('label',{id},id),React.createElement('div',{'data-user-message-bubble':''},'Synthetic question'))}
function Assistant(props){renders++;React.useId();return React.createElement('article',{id:'answer'},'Synthetic answer',React.createElement('div',{id:'actions'},React.createElement('button',{'aria-label':'Copy'},'copy'),React.createElement('button',{'aria-label':'More'},'more')),props.sourcesAction?React.createElement('footer',null,props.sourcesAction):null)}
function Nest({depth,children}){return depth?React.createElement(Nest,{depth:depth-1},children):children}
function Boundary(){React.useSyncExternalStore(subscribe,get,get);const [n,set]=React.useState(0);bump=()=>set(v=>v+1);return React.createElement('main',null,React.createElement('span',{id:'commit-tick'},n),React.createElement(Nest,{depth:window.fixtureDepth},React.createElement(User,{conversationId:book,item:{type:'user-message',messageId:'question'}}),React.createElement(Assistant,{conversationId:book,assistantItem:{type:'assistant-message',messageId:'answer'},sourcesAction:undefined}))) }
const tree=()=>React.createElement(Boundary,{conversationId:book,browserConversationId:book,renderedTurns:[]}),container=document.getElementById('app');
container.innerHTML=renderToString(tree());const initial=container.firstChild,before=container.innerHTML;window.installToolkit();window.recoveries=[];
window.nativeRoot=hydrateRoot(container,tree(),{onRecoverableError:e=>recoveries.push(e.message)});
window.fixture={inspect:()=>({before,after:(()=>{const clone=container.cloneNode(true);for(const badge of clone.querySelectorAll('.chatgpt-toolkit-message-info'))badge.remove();return clone.innerHTML})(),sameNode:container.firstChild===initial,renders,snapshots,recoveries,sourceSlot:!!document.querySelector('#answer footer')}),update(model,conversation=book){flushSync(()=>{book=conversation;mapping=make(model);for(const fn of listeners)fn();bump();window.nativeRoot.render(tree())})}};
` }, bundle: true, write: false, platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' } }).outputFiles[0].text;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(depth) {
  const dom = new JSDOM('<html><head></head><body><div id="app"></div></body></html>', { url: 'https://chatgpt.com/c/chat-a', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, roots = [], menus = [], writes = [], errors = [], observers = [], store = new Map();
  const NativeObserver=w.MutationObserver;w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this)}};
  const settings = {v:1,id:'existing',updated:1770000000000,cap:200,mode:'fixed',anchor:1770000000000,ledger:'default',label:'Existing ledger'};
  store.set('gpc.v1.settings.existing', settings); store.set('gpc.v1.ui.messageInfo', true);
  const beforeStore = JSON.stringify([...store]); let requests = 0;
  w.GM_getValue=(key,fallback)=>store.has(key)?store.get(key):fallback;
  w.GM_setValue=(key,value)=>{writes.push(key);store.set(key,value)}; w.GM_listValues=()=>[...store.keys()];
  w.GM_registerMenuCommand=(name,fn)=>menus.push({name,fn});w.GM_info={scriptHandler:'Tampermonkey',version:'5.5.1'};
  w.unsafeWindow=w;w.matchMedia=()=>({matches:false,addEventListener(){}});w.alert=()=>{};
  w.fetch=()=>{requests++;return Promise.resolve(new Response('{}',{headers:{'content-type':'application/json'}}))};
  w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.fixtureDepth=depth;
  w.addEventListener('error',e=>errors.push(String(e.error)));
  const attach=w.Element.prototype.attachShadow;w.Element.prototype.attachShadow=function(options){const root=Reflect.apply(attach,this,[options]);roots.push(root);return root};
  w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:100,right:700,top:100,bottom:130,width:600,height:30}};
  const nativeCall=w.Function.prototype.call;w.installToolkit=()=>w.eval(source);w.eval(bundle);await wait(380);
  const labels=()=>[...w.document.querySelectorAll('.chatgpt-toolkit-message-info')];
  const refresh=()=>menus.find(m=>m.name==='诊断 Pro 计数器').fn();
  return {w,dom,roots,menus,writes,store,beforeStore,errors,nativeCall,labels,refresh,get requests(){return requests},close(){for(const observer of observers)observer.disconnect();w.nativeRoot?.unmount();dom.window.close()}};
}
for (const depth of [12, 320]) test(`passive inline preserves SSR/useId/native action slot at depth ${depth}`, async () => {
  const e = await setup(depth);
  try {
    const before=e.w.fixture.inspect();assert.equal(before.recoveries.length,0);assert.equal(before.sameNode,true);assert.equal(before.before,before.after);assert.equal(before.sourceSlot,false);
    assert.equal(e.labels().length,2);assert.match(e.labels()[1].textContent,/passive-actual-model/);
    assert.equal(e.labels()[1].parentNode.id,'actions');assert.equal(e.labels()[1].style.position,'static');assert.match(e.labels()[1].textContent,/max/);
    assert.equal(e.w.Function.prototype.call,e.nativeCall);assert.equal(e.requests,0);assert.deepEqual(e.writes,[]);assert.equal(JSON.stringify([...e.store]),e.beforeStore);
    e.refresh();const after=e.w.fixture.inspect();assert.equal(after.renders,before.renders);assert.equal(after.snapshots,before.snapshots);assert.equal(after.before,after.after);
    e.w.fixture.update('updated-response-model');await wait(300);assert.match(e.labels()[1].textContent,/updated-response-model/);assert.equal(e.w.fixture.inspect().sourceSlot,false);
    e.w.history.replaceState(null,'','/c/chat-b');e.w.dispatchEvent(new e.w.PopStateEvent('popstate'));await wait(250);assert.equal(e.labels().length,0,'old conversation data is never borrowed');
    e.w.fixture.update('chat-b-response-model','chat-b');await wait(300);assert.equal(e.labels().length,2);assert.match(e.labels()[1].textContent,/chat-b-response-model/);
    e.menus.find(m=>m.name==='显示 Pro 计数器').fn();const ui=e.roots.find(r=>r.host.id==='chatgpt-pro-local-counter');ui.querySelector('[data-action="settings"]').click();ui.querySelector('#message-info-off').click();await wait(250);assert.equal(e.labels().length,0);assert.equal(e.store.get('gpc.v1.ui.messageInfo'),false);
    ui.querySelector('#message-info-on').click();await wait(250);assert.equal(e.labels().length,2);assert.equal(e.requests,0);assert.deepEqual(e.errors,[]);assert.equal(e.w.fixture.inspect().recoveries.length,0);
    await e.w.fetch('/api/auth/session');assert.equal(e.labels().length,0,'account boundary clears display before the native response');await wait(260);assert.equal(e.labels().length,0,'same cached mapping cannot return after account invalidation');assert.equal(e.requests,1);
  } finally {e.close()}
});
