# K1 implementation receipt — 2026-09-21
Status: implemented, tested and handed to independent review; no merge/deploy or whole-app completion.

PR: https://github.com/klappy/3d-review-app/pull/162 (draft), attached.
Exact head: 247161741f1bb16670b8630d4df3fa03764db99b.
Tree: 2b97069610a8d8690071890a0df4a0b1973d0bb9.
Base: design-batch/2026-09-21-integration at76fe13823dda23c9c046d2b44cdce94fc0842602, tree df7caca24120c9e4ace1ea41be67bf584001d7c4.
Feature: design-batch/k1-shell-2026-09-21. Main/production unchanged. Existing159 head332b862,149/161 excluded. Worker ui_audit ACK and gates precede code. Independent plan ACCEPT b61b03c; formal ticket/gates through f51f725.

Eight added files only: ui/kit/core.js, tree.js, kit.css, tokens.css, components.css, shell.test.mjs; test/fixtures/kit-shell.html, kit-shell-data.js. Fetched remote head and compared staged local tree: zero diff. No existing tracked file changed; controller/root/release/pin/package/roadmap bytes therefore preserved. node_modules is local untracked dependency symlink and not committed.

Behavior: kit-derived glass tokens/layout, explicit-model crumbs/tree/action menu, visible-scope inputs and explicit allowed actions, escaped text/hash-only destinations, callback-only navigation/actions, keyboard/Escape/focus handling, local expansion/search and update invalidation. Caller-owned content survives local shell repaints and clears on model update. Removed external font import to avoid font request. Fixture DB/S, View as product control, fake receipts and real transport are excluded. Styles are not root-activated.

Tests: node --test ui/kit/shell.test.mjs —8/8 pass. Entry/identity-reset/scope/roadmap model regressions —50/50 pass. git diff --check clean. Test output:
- /tmp/3d-k1-evidence/shell-tests.txt
- /tmp/3d-k1-evidence/regression-tests.txt

Actual Chrome153.0.8010.53 via Playwright against isolated localhost fixture: four roles owner/member/viewer/direct ×1440x900 desktop/390x844 phone =8/8 rendered; no horizontal overflow/page errors; menu Escape returns focus, tree expands/collapses, update to viewer invalidates role/actions. Requests restricted to local GET assets; no requests during interactions; local/session storage empty and no cookies. Fixtures create no real writes. Browser run/results:
- /tmp/3d-k1-evidence/render.cjs
- /tmp/3d-k1-evidence/render-results.json
- /tmp/3d-k1-evidence/{owner,member,viewer,direct}-{desktop,phone}.png
- /tmp/3d-k1-evidence/kit-baseline.html — fetched immutable c653482 standalone
- /tmp/3d-k1-evidence/reference-{owner,member,viewer,direct}-{desktop,phone}.png — role-matched pinned reference renders
Local source checkout /tmp/3d-k1-shell-20260921; preview http://127.0.0.1:8877/test/fixtures/kit-shell.html?role=owner (local server active at handoff; not monitoring).

Visual inspection: author viewed owner-desktop and direct-phone final output, compared frozen reference shape/tokens. Broader eight-role render dimensions are instrumented, not eight independent visual judgments. Author initially observed mounted-content loss after tree toggling; fixed with content-preservation regression and rerendered all8. Phone tree changed to auto height to avoid blank grid-row stretch in sparse isolated fixture. Full final kit pages/stages/participant and normal-root integration remain later dishes, not proven by shell preview. Independent reviewer should inspect remaining image pairs and menu interactions; fixture content/shorter entity list intentionally differs from full reference data.

Exact-head check observation at handoff: Workers Builds:3d-review-dev106588562572 in_progress; no Bugbot observed for draft. No check completion, deployment or release claimed. Do not merge until applicable independent review and terminal checks/current gates are satisfied.

Debrief: keeping real behavior outside the component made the no-write boundary provable. Repainting shell structure can destroy mounted content; regression now captures that seam for later integration. No new product requirement or copy approval.

## Superseding review-correction receipt
Head 1b0ae83a9c79b17f2154317d29c035422e769fce; tree8e53f582eb1521e356eaeba035f5fbc3ce5bdcb7. Raw GitHub PR refresh verifies this head/base76fe138 and ready-for-review state. Remote fetched tree equals tested staged local tree (zero diff). Nine changed paths: original eight additions plus authorized single-line ui/.assetsignore exclusion. Content-retention fix remains.
F1 fixed: test asset excluded; actual Wrangler local asset-only server (same assets directory and .assetsignore) returned shell.test404, fixture404, core/tree/threeCSS200 byte-equal. /tmp/3d-k1-evidence/asset-filter-results.json and wrangler-assets-local.txt. Full worker deploy --dry-run was attempted but failed on missing existing generated permissions/version modules; no deployment or whole build pass claimed.
F2 fixed: synthetic assessment owner consistent with header/crumb/tree/actions; added role-agreement regression across all four models. 10/10 shell tests /tmp/3d-k1-evidence/shell-tests-amended.txt. All8 browser roles/viewports rerendered and passed; same evidence filenames replaced with current fixture output. No visual component change from2471617 beyond correct fixture role label. Existing50tests unchanged since earlier pass. Marked PR ready under authorization to trigger attached review/checks; exact new-head terminal checks pending. Independent acceptance of previous head does not cover this new head.
