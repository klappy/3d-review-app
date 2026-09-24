# TICKET — 2026-09-17-3d-release-identity

**What this is:** Give the 3D Review app a truthful release identity — one cookbook-defined product version, a build-time `<version>+<sha7>` stamp, health/MCP version fields and a generated `/changelog.json` that Design's badge can read — so every deployed build says exactly which accepted release record it was built against.
**Why now:** klappy ordered the version badge + changelog rollups after the first DEV collection increment (cookbook #16 c5709700664); root's SemVer audit found `package.json 0.0.1-phase0`, no tags, no releases, and a hardcoded health literal (c5709554662); HYGIENE 19 requires the stamp before any production promotion.
**Your move:** nothing until it plates — root fires, tags after DEV acceptance; the captain's only later call is `1.0.0`.

Class: entrée. Risk: STANDARD (no secrets, no PII, no law; protected Auth paths untouched).
Station: subagent (fresh-context worker under the cos door; LANES DEFAULT).
Owner: cos `cse_017tAuUoGnwUgSZGGu8x6rAP` (Auth/release pen). Promise: 45 min authoring — burns down across attempts (R6); +15 min cookbook record; review/Bugbot outside the promise.
Depends: none (base app `main` @ `a57ba930ced3c23616982c7dab291949b75a3b8a`; cookbook plan branch `plan/2026-09-16-parity-build-preplan`).
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-a (release/infra row; 18-H).
driver-seat: scoped (entrée) — `DELTA.md` beside this ticket.

Outcome served:
- A reader of any deployed 3D Review build can name the accepted cookbook release record it was built from and the exact app commit, without asking a human.
Learning signal:
- Whether the first `v0.1.0` release receipt (tag + cookbook C2 + DEV readback) closes with zero ambiguity about which SHA/version is live.

Ingredients:
- Accepted plan: cookbook #16 c5709788310 → rev 2 c5709825639 → rev 3 c5709952532 → rev 3a c5710115073 → rev 3b c5710298093; root ACCEPT c5710305094; Auditor five conditions c5710264717 (folded); Design interface ACK c5709828011 / c5709959245.
- Verified CI metadata: Cloudflare Workers Builds docs (`workers/ci-cd/builds/configuration`) — `CI`, `WORKERS_CI`, `WORKERS_CI_BUILD_UUID`, `WORKERS_CI_COMMIT_SHA`, `WORKERS_CI_BRANCH` at build time only; DEV trigger override set empty (root c5709978138, 06:27:26Z).
- Observed app state at `a57ba930`: `package.json` `0.0.1-phase0`; `src/handlers/platform.ts:81` literal `build`; `src/mcp.ts:39` literal `serverInfo.version`; health `contract`/`source_sha` from `contract/capabilities.json`; build command `npm ci && npm run typecheck && npm test` then `npx wrangler deploy` (docs/release.md:20); `[assets] directory="./ui"`.
- Cookbook record (prep, this ticket): `planning/2026-09-16-parity-build/releases/0.1.0.md` + `releases/releases.json` (status `candidate`), `prd/18-H-infra.md` release-identity section, 18-I Phase E line.
- HYGIENE 19 (kitchen `HYGIENE.md`), `klappy://canon/constraints/governance-change-discipline` (bump + changelog for behaviour-affecting change), SemVer 2.0.0 and Keep-a-Changelog (borrowed as-is).

Declared product:
1. app `release/release-manifest.json` — `{version, cookbook_commit, records:[{path, blob_sha, sha256}] for 0.1.0.md and releases.json, changelog{sections}}` + byte copies `release/cookbook/0.1.0.md`, `release/cookbook/releases.json`.
2. app `scripts/stamp-version.mjs` — writes git-ignored `src/version.generated.ts` (`APP_VERSION`, `APP_COMMIT`, `APP_STAMP`, `BUILD_UUID|null`) and git-ignored `ui/changelog.json` from the pinned `releases.json` copy; sha = `WORKERS_CI_COMMIT_SHA` when `CI=true`/`WORKERS_CI=1` (empty → exit 1, no fallback), else `git rev-parse HEAD`; asserts `package.json.version` and both lock `version` fields equal the manifest.
3. app `src/version.ts` (tracked re-export of `./version.generated`), `.gitignore` (+2 lines), `package.json` (`version: 0.1.0`, `pretypecheck`/`pretest`/`predev` hooks, `stamp` script), `package-lock.json` (two `version` fields).
4. app `src/handlers/platform.ts` health: `version`, `build` (changed from literal → `<version>+<sha7>`), `commit`, `build_uuid` (optional), `release_source`; `contract`/`source_sha`/`capabilities` unchanged. `src/mcp.ts:39` `serverInfo.version` → `APP_VERSION` (one line; Auth custody).
5. app `test/version-stamp.test.ts` — package == lock == manifest == generated == health == MCP; manifest records' `blob_sha` (`sha1("blob <len>\0"+bytes)`) and `sha256` recomputed from the byte copies; `ui/changelog.json` deep-equals manifest sections; CI: `APP_COMMIT === WORKERS_CI_COMMIT_SHA`.
6. app `docs/release.md` — versioning section (authority chain, hooks, `npm run stamp` for direct tool use, tag step = `git tag` + cookbook C2 by root).
7. cookbook `planning/2026-09-16-parity-build/releases/0.1.0.md`, `releases/releases.json`, `prd/18-H-infra.md` §Release identity, `prd/18-I-testing.md` Phase E line — isolated PR to `plan/2026-09-16-parity-build-preplan`.

Done-means:
- A cook on a fresh checkout can run `npm ci && npm run typecheck && npm test` and observe the generated stamp created by the hooks, all suites green, and `git status` clean.
- A reviewer with a cookbook checkout at `cookbook_commit` can run `git rev-parse <commit>:<path>` for both records and observe equality with the manifest `blob_sha` values (PR-review gate; receipt before merge).
- A reader of DEV `GET /v2/health` after merge can observe `version 0.1.0`, `build 0.1.0+<sha7>`, `commit` equal to the merged main SHA read from GitHub, `release_source` equal to the manifest `cookbook_commit`, and `contract`/`source_sha`/`capabilities` unchanged.
- An MCP client calling `initialize` can observe `serverInfo.version === "0.1.0"`.
- A browser fetching `GET /changelog.json` can observe `current: "0.1.0"`, newest-first entries, the 0.1.0 entry `status: candidate` with no `tag`/`date`, sections keyed exactly `added/changed/fixed/security`, and no HTML.
- A cook simulating `CI=true` with `WORKERS_CI_COMMIT_SHA` unset can observe the stamp script exit 1 and the build fail, never a fabricated sha.
- root, after DEV acceptance, can tag `v0.1.0` on the release merge SHA and commit cookbook C2 (`released`, `tag`, `date`) in one receipt, and observe that no app change is needed to record it.

## Failure Modes — What Breaks When Release Identity Is Faked or Split
- A second editable version authority appears (tracked generated file, app-authored CHANGELOG, hand-edited `changelog.json`).
- The stamp is fabricated or stale (fallback sha in CI; committed placeholder).
- Health `source_sha` and `release_source` are conflated, or `contract` consumers break.
- The running version is shown as `released` from a runtime guess, or historical `a57ba930` is tagged as `0.1.0`.
- Protected Auth paths or migrations are touched under this ticket.

## Required Response When Detected
- Second authority → remove it in the same PR; the consistency test must fail until only cookbook → manifest → derived surfaces remain.
- Fabricated/stale stamp → build fails (`exit 1`) or the consistency test fails; no merge; fix the hook, never the assertion.
- Conflation/consumer break → revert the health field change; `contract`/`source_sha` are frozen names.
- False release status → the entry stays `candidate` until cookbook C2 lands; tag only the accepted release merge SHA after validation.
- Protected-path touch → return the hunk to the Auth pen; the PR does not proceed with it.
