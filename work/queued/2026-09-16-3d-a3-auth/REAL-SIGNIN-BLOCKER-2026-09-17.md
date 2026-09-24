# Real sign-in blocker — diagnosis, minimal fix, human-only binding

Owner: Auth seat (cos door), session `claude-opus-5`. START 2026-09-17T12:12:33Z (observed). **Read-only source verification at deployed `f3858d72`. Nothing mutated. No impersonation, no grant invented, no account identity fabricated, no secret handled.** App-request budget untouched (49/50, 2 rows).

Chris reports he cannot actually sign in; only synthetic logins work. **He is right.** Root's earlier equation of a visible `/v2/auth/access` route plus a code form with usable real authentication is withdrawn, and the source states the reason explicitly. This is a demo blocker, and it is not satisfied by the synthetic code form.

## Two independent walls, both confirmed in code

### Wall 1 — the code form refuses a real email, by design, in every environment

`cap.auth.request_link`, `src/handlers/platform.ts:25-33`:

| Environment | Behaviour | Anchor |
|---|---|---|
| DEV (`ENVIRONMENT="dev"`) | `if (dev && !SYNTHETIC_DOMAIN.test(email)) throw INVALID_PARAMS "dev sandbox accepts only synthetic identities (name@…example.invalid)"`, hint *"no real email is ever accepted or contacted from the dev environment"*; `SYNTHETIC_DOMAIN = /\.invalid$/i` | `platform.ts:25,31` |
| Production | `if (!dev) throw RESERVED_NOT_BUILT "email-code delivery is not wired in this environment yet"`, hint *"production sign-in is Cloudflare email-code (OF-7); pending the auth lane"* | `platform.ts:32` |

So the code form is **synthetic-only** on DEV and a **stub** in production. It is not a real login page anywhere and was never built to be one. It is working exactly as written — the defect is in the expectation, not the code.

### Wall 2 — even through Access there is no usable account, and no code path can create one

`GET /v2/auth/access` (`src/index.ts:123-143`) is the only real-identity route. It creates `usr_<uuid>` with **`provisioned = 0`, `support = 0`, zero grants**.

- **`provisioned` is never set at runtime.** The only two writes to `principal` in the entire source are `INSERT OR IGNORE … VALUES (?,?,?,?,?)` (`index.ts:128`; `platform.ts:37`). There is **no `UPDATE … provisioned`** anywhere in `src/`.
- `cap.workspace.create` / `cap.project.create` require **"provisioned creator (D1)"**; `cap.request.create` ("any signed-in") is only the *request* route; the sole row labelled HUMAN-ONLY provisioning is `cap.support.acts_as`, which is **501 / not built** (`src/handlers/support.ts:3`).

**Structural finding: the product has a provisioning REQUEST path with no APPROVAL path.** A real human can sign in (given admission), file a request, and nothing in the running system can grant it. He lands in an empty app with no workspace, no project, and no way to create one. This is the real blocker behind the cosmetic one.

## The required distinction

- **Unconfigured admission / provider — partially verified, one unknown left.** An Access application *does* front the route on the dev hostname: a read-only probe at 09:39Z returned `302 → klappy.cloudflareaccess.com/cdn-cgi/access/login/3d-review-dev.klappy.workers.dev?…` with meta `auth_status: "NONE"`, `service_token_status: false`. Two apps are configured in code: dev `ACCESS_AUD 8a1c3507…` (`wrangler.toml:12`), production `584596733c…` (`:62-63`). **Whether the dev policy admits `chris@klappy.dev` and whether an IdP is enabled is not verifiable from this seat** — no Cloudflare tooling or credential here (all CF env vars unset, no `~/.wrangler`, tool search empty). The coordinator author with callable CF access is supplying that metadata.
- **Unprovisioned principal — independently and definitely true.** Fixing admission alone does **not** produce a working account. Both walls must fall.

## Smallest concrete fix — two parts

