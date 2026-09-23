# TICKET — 2026-09-16-3d-b4-error-receipt-style

**What this is:** Error code catalogue with hints, and receipt rendering rules with agent-facing examples.
**Why now:** J8/J9 depend on it; Design (C2–C4) renders from it.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: container (Fable) (LANES).
Owner: Fable. Promise: 60 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a1-contract-freeze.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-b.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row B4](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #15; stitch #17.

Ingredients:
- `05` §errors/§receipts @ 6fec90f
- error schemas in 2026-09-16-3d-a1-contract-freeze

Declared product:
1. `docs/errors.md`
2. `docs/receipts.md`
3. #15 receipt: J8/J9 pass

Done-means:
- A cook can look up any error code from the contract and observe a hint and an example.
- Design can read `receipts.md` and observe the rendering rule for every receipt kind (accepted, delivered, suppressed, undone).
- A cook can replay J8 and J9 and observe both pass.
- An agent can observe that every error in the contract has a code present in `errors.md` — lint = 0 missing.
- A reader can observe `accepted` and `delivered` rendered differently.

## Failure Modes — What Breaks When B4 Is Cooked Wrong or Counted Early
- A contract error has no catalogue entry.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A contract error has no catalogue entry → Lint fails; add before C2 fires.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
