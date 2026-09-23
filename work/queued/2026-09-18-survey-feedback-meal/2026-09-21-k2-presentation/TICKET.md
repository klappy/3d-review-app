# TICKET — 2026-09-21-k2-presentation
**What this is:** Prepare public, coordinator and administrative kit page views that consume supplied state and emit intents.
**Why now:** The accepted kit-first batch needs page composition above the isolated K1 shell.
**Your move:** Independent review of this specification; coordinator binds implementation custody and remaining dependencies before FIRE.

Status: PREPARED implementation specification; planning delivery only, not claimable/FIRE.
Class: entrée. Risk: STANDARD within isolated synthetic presentation scope.
Station: subagent. Owner: ui_audit planning custody, actual ACK; implementation custodian not yet assigned.
Promise: 10 active minutes for this planning delivery; implementation budget must be set by actual assigned worker before FIRE, not inferred.
Depends: accepted COMPARISON-PROPOSAL amendment4218b0, BATCH-PLAN-REVIEW b61b03c; K1 PR162 head1b0ae83a9c79b17f2154317d29c035422e769fce under AMEND for reproduced IME composition defect; corrected accepted head and integration required; scoped copy disposition2b09ccc; authorized exact test asset exclusion below.
Meal: 2026-09-18-survey-feedback-meal.
Outcome served: reviewers can inspect full kit page composition driven by real-shaped state before root/controller integration.
Learning signal: synthetic role/error/intent checks reveal presentation/state mismatches without causing app writes.

## Ingredients and fixed boundary
- App accepted baseline76fe13823dda23c9c046d2b44cdce94fc0842602. PR162 freshly read: unmerged, exact head1b0ae83, integration base76fe138. K1 core.js exports esc/safeHref/badge/link/chrome/levelMenu; tree.js exposes mountShell/update/content/destroy. At FIRE pin actual accepted K1 integration tree and recheck interface, not a floating branch.
- Frozen comparison/reference c653482135a18e6ca33cccc230b44855595f9dc2 design-system/ui_kits/3d-review/views-public.js, views-coordinator.js, views-admin.js; tokens/components/layout from K1. Public welcome/tour/sign-in, scope/entity/phase screens and administrative panels observed. Reference uses inline DB/S mutations and fictional receipts; deliberate divergence is explicit state/intent callbacks and factual operational copy.
- Accepted final target is kit-first full visual/interaction composition, one coherent batch. This dish is not a legacy reskin and does not reopen port choice. Displayed Understanding and phase/API ids prepare/collect/understand/improve stay.
- Existing three-clause COPY-FACT-RECONCILIATION revision2 b0ce0256, independent9c0c617 and coordinator2b09ccc apply only under exact display conditions. No broad deck VERDICT inferred.
- Prior art: existing house app controllers and cookbook kit inspected during batch planning; reuse K1 primitives/styles. No new library/framework/router/data source.
- Protected159 feedback,149 print/auth return,161 greeting remain separate. No implementation of their behavior or controller ownership; no API/backend/contract/permission/storage/receipt algorithm changes.

## Declared product — four new files plus one exact exclusion
1. ui/kit/views-public.js
2. ui/kit/views-coordinator.js
3. ui/kit/views-admin.js
4. ui/kit/coordinator.test.mjs
5. ui/.assetsignore — add exactly kit/coordinator.test.mjs; preserve K1 and every existing entry. Coordinator expressly authorized this fifth path before ticket bind.

