# Independent K5 checkpoint AMEND — 10cd7e0
Exact10cd7e0c7f7c42c6239813121ec36233c50b8507. Partial independent source review, not final acceptance. Author continues; no reviewer product edits.

Independently ran adapter+actual-entry integration suites:30 passed, /tmp/k5-independent-10-tests.txt. Reviewed actual app.js codeRun and issue/preview/execute. Secrecy/currentness of inner state and diagnostic evidence are guarded, but **finally has no live() check**: it restores every still-connected old button's prior disabled state even after generation/session/selection changed.

Executable independent counterexample (/tmp/k5-independent-10/test/reviewer-code.test.mjs, output /tmp/k5-repro.txt):
hold issue → replace survey → new context sets #load-projects.disabled=true → resolve old issue. Expected true; actual false. The old completion enables a control owned by the replacement context. Same risk on rejection. Existing18-case matrix expressly permits restoring old state and therefore does not prove accepted plan's no stale control mutation contract.
Required correction within owned app.js/test: prevent stale completion/finally from mutating replacement control state, while ensuring invalidation/current operation establishes usable controls and does not leave permanent pending lock. Meaningful test must assert newly disabled AND newly enabled states survive success/rejection; do not merely loosen expected state to original dispatch value. No blanket global refactor.

Reference-access correction: frozen source is https://github.com/klappy/3d-review-cookbook/blob/c653482135a18e6ca33cccc230b44855595f9dc2/design-system/ui_kits/3d-review/views-coordinator.js . Reviewer fetched successfully; author guessed-repo failure does not establish unavailable target. Kit collecting code-batch/Print patterns must map to actual explicit preview/execute, no revoke/undo invention.

Actual isolated-browser harness preparation underway, not complete in this checkpoint; no desktop/phone visual pass claimed. /tmp/k5-browser.cjs uses real legacy module graph and author synthetic route contract, separate Chrome context; initial harness ORIGIN error corrected. Do not claim screenshots from JSDOM. Testasset200 remains known staff-serialized exclusion gate, not passed. Remaining role/refusal/expiry/browser/privacy reference proof stays explicit.
This AMEND is actionable now; no need stop author correction awaiting expanded review. Exact successor needs independent affected re-review.
