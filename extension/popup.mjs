import {validateScope} from './core.mjs';
import {pageEditor} from './editor-adapter.mjs';
import {createDiagnostics,exportDiagnostics} from './diagnostics.mjs';
const $=id=>document.getElementById(id);
const diagnostics=createDiagnostics();
const failures=new WeakMap();
function failure(message,category='unexpected'){
  const error=new Error(message);failures.set(error,{message,category});return error;
}
function failureInfo(error){return failures.get(error)||{message:'Operation failed. Check the page and inspect again.',category:'unexpected'};}
function diagnosticStatus(message){try{$('diagnosticStatus').textContent=message;}catch{}}
function renderDiagnostics(){
  try{$('diagnosticReport').textContent=diagnostics.serialize();}
  catch{diagnosticStatus('Diagnostics display unavailable. Normal actions are still available.');}
}
function record(action,status,category){
  if(action===null)return;
  try{diagnostics.record(action,status,category);renderDiagnostics();}
  catch{diagnosticStatus('Diagnostics unavailable. Normal actions are still available.');}
}
// Never read error events, rejection reasons, URLs or stacks. Reporting is
// synchronous and contained, so a diagnostic failure cannot report itself.
globalThis.addEventListener?.('error',()=>record('runtime','failed','unexpected'));
globalThis.addEventListener?.('unhandledrejection',()=>record('runtime','failed','unexpected'));
$('clearDiagnostics').addEventListener('click',()=>{
  try{diagnostics.clear();renderDiagnostics();diagnosticStatus('Log cleared.');}
  catch{diagnosticStatus('Diagnostics unavailable.');}
});
$('exportDiagnostics').addEventListener('click',()=>{
  if(exportDiagnostics(diagnostics))diagnosticStatus('Download requested. Check your browser downloads.');
  else{record('export','failed','export-failed');diagnosticStatus('Report download could not be requested.');}
});
renderDiagnostics();
// Adapter errors cross the page boundary. Preserve only known fixed messages
// for the existing workflow status; arbitrary page/Chrome exceptions stay generic.
const adapterMessages=new Set([
  "Page not approved. Inspect the current practice page again.",
  "Assessment/proctoring pages are not supported.",
  "Embedded editor frame is hidden or inaccessible.",
  "Assessment/proctoring or inaccessible parent pages are not supported.",
  "Editor is unavailable. Inspect again.",
  "Editor is read-only or disabled; nothing changed.",
  "Editor is too large for the 200,000-character V1 limit.",
  "The page reset or changed the imported code after the write.",
  "Editor content changed since inspection. Inspect again; nothing overwritten.",
  "The page replaced or changed the selected editor after the write.",
  "Editor identity changed since inspection. Inspect again; nothing overwritten.",
  "Editor selection changed since inspection. Set the cursor and inspect again; nothing overwritten.",
  "Code is empty, too large or contains a NUL character.",
  "Invalid insertion mode.",
  "Confirm replacing the entire editor first.",
  "Result exceeds the editor size limit.",
  "Undo backup is invalid.",
  "The application changed or rejected the imported value after insertion. The editor may have changed; inspect it again. No automatic rollback was performed.",
  "Editor operation failed after a change was attempted. The editor may have changed; inspect it again. No automatic rollback was performed.",
  "Editor operation failed. Inspect again and check the page; no automatic retries are performed.",
]);
const state={tab:null,topDocumentId:null,selected:null,editors:[],snapshot:null,target:null,undo:null,busy:false};
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function update(){
  const text=$('preview').value;
  $('count').textContent=`${text.length.toLocaleString()} characters`;
  $('replaceRow').hidden=$('mode').value!=='replace';
  for(const id of ['inspect','readClipboard','file','clear','consent','mode','replaceConfirmed','preview']) $(id).disabled=state.busy;
  $('target').disabled=state.busy||!state.editors.length;
  $('insert').disabled=state.busy||!state.snapshot||!$('consent').checked||!text.length||text.length>200000||($('mode').value==='replace'&&!$('replaceConfirmed').checked);
  $('undo').disabled=state.busy||!state.undo||!$('consent').checked;
}
function resetTarget(){state.snapshot=null;state.target=null;state.topDocumentId=null;state.selected=null;state.editors=[];state.undo=null;$('target').replaceChildren();$('targetCode').value='';update();}
function showSnapshot(snapshot){state.snapshot=snapshot;$('targetCode').value=snapshot.value.slice(0,1000);}
function targetName(){return `${state.selected.label} (${state.selected.kind}, ${state.selected.frameId===0?'main page':`frame ${state.selected.frameId}`})`;}
function clean(text){
  if(typeof text!=='string')throw failure('Input is not text.','input-invalid');
  text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(!text.length||text.length>200000||text.includes('\0'))throw failure('Use non-empty text, at most 200,000 characters, without NUL bytes.','input-invalid');
  return text;
}
async function guarded(name,action){
  if(state.busy)return;state.busy=true;update();record(name,'started','started');
  try{const outcome=await action();record(name,outcome?.status||'success',outcome?.category||'completed');}
  catch(error){const info=failureInfo(error);record(name,'failed',info.category);status(info.message,true);}
  finally{state.busy=false;update();}
}
async function active(){
  if(!globalThis.chrome?.tabs)throw failure('Load the extension in Chrome to use this popup.');
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!tab.url)throw failure('This tab cannot be accessed. Open a regular practice page and click the extension icon.','scope');
  return tab;
}
async function approvedTab(){
  const tab=await active();
  if(!state.tab||tab.id!==state.tab.id)throw failure('Active tab changed. Inspect this page again.','scope');
  const scope=validateScope(tab.url,state.tab.url,$('consent').checked);if(!scope.ok)throw failure(scope.error,'scope');
  return tab;
}
function execute(target,operation,approvedUrl,args={}){
  return chrome.scripting.executeScript({target,world:'MAIN',func:pageEditor,args:[{...args,operation,approvedUrl,consent:$('consent').checked}]});
}
function checkedFrame(response,frameId,documentId){
  const frame=response.find(x=>x.frameId===frameId&&(!documentId||x.documentId===documentId));
  if(!frame?.result)throw failure('The selected page/frame is unavailable or navigated. Inspect again.','target-unavailable');
  if(!frame.result.ok){
    const partial=frame.result.mutationPossible===true;
    let message='Editor operation failed. Check the page and inspect again.';
    if(partial)message='A change was attempted. The editor may have changed; inspect it again. No automatic retry or rollback was performed.';
    if(adapterMessages.has(frame.result.error))message=frame.result.error;
    throw failure(message,partial?'partial-write':'editor-rejected');
  }
  if(!frame.documentId)throw failure('Browser did not provide a document identity. Use Chrome 106 or later.','target-unavailable');
  return frame;
}
async function invoke(operation,args={}){
  try{
    const tab=await approvedTab(),selected=state.selected;
    if(!selected||!state.topDocumentId)throw failure('Inspect and select an editor first.','target-unavailable');
    // A child must not bypass checks on the enclosing page, including same-URL reloads.
    checkedFrame(await execute({tabId:tab.id,documentIds:[state.topDocumentId]},'validate',state.tab.url),0,state.topDocumentId);
    const response=await execute({tabId:tab.id,documentIds:[selected.documentId]},operation,selected.url,args);
    return checkedFrame(response,selected.frameId,selected.documentId).result;
  }catch(error){
    // Navigation, stale snapshots and partial writes all invalidate Import/Undo.
    resetTarget();throw error;
  }
}
async function selectEditor(index){
  record('target','started','started');
  try{
    state.undo=null;state.snapshot=null;state.selected=state.editors[index];
    state.target=state.selected?.target;
    const read=await invoke('snapshot',{target:state.target});showSnapshot(read.snapshot);
    record('target','success','completed');
  }catch(error){record('target','failed',failureInfo(error).category);throw error;}
}
async function verifyWrite(snapshot){
  status('Write attempted. Checking that the selected editor keeps the new code…');
  try{
    let result;
    // Sample after the site's input handlers/render cycle and again after common
    // debounced resets. These are read-only checks, never write retries.
    for(const [index,delay] of [150,600].entries()){
      const action=index===0?'verify-1':'verify-2';
      record(action,'started','started');
      try{
        await new Promise(resolve=>setTimeout(resolve,delay));
        result=await invoke('verify',{target:state.target,expected:snapshot});
        record(action,'success','completed');
      }catch(error){record(action,'failed','verification-failed');throw error;}
    }
    return result.snapshot;
  }catch(error){
    resetTarget();
    throw failure(`The write was attempted, but the live editor did not pass verification. ${failureInfo(error).message} Check the page and inspect again. No automatic retry or rollback was performed.`,'verification-failed');
  }
}
$('inspect').addEventListener('click',()=>guarded('inspect',async()=>{
  resetTarget();state.tab=await active();
  const tab=await approvedTab();
  const top=checkedFrame(await execute({tabId:tab.id,frameIds:[0]},'inspect',state.tab.url),0);
  state.topDocumentId=top.documentId;
  let frames=[top],warning='';
  if(top.result.frames){
    try{
      frames=await execute({tabId:tab.id,allFrames:true},'inspect',state.tab.url,{discover:true});
    }catch{
      // Chrome can refuse a frame injection. Preserve the known top-frame result,
      // never retry a write or request broad host permissions automatically.
      warning=' Chrome could not inspect embedded frames. Cross-origin/restricted frames require separate site access and are not supported by this build.';
      frames=[top];
    }
    checkedFrame(frames,0,state.topDocumentId);
    if(frames.some(frame=>!frame.result?.ok)||frames.length===1)
      warning ||= ' Some embedded frames are inaccessible, restricted, or not approved. Cross-origin frames are not supported by this build.';
  }
  frames.sort((a,b)=>a.frameId-b.frameId);
  for(const frame of frames){
    if(!frame.result?.ok||!frame.documentId)continue;
    const url=frame.result.url;
    if(!url||new URL(url).origin!==new URL(state.tab.url).origin)continue;
    for(const editor of frame.result.editors){
      const index=state.editors.length;
      state.editors.push({...editor,frameId:frame.frameId,documentId:frame.documentId,url});
      const option=document.createElement('option');option.value=String(index);
      option.textContent=`${editor.label} · ${editor.kind} · ${editor.characters} chars · ${frame.frameId===0?'main page':`frame ${frame.frameId}: ${new URL(url).pathname}`}${editor.focused?' · focused':''}${editor.readOnly?' · read-only':''}`;
      option.disabled=editor.readOnly;$('target').append(option);
    }
  }
  if(warning)record('inspect','warning','frames-unavailable');
  const unsupportedCM6=frames.some(frame=>frame.result?.ok && frame.result.unsupportedCM6===true);
  if(unsupportedCM6){
    record('inspect','warning','cm6-unavailable');
    warning+=' CodeMirror 6 markup detected, but its view or single selection could not be validated. Use one selection in a visible permitted practice editor and inspect again. Private or incompatible instances are unsupported; ask the site for an approved import method.';
  }
  const writable=state.editors.map((editor,index)=>({...editor,index})).filter(editor=>!editor.readOnly);
  if(!writable.length)throw failure('No supported writable editor found in the main page or accessible same-origin frames. Supported: textareas, exposed Ace and validated CodeMirror 6 editors. Monaco, CodeMirror 5 and private/incompatible instances are unsupported.'+warning,unsupportedCM6?'cm6-unavailable':'target-unavailable');
  const focused=writable.filter(editor=>editor.focused);
  const candidate=focused.length===1?focused[0]:writable.length===1?writable[0]:null;
  if(!candidate){
    const option=document.createElement('option');option.value='';option.textContent='Choose the code editor — multiple targets found';option.disabled=true;$('target').append(option);$('target').value='';
    status('Multiple writable editors found. Choose your code editor from Target editor and check its current contents before importing.'+warning);return {status:'warning',category:'target-choice'};
  }
  $('target').value=String(candidate.index);await selectEditor(candidate.index);
  status(`Selected ${targetName()}. Check Target contents below before importing.${warning}`);
  if(warning)return {status:'warning',category:unsupportedCM6?'cm6-unavailable':'frames-unavailable'};
}));
$('target').addEventListener('change',()=>guarded(null,async()=>{
  if($('target').value==='')return;
  await selectEditor(Number($('target').value));status(`Selected ${targetName()}. Check Target contents below before importing.`);
}));
$('readClipboard').addEventListener('click',()=>guarded('clipboard',async()=>{
  try{
    // Request immediately in the button's gesture. Already-granted permission needs no new prompt.
    if(!await chrome.permissions.request({permissions:['clipboardRead']}))throw failure('Permission denied');
    const text=clean(await navigator.clipboard.readText());$('preview').value=text;status('Clipboard loaded into the preview only. Nothing has been inserted.');
  }catch{throw failure('Clipboard access failed or its text is invalid. Use the saved-file input or paste into the preview instead.','clipboard-access');}
}));
$('file').addEventListener('change',()=>guarded('file',async()=>{
  const file=$('file').files[0];if(!file)return {status:'cancelled',category:'cancelled'};
  if(file.size>800000)throw failure('File is too large. Maximum UTF-8 file size: 800,000 bytes.','input-invalid');
  let decoded;
  try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}
  catch{throw failure('File could not be read as UTF-8. Resave it as UTF-8 and try again.','file-read');}
  const text=clean(decoded);
  $('preview').value=text;status('UTF-8 file loaded into the preview. Line endings normalized; nothing inserted yet.');
}));
$('insert').addEventListener('click',()=>guarded('import',async()=>{
  if(!state.snapshot)throw failure('Inspect the editor first.','target-unavailable');
  const text=clean($('preview').value);$('preview').value=text;
  const before=state.snapshot;
  const result=await invoke('insert',{target:state.target,expected:before,text,mode:$('mode').value,replaceConfirmed:$('replaceConfirmed').checked});
  const verified=await verifyWrite(result.snapshot);
  state.undo={restore:before,expected:verified};showSnapshot(verified);
  status(`Code read back from ${targetName()} after two delayed checks. Confirm the change on the page. Keep this popup open for Undo. Later site changes and saving/submission are not verified.`);
}));
$('undo').addEventListener('click',()=>guarded('undo',async()=>{
  if(!state.undo)throw failure('No temporary undo backup.','target-unavailable');
  const result=await invoke('undo',{target:state.target,...state.undo});
  const verified=await verifyWrite(result.snapshot);showSnapshot(verified);state.undo=null;
  status(`Previous code restored in ${targetName()} and checked again. Confirm the change on the page.`);
}));
$('clear').addEventListener('click',()=>{$('preview').value='';$('file').value='';resetTarget();status('Code and temporary backup cleared. Inspect again before importing.');});
$('consent').addEventListener('change',()=>{resetTarget();status('Inspect the permitted practice page to continue.');});
for(const id of ['preview','mode','replaceConfirmed'])$(id).addEventListener('input',update);
update();
active().then(tab=>{const url=new URL(tab.url);$('page').textContent=`Current page: ${url.origin}${url.pathname}`;}).catch(()=>{record('runtime','warning','scope');});
