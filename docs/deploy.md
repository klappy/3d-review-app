# DEV and production deployment entry point

**Target:** `main` delivers the existing `3d-review-dev` Worker; `production` delivers the existing `3d-review` Worker through separately reviewed captain-owned main-to-production promotion. Staging is optional future scope only if needed.


Canonical web domains are `dev.3dreview.app` (DEV) and `3dreview.app` (production). See [project domains](domains.md) for retained aliases, Access prerequisites and verification limits.

## Status and authority

This is a proposed correction, not evidence of applied provider settings. Before cutover, the historical listeners are phase0→DEV and main→production; refresh actual state before use. After cutover, require recorded readbacks of main→DEV and production→production. The [release hold and gates](release.md) remain binding. The [control-plane request artifact](release/a8-control-plane-plan.json) is review-only and cannot execute anything. Order A authoring grants no Order B cutover, merge or production authority.

## Separately gated cutover checklist

1. Obtain exact candidate independent review, literal Bugbot SUCCESS, completed attached checks, findings dispositions and prospective hold disposition. Refresh supported provider schemas, heads, effective rules, complete queues, trigger objects and active versions. Obtain actual bounded main/phase0 freeze ACKs; drain old builds or cancel only individually identified builds covered by the final disposition, with terminal readback.
2. With main verified empty, protect an absent production branch using the narrow creation-status exemption. Create at the verified empty ancestry, immediately tighten and read back effective rules. Existing main/phase0 protections remain untouched. Existing production ref, API refusal or tightening failure stops the order.
3. Retarget existing production trigger to production first; read back unchanged request-owned settings and deployment. Account explicitly for expected server metadata changes such as modified_on. Stop on unexplained changes or unexpected builds.
4. Retarget existing DEV trigger to still-empty main, preserving Worker, D1, Access, bindings, secrets, commands, filters and associations. Read back both queues and versions; no stale phase0 delivery may remain.
5. Revalidate the whole baseline and exact head gates before normal protected PR integration into main. The resulting push is the intended DEV build event; never manually start a build or upload/deploy from a seat.
6. Match accepted main Git SHA to build source `push_event`, branch `main`, exact commit SHA and deployed DEV version. Confirm existing state identities, unchanged production and no stale queues, then release the freeze with an independent receipt. `/v2/health source_sha` is a cookbook contract pin, never the app Git SHA. Runtime version-stamp implementation remains separately owed.

## Failure and rollback

Stop subsequent writes on head, rules, queue, trigger or version drift. A cancellation request is not terminal cancellation. Before main is populated, a reviewed rollback may restore the DEV listener to phase0; retain production on production. After population, use a compatible checked PR into main while keeping the correct filters. Never restore production→main, force-reset shared history, reset data or replay migrations/seeds. Verify the prior version after a failed build rather than assuming health. No manual dispatch, seat deployment or production authorization is supplied here.

## Retained debt

The README's unrelated historical 79-row, local-run and sign-in claims remain outside this bounded correction. Full API/design/security readiness, original A8 obligations and production manifest bump/changelog/stamp remain open. Chris permits full cookbook reconstruction to follow shipment through retrospective journals, issues, PRs and commit audit; it is not a prerequisite added by this topology slice. Essential release safety documentation and independent review remain required.
