# Proposed two-item roadmap data reconciliation — 2026-09-21

Status: DRAFT for independent publication review. No live write, dry_run, permission probe, verification attestation or publisher ACK occurred. Only existing154/156 and150/160 records are in scope.

Read current DEV sanitized roadmap through exposed 3DReview Dev docs/read. Existing summaries are stale: the roadmap correction still says final build/merge pending; Letter default still says production promotion under review. Both verified-stage projections remain pending because no verifier attestations are recorded. This is distinct from actual Git/build/live receipts.

## Evidence

- Roadmap154 / PR156: [DEV receipt](DEV-RELEASE-RECEIPT-2026-09-21.md), kitchen61da3d3e4cbd84731658bc68d5d9bdac4c474b2c; appmain76fe13823dda23c9c046d2b44cdce94fc0842602, version0.14.4, canonicalDEV build119b0b41-d1c8-445a-9125-3f38b51351c3 and actual live source/identity. Three attempted presentation scenarios passed; two live absent-data cases untested with automated coverage. Production0.14.4 remains pending; [setting-evidence gap](BUGBOT-SETTING-EVIDENCE-GAP-2026-09-21.md)338b2b208e337ac36d03a0c622b6e5a8c238c0dd.
- Print150 / PR160: [production receipt](../2026-09-18-survey-letter-default/PRODUCTION-DELIVERY-2026-09-21.md), kitchen1dc6e3ffd94a1309233cc026b71f81e5517c97cb; appproduction0b798cede7f5ed4a5ccc82de4e196a5587f8ecef, version0.14.3, canonical buildd16a3609-e25f-4e24-88aa-655907515bc0 and active/live source evidence. Physical print pagination and reporter acceptance remain unmeasured. Issue150 stays open.

## Minimal proposed public summary changes

Preserve current title, feedback, priority, scope, recurrence, work_type, release_impact, release_reference and breaking fields unless explicitly below. API summary requires a complete object: re-read and copy unchanged values during preparation rather than submitting a partial replacement.

For “See clear roadmap stages and the active queue”:
- outcome: “Version 0.14.4 is deployed and verified on DEV. Three attempted live presentation scenarios passed; two cases absent from the live data retain automated coverage. Production delivery and user confirmation remain pending.”
- happening_now: “DEV delivery is verified. Production promotion is waiting for the required review-service setting evidence.”
- blocker: “Applicable comment-only review-service configuration has not yet been verified for a new production promotion.”
- next_action: “Resolve the promotion prerequisite, then complete the normal reviewed production release and live verification.”
- queue_order: null; queue_rank: null; workflow: now. This identifies a blocked release in progress, not an invented active coding worker.
- recurrence remains: “Live user confirmation remains unmeasured.”

For “Print surveys on US Letter by default”:
- outcome: “Version 0.14.3 was delivered to DEV and production with source and serving-release verification. Physical print pagination and reporter confirmation remain unmeasured.”
- happening_now: “The Letter-default software change is delivered. Physical printing and reporter acceptance remain follow-up work.”
- blocker: “Physical print pagination and reporter confirmation have not been observed.”
- next_action: “Confirm the paper-print result and original reported scenario; keep issue 150 open until acceptance is recorded.”
- queue_order: null; queue_rank: null; workflow: past for the software delivery, with outstanding outcome stated explicitly. This lane proposal needs publication-review acceptance; it does not close the issue.
- recurrence remains: “Physical print pagination and reporter confirmation remain unmeasured.”

## Stage corrections: claims and verification stay distinct

Propose a new DEV-done publisher event for154 at0.14.4/source76fe138 with PR156 and exact DEV receipt commit as evidence. Propose a new production-done publisher event for150 at0.14.3/source0b798ce with PR160 and exact production receipt commit as evidence. Neither event alone turns verified stages green. Do not infer every preceding stage is verified or mark production0.14.4 done.

A separately authorized verifier may attest only the precise event/stage it independently checks, using returned event sequence and exact evidence. Existing reported stages can be verified separately if their specific source/evidence is actually reviewed. This proposal neither requests universal verification nor grants attestation authority.

## Existing capability and custody path

Observed docs expose cap.ops.roadmap_publish, cap.ops.roadmap_summary and cap.ops.roadmap_verify as write.effect through existing danger tool: dry_run impact/confirm_token then execute with unchanged params. Access requires signed-in identity plus narrow server-configured roadmap permission. Tool exposure and successful public read do not prove current publish/verify rights. No current publisher or verifier ACK was observed or invented.

Coordinator obtains actual publisher custody ACK and independent exact-text publication review, then freshly reads cursor and both existing records. Preserve state changed since this observation. Prepare new idempotency keys, literal evidence refs and complete summary bodies; refresh expected_cursor after each successful sequential write. Do not reuse this observation's cursor blindly. Confirmation expiry/conflict returns to fresh review of current state; no blind retry. Read back sanitized rows and final cursor after authorized writes. Any verifier handoff is separate, using actual returned event sequence.

Publication copies reviewed operational status, not Chris's personal voice. Public artifacts exclude private occurrence payloads, actor identities and credentials. No production database or production-roadmap equivalence is inferred from this DEV tool observation. No new feature, ticket duplication, database bypass or direct storage edit is proposed.

## Independent coordinator publication disposition

ACCEPT the exact two-item public summary changes and two reported-stage events above for DEV only, following review against the landed production1dc6e3f and DEV61da3d3 receipts and fresh health observation21:46:56EDT. Preserve all specified untouched fields, outcomes unknown, issue150 open and production0.14.4 pending. Past denotes delivered software, not human acceptance. No verifier attestation is authorized by this disposition.

Under Chris's accepted roadmap-data reconciliation and CoS whole-roadmap delegation, assign bounded publisher execution to orphan_audit upon its actual ACK. Prior failed coordinator custody is recorded in the existing recovery receipts; this takes only these reviewed metadata updates, displacing no source author/active feature claim. Actual server permission must be demonstrated through the normal exact-parameter dry_run; no privilege/configuration changes or direct database access. Denied permission is a capability gap, not an instruction to bypass. Fresh cursor/state and impact review precede each sequential execute; readback receipt required. No production database claim and no personal-voice communication.
