# TICKET — 2026-09-16-3d-b2-scenario-runner

**What this is:** Executable journeys J1–J10 (+ accepted J11–J14) × roles, against contract mocks tonight and the live URL Thursday.
**Why now:** It is the proof that the app works as the docs say, before humans touch it.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: container (Fable) (LANES).
Owner: Fable. Promise: 150 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-b1-docs-corpus, 2026-09-16-3d-a1-contract-freeze.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-b.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row B2](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #15; stitch #17.

Ingredients:
- `05-NLX-AGENT-USAGE.md` journeys @ 6fec90f
- frozen bundles from 2026-09-16-3d-a1-contract-freeze
- live URL from 2026-09-16-3d-a8-deploy (for the live leg only)

Declared product:
1. `scenarios/journeys.json`
2. `runner/` (executable)
3. `runner/report-mock.md` tonight; `runner/report-live.md` Thursday

Done-means:
- A cook can run the runner against the contract mocks and observe every journey × role with PASS/FAIL and the failing step named.
- A cook can run the same runner against the live URL and observe the same journey ids reported.
- A cook can observe each negative case from B6 executed and refused with the documented error code.
- A reader of `report-mock.md` can observe zero journeys skipped for a missing mock — each missing bundle is named instead.
- CoS can observe the runner uses the four MCP tools for agent journeys and HTTP for the rest, per 05.

## Failure Modes — What Breaks When B2 Is Cooked Wrong or Counted Early
- A journey passes on mocks but its bundle was open in the manifest.
- Runner is pointed at live before A8 plates.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A journey passes on mocks but its bundle was open in the manifest → Mark UNVERIFIED, not PASS.
- Runner is pointed at live before A8 plates → Wait; S1a smoke uses Astra's dev URL by owner agreement only.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.
