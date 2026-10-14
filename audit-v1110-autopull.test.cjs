'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
const now = Date.now();
const settings = extra => ({ ...api.defaultSettings(now), id:'initial', updated:0, ...extra });
const config = extra => ({ version:2, mode:'file', url:'https://dav.invalid/test.json', username:'FAKE', password:'FAKE', enabled:true, approved:true, tested:true, interval:5, ...extra });
const event = (id, extra = {}) => ({v:1,id,key:'k-'+id,ledger:'default',at:now-500,updated:now-400,state:'accepted',observation:'done',delta:0,requested:'gpt-5-pro',route:'',label:'',conflict:false,stable:true,http:200,...extra});
const response = (status,value,tag='"v1"') => ({status,responseText:value ? JSON.stringify(value) : '',responseHeaders:tag ? 'ETag: '+tag : ''});
const flush = async () => { for(let i=0;i<6;i++) await new Promise(r=>setImmediate(r)); };
function session(extra = {}) {
  const calls=[]; let time=now;
  class FakeDate extends Date {constructor(...args){super(...(args.length ? args : [time]));}static now(){return time;}}
  const e=environment({entries:[['gpc.v1.webdav',config(extra.config)],['gpc.v1.settings.initial',settings()], ...(extra.entries||[])],beforeRun({context}){context.Date=FakeDate;},gmRequest(options){calls.push(options);return {abort(){}};}});
  const click=action=>{const target=e.ui().querySelector(`[data-action="${action}"]`);assert.ok(target, action);e.emit(e.ui(),'click',{target});};
  const reply=async(index,status,value,tag)=>{const call=calls[index];assert.ok(call,`call ${index}`);call.onload({...response(status,value,tag),finalUrl:call.url});await flush();};
  const auto=()=>e.intervals.at(-1)();
  return {...e,calls,click,reply,auto,advance(ms){time+=ms;},get time(){return time;}};
}

