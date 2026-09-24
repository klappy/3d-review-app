# TICKET — 2026-09-16-3d-g2-live-run

**What this is:** The same cast against the live URL at Thu 07:00; divergences from the mock run listed.
**Why now:** What differs between mock and live is what breaks the demo.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (GrokBot) (LANES).
Owner: GrokBot. Promise: 60 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-g1-mock-run, 2026-09-16-3d-a8-deploy.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-g.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row G2](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #19; stitch #17.

Ingredients:
- G1 report
- live URL from 2026-09-16-3d-a8-deploy

Declared product:
1. #17 ❌ list before 08:00 with owner per row
2. #19 `G2-live.md`

Done-means:
- A reader can observe every G1 observation re-run live with same / fixed / new status.
- A reader can observe the ❌ list on #17 before 08:00 ET with an owner per row.
- A lane owner can observe the trace id for every live divergence.
- S0 can observe privacy/auth/integrity rows cleared or blocking.
- A reader can observe zero rows marked fixed without a receipt link.

## Failure Modes — What Breaks When G2 Is Cooked Wrong or Counted Early
- A ❌ row has no owner.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A ❌ row has no owner → CoS assigns; row blocks S2 until owned.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
