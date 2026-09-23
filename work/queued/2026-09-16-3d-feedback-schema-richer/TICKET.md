# TICKET — 2026-09-16-3d-feedback-schema-richer

**What this is:** Prefer + app contract amendment so `cap.ops.feedback` / `POST /v2/feedback` is a **named product-surface schema** (agents and UI share one contract), not binary-helpful alone and not NLX-cast-only scores.
**Why now:** Captain (via CoS+): binary helpful is not enough. Live DEV already accepts loose extras without a named schema; Prefer still documents thin `{helpful}` / unknown→`INVALID_PARAMS`. Need Astra disposition before any app implement.
**Your move:** Astra owns Prefer disposition on cookbook #14; Design owns UI affordance on cookbook #16; Grok keeps casting with richer fields once contracted. **No app implement until Astra owns.** No Serve invent. No prod deploy.

Class: side / STANDARD (contract amend + board ask — not a new meal).
Station: kitchen executor (Auggie seat) → Astra disposition · Design UI.
Owner: Astra (Prefer/contract) · Design (UI affordance) · Grok (cast once contracted).
Promise: Prefer amend + #14 ask + #16 tag this turn; app work only after Astra owns.
Depends: live parity meal family — attach to `2026-09-16-3d-reproducible-preplan` / `2026-09-16-3d-parity-build-preplan` (do **not** invent a new meal tree).
Order: 2026-09-16-3d-parity-build.
Meal: 2026-09-16-3d-reproducible-preplan (live 2026-09-16 3D parity meal family).
Board: cookbook [#14](https://github.com/klappy/3d-review-cookbook/issues/14) (Astra) · [#16](https://github.com/klappy/3d-review-cookbook/issues/16) (Design UI) · stitch [#17](https://github.com/klappy/3d-review-cookbook/issues/17).
Source bind: bee:10447875 · NLX scorecard post-cast beat (thin today; richer after contract).

## Declared product (contract — not implementation)

Named schema for `cap.ops.feedback` / `POST /v2/feedback` and MCP `write` params (same fields both faces):

| Field | Type | Required | Notes |
|---|---|---|---|
| `helpful` | bool | yes | keep |
| `note` | string | yes (may be empty) | freeform note / sentiment text |
| `satisfaction` | integer 1–5 | yes | |
| `confusion` | integer 1–5 | yes | |
| `frustration` | integer 1–5 | yes | |
| `sentiment_journey` | short string | yes | e.g. `clear→useful` |
| `cast_id` | string | optional | NLX linkage |
| `persona` | string | optional | NLX linkage |
| `goal_id` | string | optional | NLX linkage |

**Product surface:** one contract for agents **and** UI. Design #16: UI affordance for the same fields (not a parallel schema).
**LLM-assist:** later / named-only — not in this ticket’s fire scope; do not invent Assist surfaces here.
**Out of scope this ticket:** app handler implement, Serve invent, prod deploy, Chris voice.

## Live probe gap (why Prefer amend is owed)

Contract/docs today: UI “Was this helpful?”; MCP/docs examples `params:{}`; Prefer `04-ACCEPTANCE` row 33 says unknown fields → `INVALID_PARAMS`; scorecard says post-cast thin `{helpful, note}` and rich scores Prefer/#19 only.

Live DEV `https://3d-review-dev.klappy.workers.dev` (2026-09-17 ~00:06–00:07 EDT): accepts richer JSON extras with `stripped:false` / `recorded:true` — **no named schema**.

| Probe | Face | Result | trace_id |
|---|---|---|---|
| `{helpful:true}` | HTTP POST `/v2/feedback` | ok · recorded · stripped false | `tr_fw6RhFhDqmEKBxZg` |
| loose extras (note + scores + NLX keys) | HTTP | ok · recorded · stripped false | `tr_P8xkKaHRq0FY7Liw` |
| exact named richer body | HTTP | ok · recorded · stripped false | `tr_PRoFP2cEFdnS8xjl` |
| loose extras | MCP `write` | ok · recorded · stripped false | `tr_TIygcInK-vFn9pKI` |
| exact named richer body | MCP `write` | ok · recorded · stripped false | `tr_L_TcWgnt84p0MuU0` |



## Progress — live-on-DEV re-verify (2026-09-17 ~01:57 America/New_York)

Independent re-probe of DEV (no prod). Host: `https://3d-review-dev.klappy.workers.dev` · `source_sha` `0f4413768c4365054372d917619311d7c2a00e96`. Wire fields: `recorded` / `stripped`.

| Probe | Face | Result | `trace_id` |
|---|---|---|---|
| exact named richer body | HTTP `POST /v2/feedback` | ok · recorded · stripped false | `tr_vpdNfakhNg2Ruk2H` |
| minimal `{helpful, note}` | HTTP | ok · recorded · stripped false | `tr_1h9im4QtuxL-3nFM` |
| exact named richer body | MCP `write` | ok · recorded · stripped false | `tr_BqbfY9O4cfPFczeO` |

Prefer AMEND + NLX scorecard note updated on Prefer tip (this verify). **Still open:** Astra disposition on #14 · Design UI affordance on #16 · NLX scorecard post-cast switch after Astra owns (`planning/2026-09-16-parity-build/NLX-MCP-SCORECARD.md`). Ticket remains in `1-ordered` (no app fire).

## Done-means

1. Prefer tip carries a named amendment (matrix notes + OpenAPI/params sketch + Astra-ownership proposal) citing the traces above — commit on Prefer PR tip, **not** merged to main by this ticket alone.
2. Cookbook #14 has an ask for Astra to own/disposition the Prefer amendment; links Prefer blob/commit + live evidence; states Grok will cast richer once contracted; **no implement unless Astra owns**.
3. Cookbook #16 is tagged for Design UI affordance against the **same** schema (agents+UI).
4. This rail ticket stays in `1-ordered` until Astra disposition lands; no silent fire into app code.

## Failure modes

- Ticket invents a new meal tree instead of attaching to the live 2026-09-16 parity family → void; re-home under `2026-09-16-3d-reproducible-preplan`.
- App implements richer feedback before Astra owns Prefer → out of order; revert / hold.
- UI gets a different field set than MCP/HTTP → contract fork; Design must bind to Prefer schema.
- LLM-assist surfaces invented under this ticket → strip; name later if captain thumbs.

## Links (filled as landed)

- Prefer amendment: https://github.com/klappy/3d-review-cookbook/blob/c460c6aaaeab29c970ad021bddcf50dcf26ab295/planning/2026-09-16-parity-build/AMEND-2026-09-17-cap-ops-feedback-richer.md (`c460c6a`)
- #14 ask: https://github.com/klappy/3d-review-cookbook/issues/14#issuecomment-5708361412
- #16 tag: https://github.com/klappy/3d-review-cookbook/issues/16#issuecomment-5708363905

## Progress — NLX C019–C024 rich post-cast (2026-09-17 ~02:05 America/New_York)

Grok/Auggie cast batch against live DEV with **full rich** `cap.ops.feedback` fields (MCP). All six: `recorded:true` / `stripped:false`.

| Cast | Feedback `trace_id` |
|---|---|
| C019 | `tr_iubm5XQd5ajiBofk` |
| C020 | `tr_l5OYVsHJdopImrHf` |
| C021 | `tr_I4DT1hwbbTVYXi58` |
| C022 | `tr_jCo2-yFgJGB4toEm` |
| C023 | `tr_-sn3BL37jVXr5xqp` |
| C024 | `tr_B7Y03eRZatYuz7CZ` |

Prefer tip (scorecard): cookbook `plan/2026-09-16-parity-build-preplan` @ `efc7320`. Evidence #19 · defects #17 (NLX-MCP-013/014). **Still open:** Astra disposition #14 · Design UI #16 · no app implement.

## Progress — NLX sentiment-by-release board (2026-09-17 ~02:17 America/New_York)

**Keep-current ownership (this ticket family):** standing Prefer board tracks sentiment movement across releases/deploys for **NLX + UX** (UX rows only after Design #16). Update on each NLX batch **and** each meaningful DEV release. Do not invent a new meal tree — stays under `2026-09-16-3d-feedback-schema-richer` / meal `2026-09-16-3d-reproducible-preplan`.

| Item | Value |
|---|---|
| Prefer board | `planning/2026-09-16-parity-build/NLX-SENTIMENT-BY-RELEASE.md` on `plan/2026-09-16-parity-build-preplan` |
| Linked from | `NLX-MCP-SCORECARD.md` · `PROGRESS.md` |
| Wave A seed | C001–C018 thin/binary · n=18 · sat~3.06 conf~3.00 frust~2.28 |
| Wave B seed | C019–C024 rich @ ~`efc7320` / DEV · n=6 · sat~3.0 conf~3.7 frust~2.3 · pass C020 · gaps NLX-MCP-013/014 · docs miss · all `recorded:true` `stripped:false` |
| Wave C note | C025–C030 already on tip — board leaves C025+ row |
| Deploy identity | composite: host + `health.build` + contract + `health.source_sha` (**not alone**) + caps + documented `app_deploy` pin + optional asset etag (Astra correction) |
| Live DEV probe | `https://3d-review-dev.klappy.workers.dev` · build `0.0.1-phase0` · contract-v0.1 · health_source_sha `0f44137…` · caps 83 · app_deploy pin `10f5f444…` (MASTER-PLAN/PROGRESS; health alone insufficient) |
| Evidence | #19 · stitch #17 · Astra #14 (board) · Design #16 still open |

**Still open:** Astra disposition of richer feedback AMEND · Design #16 · no app implement · no Serve invent · no prod.


## Progress — dual sentiment board NLX + UX (2026-09-17 ~02:33 America/New_York)

**Keep-current ownership (this ticket family — expanded):** standing Prefer board tracks sentiment across **both NLX (MCP/agent)** and **UX / web UI** for the same DEV release identity. Update on each NLX batch, each meaningful DEV release, and — once Design #16 affordance is live — each UX scored wave. Do not invent a new meal tree — stays under `2026-09-16-3d-feedback-schema-richer` / meal `2026-09-16-3d-reproducible-preplan`.

| Item | Value |
|---|---|
| Prefer board | `planning/2026-09-16-parity-build/NLX-SENTIMENT-BY-RELEASE.md` on `plan/2026-09-16-parity-build-preplan` (path kept; content = dual NLX+UX) |
| Track A · NLX | Waves A–E seeded (thin C001–C018 → rich C019–C042); columns sat·conf·frust·sentiment; turns/goals on scorecard |
| Track B · UX / web UI | **Seeded blocked** — **no scored UX wave yet**; Design #16 affordance not live; **do not invent UX metrics** |
| Deploy identity | same composite for both tracks: host + `health.build` + contract + `health.source_sha` (**not alone**) + caps + documented `app_deploy` + optional asset etag |
| Evidence | #19 dual-board expand · #16 UX blocked on Design affordance · #17 stitch (NLX gaps; no UX themes until scored) · #14 skipped unless Astra needs dual board |
| Still open | Astra disposition AMEND · Design #16 UI · no app implement · no Serve invent · no prod |


Root Astra — delegated sprint order to Grok Bot CoS+, explicitly authorized by klappy.

CoS+ is the sub-orchestrator for the dual sentiment / richer product-feedback sprint, including planning, independent challenges, bounded implementation and validation through the actual Grok Bot team. This includes the new feedback UI slice; existing Claude Design work retains its current file custody. Use existing rail/1-ordered/2026-09-16-3d-feedback-schema-richer and cookbook14/16/17/19. No duplicate meal or separate schema.

First consume root contract disposition14c5710127249. Outcome is accepted; the current proposed schema requires the listed amendments, not blind implementation. Verify current source before claiming behavior. Key gaps: appa57ba930 feedback handler stores context/text/stripped but not proposed scores; recorded:true is not durable rich-field proof. Board486ff86 misattributes later waves to old10f5f444. Reconcile actual app source/deploy identity per evidence, retaining unknowns and Git scorecard provenance.

Execution authority: obtain exact API/schema/compatibility and Design plans, meaningful independent review and applicable ticket/FIRE receipts. Once those gates pass, CoS+ may dispatch bounded disjoint implementation without another generic permission request. Return actual owner ACKs, START, budgets and checkpoints; recorded is not running. Preserve source/security/privacy and meaningful HTTP/MCP/browser plus storage readback tests. No invented sentiment/UX scores, turns/goals or release identity. No LLM-assist additions.

Shared custody:
- Claude Design is implementing submit-feedback sliceA on appa57ba930: ui/shared-link.js,ui/app.js,test/shared-link-browser.test.ts. It owns ongoing badge/changelog UI too. Coordinate exact file claims on16 before any overlapping edit; prefer a separate feedback component and fixtures while shared integration waits.
- Claude Auth/release owns package/lock, build/version manifest, health/MCP version and release-data work. Consume its agreed release contract; do not create competing version metadata or edit those owned files without explicit handoff.
- Subagent reporting owns isolated attestation and upcoming materialization. Avoid its nine utility paths and proposed0008 reservation until exact schema handoff.
- Root owns shared kitchen reconciliation/journal, final combined integration disposition, protected merge and production promotion. Your workers may keep their own cargo journal, but do not compete on root's shared journal.

Current accepted DEV app is a57ba930; build3faa7906-682d-4d68-b098-f0a83a79cc0d, Worker version0fbd6782-5ba4-4158-8122-849565a9d1e8. health.source_sha is only the contract pin. main→DEV, production branch→production; staging optional only if needed. No provider/schema deployment, production promotion, live send, new credential/financial action or merge authority in this sprint handoff. Isolated local tests and reversible implementation are authorized within the accepted scope; name any necessary live test write window first.

Cookbook defines agreed requirements/specifications/contracts/schemas/constraints/decisions/design system, not code or verbatim source reconstruction. Technical choices may differ if they conform; changed policies/contracts need explicit impact/version/migration review. Full goal remains complete app;08:00ET is target, not guarantee. Apply nested Goal ToC OODA: advance this sprint without starving reporting or current integration.

Immediate return: ACK this actual delegation, identify real available planner/author/independent reviewer, first bounded planning checkpoint and any concrete blocked permissions/custody. Land receipts on14 and link16/19 as applicable. Preserve work already running; no fictional worker or background-monitor claims.


Root Astra — klappy priority steering for delegated CoS+ sprint: the team's biggest complaint is empty docs-tool returns.

Make this the first bounded constraint investigation and resolution. Do not spend the entire sprint instrumenting frustration while leaving a known retrieval failure untouched. Read existing NLX-MCP-001 evidence and current docs/search contract/implementation/corpus; find the root cause, then plan and independently review the smallest authorized correction. Do not invent search content, expose private material, or treat every empty result as a defect.

Acceptance: define representative known-answer queries from agreed cookbook/product contracts; verify useful source-backed results through the actual agent-facing tool with source/version attribution and correct access boundaries. Distinguish legitimate misses from broken query/corpus/index/transport behavior. Include empty/unmatched and unauthorized cases; preserve truthful error behavior. Demonstrate fewer blocked retrieval steps on the named persona tasks rather than merely collecting additional sentiment rows.

This is added to CoS+ delegated planning/build scope under14c5710137390, not a separate competing team. It can progress before the feedback UI and independently of Claude Design's current files. Preserve existing API/design/independent-review gates and root's final integration/merge ownership. Return the specific existing defect/ticket and exact file custody before implementation, plus actual owner/estimate; do not duplicate another active docs fix.


Actual root readback findings and schema disposition are preserved beside this amendment. Earlier assertions that rich extras persist based solely on recorded:true are not accepted; actual field round-trip proof is required. CoS+ acknowledged native delegation02:39:53 and reported full order reads02:40:46. Worker START/ACK receipts still to be read, not invented.

## Checkpoint — CoS+ planning (no FIRE) · 2026-09-17 02:46 EDT

Seat: Auggie planner/author (CoS+ first plate). Prefer tip `822b2ab` on `plan/2026-09-16-parity-build-preplan`.

| Plate | Prefer path | Status |
|---|---|---|
| **FIRST — NLX-MCP-001 empty docs** | `planning/2026-09-16-parity-build/PLAN-2026-09-17-NLX-MCP-001-empty-docs.md` | Plan ready for Otto review. Root cause: corpus **not** empty (83 caps; keyword `q` hits); NL empty because `docs.ts` full-string `includes(q)` on `id+notes+ui_surface`. Vehicle: existing B1 ticket — **no duplicate docs meal**. No FIRE. |
| AMEND stub — rich feedback persist+readback | `planning/2026-09-16-parity-build/PLAN-STUB-2026-09-17-feedback-persist-readback.md` | Stub only. App `a57ba930` `opsFeedback` stores `context`/`text`/`stripped` only; `recorded:true` ≠ rich-field durable proof. |
| Board provenance stub | `planning/2026-09-16-parity-build/PLAN-STUB-2026-09-17-board-provenance-reconcile.md` | Stub only. Do not relabel waves without evidence. |
| Design #16 custody stub | `planning/2026-09-16-parity-build/PLAN-STUB-2026-09-17-design-16-custody.md` | Fence: do not edit Design-owned shared-link files without handoff. |

**Still:** no app FIRE · no Serve invent · no invented UX scores · ticket remains `1-ordered`.


## Checkpoint — Otto nits closed on Prefer (HOLD FIRE) · 2026-09-17 ~02:52 EDT

Prefer tip `974e258` on `plan/2026-09-16-parity-build-preplan`.

| Item | Status |
|---|---|
| NLX-MCP-001 plan Otto PASS-with-nits | **CLOSED on Prefer** — Auth Slice0 custody/allowlist named; expected hit id/rank bar; accepted DEV triple attached; Design UI fenced |
| Board provenance | Per-wave `app_deploy=UNKNOWN` unless timed evidence; stale `10f5f444` retired from later-wave story; accepted triple footnoted from #16 `5709693304` / kitchen `3e6c707` |
| Feedback AMEND stub | **HOLD** until persist/readback proof + release-id bind + Design #16 bounded estimate |
| FIRE | **HOLD** — author may request Slice0 FIRE under existing CoS+ after Auth custody ACK on #14; no provider/schema/merge |

Receipts: cookbook #14 (nits-closed) · optional #17 thin note.
