# Slice 2 — bounded integration order

Status: fully specified READINESS order; independent plan review and coordinator source FIRE pending. No implementation authorization is created by this document. Parent meal and existing K4/feedback tickets retain authority; this is their combined integration order, not a new crew or new feature ticket.

## Scope, owner and dependency

User selected slice1 first, slice2 participant + feedback next; recurring loop remains PAUSED. Existing participant Fable is the proposed execution owner, subject to actual ACK and coordinator transfer of shared paths. Internal agents plan/review only. Do not use latest staff branch: unfinished workspace cargo is excluded. No owner availability, execution promise or START is asserted.

Source inputs: slice1 f69ac5c3cadcd848fdf3537d57867df2f81c9a6e; feedback57fa453ca20754d1315d6bfbc373151c42bc0d7e; participant98ab8e9f99bb71f557acb6b55f085399f25d0477; common ancestor c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822. Evidence: SLICE2-COMPATIBILITY-2026-09-22.md at a0de30bc54c9633fbbb93e4301644c8d2c938c2a (158 passing scratch tests, not final candidate/browser acceptance).

At START refresh refs and active claims. Create/reuse one isolated branch proposed integration/slice2-participant-feedback-20260922 from the finally accepted slice1 repin if available. Otherwise f69 is permitted as a build-only dependency after FIRE; final slice1 repin must be reconciled before any release. Verify functional base matches accepted slice1; unexpected functional change stops for coordinator review. Do not write PR173, staff, cloud or release-owner branches. Search existing integration branches first; preserve unique work.

## Exclusive write set — 19 paths

- .gitignore
- contract/capabilities.json
- contract/openapi.yaml
- docs/feedback-provenance.md
- scripts/stamp-version.mjs
- src/handlers/feedback-provenance.ts
- test/feedback-provenance.test.ts
- test/kit-root.integration.test.mjs
- ui/.assetsignore
- ui/assess/assess.js
- ui/assess/feedback-modal.js
- ui/assess/feedback-modal.test.mjs
- ui/assess/feedback.js
- ui/server.mjs
- ui/kit/participant-presentation.test.mjs
- ui/kit/views-participant.js
- ui/participant-view.js
- ui/participant-view.test.mjs
- ui/participate/page.js

Only accepted input deltas, conflict reconciliation and bounded regression corrections are within this order. Coordinator must transfer these shared paths exclusively before FIRE, especially assess.js, root tests, stamp and assetsignore; other owners may retain disjoint paths. No workspace ade6, K5/code-export, print/QR, new feature, grant/auth redesign, transport invention or unrelated refactor.

Do not import release/cookbook/0.15.0.md from feedback into the selected slice1 tree. It remains available as historical source provenance in57fa, not current release identity. Do not overwrite package files, release manifest, current cookbook copies or release index with inherited0.14/0.15 state. Source integration does not allocate a release version. Generated client-release.js/changelog/version outputs are locally generated, not tracked source edits.

## Integration and contracts

Carry accepted feedback ancestry/delta and participant provenance from the exact refs above, never a latest branch merge. Record parent/merge or equivalent exact-input provenance, including explicit exclusion of historical0.15 cargo. No source drops disguised as clean merge.
1. Resolve root integration test tail by retaining BOTH complete test groups: slice1 host headings/demo disclosure/write refusal and feedback modal/account/privacy/stale completion. Restore each closing test delimiter. Neither conflict side alone is acceptable.
2. Keep all existing assetsignore entries plus exactly one assess/feedback-modal.test.mjs and exactly one kit/participant-presentation.test.mjs. Do not import only participant's ignore snapshot.
3. Preserve slice1 account email/logout generation guards, stable header/root, heading ownership, demo notice and every Retry guard. assess.js auto-merge is not proof: verify modal uses the current identity generation/route, resets on identity/route change and returns focus to visible account toggle.
4. Preserve native dialog keyboard containment, unsaved underlying form/URL, truthful feedback uncertain/rejected/recorded states and explicit duplicate-warning retry. Payload remains allowlisted form fields + experience, never account email/tokens/entity IDs inferred from surrounding DOM. Preserve backend provenance validation.
5. Participant rendering retains real controller/FormData/native input contracts, phase IDs, recovery/idempotency, accepted compact header/640px stage and phone200% Version access. No new participant/controller API.
6. Keep feedback's generated loaded-client identity contract in stamp-version.mjs and its ignore entry. It must report the actually loaded final bundle, not later health identity. Local unstamped or precommit identity is not release evidence.

## Executable acceptance / exact-head return

Run stamp after the source commit for current bundle identity; report inherited release metadata explicitly as provisional until separate release order.
- node --test test/kit-root.integration.test.mjs ui/assess/scope.test.mjs ui/assess/feedback-modal.test.mjs ui/assess/feedback.test.mjs ui/kit/participant-presentation.test.mjs ui/participant-view.test.mjs
- node --test ui/participant-header.test.mjs ui/participant-dom.test.mjs ui/participant-resume.test.mjs ui/participate/controller.test.mjs ui/assess/identity-reset.test.mjs
- npx vitest run test/feedback-provenance.test.ts test/participant-auth.test.ts
- Typecheck and applicable version-stamp tests; do not change release literals to conceal a stale pin. Existing scratch result158/158 is a baseline, not inherited final-head proof.
- Isolated synthetic browser intercepts before navigation, no live credentials/writes: desktop + phone real root account/navigation/title/demo/Retry; feedback open retaining unsaved input/URL, native Tab/Shift-Tab/Escape and opener focus; held response after route/identity change; no private account data in submitted fixture payload; participant intro/question/submit, native FormData, recovery/idempotency; phone200% no clipped Version/actions; Version native-key open/close.
- Actual Wrangler local asset serving: both new test paths404; runtime modules, client-release.js and changelog200, final bytes/hash/commit matched. No deploy needed to prove this.
- Exact path diff excludes historical release file and all forbidden cargo. Preserve final base metadata byte-for-byte at source-only checkpoint.

Return exact branch/head/parents/tree/base, input comparison and resolved-conflict diff, test commands/results, browser screenshots/JSON, assets hashes and remaining failures. Provide source PR under coordinator's selected base; no merge authority. Independent reviewer must assess the actual composition, not merely component receipts. Missing native-browser/asset capability is an explicit blocking gap, never a synthetic PASS.

## Planning gates and release boundary

Driver-seat lens: after opening feedback, the person must return to the same unfinished survey context with reliable focus and account identity; after participant zoom, Version and form actions must remain usable. This caused explicit retention of both regression groups and both exclusions rather than choosing a conflict side. Rejected latest-staff merge because it would import unfinished workspace work.

Actual Oddkit planning challenge2026-09-22T17:45:20.769Z: CHALLENGED; governance_source knowledge_base; block_until_addressed false. This is not gate PASS. Evidence is bounded to immutable inputs and scratch tests. Retract readiness on changed functional base, active conflicting custody, unexpected diff, browser regression or private-data leakage. Source remains reversible on isolated branch; live release is separately gated.

Outstanding before source FIRE: independent narrow plan acceptance; actual Fable ACK/own promise; coordinator exclusive-path disposition; fresh per-dish preflight/checklist/challenge under existing recipes. Readiness dispatch may happen before those close, but no product edits.

After source acceptance, existing release owner receives separate canonical next-version classification/allocation and metadata order using then-current inventory. Canonical record/pin/hash chain, final exact-head service gates, candidate disposition, DEV validation and same-version/full-tree production gates remain mandatory. Slice1 must ship first; no claim this source order ships slice2. Rollback uses prior accepted deployment, with no deletion of feedback or grant changes.
