# TICKET — 2026-09-16-3d-b3-parity-audit-tool

**What this is:** Script that reads `capabilities.json`, hits HTTP and MCP, checks UI journey ids, emits the 04 checklist table with a ❌ count.
**Why now:** The ship gate: ❌ count = 0.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: container (Fable) (LANES).
Owner: Fable. Promise: 120 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a1-contract-freeze, 2026-09-16-3d-b2-scenario-runner.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-b.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row B3](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #15; stitch #17.

Ingredients:
- `capabilities.json` @ `contract-v0.1`
- A5/A6 conformance outputs
- C journey ids from C2–C4

Declared product:
1. `audit/parity.ts`
2. `audit/PARITY.md` — the committed table

Done-means:
- A cook can run the audit and observe one row per 04 row with HTTP / MCP / UI columns each ✅ ❌ or ⛔(deferred, zero credit).
- A reader can observe the ❌ count and the two parity numbers (whole / `v2.0-bcs`) at the top of `PARITY.md`.
- A cook can observe a deferred row counted as ⛔ never ✅.
- CoS can rerun after any lane's push and observe the table change only where that lane touched.
- S1 can cite `PARITY.md` and observe it committed with the SHA it audited.

## Failure Modes — What Breaks When B3 Is Cooked Wrong or Counted Early
- A 501 row shows ✅.
- Audit runs against a stale contract tag.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A 501 row shows ✅ → Fix the classifier; rerun; zero credit.
- Audit runs against a stale contract tag → Rerun against the manifest's frozen SHAs; name them in the table header.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.


## Bounded PR17 documentary amendment — accepted plan, worker gate pending

Root accepts PR17-TRUTHFULNESS-ORDER.md plus scoped DELTA and planning receipts for this limited correction. Independent /root/release_reconciliation, no authorship, ACCEPT for bounded planning after fresh35-ID source enumeration. Reviewed order SHA256bf685238ce35ae229b865a263361e806038b4f12857d52fc162dd8f7beb4fbe9. Only comments/test-description labels and paired canonical coverage ledger; no executable logic changes, no tests/features. App childPR targets fable/phase-a-sweep without writing its branch; separate cookbookPR. Narrow dependency exception: documentary evidence correction may proceed without B2/A1 completion; fullB3 remains blocked and no functional acceptance is inferred. Actual workerACK/budget and freshCHECKLIST/FIRE are still required. Auggie /root/queue_resolution coordinates successor; original Fable history/120minuteB3 budget retained. AST normalization ignores only first-argument test labels, never arbitrary literals/assertions. Root retains integration and journal pen.
