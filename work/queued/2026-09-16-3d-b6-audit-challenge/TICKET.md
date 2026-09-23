# TICKET — 2026-09-16-3d-b6-audit-challenge

**What this is:** Answers to 12 §per-lane for Lane B and a negative case per journey.
**Why now:** Every 11 role needs a journey; journeys without negatives cannot catch privacy misses.
**Your move:** Nothing; read the #15 receipt.

Class: petit four. Risk: STANDARD.
Station: container (Fable) (LANES).
Owner: Fable. Promise: 45 min — burns down across attempts (R6).
Depends: none.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-b.
driver-seat: exempt (petit four)

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row B6](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #15; stitch #17.

Ingredients:
- `11-FIELD-TEST-PLAN.md` + `12-AUDIT-CHALLENGE.md` @ 6fec90f
- held draft on PR #21 @ 429da09 (J11–J14 proposed)

Declared product:
1. #15 comment: per-lane answers, roles without journeys, journeys without negatives, proposed J11–J14

Done-means:
- A reader of #15 can observe every 11 role mapped to at least one journey, or named as missing.
- A reader can observe a negative case for each J1–J10.
- A reader can observe which 04 rows no journey touches, by id.
- B2 can cite the J11–J14 proposals and observe their acceptance or rejection on #15.
- PROGRESS row B6 reads 🟢 with the comment link.

## Failure Modes — What Breaks When B6 Is Cooked Wrong or Counted Early
- A role is left without a journey at fire of B2.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A role is left without a journey at fire of B2 → B2 blocked for that role; propose the journey on #15 first.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
