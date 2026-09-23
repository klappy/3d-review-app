# Proposed amendment — identifiable printable surveys (#149)

Status: PROVISIONAL revision 2; separate review and owner bind required. Revision 2 below supersedes conflicting revision-1 recommendations. Planning only; no implementation fire.
Date: 2026-09-21 America/New_York.
Existing authority: TICKET.md and DESIGN.md in this directory; accepted ../2026-09-18-survey-feedback-meal/EVALUATION-2026-09-21.md. Preserve their history.
Owner: permissions_increment remains intake owner; root coordinates delivery. This planning receipt does not transfer source custody.

## Observed baseline and limits

Main 2e9cb18b80dc60e93631dac56c8f2c2c3bd0ed36 and production 0b798cede7f5ed4a5ccc82de4e196a5587f8ecef share tree fecf8813ae19c7e9d2d21aee78775d7c2bbd93bc, version 0.14.3. Local retained production-candidate checkout at 7139e0fc5b493d54317afc11bc56fd5ef0e60b9a has that same tree.

Inspected ui/stage-screens.js, ui/assess/share.js, ui/assess/assess.js and src/handlers/survey.ts. The member-authorized blank endpoint returns template identity and questions, intentionally no credentials. loadBlankPrint drops assessment/survey context. renderBlankPrint intentionally renders “No invitation link on this blank form”; printBlankForm mounts an isolated article. Existing share flow requires explicit confirmation before minting, keeps access link in memory and renders an invitation with assessment/template information, real SVG QR and full bearer URL, but no questions. Existing staff route is #assessment/{aid}/survey/{sid}; its unauthenticated return-through-sign-in behavior is not yet verified.

Independent actual-module JSDOM reproduction used 30 synthetic questions and example.invalid with SYNTHETIC_ONLY token. Blank: 30 questions, zero SVGs, Letter default; isolated print: same, 12mm page margin. Invitation: one SVG, zero questions, synthetic assessment label and URL fallback present. No production data, mint, network write, browser rendering, PDF pagination, physical print or camera scan was performed. Local receipt: /tmp/3d-review-149-reproduction.json. This confirms the intentional split, not a QR encoder defect, and does not establish the reporter’s experienced client version.

## Proposed behavior — one form, explicit access mode

Default “Print blank survey” remains credential-free. Its print preview and every printed page identify template title, immutable template id/version and exact assessment/survey identifiers. Do not add organization, assessment display name, participant name, email, response, analytics or bearer credentials by default. Identifiers are still potentially sensitive correlation metadata; preview states what leaves the application on paper, and authorization to read the assessment remains required.

Default first-page QR encodes the canonical application origin plus existing staff survey fragment route. Label: “Open this form — sign-in and assessment access required.” Human-readable fallback is the same complete staff URL plus separate selectable/wrappable assessment id, survey id and template version. Possession of this code grants no access. Never substitute an anonymous answering URL or call invitation mint APIs in this mode. Do not introduce a short-link resolver, new identity database, tracking service or alternative authorization path.

The current invitation action remains a distinct “Print invitation” mode, with its existing explicit issue-link confirmation, bearer warning, QR, full matching URL and no questionnaire. Add the same minimal form identity to that sheet, but do not automatically combine an answer link with the questionnaire in this bounded increment. The preview must distinguish “staff form link” from “anyone with this invitation link can answer.” Existing revocation, collection closure and uncertain-mint behavior remain authoritative. A participant-facing combined form can be separately evaluated after this distinction is tested; it is not implicit work under this plan.

Invalid/missing identifiers or canonical origin: disable identified printing with an actionable retry message; do not emit an ambiguous or wrong-assessment QR. QR encoding failure: display the matching complete fallback URL and identity, visibly report QR unavailable, and allow manual-entry printing only after explicit preview acknowledgment. No remote QR service and no fabricated image placeholder.

## Pagination and scanning contract

