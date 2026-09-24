# TICKET — 2026-09-16-3d-b1-docs-corpus

**What this is:** `docs/` markdown projected from the cookbook: one file per 04 row plus topics, with source anchors.
**Why now:** The MCP `docs` tool and `/docs` serve this; agents learn the app from it.
**Your move:** Nothing; note the early draft (PR #21 @ 429da09) is held until this ticket is fired.

Class: entrée. Risk: STANDARD.
Station: container (Fable — this Claude seat) (LANES).
Owner: Fable. Promise: 90 min — burns down across attempts (R6).
Depends: none.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-b.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row B1](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #15; stitch #17.

Ingredients:
- `04-CAPABILITY-MATRIX.md` + `05-NLX-AGENT-USAGE.md` @ 6fec90f
- `14-STEVE-REPO-SYNC.md` vocabulary @ 6fec90f
- held draft: cookbook PR #21 @ 429da09 (reuse after fire, re-pin to 3c09943)

Declared product:
1. `docs/capabilities/<row-id>.md` × 79
2. `docs/index.md`
3. `docs/topics/*.md` (6)
4. `docs/lint.json` — every 04 row → doc path

Done-means:
- A cook can run the docs lint and observe every 04 row mapped to exactly one doc file.
- An agent can open any capability doc and observe params, receipt shape, class and a source anchor into the cookbook.
- A reader can open `docs/index.md` and reach every capability doc in one click.
- A reader can observe the vocabulary from 14 (Translator, nine forms, four mid-level roles) used consistently.
- A cook can diff the docs against `contract-v0.1` and observe zero rows whose params disagree.

## Failure Modes — What Breaks When B1 Is Cooked Wrong or Counted Early
- A doc describes a row the contract does not have.
- Held PR #21 is counted before fire.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A doc describes a row the contract does not have → Remove or mark target/not implemented; lint fails until aligned.
- Held PR #21 is counted before fire → Not counted; PROGRESS row stays ⬜ until fire.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.


## Bounded discovery plan revision2

Attached proposal and earlierindependentAMEND retained. Root independentlyreadrev2/fullactualsetuphandlers and posted narrowdocumentationacceptance under ROOT-SETUP-ACCEPTANCE.json. HistoricalFablecustody retained; /root/testing_plan_review proposedboundedAuggiecoordination. No actualimplementationworkerACK/fire. Under captainTOC/01:00deadline, preserveplan and do notstartnewauthoring untilnextconstraintpriorityestablished. Existing90minutehistorynotreset; fullB1notaccepted.

## Checkpoint — CoS+ NLX-MCP-001 plan (no FIRE) · 2026-09-17 02:46 EDT

Priority steering (#14) made empty docs first plate. Prefer plan (tip `822b2ab`): `planning/2026-09-16-parity-build/PLAN-2026-09-17-NLX-MCP-001-empty-docs.md`.

Live+source root cause: **not** empty corpus; `src/handlers/docs.ts` @ `a57ba930` full-string substring match fails multi-word NL `q`. Slice 0 = tokenize/stopword/overlap on existing registry fields; Slice 1 = existing B1 discovery projection (no invented recipes).

This B1 ticket remains the implementation vehicle after Otto review + FIRE — **do not open a competing docs ticket**. Historical Fable custody / PR21 held / no impl ACK from this checkpoint.


## Checkpoint — Otto nits closed · Slice0 Auth custody · 2026-09-17 ~02:52 EDT

Prefer tip `974e258`. Otto Orient `5710252796` PASS-with-fixes **closed on Prefer**.

- **Slice0 search/test allowlist owner:** Auth / Astra on cookbook #14 (`docs.ts` + frozen stopword + unit tests). **No Design overlap.**
- **B1/Fable:** this ticket remains the meal vehicle; Slice1 discovery still Fable custody — **ACK before Slice1 FIRE**. Slice0 reuses this meal (no competing docs ticket).
- Empty-docs-first: missing public health app/build/Worker fields are **not** a Slice0 FIRE blocker (Auth/release owns metadata).
- **HOLD FIRE** until named author START under existing CoS+ delegation.



## Checkpoint — FAQ / intro copy custody ACK ask · 2026-09-17 ~03:35 EDT

Prefer tip `13a621e` · plan `planning/2026-09-16-parity-build/PLAN-2026-09-17-docs-intro-faq-copy.md` (HOLD for B1 ACK · no FIRE).

Kitchen cargo (exact): `23106c847f4d052dfd766233fd66d3167dcab942` · `rail/1-ordered/2026-09-16-3d-reproducible-preplan/product-purpose-copy-2026-09-17/COPY-PACK.md` — sections **Documentation introduction** + **Compatibility FAQ** only (verbatim; no invent).

**Ask — B1/Fable custody ACK before any FAQ/intro copy FIRE:**

1. **Landing option (exactly one):**
   - **(A) TOPICS extend** — `intro` + `faq` (or `compatibility`) keys on `src/handlers/docs.ts` `TOPICS` with cargo-exact strings; Auth/docs allowlist ACK if TOPICS; **or**
   - **(B) Corpus page** — B1 discovery projection carries intro/FAQ pages; docs topic/search returns them (Slice1-shaped).
2. **File allowlist** for the chosen landing (explicit paths; no silent expand).
3. **Vehicle:** this ticket remains the meal · **no competing docs ticket**.
4. **Copy bound:** cargo sections named above only.

Until ACK: Prefer FAQ plate **holds** (plan/custody only). Orthogonal: feedback persist/readback AMEND Otto PASS but **waits Astra freeze of §1.1–§1.3** — **do not FIRE AMEND** from this ask. No Chris voice · no Serve invent · no fabricated UX.

