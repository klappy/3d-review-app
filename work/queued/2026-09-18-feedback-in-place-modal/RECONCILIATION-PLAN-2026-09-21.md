# Proposed bounded reconciliation — feedback in place, app159 / cookbook99

Status: PROPOSED, NOT CLAIMABLE, NOT FIRED. Amendment to existing kitchen rail/1-ordered/2026-09-18-feedback-in-place-modal/TICKET.md. No duplicate issue or source ownership transfer.
Prepared: 2026-09-21 America/New_York; assessment recorded 2026-09-22 01:23:24 UTC.
Coordinator: existing root/Auggie routing. Intake owner: permissions_increment. Implementation owner: not assigned; coordinator must name and receive actual acknowledgment. Independent reviewer: coordinator assigns an available seat distinct from author at exact-head handoff; no reviewer acceptance claimed.
Size/risk: bounded implementation reconciliation; privacy-bearing metadata and release control require explicit owner review, no sensitive disclosure authorized.

## Product and done means

Deliver existing #159 modal/context behavior on current main without undoing #156, preserving existing API/MCP authorization, uncertainty handling and release provenance. Done means independently accepted exact source and actual normal-shell evidence, green required checks, canonical DEV and identical-source production receipts. User outcome remains separately unmeasured; do not close all of #130.

## Inputs, dependencies and exact preservation

Read kitchen RECOVERY-ASSESSMENT-2026-09-21.md at commit4e8ded15c0cdd1d6599d83df79b55fdb2a3a1790 and existing TICKET/DESIGN. Preserve app159 head332b862903c2d3961681649d2d450fd7fe669e8a and commits ab8c83de7b42decd25ae0af96f42e9d5d9442621,5a77efa4d97fd25e48b0be2410235c46a21186d4,332b862903c2d3961681649d2d450fd7fe669e8a.

Observed main76fe13823dda23c9c046d2b44cdce94fc0842602; merge base d5c7b259542b4e2ad2f45f91c1fa103245cb6094; candidate ahead3/behind2. Fresh refs at fire govern. Prior PR metadata base is stale. Confirm #156 canonical DEV delivery and coordinator dependency disposition before proceeding to release; source reconciliation can only start under separate explicit fire.

Cookbook99 source at7c1bd9e40e9f5a0cd94172f9d5d8e3fd5157e65d contains planning/2026-09-16-parity-build/AMEND-2026-09-18-feedback-in-place-context.md and releases/0.15.0.md. Fetch exact pin; default-main404 is not permission to recreate/discard. Review and land through cookbook's existing authority, preserve previous0.14.4 record and add/reconcile0.15.0 against resulting product commit. Final app manifest and vendored cookbook bytes must match accepted exact cookbook pin, including source chain; no invented hash/self-referential record.

## Implementation scope

Prefer a merge of current main into the existing feature branch after coordinator source custody is recorded; this preserves all three commit identities and avoids force push. If policy requires replay, coordinator approves that specific alternative, keeps original refs, and requires range-diff semantic equivalence. Do not rewrite historical receipts.

Allowed functional files are the existing candidate delta: ui/assess/assess.js, feedback-modal.js, feedback-modal.test.mjs, feedback.js; src/handlers/feedback-provenance.ts; contract/capabilities.json and openapi.yaml; docs/feedback-provenance.md; test/feedback-provenance.test.ts. Build/release plumbing remains existing .gitignore, scripts/stamp-version.mjs, ui/server.mjs, package.json/package-lock.json, test/version-stamp.test.ts, release/release-manifest.json and release/cookbook records/index. Confirm actual diff at fire; unexpected files return to coordinator.

Retain current-main ui/roadmap changes from #156 exactly unless reconciliation reveals a concrete coupling for independent review. Preserve candidate's native dialog outside work root, route and unsaved input identity, same-route draft, route/identity invalidation and suppression of late completion. Context remains exact page/component enums; no extra keys, values, ids, URLs, answers, screenshots or credentials. Experienced metadata comes from loaded generated release module, not health. HTTP/MCP and support-only readback remain aligned. No migration, seed, tracking service or new capability.

Do not implement #149 sign-in-return or QR behavior here. ui/assess/assess.js source custody is exclusive during reconciliation; report release handoff before #149 integration. No Fable visual overhaul, attachments152, aggregation155, greeting161 or broader130 closure.

## Verification contract

