// Run the real popup and serialized adapter in separate JS contexts. The DOM,
// Ace instance and Chrome transport are fakes, not live browser verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {cm6Fake} from './cm6-fake.mjs';

function transport(value){
 if(Array.isArray(value))return value.map(transport);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,transport(value[key])]));
 return value;
}
function element(){return {value:'',checked:false,disabled:false,hidden:false,textContent:'',dataset:{},options:[],listeners:{},
 addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.options=[];},append(child){this.options.push(child);}};}
function page(kind){
 if(kind==='codemirror6'){
  const fake=cm6Fake({link:'cmTile'});fake.view.set('abcXYZdef',3,6);
  const node={get value(){return fake.view.state.doc.toString();},set value(value){fake.view.set(value,0,0);},
   get selectionStart(){return fake.view.state.selection.ranges[0].from;},get selectionEnd(){return fake.view.state.selection.ranges[0].to;}};
  const context=createContext({URL,crypto:webcrypto,Event,location:{href:'https://practice.example/editor'},document:fake.document,
   getComputedStyle:()=>({display:'block',visibility:'visible'})});
  return {node,context,fake};
 }
 const node={id:'code',value:'abcXYZdef',selectionStart:3,selectionEnd:6,selectionDirection:'forward',maxLength:-1,
  classList:{contains:cls=>kind==='ace'&&cls==='ace_editor'},getClientRects:()=>[{width:400,height:200}],closest:()=>null,getAttribute:()=>null,matches:()=>false,
  setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start+text.length;},
  setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;},dispatchEvent(){}};
 if(kind==='ace'){
  class Range {constructor(sr,sc,er,ec){this.start={row:sr,column:sc};this.end={row:er,column:ec};}}
  const doc={positionToIndex:({row,column})=>node.value.split('\n').slice(0,row).reduce((n,line)=>n+line.length+1,0)+column,
   indexToPosition:index=>{const lines=node.value.slice(0,index).split('\n');return {row:lines.length-1,column:lines.at(-1).length};},getNewLineCharacter:()=> '\n'};
  const editor={getReadOnly:()=>false,getValue:()=>node.value,
   getSelectionRange:()=>{const a=doc.indexToPosition(node.selectionStart),b=doc.indexToPosition(node.selectionEnd);return new Range(a.row,a.column,b.row,b.column);},
   selection:{isBackwards:()=>node.selectionDirection==='backward',setSelectionRange:(r,backwards=false)=>node.setSelectionRange(doc.positionToIndex(r.start),doc.positionToIndex(r.end),backwards?'backward':'forward')},
   session:{doc,markUndoGroup(){},replace:(range,text)=>{node.setRangeText(text,doc.positionToIndex(range.start),doc.positionToIndex(range.end));return doc.indexToPosition(node.selectionEnd);}}};
  node.env={editor};
 }
 const context=createContext({URL,crypto:webcrypto,Event,location:{href:'https://practice.example/editor'},
  document:{title:'Practice',querySelector:()=>null,querySelectorAll:selector=>selector==='iframe, frame'?[]:[node]},
  getComputedStyle:()=>({display:'block',visibility:'visible'})});
 return {node,context};
}
let popupSequence=0;
async function popup(kind,onResult=()=>{}){
 const {node,context,fake}=page(kind);
 const html=readFileSync(new URL('../extension/popup.html',import.meta.url),'utf8');
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element()]));
 nodes.mode.value='selection';nodes.preview.value='new\nनमस्ते';nodes.consent.checked=true;
 globalThis.document={getElementById:id=>nodes[id],createElement:()=>element()};
 const calls=[];
 globalThis.chrome={tabs:{query:async()=>[{id:1,url:'https://practice.example/editor'}]},scripting:{executeScript:async input=>{
  calls.push(input);
  context.request=JSON.parse(JSON.stringify(transport(input.args[0])));
  const result=runInContext(`(${input.func.toString()})(request)`,context);
  onResult({node,context,fake,operation:input.args[0].operation,result});
  return JSON.parse(JSON.stringify(transport([{frameId:0,documentId:'doc-1',result}])));
 }}};
 await import(`../extension/popup.mjs?roundtrip=${++popupSequence}`);
 return {node,context,nodes,calls,click:id=>nodes[id].listeners.click()};
}
for(const kind of ['textarea','ace','codemirror6'])test(`${kind}: real popup/adapter import and undo survive sorted transport keys`,async()=>{
 const {node,nodes,calls,click}=await popup(kind);
 await click('inspect');assert.equal(nodes.insert.disabled,false,nodes.status.textContent);
 await click('insert');assert.equal(nodes.status.dataset.error,'false',nodes.status.textContent);
 assert.equal(node.value,'abcnew\nनमस्तेdef');assert.equal(nodes.undo.disabled,false);
 await click('undo');assert.equal(node.value,'abcXYZdef');assert.equal(node.selectionStart,3);assert.equal(node.selectionEnd,6);
 assert.equal(nodes.status.dataset.error,'false',nodes.status.textContent);
 for(const action of ['import','verify-1','verify-2','undo'])assert.ok(nodes.diagnosticReport.textContent.includes(`| ${action} | success | completed |`));
 assert.doesNotMatch(nodes.diagnosticReport.textContent,/abcXYZdef|नमस्ते|practice\.example|token/);
 assert.equal(calls.filter(call=>call.args[0].operation==='insert').length,1);
 // Real changes must still fail and clear stale popup actions after the fix.
 node.value='changed by site';await click('insert');
 assert.equal(node.value,'changed by site');assert.match(nodes.status.textContent,/Editor content changed/);
 assert.equal(nodes.insert.disabled,true);assert.equal(nodes.undo.disabled,true);
});
for(const failure of ['reset','replace','hide'])test(`does not report success when the page ${failure}s the editor after a write`,async()=>{
 const {node,nodes,calls,click}=await popup('textarea',({node,context,operation})=>{
  if(operation!=='insert')return;
  queueMicrotask(()=>{
   if(failure==='reset')node.value='abcXYZdef';
   if(failure==='replace'){
    const replacement={...node,value:'abcXYZdef'};
    context.document.querySelectorAll=selector=>selector==='iframe, frame'?[]:[replacement];
   }
   if(failure==='hide')node.getClientRects=()=>[];
  });
 });
 await click('inspect');await click('insert');
 assert.equal(nodes.status.dataset.error,'true',nodes.status.textContent);
 assert.doesNotMatch(nodes.status.textContent,/Code imported/);
 assert.match(nodes.diagnosticReport.textContent,/\| verify-1 \| failed \| verification-failed \|/);
 assert.match(nodes.diagnosticReport.textContent,/\| import \| failed \| verification-failed \|/);
 assert.doesNotMatch(nodes.diagnosticReport.textContent,/\| import \| success \|/);
 assert.equal(nodes.insert.disabled,true);assert.equal(nodes.undo.disabled,true);
 assert.equal(calls.filter(c=>c.args[0].operation==='insert').length,1,'no retry or rollback');
 if(failure==='reset')assert.equal(node.value,'abcXYZdef');
});
for(const sample of [1,2])test(`CM6 popup delayed sample ${sample} detects a site reset without retry/rollback`,async()=>{
 let checks=0,writes=0;
 const {nodes,calls,click}=await popup('codemirror6',({fake,operation})=>{
  if(operation==='insert'){writes++;if(sample===1)fake.view.set('reset by site',0,0);}
  if(operation==='verify' && ++checks===1 && sample===2)fake.view.set('reset by site',0,0);
 });
 await click('inspect');await click('insert');
 assert.equal(nodes.status.dataset.error,'true');assert.equal(writes,1);
 assert.ok(nodes.diagnosticReport.textContent.includes(`| verify-${sample} | failed | verification-failed |`));
 assert.equal(calls.filter(c=>c.args[0].operation==='verify').length,sample);
 assert.equal(nodes.undo.disabled,true);
});
test('CM6 unsupported capability is actionable and diagnostics contain fixed vocabulary only',async()=>{
 const {nodes,click}=await popup('codemirror6',({fake,operation,result})=>{
  if(operation==='inspect'){delete fake.content.cmTile;result.editors=[];result.unsupportedCM6=true;}
 });
 await click('inspect');assert.match(nodes.status.textContent,/CodeMirror 6 markup detected/);
 assert.match(nodes.diagnosticReport.textContent,/cm6-unavailable/);
 assert.doesNotMatch(nodes.diagnosticReport.textContent,/abcXYZdef|practice\.example|cmTile/);
 assert.equal(nodes.insert.disabled,true);
});
