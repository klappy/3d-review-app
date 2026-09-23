# C2b expected interface — proposed contract of collaboration, not a stub

Bound to accepted C2 plan9778158b and store delta4795b21f. This note is not product code, a replacement store design or an assertion C2a exists. C2a owner retains its four files; exact preview ACK is recorded below, and existing exported operation names were source-verified; smallest naming adjustment may be recorded here without changing semantics.

## Required store seam

Use existing synthetic-report-store.ts exports `buildMaterialized(ctx, assessmentId)`, `readMaterialized(ctx, reportId)`, `listMaterialized(ctx, assessmentId, afterId = null, pageSize = 5)` and proposed `observeBuildEligibility(ctx, assessmentId)`. Context is existing db/principal/now subset. Handler never receives or calls private capture/commit SQL and never supplies renderer, capture, minimum role or trusted marker.

- Build/get success: `{ok:true,value:Report}` using existing immutable internal report fields. Public handler explicitly projects id, createdAt→created_at and payload; no spreading internal reportKey/captureDigest.
- List success: `{ok:true,value:{reports:readonly ReportSummary[],afterId:string|null}}`. Store has validated complete selected page and lookahead before returning. Public projection uses id/created_at only; cursor mints from afterId, the last disclosed row ID. No cursor on held output.
- `HELD`: `{ok:false,reason:'HELD',marker:{assessment_id,eligible:false,policy_version}}`, no other report data. Public fixed held projection uses this marker; no second query.
- `NOT_VISIBLE`, `UNAVAILABLE`, `CONFLICT`, `DETERMINISM`: discriminated failure with no marker/report data. No handler manufactures held authority from these failures.
- Build preview: proposed `{ok:true,marker:{assessment_id,eligible:boolean,policy_version}}` or NOT_VISIBLE/UNAVAILABLE. Only marker crosses this seam, no packed capture/digest. `eligible:false` maps held; true maps exact ready preview. This exact ok:true marker shape, including eligible:false, is ACKed by the actual C2a owner; no alternate HELD shape or dual-shape permissive adapter is accepted for preview.

Server-owned minimum remains member for preview/build and viewer for get/list. Store enforces actual assessment grants including support and validates eligibility from the same observed bytes. Public policy rejects non-user/non-support principals as specified without a grant read. Build's postwrite observation remains authoritative; handler never substitutes preview/prewrite authority.

## Public failure mapping

NOT_VISIBLE → report not found or not visible / NOT_FOUND_OR_NOT_VISIBLE.
HELD(marker) → exact fixed held success, no cursor/IDs/counts/hashes/cadence.
UNAVAILABLE/CONFLICT/DETERMINISM → STAGE_CONFLICT, build uncertain-outcome message vs neutral get/list failure, per accepted plan and pending Auth disposition. Dry-run writes nothing: its infrastructure failure must use neutral request-failure wording, not claim an uncertain write. Record this transport-mode distinction in owner/Auth readback.

## Assembly and testing dependency

Union1c2423d2/tree27786b7f has old disabled B2 interface. No mock/stub/provisional store edits to make C2b compile. C2b can proceed on pinned interface only after FIRE, with dependency incompleteness reported honestly; final compilation/integrated tests use actual coordinator-integrated C2a candidate and exact readback. Do not cherry-pick an unreviewed moving branch or overwrite sibling work. Coordinator pins combined candidate and independent reviewer, then both author suites and public tests run on that exact tree.

## Preserved holds

C2a preview interface ACK is received; Auth exact error/cursor/custody disposition and C2b root FIRE remain open. This note chooses no new user policy, renderer strategy, validation cache, receipt behavior or rollout mechanism. Design owns UI consumption; provider/resource/0008 release remains root-owned.

## Received actual C2a owner ACK

Coordinator relayed actual a8 START07:41:08UTC under root FIRE2dd5e730/k0236 and exact signature:

`observeBuildEligibility(ctx,assessmentId): Promise<{ok:true;marker:{assessment_id:string;eligible:boolean;policy_version:string}}|{ok:false;reason:'NOT_VISIBLE'|'UNAVAILABLE'}>`

Authorized ineligible preview is ok:true with eligible:false, never HELD. Operational build/read/list HELD carries marker eligible:false; other errors have no marker. This is an interface ACK, not completed C2a implementation or independent candidate acceptance.
