'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../chatgpt-pro-counter.user.js');
const { environment } = require('../fixtures/audit-dom-fixture.cjs');
const { setup, raw } = require('../fixtures/current-frontend-fixture.cjs');
test('current frontend cached history renders user time and assistant time/model with zero old DOM pairs',()=>{
  const s=setup();assert.equal(s.doc.querySelectorAll('[data-message-id][data-message-author-role]').length,0);
  const result=s.render();assert.equal(result.messageBadges,2);assert.match(s.badge().textContent,/current-model/);assert.doesNotMatch(s.badge(0).textContent,/model/);
  assert.match(s.badge().getAttribute('title'),/2026-02-02T02:40:00.000Z/);assert.equal(s.requests(),0);assert.equal(s.calls(),0);
});
test('already materialized mapping hook works without query data or app getters',()=>{
  const s=setup({query:false,external:true});s.render();assert.ok(s.badge());assert.equal(s.calls(),0);assert.equal(s.requests(),0);
});
test('bounded DOM fallback finds new component identities when native anchor spellings change',()=>{
  const s=setup({noAnchor:true});s.render();assert.equal(s.badges.size,2);
});
test('hide and show restore cached new frontend history without a fetch',()=>{
  const s=setup({query:false,external:true});s.render();s.state.setEnabled(false);s.render();assert.equal(s.badges.size,0);
  s.state.setEnabled(true);s.render();assert.equal(s.badges.size,2);assert.equal(s.requests(),0);
});
test('readable query snapshot requires its explicit server conversation identity',()=>{
  const s=setup();s.data.conversation_id='other';s.render();assert.equal(s.badges.size,0);
});
test('cached mapping without explicit query ID requires proven internal/server boundary alias',()=>{
  const s=setup({query:false,external:true});delete s.boundary.memoizedProps.browserConversationId;s.render();assert.equal(s.badges.size,0);
});
test('conflicting browser conversation boundary rejects both store and network rows',()=>{
  const s=setup();s.boundary.memoizedProps.browserConversationId='wrong';
  s.state.history(s.state.capture('chat-a'),{...s.data,conversation_id:'chat-a'});s.data.conversation_id='chat-a';s.render();assert.equal(s.badges.size,0);
});
test('direct server conversation identity permits committed mapping snapshot',()=>{
  const s=setup({query:false,external:true,direct:true});delete s.boundary.memoizedProps.browserConversationId;s.render();assert.equal(s.badges.size,2);
});
test('new frontend labels naturally observed network metadata when native mapping is absent',()=>{
  const s=setup({query:false});s.state.history(s.state.capture('chat-a'),s.data);s.render();assert.equal(s.badges.size,2);
});
test('latest user ID then server ID precedence is exact rather than turn position',()=>{
  const s=setup();s.components[0].item.latestMessageId='latest';s.components[0].item.serverMessageId='server';
  s.data.mapping.latest={message:raw('latest','user',{create_time:1770000100})};s.data.mapping.server={message:raw('server','user',{create_time:1770000200})};
  s.render();assert.match(s.badge(0).getAttribute('title'),/02:41:40/);
  delete s.components[0].item.latestMessageId;s.render();assert.match(s.badge(0).getAttribute('title'),/02:43:20/);
});
test('assistant returned messageId outranks latestMessageId',()=>{
  const s=setup();s.components[1].item.latestMessageId='latest';s.data.mapping.latest={message:raw('latest','assistant',{metadata:{model_slug:'wrong'}})};
  s.render();assert.match(s.badge().textContent,/current-model/);
});
test('assistant falls back to latest ID when rendered props do not identify the message',()=>{
  const s=setup();delete s.components[1].host.memoizedProps.messageId;s.components[1].item.latestMessageId='latest';
  s.data.mapping.latest={message:raw('latest','assistant',{metadata:{model_slug:'latest-model'}})};s.render();assert.match(s.badge().textContent,/latest-model/);
});
test('hidden metadata removes cached native and network label',()=>{
  const s=setup();s.state.history(s.state.capture('chat-a'),s.data);s.render();assert.ok(s.badge());
  s.data.mapping.answer.message=raw('answer','assistant',{metadata:{is_visually_hidden_from_conversation:true,model_slug:'hidden'}});s.render();assert.equal(s.badge(),null);
});
test('tool-directed message vetoes old network metadata',()=>{
  const s=setup();s.state.history(s.state.capture('chat-a'),s.data);s.data.mapping.answer.message=raw('answer','assistant',{recipient:'python'});s.render();assert.equal(s.badge(),null);
});
test('mapping ID and role must both match exact component identity',()=>{
  for(const extra of [{id:'other'},{author:{role:'user'}}]){const s=setup();s.data.mapping.answer.message=raw('answer','assistant',extra);s.render();assert.equal(s.badge(),null);}
});
test('SPA history switch immediately removes old labels and restores new cached history',()=>{
  const s=setup({query:false,external:true});s.render();assert.ok(s.badge());s.page('https://chatgpt.com/c/chat-b');s.render();assert.equal(s.badges.size,0);
  s.boundary.memoizedProps={...s.boundary.memoizedProps,conversationId:'local-b',browserConversationId:'chat-b'};
  for(const c of s.components)c.fiber.memoizedProps={...c.props,conversationId:'local-b'};
  const mapping={question:{message:raw('question','user')},answer:{message:raw('answer','assistant',{metadata:{model_slug:'chat-b-model'}})}};
  s.boundary.memoizedState={memoizedState:mapping,queue:{value:mapping,getSnapshot(){throw Error('called');}}};s.render();assert.match(s.badge().textContent,/chat-b-model/);
  s.page('https://chatgpt.com/c/chat-a');s.render();assert.equal(s.badges.size,0);
});
test('history switch does not borrow a bare cached mapping without matching boundary',()=>{
  const s=setup({query:false,external:true});s.render();s.page('https://chatgpt.com/c/chat-b');s.render();assert.equal(s.badges.size,0);
});
test('account fence removes same-node same-ID metadata and stale new-host source reuse',()=>{
  const s=setup();s.render();s.state.invalidate();s.render();assert.equal(s.badges.size,0);
  for(const c of s.components){const fresh=s.doc.createElement('div');c.element.parentNode.appendChild(fresh);c.element.remove();c.element=fresh;c.host.stateNode=fresh;Object.defineProperty(fresh,'__reactFiber$test',{value:c.host});c.fiber.memoizedProps={...c.props};}
  s.render();assert.equal(s.badges.size,0);
});
test('new host and fresh snapshots recover after account boundary',()=>{
  const s=setup();s.render();s.state.invalidate();
  for(const c of s.components){const fresh=s.doc.createElement('div');c.element.parentNode.appendChild(fresh);c.element.remove();c.element=fresh;c.host.stateNode=fresh;Object.defineProperty(fresh,'__reactFiber$test',{value:c.host});c.fiber.memoizedProps={...c.props};}
  s.boundary.memoizedState={memoizedState:{data:{...s.data,mapping:{question:{message:raw('question','user')},answer:{message:raw('answer','assistant',{metadata:{model_slug:'fresh-account'}})}}}}};
  s.render();assert.match(s.badge().textContent,/fresh-account/);
});
test('uncommitted alternate and pending props never contribute metadata',()=>{
  const s=setup();s.boundary.alternate={memoizedState:{memoizedState:{data:{...s.data,mapping:{answer:{message:raw('answer','assistant',{metadata:{model_slug:'wrong'}})}}}}}};
  s.components[1].fiber.pendingProps={...s.components[1].props,assistantItem:{type:'assistant-message',messageId:'wrong'}};s.render();assert.match(s.badge().textContent,/current-model/);
});
test('mismatched external-store cache identity is rejected without executing snapshot',()=>{
  const s=setup({query:false,external:true});s.boundary.memoizedState.queue.value={...s.data.mapping};s.render();assert.equal(s.badges.size,0);assert.equal(s.calls(),0);
});
test('snapshot, queue, metadata and content accessor getters are never executed',()=>{
  const s=setup({query:false,external:true});Object.defineProperty(s.data.mapping.answer.message.metadata,'resolved_model_slug',{get(){throw Error('metadata getter');}});
  s.render();assert.match(s.badge().textContent,/fallback-model/);
  Object.defineProperty(s.boundary.memoizedState.queue,'value',{get(){throw Error('queue getter');}});s.render();assert.equal(s.badges.size,0);
});
test('hook cycles and oversized chains are bounded',()=>{
  const s=setup({query:false});s.boundary.memoizedState={memoizedState:{}};s.boundary.memoizedState.next=s.boundary.memoizedState;s.render();assert.equal(s.badges.size,0);
});
test('React Offscreen hidden subtree is not labeled',()=>{
  const s=setup();s.turnHost.tag=22;s.turnHost.memoizedState={hidden:true};s.render();assert.equal(s.badges.size,0);
});
test('two messages in one turn mount separately with no duplicate badges on repeat render',()=>{
  const s=setup();s.render();s.render();assert.equal(s.badges.size,2);assert.equal(s.components[0].element.querySelectorAll('.chatgpt-toolkit-message-info').length,1);assert.equal(s.components[1].element.querySelectorAll('.chatgpt-toolkit-message-info').length,1);
});
module.exports={setup,raw};
test('live committed external mapping outranks stale query response in an earlier hook',()=>{
 const s=setup();const live={...s.data.mapping,answer:{message:raw('answer','assistant',{metadata:{resolved_model_slug:'live-model'}})}};
 s.boundary.memoizedState.next={memoizedState:live,queue:{value:live,getSnapshot(){throw Error('called');}}};
 s.render();assert.match(s.badge().textContent,/live-model/);
});
test('live hidden message overrides older visible query and network snapshots',()=>{
 const s=setup();s.state.history(s.state.capture('chat-a'),s.data);
 const live={...s.data.mapping,answer:{message:raw('answer','assistant',{metadata:{is_visually_hidden_from_conversation:true}})}};
 s.boundary.memoizedState.next={memoizedState:live,queue:{value:live,getSnapshot(){throw Error('called');}}};
 s.render();assert.equal(s.badge(),null);
});
test('same-message nested component can supply host when only outer carries conversationId',()=>{
 const s=setup();const c=s.components[0];const nested={tag:0,memoizedProps:{item:c.item},return:c.fiber,child:c.host};
 c.fiber.child=nested;c.host.return=nested;s.render();assert.ok(s.badge(0));
});
test('LegacyHidden and Activity hidden state omit message descendants',()=>{
 for(const tag of [23,31]){const s=setup();s.turnHost.tag=tag;s.turnHost.memoizedState={};s.turnHost.memoizedProps={mode:'hidden'};s.render();assert.equal(s.badges.size,0);}
});
test('dialogs and sidebar replicas do not receive badges',()=>{
 for(const type of ['dialog','aside','nav']){const s=setup();if(type==='dialog')s.turnHost.stateNode.setAttribute('role','dialog');else s.turnHost.stateNode.tagName=type.toUpperCase();s.render();assert.equal(s.badges.size,0);}
});
test('reader releases raw component references after each render',()=>{
 const s=setup();s.render();for(const t of s.state.nativeReader(s.doc).targets())assert.deepEqual(Object.keys(t).sort(),['element','id','role']);
});
