import {pageEditor} from '../extension/editor-adapter.mjs';
export function runSafetyTests(){
const results=[];const fixture=document.getElementById('fixture');
const invoke=(operation,args={})=>pageEditor({operation,approvedUrl:location.href,consent:true,...args});
const check=(name,run)=>{try{run();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}};
const setup=()=>{fixture.innerHTML='<textarea id="qa-target">abcXYZdef</textarea>';const el=fixture.querySelector('textarea');el.setSelectionRange(3,6);const info=invoke('inspect');return {el,snap:invoke('snapshot',{target:info.editors[0].target})};};
const assert=(v,msg)=>{if(!v)throw Error(msg);};
check('reject changed content without overwriting',()=>{const {el,snap}=setup();el.value='edited';const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text:'new',mode:'selection'});assert(!r.ok&&el.value==='edited','stale write allowed');});
check('replace all requires separate confirmation',()=>{const {el,snap}=setup();const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text:'new',mode:'replace'});assert(!r.ok&&el.value==='abcXYZdef','replacement without confirmation');});
check('confirmed replace all inserts literal markup',()=>{const {el,snap}=setup();const text='<img src=x onerror="window.importQA=true">';const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text,mode:'replace',replaceConfirmed:true});assert(r.ok&&el.value===text&&!window.importQA,'text not literal');});
check('read-only and disabled protection',()=>{for(const key of ['readOnly','disabled']){const {el,snap}=setup();el[key]=true;const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text:'new',mode:'selection'});assert(!r.ok&&el.value==='abcXYZdef','readonly mutation');}});
check('textarea length limit protection',()=>{const {el,snap}=setup();el.maxLength=9;const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text:'longer text',mode:'selection'});assert(!r.ok&&el.value==='abcXYZdef','length limit ignored');});
check('exact URL and consent required',()=>{setup();assert(!invoke('inspect',{approvedUrl:'https://different.example/practice'}).ok,'URL not checked');assert(!invoke('inspect',{consent:false}).ok,'consent not checked');});
check('unsupported custom editor hidden inputs excluded',()=>{fixture.innerHTML='<div class="monaco-editor"><textarea>hidden implementation input</textarea></div>';assert(invoke('inspect').editors.length===0,'Monaco internal textarea exposed');});
check('hidden textarea excluded',()=>{fixture.innerHTML='<textarea style="display:none">abc</textarea>';assert(invoke('inspect').editors.length===0,'hidden element discovered');});
check('assessment marker rejected',()=>{fixture.innerHTML='<textarea>abc</textarea><div data-assessment="true"></div>';assert(!invoke('inspect').ok,'assessment marker ignored');});
check('iframe not guessed as top-frame editor',()=>{fixture.innerHTML='<iframe srcdoc="<textarea>abc</textarea>"></iframe>';const r=invoke('inspect');assert(r.ok&&r.frames===1&&r.editors.length===0,'iframe scope guessed');});
check('identical replacement node is refused',()=>{const {el,snap}=setup();const clone=el.cloneNode(true);clone.value=el.value;clone.setSelectionRange(el.selectionStart,el.selectionEnd,el.selectionDirection);el.replaceWith(clone);const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text:'X',mode:'selection'});assert(!r.ok&&clone.value===snap.snapshot.value,'uninspected clone mutated');});
check('identical inserted editor changes ordinal and is refused',()=>{const {el,snap}=setup();const clone=el.cloneNode(true);clone.value=el.value;clone.setSelectionRange(el.selectionStart,el.selectionEnd,el.selectionDirection);el.before(clone);const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text:'X',mode:'selection'});assert(!r.ok&&clone.value===snap.snapshot.value&&el.value===snap.snapshot.value,'uninspected reordered editor mutated');});
check('disabled ancestor fieldset is refused',()=>{const {el,snap}=setup();const fieldset=document.createElement('fieldset');fieldset.disabled=true;el.replaceWith(fieldset);fieldset.append(el);const r=invoke('insert',{target:snap.target,expected:snap.snapshot,text:'X',mode:'selection'});assert(!r.ok&&el.value===snap.snapshot.value,'fieldset-disabled textarea mutated');});
fixture.innerHTML='';document.getElementById('results').textContent=JSON.stringify(results,null,2);return results;
}
window.runSafetyTests=runSafetyTests;
