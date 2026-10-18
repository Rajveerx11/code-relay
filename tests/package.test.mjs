import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {resolve,dirname,join,relative,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const walk=p=>readdirSync(p).flatMap(n=>statSync(join(p,n)).isDirectory()?walk(join(p,n)):[join(p,n)]);
const manifest=JSON.parse(read('manifest.json'));
test('one root MV3 manifest has a resolvable popup and unchanged permissions',()=>{
 assert.equal(manifest.manifest_version,3);assert.equal(manifest.version,'1.0.1');
 assert.deepEqual(walk(root).filter(p=>basename(p)==='manifest.json'),[join(root,'manifest.json')]);
 assert.equal(manifest.action.default_popup,'extension/popup.html');
 assert.ok(existsSync(join(root,manifest.action.default_popup)));
 assert.deepEqual(manifest.permissions,['activeTab','scripting']);
 assert.deepEqual(manifest.optional_permissions,['clipboardRead']);
 for(const key of ['host_permissions','background','content_scripts','web_accessible_resources'])assert.equal(manifest[key],undefined);
});
test('popup scripts, CSS, module imports and DOM IDs connect to real files/elements',()=>{
 const html=read(manifest.action.default_popup), js=read('extension/popup.mjs');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(existsSync(resolve(root,'extension',m[1])),m[1]);
 for(const file of walk(join(root,'extension')).filter(p=>p.endsWith('.mjs'))){
  for(const m of readFileSync(file,'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g))assert.ok(existsSync(resolve(dirname(file),m[1])),m[1]);
 }
 for(const m of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(m[1]),m[1]);
 assert.doesNotMatch(html,/bridge\.js|tests\//);
});
test('demo and test local imports/src/href paths resolve after repackaging',()=>{
 for(const file of [...walk(join(root,'demo')),...walk(join(root,'tests'))]){
  if(!/\.(html|mjs|js)$/.test(file))continue;
  const text=readFileSync(file,'utf8');
  const refs=[...text.matchAll(/(?:src|href)="([^"<>]+)"/g),...text.matchAll(/(?:from\s*|import\(\s*|fetch\(\s*)['"]([^'"]+)['"]/g)];
  for(const m of refs){const ref=m[1];if(/^(?:https?:|node:|#)/.test(ref)||ref.includes("'"))continue;
   assert.ok(existsSync(ref.startsWith('/')?join(root,ref):resolve(dirname(file),ref)),relative(root,file)+': '+ref);
  }
 }
});
