'use strict';
// Independent synthetic DOM/VM bootstrap regression suite. Not an extension-injection or layout test.
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(process.env.AUDIT_SOURCE||path.join(__dirname,'../../chatgpt-pro-counter.user.js'),'utf8');
function environment(options={}){
 const observers=[],intervals=[],errors=[],menus=[],alerts=[];const timeouts=new Map();let nextTimer=1;
 const store=options.store||new Map(options.entries||[]);
 let document;
 class Node {
  constructor(tag='',value=''){this.tagName=tag.toUpperCase();this.nodeType=tag==='#text'?3:tag==='#fragment'?11:1;this.data=value;this.children=[];this.childNodes=this.children;this.parentNode=null;this.attributes={};this.listeners={};this.style={setProperty:(k,v)=>{this.style[k]=v;},removeProperty:k=>{delete this.style[k];}};this.dataset={};this._html='';this.classList={contains:k=>(this.className||'').split(/\s+/).includes(k),add:(...v)=>{this.className=[...new Set([...(this.className||'').split(/\s+/).filter(Boolean),...v])].join(' ');},remove:(...v)=>{this.className=(this.className||'').split(/\s+/).filter(x=>!v.includes(x)).join(' ');},toggle:(k,force)=>{const value=force??!this.classList.contains(k);value?this.classList.add(k):this.classList.remove(k);return value;}};}
  get ownerDocument(){return document;}
  get id(){return this.attributes.id||'';}set id(v){this.setAttribute('id',v);}
  get className(){return this.attributes.class||'';}set className(v){this.setAttribute('class',v);}
  get value(){if(this._value!==undefined)return this._value;if(this.tagName==='SELECT'){const opts=this.querySelectorAll('option');return (opts.find(o=>o.hasAttribute('selected'))||opts[0])?.value||'';}return this.getAttribute('value')||'';}set value(v){this._value=String(v);}
  get checked(){return this._checked??this.hasAttribute('checked');}set checked(v){this._checked=!!v;}
  get firstChild(){return this.children[0]||null;}
  get parentElement(){return this.parentNode;}
  get isConnected(){return !!this.parentNode&&(this.parentNode===document||this.parentNode.isConnected||this.parentNode===document.documentElement)||this===document.documentElement;}
  get textContent(){return this.nodeType===3?this.data:this.children.length?this.children.map(c=>c.textContent).join(''):this._html.replace(/<[^>]*>/g,'');}
  set textContent(v){this.replaceChildren();if(String(v))this.appendChild(new Node('#text',String(v)));}
  get innerHTML(){return this._html||this.children.map(c=>c.outerHTML).join('');}
  set innerHTML(v){if(options.trustedTypes)throw TypeError("This document requires 'TrustedHTML' assignment.");this.children.length=0;this._html=String(v);}
  get outerHTML(){return this.nodeType===3?this.data:`<${this.tagName.toLowerCase()} ${Object.entries(this.attributes).map(([k,v])=>`${k}="${v}"`).join(' ')}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;}
  appendChild(child){if(child.nodeType===11&&!child.host){for(const c of [...child.children])this.appendChild(c);return child;}child.remove();this.children.push(child);child.parentNode=this;this._html='';return child;}
  append(...children){for(const c of children)this.appendChild(typeof c==='string'?new Node('#text',c):c);}
  replaceChildren(...children){for(const c of this.children)c.parentNode=null;this.children.length=0;this._html='';this.append(...children);}
  remove(){if(this.parentNode){const a=this.parentNode.children;a.splice(a.indexOf(this),1);this.parentNode=null;}}
  removeChild(c){c.remove();return c;}
  setAttribute(k,v){this.attributes[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  hasAttribute(k){return Object.hasOwn(this.attributes,k);}
  removeAttribute(k){delete this.attributes[k];}
  toggleAttribute(k,on){if(on??!this.hasAttribute(k))this.setAttribute(k,'');else this.removeAttribute(k);}
  attachShadow(){const r=new Node('#fragment');r.host=this;r.parentNode=this;this.shadow=r;return r;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(f=>f!==fn);}
  dispatchEvent(e){for(const fn of this.listeners[e.type]||[])fn(e);return true;}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}
  matches(sel){
   if(sel.includes(','))return sel.split(',').some(s=>this.matches(s.trim()));
   const pieces=sel.trim().split(/\s+(?![^\[]*\])/);if(pieces.length>1){if(!this.matches(pieces.pop()))return false;let p=this.parentElement;while(p){if(p.matches(pieces.join(' ')))return true;p=p.parentElement;}return false;}
   const tag=/^[a-z][a-z0-9-]*/i.exec(sel);if(tag&&this.tagName.toLowerCase()!==tag[0].toLowerCase())return false;
   const id=/#([a-z0-9_-]+)/i.exec(sel);if(id&&this.id!==id[1])return false;
   for(const c of sel.matchAll(/\.([a-z0-9_-]+)/gi))if(!this.classList.contains(c[1]))return false;
   for(const a of sel.matchAll(/\[([^\s=\]]+)(?:=["']?([^"'\]]*)["']?)?\]/g)){if(!this.hasAttribute(a[1]))return false;if(a[2]!==undefined&&this.getAttribute(a[1])!==a[2])return false;}
   return !!(tag||id||sel.includes('.')||sel.includes('['));
  }
  querySelectorAll(sel){const selectors=sel.split(',').map(x=>x.trim());const matches=[];for(const c of this.children){if(selectors.some(s=>c.matches(s)))matches.push(c);matches.push(...c.querySelectorAll(sel));}return matches;}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  closest(sel){return this.matches(sel)?this:this.parentNode?.closest?.(sel)||null;}
  getBoundingClientRect(){return this._rect||{top:20,right:1180,bottom:60,left:1040,width:140,height:40};}
  focus(){document.activeElement=this;let p=this.parentNode;while(p){if(p.host){p.activeElement=this;document.activeElement=p.host;break;}p=p.parentNode;}}
  click(){this.dispatchEvent({type:'click',target:this,preventDefault(){},stopPropagation(){}});}
 }
 document={listeners:{},readyState:options.bodyAbsent?'loading':'complete',hidden:false,activeElement:null,createElement:t=>new Node(t),createElementNS:(_,t)=>new Node(t),createTextNode:t=>new Node('#text',t),createDocumentFragment:()=>new Node('#fragment'),addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);},removeEventListener(){},getElementById:id=>document.documentElement.querySelector('#'+id),querySelector:s=>document.documentElement.querySelector(s),querySelectorAll:s=>document.documentElement.querySelectorAll(s),contains:n=>document.documentElement.contains(n)};
 document.documentElement=new Node('html');document.head=new Node('head');document.documentElement.appendChild(document.head);document.body=options.bodyAbsent?null:new Node('body');if(document.body)document.documentElement.appendChild(document.body);
 const originalPromise=Promise.resolve(new Response('{}',{headers:{'content-type':'application/json'}}));
 const win={alert:text=>alerts.push(String(text)),location:{href:'https://chatgpt.com/'},fetch(...args){return options.fetch?options.fetch(...args):originalPromise;},matchMedia(){return options.legacyMedia?{matches:false,addListener(){}}:{matches:false,addEventListener(){}};},listeners:{},addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);},removeEventListener(){},confirm:()=>true,innerWidth:1280,innerHeight:800,scrollX:0,scrollY:0,getComputedStyle(){return {display:'block',visibility:'visible'};}};win.top=win;win.self=win;win.window=win;win.document=document;document.defaultView=win;
 const context={alert:win.alert,window:win,unsafeWindow:win,document,crypto,URL,Blob,TextEncoder,TextDecoder,Response,Request,ReadableStream,AbortController,Node,Event:class{constructor(type){this.type=type;}},btoa,console,setTimeout(fn,ms=0){const id=nextTimer++;timeouts.set(id,{fn,ms});return id;},clearTimeout(id){timeouts.delete(id);},setInterval(fn){intervals.push(fn);return intervals.length;},clearInterval(){},requestAnimationFrame(fn){const id=nextTimer++;timeouts.set(id,{fn,ms:0});return id;},cancelAnimationFrame(id){timeouts.delete(id);},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}},GM_getValue(k,d){if(options.throwStorage)throw Error('Synthetic storage failure');return store.has(k)?structuredClone(store.get(k)):d;},GM_setValue(k,v){store.set(k,structuredClone(v));},GM_listValues(){if(options.throwKeys)throw Error('Synthetic list failure');return [...store.keys()];},GM_registerMenuCommand(label,fn){menus.push({label,fn});},GM_info:{scriptHandler:'Tampermonkey',version:'5.5.1'},GM_xmlhttpRequest:options.gmRequest||function(){throw Error('Unexpected external request');}};
 Object.assign(win,{setTimeout:context.setTimeout,clearTimeout:context.clearTimeout,setInterval:context.setInterval,clearInterval:context.clearInterval,MutationObserver:context.MutationObserver,requestAnimationFrame:context.requestAnimationFrame});
 if(options.module)context.module={exports:{}};
 if(options.noGM){delete context.GM_getValue;delete context.GM_setValue;delete context.GM_listValues;}
 const run=fn=>{try{fn();}catch(e){errors.push(e);}};
 if(options.beforeRun)options.beforeRun({win,context,document,Node,store});
 run(()=>vm.runInNewContext(source,context));
 const flush=(maxDelay=Infinity)=>{for(const [id,task] of [...timeouts])if(task.ms<=maxDelay&&timeouts.has(id)){timeouts.delete(id);run(task.fn);}};
 const tick=()=>{for(const fn of intervals)run(fn);flush();};
 const mutate=()=>{for(const o of observers)run(()=>o.fn([],o));flush();};
 const host=()=>document.getElementById('chatgpt-pro-local-counter');
 const ui=()=>host()?.shadow;
 const rendered=()=>!!(ui()?.querySelector('button')||/<button\b/.test(ui()?.innerHTML||''));
 const emit=(target,type,details={})=>{const event={type,target,...details,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;}};for(const fn of target.listeners?.[type]||[])run(()=>fn(event));return event;};
 return {document,win,context,store,errors,menus,alerts,host,ui,rendered,flush,tick,mutate,run,Node,originalPromise,emit,intervals,timeouts};
}
module.exports={environment};