Use the current isolated print surface and Letter/A4 setting. Repeat a compact credential-free identity block on every page through an explicitly tested print layout; do not rely on an untested CSS repeating header. If the chosen browser cannot repeat it reliably, implementation must change layout before acceptance rather than claim screen preview proves paper. Keep each question heading with its answer area where possible; no clipped text, intersecting footer or blank overflow page.

QR uses the existing local encoder, black on white, at least four modules of quiet zone; never scale below 0.4 mm per module on the printed artifact. Size grows with payload length rather than truncating identity. Actual scan tests determine whether these initial design minima suffice; failing cases increase size/layout before acceptance. QR and fallback must decode to byte-identical intended URLs. No invitation token enters the repeated default identity block.

## Implementation dishes and ownership

One bounded implementation ticket is produced only after this proposal is independently reviewed and bound. Proposed source scope: blank print model/rendering in ui/stage-screens.js; invitation identity/rendering in ui/assess/share.js; print styles and focused existing print/share test files discovered at fire. Pass already-authorized assessment/survey context explicitly, never derive identity from title parsing. Preserve the server's credential-free print contract; adding backend fields is unnecessary for the proposed minimal identity.

Integration in ui/assess/assess.js is protected by #159: coordinator obtains its owner's exact handoff or arranges the owner to apply the small context-passing change. No parallel edit under assumed ownership. #156 and #159 release work remains protected. Fable's provisional design batch must not absorb #149; cross-reference its frozen visual baseline when available, but workflow reproduction and security proof do not wait for cosmetic changes. #161 has no observed dependency and remains deferred.

## Acceptance evidence and release gates

1. Independently review the access-mode choice and identifier disclosure; bind the proposal with existing owner. Refresh current heads/claims, run CHECKLIST and FIRE-CHECK with preflight, challenge, lens receipt and reuse evaluation. Not fired by this document.
2. Unit/integration proof: exact assessment/survey/template identity survives model/render; hostile labels escaped; no credential fields or mint requests in default flow; authorization cannot be bypassed by staff URL; invitation actions still require confirmation, avoid uncertain automatic retries, and clear cached link on identity/route changes.
3. Render actual browser print PDFs for Letter and A4 using one-page and 30-question multipage fixtures, long titles/ids and at least two available language fixtures. Record browser/version, commit, paper/scale and page count. Inspect every page identity, question continuity, margins, fallback wrapping, clipping and absence of unintended authenticated UI.
4. Decode QR from generated page images for both modes; compare exact expected URL. Then independently scan printed Letter and A4 samples with a camera and test manual fallback. Capture fixture-only evidence; physical scan pending cannot be replaced by SVG existence.
5. Access matrix: staff link signed out (sign-in then correct form), authorized member (correct form), other-assessment member/unauthorized user (denied), missing/deleted survey (clear unavailable); invitation active/revoked/collection-closed behave according to existing server policy. Use local/test fixtures; no live issue-link or response write without separate authorized test setup. Failed sign-in return route is an implementation dependency to fix within owner-approved scope before release, not an accepted broken link.
6. Independent reviewer observes the rendered/scanning evidence and source/privacy tests at exact candidate head. Required terminal CI/Bugbot and DEV/MAIN verification precede same-version identical-source production promotion under current hygiene. Normal canonical push build and active deployment/live receipt required; no manual deployment.
7. Issue #149 outcome remains open until reporter or equivalent intended-user confirmation that a detached page is correctly identified and the labelled digital entry works. Delivery receipt and user acceptance are separate. #150 physical pagination acceptance remains separate, though reusable fixture evidence may be linked.

## Driver-seat delta receipt

Applied the canonical driver's-seat prompt to the ticket, existing design, accepted evaluation and source behavior before challenge. System view: an authorized user selects an explicit paper access mode, previews the disclosure, prints traceable pages, and a reader follows a clearly labelled route whose authorization remains server-enforced.

Changes from the broad existing order: specify a credential-free staff QR rather than silently mint an answer link; preserve exact ids/version across every page; make full fallback and failure states explicit; require decoded PDF and physical scan evidence separately; split integration custody from planning ownership; make sign-in return-route proof a hard gate.
Rejected: automatic bearer QR on every blank page (unrequested credential issuance/exposure); generic homepage QR (does not identify exact form); short-code backend (new mechanism without need); combined questionnaire/invitation in this increment (larger exposure and scope); DOM-only success claim (does not prove print/scan).

