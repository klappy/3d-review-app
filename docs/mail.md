# Outbound mail (OF-3) — `src/mail.ts`

**State: adapter built, sender NOT configured. Every invitation answers `delivered:false` until the captain completes the gate below.**

| Rule | Behavior |
|---|---|
| Provider | Resend HTTP API, one `POST https://api.resend.com/emails`, `Idempotency-Key: invite/<invitation id>` |
| Who sends | only `ENVIRONMENT === "production"`; dev/anything else → `delivered:false, reason:"not_production"` |
| Not configured | `RESEND_API_KEY` or `MAIL_FROM` missing → `reason:"not_configured"` |
| Synthetic recipients | `*.invalid`, `*.test`, `*.example`, `example.com/net/org` are never mailed → `reason:"synthetic_recipient"` |
| Provider says no / is down | `reason:"provider_error"` (+ status) / `"provider_unreachable"`; the capability still succeeds and the invitation exists — re-invite to retry |
| `delivered:true` means | the provider **accepted** the message. Inbox arrival is not claimed |
| Privacy | the address is never logged, traced or returned; spans carry an 8-char hash prefix |
| Link | `${PUBLIC_ORIGIN}/?invite=<token>` — `PUBLIC_ORIGIN` is a per-environment var in `wrangler.toml` |

## Captain gate (HUMAN-ONLY: secret) — three steps, no seat touches the key
1. Resend → Domains → add and verify a sending domain (DNS records on the klappy.dev zone).
2. Resend → API Keys → create a key with **Sending access only**, restricted to that domain.
3. Cloudflare → Workers → `3d-review` → Settings → Variables and Secrets → add secret `RESEND_API_KEY` and secret (or var) `MAIL_FROM`, e.g. `3D Review <no-reply@YOUR-DOMAIN>`.

## Wired
- `cap.grant.invite` (danger/effect): sends the collaborator invitation; result carries `delivered` + `delivery.reason`.

## Not wired — named gaps
- `cap.survey.send_links` still answers `RESERVED_NOT_BUILT`: `issue_link` stores only a token **hash** and an invitee **hash**, so at send time neither the link nor the address exists to mail. Needs a contract decision (proposal on cookbook #14): recipients supplied at send time, token minted at send. Lane A file.
- The UI has no `/?invite=` landing yet (Lane A / Design pen): until it does, a mailed link opens the shell but does not auto-accept; `POST /v2/invitations/{token}/accept` (or MCP `danger cap.grant.accept`) works with the token.
- `INTERFACE.md` pointer to this file is deferred to avoid a three-way conflict with open PRs #12/#15 (both append to that file's end); add after they merge.

## Message text (exact)
Subject: `You have been invited to 3D Review`

```
You have been invited to join a <workspace|project|assessment> in 3D Review as <owner|member|viewer>.

To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.

<link>

The invitation expires in 7 days and only works for this email address. If you were not expecting it, you can ignore this message.
```
