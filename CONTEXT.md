# Project Context

## Scope and purpose

This document applies only to this project folder. It is a source-grounded onboarding reference, not a global agent configuration. See [ARCHITECTURE.md](ARCHITECTURE.md) for runtime design and [README.md](README.md) for end-user instructions.

The folder is named `CodeTantraChromeExtension`, but the product is **Practice Program Import — V1**, version **1.0.1**. It is a Chrome extension that previews and imports a user's own saved source text into a trusted practice page where external-code import is explicitly permitted.

It is **not** a VS Code extension, an exam/proctoring bypass, an automatic submission tool, or a guaranteed CodeTantra integration. Live CodeTantra compatibility and server-side saving/submission have not been verified.

## Project snapshot

- Chrome Manifest V3; minimum Chrome version **106**.
- Plain HTML, CSS and JavaScript ES modules (`.mjs`).
- No npm packages, `package.json`, build step, bundler, framework or production backend.
- No background service worker, persistent content script or broad host permissions.
- Node's built-in test runner provides automated tests; Python's standard library provides an optional local demo server.
- This inspected folder has no Git repository metadata. Do not assume a branch, remote, commit history or CI configuration exists here.

## File map

| Path | Purpose |
| --- | --- |
| `manifest.json` | Root Chrome manifest, permissions, popup entry point and extension-page CSP. |
| `extension/popup.html` | Consent, target selection, source preview, import and undo interface. |
| `extension/popup.css` | Popup presentation and control states. |
| `extension/popup.mjs` | Popup state, file/clipboard loading, Chrome scripting, frame routing and delayed verification. |
| `extension/core.mjs` | Pure `validateScope()` URL/consent validation. |
| `extension/editor-adapter.mjs` | Self-contained `pageEditor()` injected into the page's MAIN world. |
| `demo/` | Top-frame textarea demo, same-origin iframe demo and UTF-8 sample program. |
| `tests/*.test.mjs` | Node unit, popup, frame-routing, serialized round-trip and package-layout tests. |
| `tests/browser.html`, `tests/safety.html`, `tests/ui.html` | Optional browser fixtures; UI fixtures use a test-only Chrome API bridge. |
| `tests/bridge.js`, `tests/saved-file.mjs`, `tests/safety.mjs` | Browser-fixture support; not production extension code. |
| `tools/serve.py` | Loopback-only optional demo/test HTTP server. |
| `TESTING.md`, `VERIFICATION.json` | Existing recorded verification evidence and its limits. |
| `CHECKSUMS.sha256` | Existing bundle checksums; does not include these new context/architecture documents. |

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
node --check extension/core.mjs
node --check extension/editor-adapter.mjs
node --check extension/popup.mjs
```

There is no dependency-install step. In a shell without wildcard expansion, pass the six `tests/*.test.mjs` files explicitly if needed.

## Supported behavior and limits

- Visible native textareas and Ace editors exposing `element.env.editor` with the required APIs.
- Top-level pages and accessible, visible same-origin frames, including nested frames.
- Focused writable target preferred; ambiguous targets require explicit selection. The first 1,000 characters of the selected target are shown for confirmation.
- UTF-8 saved-file loading, optional clipboard reading, and manual preview editing. Filename extensions are not enforced by the implementation.
- Non-empty source text up to **200,000 JavaScript string code units**, without NUL characters; saved files up to **800,000 bytes**. The UI describes the string limit as characters.
- Leading BOM removal and CRLF/CR normalization during source cleaning; insertion adapts line endings to the editor.
- Cursor insertion/selection replacement, or separately confirmed full replacement.
- Temporary single-level extension undo, lost when the popup closes or its target/backup is cleared. Do not promise native Ctrl+Z support.
- Immediate read-back plus two delayed checks, after about 150 ms and another 600 ms. No automatic write retry or rollback.

Unsupported: Monaco, CodeMirror, private/inaccessible Ace instances, cross-origin or inaccessible/sandboxed frames, hidden targets, `about:blank`/`srcdoc` frames, and detected assessment/proctoring pages. Detection is heuristic; user authorization is still required.

## Permission and privacy boundaries

Required permissions are `activeTab` and `scripting`; `clipboardRead` is optional and requested on the clipboard button gesture. Saved-file import does not require clipboard permission.

The extension has no explicit source upload, telemetry or persistent storage. Source, snapshots and undo data are held in popup memory. Importing into a website exposes that code to the website and its own autosave/server behavior. MAIN-world integration shares the page's JavaScript environment; use only trusted, authorized pages.

Preserve exact URL/document checks, consent, assessment checks, visible/writable-target filtering, stale-snapshot rejection and replace-all confirmation when changing behavior. Do not broaden permissions or introduce bypass, monitoring-disabling or submission features implicitly.

## Verification status from this documentation pass

- Executed on Windows with **Node v24.19.0**: `node --test tests/*.test.mjs` produced **33 passed, 1 failed** out of 34.
- The existing failure is `tests/package.test.mjs:12`: `endsWith('/manifest.json')` does not match Windows backslash paths, so the manifest search returns an empty array. No test or production code was changed for this documentation task.
- `sha256sum -c CHECKSUMS.sha256` passed for all **26 existing listed files** before these documents were added. The new documents are not covered by that existing list.
- `TESTING.md` and `VERIFICATION.json` record an earlier 34/34 Node run and 19/19 local browser-fixture run. These are historical results, not results rerun in this pass.
- Native extension installation, actual `activeTab` grants, clipboard permission prompts and live CodeTantra behavior were not exercised in this pass. Browser fixtures are not proof of those behaviors.

## Maintenance orientation

Keep the root manifest layout and relative module paths intact. `pageEditor()` must remain self-contained because Chrome serializes the function rather than transferring its module scope. Treat Chrome message payloads as data: snapshot comparison must not depend on object property order.

Choose regression coverage by change: scope checks in `core.test.mjs`, editor behavior in `adapter.test.mjs`, document routing in `frames.test.mjs`, popup state in `popup.test.mjs`, serialization/write verification in `roundtrip.test.mjs`, and packaging in `package.test.mjs`. Browser fixtures and real Chrome manual testing remain necessary for behaviors that fakes cannot establish.

Existing checksums and verification records describe the prior bundle. If producing a new release, intentionally regenerate its integrity/evidence artifacts after validation; do not silently present historical results as current release verification.
