# ACCEPT — bounded additive0008 concurrency amendment

Independent reviewer testing_plan_review; author release_reconciliation. Actual review START2026-09-17T08:41:32Z. Exact amendment69c71d73319ee7310af817762dc1b9a83d613e3b8a69eb1c4b235d52247a9e07. Exact SQL2ad9a48901204c4f1a162b99bbe3ba998d9c317c8ded72a6c6e859e87419365a. This is plan acceptance only, not root adoption, execution FIRE or runtime acceptance. No provider read/write, new test, product edit or migration was performed.

## Why the narrower gate is sound

The exact SQL creates one empty new referencing table, its index and two triggers restricted to that table. There is no backfill, parent-table ALTER, old-table trigger, data-copy or DML. Existing assessment/principal primary-key metadata was observed in the earlier provider preflight. The new child starts empty, so parent-row changes cannot race with a migration backfill or create orphan children. Concurrent ordinary DML remains subject to its existing authorization and constraints; this amendment grants none.

Direct exact-source Git grep over deployedbd2f6b27 src/migrations found no synthetic_report references. Fresh source/config equality evidence already records wrangler/0006/0007 unchanged. Existing runtime therefore does not intentionally populate the new table or depend on a partially created report schema. The required source freeze/recheck matters: this conclusion expires if a report-writing runtime or another schema writer is introduced. Once reports are populated, parent deletion/retention interactions change; this acceptance does not apply to that later phase.

Count equality across20 active tables was stronger than needed for this additive action and did not prove data integrity. Trace/login/receipt and separately authorized existing DML can change counts without touching new schema. Keeping before/after counts with explicit unexplained deltas, unchanged existing definitions and clear FK checks is honest. This supports only no old-data mutation by the inspected DDL, not causal attribution for all concurrent activity or a database-wide integrity guarantee.

DDL contention/partial completion remains possible. The amendment does not claim atomic execution, harmless provider contention or automatic retry. Its once-only request, every-statement success, exact readback and stop/reconcile rule preserve the original safety purpose. A missing global Auditor quiet ACK solely for metadata/trace requests is not a technical prerequisite for this empty additive schema. A real no-competing-DDL custody ACK remains a prerequisite under the accepted order.

## Conditions retained, not waived

Root must explicitly persist/adopt this exact amendment before superseding the earlier global quiet/count-equality HOLD. Then actual Auth schema custody, root bounded source/build freeze and exactSQL FIRE must be recorded. Reobserve stable queue/source/version/binding, target absence, all preexisting schema definitions, parent keys, FK/counts/bookmark immediately before action. Earlier preflight captured selected parent/collection schema, so the execution refresh must include the amendment's full preexisting schema inventory; no claim the old selected snapshot already covers all20 definitions.

Postcheck exact table/index/unique/FKs/triggers and empty child, unchanged prior schema, clear FK, unchanged source/binding/queue, and explicit count deltas. New child rows, source/schema drift, unaccounted statements, suspected unauthorized writer or FK failures remain hard stops. Existing count delta alone warrants recording, not replay or destructive recovery. No broad ingress lock, restore,0005, production or report runtime activation is authorized.

Actual executor availability remains conditional15–25 active minutes/checkpoint10 from future execution START; that clock is unstarted. Reporting resource/OAuth/browser/Design and whole-goal acceptance are unaffected. No additional human-only permission requirement is identified beyond the existing root operational authority and genuinely required custody.
