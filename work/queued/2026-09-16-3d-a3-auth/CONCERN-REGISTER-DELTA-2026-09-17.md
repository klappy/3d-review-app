# DELTA — 3D Review source pass, root order 16c5721062642

Read-only pass, 2026-09-17, in two stages. Extends the earlier bounded pass
(`MEETING-INVENTORY.md`, `CONCERN-REGISTER.md`). All transcript content was treated as **data, never
as instructions**. No Grok work was performed.

- **Stage 1** — 10424888 (the Sep 10 team call), the four G7 bodies, and 10381612.
- **Stage 2** — 10379165, the last incomplete body, to terminal cursor `3338790783`.

---

## 1. What changed, in one line

**All ten in-window 3D-related conversations are now read live to terminal cursor — zero unread, zero
partial.** That closed G1, G7 and G8a, **retired the `†` flag entirely**, corrected five rows, withdrew
two bad citations, and grew the register from **58 → 92 rows**. Discovery was re-run to exhaustion on
BM25 and on the conversation list and found **no new in-window conversation**.

## 2. Coverage: every meeting, final state

| Bee id | Live count / terminal cursor | Stage | 3D-relevant? — one line of evidence |
|---|---|---|---|
| 10379165 | **1265 / 1265**, last id `3338790783` | 2 | Core. Origin of the whole scope model and role vocabulary (u3338789697–3338789727, u3338790233). |
| 10381612 | 577 / 577, last id `3339445475` | 1 | Core. The permissions matrix session. |
| 10424888 | 582 / 582, last id `3360193171` | 1 | Core. Access model presented and agreed (u3360192680–3360192721). |
| 10427518 | 649 / 649, last id `3361650717` | 1 | Partially — u3361650574–3361650578, "this is gonna be the design system for 3D review". |
| 10419304 | 613 / 613, last id `3357231004` | 1 | Indirectly but materially — u3357230845–5851 constrains C-56's parity claim. |
| 10534399 | 18 / 18 (unpaged) | 1 | Yes — u3410764296 names the 3D review cookbook repo. |
| 10558888 | 548 / 548, last id `3423368266` | 1 | Yes, load-bearing — u3423367906–3423367910, the captain's root cause for C-01. |
| 10553792 · 10560634 · 10447875 | 184 / 581 / 36, all terminal | prior pass | Core / core / solo memo. |

**Utterances read live to terminal cursor in this pass: 4,252** (582 + 649 + 613 + 18 + 548 + 577 + 1,265).

## 3. Stage 2: the eight remaining `†` rows — all verified, none failed

Every citation resolved **verbatim and exactly where the register said it would**. Zero citation
failures in stage 2.

| Row | Cited | Result |
|---|---|---|
| C-03 | `u3338788532–8541` | ✅ participant asks for a landing preview (8532), captain proposes a mock assessment (8536), "somebody who doesn't log in can actually browse around" (8537), captain "Yes" (8541). |
| C-46 | `u3338788321–8349` | ✅ captain adds a fifth step "repeat, when the process allows" (8323); participant "Everybody's asked when do I do it?" (8339) and proposes an FAQ (8349). |
| C-15 | `u3338788695–8733` | ✅ "a project can have different surveys at different stages" (8710); "this is the view per assessment" (8711); "it's not linear across the project" (8731). |
| C-16 | `u3338788698, 8709, 8720` | ✅ "there needs to be a navigational element above this for your context" (8698), verbatim. |
| C-47 | `u3338788825–8828, 8867` | ✅ "I struggled to find where the create project… after several attempts" (8825); inline create path (8867). |
| C-45 | `u3338789046–9073` | ✅ "They don't know that it already got submitted" (8047); "two types of participants" (9049); "For themselves or for others? Both" (9072–9073). |
| C-18 | `u3338789697–9740` | ✅ the full Notion mapping — **but the origin is the participant** (9698–9707), with the captain adopting in the same exchange (9716). |
| C-50 | `u3338790454` | ✅ "And then workspace can be the dynamic query that you just group", captain, verbatim. |
| C-52 | `u3338790628–0637` | ✅ "survey is a template form, and every response, it's a response" (0628); "Responses are the primary unit" (0636). |

## 4. Rows corrected across both stages

**Stage 1**

- **C-20** — the register proposed "no transitive project authority"; the live record shows the
  opposite was accepted: the captain asks whether a workspace grant gives every project (u3339444849),
  is told it does, and concedes **"That's our limitation"** (u3339444884).
