# Outbound mail (OF-3) — `src/mail.ts`

**State: adapter built, sender NOT configured. Every invitation answers `delivered:false` until the captain completes the gate below.**

| Rule | Behavior |
|---|---|
| Provider | Resend HTTP API, one `POST https://api.resend.com/emails`, `Idempotency-Key: invite/<invitation id>` |
| Who sends (fail-closed) | `ENVIRONMENT === "production"`, **or** `ENVIRONMENT === "dev"` **and** the recipient is on the dev allowlist. Any other or missing `ENVIRONMENT` → `delivered:false, state:"not_sent", reason:"not_allowed_env"` |
| Dev allowlist | `MAIL_ALLOWLIST_SHA256`: comma-separated `sha256(trim+lowercase(address))`, each entry exactly 64 **lowercase** hex. Missing, empty, or **one** malformed entry invalidates the whole list → `reason:"not_allowlisted"`; an unlisted recipient → `reason:"not_allowlisted"`. An **empty** entry counts as malformed: a trailing comma (`<hash>,`), a doubled comma (`<hash>,,<hash>`) or a whitespace-only entry closes the list instead of being quietly dropped. A typo closes the door, it does not silently shrink the list. No address is ever written into config |
| Not configured | `RESEND_API_KEY` or `MAIL_FROM` missing → `reason:"not_configured"`, no fetch |
| Address shape | exactly one plain **ASCII** mailbox (`normalizeAddress`; letters, digits, `. _ % + -`; punycode hosts and TLDs accepted; quoted local parts and `' / =` refused loudly rather than sent and bounced): display names, lists, whitespace, CRLF, trailing dots, dotless hosts → handler `INVALID_PARAMS`; adapter `reason:"invalid_address"` |
| Synthetic recipients | `.invalid`, `.test`, `.example`, `.localhost`, `.local`, `example.com/net/org` **and their subdomains** are never mailed → `reason:"synthetic_recipient"`. Decided **before** any environment, allowlist or configuration check: a dev allowlist entry cannot re-enable a reserved address |
| Intent de-duplication | decided and written in **one SQL statement** (`INSERT … SELECT … WHERE NOT EXISTS`), so concurrent replays cannot both pass. A live duplicate = a `sent` row for the same scope+invitee in the last 10 minutes, a `pending` row younger than 30 s (an in-flight twin), or an **unexpired `unconfirmed` row** (no cooldown expiry — see the `unconfirmed` lifecycle below). A `pending` row older than 30 s never reached a provider (the send attempt is in the same call, and it would have moved the row to `sent` or `unconfirmed`), so it does **not** block a retry. Duplicate → existing invitation, `reason:"duplicate_recent"` (or `duplicate_uncertain` for an `unconfirmed` twin), nothing sent. Same person, **different role** inside the window → `INVALID_PARAMS` pointing at `cap.grant.revoke_invitation` |
| Inviter cap | 30 **collaborator** invitations per inviter per hour (participant-link rows from `cap.survey.issue_link` are not counted) → `RATE_LIMITED`. The HTTP `retry-after: 60` header is the generic one; the hint says the cap resets over the hour |
| Row status | `sent` only after the provider accepted, `unconfirmed` when the send could not be confirmed, `pending` when nothing was attempted or the provider refused. Every post-send write is **conditional** (`WHERE id = ? AND status = 'pending'`), so a `revoke` or `accept` that lands while the send is in flight is never overwritten; the result's `status` is then the actually-stored state, read back, while `delivery.state` still reports only what the provider said |
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

`reason:"duplicate_uncertain"` is reported with `state:"unconfirmed"`, not `not_sent`: a second invite inside the uncertain
window sends nothing, but the **first** attempt's fate is still unknown, so the call must not be rendered as "not delivered".

`unconfirmed` is the load-bearing one. On `unconfirmed` the adapter does **not** retry and the handler does **not** replay. The
`Idempotency-Key` is `invite/<invitation id>`, so a later manual re-invite of the **same** invitation cannot double-send at the
provider.

## The `unconfirmed` invitation lifecycle (no schema change)

`invitation.status` is plain `TEXT` with **no `CHECK` constraint** (`migrations/0001_init.sql:104`), so the uncertain outcome is
recorded as a **data value**, not a new column: on a timeout or an unreachable provider the row transitions
`pending` → `unconfirmed` with `UPDATE invitation SET status = 'unconfirmed' WHERE id = ? AND status = 'pending'`.

An `unconfirmed` row is **LIVE** — everywhere `sent` is live, `unconfirmed` is too:

| Where | Behavior for `unconfirmed` |
|---|---|
| De-duplication predicate (`cap.grant.invite`) | a live duplicate **for as long as the row is unexpired** — there is no 10-minute cooldown expiry, because we cannot know the mail did not go out. A later invite for the same scope+invitee returns the **same** `invitation_id` with `delivery.state:"unconfirmed", reason:"duplicate_uncertain"`; it mints no token, creates no row, uses no new idempotency key and makes no `fetch` |
| `cap.grant.accept` | **permitted** — the mail may well have arrived, and holding the token is proof that it did |
| `cap.grant.revoke_invitation` | **permitted** — this is the explicit human path out: revoke the uncertain invitation, then invite anew (which mints a fresh token and a fresh idempotency key) |
| `cap.grant.list` → `pending_invitations` | **included** (`status IN ('sent','pending','unconfirmed')`) |
| `cap.survey.*` participant links | untouched — `issue_link` / `revoke_link` rows never take this state |

The result of an uncertain send therefore reports `status:"unconfirmed"` **and** `delivery.state:"unconfirmed"`, and no second
mail can be produced for it by replay, by a later call, or by two concurrent calls inside the uncertain window.

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
- The UI has no `/#invite=` landing yet: a mailed link opens the shell but does not auto-accept; `POST /v2/invitations/{token}/accept` (or MCP `danger cap.grant.accept`) works with the token.
- **Design handoff — `ui/scope-invitations.js` (PR #51) already reads `delivered` and must change.** It branches on `delivered` alone and never looks at `delivery.state`: it renders `delivered:false` as *"Invitation created; email not delivered. The recipient has not accepted yet."* (and *"Email was not delivered…"* in the credential box), and it **throws** `Unexpected delivery result` whenever `delivered !== false`. With this transport live that copy is wrong in two ways: `delivered:true` is a normal outcome, and `delivery.state:"unconfirmed"` (including `reason:"duplicate_uncertain"`) means **"could not confirm"**, not "not delivered". The surface must switch on `delivery.state`: `accepted` → handed over for delivery; `refused`/`not_sent` → not delivered; `unconfirmed` → *could not confirm the email was sent*.
- The exact message text below is **not** captain-approved yet; text approval is a separate boundary from this transport.

## Message text (exact)
Subject: `You have been invited to 3D Review`

```
You have been invited to join a <workspace|project|assessment> in 3D Review as <owner|member|viewer>.

To accept, open this link and sign in with this email address. You will get a one-time code by email — there is no password.

<link>

The invitation expires in 7 days and only works for this email address. If you were not expecting it, you can ignore this message.
```
