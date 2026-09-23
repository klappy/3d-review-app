# Existing A8 schema source gate clarification — proposed, not FIRE

Purpose: remove unnecessary serialization between accepted additive DEV schema preparation and final UI review, without weakening final runtime acceptance. This explicitly amends the original rollout's “final integrated SHA before DDL” hold; that hold remains effective until independent acceptance and root's recorded disposition. All other rollout1c780e37 conditions remain.

## Proposed source gate for schema execution

Use published inspected app `485914ba578800465a88a3f7afc448bf2e38f73e` as the immutable **schema source pin**, with independently inspected shared-aware backend ancestor `ad95321e99923666b3dbc9eac163710e6e70ad41`. This does not label485914b the final deliverable. Both contain identical reviewed migration bytes and executable DEV config:

-0006 SHA256 `7b0b0d2dc7f2d22fbcc57f065c9746ca3b393bfac7463b969b908b9c72748121`.
-0007 SHA256 `1fe0f9e014a4a716caf0c45d88d2adc2fc0b288390464fc430f62f1243a7a88a`.
-Account `b03e6ea242724c05eb97eb732cceb21d`, root DEV DB `5d4cc260-a7b1-47cc-b03d-ed4f60d324c3`; production excluded.

Root reports all current owner/remote-writer quiescence ACKs closed, including Chris pausing Grok05:04:05Z, kitchen2d3c106f. Executor must verify actual linked custody/window receipts and refresh live binding, deployed-version/source identity, schema/count/FK/bookmark immediately before mutation. These are not waived. Immutable10f5 explicit-column source compatibility was independently inspected; require fresh provider confirmation it remains the deployed source. If not, stop and review actual source compatibility. No schema FIRE is granted here.

Once this amendment is independently accepted and root records it, the named executor may receive separate schema-only FIRE using these pins and all existing sequential0006/readback/0007/postcondition/partial-failure stops. No final UI SHA is needed for this additive preparation: currently deployed10f5 can continue on the added nullable column/new tables, no code/config is deployed by SQL execution, and no new shared traffic is enabled by this step. If final UI delivery is delayed or abandoned, additive schema remains compatible and data retained; do not undo it or roll back data.

## Final runtime delivery gate remains separate

Before merging/deploying the actual final candidate, independently compare its0006/0007 bytes and executable DB bindings with the schema source pin and recorded remote postconditions. Final candidate must retain compatible shared-aware backend semantics and the accepted recovery procedure. If SQL, binding, relevant session/claim schema assumptions or backend security changed, stop for applicable review; no assumption that all changes are cosmetic. UI-only or count-description corrections need their own appropriate review but do not invalidate unchanged schema bytes. Root still requires final exact-head checks, independent review and real integrated acceptance. Schema applied is not app shipped or acceptance passed.

## Risk / constraint assessment

The actual constraint on schema execution is reviewed DDL+correct existing database+compatible running consumer+exclusive window, not unfinalized UI source. Current pending UI and contract-count metadata findings do not alter those migration files or bindings in the observed485914b tree. Future changes are controlled by the explicit final comparison. The irreversible risk remains writing to the wrong database or partially applying0007; existing exact identity, hashes, quiescence, readbacks and no-blind-retry rules address it unchanged. No new timing promise: executor's actual15-minute estimate/5-minute checkpoint starts only on FIRE and excludes holds. Parallel work saves potential elapsed time, not guaranteed shipment time.

Verdict proposed: **allow schema source gate to close on these reviewed immutable pins**, retaining fresh execution preflight and root FIRE; do not wait solely for final UI SHA. Independent reviewer must accept this explicit scope split before root uses it. No DB/provider/config/code mutation performed by this clarification.
