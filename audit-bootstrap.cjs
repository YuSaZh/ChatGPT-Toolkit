'use strict';
// Independent synthetic-browser bootstrap audit. No authenticated page or WebDAV access.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const script = fs.readFileSync(process.argv[2] || path.join(__dirname, 'chatgpt-pro-counter.user.js'), 'utf8');
const boot = `
window.unsafeWindow=window;
window.__auditRoots=[]; window.__auditStore={}; window.__auditMenu=[];
const attach=Element.prototype.attachShadow;
Element.prototype.attachShadow=function(options){const root=attach.call(this, options);window.__auditRoots.push(root);return root;};
window.GM_getValue=(key,fallback)=>Object.hasOwn(__auditStore,key)?structuredClone(__auditStore[key]):fallback;
window.GM_setValue=(key,value)=>{__auditStore[key]=structuredClone(value);};
window.GM_listValues=()=>Object.keys(__auditStore);
window.GM_registerMenuCommand=(label,callback)=>__auditMenu.push({label,callback});
window.GM_info={scriptHandler:'Tampermonkey',version:'5.5.1'};
window.GM_xmlhttpRequest=()=>{throw Error('Audit forbids real WebDAV requests');};
window.fetch=()=>Promise.resolve(new Response('{}',{headers:{'content-type':'application/json'}}));
`;
(async()=>{
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html');
  if(req.url==='/trusted-types')res.setHeader('Content-Security-Policy',"require-trusted-types-for 'script'; trusted-types 'none'");
  res.end('<!doctype html><html><head><title>Synthetic bootstrap audit</title></head><body><main>Empty fixture</main></body></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const results=[];
 async function probe(name,setup='',route='/',change=null){
  const context=await browser.newContext();
  await context.addInitScript({content:boot+'\n'+setup+'\n'+script});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
  await page.waitForTimeout(250);
  if(change){await change(page);await page.waitForTimeout(1600);}
  const result=await page.evaluate(()=>{
   const host=document.getElementById('chatgpt-pro-local-counter');
   const root=window.__auditRoots.find(r=>r.host===host);
   const button=root?.querySelector('button');
   return {mounted:!!host,rendered:!!button,content:root?.textContent.replace(/\s+/g,' ').slice(-170)||'',menus:window.__auditMenu.length,hostCount:document.querySelectorAll('#chatgpt-pro-local-counter').length};
  });
  results.push({name,...result,errors});await context.close();
 }
 try{
  await probe('document-start normal');
  await probe('page global module.exports','window.module={exports:{}};');
  await probe('GM storage getters throw',"window.GM_getValue=()=>{throw Error('Synthetic storage failure');};");
  await probe('GM legacy API unavailable','delete window.GM_getValue;');
  await probe('media addEventListener unavailable',"window.matchMedia=()=>({matches:false,addListener(){}});");
  await probe('Trusted Types enforced with no policy','', '/trusted-types');
  await probe('SPA removes host','', '/', page=>page.evaluate(()=>document.getElementById('chatgpt-pro-local-counter')?.remove()));
  await probe('SPA replaces body','', '/', page=>page.evaluate(()=>document.body.replaceWith(document.createElement('body'))));
  console.log(JSON.stringify(results,null,2));
  for (const result of results) {
   assert.equal(result.mounted, true, result.name + ': host mounts');
   assert.equal(result.rendered, true, result.name + ': launcher renders');
   assert.equal(result.hostCount, 1, result.name + ': no duplicate host');
   assert.ok(result.menus >= 1, result.name + ': menu registered');
   assert.deepEqual(result.errors, [], result.name + ': no uncaught page errors');
  }
 } finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
