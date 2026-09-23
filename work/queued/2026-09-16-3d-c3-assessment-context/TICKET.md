# TICKET — 2026-09-16-3d-c3-assessment-context

**What this is:** Surfaces 2 (assessment), 3 (context), 7 (help) against contract mocks.
**Why now:** J1/J3/J5/J9 UI journeys; the owner's create-assessment path is in the demo.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (Claude Design) (LANES).
Owner: Design. Promise: 150 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-c1-tokens-ui-states.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-c.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row C3](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #16; stitch #17.

Ingredients:
- `06` surfaces 2/3/7 + `13` @ 6fec90f
- contract mocks from 2026-09-16-3d-a1-contract-freeze

Declared product:
1. `ui/assessment/*`, `ui/context/*`, `ui/help/*`
2. #16 receipt: J1/J3/J5/J9 browser runs

Done-means:
- An owner can create an assessment in the browser and observe the receipt rendered per B4.
- A member without a grant can open a scoped view and observe the 404 experience, not a hint of existence.
- A cook can replay J1, J3, J5 and J9 in the browser and observe all pass.
- A user can open help and observe the B1 doc for the surface they are on.
- A reader can observe every write action offers undo only where the row declares an inverse.

## Failure Modes — What Breaks When C3 Is Cooked Wrong or Counted Early
- Undo is shown on an `inverse: none` row.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- Undo is shown on an `inverse: none` row → Remove; parity ❌ until fixed.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
