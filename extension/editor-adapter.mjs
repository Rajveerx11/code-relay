// Self-contained: Chrome serializes this function for MAIN-world execution.
export function pageEditor(request) {
  let mutationPossible=false;
  const fail = error => ({ok:false, error, mutationPossible});
  try {
    const current = location.href;
    const url = new URL(current);
    const local = url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    // Discovery may inspect same-origin child URLs, but every subsequent operation
    // must match the exact selected frame URL and Chrome document identity.
    const approved = new URL(request.approvedUrl);
    const discovering = request.operation === 'inspect' && request.discover === true;
    if (!request.consent || (discovering ? url.origin !== approved.origin : current !== request.approvedUrl) || (url.protocol !== 'https:' && !local) || url.username || url.password)
      return fail('Page not approved. Inspect the current practice page again.');
    if (/(exam|assessment|proctor|secure[-_]?test|quiz)/i.test(url.pathname+url.search+url.hash+' '+document.title) ||
        document.querySelector('[data-proctored="true"], [data-assessment="true"]'))
      return fail('Assessment/proctoring pages are not supported.');
    const visible = el => {
      if (el.isConnected===false || ![...el.getClientRects()].some(rect=>rect.width>0 && rect.height>0)) return false;
      for (let node=el;node;node=node.parentElement) {
        const style=getComputedStyle(node);
        if (node.hidden || node.getAttribute('aria-hidden')==='true' || style.display==='none' ||
            ['hidden','collapse'].includes(style.visibility) || style.opacity==='0') return false;
      }
      return true;
    };
    // Do not expose hidden frames or editors nested under an assessment page.
    // Reading an inaccessible ancestor fails closed in the outer catch.
    let activeFrame=true;
    if (globalThis.window) {
      let frame = window;
      while (frame !== frame.top) {
        if (!frame.frameElement || !visible(frame.frameElement)) return fail('Embedded editor frame is hidden or inaccessible.');
        activeFrame=activeFrame && frame.parent.document.activeElement===frame.frameElement;
        frame = frame.parent;
        const ancestor = new URL(frame.location.href);
        if (ancestor.origin !== approved.origin ||
            /(exam|assessment|proctor|secure[-_]?test|quiz)/i.test(ancestor.pathname+ancestor.search+ancestor.hash+' '+frame.document.title) ||
            frame.document.querySelector('[data-proctored="true"], [data-assessment="true"]'))
          return fail('Assessment/proctoring or inaccessible parent pages are not supported.');
      }
    }
    if (request.operation === 'validate') return {ok:true,url:current};
    const candidates = [...document.querySelectorAll('textarea, .ace_editor')].filter(el => visible(el) &&
      (el.classList.contains('ace_editor') || (!el.matches('.ace_text-input, .ime-text-area') && !el.closest('.ace_editor, .monaco-editor, .CodeMirror, .cm-editor'))));
    const adapters = candidates.flatMap(el => {
      if (el.classList.contains('ace_editor')) {
        const editor=el.env?.editor;
        if (!editor?.session?.doc?.positionToIndex || !editor.selection?.setSelectionRange || typeof editor.getReadOnly !== 'function') return [];
        const doc=editor.session.doc;
        return [{el,kind:'ace',readonly:()=>editor.getReadOnly() || el.getAttribute('aria-readonly')==='true',value:()=>editor.getValue(),
          selection:()=>{const r=editor.getSelectionRange();return {start:doc.positionToIndex(r.start),end:doc.positionToIndex(r.end),direction:editor.selection.isBackwards()?'backward':'forward'};},
          replace:(text,start,end)=>{const Range=editor.getSelectionRange().constructor;const a=doc.indexToPosition(start),b=doc.indexToPosition(end);editor.session.markUndoGroup();const point=editor.session.replace(new Range(a.row,a.column,b.row,b.column),text);editor.selection.setSelectionRange(new Range(point.row,point.column,point.row,point.column));editor.session.markUndoGroup();},
          select:(start,end,direction)=>{const Range=editor.getSelectionRange().constructor,a=doc.indexToPosition(start),b=doc.indexToPosition(end);editor.selection.setSelectionRange(new Range(a.row,a.column,b.row,b.column),direction==='backward');},
          newline:()=>doc.getNewLineCharacter(),limit:()=>200000,notify:()=>{}}];
      }
      return [{el,kind:'textarea',readonly:()=>el.readOnly||el.disabled||el.matches(':disabled')||el.getAttribute('aria-readonly')==='true',value:()=>el.value,
        selection:()=>({start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection}),
        replace:(text,start,end)=>el.setRangeText(text,start,end,'end'),select:(start,end,direction)=>el.setSelectionRange(start,end,direction),
        newline:()=> '\n',limit:()=>el.maxLength>=0?Math.min(200000,el.maxLength):200000,notify:()=>el.dispatchEvent(new Event('input',{bubbles:true}))}];
    });
    const describe = (a,index) => ({target:index,kind:a.kind,label:a.el.labels?.[0]?.textContent?.trim().slice(0,100) || a.el.getAttribute('aria-label') || a.el.id || `Editor ${index+1}`,readOnly:!!a.readonly(),characters:a.value().length,
      focused:activeFrame && !!document.activeElement && (document.activeElement===a.el || !!a.el.contains?.(document.activeElement))});
    if (request.operation === 'inspect') return {ok:true,url:current,editors:adapters.map(describe),frames:document.querySelectorAll('iframe, frame').length};
    if (!Number.isInteger(request.target) || !adapters[request.target]) return fail('Editor is unavailable. Inspect again.');
    const a=adapters[request.target],info=describe(a,request.target);
    if (info.readOnly) return fail('Editor is read-only or disabled; nothing changed.');
    // An ordinal and matching text/attributes cannot identify a DOM node: frameworks
    // may replace it or reorder indistinguishable editors between popup actions.
    // A non-enumerable symbol survives separate serialized MAIN-world calls on
    // this node, but is not copied by cloneNode or by HTML replacement.
    const identityKey=Symbol.for('practice-program-import.editor-identity.v1');
    if (!Object.prototype.hasOwnProperty.call(a.el,identityKey))
      Object.defineProperty(a.el,identityKey,{value:crypto.randomUUID()});
    const snapshot=()=>({value:a.value(),...a.selection(),identity:[a.el.id,a.el.getAttribute('name')||'',info.kind,info.label,a.el[identityKey]]});
    const before=snapshot();
    if (before.value.length>200000) return fail('Editor is too large for the 200,000-character V1 limit.');
    if (request.operation==='snapshot') return {ok:true,target:request.target,snapshot:before};
    // Chrome's serialization boundary can reorder object keys. Compare the
    // snapshot's data, never its JSON encoding; unchanged editors must survive
    // the MAIN-world -> popup -> MAIN-world round trip.
    const expected=request.expected;
    const sameIdentity=identity=>Array.isArray(identity) && identity.length===before.identity.length &&
      before.identity.every((value,index)=>value===identity[index]);
    if (!expected || before.value!==expected.value)
      return fail(request.operation==='verify'?'The page reset or changed the imported code after the write.':'Editor content changed since inspection. Inspect again; nothing overwritten.');
    if (!sameIdentity(expected.identity))
      return fail(request.operation==='verify'?'The page replaced or changed the selected editor after the write.':'Editor identity changed since inspection. Inspect again; nothing overwritten.');
    // A fresh invocation rediscovers the currently visible node. Read-only
    // verification checks content and identity, not harmless post-write cursor moves.
    if (request.operation==='verify') return {ok:true,target:request.target,snapshot:before};
    if (before.start!==expected.start || before.end!==expected.end || before.direction!==expected.direction)
      return fail('Editor selection changed since inspection. Set the cursor and inspect again; nothing overwritten.');
    let value;
    if (request.operation==='insert') {
      if (typeof request.text!=='string' || !request.text.length || request.text.length>200000 || request.text.includes('\0')) return fail('Code is empty, too large or contains a NUL character.');
      if (!['selection','replace'].includes(request.mode)) return fail('Invalid insertion mode.');
      if (request.mode==='replace' && request.replaceConfirmed!==true) return fail('Confirm replacing the entire editor first.');
      const text=request.text.replace(/\r\n?/g,'\n').replace(/\n/g,a.newline());
      const start=request.mode==='replace'?0:before.start,end=request.mode==='replace'?before.value.length:before.end;
      value=before.value.slice(0,start)+text+before.value.slice(end);
      if (value.length>a.limit()) return fail('Result exceeds the editor size limit.');
      mutationPossible=true;
      a.replace(text,start,end);
    } else if (request.operation==='undo') {
      const restore=request.restore;
      if (!restore || typeof restore.value!=='string' || restore.value.length>200000 || JSON.stringify(restore.identity)!==JSON.stringify(before.identity)) return fail('Undo backup is invalid.');
      value=restore.value;
      mutationPossible=true;
      a.replace(value,0,before.value.length); a.select(restore.start,restore.end,restore.direction);
    } else return fail('Unknown operation.');
    a.notify();
    if (a.value()!==value) return fail('The application changed or rejected the imported value after insertion. The editor may have changed; inspect it again. No automatic rollback was performed.');
    // No focus() call: keep the popup open so its temporary undo backup survives.
    return {ok:true,target:request.target,snapshot:snapshot(),characters:a.value().length};
  } catch { return fail(mutationPossible ? 'Editor operation failed after a change was attempted. The editor may have changed; inspect it again. No automatic rollback was performed.' : 'Editor operation failed. Inspect again and check the page; no automatic retries are performed.'); }
}
