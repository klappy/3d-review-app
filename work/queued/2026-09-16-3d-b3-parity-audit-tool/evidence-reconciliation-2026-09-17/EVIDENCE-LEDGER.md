# B2/B3 requirement evidence ledger

Planning only; no test/build/runtime campaign run. See PINS.json. Original35-ID ledger is proposed and not whole-product acceptance. Its9f551c03 Phase-A acceptance/sweep files are absent from inspected main299f825: keep historical cells at their actual pin. Current overlays below do not inherit historical suite pass or turn into deployed acceptance.

Each record retains HTTP/MCP POS/NEG and UI historical columns in EVIDENCE-LEDGER.json. Role/transport shown below applies only to the named overlay. No overlay means gap not closed by selected evidence, not proof no other test exists.

## A04-1 — cap.entry.intents

Historical gap: Followable routes and docs six-intent parity absent.

- **Candidate only / docs tool/internal handler / visitor/auth context:** PR32 TOPICS intro/faq and no-arg what exact bytes; not entry.intents routes parity. Bugbot success root-observed08:08:57. Source: https://github.com/klappy/3d-review-app/pull/32

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-2 — cap.entry.example

Historical gap: Exact proposed error and support mutation refusal absent; status alone is not persistent-state comparison.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-3 — cap.auth.consume_link

Historical gap: Subject identity, no-session issuance on refusal and concurrent use not asserted here. Auth custody; staff login evidence is not participant-login policy.

- **Auth source / HTTP/MCP / staff:** Separate current Access/OAuth tests exist; no participant login requirement. The old consume_link scenario is not the whole production sign-in contract. Source: Source inventory access.test.ts,mcp-oauth*.test.ts; no new execution

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: Existing Auth/participant A14 + B15/B3 →17; UNACKNOWLEDGED gaps.

## A04-4 — cap.auth.logout

Historical gap: Source anonymous idempotent success is SUPERSEDED by ruling5706310753. MCP receipt shape absent.

- **Current assertion / HTTP/MCP / user:** Current logout-cross-face test exists. Cross-face token revocation is the governing rule; no anonymous-success requirement reinstated. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/logout-cross-face.test.ts#L21

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: Existing Auth/participant A14 + B15/B3 →17; UNACKNOWLEDGED gaps.

## A04-5 — cap.workspace.create

Historical gap: Proposed201 differs from asserted200; workspace.get owner role absent.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-6 — cap.workspace.list

Historical gap: Successful MCP list missing; generic owner-read aggregate does not credit this cell.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-7 — cap.workspace.get

Historical gap: Grouped project contents not asserted.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-8 — cap.workspace.update

Historical gap: No readback of renamed value before undo; member refusal absent. MCP undo is not MCP workspace.update.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-9 — cap.workspace.unarchive

Historical gap: Prior projects intact, member refusal and no-new-receipt absent. Archived stays listed; source tension to A1. Do not infer receipt semantics from note().

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-10 — cap.project.create

Historical gap: Foreign-workspace refusal contradicts asserted success;201/receipt/owner role not asserted.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-10a — cap.language.create

Historical gap: Proposed201, inverse and assessment creation only partly exercised by direct dispatch G15, not twins. Viewer refusal absent.

- **Current assertion / internal dispatch / owner/outsider:** language.test.ts exercises create/list/assessment creation, duplicate refusal, archive and inverse; this is not external twin proof. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/language.test.ts#L15
- **Live attributed / MCP / owner:** C093 reports language.create; no per-field shape or negative case inferred. Source: https://github.com/klappy/3d-review-cookbook/issues/19#issuecomment-5710948108

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-10b — cap.language.list

Historical gap: Per-item id/code/name/archived_at shape and positive MCP list absent.

- **Current assertion / internal dispatch / owner/outsider:** Successful list within language lifecycle does not prove external MCP shape. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/language.test.ts#L15

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-11 — cap.project.update

Historical gap: Member refusal, nonempty descendant preservation and org/language updates absent.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-12 — cap.project.unarchive

Historical gap: No successful owner project archive/unarchive scenario; no live-project idempotency, member refusal, child stage/count preservation. Generic scope/anonymous refusal is narrower.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-13 — cap.assessment.list

