'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../../chatgpt-pro-counter.user.js');
const {environment}=require('../fixtures/audit-dom-fixture.cjs');
const esc=str=>String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('escaped user text and attributes cannot become active elements or event handlers',()=>{
 const e=environment({trustedTypes:true}),target=e.document.createElement('div');
 const payload='</div><img src=x onerror="alert(1)"><script>alert(1)</script> & " \' '; 
 api.renderMarkup(target,`<div>${esc(payload)}</div><input value="${esc(payload)}">`,e.document);
 assert.equal(target.querySelector('div').textContent,payload);
 assert.equal(target.querySelector('input').getAttribute('value'),payload);
 assert.equal(target.querySelector('img'),null);assert.equal(target.querySelector('script'),null);
 assert.equal(target.querySelector('input').getAttribute('onerror'),null);
});
test('escaped pre-existing entities are decoded once and stay literal text',()=>{
 const e=environment({trustedTypes:true}),target=e.document.createElement('div');
 const payload='&lt;script&gt; &#x3c;img&#x3e; &quot;';
 api.renderMarkup(target,`<div>${esc(payload)}</div>`,e.document);
 assert.equal(target.textContent,payload);assert.equal(target.querySelector('script'),null);
});
test('renderer rejects executable tags, handler attributes and navigation URLs',()=>{
 const e=environment({trustedTypes:true}),target=e.document.createElement('div');
 for(const markup of ['<script>alert(1)</script>','<img src="x">','<button onclick="alert(1)">x</button>','<div href="javascript:alert(1)">x</div>'])assert.throws(()=>api.renderMarkup(target,markup,e.document));
});
test('custom ledger label remains inert when opening settings and overview',()=>{
 const now=Date.now();const label='</div><img src=x onerror=alert(1)>';
 const settings={v:1,id:'custom',updated:now,cap:100,mode:'fixed',anchor:now-3600000,ledger:'default',label};
 const e=environment({trustedTypes:true,entries:[['gpc.v1.settings.custom',settings]]});
 e.menus.find(menu => menu.label === '显示 Pro 计数器').fn();
 assert.deepEqual(e.errors,[]);assert.ok(e.ui().textContent.includes(label));assert.equal(e.ui().querySelector('img'),null);
});
test('script does not add permissive Trusted Types policy or page-global private API',()=>{
 const e=environment({trustedTypes:true});
 assert.equal(e.win.trustedTypes,undefined);
 const keys=Object.keys(e.win).filter(k=>/GM_|webdav|password|gpc|pro.?counter/i.test(k));
 assert.deepEqual(keys,[]);
});