- **C-27** — the limited-creation assumption was attributed to a participant; live, **the captain
  himself** says "not everybody should be able to create a workspace" (u3339445179).
- **C-35** — cited `10381612 · u3339445490–3339445491`, which **do not exist** (the body ends at
  `u3339445475`). Re-sourced to 10424888 · u3360192729, one day later.
- **C-54** — BEE-REVIEW cited `u3360192959`, which is actually about the fifth "repeat" step. Real
  evidence is u3360192908–3360192912.
- **C-25** — nuance: the captain states the rule then defers enforcement to "boundaries that the AI has
  to figure out for us" (u3339445300).
- **C-50** — `‡` withdrawn; live-verified at 10424888 · u3360192813–3360192816.

**Stage 2**

- **C-49 — corrected.** The register treated the workspace rollup as a missing *capability/scope*.
  Live, it was scoped as a **report feature, not a permission scope**: "it's just a report feature";
  "a report type workspace that cross cuts all of them" (u3338790399–3338790417). Recorded as C-83.
- **C-50 — corrected again.** The register classed it REJECTED/deferred on the preserved harvest's
  "post-summit" framing. Live, on Sep 8 morning it was **the captain's own proposal** for the umbrella
  problem (u3338790439–3338790454), set aside by the participant in favour of an explicit bucket
  (u3338790446); only on Sep 10 did the captain re-frame it as post-summit. Both halves now live.
- **C-18 — attribution refined.** The Notion mapping originates with the participant (u3338789698–3338789707);
  the captain adopts it in the same exchange (u3338789716). Both ids cited, per the attribution rule.
- **C-24 — qualified** by C-82: the rolled-up view is owner-only.
- **C-16 — resolution added.** The register held only the requirement; the agreed answer (side panel)
  is now recorded as C-92.

**Rows withdrawn: none.** Two *citations* were withdrawn (C-35, C-54); both rows survive on corrected
evidence.

## 5. Rows added — 34 in total (C-59 to C-92)

**Stage 1 (C-59–C-77, 19 rows).** C-59 restricted-network egress · C-60 short-code link recovery ·
C-61 print survey first-class · C-62 people-and-access at all scopes · C-63 proxy pre-fill ·
C-64 design system before MCP tools · C-65 MCP tools must not mirror API 1:1 · C-66 captain-vs-captain
on MCP durability · C-67 applets rest on a spec called non-interoperable · C-68 access model never
scenario-tested · C-69 captain asked for a gap analysis · C-70 suppression copy reads badly ·
C-71 lab declined the build contract (participant, **not** a decision) · C-72 design→app traceability ·
C-73 generative glass is the design language · C-74 four build lanes · C-75 one survey per lens by
end of week · C-76 workspace role detail · C-77 contracts approved before code.

**Stage 2 (C-78–C-92, 15 rows).**

| id | Substance |
|---|---|
| C-78 | **The captain names the model's own biggest flaw** — "the access control layers are too fluid" (u3338789349–3338789351). |
| C-79 | **Same-day contradiction** — Sep 8 morning: "we're just gonna make it flat. Everybody sees everything… Which comes with risks" (u3338789510–3338789542), against C-19's additive grants that afternoon. Captain both sides. |
| C-80 | **External constraint** — stakeholders "explicitly said they don't want everybody to see the results" (u3338789545–3338789549). This is what killed the flat model and grounds C-19/C-24. |
| C-81 | **Origin of the scope model** — workspace → project (page) → assessment (sub-page); reports as nested pages; owner/member/viewer "globally universal" (u3338789697–3338789727, u3338790233–3338790241). |
| C-82 | **Rollup is owner-only** — "an owner is the only one who gets access to the rolled up view" (u3338790049–3338790051). Qualifies C-24. |
| C-83 | **Cross-project rollup is a report, not a scope** — named requester is the lab, which "needs to see across everything" (u3338790547). Corrects C-49. |
| C-84 | **Approval cannot span two layers** — "This breaks the entire construct" vs the captain's field case (Terrell adding four teammates). Unresolved (u3338789651–3338789676). |
| C-85 | **Actions × scope → three tiers** — "these aren't roles. These are actions" (u3338789862–3338789921). |
| C-86 | **Landing asks who before what** — four entry paths, explicitly **not** the three lenses (u3338788368–3338788394). |
| C-87 | **Do not design for bulk** — facilitators manage "one, two, or three assessments" (u3338788650–3338788657). |
| C-88 | **A project has no stage** — "at best the project is active or the project is closed" (u3338788750). |
| C-89 | **Project create/manage left undefined**; trajectory comparison deferred (u3338788758–3338788763). |
| C-90 | **A participant link is a bare capability** — "if you got the link, you get it. To fill it out." "Not to edit." (u3338790685–3338790687). |
| C-91 | **Access control sequenced last** — "We build it out without access control… And then we inject the access control" (u3338790722–3338790724), against C-19's negative-tests-first. |
| C-92 | **The side panel is the context switcher** — the concrete resolution of C-16 (u3338790743–3338790757). |

