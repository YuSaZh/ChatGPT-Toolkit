'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../chatgpt-pro-counter.user.js');
const now=Date.UTC(2026,9,12,3);
const settings={...api.defaultSettings(now),anchor:now-1000};
const event=(id,extra={})=>({v:1,id,key:'key-'+id,ledger:'default',at:now-10,updated:now,state:'accepted',observation:'done',delta:0,requested:'gpt-5-pro',route:'',label:'',conflict:false,stable:true,http:200,...extra});
const cfg={url:'https://dav.example/counter.json',username:'user',password:'SECRET-PASS',approved:true};
const response=(status,obj,tag='"tag-1"')=>({status,responseText:obj?JSON.stringify(obj):'',responseHeaders:tag?'ETag: '+tag:''});
const snapshot=(events)=>api.snapshot(settings,events);
const ops=(request,here=snapshot([event('local')]))=>{const calls=[];const applied=[];let backups=0;return {deps:{request:async(...args)=>{calls.push(args);return request(...args);},local:()=>here,apply:m=>applied.push(m),backup:()=>{backups++;}},calls,applied,get backups(){return backups;}};};

test('WebDAV URL requires HTTPS exact file URL without auth query or fragment',()=>{
 for(const url of ['http://dav.example/a.json','https://user:pass@dav.example/a.json','https://dav.example/a.json?token=x','https://dav.example/a.json#x','https://dav.example/folder/']) assert.throws(()=>api.webDavConfig({...cfg,url}));
 assert.equal(api.webDavConfig(cfg).url,cfg.url);
});
test('sync requires opt-in, test read is allowed without data upload',async()=>{
 const o=ops(()=>response(404));
 await assert.rejects(api.syncWebDav({...cfg,approved:false},o.deps));assert.equal(o.calls.length,0);
 assert.deepEqual(await api.syncWebDav({...cfg,approved:false},o.deps,{testOnly:true}),{missing:true,status:404});
 assert.deepEqual(o.calls.map(x=>x[1]),['GET']);assert.equal(o.backups,0);
});
test('failed, corrupt, unknown-schema and weak/no ETag reads never cause writes',async()=>{
 const cases=[response(401),response(403),response(500),{status:200,responseText:'garbage',responseHeaders:'ETag: "x"'},response(200,{...snapshot([]),version:99}),response(200,snapshot([]),''),response(200,snapshot([]),'W/"weak"')];
 for(const r of cases){const o=ops(()=>r);await assert.rejects(api.syncWebDav(cfg,o.deps));assert.deepEqual(o.calls.map(x=>x[1]),['GET']);assert.equal(o.backups,0);assert.equal(o.applied.length,0);}
});
test('missing file is created only with If-None-Match and data excludes credentials',async()=>{
 const o=ops((c,m)=>m==='GET'?response(404):response(201));
 await api.syncWebDav(cfg,o.deps);
 assert.equal(o.calls[1][2]['If-None-Match'],'*');assert(!o.calls[1][3].includes('SECRET-PASS'));assert(!o.calls[1][3].includes('dav.example'));assert.equal(o.backups,1);assert.equal(o.applied.length,1);
});
test('conflicting PUT rereads, merges all events and uses new exact ETag',async()=>{
 let round=0;const o=ops((c,m)=>{if(m==='GET')return response(200,snapshot([event(round?'remote2':'remote1')]),round?'"v2"':'"v1"');round++;return response(round===1?412:204);});
 const result=await api.syncWebDav(cfg,o.deps);
 assert.equal(result.attempts,2);assert.equal(o.calls[1][2]['If-Match'],'"v1"');assert.equal(o.calls[3][2]['If-Match'],'"v2"');
 assert.deepEqual(JSON.parse(o.calls[3][3]).events.map(x=>x.id).sort(),['local','remote2']);
 assert.equal(o.applied.length,1);
});
test('backup failure aborts before any PUT',async()=>{
 const o=ops(()=>response(404));o.deps.backup=()=>{throw Error('storage failed');};
 await assert.rejects(api.syncWebDav(cfg,o.deps),/storage failed/);assert.deepEqual(o.calls.map(x=>x[1]),['GET']);
});
test('unsupported manager blocks before credential transmission',async()=>{
 let invoked=false;const tx=api.createDavTransport(()=>{invoked=true;},{scriptHandler:'Tampermonkey',version:'5.4'});
 await assert.rejects(tx(cfg,'GET'));assert.equal(invoked,false);
});
test('transport is anonymous, blocks redirects and sets explicit Basic only for configured host',async()=>{
 let sent;const tx=api.createDavTransport(p=>{sent=p;queueMicrotask(()=>p.onload({status:200,finalUrl:cfg.url,responseText:'x'}));return {abort(){}};},{scriptHandler:'Tampermonkey',version:'5.5.1'});
 await tx(cfg,'GET');assert.equal(sent.anonymous,true);assert.equal(sent.redirect,'error');assert.equal(sent.url,cfg.url);assert.equal(sent.headers.Authorization,'Basic '+btoa('user:SECRET-PASS'));
 const bad=api.createDavTransport(p=>{queueMicrotask(()=>p.onload({status:200,finalUrl:'https://evil.example/',responseText:'x'}));return {abort(){}};},{scriptHandler:'Tampermonkey',version:'5.5.1'});
 await assert.rejects(bad(cfg,'GET'),/重定向/);
});
test('independent timeout aborts hung Tampermonkey request',async()=>{
 let aborted=false;const tx=api.createDavTransport(()=>({abort(){aborted=true;}}),{scriptHandler:'Tampermonkey',version:'5.5.1'},5);
 await assert.rejects(tx(cfg,'GET'),/超时/);assert.equal(aborted,true);
});
test('settings merge is deterministic for two installations initial same id/time',()=>{
 const a={...settings,id:'initial',updated:0,anchor:now-api.WEEK};
 const b={...settings,id:'initial',updated:0,anchor:now};
 assert.deepEqual(api.newestSettings(a,b),api.newestSettings(b,a));
});
test('stream transport reads successful JSON and enforces byte limit before completion',async()=>{
 let sent;const manager={scriptHandler:'Tampermonkey',version:'5.5.1'};
 const tx=api.createDavTransport(p=>{sent=p;queueMicrotask(()=>{p.onloadstart({status:0,finalUrl:'',responseHeaders:'',response:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"ok":true}'));c.close();}})});p.onload({status:200,finalUrl:cfg.url,responseHeaders:'ETag: "stream"'});});return {abort(){}};},manager);
 const result=await tx(cfg,'GET');assert.equal(sent.responseType,'stream');assert.equal(result.responseText,'{"ok":true}');
 let aborted=false;const huge=api.createDavTransport(p=>{queueMicrotask(()=>p.onloadstart({status:200,finalUrl:cfg.url,response:new ReadableStream({start(c){c.enqueue(new Uint8Array(5*1024*1024+1));c.close();}})}));return {abort(){aborted=true;}};},manager);
 await assert.rejects(huge(cfg,'GET'),/5 MB/);assert.equal(aborted,true);
});
test('pre-cancelled transport never sends credentials',async()=>{
 const ctrl=new AbortController();ctrl.abort();let invoked=false;
 const tx=api.createDavTransport(()=>{invoked=true;return {abort(){}};},{scriptHandler:'Tampermonkey',version:'5.5.1'});
 await assert.rejects(tx(cfg,'GET',{},undefined,ctrl.signal),/取消/);assert.equal(invoked,false);
});
test('transport cancellation aborts pending request',async()=>{
 const ctrl=new AbortController();let aborted=false;
 const tx=api.createDavTransport(()=>({abort(){aborted=true;}}),{scriptHandler:'Tampermonkey',version:'5.5.1'});
 const pending=tx(cfg,'GET',{},undefined,ctrl.signal);ctrl.abort();await assert.rejects(pending,/取消/);assert.equal(aborted,true);
});
test('cancel after GET prevents PUT and local apply',async()=>{
 const ctrl=new AbortController();const o=ops(()=>{ctrl.abort();return response(404);});
 await assert.rejects(api.syncWebDav(cfg,o.deps,{signal:ctrl.signal}),/取消/);assert.deepEqual(o.calls.map(x=>x[1]),['GET']);assert.equal(o.applied.length,0);
});
test('configuration change while backing up prevents PUT',async()=>{
 let valid=true;const o=ops(()=>response(404));o.deps.backup=()=>{valid=false;};
 await assert.rejects(api.syncWebDav(cfg,o.deps,{check(){if(!valid)throw Error('config changed');}}),/config changed/);assert.deepEqual(o.calls.map(x=>x[1]),['GET']);
});
test('local apply failure is reported, not silently called successful sync',async()=>{
 const o=ops((c,m)=>response(m==='GET'?404:204));o.deps.apply=()=>{throw Error('write failed');};
 await assert.rejects(api.syncWebDav(cfg,o.deps),/write failed/);
});