Author runs existing affected feedback/modal DOM tests, provenance Worker/D1/HTTP/MCP roundtrip and rejection tests, version/stamp tests and typecheck; record exact commands discovered from current package scripts, commit and counts. Expected historical baseline21/20/16 is comparison context, not mandated count or fresh evidence. Run broader repository-required checks once after functional reconciliation; repeat only affected checks after subsequent changes. Verify public-asset exclusion of tests and generated metadata consistency.

Actual normal-shell browser proof uses local exact-head application assets, synthetic authenticated fixtures and intercepted feedback writes. Load actual shell/controller; no substitute component-only HTML. Use an isolated empty browser context with no real cookies, saved credentials or production storage. All fixture data and credentials are synthetic. An explicit local-origin/method/path allowlist must intercept permitted fixture requests; refuse EVERY unrecognized write and EVERY nonlocal write before network dispatch. No pass-through fallback. Treat POST/PUT/PATCH/DELETE and unknown methods as writes; fail the run on an unexpected request. Record refused-request evidence and verify zero live submissions. Load no authenticated remote application in this fixture.

Record browser/version, head, fixture setup, screenshot and observed DOM/URL/payload receipts. Cases: (1) unsaved actual editable field survives open/Back/Escape with root/input identity and URL unchanged; (2) draft survives same-route reopen and focus returns to opener; (3) keyboard focus stays in native modal and returns on dismiss; (4) route departure and identity change clear draft and suppress delayed prior response; (5) outbound payload contains only permitted context and actually loaded-client identity, with synthetic input values/private markers absent; (6) uncertain write remains uncertain and no automatic resubmit. Include signed-out/demo gates unchanged. No actual user records or live feedback submission.

Precise late-response oracle: hold the synthetic response after request dispatch, depart route or change identity, then resolve it. Assert the old result does not alter the new route/identity UI, reopen the old modal, restore the cleared draft, display a stale success receipt, or trigger another request. This proves stale-UI suppression only. A request already dispatched may have committed; do not label departure as cancellation, assert no server effect, or show a false failure/undo claim. Preserve existing uncertain-write handling for unresolved writes.

Fixture reproducibility gate: a repeatable normal-shell entrypoint and command have NOT been verified. The prior setup timed out before observation. The implementing owner must supply the actual fixture path, exact start/run commands, synthetic routes and deny-by-default network guard, and independently demonstrate them before browser acceptance. Do not invent a runnable command or treat historical fixture setup as proof.

Independent reviewer receives exact app head/tree/base, minimal diff/range comparison, cookbook pin+blob identities, source-chain receipt, test commands/results, normal-shell fixture and observations, known limitations and all open findings. Reviewer independently reproduces core preservation/focus/context/invalidation cases and examines HTTP/MCP privacy contract. If head changes, return only affected delta with fresh evidence; never carry unconditional ACCEPT across changes. A setup timeout is untested, not pass.

## Release boundary

This draft grants no merge. After exact-head independent ACCEPT, terminal genuine Bugbot and all required checks, coordinator may separately authorize normal expected-head MAIN merge. Observe canonical DEV push build terminal success, actual active version and live health/pin/assets/changelog/privacy. Only then prepare same-version identical-source production candidate and separate independent equivalence review/disposition. No seat/manual deploy, migration, seed or bypass. #130 and human outcomes remain open as appropriate.

## Failure Modes — Reconciliation erases corrections or inflates proof

Current-main regression; dropped candidate behavior; stale cookbook pin; overlapping source ownership; component fixture mislabeled normal shell; missed private payload field; absent Bugbot; unresolved async write; changed refs.

## Required Response When Detected

Stop and preserve worktree/refs for ownership or changed-base ambiguity. Resolve regression within scoped source and rerun affected tests. Return cookbook mismatch to canonical record/pin reconciliation. Reproduce actual normal shell before claiming browser acceptance. Privacy or uncertainty failure blocks merge. Missing checks remain pending. No repeated retries or deadline resets without an actual new observation.

## Planning and fire gates still owed

Review amendment: these corrections fold ui_audit's AMEND into the existing proposal; they are not an independent ACCEPT. At fire, fetch actual current main and #159 refs again. Record exact baseline/head/tree and compare the complete ui/roadmap directory, including file inventory and each blob, byte-for-byte against accepted #156 main76fe13823dda23c9c046d2b44cdce94fc0842602. If newer accepted main legitimately changes that directory, obtain its explicit disposition and baseline; do not silently overwrite it or waive equality. Reconciled candidate must retain all applicable approved roadmap bytes. An unexpected difference stops handoff until reviewed.

