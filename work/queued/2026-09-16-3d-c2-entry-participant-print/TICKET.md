# TICKET — 2026-09-16-3d-c2-entry-participant-print

**What this is:** Surfaces 1 (entry), 4 (participant), 6 (print) against contract mocks.
**Why now:** J2 in the browser (code + link) and the print snapshot are demo-path rows.
**Your move:** Nothing until it plates.

Class: entrée. Risk: STANDARD.
Station: captain seat (Claude Design) (LANES).
Owner: Design. Promise: 150 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-c1-tokens-ui-states, 2026-09-16-3d-b4-error-receipt-style.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-c.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row C2](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #16; stitch #17.

Ingredients:
- `06` surfaces 1/4/6 + `13` verbs @ 6fec90f
- contract mocks from 2026-09-16-3d-a1-contract-freeze
- nine forms from klappy/3d-quality-review@f042cde Items.csv per 14

Declared product:
1. `ui/entry/*`, `ui/participant/*`, `ui/print/*`
2. #16 receipt: J2 browser run (code + link) + print snapshot

Done-means:
- A participant can enter an access code in the browser and observe the correct form template for their role.
- A participant can follow an invitation link and observe the same journey as by code.
- A cook can print an assessment and observe a snapshot that differs from a credential export (blank print carries no codes).
- A cook can replay J2 in the browser against mocks and observe pass.
- A reader can observe every error shown uses the B4 code and hint.

## Failure Modes — What Breaks When C2 Is Cooked Wrong or Counted Early
- Blank print reveals access codes.
- A surface calls a row not in the contract.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- Blank print reveals access codes → Blocked; privacy finding to #17.
- A surface calls a row not in the contract → Blocked; spec-gap on #14.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.

## Governing participant-flow correction — Chris, observed 2026-09-17T02:28:51.856Z

Chris explicitly reaffirmed the original product flow: authenticated staff/facilitators configure an assessment, selecting included surveys and intended respondents/groups; distribute the selected surveys to as many people as needed; participants open the shared survey and submit results. Participants require no OAuth, account, separate login, mandatory access code, or per-person authentication batch. Survey respondent types are not staff account roles. This supersedes conflicting participant-authentication requirements in earlier plans, C2 done-means/J2, mocks and acceptance inventories. Preserve historical records with supersession; code-path existence or tests for those paths do not make them required product behavior. No new duplicate-response or identity policy is inferred.

Direct source verification: Lovable project69992fc5-4356-4be7-a803-33ed1b39b0c3 at edd0b8c30a2d1a987e33cea6a42fd919ca292e7a, file inventory and native reads of src/pages/SurveyEntry.tsx, src/components/admin/SurveyLinksCard.tsx and src/components/admin/AssessmentEventDialog.tsx. Assessment creation selects respondent types (_selectedTypes); staff copy /survey/{token} links; SurveyEntry calls survey-bootstrap explicitly without authentication and renders the corresponding SurveyFlow. A survey-link identifier is not a participant account or an instruction to type an authentication code. Source inspection, not a fresh end-to-end execution. Earlier whiteboard NEXT-PLAN likewise specifies assessment-selected templates and direct participant survey links.

Owner return through existing queue: Auggie/Design C2 and C6, Fable contract/auth A1/A3/A5, and stitch acceptance must reconcile their current artifacts with this correction before participant acceptance or further broad build. C2's required code-entry and code/link equivalence are superseded as product requirements. Required acceptance instead demonstrates assessment survey selection, shared link distribution to multiple respondents without provisioning identities, direct unauthenticated completion, and responses attributed to the correct assessment/survey. Do not require a recipient roster to issue individually authenticated links. Staff/agent OAuth security findings remain valid and separate; do not discard the PR15 authorization-code race or staff permission controls. No new implementation fire, deployment, data mutation, budget reset, or owner ACK is implied. Root remains audit/reconciliation writer; broad product work awaits assessment with Chris.