## Failure Modes — Paper obscures identity or grants unexpected access

Wrong/stale context; ambiguous QR label; bearer leak; clipped or missing repeated identity; QR too dense; sign-in loses form; stale owner assumption; release evidence mistaken for user acceptance.

## Required Response When Detected

Wrong/stale context: stop print and reload scoped data. Ambiguous label or bearer in default output: block merge and correct model/render privacy tests. Missing/clipped identity or scan failure: revise layout and repeat affected rendered/scan evidence. Lost sign-in route: fix and re-run access matrix before release. Owner conflict: return integration to coordinator without editing protected files. Missing reporter evidence: retain issue open and label outcome unmeasured.

## Review state

Provisional specification; rendered reproduction, physical scanning, access-matrix execution, formal order/fire checks, independent review and owner bind remain pending. No new product code, live writes, ticket duplication or implementation ownership claim.

## Challenge response and confidence

Oddkit planning challenge at 2026-09-22T01:16:15.483Z used knowledge_base governance; block_until_addressed=false, with confidence, cost and reversibility questions. Confidence is high only for the inspected source/JSDOM behavior at the recorded tree; proposed staff-link usefulness is a working hypothesis. One synthetic fixture is not representative print or user evidence. Strongest alternative: participants may actually need an anonymous answer QR on a questionnaire. If intended-user review establishes that requirement, reject this bounded staff-link choice and revise explicitly before implementation.

Costs: denser codes and repeated opaque ids consume paper space; a staff route may frustrate participants; printing correlation identifiers creates disclosure risk even without bearer access. Default metadata is deliberately limited, but independent owner review must accept that disclosure before bind. Printed paper cannot be recalled; software rollback removes future generation only. No token is made revocable by a QR, and existing issued invitations continue to require existing revocation controls.

Post-challenge lens delta: added falsifier for the staff-entry hypothesis, explicit paper-disclosure/space costs and the irreversible boundary at distribution. No product or scope change. Proposal remains reversible before implementation/distribution. Existing same-app encoder/share/print prior art is observed; installation-wide prior-art gate and formal reuse evaluation are still pending before fire.

Final post-delta challenge: 2026-09-22T01:16:35.807Z, knowledge_base, block_until_addressed=false. Its confidence prompt remains answered in the preceding explicit high-confidence source observation / working-hypothesis design distinction; this is not an independent review or a FIRE verdict.

## Revision 2 — coordinator review amendments, 2026-09-21

Reoriented current main: 76fe13823dda23c9c046d2b44cdce94fc0842602 (0.14.4 roadmap change). Re-read current ui/assess/assess.js blob 15b6b5dcbddee2cbc5dcdce9fe053b8cdec0a815 and src/index.ts blob c20286c4c906e553886d66a52345d161dcde9766. This refresh does not claim production moved or repeat the earlier print rendering fixture at the new head.

### QR target: conditional choice with a concrete navigation dependency

The revision-1 suggestion that normal sign-in returns to the exact survey is disproven by source. Current server auth callback returns /#session={token}; current client consumes that fragment and replaces it with /#workspaces. Its signed-out deep-link panel explicitly tells the user to sign in and reopen the address. Executed the current scrubCredentialHash function with mocked browser primitives and a synthetic session fragment: result “session”, replacement /#workspaces. This is a bounded local navigation-function reproduction, not a real Cloudflare login or full browser flow.

Therefore the proposed staff QR is NOT ready to bind as a seamless digital-entry target. Concrete prerequisite within the existing #149 plan: the owner of ui/assess/assess.js and auth navigation must implement and independently validate safe return to the exact staff survey after sign-in, or explicitly accept the existing sign-in-then-rescan/reopen interaction as the product behavior. Recommendation: safe return, not a silent rescan requirement. The plan chooses safe return as the proposed implementation dependency; coordinator must secure the existing owner's participation before fire. No source custody is inferred.

