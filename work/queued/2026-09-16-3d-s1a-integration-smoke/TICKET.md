# TICKET — 2026-09-16-3d-s1a-integration-smoke

**What this is:** First live contact tonight: B2 runner and C2/C3 journeys against Astra's dev URL, partial allowed; green/❌ posted on #17.
**Why now:** Astra's objection: one-shot integration Thursday morning is how demos die. This dish exists only once Astra, Fable and Design each say yes or name a clock on their issue.
**Your move:** Nothing; the three owners agree the clock on #14/#15/#16.

Class: petit four. Risk: STANDARD.
Station: captain seat (each owner on their own lane) (LANES).
Owner: CoS (coordinator); Astra, Fable, Design execute. Promise: 45 min, owner-agreed clock (proposed Wed 21:00 ET) — burns down across attempts (R6).
Depends: 2026-09-16-3d-a5-handlers, 2026-09-16-3d-b2-scenario-runner, 2026-09-16-3d-c2-entry-participant-print.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-s.
driver-seat: exempt (petit four)

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row S1a](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #17; stitch #17.

Ingredients:
- Astra dev URL (whatever is up at the agreed clock)
- runner from 2026-09-16-3d-b2-scenario-runner
- C2/C3 surfaces

Declared product:
1. #17 comment: green/❌ per journey with owner
2. (no rail move — a ❌ here blocks nothing yet; it informs tonight's fixes)

Done-means:
- A reader of #17 can observe which journeys reached Astra's dev URL and which did not, with a reason each.
- Each owner can observe the clock they agreed to, quoted from their own issue comment.
- A lane owner can observe any ❌ with the failing step and a trace id where one exists.
- CoS can observe whether S1 Thursday is the second contact (this ran) or the first (it did not).
- A reader can observe this dish marked SKIPPED, not FAILED, if any owner declined the clock.

## Failure Modes — What Breaks When S1a Is Cooked Wrong or Counted Early
- It is fired without all three owners' yes.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- It is fired without all three owners' yes → Mark SKIPPED; note who did not agree.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
