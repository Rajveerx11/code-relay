# Architecture

## Overview

Practice Program Import — V1 is a **popup-driven Chrome Manifest V3 extension**. The popup owns the workflow and temporary state; a self-contained injected function discovers, reads and updates supported editors in the selected page document. There is no production server, service worker, database or persistent content script.

Project setup, support boundaries and current verification status are in [CONTEXT.md](CONTEXT.md). End-user instructions are in [README.md](README.md).

```text
User-selected file / optional clipboard / manual preview
                         |
                         v
manifest.json --> extension/popup.html + popup.css
                         |
                         v
                 extension/popup.mjs
                  |              |
                  v              v
          core.mjs          chrome.scripting.executeScript
       validateScope()       world: MAIN, func: pageEditor
                                      |
                                      v
                          extension/editor-adapter.mjs
                          executed in selected document
                               |                |
                               v                v
                         Native textarea    Exposed Ace
                               \                /
                                snapshots/results
                                      |
                                      v
                          Popup verification and undo
```

The diagram is a logical dependency/data-flow view. The adapter module is imported by the popup; Chrome serializes `pageEditor()` for execution in the target document rather than loading that module as a page script.

## Runtime components

### Manifest and popup surface

`manifest.json` declares version `1.0.1`, minimum Chrome `106`, required `activeTab`/`scripting` permissions and optional `clipboardRead`. The action opens `extension/popup.html`, which loads local CSS and `popup.mjs` as an ES module.

The extension-page CSP is `script-src 'self'; object-src 'none'; connect-src 'none'`. There are no declared host permissions, background scripts, content scripts or web-accessible resources. The popup does not fetch a backend.

`popup.html` provides three workflow stages: approve/inspect, bring source text into a preview, and deliberately import or undo. Source and target text are displayed through control values/text content, not interpreted as HTML.

### Popup controller: `extension/popup.mjs`

The controller owns:

- Active-tab lookup and exact approved top-page URL checks.
- Consent, input validation and UI availability.
- File decoding via fatal UTF-8 `TextDecoder`; optional clipboard permission/read.
- Frame discovery, target selection and target-content preview.
- `chrome.scripting.executeScript()` calls and response validation.
- Temporary snapshots, one undo backup, and bounded delayed write verification.

Its in-memory state has these fields:

| Field | Meaning |
| --- | --- |
| `tab` | Tab and exact top-level URL captured at inspection. |
| `topDocumentId` | Chrome identity of the inspected enclosing document. |
| `editors` | Discovered editor descriptors plus frame/document IDs and frame URL. |
| `selected`, `target` | Selected descriptor and its document-local adapter ordinal. |
| `snapshot` | Last accepted content, selection and node identity. |
| `undo` | Pre-import restore snapshot and expected post-import snapshot. |
| `busy` | Serializes UI actions and disables conflicting controls. |

`guarded()` manages busy/error status. `resetTarget()` clears the target, approval snapshot and undo state, but does not erase the source preview. The Clear action explicitly clears the preview/file input too. Closing the popup discards its JavaScript state.

### Execution diagnostics: `extension/diagnostics.mjs`

Each popup creates a memory-only log capped at 100 entries, evicting the oldest. `record()` accepts only allowlisted action/status/category tokens and generates its own ISO timestamp and fixed message; it does not accept arbitrary detail objects or exceptions. `serialize()` produces the same plain text shown with `textContent` in the expandable report preview. Clear affects only this log. Export uses a native Blob/object URL and temporary download anchor with a fixed filename, then removes the anchor and revokes the URL. A download request is not confirmation that the user saved the file.

The controller records inspection/target choice, source loading, import/undo and each of the two read-only delayed checks. Failed checks and possible partial writes never become a successful operation result. Observable `error` and `unhandledrejection` events produce generic entries without reading their payloads. Diagnostic formatting/render/export failures are contained and never recursively reported. Unknown workflow exceptions also receive a generic status; only locally created failures and explicitly allowlisted fixed adapter messages retain detailed workflow status.

