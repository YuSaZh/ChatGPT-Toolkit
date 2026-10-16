'use strict';
// These tests deliberately reproduce defects in the dormant metadata bridge.
// Production 1.1.19 never starts this bridge; safety-rollback.test.cjs checks the
// actual boot path. A passing counterexample is not a claim that injection is safe.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM}=require('jsdom'),{buildSync}=require('esbuild');
const {pageMetadataRuntime}=require('../../metadata-page-runtime.cjs');
const bundle=buildSync({stdin:{contents:`
const React=require('react'),{renderToString}=require('./node_modules/react-dom/cjs/react-dom-server-legacy.browser.production.js'),{hydrateRoot}=require('react-dom/client');
const bridge=window['hydrate-audit'];let calls=0,effects=0;
function Child(){const id=React.useId();React.useEffect(()=>{effects++},[]);return React.createElement('label',{id},id)}
function User(){calls++;React.useId();return React.createElement('section',null,React.createElement(Child))}
function Assistant(props){calls++;React.useEffect(()=>{effects++},[]);return React.createElement('article',null,'Synthetic answer',props.sourcesAction?React.createElement('footer',null,props.sourcesAction):null)}
function Boundary(props){return React.createElement('main',null,props.children)}
const assistant=window.scenario==='assistant';
const props=assistant?{conversationId:'local-a',assistantItem:{type:'assistant-message',messageId:'answer'},sourcesAction:undefined}:{conversationId:'local-a',item:{type:'user-message',messageId:'question'}};
const Native=assistant?Assistant:User;
const tree=(Component,Shell)=>React.createElement(Shell,{conversationId:'local-a',browserConversationId:'chat-a'},React.createElement(Component,props));
const container=document.getElementById('app');container.innerHTML=renderToString(tree(Native,Boundary));const initial=container.firstChild,before=container.innerHTML;calls=0;
const Component=window.patchMessage?bridge.message(Native,React,assistant):Native,Shell=window.patchBoundary?bridge.boundary(Boundary,React):Boundary;
window.errors=[];window.root=hydrateRoot(container,tree(Component,Shell),{onRecoverableError(e){errors.push(e.message)}});
window.inspect=()=>({before,after:container.innerHTML,calls,effects,errors,sameNode:container.firstChild===initial,labels:container.querySelectorAll('[data-chatgpt-toolkit-info]').length});
`,resolveDir:__dirname,sourcefile:'hydration-regression-fixture.cjs'},bundle:true,write:false,platform:'browser',define:{'process.env.NODE_ENV':'"production"'}}).outputFiles[0].text;
async function run({scenario='user',patchMessage=false,patchBoundary=false,enabled=false}={}){
 const dom=new JSDOM('<html><head><meta id="status"></head><body><div id="app"></div></body></html>',{url:'https://fixture.invalid/c/chat-a',runScripts:'dangerously',pretendToBeVisual:true});
 const w=dom.window;let requests=0;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.fetch=()=>{requests++;throw Error('No real requests allowed')};
 try{w.eval('('+pageMetadataRuntime.toString()+')('+JSON.stringify({key:'hydrate-audit',statusId:'status',eventName:'control',enabled})+',()=>({changed:false}));');Object.assign(w,{scenario,patchMessage,patchBoundary});w.eval(bundle);await new Promise(resolve=>setTimeout(resolve,80));return {requests,...w.inspect()};}
 finally{w.root?.unmount();dom.window.close()}
}
test('SSR control and boundary-only wrapping preserve native useId hydration',async()=>{
 for(const patchBoundary of [false,true]){const result=await run({patchBoundary});assert.equal(result.errors.length,0);assert.equal(result.before,result.after);assert.equal(result.calls,1);assert.equal(result.effects,1);assert.equal(result.sameNode,true);assert.equal(result.requests,0)}
});
test('dormant user wrapper changes nested useId and causes text hydration recovery even with labels disabled',async()=>{
 for(const enabled of [false,true]){const result=await run({patchMessage:true,enabled});assert.equal(result.errors.length,1);assert.match(result.errors[0],/Minified React error #418/);assert.match(result.errors[0],/args\[\]=text/);assert.equal(result.sameNode,false);assert.ok(result.calls>1);assert.equal(result.labels,0);assert.equal(result.requests,0)}
});
test('dormant assistant wrapper changes an absent action slot to truthy and causes HTML hydration recovery',async()=>{
 const control=await run({scenario:'assistant'});assert.equal(control.errors.length,0);assert.equal(control.sameNode,true);assert.equal(control.calls,1);
 const result=await run({scenario:'assistant',patchMessage:true,enabled:false});assert.equal(result.errors.length,1);assert.match(result.errors[0],/Minified React error #418/);assert.match(result.errors[0],/args\[\]=HTML/);assert.equal(result.sameNode,false);assert.ok(result.calls>1);assert.match(result.after,/<footer>/);assert.equal(result.labels,0);assert.equal(result.requests,0);
});
