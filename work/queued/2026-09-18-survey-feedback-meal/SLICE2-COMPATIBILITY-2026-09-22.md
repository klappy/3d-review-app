# Slice 2 compatibility and release handoff — 2026-09-22

Status: bounded compatibility evidence, not final candidate acceptance or FIRE. Internal independent reviewer; existing external Fable implementation/release custody only. Latest user scope is slice 1 first, then participant + feedback; workspace, code-export and print remain unfinished/preserved. Recurring loop remains PAUSED.

## Immutable comparison and observed conflicts

Slice 1 functional source: f69ac5c3cadcd848fdf3537d57867df2f81c9a6e.
Feedback: 57fa453ca20754d1315d6bfbc373151c42bc0d7e.
Participant: 98ab8e9f99bb71f557acb6b55f085399f25d0477.
Both merge bases with slice 1 are c9bf2b1e0ad3e9ae1d679cb286959a5b21bab822.
Cookbook PR103 observed open/unmerged at a5abe0c7b3d03cf76fd451f030e40aceefc15508, base20d51447e0d923f05a9b83f7e421241eec1ccf40. Its future immutable merged pin must be freshly obtained; this packet does not finalize it.

Scratch /tmp/slice2-compat at f69: uncommitted --no-commit merge of57fa; participant's five changed implementation/test files copied byte-for-byte from98ab. No product commits, branch pushes or production mutations.
- f69 +57fa conflict: test/kit-root.integration.test.mjs tail. Retain BOTH complete blocks: slice1 four-route heading/demo regressions and feedback modal/privacy/stale completion regressions. Close each test correctly; neither side alone is sufficient.
- 57fa +98ab merge-tree conflict: ui/.assetsignore. Preserve BOTH assess/feedback-modal.test.mjs and kit/participant-presentation.test.mjs exactly once, plus all existing entries. Participant side alone loses feedback exclusion.
- ui/assess/assess.js auto-merges; this is not proof by itself. Composed tests below exercise account host, identity reset, modal open and payload privacy. Preserve slice1 titles/demo/Retry fixes and existing authenticated email behavior.
- Participant's remaining delta from common base is ui/kit/views-participant.js, ui/kit/participant-presentation.test.mjs, ui/participant-view.js, ui/participant-view.test.mjs, ui/participate/page.js. No need to rewrite shared controllers for participant integration.

## Actual compatibility checks

158 tests pass on the uncommitted scratch composition; no skipped tests:
1. node --test test/kit-root.integration.test.mjs ui/assess/scope.test.mjs ui/assess/feedback-modal.test.mjs ui/assess/feedback.test.mjs ui/kit/participant-presentation.test.mjs ui/participant-view.test.mjs —88/88.
2. node --test ui/participant-header.test.mjs ui/participant-dom.test.mjs ui/participant-resume.test.mjs ui/participate/controller.test.mjs ui/assess/identity-reset.test.mjs —48/48.
3. npx vitest run test/feedback-provenance.test.ts test/participant-auth.test.ts —22/22.
Local transcripts: /tmp/slice2-tests.txt, /tmp/slice2-more-tests.txt, /tmp/slice2-backend-tests.txt.

npm run stamp succeeded using inherited0.16.0/f69/20d5144. That stamp identifies scratch HEAD only, NOT the uncommitted combined tree and NOT a releasable identity. Generated client-release.js is necessary for feedback's loaded-client provenance; retain the stamp-generation change and its ignore entry. Historical release/cookbook/0.15.0.md inherited from feedback does not authorize rollback of current manifest/pin/version.

Prior participant98ab acceptance d79ea8c8 and feedback acceptance remain component evidence. This pass did NOT repeat actual browser/asset/deployment checks on the combined candidate. JSDOM focus assertions are not a substitute for native Tab/Escape proof.

## Minimal external integration order and remaining gates

1. Existing release Fable finishes slice1 selected-source/canonical repin and required DEV/production validation first. Coordinator explicitly transfers exclusive assess.js, root test, stamp and assetsignore custody for slice2. No invented worker ACK here.
2. Existing Fable branches from the actual accepted slice1 release tree, integrates57fa and98ab provenance, resolves the two conflicts above, preserves current metadata and all slice1 fixes. Compare any changed cloud heads before selection; one successor only. No workspace/export/print cargo.
3. Produce exact commit/tree/diff and rerun the158 checks against that real commit. Independently review the conflict resolution and any difference from this scratch composition.
4. Actual isolated desktop/phone browser: authenticated account/new-root headings and demo disclosure; feedback open without navigation/unsaved-input loss; native Tab/Shift-Tab/Escape/opener return; stale route/identity completion suppression and no account email in payload; participant intro→question→submit/recovery, native FormData fields; phone200% header/Version accessibility. Verify both test assets404 and runtime/client-release/changelog200 with bytes matching final stamped commit.
5. Release owner allocates the next version using current canonical inventory and governing classification for the combined added feedback behavior; this packet does not reserve a number. Canonical record first, immutable merge/hash chain, app metadata/pin second, final stamp/current bundle and truthful evidence. Do not ship slice2 under a slice1-only0.16.0 record.
6. Exact-head independent acceptance + real required service checks, coordinator candidate disposition, canonical DEV deployment/read-only proof, then same-version/full-tree production candidate and its separate gates. Rollback remains prior accepted deployment; do not erase submitted feedback or change grants.

Driver-seat challenge: a participant opens feedback and returns to an unfinished form while the account/root remain intact. Therefore preserve both regression blocks and both exclusions, rather than accepting Git's clean controller merge or taking one conflict side. Confidence is bounded to these immutable sources/tests; changed source, native focus failure, payload leakage or wrong asset identity retracts compatibility. Alternative separate participant/feedback release would add release work; combined slice2 is the user's selected scope, subject to proof.

Actual Oddkit planning challenge2026-09-22T17:43:02Z returned CHALLENGED, governance_source knowledge_base, block_until_addressed false (not PASS). Generic evidence/scope/reversibility prompts are addressed by exact refs, test commands, explicit untested browser/production denominator, rollback and stop conditions above.
