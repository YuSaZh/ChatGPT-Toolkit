'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {environment}=require('./audit-dom-fixture.cjs');
function visible(env){assert.deepEqual(env.errors.map(e=>e.message),[]);assert.ok(env.host(),'UI host mounts');assert.ok(env.rendered(),'a usable button renders');}
test('browser boot mounts normally with no page prerequisites',()=>visible(environment()));
test('browser-global module.exports cannot suppress userscript boot',()=>visible(environment({module:true})));
test('missing storage APIs show visible temporary-mode diagnostic',()=>{const e=environment({noGM:true});visible(e);assert.match(e.ui().textContent,/未保存|无法保存|临时|存储|权限/);});
test('throwing storage reads cannot suppress UI',()=>visible(environment({throwStorage:true})));
test('legacy media listener interface cannot suppress UI',()=>visible(environment({legacyMedia:true})));
test('Trusted Types blocked innerHTML does not stop UI',()=>visible(environment({trustedTypes:true})));
test('document-start mounts when the body arrives',()=>{const e=environment({bodyAbsent:true});e.document.body=new e.Node('body');e.document.documentElement.appendChild(e.document.body);for(const fn of e.document.listeners.DOMContentLoaded||[])e.run(fn);e.mutate();e.tick();visible(e);});
test('removed host is recovered without duplicating UI',()=>{const e=environment();e.host()?.remove();e.mutate();e.tick();visible(e);assert.equal(e.document.querySelectorAll('#chatgpt-pro-local-counter').length,1);});
test('body replacement is recovered without losing storage',()=>{const e=environment();const before=[...e.store.entries()];e.document.body.remove();e.document.body=new e.Node('body');e.document.documentElement.appendChild(e.document.body);e.mutate();e.tick();visible(e);assert.deepEqual([...e.store.entries()],before);});
test('v1 settings, records and WebDAV config survive upgrade',()=>{const now=Date.now();const settings={v:1,id:'custom',updated:now,cap:100,mode:'fixed',anchor:now-3600000,ledger:'default',label:'升级测试'};const event={v:1,id:'manual-fixture',key:'m:manual-fixture',ledger:'default',at:now-10000,updated:now-10000,state:'manual',observation:'manual',delta:11,requested:'',route:'',label:'',conflict:false,stable:true,http:0};const dav={url:'https://dav.invalid/counter.json',username:'synthetic',password:'NOT-A-REAL-CREDENTIAL',interval:0,enabled:true,tested:true,approved:true};const entries=[['gpc.v1.settings.custom',settings],['gpc.v1.event.manual-fixture',event],['gpc.v1.webdav',dav]];const e=environment({entries});visible(e);for(const [k,v] of entries)assert.deepEqual(e.store.get(k),v);assert.match(e.ui().textContent,/11\s*\/\s*100/);assert.ok(!e.ui().textContent.includes(dav.password));});
