'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../chatgpt-pro-counter.user.js');
const now = Date.UTC(2026, 9, 12, 3);
const settings = {...api.defaultSettings(now), anchor: now - 1000};
const event = (overrides = {}) => ({v:1,id:'id-1',key:'key-1',ledger:'default',at:now-10,updated:now,state:'accepted',observation:'done',delta:0,requested:'gpt-5-pro',route:'',label:'',conflict:false,stable:true,http:200,...overrides});
const sse = chunks => new Response(new ReadableStream({start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(x)); c.close(); }}), {headers:{'content-type':'text/event-stream'}});

test('model token classification does not treat project/profile/proxy as Pro', () => {
  for (const m of ['project', 'profile', 'proxy', 'gpt-5-thinking', 'gpt-5', 'my-proxy']) assert.notEqual(api.modelKind(m),'pro');
  assert.equal(api.modelKind('gpt-5-pro'),'pro');
  assert.equal(api.modelKind('auto'),'unknown');
});
test('fixed interval and rolling window boundaries', () => {
  assert.equal(api.summarize([event({at:settings.anchor-1})],settings,now).used,0);
  assert.equal(api.summarize([event({at:settings.anchor})],settings,now).used,1);
  assert.equal(api.summarize([event({at:now-api.WEEK-1})],{...settings,mode:'rolling'},now).used,0);
  assert.equal(api.summarize([event({at:now+1})],settings,now).used,0);
});
test('accepted retry is preserved despite later failure of same stable key', () => {
  const rows = [event(),event({id:'retry',updated:now+1,state:'failed'})];
  assert.equal(api.summarize(rows,settings,now).used,1);
});
test('merge/import validates schema, strips unapproved fields and cannot pollute prototypes', () => {
  const raw=JSON.stringify({format:'chatgpt-pro-counter',version:1,settings,events:[{...event(),password:'secret',body:'secret',__proto__:{polluted:true}}]});
  const clean=api.decodeImport(raw);
  assert.equal(clean.events[0].password,undefined); assert.equal(clean.events[0].body,undefined); assert.equal({}.polluted,undefined);
  assert.throws(()=>api.decodeImport(raw.replace('"version":1','"version":2')));
  assert.throws(()=>api.decodeImport(JSON.stringify({format:'chatgpt-pro-counter',version:1,settings,events:[event({v:2})]})));
});
test('request targeting requires correct origin POST and conversation endpoint', () => {
  const base='https://chatgpt.com/';
  assert.equal(api.targetRequest('/backend-api/conversation',{method:'POST'},base),true);
  for (const u of ['https://evil.example/backend-api/conversation','/backend-api/conversations','/backend-api/conversation/1']) assert.equal(api.targetRequest(u,{method:'POST'},base),false);
  assert.equal(api.targetRequest('/backend-api/conversation',{method:'GET'},base),false);
});
test('different regenerations of same user turn are not collapsed by explicit request ID', () => {
  const input={action:'variant',model:'gpt-5-pro',messages:[{id:'user-1',author:{role:'user'}}]};
  const a=api.requestMeta({...input,client_request_id:'operation-1'});
  const b=api.requestMeta({...input,client_request_id:'operation-2'});
  assert.notEqual(a.seed,b.seed);
});
test('tool-only next requests are not counted as user sends', () => {
  assert.equal(api.requestMeta({action:'next',model:'gpt-5-pro',messages:[{id:'tool-1',author:{role:'tool'}}]}).skip,true);
});
test('SSE route metadata parses even when CRLF is split across chunks', async () => {
  const updates=[];
  await api.inspectResponse(sse(['data: {"resolved_model_slug":"gpt-5-pro"}\r','\n\r','\ndata: [DONE]\r','\n\r','\n']),u=>updates.push(u));
  assert.equal(updates.at(-1).route,'gpt-5-pro');
});
test('observer preserves native promise, argument identity, site response body; inspection survives immediate consumption', async () => {
  const reqBody=JSON.stringify({action:'next',model:'auto',messages:[{id:'user-1',author:{role:'user'},content:{parts:['private message']}}]});
  const init={method:'POST',body:reqBody,headers:{Authorization:'Bearer private-token'}};
  const response=sse(['data: {"resolved_model_slug":"gpt-5-pro"}\n\ndata: [DONE]\n\n']);
  const native=Promise.resolve(response); let actualArgs;
  const win={location:{href:'https://chatgpt.com/'},fetch(...args){actualArgs=args; return native;}};
  const saved=[];
  const observer=api.installObserver(win,{save:e=>saved.push({...e}),ledger:()=> 'default',random:()=> 'id-observer',clock:()=>now,hash:async()=>{await new Promise(r=>setTimeout(r,10));return 'hash';}});
  const result=win.fetch('/backend-api/conversation',init);
  assert.equal(result,native); assert.equal(actualArgs[1],init);
  const text=await result.then(r=>r.text()); assert.match(text,/resolved_model_slug/);
  await observer.idle();
  assert.equal(saved.at(-1).route,'gpt-5-pro');
  const serialized=JSON.stringify(saved); assert(!serialized.includes('private message')); assert(!serialized.includes('private-token'));
});
test('edits have independent keys while retry of same user message deduplicates',()=>{
 const meta=(id,action)=>api.requestMeta({action,model:'gpt-5-pro',messages:[{id,author:{role:'user'}}]});
 assert.equal(meta('user-1','next').seed,meta('user-1','retry').seed);
 assert.notEqual(meta('user-1','next').seed,meta('edited-2','next').seed);
 assert.equal(api.requestMeta({action:'variant',model:'gpt-5-pro',messages:[{id:'user-1',author:{role:'user'}}]}).seed,'');
});
test('Request bodies remain available to original fetch and are not persisted',async()=>{
 const req=new Request('https://chatgpt.com/backend-api/conversation',{method:'POST',body:JSON.stringify({action:'next',model:'gpt-5-pro',messages:[{id:'private-id',author:{role:'user'},content:{parts:['PRIVATE BODY']}}]})});
 let actual,body;const win={location:{href:'https://chatgpt.com/'},fetch(r){actual=r;return r.text().then(t=>{body=t;return new Response('{}',{headers:{'content-type':'application/json'}});});}};
 const saved=[];const observer=api.installObserver(win,{save:e=>saved.push({...e}),ledger:()=> 'default'});
 await win.fetch(req);await observer.idle();assert.equal(actual,req);assert.match(body,/PRIVATE BODY/);assert.equal(saved.at(-1).state,'accepted');
 assert(!JSON.stringify(saved).includes('PRIVATE BODY'));assert(!JSON.stringify(saved).includes('private-id'));
});
test('native rejection and synchronous exception propagate unchanged',async()=>{
 for(const sync of [false,true]){
  const error=Object.assign(new Error('native failure'),{name:sync?'TypeError':'AbortError'});
  const native=sync?null:Promise.reject(error);let saved=[];
  const win={location:{href:'https://chatgpt.com/'},fetch(){if(sync)throw error;return native;}};
  const observer=api.installObserver(win,{save:e=>saved.push({...e}),ledger:()=> 'default'});
  const call=()=>win.fetch('/backend-api/conversation',{method:'POST',body:'{"model":"gpt-5-pro","action":"next"}'});
  if(sync)assert.throws(call,e=>e===error);else {const returned=call();assert.equal(returned,native);await assert.rejects(returned,e=>e===error);}
  await observer.idle();assert.equal(saved.at(-1).state,sync?'failed':'aborted');
 }
});
test('HTTP 200 structured error is excluded from Pro counts',async()=>{
 const saved=[];const win={location:{href:'https://chatgpt.com/'},fetch(){return Promise.resolve(new Response('{"error":{"code":"limit"}}',{headers:{'content-type':'application/json'}}));}};
 const observer=api.installObserver(win,{save:e=>saved.push({...e}),ledger:()=> 'default'});
 await win.fetch('/backend-api/conversation',{method:'POST',body:'{"model":"gpt-5-pro","action":"next"}'});await observer.idle();
 assert.equal(saved.at(-1).state,'failed');assert.equal(api.summarize([saved.at(-1)],settings,Date.now()).used,0);
});
test('metadata parser ignores model names inside assistant content',async()=>{
 const updates=[];await api.inspectResponse(sse(['data: {"message":{"author":{"role":"assistant"},"content":{"parts":["gpt-5-pro"],"resolved_model_slug":"gpt-5-pro"},"metadata":{"model_slug":"gpt-5-pro"}}}\n\ndata: [DONE]\n\n']),u=>updates.push(u));
 assert.equal(updates.at(-1).route,'');assert.equal(updates.at(-1).label,'gpt-5-pro');
 assert.equal(api.kindFor(event({requested:'auto',route:'',label:'gpt-5-pro'})),'unknown');
});
test('successful retry after cycle reset is counted at first acceptance, not old failure',()=>{
 const rows=[event({id:'failed-first',at:settings.anchor-10,state:'failed'}),event({id:'accepted-retry',at:now-10,updated:now+1})];
 assert.equal(api.summarize(rows,settings,now).used,1);
 const rolling=[event({id:'failed-first',at:now-api.WEEK-10,state:'failed'}),event({id:'accepted-retry',at:now-10,updated:now+1})];
 assert.equal(api.summarize(rolling,{...settings,mode:'rolling'},now).used,1);
});
