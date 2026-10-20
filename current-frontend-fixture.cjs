'use strict';
const api = require('./chatgpt-pro-counter.user.js');
const { environment } = require('./audit-dom-fixture.cjs');
// Source-grounded synthetic current frontend. No legacy ID/role DOM attributes.
// Renderer: item / assistantItem with internal conversationId, ancestor
// browserConversationId; useQuery data and useSyncExternalStore cached values.
function raw(id='answer', role='assistant', extra={}) {
  const message = { id, author:{role}, recipient:'all', create_time:1770000000,
    metadata:{model_slug:'fallback-model',resolved_model_slug:'current-model'},...extra };
  Object.defineProperty(message,'content',{get(){throw Error('content read');}});
  return message;
}
function setup({ internal='local-a', browser='chat-a', mapping=null, query=true, external=false, noAnchor=false, direct=false }={}) {
  let url='https://chatgpt.com/c/chat-a', requests=0, calls=0;
  const env=environment({fetch(){requests++;throw Error('network');}}), doc=env.document;
  const timeline=doc.createElement('main'), turn=doc.createElement('article');
  if(!noAnchor)timeline.setAttribute('data-app-action-timeline-scroll','');
  timeline.appendChild(turn);doc.body.appendChild(timeline);
  const root={tag:3,return:null};root.stateNode={current:root};
  const data={conversation_id:browser,current_node:'answer',mapping:mapping||{question:{message:raw('question','user')},answer:{message:raw()}}};
  const boundary={tag:0,memoizedProps:{conversationId:internal,browserConversationId:browser,renderedTurns:[]},return:root};
  const mainHost={tag:5,stateNode:timeline,return:boundary,memoizedProps:{}};
  const turnHost={tag:5,stateNode:turn,return:mainHost,memoizedProps:{}};
  root.child=boundary;boundary.child=mainHost;mainHost.child=turnHost;
  if(query)boundary.memoizedState={memoizedState:{data},next:null};
  if(external){const h={memoizedState:data.mapping,queue:{value:data.mapping,getSnapshot(){calls++;throw Error('snapshot called');}},next:boundary.memoizedState};boundary.memoizedState=h;}
  Object.defineProperty(timeline,'__reactFiber$test',{value:mainHost});
  Object.defineProperty(turn,'__reactFiber$test',{value:turnHost});
  const components=[];
  for(const [id,role] of [['question','user'],['answer','assistant']]) {
    const element=doc.createElement('div');turn.appendChild(element);
    if(!noAnchor&&role==='user')element.setAttribute('data-user-message-bubble','');
    if(!noAnchor&&role==='assistant')element.setAttribute('data-message-author-role','assistant');
    const item={type:role+'-message',messageId:id};
    Object.defineProperty(item,'content',{get(){throw Error('item content read');}});
    const props={conversationId:direct?browser:internal,[role==='assistant'?'assistantItem':'item']:item};
    const component={tag:0,memoizedProps:props,return:turnHost};
    const host={tag:5,stateNode:element,return:component,memoizedProps:role==='assistant'?{messageId:id}:{}};
    component.child=host;
    if(components.length)components.at(-1).fiber.sibling=component;else turnHost.child=component;
    Object.defineProperty(element,'__reactFiber$test',{value:host,configurable:true});
    components.push({fiber:component,host,props,item,element,id,role});
  }
  const state=api.createMessageInfoState({page:()=>url}),badges=new Map();
  return {env,doc,state,badges,data,boundary,mainHost,turnHost,root,components,requests:()=>requests,calls:()=>calls,
    page(next){url=next;},render(){return api.renderMessageInfo(doc,state,badges);},badge(i=1){return components[i].element.querySelector('.chatgpt-toolkit-message-info');}};
}

module.exports={setup,raw};
