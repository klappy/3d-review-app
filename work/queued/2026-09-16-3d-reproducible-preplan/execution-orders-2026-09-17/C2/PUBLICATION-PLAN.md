# Ingredient publication — root scope required, no push performed

A already has draft app PR28 at 3523f20. Preserve it; no duplicate A PR.

B1+B2 are a linear continuation of A, exact tip dc9e6dc4a61056048f86c0ae898a775ca64b471a. Proposed branch `report/materialization-boundary-20260917`, draft PR against A branch `report/attestation-utility-20260917` so the review delta excludes A. Label disabled private store, no public readiness, unresolved platform gates. Include independent B1/B2 receipts. Root may instead choose one consolidated final reporting PR; do not create redundant queue inventory merely for utilization.

C1 exact tip 3d8dce056154d7c860344c1e7a3d8175f6680381, parent A3523. Proposed branch `report/source-renderer-20260917`, draft PR against the same A branch, nine-path reviewed delta. Include independent C1 receipt, no public report claim.

Before any push: root explicitly names chosen scope/branches, inspect remote refs/PRs for existing custody, fast-forward/create only exact reviewed commits, no force, read back exact head/base, request ordinary Bugbot and record actual checks. Publication is not merge, deployment or acceptance of the final combined application. Root owns final integration and protected main merge.
