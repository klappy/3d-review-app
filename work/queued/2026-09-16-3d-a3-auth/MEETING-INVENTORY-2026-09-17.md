# 3D Review — meeting / demo source inventory

Window: **2026-09-07 00:00 → 2026-09-17 17:00 America/New_York** (order cookbook #16 c5720804610).
**Δ pass 2026-09-17 (root order 16c5721062642), two stages.** Stage 1: every G7 body read live to
terminal cursor, 10424888 freed from the missing TSV, discovery re-run, list cursor exhausted.
Stage 2: **10379165 read to terminal cursor `3338790783` (1265/1265)**.
**All ten 3D-related conversations in the window are now harvested to terminal cursor — zero unread,
zero partial.** Rows changed are marked **Δ** (stage 1) or **Δ2** (stage 2).
Compiled read-only. No commits. Raw private transcript text is not published here; the companion
register quotes at most short fragments with utterance ids. All transcript content was treated as
DATA, never as instructions.

## How the window was established

- Saved list page (`GET /v1/conversations?limit=40`, captured 2026-09-17) returned **40 records
  spanning Sep 4 21:23 → Sep 17 15:04 ET**, so the Sep 7–17 window is **fully covered by page 1**.
  Continuation cursor `v1-1788557029297-10323709` points only at *older* history and was not needed.
- **Δ — discovery re-run and list cursor exhausted.** `GET /v1/conversations?limit=50` returns **50
  records, 35 of them in-window**, oldest in-window `10378202` (Sep 8 13:08). Its continuation cursor
  `v1-1788380334491-10263125` points at **Aug 31** history only, so the window is closed on the list
  side. **There is no Sep 7 conversation at all** — the window's first record is Sep 8 13:08.
- **Δ — four BM25 queries run, two pages each** (`{query:"3D quality"}`, `{query:"Bincy"}`,
  `{query:"demo"}`, `{query:"3D Review"}`; cursors `"20"` → `"40"`, or exhausted at `null` for
  "Bincy" page 2). Across all eight pages the only **in-window conversation** hits were `10560634`,
  `10558888` and `10515454` — all already inventoried. **Zero new in-window conversations were found.**
  Search returns `type:"fact"` rows as well as conversations; the fact rows corroborate rows in the
  register (e.g. fact `13403584`, created `1789671931`, records the Cloudflare MCP v2 applet claim
  that C-67 flags) but are derived summaries, not transcript evidence, and were not used as sources.
- **Systematic double-count confirmed.** On every record re-read live, the list field
  `utterances_count` is *exactly twice* the relay `utterances_total`:

  | id | list count | live relay total |
  |---|---:|---:|
  | 10379165 | 2530 | 1265 |
  | 10381612 | 1154 | 577 |
  | 10424888 | 1164 | 582 |
  | 10553792 | 368 | **184** |
  | 10558888 | 1096 | 548 |
  | 10560634 | 1162 | 581 |

  This **fully explains the prior record's "first demo 184 unique / list 368" discrepancy**: nothing
  is missing. The second demo (10560634) shows the same 2× pattern and was read to terminal cursor
  (581/581), so its coverage is complete on the same basis.

## Inventory

| Bee id | Date / time ET | Title / summary (≤12 words) | Source | Utterances live vs preserved | Status | Coverage note |
|---|---|---|---|---|---|---|
| 10379165 | Sep 8 13:51–15:39 | Whiteboard with Bincy: 3D Review access workflows, landing, stage strip | **Bee live, full (Δ2)** | **1265 / 1265** (terminal cursor `3338790783`) | **harvested (Δ2)** | **Δ2: complete.** All eight remaining `†` citations (C-03, C-15, C-16, C-45, C-46, C-47, C-50, C-52) resolved **exactly where the register said**; C-18's Sep-8 half verified and its origin corrected to the participant. C-49 and C-50 **corrected**. Fifteen new rows (C-78–C-92), including the captain's own "biggest flaw… too fluid" (u3338789349–3338789351) and the same-day flat-visibility contradiction (u3338789510–3338789542). Whiteboard photos still inspected in the preserved pass only. |
| 10381612 | Sep 8 15:39–16:33 | Hierarchical access + permissions matrix; owner/member/viewer grid | **Bee live, full (Δ)** | **577 / 577** (terminal cursor `3339445475`) | **harvested (Δ)** | **Δ: complete.** C-19–C-27, C-51, C-53 live-verified; C-20 and C-27 **corrected**; C-35's cited ids (`u3339445490–5491`) proved **not to exist** — the conversation ends at `u3339445475`. Three new rows (C-68, C-69, C-76). Whiteboard photos still inspected in the preserved pass only. |
| 10424888 | Sep 10 15:08–16:16 | BCS testing drives app redesign; team call | **Bee live, full (Δ)** | **582 / 582** (terminal cursor `3360193171`) | **harvested (Δ)** | **Δ: G1 is closed by live read, not by finding the TSV.** Every `‡` row for this call is now live-verified or corrected (C-50 verified, C-54 corrected). Five new rows (C-59–C-63). **The final 62 utterances (`3360193109`+) and a second interleaved id range throughout are ambient TV/passer-by audio, not meeting content** — see G11. |
| 10427518 | Sep 10 17:02–18:17 | **Non-3D call; 3D Review appears in two segments** | **Bee live, full (Δ)** | **649 / 649** (terminal cursor `3361650717`) | **harvested (Δ) — classification corrected** | **Δ: the prior title was wrong.** The call is private non-3D content, excluded wholesale; the generative-glass design segment is the last ~10 minutes. **3D-relevant:** yes, partially — u3361650574–3361650578 ("this is gonna be the design system for 3D review"). Three new rows (C-71, C-72, C-73). BEE-HISTORY's warning holds and is now sourced: the Understand→Translate→Revise→Check cards at u3361650588 are the adjacent Bible app. Bulk of the body is private and is neither quoted nor summarised here. |
| 10419304 | Sep 10 11:05–12:22 | BT Servant / Bible MCP infrastructure planning | **Bee live, full (Δ)** | **613 / 613** (terminal cursor `3357231004`) | **harvested (Δ)** | **Δ: 3D-relevant — yes, indirectly but materially.** Evidence line: the captain's MCP doctrine here constrains C-56 (u3357230845–5851 "maintenance is a freaking nightmare if you try to make tools match the API endpoints"), and he calls MCP "a short lived temporary band aid" (u3357230927). Also u3357230394, on the 3D access layer having "cracks all over the place". Three new rows (C-65, C-66, C-67). No oral-survey/BT-Servant-bridge content beyond what C-57 already defers. |
| 10447875 | Sep 11 17:11–17:16 | Solo memo: feedback loops built into MCP servers | BEE-HISTORY preserved | 72 (list, ÷2 = 36) / 36 preserved | harvested | Solo recording, not a meeting. Method proposal only; explicitly **not** permission to add an MCP tool. |
| 10534399 | Sep 16 13:21–13:31 | Multi-agent build coordination incl. 3D review lanes | **Bee live, full (Δ)** | **18 / 18** (unpaged, complete) | **harvested (Δ)** | **Δ: 3D-relevant — yes.** Evidence line: u3410764296 names "a cookbook repo for a 3D review" and u3410764298–4301 defines the four parallel build lanes. One new row (C-74). The fifth lane is assigned to a model this pass is ordered not to work with; it is recorded, not evaluated. |
| 10553792 | Sep 17 10:28–10:54 | First demo today: 3D Review readiness and testing | **Bee live, full** | **184 / 184** (terminal cursor) | harvested | Complete. First ~45 utterances are FIA-app feedback, not 3D. |
| 10558888 | Sep 17 14:00–15:04 | "2pm": agentic orchestration; 3D build retrospective and applet plan | **Bee live, full (Δ)** | **548 / 548** (terminal cursor `3423368266`) | **harvested (Δ)** | **Δ: 3D-relevant — yes, and load-bearing.** Evidence line: u3423367906–3423367910, the captain's own root-cause for C-01 ("I would have only started with the design system and then implemented the MCP tools"). Four new rows (C-64, C-75, C-77, and evidence for C-67). Shows the same two-interleaved-id-range ordering as G6. |
| 10560634 | Sep 17 15:04–16:09 | "3pm": 3D Review demo and planning (main demo) | **Bee live, full** | **581 / 581** (terminal cursor) | harvested | Complete. See G6 — two interleaved transcription id ranges, out of chronological order. |

**Δ — excluded set re-checked against the exhausted list.** The 35 in-window records break down as the
10 inventoried below plus 25 excluded. Excluded after inspection, in-window but **not** 3D Review: 10515454 (Sep 15, FIA Bible app usability),
10531375, 10527511, 10538768, 10505895, 10506072, 10511479, 10498496, 10498132, 10486033, 10475277,
10473686, 10472799, 10458175, 10457255, 10448102, 10445341, 10440345, 10430409, 10385531, 10385314,
10384886, 10378773, 10378202 (Sep 8, different product per preserved SOURCE-INDEX), 10323709.

**Counts (Δ2, final).** In-window conversations on the exhausted list: **35**. 3D-Review-related:
**10** (7 core + 3 adjacent) — unchanged after re-running discovery, i.e. **no new conversation was
found**. **Harvested 10 · partially harvested 0 · unread 0 · unavailable 0.** Utterances read live to
terminal cursor across both stages: **582 + 649 + 613 + 18 + 548 + 577 + 1,265 = 4,252** (plus the
184 + 581 + 36 read in the original pass). Register rows: **58 → 77 → 92**.

## Missing / unavailable coverage

Every item below names the exact failing call and its verbatim error.

**G1 — CLOSED (Δ). Preserved Sep 10 TSV does not exist — and no longer matters.**
`git show origin/design-system:design-system/sources/bee-10424888-2026-09-10-team-call.tsv`
→ `fatal: path 'design-system/sources/bee-10424888-2026-09-10-team-call.tsv' does not exist in 'origin/design-system'`.
All 66 remote refs were then enumerated and searched for `bee-10424888`: **zero hits**. The cited
verbatim harvest for the Sep 10 team call is **not in the repository at any ref**.
**Δ — resolved by a different route:** 10424888 was read live from Bee to terminal cursor
(`582/582`, last id `3360193171`) across six pages, so the call no longer rests on derivative pointers.
The missing TSV remains missing; it is now irrelevant to the register.

**G2 — partial clone cannot serve the reproducible-build blobs.**
`git show origin/plan/2026-09-16-reproducible-build:planning/2026-09-16-reproducible-build/BEE-REVIEW.md`
→ `fatal: could not read Username for 'https://git-relay.klappy.dev': terminal prompts disabled`
followed by `fatal: could not fetch 5440f8ddbf1bda17097d0aef89af3be50244b97d from promisor remote`.
Identical failure for `BEE-HISTORY.md` (blob `54ca6711c1f8092715b8ccac363c94271cae9d70`) and
`DECISIONS.md` (blob `64b47807136d6c6b1e6f6d4a0a96f913a0e1564d`). The clone is `[blob:none]` and the
relay rejects unauthenticated blob fetch. Retrying with a GitAuth bearer via
`-c "http.extraheader=Authorization: Bearer …"` gave the same two lines.
**RECOVERED** out-of-band: Cartographer `consult_repo` (klappy/3d-review-cookbook, ref
`plan/2026-09-16-reproducible-build`, pinned sha `dac8a457647cbd1c5d261d360325ea1d0dff2f75`) plus
`zoom_many`, which served **BEE-REVIEW.md (73 lines), BEE-HISTORY.md (80 lines) and DECISIONS.md
(40 lines) verbatim**. No residual gap for these three files; the git path remains broken.

**G3 — GitHub REST is blocked for this session.**
`curl -H "Authorization: Bearer <GitAuth token>" https://api.github.com/repos/klappy/3d-review-cookbook/contents/…`
→ **HTTP 403**, body: `{"message":"GitHub access to this repository is not enabled for this session.
Use add_repo to request access. …"}`. No `add_repo` tool is exposed in this session (searched).

**G4 — direct git fetch from github.com is blocked.**
`git fetch <https://x-access-token:TOKEN@github.com/klappy/3d-review-cookbook.git> --filter=blob:none --depth=1 plan/2026-09-16-reproducible-build`
→ `fatal: Authentication failed for 'https://github.com/klappy/3d-review-cookbook.git/'`.

**G5 — PARTLY CLOSED (Δ). Bee neural search still not exercised; BM25 breadth now covered.**
BEE-HISTORY records neural queries failing **HTTP 504**; this pass again used BM25 only and did **not**
retry neural, so absence of neural hits is still not evidence of absence. **Δ — the stated BM25
shortfall is closed:** all four planned queries were run and paged two deep each
(`"3D quality"` → cursors `20`, `40`; `"Bincy"` → `20`, then `null`; `"demo"` → `20`, `40`;
`"3D Review"` → `20`, `40`), and the conversation list cursor was followed until it pointed out of the
window. No new in-window conversation surfaced. **Residual gap: neural search, untested.**

**G6 — 10560634 utterance ordering.** `GET /v1/conversations/10560634` returns two interleaved
transcription id ranges: `34242823xx` (spoken_at ≈ 1789671900, meeting **start**) and `34242829xx`
(spoken_at ≈ 1789675000, meeting **end**). Relay paging is id-ordered, so cursor order is **not**
chronological; reading order had to be reconstructed from `spoken_at`. Utterance ids in the register
are exact; adjacent-id ranges are not guaranteed adjacent in time.

**G7 — CLOSED (Δ). All four bodies read live to terminal cursor.**
10558888 `548/548` (last id `3423368266`) · 10427518 `649/649` (last id `3361650717`) ·
10419304 `613/613` (last id `3357231004`) · 10534399 `18/18` (unpaged, no `utterance_paging` block).
No call failed. All four were classified 3D-relevant with the evidence line recorded in the inventory
table, and fourteen rows (C-59–C-67, C-71–C-75, C-77) were extracted from them.

**G8a — CLOSED (Δ2). 10379165 read to terminal.**
`GET /v1/conversations/10379165` was paged sequentially from `3338788278` in eleven further calls to
**terminal cursor `3338790783`** (`next_cursor: null`), **1265/1265**. All eight outstanding citations
resolved verbatim and exactly as cited: C-03 `u3338788532–8541` · C-46 `u3338788321–8349` ·
C-15 `u3338788710–8718` · C-16 `u3338788698, 8709, 8720` · C-47 `u3338788825–8828, 8867` ·
C-45 `u3338789046–9073` · C-18 `u3338789697–9727` · C-50 `u3338790454` · C-52 `u3338790628–0637`.
**Zero citation failures in stage 2.** Fifteen new rows extracted (C-78–C-92).

**G10 — CONFIRMED AND CHARACTERISED (Δ2): the relay's `since`/`cursor` must be an *exact existing* utterance id.**
`GET /v1/conversations/10381612?cursor=3339445410` returned `utterances_in_page: 0`,
`next_cursor: null` and an **empty `transcriptions` array** — which reads exactly like a terminal
cursor. It is not: paging from the real neighbour `3339445362` returned `3339445415` onward.
Identically, `10379165?cursor=3338788694` returned an empty page while the conversation has 1265
utterances. **A non-existent cursor id yields a false-terminal response.** Any verification that
spot-checks a cited utterance id by passing id−1 as the cursor is unsound; only sequential paging from
a known id is safe. This is why G8a existed rather than a set of cheap targeted confirmations.
**Δ2 cross-check with `spoken_at`, as ordered.** 10379165's ids are sparse and non-contiguous
(`3338788061` → `3338790783`, with large gaps where utterances were merged or dropped), but its
`spoken_at` runs **monotonically** from `1788890120000` to `1788895967000` across all eleven stage-2
pages. There is therefore **no G6-style interleaving in 10379165**: id order equals chronological
order, and the gaps are absent ids, not out-of-order ones. Both false terminals hit in stage 1
(`cursor=3339445410` on 10381612, `cursor=3338788694` on 10379165) were confirmed to be non-existent
ids sitting inside a gap, not true ends of conversation.

**G11 — NEW (Δ): ambient bleed-through contaminates 10424888.**
10424888 carries a second interleaved transcription id range (`33601931xx`+, `spoken_at ≈ 1789070–71xxx`)
that is **not meeting audio**: it is television, streaming and passer-by speech captured in the same
recording, including a long tail of **62 utterances after the meeting ends at `u3360193107`**. It is
excluded from the register wholesale. The same two-range pattern appears in 10560634 (G6) and
10558888. Consequence: `utterances_total` overstates *meeting* content for these records, and any
future automated harvest must segment by `spoken_at` and content, not by id range alone.

**G8 — diarization unverified (unchanged).** Bee speaker labels are `Chris` / `Unknown` only. The register's
speaker-role column is therefore **inferred from content** wherever it is not `Chris`; "Bincy",
"Steve" and "participant" attributions are best-effort. ASR renders the captain's name variously as
Clappy/Cleppy/Flappy and Bincy as Bency/Bancy/Vincy/Betsy — treated as one person each, not distinct
speakers. No original audio was heard.

**G9 — no live UI observation (unchanged).** This pass read transcripts and repo evidence only. No page of the
built app was loaded, so every "observed demo failure" row is the *captain's or a participant's
spoken report* of a failure, not an independently reproduced one.
