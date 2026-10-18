// Real popup controller with minimal DOM/Chrome fakes, not native extension coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const secret='PRIVATE_STUDENT_<img src=x onerror=secret>_source';
const url='https://practice.example/'+encodeURIComponent(secret)+'?token=PRIVATE_TOKEN#PRIVATE_HASH';
function element(){return {value:'',checked:false,disabled:false,textContent:'',dataset:{},options:[],listeners:{},files:[],
  addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.options=[];},append(child){this.options.push(child);}};}
let sequence=0;
async function popup(t,config={}){
  const html=readFileSync(new URL('../extension/popup.html',import.meta.url),'utf8');
  const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element()]));
  nodes.mode.value='selection';nodes.preview.value=secret;nodes.consent.checked=true;
  const previous={document:globalThis.document,chrome:globalThis.chrome,addEventListener:globalThis.addEventListener};
  t.after(()=>Object.assign(globalThis,previous));
  const events={},calls=[];
  globalThis.addEventListener=(type,fn)=>{events[type]=fn;};
  globalThis.document={getElementById:id=>nodes[id],createElement:()=>element()};
  const snapshot={value:secret,start:0,end:0,direction:'forward',identity:[secret,secret,'textarea',secret,secret]};
  globalThis.chrome={tabs:{query:async()=>[{id:1,url}]},permissions:{request:async()=>!config.clipboardDenied},scripting:{executeScript:async input=>{
    const operation=input.args[0].operation;calls.push(operation);
    if(config.throwOn===operation)throw Error(secret+' '+url);
    let result={ok:true,snapshot};
    if(operation==='inspect')result={ok:true,url,frames:0,editors:[{target:0,label:secret,kind:'textarea',characters:secret.length,readOnly:false}]};
    if(operation===config.partial)result={ok:false,mutationPossible:true,error:secret+' '+url};
    if(operation==='verify'&&calls.filter(x=>x==='verify').length===config.failVerify)result={ok:false,error:config.verifyError??secret+' '+url};
    return [{frameId:0,documentId:'private-doc',result}];
  }}};
  await import(`../extension/popup.mjs?diagnostics=${++sequence}`);
  return {nodes,events,calls,click:id=>nodes[id].listeners.click(),report:()=>nodes.diagnosticReport.textContent};
}
function redacted(report){assert.doesNotMatch(report,/PRIVATE|private-doc|onerror|https:\/\/|Error:|\.java|\.mjs:\d/);}
function outcome(report,action,status,category){assert.ok(report.includes(` | ${action} | ${status} | ${category} | `),report);}

