# TICKET — 2026-09-16-3d-g3-agentic-persona-e2e

**What this is:** GrokBot plans and executes the full persona pass over the four tools, mock leg tonight, live leg Thursday against A8; evidence receipts on #19/#17.
**Why now:** Captain ruling ~13:28 ET: GrokBot's explicit lane is persona testing start to finish.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (GrokBot 4-seat stack: CoS / Auggie / Otto / EA) (LANES).
Owner: GrokBot. Promise: 240 min (mock leg tonight by 23:00; live leg Thu 07:00–07:45 so evidence feeds S0 at 08:00) — burns down across attempts (R6).
Depends: 2026-09-16-3d-g0-affirm-cast, 2026-09-16-3d-a1-contract-freeze.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-g.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row G3](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #19; stitch #17.

Ingredients:
- cast from 2026-09-16-3d-g0-affirm-cast
- mocks from 2026-09-16-3d-a1-contract-freeze
- live URL from 2026-09-16-3d-a8-deploy (live leg)

Declared product:
1. #19 `G3-plan.md`
2. #19 `G3-mock-evidence.md` tonight; `G3-live-evidence.md` Thursday
3. feeds S0 at Thu 08:00

Done-means:
- A reader can observe a plan naming every persona, journey and tool call before any run.
- A reader can observe the mock-leg evidence with a receipt or trace per journey.
- A reader can observe the live-leg evidence Thursday against the A8 URL with the same journey ids.
- S0 can read the evidence and observe privacy/auth/integrity cleared or named as blockers.
- A reader can observe Fable did not execute any persona (definitions only).

## Failure Modes — What Breaks When G3 Is Cooked Wrong or Counted Early
- A persona is executed by a seat other than GrokBot's stack.
- Live leg runs before A8 plates.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A persona is executed by a seat other than GrokBot's stack → Not counted; rerun by the stack.
- Live leg runs before A8 plates → Wait; mock-leg evidence stands alone.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
