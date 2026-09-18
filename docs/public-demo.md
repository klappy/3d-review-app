# Public example and legacy-route disposition (issue95)

The public tour and sample assessment use the production assessment controller, scope/views modules and report renderer. The sample survey uses the production participant controller, question pager, answer review and receipt view. Demo transport is an explicit fixture adapter with no network fallback; its only simulated submission stays in a private in-memory store. It never reads staff credentials or changes real drafts, grants or responses. The regular version badge may read public health/changelog metadata.

The named example is Earning trust, January 2026:12 synthetic responses in3 surveys (Church2, Community6, Translation Team4). `tools/build-public-demo.mjs` extracts only this complete assessment from the committed source-pinned corpus. `node --experimental-strip-types tools/build-public-demo.mjs --check` verifies the generated artifact against the pinned input digests, forms and existing report oracle. The report body is copied from the established source projection; it is not rescored in the browser. Its timestamp identifies this offline demo snapshot, not a stored live report. General results remain held. Practice changes do not recalculate the snapshot. No real participant records are included.

## Routes

|Entry|Disposition|
|---|---|
|Current homepage tour/sample links; `/#how`, `/#example`|Same fixture-backed assessment at `/?demo=1#assessment/demo-assessment/prepare`|
|Legacy homepage tour/sample links; `/legacy/#how`, `/legacy/#example`|Same actual assessment; old narrative-only panels retired|
|Current homepage survey choice|Current survey entry with sample-survey option and existing optional access-code entry|
|Shared participant `#survey=…`|Existing standalone participant controller, unchanged|
|Invitation `#invite=…`|Preserved targeted legacy acceptance; no demonstrated replacement|
|Code participant after `/v2/participate/code`|Preserved `/legacy/#participant`; no demonstrated replacement|
|Generic current-header legacy link|Removed; workspaces/projects/assessment/permissions now current UI|
|Current `#reports-card` and public report links|Current projects entry; no implied shared-report token or permission|
|Legacy facilitator/workspace/participant/evidence URLs|Remain compatible; no backend routes deleted. Request activity and code entry are not claimed migrated|

Legacy homepage layout, styles, gradients, typography and perspective cards are preserved. Only destinations and truthful sample wording change. The hidden tour/example container IDs remain for existing entry visibility logic, with no duplicate functional implementation.

## Acceptance boundary

Required checks: normal homepage and direct legacy example entry; actual stage navigation and populated counts; open/close real report; inspect a synthetic answer and edit/review/practice receipt with the real participant flow; back/close; mobile viewport; no demo data network writes or real session-storage mutations; pinned-source artifact parity. These are synthetic agent tests, not human usability scores or live participant outcomes.
