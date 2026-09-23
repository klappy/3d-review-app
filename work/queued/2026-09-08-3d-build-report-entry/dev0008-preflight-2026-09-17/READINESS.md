# DEV0008 read-only preflight

Actual START 2026-09-17 08:23:42Z. Read-only observations through08:28:37Z. No SQL mutation, provider mutation, deploy, push or execution FIRE occurred. This is readiness evidence, not runtime/report acceptance.

## Stable post-PR31 observations

Main bd2f6b27eb3ced85099c525793ac79cbdea2b7e5 maps directly through provider version lookup to successful build192a88ef-a6fb-4ab3-9b79-1fedd5c06023 (stopped08:25:59.974Z), deployment6b09e0ec-6f44-486d-b2d8-8e733aa8371d and active versione40439d4-0ee0-4168-b3d4-d3ec23baf8b7 at100%. Complete22-build inventory at08:27:35Z has all jobs stopped; this is an observed drained queue, not a promise that no new work can arrive.

Fresh settings08:28:16Z bind DB to5d4cc260-a7b1-47cc-b03d-ed4f60d324c3 in accountb03e6ea242724c05eb97eb732cceb21d. Compatibility2026-09-01, usage_model standard, no limits field; no entitlement/CPU/peak-memory inference. main config and0006/0007 blobs equal prior299f825 and reviewed report candidate68f795cb. PR31 changes12 release/version files, including package/lock/MCP; it is not literally health-handler-only. No config, prior migration, report handler or storage delta. Main has no0008.

Provider schema reads confirm synthetic_report, its named index/two triggers and d1_migrations absent. Existing collection/Auth definitions and assessment/principal PK/FK metadata are captured in SCHEMA-BASELINE/PARENT-METADATA. Fresh foreign_key_check empty.22 fresh read statements each success, rows_written0, changed_dbfalse. No answers/credentials/participant rows retrieved.

Counts08:28:16Z: access_code38; assessment55; assessment_survey128; feedback134; grant102; invitation3; language35; login_code249; oauth_code_redemption0; participant_session16; principal14; project39; receipt912; request10; response435; session207; shared_response_claim2; survey_template18; trace2836; workspace9. Platforminternal _cf_KV excluded. Counts are a baseline, not an assertion of quiescence or unchanged historical counts.

Bookmark08:28:16Z: 0000004a-00000000-000050e9-41026f00a9f80f0593449c367f1e034b. Earlier bookmark differs; no restore authorization and no inferred cause. Refresh immediately within the actual quiet execution window.

## Capability and honest failure

This executor authenticated successful GET metadata/bookmark/build calls and SELECT/PRAGMA against exact DEV DB. It proves read access, not independently pre-proven write permission. One initial20-term UNION count query failed provider7500 too many compound SELECT terms; no mutation statements were present. Replaced with20 separate SELECT statements, all successful. Failed receipt retained. Metadata output is sanitized to omit irrelevant author/token identifiers.

## Remaining execution holds

Actual root/native schema custody and quiet ACKs have not been delivered to this executor. Observed queue drain does not close those holds. Separate root exact-SQL FIRE remains required; mutation clock not started. Refresh source/queue/binding/schema/counts/bookmark at that window, reconcile drift and stop unexpected deployment/new queue/schema writer. Final report candidate integration/runtime/resource/Design gates remain distinct and open. No need for generic new user permission.

Conditional executor estimate remains15–25 active minutes from actual mutation START, checkpoint10. Read-only work is complete enough for the coordinator to review a concrete order; no write should use this timestamped baseline without immediate refresh.
