# Phase 0 shared interface — both builders code against this exactly

Repo: klappy/3d-review-app (Cloudflare Worker, TypeScript, Hono, D1). Package root = /home/claude/app.

## Layout (owner in brackets)
- `wrangler.toml`, `package.json`, `tsconfig.json`, `vitest.config.ts` [platform]
- `contract/capabilities.json`, `contract/openapi.yaml` — already exist (copy from _inputs); READ-ONLY here
- `src/index.ts` — Worker entry: Hono app; mounts HTTP routes from the registry + `/mcp` endpoint [platform]
- `src/registry.ts` — loads contract/capabilities.json at build time (import JSON); exposes `capabilities: Capability[]`, `byId`, `classToTool` [platform]
- `src/envelope.ts` — `ok(capability, result, receipt?)`, `fail(code, message, hint?, docs?)`, error code enum from capabilities.json `errors` [platform]
- `src/auth.ts` — principal resolution: session cookie `session`, `Authorization: Bearer` (delegated agent bearer), participant token; phase 0 = signed opaque tokens in KV/D1 `session` table; email-code login stub that logs the code (no email send) [platform]
- `src/policy.ts` — `authorize(ctx, capability, scope)`: role check from `grant` rows; roles owner/member/viewer at workspace/project/assessment; participant for P rows; support flag for S rows; inheritance is workspace → grouped project only (effective project role = max of the direct project grant and the grant on the workspace that groups it; an ungrouped project has only its direct grants), and assessment grants are never inherited — only an explicit assessment grant opens an assessment (D9); returns NOT_FOUND_OR_NOT_VISIBLE for unauthorized AND nonexistent [platform]
- `src/receipt.ts` — receipt minting (`rcpt_…`), trace ids (`tr_…`), undo tokens (`undo_…`) only for rows with inverse.kind == "true", confirm tokens for danger (bound to capability+params hash+actor+scope; TTL 300s, labeled inherited); persisted in `receipt` table [platform]
- `src/mcp.ts` — JSON-RPC 2.0 over HTTP POST at `/mcp` (MCP streamable-HTTP, no SSE needed): `initialize`, `tools/list` → exactly docs/read/write/danger, `tools/call` → dispatch via the SAME `execute()` as HTTP [platform]
- `src/dispatch.ts` — `execute(ctx, capabilityId, params, mode?)`: looks up registry → class/tool check (WRONG_TOOL_FOR_CLASS) → RESERVED_NOT_BUILT for v2.1-oct → authorize → handler → receipt. Danger: mode dry_run → handler(…, {dryRun:true}) returns Impact + confirm_token; execute requires token. HTTP routes and MCP both call this. [platform]
- `src/handlers/types.ts` [platform writes; data imports]:
```ts
export type Role = "owner"|"member"|"viewer";
export type ScopeType = "workspace"|"project"|"assessment"|"survey"|"platform";
export interface Principal { kind:"user"|"participant"|"support"|"anonymous"; id:string; email?:string; delegatedBy?:string; supportActor?:string; participantSurveyId?:string }
export interface Ctx { env: Env; db: D1Database; principal: Principal; traceId: string; now: () => Date; log: (span:string, data?:Record<string,unknown>)=>void }
export interface Impact { affected: unknown[]; irreversible: boolean; effect: "external"|"disclosure"|"destructive"; retention?: string; compensating_control?: string }
export interface HandlerResult { result: Record<string,unknown>; scope?: {type:ScopeType; id:string}; priorState?: Record<string,unknown>; impact?: Impact }
export type Handler = (ctx: Ctx, params: Record<string,unknown>, opts?: {dryRun?: boolean}) => Promise<HandlerResult>;
export interface Env { DB: D1Database; SESSION_SECRET: string; ENVIRONMENT?: string }
```
- `src/handlers/index.ts` [data] — `export const handlers: Record<string, Handler>` keyed by capability id. Any v2.0-bcs id missing from this map → dispatch returns `{ok:false, error:{code:"RESERVED_NOT_BUILT", message:"not built yet (phase 0)", hint, docs}}` with HTTP 501 — honest, never fake.
- `src/handlers/{entry,auth,workspace,project,assessment,template,survey,participant,response,results,grant,request,support,ops,docs}.ts` [data, except: `auth.ts`, `ops.ts`, `docs.ts`, `entry.ts` = platform]
- `migrations/0001_init.sql` [data] — D1 schema: workspace, project, language, assessment (language_id, stage), survey_template (+ version, items json, rubric ref), assessment_survey (template@version, state), invitation, access_code (hashed code, redeemed_at), participant_session, response (append-only, idempotency_key unique, respondent_id, provenance cols), grant (principal_id, scope_type, scope_id, role; unique), request, receipt (id, actor, capability, scope_type, scope_id, class, inverse, undo_token, confirm_token, trace_id, prior_state json, at), trace (trace_id, spans json), session (token hash, principal, kind, expires_at, delegated_by), feedback. Follow cookbook 03 + steve-SCHEMA.md (Project→Language→Assessment) + PRD R6. Real data never seeded.
- `seed/synthetic.sql` [data] — one workspace, two projects, two languages, three assessments at different stages, nine templates (names from 14-STEVE-REPO-SYNC; items may be minimal placeholders), a few grants, synthetic responses; ALL names invented (no Laos/Aushi/real names).
- `scripts/parity.mjs` [platform] — for every capability: call HTTP twin and MCP tool with the same fixture principal; compare normalized envelopes; print `same=S/compared=81 · excluded=2 · contract=83` (never `83/83`). The two EXCLUDE rows (`docs.openapi`, `auth.logout`) do not increment `same`. Compared rows are tagged `REFUSAL-PARITY` or `RESULT-PARITY`. Exit 1 on any differ. Requires `SESS` for `/mcp`. FX real-fixture mode is deferred.
- `scripts/journeys.mjs` [platform] — live B2 runner; row type `{id, verdict, note, evidence}` with `verdict ∈ {PASS, FAIL, RESERVED_501, SKIP}`. Summary `journeys PASS=a FAIL=b RESERVED=c SKIP=d`. Exit 1 on any FAIL or if the non-overridable floor `AUTH, ME, J8, J14a, J7, J6, MCP, OUT` is not all PASS (`REQUIRE=` may only add). `--strict` default; `--allow-skip` cannot drop the floor. `INJECT_FAIL=<rowId>` is local-only proof. Uncaught exception → exit 2 naming the row in flight.
- `test/*.test.ts` [both, own areas] — vitest + `@cloudflare/vitest-pool-workers` or miniflare; at minimum: registry loads 79; tools/list == 4; WRONG_TOOL_FOR_CLASS; RESERVED_NOT_BUILT for v2.1-oct; NOT_FOUND_OR_NOT_VISIBLE parity; danger dry_run→confirm→execute; suppression returns ok:true suppressed:true.

