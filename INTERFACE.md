# Phase 0 shared interface — both builders code against this exactly

Repo: klappy/3d-review-app (Cloudflare Worker, TypeScript, Hono, D1). Package root = /home/claude/app.

## Layout (owner in brackets)
- `wrangler.toml`, `package.json`, `tsconfig.json`, `vitest.config.ts` [platform]
- `contract/capabilities.json`, `contract/openapi.yaml` — already exist (copy from _inputs); READ-ONLY here
- `src/index.ts` — Worker entry: Hono app; mounts HTTP routes from the registry + `/mcp` endpoint [platform]
- `src/registry.ts` — loads contract/capabilities.json at build time (import JSON); exposes `capabilities: Capability[]`, `byId`, `classToTool` [platform]
- `src/envelope.ts` — `ok(capability, result, receipt?)`, `fail(code, message, hint?, docs?)`, error code enum from capabilities.json `errors` [platform]
- `src/auth.ts` — principal resolution: session cookie `session`, `Authorization: Bearer` (delegated agent bearer), participant token; phase 0 = signed opaque tokens in KV/D1 `session` table; email-code login stub that logs the code (no email send) [platform]
- `src/policy.ts` — `authorize(ctx, capability, scope)`: role check from `grant` rows; roles owner/member/viewer at workspace/project/assessment; participant for P rows; support flag for S rows; NO inheritance; returns NOT_FOUND_OR_NOT_VISIBLE for unauthorized AND nonexistent [platform]
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
- `scripts/parity.ts` [platform] — for every capability: call HTTP twin and MCP tool with the same fixture principal; compare normalized envelopes; print table. Runs against `wrangler dev` or a `unstable_dev` in vitest.
- `test/*.test.ts` [both, own areas] — vitest + `@cloudflare/vitest-pool-workers` or miniflare; at minimum: registry loads 79; tools/list == 4; WRONG_TOOL_FOR_CLASS; RESERVED_NOT_BUILT for v2.1-oct; NOT_FOUND_OR_NOT_VISIBLE parity; danger dry_run→confirm→execute; suppression returns ok:true suppressed:true.

## Non-negotiables (cookbook 16-CONSTRAINTS)
- Danger twins never GET. SUPPRESSED is ok:true. v2.1-oct rows are 501 RESERVED_NOT_BUILT. Existence hidden. No inheritance. Codes never returned by issue_codes (count/ids only). Telemetry never carries params/codes/addresses/answers. Receipt on every write with trace_id. No real participant data anywhere. No Supabase. No offline queue.
- Do NOT npm-install anything that needs network beyond the npm registry. Do not try to reach GitHub. Do not run `wrangler login`/deploy — local only (`wrangler dev --local` or vitest workers pool).

## Transport routes (not capabilities — never counted in parity)

| route | what | why it is not a capability |
|---|---|---|
| `POST /mcp` | JSON-RPC face of the same `execute()` | it *is* the second face |
| `GET /v2/openapi.yaml` | contract projection | static |
| `GET /v2/auth/access` | Cloudflare Access email-code return leg (browser redirect) | agents hold a bearer; browsers only |
| `POST /v2/ops/seed/synthetic` | **dev bootstrap**: loads `seed/synthetic-responses.sql` into dev D1; signed-in, idempotent, refused unless `ENVIRONMENT` is exactly `dev` (a missing variable fails closed); label `dev.bootstrap.seed_synthetic`, no receipt | environment plumbing, not product behavior |

## Rate limits (src/ratelimit.ts)

Borrowed substrate: Cloudflare Workers Rate Limiting bindings (`[[ratelimits]]` in `wrangler.toml`, repeated under `[env.production]` — bindings are not inherited). Enforced inside `execute()` so the HTTP twin and the MCP tool share one budget, before authorization and before the capability's handler touches storage. Precisely: a request that presents **no credential** is refused with zero storage access; a request that presents a credential costs one indexed D1 session lookup (`resolvePrincipal`) before the limiter runs. A refused call returns the contract error `RATE_LIMITED` (HTTP 429 + `retry-after: 60`; on MCP the envelope error, or JSON-RPC `-32029` with `data.code = "RATE_LIMITED"` when the anonymous transport limit trips) and writes **no** trace row.

