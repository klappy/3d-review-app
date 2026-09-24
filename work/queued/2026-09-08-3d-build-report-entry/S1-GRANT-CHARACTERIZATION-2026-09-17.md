# Characterization — the 18 UUID-form assessment-owner grants on `person_mara` (DEV)

Seat: Auth (cos door), session `claude-opus-5`. START 2026-09-17T10:22Z; corrected after independent review 10:38Z; **provider results folded 10:47:35Z (§7 — supersedes the open items in §3)** (all observed). Parallel gap closure for S1 (#14 c5712703486). **Zero DEV requests spent: 49/50 and 2 rows preserved, 1 request still unspent.** No actor writes, no report writes, no grant created/changed/revoked/deleted, no seed, no budget reset.

**Revision note:** an independent Opus reviewer returned CHANGES REQUIRED on v1 and all 11 corrections are applied here. Two were substantive and are called out where they land: v1 asserted that no real-world identity could have created these (false — §1), and v1's SQL would have over-collected 12 seeded assessments and silently truncated the result set (§4). Both were caught before anything was handed to root or acted on.

## 0. Capability gap, stated first

**I cannot execute the SELECT-only provider read myself.** Root's metadata receipt (kitchen `5d5aa6fb`) was produced through a connector's D1 query endpoint bound to account `b03e6ea2…` / DEV D1 `5d4cc260-a7b1-47cc-b03d-ed4f60d324c3`. **No such connector and no Cloudflare/D1 tool exists in this session's tool set** (searched). The only DEV read path available to this seat is the app's own HTTP/MCP API, which would spend the preserved budget — root forbade that, correctly.

So this document is what can be established **without any query**: from the deployed source at `25a80fa2`, the pinned attestation artifact, the seed files, and existing receipts. §2 bounds the actual risk structurally. §4 hands root corrected SQL to close the residue on its own connector.

## 1. Provenance: app-created shape, but the creating identity is NOT established

### What is structurally established

| Fact | Source |
|---|---|
| `newId(prefix)` returns `` `${prefix}_${crypto.randomUUID()}` `` — a **dashed** UUID; `assess_` + 36 = **43 chars exactly** | `src/handlers/common.ts:18-20` |
| `cap.assessment.create` mints its id with `newId("assess")` | `src/handlers/assessment.ts:23` |
| The other id helper strips dashes and truncates to 20 chars, so it cannot produce the observed shape | `src/handlers/types.ts:48` |
| Seed assessment ids (37 total, both files, exhaustive) are human-readable; **none has length 43** and none is UUID-form | `seed/synthetic.sql:15-18`; `seed/synthetic-responses.sql` |
| `create` inserts the assessment **and** `INSERT INTO "grant" … (ctx.principal.id, 'assessment', id, 'owner')` in one D1 batch | `src/handlers/assessment.ts:27-30` |
| The only other runtime path that inserts `assessment` rows is the non-capability dev route `POST /v2/ops/seed/synthetic`, which replays `seed/synthetic-responses.sql` and can emit **only fixed `assess_syn_*` ids** | `src/index.ts:148-159` |

**Conclusion that holds:** a dashed-UUID assessment id can only have come from `cap.assessment.create`. These rows were created **through the authenticated API**, not by seed and not out-of-band.

### What v1 got wrong — two corrections

**(a) The creating identity is not bounded to synthetic identities.** The email-code route accepts only reserved `.invalid` identities and fails closed unless `ENVIRONMENT === "dev"` (`platform.ts:29,31,32`). But it is **not the only sign-in route**: `GET /v2/auth/access` verifies a Cloudflare Access JWT, does `INSERT OR IGNORE INTO principal` for whatever email it carries, and mints a first-class `user` (or `support`) session — **no `.invalid` test, no environment gate** (`src/index.ts:123-138`; `src/access.ts:38-44`). Access is configured for dev (`wrangler.toml:9-12`: `ENVIRONMENT="dev"` alongside `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD`), which my own pre-FIRE probe confirmed live — `GET /v2/auth/access` → 302 to `klappy.cloudflareaccess.com`. **So a real-world Access-verified human can hold a session on the shared DEV database.** v1's claim "no real-world identity can have created these" is withdrawn. This does not change §2 at all, but it means provenance is **not** structurally benign; `created_by` (SQL statement 2) is what settles it.

**(b) "18 grants = 18 assessments created by `person_mara`" is not established.** Two further statements insert assessment-scope grants: `cap.grant.accept` (role may be `owner`) and `cap.grant.transfer_owner`, which inserts `'owner'` for the target unconditionally (`src/handlers/grant.ts:70-72,122-123`). `transfer_owner` needs only that the caller be owner at that scope and that the target principal exist — and `person_mara` is a publicly committed principal id (`seed/synthetic.sql:5`). So a third party could attach `owner` on `person_mara` to an assessment **it** created. The honest statement: 18 assessment-scope `owner` grants are **consistent with** 18 API-created assessments, and the UUID-form project/workspace grants root also saw have the same likely cause (each prior run created its own project/language first; `project.create`/`workspace.create` both require `provisioned=1`, and `person_mara` is the only provisioned seeded principal — `project.ts:9-18`, `workspace.ts:14-23`, `seed/synthetic.sql:5`). But `created_by` is unproven.

**Consistent with recorded history** (context, not evidence): the 05:50–05:53Z first-increment DEV acceptance did "fresh project → language → assessment" (`claude/2026-09-16-3d-audit-ledger.md`), as did the browser proofs and UI runs, each signed in as the shared demo owner. Accumulated test artifacts of prior authorized work in a shared sandbox remain the most likely explanation — now stated as likelihood, not structure.

## 2. Risk bound: the report surface cannot emit anything from them

This is the decisive section. It needs no query, and the reviewer independently closed the three holes it could have had.

| Fact | Source |
|---|---|
| The pinned attestation artifact contains **zero** dashed-UUID tokens; **34** distinct `assess_syn_*` assessment ids; **425** response entries (asserted as an invariant in code) | `src/synthetic-attestation-index.json`; `src/report-attestation.ts:78` |
| `attestCapture` returns `IDENTITY_MISMATCH` for any response id absent from the index, or any metadata/answers/template digest mismatch | `src/report-attestation.ts:99,102` |
| Every non-eligible attestation collapses to a single undifferentiated `HELD` | `src/report-capture.ts:171-177` |
| `HELD` → the exact held envelope; the eligibility marker exposes only `{assessment_id, eligible, policy_version}` | `src/handlers/report.ts:15-18`; `src/synthetic-report-store.ts:40,45,143-149` |
| Held returns **before** `commitMaterialized`, so no row is written even with a valid confirm token — observed live at step 39 | `store:150-153`; `RECEIPT-dev-acceptance-25a80fa2.md` step 39 |
| Runtime responses carry `resp_<uuid>` ids, absent from the index by construction | `src/handlers/response.ts:89` |

**Therefore:** `cap.report.build` is *authorized* on all 18 (assessment-scope `owner` satisfies `report-capture.ts:18-21`) but **permanently ineligible**. Any dry_run or execute returns held, writes no row, and discloses nothing beyond the assessment id the caller supplied.

Three closure checks, verified independently by the reviewer against source:

- **Zero-response assessment** cannot produce a report — triple-guarded: SQL requires `response_count BETWEEN 1 AND 425` else `capture_json` is NULL (`report-capture.ts:78`), `decodePackedCapture` refuses `responses.length < 1` (`:142`), and `snapshot` refuses an empty list (`report-attestation.ts:30`).
- **No `report_key` collision across assessments** — `identity()` binds `assessmentId` into the key preimage (`store:63-67`) and the table is `UNIQUE(assessment_id, report_key)` (`0008:20`).
- **`cap.report.get` on a known report id can never return another assessment's data** — the target CTE derives from `synthetic_report.assessment_id` and still requires a grant at that assessment (`report-capture.ts:99-101,18-21`); `readMaterialized` re-checks `row.assessment_id` and `validateStored` recomputes the key over it (`store:193-196,113-120`).
- **No mirror risk** — all 34 indexed `assess_syn_*` ids carry a `person_mara` assessment-scope owner grant; the only other seeded principal holds `viewer` on `assess_tavo_collect`, which is not in the index (`seed/synthetic-responses.sql`; `seed/synthetic.sql:37`).

**The report surface is a closed door on the 18, not a risk.**

### Residual non-report surface (corrected and extended)

A signed-in `person_mara` already had, before and after this work: `cap.assessment.get`/`list` (which return the free-text `name`), and `cap.survey.get_status`, which returns **unsuppressed raw `responses`/`respondents` counts** at viewer with no threshold applied (`survey.ts:69-73`). `cap.response.list` is always `{suppressed:true, status:"held"}` (`response.ts:122-128` — v1 mis-cited `:111`). `cap.ops.trace` is actor-scoped and key-redacted (`platform.ts:96-100`; `receipt.ts:234`). `cap.assessment.delete` exists (`assessment.ts:96`), so housekeeping is executable. Also unenumerated by v1: `POST /v2/ops/seed/synthetic` is a non-capability, un-receipted write route available to **any** signed-in principal (`index.ts:148-159`) — idempotent and incapable of minting UUID-form ids, so no threat to §1's shape conclusion, but it belongs on the record.

**Consequence worth stating plainly:** §3 items 2 and 3 below are **budget-blocked, not capability-blocked** — one authenticated API call each would answer them. §4's `length(name)` restraint is therefore more conservative than the caller's own standing authority. That is a deliberate choice, not a protection claim.

## 3. What remained unproven before the provider read (see §7 for what the queries settled)

1. The 18 ids, names, `created_at`, **`created_by`**, `project_id`, `archived_at` — never captured (the executor recorded count and form only; `/v2/me` output was not persisted).
2. Whether any of the 18 holds response rows, and how many.
3. Whether any assessment `name` contains non-synthetic text — upgraded in severity by §1(a): with a real Access identity able to hold a DEV session, a careless label could carry real content rather than only sloppy synthetic text.
4. Whether any of the 18 sits inside a `proj_syn_*` project rather than a runtime-created one — the one item with **demo consequence** (§5).
5. Whether `person_mara` holds grants outside this pattern. Root's earlier SELECT was scoped to the four targets and disclaimed completeness; nothing since has closed that.

## 4. Corrected narrow SQL for root's connector (SELECT-only, no content, no personal fields)

**v1's `GLOB 'assess_*-*-*-*-*'` was wrong and is replaced.** It requires only four hyphens after the prefix and therefore matched **12 real seeded assessments** (`assess_syn_loses-a-translator-*` ×5, `assess_syn_trust-outvoted-expert-*` ×5, `assess_syn_strong-team-unconvinced-community-2026-09`, `assess_syn_under-resourced-loved-2026-09`). It would have reported `uuid_form = 30`, double-counted those 12 as seed-form too, and truncated statement 2 at `LIMIT 25` while root believed the set complete. The clean discriminator, verified against all 37 seed ids: **`assess_` + a dashed UUID is exactly 43 characters and no seed id has length 43.**

```sql
-- 1. Grant shape only. Expect 35 seed-form (34 assess_syn_* + assess_tavo_collect)
--    + 18 UUID-form = 53 at assessment scope, per receipt line 23.
SELECT scope_type, role, COUNT(*) AS n,
       SUM(CASE WHEN length(scope_id) = 43 AND scope_id NOT LIKE 'assess_syn_%' THEN 1 ELSE 0 END) AS uuid_form,
       SUM(CASE WHEN length(scope_id) <> 43 THEN 1 ELSE 0 END) AS other_form
FROM "grant" WHERE principal_id = 'person_mara' GROUP BY scope_type, role;

-- 2. The 18 themselves: identity and lifecycle, no content. created_by settles §1(a)/(b).
SELECT a.id, a.project_id, a.stage, a.created_at, a.created_by, a.archived_at, length(a.name) AS name_len
FROM assessment a
JOIN "grant" g ON g.scope_type = 'assessment' AND g.scope_id = a.id AND g.principal_id = 'person_mara'
WHERE length(a.id) = 43 AND a.id NOT LIKE 'assess_syn_%'
ORDER BY a.created_at LIMIT 60;

-- 3. Response counts, zero-rows preserved (v1 inner-joined and would have hidden
--    any of the 18 that has no survey row — exactly what item 2 asks).
SELECT a.id, COUNT(r.id) AS responses, COUNT(DISTINCT r.respondent_id) AS respondents
FROM assessment a
LEFT JOIN assessment_survey s ON s.assessment_id = a.id
LEFT JOIN response r ON r.assessment_survey_id = s.id
WHERE length(a.id) = 43 AND a.id NOT LIKE 'assess_syn_%'
GROUP BY a.id LIMIT 60;

-- 4. Demo-scope check: do the two demo projects contain anything beyond their seeded assessments?
SELECT project_id, COUNT(*) AS assessments,
       SUM(CASE WHEN length(id) = 43 AND id NOT LIKE 'assess_syn_%' THEN 1 ELSE 0 END) AS uuid_form
FROM assessment
WHERE project_id IN ('proj_syn_model-project','proj_syn_earning-trust') GROUP BY project_id;
```

`length(name)` in statement 2 tests for an odd label without pulling it. If a row warrants it, selecting that single `name` is root's follow-up decision; I do not request it pre-emptively (noting §2: the caller could already read it via `cap.assessment.get`).

## 5. Exact safe demo identity and target scope

**Identity:** `person_mara` via `demo.owner@example.invalid`, dev email-code → `st_` session (valid on HTTP and `/mcp`). No other actor is needed and no domain write is required.

**Targets — exactly two, both already built and trigger-immutable:**

| Assessment | Report id | Built | Payload digest (comparison token) |
|---|---|---|---|
| `assess_syn_model-project-2026-09` | `sreport_276af278-af1b-4f3c-8044-e3af83d88a34` | 09:57:55.976Z | `278ec8a3…9b0a`, 4213 B |
| `assess_syn_earning-trust-2026-01` | `sreport_2c3afc17-593f-4bfc-a01d-16935bfaec21` | 09:58:06.989Z | `b24878af…7b57`, 4460 B |

Both rows are UPDATE/DELETE trigger-blocked (`migrations/0008:23-26`), so the demo needs **no domain write** — `cap.report.get` / `cap.report.list` suffice. (Not "pure read": every dispatched request appends a `trace` row, `receipt.ts:220-227`, `dispatch.ts:97`.) Nothing needs re-proving from the preserved acceptance budget; any demo-time requests are the demo's own, not that budget's.

**One concrete demo hazard, and the mitigation.** `/v2/me` returns **every** grant the principal holds, unscoped (`platform.ts:72-77`) — all 53+ assessment plus project and workspace rows. `cap.assessment.list` returns, for a given project, every assessment the caller holds an **assessment-scope** grant on (`assessment.ts:33-38`). So any demo screen enumerating grants, workspaces, or projects will put the 18 uncharacterised test assessments and UUID-form projects **on screen**. In preference order:

1. **Deep-link or direct-select** the two named assessments (or land the glass UI straight on the report view). Nothing uncharacterised renders.
2. If a list must be shown, scope it to a **single named project** (`proj_syn_model-project` or `proj_syn_earning-trust`) rather than a workspace or cross-project view — **now observed clean**: statement 4 returned 1 and 5 assessments respectively, **0 UUID-form in each** (§7). This is a snapshot at 10:46:23Z, not a standing guarantee.
3. Avoid any "all my projects / all my assessments" affordance during the demo.

This is a presentation-scope observation about what the API returns, offered so the demo path can be chosen deliberately. Design owns the UI; this is not a Design instruction and not a contract change.

## 6. Disposition

- **S1 correction accepted and recorded:** the packet STOP was met and execution continued; root's earlier "no STOP" paraphrase is superseded by this and by #14 c5712703486. No re-litigation.
- **Provenance: app-created shape confirmed; creating identity unproven.** Most likely accumulated test artifacts of prior authorized DEV runs, but a real Access-verified identity can hold a DEV session and `transfer_owner` can attach `owner` on `person_mara` to another principal's assessment. `created_by` decides.
- **Risk to the reporting surface: none reachable.** Authorized but permanently ineligible; held before any write; no zero-response, key-collision, or cross-assessment read path.
- **Write-authority caution: KEPT, narrowed only in its report clause.** v1 proposed narrowing it to "housekeeping and presentation, not authorization"; the reviewer rejected that and I accept the rejection. The report surface needs no further gate (§2 closes it). But §1(a) removes the structural benignity the narrowing leaned on, and `POST /v2/ops/seed/synthetic` is an un-receipted write route open to any signed-in principal — so "characterise before extending write authority on this principal" still does real work. The concrete growth cap remains sensible: no new assessment-creating DEV runs as `person_mara` until the set is enumerated. `cap.assessment.delete` exists if root later wants the pile cleaned.
- **Still owed by someone holding the connector:** the four corrected statements in §4. I will consume the result and fold it in; I will not re-run or duplicate root's queries.


## 7. Provider results folded (root's delegated read, #14 c5713079848, kitchen receipt)

Executed by the release-recovery author at root's delegation: START 10:44:51Z, complete 10:46:23Z, the four §4 statements verbatim as one provider request against DEV D1 `5d4cc260…`. All four `success`, each `changes 0 / changed_db false / rows_written 0`; `rows_read` 203 / 125 / 87 / 10. **Zero app requests, zero DB writes.** This seat ran nothing and repeats nothing.

### What the queries settled

| Question (§3) | Result | Consequence |
|---|---|---|
| Grant totals | **53 assessment** (18 UUID-form / 35 other-form), **39 project**, **9 workspace** owner | My §4 statement 1 prediction of 53 at assessment scope (35 + 18) is **confirmed exactly**. The discriminator worked as intended at assessment scope. |
| §3.1 `created_by` on the 18 | **All 18 are `created_by = person_mara`**, spanning **2026-09-16T22:37:16.335Z → 2026-09-17T07:42:22.452Z** | The grants are explained as **create-time auto-grants** (`assessment.ts:27-30`): mara's own sessions created these assessments. **§1(b) is resolved as to the grants' existence** — `cap.grant.transfer_owner` / `accept` are no longer *needed* to explain them. They are **not excluded as having also occurred**: both upsert the same `(principal_id, scope_type, scope_id)` row (`grant.ts:71-72,122-123`) and `step_down` can demote a creator (`:124`), so an interval in which another principal held owner would leave no distinct row. That bears on *past* disclosure, not present reachability, and it is testable — the upsert updates only `role`, so `grant.created_at` survives; comparing `g.created_at` with `a.created_at` would show whether each grant is the create-time row. **§1(a) is NOT resolved:** `created_by` names a *stored principal*, not an operator; it cannot distinguish which seat, tool, or human held that session. Per root's instruction, **no benignity is inferred from the creator.** |
| §3.2 response rows | **6 rows across 4 of the 18**: `assess_18390c0c-…` (2), `assess_3c4b7669-…` (1), `assess_73dd6650-…` (2), `assess_76205e34-…` (1); response count = distinct-respondent count *within* each assessment | Content unexamined by design. No global distinctness and no synthetic-content claim is made or implied. The other 14 hold zero response rows. **Materially different from the zero-response case accepted in §2:** `response_count` 1–2 is **inside** the valid range (`report-capture.ts:78`), and `decodePackedCapture`'s `<1` refusal and `snapshot`'s empty-list refusal also pass. For these 4 the closure is **single-control** — index membership at `report-attestation.ts:99` (`entries.get('resp_<uuid>')` → `IDENTITY_MISMATCH`). `invalid_count`/`integrity` do **not** contribute: a genuine participant submit satisfies the fragment predicate (`response.ts:94` binds the survey's own template/version), and `integrity` is a global consistency check with no target filter. |
| §3.3 names | Not selected (`length(name)` only) | Deliberately unresolved; still root's follow-up decision. |
| §3.4 demo projects | `proj_syn_model-project`: 1 assessment, **0 UUID-form**. `proj_syn_earning-trust`: 5 assessments, **0 UUID-form** | Demo mitigation 2 is **observed clean** at 10:46:23Z. Snapshot, not a guarantee. |
| §3.5 grants outside the pattern | Assessment scope fully accounted (18 + 35 = 53). **Project/workspace partially accounted — in the direction of presence** | Seed gives `person_mara` exactly **12** project owner grants (`seed/synthetic-responses.sql:169-178` ×10; `seed/synthetic.sql:34-35` ×2) and **1** workspace owner grant (`seed/synthetic.sql:33`). Against 39 / 9 that establishes **≥27 project and ≥8 workspace non-seed owner grants, necessarily UUID-form** (`project.ts:14`, `workspace.ts:17` are the only producers). Open is their exact count and ids, **not their existence**. |

### Retained caveat — the discriminator does not generalize (root's correction, accepted)

`length(scope_id) = 43` is **assessment-specific**: `newId` emits `<prefix>_<36-char dashed uuid>`, so UUID-form ids are `assess_…` = 43, **`proj_…` = 41**, **`ws_…` = 39** (`common.ts:18-20`; `project.ts:14`; `workspace.ts:17`). Statement 1's `other_form` column therefore says **nothing** about whether the 39 project and 9 workspace owner grants include UUID-form rows — and given that each DEV run recorded in `claude/2026-09-16-3d-audit-ledger.md` created its own project (and `project.create`/`workspace.create` require `provisioned=1`, which only `person_mara` holds), **presence is established by seed arithmetic: ≥27 project and ≥8 workspace UUID-form owner grants** (see the §3.5 row). The query below enumerates them; what is open is their count and ids, not whether they exist. Correct discriminators for a separately authorized query, if root wants that scope closed:

```sql
SELECT scope_type, role, COUNT(*) AS n,
       SUM(CASE WHEN scope_type='project'   AND length(scope_id)=41 AND scope_id NOT LIKE 'proj_syn_%' THEN 1 ELSE 0 END) AS proj_uuid_form,
       SUM(CASE WHEN scope_type='workspace' AND length(scope_id)=39 THEN 1 ELSE 0 END) AS ws_uuid_form
FROM "grant" WHERE principal_id = 'person_mara' AND scope_type IN ('project','workspace')
GROUP BY scope_type, role;
```

Note for whoever runs it: `resp_…` ids are also 41 chars, but `grant.scope_id` **cannot** hold one — `CHECK (scope_type IN ('workspace','project','assessment'))` (`migrations/0001_init.sql:86`) and `reqScope` (`common.ts:72-75`). The `scope_type` filter is therefore sufficient; `NOT LIKE 'proj_syn_%'` is redundant (no seed id is 41 chars) and is also incomplete as a seed filter — the seeded projects are the 10 `proj_syn_*` **plus `proj_rill` and `proj_aster`** (`seed/synthetic.sql:10-11`).

Minor discrepancy, recorded not chased: the acceptance executor's 09:56Z `/v2/me` read reported **40** project owner grants; the provider read at 10:46Z reports **39**. Owner grants cannot be revoked or demoted (`grant.ts:104`, `:92`); the only app path that removes a project-scope grant is `cap.project.delete`, which deletes that scope's grants (`project.ts:51-58`). The simplest explanation is one empty-project delete inside the interval — i.e. **a concurrent DEV write while this characterization was being made**. §2 is unaffected (structural). §5 mitigation 2's snapshot and the growth-cap bullet **are** affected: the database is not quiescent.

### Remaining risk, stated precisely

The residue is **data-at-rest provenance of 6 response rows**, not disclosure through the application. Three independent facts bound it:

1. **`answers_json` is returned by no handler.** It appears in `src/handlers/` in exactly two places, both INSERTs (`response.ts:92`, `shared-link.ts:95`). No capability — staff, owner, support or participant — returns response content: `cap.response.list` is an unconditional typed suppression even for owners (`response.ts:122-128`), `cap.results.summary` likewise (`results.ts:6-22`), `cap.response.receipt` returns only `{response_id, submitted_at, …}`, `cap.survey.get_status` returns counts, and no receipt/undo/trace path carries answers (`receipt.ts:148-168,234`). **Its only SELECT anywhere is the report capture CTE** — one SQL text (`report-capture.ts:35,52,55`) executed by five report statements (`synthetic-report-store.ts:77,89,92,95,127`). For the 4 assessments that do hold responses the capture is non-NULL, so those answers are read into worker memory and discarded at attestation; they are never returned.
2. **That sole reader is attestation-gated and closed for all 18** (§2): the pinned index holds only the 425 `resp_syn_*` entries and zero dashed UUIDs, so runtime `resp_<uuid>` rows yield `IDENTITY_MISMATCH` → `HELD` before `commitMaterialized`.
3. Therefore the 6 rows' content **cannot be read out through the app by anyone**, and **cannot enter a report payload**. Reaching it requires direct database access — which is exactly the channel root used, and deliberately did not point at content.

So: **no application-surface exposure of response content exists.** Free text on the assessments themselves is a different matter and is **not** closed: `cap.assessment.get`/`list` return the whole row at viewer — `name`, `purpose`, `period`, `format`, `notes_reflection`, `notes_next_steps` (`migrations/0001_init.sql:43-48`; `assessment.ts:12,36`) — as is the caller-supplied `idempotency_key` on those 6 response rows (`response.ts:68-69,91-95`). (`respondent_id` is system-generated, `participant.ts:41`, so not a residue.) What is unresolved is whether any of that at-rest free text, or the 6 response bodies, contains real human content in a DEV database. `created_by` cannot answer that, and this seat does not infer that it is synthetic.

### Disposition (final from this seat)

- **Report surface: closed.** Authorized-but-permanently-ineligible on all 18; no further gate needed.
- **Application read surface: closed for *response* content.** No capability returns response content; its one reader is attestation-gated. **Assessment free text is NOT closed** — `cap.assessment.get`/`list` return `name`, `purpose`, `period`, `format` and both `notes_*` fields at viewer (`assessment.ts:12,36`).
- **Provenance: NOT established.** `created_by = person_mara` narrows the mechanism (create-time auto-grant by mara sessions in a ~9-hour window) but names a stored principal, not an operator. Benignity is not inferred.
- **Write-authority caution: KEPT** (unchanged from §6) — §1(a) still stands, and `POST /v2/ops/seed/synthetic` remains an un-receipted write route open to any signed-in principal. Growth cap stands: no new assessment-creating DEV runs as `person_mara` until root is satisfied.
- **Open, for root's decision, not this seat's:** (i) project/workspace scope with the corrected discriminators above; (ii) whether to select the 18 assessments' free-text fields (`name`, `purpose`, `notes_*`) and/or characterize the 6 response rows' content — a content read this seat has neither requested nor been authorized to make; (iii) whether the ~9-hour creation window (2026-09-16T22:37Z → 2026-09-17T07:42Z) can be matched against known seat activity, which is a records question for the shared journal, not a query; and (iv) whether each of the 18 owner grants is the create-time row, via `g.id, g.role, g.created_at` against `a.created_at`.
- **Demo: unchanged and safe as scoped in §5**, with mitigation 2 upgraded from "verify" to "observed clean at 10:46:23Z". Per root: source-appropriate project scope may be used **after** actual UI proof — Design PR41 `3e9e38a` (glass / public entry / report path) is under independent review and is not this seat's to disposition.
