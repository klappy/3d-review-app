# Bounded design — feedback concern aggregation

Authority: [app155](https://github.com/klappy/3d-review-app/issues/155), child of [132](https://github.com/klappy/3d-review-app/issues/132), coordinated with [130](https://github.com/klappy/3d-review-app/issues/130) and [116](https://github.com/klappy/3d-review-app/issues/116). Future queued. Existing feedback remains the private source inbox; concern projection is not permission to expose that inbox.

## First slice and boundaries

Start with linked concern groups, useful counts and safe receipt/read projection through the existing API/MCP pipeline. The frontend and team/LLM clients consume the same authorized projection. No duplicate feedback backend, voting, autonomous clustering, automatic priority or changes to current release patches. No version assigned. Discover existing storage/linkage contracts before implementation; this design does not assert that they already exist.

## Counting contract

Publish distinct labeled quantities: related report occurrences, distinct affected users only when identity is known and disclosure permitted, and linked open work items. Reports are not GitHub issues; votes are not people. Deduplicate ingestion. Repeated submissions by one known actor add occurrences, not people. One occurrence may belong to several concerns but counts only once within each concern. Unknown/anonymous identity remains explicitly unknown, not a fabricated user count or zero.

Pending counts reports without resolved disposition. Keep queued, active, awaiting user confirmation, deferred and resolved dispositions inspectable. Document definitions and as-of time in the shared projection. A released fix is a linked attempt; it does not automatically resolve a concern or every occurrence. Delivery status remains independent.

## Submitter journey

Successful feedback submission stays successful if grouping is pending. Receipt shows a concern title when available, related pending-report count when safe/known, and queued/active/released work status. Pending classification is explicit and updates afterward. Offer possible related concerns before submission without requiring a search, blocking a new report or adding a reporting chore. Let the submitter flag an incorrect match; do not silently discard their occurrence.

## Grouping, custody and correction

Preserve every original occurrence with experienced version and submission version separately. AI may propose group links with reasons and uncertainty; related symptoms do not establish shared root cause. Authorized merge, split, unlink and correction operations retain accountable history and source linkage. Track recurrence before delivery separately from recurrence after each released fix attempt, including unresolved version context. Preserve source→concern→work→decision→attempt→release→same-scenario outcome linkage.

Apply existing visibility/tenant scope before aggregation. Raw private text, identities and restricted populations must not leak through titles, counts or evidence. Exact counts may require withholding/generalization for restricted cohorts; choose and test a documented policy before implementation rather than inventing a threshold here. Group reads expose safe patterns, version clusters and fix-attempt evidence with the same authorization through API/MCP and UI. Human stewardship remains responsible for grouping/prioritization; popularity alone grants no authority.

## Finite acceptance matrix

Counting fixture: duplicate ingestion; repeat submissions by one known person; several known people; one report linked to multiple concerns; unknown identity; recurrence after a released fix. Assert each distinct count and unknown label without double counting.

Lifecycle fixture: successful receipt while grouping is pending; later safe grouping result; user flags wrong match; authorized merge/split/unlink preserves history; scope-restricted read cannot reveal a private cohort; UI/API/MCP return equivalent allowed projection. Fix release leaves unresolved reports pending until an explicit disposition. These are planned checks, not passed tests.

Measure report-to-actionable latency/completeness under130 separately from group size or votes. Preserve uncertainty and human confirmation status; no inferred satisfaction or efficacy from shipping.
