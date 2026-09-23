# Capability preservation appendix — literal audit reconciliation

Status: read-only planning appendix, NOT tested coverage or new feature scope. Date2026-09-21 America/New_York.
Independent mapping by orphan_audit; K1 exact-head review remains priority.

## Denominator correction

Frozen audit [§5](https://github.com/klappy/3d-review-cookbook/blob/1be0f838a9ca692f980d7c3fd1ce71e704bbd983/planning/2026-09-21-design-system-batch/GAP-ANALYSIS.md) contains27 preservation rows. Mechanically expanded slash shorthand ONLY in its capability column (e.g. cap.workspace.list/create/get); retained nested cap.assessment.notes.update; excluded “cap.ops.undo absent”, which is a negative statement. Result:55 distinct valid mapped capability IDs, zero invalid IDs. Current [contract](https://github.com/klappy/3d-review-app/blob/76fe13823dda23c9c046d2b44cdce94fc0842602/contract/capabilities.json) contains90 IDs. Literal remainder is35, not30.

Preserve author's60/90 claim as unverified historical mapping assertion; five additional implied mappings were not identified. Do not select five convenient rows to make the arithmetic fit. This appendix enumerates the exact35 literal gaps; it does not say mapped55 were tested or unmapped35 are absent from the app.

## Evidence and disposition rule

Current contract metadata is authoritative for declared surface/status, not proof of implementation. Inspected current76fe138 src/handlers/index.ts blob67d1810b4403c7540c72cb10178fe285b3a5c90f, response.ts blob119e2a93f779e8dff7c8f9809c50b89998a61e3b, platform.ts blobb79c8a2ab3d9d9ba8f9d89084023f587b028af9b. Handler registry explicitly permits honest501 for missing handlers. Selective local source matches in retained app surfaces confirm archive display/filtering, not archive action controls; ui/mcp/action-card.js explicitly renders cap.template.get/render. Local source observations are navigation anchors, not new live/runtime proof.

UI preservation means a concrete presentation/receipt obligation to account for in the existing K partitions. Backend/meta means retain current contract/authority, no new UI demand. UNKNOWN mounted UI means the contract suggests a surface but this bounded source sample did not establish its current mount; preserve backend and resolve during existing adapter mapping before any route/control retirement. Unknown is not absent or passed. No new full-parity rebuild is ordered.

| Exact unmapped ID | Disposition | Existing-batch implication |
| --- | --- | --- |
| cap.entry.intents | UI preservation | K2/K3 public intent choices remain reachable; preserve routing/permission distinction (P01/P02/P21). |
| cap.workspace.archive | UNKNOWN mounted UI | Contract names menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.workspace.unarchive | UNKNOWN mounted UI | Contract names menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.workspace.delete | UNKNOWN mounted UI | Contract names menu (danger); no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.project.archive | UNKNOWN mounted UI | Contract names menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.project.unarchive | UNKNOWN mounted UI | Contract names menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.project.delete | UNKNOWN mounted UI | Contract names danger; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.language.archive | UNKNOWN mounted UI | Contract names language row menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.language.unarchive | UNKNOWN mounted UI | Contract names language row menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.assessment.archive | UNKNOWN mounted UI | Contract names menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.assessment.unarchive | UNKNOWN mounted UI | Contract names menu; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.assessment.delete | UNKNOWN mounted UI | Contract names danger; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.template.get | UI preservation | K6 MCP action-card questionnaire rendering is explicitly mounted; preserve safe returned-question view (P25). |
| cap.template.render | UI preservation | K6 MCP action-card render branch is explicitly mounted; preserve questions without implying submission (P25). |
| cap.template.publish_version | Backend/meta; no new UI | Platform/admin contract; preserve backend authority, no new editor inferred. |
| cap.survey.revoke_code | UNKNOWN mounted UI | Contract names no explicit UI surface; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.request.create | UNKNOWN mounted UI | Contract names "Request a project/workspace"; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.response.assisted_next | UNKNOWN mounted UI | Contract names "Next person"; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.response.list | UNKNOWN mounted UI | Contract names Understand; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.response.purge | UNKNOWN mounted UI | Contract names danger; no mounted action established in this bounded inspection. K3/K5 reconcile route/handler usage before retirement; preserve backend meanwhile. |
| cap.recommendation.propose | Backend/meta; no new UI | Explicitly reserved; retain honest unavailable behavior and do not build mock feature. |
| cap.recommendation.review | Backend/meta; no new UI | Explicitly reserved; retain honest unavailable behavior and do not build mock feature. |
| cap.rollup.project | Backend/meta; no new UI | Explicitly reserved; retain honest unavailable behavior and do not build mock feature. |
| cap.rollup.workspace | Backend/meta; no new UI | Explicitly reserved; retain honest unavailable behavior and do not build mock feature. |
| cap.support.acts_as | Backend/meta; no new UI | Contract target is not implementation proof; current support source says held501/HUMAN-ONLY provisioning. No new admin UI. |
| cap.support.unlock_participant | Backend/meta; no new UI | Support handler reissues code; preserve support authorization and compensation, no new public control. |
| cap.import.batch | Backend/meta; no new UI | Explicitly reserved; retain honest unavailable behavior and do not build mock feature. |
| cap.ops.feedback_get | Backend/meta; no new UI | Support-only per-id readback; preserve scope/existence hiding, no public feed. |
| cap.ops.undo | UI preservation | K3/K5 must preserve any real receipt undo affordance and NO_INVERSE distinction; audit explicitly calls undo absent from dirty-state row, so not covered (P10/P24). |
| cap.docs.get | Backend/meta; no new UI | Role-aware docs/MCP metadata; preserve endpoint and role filtering, no help redesign inferred. |
| cap.docs.openapi | Backend/meta; no new UI | Contract artifact endpoint; preserve output, no new UI. |
| cap.ops.roadmap_publish | Backend/meta; no new UI | Roadmap publishing authority remains server-configured; preserve transport/auth and accepted156 surface; no editor added. |
| cap.ops.roadmap_summary | Backend/meta; no new UI | Roadmap publishing authority remains server-configured; preserve transport/auth and accepted156 surface; no editor added. |
| cap.ops.roadmap_verify | Backend/meta; no new UI | Roadmap publishing authority remains server-configured; preserve transport/auth and accepted156 surface; no editor added. |
| cap.ops.roadmap_redact | Backend/meta; no new UI | Roadmap publishing authority remains server-configured; preserve transport/auth and accepted156 surface; no editor added. |

## Return and gate

Use this appendix with existing P01–P27, not as a competing audit. At affected K3/K5/K6 integration, cite concrete mounted route/handler proof or explicit no-new-UI disposition for unknowns; preserve all endpoint behavior and honest unavailable states. K1 pure-view work is not blocked by these later integration debts. No product files, live writes, tests, benchmark or source ownership changed. Correct the final coverage denominator or supply the author's missing five mappings before claiming complete batch preservation.
