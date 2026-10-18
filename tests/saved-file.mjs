export async function runSavedFileTests(doc,code){
const report=[];const pause=()=>new Promise(r=>setTimeout(r,20));
const until=async(fn)=>{const end=Date.now()+3000;while(!fn()){if(Date.now()>end)throw Error('UI wait: '+doc.getElementById('status').textContent);await pause();}};
try {
 await until(()=>!doc.getElementById('inspect').disabled);
 const text='\tprint("नमस्ते 👋")\n<script>window.importUIQA=true</script>\n';
 const transfer=new DataTransfer();transfer.items.add(new File([text],'local-program.py',{type:'text/plain'}));
 doc.getElementById('file').files=transfer.files;doc.getElementById('file').dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
 await until(()=>doc.getElementById('preview').value===text&&!doc.getElementById('insert').disabled);
 doc.getElementById('insert').click();await until(()=>code.value==='start\n'+text+'end'&&!doc.getElementById('undo').disabled);
 if(window.importUIQA)throw Error('markup executed');
 doc.getElementById('undo').click();await until(()=>code.value==='start\nend'&&!doc.getElementById('inspect').disabled);
 report.push({name:'popup: UTF-8 file preview, insertion and undo (Chrome API bridge)',ok:true});
 doc.getElementById('mode').value='replace';doc.getElementById('mode').dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
 if(!doc.getElementById('insert').disabled)throw Error('replace not gated');
 doc.getElementById('replaceConfirmed').click();doc.getElementById('insert').click();await until(()=>code.value===text&&!doc.getElementById('inspect').disabled);
 doc.getElementById('undo').click();await until(()=>code.value==='start\nend'&&!doc.getElementById('inspect').disabled);
 report.push({name:'popup: explicit replace-all confirmation and restore',ok:true});
 const bad=new DataTransfer();bad.items.add(new File([new Uint8Array([255])],'invalid.py'));doc.getElementById('file').files=bad.files;doc.getElementById('file').dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
 await until(()=>doc.getElementById('status').dataset.error==='true'&&!doc.getElementById('inspect').disabled);
 if(doc.getElementById('preview').value!==text)throw Error('invalid file erased preview');
 report.push({name:'popup: invalid UTF-8 refusal preserves preview',ok:true});
} catch(e){report.push({name:'popup saved-file workflow',ok:false,error:e.message});}
document.getElementById('results').textContent=JSON.stringify(report,null,2);return report;
}
window.runSavedFileTests=()=>runSavedFileTests(document.getElementById('popup').contentDocument,document.getElementById('code'));
