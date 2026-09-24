# TICKET — 2026-09-16-3d-s2-cold-live-proof

**What this is:** A fresh session with no sources: sign in, create assessment, codes, print, participant submit by code, viewer sees summary and reports/recommendations where implemented, undo, trace.
**Why now:** This is the captain's fully-functional-demo DoD.
**Your move:** Drive the demo.

Class: entrée. Risk: STANDARD.
Station: captain seat (captain drives; CoS records) (LANES).
Owner: CoS. Promise: 53 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-s0-simulation-cast, 2026-09-16-3d-s1-swap-mock-live.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-s.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row S2](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #17; stitch #17.

Ingredients:
- live URL
- S0 go/no-go
- `audit/PARITY.md` at the demo SHA

Declared product:
1. #17 `S2-proof.md`: screenshots + receipt ids per step
2. rail: this ticket's receipt

Done-means:
- A reader can observe a screenshot and a receipt id for each demo step, in order.
- A reader can observe every deferred row named, and no 501 counted as functional.
- A reader can observe the trace step returning the spans of an earlier demo call.
- A reader can observe the undo step on a row with a declared inverse, and its receipt.
- The captain can observe the demo SHA and the parity numbers at that SHA in the proof header.

## Failure Modes — What Breaks When S2 Is Cooked Wrong or Counted Early
- A step fails live.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A step fails live → Record it as ❌ with owner; continue to the next independent step; the meal does not plate.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.

- 2026-09-16 15:06 ET — OF-8 ruled: the demo is the full v2.0-bcs slice; reports/recommendations screens show an honest "not built yet" (next push). Re-pinned to cookbook 6fec90f.
