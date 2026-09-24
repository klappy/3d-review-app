# CHECKLIST — the ordering pass
*Version: 1.4.1 · Semver on every change. Run against a ticket BEFORE it is
claimable. A ticket that fails is MALFORMED: it does not enter `1-ordered`,
and a cook who finds one there skips it (dispatch shim) rather than
repairing it silently.*

---

## How to run it

Read the ticket once. Answer all thirteen gates. Write the verdict as a dated
`CHECKLIST-RUN.md` in the ticket's folder — it travels with the ticket
through every lane, the same way a gate verdict does.

Any ❌ = **MALFORMED**. Name the failing gate; do not repair and pass in the
same motion. The order is the chef-owner's; a cook that quietly rewrites an
order has replaced his judgment with its own.

---

## The thirteen gates

| # | Gate | Passes when |
|---|---|---|
| 1 | **Header** | What this is / Why now / Your move — three sentences, present, plain. The chef-owner's single next action is named. |
| 2 | **Fields** | Class, Risk, Station, Owner, Promise, Depends all present. `Depends: none` counts; blank does not. |
| 3 | **Naming** | Folder is `YYYY-MM-DD-slug` (HYGIENE 9), date = the civil date the order was taken, America/New_York (HYGIENE 1). |
| 4 | **Ingredients bound** | Every input is bound, or named as a prep dish with provenance + freshness (R11, R12). "We'll find out" is not an ingredient. |
| 5 | **Declared product** | Every artifact named **by path**. A product you cannot `ls` for is a gesture. |
| 6 | **Done-means observable** | 5–7 entries, each `<consumer> can <action> and observe <outcome>` (P0007). Zero entries containing *improved*, *better*, *cleaner*, *robust*, *properly*. |
| 7 | **Dependencies resolvable** | Each named dependency exists on the rail, and its lane is compatible: a dish whose dependency sits in `1-ordered` is **blocked**, not ready. |
| 8 | **Risk tier honest** | Touches kitchen law, secrets, PII, chef-owner voice, revenue, or an irreversible → `ALLERGY` (R12). |
| 9 | **Vagueness test** | *Could two cooks read this and plate different dishes?* If yes → underspecified. This gate outranks the other eight: a ticket can pass 1–8 on form and still fail here on substance. |
| 10 | **Reference fidelity** | Every reference implementation the chef-owner names ("like X", "the way Y does it") is observed before design: opened or fetched live, its actual shape described in the ticket in one or two sentences, and any deliberate divergence from it named. A reference is a spec pointer, not a vibe; designing from memory of it is flying from memory. |
| 11 | **House prior art** | Before a mechanism is designed, the house is searched for one that already exists: the installation's repos are listed and the plausible ones inspected for an implementation. What was found is named in the ticket with its repo and path, or the ticket states that the search ran and found nothing. Gate 10 covers references the chef-owner names; this gate covers the ones he shouldn't have to. |
| 12 | **Failure Modes + Required Response** | Ticket has `## Failure Modes — What Breaks When …` (descriptive subtitle, not a bare category) AND `## Required Response When Detected`, and every named mode has a response. Bare `## Failure Modes` fails. A mode with no response fails. |
| 13 | **Lens receipt** | Fast-food and petit fours pass on the line `driver-seat: exempt (<class>)` in `TICKET.md`. Scoped classes (meal, entrée, catering, plan revision — `LIFECYCLE.md` step 3) **pass this gate without `DELTA.md`**: the receipt is written at step 3, after the order is on the rail. Missing receipt is not bound, not ❌. FIRE-CHECK judges file presence at fire. |

---

## Gate 11, and why it is not gate 10

Gate 10 fires on a reference the chef-owner *named*. Gate 11 fires when he
named nothing — which is most of the time, because he is not obliged to
remember which of his own repos already solved this. The distinction is the
whole point: an unspoken reference is invisible to every other gate in this
kitchen, and no gate failing is not the same as nothing being missed.

Run it mechanically. List the installation's repositories, pick the ones
where a solution to this shape would plausibly live, and look. Two tool
calls is the usual cost. Write what you found — repo and path — or write
that you looked and found nothing; the null result is the evidence that the
gate ran.