## Non-negotiables (cookbook 16-CONSTRAINTS)
- Danger twins never GET. SUPPRESSED is ok:true. v2.1-oct rows are 501 RESERVED_NOT_BUILT. Existence hidden. Inheritance only workspace → grouped project; never to an assessment (D9). Codes never returned by issue_codes (count/ids only). Telemetry never carries params/codes/addresses/answers. Receipt on every write with trace_id. No real participant data anywhere. No Supabase. No offline queue.
- Do NOT npm-install anything that needs network beyond the npm registry. Do not try to reach GitHub. Do not run `wrangler login`/deploy — local only (`wrangler dev --local` or vitest workers pool).

## Transport routes (not capabilities — never counted in parity)

| route | what | why it is not a capability |
|---|---|---|
| `POST /mcp` | JSON-RPC face of the same `execute()` | it *is* the second face |
| `GET /v2/openapi.yaml` | contract projection | static |
| `GET /v2/auth/access` | Cloudflare Access email-code return leg (browser redirect) | agents hold a bearer; browsers only |
| `GET /v2/auth/email` | B38 email sign-in link: sign-in page (one email field) | browsers only; off unless `MAGIC_LINK="on"` (DEV) — then `303 → /v2/auth/access` |
| `POST /v2/auth/email` | B38: request a link (`email`, optional `next=oauth`; form or JSON). Same answer whether or not the address has signed in before. Same-origin only; per email 5 links / 15 min (D1, one conditional INSERT…SELECT — atomic) | sends mail; browsers only |
| `GET /v2/auth/email` `?probe` | B38: `{email_links: bool}` — the UI keeps the Access sign-in button and team-domain logout when false | read-only, browsers only |
| `GET /v2/auth/email/open` | B38: landing page for the emailed link `…/open#t=<token>&e=<address>` — fragment only. Never submits by itself: it checks the link, then shows ONE button "Sign in as <hash-verified address>" (no matching address → "incomplete", never an unnamed sign-in); a person must click | browsers only |
| `POST /v2/auth/email/check` | B38: `{t, e}` → `{valid, email}` — `email` only when its hash matches the link's row. Mints and writes nothing. Same-origin only | browsers only |
| `POST /v2/auth/email/open` | B38: open the link. Requires `t` AND the link's own address `e`, hash-matched to its row — missing or mismatched → 400 "This link is incomplete — request a new one." Token 256-bit, stored as SHA-256 in `login_code` (`ml_` rows), reusable until expiry (30 min), any browser/device. Success → 30-day session, `session` cookie `HttpOnly; Secure; SameSite=Lax`, `303 → /#session=`. With `next=oauth` and this browser's parked connector request → consent page naming the hash-verified address, no web session; no matching address → refused (400) | browsers only |
| `POST /v2/ops/seed/synthetic` | **dev bootstrap**: loads `seed/synthetic-responses.sql` into dev D1; signed-in, idempotent, refused unless `ENVIRONMENT` is exactly `dev` (a missing variable fails closed); label `dev.bootstrap.seed_synthetic`, no receipt | environment plumbing, not product behavior |

