# Practice Program Import — V1 (1.0.1)

A small Chrome browser extension for importing your own saved source file into a permitted practice editor. This is **not a VS Code extension**, a secure-exam-browser workaround, or a guaranteed CodeTantra compatibility fix.

## Install in Chrome

1. Extract the ZIP completely into a permanent folder named `practice-program-import-fixed`. Do not select the ZIP itself.
2. Open `chrome://extensions`.
3. Switch on **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `practice-program-import-fixed` folder itself. It contains `manifest.json`, `README.md`, and the `extension` subfolder. Do not select `extension`: the manifest is now at the top level.
6. In Chrome's Extensions/puzzle-piece menu, pin **Practice Program Import — V1**.

No Node, npm, backend, account, payment, or VS Code plugin is needed to use the extension. Keep the extracted extension folder; Chrome loads its files from that folder. Organization-managed Chrome may prohibit unpacked extensions; ask the administrator rather than changing security policy.

## Use your VS Code program

1. Save your own program in VS Code using UTF-8 encoding.
2. Open a trusted practice page where external-code import is explicitly allowed.
3. Click in its editor and place the cursor or select the text you want to replace **before** opening the extension.
4. Click the extension icon.
5. Check **External-code import is permitted here**. Do not use it in exams, assessments or proctored sessions.
6. Click **Inspect practice editor**. The focused supported editor is preferred; if multiple editors are ambiguous, select one explicitly. Check **Target contents** matches your program, not another input field.
7. Under **Saved file from VS Code**, choose your `.c`, `.cpp`, `.java`, `.py`, `.js`, `.ts`, or `.txt` file.
8. Review the preview. UTF-8 text, tabs and Unicode are retained; line endings are normalized to the editor's format.
9. Leave **Insert at cursor / replace selection** selected, then click **Import code**.
10. Wait for verification, then check the actual editor. After import/undo, the extension rediscovers and reads the same visible editor after about 150 ms and again 600 ms later. Resets, replacement nodes and hidden targets fail verification without an automatic retry or rollback. This bounded check cannot guarantee later site changes, rendered pixels, saving or submission.

To replace the whole program, select **Replace entire editor**, check the separate replacement confirmation, then import. **Undo last import** restores the previous value and selection only while that popup remains open and the editor has not changed. Do not rely on native Ctrl+Z; closing the popup discards its temporary undo backup.

Optional: copy your program and click **Or read clipboard**. Chrome may ask for clipboard-read permission. Saved-file import does not require that permission. Permission failure does not mean CodeTantra's paste restriction was fixed or bypassed.

## Execution diagnostics

Keep the popup open while testing, then expand **Execution diagnostics** below the status. It shows timestamped action starts/results for inspection, target selection, file/clipboard loading, import, both delayed checks, undo and observable popup failures. Warnings, possible partial writes and failed verification are distinct; there are no automatic retries or rollbacks.

The report keeps only the latest **100 entries in popup memory**. Closing the popup clears it. **Clear log** clears only diagnostics, not your source or undo backup. Review the visible **Report preview**, then explicitly click **Export report** to request a local text download before closing the popup. The downloaded file remains until you delete it.

Only fixed action/status/category messages and timestamps are included: no source, clipboard text, filenames, editor labels, URLs, account/student data, raw exception messages or stacks. Unknown errors are generic. Logs do **not** prove page saving, submission or live CodeTantra support. Share the exported report instead of copying private page details; the normal source/target previews are not part of the report.

## Safe local trial

Python 3 is needed only for this optional demo/test server. Open a terminal in the extracted `practice-program-import-fixed` folder and run:

```sh
python3 tools/serve.py --port 8766
```

On Windows, use `py tools/serve.py --port 8766` if `python3` is unavailable.

Open `http://127.0.0.1:8766/demo/` in Chrome. Place the cursor in the sample textarea, open the extension, approve the page, inspect it, and import `demo/sample.py`. Confirm the text appears and try **Undo last import** without closing the popup. Repeat at `http://127.0.0.1:8766/demo/frames.html` to test an iframe-only editor. Stop the demo server with Ctrl+C.

## What V1 supports

- Visible native textareas.
- Ace editors exposing their editor instance through the page element.
- CodeMirror 6 editors with a validated accessible view and one selection (tested with `@codemirror/view` 6.36.5 and 6.41.0). Uses model state/dispatch, not edits to rendered HTML.
- Main page and accessible same-origin iframes (including nested frames), with temporary user-triggered `activeTab` access. Each target shows its frame; import and undo stay pinned to that document and exact URL.
- Preview, cursor insertion, selection replacement, separately confirmed replace-all, read-back verification, and temporary extension-provided undo.
- Source limit: 200,000 characters; file byte limit: 800,000 bytes.

