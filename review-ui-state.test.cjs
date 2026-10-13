'use strict';
// Synthetic event workflows with a DOM model; not real Tampermonkey or browser layout.
const test=require('node:test'),assert=require('node:assert/strict');
const {environment}=require('./audit-dom-fixture.cjs');
const tick=()=>new Promise(r=>setTimeout(r,10));
function tab(store){
 const requests=[];
 const e=environment({store,gmRequest(opts){const req={opts,aborted:false};requests.push(req);return {abort(){req.aborted=true;opts.onabort();}};}});
 function click(action){let button=e.ui().querySelector(`[data-action="${action}"]`);if(!button){e.emit(e.ui(),'click',{target:e.ui().querySelector('[data-action="expand"]')});button=e.ui().querySelector(`[data-action="${action}"]`);}assert.ok(button,action+' exists');e.emit(e.ui(),'click',{target:button});}
 const configure=()=>{click('sync');for(const [id,value] of Object.entries({'dav-url':'https://dav.example/counter.json','dav-user':'user','dav-pass':'PRIVATE','dav-interval':'0'}))e.ui().querySelector('#'+id).value=value;e.ui().querySelector('#dav-approved').checked=true;e.emit(e.ui(),'submit',{target:e.ui().querySelector('#webdav')});};
 const finish=()=>requests.at(-1).opts.onload({status:404,finalUrl:'https://dav.example/counter.json',responseText:''});
 return {get root(){return e.ui();},click,configure,finish,requests,e};
}
test('clearing local credentials during test GET cannot resurrect them',async()=>{
 const store=new Map(),a=tab(store);a.configure();a.click('sync-clear');a.finish();await tick();
 assert.equal(store.get('gpc.v1.webdav').password,'');assert.equal(store.get('gpc.v1.webdav').enabled,false);assert.equal(a.requests[0].aborted,true);assert.deepEqual(a.e.errors,[]);
});
test('clearing credentials in another tab during test GET cannot resurrect them',async()=>{
 const store=new Map([['gpc.v1.webdav',{url:'https://dav.example/counter.json',username:'user',password:'PRIVATE',enabled:true,tested:true,approved:true,interval:0}]]);
 const a=tab(store),b=tab(store);a.configure();b.click('sync');b.click('sync-clear');a.finish();await tick();
 assert.equal(store.get('gpc.v1.webdav').password,'');assert.equal(store.get('gpc.v1.webdav').enabled,false);assert.deepEqual(a.e.errors,[]);assert.deepEqual(b.e.errors,[]);
});
test('stored credentials are not inserted into rendered HTML',()=>{
 const store=new Map([['gpc.v1.webdav',{url:'https://dav.example/counter.json',username:'user',password:'PRIVATE-PASSWORD',enabled:true,tested:true,approved:true,interval:0}]]);
 const a=tab(store);a.click('sync');assert(!a.root.innerHTML.includes('PRIVATE-PASSWORD'));assert.deepEqual(a.e.errors,[]);
});
test('cross-tab clear also cancels first-time setup with no prior config',async()=>{
 const store=new Map(),a=tab(store),b=tab(store);a.configure();b.click('sync');b.click('sync-clear');a.finish();await tick();
 assert.equal(store.get('gpc.v1.webdav').password,'');assert.equal(store.get('gpc.v1.webdav').enabled,false);assert.deepEqual(a.e.errors,[]);
});
