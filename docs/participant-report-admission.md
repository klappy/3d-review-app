# Participant report admission

## Current released behavior

Participant-only report captures are admitted in DEV. Production admits them only when `ENVIRONMENT=production` and `PARTICIPANT_REPORTS=enabled`; unknown environments and other values hold them. This is server-owned admission, never a request parameter or an authorization bypass. See [the admission predicate](../src/report-admission.ts).

Production activation was explicitly approved on October 14 and made durable in the production configuration on October 15. The released configuration includes `PARTICIPANT_REPORTS=enabled`; do not treat the historical candidate/default-off description below as a new approval request. Activation and preservation evidence is recorded in the cookbook's [activation receipt](https://github.com/klappy/3d-review-cookbook/blob/main/work/active/2026-10-14-reporting-delivery/ACTIVATION-PERSISTENCE-2026-10-15.md). Removing the value holds future participant builds and reads again; it cannot retract reports already seen or copied.

The existing assessment-wide minimum of five responses, refusal of mixed pinned fixtures/participant captures, effective assessment access (direct assessment or containing workspace grant), preview/confirmation, immutable snapshots and source-derived scoring remain. The three-response per-perspective minimum controls overview bands only. Full reports can contain smaller-group aggregates; five and three are existing working defaults, not a validated privacy guarantee. The owner accepted this disclosure shape for activation; this document does not change it.

DEV only (`ENVIRONMENT=dev`): the server-owned floor is one participant response (`src/report-admission.ts` `participantReportMinimum`), and UI Next bands a perspective from its first response with a coverage jar beside the level (3d-review-cookbook `work/active/2026-10-26-3d-report-threshold-coverage`). Every other environment, production included, keeps the five-response floor above; lowering it there needs its own disclosure decision.

Raw response lists, demographic breakdowns and row-level exports remain held. No new scoring formula or global quality average is introduced.

## Temporary Summit override (local candidate)

The Summit decision authorizes numeric reports from one participant response. The server-only variable `SUMMIT_ONE_RESPONSE_REPORTS=enabled` lowers assessment admission from 5 to 1 and per-perspective numeric levels from 3 to 1 in known DEV/production environments. This candidate enables it in production configuration; it is not a deployment receipt. Missing, malformed, or disabled values restore the existing production floors. DEV remains at its existing 1/1 defaults. Participant admission, grants, immutable snapshots, scoring, zero-response holds, and missing/unasked axes are unchanged.

Rollback: remove `SUMMIT_ONE_RESPONSE_REPORTS` from production vars and release through normal gates. Revisit after Summit. Previously viewed/downloaded aggregates cannot be retracted. One-response numeric aggregates represent that person's answers; retain true counts and limited-coverage cues. Raw responses, demographic/small-cell answer splits and question disclosure remain held under existing rules. Translation-type categorical agreement retains the prior per-environment 3-response production minimum rather than inheriting the temporary numeric override.

Radar limitation: Detailed's shared-construct overlay is not Steve's per-perspective subdimension radar. One response supplies only one perspective; its genuine subdimensions exist, but no cross-perspective axes qualify. Do not fabricate missing scores or zero-fill to close that chart. A separate per-perspective chart presentation is needed for preview parity; this threshold candidate does not change chart semantics.

## Verification boundaries and documentation debt

On October 15 the production OAuth connector built, read and listed two source-pinned synthetic reports from existing imported assessments, with identical immutable readbacks. That verifies those synthetic API/MCP journeys. It does not establish participant-only production reporting, an authenticated browser journey, or embedded-host UI rendering. See the cookbook's [scoped production report receipt](https://github.com/klappy/3d-review-cookbook/blob/main/work/active/2026-10-14-reporting-delivery/PRODUCTION-STEVE-REPORTS-2026-10-15.md).

The projected `cap.report.build/get/list` capability descriptions still say synthetic-only and real-data reporting held. Those descriptions lag the admission predicate and released production configuration. Their canonical-source reconciliation is separate: follow [the feedback documentation procedure](https://github.com/klappy/3d-review-cookbook/blob/main/planning/2026-09-18-feedback-docs/PROCEDURE.md), amend the owning source and then update its projections/pins. Do not infer policy from stale wording, edit only a generated projection, or replace its missing current authority with an invented one.

## Historical candidate state

Before explicit activation, the 0.30.0 candidate left production disabled and changed no Worker variable or deployment configuration. It required disclosure-policy approval, independent review and normal release gates before activation. That earlier default-off state is superseded by the recorded activation above; its tests and approval chronology remain in the cookbook.