**Part A — admission (provider; console/API, minutes).** On the Access application fronting `/v2/auth/access` on `3d-review-dev.klappy.workers.dev` (AUD `8a1c3507…`): an identity provider that can reach his real mailbox — **one-time PIN is simplest and adds no new provider** — and a policy **including `chris@klappy.dev` specifically**. Not a domain-wide rule, not a wildcard, not `all_preview_workers`. Policy action must be **Allow** (not Bypass): a Bypass policy injects **no** `cf-access-jwt-assertion`, so `verifyAccessJwt` refuses at `src/access.ts:41` and the route fails closed — a plausible current cause worth checking first. Same applies to the production app when prod goes live, since production's only sign-in is Access (Wall 1).

**Part B — authorization: ONE field on ONE row (HUMAN-ONLY).** After his **first successful** Access sign-in creates his principal row, set `provisioned = 1` on exactly that row. That single flip is the whole fix: it lets him create his **own** workspace → project → assessment, each auto-granting him owner in the same D1 batch (`workspace.ts`, `project.ts`, `assessment.ts:27-30`). **He needs no grant on the synthetic estate, never touches `person_mara`'s data, and nothing is impersonated.**

```sql
-- after his first Access sign-in only; confirm the row is his before writing
SELECT id, email_hash, provisioned, support, created_at FROM principal
WHERE id LIKE 'usr_%' ORDER BY created_at DESC LIMIT 5;

UPDATE principal SET provisioned = 1 WHERE email_hash = :his_email_hash;  -- expect changes = 1
```

`:his_email_hash` = `sha256(lowercase(trim(email)))`, the app's own normaliser (`common.ts:32`). **The hash is deliberately not computed or published here** — it is a pseudonymous identifier for a real person and #14 is semi-public.

**Exact HUMAN-ONLY binding.** This write is a direct mutation of the shared DEV D1 that **no capability implements and no receipt covers**. It cannot be delegated to any seat or worker and leaves no audit trail of its own. Conditions: (i) performed by the human/root holding provider access; (ii) one row, matched on that one `email_hash`, `changes = 1` verified; (iii) recorded on #14 as the audit, since the write produces none; (iv) never generalized to a domain, pattern, or additional principals; (v) `support` stays `0`. This seat will not perform it and should not be able to.

## Metadata needed to close the remaining unknown (secret-free)

For the dev Access application (AUD `8a1c3507…`), from the coordinator author:

1. Does an application exist, and what is its host/path scope — `/v2/auth/access` only, or the whole hostname?
2. Is at least one identity provider enabled on it, and is one-time PIN among them?
3. Does any policy **include** `chris@klappy.dev`? Rule *shape* only (email / domain / group) plus include-or-not — no full policy dump needed.
4. **Policy action: Allow, Bypass, or Service Auth?** (Bypass ⇒ no JWT injected ⇒ route fails closed — see Part A.)
5. Session duration.
6. Same for the production app (`584596733c…`): does it exist and front `3d-review.klappy.dev`?

None of that requires a secret value. Answers 1–4 determine whether Part A is already done or is the current cause.

## Preview-builds capability — my claim retracted

Root observed the actual Cloudflare OpenAPI / Workers Builds API reference: **`POST /accounts/{account_id}/builds/triggers` does include `branch_includes` / `branch_excludes`** along with existing token and repo references (current `GET` shows only `main`). My v2 statement that those fields do not exist and that no second trigger is possible is **withdrawn** — my reviewer reasoned from the dashboard branch-control documentation, which describes the UI checkbox, not the API surface. Root's direct observation of the API is authoritative and my inference was wrong. Preview execution is transferred to the coordinator author with callable CF access and independent review; I am spending no further time on it, and sign-in was never serialized behind it.

## Status

Diagnosis, minimal fix and human-only binding are complete as of 12:12:33Z. Remaining work is human/provider action — Part A in the Access console, one sign-in attempt, then Part B's single `UPDATE` — realistically ~10–15 minutes, none of it blocked on this seat. If the metadata shows the policy already admits him with an Allow action and an IdP, Part A is already done and only Part B remains.

## Addendum 12:18Z — WITHDRAWN (12:40Z)

The 12:18Z addendum asserted "authentication SUCCEEDED" from source alone; no successful sign-in was observed by anyone. Its text is removed; see #14 5714392951 and the addendum below. The `provisioned = 1` step in the body above is likewise not actionable until a real sign-in is observed.

