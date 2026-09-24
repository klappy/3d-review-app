# Bounded config spec — non-production preview builds (v2, after independent config review)

> **v1's actionable section was wrong and is replaced.** v1 specified a *second trigger* with branch include/exclude fields. Workers Builds has **no such fields** and already turns non-production-branch builds into version uploads natively. The correct action is **one checkbox on the existing trigger** — strictly less work than v1 asked for, and it reuses the existing connection and token by construction. v1's §2.4 also gave false comfort about Access; corrected in §2.4 below. Independent reviewer: separate Opus agent, verdict CHANGES REQUIRED, all edits applied.

Owner: Auth seat (cos door), session `claude-opus-5`. START 2026-09-17T11:59:40Z (observed). **Read-only assessment + spec. Nothing mutated.** No migrations, no seed, no shared writes, no new credential/spend/access grant, no auth policy change. App-request budget untouched (49/50, 2 rows). Source read at app main `f3858d72f95321c622e1bfee559bb645afba1fe0`.

## 0. Capability gap — I cannot execute this order myself

**No Cloudflare tooling and no Cloudflare credential exist in this session.** Verified, existence-only: `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ACCOUNT_ID`, `WRANGLER_API_KEY` all **unset**; no `~/.wrangler`; no credential file in the scratchpad; a tool search for Cloudflare/Workers-Builds tooling returns nothing. So I **cannot**:

- read trigger `b82be56e-33f0-43d5-bf24-3749dd4dc168` (including its build-token reference), and
- create the new trigger.

Root verified the Worker flags via the Cloudflare API and holds that access. This document is therefore the **exact spec plus independent review** for root to apply — which is also the order's own sequencing ("independent bounded config review before mutation; then enable under user authority and readback"). I read everything that *is* readable from here: the Wrangler config, the bindings, the route topology, and the build-check state on the actual commits.

## 1. Wrangler preview setting — verified, and **no config change is needed**

`wrangler.toml` at `f3858d72` contains **no `workers_dev` key and no `preview_urls` key** — at top level or under `[env.production]`. Both therefore take their defaults, and the Worker-level flags root already confirmed (`subdomain enabled: true`, `previews_enabled: true` on Worker `3d-review-dev`, tag `b0b4617b8a3f49679e4d54ac876b6c73`) are what actually govern preview URLs.

**Recommendation unchanged: add neither key** — but the reasoning in v1 was inverted and is corrected. Precedence per Cloudflare docs: `preview_urls` **defaults from `workers_dev`**, and the Wrangler file is authoritative on the *next* `wrangler deploy` — if the flags are changed in the dashboard without updating the file, the file wins at the next deploy. The dashboard flags root read and the file agree **today only because both keys are absent and both default to `true`**. Consequence worth recording: anyone who later sets `workers_dev = false` silently kills preview URLs. Also verified: `grep -c durable_objects wrangler.toml` = **0**, so the documented "no preview URLs for Durable Object Workers" limitation does not apply here.

## 2. DEV bindings — verified shared, and this is the order's main risk

A version upload inherits the top-level bindings verbatim. These are **shared production-of-record dev resources, not disposable**:

