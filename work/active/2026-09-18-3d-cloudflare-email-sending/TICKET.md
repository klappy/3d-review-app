# Cloudflare Email Sending migration — 0.6.0

User order: use Cloudflare Email Sending instead of Resend for 3dreview.app. No inbox or forwarding. Domain purchased by explicit user authorization with auto-renew enabled.

Issue: https://github.com/klappy/3d-review-app/issues/87
App PR: https://github.com/klappy/3d-review-app/pull/88
Cookbook PR: https://github.com/klappy/3d-review-cookbook/pull/67

Owner: permissions_increment (adapter, native binding configuration, tests, canonical release metadata). Infrastructure: integrate_checkpoint (sending-domain DNS/readiness). Independent reviewer: release_review. Root sole merger and journal writer. Isolated branch based on accepted main0.5.0.

Scope: replace Resend with native EMAIL.send; preserve mail capability contracts, recipient normalization, synthetic refusal, DEV hash allowlist, handler deduplication and uncertain-send behavior. Configure noreply@3dreview.app, sending authentication and bounce DNS only. No root MX/inbox/forwarding, live grant, arbitrary recipient mail or manual deployment. No provider idempotency promise beyond documented behavior.

Acceptance: focused provider/lifecycle/error/timeout regressions, required full checks, independent exact-head review and literal Bugbot SUCCESS. Git-connected main/DEV validation precedes same-version/source production PR. One named-recipient delivery check requires recipient authorization. New user-requested increment remains separate from seven already-deployed milestones. No promotion-only semver bump.

Recipe references: cookbook HYGIENE section10; app docs/release.md and docs/mail.md. Prior Resend human-key handoff is superseded. Existing sender domain is enabled with DNS ready; no email sent. No fabricated deadline.
