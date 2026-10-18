'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('./chatgpt-pro-counter.user.js');
const {environment}=require('./audit-dom-fixture.cjs');
const {eventEnvironment}=require('./audit-event-fixture.cjs');
test("inline labels preserve native nodes, follow their toolbar and remove only their own span",()=>{
 const e=environment(),d=e.document,native=d.createElement("article"),toolbar=d.createElement("div"),copy=d.createElement("button"),more=d.createElement("button");native.setAttribute("data-message-id","answer");native.setAttribute("data-message-author-role","assistant");copy.setAttribute("aria-label","Copy");toolbar.append(copy,more);native.append(toolbar);d.body.append(native);
 const before=native.outerHTML,state=api.createMessageInfoState({page:()=> "https://chatgpt.com/c/chat-a"}),badges=new Map(),display=api.createInlineMessageDisplay(d);
 state.history(state.capture("chat-a"),{conversation_id:"chat-a",mapping:{answer:{message:{id:"answer",author:{role:"assistant"},create_time:1770000000,metadata:{resolved_model_slug:"actual-response-model",thinking_effort:"max"}}}}});
 api.renderMessageInfo(d,state,badges,undefined,display);const badge=badges.get(native);assert.ok(badge);assert.equal(badge.parentNode,toolbar);assert.equal(toolbar.children[0],copy);assert.equal(toolbar.children[1],more);assert.match(badge.textContent,/^actual-response-model  max/);assert.match(badge.style.cssText,/position:static/);assert.doesNotMatch(badge.style.cssText,/absolute|fixed/);
 api.renderMessageInfo(d,state,badges,undefined,display);assert.equal(badges.get(native),badge);assert.equal(toolbar.children.length,3);
 state.setEnabled(false);api.renderMessageInfo(d,state,badges,undefined,display);assert.equal(badges.size,0);assert.equal(native.outerHTML,before);display.clear();
});
test("message time uses local calendar days, weekday up to a week and older dates",()=>{
 const now=new Date(2026,9,18,14,30).getTime(),t=days=>new Date(2026,9,18-days,9,7).getTime();
 assert.equal(api.formatMessageTime(t(0),now),"09:07");
 for(const days of [1,6,7]) assert.equal(api.formatMessageTime(t(days),now),new Date(t(days)).toLocaleDateString([],{weekday:"short"})+" 09:07");
 for(const days of [8,400,-1]) assert.equal(api.formatMessageTime(t(days),now),new Date(t(days)).toLocaleDateString([],{year:"numeric",month:"2-digit",day:"2-digit"})+" 09:07");
 assert.equal(api.formatMessageTime(null,now),"");
});
test("effort comes only from actual thinking_effort and is bounded",()=>{
 const row=metadata=>api.messageInfo({id:"answer",author:{role:"assistant"},metadata},"chat-a");
 assert.equal(row({thinking_effort:"max",reasoning_effort:"high"}).effort,"max");assert.equal(row({reasoning_effort:"high"}).effort,"");assert.equal(row({thinking_effort:"<script>"}).effort,"");
});
test('model entry and all descendants remain passive in both visibility modes; Send and Start voice still show cards',()=>{
 for(const mode of ['all','pro']){
  let calls=0;const e=eventEnvironment({entries:[['gpc.v1.ui.hoverMode',mode]],fetch(){calls++;throw Error('unexpected request')}}),d=e.document,form=d.createElement('form'),editor=d.createElement('textarea'),model=d.createElement('button'),label=d.createElement('span'),svg=d.createElement('svg');
  editor.id='prompt-textarea';model.setAttribute('data-codex-intelligence-trigger','true');label.textContent='Pro';model.append(label,svg);form.append(editor,model);d.body.append(form);e.mutate();const original=model.outerHTML;
  const card=()=>d.getElementById('chatgpt-pro-local-hover');
  for(const node of [model,label,svg])for(const event of ['pointerenter','mouseenter','focus','pointerover','focusin']){e.dispatch(node,event);e.flush(150);assert.equal(card().hidden,true,mode+':'+event)}
  for(const attrs of [{'data-testid':'send-button','aria-label':'发送消息'},{'aria-label':'开始语音',type:'button','data-testid':'composer-speech-button'}]){const button=d.createElement('button');for(const [key,value]of Object.entries(attrs))button.setAttribute(key,value);form.append(button);e.mutate();e.dispatch(button,'focusin');e.flush(150);assert.equal(card().hidden,false);e.dispatch(d.body,'keydown',{key:'Escape'});button.remove()}
  assert.equal(model.outerHTML,original);assert.equal(calls,0);assert.deepEqual(e.errors,[]);
 }
});
