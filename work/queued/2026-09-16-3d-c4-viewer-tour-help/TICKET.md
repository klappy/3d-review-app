# TICKET — 2026-09-16-3d-c4-viewer-tour-help

**What this is:** Surfaces 5 (viewer/results) and 8 (tour), against contract mocks.
**Why now:** J6/J8 UI journeys; the viewer-sees-summary step is in the demo.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (Claude Design) (LANES).
Owner: Design. Promise: 120 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-c3-assessment-context.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-c.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row C4](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #16; stitch #17.

Ingredients:
- `06` surfaces 5/8 @ 6fec90f
- results semantics from `14` @ 6fec90f

Declared product:
1. `ui/viewer/*`, `ui/tour/*`
2. #16 receipt: J6/J8 browser runs

Done-means:
- A viewer can open results and observe the summary per language within a project, per 14.
- A viewer can observe a suppressed result rendered as suppressed, never as empty data.
- A cook can replay J6 and J8 and observe both pass.
- A first-time user can start the tour and observe every demo-path surface visited.
- A reader can observe reports/recommendations shown where implemented and marked target/not implemented where not — never blank.

## Failure Modes — What Breaks When C4 Is Cooked Wrong or Counted Early
- Suppressed data renders as zero rows.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- Suppressed data renders as zero rows → Blocked; privacy finding.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
