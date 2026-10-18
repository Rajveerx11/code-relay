# Verification

## Execution diagnostics (#10)

Current local validation on Windows, Node v24.19.0:

- `node --test tests/*.test.mjs`: **47/47 passed**. New direct diagnostics tests cover fixed vocabulary (including hostile strings/objects), timestamp shape, 100-entry retention, clear, exact serialization/export and cleanup failures. Actual popup/controller tests cover safe file/clipboard failures, successful import/undo, both delayed checks, partial writes, unknown errors, observable global failures and diagnostic failures without workflow interruption. Existing frame and serialized-adapter tests also assert warning/failure/success logging.
- `node --check extension/diagnostics.mjs` plus all existing production modules and edited/new test modules: passed. CI includes the new production module; no permissions or dependencies changed.
- Browser-rendered tests: **15/15 passed**, installed Playwright 1.62.0 / Chromium 151.0.7922.34, **sandbox enabled**. Target: `http://127.0.0.1:8766/tests/ui.html`, viewports 1280×1000 and 520×900 (450px popup within a fixture iframe). Existing bridge UI/file/replace/undo flows passed. Diagnostics passed keyboard expansion/focus, privacy, clear, exact native Blob download vs preview, a real page reset after 300 ms failing check 2, a real partial mutation/throw, generic error/rejection events, export-failure containment and empty logs in a new popup realm. No page/console errors or failed requests in the final run. Screenshots were inspected: report wraps within the popup, scrolls at a bounded height, and both controls and lifetime/privacy notices are visible.
- Reproduction script and artifacts are local, outside the repository: `C:/Users/rajve/AppData/Local/Temp/code-relay-diagnostics-browser.cjs` and `C:/Users/rajve/AppData/Local/Temp/code-relay-diagnostics-browser/` (`results.json`, `export.txt`, `diagnostics-1280.png`, `diagnostics-520.png`). Command: `NODE_PATH='C:/Users/rajve/.codex/skills/playwright-skill/node_modules' node 'C:/Users/rajve/.agents/skills/playwright-skill/run.js' 'C:/Users/rajve/AppData/Local/Temp/code-relay-diagnostics-browser.cjs'`. The runner reused installed dependencies; nothing was installed. Its task-owned server/browser were closed afterwards.
- LSP diagnostics are blocked: the delegated toolset has no LSP tool and `typescript-language-server` is unavailable. Syntax and runtime checks are not a substitute for LSP diagnostics.

These are **bridge fixtures, not installed-extension or live CodeTantra verification**. Native extension permissions/download behavior, actual CodeTantra execution, saving/submission and later site changes remain unverified. Closing a real Chrome popup was not tested; a new fixture popup realm was checked for fresh memory. Independent OCR review and CodeRabbit remain publication gates owned by the parent task. Issue #6 remains open; this is only its execution-log slice. Historical evidence below and the checksum/verification files remain untouched.

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

A different installed Chromium revision was found and used without disabling its sandbox. With the local server running, this exact command passed:

```sh
/home/rajveer/.nvm/versions/node/v22.22.3/bin/node /mnt/c/Users/rajve/.codex/skills/playwright-skill/run.js /tmp/practice-import-browser-check.cjs
```

The temporary script accepts `PRACTICE_URL`, `PRACTICE_OUTPUT` and `CHROMIUM_PATH`. Results: `/tmp/practice-import-browser-results.json`; target: `http://127.0.0.1:8766`; fixtures: `/tests/ui.html`, `/demo/frames.html`, `/tests/safety.html`, `/tests/browser.html`. The test browser and local server were closed afterwards. This script is a local verification artifact, not a bundled extension dependency.

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