No source, clipboard text, filenames, editor labels, URLs, identities, account/student data, raw exception messages or stacks enter this report. Existing source/target previews remain separate. Closing the popup discards the log; an explicitly exported file remains outside the extension. No storage, permissions, backend or dependencies were added. Logs cannot establish saving/submission, errors in unrelated page contexts, or live CodeTantra support. This is issue #10's execution-log slice, not completion of #6's compatibility diagnostics.

### Scope validator: `extension/core.mjs`

`validateScope(current, approved, consent)` is a pure helper. It requires consent and exact URL equality, accepts HTTPS or HTTP loopback hosts (`localhost`, `127.0.0.1`, `[::1]`), rejects embedded URL credentials, and rejects assessment-like URL keywords.

The injected adapter repeats scope checks and adds document/ancestor checks because it executes in a different JavaScript environment. It cannot rely on imported helpers or popup closures.

### Page adapter: `extension/editor-adapter.mjs`

`pageEditor(request)` is the sole injected entry point. It catches failures and returns structured results rather than depending on extension APIs inside the page.

Supported operations:

| Operation | Behavior |
| --- | --- |
| `validate` | Validate the current document/ancestor scope without discovering editors. |
| `inspect` | Discover visible supported editors and report metadata/frame presence. |
| `snapshot` | Read the selected writable editor and its selection/node identity. |
| `insert` | Check the expected snapshot and perform the requested insertion/replacement. |
| `undo` | Check the expected snapshot and restore the saved value/selection. |
| `verify` | Rediscover and read the current editor; compare content/identity without writing. |

The function must remain **self-contained**: Chrome's function serialization does not carry module imports or closure variables into the page.

## Editor abstraction

The adapter builds a document-local array of candidates from `textarea, .ace_editor, .cm-editor`. Candidates need a connected, nonzero layout rectangle and visible ancestry; hidden attributes, `aria-hidden`, collapsed/hidden visibility and zero opacity exclude them. Textarea implementation inputs inside Ace, Monaco and CodeMirror are excluded.

Each supported editor is wrapped in a small local interface: read value/selection, replace a range, restore selection, determine newline/size limits, report readonly status and notify the application.

- **Textarea:** uses `setRangeText()` and `setSelectionRange()`, respects readonly/disabled state including disabled fieldsets, honors `maxLength` within the global limit, and dispatches a bubbling `input` event.
- **Ace:** requires an exposed `element.env.editor` with the expected document/selection APIs. Uses Ace position/index conversion, session range replacement, selection ranges, newline format and undo-group boundaries. Ace's APIs perform its own notifications.

- **CodeMirror 6:** bootstrap only from the matched wrapper's single `.cm-content` using `cmView.rootView.view` (view 6.36.5) or `cmTile.root.view` (view 6.41.0). These links are **internal and version-sensitive**, not a compatibility promise. Validate the candidate's public `constructor.findFromDOM(wrapper)` result, exact `dom`/`contentDOM`, connected visible nodes, state/document/selection APIs and dispatch before offering it. Reject conflicting links, inaccessible APIs and multiple selections. Both `state.readOnly` and `EditorView.editable` plus DOM readonly/disabled flags and effective `contentDOM.isContentEditable` apply. There is no page-global search or DOM mutation fallback.

CM6 snapshots use `state.doc.toString()` (the full model, not virtualized rendered lines). Model positions count LF even for a CRLF-configured state. Incoming text is normalized to canonical LF; before dispatch it is converted to the configured `state.lineBreak` and then to `Text` via `state.toText()`. The inserted Text's verified length determines the cursor. Undo restores text and the original backward/forward selection in one dispatch; native Ctrl+Z semantics are not promised. CodeMirror 5, Monaco and private/incompatible instances remain unsupported. Detection failures expose only a boolean capability flag to the popup; diagnostic entries use fixed vocabulary, not labels, URLs or source.

