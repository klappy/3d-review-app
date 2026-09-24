# Meal — 2026-09-16-3d-meal-s · Meal S — Stitch

Status: ORDERED 2026-09-16 ~15:00 ET (CoS door, direct to main per HYGIENE 3 — a rail move is not a PR). Not fired. Coordinator: CoS (single accountable coordinator). Board: cookbook issue #17; stitch #17. Blueprint: [`07-MEAL-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) + [`MASTER-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/MASTER-PLAN.md) at PR #12 @ `6fec90f` (candidate revision, held for same-SHA affirmation).

Outcome: The four lanes meet on one live URL and a cold session proves the demo path Thursday 09:00–09:53 ET.
Learning signal: A failed row never plates: it blocks the dependent acceptance and gets an owner.

Meal-done is **derived**: every dish below plated. A dish with a ❌ in its receipt is BLOCKED, not plated, and blocks its dependents. No partial credit; a `501` on a deferred row is zero credit.

## Dishes (each is its own ticket in `rail/1-ordered/`)
| Ticket | Dish | Owner | Class / Risk | Promise | Depends |
|---|---|---|---|---|---|
| `2026-09-16-3d-s1a-integration-smoke` | S1a integration smoke tonight (PROPOSED — owners agree the clock) | CoS (coordinator); Astra, Fable, Design execute | petit four / STANDARD | 45 min, owner-agreed clock (proposed Wed 21:00 ET) | 2026-09-16-3d-a5-handlers, 2026-09-16-3d-b2-scenario-runner, 2026-09-16-3d-c2-entry-participant-print |
| `2026-09-16-3d-s1-swap-mock-live` | S1 swap mock→live (Thu 07:00) | CoS | entrée / STANDARD | 60 min | 2026-09-16-3d-a8-deploy, 2026-09-16-3d-b2-scenario-runner, 2026-09-16-3d-c2-entry-participant-print, 2026-09-16-3d-c3-assessment-context, 2026-09-16-3d-c4-viewer-tour-help, 2026-09-16-3d-g2-live-run |
| `2026-09-16-3d-s0-simulation-cast` | S0 simulation before handoff (short cast, Thu 08:00) | CoS | entrée / STANDARD | 60 min | 2026-09-16-3d-s1-swap-mock-live, 2026-09-16-3d-g3-agentic-persona-e2e |
| `2026-09-16-3d-s2-cold-live-proof` | S2 cold live proof = the demo (Thu 09:00–09:53) | CoS | entrée / STANDARD | 53 min | 2026-09-16-3d-s0-simulation-cast, 2026-09-16-3d-s1-swap-mock-live |
| `2026-09-16-3d-s3-bcs-walkthrough` | S3 BCS facilitator walkthrough script (Thu PM) | CoS | petit four / ALLERGY | 60 min | 2026-09-16-3d-s2-cold-live-proof |
| `2026-09-16-3d-s4-debrief-canon` | S4 debrief → canon (Thu PM) | CoS | petit four / STANDARD | 60 min | 2026-09-16-3d-s2-cold-live-proof |

## Existing work reuse map
| Existing home | Relation | Disposition |
|---|---|---|
| 2026-09-16-3d-parity-build-preplan (CoS, 1-ordered) | S | coordination pointer; stays the door's journal |
| 2026-09-16-3d-reproducible-preplan + meal 2026-09-16-3d-reproducible-build-plan (Astra) | S | Astra's cargo; reviews return there |

## Fire rule
Step 1 (same page: Astra, Fable, Design, GrokBot each affirm `6fec90f` on their issue) → step 2 (this rail order, landed) → step 3 (captain says cook; each owner claims its own dishes by `git mv` to `2-cooking`). Promises are the owner's budget, not a copied schedule; an owner who cannot meet a promise names a new one on their issue before fire.
