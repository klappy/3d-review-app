# Independent Fable spotcheck — 2026-09-21

Disposition: **AMEND before implementation planning acceptance; retain audit as valuable observed input.** This is an independent bounded ten-row sample, not validation of all findings, execution of the kit, or approval to port/build. No product changes, submissions, owner assignment, deployment or merge occurred. This reviewer assigns no owner. Separately, coordinator /root/auggie_review has an actual integration-coordination ACK recorded in [landed intake a8025ea](https://github.com/klappy/kitchen/commit/a8025ea), with cookbook claim 16c5769969405 reported read back by the coordinator; this is not acknowledgment by a fictional C7 worker.

## Exact inputs and coverage

Read [README](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/README.md) and [GAP-ANALYSIS](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/GAP-ANALYSIS.md) at cookbook PR100 head `1be0f838a9ca692f980d7c3fd1ce71e704bbd983`. Kitchen PR129 intake candidate was supplied as `cb5c10381d4392d8cb82945ef8a196b77e42f216`; its mergeability/authority is not established by this review.

Independently counted committed evidence: 73 JPEG files; table rows 30 GAP, 71 TXT, 16 DD. Section 5 contains 27 preservation rows, described by the audit as mapping 60/90 capabilities; that mapping is not an independently executed 60-capability proof.

Selected ten rows independently: GAP-001/006/010/018, TXT-004/042/060/070, DD-003/016. Visually inspected six actual committed JPEGs, retrieved as base64 and rendered in tool output:
- [App demo Collect](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/evidence/app_demo_1_assessment_demo_assessment_collect.jpg)
- [Kit Collect](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/evidence/kit_a_a1_collect.jpg)
- [Kit viewer People](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/evidence/kit_viewer_a_a1_people.jpg)
- [App welcome](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/evidence/app_.jpg)
- [Kit welcome](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/evidence/kit_.jpg)
- [Legacy facilitator signed-out](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/evidence/app_legacy_facilitator.jpg)

These are immutable evidence paths, not newly captured live screenshots. No local screenshot artifact was created. No authenticated live owner/member workflow, write, keyboard/mobile interaction, print output, or all-route regression was executed here. The audit correctly marks authenticated app screens source-only. Its scratchpad/text-dump references are not substitutes for committed evidence.

## Ten-row disposition

| Row | Independent finding | Required disposition |
| --- | --- | --- |
| GAP-001 | Collect screenshots support flat app topbar versus kit ancestor crumbs/role. App also has sidebar context; absence claim must stay specific to topbar. | Accept observation; shell design remains pending approved baseline. |
| GAP-006 | Layout difference is visible. App screenshot is viewer; kit is owner with illustrative invitation denominators and code controls. This is not equivalent role/data comparison. | Accept visual difference; role-matched proof needed. Do not introduce invitation denominators or kit code semantics without contract support. Audit already excludes code chips correctly. |
| GAP-010 | Kit viewer screenshot visibly exposes invite, role/removal and transfer controls; app roster comparison is source-only. | Preserve this kit defect as a pre-integration gate. Names/email and organisation fields need real data authority; fixture richness is not evidence those fields exist in app contract. |
| GAP-018 | Welcome difference is directly visible, including kit participant entry. | Accept observation, not “wrong” wording as settled design. Exact copy and stage vocabulary remain explicit rulings. |
| TXT-004 | Public app welcome screenshot visibly includes “Sandbox test identities (dev only)”. | Accept bounded semantic correction: production public entry should not advertise development-only sign-in. Replacement copy still needs its ruling. |
| TXT-042 | Current share.js intentionally keeps credential only in memory and clears on identity/survey/epoch changes. | AMEND “cut when link persists”: persistence is not an approved copy fix. Preserve/reword once-shown warning; do not change credential storage/recovery to match fixture. |
| TXT-060 | Current feedback.js supports problem-first optional text, account/support audience, no automatic attachment, optional ratings and uncertainty handling. Kit binary footer does not establish equivalent reporting. | AMEND blanket one-line cut. Condense/relocate with privacy context at entry and retain reporting capability. Reconcile separately paused PR159 before exclusive file custody. |
| TXT-070 | Source confirms legacy once-only code export/link warnings and stage consequences. Signed-out screenshot does not expose console controls. | AMEND “cut all but last; retire surface.” Remove technical jargon selectively; retain decision-relevant consequences. Retire only after replacement proves active deep links, invitation/code flows and preservation cases. |
| DD-003 | Source supports survey/template selects selecting the target for legacy actions. Inspected facilitator screenshot shows only sign-in gate, not those selects. | Accept source-only concern; signed-in visual and target-change behavior remain untested. |
| DD-016 | Kit screenshots show View as fixture role control. | Accept: keep in isolated fixture harness, exclude from production authority/UI. It is not a real permission mechanism. |

## Critical preservation checks and baseline delta

Source inspected: ui/index.html explicitly loads /assess/assess.js; ui/app.js is not the normal root. assess.js forwards #participant and #invite=/#facilitator/#workspace/#evidence to legacy. The audit correctly identifies this architecture. Any retirement must account for these live entry paths.

Read share.js credential scoping; permissions.js dry_run → frozen identical params → execute, token consumption, CONFIRM_REQUIRED refreshed preview requiring another confirmation; feedback.js recorded receipt and uncertain resend warning; legacy app.js unknown submission/receipt handling and code/link controls. These support the audit's preservation list but are **source checks, not runtime pass claims**. Participant namespace/resume, code export once-only, invitation acceptance, sharing/print and role-loss behavior need targeted normal-shell acceptance before replacing controllers. Preserve useful receipt/trace provenance through accessible disclosure.

Audit app baseline is 2e9cb18 / 0.14.3. Accepted current DEV main is 76fe13823dda23c9c046d2b44cdce94fc0842602 / 0.14.4, accepted tree df7caca24120c9e4ace1ea41be67bf584001d7c4 (see existing roadmap-readable-progress DEV-RELEASE-RECEIPT-2026-09-21.md, commit 61da3d3e4cbd84731658bc68d5d9bdac4c474b2c). Local comparison 2e9cb18→accepted d93fa68 source lists eleven changed files: package manifests; release metadata/0.14.4 record; version test; five roadmap files. Normal root, assess/share/permissions/feedback and legacy source are unchanged by that release. GAP-025, TXT-068 and S20 roadmap evidence therefore need reconciliation against the new roadmap behavior, including Next→Future, rather than treating old screenshots as current. The live DEV receipt's two absent roadmap cases remain explicitly untested. This review did not independently refresh remote main or recapture DEV.

## Port versus incremental integration

The artifacts establish useful reusable visual patterns, not port readiness. The kit's reported 83-row fixture coverage is not independently rerun here and does not prove preservation of real 90-row behavior, credentials, uncertainty, authorization or legacy paths. The viewer controls and different link model demonstrate material adaptation work. Conversely, the existing controller behavior and unchanged root source make incremental adoption of approved shell/components a credible lower-risk option; this ten-row sample does not prove its total cost either.

Before choosing: compare one bounded normal-shell vertical slice for both approaches against the same approved visual baseline and preservation cases, with explicit changed-file/controller migration scope and rollback cost. Do not treat the audit author's preference as authority. A port may reuse existing controllers; incremental integration may replace broad rendering. Decide on observed migration risk rather than labels.

## Required planning corrections / gates

1. Resolve TXT-042/060/070 preservation contradictions in the canonical audit crosswalk; keep unresolved as decisions, not automatic cut tickets.
2. Freeze approved design/copy/stage baseline and reconcile current app main/roadmap delta. Do not claim PR24 copy verdict or Fable target is ratified.
3. Give the 27 preservation rows stable acceptance references with positive, refusal, uncertain and identity-change cases where applicable. Explicitly account for unmapped capabilities; 60/90 mapping is not complete regression coverage.
4. Carry the separately recorded integration-coordination ACK into the accepted plan; obtain actual implementation custody ACKs and assign exclusive concrete file partitions. W1/W2/W3/W4 conceptual bounds overlap assess/scope and cannot alone satisfy “workers do not touch each other's files.” Account for PR159 and its cookbook99 pin; preserve accepted PR156 tree and release history.
5. One integration/release with whole-batch desktop/mobile, role-matched, normal-shell visual and behavior review. Kit permission controls, mock data replacement and active legacy route survival are gates before any retirement. No build FIRE from this receipt.

Independent reviewer: ui_audit, not author of PR100. Parent coordinator retains ruling/intake and release authority. This receipt records bounded findings in the existing meal; it does not create a competing cookbook audit.
