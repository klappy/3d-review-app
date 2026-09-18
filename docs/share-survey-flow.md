# Survey sharing: outcome-first flow

Issue [111](https://github.com/klappy/3d-review-app/issues/111) records the current user's direct feedback: creating a survey link as a separate setup task makes sharing confusing. This bounded change applies that feedback to the assessment survey page. It does not assign a release version or claim deployment.

`Share survey` prepares the existing `cap.survey.issue_link` dry run. Copy link, Show QR code, or Print invitations explicitly confirm the existing execute operation, after displaying who can use the link, that no email is sent, and what revocation can and cannot undo. Preparation/token mechanics are not separate user chores. No execution occurs during rendering or opening the choices.

The frozen capability already specifies confirmed copying in its UI surface; server permission, dry-run/execute, single disclosure and revoke contracts remain unchanged. No new retrieval capability or persistent credential storage is introduced. Link reuse lasts only while the existing in-memory survey model survives. Closing the choices preserves that model; identity, survey and epoch changes clear it.

An uncertain execute result consumes the confirmation and never retries automatically. The UI warns that another attempt may create another link. Delivery failures retain a successfully received link. Clipboard permission or transient activation failure asks the user to copy the same link again (or select the visible text); it never issues another link to repair copying. Printing likewise reuses the existing link. Removed-page and replaced-identity responses cannot deliver credentials to an output.

## Candidate validation

- 34/34 Node tests across sharing, identity reset and views; 13 sharing tests cover roles, all three first outcomes, explicit confirmation, expiry, duplicate clicks, uncertain/incomplete results, delivery fallback, memory reuse, stale page suppression and revocation.
- Typecheck passes after the normal version-generation prerequisite. No version or release metadata changed.
- 1/1 author-operated Chrome local scenario: initial 0 preparations/0 issues; open Share → 1/0; Copy → 1/1 and visible “Link copied”; QR → visible code and 1/1; Print → one intercepted print request, still 1/1. Actual changed module imported directly; synthetic API and intercepted print callback. This does not prove a physical print, full deployed shell integration, Firefox/Safari activation behavior or human comprehension.
- Human persona confirmation: 0/1, pending. Independent exact-head review and CI/Bugbot remain gates.

The reusable workflow principle belongs to kitchen HYGIENE; root is maintaining that separate policy change. This file is the specific implementation decision/evidence, not a competing authority.
