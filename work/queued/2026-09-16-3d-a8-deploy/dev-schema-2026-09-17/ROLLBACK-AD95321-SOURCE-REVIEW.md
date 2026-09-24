# Independent bounded rollback source review

Verdict: **ACCEPT as shared-aware backend source candidate; AMEND operational recovery readiness.** This read-only review is not runtime acceptance, deployment authorization or proof that a recovery Worker version exists.

Published integration branch observed `485914ba578800465a88a3f7afc448bf2e38f73e`. Its reachable intermediate is **`ad95321e99923666b3dbc9eac163710e6e70ad41`** (parent `699ea5137f536eb601dd79a0abd5f3437ff3f3e5`). Thus the candidate is retrievable by commit through the published branch even though Design reports its rollback tag as local. Keep the full SHA in governed release cargo.

## Shared security retained

Inspected actual immutable source, not merely assembly claims. The intermediate's `src/handlers/shared-link.ts`, `participant.ts`, `response.ts`, `survey.ts` and0007 are byte-identical to API24 `fc0bbc36cd79f8f477b170e4d3962d414625d332`. Shared helper checks invitation status/scope/survey and expiry; sharedSession checks unique association, session revocation/expiry and active invitation. `response.form`, `submit`, and `receipt` all enter sharedSession; form/new submit require collection open, while receipt remains scoped to the authenticated respondent. Resume enforces same invitation/survey, token shape, session lifetime and no fallback to new identity. Submission preserves respondent-scoped claim identity and canonical payload/key digests; conditional inserts recheck link/session/collection lifetime and combine response+claim in D1 batch, with unique conflict replay only after authority revalidation. No change to those runtime files between intermediate and inspected combined485914b.

This avoids the known legacy10f5 rollback gap:10f5 has no invitation-bound session enforcement or shared claims. This is a source-fidelity assessment of retained API protections, not a new claim of exhaustive security testing or remote atomic behavior. Existing independent API/Auth reviews and native final-combined acceptance remain necessary.

## Auth provenance correction

Design comment5708840163 says2315a82 is an ancestor. Git graph disproves that literal claim: merge-base of `2315a82829afe152539dd31fe3da93d57b940c1f` and485914b is `a3defc04677585acaa547492634bb50d5a927c2e`. The intermediate descends from a3defc0 via699ea51, an exact Auth hunk commit. **Both2315a82 and699ea51 have identical full tree `a03ea6220818eceb2ded471794e1773fcdf25a90`.** Therefore released Auth content is fully included; correction is “tree-equivalent exact hunk,” not “ancestor.” No Auth content loss found. Auth protected runtime/config diff a3defc0→ad95321 was empty for auth/dispatch/worker/oauth/wrangler inspected, and backend added delta matches API candidate.

## Migration/config compatibility

Intermediate contains0001–0004,0006,0007; no0005. Hashes:

-0006_oauth_code_redemption.sql SHA256 `7b0b0d2dc7f2d22fbcc57f065c9746ca3b393bfac7463b969b908b9c72748121`
-0007_shared_link_context.sql SHA256 `1fe0f9e014a4a716caf0c45d88d2adc2fc0b288390464fc430f62f1243a7a88a`

Both match accepted DEV rollout. Existing data/schema are retained; no downmigration or replay required. Root executable wrangler config selects3d-review-dev, DB `5d4cc260-a7b1-47cc-b03d-ed4f60d324c3`, Auth's five distinct DEV limiter namespaces and OAuth KV, Worker entrysrc/worker.ts, same executable config as Auth. Its historical branch comments remain stale (phase0DEV/mainprod) and must not govern today's mainDEV/productionprod control plane. Config presence does not prove remote secrets/bindings/version availability.

## Required operational completion before shared traffic

The source intermediate retains legacy UI, so rolling back the whole tree would remove shared-link browser entry/resume presentation although backend data/security checks remain. Treat as degraded recovery, not successful participant journey or final app acceptance. Existing participant tokens/records must remain private and cannot be converted into new respondents as a convenience.

No independently verified built Worker version forad95321, provider rollback action target, or root disposition for a recovery Git build was observed. An unbuilt SHA alone is not an immediate rollback button. Root must record the selected viable recovery mechanism: either an actually available reviewed shared-aware Worker version with its exact source/config identity, or a governed Git-built recovery candidate retaining this backend and verified participant isolation during the recovery interval. Do not force-reset main, bypass PR checks, manually deploy, change production, or infer new provider authority from this review. Existing rollout already requires a reviewed viable recovery path or verified participant read/write isolation before shared traffic; those operational gates remain HOLD.

The source candidate is sufficient to resolve “which backend can preserve shared protections?” It is not, by itself, sufficient to close all DEV-schema/runtime security gates. Additive schema execution can retain its separately reviewed pre-promotion gates; shared traffic cannot open until recovery/isolation and final runtime acceptance evidence exist. No tests were duplicated, DB/provider mutations performed, or code changed in this review.
