# Live rolling roadmap

[Issue123](https://github.com/klappy/3d-review-app/issues/123) records the current user authorization: `/roadmap` on existing domains, matching the app's visual components, with live work-in-progress updates independent of app releases. A build-time snapshot was explicitly rejected as fulfillment. This separate compatible feature awaits a MINOR release slot.

## Authority and transport

The [canonical additive contract](https://github.com/klappy/3d-review-cookbook/blob/f5fb9a28ee3ea017859e521ac672f4c58236a9b4/planning/2026-09-18-live-roadmap/AMENDMENT.md) defines six capabilities through the existing docs/read/write/danger tools. Their HTTP twins and the UI share the same dispatcher/store. There are no UI-only mutations. D1 stores durable public current items/events separately from restricted publisher audit. Snapshot, replay page and cursor share a transaction. Status publication does not require an app deployment.

SSE `/v2/roadmap/stream` runs the same public read capability and sends real sequence notifications, connectivity heartbeats and redaction resets. It observes D1 about every2seconds, limits streams to30seconds and replay pages to100events, and resumes with Last-Event-ID. Public connection rate limiting and abort cleanup bound work. The client labels disconnects, last event/read times and15second polling fallback; it pauses while hidden. Connectivity/elapsed time never implies progress. Three pagination consistency retries bound a rapidly changing feed. Hono's stream helper cache header is explicitly overridden to `no-store`.

Production's store is canonical once promoted; DEV's separate D1 store is visibly provisional. This increment does not silently aggregate divergent environments. A future central fan-out may reduce per-viewer D1 reads; current query budgets are explicit. References: [Hono streaming](https://hono.dev/docs/helpers/streaming), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Anti-spoofing and public suitability

Existing OAuth/session identity authenticates the producer. `ROADMAP_PUBLISHER_IDS`, `ROADMAP_VERIFIER_IDS` and `ROADMAP_SUMMARY_REVIEWER_IDS` are narrow server-side principal permission lists; empty lists refuse writes. They are authorization configuration, not credentials, and never appear publicly. No new secret, token paste, client credential or support elevation. Arbitrary project/tenant ownership does not grant global publication. Cookie-auth writes require the configured same Origin. Unknown actor/role/environment/scope fields are rejected. Server derives actor, recorded time, sequence and source environment.

Automatic lifecycle events contain only predefined metadata and public structured references. They remain attributed publisher claims—even a `production_verified` report cannot set Done. A separately authorized verifier with a different authenticated principal must reference a claim and evidence and explicitly attest independent checking. The UI labels that attestation honestly, not as automatic provider verification. Same-account agents cannot simulate independent identities. A trusted-integration alternative, `serving_release_checked`, lets the same permitted principal request a server-side check of the fixed DEV/production health endpoint against the claim version/source. It records only serving identity, never browser or human acceptance; no second account is required for that path. Earlier stages require acceptance before later Done transitions.

Public narrative is a separate reviewed publication action. Neutral feedback summary, priority, scope, outcome and recurrence require a public review reference and semantic review; schema/PII patterns cannot establish that natural language is safe or true. Never copy raw feedback, quotes, names, contacts, actors, tokens, traces, private links or sensitive vulnerability details into the feed. Private audit is excluded from every public query and stream. Reviewed summaries append durable history. History correction does not erase ordinary decisions.

Redaction atomically removes current and prior public payloads, increments generation and emits a neutral reset. Clients clear retained state before rereading; old in-flight responses cannot restore it. Replayed old idempotency keys return only the minimal receipt. Offline/external copies cannot be recalled: disconnection is explicit and removal applies on reconnect; operational cache/history remediation may still be needed. All public HTTP/SSE responses are no-store.

## UI and producer

The table has Planned/Built/Reviewed/DEV/Production and Remaining, with exact legend ✅ Done · 🟡 Pending · 🔴 Blocked. It shows20active and10completed rows by default, all-items disclosure/counts, recent history and durable paged history. Feedback→priority/scope→decisions→review/releases→outcome/recurrence are expandable. A completed stage set is not human satisfaction. Unmeasured outcomes and unknown recurrence stay explicit.

[Producer hooks](roadmap-producer.md) specify actual MCP read→dry_run→execute at work start, review/findings/checks/deploy/blocker, stable idempotency and separate verifier acceptance. Current operational permission is **not provisioned**. The installed DEV MCP connection was checked and is an authenticated provisioned OAuth user; its private ID/grants are omitted. Connected is not authorized. Operational installed-connector publication remains a deployment gate, not a completed monitor promise.

## Evidence boundary

Local proof used actual shared Hono HTTP/MCP dispatch, Miniflare D1 and synthetic sessions: HTTP claim appeared, MCP summary appeared, and MCP redaction removed it on the same open Chrome page without reload/rebuild/handler restart. The inherited build stamp identifies the local base, not a release of this candidate. Tests separately cover forged identity/scope, permission/expiry/CSRF, idempotency, concurrency, public/private separation, redaction/replay and cursor consistency. No live user writes or real-user ratings. Final candidate receipt carries exact source and counts. Independent review, checks, canonical acceptance, release assignment, DEV/production validation and operational producer permission remain outstanding gates.

## 0.12.0 deployment reconciliation

Normal main0.11.4 ancestry is incorporated. Narrow publisher identities can be provided as secret canonical-build variables and projected as server-only hashes by the existing stamp hook; no raw identity enters public source or Assets. A CI-only additive migration helper preflights/reads back the exact roadmap schema before the existing deploy command. Both are reviewed release integration changes, not seat deployment or an implicit grant of verifier/narrative permissions. See the producer document for boundaries and pending operational proof.
