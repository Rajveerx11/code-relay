// Popup wiring tests use a minimal DOM and Chrome API fake, not a real browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
function element(){return {value:'',checked:false,disabled:false,hidden:false,textContent:'',dataset:{},options:[],listeners:{},
 addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.options=[];},append(child){this.options.push(child);}};}
test('popup connects inspect/import/undo and clears stale actions after partial-write errors',async()=>{
 const html=readFileSync(new URL('../extension/popup.html',import.meta.url),'utf8');
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element()]));
 nodes.mode.value='selection';nodes.preview.value='new';nodes.consent.checked=true;
 globalThis.document={getElementById:id=>nodes[id],createElement:()=>element()};
 let failInsert=true, failUndo=false;
 const snapshot={value:'abc',start:1,end:1,direction:'forward',identity:['code','','textarea','code','token']};
 const after={...snapshot,value:'anewbc',start:4,end:4};
 const calls=[];
 globalThis.chrome={tabs:{query:async()=>[{id:1,url:'https://practice.example/editor'}]},scripting:{executeScript:async input=>{
  calls.push(input);const operation=input.args[0].operation;
  let result;
  if(operation==='inspect')result={ok:true,url:'https://practice.example/editor',editors:[{target:0,label:'Code',kind:'textarea',characters:3,readOnly:false}]};
  else if(operation==='snapshot')result={ok:true,snapshot};
  else if((operation==='insert'&&failInsert)||(operation==='undo'&&failUndo))result={ok:false,mutationPossible:true,error:'The editor may have changed; inspect it again.'};
  else result={ok:true,snapshot:operation==='verify'?input.args[0].expected:operation==='insert'?after:snapshot};
  return [{frameId:0,documentId:'doc-1',result}];
 }}};
 await import('../extension/popup.mjs');
 const click=id=>nodes[id].listeners.click();
 await click('inspect');assert.equal(nodes.insert.disabled,false);
 await click('insert');assert.equal(nodes.insert.disabled,true);assert.equal(nodes.undo.disabled,true);
 assert.equal(nodes.status.dataset.error,'true');assert.match(nodes.status.textContent,/may have changed/);assert.equal(nodes.preview.value,'new');
 failInsert=false;await click('inspect');await click('insert');assert.equal(nodes.undo.disabled,false);
 failUndo=true;await click('undo');assert.equal(nodes.insert.disabled,true);assert.equal(nodes.undo.disabled,true);
 for(const c of calls){assert.equal(c.world,'MAIN');assert.equal(c.target.tabId,1);assert.equal(typeof c.func,'function');}
 assert.deepEqual(calls[1].target.documentIds,['doc-1']);
});
