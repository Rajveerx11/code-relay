# Verification

## Run the current checks

Use Node 22 or 24 from the repository root; no dependency install is required:

```sh
node --test
node --check extension/core.mjs
node --check extension/diagnostics.mjs
node --check extension/editor-adapter.mjs
node --check extension/popup.mjs
git diff --check
```

For browser fixtures, start `python3 tools/serve.py --port 8766` (Windows: `py -3 tools/serve.py --port 8766`). Open each URL below and run its console command **only in the local fixture, never on a third-party page**:

| Local path under `http://127.0.0.1:8766` | Console command | Current cases |
| --- | --- | ---: |
| `/tests/cm6-browser.html` | `await runCM6Tests()` | 26 |
| `/tests/browser.html` | `await runTests()` | 2 |
| `/tests/safety.html` | `runSafetyTests()` | 13 |
| `/tests/ui.html` | `await runUI()`, then `await runSavedFileTests()` | 3 + 3 |

Check every result has `ok: true`; library-load/network errors are failures, not skipped successes. The Ace/CM6 fixtures fetch pinned test libraries from CDNs and need network access; the extension runtime does not fetch those libraries. Keep browser sandboxing enabled. Stop the local server afterwards.

The latest recorded runtime result is **68 Node tests and 47 browser-fixture checks passed**. These are local models/bridges, not native installed-extension or site-persistence verification. Historical counts below describe earlier revisions. Maintainer-local automation scripts and screenshots are not included in downloads; the committed fixtures above are the portable reproduction path.

The open-source documentation update does not change runtime code or permissions. `CHECKSUMS.sha256` and `VERIFICATION.json` remain historical evidence from commit `0371205`, not verification of the current source ZIP.

## Default whole-editor replacement and formatting (#14)

- Root cause: the old popup selected cursor/selection insertion by default. The existing confirmed full-replacement adapter already uses the full document range; its mutation code is unchanged in this follow-up.
- The production-HTML default regression failed before changing the popup and now passes: replace mode explicitly selected, confirmation visible and unchecked, selection mode retained as opt-in.
- Windows Node v24.19.0: `node --test tests/*.test.mjs` — **68/68 passed**. New serialized popup/adapter tests cover textarea, Ace and CM6 with both a cursor and partial selection, exact tabs/spaces/blank lines/trailing whitespace/newline/Unicode after BOM/CRLF normalization, confirmation gating, one import request, both delayed checks and undo.
- Installed Playwright 1.62.0 / Chromium 151.0.7922.34, sandbox enabled: **47/47 browser checks passed** — 26 real CM6 checks (view 6.36.5 and 6.41.0 with state 6.6.0) and 21 legacy checks. The real popup defaults are exercised, not overridden to simulate replacement. Added real CM6 LF/CRLF full-document formatting equality and backward undo. Legacy textarea cursor insertion is explicitly selected separately. No page/console/request errors.
- Node syntax checks and `git diff --check` passed. Production JavaScript/manifest/permissions are unchanged by this follow-up; only the popup HTML default/help copy changes runtime behavior. No formatter or dependency was added.
- Maintainer-local evidence (not bundled): `code-relay-replace-node-results.txt`, `code-relay-replace-browser-results.json`, and `code-relay-replace-popup.png`. The popup screenshot was inspected: default replacement and unchecked confirmation are visible. Native-extension/site saving behavior is still outside these bridge fixtures.
- Original logo: `assets/code-relay-logo.svg`, rendered with sandboxed Chromium to the 512px `assets/code-relay-logo.png`; both were visually inspected. The README embeds the SVG and links the PNG. No external asset or font is loaded by the logo.

The browser reproduction procedure below uses the current committed fixtures and therefore runs these newer checks. Historical counts below describe their respective earlier runs, not the current suite. LSP remains unavailable because `typescript-language-server` is missing; no clean LSP result is claimed.

## Validated CodeMirror 6 practice editors (#12, prior change)

Local Windows validation, Node v24.19.0:

