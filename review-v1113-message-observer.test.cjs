'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const api=require('./chatgpt-pro-counter.user.js');
const url='https://chatgpt.com/c/c1';
const row={id:'m1',author:{role:'assistant'},recipient:'all',create_time:1700000000,metadata:{resolved_model_slug:'gpt-observed'},content:{parts:['PRIVATE-CHAT-TEXT']}};
const history={conversation_id:'c1',mapping:{m1:{message:row}}};
const stream='data: '+JSON.stringify({conversation_id:'c1',message:row})+'\n\ndata: [DONE]\n\n';
const state=()=>api.createMessageInfoState({page:()=>url});
const deps={ledger:()=> 'default',random:()=> 'event1',hash:async()=> 'fixedhash'};

test('natural history inspection keeps exact native promise, this, arguments and readable response',async()=>{
 const info=state(),response=new Response(JSON.stringify(history),{headers:{'content-type':'application/json'}}),promise=Promise.resolve(response),calls=[],writes=[];
 const win={location:{href:url},fetch(...args){calls.push({this:this,args});return promise;}};
 const observer=api.installObserver(win,{...deps,messageInfoState:info,save:e=>writes.push(e)});
 const input='/backend-api/conversation/c1',init={method:'GET'},receiver={};
 assert.equal(win.fetch.call(receiver,input,init),promise);
 const text=await (await promise).text(); await observer.idle();
 assert.equal(text,JSON.stringify(history)); assert.equal(calls.length,1); assert.equal(calls[0].this,receiver); assert.equal(calls[0].args[0],input); assert.equal(calls[0].args[1],init);
 assert.equal(info.get('m1','assistant').model,'gpt-observed'); assert.deepEqual(writes,[]);
});

test('accounting storage failure cannot suppress observed SSE metadata',async()=>{
 const info=state(),response=new Response(stream,{headers:{'content-type':'text/event-stream'}}),promise=Promise.resolve(response);
 const win={location:{href:url},fetch(){return promise;}};
 const observer=api.installObserver(win,{...deps,messageInfoState:info,save(){throw Error('storage failed');}});
 assert.equal(win.fetch('/backend-api/conversation',{method:'POST',body:JSON.stringify({model:'gpt-requested',action:'next'})}),promise);
 await observer.idle(); assert.equal(info.get('m1','assistant').model,'gpt-observed'); assert.equal(await response.text(),stream);
});

test('SSE metadata never enters saved counter records or persisted chat fields',async()=>{
 const info=state(),writes=[],response=new Response(stream,{headers:{'content-type':'text/event-stream'}});
 const win={location:{href:url},fetch:()=>Promise.resolve(response)};
 const observer=api.installObserver(win,{...deps,messageInfoState:info,save:e=>writes.push(e)});
 win.fetch('/backend-api/conversation',{method:'POST',body:JSON.stringify({model:'gpt-requested',action:'next'})}); await observer.idle();
 assert.ok(writes.length); assert.doesNotMatch(JSON.stringify(writes),/PRIVATE-CHAT-TEXT|conversation_id|createdAt|1700000000|"m1"/);
});

test('auth session request clears metadata even with auto-account mode disabled and rejects late history',async()=>{
 const info=state();let resolve;const pending=new Promise(r=>resolve=r);
 const win={location:{href:url},fetch(input){return input.includes('session')?Promise.resolve(new Response('{}')):pending;}};
 const observer=api.installObserver(win,{...deps,messageInfoState:info,account:{enabled:()=>false},save(){}});
 win.fetch('/backend-api/conversation/c1'); win.fetch('/api/auth/session');
 resolve(new Response(JSON.stringify(history),{headers:{'content-type':'application/json'}})); await observer.idle();
 assert.equal(info.size(),0);
});

test('disabled display does not clone or read GET history',async()=>{
 const info=state();info.setEnabled(false); const response=new Response(JSON.stringify(history),{headers:{'content-type':'application/json'}});response.clone=()=>assert.fail('must not clone');
 const win={location:{href:url},fetch:()=>Promise.resolve(response)};const observer=api.installObserver(win,{...deps,messageInfoState:info,save(){}});
 win.fetch('/backend-api/conversation/c1');await observer.idle();assert.equal(info.size(),0);assert.equal(await response.text(),JSON.stringify(history));
});

test('oversized natural history fails closed without consuming the native response',async()=>{
 const info=state(),body=JSON.stringify({...history,unrelated:'x'.repeat(1024*1024)}),response=new Response(body,{headers:{'content-type':'application/json'}});
 const win={location:{href:url},fetch:()=>Promise.resolve(response)},observer=api.installObserver(win,{...deps,messageInfoState:info,save(){}});
 win.fetch('/backend-api/conversation/c1'); await observer.idle();assert.equal(info.size(),0);assert.equal(await response.text(),body);
});

test('redirected or foreign final POST responses cannot supply official response-model labels',async()=>{
 for (const final of [{redirected:true,url:'https://chatgpt.com/backend-api/conversation'},{redirected:false,url:'https://foreign.invalid/backend-api/conversation'}]) {
  const info=state(),response=new Response(stream,{headers:{'content-type':'text/event-stream'}});
  for(const [key,value] of Object.entries(final))Object.defineProperty(response,key,{value});
  const win={location:{href:url},fetch:()=>Promise.resolve(response)},observer=api.installObserver(win,{...deps,messageInfoState:info,save(){}});
  win.fetch('/backend-api/conversation',{method:'POST',body:'{"action":"next"}'});await observer.idle();assert.equal(info.size(),0,JSON.stringify(final));
 }
});
