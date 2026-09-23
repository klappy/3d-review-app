# TICKET — 2026-09-16-3d-a0-audit-share

**What this is:** Astra answers 12 §per-lane for Lane A: which 04 rows cannot be generated from 04 alone.
**Why now:** A1 cannot freeze bundles whose rows are not generable; the gaps must be named first.
**Your move:** Nothing; read the receipt on #14.

Class: petit four. Risk: STANDARD.
Station: captain seat (Astra in Codex) (LANES).
Owner: Astra. Promise: 30 min — burns down across attempts (R6).
Depends: none.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-a.
driver-seat: exempt (petit four)

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row A0](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #14; stitch #17.

Ingredients:
- `12-AUDIT-CHALLENGE.md` @ 6fec90f
- `04-CAPABILITY-MATRIX.md` @ 6fec90f
- Astra PR #18 `AUDIT.md` @ dac8a45 (already posted — this ticket records the order it answers)

Declared product:
1. cookbook issue #14 comment naming each non-generable row (already: PR #18 @ dac8a45)

Done-means:
- A reader of #14 can list every 04 row Astra says is not generable from 04 alone and observe a reason per row.
- CoS can diff that list against 04 and observe zero rows named that are not in 04.
- A1 can cite this list when a bundle stays open and observe the row named here.
- Any seat can open PR #18 `AUDIT.md` @ dac8a45 and observe the same rows.
- PROGRESS.md row A0 reads 🟢 with the PR #18 SHA and a reader can follow the link.

## Failure Modes — What Breaks When A0 Is Cooked Wrong or Counted Early
- A gap is named without a row id and A1 cannot map it.
- A1 freezes a bundle containing a row named here as non-generable.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A gap is named without a row id and A1 cannot map it → Return it on #14 with the row id required; A1 keeps that bundle open until it lands.
- A1 freezes a bundle containing a row named here as non-generable → Reopen that bundle in `contract-manifest.json`; post the diff on #14.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
