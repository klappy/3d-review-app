# Independent frozen-release inventory audit review

Verdict: **ACCEPT — evidence inventory audit only.** This is not acceptance of a reconstruction recipe, cold rebuild, current product completeness, or the upcoming report implementation.

Reviewed target app `a57ba930ced3c23616982c7dab291949b75a3b8a`, tree `f0d676873e597b9f74848b2e3ca86e618a5c154d`.

Exact cargo pin: `AUDIT-CARGO-HASHES.json` SHA256 `19d0499b0bca64e6af0434b2e0ad0c4bda416743acfa84609ad57acc8619a8e8`; independently rehashed all 15 listed artifacts successfully. Report SHA256 `dabd68e2b8af45c94a38405ebd7608d2f01f2b39a4566ec2aae64cb277363e5a`; ledger JSON SHA256 `811580a897a065f7a2ebb9e5a50f6473d043f65fac81670a5cec2cb92cdc4058`.

## Independently observed

- Git objects in `/tmp/a8-order-a-author/app` match all 140 ledger paths, modes, blob IDs, SHA256 values and sizes. Extracted audit source bytes also match those objects. Classification totals recompute to 108 partial, 20 missing, 12 external inputs; prior inventory intersection is exactly 117 paths and 23 are explicitly new. These are audit assessments, not measured reconstruction successes.
- All 11 archived supplier inputs match frozen app bytes and receipt hashes. Their provenance is attributed to the supplier receipt; this review did not separately fetch upstream. The twelfth external-input row is the secret-placeholder/local-input requirement, expressly lacking a canonical file producer. No secret values were inspected or exported.
- Generator `tools/gen_contract.py` emits wall-clock `generated_at`; its global error list already includes RATE_LIMITED. The frozen manifest contains 83 capabilities. The audit correctly identifies missing deterministic projection/amendment work and does not claim running this generator will reproduce the accepted manifest.
- Actual frozen migration inventory is 0001–0004, 0006, 0007. Cookbook36 contract line59 explicitly includes 0005 in its integrated sequence. The identified contradiction is real; no authority to apply 0005 follows. Preserve the original statement and record its scoped correction through the owner/root.
- Platform source has the guarded login-code UPDATE and requires exactly one change before minting. UI source has the no-fragment receipt-probe cannotResume branch before the generic error handler. These sample checks support the CAS/R15 provenance findings; they are not replacement Auth or browser acceptance. Known misleading submit wording/raw-code and missing controls remain residual observations, not future normative requirements.
- Independently extracted 26 app-module entries from the tracked source map: 7 match the frozen release, all 26 match each cited historical commit `0542cf54cc9d31851a73c52d236a2909a9e26d81` and `fbc970c541ce9ab6d704405ef86f89dd34d12532`. This supports the historical-dist gap without implying deployed-source regression or proving exact historical build reproduction.

## Boundary and disposition

The audit names source exposure, unbuilt recipes, missing inputs and historical/proposed authority honestly. It does not disguise an application archive as a cookbook producer, claim a cold build, or turn current defects into desired behavior. Root may persist this audit and route its concrete cookbook gaps. Preserve the referenced auxiliary receipts alongside the 15-file manifest; the manifest is the exact reviewed core cargo, not a claim that every adjacent file was hashed by it.

A fresh-context builder must receive only the subsequently accepted cookbook/dependency inputs, not this oracle-exposed directory. All 140 paths remain in the reconstruction denominator. No implementation, tests, generator execution, provider calls or shared Git/journal writes performed for this review. No material amendment required for accepting the bounded audit.
