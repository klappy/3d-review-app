# Outbound mail (OF-3) — `src/mail.ts`

**State: adapter built, sender NOT configured. Every invitation answers `delivered:false` until the captain completes the gate below.**

| Rule | Behavior |
|---|---|
| Provider | Resend HTTP API, one `POST https://api.resend.com/emails`, `Idempotency-Key: invite/<invitation id>` |
| Who sends (fail-closed) | `ENVIRONMENT === "production"`, **or** `ENVIRONMENT === "dev"` **and** the recipient is on the dev allowlist. Any other or missing `ENVIRONMENT` → `delivered:false, state:"not_sent", reason:"not_allowed_env"` |
| Dev allowlist | `MAIL_ALLOWLIST_SHA256`: comma-separated `sha256(trim+lowercase(address))`, each entry exactly 64 **lowercase** hex. Missing, empty, or **one** malformed entry invalidates the whole list → `reason:"not_allowlisted"`; an unlisted recipient → `reason:"not_allowlisted"`. A typo closes the door, it does not silently shrink the list. No address is ever written into config |
| Not configured | `RESEND_API_KEY` or `MAIL_FROM` missing → `reason:"not_configured"`, no fetch |
| Address shape | exactly one plain **ASCII** mailbox (`normalizeAddress`; letters, digits, `. _ % + -`; punycode hosts and TLDs accepted; quoted local parts and `' / =` refused loudly rather than sent and bounced): display names, lists, whitespace, CRLF, trailing dots, dotless hosts → handler `INVALID_PARAMS`; adapter `reason:"invalid_address"` |
| Synthetic recipients | `.invalid`, `.test`, `.example`, `.localhost`, `.local`, `example.com/net/org` **and their subdomains** are never mailed → `reason:"synthetic_recipient"`. Decided **before** any environment, allowlist or configuration check: a dev allowlist entry cannot re-enable a reserved address |
| Intent de-duplication | decided and written in **one SQL statement** (`INSERT … SELECT … WHERE NOT EXISTS`), so concurrent replays cannot both pass. A live duplicate = a `sent` row for the same scope+invitee in the last 10 minutes, or a `pending` row younger than 30 s (an in-flight twin). Older `pending` rows were never mailed and do **not** block a retry. Duplicate → existing invitation, `reason:"duplicate_recent"`, nothing sent. Same person, **different role** inside the window → `INVALID_PARAMS` pointing at `cap.grant.revoke_invitation` |
| Inviter cap | 30 **collaborator** invitations per inviter per hour (participant-link rows from `cap.survey.issue_link` are not counted) → `RATE_LIMITED`. The HTTP `retry-after: 60` header is the generic one; the hint says the cap resets over the hour |
| Row status | `sent` only after the provider accepted; otherwise `pending` — including on `unconfirmed` |
| Timeout | 8 s (`AbortSignal.timeout`) → `state:"unconfirmed"`, `reason:"provider_unreachable"` |
| Privacy | the address is never logged, traced or returned — spans carry no hash of it either (an unsalted prefix would let a guessed address be confirmed) |
| Link | `${PUBLIC_ORIGIN}/#invite=<token>` (fragment, like `/#session=` — never reaches a server or an edge log) — `PUBLIC_ORIGIN` is a per-environment var in `wrangler.toml`. Absent → no link can be built → nothing is sent (`not_configured`) |

## Delivery truth — `delivered` and `delivery.state`

`delivered:true` means **the provider returned 2xx and accepted the message**. It never means the message reached an inbox;
inbox arrival is the provider's to report and this system does not claim it. `delivery.state` says which kind of outcome it was:

| `state` | When | `delivered` | What the operator should read into it |
|---|---|---|---|
| `accepted` | provider 2xx | `true` | handed over for delivery; the recipient has **not** accepted the invitation yet |
| `refused` | provider non-2xx (`provider_status` carries it) | `false` | definitely not sent; re-invite to retry |
| `unconfirmed` | timeout / provider unreachable | `false` | **unknown**: the request may have been accepted on the far side. Not "not delivered" |
| `not_sent` | every pre-fetch refusal (`invalid_address`, `synthetic_recipient`, `not_allowed_env`, `not_allowlisted`, `not_configured`, `duplicate_recent`) | `false` | nothing left the system |

`unconfirmed` is the load-bearing one. On `unconfirmed` the adapter does **not** retry, the handler does **not** replay and no
second invitation is created inside that call; the invitation row stays `pending`, because we cannot say it was sent, and the
result text says the recipient has not accepted. The `Idempotency-Key` is `invite/<invitation id>`, so a later manual re-invite
of the **same** invitation cannot double-send at the provider.

**Named residual (no schema in M1):** an `unconfirmed` row is indistinguishable in the database from a never-mailed `pending`
row, so after 30 s it becomes eligible for the "never mailed, do not block a retry" path. A re-invite then creates a *new*
invitation with a *new* idempotency key and could produce a second mail for a send that may already have gone out. Closing this
needs a delivery-state column on `invitation` (schema change, out of scope here).

## Captain gate (HUMAN-ONLY: secret) — no seat touches the key
1. Resend → Domains → add and verify a sending domain (DNS records on the klappy.dev zone).
2. Resend → API Keys → create a key with **Sending access only**, restricted to that domain.
3. Cloudflare → Workers → Settings → Variables and Secrets:
   - secret `RESEND_API_KEY` (production, and dev if dev sending is wanted)
   - var `MAIL_FROM`, e.g. `3D Review <no-reply@YOUR-DOMAIN>`
   - var `MAIL_ALLOWLIST_SHA256` on the **dev** worker only: `sha256` hex of each address allowed to receive dev mail.

No values for any of these live in git. `PUBLIC_ORIGIN` is the only mail-related value in `wrangler.toml`.

## Wired
- `cap.grant.invite` (danger/effect): sends the collaborator invitation; result carries `delivered` + `delivery.{provider,state,reason,provider_status}`.

## Not wired — named gaps
- `cap.survey.send_links` still answers `RESERVED_NOT_BUILT`: `issue_link` stores only a token **hash** and an invitee **hash**, so at send time neither the link nor the address exists to mail. Needs a contract decision: recipients supplied at send time, token minted at send. (M2, excluded here.)
- The UI has no `/#invite=` landing yet, and no UI file reads `delivered` or `delivery` at all: until Design lands that surface, a mailed link opens the shell but does not auto-accept; `POST /v2/invitations/{token}/accept` (or MCP `danger cap.grant.accept`) works with the token. When the surface is built, `unconfirmed` must not be rendered as "not delivered".
- The exact message text below is **not** captain-approved yet; text approval is a separate boundary from this transport.

## Message text (exact)
Subject: `You have been invited to 3D Review`

```
You have been invited to join a <workspace|project|assessment> in 3D Review as <owner|member|viewer>.

To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.

<link>

The invitation expires in 7 days and only works for this email address. If you were not expecting it, you can ignore this message.
```
