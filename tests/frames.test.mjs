// Frame routing regressions use fake Chrome APIs; not proof of browser permissions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pageEditor} from '../extension/editor-adapter.mjs';
const topUrl='https://practice.example/course';
const childUrl='https://practice.example/editor';
const snapshot={value:'abc',start:1,end:1,direction:'forward',identity:['code','','textarea','code','token']};
function element(){return {value:'',checked:false,disabled:false,hidden:false,textContent:'',dataset:{},options:[],listeners:{},
 addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.options=[];},append(child){this.options.push(child);}};}
let sequence=0;
async function popup(config={}){
 const html=readFileSync(new URL('../extension/popup.html',import.meta.url),'utf8');
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element()]));
 nodes.mode.value='selection';nodes.preview.value='new';nodes.consent.checked=true;
 globalThis.document={getElementById:id=>nodes[id],createElement:()=>element()};
 const calls=[];
 const editor={target:0,label:'Code',kind:'textarea',characters:3,readOnly:false};
 const top={frameId:0,documentId:'top-doc',result:{ok:true,url:topUrl,frames:1,editors:config.topEditor?[{...editor,focused:config.topFocused}]:[]}};
 const child={frameId:7,documentId:'child-doc',result:{ok:true,url:childUrl,frames:0,editors:[{...editor,focused:config.childFocused}]}};
 globalThis.chrome={tabs:{query:async()=>[{id:1,url:topUrl}]},scripting:{executeScript:async input=>{
  calls.push(input);
  const {operation}=input.args[0];
  if(input.target.allFrames){
   if(config.denied)throw Error('Cannot access contents of frame');
   return config.frames?.(top,child)??[child,top]; // Chrome does not guarantee child order.
  }
  if(operation==='inspect')return [top];
  if(operation==='validate')return [{...top,documentId:config.reloaded?'replacement-top':'top-doc',result:config.blocked?{ok:false,error:'Assessment/proctoring pages are not supported.'}:{ok:true}}];
  const target=input.target.documentIds[0]==='top-doc'?top:child;
  if(config.navigated)return [{...target,documentId:'replacement-child',result:{ok:true,snapshot}}];
  if(config.removed)throw Error('No document with id child-doc');
  return [{...target,result:{ok:true,snapshot}}];
 }}};
 await import(`../extension/popup.mjs?frames=${++sequence}`);
 return {nodes,calls,click:id=>nodes[id].listeners.click()};
}
test('iframe-only editor supports inspection, import and undo pinned to its document and URL',async()=>{
 const {nodes,calls,click}=await popup();
 await click('inspect');assert.equal(nodes.insert.disabled,false);assert.match(nodes.target.options[0].textContent,/frame 7/);
 await click('insert');assert.equal(nodes.undo.disabled,false);
 await click('undo');assert.equal(nodes.undo.disabled,true);assert.match(nodes.status.textContent,/restored/);
 assert.equal(calls[1].target.allFrames,true);assert.equal(calls[1].args[0].discover,true);
 const actions=calls.filter(c=>['snapshot','insert','undo'].includes(c.args[0].operation));
 assert.deepEqual(actions.map(c=>c.args[0].operation),['snapshot','insert','undo']);
 for(const c of actions){assert.deepEqual(c.target,{tabId:1,documentIds:['child-doc']});assert.equal(c.args[0].approvedUrl,childUrl);assert.equal(c.args[0].target,0);}
 assert.equal(calls.filter(c=>c.args[0].operation==='validate').length,7);
 assert.equal(calls.filter(c=>c.args[0].operation==='verify').length,4);
});
test('duplicate editor ordinals in different frames are independently selectable',async()=>{
 const {nodes,calls,click}=await popup({topEditor:true,topFocused:true});
 await click('inspect');assert.equal(nodes.target.options.length,2);
 assert.equal(calls.at(-1).target.documentIds[0],'top-doc');
 nodes.target.value='1';await nodes.target.listeners.change();
 assert.equal(calls.at(-1).target.documentIds[0],'child-doc');
 await click('insert');assert.equal(calls.at(-1).target.documentIds[0],'child-doc');
});
test('focused child is selected instead of the first top-frame textarea',async()=>{
 const {nodes,calls,click}=await popup({topEditor:true,childFocused:true});
 await click('inspect');assert.equal(nodes.target.value,'1');
 assert.equal(calls.at(-1).target.documentIds[0],'child-doc');
 assert.equal(nodes.targetCode.value,snapshot.value);
 await click('insert');
 assert.equal(calls.find(call=>call.args[0].operation==='insert').target.documentIds[0],'child-doc');
});
test('ambiguous targets require an explicit choice rather than writing the first editor',async()=>{
 const {nodes,calls,click}=await popup({topEditor:true});
 await click('inspect');assert.equal(nodes.insert.disabled,true);assert.equal(nodes.target.disabled,false);
 assert.equal(nodes.targetCode.value,'');assert.match(nodes.status.textContent,/Multiple writable editors/);
 assert.equal(calls.filter(call=>call.args[0].operation==='snapshot').length,0);
 nodes.target.value='1';await nodes.target.listeners.change();
 assert.equal(nodes.insert.disabled,false);assert.equal(calls.at(-1).target.documentIds[0],'child-doc');
});
test('navigation, removed child and parent assessment changes disable writes without retargeting',async()=>{
 for(const flag of ['navigated','removed','reloaded','blocked']){
  const config={},p=await popup(config);await p.click('inspect');config[flag]=true;
  await p.click('insert');assert.equal(p.nodes.insert.disabled,true,flag);assert.equal(p.nodes.undo.disabled,true,flag);assert.equal(p.nodes.status.dataset.error,'true');
  if(['reloaded','blocked'].includes(flag))assert.equal(p.calls.filter(c=>c.args[0].operation==='insert').length,0);
 }
});
test('inaccessible frames give an actionable error, while an available top editor still works',async()=>{
 for(const topEditor of [false,true]){
  const {nodes,click}=await popup({denied:true,topEditor});await click('inspect');
  assert.match(nodes.status.textContent,/Cross-origin\/restricted frames/);assert.equal(nodes.insert.disabled,!topEditor);
 }
});
test('denied and cross-origin frame results are never offered',async()=>{
 const {nodes,click}=await popup({frames:(top,child)=>[top,{...child,result:{ok:false,error:'Page not approved.'}},{...child,frameId:8,result:{...child.result,url:'https://other.example/editor'}}]});
 await click('inspect');assert.equal(nodes.target.options.length,0);assert.equal(nodes.insert.disabled,true);assert.match(nodes.status.textContent,/No supported writable editor/);
});

