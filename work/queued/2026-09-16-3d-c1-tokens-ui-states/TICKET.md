# TICKET — 2026-09-16-3d-c1-tokens-ui-states

**What this is:** `design/tokens.*` and `design/ui-states.md` — a state ledger per 04 row.
**Why now:** Every surface renders from the ledger; parity audit checks it.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (Claude Design) (LANES).
Owner: Design. Promise: 90 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-c0-design-brief-6b, 2026-09-16-3d-a1-contract-freeze.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-c.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row C1](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #16; stitch #17.

Ingredients:
- `06` §states @ 6fec90f
- frozen bundles from 2026-09-16-3d-a1-contract-freeze
- receipt rules from 2026-09-16-3d-b4-error-receipt-style when they land (soft)

Declared product:
1. `design/tokens.json` (+ css)
2. `design/ui-states.md`

Done-means:
- A cook can read `ui-states.md` and observe every 04 row with loading / success / error / suppressed / undone states named.
- A cook can observe every color and spacing value in the surfaces resolves to a token, none hard-coded.
- B3 can read the ledger and observe the UI journey id for each row it needs.
- A reader can observe the nine form templates and role labels from 14 in the ledger vocabulary.
- A reader can observe no Notion design-language token present (6B bound).

## Failure Modes — What Breaks When C1 Is Cooked Wrong or Counted Early
- A row has no state ledger entry.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A row has no state ledger entry → Parity audit ❌ for UI on that row.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
