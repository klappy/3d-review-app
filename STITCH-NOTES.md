# STITCH NOTES — `stitch/auth-corrections-candidate-20260917`

Preview candidate for root's prospective disposition; **not for merge; no deploy.** This branch simulates, in isolation, the
tree the owner integration order below would produce. Nothing here was pushed to any shared branch.

## Inputs (exact heads)

| Line | Branch | Head | PR |
|---|---|---|---|
| base | `phase-0/walking-skeleton` | `10f5f444` | — |
| rate limits | `fable/rate-limits` | `c4321f80` | #12 (→ phase-0) |
| limiter corrections | `fix/pr12-limiter-boundary` | `745bd85a` | #19 (→ fable/rate-limits) |
| MCP OAuth | `fable/mcp-oauth` | `1ff48384` | #15 (→ fable/rate-limits); already contains `c4321f80` via merge `0c20628` |
| auth hardening | `fix/pr15-auth-hardening` | `4b3d7cce` | #20 (→ fable/mcp-oauth) |

## Intended owner integration order (recorded, NOT performed on shared branches)

1. PR #19 (`745bd85a`) → `fable/rate-limits`
2. `fable/mcp-oauth` takes `fable/rate-limits` (PR #15 gets a new head)
3. PR #20 (`4b3d7cce`) → `fable/mcp-oauth`
4. PR #15 (now containing 19 + 20) → `fable/rate-limits` (or per root's disposition)
5. PR #12 → `phase-0/walking-skeleton`

## What this branch did

1. `git checkout -b stitch/auth-corrections-candidate-20260917 1ff48384`
2. `git merge --no-ff 745bd85a` — shape of step 2. **4 conflicted files** (below). Committed as `44d8387`.
3. `git merge --no-ff 4b3d7cce` — step 3. **0 conflicts** (clean auto-merge).
4. Post-merge reconciliation of the cross-PR semantic interaction (below).

## Conflict hunks (merge 1: PR #19 into the oauth line) and resolutions

| File | Hunk | HEAD (oauth line) said | PR #19 said | Resolution |
|---|---|---|---|---|
| `src/handlers/types.ts` | `Env` interface, limiter bindings | `RL_MCP_ANON, RL_AUTH, RL_REDEEM, RL_MCP_CEILING` + `OAUTH_KV`/`OAUTH_PROVIDER` | `RL_MCP_ANON, RL_HTTP_ANON, RL_AUTH, RL_REDEEM` | **Union**: all five `RL_*` optional bindings + the OAuth fields |
| `src/ratelimit.ts` | header comment, binding table | `RL_AUTH … 10/60 s each`; `RL_MCP_CEILING 600/60 s` row | `RL_HTTP_ANON` row; `RL_AUTH … 10/60 s COMBINED per address` | PR #19's rows (COMBINED is the true statement) **plus** the `RL_MCP_CEILING` row |
| `src/ratelimit.ts` | `LimiterName` | `type LimiterName = "RL_MCP_ANON" \| "RL_AUTH" \| "RL_REDEEM" \| "RL_MCP_CEILING"` | `export const LIMITER_NAMES = ["RL_MCP_ANON","RL_HTTP_ANON","RL_AUTH","RL_REDEEM"] as const; type LimiterName = typeof…` | PR #19's `LIMITER_NAMES` const form, **with all five** names (`RL_MCP_CEILING` appended) |
| `INTERFACE.md` | after the rate-limit table | old "Posture:" paragraph + the whole `## MCP authorization` section | new "Posture:" paragraph (binding_absent/binding_failed log names, residuals R2/R3, per-message trace ids) | PR #19's Posture paragraph **followed by** the oauth line's `## MCP authorization` section unchanged |
| `README.md` | line 3 summary sentence | adds "`/mcp` requires OAuth 2.1 (or a first-party bearer) — see INTERFACE § MCP authorization" | rewrites the rate-limit clause ("anonymous traffic on both faces … a refused call writes nothing") | PR #19's sentence with the OAuth clause inserted before the rate-limit clause |

Auto-merged without conflict but worth naming: `wrangler.toml` (PR #19's amendment 3 already chose `RL_HTTP_ANON` = 30105/30205
precisely so it would not collide with `RL_MCP_CEILING` = 30104/30204 — both are bound at top level and under
`[env.production.ratelimits]` on this tree); `src/index.ts`, `src/mcp.ts`, `src/auth.ts`, `src/dispatch.ts`, handlers.

Non-conflict edit required by the union: `test/limiter-boundary.test.ts` `mkEnv` now also stubs `RL_MCP_CEILING` (the config
oracle iterates `LIMITER_NAMES`, so with five names it asserts all five bound in both tables with distinct namespace ids —
verified green: 30101/30105/30102/30103/30104 and 30201/30205/30202/30203/30204).

## Merge 2 (PR #20): clean; one semantic interaction reconciled

PR #20's test `test/mcp-oauth-hardening.test.ts` › A4 (5)(6) asserted the cost of a well-formed **unknown provider-shaped**
bearer on `/mcp` as **1 KV get + 2 D1 SELECTs** (the external-token fallthrough reaching `resolvePrincipal`). On the stitched
tree PR #19's token-shape gate (`FIRST_PARTY_TOKEN`) in `resolvePrincipal` answers anonymous **without** a SELECT, so the
measured integrated cost is **1 KV get + 0 D1**. Changes:

- `test/mcp-oauth-hardening.test.ts`: `expect(sqls.length).toBe(2)` → `toBe(0)` with the comment updated to say why.
- `INTERFACE.md` residual line (MCP authorization › Known residuals, "provider-shaped bearer"): reconciled to the measured
  integrated cost — 1 KV / 0 D1, ≤ 600 KV reads/min per address under `RL_MCP_CEILING`; notes that the literal `a:b:c` is
  *not* provider-shaped and costs 0 KV / 0 D1 via `RL_MCP_ANON`; notes the pre-stitch cost for the record.
- New `test/stitch-integrated-cost.test.ts` (2 tests): counting proxies on **both** D1 (`prepare/batch/exec`) and KV
  (`get/put/delete/list/getWithMetadata`) through the real `src/worker.ts` entry.

## Measured integrated storage costs (counting proxies, real worker entry, Miniflare)

| Bearer on `POST /mcp` | Limiter spent | KV | D1 | Response |
|---|---|---|---|---|
| `Bearer a:b:c` (not provider-shaped: grant id must be 16 and secret 32 chars) | `RL_MCP_ANON` | 0 | 0 | 401 + resource_metadata pointer, before storage |
| `Bearer user_x:<16>:<32>` (provider-shaped, unknown) | `RL_MCP_CEILING` | **1 get** | **0** | 401 (provider miss → external fallthrough → shape gate) |
| `Bearer st_<32>` well-formed unknown first-party (PR #19 residual R1, unchanged) | `RL_MCP_CEILING` on /mcp; `RL_HTTP_ANON` on HTTP twins | 0 | 2 SELECTs | 401 / anonymous |
| `Bearer garbage` on `/mcp` (no plausible shape) | `RL_MCP_ANON` | 0 | 0 | 401 + resource_metadata pointer, before storage |
| `Bearer garbage`, junk cookie, two tokens (HTTP twins) | `RL_HTTP_ANON` | 0 | 0 | anonymous path |

## Verification on this tree

- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → **22 files, 92 tests, all passing** (after merge 1 alone: 20 files / 74 tests; merge 2 adds 1 file / +16 tests
  — `mcp-oauth-hardening` 14, `fail-closed-env` +2; the stitch oracle adds 1 file / 2 tests).
- `scripts/consent-browser-check.mjs` (external Playwright 1.56.1 / Chromium 141 headless via `PLAYWRIGHT_DIR` +
  `PLAYWRIGHT_CHROMIUM`) → **RESULT: PASS**, 10/10 assertions (a–e).
- Migrations on this tree: `0001_init`, `0002_code_escrow`, `0003_language_archive`, `0004_pinned_instruments`,
  `0006_oauth_code_redemption`. **No `0005`** — per the header of `0006_oauth_code_redemption.sql`, ordinal 0005 is
  taken by `0005_report_snapshot.sql` on `review/report-baseline-20260916` (not merged on any input line); tests apply
  migrations by explicit list, so the gap is harmless here, and the owner should keep 0005 reserved for that branch.
- `package.json` / `package-lock.json`: identical to `fable/mcp-oauth` @ `1ff4838` (PR #19 touched neither); the PR #15
  `node_modules` was reused.

## Things the owner still has to do (not done here)

- PR #15's post-integration head (after steps 1–3) is a **new head**: it needs fresh review + Bugbot; nothing on this
  branch substitutes for that.
- Root's disposition on step 4 (PR #15 → `fable/rate-limits` vs. another target).
- This branch is a preview; delete it after disposition.

## Amendment 1 (combined review 5708670447, APPROVE-WITH-NITS)

- INTERFACE.md residual line: the reconciled 1 KV + 0 D1 statement now cites "measured and accepted by combined review
  5708670447"; 5708128737 is kept as history for the pre-stitch 1 KV + 2 D1 wording.
- Cost tables (here and in the PR body): explicit `Bearer garbage` on `/mcp` row (0 KV / 0 D1 under `RL_MCP_ANON`).