Actual implementation-owner ACK is a separate required receipt naming source files, frozen starting refs, exclusive custody and bounded checkpoint. This plan author is not thereby the implementation owner. ui_audit independently reviews this authored plan before bind; source/browser reviewer custody at the later exact-head handoff also requires a real ACK. No fabricated assignment or acknowledgment.

Coordinator reviews this draft, names custody/reviewer and bounded worker promise, refreshes dependencies and accepts risk boundary. Then run live CHECKLIST, preflight, driver's-seat lens with delta, post-lens challenge, reuse evaluation and FIRE-CHECK in the existing ticket home. These gates have not been run on this local draft. Existing implementation is cargo to recover, not authorization to skip the gates. Return checkpoint to Auggie/root with exact evidence and next gate; no user approval relay invented.

## Superseding bounded amendment after independent review be98ccec

Status remains NOT CLAIMABLE / NOT FIRED. This section supplies the three requested precisions; historical wording above is retained for lineage but this section governs conflicting scope/sequencing. No product files edited.

### A. Fixture-preparation prerequisite, explicit stop

Before product reconciliation, coordinator separately authorizes a fixture-only preparation step against preserved app332b862903c2d3961681649d2d450fd7fe669e8a in an isolated checkout. It may create only local review harness artifacts outside product source:
- /tmp/3d-review-159-normal-shell/server.mjs
- /tmp/3d-review-159-normal-shell/browser-check.cjs
- /tmp/3d-review-159-normal-shell/route-contract.json
- /tmp/3d-review-159-normal-shell/PREPARATION-RECEIPT.md and evidence outputs.

These are proposed paths, NOT existing verified commands or completed artifacts. The step must implement and execute the proposed interface:
- node /tmp/3d-review-159-normal-shell/server.mjs --root <absolute-exact-head-checkout> --host 127.0.0.1 --port 8891
- node /tmp/3d-review-159-normal-shell/browser-check.cjs --origin http://127.0.0.1:8891 --expected-head <full-sha>

Use actual ui/index.html and imported assess controller, not replacement component HTML. Server serves only allowlisted local app assets and synthetic fixture endpoints; browser uses empty isolated context and deny-by-default network routing. route-contract.json enumerates exact method/path/request-response pairs needed for /v2/me, project/scope loading and a mounted actual editable field, plus authenticated feedback dry_run/execute if actual controller invokes them. Discover actual request shape from preserved source; do not invent accepted endpoint payloads. Synthetic responses use current envelope and role shape. Fail every unrecognized write or nonlocal write before dispatch; do not fall through to real API. No real cookies, identities, records, email or provider login.

Preparation receipt must include exact head, executable commands actually used, route-contract path, successful normal-shell mount and editable-field observation, deliberately refused unknown-write/nonlocal-write probes and zero real writes. Independent reviewer reproduces this before dependent product reconciliation FIRE. If the local harness cannot load the shell, stop here with precise dependency; do not start product/metadata edits and leave discovery to final acceptance. If product test edits are needed, request an exact-path scope amendment first; none are silently authorized. Existing stamp command may generate ignored local release identity from the pinned source; this is not a product edit or release.

### B. Exclusive shared-path interval

Coordinator directs #159 reconciliation FIRST for ui/assess/assess.js and its feedback seams. Actual source custodian has NOT ACKed yet; coordinator records the real ACK, starting head332b862903c2d3961681649d2d450fd7fe669e8a, fresh merge baseline and bounded worker checkpoint before any source work.

Custody interval starts at that actual ACK and ends only at an explicit accepted-exact-tree handoff. K3 may read but must not write assess.js/feedback.js during that interval. Handoff records reconciled full commit/tree, independent source/browser ACCEPT, remaining release state and any integration prerequisites; K3 must consume that exact accepted lineage after acknowledging custody. Never substitute a branch name for handoff SHA. #149 auth-return and #161 greeting remain separately scoped and cannot edit these files concurrently. #159 recovery remains a separate bounded delivery lane before subsequent single design-batch integration; no forced combined release and no #149 fix smuggled into modal work.

### C. Machine-checkable file boundary