It fails safely on read-only/disabled editors, unsupported private editor instances, changed page/editor state, mismatched URL, and identified assessment/proctoring pages. The assessment detection is only a heuristic, **not** a guarantee that a page permits import. You remain responsible for authorization.

## CodeTantra status and troubleshooting

The reported “No supported writable top-frame editor” error came from a hard-coded frame-0-only scan. This working copy now discovers supported editors in accessible same-origin iframes and routes snapshot/import/undo to the selected frame. Reload the extension in `chrome://extensions`, refresh the practice page, and inspect again.

The live CodeTantra editor, iframe structure, permission context, saving behavior, and platform rules have not been inspected or verified. Same-origin frame discovery and validated CodeMirror 6 support do not establish compatibility with every CodeTantra configuration; the user must retest on an authorized practice page.

A [public community integration](https://github.com/amandotyadav/codetantra-ai/blob/ea7c33412bfacdf1e6aa2e7a390ffcbef6c7287c/src/utils/extract.ts#L87-L92) reads `.cm-content`, suggesting CodeMirror 6 in at least one configuration—not evidence about your tenant. This adapter uses the [official EditorView API](https://codemirror.net/docs/ref/#view.EditorView) and [readOnly state](https://codemirror.net/docs/ref/#state.EditorState.readOnly), with a narrowly guarded, version-sensitive DOM-to-view discovery link. Inaccessible or unfamiliar instances fail closed. No assessment or paste restrictions are bypassed; native Ctrl+Z, autosave and submission are not promised.

- **No supported writable editor:** Monaco, CodeMirror 5 and private/incompatible CodeMirror 6 or Ace instances remain unsupported. If CodeMirror 6 markup is detected but its view/selection cannot be validated, the popup and privacy-safe execution report identify that capability limitation. Use one selection in a visible permitted practice editor and inspect again; otherwise ask the site for an approved import method. Cross-origin, sandboxed/inaccessible, hidden, and `about:blank`/`srcdoc` frames are not supported by this build. No broad host permissions are requested. If the error remains, export the execution report. Further compatibility investigation requires separately authorized, privacy-reviewed page evidence.
- **Editor changed:** the false alarm caused by comparing JSON property order across Chrome messages is fixed. Reload the extension in `chrome://extensions`, refresh the practice page, and inspect again. Snapshot fields are now compared by value. If an actual change occurs, the error identifies **content**, **selection**, or **identity**; close the popup, set the cursor, reopen it and inspect again. No stale content is overwritten.
- **Reported import but no visible change:** reload this updated extension and inspect again. Earlier builds chose the first writable editor and checked only its immediate value. The updated build prefers the focused editor, excludes invisible helper inputs, shows the selected target's contents, and performs two delayed checks. If the contents do not match your code editor, choose the correct target; do not import into an unrelated input. If the problem persists, export the execution report; do not share source previews, private labels or URLs. Live CodeTantra remains unverified.
- **Invalid UTF-8:** resave the source as UTF-8 in VS Code.
- **Clipboard access failed:** use the saved-file input or paste into the extension preview.
- **Managed browser blocks Developer mode:** contact the administrator. Do not weaken its security controls.
- **Extension load error:** confirm you extracted the ZIP and selected the folder containing `manifest.json`.

## Privacy and verification boundary

The extension has no backend, telemetry, persistent storage, or explicit source upload. It reads files or clipboard text only after your action. Clipboard permission is optional. Code and undo data remain in temporary popup memory. Importing text into a website makes that text available to that website; its own autosave/server behavior still applies. MAIN-world editor integration shares the page's JavaScript environment, so use a trusted authorized page.

No autosubmission, monitoring changes, simulated typing, exam-policy changes, or restoration of native Ctrl+V are included.

See `TESTING.md` for real local test results and remaining verification. Source, tests and demo are included.

## What changed in 1.0.1

The original ZIP put its manifest at `practice-program-import-v1/extension/manifest.json`. Choosing the outer folder in Load unpacked therefore produced a missing-manifest error. This ZIP has one `manifest.json` at its root, pointing to `extension/popup.html`; popup CSS and module imports retain their correct relative paths. Snapshots now track the actual editor DOM node, so replacement/reordered editors cannot silently inherit approval. Disabled fieldsets are respected. If a website rewrites the value or a write fails partway, stale Import/Undo actions are cleared and the popup warns that the editor may have changed; inspect again. There is no automatic rollback of site edits. No permissions were added. The bundled test documentation and regression checks now match this layout. Source, tests, and local demo are preserved.

Official installation reference: https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world
