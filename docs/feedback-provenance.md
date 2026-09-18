# Feedback provenance: bounded API storage/readback slice

Issue [116](https://github.com/klappy/3d-review-app/issues/116), current user instruction September18. This candidate implements automatic submission-server attribution and an optional structured experience report on existing feedback HTTP/MCP writes. It does not complete issue116. The release candidate is 0.13.0, following roadmap 0.12.0; deployment remains unverified.

New accepted writes stamp server-generated version, commit/build, build UUID, canonical release pin, environment and submission time. Time matches row created_at. Metadata resides in the existing body storage under a reserved internal key; it is not an accepted caller field or a database migration. Caller context never becomes trusted identity. Support-only feedback_get exposes top-level provenance; the public write receipt remains exactly recorded/stripped/feedback_id, and body projection does not leak internal storage fields.

`experience` is optional, strictly allowlisted and bounded to1536 JSON UTF-8 bytes inside the existing8192-byte request budget. It may report occurred_at, a surface/host enum, loaded-client identity and a relevant API-response identity. Support readback labels it client_reported. Missing values remain unknown. It accepts no URL, hostname, page content, credentials, answers or arbitrary free-form metadata. Existing explicitly entered note/context remain governed by their existing contract; this slice does not automatically capture them. Client-reported data is evidence to investigate, not server attestation of the experience.

Example (synthetic; do not send merely to test docs):

```json
{"note":"The requested view was empty.","experience":{"occurred_at":"2026-09-17T10:11:12.000Z","surface":"mcp_panel","host":"chatgpt","client_release":{"version":"0.8.0","commit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"api_release":{"version":"0.9.0","commit":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}}
```

POST this body to the existing /v2/feedback, or wrap it as params for MCP write cap.ops.feedback under the existing connection authentication. Set require_authenticated:true when authenticated attribution is required. No field is newly required and omission/false preserves public feedback. A serving submission build never proves the older experienced build.

Legacy rows return provenance:null without mutation, preserving their original time/body. Malformed internal metadata is existence-hidden instead of being replaced by current health. No source/version is backfilled. A current health read cannot reconstruct the UI already loaded in a tab or the user's earlier API response.

Canonical contract amendment: f5d925f9f9d448828f7b7bb7afabc08ba6db933f in 3d-review-cookbook. Capabilities/OpenAPI carry separate field-level source annotations; base-matrix and semantic release pins are not misrepresented as the source of this addition. The separate 0.13.0 release record supplies the semantic-version authority; package, lock and manifest are validated projections. The contract amendment pin remains unchanged.

## Evidence and remaining acceptance

Fixed local fixture scope: nine scenarios per transport (HTTP and MCP),18 total, plus one contract projection-parity check. Those19 checks and41 existing persistence/privacy regressions pass60/60. Synthetic local Request+D1 transport fixtures exercise the shared app dispatcher, not a live OAuth/host connection. Cases cover deceptive context, spoofed metadata, different experienced client/API versions, strict shape/time/type/size rejection, legacy unknowns, malformed rows, existing public/attribution behavior, support gates and trace/write-receipt privacy. No live write, browser or human confirmation is claimed.

Issue116 stays open with linked follow-up acceptance: automatic loaded web/MCP artifact identity capture must bind evidence to the actual client artifact and relevant earlier API response, never substitute submission health; safe experienced-version replay versus fixed-version validation; known-issue/docs matching; recurrence occurrence preservation and failed-remediation attempt ledger; deployed DEV/production verification and original-user follow-up. Root's authorized monitor may consume support readback, but this PR installs no monitor/list endpoint, reproduction engine, issue writer or rollback behavior. Technical storage completion is distinct from those remaining states.
