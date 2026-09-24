# FIRE-CHECK — the firing pass
*Version: 1.3.0 · Semver on every change. Run against a ticket at the moment it
moves into cooking. A ticket that fails does not fire: it stays where it is with
the failing gate named. The twin of `CHECKLIST.md` at the other boundary — that
one judges the order, this one judges the plan.*

---

## How to run it

Read the ticket and its design once. Answer all eight gates. Write the verdict
as a dated `FIRE-CHECK-RUN.md` in the ticket's folder — it travels with the
ticket, the same way a checklist run does.

Any ❌ = **DO NOT FIRE**. Name the failing gate; do not repair and fire in the
same motion. The order is the chef-owner's, and a cook that quietly patches a
plan on the way to the stove has replaced his judgment with its own.

## The eight gates

| # | Gate | Passes when |
|---|---|---|
| 1 | **Ticketed** | The work exists as a ticket on the rail. No ticket, no fire — and the ticket is the one being fired, not an adjacent one it seemed to fit under. |
| 2 | **Well-formed** | `CHECKLIST-RUN.md` is present and reads WELL-FORMED, or the nine gates are run now and the verdict written. |
| 3 | **Spec current** | The `.md` describing this work matches what is about to be built (HYGIENE 12). If the plan changed in conversation, the change is in the file before the burner is lit. If the ticket cites a reference implementation, gate 3 includes re-confirming the described shape still matches the live reference. |
| 4 | **Rail re-read / reorient** | Re-read the rail and relevant changes since this ticket was last current. Check whether completed or active work, new evidence/outcomes, or superseding decisions materially change it. State the effect: **nothing changed / amend / no longer needed / blocked**. One sentence is enough; unrelated history is not an audit requirement. |
| 5 | **Preflight run** | `oddkit_preflight` output recorded: the bindings it surfaced, and its pitfalls answered rather than listed. |
| 6 | **Challenge run** | `oddkit_challenge` run in planning mode. `block_until_addressed` recorded, and every missing prerequisite answered in the ticket or the design — answered, not acknowledged. |
| 7 | **Borrow evaluated** | Implementation with an upstream substrate carries its 6B table with one verdict per row (`klappy://canon/constraints/borrow-evaluation-before-implementation`). Not an implementation → `n/a`, said out loud. |
| 8 | **Lens receipt** | For scoped classes (meal, entrée, catering, plan revision — `LIFECYCLE.md` step 3), `DELTA.md` is present beside the ticket; or `TICKET.md` carries the line `driver-seat: exempt (<class>)`. Neither present → not bound, DO NOT FIRE. Fast-food and petit fours pass on the exemption line alone. A scoped plan revision without a fresh `DELTA.md` fails. |

## Gate 4, the one that pays for the rest

Gates 1–3 and 5–7 check that the plan was made well. Gate 4 checks that it is
still the plan.

Hours pass. Other dishes move. Work lands, evidence arrives, or a later decision
changes an assumption this ticket was built on. So the gate is literal: re-read
the rail and the relevant changes since this ticket was last current, then write
one sentence about their effect. **"Nothing changed" is a complete answer** after
the relevant check. The point is reorientation before spending, not archaeology
of unrelated history.

The same question is asked again mid-cook whenever the seat comes back to a dish
after an hour or a day away (HYGIENE 2, *the plan is perishable*). That later
look does not need a second run file — one foldout row naming what was re-read,
and whether the effect is nothing changed, amend, no longer needed, or blocked,
is the whole of it.

## Verdict format

```markdown
# FIRE-CHECK-RUN — <ticket-id>
Run: <YYYY-MM-DD> by <who>. Fire-check v<semver>.

| Gate | Verdict | Note |
|---|---|---|
| 1 Ticketed | ✅ / ❌ | |
| ... | | |

**Verdict: FIRE** — or —
**Verdict: DO NOT FIRE** — failing gates: <list>. Disposition: <back to the
chef-owner / amend the design / hold on a dependency>.
```

## Standing binds

- **A dish cooking without its run is cooking unlit.** The run's absence is the
  finding; the health inspection reads file presence, not prose.
- **Counter service is exempt from the written run, not from the ticket.**
  Drafting under the chef-owner's eye still answers to an order; it just does
  not stop to write a verdict about it.
- **The gate judges the plan, never the dish.** Whether the work is worth doing
  is the chef-owner's call, made at the order and again at the pass.
- **Amendment:** semver bump plus a changelog line, never edit-in-place without
  one (R14).
- **This is the fire gate, not the plate gate.** The pass waits for Bugbot and
  the other attached CI/CD to finish before merge (HYGIENE 3, 17). Do not
  treat a FIRE verdict as permission to merge an 8-second PR.

## Changelog
- **1.3.0** (2026-09-07): Gate 4 reorients stale work against relevant completed
  or active work, new evidence/outcomes, and superseding decisions before fire;
  one sentence remains enough and unrelated history is not a backlog-wide audit.
  Mid-cook refresh asks the same question. No new gate, artifact, trial state, or
  cleanup obligation. If this wording adds ceremony without useful reorientation,
  ordinary recipe amendment or revert is sufficient. Ticket
  `2026-09-07-fire-check-reorient`.
- **1.2.0** (2026-09-03): Gate 8, Lens receipt — the driver's-seat lens
  (`klappy://canon/methods/driver-seat-lens`, `LIFECYCLE.md` step 3) leaves
  a `DELTA.md` or an explicit exemption line; the gate reads file presence
  at fire, after the planning seat has had its turn. Born as CHECKLIST
  1.4.0 gate 13, moved here so the ordering pass cannot deadlock a scoped
  ticket. Ticket `2026-09-02-driver-seat-pass-policy`.
- **1.1.1** (2026-08-30): Standing bind — fire gate ≠ plate gate. Pass waits
  for Bugbot and attached CI/CD. Ticket 2026-08-30-wait-for-checks.
- **1.1.0** (2026-08-17): Gate 3 gains the reference re-confirmation line —
  captain-ratified exact text, twin of CHECKLIST gate 10.
- **1.0.0** (2026-08-17): First cut. Seven gates; gate 4 (rail re-read) named as
  the gate the others are built around. Born from the checks the chef-owner was
  typing by hand before every fire and on every return to a live dish.