| Binding | Value | Anchor |
|---|---|---|
| D1 `DB` | `3d-review-dev` / `5d4cc260-a7b1-47cc-b03d-ed4f60d324c3` | `wrangler.toml` `[[d1_databases]]` |
| KV `OAUTH_KV` | `05b0c783c8d14c2ebce39f3e5073d91f` | `[[kv_namespaces]]` |
| Rate limiters | `RL_MCP_ANON` 30101, `RL_HTTP_ANON` 30105, `RL_AUTH` 30102, `RL_REDEEM` 30103, `RL_MCP_CEILING` 30104 | five `[[ratelimits]]` blocks |
| Vars | `ENVIRONMENT = "dev"`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` (public) | `[vars]` |
| Assets | `[assets] directory = "./ui"` with `run_worker_first` for `/v2/*`, `/mcp*`, OAuth paths | `[assets]` |
| `[[rules]]` | Text modules for `**/*.yaml`, `seed/*.sql` (this is how the seed asset is compiled in) | `[[rules]]` |
| **Script secrets (MISSING from v1)** | **`SESSION_SECRET`, `CODE_ESCROW_SECRET`** — script-level, inherited by **every** uploaded version with live dev values (incl. code-escrow encryption) | `.dev.vars.example`; `src/code-escrow.ts:10-13` |

**Consequences that must be stated before enabling, not after:**

1. **Every preview URL reads and writes the real DEV D1.** `wrangler versions upload` does not create a database; it publishes code against the same bindings. The order already says "versions share bindings, not disposable DB" — this confirms it from config, and it is the reason a preview link is an *audit* surface, not a sandbox.
2. **Because `[assets]` is bound, a preview URL is a full app front door**, UI shell included — not an API-only endpoint.
3. **Each preview URL is a new public hostname onto that same database, and sessions cross hostnames.** The dev email-code sign-in is app-level and works on any hostname, and the session hash lives in the **shared dev D1** (`src/auth.ts:27`) — so **a session minted on a preview hostname is a valid Bearer on `3d-review-dev.klappy.workers.dev`**. Per my R2 classification (#14 c5713891391) that is a self-service door to `person_mara` (provisioned owner). **No auth policy change is authorized or proposed here; this is disclosure so the decision is made knowingly.**
4. **Further unauthenticated surfaces live on every preview host (missing from v1):** `/register` (OAuth dynamic client registration) is an anonymous path writing client records into the shared `OAUTH_KV` (`src/worker.ts:89`); `POST /v2/ops/seed/synthetic` is gated on `ENVIRONMENT === "dev"` and is therefore **enabled on previews** (needing only a signed-in user, which point 3 supplies for free) — so "versions upload does not seed" is true of the deploy mechanism and false of the resulting hostname.
5. **Shared rate limiters are a coupling, not just a shared binding.** All five namespaces are keyed by client IP (`src/index.ts:110`; `src/worker.ts:81`), so preview traffic spends the **same** `RL_AUTH` / `RL_MCP_ANON` / `RL_MCP_CEILING` buckets as the canonical dev host. **Noise on a preview can rate-limit the demo.** Worth knowing inside a demo window.
6. **Preview traffic is not observable Cloudflare-side.** Documented limitation: no Workers Logs, no `wrangler tail`, no Logpush for preview URLs. The app's own `trace` table still records spans, but per-hostname attribution is unavailable — so v1 calling previews an "audit surface" was backwards in the observability sense. They are an *inspection* surface for reviewers; they are not auditable infrastructure.
7. **Access fails closed on previews — but Access is NOT the dev auth boundary, so this is not reassurance.** The Access application is bound to `3d-review-dev.klappy.workers.dev`; a preview hostname is not covered, so no `cf-access-jwt-assertion` is injected and `GET /v2/auth/access` refuses (`src/access.ts:41`). v1 framed that as "the good news" — **withdrawn.** The effective dev boundary is the in-band code: `POST /v2/auth/link` returns `dev_only_code` in the response body wherever `ENVIRONMENT="dev"` (`src/handlers/platform.ts:39`), on any hostname, and `:44-56` consumes it into a real session. **Net: preview hostnames are *more* exposed than the canonical host, not less** — same self-service owner path, plus no Cloudflare-side logging.

**Documented option, offered not taken (§2.5):** Cloudflare Access supports first-class destination types **`preview_worker`** and **`all_preview_workers`**, so previews can be gated behind the existing Zero Trust policy **without any wildcard and without touching the existing application**. Precision: that gates the *host*; it will not make `/v2/auth/access` work on previews, because that app's AUD ≠ `ACCESS_AUD` and `src/access.ts:53` refuses an assertion issued for another application — which is the correct outcome (sign-in stays on the canonical host; previews become staff-viewable only). This is root's/captain's call, not mine, and I am not proposing an auth policy change.

## 3. Production isolation — verified safe, with one hard condition

`[env.production]` is a separate Worker (`name = "3d-review"`), separate route (`pattern = "3d-review.klappy.dev"`), separate D1, separate KV, and separate limiter namespaces (302xx). A **top-level** version upload cannot reach any of it.

**Hard condition:** the new trigger's deploy command must **not** pass `--env production`. With `--config wrangler.toml` and no `--env`, the top-level (dev) block is what is uploaded.

## 4. The actual change — ONE checkbox on the existing trigger; do NOT create a second one

**v1 was wrong.** Workers Builds does not expose "branch include / branch exclude" fields, and it does **not** need a second trigger: for commits to any branch other than the configured production branch, the build's deploy command is **replaced with a non-production deploy command that already defaults to `npx wrangler versions upload`**. So the capability the order asks for is native.

**What root does, on the existing trigger `b82be56e-33f0-43d5-bf24-3749dd4dc168`:**

| Setting | Value | Note |
|---|---|---|
| Branch control → **production branch** | `main` | confirm it is already this |
| **"Builds for non-production branches"** | **tick / enable** | this is the entire change |
| Deploy command | **leave as `npx wrangler deploy`** | production path unchanged; `main → DEV` route preserved |
| Non-production branch deploy command | leave at default, or set explicitly to `npx wrangler versions upload` | explicit is self-documenting; **no `--env`** |

**Everything v1 asked for beyond this is deleted:** no new trigger, no second repo connection, no build-token question (reuse is automatic because the trigger is unchanged), no branch include/exclude rows. This satisfies "reuse existing token/repo, no new spend/credential/access grants" more strictly than v1 did — and it removes the undocumented risk v1 would have introduced, since Workers Builds documents one git connection per Worker and says nothing about two overlapping triggers coexisting.

**Isolation still holds:** `versions upload` with no `--env` targets the top-level (dev) block; `[env.production]` is a separate script (`3d-review`) with its own route, D1, KV and limiter namespaces, so production is untouchable by this path. `versions upload` runs no migrations, does not seed, does not change the deployed version, and does not alter any route — at the *mechanism* level. The resulting hostname is a different matter (§2.3–§2.6).

## 5. Preview link + commit proof for PR 44 — **not available yet, and here is the proof**

**Superseded by the release update:** PR #44 is now **merged as `28a45856`**, and its provider build **`b0d6` failed before deploy** — report-corpus test 60182 ms against a 60000 ms limit, 383/384 with **no assertion mismatch** (a harness budget overrun, not a behavioural failure). The root coordinator's author/reviewer own that repair; I am not duplicating it. **Currently verified live remains `f385…`, not `28…`.** The pre-merge read below stands as the negative proof that no preview existed at that head.

PR **#44** `integration/demo-combined-6` → `main`, head **`ad1b822a4cab0e501bcb1d862a4954b8441fec3e`** (read while open).

Check-runs on that exact head: **1 total — `Cursor Bugbot` (in_progress). No Workers Builds check.** So there is **no preview build and no preview URL for PR44 right now** — precisely because the non-production trigger in §4 does not exist yet. I am not going to synthesise a link, and no manual deployment was performed.

For contrast, current main `f3858d72` carries exactly one build check: **`Workers Builds: 3d-review-dev` — completed / success**, `details_url` on the Cloudflare dash under account `b03e6ea242724c05eb97eb732cceb21d` (matching root's account). That is the shape the new trigger will add on non-main branches, and the readback after §4 should be: a `Workers Builds: 3d-review-dev` check appearing on `ad1b822a` (or the then-current PR44 head) with its version preview URL.

## 6. Stale documentation found (flag only, not mine to edit)

`wrangler.toml:2` still reads `dev : branch phase-0/walking-skeleton → worker 3d-review-dev`. The actual trigger is **Dev Deploy on `main`** (root's read). That comment predates the parity rebuild and is now wrong — consistent with the stale-base finding in my core-queue reconciliation (`phase-0/walking-skeleton` frozen at `10f5f444`, main 108 ahead). Worth one line in whichever change next touches that file; I am not editing it under a read-only order.

## 7. Estimate and sequencing

- **Spec + independent review: ~15 min from 11:59:40Z** — i.e. complete well inside the 08:30 ET (12:30Z) target.
- **Root's CF mutation:** minutes, once the review is consumed (one trigger create; nothing else).
- **Readback:** builds fire on **push events** to a non-production branch, so enabling the checkbox will **not** retroactively build any existing head (v1's "no new push needed" is withdrawn as unsupported). Evidence to expect on the next commit to any non-`main` branch: a **`Workers Builds: 3d-review-dev` check run** *and* the **PR comment carrying the preview URL** — that comment is the artefact the order actually wants. A dashboard-initiated build is the alternative. **No manual deployment either way.**
- Parallel with Design/release; nothing here blocks them.

## 8. Residual obligations unchanged

R2/R3 classification received and **no auth policy change is authorized or made here** (#14 c5713891391). Mail (R7/#16), source fidelity (R8/#14, #17), trace redaction (R5), topology (R6/#22), report limits (R4) and S1/R9 all stand exactly as recorded; nothing deferred, nothing re-cooked.