Historical gap: Requested positive assessment-scoped list is contradicted by NOT_FOUND. A113:129–131 compares list results without asserting success; no positive credit. Me grants are not assessment.list.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-14 — cap.assessment.get

Historical gap: Period/format and full header values absent.

- **Current assertion / mock handler / viewer/project owner/member:** Exact assessment viewer read succeeds; write refused; project grant alone cannot authorize assessment. No HTTP/MCP positive header-value claim. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/a3-exact-assessment-grants.test.ts#L28

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-15 — cap.assessment.update

Historical gap: Readback/new value, all five fields, actual inverse restoration and responses_exist language guard absent.

- **Current assertion / mock handler / viewer/project owner/member:** Viewer update refused and no writes; project grant alone insufficient. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/a3-exact-assessment-grants.test.ts#L28
- **Live attributed / MCP / owner:** C091 reports assessment.update. Exact five-field/readback/inverse closure not established by summary. Source: https://github.com/klappy/3d-review-cookbook/issues/19#issuecomment-5710948108

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-16 — cap.assessment.set_stage

Historical gap: Successful adjacent stages, reflected stage, receipt inverse/undo and preserved counts absent on both twins. H15 only handler collection gates; proposed INVALID_PARAMS differs.

- **Live attributed / MCP / owner:** C087 reports set_stage; no successful stage/undo/count twins inferred. Source: https://github.com/klappy/3d-review-cookbook/issues/19#issuecomment-5710851850

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-17 — cap.assessment.notes.update

Historical gap: Prior text restoration only direct-dispatch E22:101–111; external inverse/undo still missing.

- **Current assertion / internal dispatch / owner:** code-escrow notes update and undo restores previous text; remains internal. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/code-escrow.test.ts#L102
- **Live attributed / MCP / owner:** C092 notes.update plus undo token; token existence is not proof of inverse restoration. Source: https://github.com/klappy/3d-review-cookbook/issues/19#issuecomment-5710948108

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-18 — cap.template.list

Historical gap: Exact IDs/pins and draft absence not asserted on list; direct database instrument test is separate.

- **Current source / internal DB/oracle / synthetic source:** pinned-instruments and rubric-source-readback tests exist. Source111items/9templates proof does not close external list exact-ID assertion by itself. Source: Current test inventory; source gold ruling13c5706246421

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-19 — cap.template.get

Historical gap: Stable item-ID set and exact INVALID_PARAMS on omitted version absent.

- **Current assertion / HTTP / participant shared context:** Pinned v2 response form asserts template id/version; not template.get external parity. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/shared-link-flow.test.ts#L87

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-20 — cap.template.render

Historical gap: Supported-set refusal, multi-select and null/zero external semantics absent; rendering/submit helper evidence P19 not external twins.

- **Current assertion / HTTP / participant shared context:** Response form/source-derived required/multi/exclusive validation is asserted; not template.render unsupported-language contract closure. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/shared-link-flow.test.ts#L87

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-21 — cap.template.publish_version

Historical gap: Support dry_run/execute success, receipt, version binding, confirmation expiry/required guard absent. Zero support execution credit.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-22 — cap.survey.deselect

Historical gap: Empty-survey direct dispatch E22:122–125 only ok/inverse:none/no undo, contradicting proposed inverse. With-response archive/count preservation and viewer refusal absent. No external success.

- **Current assertion / internal dispatch / owner:** Empty survey deselect executes with inverse none in existing code-escrow test; response-preserving external positive remains unclosed. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/code-escrow.test.ts#L120

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-23 — cap.survey.get_status

Historical gap: No count field shape, numeric value, perspective totals or below-threshold observables asserted.

- **Current assertion / HTTP / owner:** Current shared-link-flow45 asserts status.result.counts.responses = before+2 after two independent respondents. Closes the absolute claim that no HTTP numeric count assertion exists; not full perspective shape or MCP parity. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/shared-link-flow.test.ts#L45
- **Live attributed / UI/HTTP owner count / staff + two participants:** First collection/staff proof and closure preserve two responses. Historical accepted collection source, not current integrated release acceptance. Source: https://github.com/klappy/3d-review-cookbook/issues/16#issuecomment-5709742129

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-24 — cap.request.create

