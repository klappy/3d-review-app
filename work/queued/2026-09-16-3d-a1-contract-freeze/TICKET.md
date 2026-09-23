# TICKET — 2026-09-16-3d-a1-contract-freeze

**What this is:** Freeze `contract-v0.1` bundle by bundle: `capabilities.json`, `openapi.yaml`, `contract-manifest.json` generated from 04, at tracked paths.
**Why now:** B, C and G mock from the frozen bundles tonight; without tracked artifacts nothing can be mocked (Astra #14 c5702672629 item 1).
**Your move:** Thumb OF-1 (where the app repo lives) so the artifacts have a tracked home; until then they land on PR #18.

Class: entrée. Risk: STANDARD.
Station: captain seat (Astra in Codex; Otto supplies conformance) (LANES).
Owner: Astra. Promise: 90 min — burns down across attempts (R6).
Depends: 2026-09-16-3d-a0-audit-share.
Order: 2026-09-16-3d-parity-build.   Meal: 2026-09-16-3d-meal-a.
driver-seat: scoped (entrée) — DELTA.md written at LIFECYCLE step 3, judged by FIRE-CHECK at fire

Outcome served:
- see Meal.
Learning signal:
- see Meal.

Blueprint: [`07-MEAL-PLAN.md` row A1](https://github.com/klappy/3d-review-cookbook/blob/6fec90f/planning/2026-09-16-parity-build/07-MEAL-PLAN.md) and `MASTER-PLAN.md` at cookbook PR #12 @ `6fec90f` (candidate revision; every receipt names the SHA it read). Board: cookbook issue #14; stitch #17.

Ingredients:
- `04-CAPABILITY-MATRIX.md` @ 6fec90f (79 rows)
- `14-STEVE-REPO-SYNC.md` + `14-FIXTURE-MANIFEST.json` @ 6fec90f
- gate OF-1 (captain) — path binding; P-default until thumb = PR #18 `planning/2026-09-16-reproducible-build/contracts/`

Declared product:
1. `capabilities.json` (tracked path per OF-1, else PR #18 contracts/)
2. `openapi.yaml` (same home)
3. `contract-manifest.json` — bundle → frozen SHA | open items
4. git tag `contract-v0.1` on the commit that carries all three
5. #14 comment: bundles frozen, bundles open, diff vs 04

Done-means:
- A B/C/G cook can `git show contract-v0.1:<path>/capabilities.json` and observe every 04 row id present exactly once.
- A reader of `contract-manifest.json` can observe, for each bundle, either a frozen SHA or the named open items — never both, never neither.
- A cook opening a frozen bundle's routes in `openapi.yaml` can observe a concrete path, request/response/error schemas and nullability on every route — no bare method routes.
- A cook reading any W/E/D row in a frozen bundle can observe `inverse: <op>` or `inverse: none` and its effect route.
- A cook can observe the idempotency key binding, retention and same-key conflict rule stated once and referenced by every W row.
- CoS can diff `capabilities.json` against 04 and observe zero missing and zero extra rows.

## Failure Modes — What Breaks When A1 Is Cooked Wrong or Counted Early
- A bundle is tagged frozen while a route in it is still a bare method.
- Artifacts exist only in a seat's local workspace.
- 04 changes after the tag.
- The dish is reported plated with any done-means line unmet or a ❌ in its receipt.

## Required Response When Detected
- A bundle is tagged frozen while a route in it is still a bare method → Manifest flips that bundle to open, tag moves only after regeneration; diff posted on #14.
- Artifacts exist only in a seat's local workspace → Not frozen. Land them on PR #18 (or the OF-1 repo) and re-run this ticket's done-means.
- 04 changes after the tag → Bump to `contract-v0.2`, post the diff on #14, B/C/G re-mock the changed bundles only.
- Plated-with-❌ → the dish returns to 2-cooking as BLOCKED with the failing line named; dependents stay blocked; the meal does not derive done.

## Current app contradicts shared-survey flow — source inspection, not runtime reproduction

At app DEV branch commit `10f5f444d68475d7114ab8fe0bf269fe106476b1`, root directly read `src/handlers/participant.ts`, `survey.ts`, and `response.ts` after Chris's participant correction.

1. `survey.issue_link` stores only a token hash and returns `{id,status:pending,sent:false}`; it does not expose a copyable link. `survey.send_links` execute throws RESERVED_NOT_BUILT. The user-facing shared-link distribution path is therefore not established by these handlers.
2. `participant.open_link` always assigns respondentId=`invitee_${row.id}` for a given invitation, including repeated opens. `response.submit` refuses a second submission for the same survey/respondent. Consequently the current source models a link as one respondent, conflicting with sharing that survey to multiple independent respondents. This is a source-derived finding; a fresh isolated multi-browser/session reproduction is still owed. Do not claim an observed production collision or data overwrite.
3. `response.assisted_next` refuses all execution because collector identity is not established; mandatory identity provisioning must not be introduced to satisfy the newly reaffirmed public participant flow.

Required contract reconciliation under existing A1/C2/stitch ownership: make staff assessment survey selection lead to an actually shareable survey link; multiple independent respondents must submit through that same survey link without accounts/codes/batch provisioning, and their responses must remain separate and attributed to the correct assessment/survey. Implementation may retain internal response/session identifiers for isolation and retry safety; they must not become participant login or per-recipient setup. Do not infer a new repeat-response or amendment policy. Preserve staff access protection and existing data/history. Current83 capability registration and passing one-recipient tests cannot establish this acceptance.

This is a bounded audit finding and planning return, not new implementation fire or permission to alter deployed authentication. Native Auditor is asked to independently reproduce in isolated fixtures; the successor auth/contract coordinator must reconcile ownership and a bounded plan with Design before proposing implementation. Existing staff OAuth security corrections remain separate.


## Shared-link API subslice amendment v1.0.0 — 2026-09-17

What this is: Correct the existing A1 shared-link contract and API so one reusable link supports independent anonymous responses safely.
Why now: The accepted first sprint needs staff sharing and counts; the current source merges respondents and discards its share credential.
Your move: Astra lands the accepted plan and current gate receipts, then explicitly fires the named API worker; UI authoring proceeds separately under C2.

Class: entrée. Risk: ALLERGY (reusable access credential disclosure and response privacy). Station: Otto. Owner: Astra; implementation worker /root/queue_resolution/pr17_truthfulness_worker. Promise: actual55–75minutes from FIRE, checkpoint10minutes; originalA1 90minute history retained, not reset. Depends: observed Auth class/custody/0007 receipts and accepted Design browser contract; these are satisfied for this bounded subslice by root readback. Historical A0/full-contract freeze remains broader work and is not claimed complete or prerequisite to the captain-accepted sprint bundle.

Ingredients and declared paths: SHARED-LINK-CORRECTION-PLAN.md latest governing append; exact10f5 baseline; observed Auth5708270121/5708271276, custody5708292130, Design5708278629, UIparallel5708302125; source-backed response/participant/survey handlers and schema. App API owns ten exact files listed in the plan; C2 owns four UI files. Essential cookbook outputs are planning/2026-09-16-parity-build/04-CAPABILITY-MATRIX.md, prd/18-A-api-contracts.md, prd/18-A-shared-link-contract.md. Full reconstruction follows shipment by explicit captain ruling; preserve exact commits/tests/reviews for audit.

Done-means for API subslice:
- Staff can dry-run/confirm issue and observe a copyable fragment credential while unauthorized callers are refused.
- Two independent clients can open one link and observe distinct scoped respondents and successful separately attributed responses.
- A client can retry a valid submission and observe the same response identity; conflicting/racing payloads cannot create duplicate rows.
- A participant can resume and observe only its own draft/context/receipt; revoked/expired credentials cannot collect or read protected receipt data.
- Staff can close collection and observe refusal of new submissions without deletion of historical responses.
- Independent reviewer can run isolated source-validation/concurrency/Auth-compatibility tests and observe preserved protections plus exact current-head check results.
- C2 can integrate the real API candidate and observe two anonymous browser completions increase staff counts by2; API-only completion does not claim this integration already passed.

## Failure Modes — What Breaks When a Share Link Becomes One Person

- Respondent collision or receipt/draft exposure across contexts.
- Duplicate response race, weakened validation or success after completed revocation/closure.
- Auth-owned file conflict, wrong token shape or weakened IP limiter.
- Fixture UI passes while actual API/browser integration fails.
- Old canonical reconstruction requirement accidentally reinstated as current work, or essential contract docs omitted.

## Required Response When Detected

- Collision/exposure → stop acceptance, isolate reproducer, repair under owner review; no real participant data used for debugging.
- Duplicate/validation/lifetime failure → fail candidate, retain rows, repair transaction/authority path and repeat independent tests.
- Auth conflict/token/limiter mismatch → return exact hunk to Auth; no silent scope expansion.
- Fixture-only success → keep integrated acceptance open until actual candidate proof.
- Sequencing confusion/docs omission → enforce latest governing amendment; retain essential docs, defer full reconstruction with provenance.


Root disposition: final independentimpactACCEPT exactplanbd883b0624eee1f369761baadf17d2a4fd5262eac333ead2d144958641872920; thislandedpacket closeswrittenfilepresence gates. Explicit namedworkerFIRE follows verifiedreadback, no implementation implied beforethat. Root reconciles finalfivecapabilityrows underAuthaccepteddisclosure:issue_link/open_link/response.form/submit/receipt;Nextunchanged.

