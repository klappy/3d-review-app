# Report API/MCP — actual-DEV acceptance execution plan (v4.1 — v4 + scheduling clarification #14 c5712254782; FIRE authority #14 c5712305068, conditional on verified repaired deploy + Step R)

Seat: Auth (cos door). v1 START 2026-09-17T09:00:52Z; v3 START 09:27:32Z; v4 START 09:33:46Z (all observed via oddkit_time). **Deployed target = the REPAIRED deployment's root-supplied deploy triple `<SHA_R> / <BUILD_R> / <WORKER_R>` — NOT `65d36c49`.** `65d36c49` (parents `328b4cd1` + `a2e6f73b`, tree `528ce350`) merged 09:13:30Z but its Git build `abc78270` failed before deploy (Python `_sqlite3` missing); the portability repair is owned by the Codex `release_recovery_coordinator` and will produce a **new reviewed merge SHA**. Every source citation in this runbook was read at tree `528ce350` (= PR #28 candidate `a2e6f73b`). **Step R (mandatory before any assertion is carried forward):** on receipt of the repaired triple, read `git diff 528ce350 <SHA_R>^{tree} -- src contract migrations seed wrangler.toml`. **Any change under `src/`, `contract/`, `migrations/`, `seed/` or `wrangler.toml` re-opens the affected expected-results for re-derivation and re-review before FIRE** (assertions depend not only on the report/policy/dispatch/receipt/auth files but also on `index.ts`, `envelope.ts`, `mcp.ts`, `registry.ts`, `ratelimit.ts`, `report-attestation.ts`, `synthetic-attestation-index.json`, `synthetic-attestation-trust.ts`, `synthetic-report-renderer.ts`, `report-canonical-json.ts`, `wrangler.toml:9` and `seed/*.sql`); only a repair confined to build tooling outside those paths carries all assertions unchanged. Gate: **no DEV mutation until root publishes the repaired deploy triple and issues a separate validation FIRE.** Auditor owns #29/live badge and Design UI — not duplicated here.

