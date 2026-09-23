# Live MCP-first roadmap and historical provenance

Status: cooking; owner fresh_rule_check; coordinator root.
Product issue: https://github.com/klappy/3d-review-app/issues/123
Canonical candidate: https://github.com/klappy/3d-review-cookbook/pull/91

Deliver /roadmap with Planned/Built/Reviewed/DEV/Production using a durable runtime event source exposed through the existing MCP/API dispatch. No static build-time snapshot substitute. Agents publish scoped authenticated progress without user-created or pasted tokens. Server derives identity; claims remain distinct from verified facts. Public projection excludes private feedback and identities. Historical decisions, evidence and outcomes persist with safe correction/redaction across current views, replay and client caches.

Acceptance: real authorized MCP publish updates an already-open browser without refresh/rebuild/deploy; reconnect/cursor replay, idempotency, spoofed-role/identity rejection and redaction tested. Evidence freshness and disconnect visible. Existing OAuth identity verified but publisher permission unconfigured; local synthetic tests do not establish deployed authorization. Scope must not require a second human account merely to complete routine machine-verifiable release attestations: trusted integrations can verify limited facts, while human/agent review assertions remain accurately attributed.

Progress: 33 server and 6 UI/feed tests passed; 3 local browser cases passed including HTTP claim, MCP summary and redaction under unchanged running build. Independent review, real publishing configuration and DEV then identical-version production pending. Separate from issue116 feedback provenance and blocker124/PR125. No release version assigned.
