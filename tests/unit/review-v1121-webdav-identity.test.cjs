'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../../chatgpt-pro-counter.user.js');
const now=Date.now(),settings=api.defaultSettings(now),cfg={url:'https://dav.example/counter.json',approved:true};
const event=id=>({v:1,id,key:id,ledger:'default',at:now,updated:now,state:'accepted',observation:'done',delta:0,requested:'gpt-6-pro',route:'',label:'',http:200,stable:true,conflict:false});
const body=api.snapshot(settings,[event('remote')]);
test('identity GET through the real transport uses the unmodified resource ETag for conditional PUT',async()=>{
 const requests=[],applied=[];let backups=0;
 const request=api.createDavTransport(p=>{requests.push(p);const identity=p.headers['Accept-Encoding']==='identity';queueMicrotask(()=>p.onload({status:p.method==='GET'?200:p.headers['If-Match']==='"resource-v1"'?204:412,finalUrl:cfg.url,responseHeaders:'ETag: '+(identity?'"resource-v1"':'"resource-v1-gzip"'),responseText:p.method==='GET'?JSON.stringify(body):''}));return {abort(){}};},{scriptHandler:'Tampermonkey',version:'5.5.1'});
 const result=await api.syncWebDav(cfg,{request,local:()=>api.snapshot(settings,[event('local')]),backup:()=>{backups++},apply:m=>applied.push(m)});
 assert.equal(result.attempts,1);assert.deepEqual(requests.map(r=>r.method),['GET','PUT']);assert.equal(requests[0].headers['Accept-Encoding'],'identity');assert.equal(requests[1].headers['If-Match'],'"resource-v1"');assert.equal(requests[1].headers['If-None-Match'],undefined);assert.equal(backups,1);assert.deepEqual(applied[0].events.map(e=>e.id).sort(),['local','remote']);
});
test('a genuine conflict still rereads identity and uses the next exact ETag',async()=>{
 let reads=0,writes=0,applied=0,backups=0;
 const request=async(c,method,headers)=>{
  if(method==='GET'){assert.equal(headers['Accept-Encoding'],'identity');reads++;return {status:200,responseHeaders:`ETag: "v${reads}"`,responseText:JSON.stringify(body)}}
  writes++;assert.equal(headers['If-Match'],`"v${reads}"`);return {status:writes===1?412:204};
 };
 const result=await api.syncWebDav(cfg,{request,local:()=>body,backup:()=>backups++,apply:()=>applied++});
 assert.equal(result.attempts,2);assert.equal(reads,2);assert.equal(writes,2);assert.equal(backups,1);assert.equal(applied,1);
});
test('compressed-looking ETags are opaque and never rewritten or bypassed',async()=>{
 let writes=0,applied=0;
 await assert.rejects(api.syncWebDav(cfg,{request:async(c,m,h)=>{if(m==='GET')return {status:200,responseHeaders:'ETag: "opaque-gzip"',responseText:JSON.stringify(body)};writes++;assert.equal(h['If-Match'],'"opaque-gzip"');return {status:412};},local:()=>body,backup:()=>{},apply:()=>applied++}),/412/);
 assert.equal(writes,3);assert.equal(applied,0);
});
