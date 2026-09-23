# TICKET — 2026-09-16-3d-a5-handlers

**What this is:** One HTTP handler per 04 row; R/W/E/D enforced server-side by effect; receipts; undo only where `inverse:` is declared; E+D two-step; suppression on results paths.
**Why now:** This is the 100%-on-the-API ruling made concrete; B3's parity numbers count these.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (Astra in Codex) (LANES).
Owner: Astra. Promise: 180 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a1-contract-freeze, 2026-09-16-3d-a2-schema, 2026-09-16-3d-a3-auth, 2026-09-16-3d-a4-policy.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-a.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row A5](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #14; stitch #17.

Ingredients:
- `04-CAPABILITY-MATRIX.md` @ 6fec90f (79 rows, §K seams)
- `contract-v0.1` frozen bundles (2026-09-16-3d-a1-contract-freeze)
- `14-STEVE-REPO-SYNC.md` §results semantics @ 6fec90f

Declared product:
1. `src/handlers/*` (app repo)
2. `conformance/http.json` — every row hit once with status + receipt id
3. #14 receipt: two parity numbers (whole / `v2.0-bcs`)

Done-means:
- A cook can run the HTTP conformance pass and observe every 04 row called and every W/E/D row returning a receipt id.
- A cook can call undo on a row with `inverse: none` and observe it refused with the documented error code.
- A cook can call an E or D row without the two-step confirmation and observe it refused.
- A cook can observe a send row returning `accepted` and a separate durable receipt when delivered — never one receipt for both.
- A viewer can request results on a suppressed path and observe `ok:true` with suppressed content, per 04.
- A reader of #14 can observe two parity numbers with their denominators named.

## Failure Modes — What Breaks When A5 Is Cooked Wrong or Counted Early
- A row is served by the UI or MCP layer without an HTTP twin.
- A deferred row returns 501 and is counted.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A row is served by the UI or MCP layer without an HTTP twin → Blocked; the row is a ❌ on the parity table until the handler exists.
- A deferred row returns 501 and is counted → Zero credit; PROGRESS marks it target/not implemented.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
