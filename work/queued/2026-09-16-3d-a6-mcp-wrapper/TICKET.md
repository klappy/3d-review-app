# TICKET — 2026-09-16-3d-a6-mcp-wrapper

**What this is:** Four MCP tools (docs / read / write / danger) over the same handlers, official SDK, stateless.
**Why now:** The captain's 3–4 tool ruling; agents (G, B runner) use this surface.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (Astra in Codex) (LANES).
Owner: Astra. Promise: 90 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a5-handlers.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-a.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row A6](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #14; stitch #17.

Ingredients:
- `02-ARCHITECTURE-PROJECTION.md` §4 tools @ 6fec90f
- handlers from 2026-09-16-3d-a5-handlers

Declared product:
1. `src/mcp/*` (app repo)
2. `conformance/mcp.json` — every row via MCP with receipt ids
3. #14 receipt: receipt diff HTTP vs MCP = 0

Done-means:
- An agent can list tools and observe exactly four, named docs/read/write/danger.
- A cook can run the MCP conformance pass and observe every 04 row reachable through one of the four tools.
- A cook can diff MCP receipts against HTTP receipts for the same calls and observe zero differences.
- An agent can call a danger-class row through `write` and observe it refused, then through `danger` and observe the two-step.
- A cook can restart the worker mid-session and observe no MCP state lost.

## Failure Modes — What Breaks When A6 Is Cooked Wrong or Counted Early
- A fifth tool appears.
- A danger row is callable via GET or via `read`.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A fifth tool appears → Remove it; the row it served moves under one of the four.
- A danger row is callable via GET or via `read` → Blocked until fixed; add a negative case to B6.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
