# 3D feedback release attribution and recurrence triage

Status: ordered; implementation not started. Coordinator: root 3D Review task; implementation owner assigned when pulled.

Product issue: [3d-review-app #116](https://github.com/klappy/3d-review-app/issues/116). Source: creator instructions September18 to attribute experienced versions, reproduce concerns, check known issues and distinguish unaddressed recurrence from failed remediation.

Deliver a bounded implementation capturing trusted submission-server release/build separately from experienced UI/MCP artifact and relevant API-response build, with experience/submission times and provenance. Preserve unknown historical versions; never infer experienced version from submission time. Keep existing privacy, actor attribution and public compatibility; expose authorized support readback and feed the monitor. No sensitive page/answer/token capture.

Acceptance:
- HTTP/MCP coverage proves server metadata cannot be spoofed, optional experienced-client evidence is identified as client-reported, and legacy records remain readable with unknown attribution.
- Reproduction uses the experienced source when recoverable and compares the same scenario on the candidate. Not reproduced does not mean disproved.
- Link known issues and applicable fix releases while retaining each occurrence and released remediation attempt.
- Repeated reports before a fix are open-defect evidence; reports after an applicable released attempt trigger suspected/confirmed failed-remediation incident triage. Multiple failed attempts retain their history and escalate investigation rather than reset the issue.
- Independent exact-head review, canonical contract/pin updates as needed, normal DEV-first release and identical-source production promotion. Keep technical resolution and user confirmation separate.

This is distinct from the [reusable operating recipe](../2026-09-18-feedback-release-loop-recipe/TICKET.md), kitchen PR127, and the already shipped/pending feedback form. Do not enlarge or block accepted releases with this new slice. Product implementation remains pending, not delivered by documenting the recipe.
