# Existing report-entry: API → Design planning handoff

Proposed next bounded Design bill after its current badge/copy candidate freeze. Design remains the actual UI/spec owner; root routes and authorizes. No implementation FIRE, UI author ACK or delivery promise is made here. Backend/root DEV validation can proceed independently; integrated reporting cannot be claimed until the actual browser journey passes.

## Reuse the existing surface, correct the semantic mismatch

Existing home: kitchen `rail/1-ordered/2026-09-08-3d-build-report-entry/`. At observed cookbook design-system7f442498, reuse `design-system/cards/ReportCard.md`, `design-system/ui_kits/3d-review/views-coordinator.js` (`_understand`, `_understandBody`, viewer), `copy.md`, existing tokens/ContextTree/navigation and coverage method. Do not build another dashboard.

Those existing kit examples are explicitly illustrative: band words/smileys, fake evidence sentences, review dates, recipient variants and reserved report cards. They are not the accepted synthetic API output. The current renderer returns source numeric lens/subdimension/construct data, deterministic narrative and source evidence; no accepted numeric→Strong/Growing band mapping exists. Design must adapt the existing card/detail treatment to those semantics, not infer bands or reproduce mock data. A new per-report human review requirement for pinned deterministic prose would contradict the settled source ruling. The explicit danger confirmation remains required and is different from approving an LLM interpretation.

## Frozen consumer contract

Use app draftPR28 exact68f795cb (C2b b8a1b4e source) and cookbook18-B123ce96; final integration may preserve newer siblings. Source-readable contract: `docs/synthetic-report-api.md`, three report rows in capabilities/OpenAPI; owner conditions cookbook14c5710852889. No new backend/API/receipt/DDL authorship under Design.

| User action | Actual API and meaning |
|---|---|
| Ask to build | POST `/v2/assessments/{aid}/reports`, `{mode:"dry_run"}`. Returns ready or held plus impact, confirm_token, expires_in. Preview writes no report/receipt. Do not build automatically on entering Understand. |
| Confirm deliberate build | Same POST `{mode:"execute",confirm_token:<preview token>}` with identical params. Current-at-execute inputs are evaluated; no promise of preview-cohort freeze. Disable duplicate pending clicks; do not silently retry. |
| Open existing result | GET `/v2/reports/{id}`. Success has assessment_id, suppressed:false and report{id,created_at,payload}; do not substitute current summary data into a saved report. |
| List/reopen | GET `/v2/assessments/{aid}/reports`, optional opaque cursor. Success has reports[{id,created_at}] and next_cursor; five results plus validated lookahead, live keyset rather than complete chronological history. Do not decode cursor or infer totals. |

Payload `3d-synthetic-assessment-report-v1` includes synthetic:true, source_commit, versions, assessment_id, distinct lenses/subdimensions, cross_lens_multi/single, standalone_indicators, translation_type_agreement, evidence and narrative. Render approved fields as text, retain source labels/missing/null/categorical distinctions and ordering. Never average the lenses into a new overall score or invent recommendations. Progressive detail can keep the existing concise card layout while exposing the actual source-backed evidence and limitations.

Member/owner can build; viewer-or-higher can read only with an exact assessment grant. Support also needs that grant. Participant credentials and a guessed report URL confer no access. This slice does not introduce anonymous recipient links or expose real participant results. A report route can reuse the viewer presentation but remains authenticated/private under the actual contract.

## Smallest complete visible journey

1. An authenticated authorized staff user opens a known pinned synthetic assessment's existing Understand/report area. Its synthetic/source-limited nature is clear before action; collection and real-result suppression remain truthful.
2. Staff explicitly previews, sees the irreversible-disclosure meaning, confirms, and sees the actual created/opened report. Display the report timestamp/source/version meaning without confusing it with the app release badge or claiming a human reviewed it.
3. Render the report's distinct perspectives, available source details and deterministic narrative. Reopen the same immutable report through its assessment list after reload. Viewer can open an authorized report without a build affordance granting new rights.
4. Real/mixed/unknown/empty inputs produce the fixed held experience. The UI must not display stale report content, hidden IDs/counts/cursor/digests or imply that missing evidence is a poor score. Revocation/unknown target share a not-visible experience. Loading, empty eligible list, expired/malformed cursor and transport failures each have truthful recoverable states.
5. Execute uncertainty must not say no report was created. Use the accepted meaning: outcome unconfirmed; inspect reports before choosing a retry. Read/preview failures say the request could not be completed. No raw internal error code or automatic retry. A held execute receipt means the operation completed, not that materialization occurred.

## Observable acceptance and requested owner return

Design returns exact consumer paths/current base, copy and state treatment, actual worker availability/estimate/checkpoint, and any concrete mismatch with the frozen API. Preserve existing badge/copy/feedback writers; one owner edits each UI file. No broad kit rewrite or new public sharing flow.

Candidate review must show source-backed fixtures for ready/held/empty/loading/error/not-visible and viewer/member states, accessible keyboard/mobile presentation, escaped payload text and no mock band/score conversion. Actual browser proof on the deployed frozen source must include explicit preview→confirm→report, list/reopen after reload, held real-data boundary, exact-role refusal and uncertain-submit copy. Backend tests are not browser evidence. Record app SHA/build/Worker/cookbook pins and corresponding API results/screenshots; no participant data in cargo.

Report content, API/private authorization, real-data D7 and runtime release limits are already scoped. Design may propose a smaller UI iteration but must name which visible journey remains absent; root will not label an API-only result an integrated reporting experience. No new human-only fork is identified by this handoff.
