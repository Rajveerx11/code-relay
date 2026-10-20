// Test-only real libraries. Production has no dependency, CDN or global scan.
import {pageEditor} from '../extension/editor-adapter.mjs';
const versions=['6.36.5','6.41.0'];
const assert=(value,message)=>{if(!value)throw Error(message);};
const invoke=(operation,args={})=>pageEditor({operation,target:0,approvedUrl:location.href,consent:true,...args});
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
const until=async condition=>{const end=Date.now()+10000;while(!condition()){if(Date.now()>end)throw Error('Popup wait timed out');await pause();}};
window.runCM6Tests=async()=>{
 const results=[],fixture=document.getElementById('fixture');let views=[];
 const clear=()=>{for(const view of views)view.destroy();views=[];fixture.replaceChildren();document.getElementById('popup-host').replaceChildren();};
 for(const version of versions){
  const check=async(name,run)=>{try{clear();await run();results.push({version,name,ok:true});}catch(error){results.push({version,name,ok:false,error:error.message});}finally{clear();}};
  let EditorView,EditorState,EditorSelection;
  try{
   ({EditorView}=await import(`https://esm.sh/@codemirror/view@${version}?bundle&external=@codemirror/state`));
   ({EditorState,EditorSelection}=await import('https://esm.sh/@codemirror/state@6.6.0?bundle'));
  }catch(error){results.push({version,name:'pinned library load',ok:false,error:error.message});continue;}
  const create=(options={})=>{const view=new EditorView({parent:fixture,state:EditorState.create({doc:'abcXYZdef',selection:{anchor:6,head:3},...options})});views.push(view);return view;};
  const insert=expected=>invoke('insert',{expected,text:'न\r\n👋\r!',mode:'selection'});
  for(const separator of ['\n','\r\n'])await check(`model API, ${JSON.stringify(separator)} offsets, Unicode, backward undo`,()=>{
   const view=create({doc:['a','😀XYZ','z'].join(separator),selection:{anchor:7,head:4},extensions:EditorState.lineSeparator.of(separator)});
   assert(version==='6.36.5'?!!view.contentDOM.cmView:!!view.contentDOM.cmTile,'expected upstream DOM link missing');
   assert(invoke('inspect').editors[0]?.kind==='codemirror6','CM6 not discovered');
   const before=invoke('snapshot').snapshot,focus=document.activeElement,editable=view.contentDOM.getAttribute('contenteditable');
   let writes=0;const dispatch=view.dispatch;view.dispatch=(...args)=>{writes++;return dispatch(...args);};
   const inserted=insert(before);assert(inserted.ok,inserted.error);
   assert(view.state.doc.toString()==='a\n😀न\n👋\n!\nz' && view.state.selection.main.head===10,'model text/offset mismatch');
   assert(document.activeElement===focus && view.contentDOM.getAttribute('contenteditable')===editable,'focus/editability changed');
   const undo=invoke('undo',{expected:inserted.snapshot,restore:before});assert(undo.ok,undo.error);
   assert(view.state.doc.toString()===before.value && view.state.selection.main.anchor===7 && view.state.selection.main.head===4,'backwards selection not restored');
   assert(writes===2,'insert/undo must each use one dispatch');
  });
  for(const separator of ['\n','\r\n'])await check(`full replacement preserves exact formatting with ${JSON.stringify(separator)} and ignores partial selection`,()=>{
   const view=create({extensions:EditorState.lineSeparator.of(separator)}),before=invoke('snapshot').snapshot;
   const source='\tif (ready) {\r\n    run("न 👋");  \r\n\r\n}\r\n',expected=source.replace(/\r\n?/g,'\n');
   const result=invoke('insert',{expected:before,text:source,mode:'replace',replaceConfirmed:true});
   assert(result.ok,result.error);assert(view.state.doc.toString()===expected,'old text or changed formatting remains');
   assert(view.state.sliceDoc()===expected.replace(/\n/g,separator),'configured line endings changed');
   const undone=invoke('undo',{expected:result.snapshot,restore:before});
   assert(undone.ok && view.state.doc.toString()===before.value,'whole replacement undo failed');
   assert(view.state.selection.main.anchor===6 && view.state.selection.main.head===3,'backward selection lost');
  });
  await check('virtualized full model, not rendered lines',()=>{
   const text=Array.from({length:3000},(_,i)=>`line ${i} 😀`).join('\n'),view=create({doc:text,selection:{anchor:0}});
   const snap=invoke('snapshot');assert(snap.ok && snap.snapshot.value===text,'full model was not read');
   assert(view.contentDOM.textContent.length<text.length,'fixture did not virtualize');
   const result=invoke('insert',{expected:snap.snapshot,text:'tail',mode:'replace',replaceConfirmed:true});
   assert(result.ok && view.state.doc.toString()==='tail','replace-all did not use full model');
  });
  await check('multiple instances, explicit target, separately confirmed replace-all',()=>{
   const first=create(),second=create();assert(invoke('inspect').editors.length===2,'instances not enumerated');
   const expected=invoke('snapshot',{target:1}).snapshot;
   assert(!invoke('insert',{target:1,expected,text:'<b>literal</b>',mode:'replace'}).ok,'confirmation bypass');
   const result=invoke('insert',{target:1,expected,text:'<b>literal</b>',mode:'replace',replaceConfirmed:true});
   assert(result.ok && first.state.doc.toString()==='abcXYZdef' && second.state.doc.toString()==='<b>literal</b>','wrong target or text');
   assert(!second.contentDOM.querySelector('b'),'markup executed');
  });
  await check('multiple selections rejected',()=>{
   create({extensions:EditorState.allowMultipleSelections.of(true),selection:EditorSelection.create([EditorSelection.cursor(1),EditorSelection.cursor(5)])});
   const result=invoke('inspect');assert(!result.editors.length && result.unsupportedCM6,'ambiguous selection exposed');
  });
  await check('readOnly and editable facets independent, DOM flags enforced',()=>{
   for(const extensions of [EditorState.readOnly.of(true),EditorView.editable.of(false)]){
    clear();const view=create({extensions}),result=invoke('inspect');
    assert(result.editors[0]?.readOnly,'facet not enforced');assert(!invoke('snapshot').ok && view.state.doc.toString()==='abcXYZdef','read-only accepted');
   }
   for(const value of ['false','FALSE','False',null]){
    clear();const view=create(),expected=invoke('snapshot').snapshot;
    if(value===null)view.contentDOM.removeAttribute('contenteditable');
    else view.contentDOM.setAttribute('contenteditable',value);
    assert(!view.contentDOM.isContentEditable,'fixture must be effectively non-editable');
    assert(invoke('inspect').editors[0]?.readOnly,'effective DOM editability ignored');
    assert(!insert(expected).ok && view.state.doc.toString()==='abcXYZdef','non-editable content mutated');
   }
   for(const [node,attribute] of [['dom','aria-disabled'],['contentDOM','aria-readonly'],['dom','disabled'],['contentDOM','readonly']]){
    clear();const view=create(),expected=invoke('snapshot').snapshot;view[node].setAttribute(attribute,'true');
    assert(!insert(expected).ok && view.state.doc.toString()==='abcXYZdef','DOM flag ignored');
   }
  });
  await check('stale content, selection, node, order and inaccessible ownership fail closed',()=>{
   for(const change of ['content','selection','node','order','link','hidden']){
    clear();const view=create(),expected=invoke('snapshot').snapshot;
    if(change==='content')view.dispatch({changes:{from:0,to:3,insert:'NEW'}});
    if(change==='selection')view.dispatch({selection:{anchor:3,head:6}});
    if(change==='node'){view.destroy();views=[];fixture.replaceChildren();create();}
    if(change==='order'){const other=create();view.dom.before(other.dom);}
    if(change==='hidden')view.contentDOM.style.display='none';
    const key=version==='6.36.5'?'cmView':'cmTile',link=view.contentDOM[key];
    if(change==='link')delete view.contentDOM[key];
    const result=insert(expected);
    if(change==='link')view.contentDOM[key]=link; // Restore before library cleanup, not a production fallback.
    assert(!result.ok && !result.mutationPossible,`stale ${change} accepted`);
   }
  });
  await check('transaction filter rejects write, one dispatch, no rollback',()=>{
   const view=create({extensions:EditorState.changeFilter.of(()=>false)}),expected=invoke('snapshot').snapshot;
   let writes=0;const dispatch=view.dispatch;view.dispatch=(...args)=>{writes++;return dispatch(...args);};
   const result=insert(expected);assert(!result.ok && result.mutationPossible && writes===1,'filtered write not reported once');
   assert(view.state.doc.toString()==='abcXYZdef','filtered model changed');
  });
  const popup=async(resetSample=0)=>{
   const view=create(),calls=[];let verifications=0;
   window.sampleCode='\uFEFF\tif (ready) {\r\n    run("न 👋");  \r\n\r\n}\r\n';window.clipboardFails=false;
   const expected=window.sampleCode.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
   // Test bridge calls the actual adapter. Node tests separately serialize it
   // across contexts. This does NOT emulate Chrome permissions/document IDs.
   window.executeForTest=(_func,args)=>{
    const request=args[0],result=pageEditor(request);calls.push(request.operation);
    if(request.operation==='verify')verifications++;
    if((resetSample===1 && request.operation==='insert') || (resetSample===2 && request.operation==='verify' && verifications===1))
     queueMicrotask(()=>view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'site reset'}}));
    return {frameId:0,documentId:'cm6-test-document',result};
   };
   const response=await fetch('../extension/popup.html');assert(response.ok,'popup fixture load failed');
   const html=await response.text(),frame=document.createElement('iframe');frame.title='Test popup';
   const loaded=new Promise(resolve=>{frame.onload=resolve;});
   frame.srcdoc=html.replace('<head>','<head><base href="'+location.origin+'/extension/"><script src="../tests/bridge.js"><\/script>');
   document.getElementById('popup-host').append(frame);await loaded;
   const doc=frame.contentDocument,$=id=>doc.getElementById(id);
   await until(()=>$('inspect') && !$('inspect').disabled);
   assert($('mode').value==='replace' && !$('replaceRow').hidden && !$('replaceConfirmed').checked,'wrong production default');
   $('consent').click();$('inspect').click();await until(()=>$('target').options.length===1 && !$('inspect').disabled);
   $('readClipboard').click();await until(()=>$('preview').value===expected && !$('readClipboard').disabled);
   assert($('insert').disabled,'replacement confirmation missing');$('insert').click();
   assert(!calls.includes('insert') && view.state.doc.toString()==='abcXYZdef','unconfirmed mutation');
   $('replaceConfirmed').click();await until(()=>!$('insert').disabled);$('insert').click();await until(()=>!$('inspect').disabled);
   const report=$('diagnosticReport').textContent;
   assert(calls.filter(value=>value==='insert').length===1,'write retry');
   if(resetSample){
    assert($('status').dataset.error==='true' && $('undo').disabled,'reset reported success');
    assert(report.includes(`| verify-${resetSample} | failed | verification-failed |`),'wrong delayed check');
    assert(view.state.doc.toString()==='site reset' && verifications===resetSample,'rollback or wrong verification count');
   }else{
    assert(view.state.doc.toString()===expected && !$('undo').disabled,$('status').textContent);
    for(const sample of [1,2])assert(report.includes(`| verify-${sample} | success | completed |`),'missing delayed sample');
    $('undo').click();await until(()=>!$('inspect').disabled);
    assert(view.state.doc.toString()==='abcXYZdef' && view.state.selection.main.anchor===6 && view.state.selection.main.head===3,'popup undo failed');
    assert(calls.filter(value=>value==='verify').length===4,'undo not verified twice');
   }
   assert(!/abcXYZdef|न|localhost|127\.0\.0\.1/.test(report),'diagnostics leaked input or URL');
  };
  await check('real popup default full replacement, exact formatting, both delayed checks and backwards undo',()=>popup());
  for(const sample of [1,2])await check(`real popup bridge reset at delayed sample ${sample}, no retry`,()=>popup(sample));
 }
 document.getElementById('results').textContent=JSON.stringify(results,null,2);return results;
};