| Binding | Counts | Key | Limit |
|---|---|---|---|
| `RL_MCP_ANON` | every anonymous `POST /mcp`, **one unit per JSON-RPC message** in a batch (signed-in callers are not counted); any batch over 10 messages is refused (`-32600`) for every caller | caller address | 30 / 60 s |
| `RL_AUTH` | `cap.auth.request_link`, `cap.auth.consume_link` | caller address; plus sha256(email) for `request_link`, sha256(email)+address for `consume_link` (so a stranger cannot lock a victim out); a non-string `email` is `INVALID_PARAMS` | 10 / 60 s each |
| `RL_REDEEM` | `cap.participant.redeem_code`, `cap.participant.open_link` | caller address | 60 / 60 s (a workshop room shares one address) |

Posture: binding absent → allowed only when `ENVIRONMENT` is exactly `dev`; otherwise refused (fail closed). Binding throws → allowed and logged. Known limit of the borrow: counters are per Cloudflare location and eventually consistent — a dampener, not a lockout; no durable per-credential lockout exists yet (residual, tracked in cookbook `prd/18-I-testing.md` phase C).

## MCP authorization (src/worker.ts, src/oauth.ts)

Worker entry is `src/worker.ts`: the borrowed **`@cloudflare/workers-oauth-provider` 0.10.3** (same pin as `klappy/bee-ai-auth-mcp`) sits in front of `POST /mcp`; the Hono app in `src/index.ts` is its default handler and is otherwise unchanged. Storage: KV binding `OAUTH_KV` (hashed clients/grants/tokens + parked authorization requests under `3dr:authreq:`).

| Route | Served by | What |
|---|---|---|
| `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource[/mcp]` | provider | discovery |
| `POST /register` | provider | dynamic client registration |
| `POST /token` | provider | code + PKCE exchange, refresh, revocation |
| `GET /authorize` | app glue | provider validates the request → parked 10 min (KV + `oauth_req` cookie) → 302 to `/v2/auth/access?next=oauth` |
| `GET /v2/auth/access?next=oauth` | app glue (Access-guarded) | identity = verified Access JWT only → consent page naming the app; **no web session is opened** |
| `POST /oauth/consent` | app glue | HMAC ticket + matching cookie + single-use parked request → `completeAuthorization` (props `{principal_id, client_id}`) or `access_denied` |
| `POST /mcp` | provider → `handleMcp` | no/invalid credential → **401 + `WWW-Authenticate`**; provider token → principal re-read from D1 every call, `delegated_by = "oauth:<client_id>"`, never `support`; first-party bearer (web session token, participant token) → accepted through `resolveExternalToken`, unchanged behavior |

Rules: anonymous MCP no longer exists (public docs stay on HTTP: `GET /v2/docs…`). A provider token is **not** a web session — the HTTP face refuses it. `write cap.auth.logout` from a delegated caller revokes that user's grants for that client. Pre-auth metering in `src/worker.ts`: credential-less `/mcp` **and any bearer that cannot be ours by shape** spend `RL_MCP_ANON` (30/60 s) and are refused before any storage lookup; a well-shaped bearer (known or not) and `/token` spend `RL_MCP_CEILING` (600/60 s per address — generous because hosted connectors share egress addresses); `/register`, `/authorize`, `/oauth/consent` spend `RL_MCP_ANON`. Behind the provider the per-message anonymous batch metering in `src/index.ts` is only reachable if a session is revoked mid-request. **Breaking:** a cookie-only web session is no longer accepted on `/mcp` (send it as a bearer). Known residual: consent single-use is KV get→delete, not atomic (same browser, same ticket, truly concurrent → two codes for the same client/user; needs a D1 migration to close). `wrangler.toml` `run_worker_first` lists these paths so static assets never shadow them. `scripts/parity.mjs` now requires `SESS`.

One-way door (17-IRREVERSIBILITY): once real users connect apps in production, deleting `OAUTH_KV` or removing the provider disconnects everyone at once.
