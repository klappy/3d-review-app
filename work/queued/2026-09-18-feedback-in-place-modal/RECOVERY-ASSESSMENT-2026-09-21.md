# Feedback-in-place recovery assessment — 2026-09-21

Status: read-only assessment; no implementation fire, source transfer, rebase or release authorization.
Existing ticket: TICKET.md / DESIGN.md in this directory. App #159 is a bounded child of #130; cookbook #99. Owner remains permissions_increment for intake; root coordinates delivery. No fresh source-owner acknowledgment observed.

## Exact observed cargo

App head 332b862903c2d3961681649d2d450fd7fe669e8a, draft feat/feedback-in-place.
Current main observed 76fe13823dda23c9c046d2b44cdce94fc0842602.
Compare main...head: ahead 3, behind 2; merge base d5c7b259542b4e2ad2f45f91c1fa103245cb6094.
PR metadata base_sha still 2e9cb18b80dc60e93631dac56c8f2c2c3bd0ed36; actual branch comparison governs.
Three candidate commits:
- ab8c83de7b42decd25ae0af96f42e9d5d9442621 — in-place modal and loaded-client context.
- 5a77efa4d97fd25e48b0be2410235c46a21186d4 — context amendment/provenance roundtrip.
- 332b862903c2d3961681649d2d450fd7fe669e8a — canonical 0.15.0 pin.

Exact-head Workers check 105802366332 completed SUCCESS, build 3ce0422e-d48c-46ec-9200-0e4ca300e713, version a8a2e4e9-d229-467b-99d2-9bd95ed681aa. One check returned; no Bugbot or reviews returned. Old check success does not cover a reconciled head.

## Retained evidence and its limits

[Canonical candidate specification](https://github.com/klappy/3d-review-cookbook/blob/7c1bd9e40e9f5a0cd94172f9d5d8e3fd5157e65d/planning/2026-09-16-parity-build/AMEND-2026-09-18-feedback-in-place-context.md)
[Candidate release evidence](https://github.com/klappy/3d-review-cookbook/blob/7c1bd9e40e9f5a0cd94172f9d5d8e3fd5157e65d/planning/2026-09-16-parity-build/releases/0.15.0.md)
[App PR159](https://github.com/klappy/3d-review-app/pull/159)
[Cookbook issue99](https://github.com/klappy/3d-review-cookbook/issues/99)

The two cookbook paths return 404 on default main but exist at full pinned commit above: retained branch cargo, not an orphan finding.
Author local actual-controller Chrome fixture: unfinished input preserved/URL unchanged; draft retained on reopen; Escape restores opener. Three scenario families, not independent normal-shell proof.
Author recorded 21 feedback/identity DOM tests,20 provenance tests,16 version tests and typecheck passing, with final repin version rerun tracked separately. Those are historical author receipts, not newly executed tests.
Normal-shell fixture attempt timed out before observation. Browser acceptance remains untested; human outcomes unmeasured. No live feedback write.
Local original receipt: /Users/chrisklapp/Documents/Codex/2026-09-17/3d-review-fresh-overhaul/outputs/feedback-in-place-local-evidence.md.

## Custody and bounded gates

ui/assess/assess.js is shared with #149's newly observed sign-in-return dependency. Keep that navigation change OUT of #159. Root must explicitly assign reconciliation custody under existing recovery authority; silence or an old task failure is not itself a handoff.
1. Preserve all three candidate commits and historical receipts; reconcile against actual current main, retaining #156 roadmap corrections.
2. Review exact resulting diff and reconcile cookbook99 candidate source/pin,0.15.0 package/manifest/changelog and immutable record relationships.
3. Re-run affected modal/provenance/version/typecheck checks at exact new head; independent browser proof must use actual normal shell with synthetic authorized data and intercepted submission.
4. Prove input/DOM/route preservation, draft/Escape/focus, route/identity departure and late-response invalidation, allowlisted outbound context and loaded-client identity. No live feedback write needed.
5. Independent exact-head source/browser review, terminal Bugbot and all required checks, then canonical MAIN/DEV verification before same-version identical-source production promotion. Merge is not deployment.
6. #130 remains broader than this release. Attachments152, aggregation155, print149 and greeting161 are excluded.

This record is an assessment only; existing source and ownership preserved. Subsequent coordinator-reviewed reconciliation draft must pass planning/fire gates before work begins.
