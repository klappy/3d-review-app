# 3D Review — app (phase 0: walking skeleton)

Cloudflare Worker (Hono + D1). **Every one of the 79 capabilities answers on both faces — HTTP twin and MCP (`docs` / `read` / `write` / `danger`) — through one `execute()`.** Built rows do the real thing; unbuilt rows answer an honest `501 RESERVED_NOT_BUILT`. Anonymous MCP, sign-in and code redemption are rate limited (`429 RATE_LIMITED`, see `INTERFACE.md` § Rate limits). Blueprints: `klappy/3d-review-cookbook` `planning/2026-09-16-parity-build/` (contract projected from `04-CAPABILITY-MATRIX.md`; MCP layer per `prd/18-D-mcp.md`).

## Deploy (git hooks only)
Cloudflare **Workers Builds** watches this repo: a push to `phase-0/walking-skeleton` builds and deploys **3d-review-dev** (https://3d-review-dev.klappy.workers.dev); a merge into `main` (by PR) builds and deploys **3d-review** (production, `--env production`). No seat runs `wrangler deploy`. Secrets (`SESSION_SECRET`) live on the Worker, not in the repo. D1 migrations are applied with `wrangler d1 migrations`/execute against the named database by the build or by a reviewed step — never ad hoc against prod.

## Run locally
```
npm i
npm run migrate:local && npx wrangler d1 execute 3d-review --local --file=migrations/0002_platform_ext.sql && npm run seed:local
npm run dev            # http://localhost:8787
curl localhost:8787/v2/health
curl localhost:8787/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
SESS=<token> npm run parity   # 79/79 HTTP vs MCP (2 documented exclusions)
```
Sign in (phase 0, no email is sent): `POST /v2/auth/link {"email":…}` → response carries `dev_only_code` in dev → `POST /v2/auth/session {"email","code"}` → `session` token works as cookie `session` and as `Authorization: Bearer` (delegated-identity contract is open item D-1 in 18-D).

## Layout
`contract/` A1 (Lane A owns) · `src/registry.ts` routes from the contract · `src/dispatch.ts` one execute (class→tool, RESERVED_NOT_BUILT, authorize, handler, receipt, danger two-step) · `src/mcp.ts` four tools · `src/policy.ts` no inheritance, unauthorized == nonexistent · `src/handlers/` Lane B: entry/auth/ops/docs/undo; Lane A: domain (workspace is a draft seed; project/assessment/template/survey/participant/response/results/grant/request/support still 501) · `migrations/` 0001 schema (Lane A draft) + 0002 platform ext · `seed/synthetic.sql` invented data only · `scripts/parity.mjs` B3.

## Rules carried (cookbook 16-CONSTRAINTS)
Danger twins never GET · `SUPPRESSED` is `ok:true` · `v2.1-oct` = documented 501 · existence hidden · no inheritance · codes never returned by `issue_codes` · telemetry carries no params/codes/answers · receipt with `trace_id` on every write · no real participant data · no Supabase · no offline queue.
