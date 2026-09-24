# Meal — 2026-09-16-3d-meal-a · Meal A — Core & Contract

Status: ORDERED 2026-09-16 ~15:00 ET (CoS door, direct to main per HYGIENE 3 — a rail move is not a PR). Not fired. Coordinator: Astra (ChatGPT/Codex). Board: cookbook issue #14; stitch #17. Blueprint: [`07-MEAL-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) + [`MASTER-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/MASTER-PLAN.md) at PR #12 @ `6fec90f` (candidate revision, held for same-SHA affirmation).

Outcome: A fresh 3D Review app whose whole functionality is on the API, with a per-bundle frozen contract that Lanes B/C/G can mock and then hit live.
Learning signal: Every 04 row answers over HTTP and over the 4 MCP tools with identical receipts; a cold curl of a live URL proves it.

Meal-done is **derived**: every dish below plated. A dish with a ❌ in its receipt is BLOCKED, not plated, and blocks its dependents. No partial credit; a `501` on a deferred row is zero credit.

## Dishes (each is its own ticket in `rail/1-ordered/`)
| Ticket | Dish | Owner | Class / Risk | Promise | Depends |
|---|---|---|---|---|---|
| `2026-09-16-3d-a0-audit-share` | A0 audit share | Astra | petit four / STANDARD | 30 min | none |
| `2026-09-16-3d-a1-contract-freeze` | A1 contract freeze (per bundle) | Astra | entrée / STANDARD | 90 min | 2026-09-16-3d-a0-audit-share |
| `2026-09-16-3d-a2-schema` | A2 fresh-app D1 schema + synthetic seeds | Astra | entrée / ALLERGY | 120 min | 2026-09-16-3d-a1-contract-freeze |
| `2026-09-16-3d-a3-auth` | A3 login, session, participant token, access codes | Astra | entrée / ALLERGY | 120 min | 2026-09-16-3d-a1-contract-freeze, 2026-09-16-3d-a2-schema |
| `2026-09-16-3d-a4-policy` | A4 grant policy (scope, role), no inheritance, 404 existence-hiding | Astra | entrée / ALLERGY | 120 min | 2026-09-16-3d-a2-schema |
| `2026-09-16-3d-a5-handlers` | A5 one handler per 04 row | Astra | entrée / STANDARD | 180 min | 2026-09-16-3d-a1-contract-freeze, 2026-09-16-3d-a2-schema, 2026-09-16-3d-a3-auth, 2026-09-16-3d-a4-policy |
| `2026-09-16-3d-a6-mcp-wrapper` | A6 four-tool MCP wrapper over the same handlers | Astra | entrée / STANDARD | 90 min | 2026-09-16-3d-a5-handlers |
| `2026-09-16-3d-a7-telemetry-xray` | A7 telemetry, per-request span log, `cap.ops.trace` | Astra | entrée / ALLERGY | 90 min | 2026-09-16-3d-a5-handlers |
| `2026-09-16-3d-a8-deploy` | A8 deploy Worker + D1 + R2 + KV on a live URL | Astra | entrée / ALLERGY | 90 min | 2026-09-16-3d-a5-handlers, 2026-09-16-3d-a6-mcp-wrapper, 2026-09-16-3d-a7-telemetry-xray |

## Existing work reuse map
| Existing home | Relation | Disposition |
|---|---|---|
| 2026-09-08-3d-build-scope-contract (B01, 1-ordered HOLD) | A1/A2/A4 | reuse requirements; supersede once A1/A2/A4 plate — hold is not lifted by this meal |
| 2026-09-08-3d-build-rollups (B05, HOLD) | A2/A4/A5 | reconcile grouping/revoke/retention; not ratified by the new app |

## Fire rule
Step 1 (same page: Astra, Fable, Design, GrokBot each affirm `6fec90f` on their issue) → step 2 (this rail order, landed) → step 3 (captain says cook; each owner claims its own dishes by `git mv` to `2-cooking`). Promises are the owner's budget, not a copied schedule; an owner who cannot meet a promise names a new one on their issue before fire.
