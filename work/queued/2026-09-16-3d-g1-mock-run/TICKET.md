# TICKET — 2026-09-16-3d-g1-mock-run

**What this is:** The cast executes against the frozen-bundle mocks; every observation classified per 11 (missed constraint / missed assumption / defect / copy) with the tool call and trace.
**Why now:** Lanes fix tonight what personas find tonight; privacy/auth/integrity items first.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (GrokBot) (LANES).
Owner: GrokBot. Promise: 180 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-g0-affirm-cast, 2026-09-16-3d-a1-contract-freeze.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-g.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row G1](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #19; stitch #17.

Ingredients:
- cast from 2026-09-16-3d-g0-affirm-cast
- frozen bundles from 2026-09-16-3d-a1-contract-freeze
- `11` classification @ 6fec90f

Declared product:
1. #19 report `G1-mock.md`: observations table (persona, journey, tool call, class, trace id)
2. ❌ list on #17 for lane owners

Done-means:
- A reader can observe every persona ran every assigned journey, or the skip named with a reason.
- A lane owner can open any observation and observe the exact tool call and, where one exists, the trace id.
- A reader can observe privacy/auth/integrity observations listed first.
- A reader can observe each observation carries exactly one 11 class.
- CoS can observe the ❌ list posted on #17 with an owner per row.

## Failure Modes — What Breaks When G1 Is Cooked Wrong or Counted Early
- Observations against an open bundle are reported as defects.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- Observations against an open bundle are reported as defects → Reclass as UNVERIFIED; do not assign an owner.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