## Rate limits — none in the app

No app-level rate limiting (captain ruling 2026-10-16, cookbook `work/active/2026-10-15-3d-workshop-same-ip/RULING-2026-10-16-scrap-app-ratelimit.md`): rate limiting is an edge concern, not an app concern, and no edge rule is configured. No request is refused for volume, on either face; `wrangler.toml` binds no `[[ratelimits]]`.

What remains, and is not a rate limiter:

- **Product caps** keep the contract error `RATE_LIMITED` with their own wait: collaborator invitations per inviter per hour (`error.data.retry_after = 3600`) and sign-in links per address on `POST /v2/auth/email` (5 links / 15 min, counted in D1; `429` + `retry-after: 900`). An upstream translator's `429` on `POST /v2/translate` is passed through as `429` + `retry-after: 60`. On HTTP a `RATE_LIMITED` envelope carries `retry-after`; on MCP the envelope carries `error.data.retry_after`.
- **`/mcp` batch cap:** a JSON-RPC batch over 10 messages is refused (`-32600`) for every caller — input validation.
- **Malformed credentials cost 0 D1.** `resolvePrincipal` admits only the shapes this code mints — `st_`/`pt_` + 32 chars of `[A-Za-z0-9_-]` — and treats anything else (`Bearer garbage`, a provider-shaped `a:b:c` token, a junk cookie) as anonymous without a lookup (`test/credential-boundary.test.ts`).
- **Well-formed unknown tokens cost indexed D1 SELECTs per request** — 2 for a bearer (`session`, then `participant_session`), 1 for a `session` cookie — and nothing in the app bounds how many such requests arrive (**Residual R1**, now unbounded by design).
- **Residual R3 — PROPOSED; ACCEPTED by independent review 5708112856:** no body-size ceiling of our own in front of the `/mcp` double parse or the HTTP body parse; the Workers platform request-body limit (100 MB on the paid plan) is the only bound.

Trace ids are per JSON-RPC message: one row per `read` / `write` / `danger` `tools/call` in a batch (`docs` calls persist no row; `trace.trace_id` is the primary key).

## MCP authorization (src/worker.ts, src/oauth.ts)

Worker entry is `src/worker.ts`: the borrowed **`@cloudflare/workers-oauth-provider` 0.10.3** (same pin as `klappy/bee-ai-auth-mcp`) sits in front of `POST /mcp`; the Hono app in `src/index.ts` is its default handler and is otherwise unchanged. Storage: KV binding `OAUTH_KV` (hashed clients/grants/tokens + parked authorization requests under `3dr:authreq:`).

