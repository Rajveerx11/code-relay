# Project Context

## Scope and purpose

This document applies only to this project folder. It is a source-grounded onboarding reference, not a global agent configuration. See [ARCHITECTURE.md](ARCHITECTURE.md) for runtime design and [README.md](README.md) for end-user instructions.

The project is **CodeRelay**. The local folder remains `CodeTantraChromeExtension`, and the installed Chrome manifest still uses **Practice Program Import — V1**, version **1.0.1**. It is a Chrome extension that previews and imports a user's own saved source text into a trusted practice page where external-code import is explicitly permitted.

It is **not** a VS Code extension, an exam/proctoring bypass, an automatic submission tool, or a guaranteed CodeTantra integration. Live CodeTantra compatibility and server-side saving/submission have not been verified.

## Project snapshot

- Chrome Manifest V3; minimum Chrome version **106**.
- Plain HTML, CSS and JavaScript ES modules (`.mjs`).
- No npm packages, `package.json`, build step, bundler, framework or production backend.
- No background service worker, persistent content script or broad host permissions.
- Node's built-in test runner provides automated tests; Python's standard library provides an optional local demo server.
- GitHub repository: [Rajveerx11/code-relay](https://github.com/Rajveerx11/code-relay), verified private when created. Default branch: `main`.
- `.github/workflows/ci.yml` defines Node 22/24 tests and production-module syntax checks on Windows and Linux for pull requests and pushes to `main`. Check GitHub Actions for actual run results; workflow presence alone does not prove a passing run.

## File map

| Path | Purpose |
| --- | --- |
| `manifest.json` | Root Chrome manifest, permissions, popup entry point and extension-page CSP. |
| `extension/popup.html` | Consent, target selection, source preview, import and undo interface. |
| `extension/popup.css` | Popup presentation and control states. |
| `extension/popup.mjs` | Popup state, file/clipboard loading, Chrome scripting, frame routing and delayed verification. |
| `extension/diagnostics.mjs` | Bounded memory-only safe execution report and explicit native download. |
| `extension/core.mjs` | Pure `validateScope()` URL/consent validation. |
| `extension/editor-adapter.mjs` | Self-contained `pageEditor()` injected into the page's MAIN world. |
| `demo/` | Top-frame textarea demo, same-origin iframe demo and UTF-8 sample program. |
| `tests/*.test.mjs` | Node unit, popup, frame-routing, serialized round-trip and package-layout tests. |
| `tests/browser.html`, `tests/safety.html`, `tests/ui.html` | Optional browser fixtures; UI fixtures use a test-only Chrome API bridge. |
| `tests/bridge.js`, `tests/saved-file.mjs`, `tests/safety.mjs` | Browser-fixture support; not production extension code. |
| `tools/serve.py` | Loopback-only optional demo/test HTTP server. |
| `assets/code-relay-logo.svg`, `assets/code-relay-logo.png` | Original project logo used in the README; not a third-party affiliation mark. |
| `TESTING.md`, `VERIFICATION.json` | Existing recorded verification evidence and its limits. |
| `CHECKSUMS.sha256` | Historical imported-bundle checksums, not a manifest of the current working tree. |
| `.github/workflows/ci.yml` | Dependency-free Windows/Linux Node test and syntax-check matrix. |
| `.gitattributes`, `.gitignore` | Stable LF checkout text and exclusions for credentials/local generated artifacts. |

## Run locally

### Load the extension

1. Open `chrome://extensions` in Chrome and enable Developer mode if organizational policy permits it.
2. Choose **Load unpacked** and select this project root containing `manifest.json`, **not** the `extension/` subfolder.
3. Reload the extension after changes; refresh the target practice page before retesting.

No Node or Python installation is required to use the extension itself. Do not change managed-browser security policy to enable installation.

### Optional local demo

From the project root:

```sh
python3 tools/serve.py --port 8766
# Windows alternative:
py tools/serve.py --port 8766
```

Open `http://127.0.0.1:8766/demo/` or `http://127.0.0.1:8766/demo/frames.html`. Focus the editor before opening the extension, approve the page, inspect the target, load `demo/sample.py`, import and undo without closing the popup. Stop the server with Ctrl+C.

The server binds to `127.0.0.1`. Its GET handler permits paths beginning with `/demo/`, `/tests/` and `/extension/`; it is a development helper, not a production service or hardened public server.

### Automated checks

Use an installed Node version supporting ES modules and `node:test`:

```sh
node --test tests/*.test.mjs
node --check extension/diagnostics.mjs
node --check extension/core.mjs
node --check extension/editor-adapter.mjs
node --check extension/popup.mjs
```

There is no dependency-install step. In a shell without wildcard expansion, pass the `tests/*.test.mjs` files explicitly if needed.

## Supported behavior and limits

- Visible native textareas, Ace editors exposing `element.env.editor`, and CodeMirror 6 views with validated model/dispatch APIs and exactly one selection.
- CM6 discovery uses version-sensitive DOM links, then verifies the matching wrapper/content/view through public `findFromDOM`. Unsupported/private instances fail closed; text is never written directly into the editor DOM. Local real-library coverage includes view 6.36.5 and 6.41.0; this does not establish live CodeTantra compatibility.
- Top-level pages and accessible, visible same-origin frames, including nested frames.
- Focused writable target preferred; ambiguous targets require explicit selection. The first 1,000 characters of the selected target are shown for confirmation.
- UTF-8 saved-file loading, optional clipboard reading, and manual preview editing. Filename extensions are not enforced by the implementation.
- Non-empty source text up to **200,000 JavaScript string code units**, without NUL characters; saved files up to **800,000 bytes**. The UI describes the string limit as characters.
- Leading BOM removal and CRLF/CR normalization during source cleaning; insertion adapts line endings to the editor. Tabs, indentation, blank lines, trailing whitespace/newline and Unicode are otherwise preserved, with no automatic formatter.
- Whole-editor replacement is the default and requires a separate unchecked-by-default confirmation. It ignores the cursor/selected range; cursor insertion/selection replacement remains an explicit opt-in.
- Temporary single-level extension undo, lost when the popup closes or its target/backup is cleared. Do not promise native Ctrl+Z support.
- Immediate read-back plus two delayed checks, after about 150 ms and another 600 ms. No automatic write retry or rollback.

Unsupported: Monaco, CodeMirror 5, private/incompatible CM6 or Ace instances, CM6 multiple selections, cross-origin or inaccessible/sandboxed frames, hidden targets, `about:blank`/`srcdoc` frames, and detected assessment/proctoring pages. Detection is heuristic; user authorization is still required.

## Permission and privacy boundaries

Required permissions are `activeTab` and `scripting`; `clipboardRead` is optional and requested on the clipboard button gesture. Saved-file import does not require clipboard permission.

The extension has no explicit source upload, telemetry or persistent storage. Source, snapshots and undo data are held in popup memory. Execution diagnostics retain at most 100 timestamped entries using only fixed action/status/category messages. Source, clipboard text, filenames, editor labels, URLs, account/student data and raw exceptions are excluded from the report. Closing the popup clears the log; explicit export requests a local file, which persists independently. Logs do not prove saving/submission or live compatibility. Importing into a website exposes that code to the website and its own autosave/server behavior. MAIN-world integration shares the page's JavaScript environment; use only trusted, authorized pages.

Preserve exact URL/document checks, consent, assessment checks, visible/writable-target filtering, stale-snapshot rejection and replace-all confirmation when changing behavior. Do not broaden permissions or introduce bypass, monitoring-disabling or submission features implicitly.

## Verification status

- Current replacement-default change: **68/68 Node tests** and **47/47 sandboxed browser-fixture checks** (26 real CM6 + 21 legacy) passed locally. The production default, separate confirmation, full text/formatting equality and undo are covered. See [TESTING.md](TESTING.md) for exact evidence and browser/native-extension limits.

- Before the foundation fix, Windows **Node v24.19.0** produced **33 passed, 1 failed**: `tests/package.test.mjs` assumed `/` separators when finding the root manifest.
- After switching to native `basename()` matching, `node --test tests/*.test.mjs` passed **34/34** locally on Windows. Production-module syntax checks also passed. A temporary extra nested manifest was correctly rejected, confirming the exactly-one-root-manifest assertion remains effective.
- No production code, extension version or permissions changed in that fix. See GitHub Actions for independent Windows/Linux matrix results.
- `CHECKSUMS.sha256` and `VERIFICATION.json` are preserved historical evidence from imported baseline commit `0371205`. All 26 listed files passed checksum validation before subsequent edits. Changed tests/docs now intentionally differ; use the baseline commit when reproducing those old checksums. Current release artifact generation is tracked in issue #8.
- `TESTING.md` separates current foundation checks from the historical 34/34 Node and 19/19 browser-fixture runs. The browser runs were not repeated for the foundation fix.
- Native extension installation, actual `activeTab` grants, clipboard permission prompts and live CodeTantra behavior remain unverified. Browser fixtures are not proof of those behaviors.

## Maintenance orientation

Keep the root manifest layout and relative module paths intact. `pageEditor()` must remain self-contained because Chrome serializes the function rather than transferring its module scope. Treat Chrome message payloads as data: snapshot comparison must not depend on object property order.

Choose regression coverage by change: scope checks in `core.test.mjs`, editor behavior in `adapter.test.mjs`, document routing in `frames.test.mjs`, popup state in `popup.test.mjs`, serialization/write verification in `roundtrip.test.mjs`, and packaging in `package.test.mjs`. Browser fixtures and real Chrome manual testing remain necessary for behaviors that fakes cannot establish.

Existing checksums and verification records describe the prior bundle. If producing a new release, intentionally regenerate its integrity/evidence artifacts after validation; do not silently present historical results as current release verification.

## Tracked next work

GitHub issues #1–#2 cover the Windows test/CI foundation. Remaining work is tracked separately: #3 installed-extension browser tests, #4 authorized CodeTantra compatibility, #5 application persistence, #6 read-only diagnostics, #7 undo UX, and #8 release artifacts. Issue #10 implements only the privacy-safe execution-log slice; #6 remains open for compatibility diagnostics. Issue #12 adds narrowly validated CM6 support, regression fixtures and a safe `cm6-unavailable` diagnostic. Issue #14 makes confirmed whole-editor replacement the default and verifies formatting fidelity; #4 remains open until the actual authorized CodeTantra page is independently verified. Issues #4–#5 require authorized site evidence; do not infer CodeTantra internals or claim live compatibility from local fixtures.
