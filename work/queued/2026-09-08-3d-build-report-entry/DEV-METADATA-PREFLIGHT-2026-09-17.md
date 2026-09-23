# DEV report fixture metadata preflight

Actual START 2026-09-17 09:16:02 UTC. Schema-first provider observations completed by09:17:01 UTC; receipt packaging follows. Scope only named fixtures, selected counts and existing exact grants, not Auth's API/MCP campaign or deployment observation.

Account b03e6ea242724c05eb97eb732cceb21d; DEV D1 database5d4cc260-a7b1-47cc-b03d-ed4f60d324c3. Connector's D1 query endpoint uses HTTP POST as transport, but every executed SQL statement was SELECT. Two API invocations: one eight-object schema read; one batch of four metadata SELECTs. All five statements success; each changed_db=false, changes=0, rows_written=0. No login, session/code/secret/raw answer/payload access, inserts, updates, deletes, seed replay, API test calls or provider configuration changes.

## Observed target state

| Requested assessment | Present / active | Surveys | Responses | Existing reports | Mara assessment grant | Mara project grant |
|---|---|---:|---:|---:|---|---|
| assess_syn_model-project-2026-09 | yes / understand, unarchived |3|12|0|owner|owner|
| assess_syn_earning-trust-2026-01 | yes / understand, unarchived |3|12|0|owner|owner|
| assess_tavo_collect | yes / collect, unarchived |4|2|0|owner|owner|
| assess_melo_understand | yes / understand, unarchived |1|2|0|none|owner|

Both positive targets have three selected, unarchived, closed surveys with published template rows present: written v2 six responses, validation v2 four responses, involved_pastor v2 two responses. This closes missing-target and missing-local-fixture-row uncertainty for these two IDs. It does NOT prove source attestation, response content parity, complete global integrity, API authorization enforcement or report readiness. No answer or template-content bytes were selected.

Tavo's two responses belong to survey_tavo, tpl_validation v1, archived_at2026-09-17T07:07:34.102Z, state archived and collection closed. Three selected/open/unarchived v2 surveys (validation/audio/community_pastor) have zero responses. Thus the proposed 'zero responses' explanation for held is false on actual DEV. Accepted report capture includes response membership by assessment without filtering archived survey rows (accepted local source src/report-capture.ts members CTE, lines31–39); do not assume archived responses disappear. Auth must test held under actual state and explain eligibility through runtime outcome rather than pretend an empty capture. No report eligibility was computed here.

Melo has survey_melo/tpl_written v1, selected/closed, two responses. Mara has proj_aster owner but no assessment grant. This supports the intended exact-assessment-grant negative precondition, not evidence that HTTP/MCP hide it correctly.

Mara exists, provisioned1/support0. Ion exists, provisioned0/support0, but **no grant** was returned for any of the four target assessments or their project scopes. Local synthetic.sql line37 contains seed grant_ion_tavo viewer; actual DEV differs, so neither seed presence nor actor principal presence proves a usable viewer grant. Do not silently restore it or create another grant. Query was scoped: no claim Ion has zero grants everywhere or no usable identity route. No actor login was attempted.

## Readiness disposition

READY for Auth to reconcile these metadata prerequisites into its exact runbook: two positive target rows and Mara exact owner grants exist, report table exists, four selected targets have zero current report rows, hidden target's grant shape is as expected.

HOLD on broader acceptance: final deployed merge identity, genuine authenticated/HTTP/MCP/OAuth behavior, strict capture source eligibility and content parity, report execution/immutable writes, fresh role-negative evidence and all root validation FIRE requirements remain separate. The root's no-new-invites/grants ruling is preserved. The stale zero-response and seed-viewer assumptions need runbook correction before FIRE; no seed load is needed or authorized from this observation. Metadata is a timestamped mutable snapshot, not an exclusive-window or same-observation cross-call guarantee.

## Evidence

SCHEMA-REQUEST-RESPONSE.json and TARGETS-REQUEST-RESPONSE.json retain exact connector arguments/SQL and full provider metadata-only responses. TARGETS.sql is the exact four-SELECT batch. Source plan comments5711873552/5711936125 are retained verbatim as attributed proposals/root corrections. No raw credentials or participant answers are present. Provider response metadata served_by='v3-prod' is provider engine naming, not the application production environment; target UUID/account explicitly DEV. No deployment checks were duplicated.
