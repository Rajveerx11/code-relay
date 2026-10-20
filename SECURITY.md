# Security policy

## Report privately

Please use [GitHub private vulnerability reporting](https://github.com/Rajveerx11/code-relay/security/advisories/new) for suspected vulnerabilities. If the private form is unavailable, open a public issue asking for a private reporting channel **without including vulnerability details or sensitive data**. Do not publish an exploit in a public issue or PR first.

Include the affected commit/version, a minimal reproduction on a page you control, expected and actual behavior, impact, and relevant environment versions. Use synthetic code and redact credentials, cookies, tokens, student identifiers, private URLs and assignment content. Do not share a real account/session to reproduce a problem.

This is a volunteer-maintained project. There is no guaranteed response time or bounty program. Coordinate disclosure with the maintainer; do not test other students' accounts or third-party platforms without permission.

## Supported code

Security fixes target the latest `main` revision. Older snapshots and unofficial modified builds are not maintained separately. The manifest currently says version 1.0.1 across several source revisions, so include the Git commit (or download date if unknown) in a report. There is no Chrome Web Store distribution or independently verified release ZIP.

## Trust boundaries

- Only import on trusted practice pages that explicitly allow it. Assessment detection is heuristic; it is not an authorization decision by the institution.
- The extension uses temporary `activeTab` access and `scripting`; clipboard reading is optional. It does not request broad host permissions.
- Page editor integration runs in the page's MAIN world. A malicious page controls that environment; model validation and read-back checks cannot turn it into a trusted sandbox.
- Imported code is available to the website, including any autosave/server behavior it implements. The extension itself has no backend, telemetry or persistent source storage.
- Diagnostics use bounded, fixed-category messages in popup memory. Inspect an exported report before sharing it. Source and target previews are **not** part of the privacy-safe report.
- The local demo server is a loopback-only development helper, not a public service. Do not expose it to a network.

Tests cover defined validation/refusal paths, not every browser, editor configuration or hostile page. See [TESTING.md](TESTING.md) for known verification gaps. Do not disable browser sandboxing or organizational policies to make a test pass.
