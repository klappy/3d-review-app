# Outbound mail (OF-3) — `src/mail.ts`

**State: adapter built, sender NOT configured. Every invitation answers `delivered:false` until the captain completes the gate below.**

| Rule | Behavior |
|---|---|
| Provider | Resend HTTP API, one `POST https://api.resend.com/emails`, `Idempotency-Key: invite/<invitation id>` |
| Who sends | only `ENVIRONMENT === "production"`; dev/anything else → `delivered:false, reason:"not_production"` |
| Not configured | `RESEND_API_KEY` or `MAIL_FROM` missing → `reason:"not_configured"` |
| Address shape | exactly one plain **ASCII** mailbox (`normalizeAddress`; letters, digits, `. _ % + -`; punycode hosts and TLDs accepted; quoted local parts and `' / =` refused loudly rather than sent and bounced): display names, lists, whitespace, CRLF, trailing dots, dotless hosts → handler `INVALID_PARAMS`; adapter `reason:"invalid_address"` |
| Synthetic recipients | `.invalid`, `.test`, `.example`, `.localhost`, `.local`, `example.com/net/org` **and their subdomains** are never mailed → `reason:"synthetic_recipient"` |
| Intent de-duplication | decided and written in **one SQL statement** (`INSERT … SELECT … WHERE NOT EXISTS`), so concurrent replays cannot both pass. A live duplicate = a `sent` row for the same scope+invitee in the last 10 minutes, or a `pending` row younger than 30 s (an in-flight twin). Older `pending` rows were never mailed and do **not** block a retry. Duplicate → existing invitation, `reason:"duplicate_recent"`, nothing sent. Same person, **different role** inside the window → `INVALID_PARAMS` pointing at `cap.grant.revoke_invitation` |
| Inviter cap | 30 **collaborator** invitations per inviter per hour (participant-link rows from `cap.survey.issue_link` are not counted) → `RATE_LIMITED`. The HTTP `retry-after: 60` header is the generic one; the hint says the cap resets over the hour |
| Row status | `sent` only after the provider accepted; otherwise `pending` |
| Timeout | 8 s (`AbortSignal.timeout`) → `provider_unreachable` |
| Provider says no / is down | `reason:"provider_error"` (+ status) / `"provider_unreachable"`; the capability still succeeds and the invitation exists — re-invite to retry |
| `delivered:true` means | the provider **accepted** the message. Inbox arrival is not claimed |
| Privacy | the address is never logged, traced or returned — spans carry no hash of it either (an unsalted prefix would let a guessed address be confirmed) |
| Link | `${PUBLIC_ORIGIN}/#invite=<token>` (fragment, like `/#session=` — never reaches a server or an edge log) — `PUBLIC_ORIGIN` is a per-environment var in `wrangler.toml` |

## Captain gate (HUMAN-ONLY: secret) — three steps, no seat touches the key
1. Resend → Domains → add and verify a sending domain (DNS records on the klappy.dev zone).
2. Resend → API Keys → create a key with **Sending access only**, restricted to that domain.
3. Cloudflare → Workers → `3d-review` → Settings → Variables and Secrets → add secret `RESEND_API_KEY` and secret (or var) `MAIL_FROM`, e.g. `3D Review <no-reply@YOUR-DOMAIN>`.

## Wired
- `cap.grant.invite` (danger/effect): sends the collaborator invitation; result carries `delivered` + `delivery.reason`.

## Not wired — named gaps
- `cap.survey.send_links` still answers `RESERVED_NOT_BUILT`: `issue_link` stores only a token **hash** and an invitee **hash**, so at send time neither the link nor the address exists to mail. Needs a contract decision (proposal on cookbook #14): recipients supplied at send time, token minted at send. Lane A file.
- The UI has no `/#invite=` landing yet (Lane A / Design pen): until it does, a mailed link opens the shell but does not auto-accept; `POST /v2/invitations/{token}/accept` (or MCP `danger cap.grant.accept`) works with the token.
- `INTERFACE.md` pointer to this file is deferred to avoid a three-way conflict with open PRs #12/#15 (both append to that file's end); add after they merge.

## Message text (exact)
Subject: `You have been invited to 3D Review`

```
You have been invited to join a <workspace|project|assessment> in 3D Review as <owner|member|viewer>.

To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.

<link>

The invitation expires in 7 days and only works for this email address. If you were not expecting it, you can ignore this message.
```

Merge order: this branch carries `fable/rate-limits` (app #12) for the `RATE_LIMITED` error code — merge #12 first.
