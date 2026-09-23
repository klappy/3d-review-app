# TICKET — 2026-09-16-3d-a2-schema

**What this is:** D1 schema for the fresh app (language/cycle identity, curated submission links, versioned instruments, scope/grant/invitation/access_code/receipt/trace) and synthetic-only seeds.
**Why now:** Everything downstream persists through this schema; the real Laos/Aushi participant data must never enter the app or the demo.
**Your move:** Nothing until it plates; VERDICT.md required (ALLERGY: PII-holding tables).

Class: entrée. Risk: ALLERGY.
Station: captain seat (Astra in Codex) (LANES).
Owner: Astra. Promise: 120 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a1-contract-freeze.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-a.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row A2](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #14; stitch #17.

Ingredients:
- `03-DOMAIN-MODEL-AND-PERMISSIONS.md` @ 6fec90f
- `14-STEVE-REPO-SYNC.md` §schema/§seeds @ 6fec90f
- `survey-pipeline/data/reference/` + `rubric_csv/` in klappy/3d-quality-review@f042cde (instrument versions)
- mock Minnesota Nice + synthetic personas in klappy/3d-quality-review@f042cde (allergen: real Laos/Aushi CSVs sit beside them — excluded by name)

Declared product:
1. `migrations/0001_init.sql` (app repo per OF-1)
2. `seeds/synthetic/*.json` pinned to f042cde
3. `schema-checks.md` — the 14 fixture checks with pass/fail

Done-means:
- A cook can apply the migration to an empty D1 and observe zero errors and every table in 03 present.
- A cook can run the 14 fixture checks and observe each named check with PASS.
- A reviewer can grep the seeds for any Laos/Aushi participant row and observe zero matches.
- A cook can read a stored response and observe its instrument version, template version and scoring version retained on the row.
- A cook can observe that pipeline batch identifiers from f042cde are not reused as app identifiers.

## Failure Modes — What Breaks When A2 Is Cooked Wrong or Counted Early
- A real participant row lands in seeds or a demo database.
- A 14 fixture check fails.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A real participant row lands in seeds or a demo database → Stop; purge the row and its derivatives; VERDICT records the incident; A8 does not deploy until purged.
- A 14 fixture check fails → Ticket stays 2-cooking; failing check named on #14; dependent A5 rows blocked.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.

- 2026-09-16 15:06 ET — D9 ruled: `assessment.language_id`, many languages per project, identity only. Re-pinned to cookbook 6fec90f.