test('actual popup logs inspect/target, file, import, both checks and undo without page/source metadata',async t=>{
  const p=await popup(t);await p.click('inspect');
  p.nodes.file.files=[{name:secret+'.java',size:10,arrayBuffer:async()=>new TextEncoder().encode(secret).buffer}];
  await p.nodes.file.listeners.change();await p.click('insert');await p.click('undo');
  for(const action of ['inspect','target','file','import','verify-1','verify-2','undo']){
    outcome(p.report(),action,'started','started');outcome(p.report(),action,'success','completed');
  }
  assert.equal(p.calls.filter(x=>x==='verify').length,4);redacted(p.report());
  p.nodes.target.value='0';await p.nodes.target.listeners.change();redacted(p.report());
  assert.equal(p.nodes.undo.disabled,true);
  await p.click('clearDiagnostics');assert.match(p.report(),/No entries\.$/);assert.equal(p.nodes.preview.value,secret);
  const fresh=await popup(t);assert.match(fresh.report(),/No entries\.$/);
});
test('partial writes and unknown transport errors never become success or leak exceptions',async t=>{
  for(const config of [{partial:'insert'},{throwOn:'insert'}]){
    const p=await popup(t,config);await p.click('inspect');await p.click('insert');
    outcome(p.report(),'import','failed',config.partial?'partial-write':'unexpected');
    assert.doesNotMatch(p.report(),/ \| import \| success \| | \| verify-1 \| /);
    assert.equal(p.nodes.insert.disabled,true);assert.equal(p.nodes.undo.disabled,true);
    redacted(p.report());redacted(p.nodes.status.textContent);
  }
});
for(const check of [1,2])test(`failed delayed check ${check} records failure and no import success or retry`,async t=>{
  const p=await popup(t,{failVerify:check});await p.click('inspect');await p.click('insert');
  outcome(p.report(),`verify-${check}`,'failed','verification-failed');outcome(p.report(),'import','failed','verification-failed');
  assert.doesNotMatch(p.report(),/ \| import \| success \| /);
  if(check===1)assert.doesNotMatch(p.report(),/ \| verify-2 \| /);
  else outcome(p.report(),'verify-1','success','completed');
  assert.equal(p.calls.filter(x=>x==='insert').length,1);assert.equal(p.calls.filter(x=>x==='verify').length,check);
  assert.equal(p.nodes.undo.disabled,true);redacted(p.report());redacted(p.nodes.status.textContent);
});
test('verification status retains known safe causes while the report stays category-only',async t=>{
  for(const message of ['The page reset or changed the imported code after the write.','The page replaced or changed the selected editor after the write.']){
    const p=await popup(t,{failVerify:1,verifyError:message});await p.click('inspect');await p.click('insert');
    assert.ok(p.nodes.status.textContent.includes(message),p.nodes.status.textContent);
    assert.match(p.nodes.status.textContent,/write was attempted/);
    assert.match(p.nodes.status.textContent,/No automatic retry or rollback/);
    outcome(p.report(),'import','failed','verification-failed');
    assert.ok(!p.report().includes(message));redacted(p.report());
    assert.equal(p.nodes.insert.disabled,true);assert.equal(p.nodes.undo.disabled,true);
  }
});
test('undo partial failure is logged without success',async t=>{
  const p=await popup(t,{partial:'undo'});await p.click('inspect');await p.click('insert');await p.click('undo');
  outcome(p.report(),'undo','failed','partial-write');assert.doesNotMatch(p.report(),/ \| undo \| success \| /);redacted(p.report());
});
test('file decoding/reading and input rejection, cancellation and clipboard denial are distinguished',async t=>{
  const p=await popup(t,{clipboardDenied:true});
  for(const file of [{size:800001},{size:1,arrayBuffer:async()=>{throw Error(secret);}},{size:1,arrayBuffer:async()=>new Uint8Array([255]).buffer},{size:0,arrayBuffer:async()=>new ArrayBuffer(0)}]){
    p.nodes.file.files=[{...file,name:secret+'.java'}];await p.nodes.file.listeners.change();
    outcome(p.report(),'file','failed',file.size===0||file.size>800000?'input-invalid':'file-read');
  }
  p.nodes.file.files=[];await p.nodes.file.listeners.change();outcome(p.report(),'file','cancelled','cancelled');
  await p.click('readClipboard');outcome(p.report(),'clipboard','failed','clipboard-access');
  assert.equal(p.nodes.preview.value,secret);redacted(p.report());
});
test('observable global errors ignore raw event data; diagnostics failures cannot break normal actions or recurse',async t=>{
  const p=await popup(t);
  const event={get message(){throw Error(secret);},get reason(){throw Error(secret);}};
  p.events.error(event);p.events.unhandledrejection(event);outcome(p.report(),'runtime','failed','unexpected');redacted(p.report());
  Object.defineProperty(p.nodes.diagnosticReport,'textContent',{get:()=>'',set(){throw Error(secret);}});
  p.events.error(event);await p.click('inspect');await p.click('insert');assert.equal(p.nodes.undo.disabled,false);
  assert.match(p.nodes.diagnosticStatus.textContent,/display unavailable/);
  // An export failure is contained and gets a fixed safe result, not a rejected handler.
  t.mock.method(URL,'createObjectURL',()=>{throw Error(secret);});await p.click('exportDiagnostics');
  assert.match(p.nodes.diagnosticStatus.textContent,/could not be requested/);
  await p.click('undo');assert.equal(p.nodes.undo.disabled,true);
});
test('diagnostic timestamp failures do not stop import or trigger recursive error reporting',async t=>{
  const p=await popup(t);
  t.mock.method(Date.prototype,'toISOString',()=>{throw Error(secret);});
  p.events.error({});await p.click('inspect');await p.click('insert');
  assert.equal(p.nodes.undo.disabled,false);
  assert.match(p.nodes.diagnosticStatus.textContent,/Diagnostics unavailable/);
  assert.match(p.report(),/No entries\.$/);
});
test('export failure is safely visible in the actual popup report',async t=>{
  const p=await popup(t);t.mock.method(URL,'createObjectURL',()=>{throw Error(secret);});
  await p.click('exportDiagnostics');outcome(p.report(),'export','failed','export-failed');redacted(p.report());
});
