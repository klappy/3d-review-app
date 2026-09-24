# Copy fact reconciliation — three clauses only

Status: PROPOSED revision 2 operational wording, not approved copy, not publication, not final copy VERDICT. Existing frozen deck remains unchanged.
Compared cookbook c653482135a18e6ca33cccc230b44855595f9dc2 design-system/copy.md (blob b8b87dc26c802d328b119c9a49963c761bc5184b) with app76fe13823dda23c9c046d2b44cdce94fc0842602. Source inspection only; no new live auth, participant submission or report execution. Date:2026-09-21 America/New_York.

## 1. Email-link and fifteen-minute sign-in

Exact deck clauses, Surface1:
“Sign in. Facilitators and collaborators sign in with an email link.”
“Check your email. We sent a one-time link to … It works once and expires in 15 minutes. No password exists for this account.”
“That link has expired. Links work once and for 15 minutes.”
“You are signed in. Session started. The link was consumed; opening it again shows the expired state.”

Verified source: [scope.js lines91](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/ui/assess/scope.js#L91) points real sign-in to /v2/auth/access and says Cloudflare sends an email code; sandbox identities are a separately labelled dev-only path. [index.ts lines126–145](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/src/index.ts#L126) verifies Access identity then creates the app session. The legacy capability does not describe the normal real sign-in journey. Current source does not establish a fifteen-minute provider code lifetime. Do not replace the link lifetime with an invented code lifetime.

Proposed minimal wording:
- Entry: “Sign in with an email code.”
- Explanation: “Cloudflare sends a one-time code to your email. Follow the sign-in instructions to continue.”
- App return: “You are signed in.”
Remove the deck's app-owned sent/expired/consumed-link claims from the real Access path; provider screens own their actual code states. Retain any independently scoped legacy/sandbox copy only where that flow actually runs.

Boundary: Auth owner verifies semantics and actual mounted path; copy owner approves exact operational text. This is not permission to change provider configuration, auth expiry or redirects, and does not settle #149's lost return-route dependency. No captain-voice wording is rewritten.

## 2. Shared invitation versus one respondent's receipt

Exact deck clauses, Surface4:
“Your answers. Change anything before you submit. After submitting, this link shows your receipt and cannot be answered again.”
“Thank you. Your answers stay with the team, grouped with others from the community perspective. Reopening your link shows this receipt again.”

The deck itself already says in Surface1: “Everyone who receives the same link answers the same survey.” Preserve that compatible shared-invitation statement.

Verified source: [shared-link.ts](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/src/handlers/shared-link.ts#L45) resumes a validated participant session or creates a new respondent/session associated with the invitation. [ui/shared-link.js](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/ui/shared-link.js#L1) stores per-link state in sessionStorage, explicitly notes new storage may create a new respondent and duplicated storage may resume the same respondent. Receipt/idempotency is respondent-session scoped; the shared invitation is not consumed by the first answer. No person-uniqueness guarantee. Session loss, expiry/revocation and collection policy limit resumption.

Proposed minimal wording:
- Review: “Your answers. Check them before you submit.”
- Receipt: “Thank you. Your answers were submitted. Your receipt may be available when you reopen the survey in this browser.”
- Invitation explanation: “Other people can use the same invitation to answer the survey.”

Boundary: Participant/Auth owner reviews exact resume/idempotency semantics and user-facing session terminology. Copy owner approves the minimal phrasing or clearer equivalent without restoring an unconditional receipt promise. Existing uncertain-submission warning, collection-closed and cannot-resume messages survive. No cookie/storage persistence change or one-person identity enforcement is authorized. The broader privacy assertion about grouping is outside this three-clause factual correction and is not independently ratified here.

## 3. Bands-only versus held and authorized synthetic reports

Exact deck clauses:
Voice rules: “Bands, never numbers.”
Surface2 tour: “First time in Reviewing: Bands, not scores. Withheld means a small group, not a poor result.”
Surface7: “What is a band? One word for a perspective's view: Strong, Growing, More input needed. Never a number.”

Verified source: [report.ts](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/src/handlers/report.ts#L15) returns held/suppressed when current synthetic reporting policy does not permit a report; held is not evidence specifically of a small group. [synthetic-report-store.ts](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/src/synthetic-report-store.ts#L132) separates authorized reads and source-attested capture eligibility. [report-attestation.ts](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/src/report-attestation.ts#L90) validates response/template metadata and digests; its pure attestation alone does not grant access. [report-view.js](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/ui/report-view.js#L36) renders nothing for held/malformed results and labels eligible output Synthetic data with source/scorer/narrative/policy provenance. [report-card.js](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/ui/report-card.js#L30) and report-view render numeric lens/item scores. Existing authorized source-attested synthetic reporting must not be replaced by a kit placeholder or universal bands-only promise.

Proposed minimal wording:
- Results help: “Available reports show synthetic sample results, including scores and source information. A held report is unavailable under the current synthetic reporting policy.”
- Held state: retain existing “Report unavailable under the current synthetic reporting policy.”
- Sample label: retain “Synthetic data.”
These are scoped to the current synthetic-report surface, not a claim that real-response scoring is approved or all results are synthetic forever.

Boundary: Report/scoring and Auth owners confirm the precise policy, authorization and evidence meanings. Design may improve presentation but must preserve exact values/provenance and useful limitations. Replacing a universal voice rule requires explicit copy-deck approval; this factual reconciliation does not ratify a new scoring policy or captain voice. Any future bands product remains a separate governed decision.

## Preservation and return

Do not duplicate the ten-row audit. Carry [FABLE-SPOTCHECK-2026-09-21.md](FABLE-SPOTCHECK-2026-09-21.md), observed blob6372f2b8ab1b300a6af0c220ea5c8bb2334e13e2, into copy review:
- TXT042: preserve/reword once-shown credential warning; do not invent persistence to justify cutting it.
- TXT060: retain problem-first reporting, audience/privacy context and uncertainty; binary footer is not equivalent.
- TXT070: retain consequential code/link/stage warnings and active paths until replacement proves them; remove jargon selectively.

All proposed wording above remains unapproved. Return to coordinator for semantic-owner review and exact-text copy disposition; final deck VERDICT remains pending. No code, broad copy rewrite, UI publication, source ownership claim or user outcome claim.

## Revision 2 — exact scopes, plain wording and retained consequences

Lineage: revision1 is preserved at kitchen commit4a2f37061b748cc9251b87a34f359ac7b8a7c8e0. Revision2 replaces only the three participant proposal lines above and adds scope/review material; it does not alter the frozen deck or broaden approval. CoS's kit-first presentation ruling retains authoritative app controllers and displayed Understanding/API identifiers; it is not a blanket copy VERDICT. No stage renaming is proposed here.

| Proposed text | Exact display condition / anchor | Exclusion or retained consequence |
| --- | --- | --- |
| “Sign in with an email code.” / “Cloudflare sends a one-time code to your email. Follow the sign-in instructions to continue.” | Deck Surface1 #/signin; actual ui/assess/scope.js signin() real link /v2/auth/access | Do not show app-owned sent/expired-link screens for Access, promise15-minute expiry or change sandbox auth. |
| “You are signed in.” | Deck Surface1 #/signin/verify replacement; only after actual successful app identity observation | Never from merely returning from provider or clicking sign in. |
| “Your answers. Check them before you submit.” | Deck Surface4 #/participate/review; actual participant review before submission | Does not claim the invitation is consumed, person uniqueness or that uncertain retries are prohibited. |
| “Thank you. Your answers were submitted. Your receipt may be available when you reopen the survey in this browser.” | Deck Surface4 #/participate/receipt; only after a confirmed submitted receipt from the existing controller | Saved access is browser-held respondent access, not the reusable invitation. Resume remains subject to existing expiry/revocation/collection policy; current cannot-resume/closed states take precedence. This sentence is not shown for an uncertain send. |
| “Other people can use the same invitation to answer the survey.” | Deck Surface1 participant entry/explanation for a shared invitation | Not on legacy once-only access-code screens. Does not promise a revoked/expired/closed invitation works. |
| “Available reports show synthetic sample results, including scores and source information. A held report is unavailable under the current synthetic reporting policy.” | Deck Surface2 Understand help and Surface7 report help only for current synthetic-report feature | Do not apply to arbitrary future reports, change scorer/authorization, replace valid reports with kit placeholders or relabel held as necessarily small-group suppression. |
| Existing “Report unavailable under the current synthetic reporting policy.” / “Synthetic data.” | Actual held result / eligible synthetic-report label respectively | Preserve exact numerical values, provenance and meaningful limitations. |

Receipt-copy review note: “may be available” keeps resume conditional without exposing session terminology. Existing cannot-resume, expired/revoked access and collection-closed states remain authoritative. Confirmed submission and possible later receipt access are distinct claims; the existing uncertain-send message is unchanged.

TXT042/060/070 remain preservation obligations, not extra rewrite assignments:
- TXT042 anchor: ui/assess/share.js issued-link Copy/QR/Print controls. Keep the once-shown/copy-now consequence and loss on identity/survey changes. No promise that links can be recovered later and no credential-storage change.
- TXT060 anchor: ui/assess/feedback.js problem-first form and proposed159 dialog entry. Keep intended account/support audience, optional text/ratings, no automatic attachment and uncertain-write consequence at the decision point. A one-line binary footer cannot replace the reporting flow. Existing159 custody is separate.
- TXT070 anchor: legacy facilitator invitation/code export actions and stage controls reached by retained deep links. Keep once-only export/recovery limits and state-changing consequences; jargon may be condensed only when those remain visible. No surface retirement until authoritative replacement behavior is proven.

Fresh driver's-seat lens applied to this three-correction proposal and frozen-deck/current-source evidence: shortened pre-submit copy to the user's immediate action, separated confirmed receipt from uncertain send, restricted multi-person wording to shared invitations, and made each text conditional on the actual controller state. Rejected “this link cannot be answered again” (wrong scope), “session” in primary UI (internal language), unconditional “reopen to see your receipt” (storage/policy limitations), and broad loss of privacy/credential warnings to achieve brevity. This is a constructive revision receipt, not independent acceptance.

Confidence: high for the cited source behavior at recorded app76fe138, provisional for comprehension of the proposed exact wording; no new runtime or user test was performed. Risks: oversimplified receipt wording could still confuse access to a past response with reopening collection, and broad bands-rule edits could accidentally change product policy. Cost is bounded semantic/copy review and affected state screenshots after implementation. Text remains reversible before publication; a published misleading promise can affect user choices, so exact-text disposition is still required. ui_audit independently reviews this proposal; this author does not accept it.

Post-challenge lens refinement: chose one conditional “may be available” receipt sentence instead of an alternative pair, to make exact-text review unambiguous. Disconfirmer: a source change removing browser resume, or independent comprehension review reading this as a guaranteed receipt/reusable personal identity, requires revision before bind. Source claims are established only at the cited commit; wording remains a working proposal. This answers the challenge confidence/disconfirmer prompts.

Post-lens Oddkit planning challenge re-run at2026-09-22T01:48:49.050Z: knowledge_base governance; block_until_addressed=false. It repeated confidence/disconfirmer prompts answered explicitly above. Tool challenge is not independent copy acceptance; ui_audit review and final copy VERDICT remain pending.


## Independent scoped review — ui_audit, 2026-09-21

**ACCEPT revision 2 exact operational clauses at b0ce0256b6d2a0685f4b305e06d2e65a191d0fd2 for coordinator scoped disposition**, subject to the display conditions already specified above. This is independent semantic/copy-plan acceptance, not publication, full-deck VERDICT, authenticated runtime proof or FIRE.

Independently read normal-root scope.js sign-in and src/index.ts Access callback at accepted app tree; shared-link.js namespace/resume limitations and participate/controller.js confirmed/uncertain receipt logic; report-view.js and handlers/report.ts held/numeric provenance behavior. The inspected accepted d93fa68 source tree matches app76fe138 tree df7caca24120c9e4ace1ea41be67bf584001d7c4, independently rechecked via Git commit API. No live auth, submission, report build or provider settings were exercised.

- Email-code entry/explanation is consistent with the actual Access route. Success copy is valid only after confirmed app identity; no code-expiry duration or app-owned link consumption claim remains.
- Participant review and confirmed-receipt text no longer claims the reusable invitation is consumed. “May be available” is conditional enough for current browser-held resumption; existing closed/cannot-resume/uncertain states take precedence. Shared invitation explanation must retain its explicit exclusion from once-only code flows and expired/revoked/closed states.
- Synthetic report help, held reason and sample label match the current scoped feature. This does not approve real-response scoring, a universal bands policy, the excluded grouping/privacy assertion or presentation of held results as a small-group finding.
- TXT042/060/070 preservation requirements are retained. No material amendment required within these three clauses.

Implementation acceptance still requires the actual mounted state screenshots/tests and current owner/file custody. Coordinator may accept these bounded operational replacements without treating all frozen deck prose as approved. Exact wording outside these rows remains outside this review. The full kit target and displayed Understanding ruling are unaffected.


## Coordinator scoped disposition — 2026-09-21 21:52:44 EDT

ACCEPT the exact revision2 operational clauses at b0ce0256, with independent semantic review9c0c617 and every stated display condition/exclusion, for use by the separately gated batch implementation. This follows CoS's explicit instruction to incorporate factual corrections after independent review. It supersedes the proposal-only status solely for these enumerated replacements. It does not approve the entire frozen deck, change scorer/auth/storage/collection policy, authorize Chris-voice text or waive mounted-state/ownership/release gates. No UI publication occurred through this disposition. Retain original proposals/review as lineage; any changed wording or scope needs affected review.
