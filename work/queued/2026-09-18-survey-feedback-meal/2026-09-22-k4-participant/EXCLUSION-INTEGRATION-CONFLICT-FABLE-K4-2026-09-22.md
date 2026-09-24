# Exclusion integration — exact conflict returned (participant owner)
2026-09-22 16:08Z (12:08 ET). ACK of COMMITTED-EXCLUSION-INTEGRATION @ kitchen fab66ebb at 16:06Z. Status: NOT INTEGRATED — parent-context conflict returned per order; participant head unchanged at 6ab60dc05755ad2ed603cbb62011df7e0d46d109. No overwrite, no re-authoring, no shared-file edit.

## What was attempted (once)
`git cherry-pick 57fa453ca20754d1315d6bfbc373151c42bc0d7e` onto `design-batch/k4-participant-20260922` @ 6ab60dc (base c9bf2b1). Result: `UU ui/.assetsignore`, then `git cherry-pick --abort`; working tree clean, head unchanged.

## Exact conflict
Staff commit 57fa453c (verified: one file, +1 line `kit/participant-presentation.test.mjs`) has parent **efb53588edb0efd0b2f2b2edb15901794a287cd2**, which is 5 commits ahead of my base c9bf2b1 and NOT on main (compare main...efb5358: ahead 32 / behind 0): ab8c83d, 5a77efa, 332b862, c2a3dc0 (merge #159 feedback-in-place into K3b1), efb5358 (feedback-modal). That lineage adds `assess/feedback-modal.test.mjs` to ui/.assetsignore immediately before the cargo line and adds ui/assess/feedback-modal.test.mjs itself — neither exists at c9bf2b1 or on my branch.
Conflict hunk (tail of ui/.assetsignore):
```
kit/app-adapter.test.mjs
<<<<<<< HEAD
=======
assess/feedback-modal.test.mjs
kit/participant-presentation.test.mjs
>>>>>>> 57fa453 (chore(assets): exclude kit/participant-presentation.test.mjs …)
```
The three-way merge cannot separate the cargo line from the staff K3b1 context line; any resolution I make is either (A) hand-editing the shared file (keep HEAD + append only `kit/participant-presentation.test.mjs`, dropping `assess/feedback-modal.test.mjs` which has no file on this branch) — that is re-authoring the locked file, which the order forbids me — or (B) rebasing the participant branch onto efb5358, which changes my accepted base c9bf2b1 to the unaccepted staff K3b1 head. Neither is mine to choose.

## Options for coordinator/staff (pick one; I execute immediately on the Git receipt)
1. Authorize resolution (A) explicitly: I complete the cherry-pick keeping 57fa453c's provenance (author/message) with the file resolved to HEAD + the single cargo line; proof: diff 6ab60dc→head is exactly `+kit/participant-presentation.test.mjs`.
2. Authorize base change (B): rebase the five participant commits onto efb5358 (or onto a named accepted staff head), then cherry-pick applies clean; note this pulls the K3b1 feedback-in-place lineage under the participant candidate and invalidates the 6ab60dc visual re-review's source identity.
3. Staff lands an equivalent one-line commit whose parent is c9bf2b1 (or main), which then cherry-picks clean onto my branch.

## Meanwhile (unchanged facts)
Wrangler local at 6ab60dc: /kit/participant-presentation.test.mjs 200, /kit/views-participant.js 200, /participate/ 200, inherited /kit/app-adapter.test.mjs 404. Runtime modules required by the participant page: /participate/page.js, /participant-view.js, /kit/views-participant.js, /kit/core.js (imported? no — views-participant.js has no imports), /present.js, /demo.js, /shared-link.js, /participate/controller.js — all served.
Independent re-review of 6ab60dc may proceed on unchanged product behaviour; exclusion proof will be re-stamped at the resulting head.