## Addendum 12:40Z — CORRECTION + bounded logged-out diagnosis (12:28–12:40Z observed; model claude-fable-5-1)

**Withdrawn.** My comment 5714232326 ("authentication SUCCEEDED; the UI rendered the unprovisioned state") and the 12:18Z addendum in kitchen `cad1d111` (`rail/1-ordered/2026-09-16-3d-a3-auth/REAL-SIGNIN-BLOCKER-2026-09-17.md`) were a source-derived hypothesis stated as observed fact. Nobody observed a successful sign-in. Klappy states he never signed in; that stands. No inferred identity, no account query, no provisioning write is proposed from this seat. The "one `provisioned=1` flip remains" claim is likewise withdrawn until a real sign-in is observed.

### What I actually observed (built-in browser on the captain's machine, logged out, no credentials entered, nothing written)
1. `GET /` on `3d-review-dev.klappy.workers.dev` → marketing home; no cookies, empty sessionStorage; identity badge `Not signed in`.
2. `#facilitator` → workspace view shows the **Sign in** panel: Access button *plus* two synthetic forms (email prefilled `demo.owner@example.invalid`) in one card. Three ways in, one real.
3. Click **Sign in with an email code** (`/v2/auth/access`) → lands on `klappy.cloudflareaccess.com/cdn-cgi/access/login/3d-review-dev.klappy.workers.dev` with Access meta `aud=8a1c3507…`, `hostname=3d-review-dev.klappy.workers.dev`, `redirect_url=/v2/auth/access`, `auth_status=NONE`; page "Log in to 3D Review dev — email-code sign-in", one Email field + "Send login code". **First hop works in this in-app browser.** I stopped there (no OTP, no account).

Not observed by anyone: OTP delivery/submission, the return to `/v2/auth/access`, the `302 /#session=`, `/v2/me`. Everything after step 3 is unverified.

### Why "back on the homepage" is what a FAILED return looks like (code fact, `f3858d72`)
- `ui/app.js:498` clears `#session=` to a bare `/`, then `:536-538` calls `/v2/me`; **any** failure is swallowed (`catch {}` — no message) and the badge is set to `Not signed in`.
- `ui/public-entry.js:4-9`: not authenticated + empty hash ⇒ view `home` ⇒ the marketing page. A successful `/v2/me` would force view `workspace` (badge `user · usr_…`).
- A failure *inside* `/v2/auth/access` returns a JSON error body, not the homepage (`src/index.ts:140-142`).
So: **marketing homepage after the round-trip ⇒ either Access never returned to `/v2/auth/access`, or `/v2/me` failed and the UI hid the reason.** The app currently cannot tell the user which. That is the diagnosability defect.

### Smallest fix (UI only; Design custody; existing provider and session, no auth change)
1. `app.js:536-538`: on the Access-return path, do not swallow — write the error (`code` + trace) into the sign-in panel ("Sign-in did not complete: …") and keep the view on `#facilitator` (replaceState to `/#facilitator`, not `/`). ~3 lines.
2. Hide `#signin-panel` when the badge is authenticated (same pattern as `style.css:86` for `#signout`). 1 CSS line.
3. Sign-in panel: on `/` and `#facilitator`, show the Access button alone; fold the synthetic forms under a "Sandbox identities (dev)" disclosure. Copy/markup only — Design's four-choice entry decides placement.
With (1) in place, one more attempt by Klappy yields a *reason* instead of a homepage, and this seat can act on a fact.

### Distinguishing test needing no code, no credentials, no query
Klappy (or root, in the browser where the attempt happened): top-right badge text and URL right after the round-trip. `Not signed in` on `/` ⇒ return failed (above). `user · usr_…` ⇒ session exists. Anything else (JSON page, Access error) ⇒ paste the `code`. Do not retry the login for my benefit.

### Standing gaps (unchanged, recorded)
No Cloudflare/D1 tooling at this seat; root IAB connector unavailable; provisioning approval path not built (`cap.support.acts_as` 501). Stay on claude-fable-5-1 for next work.