| Route | Served by | What |
|---|---|---|
| `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource[/mcp]` | provider | discovery; both advertise `scopes_supported: ["3dreview"]` and every `WWW-Authenticate` challenge carries `scope="3dreview"` |
| `POST /register` | provider | dynamic client registration |
| `POST /token` | provider + app glue (`tokenExchangeCallback`) | code + PKCE exchange, refresh, revocation. Authorization-code single use is enforced by the app, not the provider: the callback (runs after the provider's client + PKCE checks, before its KV write) does `INSERT OR FAIL` into D1 `oauth_code_redemption` (`migrations/0006_oauth_code_redemption.sql`, key = grant id, 1:1 with the code); a duplicate (SQLite constraint) answers `400 invalid_grant`; any other D1 failure answers `503 temporarily_unavailable` and the code is not burnt (the provider has not written the grant yet). A wrong verifier never reaches the callback, so it does not burn the code |
| `GET /authorize` | app glue | provider validates the request → **PKCE `S256` required for every client** (confidential clients too; else `302 error=invalid_request` to the validated redirect URI, nothing parked) → parked 10 min (KV + `__Host-oauth_req` cookie) → 302 to `/v2/auth/access?next=oauth` |
| `GET /v2/auth/access?next=oauth` | app glue (Access-guarded) | identity = verified Access JWT only → consent page naming the app; **no web session is opened**. Consent page CSP is `form-action 'self' <source>` where `<source>` is the origin (http/https) or `<scheme>:` (custom scheme) of the provider-validated redirect URI — CSP3 checks `form-action` on the post-submit 302, and `'self'` alone blocked it in Chromium (Bugbot 4032352529); proven by `scripts/consent-browser-check.mjs` (headless Chromium; Connect, Cancel, negative). Error pages stay `'self'` |
| `POST /oauth/consent` | app glue | HMAC ticket + matching cookie + single-use parked request → `completeAuthorization` (props `{principal_id, client_id}`) or `access_denied` |
| `POST /mcp` | provider → `handleMcp` | no/invalid credential → **401 + `WWW-Authenticate`**; provider token → principal re-read from D1 every call, `delegated_by = "oauth:<client_id>"`, never `support`; first-party bearer (web session token, participant token) → accepted through `resolveExternalToken`, unchanged behavior |

Rules: anonymous MCP no longer exists (public docs stay on HTTP: `GET /v2/docs…`). A provider token is **not** a web session — the HTTP face refuses it. `write cap.auth.logout` from a delegated caller revokes that user's grants for that client. Pre-auth shape gate in `src/worker.ts` (no rate limit — removed, captain 2026-10-16): on `/mcp` **any bearer that cannot be ours by shape** is refused 401 before any storage lookup. "By shape" is exact: `Authorization` is parsed exactly as the provider does (`Bearer ` + token, case-sensitive, one space), first-party = `st_|pt_` + 32 `[A-Za-z0-9_-]`, provider = `<user id>:<16>:<32>` from the same alphabet; the early 401 carries the same `WWW-Authenticate` (RFC 9728 `resource_metadata` derived from the request path, plus `scope`) the provider would send. The provider is built per `env` (`WeakMap`) so its callbacks reach `env.DB`. `OAUTH_KV` is a **required** binding: without it `/token`, `/register` and a provider-shaped bearer on `/mcp*` answer `503 temporarily_unavailable` before any storage access (first-party bearers are unaffected). Behind the provider the per-message anonymous batch metering in `src/index.ts` is only reachable if a session is revoked mid-request. **Breaking:** a cookie-only web session is no longer accepted on `/mcp` (send it as a bearer). `wrangler.toml` `run_worker_first` lists these paths (`/mcp` and `/mcp/*`) so static assets never shadow them. `scripts/parity.mjs` now requires `SESS`.

Known residuals (recorded, not closed here; each names its closer). Each row is marked `PROPOSED` by the auth pen and `ACCEPTED by independent review 5708128737`:
- PROPOSED · ACCEPTED by independent review 5708128737 — Consent single-use is KV get→delete, not atomic: same browser, same ticket, truly concurrent → two codes for the same client/user/challenge. Grants nothing new; the provider revokes the earlier grant. Closer: the same D1 `INSERT OR FAIL` row pattern that now gates code redemption.
- PROPOSED · ACCEPTED by independent review 5708128737 — Reuse asymmetry: a **concurrent** loser is refused (`invalid_grant`) and does **not** revoke the grant — a revoke there would race the winner's own KV write; the winner's tokens stay valid. **Sequential** reuse is refused *and* the grant revoked by the provider itself (OAuth 2.1 §4.1.2), before the callback runs.
- PROPOSED · **measured and accepted by combined review 5708670447 at the stitched tree (PR #19 + PR #20 together, `test/stitch-integrated-cost.test.ts`)** — A well-formed but unknown provider-shaped bearer (`userId:<16>:<32>`) costs **1 KV read and 0 D1**: the provider misses the token in KV, falls through to `resolveExternalToken` → `resolvePrincipal`, and PR #19's token-shape gate answers anonymous without a SELECT. Not bounded by any app limiter (app-level rate limiting removed, captain 2026-10-16). The literal `a:b:c` is *not* provider-shaped (grant id 16 / secret 32 chars required): it is refused before any storage (0 KV, 0 D1). History: before the stitch (PR #20 alone) the same bearer additionally cost the two first-party `session`/`participant` SELECTs — that pre-stitch statement (1 KV + 2 D1) was the one ACCEPTED by independent review 5708128737. Not a bypass; a cost.
- PROPOSED · ACCEPTED by independent review 5708128737 — `oauth_code_redemption` rows are never purged (index on `redeemed_at` exists); purge is a follow-up.

One-way door (17-IRREVERSIBILITY): once real users connect apps in production, deleting `OAUTH_KV` or removing the provider disconnects everyone at once.
