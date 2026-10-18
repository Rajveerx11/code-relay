import {validateScope} from './core.mjs';
import {pageEditor} from './editor-adapter.mjs';
const $=id=>document.getElementById(id);
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
  if(typeof text!=='string')throw Error('Input is not text.');
  text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(!text.length||text.length>200000||text.includes('\0'))throw Error('Use non-empty text, at most 200,000 characters, without NUL bytes.');
  return text;
}
async function guarded(action){
  if(state.busy)return;state.busy=true;update();
  try{await action();}catch(e){status(e.message||'Operation failed. Check the page and inspect again.',true);}
  finally{state.busy=false;update();}
}
async function active(){
  if(!globalThis.chrome?.tabs)throw Error('Load the extension in Chrome to use this popup.');
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!tab.url)throw Error('This tab cannot be accessed. Open a regular practice page and click the extension icon.');
  return tab;
}
async function approvedTab(){
  const tab=await active();
  if(!state.tab||tab.id!==state.tab.id)throw Error('Active tab changed. Inspect this page again.');
  const scope=validateScope(tab.url,state.tab.url,$('consent').checked);if(!scope.ok)throw Error(scope.error);
  return tab;
}
function execute(target,operation,approvedUrl,args={}){
  return chrome.scripting.executeScript({target,world:'MAIN',func:pageEditor,args:[{...args,operation,approvedUrl,consent:$('consent').checked}]});
}
function checkedFrame(response,frameId,documentId){
  const frame=response.find(x=>x.frameId===frameId&&(!documentId||x.documentId===documentId));
  if(!frame?.result)throw Error('The selected page/frame is unavailable or navigated. Inspect again.');
  if(!frame.result.ok)throw Error(frame.result.error);
  if(!frame.documentId)throw Error('Browser did not provide a document identity. Use Chrome 106 or later.');
  return frame;
}
async function invoke(operation,args={}){
  try{
    const tab=await approvedTab(),selected=state.selected;
    if(!selected||!state.topDocumentId)throw Error('Inspect and select an editor first.');
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
  state.undo=null;state.snapshot=null;state.selected=state.editors[index];
  state.target=state.selected?.target;
  const read=await invoke('snapshot',{target:state.target});showSnapshot(read.snapshot);
}
async function verifyWrite(snapshot){
  status('Write attempted. Checking that the selected editor keeps the new code…');
  try{
    let result;
    // Sample after the site's input handlers/render cycle and again after common
    // debounced resets. These are read-only checks, never write retries.
    for(const delay of [150,600]){
      await new Promise(resolve=>setTimeout(resolve,delay));
      result=await invoke('verify',{target:state.target,expected:snapshot});
    }
    return result.snapshot;
  }catch(error){
    resetTarget();
    throw Error(`The write was attempted, but the live editor did not pass verification. ${error.message} Check the page and inspect again. No automatic retry or rollback was performed.`);
  }
}
$('inspect').addEventListener('click',()=>guarded(async()=>{
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
  const writable=state.editors.map((editor,index)=>({...editor,index})).filter(editor=>!editor.readOnly);
  if(!writable.length)throw Error('No supported writable editor found in the main page or accessible same-origin frames. Supported: textareas and exposed Ace editors. Monaco, CodeMirror and private Ace instances are unsupported.'+warning);
  const focused=writable.filter(editor=>editor.focused);
  const candidate=focused.length===1?focused[0]:writable.length===1?writable[0]:null;
  if(!candidate){
    const option=document.createElement('option');option.value='';option.textContent='Choose the code editor — multiple targets found';option.disabled=true;$('target').append(option);$('target').value='';
    status('Multiple writable editors found. Choose your code editor from Target editor and check its current contents before importing.'+warning);return;
  }
  $('target').value=String(candidate.index);await selectEditor(candidate.index);
  status(`Selected ${targetName()}. Check Target contents below before importing.${warning}`);
}));
$('target').addEventListener('change',()=>guarded(async()=>{
  if($('target').value==='')return;
  await selectEditor(Number($('target').value));status(`Selected ${targetName()}. Check Target contents below before importing.`);
}));
$('readClipboard').addEventListener('click',()=>guarded(async()=>{
  try{
    // Request immediately in the button's gesture. Already-granted permission needs no new prompt.
    if(!await chrome.permissions.request({permissions:['clipboardRead']}))throw Error('Permission denied');
    const text=clean(await navigator.clipboard.readText());$('preview').value=text;status('Clipboard loaded into the preview only. Nothing has been inserted.');
  }catch{throw Error('Clipboard access failed or its text is invalid. Use the saved-file input or paste into the preview instead.');}
}));
$('file').addEventListener('change',()=>guarded(async()=>{
  const file=$('file').files[0];if(!file)return;
  if(file.size>800000)throw Error('File is too large. Maximum UTF-8 file size: 800,000 bytes.');
  const text=clean(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()));
  $('preview').value=text;status('UTF-8 file loaded into the preview. Line endings normalized; nothing inserted yet.');
}));
$('insert').addEventListener('click',()=>guarded(async()=>{
  if(!state.snapshot)throw Error('Inspect the editor first.');
  const text=clean($('preview').value);$('preview').value=text;
  const before=state.snapshot;
  const result=await invoke('insert',{target:state.target,expected:before,text,mode:$('mode').value,replaceConfirmed:$('replaceConfirmed').checked});
  const verified=await verifyWrite(result.snapshot);
  state.undo={restore:before,expected:verified};showSnapshot(verified);
  status(`Code read back from ${targetName()} after two delayed checks. Confirm the change on the page. Keep this popup open for Undo. Later site changes and saving/submission are not verified.`);
}));
$('undo').addEventListener('click',()=>guarded(async()=>{
  if(!state.undo)throw Error('No temporary undo backup.');
  const result=await invoke('undo',{target:state.target,...state.undo});
  const verified=await verifyWrite(result.snapshot);showSnapshot(verified);state.undo=null;
  status(`Previous code restored in ${targetName()} and checked again. Confirm the change on the page.`);
}));
$('clear').addEventListener('click',()=>{$('preview').value='';$('file').value='';resetTarget();status('Code and temporary backup cleared. Inspect again before importing.');});
$('consent').addEventListener('change',()=>{resetTarget();status('Inspect the permitted practice page to continue.');});
for(const id of ['preview','mode','replaceConfirmed'])$(id).addEventListener('input',update);
update();
active().then(tab=>{const url=new URL(tab.url);$('page').textContent=`Current page: ${url.origin}${url.pathname}`;}).catch(()=>{});
