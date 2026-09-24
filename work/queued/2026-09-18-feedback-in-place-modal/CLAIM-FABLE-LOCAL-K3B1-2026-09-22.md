# CLAIM/ACK — Fable local, K3b1 feedback-in-place (same owner, 22-path custody)
Observed 15:07Z. Read: kitchen K3b1 dish @ 064de718 (TICKET 1.0.1, FIRE-CHECK-RUN) and INDEPENDENT-K3B1-PLAN-REVIEW-2026-09-22 @ 3b269b4b. Status: **custody ACK only — NO source edits until the accepted K3a exact-tree handoff and Auggie SOURCE FIRE.**

## Custody ACK (22 paths, exactly as ticket)
18 reconciliation paths: .gitignore; contract/capabilities.json; contract/openapi.yaml; docs/feedback-provenance.md; package-lock.json; package.json; release/cookbook/0.15.0.md; release/cookbook/releases.json; release/release-manifest.json; scripts/stamp-version.mjs; src/handlers/feedback-provenance.ts; test/feedback-provenance.test.ts; test/version-stamp.test.ts; ui/assess/assess.js; ui/assess/feedback-modal.js; ui/assess/feedback-modal.test.mjs; ui/assess/feedback.js; ui/server.mjs. Plus 4 harness/regression: ui/assess/feedback.test.mjs; ui/assess/identity-reset.test.mjs; test/kit-root.integration.test.mjs; test/fixtures/kit-root-transport.js. Metadata paths reconciliation-only (retain K3a bytes; 0.15.0.md as historical cargo). Same single writer as K3a (assess.js/feedback seams sequential). Excluded paths acknowledged (kit header/core/style, auth, migrations, attachments, 149, K4/K5).

## Verified today (read-only, no edits)
- 159 commits resolve: ab8c83de, 5a77efa4, 332b8629 (titles match ticket). Merge-base with K3a head 185ede97 = d5c7b259.
- 159 delta vs merge-base: exactly the 18 files (+202/−38). Overlap with K3a-changed files: **ui/assess/assess.js only** (159 delta there: 2 imports, `feedbackModal?.reset()` in resetIdentity, document click intercept on `a[href="#feedback"]`, hashchange reset, `#app` boot guard).
- Dry `git merge --no-commit` of 332b8629 onto 185ede97 (aborted, tree clean): 6 conflicts — package.json, package-lock.json, release/cookbook/releases.json, release/release-manifest.json, test/version-stamp.test.ts, ui/assess/assess.js. All inside the 22 paths.
- Known K3a-specific reconciliation points: boot guard must be `kit || #app`; the `#feedback` link now lives inside the account disclosure menu (`#shell-links` in `#account-menu`), so opener focus return must target the menu toggle when the menu has closed; page contexts are generation+identity bound (stale-completion suppression aligns with 159's snapshot/serial); native dialog appended outside `#rv` must not touch the stable content/host elements.

## Own implementation range (binds at SOURCE FIRE, not before)
- First integrated checkpoint ≤ 90 min active after FIRE: merged branch from the accepted K3a tree, 6 conflicts reconciled, feedback opens from the real kit root without route replacement, existing 159 + K3a suites green.
- K3b1 candidate for independent review: **3–4 h active** (reconciliation 30–45; kit-root integration + opener/menu focus 45–60; strict focus containment + stale/privacy regressions 60–90; harness/browser proof + receipts 45). Five-minute ToC checkpoints.

## Remaining critical path toward FULL release (estimates, not promises; assumptions explicit)
K3b1 3–4 h → K3b remainder (stage/survey/share/report/notes/permissions/create/rename kit bindings) 8–12 h → K4 participant + print 4–6 h → K5 legacy/code/export 4–6 h → K6 whole-batch route/state/visual + 90-capability evidence 4–8 h → release gates (independent exact-head review, service checks, canonical pin, DEV, production promotion; coordinator-owned). **Author-active total ≈ 24–36 h** over the remaining dishes, plus review turnaround per dish. Assumptions: single writer; frozen kit c653482 unchanged; no backend/API changes; reviewer PNG/regression turnaround ≤ 1 h per dish; no new findings reopening K3a; bounded amendments granted when a fix falls outside declared paths. Dependencies: accepted K3a handoff (in review now), FIRE per dish, K3b1 → K3b ordering, cookbook 99 reconciliation once.

## Owner preflight / challenge (planning mode, exact)
- `oddkit preflight` 15:06:02Z: DoD `klappy://canon/definition-of-done`; pitfalls: visual proof for UI changes, test output for logic changes, reference decisions; constraints surfaced incl. mode-discipline (search canon before designing) and audit-gates-are-spawned-agent-sessions.
- `oddkit challenge` (planning) 15:06:24Z: **CHALLENGED, block_until_addressed=false, tensions []**; 2 generic prerequisites unresolved: "principle not anchored to multiple cases" (true — the dry merge is one observation at one head; I do not claim a pattern) and comparison-target proper noun (the compared work is the 159 branch by permissions_increment/ui_audit at 332b8629, as of 2026-09-22). Not a PASS; independent acceptance separate.

## K3a status feeding this
K3a head 185ede97 (menu clamp after measured 195px overflow), 435/435, wrangler proof, stable bundle manifest 185ede97; reviewer holds 4 PNGs at 2e7e030f — CSS-only delta since. K3a acceptance pending independent review.