**Durable metadata (root, SELECT-only, kitchen `5d5aa6fb` `DEV-METADATA-PREFLIGHT-2026-09-17.md`; not this seat's observation):** `assess_syn_model-project-2026-09` and `assess_syn_earning-trust-2026-01` present, understand/unarchived, 3 selected closed v2 surveys each, **12 responses each**, 0 reports, mara assessment-owner + project-owner. `assess_tavo_collect` present, collect/unarchived, 4 surveys, **2 responses on the archived `survey_tavo` (tpl_validation v1; archived 07:07:34Z, collection closed)** plus three selected/open v2 surveys with zero responses, 0 reports, mara assessment-owner. `assess_melo_understand` present, 1 survey, 2 responses, 0 reports, mara **project-owner only, no assessment grant**. `person_ion` exists (provisioned 0) with **no grant on any of the four targets or their projects on actual DEV** — the local seed line `synthetic.sql:37` (`grant_ion_tavo` viewer) is **not** present on DEV. No seed load is needed or authorized by that observation.

**Root's prospective validation choices (c5711936125), binding on FIRE:** mandatory owner + ungranted `.invalid` dev sign-ins permitted only after the separate FIRE/pre-flight; 2 permanent synthetic report rows; ≤ 50 requests; no private/mixed-source data, no stress; optional step 8 (new invites/grants) **DECLINED**; optional step 9 may use an **already available authorized participant bearer only — no link issuance**; genuine delegated OAuth is a separate browser leg, never relabelled from `st_`; **no current DEV actor write authorization from this preparation order.**

**Root SELECT-only metadata (c5711936125, durable receipt requested):** both named positive assessments exist on DEV with **12 responses each**; `assess_tavo_collect` has **2 archived v1 responses plus empty selected v2 surveys — not zero total responses**; `person_ion` exists but **no grant returned for the four targets**. This plan does not infer fixture eligibility from that metadata; eligibility is observed at pre-flight.

## 0. Source facts the plan rests on (all read at a2e6f73 unless noted)

| Fact | Source |
|---|---|
| Three rows: `cap.report.build` write.effect/danger `POST /v2/assessments/{aid}/reports` roles O,M; `cap.report.get` read `GET /v2/reports/{id}` Vw+; `cap.report.list` read `GET /v2/assessments/{aid}/reports` Vw+; all `public:false`, status `implemented-synthetic-only` | `contract/capabilities.json` |
| Policy: anonymous → `NOT_AUTHENTICATED`; report rows: principal not `user`/`support` → `notVisible("report")` = `NOT_FOUND_OR_NOT_VISIBLE`; grant/role/existence decided by the store's single observation | `src/policy.ts:33-37` |
| Grant predicate: **assessment-scope** grant only (`g.scope_type='assessment'`), min `member` for build/dry_run, `viewer` for get/list; project/workspace grants do **not** qualify; `archived_at IS NULL` | `src/report-capture.ts` B1_CAPTURE_SQL `target` CTE; C2-PLAN §Same-observation |
| Eligibility: capture needs ≥1 response and attestation against `ATTESTATION_TRUST` (indexRoot `d964f816…`, sourcePin `f042cde5…`); authorized-but-ineligible → **held** envelope `{assessment_id, suppressed:true, status:"held", reason:"Report unavailable under the current synthetic reporting policy.", report:null|reports:[], snapshot_version:null, algorithm_version:null, policy_version:"synthetic-current-assessment-asof-query-v1"}` | `src/synthetic-attestation-trust.ts`, `src/handlers/report.ts:15-18`, `src/synthetic-report-store.ts:144-148` |
| dry_run: capture+render only, no write; eligible → `{assessment_id, suppressed:false, status:"ready", report:null}` + impact `{affected:[], irreversible:true, effect:"disclosure", compensating_control:"cap.report.get suppression / access control; a built report is never unsent"}` + `confirm_token` (300 s, intent bound to actor/params/assessment) | `report.ts:23-30`, `dispatch.ts:53-76`, `policy.ts:15` |
| execute: guarded INSERT `ON CONFLICT(assessment_id, report_key) DO NOTHING`; **reports are keyed by assessment + capture/version identity** (`report_key` = sha256 of `{assessmentId, captureDigest, indexRoot, sourcePin, scorer/narrative/policy/outputSchema versions}`), so a changed capture or version tuple yields a new row on the same assessment; unchanged capture → same key → same row returned (convergence); D1/transport/DETERMINISM → `STAGE_CONFLICT` "The report build outcome could not be confirmed. Recheck reports before choosing to retry."; read/list operational failure → `STAGE_CONFLICT` "The report request could not be completed." | `report.ts:19-21,31-33`, store `:150-187` |
| list: page size 5, keyset by id, `next_cursor` = AES-GCM `cur1_…` bound to actor/assessment/version tuple, 300 s; bad/foreign/expired cursor → `INVALID_PARAMS`; valid cursor with lost authority → notVisible | `report.ts:40-46`, `src/report-cursor.ts`, C2-PLAN §Cursor |
| Versions carried: `REPORT_VERSIONS = {scorer:'steve-f042cde-single-assessment-v1', narrative:'steve-f042cde-rule-narrative-v1', policy:'synthetic-current-assessment-asof-query-v1'}`; row stores `source_pin`, `index_root`, `capture_digest`, `payload_sha256` | `src/synthetic-report-renderer.ts:11`, `src/synthetic-report-store.ts` `identity()`/`reportKey()`, `migrations/0008:20` |
| Receipts: build receipt `result_ids = {}` (no report id in receipt); `PARAM_FIELDS` has no report entry → no params in receipt; trace spans key-redacted | `src/receipt.ts:131,147`, `:234-241` |
| Health at a2e6f73 exposes `version/build/commit/build_uuid/release_source` (release identity already on main `bd2f6b27`) | `src/handlers/platform.ts:84-85` |
| DEV actor route: `ENVIRONMENT="dev"` returns `dev_only_code` in-band for **`.invalid` synthetic identities only**; `POST /v2/auth/link` → `POST /v2/auth/session` → `st_` session token; that token is accepted as Bearer on HTTP and on `/mcp` (first-party bearer path) | `platform.ts:20-39`, `src/worker.ts:45-47`, `src/auth.ts:17-24`, `wrangler.toml:9` |
| Delegated OAuth bearer on DEV requires the Cloudflare-Access-guarded consent route with a **verified Access JWT** (real browser, real Access identity) | `src/oauth.ts:9-11,93,121` |
| Synthetic data: `seed/synthetic.sql` = `person_mara` (owner; email `demo.owner@example.invalid`), `person_ion` (viewer on `assess_tavo_collect` only; email hash `synthetic_hash_ion` — **not sign-in-able**), assessments `assess_tavo_prepare/collect`, `assess_melo_understand`; `seed/synthetic-responses.sql` = **34** `assess_syn_*` assessments, 425 responses, each with `person_mara` **assessment-scope owner** grant | `seed/*.sql` |

## 1. Genuine actor routes available from this seat on DEV (no new grants/providers/costs)

| Actor | Route | Status |
|---|---|---|
| **Owner (`person_mara`)** | HTTP email-code sign-in with `demo.owner@example.invalid` → `dev_only_code` → `st_` token; used as Bearer on HTTP **and** on `/mcp` | AVAILABLE (used in the 05:50Z DEV acceptance) |
| **Ungranted signed-in user** | Sign in a second reserved identity, e.g. `report.nobody@example.invalid` (dev route accepts any `.invalid`); no grants anywhere | AVAILABLE — **one controlled write**: creates a `principal` + `session` row on DEV (no grant, no data). Needs root OK in the FIRE. |
| **Viewer / member on a synthetic assessment** | **Source seed ≠ actual DEV.** Local `seed/synthetic.sql:37` grants `person_ion` viewer on `assess_tavo_collect`; root's SELECT on actual DEV returned **no grant** for `person_ion` on any of the four targets or their projects (scoped query; no claim about other scopes). Independently, `person_ion` has no sign-in route (literal `synthetic_hash_ion` email hash). So on DEV there is **neither an eligible viewer/member grant nor an actor route**. Restoring the seed grant or creating another is **DECLINED by root (step 8 removed)**. | GAP (declined) — viewer/member positives are local-suite-only and reported as such. |
| **Support** | No support principal in seed; provisioning is HUMAN-ONLY | NOT AVAILABLE — report as not exercised on DEV. |
| **Participant (negative)** | Needs a live `pt_` bearer. Root: step 9 may use an **already available authorized participant bearer only — no link issuance**. Both earlier DEV links are revoked / collection closed and this seat holds no live `pt_` token. | **GAP** unless root/another seat supplies an already-authorized live `pt_` bearer at FIRE; otherwise covered locally (`synthetic-report-boundary.test.ts`) and recorded as not exercised on DEV. |
| **Delegated OAuth bearer (`userId:grantId:secret`)** | Access-guarded consent; needs a human in a real browser with a Cloudflare Access identity | **NOT AVAILABLE from this seat**. Not fabricated. The `/mcp` leg is exercised with the first-party `st_` bearer, which is a genuine DEV session — distinct from the local fake-JWKS test path. Candidate for the Auditor/captain with the built-in browser if root wants the OAuth leg on DEV. |
| **Anonymous** | No credential | AVAILABLE |

## 2. Pre-FIRE anonymous reads vs post-FIRE pre-flight

**Allowed before FIRE (anonymous read-only capabilities, after the repaired deploy triple is published — note each still writes exactly one `trace` row, `dispatch.ts:97-105`; no receipt, no data row):**

P0. `GET /v2/health` → record `version`, `build`, `commit`, `build_uuid`, `release_source`, `contract`, `source_sha`, `caps`. **Expect `commit` = `<SHA_R>` and `build_uuid` = `<BUILD_R>` from root's repaired triple**; if either differs, STOP — wrong runtime. (1 request)
P1. `GET /v2/capabilities.json` → the three `cap.report.*` rows present with the classes in §0. (1 request)

**After explicit validation FIRE only (P2 is a write — a dev sign-in creates `login_code`/`principal`/`session`/receipt rows):**

P2. Sign in `demo.owner@example.invalid` (dev code) → `GET /v2/me` → `principal.kind:"user"`, grants include assessment-scope `owner` on both positive targets and `assess_tavo_collect`, project-only on `assess_melo_understand` (matches the metadata receipt). If the positive-target grants are absent → **GAP S1: STOP — preparation gap**; missing fixtures are never permission for a seed load or replay. (3 requests)
P3. `read cap.assessment.get {id:"assess_syn_model-project-2026-09"}` → 200. (1)
P4. `read cap.report.list {aid:"assess_syn_model-project-2026-09"}` → **expect** `{suppressed:false, reports:[], next_cursor:null}` — or `held` (DEV response content differs from the attested set, **or** a global `integrity` failure from orphaned response rows anywhere in the DB, `report-capture.ts:22-30,78` → **GAP S2**, STOP before any build). No `synthetic_report` write. (1)
P5. 0008 is proven by P4 returning a typed envelope rather than `STAGE_CONFLICT "could not be completed"`. (0)

## 3. Execution steps (FIRE only) — chosen assessments

Positive target: **`assess_syn_model-project-2026-09`** (single-cycle project, one report expected). Second positive for list ordering: **`assess_syn_earning-trust-2026-01`**. Held target: **`assess_tavo_collect`** (mara owner at assessment scope). **Corrected reading (v4):** the two DEV responses are on the archived `survey_tavo`, template `tpl_validation` **v1**, and that survey's own selected template is also v1 — so they are **not** version-mismatched, and the members CTE (`report-capture.ts:31-39`) does **not** filter archived survey rows, so they are expected to enter the capture with non-NULL fragments. Eligibility then rests on attestation against `ATTESTATION_TRUST` (`attestCapture` → `HELD` on any refusal, `report-capture.ts:170-177`); Tavo is not one of the 34 attested synthetic assessments, so the source expectation is **held via attestation refusal**, not via an empty capture. This is a source expectation only: **the runtime outcome decides and is recorded as observed**, and a `ready` on Tavo is a STOP-and-report finding. The earlier "zero responses" and "version-mismatch" explanations are withdrawn.

Every step is run on **both faces**: HTTP twin and `/mcp` `tools/call` with the same `st_` bearer; envelopes must be identical modulo transport (HTTP status + `retry-after` header vs JSON-RPC result). Record `trace_id` per step; never record tokens, codes, or cursors in receipts.

| # | Step | Expected (HTTP / MCP) | Writes |
|---|---|---|---|
| 1 | anonymous `GET /v2/reports/rep_x` and `POST …/assess_syn_model-project-2026-09/reports` (**HTTP only**) | `401 NOT_AUTHENTICATED` envelope (docs pointer `cap.auth.request_link`); anonymous HTTP metered by `RL_HTTP_ANON` — one call each, no flood. **MCP leg exempt:** `/mcp` has no anonymous path — a tokenless POST gets transport `401` + `WWW-Authenticate` from the OAuth provider (`worker.ts:95-98,108-125`), no envelope | trace rows only |
| 2 | owner `danger cap.report.build {aid}` mode `dry_run` | `ok`, `status:"ready"`, `report:null`, impact exactly as §0, `confirm_token` + `expires_in:300`; **no** report id | none (dry-run mints no receipt, writes no row) |
| 3 | owner `execute` without token | `CONFIRM_REQUIRED` | none |
| 4 | owner `execute` with token from 2 (within 300 s) | `ok`, `report:{id, created_at, payload}`; payload carries `REPORT_VERSIONS` values and no raw answers beyond the synthetic scored content; wire receipt `{id, actor, scope:{type:"assessment",id:aid}, class:"write.effect", inverse:"none", compensating_control, mode:"execute", trace_id, at}` and **no** `undo_token`. (`result_ids:{}` / no params is source-verified at `receipt.ts:131,147`, not wire-observable — do not claim it as observed.) | **1 row** `synthetic_report` (permanent: UPDATE/DELETE triggers `0008:23-26`) + 1 receipt + 1 trace |
| 5 | owner `read cap.report.get {id}` from 4 | identical `payload`, same `created_at`; `payload_sha256` consistency checked by re-hashing the canonical payload locally against the store's stored hash is not exposed — accept equality of payload bytes across get/build instead | none |
| 6 | owner `read cap.report.list {aid}` | `reports:[{id,created_at}]` (one), `next_cursor:null` — positive pagination is **unexercised under unchanged fixtures and the two-row bound**, not impossible by contract (a changed capture or version tuple would add rows) | trace |
| 7 | owner **re-execute** (fresh dry_run → execute) same aid | converges: same `id` as 4, no second row (list still one) — "reopen" | none (INSERT … DO NOTHING) |
| 8 | **REMOVED — declined by root (no new invites/grants).** Viewer/member positives remain local-suite-only. | — | none |
| 9 *(conditional)* | **only if** an already-authorized live `pt_` participant bearer is supplied at FIRE (no link issuance by anyone under this plan): call `get`/`list`/`build dry_run` with it | all three → `NOT_FOUND_OR_NOT_VISIBLE` (policy branch, participant) | trace rows only |
| 10 | owner `build dry_run {aid:"assess_tavo_collect"}` | **held** envelope expected (authorized; the archived-survey v1 responses enter the capture, `report-capture.ts:31-39`; attestation against the 34-assessment index refuses, `:170-177`) — **runtime outcome decides**; impact still attached; `list` → held with `reports:[]`. **Interpretation guard:** the `integrity` CTE is global, not target-scoped (`report-capture.ts:22-30,78`) — if P4/step 2 on a *positive* target is also held, suspect a global integrity failure (orphaned response rows anywhere on DEV) = **GAP S2**, not Tavo-style per-assessment ineligibility; STOP and report | trace |
| 11 | owner `list {aid:"assess_melo_understand"}` and `build dry_run` | `NOT_FOUND_OR_NOT_VISIBLE` (project-scope grant does not qualify) | none |
| 12 | ungranted user (`report.nobody@example.invalid`) `list`/`get(id from 4)`/`build dry_run` on the positive aid | all `NOT_FOUND_OR_NOT_VISIBLE` — `get` on a real id must hide existence | sign-in writes `login_code` + `principal` + `session` + 2 auth receipts (`request_link`, `consume_link`) + traces |
| 13 | owner `list {aid, cursor:"cur1_AAAA"}` (malformed) and a cursor minted for a different actor (from 12 cannot mint one — use a syntactically valid but tampered copy of any `cur1_` seen; if none seen because `next_cursor` is null, test malformed only) | `INVALID_PARAMS` | none |
| 14 | owner second positive `assess_syn_earning-trust-2026-01`: dry_run → execute → list | second report on a different aid; `list` per aid still one row each; confirms keying by assessment | 1 row |
| 15 | wrong tool: MCP `write cap.report.build {aid}` | `WRONG_TOOL_FOR_CLASS` (HTTP 400 on the twin; `dispatch.ts:42-44`). Note: `GET /v2/assessments/{aid}/reports` is **`cap.report.list`'s twin** and legitimately returns the list — `twin_never_get` is a boot-time invariant (`index.ts:33-34`), not a runtime refusal; no 405 expectation | trace |
| 17 | owner: dry_run on aid A, then `execute` on aid B (`assess_syn_earning-trust-2026-01`) with A's token | `CONFIRM_REQUIRED` (intent mismatch — proves `targetScope` binds the assessment, `policy.ts:15`, `receipt.ts:77`) | trace |
| 18 | owner: `execute` A with the **step-2 token** only after its **observed** age exceeds 300 s (mint clock recorded; checked against `oddkit_time`); no new dry_run | `CONFIRM_EXPIRED` (`dispatch.ts:67-68`; tokens are not consumed by use, `receipt.ts:69-78`) | trace |
| 19 | owner: dry_run on `assess_tavo_collect` (held) still returns a `confirm_token`; `execute` with it **while that token is still valid** (< 300 s observed) | **held** envelope on execute (no row) — pins that a token does not override policy (`report.ts:28-33`) | trace |
| 20 | owner `read cap.report.get {id:"sreport_"+random}` | `NOT_FOUND_OR_NOT_VISIBLE` (rid branch, no matching row) | trace |
| 16 | source/version capture: `GET /v2/health` again; record triple; `cap.ops.trace` on step 4's `trace_id` as owner | health unchanged from P0; trace spans redacted, no payload/answers | none |

Total DEV writes in the mandatory path: **2 `synthetic_report` rows (permanent — UPDATE and DELETE are both trigger-blocked)** + 2 build receipts + one `trace` row per call + per sign-in `login_code`/`principal`/`session`/2 auth receipts (2 sign-ins: owner, ungranted). Step 8 is removed; step 9 adds no rows (bearer must pre-exist).

### 3a. Exact budgeted request schedule (hard ceiling **50**; §4 aligned to 50)

Faces are chosen per step so each of the three `cap.report.*` rows is exercised on both HTTP and `/mcp` at least once without doubling everything (auth, health, capabilities, assessment.get and ops.trace run HTTP-only; anonymous MCP is impossible by design, `worker.ts:108-125`). Confirm tokens carry no nonce — `cfm_` + canonical `{capability, params_hash, actor, scope, revision, exp}` + HMAC (`receipt.ts:61-66`) — so a same-second re-mint of the same intent yields a byte-identical token (expected, not a defect); tokens are **not single-use** (`checkConfirmToken` checks HMAC, `exp` and intent only, `receipt.ts:69-78`), which is exactly why step 18 can reuse the step-2 token after step 4 consumed nothing.

| Phase | Requests | Running |
|---|---:|---:|
| Pre-FIRE P0 health, P1 capabilities (anonymous) | 2 | 2 |
| P2 owner sign-in (link, session) + `/v2/me` | 3 | 5 |
| P3 assessment.get (HTTP) · P4 list (MCP) | 2 | 7 |
| 1 anonymous HTTP: get, build POST | 2 | 9 |
| 2 dry_run positive A: HTTP + MCP | 2 | 11 |
| 3 execute without token: HTTP | 1 | 12 |
| 4 execute A with token (HTTP) | 1 | 13 |
| 5 get A: HTTP + MCP | 2 | 15 |
| 6 list A: HTTP | 1 | 16 |
| 7 re-execute A on MCP face: dry_run + execute (convergence) | 2 | 18 |
| 10 Tavo: dry_run (HTTP) + list (MCP) — dry_run token retained for 19 | 2 | 20 |
| 11 Melo: list (HTTP) + dry_run (MCP) | 2 | 22 |
| 12 ungranted sign-in (link, session) + list (HTTP) + get A (MCP) + dry_run (HTTP) | 5 | 27 |
| 13 malformed cursor list (HTTP) | 1 | 28 |
| 14 positive B: dry_run (MCP) + execute (MCP) + list (HTTP) | 3 | 31 |
| 15 wrong tool `write cap.report.build` (MCP) | 1 | 32 |
| 17 cross-assessment: dry_run A (HTTP) → execute B with A's token (HTTP) | 2 | 34 |
| 19 held-token: execute Tavo with the step-10 token — **while still valid** (observed age < 300 s from its recorded mint clock; reorder right after step 10 if needed) | 1 | 35 |
| 18 expiry: execute A with the step-2 token — **only after its observed age > 300 s** (recorded mint clock vs an `oddkit_time` read; do receipt preparation while waiting; never infer expiry from request order) | 1 | 36 |
| 20 get random `sreport_` id (HTTP) | 1 | 37 |
| 16 health + `cap.ops.trace` on step 4's trace id | 2 | 39 |
| **Mandatory total** | **39** | |
| 9 conditional (pre-existing `pt_` only): get + list + dry_run | ≤3 | ≤42 |
| Retry reserve (transport error only, never a re-execute) | ≤5 | ≤47 |
| Unused ceiling | 3 | 50 |

Anonymous requests: 4 (P0, P1, step 1 ×2) — still "≤ 2 per face"; §4 updated accordingly. If the retry reserve is exhausted, the run STOPs and reports rather than expanding the ceiling; no split is needed for the mandatory path. Steps 17/18/19 reuse tokens minted earlier in the same run; every mint's clock is recorded and token ages are **observed**, never inferred from request order: step 19 runs before the step-10 token's 300 s elapse, step 18 only after the step-2 token's 300 s have elapsed (#14 c5712254782). If any token is consumed by an unexpected success, that step is reported as not exercised rather than re-minted. §3a governs face allocation and supersedes any earlier "every step both faces" wording.

## 4. Disclosure and safety constraints

Synthetic only (`.invalid` identities, `assess_syn_*` data). No real-data assessment exists on DEV; if `/v2/me` shows any grant outside the seed set, STOP and report. No stress: single calls, **≤ 50 requests hard ceiling (39 mandatory + ≤3 conditional + ≤5 retry reserve, §3a)**; anonymous calls ≤ 4 (2 pre-FIRE reads + 2 in step 1). No credentials, codes, cursors, or bearer values in any receipt — receipts carry `trace_id`s, status codes, error codes, report ids and `created_at`. Payload contents are not pasted into #14; the receipt records `payload_sha256`-equivalent (sha256 of the canonical bytes as returned) and the `REPORT_VERSIONS` triple only.

## 5. Precise access gaps (named, not worked around)

- **G1 delegated OAuth on DEV**: Access-guarded consent needs a real Access identity in a browser; this seat has none. Owner: captain/Auditor with the built-in browser if root wants the OAuth leg; otherwise recorded as "not exercised on DEV; local fake-JWKS suite only".
- **G2 viewer/member/support actors**: two distinct gaps — no eligible viewer/member grant exists on either positive target, and the one *source-seed* viewer (`person_ion` on `assess_tavo_collect`, `seed/synthetic.sql:37` — **not present on actual DEV** per root's SELECT) has no sign-in route (literal `synthetic_hash_ion` email hash). Invites to create one are **declined by root** (step 8 removed). Support: not reachable (HUMAN-ONLY).
- **G3 participant negative**: conditional on an already-authorized live `pt_` bearer supplied at FIRE; **no link issuance under this plan** (step 9 conditional).
- **S1 fixture presence**: root's metadata receipt shows both positive targets, Tavo and Melo present with the stated counts and grants; P2–P4 re-confirm after FIRE. If anything is absent at that point, **STOP — preparation gap**; no seed load or replay is needed, implied, or authorized by this plan.
- **S2 DEV capture parity with attestation**: P4 held-vs-ready reveals it read-only before any write.
- **Cursor traversal**: positive pagination unexercised under this plan's unchanged fixtures and two-row bound (keyed by assessment + capture/version identity; more rows are possible by contract); negatives only.
- **Archived assessment** (`archived_at IS NULL` in `target`, `report-capture.ts:15`): no archived row exists in seed; archiving one is a write outside this plan — named gap, covered locally only.

## 6. Estimate

Pre-flight P0–P5: ~5 min after the deploy triple is published. Mandatory schedule (§3a, 39 requests, no idle wait): ~25 min. Step 9 (if a bearer is supplied): +5 min. Receipt to #14 with trace ids and expected-vs-observed table: +5 min. Total ≈ 35–45 min wall, one Opus worker for execution, one Opus fresh-context reviewer of the receipt; parent stays on claude-fable-5-1.

## 7. Decisions still owed to root before FIRE (updated after c5711936125)

1. The **repaired** deploy triple `<SHA_R>/<BUILD_R>/<WORKER_R>` (new reviewed merge SHA, not 65d36c49) once the Codex `release_recovery_coordinator` lands the `_sqlite3` portability repair; then Step R (runtime-source delta) before any assertion is carried.
2. ~~Metadata receipt~~ — landed (kitchen `5d5aa6fb`), consumed in v4.
3. Whether an already-authorized live `pt_` bearer exists for step 9; if none, step 9 is recorded as not exercised on DEV.
4. Whether the genuine delegated OAuth leg is assigned to a browser-holding seat (separate leg; never relabelled `st_`).
5. The FIRE text itself, which alone authorizes the two dev sign-ins and the two permanent rows.

## 8. Time-receipt correction (v4)

The v3 return (#14 5712146256) said "done ~09:40Z"; that was an inferred finish, not an observed clock. Observed: v3 START 09:27:32Z; the next observed clock after posting was 09:33:46Z (v4 START). No finish time is claimed for v3 beyond "posted before 09:33:46Z". This runbook claims no future timestamps.