Proposed return contract: store only a validated same-origin staff assessment/survey route in tab-scoped sessionStorage immediately before initiating sign-in; never preserve session/invite/survey bearer fragments, arbitrary URLs, query strings or external origins. On successful session callback consume and delete that intent once, then navigate to it; server authorization still gates all content. Clear stale intent on explicit cancellation/logout; use a ten-minute expiry; malformed/expired/missing values fall back to current workspace landing. Test blocked storage with visible sign-in-then-reopen instructions and the original credential-free URL retained on the pre-login page. Tests cover fresh/expired/malformed/cross-origin intent, two tabs, cancellation, repeated callback, forbidden assessment and deleted survey. This is proposed navigation scope, not observed existing behavior; auth owner review may require a separate bounded implementation dish within #149. No new backend redirect parameter is proposed.

### Compact page identity replaces repeated raw-id blocks

Replace revision-1 requirement to display all full opaque ids prominently on every page. Each page's human-facing header repeats template title and version plus a neutral compact “Form reference” derived deterministically from the exact assessment id, survey id and template id/version (SHA-256 canonical tuple, first 12 hex characters). This reference is a disambiguation aid, NOT authorization and NOT a database lookup key. Do not imply collision-free identity.

Retain complete exact credential-free identity in an unobtrusive, readable footer on every page (small but at least 8pt, wrapped, no truncation), and first-page staff QR plus full URL fallback. Human label first; exact machine identity remains recoverable when a page is detached. No assessment/organization/person names are added. Two synthetic forms with the same title must remain visibly distinguishable; adversarial long identifiers must not clip. If full metadata cannot fit without clutter or loss of readability, return layout to review rather than shrinking below the readability floor. This supersedes the revision-1 raw-id presentation, not exact identity requirements.

### Generated print evidence versus physical outcome

Replace revision-1 acceptance item 4's universal physical-camera release gate. Agent-verifiable release evidence is actual browser-generated Letter and A4 PDFs, inspection of every page, rasterized-page QR decoding (not source SVG decoding), full fallback comparison and the access/navigation matrix. PDF print output is mandatory; screen DOM alone is insufficient. Record browser, scale, page sizes/counts and decode result; apply quiet-zone/module-size requirements in that real output.

Physical paper/camera scanning is not an available agent capability here and was not established as a mandatory universal release prerequisite by the existing ticket. Preserve it as explicitly pending intended-user follow-up alongside reporter acceptance, with Letter/A4 coverage tracked separately. Do not call that outcome verified from PDFs. Coordinator/owner must bind this exact coverage before implementation; if they interpret existing “actual print output” as physical-paper acceptance, hold that portion rather than silently downgrade it. #149 can record software delivery with physical/user outcome pending and remain open. Any real physical scan failure reopens the layout defect regardless of passing raster decode. #150's distinct physical pagination outcome is preserved.

### Fresh lens delta and review disposition

Applied the driver's-seat lens again to the revised whole design. Changes: exposed the actual workspace-landing dependency before QR selection; specified bounded safe-return behavior with fail-closed route validation; made the dominant paper label compact while retaining exact detached-page identity; split reproducible PDF release proof from unavailable physical-user evidence. Rejected: asserting successful return from a valid route string; making a camera test an agent capability by writing it into a gate; shortening ids and pretending they remain exact; silently equating PDF decoding with physical scanning.

Confidence: current callback behavior is source/function-observed; safe-return usability and compact layout are design hypotheses pending implementation and independent evidence. Risks/costs: expanded auth-navigation review and protected-file coordination, additional footer area, residual correlation metadata on paper, possible camera-specific failures. Reversible before distribution; distributed paper cannot be recalled. No product changes or provider login were performed. Formal bind/fire remain pending.

Revision-2 post-lens Oddkit challenge: 2026-09-22T01:19:35.413Z, knowledge_base governance, block_until_addressed=false. Confidence question is answered above with the source/function observation versus proposed-design hypothesis distinction. Independent coordinator/product review remains required; this is not a FIRE verdict.
