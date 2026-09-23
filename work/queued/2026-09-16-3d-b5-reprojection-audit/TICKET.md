# TICKET — 2026-09-16-3d-b5-reprojection-audit

**What this is:** Dependency map doc → component and a `reproject` script listing what to rebuild when a doc changes.
**Why now:** The captain ruled everything is a projection of the docs; this is the tool that keeps it true.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: container (Fable) (LANES).
Owner: Fable. Promise: 60 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-b1-docs-corpus.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-b.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row B5](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #15; stitch #17.

Ingredients:
- `10-REPROJECTION-AUDIT.md` @ 6fec90f
- docs from 2026-09-16-3d-b1-docs-corpus

Declared product:
1. `audit/reproject.ts`
2. `audit/REPROJECT-MAP.md`

Done-means:
- A cook can edit one capability doc deliberately, run `reproject`, and observe the affected handlers, docs, UI states and journeys listed.
- A reader can open `REPROJECT-MAP.md` and observe every 04 row with its dependents.
- A cook can observe the output on the deliberate edit matches the expectation written in the ticket receipt.
- CoS can run it after a 04 change and observe which lanes owe a rebuild.
- A cook can observe the script exits non-zero when a doc has no dependents mapped.

## Failure Modes — What Breaks When B5 Is Cooked Wrong or Counted Early
- A doc edit produces an empty rebuild list.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A doc edit produces an empty rebuild list → Map is incomplete; ticket stays cooking.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
