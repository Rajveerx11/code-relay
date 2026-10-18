# Visible-target and delayed-write verification

This working copy retains manifest version 1.0.1; no release bump or permission changes were made.

## Passed

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

`VERIFICATION.json` records current verification and production hashes. `CHECKSUMS.sha256` covers every other bundled file; no ZIP was created or verified in this repair.
