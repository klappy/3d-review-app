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

Borrowed substrate: Cloudflare Workers Rate Limiting bindings (`[[ratelimits]]` in `wrangler.toml`, repeated under `[env.production]` — bindings are not inherited; `test/limiter-boundary.test.ts` parses the file and fails if any binding the code names is missing on either side or shares a namespace id). Namespace ids on the stack: `RL_HTTP_ANON` is `30105` (dev) / `30205` (production) because `RL_MCP_CEILING` on `fable/mcp-oauth` already holds `30104` / `30204` — distinct at the merged head. Two layers: a **transport** limiter per face for callers with no credential (`RL_MCP_ANON` on `POST /mcp`, `RL_HTTP_ANON` on every capability HTTP twin), and **capability** limiters inside `execute()` so the HTTP twin and the MCP tool share one budget, spent before parameter validation, before authorization and before the handler touches storage.

What storage a call can touch before it is refused — the true statement (supersedes the earlier "no credential → zero storage access", which held for five paths out of ~80):

- **Anonymous callers are metered per address on both faces.** A refused call (transport or capability limiter) returns `RATE_LIMITED` and writes **nothing** — no trace row, no feedback row, no receipt. An **allowed** anonymous call on a public row may write its trace row (and, for `POST /v2/feedback`, a feedback row and receipt) — bounded by the anonymous budget of that address (60 requests / 60 s on HTTP, 30 messages / 60 s on MCP).
- **Malformed credentials cost 0 D1.** `resolvePrincipal` admits only the shapes this code mints — `st_`/`pt_` + 32 chars of `[A-Za-z0-9_-]` — and treats anything else (`Bearer garbage`, a provider-shaped `a:b:c` token, a junk cookie) as anonymous without a lookup; the anonymous budget above then applies.
- **Well-formed unknown tokens cost indexed D1 SELECTs per request** — 2 for a bearer (`session`, then `participant_session`), 1 for a `session` cookie (cookies never reach the participant lookup) — on **every** request including the ones the limiter then refuses, because `resolvePrincipal` runs before any limiter. **Residual R1 — PROPOSED; ACCEPTED by independent review 5708112856:** well-formed unknown `st_`/`pt_` tokens: 2 D1 reads per request as a bearer (1 as a cookie), **unbounded per address on HTTP** (and on MCP); the caller collapses to anonymous, so **writes** are bounded by the anonymous budget (a refused request writes nothing) — reads are not. Rejected alternative: a pre-resolution credential meter (a second binding spent before the lookup); revisit only on a field receipt showing abuse.
- **Capability limiters spend the address unit first, then validate.** A non-string `email` on the sign-in caps is `INVALID_PARAMS` only after a unit was spent, so it traces at the same 10 / 60 s rate as a wrong code and can no longer be an unlimited write path.

A refused call returns the contract error `RATE_LIMITED` with `error.data.retry_after = 60` in the envelope on both faces and both layers (HTTP capability or transport refusal: `429` + `retry-after: 60` + the envelope; MCP capability refusal: the `200` envelope; MCP transport refusal: JSON-RPC `-32029` with `data.code = "RATE_LIMITED"`, `data.retry_after = 60` + `retry-after`) and writes **no** trace row.

**Residual R4 — PROPOSED (independent review 5708112856 #2; not fixed, out of this PR's scope):** on MCP only, `tools/call` on a sign-in capability that fails *before* the capability limiter — `WRONG_TOOL_FOR_CLASS` (wrong tool for `cap.auth.*`) or `INVALID_PARAMS` from `execute()`'s pre-limiter checks (params not an object, unknown capability) — still persists a trace row (`dispatch.ts` skips the trace only for `RATE_LIMITED`). For an anonymous caller this is bounded by `RL_MCP_ANON` (≤ 30 rows / 60 s / address); for a **signed-in** caller it is unbounded per credential (a signed-in caller can always write trace rows at will by calling any capability it holds, so this adds no new write class, only a cheaper one). Closer: skip the trace for pre-limiter `CapError`s or move the limiter ahead of those checks — both change the "every outcome traces" rule and need their own review.

| Binding | Counts | Key | Limit |
|---|---|---|---|
| `RL_MCP_ANON` | every anonymous `POST /mcp`, **one unit per JSON-RPC message** in a batch (signed-in callers are not counted); any batch over 10 messages is refused (`-32600`) for every caller | caller address | 30 / 60 s |
| `RL_HTTP_ANON` | every anonymous request on any capability HTTP twin (public rows, 401 rows, 501 rows alike), spent after credential resolution and before the body is parsed; credential holders are not counted | caller address | 60 / 60 s (a workshop room shares one address) |
| `RL_AUTH` | `cap.auth.request_link`, `cap.auth.consume_link` | caller address — **one `ip:` key shared by both caps, so the budget is 10 / 60 s combined per address, not each** (splitting the key would double the per-address attacker surface; decision recorded). `request_link` additionally per sha256(trim+lowercase email) — the same normaliser the handler hashes into `login_code`. A non-string `email` is `INVALID_PARAMS` after the address unit is spent. **Known residual (consume) — PROPOSED:** no per-email guess limit on `consume_link` (a bare email key would let a stranger lock a victim out; needs an attempts counter on `login_code` = a migration). **Known residual (issuance) — PROPOSED:** the bare `em:` key on `request_link` means a stranger rotating addresses can exhaust a victim's code *issuance* for the window (not their sign-in: `consume_link` is per-address). Both are dev-only paths; dev returns the code in-band and production sign-in is Cloudflare Access | 10 / 60 s combined per address |
| `RL_REDEEM` | `cap.participant.redeem_code`, `cap.participant.open_link` | caller address | 60 / 60 s (a workshop room shares one address) |

Posture: binding absent → allowed only when `ENVIRONMENT` is exactly `dev`; otherwise refused (fail closed) and logged as `ratelimit.binding_absent <name>` so a misdeploy is distinguishable from a throttle. Binding throws → allowed and logged (`ratelimit.binding_failed`). Known limits of the borrow: counters are per Cloudflare location and eventually consistent — a dampener, not a lockout; no durable per-credential lockout exists yet (residual, tracked in cookbook `prd/18-I-testing.md` phase C). **Residual R2 — PROPOSED; ACCEPTED by independent review 5708112856:** a request without `cf-connecting-ip` keys as `ip:unknown` — one shared bucket; correct behind Cloudflare (the header is always set there), wrong on any non-Cloudflare path. **Residual R3 — PROPOSED; ACCEPTED by independent review 5708112856:** no body-size ceiling of our own in front of the `/mcp` double parse or the HTTP body parse; the Workers platform request-body limit (100 MB on the paid plan) is the only bound. Trace ids are per JSON-RPC message: one row per `read` / `write` / `danger` `tools/call` in a batch (`docs` calls persist no row; `trace.trace_id` is the primary key).
