// Unit tests with a deliberately small DOM fake. These do not claim browser/Chrome API coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
globalThis.crypto ??= webcrypto;
import {pageEditor} from '../extension/editor-adapter.mjs';
let el,marker=false;
function setup(){
 marker=false;globalThis.location={href:'https://practice.example/editor'};
 el={id:'code',value:'abcXYZdef',selectionStart:3,selectionEnd:6,selectionDirection:'forward',readOnly:false,disabled:false,maxLength:-1,
  matches:()=>false,classList:{contains:()=>false},getClientRects:()=>[{width:400,height:200}],closest:()=>null,getAttribute:()=>null,
  setRangeText(t,s,e){this.value=this.value.slice(0,s)+t+this.value.slice(e);this.selectionStart=this.selectionEnd=s+t.length;},
  setSelectionRange(s,e,d){this.selectionStart=s;this.selectionEnd=e;this.selectionDirection=d;},dispatchEvent(){this.events=(this.events||0)+1;}};
 globalThis.getComputedStyle=()=>({display:'block',visibility:'visible'});
 globalThis.document={title:'Practice editor',querySelector:()=>marker?{}:null,querySelectorAll:q=>q==='iframe, frame'?[]:[el]};
 return invoke('snapshot').snapshot;
}
const invoke=(operation,args={})=>pageEditor({operation,target:0,approvedUrl:location.href,consent:true,...args});
test('textarea selection replacement, Unicode, input notification, and undo',()=>{
 const before=setup(),text='\tनमस्ते 👋\n';
 const r=invoke('insert',{expected:before,text,mode:'selection'});
 assert.equal(r.ok,true);assert.equal(el.value,'abc'+text+'def');assert.equal(el.events,1);
 const undo=invoke('undo',{expected:r.snapshot,restore:before});assert.equal(undo.ok,true);
 assert.equal(el.value,before.value);assert.equal(el.selectionStart,3);assert.equal(el.selectionEnd,6);assert.equal(el.events,2);
});
test('replace-all requires confirmation and preserves literal markup',()=>{
 const expected=setup(),text='<img src=x onerror=alert(1)>';
 assert.equal(invoke('insert',{expected,text,mode:'replace'}).ok,false);assert.equal(el.value,expected.value);
 assert.equal(invoke('insert',{expected,text,mode:'replace',replaceConfirmed:true}).ok,true);assert.equal(el.value,text);
});
test('snapshot comparison survives Chrome reordering serialized object keys',()=>{
 const before=setup();
 // Chrome's extension boundary need not preserve JS object insertion order.
 const expected=JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(before).sort(([a],[b])=>a.localeCompare(b)))));
 assert.notEqual(JSON.stringify(expected),JSON.stringify(before));
 const inserted=invoke('insert',{expected,text:'new',mode:'selection'});
 assert.equal(inserted.ok,true,inserted.error);assert.equal(el.value,'abcnewdef');
 const undoExpected=Object.fromEntries(Object.entries(inserted.snapshot).reverse());
 const undone=invoke('undo',{expected:undoExpected,restore:expected});
 assert.equal(undone.ok,true,undone.error);assert.equal(el.value,before.value);
 assert.equal(el.selectionStart,before.start);assert.equal(el.selectionEnd,before.end);
});
test('stale content, selection bounds/direction and identity still fail with specific errors',()=>{
 for(const [reason,mutate] of [
  ['content',()=>el.value='changed'],['selection',()=>el.selectionStart=0],
  ['selection',()=>el.selectionEnd=7],['selection',()=>el.selectionDirection='backward'],
  ['identity',()=>el.id='other']
 ]){
  for(const operation of ['insert','undo']){
   const expected=setup();mutate();const current=el.value;
   const result=invoke(operation,{expected,restore:expected,text:'new',mode:'selection'});
   assert.equal(result.ok,false);assert.match(result.error,new RegExp(`Editor ${reason} changed`));
   assert.equal(result.mutationPossible,false);assert.equal(el.value,current);
  }
 }
});
test('missing snapshot fields are rejected rather than silently refreshed',()=>{
 for(const field of ['value','start','end','direction','identity']){
  const expected=setup(),value=el.value;delete expected[field];
  const result=invoke('insert',{expected,text:'new',mode:'selection'});
  assert.equal(result.ok,false,field);assert.equal(result.mutationPossible,false);assert.equal(el.value,value);
 }
});
test('readonly, disabled, max-length, NUL, empty and oversized inputs are refused',()=>{
 for(const prop of ['readOnly','disabled']){const expected=setup();el[prop]=true;assert.equal(invoke('insert',{expected,text:'new',mode:'selection'}).ok,false);}
 for(const text of ['', '\0','x'.repeat(200001)]){const expected=setup();assert.equal(invoke('insert',{expected,text,mode:'selection'}).ok,false);assert.equal(el.value,expected.value);}
 const expected=setup();el.maxLength=9;assert.equal(invoke('insert',{expected,text:'too long',mode:'selection'}).ok,false);
});
test('exact URL, consent, secure scope and assessment marker are required',()=>{
 setup();assert.equal(invoke('inspect',{consent:false}).ok,false);assert.equal(invoke('inspect',{approvedUrl:'https://other.example/'}).ok,false);
 marker=true;assert.equal(invoke('inspect').ok,false);marker=false;
 for(const url of ['chrome://settings','http://example.com/editor','https://practice.example/exam/1']){location.href=url;assert.equal(invoke('inspect').ok,false);}
});
test('hidden and custom-editor internal textareas are not offered',()=>{
 setup();el.getClientRects=()=>[];assert.equal(invoke('inspect').editors.length,0);
 setup();el.closest=()=>({});assert.equal(invoke('inspect').editors.length,0);
});
test('invisible helper fields and transparent ancestors are excluded',()=>{
 setup();getComputedStyle=()=>({display:'block',visibility:'visible',opacity:'0'});
 assert.equal(invoke('inspect').editors.length,0);
 setup();el.getClientRects=()=>[{width:0,height:20}];assert.equal(invoke('inspect').editors.length,0);
 setup();el.getAttribute=name=>name==='aria-hidden'?'true':null;assert.equal(invoke('inspect').editors.length,0);
 setup();el.parentElement={hidden:true,getAttribute:()=>null};assert.equal(invoke('inspect').editors.length,0);
 setup();el.matches=selector=>selector.includes('.ace_text-input');assert.equal(invoke('inspect').editors.length,0);
});
test('inspection identifies the focused textarea, including when another field comes first',()=>{
 setup();const other={...el,id:'other'};document.activeElement=el;
 document.querySelectorAll=selector=>selector==='iframe, frame'?[]:[other,el];
 const result=invoke('inspect');assert.equal(result.editors[0].focused,false);assert.equal(result.editors[1].focused,true);
});
test('read-only verification accepts cursor movement but refuses changed content or identity',()=>{
 const expected=setup();el.selectionStart=0;
 const verified=invoke('verify',{expected});assert.equal(verified.ok,true);assert.equal(el.events,undefined);
 el.value='reset';assert.equal(invoke('verify',{expected}).ok,false);
 el.value=expected.value;el={...el};assert.equal(invoke('verify',{expected}).ok,false);
});
test('application rejecting an import is reported, with no automatic retry',()=>{
 const expected=setup();el.dispatchEvent=()=>{el.value='application reset';};
 const r=invoke('insert',{expected,text:'new',mode:'selection'});assert.equal(r.ok,false);assert.equal(r.mutationPossible,true);assert.match(r.error,/changed or rejected/);assert.equal(el.value,'application reset');
});

