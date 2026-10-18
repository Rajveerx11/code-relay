import test from 'node:test';
import assert from 'node:assert/strict';
import {createDiagnostics,exportDiagnostics,LOG_LIMIT} from '../extension/diagnostics.mjs';

test('diagnostics accept only fixed vocabulary, never arbitrary values or exception getters',()=>{
  const log=createDiagnostics();
  const hostile={toString(){throw Error('must not coerce');},get message(){throw Error('must not read');}};
  for(const value of ['https://private.example/student?token=secret#name','private-file.java','<img onerror=secret>','source text',new Error('private stack'),hostile,'__proto__','constructor']){
    log.record(value,value,value);
  }
  const lines=log.serialize().split('\n').filter(line=>line.includes(' | '));
  assert.equal(lines.length,8);
  for(const line of lines)assert.match(line,/^\d{4}-\d{2}-\d{2}T[\d:.]+Z \| runtime \| failed \| unexpected \| Unexpected failure\. Check the page and inspect again\.$/);
  assert.doesNotMatch(log.serialize(),/private|secret|onerror|source text|__proto__|constructor|Error:/);
});
test('retains only latest 100 entries, serializes deterministically and clears without a new event',()=>{
  const log=createDiagnostics();log.record('file','started','started');
  for(let n=0;n<LOG_LIMIT;n++)log.record('inspect','success','completed');
  assert.equal(log.serialize().split('\n').filter(line=>line.includes(' | ')).length,100);
  assert.doesNotMatch(log.serialize(),/ \| file \| /);
  assert.equal(log.serialize(),log.serialize());
  log.clear();assert.match(log.serialize(),/No entries\.$/);assert.doesNotMatch(log.serialize(),/ \| /);
  assert.equal(log.serialize(),createDiagnostics().serialize());
});
test('explicit export uses exactly the serialized preview, fixed filename, and delayed URL cleanup',async t=>{
  const log=createDiagnostics();log.record('inspect','started','started');
  let blob,download,removed=false,cleanup;
  const revoked=[];
  t.mock.method(URL,'createObjectURL',value=>{blob=value;return 'blob:fixture';});
  t.mock.method(URL,'revokeObjectURL',value=>revoked.push(value));
  t.mock.method(globalThis,'setTimeout',fn=>{cleanup=fn;});
  const anchor={click(){download=this.download;},remove(){removed=true;}};
  const old=globalThis.document;t.after(()=>{globalThis.document=old;});
  globalThis.document={createElement:tag=>{assert.equal(tag,'a');return anchor;},body:{append:node=>assert.equal(node,anchor)}};
  assert.equal(exportDiagnostics(log),true);
  assert.equal(await blob.text(),log.serialize());assert.equal(blob.type,'text/plain;charset=utf-8');
  assert.equal(download,'code-relay-diagnostics.txt');assert.equal(anchor.href,'blob:fixture');
  assert.equal(removed,true);assert.deepEqual(revoked,[]);cleanup();assert.deepEqual(revoked,['blob:fixture']);
});
test('export and cleanup failures are contained, never thrown or appended as raw errors',t=>{
  const log=createDiagnostics();
  const old=globalThis.document;t.after(()=>{globalThis.document=old;});
  let revoked=false;
  t.mock.method(URL,'createObjectURL',()=> 'blob:fixture');
  t.mock.method(URL,'revokeObjectURL',()=>{revoked=true;throw Error('private URL');});
  globalThis.document={createElement:()=>({click(){throw Error('private name');},remove(){throw Error('private path');}}),body:{append(){}}};
  assert.equal(exportDiagnostics(log),false);assert.equal(revoked,true);
  assert.match(log.serialize(),/No entries\.$/);
  t.mock.method(URL,'createObjectURL',()=>{throw Error('private blob failure');});
  assert.equal(exportDiagnostics(log),false);
});
