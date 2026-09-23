<!-- Review cargo, Auditor seat (native Claude task cse_014QEHd8DrdFiLZzxoef2Su5), persisted 2026-09-17T03:2xZ per root #14 c5707863572. Labels: SPECIFIED = reviewer-ASSESSED as regenerable from cookbook text/data; NOT proof of a clean independent rebuild — no clean full-app rebuild has been performed. Compared pins: app phase-0/walking-skeleton@10f5f44 (117 tracked files; stitch of open PRs +16), cookbook PR #12 @ c627720, PR #18 @ dac8a45, design-system @ cb93cbf. As-built INTERFACE/DDL/path maps are evidence inputs, not authority to encode current shared-link defects or the rejected deployment topology into the cookbook; accepted behavior and captain rulings govern reconciliation before implementation. Clock note: earlier return said "observed 03:12Z" — that was inferred between two observations (02:49:02Z and 03:13:04Z); corrected here. -->
# Rebuildability coverage crosswalk — klappy/3d-review-app vs cookbook

Auditor: fresh-context, read-only. Date: 2026-09-16. Requisite (captain 02:48Z): 100% of the tracked app repository must be reliably rebuildable from a pinned cookbook + explicitly pinned/retrievable dependencies, not by copying the app repo.

**Inputs observed**
- App: `phase-0/walking-skeleton@10f5f44` — `git ls-files` = 117 files. Open-PR stitch (`wtstitch`, branch `stitch`) adds 16 files + deltas to `wrangler.toml`/`package.json` (rows 118–135).
- Cookbook plan PR #12 @ c627720 (`cb12/planning/2026-09-16-parity-build/00…19`, `prd/18-*`, `MASTER-PLAN`, `14-FIXTURE-MANIFEST.json`).
- Cookbook PR #18 @ dac8a45 (`cb18/planning/2026-09-16-reproducible-build/REPROJECTION.md`, `CONTRACTS.md`, `CAPABILITY-CROSSWALK.md`, …).
- Design system (cookbook PR #24/#27) at `pr27work/design-system`.

**Coverage labels.** SPECIFIED = an independent builder could regenerate the file from cookbook text/data (doc cited). PARTIAL = intent present, details missing (stated). UNSPECIFIED = nothing in cb12/cb18/design-system. EXTERNAL-INPUT = secret/env id; noted whether the cookbook declares it. Every tracked file is in the denominator, including `dist/` and docs.

OBSERVED = read from the files named. INFERRED = my judgement; marked where used.

## Specific checks (3a–3h)

| # | Question | Finding (OBSERVED unless marked) |
|---|---|---|
| a | Toolchain pinned? | **No.** `wrangler`, `hono`, `node`, `vitest`, `typescript` versions appear nowhere in cb12/cb18 as build inputs ("hono" grep hits are all the word *honor*; "vitest" appears only in 18-I evidence rows and `prd/experiments/*`). Only pin present: `@cloudflare/workers-oauth-provider` **0.10.3** in `prd/18-D-mcp.md` D-1 and `prd/18-I-testing.md` (as a 6B borrow for app PR #15). `02-ARCHITECTURE` names `@modelcontextprotocol/sdk`, which the app does not use (`src/mcp.ts` hand-rolls JSON-RPC). cb18 `REPROJECTION.md` §"Version and compatibility policy" *requires* "dependency lock hashes, toolchain/runtime versions" in a release baseline, but no baseline exists. App lockfile actually resolves: hono 4.13.8, wrangler 4.133.0, vitest 2.1.9, typescript 5.9.3, workers-types 5.20260916.1, miniflare 5.20260916.0-alpha (imported directly by tests but not a declared devDependency). No `engines` field. |
| b | Migrations 0001–0004 derivable from 03 / REPROJECTION? | **Partially.** `02-ARCHITECTURE` §Data model lists entities (workspace, project, assessment, survey_template, assessment_survey, response, participant, principal, grant, invitation, access_code, receipt, trace, source, import_batch) and says "bend, don't break the July schema.sql" (pinned via 14-FIXTURE-MANIFEST `survey-pipeline/db/SCHEMA.md`). `03` gives roles/scopes/stages. No column-level DDL, indexes, the `grant_` view, or the `login_code` / `participant_session` / `request` / `language` / `session` / `feedback` tables' shapes exist in the cookbook. 0002 escrow columns and 0003 `archived_at` are app-only. 0004's rules (9 variants, source_ref, 111/498, template version binding) are in `14-STEVE-REPO-SYNC`; the CSV→`items_json` mapping is only in `tools/build_pinned_instruments.py`. Migration file names occur in the cookbook only inside `prd/experiments/report-boundary/*.mjs` (which read the app) and `18-B-attestation-design.md` (sha256 of 0004). cb18 `REPROJECTION.md` is a process spec (record types, dependency graph, change algorithm), not a schema. The app's own `INTERFACE.md` is the only document that lists the 0001 tables. |
| c | `contract/capabilities.json` derivable from 04? | **Ids/classes/roles/slices yes; HTTP paths no.** Cookbook 04 @ c627720: 83 `| cap.` rows. App contract: 83 capabilities (`counts.total` 83; read 29 / write.reversible 41 / write.effect 6 / write.dangerous 7; v2.0-bcs 75 / v2.1-oct 8). Id sets match 1:1 (04 also contains the illustrative `cap.x.y`). But the app contract is projected from 04 @ **0f44137**, not c627720, and `counts.paths_inferred` = **37**: 04 elides the HTTP twin on 37 rows, and `tools/gen_contract.py` supplies them via a hard-coded `PATH_FIX` table (21 entries) plus heuristics — those paths exist only in the app. Per-capability params/result schemas are "OWED" (contract/README, contract-manifest `params_schemas`). cb18 `CAPABILITY-CROSSWALK.md` names 157 cap ids, 50 of which (`cap.audit.*`, `cap.jobs.*`, `cap.recommendation.*`, `cap.delegation.*`, …) are not in the app contract, and it lacks 7 app ids (`cap.language.*`, `cap.survey.export_codes`, `cap.grant.revoke_invitation`, `cap.assessment.notes.update`) — the two cookbook PRs disagree on the denominator. |
| d | Seed SQL / fixtures derivable from 14-FIXTURE-MANIFEST + f042cde? | `seed/source/*` (10 CSV + scoring_rubric_draft.md): **yes** — manifest pins git blob shas at f042cde; `rubric_csv.sha256` derivable. `seed/synthetic/answer-sets.json` (425 submissions, 34 cycles): **partial** — app manifest names generator `survey-pipeline/run_synthetic_pipeline.py` @ f042cde, which is **not** in 14-FIXTURE-MANIFEST's file list (persona CSVs and `synthetic/*.py` modules are); no invocation/seed recorded; 18-B-attestation pins its sha256 as evidence only. `seed/synthetic-responses.sql`: ID-mapping rules (resp_syn_+sha256[:20], assess_syn_, survey_syn_) **are** in 18-B-attestation-design §"Source mapping"; generator content app-only. `seed/synthetic.sql`: invented identities (Cedar Workshop, person_mara, demo.owner@example.invalid) app-only. `seed/dev-principals.sql` is a **0-byte tracked file**. **Real data:** none observed — "Laos/Aushi" appear only as prohibitions in READMEs; personas are labelled Synthetic; CON-PRIV-003 honoured. |
| e | wrangler.toml bindings declared in cookbook? | **No.** `d1_databases`, `database_id`, `compatibility_date`, `[assets]`/`run_worker_first`, `[[rules]]`, `env.production`, `routes`/custom domain, `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, `ratelimits`, `kv_namespaces` (stitch) — zero hits in cb12/cb18. `02` says the substrate is "D1 · R2 · KV · Analytics Engine"; the dev app binds **D1 only** (stitch adds KV for OAuth and 4 rate-limit namespaces). External ids in the app that no cookbook doc declares: D1 ids `5d4cc260…`/`2641de99…`, Access AUDs `8a1c3507…`/`58459673…`, KV `05b0c783…`, ratelimit namespace ids 30101–30104, secrets `SESSION_SECRET`/`CODE_ESCROW_SECRET`. cb18 REPROJECTION §9 requires "environment topology and secret references without values" — not yet written (18-H infra PRD is a stub). |
| f | UI specified? | **Not the app's `ui/*`.** `ui/README.md` (app) calls it a "temporary functional UI shell … the Design lane may replace `ui/`"; `ui/style.css`/`index.html` reference no design-system tokens (0 hits). The design system (PR27) specifies a *different* artefact: `ui_kits/3d-review/` (index.html/core.js/caps.js/data.js/instrument.js/kit.css → `standalone.html`, 34–35 routes, 83 caps, `scripts/build-standalone.mjs` byte-identical rebuild, `check-coverage.mjs` 83/83), plus `tokens.css/json`, `ui-states.md`, `copy.md`, `COVERAGE.md`. cb12 `06`/`13` list surfaces and verbs; `prd/18-E-ux.md` and `18-F-ui.md` are stubs. So: a rebuilder gets a specified *mockup* UI, and no spec for the shipped shell's behaviour (participant resume, present.js, visibility.js). INFERRED: the kit is not wired to `/v2` (README: "No build, account, network or backend"). |
| g | CI/deploy/Bugbot specified? | **Not in the cookbook.** Workers Builds trigger ids (`b82be56e…`, `d067de78…`), branch→worker map (`phase-0/walking-skeleton`→`3d-review-dev`, `main`→`3d-review`), build command `npm ci && npm run typecheck && npm test`, path filters, and the GitHub ruleset body live only in app `docs/release.md` + `docs/release/proposed-ruleset.json`. Bugbot is named in cb12 (MASTER-PLAN, 18-B-attestation, PRD) as a *gate* ("real Cursor Bugbot SUCCESS") but `.cursor/BUGBOT.md` content and the Autofix-off requirement come from kitchen HYGIENE 3 (external repo, referenced by AGENTS.md). `07` A8 says only "Worker + D1 + R2 + KV on *.klappy.workers.dev". `prd/18-H-infra.md` is a stub. |
| h | `dist/` tracked? | **Yes** — 4 files (`README.md`, `index.js` 128 KB, `index.js.map` 398 KB, `<sha>-openapi.yaml`), committed in `ffa3111` ("generated at 2026-09-16T21:30:28Z" per its README). `.gitignore` does not exclude it; nothing in the cookbook or app docs asks for it. INFERRED: it is a wrangler build/dry-run output and is regenerable from `src/` + toolchain; tracking it makes the repo carry a non-source artefact whose provenance (wrangler version, build flags) is unrecorded. Recommendation for the coverage ledger: exclude via `.gitignore` or record the exact build command + wrangler version in the cookbook; until then it counts as 4 UNSPECIFIED files. |

## Category summary
### Dev head 10f5f44 — 117 tracked files (n=117)

| category | files | SPECIFIED | PARTIAL | UNSPECIFIED | EXTERNAL-INPUT |
|---|---|---|---|---|---|
| runtime src | 30 | 5 | 24 | 1 | 0 |
| tests | 18 | 2 | 15 | 1 | 0 |
| seed/fixtures | 18 | 12 | 5 | 1 | 0 |
| ui | 12 | 0 | 0 | 12 | 0 |
| docs | 10 | 0 | 4 | 6 | 0 |
| config | 9 | 0 | 4 | 4 | 1 |
| scripts/tools | 9 | 1 | 5 | 3 | 0 |
| dist | 4 | 0 | 0 | 4 | 0 |
| migrations | 4 | 0 | 4 | 0 | 0 |
| contract | 3 | 1 | 2 | 0 | 0 |
| **all** | **117** | **21 (18%)** | **63 (54%)** | **32 (27%)** | **1 (1%)** |
### Dev + files added by open-PR stitch — 133 files (n=133)

| category | files | SPECIFIED | PARTIAL | UNSPECIFIED | EXTERNAL-INPUT |
|---|---|---|---|---|---|
| runtime src | 34 | 6 | 27 | 1 | 0 |
| tests | 24 | 5 | 17 | 2 | 0 |
| seed/fixtures | 20 | 12 | 7 | 1 | 0 |
| docs | 13 | 0 | 5 | 8 | 0 |
| ui | 13 | 0 | 0 | 13 | 0 |
| config | 9 | 0 | 4 | 4 | 1 |
| scripts/tools | 9 | 1 | 5 | 3 | 0 |
| dist | 4 | 0 | 0 | 4 | 0 |
| migrations | 4 | 0 | 4 | 0 | 0 |
| contract | 3 | 1 | 2 | 0 | 0 |
| **all** | **133** | **25 (19%)** | **71 (53%)** | **36 (27%)** | **1 (1%)** |
Notes: `wrangler.toml` is counted PARTIAL (its external ids are flagged in-row); `.dev.vars.example` is the one file counted EXTERNAL-INPUT. UI category excludes `ui/README.md` (docs).

## Top 10 missing ingredients (first things an independent rebuilder hits)

| # | Gap (OBSERVED) | Smallest cookbook addition that closes it |
|---|---|---|
| 1 | **No toolchain/dependency pin.** Node, wrangler, hono, vitest, typescript, workers-types unnamed; only oauth-provider 0.10.3 pinned. | Add `18-H-infra.md §Toolchain` (or a `BUILD-BASELINE.md`): `node` major, `wrangler 4.133.0`, `hono 4.13.8`, `vitest 2.1.9`, `typescript 5.9.3`, `@cloudflare/workers-types 5.20260916.1`, `miniflare` (declare as devDependency), `@cloudflare/workers-oauth-provider 0.10.3`, plus the sha256 of `package-lock.json` at the release SHA. ~15 lines. |
| 2 | **No D1 DDL.** 0001–0004 columns, indexes, `grant_` view, `login_code`/`participant_session`/`request`/`session`/`feedback` tables absent; 02 lists R2/KV/import_batch the app doesn't have. | Fill `prd/18-B-data-and-results.md §4 Interfaces` with the four migration files verbatim (or an `A2-SCHEMA.md` with one table per entity: columns, types, nullability, indexes) and a one-line "migration order 0001→0004". Reconcile 02's entity list (drop/mark R2/KV/import_batch as `v2.1-oct`). |
| 3 | **37 HTTP paths not in 04.** `capabilities.json`/`openapi.yaml` depend on `tools/gen_contract.py PATH_FIX`. | Edit `04-CAPABILITY-MATRIX.md`: write the explicit `METHOD /v2/...` in the HTTP column for the 37 `path_inferred` rows (list obtainable from `capabilities.json` where `http.path_inferred=true`). Then 04 → contract is mechanical. Also re-project app contract from c627720 (currently 0f44137). |
| 4 | **wrangler.toml / environment topology.** Bindings, compatibility_date, assets rules, env.production, routes; external ids undeclared. | `18-H-infra.md §4`: table of bindings per env (`DB` D1 → name; `OAUTH_KV`; `RL_*` limits) and a declared-external-inputs list: `D1 database_id (dev, prod)`, `ACCESS_AUD (dev, prod)`, `ACCESS_TEAM_DOMAIN`, `KV id`, `ratelimit namespace_id ×4`, `SESSION_SECRET`, `CODE_ESCROW_SECRET`, custom domain. Values stay out; names in. ~25 lines. |
| 5 | **Auth mechanism as built is unspecified.** 18-C-auth is a stub; app uses Cloudflare Access one-time-PIN JWT (`src/access.ts`), `dev_only_code`, `.invalid`-only sandbox identities, session/bearer/participant token formats, 300 s confirm TTL. | Write `18-C-auth.md §3/§4` from app `INTERFACE.md` + `src/auth.ts`/`src/access.ts`: token kinds and prefixes, TTLs, cookie name, Access JWT verification inputs, dev-mode rule, participant token binding. |
| 6 | **Handler semantics: params/result schemas OWED.** 24/30 src files PARTIAL because 04 rows give id/class/roles only; 18-A api-contracts is a stub. | Land the "next A1 increment" named in `contract/README.md`: per-capability `params`/`result` JSON schema in `04` (extra column or sidecar `04-SCHEMAS.json`), starting with the 75 `v2.0-bcs` rows. |
| 7 | **Synthetic fixture generation not reproducible from the manifest.** `run_synthetic_pipeline.py` not pinned; no invocation/seed; `synth_answers.py`/`synth_seed_sql.py`/`build_pinned_instruments.py` app-only; `seed/synthetic.sql` names invented. | Add to `14-FIXTURE-MANIFEST.json`: `survey-pipeline/run_synthetic_pipeline.py` blob + exact command line/seed; add a `14-SEED-RECIPE.md` listing the four app tools, their inputs → outputs, expected sha256 of `answer-sets.json` (efc50c5…), `0004` (7280369…), and the fixed demo identities (`ws_cedar`, `person_mara`, `demo.owner@example.invalid`). |
| 8 | **UI shell unspecified; design system specifies a different artefact.** 12–13 `ui/*` files UNSPECIFIED; 18-E/18-F stubs. | Captain decision recorded in `09`: either (a) declare app `ui/` disposable and make `design-system/ui_kits/3d-review` + tokens the rebuild target (then add a wiring spec: which `/v2` calls each route makes), or (b) write `18-F-ui.md §3` for the shell's 6 behaviours (sign-in, project/language/assessment create, code issue/export, participant redeem/submit/resume, results held). |
| 9 | **CI/deploy/branch topology and Bugbot gate live only in app docs / kitchen.** | `18-H-infra.md §5 Deploy`: branch→worker→D1 map, Workers Builds command, path filters, "no seat deploy" rule, required check = literal Cursor Bugbot SUCCESS, ruleset summary. Copy from app `docs/release.md` table (6 lines). |
| 10 | **Build outputs and empty files in the denominator.** `dist/` (4 files) tracked with unrecorded build provenance; `seed/dev-principals.sql` is 0 bytes; `tsconfig.json`, `vitest.config.ts`, `ui/.assetsignore`, `.gitignore` allow-list rule unspecified. | One `18-H §Repo layout` block: tracked-file policy (`dist/` ignored or its build command + wrangler version stated), and the three config files reproduced verbatim (tsconfig 1 line, vitest.config 6 lines, .assetsignore 6 lines, .gitignore 12 lines). Delete or fill `seed/dev-principals.sql`. |

Also noted (not in top 10): cb18 `CAPABILITY-CROSSWALK.md` (157 ids) and cb12 `04` (83 ids) disagree on the capability denominator; `02` names the official MCP SDK while the app hand-rolls JSON-RPC; `prd/18-A`, `18-B-data`, `18-C`, `18-E`, `18-F`, `18-H` are all "stub — not written", so 6 of 9 layer PRDs contribute nothing to rebuildability today.

## Per-file table — dev head 10f5f44 (117 files)

| # | path | category | coverage | cookbook source / what is missing |
|---|---|---|---|---|
| 1 | `.cursor/BUGBOT.md` | config | PARTIAL | Bugbot-SUCCESS gate named in cb12 MASTER-PLAN/18-B/PRD; policy text comes from kitchen HYGIENE 3 (external repo), file content not in cookbook |
| 2 | `.dev.vars.example` | config | EXTERNAL-INPUT (undeclared) | SESSION_SECRET / CODE_ESCROW_SECRET named nowhere in cb12/cb18; cb18 REPROJECTION §9 requires "secret references without values" but none listed |
| 3 | `.gitignore` | config | PARTIAL | cb12 16-CONSTRAINTS CON-PROC-006 (block raw data, .env, secrets); the `*.csv` deny + `!seed/source/rubric_csv/*.csv` allow rule is app-only |
| 4 | `AGENTS.md` | docs | UNSPECIFIED | points at klappy/kitchen HYGIENE (external); no cookbook text |
| 5 | `INTERFACE.md` | docs | UNSPECIFIED | app-only "Phase 0 shared interface" (module layout, Env/Ctx/Handler types, token formats, TTLs). Nothing equivalent in cb12/cb18 — this is the closest thing to a build recipe and it lives in the app |
| 6 | `README.md` | docs | PARTIAL | cb12 MASTER-PLAN code-home + 00-CHARTER intent; text app-only |
| 7 | `contract/README.md` | docs | PARTIAL | rules restated from 04/10/18-D; file app-only |
| 8 | `contract/capabilities.json` | contract | PARTIAL | cb12 04-CAPABILITY-MATRIX §A–J: 83 ids/classes/roles/slices/§K SPECIFIED; 37 of 83 HTTP paths are inferred by app tools/gen_contract.py PATH_FIX (21 explicit) + heuristics, not stated in 04; per-cap params schemas OWED; projected from 04@0f44137 not c627720 |
| 9 | `contract/contract-manifest.json` | contract | SPECIFIED | cb12 MASTER-PLAN "Contract acceptance is per bundle" + 04 sections A–J → bundle ids and freeze rule |
| 10 | `contract/openapi.yaml` | contract | PARTIAL | envelope/ErrorEnvelope/Receipt from cb12 prd/18-D-mcp MCP-REQ-004/005 + 05; 3 security schemes from 02 auth; per-op request/response schemas OWED; 37 inferred paths |
| 11 | `dist/README.md` | dist | UNSPECIFIED | build output (wrangler dry-run 2026-09-16T21:30Z) committed in ffa3111; not mentioned in cookbook |
| 12 | `dist/e8ebc59450295a1ae6e68a6eeabcebd738b98c03-openapi.yaml` | dist | UNSPECIFIED | copy of contract/openapi.yaml with hash name; build artefact |
| 13 | `dist/index.js` | dist | UNSPECIFIED | bundled Worker (128 KB); build artefact, regenerable from src via wrangler |
| 14 | `dist/index.js.map` | dist | UNSPECIFIED | source map; build artefact |
| 15 | `docs/code-escrow-local.md` | docs | UNSPECIFIED | escrow mechanism (AES-GCM, batch export, 300 s confirm) is app-only; cookbook has only CON-PRIV-005 intent |
| 16 | `docs/release.md` | docs | PARTIAL | cb12 MASTER-PLAN "Release correction" + 17-IRREVERSIBILITY IRR-020 give intent; Workers Builds trigger ids, branch→worker map, build command `npm ci && npm run typecheck && npm test` only in this app doc |
| 17 | `docs/release/DEBRIEF.md` | docs | UNSPECIFIED | historical governance debrief; not a rebuild input |
| 18 | `docs/release/proposed-ruleset.json` | docs | UNSPECIFIED | GitHub ruleset body (branch protection, required Cursor Bugbot); not in cookbook |
| 19 | `migrations/0001_init.sql` | migrations | PARTIAL | cb12 02-ARCHITECTURE entity list (17 tables named incl. R2/KV ones app lacks) + cb12 03-DOMAIN-MODEL roles/scopes/stages + July schema.sql pinned via cb12 14-FIXTURE-MANIFEST.json (survey-pipeline/db/SCHEMA.md); no column-level DDL, indexes, view `grant_`, `login_code`/`participant_session`/`request` tables anywhere in cookbook |
| 20 | `migrations/0002_code_escrow.sql` | migrations | PARTIAL | cb12 16-CONSTRAINTS CON-PRIV-005 (codes never returned by issue; export is confirmed effect); columns batch_id/code_ciphertext/code_iv/exported_at app-only |
| 21 | `migrations/0003_language_archive.sql` | migrations | PARTIAL | cb12 04-CAPABILITY-MATRIX §C cap.language.archive/unarchive (PROPOSED rows) + cb12 14-STEVE-REPO-SYNC FIX-07 imply archived_at; DDL not stated |
| 22 | `migrations/0004_pinned_instruments.sql` | migrations | PARTIAL | cb12 14-STEVE-REPO-SYNC (9 variants, 111/498, template must carry source commit/item+option ids/version) + cb12 14-FIXTURE-MANIFEST.json blob pins; cb12 prd/18-B-attestation-design pins this file's sha256 (7280369b…) as evidence but not the CSV→items_json mapping; "version 2 / v1 unchanged" rule app-only |
| 23 | `package-lock.json` | config | UNSPECIFIED | cb18 REPROJECTION requires "dependency lock hashes" in a release baseline; no baseline/lock hash exists in cookbook. Locked: hono 4.13.8, wrangler 4.133.0, vitest 2.1.9, typescript 5.9.3, workers-types 5.20260916.1, miniflare 5.20260916.0-alpha (transitive; tests import it directly) |
| 24 | `package.json` | config | PARTIAL | cb12 02-ARCHITECTURE "Cloudflare Worker (TypeScript)"; hono not named anywhere in cookbook (INTERFACE.md app-only names it); 02 names @modelcontextprotocol/sdk which app does not use; no node/wrangler/vitest pins; npm scripts (dev/test/migrate:local/seed:local/parity) unnamed; HYGIENE 19 version-source rule external |
| 25 | `scenarios/journeys.json` | tests | PARTIAL | cb12 05-NLX (J1–J14) defines J1–J14 + cb12 07-MEAL-PLAN B2 runner; JSON shape (checkpoints, actors) app-only |
| 26 | `scripts/journeys.mjs` | scripts/tools | PARTIAL | cb12 07-MEAL-PLAN B2 "executable J1–J10 × roles" + cb12 prd/18-I-testing "20 checkpoints"; script content app-only |
| 27 | `scripts/local-vertical.mjs` | scripts/tools | UNSPECIFIED | local synthetic HTTP vertical; not in cookbook |
| 28 | `scripts/parity.mjs` | scripts/tools | SPECIFIED | cb12 07-MEAL-PLAN B3 + cb12 10-REPROJECTION-AUDIT mechanics + cb12 prd/18-D-mcp MCP-REQ-013 (normalize id/trace/at, equal receipts per row) |
| 29 | `scripts/pinned-vertical.mjs` | scripts/tools | UNSPECIFIED | not in cookbook |
| 30 | `scripts/smoke.sh` | scripts/tools | UNSPECIFIED | not in cookbook (07 A8 says "cold curl of health + docs" only) |
| 31 | `seed/dev-principals.sql` | seed/fixtures | UNSPECIFIED | 0-byte file (observed); no cookbook reference |
| 32 | `seed/source/README.md` | docs | PARTIAL | rule "read never edited; regenerate from pin" matches cb12 14-STEVE-REPO-SYNC §authority; text app-only |
| 33 | `seed/source/rubric_csv.sha256` | seed/fixtures | SPECIFIED | derivable: sha256 of files pinned by cb12 14-FIXTURE-MANIFEST.json (blob shas) at f042cde |
| 34 | `seed/source/rubric_csv/CrossLens.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 042fccd…@f042cde |
| 35 | `seed/source/rubric_csv/EvidenceQuality.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob b7852e7… |
| 36 | `seed/source/rubric_csv/Items.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 7e9f387…; 111 items |
| 37 | `seed/source/rubric_csv/Options.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 1a38ad1…; 498 options |
| 38 | `seed/source/rubric_csv/README.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob db5c924… |
| 39 | `seed/source/rubric_csv/SubDimensions.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 83a135f… |
| 40 | `seed/source/rubric_csv/Vocab_Maturity.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 462d3da… |
| 41 | `seed/source/rubric_csv/Vocab_Methodology.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 7f0cf8d… |
| 42 | `seed/source/rubric_csv/Vocab_Organization.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 0e4fd74… |
| 43 | `seed/source/rubric_csv/Vocab_Region.csv` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 28db245… |
| 44 | `seed/source/scoring_rubric_draft.md` | seed/fixtures | SPECIFIED | cb12 14-FIXTURE-MANIFEST.json blob 6f2d322… |
| 45 | `seed/synthetic-responses.sql` | seed/fixtures | PARTIAL | cb12 prd/18-B-attestation-design §"Source mapping" gives ID rules (resp_syn_+sha256[:20], assess_syn_, survey_syn_) and 425/34 counts; generator tools/synth_seed_sql.py pinned by sha only; INSERT OR IGNORE + owner-grant policy app-only |
| 46 | `seed/synthetic.sql` | seed/fixtures | PARTIAL | cb12 07-MEAL-PLAN A2 "synthetic fixture seeds pinned to f042cde" + CON-PRIV-003; invented names (Cedar Workshop, Mara/Ion, Rill/Aster) and demo.owner@example.invalid hash app-only; INTERFACE.md (app) describes shape |
| 47 | `seed/synthetic/answer-sets.json` | seed/fixtures | PARTIAL | cb12 14-STEVE-REPO-SYNC FIX-12 "consume pinned persona definitions"; cb12 14-FIXTURE-MANIFEST.json pins personas/*.csv + synthetic/*.py but NOT survey-pipeline/run_synthetic_pipeline.py named by app manifest as generator; cb12 prd/18-B-attestation-design pins sha256 efc50c5… as evidence; no invocation/seed recorded |
| 48 | `seed/synthetic/manifest.json` | seed/fixtures | PARTIAL | cb12 prd/18-B-attestation-design requires exact repo/pin/generator + reads_real_exports=false; pins sha a938ee9…; format app-only |
| 49 | `seed/synthetic/personas.json` | seed/fixtures | PARTIAL | cb12 14-FIXTURE-MANIFEST.json pins survey-pipeline/synthetic/personas/ProjectPersonas.csv etc. (source); JSON projection app-only |
| 50 | `src/access.ts` | runtime src | PARTIAL | cb12 16-CONSTRAINTS CON-ACC-005 / OF-7 "Cloudflare email-code"; Access one-time-PIN JWT verification against ACCESS_TEAM_DOMAIN/ACCESS_AUD app-only; 18-C-auth is a stub |
| 51 | `src/auth.ts` | runtime src | PARTIAL | cb12 02-ARCHITECTURE §Auth (session cookie/bearer/participant token) + cb12 prd/18-D-mcp MCP-REQ-007; 18-C stub; dev_only_code, .invalid-only rule, token formats app-only (INTERFACE.md) |
| 52 | `src/code-escrow.ts` | runtime src | PARTIAL | CON-PRIV-005 intent; crypto, batch, export-once app-only |
| 53 | `src/dispatch.ts` | runtime src | SPECIFIED | cb12 prd/18-D-mcp MCP-REQ-002/003/005/006/010 + cb12 02-ARCHITECTURE classes + CON-ARCH-003 (501 RESERVED_NOT_BUILT) |
| 54 | `src/envelope.ts` | runtime src | SPECIFIED | cb12 prd/18-D-mcp MCP-REQ-004 envelope; all 10 error codes in src appear in cb12 (05/18-D/16) |
| 55 | `src/handlers/assessment.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §D + cb12 03-DOMAIN-MODEL stage semantics; cb12 04-CAPABILITY-MATRIX §rows (id/class/tool/roles/slice) + cb12 03-DOMAIN-MODEL matrix + cb12 05-NLX (J1–J14); per-capability params/result schemas OWED (app contract/README); 18-A/18-B/18-C layer PRDs are stubs |
| 56 | `src/handlers/common.ts` | runtime src | PARTIAL | helpers (sha256, ids); app-only |
| 57 | `src/handlers/docs.ts` | runtime src | PARTIAL | cb12 prd/18-D-mcp MCP-REQ-008/009 (role-aware docs, orientation); B1 docs corpus not built |
| 58 | `src/handlers/errors.ts` | runtime src | SPECIFIED | error code enum; every code named in cb12 05/18-D/16 |
| 59 | `src/handlers/grant.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §F + cb12 03-DOMAIN-MODEL D3 + CON-ACC-002; invitation-email binding app-only; cb12 04-CAPABILITY-MATRIX §rows (id/class/tool/roles/slice) + cb12 03-DOMAIN-MODEL matrix + cb12 05-NLX (J1–J14); per-capability params/result schemas OWED (app contract/README); 18-A/18-B/18-C layer PRDs are stubs |
| 60 | `src/handlers/index.ts` | runtime src | PARTIAL | handler map keyed by cap id per 02/10; app-only |
| 61 | `src/handlers/language.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §C cap.language.* rows marked PROPOSED + cb12 14-STEVE-REPO-SYNC FIX-07 |
| 62 | `src/handlers/participant.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §A/G + 02 participants; cb12 04-CAPABILITY-MATRIX §rows (id/class/tool/roles/slice) + cb12 03-DOMAIN-MODEL matrix + cb12 05-NLX (J1–J14); per-capability params/result schemas OWED (app contract/README); 18-A/18-B/18-C layer PRDs are stubs |
| 63 | `src/handlers/platform.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §J (ops/telemetry/feedback); Analytics Engine per 02 not implemented |
| 64 | `src/handlers/project.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §C + cb12 03-DOMAIN-MODEL; cb12 04-CAPABILITY-MATRIX §rows (id/class/tool/roles/slice) + cb12 03-DOMAIN-MODEL matrix + cb12 05-NLX (J1–J14); per-capability params/result schemas OWED (app contract/README); 18-A/18-B/18-C layer PRDs are stubs |
| 65 | `src/handlers/request.ts` | runtime src | PARTIAL | cb12 03-DOMAIN-MODEL D1 "request route for others"; cb12 04-CAPABILITY-MATRIX §rows (id/class/tool/roles/slice) + cb12 03-DOMAIN-MODEL matrix + cb12 05-NLX (J1–J14); per-capability params/result schemas OWED (app contract/README); 18-A/18-B/18-C layer PRDs are stubs |
| 66 | `src/handlers/response.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §G + CON-INT-001/002; cb12 04-CAPABILITY-MATRIX §rows (id/class/tool/roles/slice) + cb12 03-DOMAIN-MODEL matrix + cb12 05-NLX (J1–J14); per-capability params/result schemas OWED (app contract/README); 18-A/18-B/18-C layer PRDs are stubs |
| 67 | `src/handlers/results.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §H (held/501) + CON-PRIV-001 SUPPRESSED; scoring rules held per 14 |
| 68 | `src/handlers/support.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §I + D8 + CON-ACC-004 |
| 69 | `src/handlers/survey.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §E/F issue_codes/export_codes/print; escrow details app-only |
| 70 | `src/handlers/template.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §E + cb12 14-STEVE-REPO-SYNC template versioning |
| 71 | `src/handlers/types.ts` | runtime src | PARTIAL | types defined only in app INTERFACE.md |
| 72 | `src/handlers/undo.ts` | runtime src | PARTIAL | CON-INT-003 + MCP-REQ-006 (undo only with true inverse) |
| 73 | `src/handlers/workspace.ts` | runtime src | PARTIAL | cb12 04-CAPABILITY-MATRIX §B + cb12 03-DOMAIN-MODEL; cb12 04-CAPABILITY-MATRIX §rows (id/class/tool/roles/slice) + cb12 03-DOMAIN-MODEL matrix + cb12 05-NLX (J1–J14); per-capability params/result schemas OWED (app contract/README); 18-A/18-B/18-C layer PRDs are stubs |
| 74 | `src/index.ts` | runtime src | PARTIAL | cb12 02-ARCHITECTURE faces (HTTP twin + /mcp); Hono routing app-only |
| 75 | `src/mcp.ts` | runtime src | SPECIFIED | cb12 prd/18-D-mcp MCP-REQ-001..014 (four tools, JSON-RPC); note 02 says official MCP SDK, app hand-rolls JSON-RPC |
| 76 | `src/policy.ts` | runtime src | PARTIAL | cb12 03-DOMAIN-MODEL matrix (B/P cells, D1–D8 held, "?" cells) + CON-ACC-001/003; P-defaults chosen by app |
| 77 | `src/receipt.ts` | runtime src | PARTIAL | CON-INT-003 + 02 receipt fields; rcpt_/tr_/undo_ formats, 300 s confirm TTL only in app INTERFACE.md |
| 78 | `src/registry.ts` | runtime src | SPECIFIED | cb12 02-ARCHITECTURE "capability id is the unit of parity" + cb12 10-REPROJECTION-AUDIT |
| 79 | `src/yaml.d.ts` | runtime src | UNSPECIFIED | TS module shim for yaml import; app-only |
| 80 | `test/a3-d1-journey.test.ts` | tests | PARTIAL | cb12 05-NLX (J1–J14) J1–J14 + cb12 04-ACCEPTANCE; assertions app-only |
| 81 | `test/a3-exact-assessment-grants.test.ts` | tests | PARTIAL | CON-ACC-001 / 03 J3 sibling-hide |
| 82 | `test/a3-response-results.test.ts` | tests | PARTIAL | CON-PRIV-001/002 |
| 83 | `test/access.test.ts` | tests | PARTIAL | OF-7 intent; Access JWT verification unspecified |
| 84 | `test/code-escrow.test.ts` | tests | PARTIAL | cb12 prd/18-I-testing "escrow test asserts no plaintext codes/tokens/emails"; CON-PRIV-005 |
| 85 | `test/collection-stage-gate.test.ts` | tests | PARTIAL | cb12 03-DOMAIN-MODEL stage semantics (prepare→collect) |
| 86 | `test/dispatch.test.ts` | tests | SPECIFIED | cb12 prd/18-D-mcp §Acceptance 1–5 (WRONG_TOOL_FOR_CLASS, CONFIRM_REQUIRED, NO_INVERSE) |
| 87 | `test/fail-closed-env.test.ts` | tests | PARTIAL | fail-closed principle in 18-B/12; missing-secret behaviour app-only |
| 88 | `test/lane-b-grants.test.ts` | tests | PARTIAL | cb12 03-DOMAIN-MODEL matrix + D3; cb12 04-ACCEPTANCE |
| 89 | `test/language.test.ts` | tests | PARTIAL | cb12 04-CAPABILITY-MATRIX §C PROPOSED rows + FIX-07 |
| 90 | `test/logout-cross-face.test.ts` | tests | PARTIAL | cb12 prd/18-D-mcp MCP-REQ-014 + Acceptance 5 |
| 91 | `test/participant-auth.test.ts` | tests | PARTIAL | cb12 02-ARCHITECTURE participants; cb12 04-CAPABILITY-MATRIX §A |
| 92 | `test/pinned-instruments.test.ts` | tests | PARTIAL | cb12 14-STEVE-REPO-SYNC 9/111/498 |
| 93 | `test/rubric-source-readback.test.ts` | tests | SPECIFIED | CON-INT-005 + cb12 prd/18-I-testing "byte-identical sha256 readback" + cb12 14-FIXTURE-MANIFEST.json |
| 94 | `test/synthetic-owner-auth.test.ts` | tests | UNSPECIFIED | demo.owner@example.invalid / .invalid-only sandbox rule not in cookbook |
| 95 | `test/synthetic-seed.test.ts` | tests | PARTIAL | cb12 prd/18-B-attestation-design 425 records / 34 cycles counts |
| 96 | `test/undo-batch.test.ts` | tests | PARTIAL | CON-INT-003; MCP-REQ-006 |
| 97 | `tools/build_pinned_instruments.py` | scripts/tools | PARTIAL | cb12 14-STEVE-REPO-SYNC requirements; CSV column→items_json/select|multi|text mapping app-only |
| 98 | `tools/gen_contract.py` | scripts/tools | PARTIAL | cb12 04-CAPABILITY-MATRIX § "Lane A generates" + cb12 10-REPROJECTION-AUDIT; PATH_FIX (21 paths) + inference heuristics app-only |
| 99 | `tools/synth_answers.py` | scripts/tools | PARTIAL | cb12 14-STEVE-REPO-SYNC FIX-12; generator invocation app-only |
| 100 | `tools/synth_seed_sql.py` | scripts/tools | PARTIAL | cb12 prd/18-B-attestation-design ID mapping rules; sha 9f554ae… pinned as evidence |
| 101 | `tsconfig.json` | config | UNSPECIFIED | no compiler settings anywhere in cookbook |
| 102 | `ui/.assetsignore` | config | UNSPECIFIED | wrangler assets exclusion list; not in cookbook |
| 103 | `ui/README.md` | docs | UNSPECIFIED | "temporary functional UI shell … Design lane may replace"; not in cookbook |
| 104 | `ui/app.js` | ui | UNSPECIFIED | provisional shell (21 KB). cb12 06/13 list surfaces/verbs; design-system (PR27) specifies a DIFFERENT artefact (ui_kits/3d-review kit, 34 routes, 83 caps, tokens.css) — not this file |
| 105 | `ui/index.html` | ui | UNSPECIFIED | as ui/app.js; does not use design-system tokens.css/kit.css (observed: 0 token refs) |
| 106 | `ui/language.js` | ui | UNSPECIFIED | as ui/app.js |
| 107 | `ui/language.test.mjs` | ui | UNSPECIFIED | node test for shell; not in cookbook |
| 108 | `ui/participant-resume.js` | ui | UNSPECIFIED | reload/resume behaviour described only in app ui/README |
| 109 | `ui/participant-resume.test.mjs` | ui | UNSPECIFIED | not in cookbook |
| 110 | `ui/present.js` | ui | UNSPECIFIED | not in cookbook |
| 111 | `ui/present.test.mjs` | ui | UNSPECIFIED | not in cookbook |
| 112 | `ui/server.mjs` | ui | UNSPECIFIED | local proxy fallback; excluded by .assetsignore |
| 113 | `ui/style.css` | ui | UNSPECIFIED | 1.8 KB shell CSS; design-system tokens.css is the specified look, not this |
| 114 | `ui/visibility.js` | ui | UNSPECIFIED | not in cookbook |
| 115 | `ui/visibility.test.mjs` | ui | UNSPECIFIED | not in cookbook |
| 116 | `vitest.config.ts` | config | UNSPECIFIED | yaml/sql-as-text plugin + include glob; vitest named only in 18-I evidence/experiments, never as a build input |
| 117 | `wrangler.toml` | config | PARTIAL / EXTERNAL-INPUT (undeclared) | cb12 02-ARCHITECTURE Worker+D1 (+R2/KV/Analytics Engine which app lacks) + cb12 07-MEAL-PLAN A8; branch→worker map, compatibility_date, [assets]/run_worker_first, [[rules]] Text globs, env.production routes app-only. External ids not declared in cookbook: D1 database_id ×2, ACCESS_AUD ×2, ACCESS_TEAM_DOMAIN, custom domain 3d-review.klappy.dev |

## Files added or changed by the open-PR stitch (`wtstitch`, 16 new files + 2 config deltas)

| # | path | category | coverage | cookbook source / what is missing |
|---|---|---|---|---|
| 1 | `docs/mail.md` | docs | PARTIAL | cb12 09 OF-3 (Resend sender) + CON-ACC-005; text app-only |
| 2 | `docs/ui-recovery-correction.md` | docs | UNSPECIFIED | not in cookbook |
| 3 | `seed/synthetic-responses-org.sql` | seed/fixtures | PARTIAL | cb12 prd/18-I-testing "app PR #14 adds 525 more from Steve's seeded org cohort → 7 of 9 forms"; cb12 14-FIXTURE-MANIFEST.json pins org_cohort.py/org_profiles.py |
| 4 | `seed/synthetic/README.md` | docs | UNSPECIFIED | not in cookbook |
| 5 | `seed/synthetic/answer-sets-org-comparison.json` | seed/fixtures | PARTIAL | as synthetic-responses-org.sql |
| 6 | `src/mail.ts` | runtime src | PARTIAL | OF-3 + CON-ACC-005 + 04 §F "accepted ≠ delivered"; provider API app-only |
| 7 | `src/oauth.ts` | runtime src | PARTIAL | cb12 prd/18-D-mcp D-1 "@cloudflare/workers-oauth-provider 0.10.3, Access email-code as authorize step" (6B on app #15); endpoints /authorize,/token,/register app-only |
| 8 | `src/ratelimit.ts` | runtime src | SPECIFIED | cb12 prd/18-I-testing Phase C: /mcp 30/60 s, sign-in 10/60 s per address+hashed email, redeem/open_link 60/60 s (as shipped in app PR #12 — written after the fact) |
| 9 | `src/worker.ts` | runtime src | PARTIAL | OAuth wrapper entry; 18-D D-1 |
| 10 | `test/mail.test.ts` | tests | PARTIAL | OF-3 |
| 11 | `test/mcp-oauth.test.ts` | tests | PARTIAL | 18-D D-1 |
| 12 | `test/phase-a-acceptance.test.ts` | tests | SPECIFIED | cb12 04-ACCEPTANCE 33 acceptance lines |
| 13 | `test/phase-a-contract-sweep.test.ts` | tests | SPECIFIED | cb12 prd/18-D-mcp MCP-REQ-013 / 04 parity checklist |
| 14 | `test/rate-limits.test.ts` | tests | SPECIFIED | cb12 prd/18-I-testing Phase C numbers + "6 wiring tests" |
| 15 | `test/stubs/cloudflare-workers.ts` | tests | UNSPECIFIED | test stub; not in cookbook |
| 16 | `ui/participant-dom.test.mjs` | ui | UNSPECIFIED | not in cookbook |
| 17 | `wrangler.toml (stitch delta)` | config | PARTIAL / EXTERNAL-INPUT (undeclared) | [[ratelimits]] ×4 (limits in 18-I; namespace_id 30101–30104 external, undeclared), [[kv_namespaces]] OAUTH_KV id 05b0c78… (undeclared), PUBLIC_ORIGIN var, extra run_worker_first paths |
| 18 | `package.json (stitch delta)` | config | PARTIAL | @cloudflare/workers-oauth-provider 0.10.3 exact pin IS in cb12 18-D/18-I; seed:local script extension app-only |