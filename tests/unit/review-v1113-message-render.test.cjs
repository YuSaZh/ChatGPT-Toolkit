'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const api=require('../../chatgpt-pro-counter.user.js');
const {environment}=require('../fixtures/audit-dom-fixture.cjs');
function setup() {
 const e=environment();e.win.location.href='https://chatgpt.com/c/c1';
 const state=api.createMessageInfoState({page:()=>e.win.location.href}),badges=new Map();
 const add=(id,role='assistant')=>{const n=e.document.createElement('div');n.setAttribute('data-message-id',id);n.setAttribute('data-message-author-role',role);n.textContent='UNCHANGED USER CONTENT';e.document.body.appendChild(n);return n;};
 const load=(messages)=>state.history(state.capture('c1'),{conversation_id:'c1',mapping:Object.fromEntries(messages.map(m=>[m.id,{message:m}]))});
 const row=(id,role='assistant',extra={})=>({id,author:{role},recipient:'all',create_time:1700000000,metadata:{model_slug:'gpt-known'},...extra});
 const render=()=>api.renderMessageInfo(e.document,state,badges);
 return {e,state,badges,add,load,row,render};
}
test('DOM badges use exact message ID and role, preserve content, and remain single on rerender',()=>{
 const {add,load,row,render,badges}=setup();const a=add('m1'),wrong=add('m1','user'),unknown=add('m2');load([row('m1')]);
 render();const badge=badges.get(a);assert.ok(badge);assert.match(badge.textContent,/gpt-known/);assert.match(badge.getAttribute('title'),/2023-11-14T22:13:20\.000Z/);
 render();render();assert.equal(badges.get(a),badge);assert.equal(a.querySelectorAll('.chatgpt-toolkit-message-info').length,1);
 assert.equal(a.firstChild.textContent,'UNCHANGED USER CONTENT');assert.equal(wrong.querySelectorAll('.chatgpt-toolkit-message-info').length,0);assert.equal(unknown.querySelectorAll('.chatgpt-toolkit-message-info').length,0);
});
test('DOM branch ID reuse, removal, settings and navigation cannot leave old badges',()=>{
 const {e,state,add,load,row,render,badges}=setup();const a=add('m1');load([row('m1')]);render();a.setAttribute('data-message-id','m2');render();assert.equal(badges.size,0);
 a.setAttribute('data-message-id','m1');render();assert.equal(badges.size,1);a.remove();render();assert.equal(badges.size,0);
 e.document.body.appendChild(a);render();state.setEnabled(false);render();assert.equal(badges.size,0);
 state.setEnabled(true);load([row('m1')]);render();e.win.location.href='https://chatgpt.com/c/c2';render();assert.equal(badges.size,0);assert.equal(state.size(),0);
});
test('user row never inherits assistant model and missing timestamp is not rendered as current time',()=>{
 const {add,load,row,render,badges}=setup();const user=add('u','user'),assistant=add('a'),blank=add('b');
 load([row('u','user'),row('a','assistant',{create_time:null}),row('b','assistant',{create_time:null,metadata:{default_model_slug:'requested-only'}})]);render();
 assert.doesNotMatch(badges.get(user).textContent,/gpt-known/);assert.equal(badges.get(assistant).textContent,'gpt-known');assert.equal(badges.has(blank),false);
});

test('startup preference faults cannot reactivate a saved disabled metadata display',async()=>{
 for(const failingKey of ['gpc.v1.ui.hoverMode','gpc.v1.ui.messageInfo']) {
  const row={id:'m1',author:{role:'assistant'},create_time:1700000000,metadata:{model_slug:'gpt-observed'}};
  const e=environment({entries:[['gpc.v1.ui.messageInfo',false]],fetch:()=>Promise.resolve(new Response(JSON.stringify({conversation_id:'c1',mapping:{m1:{message:row}}}),{headers:{'content-type':'application/json'}})),beforeRun({win,document,context}){
   const get=context.GM_getValue;context.GM_getValue=(key,fallback)=>{if(key===failingKey)throw Error('fault');return get(key,fallback);};
   win.location.href='https://chatgpt.com/c/c1';const n=document.createElement('div');n.setAttribute('data-message-id','m1');n.setAttribute('data-message-author-role','assistant');document.body.appendChild(n);
  }});
  await e.win.fetch('/backend-api/conversation/c1');for(let i=0;i<10;i++)await new Promise(setImmediate);e.flush(80);
  assert.equal(e.document.querySelector('.chatgpt-toolkit-message-info'),null,failingKey);assert.equal(e.store.get('gpc.v1.ui.messageInfo'),false);
 }
});
