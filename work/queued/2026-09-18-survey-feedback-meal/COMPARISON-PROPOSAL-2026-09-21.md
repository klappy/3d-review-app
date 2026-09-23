# Port versus incremental integration — bounded comparison proposal
Date: 2026-09-21
Status: PROPOSED; independent acceptance pending; no build FIRE or port ruling.

## Authority, baseline and evidence

The comparison baseline is cookbook design-system c653482, frozen for comparison only. This does not merge PR24, approve its copy or authorize all its controls. App baseline is 76fe13823dda23c9c046d2b44cdce94fc0842602, tree df7caca24120c9e4ace1ea41be67bf584001d7c4, verified through Git commit API in this pass. The locally inspected accepted d93fa68 tree has that same tree SHA. Preserve accepted PR156 roadmap behavior, complete release history and effective cookbook pin 791b86; any later pin change requires explicit reconciliation.

Inputs: cookbook PR100 at 1be0f838a9ca692f980d7c3fd1ce71e704bbd983 README/GAP; six actual screenshots and ten-row review in [FABLE-SPOTCHECK](FABLE-SPOTCHECK-2026-09-21.md); current app root, route, share, permissions, feedback, report and participant sources. Additionally inspected kit tree.js, router.js and views-coordinator.js at c653482. Kit coordinator handlers directly mutate fixture DB/S and emit receipts; tree role uses S.view. These cannot be substituted for authenticated transport or real receipts. No prototype, runtime parity test, new live screenshot or benchmark was executed for this proposal.

