'use strict';
// Independent synthetic review: no live requests, browser, account data, or production edits.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const ms = 1700000000123;
const message = (id='m1', extra={}) => ({id, author:{role:'assistant'}, recipient:'all', create_time:ms/1000, metadata:{model_slug:'gpt-label', resolved_model_slug:'gpt-resolved'}, ...extra});
const history = (conversation='c1', messages=[message()]) => ({conversation_id:conversation, mapping:Object.fromEntries(messages.map((m,i)=>['node'+i,{message:m}]))});
function setup(options={}) { let page='https://chatgpt.com/c/c1'; const state=api.createMessageInfoState({page:()=>page,...options}); return {state, page:value=>{page=value;}, token:()=>state.capture('c1')}; }

test('protocol timestamp and resolved model are used; plaintext fields are never retained or accessed',()=>{
 const {state,token}=setup(); const row=message(); Object.defineProperty(row,'content',{get(){throw Error('must not inspect chat text');}, enumerable:true});
 row.metadata.default_model_slug='REQUESTED-DO-NOT-DISPLAY'; row.metadata.private='PRIVATE-METADATA';
 state.history(token(),history('c1',[row])); const value=state.get('m1','assistant');
 assert.ok(value); assert.equal(value.createdAt,ms); assert.equal(value.model,'gpt-resolved'); assert.equal(value.rank,2);
 assert.doesNotMatch(JSON.stringify(value),/PRIVATE|REQUESTED|content/);
 assert.equal(state.get('node0','assistant'),null); assert.equal(state.get('m1','user'),null);
});

test('invalid times never become now; requested/default model never substitutes for response model',()=>{
 for (const time of [null,undefined,0,-1,'1700000000',Infinity,NaN,4102444800,1700000000000]) {
  const {state,token}=setup(); state.history(token(),history('c1',[message('m1',{create_time:time,metadata:{default_model_slug:'gpt-requested'}})]));
  const result=state.get('m1','assistant'); assert.ok(!result || result.createdAt===null,`time ${time}`); assert.ok(!result || !result.model);
 }
});

test('non-user-facing messages and hidden assistant metadata never decorate visible messages',()=>{
 const {state,token}=setup();
 const rows=[message('tool-role',{author:{role:'tool'}}),message('tool-call',{recipient:'python'}),message('system',{author:{role:'system'}}),message('hidden',{metadata:{is_visually_hidden_from_conversation:true,model_slug:'gpt-x'}}),message('visible')];
 state.history(token(),history('c1',rows));
 for (const id of ['tool-role','tool-call','system','hidden']) assert.equal(state.get(id,'assistant'),null,id);
 assert.ok(state.get('visible','assistant'));
});

test('conversation mismatches and late history cannot revive cleared state',()=>{
 const {state,token,page}=setup(); const old=token();
 state.history(old,history('wrong')); assert.equal(state.size(),0);
 state.history(old,history()); assert.ok(state.get('m1','assistant'));
 page('https://chatgpt.com/c/c2'); state.syncPage(); assert.equal(state.get('m1','assistant'),null);
 state.history(old,history()); assert.equal(state.size(),0);
 page('https://chatgpt.com/c/c1'); state.syncPage(); state.history(old,history()); assert.equal(state.size(),0);
});

test('identity and disabled-setting fences reject in-flight history and SSE',()=>{
 for (const fence of [state=>state.invalidate(),state=>{state.setEnabled(false);state.setEnabled(true);}]) {
  const {state,token}=setup(); const old=token(); state.history(old,history()); fence(state);
  assert.equal(state.size(),0); state.history(old,history()); state.frame(old,{conversation_id:'c1',message:message('late')},{});
  assert.equal(state.size(),0);
 }
});

test('same message ID cannot cross conversation boundary',()=>{
 const {state,token,page}=setup(); state.history(token(),history());
 page('https://chatgpt.com/c/c2'); state.syncPage(); const t2=state.capture('c2');
 state.history(t2,history('c2',[message('m1',{metadata:{model_slug:'gpt-c2'},create_time:(ms-1000)/1000})]));
 assert.equal(state.get('m1','assistant').model,'gpt-c2'); assert.equal(state.get('m1','assistant').createdAt,ms-1000);
});