function adapterPage(url=childUrl){
 delete globalThis.window;
 globalThis.location={href:url};
 globalThis.document={title:'Practice',querySelector:()=>null,querySelectorAll:()=>[]};
 globalThis.getComputedStyle=()=>({display:'block',visibility:'visible'});
}
const inspect=(extra={})=>pageEditor({operation:'inspect',approvedUrl:topUrl,discover:true,consent:true,...extra});
test('discovery allows same-origin frame URLs, never cross-origin, insecure or assessment URLs',()=>{
 adapterPage();assert.equal(inspect().ok,true);assert.equal(inspect().url,childUrl);
 assert.equal(inspect({discover:false}).ok,false);assert.equal(inspect({consent:false}).ok,false);
 for(const url of ['https://other.example/editor','http://practice.example/editor','https://practice.example/quiz/1','about:blank']){
  adapterPage(url);assert.equal(inspect().ok,false,url);
 }
 adapterPage();assert.equal(inspect({operation:'snapshot',target:0}).ok,false);
});
test('nested iframe visibility and ancestor assessment checks fail closed',()=>{
 adapterPage();
 const top={location:{href:topUrl},document:{title:'Practice',querySelector:()=>null}};top.top=top;
 const host={getClientRects:()=>[{width:600,height:400}],getAttribute:()=>null};
 const parent={top,parent:top,location:{href:'https://practice.example/container'},document:{title:'Practice',querySelector:()=>null},frameElement:host};
 globalThis.window={top,parent,frameElement:host};
 try{
  assert.equal(inspect().ok,true);
  parent.document.title='Proctored assessment';assert.equal(inspect().ok,false);
  parent.document.title='Practice';host.getClientRects=()=>[];assert.equal(inspect().ok,false);
  host.getClientRects=()=>[{width:600,height:400}];top.document.querySelector=()=>({});assert.equal(inspect().ok,false);
  top.document.querySelector=()=>null;window.frameElement=null;assert.equal(inspect().ok,false);
 }finally{delete globalThis.window;}
});
