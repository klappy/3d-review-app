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
