'use strict';
const React = require('react');
const {createRoot} = require('react-dom/client');
const {flushSync} = require('react-dom');
const {jsx,jsxs} = require('react/jsx-runtime');
let nativeGets=0, conversation='local-a', browser='chat-a', rendering=0;
const raw=(id,role)=>{const value={id,author:{role},recipient:'all',create_time:1770000000,metadata:{resolved_model_slug:'injected-model'}};Object.defineProperty(value,'content',{get(){throw Error('private body read')}});return value;};
let mappings={'local-a':{question:{message:raw('question','user')},answer:{message:raw('answer','assistant')}}};
const originalProps=[], nativeCalls=[];const action=()=>{window.__moduleMetrics.actions++};window.__moduleMetrics={originalProps,nativeCalls,actions:0,action};
const modules={
 metrics(m){m.exports=window.__moduleMetrics}, react(m){m.exports=React}, jsx(m){m.exports={jsx,jsxs}}, selectors(m){m.exports={mapping:{token:true}}},
 content(m,e,r){var S=r('selectors');e.read=(get,cid)=>{let value=get(S.mapping,cid);return{mapping:value,context_truncation_continuation:0,getRenderTelemetry:0,isStreaming:false}}},
 boundary(m,e,r){var R=r('react'),J=r('jsx');r.d(e,{render:()=>Turns});function Turns(props){return (0,J.jsx)('main',{id:'pending-chatgpt-submit',timestampSeparatorAtMs:props.time,children:props.children})}},
 messages(m,e,r){var R=r('react'),J=r('jsx'),M=r('metrics');
  e.copyPlainTextFromSource=0;e.suppressCopyTurnToClipboardAnalytics=0;e.getCopyHtml=0;
  function User(p){M.nativeCalls.push('user');M.originalProps.push(p);if(p.item.hidden)return null;return (0,J.jsx)('div',{'data-native':'user',hidden:p.item.cssHidden,children:'Synthetic question'})}
  function Actions(p){M.nativeCalls.push('assistant');M.originalProps.push(p);if(p.assistantItem.hidden)return null;return (0,J.jsx)('div',{'data-native':'assistant',messageId:'answer',hidden:p.assistantItem.cssHidden,children:['Synthetic answer',p.sourcesAction]})}
  e.items=(cid,hidden=false,cssHidden=false)=>[(0,J.jsx)(User,{conversationId:cid,item:{type:'user-message',messageId:'question',hidden,cssHidden},items:[],isMostRecentTurn:true,isReadOnly:false}), (0,J.jsxs)(Actions,{conversationId:cid,assistantItem:{type:'assistant-message',messageId:'answer',latestMessageId:'wrong-representative',hidden,cssHidden},additionalTurnActions:[],actionRowRef:null,sourcesAction:(0,J.jsx)('button',{'data-native-action':'',onClick:M.action,children:'Source'})})];
 }
};
function webpack(id){if(webpack.c[id])return webpack.c[id].exports;const m={id,exports:{}};webpack.c[id]=m;webpack.m[id].call(m.exports,m,m.exports,webpack);return m.exports;}
webpack.m=modules;webpack.c={};webpack.C=()=>{};webpack.d=(e,d)=>{for(const key of Object.keys(d))Object.defineProperty(e,key,{enumerable:true,get:d[key]})};
// Boundary deliberately initializes before the message factory.
const Turns=webpack('boundary').render, messages=webpack('messages'), content=webpack('content');
const cache=new Map();let hide=false,cssHide=false;
function App(){rendering++; if(!cache.has(conversation))cache.set(conversation,content.read((selector,cid)=>{nativeGets++;return mappings[cid]},conversation));return React.createElement(Turns,{conversationId:conversation,browserConversationId:browser,renderedTurns:[],children:messages.items(conversation,hide,cssHide)});}
const root=createRoot(document.getElementById('app'));
function render(){flushSync(()=>root.render(React.createElement(App)));}
function inspect(){return{labels:[...document.querySelectorAll('[data-chatgpt-toolkit-info]')].map(x=>x.textContent),nativeGets,nativeCalls:nativeCalls.length,rendering,legacyNodes:document.querySelectorAll('[data-message-id][data-message-author-role]').length,props:originalProps.length,actions:window.__moduleMetrics.actions,actionIdentity:originalProps.filter(p=>p.assistantItem).every(p=>p.sourcesAction.props.children[0].props.onClick===window.__moduleMetrics.action),status:Object.fromEntries([...document.getElementById('bridge-test_status').attributes].filter(x=>x.name.startsWith('data-')).map(x=>[x.name,x.value]))};}
window.moduleFixture={render,inspect,route(cid,bid){conversation=cid;browser=bid;if(!mappings[cid])mappings[cid]={question:{message:raw('question','user')},answer:{message:raw('answer','assistant')}};history.replaceState(null,'','/c/'+bid);render()},fresh(){mappings[conversation]={question:{message:raw('question','user')},answer:{message:raw('answer','assistant')}};cache.delete(conversation);render()},reobserveOld(){cache.delete(conversation);render()},hide(value,css=false){hide=value;cssHide=css;render()},throwOriginal(error){return content.read(()=>{throw error},conversation)},unmount(){flushSync(()=>root.unmount())}};
render();