Coordinator /root/auggie_review has actual integration-coordination ACK recorded by [intake a8025ea](https://github.com/klappy/kitchen/commit/a8025ea); cookbook claim 16c5769969405 was reported read back by coordinator. This proposal assigns no worker and does not invent a C7 acknowledgment.

Protected concurrent work, per coordinator handoff:
- PR159: paused plan reconciliation; preserve branch/source and cookbook99 pin lineage. assess.js/feedback context custody must be exclusive before integration; do not silently include its release or assume current acceptance.
- Issue149: provisional survey-print-identity plan 3b47b14, no implementation owner/FIRE. Sign-in callback loses staff survey route. Safe return requires protected assess.js/navigation ownership and is outside 159 release.
- Issue161: unassigned, no independent reproduction; bounded generic-safe greeting/optional-alias planning. scope.js overlap; earlier entry proposal excludes greeting. Do not treat a fixture name or alias as required real identity data.

## Same units, same target

“Port” means use kit router/shell/view composition as primary presentation and adapt retained app behavior into it. “Incremental” means keep app route/state/controller ownership and replace presentation with approved kit components. Both are one coherent integration batch and release; incremental does not mean several design releases. Either may reuse modules or replace rendering; differences below concern ownership boundaries, not slogans.

Both must cover the same audit inventory: 28 app screens and disposition each of the 15 kit-only routes. Neither gains scope by counting every kit route as a required new feature. Counts are audit inventory, not independently verified implementation estimates. No hours, effort ratio or finished coverage is asserted.

| Common unit | Port path | Incremental path |
| --- | --- | --- |
| Root entry, workspaces, workspace, projects, project, assessment, survey | Adopt kit router.js/tree.js/core.js/views-public.js/views-coordinator.js presentation; bridge existing hash routes, auth return and scope loading to kit composition. Replace fixture DB/S route assumptions. | Keep index.html→assess.js route dispatch, cards.routes and scope loaders; replace context(), screen(), viewTabs(), cards/scope rendering with approved crumbs/tree/menu components. Adapt kit components away from global DB/S. |
| Assessment head and four phases | Mount kit stage/presentation; adapt stage state and actual dry_run/execute handler. | Replace existing stage/phase markup using same approved design; retain app handlers and role gating. |
| Survey counts, selected templates, share and print | Bind kit cards to existing per-survey settled results; embed/adapt share.js and blank-print hooks. No fixture invitation denominators or code chips. | Restyle current counts/template/share views; move controls only with explicit target/currentness binding. Same lack of supported invitation denominator. |
| Understand, reports, Improve | Adapt views.js loaders, report-build.js, report-view.js and notes update to kit containers and lifecycle. | Keep views.js model/bind contracts; change rendered arrangement and components. Report DOM replacement still needs lifecycle review. |
| People/access | Use kit form/modal presentation with permissions.js backend semantics; remove fixture authority and unauthorized viewer actions. | Adapt permissions.js current table/sheet into approved visual components; preserve its immutable params/confirmation/receipt behavior. |
| Participant and invitation print | Use views-participant.js/views-print.js presentation, with existing participate/controller.js, shared-link.js and namespace/resume storage as authoritative behavior. Adapter needs event/view contract. | Keep participate/page.js/controller.js and participant-view.js integration; replace approved markup/styles and print templates. Rendering changes can still break focus, draft and state transitions. |
| Feedback and diagnostics | Replace kit binary feedback/mock receipt with retained app feedback capability, subject to 159 reconciliation. Map diagnostic disclosure to real receipt/trace. | Integrate approved feedback presentation under retained app contract after 159 custody handoff. Same privacy/disclosure obligations. |
| Legacy routes and code-based workflows | Keep explicit legacy bridge until each destination is proven replaced; broad navigation swap increases route-alias/redirect work. | Preserve current forwarding initially; replace individual targets only once equivalent functionality is accepted. Legacy retirement is not presumed. |
| Roadmap, changelog and MCP | Mount existing accepted modules as separate preserved surfaces; do not roll back to audit 0.14.3. Shared global CSS/router must not disturb them. | Preserve same modules and public paths; scope new styles to avoid leaking into these surfaces. Shared cards may also be used by MCP. |
| State/permission proof | Rebind all migrated screen lifecycles: loading, empty, failure, 401, refusal, held/suppressed, 501, stale identity, dirty visibility, uncertain mutation, confirmation expiry, owner/member/viewer/direct grant. | Recheck same cases for every changed render/mount boundary; retained controllers reduce migration surface but do not waive tests. |
| Copy decisions | Same pending exact-copy/stage rulings and semantic dispositions below. Porting does not automatically authorize kit text or deletion. | Identical rulings/dispositions; retaining markup does not excuse confusing copy. |
| Regression and rollback | Larger routing/data/lifecycle seam; risk of fixture behavior surviving in production. Candidate rollback must restore previous whole tree and route behavior through normal release mechanics. | Risk of hybrid visual inconsistencies and duplicated markup; one final whole-batch visual review required. Rollback remains whole candidate, not ad hoc fragment release. |

## Concrete common vertical slice

One assessment with one selected survey; fixed synthetic owner/member/viewer/direct-grant scenarios; same source data and viewport for both candidate approaches. This is a proposed bounded evidence exercise requiring its own accepted ticket, not an instruction to implement now. Normal application shell must load all assets. Use an isolated local transport fixture that fails closed for all unrecognized writes, never real cookies or live submissions.

| Step / boundary | Actual current seam | Required retained behavior in BOTH paths |
| --- | --- | --- |
| Root→project→assessment Collect | index.html loads /assess/assess.js; route() and cards.routes generate #project/{pid}, #assessment/{aid}/collect | Ancestors open only if accessible; direct assessment grant must not invent ancestor access. Preserve session/identity generation, invalidation, 401/refusal separation and selected target. Root is not ui/app.js. |
| Collect→survey leaf | #assessment/{aid}/survey/{sid}; assess.js counts/template selection and shareFor(aid,sid,epoch) | Settled per-survey counts retain failure/Retry, archived counts and selection semantics. No invented denominators; respondent counts cannot be summed into unique people. Survey/identity changes discard stale share state. |
| Share→participant branch | share.js dry_run/execute then once-shown #survey= token URL; root forwarding to /participate/; participate/page.js/controller.js | Owner/member only; explicit preparation/confirmation semantics; token memory-only, no logs/storage/extra URL echo; no auto retry after unknown outcome. Copy/QR/print share same issued link; revoke by ID. Participant does not inherit staff identity. |
| Participant form→review→submit→resume | controller.js, shared-link.js, participant-view.js and participant-resume storage helpers | Preserve scoped namespace and idempotency; draft/edit; unknown stays unknown; conflict/receipt probe, rate-limit/closed/error states; same-tab resume; stale receipt does not erase uncertainty; confirmed receipt only. |
| Collect/Understand→report branch | views.js, report-build.js, report-view.js, readableNumbers | Actual stage constraints; literal held/suppressed results; per-survey respondent caveat; report preview/build confirmation and role rules; returned report opens in full view, failure and retry remain distinct. Progressive disclosure may relocate IDs, never erase diagnostic provenance. |
| Staff print/sign-in boundary | existing blank print path and issue149 return-route seam | No invented resolution of 149. Test current failure as known baseline; any safe-return correction needs separate accepted scope/owner, preserve only permitted internal destination, no credential reflection. A planned batch must explicitly include or defer this blocker. |

For each approach record identical evidence units: changed files and lines; app modules reused byte-for-byte; adapters and API/event mappings; fixture replacements; the listed behavior cases passed/failed/untested; desktop and phone screenshots; route/deep-link aliases; remaining legacy dependencies; rollback boundary. A file count is not an effort estimate. Same synthetic identities/data avoid owner-versus-viewer screenshot comparisons. No duplicate full implementation is authorized to obtain this evidence: first resolve source-level adapter maps; authorize only the smallest remaining uncertain seam if necessary.

## Semantic dispositions carried from independent review

- TXT-042 — PRESERVE/REWORD: once-shown link availability warning remains adjacent to link delivery. Do not persist/recover credentials just to match the kit. Exact wording is deferred.
- TXT-060 — PRESERVE/CONDENSE/RELOCATE: retain problem-first reporting, optional fields, account/support audience, no automatic attachments, private-data caution and uncertain resend semantics. A two-button footer is not equivalent. Resolve 159 before changing its files.
- TXT-070 — PRESERVE/REWORD, retirement conditional: remove implementation jargon where approved; retain once-only export/link warning, stage consequences and participant privacy boundaries at decisions. Active legacy invitation/code paths remain until replacement proof.
- TXT-004 — remove production dev-only entry within accepted scope; replacement text still governed. Issue161 greeting/alias is distinct.
- TXT-046/048 are outside the ten-row independent sample; do not auto-cut count caveats or convert synthetic-policy explanation into 501 without semantic review.
- copy.md verdict and Understanding/Reviewing vocabulary remain decisions; c653482 is comparison reference only. No new product copy is published here.

## Recommendation, driver-seat challenge and next gates

Provisional preference: incremental adoption of approved kit shell/components while retaining existing behavioral ownership, because observed kit handlers are fixture mutations and existing app already contains credential/uncertainty/permission handling. This is a risk-based hypothesis, not a port ruling or measured cost advantage. Prefer port only if the same-unit adapter map shows it retains those behaviors with fewer/clearer lifecycle seams and the same acceptance evidence; neither route may claim fixture coverage as live parity.

Driver-seat check: imagine returning on a phone after an uncertain submission, reopening a survey link after changing identity, or arriving by an old invitation URL. Attractive shell parity is insufficient if those paths lose context, warn falsely, or expose authority. Revised proposal therefore keeps behavioral controllers authoritative, makes legacy retirement conditional, compares role-matched data, and adds the 149 auth-return boundary. Rejected alternatives: import all kit handlers/receipts; cut all explanatory text; assume legacy unused; equate 83 fixture rows with app contract completeness; split designs into drifting releases. Independent challenge/review of this revised proposal is still pending; reading a method is not claimed as gate completion.

Before any implementation FIRE:
1. Independent reviewer challenge this same-unit comparison and disposition amendments; coordinator records path decision and approved visual/copy boundary.
2. Reconcile current heads/pins for 159/149/161 and later app changes; establish actual implementation owner ACKs and exclusive file custody. assess.js is one integration seam; scope.js and feedback.js require explicit handoffs. No parallel overlapping edits under conceptual W1/W2/W3 labels.
3. Produce fully specified implementation tickets with concrete file lists/adapters, dependencies, acceptance fixtures and return paths. Current table is planning, not a claimable build ticket.
4. Convert 27 preservation rows to stable acceptance references and account for all unmapped contract capabilities. Preserve current roadmap tests/source baseline, print/legacy paths and release history.
5. One integration candidate, whole-batch desktop/mobile visual and normal-shell regression review on same exact tree, current applicable contract/parity and release gates. No port/production authorization follows from this document.

Prepared by ui_audit within the bounded planning promise. No implementation, prototype, release or product-copy change performed.


---

# Superseding amendment — settled kit-first batch scope
2026-09-21, ui_audit; scoped planning revision. This section supersedes the earlier provisional incremental preference and any suggestion that the path decision remains open. CoS ruling relayed by integration coordinator: **kit-first FINAL visual and interaction target, authoritative app controllers, ONE complete batch; not a legacy reskin. Displayed “Understanding” stays; existing phase/API identifiers stay.** This is not blanket copy.md ratification, PR24 merge, or FIRE. Prior comparisons remain historical evidence.

## System and adapter contract

The normal root remains a real application entry; kit-derived presentation becomes the final shell, navigation, page composition, states and interaction language throughout agreed screens. Existing controllers retain session, scope, capability, command, receipt, uncertainty and storage authority. UI adapters map controller state into kit views and map view intents back to existing handlers. They must not synthesize permission, confirmation, identities, invited totals, successful receipts, inverse actions or persistent credentials from kit fixtures.

Required adapter envelope: current identity/assessment/survey/epoch; current route and permitted ancestor links; real role and capability decisions; per-resource settled status; display model excluding secrets except the currently authorized link view; explicit callbacks for navigation, retry, prepare, confirm, cancel, copy/print, revoke and submit. Each callback validates the same currentness boundary as the retained handler. Presentation modules receive data/callbacks, not live transport/storage or global DB/S. Role fixture control stays in test harness only. Contracts may be expressed as JS documentation plus tests, not an unsolicited runtime framework.

Full target inventory stays audit S01–S28 plus explicit disposition of 15 kit-only routes. Supported existing behaviors obtain kit presentation, not permanent mixed legacy layout. Unsupported mock-only capabilities remain unavailable with honest approved states; they do not become new backend requirements. Legacy retirement happens only after its active destination has an equivalent kit-presented route and acceptance proof. Any deferred legacy flow needs an explicit coordinator scope decision before claiming full batch complete.

## Exclusive file partitions replacing W1–W6

Paths below are product-repo paths; “new” means proposed artifact, not existing code. Seats are assignments awaiting actual worker ACK, not people invented by this plan. Integration coordination is acknowledged separately. One shared file has exactly one writer; no competing W3 copy edits. Workers can review each other's files but send requested changes to their custodian.

| Partition / old W mapping | Exclusive proposed write set | Reads / dependencies / output boundary |
| --- | --- | --- |
| K1 shell foundation (W1 core; first prepared dish) | NEW ui/kit/core.js, ui/kit/tree.js, ui/kit/kit.css, ui/kit/tokens.css, ui/kit/components.css, ui/kit/shell.test.mjs; NEW test/fixtures/kit-shell.html, test/fixtures/kit-shell-data.js | Borrow c653482 tokens/components/kit core/tree structure. Pure render + DOM interaction callbacks; no router/data fixture import, network, auth, storage, root wiring or copy verdict. Own shared styles for entire batch; later workers request additions through K1. |
| K2 public/coordinator presentation (W1 remainder, W2, W4 rendering) | NEW ui/kit/views-public.js, ui/kit/views-coordinator.js, ui/kit/views-admin.js, ui/kit/coordinator.test.mjs | Depends K1 interface; kit page layouts and states, stage labels with Understanding. Reads controller schemas. Emits callbacks and receives status; never duplicates real write logic. |
| K3 integration and controller adapters (W1 wiring, W2/W4 binding, W6 staff behavior) | ui/index.html; ui/assess/assess.js, scope.js, cards.js, views.js, share.js, permissions.js, feedback.js, report-build.js; their existing .test.mjs files; NEW ui/kit/app-adapter.js, ui/kit/app-adapter.test.mjs | Sole writer of shared app seams. Preserve behavioral algorithms; extract/inject rendering only where necessary. Depends K1/K2, exact-copy ledger and 159/149/161 dispositions. No root merge before full batch. Subdivide sequential K3a shell/read mapping then K3b writes/states with same custody, not parallel file ownership. |
| K4 participant + print (W5) | ui/participate/page.js; ui/participant-view.js, participant-view.test.mjs, participant-dom.test.mjs, participant-header.test.mjs; NEW ui/kit/views-participant.js, ui/kit/views-print.js, ui/kit/print.css, ui/kit/participant-presentation.test.mjs | Depends K1 and accepted view contract. controller.js, shared-link.js, participant-resume.js stay read-only unless explicit amendment. K3 owns staff blank-print invocation; K4 provides print view. Coordinate issue149, do not independently change sign-in return. |
| K5 legacy migration (W1 DD legacy; W6 legacy) | ui/legacy/index.html; ui/app.js; ui/language.js, entity-screen.js, workspace-overview.js, lens-surveys.js, report-card.js, collab-mount.js, scope-invitations.js; matching existing unit tests | Depends K1/K2 and K3 route contract. Reuse real legacy handlers behind kit view mapping or redirect only after equivalence. NEW ui/kit/legacy-adapter.js and legacy-adapter.test.mjs belong K5. No source deletion merely because selectors disappear. |
| K6 batch validation (W6 proof) | NEW test/kit-batch.integration.test.mjs; NEW test/fixtures/kit-batch-transport.js; evidence outputs under approved batch evidence path determined by coordinator | Read-only product reviewer; writes tests/fixtures/evidence only, not “fixes” in others' files. Normal shell with fail-closed synthetic transport, keyboard/focus/phone/desktop and preservation matrix; independent final reviewer is separate from test author. |
| Copy specialist (W3) | Existing cookbook/kitchen exact-copy disposition ledger only, by its actual Git pointer | No product file ownership. K2/K3/K4/K5 apply approved exact strings in owned views; protected semantic warnings remain until approved replacement. Pointer and verdict required before affected presentation acceptance. |

All unlisted app source, API/contract/schema, package versions, release/history/pins, roadmap/*, changelog.js, demo modules, MCP panel and controller/storage modules are read-only by default. A required edit to an unlisted file returns to coordinator for explicit ownership/scope amendment and fresh applicable lens/challenge. File ownership transfers require old/new actual ACK and exact handoff head; never concurrent claims. K3 custody for assess.js/feedback.js waits for 159 reconciliation; 149 owns the return-route requirement through coordination, not an implied competing writer; 161 scope.js greeting proposal remains excluded until reproduced/accepted.

## 27 preservation acceptance rows

Stable review references P01–P27 below map one-to-one, in order, to audit §5 rows. They are planning IDs in this cargo, not a competing canonical audit. Every row requires real controller integration under normal shell; fixture-only kit rendering is insufficient. Common dimensions apply when relevant: owner/member/viewer/direct grant; loading/empty/401/refused/transient; identity/route switch while pending; desktop and phone; keyboard/focus. Evidence records pass/fail/untested, exact head and test/screenshot path. No runtime pass is claimed here.

| ID / retained function | Responsible integration partition | Acceptance evidence required / existing anchors |
| --- | --- | --- |
| P01 session/bootstrap | K3 | Cookie/bearer bootstrap, scrub session return, identity generation rejects stale result; identity-reset.test.mjs + normal-shell sign-in/out route scenario. No private ID in UI proof. |
| P02 sandbox sign-in | K3 | Dev synthetic entry works only in allowed environment; production welcome has no dev-only door. entry.test.mjs and test/synthetic-owner-auth.test.ts; no live identity creation. |
| P03 sign out | K3 | UI identity/share state clears and next access reflects sign-out; test/logout-cross-face.test.ts plus pending-response isolation. |
| P04 workspace lifecycle | K3 | List/create/get/rename/add/remove projects use actual capabilities and visibility, maintain truthful outcomes; scope.test.mjs + test/workspace-manager.test.mjs. |
| P05 projects/languages | K3 | Create/list/get/rename and language list/create preserve target, grants, error handling; scope.test.mjs, test/language.test.ts, self-service-creation.test.ts. |
| P06 assessment/stage writes | K3 | Prepare/Collect/Understand/Improve IDs unchanged, displayed Understanding; one-step confirmed stage change and collection consequences; stage-composition.test.mjs + collection-stage-gate.test.ts. |
| P07 assessment list/cache | K3 | Dedupe and refused/failed/unauthenticated states remain distinct; Retry and identity switch invalidate correctly; existing scope tests plus mounted adapter case. |
| P08 per-survey counts | K3 | Bind aid+epoch; stale result ignored; partial failure/Retry, no invented zero or invited denominator; views.test.mjs + mounted late-response scenario. |
| P09 survey selection/archive | K3 | Exact template/version selection, remove/archive retains counts, include again; stage-composition/stage-screens tests plus normal-shell fixture. |
| P10 dirty/visibility | K3 | Post-write/refusal banner appears and truthful stale state persists until refresh; ui/visibility.test.mjs + mounted write→route scenario. |
| P11 blank survey print | K3+K4 distinct owned files | Safe load/refusal, Letter default, correct survey/identity before print; stage-screens.test.mjs + actual print artifact visual review; issue149 return-route disposition explicit. |
| P12 shared link lifecycle | K3 | dry_run/execute; once-only in-memory token; scope/identity clearing; same issued link copy/QR/print; revoke by ID; uncertain issuance no auto retry; share.test.mjs and normal-shell route switch. |
| P13 results/reports | K3 | Held/suppressed literal, per-survey count caveat; report list/get/build confirmation, full render and contract-supported numeric labels; views/report-build/report-view tests plus held/401/failure/late response fixtures. |
| P14 Improve notes | K3 | Persist authorized notes, visibility disclosure, draft/outcome handling on refusal or stale identity; views.test.mjs plus mounted scenario. |
| P15 permissions | K3 | Real roster/invite/role/revoke/transfer; immutable params dry_run→execute, token consume/expiry and CONFIRM_REQUIRED refresh then explicit reconfirm; permissions.test.mjs + lane-b-grants.test.ts; viewer sees no unauthorized actions. |
| P16 invitation acceptance | K5+K3 route | Old #invite entry still resolves; wrong identity/auth, preview/accept/refusal are honest; invitation-entry.test.mjs, scope-invitations.test.mjs, collab-mount.test.mjs; no live invitation. |
| P17 app feedback | K3 after159 | Optional problem-first text and privacy, signed-in audience, no attachments, confirmed receipt and uncertain explicit resend; feedback.test.mjs + ops-feedback-privacy-redact.test.ts; 159 accepted head/normal-shell proof required. |
| P18 shared participant journey | K4 | Controller namespace/idempotency/draft/review/receipt/resume preserved; conflict/uncertain/closed/rate-limit and identity separation; participate/controller.test.mjs, participant-resume/view/dom tests, shared-link-browser/flow/concurrency tests. |
| P19 code-based participant | K5 | Existing code redemption, form/review/submit/receipt and safe refusal survives kit presentation; participant-auth.test.ts + legacy adapter journey; never expose other answers. |
| P20 code batches | K5 | Issue→preview→separate confirmed export; values displayed once with save/print warning, selection/identity clears; code-escrow.test.ts + synthetic once-only export fixture. |
| P21 demo/practice | K3+K4 | Sample labels and practice behavior; zero real writes; demo.test.mjs and fail-closed harness request log proving blocked unknown write. |
| P22 version/changelog | K3 wiring, original read-only | Exact health version/current pin and history badge/dialog remain accessible; changelog.test.mjs, version-stamp.test.ts and normal-shell mount. No incidental version bump. |
| P23 roadmap | K6 preservation | Preserve accepted 0.14.4 source/tree subset and current Future/progress layout; roadmap model/live tests and desktop/mobile route. Existing absent-case gaps explicitly targeted locally, no invented live pass. |
| P24 request evidence | K5 | Correct method/capability/receipt/trace accessible through disclosure; no credentials/private payloads; diagnostic-path.test.mjs and legacy evidence fixture. |
| P25 MCP panel | K6 preservation | Workspace/project/assessment selection, summary/count/confirmation stays functional; mcp-panel-interactions/mcp-action-card/mcp-panel-theme tests and existing panel build check. No default source edits. |
| P26 errors/diagnostic redaction | K3+K5 owned boundaries | 401, refusal, 501, transient distinct; safe path redaction, truthful unsupported UI; diagnostic-path.test.mjs + adapter error cases. No fixture success/undo claims. |
| P27 other legacy modules | K5 | Language/entity/workspace/lens/report routes preserve target selection, counts and capability boundaries while adopting kit presentation; existing matching module tests + every retained legacy deep link mounted. |

Listed test names abbreviate the observed source paths: ui/assess/*.test.mjs for staff modules, ui/*.test.mjs for named shared modules, test/*.test.ts/mjs for backend/journey anchors. New adapter/mounted tests fill gaps; existing tests are starting evidence, not automatic coverage. Full contract parity must account for the audit's unmapped 30/90 capability IDs; do not silently mark them covered by these 27 rows.

## First prepared build dish — K1 shell foundation, no root activation

What: extract approved kit shell presentation into app-local components with explicit data/callback boundaries and an isolated fixture preview.
Why now: it enables the settled final kit target without entangling protected staff controller custody.
Your move: independent review of this bounded specification, then actual worker assignment/promise and formal ticket/gates; no further product ruling requested by this dish.

Proposed class entrée, risk ALLERGY for capability/identity presentation; station subagent. Owner and implementation promise remain unbound until actual worker ACK. This is a fully described candidate scope, **not claimable or FIRE-ready** while those fields/gates are absent. Depends: accepted amended batch scope; K1 worker custody; comparison c653482 pin; independent plan review. Copy-sensitive decisions are excluded from K1: fixtures use existing approved labels including Understanding, no new greeting or production prose.

Declared product is exactly the K1 write set above, plus review evidence in the existing meal. No package changes, bundler, framework, production route, release artifact, live transport or global fixture role import.

Seven observable done-means:
1. Reviewer can mount owner/member/viewer/direct-grant models and observe kit-shaped breadcrumbs/tree/menu with only permitted ancestors/actions.
2. Reviewer can use keyboard and pointer to expand tree and open/close menu, observing focus return, Escape handling and current-page indication.
3. Reviewer can switch model identity/route and observe no stale selected node, prior role label or callback targeting previous scope.
4. Reviewer can provide special-character entity text and observe escaped visible text, no executable injected markup or unsafe destination.
5. Reviewer can inspect 1440×900 and 390×844 screenshots against c653482 role-matched shell and observe kit geometry/tokens/interactions; intentional Understanding deviation is recorded.
6. Reviewer can inspect request/storage instrumentation and observe no network, auth, secret persistence, fixture View as control or real mutation from component preview.
7. Reviewer can compare branch diff and observe only K1 allowed files; existing app root/controllers/159/149/161/roadmap/release bytes remain unchanged.

Exact proposed commands after implementation (not run now):
- node --test ui/kit/shell.test.mjs
- node --test ui/assess/entry.test.mjs ui/assess/identity-reset.test.mjs ui/assess/scope.test.mjs ui/roadmap/model.test.mjs
- Browser fixture test/fixtures/kit-shell.html: four roles at both specified widths; keyboard/menu focus; tree expansion; model switch; unsafe text fixture; instrument network/storage deny checks. Record screenshot paths and outcomes, not just test count.
- git diff --name-only <fresh-approved-base>...HEAD and byte/tree checks for excluded paths. Shell unit suite includes the seven scenarios above; no mirror-only tests.
No repository build or live deployment is needed for K1 proof. Final root composition and full interaction parity occur K3/K6 before the single release.

Failure modes and required responses: fixture authority or generated success → stop and remove dependency; inaccessible ancestor exposure → fail role test and return to custodian; unapproved copy → preserve approved source and route ledger decision; off-partition edit/head drift → stop for coordinator handoff; visual mismatch → revise under same target, do not lower acceptance to legacy resemblance; missing real worker/review/gate → hold, no FIRE.

## Delta, borrowing and gates

Driver-seat lens rerun after the settled ruling: treat the whole system as kit presentation driven by authentic current app state. Changes made here: supersede open path choice; centralize shared-file custody; create explicit pure-view adapter seam; assign all 27 preservation cases; make the first dish independent of disputed root custody; prohibit a preview completion being mistaken for full-app completion. Rejected: styling legacy as final, importing fixture DB/S as authority, independent copy edits across shared files, deleting legacy before equivalent target proof, or declaring a worker assigned by a table. This is the substantive revision receipt; formal ticket DELTA.md remains required at bind/fire and must point to this revision.

6B: Borrow = applied (c653482 kit presentation and existing app controllers); Bend = planned (data/callback adapters, true permissions/receipts, Understanding label); Break = observed (fixture DB/S writes, viewer actions, mock link semantics cannot serve as production authority); Beget = not required (house already owns both substrates; no new external platform needed); Bide = not selected (settled target and available substrates; remaining gate waits are governance, not technology speculation); Build = minimal adapters/normal-shell integration plus tests, no controller rewrite without separate evidence. Reversibility: component-only K1 easily removable; root integration rollback requires whole accepted candidate restoration through ordinary release mechanics, with no data migration introduced.

Prior art: installation repository listing run; known relevant homes klappy/3d-review-cookbook design-system/ui_kits/3d-review and klappy/3d-review-app ui/assess, ui/participate inspected. Existing controllers, tests and kit reused. No claim of exhaustive house search.

Current recipes fetched: TEMPLATE1.2.0, CHECKLIST1.4.1, LIFECYCLE1.1.0, FIRE-CHECK1.3.0. Preflight run surfaced visual proof, logic test output, decision references, independent agent review and provenance. Responses: role-matched screenshots and exact commands above; settled ruling recorded; independent review explicitly pending; Git/readback evidence required. Oddkit-write-access retrieved as a different product planning document is not imported as kitchen write authority.

Remaining gates: actual worker ACK/promise and formal self-contained ticket + CHECKLIST-RUN; independent review of this amendment; copy specialist exact Git ledger [COPY-FACT-RECONCILIATION-2026-09-21.md](COPY-FACT-RECONCILIATION-2026-09-21.md) at b0ce0256b6d2a0685f4b305e06d2e65a191d0fd2, independently reviewed for affected later work; 159/149/161 custody dispositions before K3; fresh base/claims/ref check; formal current DELTA/preflight/challenge/6B receipts and FIRE-CHECK at each dish fire. No broad copy VERDICT, no FIRE, no merge/release authorization from this artifact.

Post-lens challenge receipt: oddkit planning challenge returned governance_source=knowledge_base, no tensions, block_until_addressed=false; it asked for explicit confidence. Answer: source seams and named tests are observed at the pinned trees; proposed ownership/adapters and acceptance design are working plans, not proven implementation. Confidence in complete behavior preservation remains untested until normal-shell evidence. This applies only to this batch; if adapters require controller semantics to change or cannot meet the full kit target, stop and amend rather than dilute target or claim preservation. No plan acceptance is inferred from the tool verdict. CoS direction is also recorded in coordinator ROADMAP commit c199b9; this planning record preserves that direction. Exact operational copy may receive scoped acceptance following independent review; no blanket requirement for new human approval of every label is introduced.


## 2026-09-22 ToC/OODA critical-path challenge — proposed scheduling amendment
User sets FULL delivery in 4–6 hours as a TARGET, not an owner promise, scope cut or gate waiver. Internal agents remain planning/review only. Full scope and finish line in cookbook DELIVERY-PLAN291d7e1 remain authoritative; historical 30/90 wording above is superseded by the verified 55 mapped/35 remainder appendix. This scheduling proposal does not authorize new product paths or FIRE.

Evidence: Fable actual claim1ff996a3a7c80e2ead7d40e4cb642523644576fa reports remaining24–36 active author hours under single-writer serial assumptions. Its real dry merge at K3a185ede97 found159 +202/−38 lines over18 paths, only one functional overlap (assess.js), with five metadata/test-literal conflicts and that controller conflict. Treat this as reuse evidence, not proof of a faster completed integration. Its own3–4h feedback range remains the only current dish-author estimate; coordinator may challenge it, not silently replace it.

### Constraint and exploitation
The immediate constraint is accepted K3a root/custody plus the one cook's shared staff wiring, not absence of reusable domain algorithms. Serial K3b→K4→K5→all review is an assumption: K4 presentation has disjoint files and existing participant controllers. K5 can prepare legacy presentation against a fixed route interface without owning root. Root integration,149 staff return, shared CSS and assess/scope mutation stay one writer. Two accounts are not two dispatched cooks.

Keep existing Fable custody uninterrupted. Ask it to classify each remaining binding as existing-controller reuse, thin presentation adapter, or actual missing contract; no new audit. Reject mock successes and controller rewrites as schedule shortcuts. Preserve159 commits and current metadata mechanically, then spend implementation effort on observed boot/menu/focus/currentness seams.

### Dependency schedule by existing acceptance rows
| Lane / readiness | Rows and reuse | New work / join |
| --- | --- | --- |
| Fable current root→staff lane | P01–03,04–10,12–15,17,22,26; reuse accepted kit, real loaders/writes, account161 and159 | Complete K3a correction/acceptance; feedback reconciliation and mounted write adapters sequentially in owned files. P12 token uncertainty and P15 preview/execute are complexity probes, not optional cases. P08–10 counts/stale semantics remain explicit. |
| Proposed second external lane, ONLY after real channel ACK and bounded FIRE | K4 P18 and participant portionP21; reuse controller/shared-link/resume storage and established tests | K4 exclusive views/page/participant files from partition table; no controller.js, shared-link.js, participant-resume.js, root, styles or149 auth edits. Build participant view contract and actual journey concurrently with staff lane. PrintP11 consumes staff invocation/149 disposition later. |
| Second lane next or another ACKed nonoverlapping slice | K5 P19,20,24,27 plus its partP16/26; reuse redemption/export/evidence/legacy handlers | K5 exact partition files, no assess/scope writes. Fixed route callback contract; old links remain until kit-equivalent proof. Staff/root owner joins invitation routes. Verify file claims before overlap. |
| Reviewer overlap, no product fixes | Stable completed rows above; preservedP23/25 and baseline roles/errors | Run actual regression/reference review as candidate slices stabilize; record source fingerprints. At final join rerun cross-route/identity/listener/state tests and impacted evidence on ONE exact tree. Earlier results are inherited provenance, not automatic final acceptance. |
| Serialized final join | P11/149, P16 joins, all27; GAP/TXT/DD and90-capability dispositions | Single integration owner composes accepted deltas, completes kit-only/legacy dispositions and full28-screen/15-kit-only accounting. Canonical source/pin/checks→DEV→same-version production still required. |

No blanket permission to begin K4/K5 follows this table. The accepted partition supplies candidate files; coordinator binds a fully specified dish, actual external ACK and gates. K4 can overlap staff work; K5 can follow on that second seat without waiting for all staff rows, subject to frozen route contract. Root owns dispatch. No fictional second cook.

### Four–six-hour feasibility test and stop-loss
The target is not supported by current owner estimate. It becomes credible only if actual burn-down demonstrates much cheaper reuse, a second acknowledged cook, review overlap, no newly missing behavior, and service/release turnaround inside the remaining wall-clock window. Do not sum speculative dish durations or convert active author hours to elapsed delivery.

At the next agreed60–90 active-minute owner checkpoint (proposal, not replacement of its promise), obtain:
- Staff: real root feedback open/dismiss/send/stale/privacy evidence and one representative complex real write (P12 orP15), with actual time split between conflict resolution, adaptation and proof.
- Participant seat if actually started: full form→review→receipt/resume and refusal/uncertainty evidence using retained controllers, plus actual time used.
- Legacy: explicit reuse/new classification of code redemption, once-only batch export and remaining deep links; unresolved mounts identified, not guessed.
- Reviewer: accepted/AMEND/untested rows, defect severity/rework, final-reference readiness. Record each row's semantic, visual and state dimensions, not one inflated aggregate percentage.

Forecast each lane from comparable observed work and named remaining work, then take the longest dependent lane plus measured join/review/release work. One easy CRUD row cannot predict permission/token flows. If critical rows remain unmounted, second ACK is absent, or observed rework consumes the window, report 4–6h unsupported immediately and ask for a real decision on capacity/time/scope; keep full scope until explicit tradeoff approval.

Planning driver-seat revision: future user needs all original destinations and truthful writes in the kit, not a rapid-looking dashboard. Therefore parallelize independent presentation and review, retain authoritative algorithms, and stop counting fixture or shell milestones as delivery. Rejected: simultaneous root writers, delaying all review to K6, rewriting existing backend, skipping legacy, accepting screenshot-only completion. This addendum is ready for independent challenge; it does not claim that its scheduling assumptions have been validated or supersede Fable's recorded estimate.


## Binding operating charter amendment — 30-minute production sprints
2026-09-22; user instruction relayed explicitly by Auggie after the preceding addendum: **ship a production release every30 minutes; complete FULL scope in4–6 hours (8–12 sprints target).** This supersedes the earlier single-final-release restriction and the no-each-sprint-release assumption, including those statements in historical tickets and DELIVERY-PLAN291d7e1. It does not supersede source ownership, required checks, independent review, canonical version/pin, DEV proof or production safety. Incremental coherent releases are now the intended delivery strategy; final full-kit acceptance remains mandatory.

Each30-minute sprint produces a working increment, exact source head/tree, meaningful tests and demo, actual gate status and (when qualified) verified production receipt. Before its end, coordinator names the remaining blocker/owner and has the next bounded assignment ready. Cook continues through accepted scope without milestone idling; only a real gate/custody boundary stops dependent work. Slice existing tickets internally rather than making a new ceremony per interval. Timing begins from actual coordinator START; no clock or owner ACK is fabricated here.

### Target release sequence, not fabricated duration estimates
These12 candidate bundles map all preservation rows; compress to8 only when multiple independently complete bundles genuinely fit. The coordinator may reorder disjoint bundles; each is a target release slot, not evidence it can fit30 minutes.
| Slot | Independently usable increment and existing acceptance | Dependency / actual role |
| --- | --- | --- |
| S1 | Correct K3a pointer/root; kit reads plus working retained writes/routes/account/version. P01–03/07/22 and current behavior regression | Fable current cook, independent orphan review; exact accepted head, canonical stamp/checks/DEV/PROD required before release. K3b starts when qualified, not because clock expired. |
| S2 | In-place feedback without lost work/privacy or false receipt; P17 | Existing Fable159 custody; accepted K3a→K3b1 gates. Reuse original three commits. |
| S3 | Workspace/project/language real lifecycle; P04/05 | Fable shared staff files; actual permissions and target-specific receipts. |
| S4 | Stage/survey/count/archive/stale state; P06/08/09/10 | Fable controllers preserved, Understanding display only; truthful partial failures. |
| S5 | Shared link preview/issue/copy/revoke; P12 | Fable; once-only token and uncertain-send proof. |
| S6 | Reports/results/Improve notes; P13/14 | Fable; held/suppressed/count caveats and authorized persistence. |
| S7 | Permissions and staff invitation join; P15/16 | Fable root/permission seam; K5 invitation adapter joins only after independent acceptance. |
| S8 | Full shared participant/demo journey; P18/21 | Proposed second external K4 cook, NOT ACKed; otherwise Fable capacity remains limiting. Real controller unchanged. |
| S9 | Blank print and149 safe return/identity; P11 | K4 view + sole Fable staff/route seam,149 bounded accepted disposition required. |
| S10 | Legacy code redemption/batches/export/evidence; P19/20/24 | Proposed second external K5 cook after actual ACK and exact partition gates; no overlap with staff. |
| S11 | Remaining legacy deep links/errors; P27/26, invitation residualP16 | K5 view paths; Fable owns root join. Equivalent routes before retirement. |
| S12 | Remaining full-kit/capability/copy/reference closure, roadmap/MCP preservation; P23/25 plus ALL rows | Whole exact-tree independent review;28 app screens/15 kit-only dispositions/27 contracts/90 capabilities. Evidence is accumulated fromS1, not postponed here. |

A coherent intermediate release preserves usable untouched destinations and all existing semantics, with no dead kit actions, fake writes, leaked account context, or confusing duplicate shells. Transitional retained presentation is not final target completion. If a proposed increment cannot stand alone safely, combine it with its dependency and report the cadence miss; do not ship a broken mixed UI to satisfy the clock.

### Per-slot release chain and rollback
Candidate-specific independent acceptance → canonical record/pin and version requirements → real required terminal checks/findings disposition → guarded main/DEV deployment and affected actual journey proof → identical accepted source/version/pin production promotion and deployment verification. Literal Bugbot SUCCESS and applicable provider gates remain. Named167/169 duplicate-record exceptions apply only to those exact records/heads; no new waiver. No automated logout of Chris. Rollback is the prior verified production identity via normal release mechanics, with no destructive migration or forced history rewrite.

Only current real roles count: Fable cooks; Auggie coordinates dependency/release decisions; internal ui_audit/orphan plan and independently review subject to authorship separation. A second external account has no execution capacity until real channel, ACK, exact custody and gates are verified by root. This charter is authority to organize the requested cadence, not a source FIRE or bypass of candidate disposition.

### Actual planning challenge and feasibility
Oddkit planning challenge executed on this specific sprint proposal: CHALLENGED, governance_source=knowledge_base, tensions=[], block_until_addressed=false. Its eight missing-prerequisite prompts are addressed as follows: confidence is LOW scheduling feasibility, not promised throughput; scope is this app batch only, no new principle/pattern claimed; comparison is Fable claim1ff996a3's serial24–36h plan, read this turn, against observed reuse and disjoint accepted partition4218b0; source is that claim, delivery291d7e1 and current binding user instruction. The one dry merge is one observation, not representative measured completion. Assumptions are second actual ACK, inexpensive adapters, reusable controllers and gate turnaround. Disconfirmers are unclosed complex rows, rework, no second cook or service/DEV/production latency beyond the slot. Record misses honestly and reforecast immediately; no scope reduction follows.

First release30-minute feasibility and full4–6h feasibility remain UNPROVEN. Measure every slot: active cook/review time, elapsed provider wait, accepted row dimensions, defects, exact deployed identity and remaining dependency. Preserve Fable's recorded estimate until it revises it from observed work. Earlier60–90-minute measurement proposal above is superseded by these30-minute checkpoints. The schedule adds pressure for useful verified increments, never pressure to manufacture acceptance.

## Binding release-first priority —2026-09-22 16:46 UTC
Chris repeats ToC OODA and30-minute sprint releases because testers are using the app now. Auggie is the single release integration owner. Keep cadence anchored at :18/:48; missed15:48 and16:18 slots remain recorded, never reset silently. Full4–6hour target remains a target, not fabricated feasibility.

Bound work in progress: do not start new feature dishes, including accepted print-only planning, ahead of the next verified deployment. Finish safe active work; reserve independent reviewers and existing release-metadata owner for the corrective candidate. First deployment scope is0.16 kit root/navigation/account plus the three verified corrections. Unfinished workspace/code-export/print work does not ride it. Fourth isolated correction branch exists at907 as of16:46:35; cloud source still907, neither corrected yet.

Exploit the constraint: review the first corrective head immediately; compare cloud/fallback and choose one successor; amend the same0.16 canonical source provenance without changing historical counts, merge normally, repin immutable records and test; exact final checks/hold disposition; ordinary main→DEV build/live validation, then separate production promotion with effective AutofixOff evidence and all real gates. No competing cloud writes, no bypass, no unsupported provider access. Packetdd2a2cba defines runnable verification. Source progress, metadata merge and partial tests are not deployment.

## Binding trailing-sprint cadence —2026-09-22 16:50 UTC
Chris clarifies the model: window N builds increment N while the independent validation/release lane ships the frozen increment from N-1. Freeze a concrete candidate at each :18/:48 boundary; validation, actual checks, canonical reconciliation, DEV observation and applicable production gates run in its trailing30-minute window. Do not wait for full rollout. The temporary release-first recovery above must not become a serial waterfall. Continue the next bounded build where custody permits; no duplicate workers or competing branch writes.

A failing slice remains visibly blocked. Split or shrink only to a coherent independently usable accepted increment, with explicit deferred obligations; never waive gates or silently reduce the full goal. Preserve missed15:48,16:18 and16:48 slots and fixed cadence. A built slice or completed checklist is not a shipped release.

Ownership: Auggie owns candidate freeze, cross-branch disposition, release coordination and ordinary gated merge; existing Fable correction owner builds the release fixes; existing metadata Fable returns at a safe K5 boundary for canonical/pin changes; internal independent reviewers own source/browser/hash/check verification. Existing staff/participant/code cooks retain their separate bounded custody. Root handles actual external dispatch and genuine human-only provider decisions. No new worker assumed.

Each checkpoint states the live shipped change, next frozen candidate, blocker and owner, and next fixed slot. Targets are not promises. Actual fourth correction START16:45:45UTC from907 is root-observed/readback; first working checkpoint before17:15 is the owner's promise, not whole release completion. Review partial corrections as they arrive while remaining fixes cook; freeze only a candidate satisfying the intended coherent release scope.

## Binding bounded resumption —2026-09-22 17:38 UTC
Chris authorizes finishing the existing accepted work through visible iterative deployments: first the accepted root/header/navigation/account plus three fixes; second participant and feedback after integration verification. Preserve unfinished workspace, code/export and print for the new direction; no new feature development. This supersedes the prior full-rollout execution queue for this resumed run. The recurring loop remains PAUSED; current authorized work proceeds through actual owners and gates without claiming scheduled monitoring.

Auggie owns integration/release, existing Fable owners implement, independent reviewers validate. Report actual URL/version/user-visible change at each verified DEV and PROD event. Do not equate prepared source, canonical merge or a checklist with deployed progress. Existing cloud custody, named exceptions, actual review/checks, prospective disposition, DEV/provider/production prerequisites remain. Effective AutofixOff/reviewsOn is requested through the supported human settings surface; not presumed saved, no policy bypass. PR103 at a5abe0c7 is the current canonical continuation, then exact acceptedf69 repin under existing bounded order; no extra planning round.
