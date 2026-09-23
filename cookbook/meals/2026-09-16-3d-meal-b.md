# Meal — 2026-09-16-3d-meal-b · Meal B — NLX & Verification

Status: ORDERED 2026-09-16 ~15:00 ET (CoS door, direct to main per HYGIENE 3 — a rail move is not a PR). Not fired. Coordinator: Fable (this Claude seat). Board: cookbook issue #15; stitch #17. Blueprint: [`07-MEAL-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) + [`MASTER-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/MASTER-PLAN.md) at PR #12 @ `6fec90f` (candidate revision, held for same-SHA affirmation).

Outcome: Agents and people can use the app from the docs alone, and a runner proves every journey J1–J10 on mocks then live.
Learning signal: The parity table's ❌ count reaches 0 before ship; re-projection lists what to rebuild when a doc changes.

Meal-done is **derived**: every dish below plated. A dish with a ❌ in its receipt is BLOCKED, not plated, and blocks its dependents. No partial credit; a `501` on a deferred row is zero credit.

## Dishes (each is its own ticket in `rail/1-ordered/`)
| Ticket | Dish | Owner | Class / Risk | Promise | Depends |
|---|---|---|---|---|---|
| `2026-09-16-3d-b1-docs-corpus` | B1 docs corpus (one file per capability + topics) | Fable | entrée / STANDARD | 90 min | none |
| `2026-09-16-3d-b6-audit-challenge` | B6 audit challenge for Lane B + negatives per journey | Fable | petit four / STANDARD | 45 min | none |
| `2026-09-16-3d-b2-scenario-runner` | B2 scenario runner J1–J10 × roles | Fable | entrée / STANDARD | 150 min | 2026-09-16-3d-b1-docs-corpus, 2026-09-16-3d-a1-contract-freeze |
| `2026-09-16-3d-b4-error-receipt-style` | B4 error codes, hints, receipt rendering rules | Fable | entrée / STANDARD | 60 min | 2026-09-16-3d-a1-contract-freeze |
| `2026-09-16-3d-b3-parity-audit-tool` | B3 parity audit tool (HTTP + MCP + UI journey ids) | Fable | entrée / STANDARD | 120 min | 2026-09-16-3d-a1-contract-freeze, 2026-09-16-3d-b2-scenario-runner |
| `2026-09-16-3d-b5-reprojection-audit` | B5 re-projection audit (doc→component map + `reproject`) | Fable | entrée / STANDARD | 60 min | 2026-09-16-3d-b1-docs-corpus |

## Existing work reuse map
| Existing home | Relation | Disposition |
|---|---|---|
| meal 2026-09-03-3d-review-cookbook-drain | B1 sources | dishes 4–7 still open; source sync does not close it |
| cookbook draft PR #21 @ 429da09 | B1/B6/B2 | held cargo; re-pin to 3c09943 at fire, then counts |

## Fire rule
Step 1 (same page: Astra, Fable, Design, GrokBot each affirm `6fec90f` on their issue) → step 2 (this rail order, landed) → step 3 (captain says cook; each owner claims its own dishes by `git mv` to `2-cooking`). Promises are the owner's budget, not a copied schedule; an owner who cannot meet a promise names a new one on their issue before fire.