Historical gap: 201, support queue/author visibility, no provisioning and open-window boundaries absent.

- **Current assertion / internal handler / stranger signed-in:** Pending request idempotency and invalid kind asserted; support queue/provisioning/window not proved here. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/lane-b-grants.test.ts#L73
- **Live attributed / MCP / owner/viewer:** C094/C095 report request.create; no201/support-readback inference. Source: https://github.com/klappy/3d-review-cookbook/issues/19#issuecomment-5710948108

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-25 — cap.response.form

Historical gap: Mandatory participant-code prerequisite SUPERSEDED. Isolated handler form evidence J13/P19 is not successful HTTP/MCP form acceptance; bound-version stability and closed collection external case absent.

- **Current assertion / HTTP / shared participant:** Bound v2 form and closed/revoked/expired scopes asserted; old blanket no external form-positive claim is superseded. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/shared-link-flow.test.ts#L62
- **Current assertion / MCP / participant bearer, owner denied own receipt:** MCP response.form succeeds, submit/receipt identity agrees, owner receipt denied. This local adapter test uses minted sessions, not delegated OAuth journey. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/shared-link-flow.test.ts#L107
- **Live attributed / browser UI / anonymous shared-link participant:** First collection browser receipt proves bounded direct completion without participant account; no all-device assertion. Source: https://github.com/klappy/3d-review-cookbook/issues/16#issuecomment-5709623832

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: Existing Auth/participant A14 + B15/B3 →17; UNACKNOWLEDGED gaps.

## A04-26 — cap.response.assisted_next

Historical gap: Fresh respondent after submission, next-without-submit idempotency, counts and successful twins absent. Shared-link independent respondents governs; do not restore mandatory-code batches.

- **Current assertion / HTTP / shared participant:** assisted_next explicitly expects STAGE_CONFLICT; not implemented positive flow. Multiple independent shared-link respondents do not require assisted_next. Source: https://github.com/klappy/3d-review-app/blob/299f8255526e13b17215ea1af44e3600d4b35dc2/test/shared-link-flow.test.ts#L80

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: Existing Auth/participant A14 + B15/B3 →17; UNACKNOWLEDGED gaps.

## A04-27 — cap.recommendation.propose

Historical gap: Provenance proposal storage and built validation absent; zero functional credit.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-28 — cap.recommendation.review

Historical gap: Review state transition, reviewer timestamp/reason and role/state validation absent; zero functional credit. Row absent from A205 loop but present in S57 reserved list.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-29 — cap.rollup.project

Historical gap: Aggregated result/suppression semantics absent; zero functional credit.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-30 — cap.rollup.workspace

Historical gap: Workspace aggregation/suppression/scope filtering absent; zero functional credit.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-31 — cap.import.batch

Historical gap: Import storage/source/receipts/all-or-nothing and owner refusal when built absent; zero functional credit.

No selected current receipt closes this historical gap.

Disposition: Historical gap not closed by the selected current receipt set; absence of complete evidence is not a newly observed product failure. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-32 — cap.ops.health

Historical gap: Build SHA and dependency-failure503 absent; KV/email not represented. Regex is not universal no-secret proof.

- **Live attributed / MCP / owner:** C096 health read reported at composite main299f825 identity; health source_sha is old contract pin, not deployment identity. Source: https://github.com/klappy/3d-review-cookbook/issues/19#issuecomment-5710948108
- **Candidate only / HTTP/MCP / public health/MCP initialize:** PR31be5534d release identity; older43c9868 review/test receipt historical, exact candidate must retain its own verification. UI badge is separatePR33. Source: https://github.com/klappy/3d-review-app/pull/31

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

## A04-33 — cap.ops.feedback

Historical gap: 201, support visibility/context, size/unknown-field refusal and receipt stripped flag absent (assertion is result.stripped).

- **Live attributed / MCP / owner/viewer:** Wave N reports recorded:true/stripped:false. Does not prove rich fields persisted or authorized readback; separate feedback AMEND remains own lane. Source: https://github.com/klappy/3d-review-cookbook/issues/19#issuecomment-5710948108

Disposition: Partial scoped overlay; no whole-row acceptance. Owner: A14 contracts + B15/B3 evidence →17; UNACKNOWLEDGED gaps.