App tracked write allowlist (each exact repository-relative path; no glob):
```
.gitignore
contract/capabilities.json
contract/openapi.yaml
docs/feedback-provenance.md
package-lock.json
package.json
release/cookbook/0.15.0.md
release/cookbook/releases.json
release/release-manifest.json
scripts/stamp-version.mjs
src/handlers/feedback-provenance.ts
test/feedback-provenance.test.ts
test/version-stamp.test.ts
ui/assess/assess.js
ui/assess/feedback-modal.js
ui/assess/feedback-modal.test.mjs
ui/assess/feedback.js
ui/server.mjs
```
Cookbook tracked reconciliation paths, under existing #99 authority:
```
planning/2026-09-16-parity-build/AMEND-2026-09-18-feedback-in-place-context.md
planning/2026-09-16-parity-build/releases/0.15.0.md
planning/2026-09-16-parity-build/releases/releases.json
```
Existing0.14.4 records and all ui/roadmap files are preservation-only, not permitted release reauthoring. The feature carries historical0.14.4 cargo because stacked; reconcile by inheriting accepted main, not overwriting it.

Generated local-only artifacts from inspected scripts: src/version.generated.ts, ui/changelog.json, ui/client-release.js; src/roadmap/permissions.generated.ts only through existing generator with empty synthetic/no-privilege configuration when needed. They remain ignored/uncommitted, never hand-written canonical records or authorization secrets. No scripts/stamp-roadmap-permissions.mjs modification authorized. Any other generated tracked output requires specific coordinator allowance before writing/committing. Candidate diff must be a subset of the exact allowlist; preserve all original commits and approved release ancestry.

Fresh driver-seat delta: moved harness uncertainty into a separately authorized prerequisite with a hard stop before product edits; made the next worker's two commands and evidence concrete but honestly proposed; sequenced shared-file custody159→accepted exact tree→K3; expanded every tracked path and separated local generated output. Rejected speculative existing-harness success, concurrent assess.js edits, wildcard release paths and treating record metadata as permission. These amendments need fresh independent ui_audit review; author cannot accept own plan.

Post-lens challenge2026-09-22T02:25:43.555Z: knowledge_base, block_until_addressed=false; confidence prompt answered: preserved source/paths are observed, proposed harness commands are unexecuted interfaces and remain a hard prerequisite. Risk/cost is failed fixture preparation or overlapping custody; stop before product work if falsified. No FIRE verdict inferred.

## Sequencing supersession — accepted 161 source before 159 before K3

This narrow amendment resolves independent review cee22d6bca588510ea1431841aab8f8743e20472 and supersedes every earlier 159-FIRST/shared-path statement above. Coordinator orders 161 → 159 → K3. Incident account identity161 currently has independent source/privacy/synthetic-browser ACCEPT dcb9382568f4cd5314dfc9b891f4f77e163dd751 for app head96a56a57ad2775450558fb31041251d07d243cce, treec5563e543ea79be2d840e9efd680cac3d6c33a6d. That source receipt does NOT establish merge, canonical DEV deployment, real-provider acceptance or production delivery.

159 product reconciliation must wait for coordinator's actual accepted main handoff after the applicable161 release gates, refresh the resulting immutable main commit/tree and inherit it through a history-preserving merge. Do not treat the source candidate as already deployed or silently substitute its branch name for main. Preserve the existing three159 commits and all accepted161 account/session/privacy behavior; no auth/account fix enters159. Existing exact path boundaries remain unchanged. K3 follows accepted159 exact-tree handoff and must retain161 behavior. #149 remains separately protected. No overlapping source writes are authorized.

The previously specified fixture-only preparation prerequisite is now orderable as a separate bounded step without acquiring protected product-source custody: isolated preserved159 source, local /tmp harness and evidence only, exact proposed commands, synthetic empty context, fail-closed unknown/nonlocal writes and independent normal-shell proof remain as specified above. It is NOT automatically FIRE, not implementation started, and not evidence that the harness already exists. Coordinator must provide actual worker ACK/promise and applicable preparation gates before execution. Its independent success may precede161 delivery; dependent product reconciliation cannot.

Driver-seat sequencing correction: preserve the urgent account repair when later integrating modal work and give K3 one accepted lineage. This changes custody/dependency order only; fixture acceptance and exact file boundaries already accepted by the independent reviewer remain intact. No product edits or release action performed.
