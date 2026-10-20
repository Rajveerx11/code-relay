# Contributing to CodeRelay

Thanks for helping students import their own code into permitted practice editors. Small, reproducible fixes are easier to review than broad rewrites.

## Before you start

- Search existing [issues](https://github.com/Rajveerx11/code-relay/issues). Open an issue first for a new editor adapter, permission change or substantial feature.
- Use only pages you own or are authorized to test. Start with the bundled local demo and synthetic source code.
- Keep discussions respectful and technical. Do not post private student/course data, credentials, cookies, tokens, assignment answers or source-preview screenshots.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues or pull requests.

## Local setup

1. Fork the repository and clone your fork.
2. Create a branch for one change: `git switch -c fix/short-description`.
3. Follow [README.md](README.md) to load the root folder as an unpacked extension.
4. Use Node **22 or 24** for tests. No package installation or build step is required. Python 3 is optional for the local browser fixtures.

From the repository root:

```sh
node --test
node --check extension/core.mjs
node --check extension/diagnostics.mjs
node --check extension/editor-adapter.mjs
node --check extension/popup.mjs
git diff --check
```

`node --test` discovers the `*.test.mjs` tests without depending on shell wildcard expansion. See [TESTING.md](TESTING.md) for browser-fixture commands and verification limits. Keep browser sandboxing enabled. The optional Ace/CM6 fixtures require external CDN access; a failed library load is not a passing test.

## Change boundaries

- Prefer plain JavaScript and existing helpers. Do not add dependencies or broad abstractions without a demonstrated need.
- Read [ARCHITECTURE.md](ARCHITECTURE.md). `pageEditor()` must remain self-contained because Chrome serializes it for execution in the page.
- Preserve explicit consent, assessment refusal, exact URL/document targeting, editor identity checks, stale-snapshot protection, writable/visible checks, separate whole-replacement confirmation and source limits.
- Preserve bounded verification and explicit uncertainty. Do not add automatic retries or rollback over website changes.
- The maintained project does not accept exam/proctoring bypasses, monitoring changes, simulated typing to evade controls or autosubmission. This describes project scope, not an additional restriction on the MIT License.
- Do not include secrets, personal data, local agent logs or generated review artifacts in commits. Review your diff before pushing.

## Tests and pull requests

For a bug fix, add the smallest regression that fails before the fix. Exercise refusal paths as well as success. Document which checks you ran and which you could not run; do not call skipped checks clean.

Include the problem, related issue, scope of changes and verification evidence in your PR. UI changes should include a screenshot using harmless local demo content. Do not include private page screenshots or full source previews. A maintainer must approve merges; contributors should not self-merge around failing checks.

The workflow runs Node tests and syntax checks on Windows/Linux with Node 22/24. Browser bridges do not prove real Chrome permission prompts, installed-extension behavior or a site's save/submission behavior. Report those boundaries honestly.

## Licensing

By contributing, you confirm you have the right to submit the contribution under the project's [MIT License](LICENSE). Retain third-party notices when applicable. There is no CLA or guaranteed review/response time.
