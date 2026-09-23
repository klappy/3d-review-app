# JOURNAL — session 1 (CoS door seat, mobile) — 2026-09-16 09:53–10:45 ET

Later sessions journal in `journal/2026-09-16-3d-reproducible-build-plan.tsv` and `rail/meals/2026-09-16-3d-reproducible-build-plan/`; this file backfills the opening session only.

- Boarded: oddkit_time 13:52Z; model-operating-contract fetched. GitAuth read token, then write token (cookbook+kitchen).
- Read kitchens head 9c1bfa1 (STACK, boarding/RECIPE, canon/cos-operating-card, document-routing) via raw API — cartographer consult served stale map 3c82518 → lane fact.
- Evidence census: cookbook (28 atoms, 09-08 whiteboard U-fidelity, 09-09 app-flow), superseded PR6 MODEL/BUILD-ORDERS (D1–D8, B01–B05), `3d-quality-review` July design (arch §1 "MCP IS the interface", decision-queue, schema, threed-data twin, change-mgmt canon), kitchen rail (scenario-ux meal, B01–B05 HOLD, 86ed M01–M06), Bee census 08-12→09-16 (ids only, S-fidelity).
- Cooked in-door (no managed-agent spawn: no API key in seat): cookbook PR #12 preplan 00–10 + HANDOFF @ d5a77f6; labels; issues #13–#17; kitchen PR #120 (this ticket).
- Astra arrived: PR #18 additive cargo; five spec-gaps on #13; claims Lane A planning only. CoS accepted all five with amendments on #13 (later applied by session 2 @ cc57976).
- Kitchen bot posted lane pickups on #14–#17; claims format on #7. Fable/Design roots not yet posted at 10:45.
- Handoff: memory `/projects/…/areas/3d-parity-build.md`; shim given to captain.
- Miss: HANDOFF/JOURNAL push failed on an expired GitAuth token (60-min TTL); first JOURNAL was lost to a rebase collision with session 2 — backfilled here via contents API.

## Debrief candidates
- Cartographer stale kitchens map (resolved.sha ≠ map sha) — add sha check to consult procedure.
- Mobile door seat cannot spawn agents; captain fallback "cook in-door" used — decide whether door seats carry an API key or route via ARS.
- Additive-cargo + root-comment arrival protocol let two planners converge inside 30 min — candidate for canon (08 §rules).
- "100% parity" while reserving rows was a peer-caught spec-gap — parity claims need a slice column from the start.
- GitAuth token TTL vs long door sessions — re-mint before every push batch; journal before the token ages, not after.
- Rebase collisions between overlapping CoS sessions — one journal file per session, or TSV rows, not a shared JOURNAL.md.
