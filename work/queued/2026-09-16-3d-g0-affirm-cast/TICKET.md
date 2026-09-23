# TICKET — 2026-09-16-3d-g0-affirm-cast

**What this is:** GrokBot's root post on #19 pinned to 3c09943 with the full cast: owner, member, viewer, participant, support, BCS tester, KCS support — each mapped to a pinned synthetic persona and to J1–J10 over the four tools.
**Why now:** G1 cannot run a cast that is not written down; the cast definition was missing from the prior draft (Astra defect 4).
**Your move:** Nothing; read #19.

Class: petit four. Risk: STANDARD.
Station: captain seat (GrokBot; captain pastes prompts) (LANES).
Owner: GrokBot. Promise: 45 min — burns down across attempts (R6).
Depends: none.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-g.
driver-seat: exempt (petit four)

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row G0](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #19; stitch #17.

Ingredients:
- `survey-pipeline/synthetic/personas/*.csv` in klappy/3d-quality-review@f042cde (RespondentPersonas, Dials, ProjectPersonas, Roles, Trajectory*)
- `11-FIELD-TEST-PLAN.md` roles + stories @ 6fec90f
- `14` §personas @ 6fec90f

Declared product:
1. #19 root post: affirmation + `cast.md` (seven roles × persona ids × journeys × tools)

Done-means:
- A reader of #19 can observe every one of the seven roles bound to a named synthetic persona id from f042cde.
- A reader can observe every J1–J10 assigned to at least one persona.
- A reader can observe every 11 story assigned to a persona.
- A reader can observe app roles mapped separately from survey persona traits (security coverage is independent).
- PROGRESS row G0 reads 🟢 with the post link.

## Failure Modes — What Breaks When G0 Is Cooked Wrong or Counted Early
- A role has no persona.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A role has no persona → G1 blocked for that role.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