The failure this gate was written for: journal s0037–s0040. A CI bench gate
was designed from scratch over three turns while `klappy/oddkit` had been
running `perf/perf-smoke.mjs` since 2026-08-21, carrying empirical bands the
fresh design got wrong. Gate 10 was clean throughout, because the reference
was never spoken.

## Gate 9, the one that does the work

The other eight gates check that fields exist. Gate 9 checks that the
fields mean one thing.

Run it literally. Read the declared product and done-means, then ask what a
second cook — no shared context, no memory of the conversation that
produced the order — would build from the same words. If you can describe
two defensible dishes, the ticket is underspecified and the difference
between them is exactly the sentence that is missing.

The failure this gate was written for: journal k0053, a ticket its own
owner could not act on. The tell is almost always an abstraction standing
where a name, a number, or a path belongs (HYGIENE 14, **Concrete**).

---

## Verdict format

```markdown
# CHECKLIST-RUN — <ticket-id>
Run: <YYYY-MM-DD> by <who>. Checklist v<semver>.

| Gate | Verdict | Note |
|---|---|---|
| 1 Header | ✅ / ❌ | |
| ... | | |

**Verdict: WELL-FORMED** (claimable) — or —
**Verdict: MALFORMED** — failing gates: <list>. Disposition: <back to the
chef-owner / amend by owner / hold>.
```

---

## Standing binds

- **A malformed ticket is never cooked as-is and never silently repaired.**
  The cook skips it with one DEBRIEF line naming the failing gate.
- **Gate 13 "not bound" is not ❌.** A scoped ticket may enter `1-ordered`
  without `DELTA.md`; the planning seat writes the receipt at LIFECYCLE
  step 3. FIRE-CHECK refuses fire until it is there.
- **The checklist does not judge the dish, only the order.** A well-formed
  ticket for the wrong work is a chef-owner call.
- **Retroactive sweep:** tickets already on the rail get their run at first
  formal visit, not in a bulk pass (see `INSPECTION-PREDICATE.md` in this
  dish's cargo).
- **Amendment:** this checklist changes by semver bump plus a line in the
  changelog below, never edit-in-place without one (R14).

## Changelog
- **1.4.1** (2026-09-03): Gate 13 does not MALFORM a scoped ticket for a
  missing `DELTA.md` — that receipt is LIFECYCLE step 3, after the order
  enters `1-ordered`. "Not bound" is not ❌. Exempt classes still fail
  without the exemption line. File-presence fail moves to FIRE-CHECK 1.2.0.
  Ticket `2026-09-02-driver-seat-pass-policy`.
- **1.4.0** (2026-09-03): Gate 13, Lens receipt — the driver's-seat lens
  (`klappy://canon/methods/driver-seat-lens`, `LIFECYCLE.md` step 3) leaves
  a `DELTA.md` or an explicit exemption line; the gate reads file presence.
  Ticket `2026-09-02-driver-seat-pass-policy`. The ticket named this bump
  1.5.0; main was at 1.3.0, so it lands as 1.4.0.
- **1.3.0** (2026-08-30): Gate 12, Failure Modes + Required Response — captain
  Serve 9:24a ET (`failure-mode-names-its-response`). Descriptive subtitle
  required per `klappy://canon/meta/writing-canon`, section Headers Are a
  Navigational Map. Bare `## Failure Modes` fails; every named mode owes a
  response.
- **1.2.0** (2026-08-23): Gate 11, house prior art — chef-owner ruling
  ("hygiene and health codes"), exact text tasted at the pass. Born from
  journal s0037–s0040: oddkit's perf-smoke harness reinvented from scratch
  because no gate asks whether the house already does this. Twin clause
  added to FIRE-CHECK gate 3 (v1.2.0) and standing practice bound at
  HYGIENE line 17 (v1.11.0).
- **1.1.0** (2026-08-17): Gate 10, reference fidelity — captain-ratified exact
  text at the pass. Born from the four-round seasoning cascade on the catalog
  arc (journal s0038): "like oddkit catalog" designed from memory of the
  reference instead of observation of it.
- **1.0.0** (2026-08-12): First cut. Nine gates; gate 9 (vagueness) named as
  the substance gate. Born from journal k0031 (chef-owner order), k0033
  (rule-in-memory class), k0053–k0054 (ticket zero unreadable by its owner).