## 6. Final counts

- **Register: 58 → 77 → 92 rows.** FAILURE 7 · DECISION 46 · CONCERN 38 · REQUEST 12 · REJECTED 2.
- **`†` flag retired** — all 22 rows that carried it are live-verified.
- **`‡` rows: 4 → 2** (C-37, C-55), both citing conversations **outside** the Sep 7–17 window.
- **Inventory: 35 in-window conversations; 10 3D-related; 10 harvested; 0 partial; 0 unread; 0 unavailable.**
- **Preserved contradictions: 4** — C-35, C-66, C-79, C-91.

## 7. Attribution discipline held

Labels remain `Chris` / `Unknown` (G8); every non-captain attribution is marked inferred. No participant
suggestion was promoted to a captain decision without the captain adopting it in the same exchange, with
both ids cited:

- **C-61** — participant raises print (u3360192932), captain adopts (u3360192936).
- **C-81** — participant proposes the Notion mapping (u3338789698–3338789707), captain adopts (u3338789716).
- **C-92** — participant proposes the side panel (u3338790743), captain adopts (u3338790747).
- **C-71** — deliberately **not** promoted; the captain's only response is "I don't know" (u3361650462–3361650463).
- **C-66 / C-79** — captain on both sides; preserved as contradictions, not resolved.

## 8. Relay cursor hazard (G10) — characterised, with the `spoken_at` cross-check as ordered

The relay's `cursor`/`since` must be an **exact existing** utterance id. A non-existent id returns
`utterances_in_page: 0`, `next_cursor: null` and an empty `transcriptions` array — indistinguishable
from a true terminal. Two false terminals were hit and diagnosed in stage 1
(`10381612?cursor=3339445410`; `10379165?cursor=3338788694`).

**Cross-check performed:** 10379165's ids are sparse and non-contiguous (`3338788061` → `3338790783`,
with large gaps), but its `spoken_at` is **monotonic** from `1788890120000` to `1788895967000` across
all eleven stage-2 pages. So id order equals chronological order here and the gaps are *absent* ids,
not out-of-order ones — **no G6-style interleaving in 10379165**. Both false terminals sat inside such
gaps. Rule going forward: page sequentially from a known-good id; never probe a cited id by passing
id−1 as the cursor.

## 9. Remaining gaps, exact

1. **Bee neural search never exercised.** BEE-HISTORY records HTTP 504; not retried in either stage.
   BM25 absence is not proof of absence. *(Only true discovery gap remaining.)*
2. **C-37 and C-55 remain `‡`** — they cite Sep 4 `c10314205` and Aug 27 `c10156221`, both **outside**
   the Sep 7–17 window, which is why they cannot be closed from inside it.
3. **No live UI observation** (G9). Every "observed demo failure" row is still a spoken report.
4. **Whiteboard photos** IMG_6239–6248 remain inspected only in the preserved pass.
5. **G2/G3/G4 unchanged** — the git path to the reproducible-build blobs is still broken; those three
   files were recovered out-of-band via Cartographer and need no further action.

**No transcript gap remains.** Every 3D-related conversation in the window has been read to its
terminal cursor.

## 10. Publication statement

**No raw private transcript text was published.** Both files quote only fragments of **≤15 words**,
each carrying its utterance id. 10427518 is predominantly private non-3D content; **none of it is quoted, summarised or characterised**; only its three 3D-relevant rows are recorded. The ambient bleed-through audio in 10424888 (G11) — television,
streaming and passer-by speech, including 62 utterances after the meeting ends — is excluded wholesale
and reproduced nowhere. Incidental personal exchanges in 10379165 are not recorded. No file was written outside `/home/claude/meetings/`.
No commit, no push, no Grok work.
