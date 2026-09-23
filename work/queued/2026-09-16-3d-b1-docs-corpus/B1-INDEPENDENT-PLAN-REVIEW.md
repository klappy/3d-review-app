# Independent B1 plan review

Verdict: AMEND before acceptance as a fully specified implementation plan. Reviewed local plan SHA256 `54c4d9c7004dace17561a3dac2902372a701c8e631ff4bec96944c0e5bef5f8e`; no authorship or implementation by this reviewer.

Fresh supporting reads: existing kitchen B1 TICKET; held PR21 disposition5707627120; app src/handlers/docs.ts and tools/gen_contract.py at10f5f444d68475d7114ab8fe0bf269fe106476b1. B1 remains owned historically by Fable; current active writer ACK has not been proved. This is a review of planning sufficiency, not a new execution claim.

## Required amendments

1. **Finish the concrete projection design now.** Choose exact maintained cookbook data location, projection program location, deterministic command and pinned tool dependencies, generated app output path and docs handler/test allowlist. Replace “05 and/or18-G” and “implementer specifies path/command before fire” with reviewable decisions. Name B5/shared-file custody and the actual owner-return boundary. The existing gen_contract.py is not an adequate docs schema projector: it generates generic parameter objects and a current-time generated_at value, so blindly reusing it fails the proposed exact regeneration oracle. A new bounded projector may be appropriate, but its input/output contract and normalization must be in the accepted plan, not discovered during implementation.

2. **Separate observed parameter shapes from accepted source authority.** tools/gen_contract.py explicitly declares params_schemas OWED; generic OpenAPI additionalProperties and 83 registered capabilities do not supply accepted schemas for pid, scope, role/email/gid, assessment fields or form constraints. Include a narrow schema acceptance table: capability, exact source pin, current observed handler pin, required/optional type, normative disposition and actual contract-owner receipt or pending blocker. No silent codification of implementation defects. Auth002/005 must bind a specific accepted contract snapshot or remain excluded/pending; do not chase a moving Auth branch during docs implementation. An additive docs supplement can preserve unresolved discrepancies without editing the contract itself.

3. **Complete the PR21 cargo map as planning material.** Its 79 pages/six topics/generator stub/B6/J1–J10 shape remain unique historical cargo. Read the relevant groups and specify retained, unadopted or superseded status, actual destination and responsible owner before selecting reuse paths. The existing disposition expressly says wholesale adoption/discard is unproved. This small map need not independently accept every legacy page or delay unrelated work; it prevents inventing custody or recreating an already maintained artifact. PR21 remains held.

## Preserve these strengths

The proposed implementation is genuinely executable docs discovery, not merely another prose wrapper: natural-language recipe discovery, concrete schemas/examples, independent cold-agent holdout wording, correct first attempted call, local synthetic effect tests and exact clean regeneration. Preserve the <=2 docs-call target as proposed/tested, not existing global acceptance. Scope excludes aliases, automatic collection opening, validation weakening, class/permission changes and actual shared-link implementation. Participant code/login must never become a prerequisite; synthetic fixture setup can supply test context without documenting legacy issuance as the user flow.

The cold-agent receipt should record what the agent actually knew initially, all docs/capability calls and source pins, so repo-coached implementation tests cannot substitute for the independent oracle. Examples for invite/revoke must use valid flat scope parameters and prove the intended authorization behavior, not only parameter rejection.

No gate PASS, active writer ACK, cookbook publication, implementation, provider change or full B1 acceptance follows from this review. Return the revised bounded plan to a different non-author reviewer; root retains publication/disposition and shared records.
