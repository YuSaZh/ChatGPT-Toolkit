'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {eventEnvironment}=require('./audit-event-fixture.cjs');
const api=require('./chatgpt-pro-counter.user.js');
test('idle refresh retains the expanded panel, stylesheet, focus and scroll position',()=>{
 const e=eventEnvironment();e.menus.find(m=>m.label==='显示 Pro 计数器').fn();
 const root=e.ui(),panel=root.querySelector('#gpc-panel'),style=root.querySelector('style'),button=panel.querySelector('[data-action="log"]');
 panel.scrollTop=73;button.focus();
 for(let i=0;i<4;i++)e.intervals[0]();
 assert.equal(root.querySelector('#gpc-panel'),panel);assert.equal(root.querySelector('style'),style);assert.equal(panel.scrollTop,73);assert.equal(root.activeElement,button);
 assert.deepEqual(e.errors,[]);
});
test('template changes and removed roots still paint and escaped text stays inert',()=>{
 const e=eventEnvironment(),target=e.document.createElement('div');
 api.renderMarkup(target,'<strong>19</strong>',e.document);const first=target.firstChild;
 api.renderMarkup(target,'<strong>20</strong>',e.document);assert.equal(target.textContent,'20');assert.notEqual(target.firstChild,first);
 target.replaceChildren();api.renderMarkup(target,'<strong>20</strong>',e.document);assert.equal(target.textContent,'20');
 api.renderMarkup(target,'<strong>&lt;img src=x&gt;</strong>',e.document);assert.equal(target.querySelector('img'),null);assert.equal(target.textContent,'<img src=x>');
});