Primary references: [EditorView API](https://codemirror.net/docs/ref/#view.EditorView), [EditorState API](https://codemirror.net/docs/ref/#state.EditorState), upstream [6.36.5 findFromDOM](https://github.com/codemirror/view/blob/6.36.5/src/editorview.ts#L1148) and [6.41.0 findFromDOM](https://github.com/codemirror/view/blob/6.41.0/src/editorview.ts#L1194). These inspected versions justify only the guarded bootstrap, not all versions or live CodeTantra support.

The adapter does not synthesize typing, re-enable paste, submit forms or change monitoring controls.

## Discovery and document routing

1. The user approves a permitted page and clicks Inspect. The popup captures the active tab and validates its exact URL.
2. An initial `inspect` targets frame `0`; Chrome's returned `documentId` becomes `topDocumentId`.
3. If the top document reports frames, the popup attempts an `allFrames` inspection with `discover: true`. Discovery permits differing frame URLs only within the approved origin. Denied injection falls back to the known top-frame result with a warning.
4. Successful results with document identities and matching origins are merged, sorted by frame ID and labeled for the UI.
5. A unique focused writable editor is preferred; otherwise a sole writable editor is selected. Multiple ambiguous writable editors require an explicit choice.
6. Selection obtains a fresh snapshot and displays its first 1,000 characters.

Frame focus follows the active iframe ancestry so stale focus in an inactive child is not treated as the current editor focus. Hidden/inaccessible frames and assessment-marked ancestors fail closed.

Every subsequent `invoke()` rechecks the active tab and exact top URL, validates the original top document by `documentIds`, then routes to the selected document by its own `documentId` and exact frame URL. Response frame/document IDs must match. This prevents same-URL reloads or replaced child documents from inheriting approval. A document-local target ordinal alone is not sufficient authority to write.

## Snapshot and write contracts

A snapshot contains:

```text
value
start, end, direction
identity = [element id, name, kind, label, node token]
```

For CM6, identity additionally includes tokens on the view owner and content DOM node. Replacing a view on the same wrapper, or replacing the content node, cannot inherit the old snapshot.

The node token is a UUID held on the actual DOM node through a non-enumerable `Symbol.for('practice-program-import.editor-identity.v1')` property. Separate injected calls can recognize the same node, while ordinary DOM cloning/replacement does not copy that token.

Before insert or undo, the adapter compares content, identity and selection fields. Comparisons do not rely on snapshot object key order across Chrome serialization. `verify` compares content and identity but allows harmless cursor movement.

Insertion additionally validates non-empty text, NUL exclusion, the 200,000-code-unit source/result limits, insertion mode, replace-all confirmation, editor writability and textarea limits. Source line endings are converted to the editor's format before range replacement.

These are stale-target safeguards for trusted pages, not isolation from hostile page JavaScript: MAIN-world objects and editor APIs are controlled by the page.

## Import, verification and undo lifecycle

```text
Approve -> Inspect -> Choose target -> Snapshot
                                  -> Load/edit source preview
                                  -> Import once
                                  -> Immediate read-back
                                  -> Wait ~150 ms -> verify
                                  -> Wait another ~600 ms -> verify
                                  -> Keep snapshot + single undo backup
                                  -> Undo once, with the same verification cycle
```

The preview can be loaded before inspection; a valid inspected snapshot and consent are still required for Import.

After import, `undo` holds `{restore: before, expected: verified}`. Undo checks that the editor still matches the expected post-import state before restoring the prior content and selection. A subsequent successful import replaces the previous backup; successful undo clears it. Target changes, consent changes, reinspection and failed routed operations invalidate stale actions.

A write is not transactional. The adapter sets `mutationPossible` before attempting a mutation and immediately checks the resulting value after notification. If the site rejects a write, changes/replaces/hides the editor, navigation occurs or a delayed check fails, the popup reports failure and clears Import/Undo approval. It never retries the write or automatically rolls back site changes.

The delayed samples occur roughly 150 ms and 750 ms after the write, subject to scheduling. Passing them proves only the sampled editor value/identity, not rendered pixels, later persistence, site saving or submission.

## Data and trust boundaries

- File bytes, clipboard text and manually entered preview text enter popup memory only through user actions.
- Source and expected/restore snapshots cross the Chrome scripting boundary as request arguments; results return through Chrome's serialization boundary.
- The page receives imported code and can read it or transmit it through its own behavior.
- There is no persistent extension data model, telemetry pipeline or explicit extension source-upload endpoint.
- Consent and assessment detection are safety gates, not proof that platform rules permit import.
- Clipboard access is an optional separate permission path; clipboard failure does not establish that a website's paste policy was changed.

## Tests and development tooling

| Layer | Files and coverage |
| --- | --- |
| Pure scope | `tests/core.test.mjs`: approval, URL and protocol boundaries. |
| Adapter unit | `tests/adapter.test.mjs`: small DOM fakes, text/selection/identity invariants and mutation failures. |
| Diagnostics | `tests/diagnostics.test.mjs`, `tests/popup-diagnostics.test.mjs`: vocabulary/redaction, bounded retention, clear/export/cleanup and actual controller success/failure/check logging with small fakes. |
| Popup wiring | `tests/popup.test.mjs`: fake DOM/Chrome APIs, state and error invalidation. |
| Frame routing | `tests/frames.test.mjs`: fake frame/document responses, focus, navigation and denied access. |
| Serialization integration | `tests/roundtrip.test.mjs`: actual popup and serialized adapter in separate JS contexts with sorted-key transport; fake textarea/Ace/CM6, including both delayed-reset samples. |
| Package layout | `tests/package.test.mjs`: root manifest, permissions, imports, paths and DOM IDs. |
| Browser fixtures | `tests/browser.html`, `tests/safety.html`, `tests/ui.html`: real DOM exercises; popup uses `tests/bridge.js`, not native extension grants. `tests/saved-file.mjs` adds file-flow checks. |

`tests/cm6-browser.html` / `tests/cm6-browser.mjs` load pinned real view 6.36.5 and 6.41.0 with state 6.6.0 from esm.sh. The fixture tests virtualized text, CRLF/Unicode offsets, backwards undo, explicit target selection, readonly/editable, stale nodes, filtered transactions and actual popup delayed checks through a test-only bridge. It is not native extension or live tenant evidence.

`tests/browser.html` loads the real Ace library from `https://ace.c9.io/build/src/ace.js`; this optional fixture has an external network dependency, unlike the production extension. Fixture functions are invoked explicitly (for example, `runTests()`, `runSafetyTests()` and `runUI()`).

`tools/serve.py` serves local fixtures with Python's `ThreadingHTTPServer`. It is outside the production runtime. Historical browser automation referenced in `TESTING.md` used a temporary script not included in this project.

The package-test Windows path-separator failure is fixed using native `basename()` matching; that foundation change passed 34/34 locally. See [TESTING.md](TESTING.md) for current diagnostics validation. `.github/workflows/ci.yml` defines Windows/Linux coverage on Node 22/24, with pinned actions and read-only permissions. `.gitattributes` preserves LF text checkouts, and `.gitignore` excludes local credentials/generated artifacts. See [CONTEXT.md](CONTEXT.md) and GitHub Actions for verification scope and actual CI results. Neither these fixtures nor historical browser evidence verify a native installed-extension permission flow or live CodeTantra behavior.

## Change boundaries

- Keep production runtime files in `extension/` and the only manifest at the project root.
- Keep injected logic closure-free; test serialization and real page behavior when changing it.
- Preserve the separation between inspection, one-time mutation and read-only verification.
- Preserve top-document validation before child operations and exact document/URL pinning.
- Keep test bridges out of production entry points and manifest exposure.
- Treat `VERIFICATION.json` and `CHECKSUMS.sha256` as recorded bundle evidence, not automatically current claims after future edits.
