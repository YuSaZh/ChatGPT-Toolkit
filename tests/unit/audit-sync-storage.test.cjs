'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {environment}=require('../fixtures/audit-dom-fixture.cjs');
function setup(){const calls=[];const config={url:'https://dav.invalid/counter.json',username:'synthetic',password:'NOT-A-REAL-CREDENTIAL',enabled:true,tested:true,approved:true,interval:5};const e=environment({throwKeys:true,entries:[['gpc.v1.webdav',config]],gmRequest(opts){calls.push(opts);return {abort(){}};}});return {e,calls,config};}
test('automatic sync does not transmit while local records cannot be read',()=>{const {e,calls,config}=setup();e.tick();assert.equal(calls.length,0,'No WebDAV request when local storage is unreliable');assert.deepEqual(e.store.get('gpc.v1.webdav'),config);});
test('manual sync does not transmit while local records cannot be read',()=>{const {e,calls,config}=setup();e.menus.find(menu => menu.label === '显示 Pro 计数器').fn();const click=action=>e.emit(e.ui(),'click',{target:{closest:()=>({dataset:{action}})}});click('sync');click('sync-now');assert.equal(calls.length,0,'No WebDAV request when local storage is unreliable');assert.deepEqual(e.store.get('gpc.v1.webdav'),config);});
