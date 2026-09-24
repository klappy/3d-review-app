# Implementation receipt — account identity161

DRAFT for independent exact-head review; not merged or released.
Source FIRE7abdf98, accepted plan d67f4f88, independent planning ACCEPT537f57d.
Actual author ui_audit; implementation started after FIRE receipt. First source/test checkpoint delivered inside25-active-minute promise.

PR: https://github.com/klappy/3d-review-app/pull/163
Head:96a56a57ad2775450558fb31041251d07d243cce
Full tree:c5563e543ea79be2d840e9efd680cac3d6c33a6d
Base:76fe13823dda23c9c046d2b44cdce94fc0842602
Base tree:df7caca24120c9e4ace1ea41be67bf584001d7c4
Branch:fix/161-account-identity-2026-09-21 targets main; no merge authorized.
Local checkout:/tmp/3d-161-account-20260921. Remote head fetched, staged tested contents diff against FETCH_HEAD is empty; unstaged tracked diff empty. node_modules is an untracked local symlink, excluded from source.

## Delivered behavior
Existing protected Access route accepts strict account-read mode before all sign-in side effects. Verified email is returned only after matching current selected app session/principal email hash, stored delegation and expiry checks. Missing/invalid/mismatched/delegated account returns generic unavailable/no-store. No persistence, full provider identity proxy, auth.me/MCP disclosure, grant or schema change.

Root header exposes account email, Sign out and Use another account; welcome no longer echoes internal ID. Exact identity/credential checks suppress stale email/logout/switch completion. Confirmed logout alone clears app state; uncertainty is visible. Provider-wide switch warning precedes deliberate confirmation. No live incident logout performed.

## Exact seven-path diff
src/index.ts; test/access.test.ts; ui/index.html; ui/assess/assess.js; ui/assess/scope.js; ui/assess/identity-reset.test.mjs; ui/assess/scope.test.mjs.
Seven files,174 additions/15 deletions. No version/release metadata, contracts/config, auth resolver/verifier, grants, K1/K2 or159 source changes.161-first custody remains;159/K3 later consume accepted tree.

## Verification
- node --test ui/assess/identity-reset.test.mjs ui/assess/scope.test.mjs ui/assess/entry.test.mjs:46 passed. Includes stale success/failure logout AND switch, confirmed/unconfirmed effects, duplicate dispatch, email stale response, work retention and generic welcome delegation.
- npx vitest run test/access.test.ts test/logout-cross-face.test.ts test/mcp-oauth.test.ts test/participant-auth.test.ts:49 passed. Includes cookie/bearer/support delegation, invalid preferred bearer, identity mismatch/missing/replaced/expired row, malformed provider claims, unknown/duplicate read mode, no writes/cookies/redirect; existing cross-face logout and normal OAuth sign-in retained.
- npm run typecheck:passed.
- npm test:54 files/613 tests passed,175.46seconds. Full output:/tmp/3d-161-evidence/full-tests.txt. Existing test diagnostics include expected rejection/rate-limit messages; suite exit0.
- git diff --check:passed.
- Actual Wrangler local asset service on8892, no deployment: modified scope/identity tests404, root and assess/scope runtime assets200 byte-equal. /tmp/3d-161-evidence/asset-results.json; assets.toml; assets.log.
- Browser Chrome153.0.8010.53: actual root HTML/controllers on localhost8891 with isolated empty contexts, explicit synthetic API allowlist and rejection of unknown/nonlocal writes. Two viewports1440x900 and390x844; each passed six groups: delayed account read retains actual input; complete email wraps/no overflow; Projects/Workspaces controls visible; dialog Cancel/Escape; failed logout retains work; confirmed logout clears account.6 groups×2 viewports, not whole-app coverage. An initial fixture run refused an unlisted health GET; explicit synthetic health fixture added and rerun passed, no product change from that setup correction.
- Browser harness:/tmp/3d-161-evidence/render.cjs; observations:/tmp/3d-161-evidence/render-results.json. Screenshots:projects-desktop.png,projects-phone.png,workspaces-desktop.png,workspaces-phone.png,switch-desktop.png,switch-phone.png in that directory. Author visually inspected projects-phone and switch-desktop; others captured and DOM assertions passed, not all visually inspected.
- Current feedback.js serializes named form fields only; no page/account DOM capture. New email uses transient textContent only, no storage/log/feedback injection. Feedback modules untouched.

## Boundaries and handoff
Real provider query-mode forwarding and different-email switch journey remain untested on deployed candidate. Synthetic browser/API proof is not provider proof. The private-window DEV sign-in route was separately observed without sign-in and did not exercise candidate. Do not use current incident session as fixture.
Allergy cargo remains draft awaiting independent source/privacy/browser review, literal required terminal checks and candidate-specific merge/release disposition. No assertion that data access repair, provider logout journey or release is complete. No sensitive live IDs/emails/screenshots included.

## Review readiness update
Coordinator received independent exact-head source/privacy/synthetic-browser ACCEPTdcb9382568f4cd5314dfc9b891f4f77e163dd751. PR163 marked ready through supported GitHub action, head unchanged96a56a57. One fresh check observation: real Cursor Bugbot app1210556 check106598508115 in_progress; Workers Builds:3d-review-dev106598297263 completed/success. No terminal Bugbot claim or polling loop. Independent review does not close provider journey or release-identity gaps. Metadata amendment proposal is separate; no source/release files expanded by readiness.