Do not change K1 source/styles/tests/fixtures; ui/index.html, assess/*, participate/*, app.js, existing tests, packages, version, release metadata and production are excluded. Missing shared style primitive returns a named request to K1 custodian; no parallel style edit or invented replacement stylesheet. Browser evidence and temporary harness may live outside product repository under /tmp/3d-k2-evidence; do not add an additional fixture file silently.

Packaging scope: coordinator authorized K2 custodian to add exactly kit/coordinator.test.mjs to ui/.assetsignore as the fifth path. Preserve kit/shell.test.mjs and every prior entry; no wildcard cleanup. Actual Wrangler asset filtering must prove test404 and runtime modules200.

## Public module contract and exact coverage
Each module exports one mount function: mountPublicView(root, model, onIntent), mountCoordinatorView(...), mountAdminView(...). Each returns {update(model,onIntent),destroy()}. Rendering accepts explicit plain values/arrays, never raw HTML. root is a K1 content slot or isolated container; no duplicated shell/second main landmark. Update invalidates prior controls/callbacks, destroy removes listeners. Use K1 escaping/destination validation. No global V/DB/S, location changes, fetch/XHR/WebSocket, storage, cookies, crypto/id generation, timers that invent results, or automatic writes.

Model.common: context={identityKey,scopeId,epoch}; screen exact enum below; status=loading|ready|empty|unauthenticated|refused|notFound|notBuilt|error; title/eyebrow/help text from scoped accepted copy; items; actions=[{id,label,allowed,busy}]; receipt (only explicitly supplied confirmed state); error/notice. Missing fields do not become fixture facts. Context is opaque callback data, not displayed identifiers. onIntent receives {action,context,values}; values include only fields entered for that form. No live credential fixtures or private actor IDs.

| File | Screen enum / kit references | Required presentation inputs and intents |
| --- | --- | --- |
| views-public.js | welcome, tour, example, signin, help, status, trace | Welcome participant-first composition and three perspective cards; tour supplied steps/current index with bounds; sample banner only when model.sample; sign-in entry and confirmed identity state; help sections supplied; status/trace real-shaped supplied rows. navigation/start-signin/tour-next/tour-back intents. No mock email-sent/expired/consumed states, static healthy services or fake parity totals. Request/provisioning route is not introduced: current self-service behavior is authoritative; use supplied authorized action or honest notBuilt state. |
| views-coordinator.js | projects, projectNew, project, workspaceNew, workspace, assessment, templatePreview, viewer, invite | Kit entity cards/lists/create forms, assessment head/stagebar/four numbered phases, Prepare/Collect/Understanding/Improve/People content selected by model.view, invitation review. Fields/data are supplied; create/save/stage-preview/survey-select/survey-remove/share/report-preview/report-open/notes-save/invite-preview/role-preview/revoke-preview/transfer-preview/accept-preview intents only if action.allowed. No data mutation or success inference. |
| views-admin.js | support, templates | Kit panel/table composition for explicitly supplied supported operations. No hardcoded act-as/unlock/provision/publish behavior. Not-built/refused models render honest approved state; actions exist only if supplied allowed. Input previews emit intent; controller owns authorization, confirmation and effects. No claims all template publish/support features are implemented. |

Assessment model: stage and phase remain authoritative API values; phase is prepare|collect|understand|improve. Separate model.view=prepare|collect|understand|improve|people selects presentation. The four phase views map to unchanged phase ids; people has no API phase counterpart. Display understand as Understanding. Browsing emits browse-view with values.view only when that action is explicitly allowed; People never fabricates a phase/stage value or emits a stage write. Stage preview remains a separately supplied allowed intent. Survey cards expose supplied responses and optional explicitly supported denominator only; do not synthesize invited totals. Share state carries supplied presentation state but no fake token/QR credential generation. K2 provides named empty content slots for authoritative share/report/feedback/print controllers where full output already exists; visual wrappers match kit. K3 mounts real behavior later. Slots must survive local disclosure/menu toggles; model replacement clears obsolete slots. Report slot preserves exact values/provenance and held state; do not rebuild scorer. People data uses only supplied display names/labels, never manufacture email or organisation. Preview/confirmation visual state requires explicit model.interaction.step and supplied impact/action; confirmation callback emits intent, does not consume/mint token or mark success.


### Explicit state precedence (independent review amendment)
Resource load status remains Model.common.status above. Orthogonal model.report.eligibility=held|eligible|notBuilt is supplied only for report surfaces; held preserves supplied reasons/provenance and disables report-open. No missing eligibility becomes eligible. model.interaction={step:idle|preview|confirmation, actionId, impact, outcome:idle|pending|uncertain|confirmed|error}; missing interaction means idle with no confirmed outcome. actionId must identify an existing allowed action; impact is supplied plain data, not inferred effects. Confirmed rendering additionally requires an explicit supplied confirmed result/receipt; outcome=confirmed alone never manufactures one.

Precedence: refused/notFound/unauthenticated or any identity/scope/epoch replacement first removes stale rows, form values, sensitive slots, callbacks and prior receipt. A newly permitted model may render only its own supplied state; prior confirmed state never overrides denial. Loading/error do not turn earlier data into a fresh confirmation. pending or uncertain disables the corresponding duplicate action; uncertain retains truthful unresolved status without failure/cancellation/success inference. Preview/confirmation is a presentation step, not an outcome or grant. Explicit confirmed outcome plus supplied confirmed result permits receipt UI only in the current ready, permitted context. Held report eligibility prevents report-open even when an unrelated action is confirmed.

Tests must prove denial wins over a previously confirmed receipt, identity replacement clears slots, uncertain blocks a duplicate without false failure, preview does not imply confirmation, and a role-matched People view emits only browse-view (no phase/stage write).

## Copy and role conditions
Use accepted operational clauses for real Access sign-in and current synthetic-report help; confirmed identity/receipt only after model explicitly says confirmed. Participant receipt clause belongs K4, not a new K2 participant implementation. Preserve existing actor/audience/privacy and once-only warnings at affected slots (TXT042/060/070); never cut them to match a shorter kit footer. Problem-first feedback is an authoritative slot, not kit binary fake receipt.

Nonratified marketing/tour/help paragraphs are data slots awaiting grounded disposition; do not embed all c653482 prose as approved. Existing app operational labels and settled Understanding may be reused within current meaning. Rendering a supplied test string is not copy approval. Lack of approved new prose does not prevent component structure; acceptance receipt must list unavailable wording explicitly before final mounted acceptance. No forced human approval for every ordinary label; coordinator scoped review remains valid authority.

Role matrix: owner/member/viewer/direct-grant receive caller-derived actions and accessible scope data. View must not infer ancestor access or privilege from role name. For same role with allowed=false, action absent; allowed=true without valid action id still absent. Supplied busy/uncertain state never becomes enabled second write or success. Refused/notFound expose no stale prior entity rows; unauthorized invite/transfer controls absent for viewer fixtures. Synthetic fixture roles never become a product role selector.

## Seven observable Done-means
1. Reviewer can mount every enumerated screen with synthetic supplied data and observe kit composition, with no global fixture state or live request.
2. Reviewer can compare owner/member/viewer/direct-grant models and observe only explicit allowed controls, consistent role/scope labels and no hidden ancestor data.
3. Reviewer can activate form/navigation/phase controls and observe one correctly scoped intent with entered values, no direct data mutation, no inferred success and no stage change from phase browsing.
4. Reviewer can replace identity/scope during preview/error/uncertain state and observe stale callbacks/content removed, with no cross-scope status or prior data.
5. Reviewer can render loading/empty/401/refused/notFound/501/transient/held/uncertain/confirmed models and observe distinct truthful states, preserved warnings and only supplied receipt/provenance.
6. Reviewer can compare matched representative pages at1440x900 and390x844, use keyboard/focus/disclosures/forms, and observe kit layout with no horizontal overflow or lost mounted slot content.
7. Reviewer can inspect exact diff and actual local asset filtering and observe only authorized paths, excluded coordinator test, preserved runtime assets and no root/controller/version/release change.

## Meaningful verification and evidence
- node --test ui/kit/coordinator.test.mjs ui/kit/shell.test.mjs
- node --test ui/assess/entry.test.mjs ui/assess/scope.test.mjs ui/assess/views.test.mjs ui/assess/permissions.test.mjs ui/assess/share.test.mjs ui/assess/feedback.test.mjs (unchanged controller anchors; presentation tests required in addition).
- New test file owns synthetic fixtures inline: all18 enumerated screens (7 public +9 coordinator +2 admin), including all five phase/view variants within assessment. Report actual enumerated case count from tests rather than claiming a count by arithmetic; no skipped unsupported screen silently.
- Cross-cut cases: escaped hostile text/unsafe href, empty list vs fetch failure, owner disallowed action, viewer/direct no leaked ancestors, busy duplicate click, stale detached button after update, form value isolation, phase navigation vs stage preview, explicit-confirm-only, no network/storage, confirmed-only receipts, mounted slot retained across local controls.
- Browser harness outside product repo imports K1/K2 and mounts real DOM. Record desktop/phone pairs for welcome, sign-in, project, Collect, Understand held+eligible synthetic, People viewer+owner preview, support notBuilt; assess roles matched. Keyboard tab/Enter/Escape/focus and actual input/action exercised. Source-only/unrendered paths explicitly untested.
- Local Wrangler asset-only config uses actual ui directory/.assetsignore: coordinator.test404, runtime3view modules200 byte-equal, external harness not served. Full app build not required for pure views; do not fabricate generated files if unrelated full-worker dry-run fails.
- Receipt in this folder lists exact candidate/base/tree, commands/results, screenshot paths and case denominator, callbacks/requests log, allowed diff, remaining full-batch obligations. Independent implementation review after exact-head tests; applicable terminal checks before any integration merge.
- One feature PR targets design-batch/2026-09-21-integration after accepted K1 integration. No main/production target, merge or deployment from this ticket.

## Failure Modes — What Breaks When Presentation Becomes Authority
Fixture actions imply real writes; copied prose promises unsupported auth/scoring; role name creates grants; stale context emits wrong intent; rejected data survives in DOM; component CSS/controller scope expands; asset test leaks; missing K1/copy/custody gate hidden as completion.
## Required Response When Detected
Fail test and correct within owned view file; restore caller-derived data/allowed action and explicit outcome. Return unsupported copy to scoped ledger and retain truthful existing warning. Stop for scope/custody amendment if fix requires excluded file; do not redesign target. Asset/custody dependency unresolved means no FIRE, not a waiver.

## Borrow and reversibility
Borrow applied: frozen kit layouts/K1primitives. Bend planned: state/callback boundary and scoped copy. Break observed: kit DB mutations, fake receipts, unsupported provision/act-as/link semantics. Beget not required: house owns source. Bide not selected: settled target; gate waits explicit. Build minimal pure presentation modules/tests. Reversibility: new unmounted files removable, no data migration; later integration has separate release boundary.

## Planning delta and current gates
Driver-seat: reviewer must drive pages without unknowingly becoming a user/grant issuer. Revised scope names every screen, separates phase from stage intents, requires explicit status/allowed fields, preserves mounted slots and scopes copy rather than copying a whole mock deck. Rejected globalfixture transplant, broad marketing approval, adding unsupported support workflows, controller rewrite, and a test under ui without exclusion. This is K2 planning, not proof of whole batch behavior. Capability mapping is independently corrected to55/90 with35remaining; do not reuse historical60/30 as verified.
Fresh recipes TEMPLATE1.2.0/CHECKLIST1.4.1/LIFECYCLE1.1.0/FIRE1.3.0 fetched unchanged. Independent plan review, actual build owner ACK/promise, K1 accepted merge/interface, formal FIRE check remain before execution. No product source changed by this ticket.

Post-lens planning challenge: knowledge_base, no tensions, block_until_addressed=false. Confidence/disconfirmer prompts answered: source behavior/reference shapes observed at exact pins; proposed adapter completeness remains untested. If a named view needs excluded controller behavior or cannot match the approved kit without extra files, stop for bounded amendment; do not make the mock authoritative. The five-path exclusion adjustment is coordinator-authorized packaging only, with no new product behavior.

## Narrow independent-review response
Review d96dfcbbe1c08430115d3b44014e630097555f17 required explicit orthogonal state fields/precedence and People versus API phase separation; both are specified above with meaningful refusal/uncertainty/People assertions. K1 dependency now explicitly carries its IME AMEND; no cloud fix completion or stable integration claimed. Driver-seat revision: a reviewer can distinguish a visual confirmation step from a confirmed effect, and browse People without accidentally changing stage. Rejected ambiguous booleans and a fifth API phase. This is a contract clarification within the same five paths, no product or copy expansion. Narrow independent re-review and existing owner/FIRE gates remain owed.
