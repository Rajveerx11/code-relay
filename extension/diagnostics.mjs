// Only fixed vocabulary crosses this boundary. Never pass source, page metadata,
// exceptions or user-provided strings to a diagnostic entry.
export const LOG_LIMIT=100;
const actions=['inspect','target','file','clipboard','import','verify-1','verify-2','undo','runtime','export'];
const statuses=['started','success','warning','failed','cancelled'];
const messages=Object.freeze({
  started:'Action started.',
  completed:'Action completed; saving and submission are not verified.',
  'target-choice':'Choose a target before importing.',
  'frames-unavailable':'Some embedded frames could not be inspected.',
  'input-invalid':'Input was rejected; review the source limits.',
  'file-read':'File could not be read as UTF-8.',
  'clipboard-access':'Clipboard permission, reading or text validation failed.',
  scope:'Page approval or scope check failed. Inspect again.',
  'target-unavailable':'Target or document is unavailable. Inspect again.',
  'editor-rejected':'Editor operation was refused. Inspect again.',
  'partial-write':'A change was attempted; the editor may have changed. No retry or rollback.',
  'verification-failed':'Write attempted, but delayed verification failed. No retry or rollback.',
  cancelled:'No file selected.',
  unexpected:'Unexpected failure. Check the page and inspect again.',
  'export-failed':'Report download could not be requested.'
});
const header='Code Relay execution diagnostics\nMemory-only: closing the popup clears this log. Latest 100 entries only.\nThese checks do not prove saving, submission or live CodeTantra support.\nNo source, clipboard text, filenames, editor labels, URLs or account data included.\n';

export function createDiagnostics(){
  const entries=[];
  return {
    record(action,status,category){
      // No coercion or inspection of unknown objects (including Error getters).
      if(!actions.includes(action))action='runtime';
      if(!statuses.includes(status))status='failed';
      if(typeof category!=='string'||!Object.hasOwn(messages,category))category='unexpected';
      entries.push(`${new Date().toISOString()} | ${action} | ${status} | ${category} | ${messages[category]}`);
      if(entries.length>LOG_LIMIT)entries.shift();
    },
    clear(){entries.length=0;},
    serialize(){return header+'\n'+(entries.join('\n')||'No entries.');}
  };
}

// A click requests a download; it cannot confirm the user saved the file.
// Failures, including cleanup, must not escape into the workflow/global reporter.
export function exportDiagnostics(log){
  let url,anchor;
  const revoke=()=>{try{if(url)URL.revokeObjectURL(url);}catch{}};
  try{
    url=URL.createObjectURL(new Blob([log.serialize()],{type:'text/plain;charset=utf-8'}));
    anchor=document.createElement('a');anchor.href=url;anchor.download='code-relay-diagnostics.txt';
    document.body.append(anchor);anchor.click();
    setTimeout(revoke,1000);
    return true;
  }catch{revoke();return false;}
  finally{try{anchor?.remove();}catch{}}
}
