'use strict';
// Generate a local, network-free browser fixture. Production reader/render code
// is unchanged; only bootstrap exports the API instead of starting the full app.
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../chatgpt-pro-counter.user.js'),'utf8')
  .replace("else if (browser) { diagnostics.mark('boot'); api.boot(); }","else if (browser) { window.fixtureAPI = api; }");
const harness=`
const api=window.fixtureAPI;let route='chat-a';let requests=0;
window.fetch=()=>{requests++;throw Error('Fixture forbids network');};
let state=api.createMessageInfoState({page:()=> 'https://chatgpt.com/c/'+route}),badges=new Map();
function mount(){
 document.getElementById('timeline').replaceChildren();
 const timeline=document.getElementById('timeline'),root={tag:3,return:null};root.stateNode={current:root};
 const mapping={question:{message:{id:'question',author:{role:'user'},recipient:'all',create_time:1770000000,metadata:{}}},answer:{message:{id:'answer',author:{role:'assistant'},recipient:'all',create_time:1770000010,metadata:{resolved_model_slug:route==='chat-a'?'gpt-5.4-pro':'gpt-5.4-thinking'}}}};
 const boundary={tag:0,memoizedProps:{conversationId:'local-'+route,browserConversationId:route,renderedTurns:[]},return:root,memoizedState:{memoizedState:mapping,queue:{value:mapping,getSnapshot(){throw Error('Must never run');}}}};
 const main={tag:5,stateNode:timeline,memoizedProps:{},return:boundary};root.child=boundary;boundary.child=main;timeline.__reactFiber$fixture=main;
 let last;
 for(const role of ['user','assistant']){
  const id=role==='user'?'question':'answer',element=document.createElement('section');element.className=role;
  element.textContent=role==='user'?'How do message labels work?':'Labels use already-loaded message metadata. This is synthetic browser QA.';timeline.appendChild(element);
  const props={conversationId:'local-'+route,[role==='user'?'item':'assistantItem']:{type:role+'-message',messageId:id}};
  const component={tag:0,memoizedProps:props,return:main},host={tag:5,memoizedProps:role==='assistant'?{messageId:id}:{},stateNode:element,return:component};component.child=host;element.__reactFiber$fixture=host;
  if(last)last.sibling=component;else main.child=component;last=component;
 }
}
function render(){const r=api.renderMessageInfo(document,state,badges);document.getElementById('status').textContent=JSON.stringify({route,enabled:state.enabled(),badges:r.messageBadges,legacyPairs:document.querySelectorAll('[data-message-id][data-message-author-role]').length,requests});}
document.getElementById('toggle').onclick=()=>{state.setEnabled(!state.enabled());render();};
document.getElementById('next').onclick=()=>{route=route==='chat-a'?'chat-b':'chat-a';render();mount();render();};
document.getElementById('account').onclick=()=>{state.invalidate();render();};
document.getElementById('remount').onclick=()=>{mount();render();};
mount();render();
`;
const output=path.join(__dirname,'../../artifacts/ui-current-frontend-fixture.html');fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,`<!doctype html><meta charset="utf-8"><title>Toolkit current frontend browser fixture</title><style>body{font:16px/1.5 system-ui;background:#f6f7f9;margin:30px;color:#20252d}main{max-width:740px;margin:30px auto}section{background:white;border:1px solid #d7dbe2;padding:22px;border-radius:15px;margin:20px 0}.user{margin-left:120px}.assistant{margin-right:40px}button{padding:9px 15px;margin:4px}#status{font:14px monospace}</style><h1>Current frontend message-label fixture</h1><p>Synthetic messages, real browser DOM. No ChatGPT login or API request.</p><button id="toggle">Toggle labels</button><button id="next">Switch history</button><button id="account">Account boundary</button><button id="remount">Fresh remount</button><p id="status"></p><main id="timeline" data-app-action-timeline-scroll></main><script>${source.replace(/<\/script/gi,'<\\/script')}</script><script>${harness}</script>`);
console.log('Generated browser fixture');
