# TICKET — 2026-09-16-3d-c5-copy-deck

**What this is:** `design/copy.md` — every string on every surface, anchored to its surface and row.
**Why now:** It is the captain's authorial voice; it cannot ship without his read.
**Your move:** Read `copy.md` and approve or mark lines; VERDICT.md required.

Class: entrée. Risk: ALLERGY.
Station: captain seat (Claude Design) (LANES).
Owner: Design. Promise: 90 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-c2-entry-participant-print, 2026-09-16-3d-c3-assessment-context.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-c.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row C5](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #16; stitch #17.

Ingredients:
- surfaces C2–C4
- captain's voice rules (no em dashes, no 'the honest part is' openers)

Declared product:
1. `design/copy.md`
2. VERDICT.md beside this ticket when approved

Done-means:
- The captain can read `copy.md` and observe every string with its surface and row anchor.
- A cook can grep the surfaces for a user-facing string not in `copy.md` and observe zero.
- A reader can observe zero em dashes and zero banned openers.
- A cook can observe role labels match 14 (Translator, four mid-level roles + Other).
- VERDICT.md exists with the captain's line-level marks resolved before plate.

## Failure Modes — What Breaks When C5 Is Cooked Wrong or Counted Early
- Copy ships without VERDICT.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- Copy ships without VERDICT → Not plated; roll back the strings to draft label.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
