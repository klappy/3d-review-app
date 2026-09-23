# TICKET — 2026-09-16-3d-s1-swap-mock-live

**What this is:** B2 runner, C journeys and G2 all against the A8 live URL.
**Why now:** The stitch: four trees, one URL.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (CoS coordinates; each lane runs its own leg) (LANES).
Owner: CoS. Promise: 60 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a8-deploy, 2026-09-16-3d-b2-scenario-runner, 2026-09-16-3d-c2-entry-participant-print, 2026-09-16-3d-c3-assessment-context, 2026-09-16-3d-c4-viewer-tour-help, 2026-09-16-3d-g2-live-run.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-s.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row S1](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #17; stitch #17.

Ingredients:
- live URL from 2026-09-16-3d-a8-deploy
- B2 runner, C2–C4 surfaces, G2 evidence
- `audit/PARITY.md` from 2026-09-16-3d-b3-parity-audit-tool

Declared product:
1. #17 `S1-report.md`: all-green or ❌ list with owner and blocked dependents named

Done-means:
- A reader can observe every B2 journey, every C journey and every G2 persona with PASS or a ❌ and owner.
- A reader can observe the parity table rerun against the live SHA with its ❌ count.
- A lane owner can observe which S2 steps their ❌ blocks.
- A reader can observe no ❌ row described as plated or done.
- S0 can start only after this report exists.

## Failure Modes — What Breaks When S1 Is Cooked Wrong or Counted Early
- A ❌ row is carried into S2 as if green.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A ❌ row is carried into S2 as if green → S2 stops at that step; the row's owner is named in the demo ❌ list.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
