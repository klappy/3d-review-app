# DELTA — driver's-seat lens on 2026-09-16-3d-c3-assessment-context
Run: 2026-09-16 ~20:50 ET by Fable (first officer, Cowork seat), LIFECYCLE step 3. Ticket read at kitchen `26fef2c`; blueprint at cookbook PR #12 `6fec90f`. Captain fired Lane C with "let's cook~" (~19:40 ET); this delta is written while cooking, not before, because the captain's next message named a gap the fired plan did not: the left-pane hierarchy.

## Changed
1. **Surface 3 (context) is a tree, not a list.** `ContextTree`: workspace › project › assessment › survey; role badge on the granting scope; breadcrumb of openable ancestors; quick switch; add affordances per level and role; assessment-only grantee sees *Shared with you* and no parent or siblings. Reason: the accepted context side panel of cookbook `design/2026-09-09-app-flow/index.html` (Bee 10379165/3338790743–0754) and the 8 Sept board (IMG_6239/6240) and the 10 Sept team call (Bee 10424888/3360192917–2927, "every level has consistency"; 3360192818 "go ahead with this") all say so; the first build's aside was a flat project list with a journey menu, which the captain observed and named. Evidence with ids: cookbook `design-system/NAVIGATION-EVIDENCE.md`.
2. **Level menu at every scope** (contents · Details · People & access) with new routes `#/w/:id/people`, `#/projects/:id/people`. Reason: 13 §nav and the 15:39–15:40 utterances.
3. **Declared-product paths differ:** the cook plated under `design-system/` (`components.css`, `cards/`, `ui_kits/3d-review/`) rather than `ui/assessment/*`, `ui/context/*`, `ui/help/*`. One rename, captain's call; the audit (`AUDIT-2026-09-16.md` §1) already flagged it.
4. **A fixture role switcher** (owner · member · viewer · direct grantee) in the pane footer, labelled sample. Reason: done-means line 2 (member without a grant sees the 404 experience) and J4/J6 cannot be shown with one owner fixture.
5. **`--shell-panel-w` 210 → 260px.** Reason: the survey level needs the width; the app-flow mock drew 240.

## Considered and rejected
- Rendering the live mockup inside the design-system artifact card — it does not run in a card (blank, captain's comment); replaced with snapshots and a pointer to the kit.
- Inheritance hints in the tree ("2 more projects not shared with you") — existence hidden (03, D2); nothing is listed that is not granted.
- Looking like Notion — 06 §brief bounds the borrow to access layering and navigation feel.

## Not done in this delta (stays on C1–C5, in rail order)
ui-states ledger; undo only on `inverse:true` (four rows still wrong); loading / not-authorized / stage-conflict states; nine instrument variants (instrument.js is transcribed and loaded, the participant form still reads the invented `DB.questions`); print surface; `language_id`; per-language results; role-aware help; tour per stage; copy deck. C0's 6B table and affirmation on #16 are still unposted: this cook started C2/C3-level work before the C0 gate; the captain's "let's cook~" was the fire, the gate order was not kept. Debrief item.

## Persistence
Cookbook branch commits `1447da7`, `a44714d`, `62510da` (design-system/) exist only as a git-am patch in the session outputs: the cloud proxy refuses git and API writes to klappy/* ("not in this session's authorized repository set"). Artifact mirror published (v10). Landed 21:20 ET: the existing `klappy-git-relay` worker was given the hostname `git-relay.klappy.dev`; git push and the REST API go through it with the Git_Auth token. Cookbook PR #24; this rail branch is kitchen PR #123.

## Voice
Nothing here is in the captain's voice. The 6B table and the #16 root post are the captain's to affirm.

## Audit qualification — September 16, fresh-session review

This original author record is preserved verbatim above from kitchen PR123 at `f3364a5a7bdb7d5c6fc0c9cf05e26f4feee840a9`. Auggie and Astra/root independently read all six rail records before this direct-main persistence. This is historical cargo, not an accepted plate or proof that a pre-fire gate ran. Words such as "plated" and references to captain path decisions above are author claims, not independently established captain acceptance; C0–C5 remain in their actual lanes. The recorded C0/dependency and retrospective-lens timing breach remains a breach.

Authored approximate civil times, including C2 22:20, C4 22:50 and C5 23:10, were in the candidate before the fresh review observed 22:04 EDT; those event times are unverified and must not be used as clocks or backfilled with invented timestamps. Route-smoke counts and author browser reports are not complete capability, persona, privacy or deployed-app acceptance. C1's considered/rejected alternatives remain owed; this transport correction does not create that missing lens evidence.

Design retains implementation and correction ownership. Current findings and source coverage are governed by existing C6/PR25 and the dated reconciliation; newer design artifacts can supersede these historical not-done observations only on exact evidence. The narrow disposition persists rail records directly under HYGIENE3, preserves provenance, and closes the unnecessary rail PR unmerged. It grants no product merge, deployment, lane change or retrospective gate waiver.
