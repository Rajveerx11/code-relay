import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {pageEditor} from '../extension/editor-adapter.mjs';
import {cm6Fake} from './cm6-fake.mjs';
const invoke=(operation,args={})=>pageEditor({operation,target:0,approvedUrl:location.href,consent:true,...args});
function setup(options){const fake=cm6Fake(options);globalThis.crypto ??= webcrypto;Object.assign(globalThis,{location:{href:'https://practice.example/editor'},document:fake.document,getComputedStyle:()=>({display:'block',visibility:'visible'})});return fake;}
test('CM6 markup with an accessible validated model is discovered (regression #12)',()=>{
 setup();const result=invoke('inspect');assert.equal(result.editors.length,1);assert.equal(result.editors[0].kind,'codemirror6');
});
for(const link of ['cmView','cmTile'])test(`${link}: canonical LF offsets, CRLF conversion, Unicode and backwards undo`,()=>{
 const f=setup({link,lineBreak:'\r\n'});f.view.set('a\n😀XYZ\nz',7,4);
 const before=invoke('snapshot').snapshot;
 const inserted=invoke('insert',{expected:before,text:'न\r\n👋\r!',mode:'selection'});
 assert.equal(inserted.ok,true,inserted.error);assert.equal(f.view.state.doc.toString(),'a\n😀न\n👋\n!\nz');
 assert.equal(inserted.snapshot.start,10);assert.equal(inserted.snapshot.end,10);
 const undo=invoke('undo',{expected:inserted.snapshot,restore:before});assert.equal(undo.ok,true,undo.error);
 assert.equal(f.view.writes,2,'one dispatch per insert/undo, including restored selection');
 assert.deepEqual(undo.snapshot,before);assert.equal(f.view.state.selection.ranges[0].anchor,7);assert.equal(f.view.state.selection.ranges[0].head,4);
});
test('CM6 validates API and DOM ownership, failing closed with a capability flag',()=>{
 for(const breakView of [f=>delete f.content.cmView,f=>f.view.constructor.findFromDOM=()=>null,
  f=>f.view.dom={},f=>f.view.contentDOM={},f=>f.content.cmTile={root:{view:{}}},
  f=>f.view.state.selection.ranges.push({...f.view.state.selection.ranges[0]}),
  f=>f.view.state.selection.ranges[0].anchor=-1,f=>f.view.state.readOnly=undefined,
  f=>f.view.state.facet=()=>undefined,f=>f.view.dispatch=null,f=>f.view.state.toText=null,
  f=>f.content.isConnected=false,f=>f.content.getClientRects=()=>[]]){
  const f=setup();breakView(f);const result=invoke('inspect');
  assert.equal(result.ok,true);assert.deepEqual(result.editors,[]);assert.equal(result.unsupportedCM6,true);assert.equal(f.view.writes,0);
 }
});
test('CM6 respects state and DOM readonly/disabled/editable flags',()=>{
 for(const block of [f=>f.view.state.readOnly=true,f=>f.view.state.facet=()=>false,
  f=>f.wrapper.disabled=true,f=>f.content.readOnly=true,
  f=>f.wrapper.hasAttribute=name=>name==='readonly',f=>f.content.hasAttribute=name=>name==='disabled',
  f=>f.wrapper.getAttribute=name=>name==='aria-disabled'?'true':null,
  f=>f.content.getAttribute=name=>name==='aria-readonly'?'true':null,
  f=>f.content.getAttribute=name=>name==='contenteditable'?'false':null]){
  const f=setup(),expected=invoke('snapshot').snapshot;block(f);
  assert.equal(invoke('inspect').editors[0].readOnly,true);
  assert.equal(invoke('insert',{expected,text:'X',mode:'selection'}).ok,false);assert.equal(f.view.writes,0);
 }
});
test('CM6 refuses effective DOM non-editability, including mixed-case or missing attributes',()=>{
 for(const link of ['cmView','cmTile'])for(const value of ['FALSE','False',null]){
  const f=setup({link}),expected=invoke('snapshot').snapshot;
  f.content.getAttribute=name=>name==='contenteditable'?value:null;
  assert.equal(f.content.isContentEditable,false);
  assert.equal(invoke('inspect').editors[0].readOnly,true);
  assert.equal(invoke('insert',{expected,text:'X',mode:'selection'}).ok,false);
  assert.equal(f.view.writes,0);
 }
});
test('CM6 stale view on the SAME DOM, content, selection and wrapper are refused',()=>{
 for(const change of [f=>f.replaceOwner(),f=>f.view.set('changed'),f=>f.view.set('abcXYZdef',3,6),
  f=>{const replacement={...f.content};f.wrapper.querySelectorAll=()=>[replacement];f.view.contentDOM=replacement;},
  f=>f.wrapper.id='different',f=>f.wrapper.isConnected=false]){
  const f=setup(),expected=invoke('snapshot').snapshot;change(f);
  assert.equal(invoke('insert',{expected,text:'X',mode:'selection'}).ok,false);assert.equal(f.view.writes,0);
 }
});
test('CM6 replace-all is confirmed separately; filtered writes have no retry or rollback',()=>{
 const f=setup(),expected=invoke('snapshot').snapshot;
 assert.equal(invoke('insert',{expected,text:'<script>x</script>',mode:'replace'}).ok,false);assert.equal(f.view.writes,0);
 assert.equal(invoke('insert',{expected,text:'<script>x</script>',mode:'replace',replaceConfirmed:true}).ok,true);
 assert.equal(f.view.state.doc.toString(),'<script>x</script>');assert.equal(f.view.writes,1);
 const g=setup(),before=invoke('snapshot').snapshot;g.view.dispatch=()=>{g.view.writes++;};
 const result=invoke('insert',{expected:before,text:'X',mode:'selection'});
 assert.equal(result.ok,false);assert.equal(result.mutationPossible,true);assert.equal(g.view.writes,1);
});
test('CM6 size/NUL and full-model snapshots are enforced',()=>{
 for(const text of ['','\0','x'.repeat(200001)]){
  const f=setup(),expected=invoke('snapshot').snapshot;
  assert.equal(invoke('insert',{expected,text,mode:'selection'}).ok,false);assert.equal(f.view.writes,0);
 }
 const f=setup();f.view.set('x'.repeat(200001),0,0);assert.equal(invoke('snapshot').ok,false);
});
