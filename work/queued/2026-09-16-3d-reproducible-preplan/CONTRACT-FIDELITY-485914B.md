# Independent integration fidelity audit —485914b

Exact source `485914ba578800465a88a3f7afc448bf2e38f73e`, fetched published integration branch. **Runtime/contract union fidelity ACCEPT within this scope; narrow metadata AMEND.** No suite run or product edits; native final review remains required.

- JSON comparison: Auth2315→combined differs in exactly `cap.survey.issue_link`, `cap.participant.open_link`, `cap.response.form`, `cap.response.submit`, `cap.response.receipt`. Every capability object equals API24fc0bbc3. Issue_link is write.effect/danger with params/result schemas; the other four retain reviewed class/tool/schema values. No silent sixth capability change.
- Entire capabilities.json differs from API24 only by Auth's added global RATE_LIMITED. Entire openapi.yaml differs from API24 only by the same ErrorEnvelope enum member. Thus all five API OpenAPI operation deltas remain verbatim, including public open, scoped participant security, schemas and lifetime annotations. Auth src/handlers/docs.ts is unchanged from2315 and includes RATE_LIMITED in every documented row's error list.
- contract-manifest.json is byte-identical toAPI24. It **does not contain artifact-content hash claims**; source_sha is historical cookbook source provenance, not an assertion that current derived artifacts equal that source. shared_link_amendment correctly records five IDs,0007,10f5 development baseline and candidate review status. No generator/hash validation should be claimed merely because this file merged cleanly. Actual computed SHA256 values below pin what was inspected.

**AMEND metadata only:** capabilities.json counts still lists write.effect6/write.reversible41. Counting actual83 rows gives write.effect7/write.reversible40 (read29/write.dangerous7 unchanged). This stale derived count came from API24's class change, not a lost merge. API owner should correct exact metadata hunk with applicable delta review; no generator/full reconstruction needed. OpenAPI introduction still says79 capabilities while current list has83; this is preexisting, record/correct essential description without asserting new behavioral scope.

Migration inventory compared with10f5 adds only0006_oauth_code_redemption.sql and0007_shared_link_context.sql; no0005 and no seed change. SQL hashes match accepted rollout7b0b0d2dc7f2d22fbcc57f065c9746ca3b393bfac7463b969b908b9c72748121 /1fe0f9e014a4a716caf0c45d88d2adc2fc0b288390464fc430f62f1243a7a88a. Auth protected runtime/config survives, API backend delta exactfc0bbc3, UI/recovery and A8 docs are the other named scopes. No unrelated backend feature observed.

Test/schema claim precision: OAuth/hardening/stitch-cost fixtures load0001–0004+0006; shared flow/concurrency/browser fixtures load0001–0004+0007; code-escrow gained0007. All referenced files exist. Design's plan statement that every changed-handler DB loads both0006+0007 is not true of execution. This is not automatically a failing test design: isolated tests cover different handlers. Do not represent the120-test sum as a single DB with fullschema or remote migration proof. Existing native Auditor's integrated acceptance must use the chosen full0006+0007 local/DEV schema under its actual gates. Existing docs/release instructions and separate accepted rollout govern remote additive execution; never replay test setup remotely.

Actual inspected artifact SHA256:

| Artifact | SHA256 |
|---|---|
|contract/capabilities.json|`7a0ba42ed6cf646f27c2ee96367ba5be130571df38a403f148ea7014a5e9026a`|
|contract/openapi.yaml|`c2b28d735987acd801352ebf63513e0c7154e3c29f812b3a7aab7459e89b6429`|
|contract/contract-manifest.json|`67efd0b1bcdeec5bea920152134d7ec74a5a196dc193b10777234e2423990c29`|

No inference that485914b is final after outstanding UI findings. Any later contract changes require exact delta recheck; previously reviewed unchanged bytes can retain their provenance. Root owns handoff/persistence.