test('automatic remote pull updates counter and shared cap without local dirty events',async()=>{
  const e=session();assert.equal(e.calls.length,0);e.auto();
  assert.equal(e.calls[0].method,'GET');
  await e.reply(0,200,api.snapshot(settings({id:'remote-settings',updated:now-50,cap:200}),[event('remote1'),event('remote2')]));
  assert.equal(e.calls[1].method,'PUT');await e.reply(1,204);
  assert.equal(e.store.get('gpc.v1.lastSync'),now);
  assert.equal(e.ui().querySelector('strong').textContent,'2/200');
  assert.equal(e.store.get('gpc.v1.event.remote1').state,'accepted');
  assert.deepEqual(e.errors,[]);
});
test('timer waits selected interval after success then pulls again and deduplicates',async()=>{
  const e=session();const remote=api.snapshot(settings(),[event('remote')]);
  e.auto();await e.reply(0,200,remote);await e.reply(1,204);
  e.advance(299999);e.auto();assert.equal(e.calls.length,2);
  e.advance(1);e.auto();assert.equal(e.calls.length,3);
  await e.reply(2,200,remote);await e.reply(3,204);
  assert.equal(e.ui().querySelector('strong').textContent,'1/100');
  assert.equal([...e.store.keys()].filter(k=>k.startsWith('gpc.v1.event.')).length,1);
});
test('local events and newer local settings during PUT survive and remain queued',async()=>{
  const e=session();e.auto();await e.reply(0,200,api.snapshot(settings({id:'remote',updated:now-100,cap:200}),[event('remote')]));
  e.advance(100);e.store.set('gpc.v1.event.during',event('during',{at:e.time,updated:e.time}));
  e.store.set('gpc.v1.settings.during',settings({id:'during',updated:e.time,cap:300}));
  await e.reply(1,204);
  assert.equal(e.ui().querySelector('strong').textContent,'2/300');
  assert.equal(e.store.get('gpc.v1.lastSync'),now);
  assert(!JSON.parse(e.calls[1].data).events.some(e=>e.id==='during'));
  e.click('expand');assert.match(e.ui().textContent,/有待同步的新记录/);
});
test('accepted event later marked failed on another device refreshes count downward',async()=>{
  const e=session({entries:[['gpc.v1.event.same',event('same')]]});
  assert.equal(e.ui().querySelector('strong').textContent,'1/100');e.auto();
  await e.reply(0,200,api.snapshot(settings(),[event('same',{updated:now,state:'failed',observation:'error'})]));await e.reply(1,204);
  assert.equal(e.ui().querySelector('strong').textContent,'0/100');
});
test('failed PUT does not claim success or import remote; later schedule retries',async()=>{
  const e=session();e.auto();await e.reply(0,200,api.snapshot(settings(),[event('remote')]));await e.reply(1,403);
  assert.equal(e.store.has('gpc.v1.lastSync'),false);assert.equal(e.store.has('gpc.v1.event.remote'),false);
  assert.equal(e.ui().querySelector('strong').textContent,'0/100');
  e.advance(300000);e.auto();assert.equal(e.calls[2].method,'GET');
});
test('pending and failed are synced, but only accepted Pro and manual calibration count',async()=>{
  const e=session();e.auto();
  await e.reply(0,200,api.snapshot(settings(),[event('accepted'),event('pending',{state:'pending',observation:'pending'}),event('failed',{state:'failed',observation:'error'}),event('thinking',{requested:'gpt-5-thinking'}),event('manual',{state:'manual',observation:'manual',delta:2})]));await e.reply(1,204);
  assert.equal(e.ui().querySelector('strong').textContent,'3/100');
  assert.equal(JSON.parse(e.calls[1].data).events.length,5);
});
test('saving tested configuration only reads; first automatic data import waits selected interval',async()=>{
  const e=session();e.click('expand');e.click('sync');
  e.emit(e.ui(),'submit',{target:e.ui().querySelector('#webdav')});await flush();
  assert.equal(e.calls[0].method,'GET');await e.reply(0,200,api.snapshot(settings(),[event('remote')]));
  assert.equal(e.calls.length,1);assert.equal(e.store.has('gpc.v1.event.remote'),false);
  e.auto();assert.equal(e.calls.length,1);e.advance(300000);e.auto();assert.equal(e.calls[1].method,'GET');
  await e.reply(1,200,api.snapshot(settings(),[event('remote')]));await e.reply(2,204);
  assert.equal(e.store.has('gpc.v1.event.remote'),true);
});
test('v1110: successful auto sync on open sync page should refresh status and launcher without replacing form',async()=>{
  const e=session();e.click('expand');e.click('sync');const form=e.ui().querySelector('#webdav');
  e.auto();await e.reply(0,200,api.snapshot(settings(),[event('remote')]));await e.reply(1,204);
  assert.equal(e.store.has('gpc.v1.event.remote'),true);
  assert.equal(e.ui().querySelector('#webdav'),form);
  assert.match(e.ui().querySelector('#sync-status').textContent,/同步成功/);
  assert.equal(e.ui().querySelector('[data-action="expand"] strong').textContent,'1/100');
});
test('v1110: merged payload should never be uploaded if its own decoder rejects record count',async()=>{
  const events=Array.from({length:20001},(_,i)=>event(String(i),{key:'k',requested:'',state:'pending',observation:'pending',stable:false,http:0}));
  assert(JSON.stringify(api.snapshot(settings(),events)).length < 5*1024*1024);
  const calls=[];let applied=false;
  await assert.rejects(api.syncWebDav(config(),{request:async(_,method)=>{calls.push(method);return response(method==='GET'?404:201);},local:()=>api.snapshot(settings(),events),backup(){},apply(){applied=true;}}),/20.?000|记录.*上限|事件.*上限/);
  assert.deepEqual(calls,['GET']);assert.equal(applied,false);
});
test('v1110: individually valid peers cannot combine into an unreadable over-limit remote file',async()=>{
  const remoteEvents=Array.from({length:19999},(_,i)=>event(String(i),{key:'k',requested:'',state:'pending',observation:'pending',stable:false,http:0}));
  const remote=api.snapshot(settings(),remoteEvents),here=api.snapshot(settings(),[event('local-a'),event('local-b')]);
  assert.equal(api.decodeImport(JSON.stringify(remote)).events.length,19999);
  const calls=[];let backup=false,applied=false;
  await assert.rejects(api.syncWebDav(config(),{request:async(_,method)=>{calls.push(method);return method==='GET'?response(200,remote):response(204);},local:()=>here,backup(){backup=true;},apply(){applied=true;}}),/20.?000|记录.*上限|事件.*上限/);
  assert.deepEqual(calls,['GET']);assert.equal(backup,false);assert.equal(applied,false);
});
test('exactly 20000 assigned events plus unassigned records remains a valid upload',async()=>{
  const events=Array.from({length:20000},(_,i)=>event(String(i),{key:'k',requested:'',state:'pending',observation:'pending',stable:false,http:0}));
  events.push(event('unassigned-a',{ledger:'unassigned:synthetic'}));
  const calls=[];let uploaded;
  await api.syncWebDav(config(),{request:async(_,method,headers,data)=>{calls.push(method);if(method==='PUT')uploaded=data;return response(method==='GET'?404:201);},local:()=>api.snapshot(settings(),events),backup(){},apply(){}});
  assert.deepEqual(calls,['GET','PUT']);assert.equal(api.decodeImport(uploaded).events.length,20000);
});