test('replaced or reordered identical-looking editor is refused by node identity',()=>{
 for(const change of ['replace','reorder']){
  const expected=setup(), original=el;
  // Like cloneNode, this copies visible fields but not non-enumerable identity.
  el={...original};
  assert.equal(Object.getOwnPropertySymbols(el).length,0);
  const r=invoke('insert',{expected,text:'X',mode:'selection'});
  assert.equal(r.ok,false,change);assert.equal(el.value,expected.value);assert.equal(original.value,expected.value);
 }
});
test('textarea disabled by ancestor fieldset is refused',()=>{
 const expected=setup();el.matches=selector=>selector===':disabled';
 assert.equal(el.disabled,false);
 assert.equal(invoke('inspect').editors[0].readOnly,true);
 assert.equal(invoke('insert',{expected,text:'X',mode:'selection'}).ok,false);assert.equal(el.value,expected.value);
});

test('throw after attempted mutation reports possible change without automatic rollback',()=>{
 const expected=setup();el.setRangeText=()=>{el.value='partly changed';throw Error('site failure');};
 const r=invoke('insert',{expected,text:'new',mode:'selection'});
 assert.equal(r.ok,false);assert.equal(r.mutationPossible,true);assert.match(r.error,/may have changed/);assert.equal(el.value,'partly changed');
});
