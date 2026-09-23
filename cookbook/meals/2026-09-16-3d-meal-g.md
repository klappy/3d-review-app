# Meal — 2026-09-16-3d-meal-g · Meal G — Agentic persona testing, start to finish

Status: ORDERED 2026-09-16 ~15:00 ET (CoS door, direct to main per HYGIENE 3 — a rail move is not a PR). Not fired. Coordinator: GrokBot (Grok, 4-seat stack). Board: cookbook issue #19; stitch #17. Blueprint: [`07-MEAL-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) + [`MASTER-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/MASTER-PLAN.md) at PR #12 @ `6fec90f` (candidate revision, held for same-SHA affirmation).

Outcome: A cast of synthetic personas (owner/member/viewer/participant/support/BCS tester/KCS support) executes the whole app over the 4 tools, on mocks tonight and live Thursday, and the findings are classified per 11.
Learning signal: Privacy/auth/integrity findings surface before the demo, not during it.

Meal-done is **derived**: every dish below plated. A dish with a ❌ in its receipt is BLOCKED, not plated, and blocks its dependents. No partial credit; a `501` on a deferred row is zero credit.

## Dishes (each is its own ticket in `rail/1-ordered/`)
| Ticket | Dish | Owner | Class / Risk | Promise | Depends |
|---|---|---|---|---|---|
| `2026-09-16-3d-g0-affirm-cast` | G0 affirm + persona cast plan | GrokBot | petit four / STANDARD | 45 min | none |
| `2026-09-16-3d-g1-mock-run` | G1 persona mock run against contract-v0.1 | GrokBot | entrée / STANDARD | 180 min | 2026-09-16-3d-g0-affirm-cast, 2026-09-16-3d-a1-contract-freeze |
| `2026-09-16-3d-g3-agentic-persona-e2e` | G3 agentic persona end-to-end (mock tonight, live Thursday) | GrokBot | entrée / STANDARD | 240 min (mock leg tonight by 23:00; live leg Thu 07:00–07:45 so evidence feeds S0 at 08:00) | 2026-09-16-3d-g0-affirm-cast, 2026-09-16-3d-a1-contract-freeze |
| `2026-09-16-3d-g2-live-run` | G2 persona live run and divergence list | GrokBot | entrée / STANDARD | 60 min | 2026-09-16-3d-g1-mock-run, 2026-09-16-3d-a8-deploy |

## Existing work reuse map
| Existing home | Relation | Disposition |
|---|---|---|
| 2026-09-08-3d-build-response-recovery (B03, HOLD) | G1 negatives | preserve channel/idempotency cases |
| Astra PR #18 FIELD-TESTING.md @ dac8a45 | G0 stories | peer input, folded via 11 |

## Fire rule
Step 1 (same page: Astra, Fable, Design, GrokBot each affirm `6fec90f` on their issue) → step 2 (this rail order, landed) → step 3 (captain says cook; each owner claims its own dishes by `git mv` to `2-cooking`). Promises are the owner's budget, not a copied schedule; an owner who cannot meet a promise names a new one on their issue before fire.