- Before editing production code, `node --test tests/cm6.test.mjs` reproduced the discovery failure: a CM6 wrapper with a validated accessible model returned **0 editors instead of 1**. The focused regression now passes.
- `node --test tests/*.test.mjs`: **61/61 passed** after independent-review hardening (initial implementation: 60/60). A regression first reproduced writes into effectively non-editable DOM with mixed-case or removed `contenteditable`; both model and effective DOM editability are now checked, with real-library negative coverage on both versions. Added CM6 fake/API guards and serialized real-popup transport coverage: both DOM-link shapes, CRLF/Unicode offsets, backward selection restoration, view replacement on the same wrapper, content-node replacement, readonly/editable/DOM flags, multiselection, size/NUL limits, confirmation, filtered writes and both delayed reset samples. The unsupported-capability report uses fixed vocabulary without source, labels or URLs.
- `node --check` on all production `.mjs` files plus new/edited CM6 and roundtrip modules, and `git diff --check`: passed. No production dependency, permission or manifest changes.
- Installed Playwright **1.62.0** runner, sandbox-enabled Chromium **151.0.7922.34**: **22/22 CM6 cases passed**, eleven per real `@codemirror/view` **6.36.5** (`cmView`) and **6.41.0** (`cmTile`), sharing `@codemirror/state` **6.6.0**, which satisfies both view packages' declared state dependency ranges. The test-only esm.sh imports are pinned; an import map ensures one state module rather than incompatible duplicated bundles. The parent reran all 42 browser checks after correcting the initial fixture's out-of-range state 6.5.2 pairing for view 6.41.0. Cases include actual virtualized documents, LF/CRLF, Unicode, backward undo, multiple editors/selections, readonly and editable facets, stale nodes/links, transaction filters, and popup import/undo with both delayed checks and site resets at each sample. Same-wrapper owner replacement is covered with a controlled API fake, not claimed as a real-library lifecycle feature.
- Existing browser fixtures also passed **20/20**: textarea, real Ace **1.45.0**, safety checks, popup clipboard/file/replace/undo. Final run: **42/42 total**, no page errors, console errors or failed requests. A test route serves an empty favicon; no browser security flags were disabled.
- LSP remains blocked: no LSP tool in this worker and `command -v typescript-language-server` / `command -v lsp` found no available executable. Nothing was installed. Syntax/runtime checks do not replace LSP diagnostics.

Reproduce the committed browser fixture using the current-checks table above. The result array and page output show every version/case; CDN/network failures are failures, not skipped successes. Original automation used a maintainer-local Playwright runner with `CM6_URL` and `CM6_OUTPUT`, producing `code-relay-cm6-browser-results.json`. That temporary runner is not bundled or required to run the committed fixtures.

