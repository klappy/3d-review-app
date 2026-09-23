# Scoped Permissions increment — 0.3.0

Owner: permissions_increment. Root retains the journal and release disposition.

Deliver one independently releasable Permissions feature after the 0.2.0 web baseline. App issue68 / PR69; cookbook release-record PR48. Keep MCP panels and participant migration in their own tickets and releases.

Scope: exact workspace/project/assessment roster and pending invitations; danger preview/confirm for invitations, role changes and ownership transfers; single-call revocations. Fix F-G1-1 by refreshing server-owned state without erasing action outcome, receipt and trace. No inheritance, API/schema additions or live invitation/grant mutations.

Acceptance: meaningful lifecycle regressions fail original CP7 and pass fixed code; existing suites pass; exact-head independent security review and required checks pass; cookbook-backed 0.3.0 identity verifies. Root ships through normal Git-connected DEV and separately production PRs. Candidate is not deployed or accepted merely because tests pass.

Separate dependency: accepted baseline CP6 4a27830c56c4ef05d2ea8656e07de68311eef942 and its 0.2.0 record. Existing PR65 stays historical. Current source imports only CP7 G1 and bounded F-G1-1 correction.

Recipe references: docs/release.md in app; kitchen health-code/HYGIENE.md and health-code/RULINGS.md. Ingredients: accepted CP6, source contracts and existing review receipts. Station: isolated agent branch. Risk: bounded application increment; normal tests and independent review required. Promise: active, no fabricated deadline. Declared product and acceptance scope above.
