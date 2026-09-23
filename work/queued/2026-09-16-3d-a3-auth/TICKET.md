# TICKET — 2026-09-16-3d-a3-auth

**What this is:** Sign-in per OF-7 (magic link as written vs Cloudflare email-code with shared identity and separate browser sessions — both prepared, neither cooked until the captain thumbs), sessions, participant tokens and access codes in D1.
**Why now:** J2/J3 cannot run over HTTP without it; the login mechanism is the one open fork Astra flagged (#14 item 3).
**Your move:** Thumb OF-7 (login mechanism) and OF-3 (sender). **A3 is OF-7 RULED 15:00 ET: Cloudflare email-code — unblocked.

Class: entrée. Risk: ALLERGY.
Station: captain seat (Astra in Codex; Otto specifies token custody) (LANES).
Owner: Astra. Promise: 120 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a1-contract-freeze, 2026-09-16-3d-a2-schema.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-a.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row A3](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #14; stitch #17.

Ingredients:
- **gate OF-7 (captain thumb) — blocking**; source of the alternative: Astra #13 c5701326321 + PR #18 AUDIT:13–15/27 (proposed, not ruled)
- `02-ARCHITECTURE-PROJECTION.md` §auth @ 6fec90f
- `09` OF-3, OF-7 @ 6fec90f
- Otto: subject/custody/audience/expiry/revocation/recovery spec (prep dish, posted on #14 before A3 fires)
- Resend sender (allergen: secrets — env only, never in repo)

Declared product:
1. `src/auth/*` (app repo)
2. `docs/auth.md` naming the OF-7 disposition cooked
3. #14 receipt: J2 + J3 transcripts over HTTP

Done-means:
- A participant can enter an access code over HTTP and observe a participant token scoped to one assessment.
- A user can complete the login flow and observe a session that expires at the stated time and can be revoked.
- A cook can replay J2 and J3 from 05 over HTTP and observe both pass.
- A reviewer can read `docs/auth.md` and observe the OF-7 option the captain thumbed, with the thumb receipt linked.
- A reviewer can grep the repo for the sender API key and observe zero matches.

## Failure Modes — What Breaks When A3 Is Cooked Wrong or Counted Early
- A secret is committed.
- OF-7 is thumbed after A3 plates.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A secret is committed → Rotate it, purge history per HYGIENE, VERDICT records it; A8 blocked until rotated.
- OF-7 is thumbed after A3 plates → Refire as A3.1 with a new promise; A5/A8 receipts cite the refire.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.

- 2026-09-16 15:06 ET — OF-7 ruled by captain: **Cloudflare email-code**. Dish unblocked; build this path only. Re-pinned to cookbook 6fec90f.

## Governing participant-flow correction — Chris, observed 2026-09-17T02:28:51.856Z

Chris explicitly reaffirmed the original product flow: authenticated staff/facilitators configure an assessment, selecting included surveys and intended respondents/groups; distribute the selected surveys to as many people as needed; participants open the shared survey and submit results. Participants require no OAuth, account, separate login, mandatory access code, or per-person authentication batch. Survey respondent types are not staff account roles. This supersedes conflicting participant-authentication requirements in earlier plans, C2 done-means/J2, mocks and acceptance inventories. Preserve historical records with supersession; code-path existence or tests for those paths do not make them required product behavior. No new duplicate-response or identity policy is inferred.

Direct source verification: Lovable project69992fc5-4356-4be7-a803-33ed1b39b0c3 at edd0b8c30a2d1a987e33cea6a42fd919ca292e7a, file inventory and native reads of src/pages/SurveyEntry.tsx, src/components/admin/SurveyLinksCard.tsx and src/components/admin/AssessmentEventDialog.tsx. Assessment creation selects respondent types (_selectedTypes); staff copy /survey/{token} links; SurveyEntry calls survey-bootstrap explicitly without authentication and renders the corresponding SurveyFlow. A survey-link identifier is not a participant account or an instruction to type an authentication code. Source inspection, not a fresh end-to-end execution. Earlier whiteboard NEXT-PLAN likewise specifies assessment-selected templates and direct participant survey links.

Owner return through existing queue: Auggie/Design C2 and C6, Fable contract/auth A1/A3/A5, and stitch acceptance must reconcile their current artifacts with this correction before participant acceptance or further broad build. C2's required code-entry and code/link equivalence are superseded as product requirements. Required acceptance instead demonstrates assessment survey selection, shared link distribution to multiple respondents without provisioning identities, direct unauthenticated completion, and responses attributed to the correct assessment/survey. Do not require a recipient roster to issue individually authenticated links. Staff/agent OAuth security findings remain valid and separate; do not discard the PR15 authorization-code race or staff permission controls. No new implementation fire, deployment, data mutation, budget reset, or owner ACK is implied. Root remains audit/reconciliation writer; broad product work awaits assessment with Chris.
