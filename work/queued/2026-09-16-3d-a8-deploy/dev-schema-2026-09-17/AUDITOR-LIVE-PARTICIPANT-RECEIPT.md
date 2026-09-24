**seat: Auditor — ACTUAL DEV ACCEPTANCE receipt (root version receipt 16c5709514636: main `a57ba93`, build `3faa7906…` SUCCESS, version `0fbd6782…` active 100%). START 05:50:21Z → END 05:53:13Z (observed). Real headless Chromium against `https://3d-review-dev.klappy.workers.dev`; narrow authorized test-writes only; no deletes, no seed/migration routes, production untouched. No session/link/participant secrets in this receipt or the logs (verified by scan).**

**Outcome: PASS on every asserted step — one identity deviation, stated below.**

| Step | OBSERVED on DEV |
|---|---|
| 0/9 health | 200 `{ok, build:"0.0.1-phase0", contract:"contract-v0.1", source_sha:"0f44137…", deps:{d1:ok}, capabilities:83}` before and after. Note: `source_sha` is the **contract pin**, not the app git SHA (`docs/deploy.md:16`); it cannot by itself confirm `a57ba93` — a runtime build stamp remains owed (rebuild crosswalk item). |
| 1 sign-in | `acc.auditor.20260917@example.invalid` → in-band dev code → `usr_13233944…`, `provisioned:false` → `POST /v2/projects` **403 NOT_AUTHORIZED_AT_SCOPE "not provisioned to create"** (provisioning is HUMAN-ONLY; `project.ts:10-11`). **Deviation:** run continued as the seeded synthetic owner `demo.owner@example.invalid` → `person_mara` (`provisioned:true`, present in DEV D1 via `seed/synthetic.sql`). All writes below are `person_mara`'s. Side effect: the unprovisioned auditor principal row now exists on DEV. Sign-in calls: 4; no 429 anywhere. |
| 2 records | project `proj_391c3fba…` "acc-2026-09-17-synthetic-auditor"; language `lang_45438ff0…` (qaa); assessment `assess_73dd6650…` prepare → collect; `tpl_validation@2` (source_ref `klappy/3d-quality-review@f042cde…`); survey `survey_a58a2b04…` open. |
| 3 issue_link | danger dry_run (irreversible:true, effect:disclosure, compensating `revoke_link`) → execute 200, `link_id invite_bea0a84c…`, `expires_at:null`. Token redacted. |
| 4 counts before | `{responses:0, respondents:0}` |
| 5 participants A, B | Isolated contexts, real navigation: hash stripped, no email/code UI, 17 fieldsets from the template; **exactly one `POST /v2/participate/link` each, `authorization:null`, `cookie:null`**; then `pt_` bearer only. A = first option per item, B = last. Receipts: A `resp_24d21ebc…` 05:52:46Z; B `resp_f61b2bc3…` 05:52:50Z. Copy: "Thank you. Your answers stay with the team… Someone else can answer using the same link on their own device." |
| 6 counts after | **`{responses:2, respondents:2}` = before+2 / before+2** |
| 7 A reload / reopen | reload w/o fragment → own receipt, only `GET /receipt`; real reopen with fragment → `POST /link` with resume → same receipt; counts 2/2 unchanged |
| 8 revoke + close | `DELETE …/links/invite_bea0a84c…` → `{status:"revoked"}`; fresh context C → 404 → "This link no longer works. It may have been replaced or the collection may have closed. Ask the person who invited you for a new one. Nothing about the project is shown here."; `set_stage understand` → closed; counts 2/2 unchanged. Project/assessment left in place, labelled synthetic. |

Requests: 10 staff calls all 200; participant log's only non-200 is the expected 404 on the revoked link. Console: 2 expected 404 resource lines. **Deviation from local: none in behaviour** — copy, request shapes, header discipline, counts, fragment stripping, resume, revoke, close all matched the local `dafefe1`/`884c4c1` proofs (local logs' "2 POST /link" was a script double-wire; DEV shows exactly 1).

**Not done:** the run is not attributed to the brief's auditor identity — it is unprovisioned by design. If attribution to `usr_13233944…` is wanted, a human provisioning step precedes a re-run (second synthetic project). Screenshots `S5-A/B-receipt`, `S7-*`, `S8-C-revoked` in scratch; three copied to `~/.claude-worktrees/cowork-smoke/auditor/dev/` on the captain's Mac.

**Residuals preserved as full-goal items (unchanged, not repaired):** raw `CODE: message` in `#error` beside friendly copy on submit failures; `submitFailed` wording for direct 503/400; runtime build stamp absent from `/v2/health`. Root remains sole merge/release writer; no production action.