test('known new-conversation transition retains only the stream-identified conversation',()=>{
 for (const destination of ['c1','other']) {
  let page='https://chatgpt.com/'; const state=api.createMessageInfoState({page:()=>page}); const token=state.capture();
  state.frame(token,{conversation_id:'c1',message:message()},{}); page=`https://chatgpt.com/c/${destination}`; state.syncPage();
  assert.equal(!!state.get('m1','assistant'),destination==='c1');
 }
});

test('URL-before-frame new-chat race accepts exact destination only and never crosses later fences',()=>{
 for (const fence of ['none','identity','disabled','second-navigation','wrong-conversation']) {
  let page='https://chatgpt.com/';const state=api.createMessageInfoState({page:()=>page}),t=state.capture(),ctx={};
  page='https://chatgpt.com/c/c1';state.syncPage();
  if(fence==='identity')state.invalidate();
  if(fence==='disabled'){state.setEnabled(false);state.setEnabled(true);}
  if(fence==='second-navigation'){page='https://chatgpt.com/c/c2';state.syncPage();page='https://chatgpt.com/c/c1';state.syncPage();}
  state.frame(t,{conversation_id:fence==='wrong-conversation'?'c2':'c1',message:message()},ctx);
  assert.equal(!!state.get('m1','assistant'),fence==='none',fence);
 }
});

test('memory bound evicts older IDs and changing setting drops all RAM metadata',()=>{
 const {state,token}=setup({limit:3}); state.history(token(),history('c1',Array.from({length:12},(_,i)=>message(`m${i}`))));
 assert.ok(state.size()<=3); assert.equal(state.get('m0','assistant'),null); assert.ok(state.get('m11','assistant'));
 state.setEnabled(false); assert.equal(state.size(),0); state.setEnabled(true); assert.equal(state.get('m11','assistant'),null);
});

test('history endpoint matching excludes lists, suffixes, external origin, wrong methods and malformed IDs',()=>{
 const base='https://chatgpt.com/c/c1';
 assert.equal(api.conversationHistoryRequest('/backend-api/conversation/c1',undefined,base),'c1');
 for (const [url,init] of [['https://evil.invalid/backend-api/conversation/c1'],['/backend-api/conversation'],['/backend-api/conversations'],['/backend-api/conversation/c1/extra'],['/backend-api/conversation/c1',{method:'POST'}],['/backend-api/conversation/c1%2fextra']]) assert.equal(api.conversationHistoryRequest(url,init,base),'',url);
});

test('resolved response model cannot be downgraded by later label-only metadata for the same ID',()=>{
 const {state,token}=setup(); const t=token(), stream={};
 state.frame(t,{conversation_id:'c1',message:message()},stream);
 state.frame(t,{conversation_id:'c1',message:message('m1',{metadata:{model_slug:'gpt-fallback'}})},stream);
 assert.equal(state.get('m1','assistant').model,'gpt-resolved');
});

test('unsupported identity or whole-message removal patches cannot transfer the next model to a previous message',()=>{
 for (const transition of [{p:'/message/id',o:'replace',v:'m2'},{p:'/message',o:'remove'}]) {
  const {state,token}=setup(); const t=token(),ctx={};
  state.frame(t,{conversation_id:'c1',message:message('m1',{metadata:{model_slug:'original'}})},ctx);
  state.frame(t,transition,ctx); state.frame(t,{p:'/message/metadata/resolved_model_slug',o:'replace',v:'another-message-model'},ctx);
  assert.notEqual(state.get('m1','assistant')?.model,'another-message-model',JSON.stringify(transition));
 }
});

test('explicit tool/hidden transitions revoke formerly visible row metadata',()=>{
 for (const transition of [{p:'/message/recipient',o:'replace',v:'python'},{p:'/message/author/role',o:'replace',v:'tool'},{p:'/message/metadata/is_visually_hidden_from_conversation',o:'replace',v:true}]) {
  const {state,token}=setup(); const t=token(),ctx={};
  state.frame(t,{conversation_id:'c1',message:message()},ctx); state.frame(t,transition,ctx);
  state.frame(t,{p:'/message/metadata/resolved_model_slug',o:'replace',v:'tool-model'},ctx);
  assert.equal(state.get('m1','assistant'),null,JSON.stringify(transition));
 }
});
