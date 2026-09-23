# Meal — 2026-09-16-3d-meal-c · Meal C — Design language parity

Status: ORDERED 2026-09-16 ~15:00 ET (CoS door, direct to main per HYGIENE 3 — a rail move is not a PR). Not fired. Coordinator: Claude Design + captain. Board: cookbook issue #16; stitch #17. Blueprint: [`07-MEAL-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) + [`MASTER-PLAN.md`](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/MASTER-PLAN.md) at PR #12 @ `6fec90f` (candidate revision, held for same-SHA affirmation).

Outcome: Every 04 row has a UI state and a surface; the browser journeys pass against the contract mocks, then live.
Learning signal: Field testers complete J2/J1/J6 in the browser without help; captain approves the copy deck.

Meal-done is **derived**: every dish below plated. A dish with a ❌ in its receipt is BLOCKED, not plated, and blocks its dependents. No partial credit; a `501` on a deferred row is zero credit.

## Dishes (each is its own ticket in `rail/1-ordered/`)
| Ticket | Dish | Owner | Class / Risk | Promise | Depends |
|---|---|---|---|---|---|
| `2026-09-16-3d-c0-design-brief-6b` | C0 affirm design brief + 6B Notion-borrow table | Design | petit four / STANDARD | 45 min | none |
| `2026-09-16-3d-c1-tokens-ui-states` | C1 tokens + ui-states ledger | Design | entrée / STANDARD | 90 min | 2026-09-16-3d-c0-design-brief-6b, 2026-09-16-3d-a1-contract-freeze |
| `2026-09-16-3d-c2-entry-participant-print` | C2 entry, participant and print surfaces (1, 4, 6) | Design | entrée / STANDARD | 150 min | 2026-09-16-3d-c1-tokens-ui-states, 2026-09-16-3d-b4-error-receipt-style |
| `2026-09-16-3d-c3-assessment-context` | C3 assessment + context surfaces (2, 3, 7) | Design | entrée / STANDARD | 150 min | 2026-09-16-3d-c1-tokens-ui-states |
| `2026-09-16-3d-c4-viewer-tour-help` | C4 viewer + tour surfaces (5, 8) | Design | entrée / STANDARD | 120 min | 2026-09-16-3d-c3-assessment-context |
| `2026-09-16-3d-c5-copy-deck` | C5 copy deck with anchors (draft) | Design | entrée / ALLERGY | 90 min | 2026-09-16-3d-c2-entry-participant-print, 2026-09-16-3d-c3-assessment-context |

## Existing work reuse map
| Existing home | Relation | Disposition |
|---|---|---|
| 2026-09-08-3d-build-navigation (B02, HOLD) | C2–C4 | carry UX acceptance lineage into successors |
| 2026-09-08-3d-build-report-entry (B04, HOLD) | C4 | suppression/codebook/human-review lineage retained |
| meal 2026-09-08-3d-scenario-ux (M01–M06 86ed) | C0 | prior glass evidence; combined showcase not revived |

## Fire rule
Step 1 (same page: Astra, Fable, Design, GrokBot each affirm `6fec90f` on their issue) → step 2 (this rail order, landed) → step 3 (captain says cook; each owner claims its own dishes by `git mv` to `2-cooking`). Promises are the owner's budget, not a copied schedule; an owner who cannot meet a promise names a new one on their issue before fire.