These are **local real-library and test-bridge results, not native installed-extension or live CodeTantra evidence**. User retesting on an authorized practice page remains necessary. No clipboard/assessment restrictions were bypassed. Native Ctrl+Z, permissions, saving/submission, incompatible/private instances, future internal-link changes and resets after the bounded checks remain unverified. Review and CI evidence for that implementation is recorded in [PR #13](https://github.com/Rajveerx11/code-relay/pull/13). Historical results below, `CHECKSUMS.sha256` and `VERIFICATION.json` are unchanged historical evidence; historical statements that all CodeMirror versions are unsupported are superseded only by this narrowly validated CM6 support.

## Execution diagnostics (#10, prior change)

Current local validation on Windows, Node v24.19.0:

- `node --test tests/*.test.mjs`: **48/48 passed** after the PR review follow-up (initial diagnostics implementation: 47/47). New direct diagnostics tests cover fixed vocabulary (including hostile strings/objects), timestamp shape, 100-entry retention, clear, exact serialization/export and cleanup failures. Actual popup/controller tests cover safe file/clipboard failures, successful import/undo, both delayed checks, partial writes, unknown errors, observable global failures and diagnostic failures without workflow interruption. Existing frame and serialized-adapter tests also assert warning/failure/success logging. A new regression first failed when delayed verification discarded known safe reset/replacement explanations; it now proves those explanations survive in workflow status while the report remains category-only and unknown errors remain generic.
- `node --check extension/diagnostics.mjs` plus all existing production modules and edited/new test modules: passed. CI includes the new production module; no permissions or dependencies changed.
- Browser-rendered tests: **15/15 passed**, installed Playwright 1.62.0 / Chromium 151.0.7922.34, **sandbox enabled**. Target: `http://127.0.0.1:8766/tests/ui.html`, viewports 1280×1000 and 520×900 (450px popup within a fixture iframe). Existing bridge UI/file/replace/undo flows passed. Diagnostics passed keyboard expansion/focus, privacy, clear, exact native Blob download vs preview, a real page reset after 300 ms failing check 2, a real partial mutation/throw, generic error/rejection events, export-failure containment and empty logs in a new popup realm. No page/console errors or failed requests in the final run. Screenshots were inspected: report wraps within the popup, scrolls at a bounded height, and both controls and lifetime/privacy notices are visible.
- Reproduction script and artifacts were maintainer-local, outside the repository: `code-relay-diagnostics-browser.cjs` and a results directory containing `results.json`, `export.txt`, `diagnostics-1280.png` and `diagnostics-520.png`. That automation is not bundled; use the current committed browser fixtures above for portable reproduction. The historical runner reused installed dependencies; nothing was installed. Its task-owned server/browser were closed afterwards.
- LSP diagnostics are blocked: the delegated toolset has no LSP tool and `typescript-language-server` is unavailable. Syntax and runtime checks are not a substitute for LSP diagnostics.

These are **bridge fixtures, not installed-extension or live CodeTantra verification**. Native extension permissions/download behavior, actual CodeTantra execution, saving/submission and later site changes remain unverified. Closing a real Chrome popup was not tested; a new fixture popup realm was checked for fresh memory. Review and CI evidence for that implementation is recorded in [PR #11](https://github.com/Rajveerx11/code-relay/pull/11). Issue #6 remains open; this is only its execution-log slice. Historical evidence below and the checksum/verification files remain untouched.

## Repository foundation checks (prior change)

The Windows packaging regression is fixed with platform-independent `basename()` matching. Local validation on Windows, Node v24.19.0:

- `node --test tests/*.test.mjs`: **34/34 passed** (baseline before the fix: 33/34).
- `node --check extension/core.mjs`, `node --check extension/editor-adapter.mjs`, and `node --check extension/popup.mjs`: passed.
- A temporary additional nested `manifest.json` caused the root-manifest test to fail as expected; the temporary fixture was removed afterward.
- `.github/workflows/ci.yml` runs these tests and syntax checks on Windows/Linux with Node 22/24. Consult GitHub Actions for actual CI results.
- Production extension code, version and permissions are unchanged. No browser or live CodeTantra validation was performed for this foundation change.

`CHECKSUMS.sha256` and `VERIFICATION.json` retain the imported baseline evidence at commit `0371205`; they do not attest to the current tests/docs or new repository files. Check them against that baseline, not the modified working tree. Release artifact regeneration is tracked in GitHub issue #8.

## Historical visible-target and delayed-write verification

The rest of this document records earlier verification imported with the project. Tool versions, external temporary paths and browser results below are historical, not newly reproduced results.

That working copy retained manifest version 1.0.1; no release bump or permission changes were made.

### Passed

- `node --test tests/adapter.test.mjs tests/roundtrip.test.mjs tests/frames.test.mjs tests/popup.test.mjs`: 30/30 passed, exit 0.
- `node --test tests/*.test.mjs`: 34/34 passed, exit 0, Node v18.19.1.
- `node --check extension/editor-adapter.mjs && node --check extension/popup.mjs && node --check tests/adapter.test.mjs && node --check tests/roundtrip.test.mjs && node --check tests/frames.test.mjs && node --check tests/popup.test.mjs`: passed, exit 0.
- Chromium browser fixtures: 19/19 passed, exit 0; Chrome for Testing 148.0.7778.96, sandbox enabled, 1280×1000 viewport. Real textarea and Ace 1.44.0 import/undo, readonly safeguards, popup flow using the test-only Chrome bridge, real iframe focus ancestry, and a site reset after 300 ms were exercised. Final run: no console/page errors or failed requests. The harness serves an empty favicon because the scoped demo server does not provide one.
- Package tests confirm root manifest/popup paths, module imports, DOM IDs, and unchanged permissions: `activeTab`, `scripting`; optional `clipboardRead`.

The initial focused run had seven adapter failures because Node 18's module/test runtime did not expose global Web Crypto. The test harness now supplies Node's `webcrypto`; production browser code is unchanged for this issue. All tests passed after that correction.

The tests use small DOM and Chrome API fakes. A new regression reproduced the exact “Editor content, selection or identity changed” error by reordering snapshot object keys without changing any data. Before the fix, `node --test --test-name-pattern='snapshot comparison survives Chrome' tests/adapter.test.mjs` failed (exit 1, one failure, ten skipped). Field-wise comparison fixes it while preserving content, selection bounds/direction and node-identity checks. Errors now identify the field that really changed.

`tests/roundtrip.test.mjs` runs the actual popup and serialized adapter in separate JavaScript contexts with sorted-key message transport. Textarea and fake Ace import/undo succeed, and real content changes still disable stale popup actions. These are integration fixtures, not real Chrome or Ace-library verification.

Iframe-only discovery, document/URL routing, duplicate editor ordinals, parent/child navigation, removed/hidden/nested frames, assessment checks, denied injection, cross-origin exclusion, readonly, size, Unicode and partial-write safeguards still pass.

The current repair first reproduced three false-success cases with `node --test --test-name-pattern='does not report success' tests/roundtrip.test.mjs` (exit 1; three failed, two skipped): site reset, node replacement and hiding after an immediately successful write. All now pass. Focused iframe preference, explicit selection when multiple targets are ambiguous, invisible helper exclusion, target-content preview and read-only delayed verification are covered. Verification samples occur after 150 ms and a further 600 ms; later site changes are still possible.

## Browser evidence

A different installed Chromium revision was found and used without disabling its sandbox. The historical run used a maintainer-local Node/Playwright runner (`practice-import-browser-check.cjs`) with `PRACTICE_URL`, `PRACTICE_OUTPUT` and `CHROMIUM_PATH`. It produced `practice-import-browser-results.json` against `http://127.0.0.1:8766`, exercising `/tests/ui.html`, `/demo/frames.html`, `/tests/safety.html` and `/tests/browser.html`. The test browser and local server were closed afterwards. This script is a local verification artifact, not bundled or required to run the current committed fixtures.

## Not verified

- Real Chrome extension installation, `activeTab` frame grants or permission prompts (the browser popup tests use a test-only Chrome API bridge).
- Live CodeTantra compatibility, rendered CodeTantra changes or its server saving/submission.
- Actual clipboard permission prompts or native Ctrl+Z.
- Changes after the bounded verification window.

No browser/security policy was changed. The new status identifies the selected editor and describes read-back checks rather than claiming that application saving or visible CodeTantra rendering is verified.

Cross-origin, inaccessible/sandboxed, hidden, `about:blank` and `srcdoc` frames remain unsupported. Monaco, CodeMirror and private Ace instances remain unsupported. The extension does not request broad host access or import into detected assessments.

## Reproduce

1. Run `node --test tests/*.test.mjs`.
2. Start `python3 tools/serve.py --port 8766` (Windows: `py tools/serve.py --port 8766`).
3. Load or reload this folder in `chrome://extensions`.
4. Open `http://127.0.0.1:8766/demo/frames.html`. Click in the embedded textarea, approve the practice page in the popup and inspect. Confirm the target label identifies an iframe.
5. Import `demo/sample.py`; verify the embedded editor changed. Undo while the popup stays open; verify value/selection restoration.
6. Repeat with `http://127.0.0.1:8766/demo/` to check top-frame behavior.
7. To verify stale-document protection, reload the selected iframe between inspection and import: import must fail and require inspection again, not target a replacement editor.
8. Existing optional browser fixtures remain at `/tests/browser.html`, `/tests/safety.html` and `/tests/ui.html`. These use a test-only bridge, not Chrome's real frame permissions. The Ace fixture fetches an external library.

For that historical repair, `VERIFICATION.json` recorded verification and production hashes, and `CHECKSUMS.sha256` listed the other files in that bundle. Neither file covers all current repository additions or modifications. No ZIP was created or verified in that repair.
