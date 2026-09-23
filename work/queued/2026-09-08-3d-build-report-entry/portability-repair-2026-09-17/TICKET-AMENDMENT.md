# Reporting source-reader portability repair — existing report-entry amendment

**What this is:** Remove the observed Python SQLite dependency from offline recovery of hash-pinned template sources.
**Why now:** Main65d36c49 Git buildabc78270 failed before deployment; runtime report acceptance cannot proceed on prior DEV328b.
**Your move:** Root records and fires this independently reviewed correction after the gates below; no captain decision or broad product work is requested.

Class: entrée (revision to accepted attestation plan). Risk: STANDARD — isolated reversible code, synthetic inputs, no remote state. Station: subagent.
Owner: /root/release_recovery_coordinator/portability_author. Coordinator: /root/release_recovery_coordinator. Independent reviewer: /root/release_recovery_coordinator/portability_plan_challenge. Root owns shared Git journal, publication and integration.
Promise: author's actual readiness ACK25–35active minutes after explicit FIRE; checkpoint10. Reviewer actual ACK10–15active minutes plus actual test duration after complete candidate. Neither clock has started; budget never silently resets.
Depends: original accepted report-entry attestation inputs and merged main65d36c49; independent amended-plan acceptance; root Git landing/readback and FIRE. Existing report-entry ticket at rail/1-ordered/2026-09-08-3d-build-report-entry is amended, not replaced. No Auth/Design/Grok dependencies are reassigned.

## Exact inputs and two-path custody

App base65d36c49ccf92c388ca98829dd755c86a22a4c4b, tree528ce350b2ddca9e420a502534d927eff636fc90. Reverify before checkout. Planning author attribution and prior probes remain /tmp/3d-attestation-portability-plan/PLAN.md and accompanying SOURCE-PINS.json, corrected LOCAL-CAPABILITY-EQUIVALENCE-DEFAULTS.json, MIGRATION-EQUALITY.json. Failure and metadata records: /tmp/3d-report-dev-deployment-proof/READOUT.md and /tmp/3d-report-dev-metadata-preflight/FINDINGS.md. Remote facts in these records are attributed and timestamped; no fresh provider mutation/probe is claimed.

Only editable product paths:
1. tools/build-synthetic-attestation.ts — replace child_process/Python SQLite source reconstruction with Node built-in DatabaseSync(':memory:'); execute identical hash-pinned0001–0004SQL in identical order; same six-column SELECT version2 ORDER BY id; ordinary foreign-key defaults; close in finally. Normalize native row objects through JSON transport if needed to preserve original plain objects. Preserve all digests, manifest/source identity, strict parsing, record counts, downstream canonical/trust checks and output bytes.
2. test/report-attestation.test.ts — focused real fault regression below and stale comment correction only; preserve every existing assertion and independent425tuple committed SQL-literal Python decoder.

No package/lock/config/CI, migration/seed/fixture/source pin, trust/index, renderer/runtime/auth or provider changes. No provider install, deploy or manual retry. Existing Python literal-only decoder stays; this does not remove all Python use.

## Regression amendment from independent review

The original proposed namespace child_process spy is superseded: independent Vitest2.1.9 probe throws Cannot redefine property, so it is not a runnable regression. Add one ordinary non-concurrent test in the existing test file. Create disposable directory and sqlite3.py raising ImportError('PORTABILITY_SQLITE_UNAVAILABLE'); save prior PYTHONPATH, prepend shim using platform path delimiter; assert actual python3 -c import sqlite3 fails with the marker. Then call real readPinnedSources and compare all nine template rows/all six fields to baseline sources.templates, with425records. In finally restore prior PYTHONPATH exactly (delete if undefined), remove temp directory. Do not mock source data, change beforeAll, or use concurrent test. Author proves RED on disposable original generator and GREEN on candidate; old failure may occur in the focused test, while separate whole-process shim demonstrates prior collection failure. Preserve full-suite environment restoration.

## Required evidence and done-means

1. Reviewer can inspect an isolated checkout and observe exact65d36 ancestry, runtime versions and only the two allowed tracked paths changed.
2. Reviewer can regenerate to a temporary file and observe bytes identical to committed index, unchanged indexRoot/trust,9templates/111items/425entries/34cycles/301required omissions/659optional nulls.
3. Reviewer can run both formerly failing suites and observe every existing assertion enabled, independent425tuple literal oracle intact and new regression oldFAIL/newPASS.
4. Reviewer can run normal Node24 typecheck/full npm test, and full npm test under disposable PYTHONPATH sqlite3-failure shim with failing Python import control, observing pass counts and any pre-existing skips explicitly. No new skip or threshold relaxation is allowed. Local shim is a missing-module model, not provider equivalence.
5. Root can inspect independent exact-candidate review, real exact-head Bugbot SUCCESS and all attached finished checks before normal protected merge; no self acceptance or fabricated check.
6. Root can observe actual Git-hook build success/deployed identity before authorizing separate Auth report runtime acceptance. Local proof does not claim DEV readiness or production authority.

Return local patch/commit, complete commands/logs, identity hashes, tracked diff, DEBRIEF and explicit residuals. Implementation worker does not publish/merge; root owns those boundaries. Recipe remains prior PLAN.md plus this superseding regression and custody amendment.

## Borrow evaluation

| Step | Verdict | Evidence/reason |
|---|---|---|
| Borrow | applied (planned) | Node public built-in node:sqlite DatabaseSync; observed Node22.16 and24.19 parity; actual provider24.18 import remains downstream build gate. No external package manifest addition applies to a built-in. |
| Bend | applied (planned) | Existing offline adapter executes pinned SQL and same SELECT; JSON transport normalization preserves plain-object shape. |
| Break | observed | Actual provider Python3.13.3 lacks _sqlite3; native module namespace spy is non-configurable in Vitest2.1.9. |
| Beget | delegated | Sole author portability_author; distinct reviewer portability_plan_challenge. |
| Bide | skipped | Available built-in independently executes all nine templates; waiting for provider Python repair prolongs current blocked build without need. Miniflare already in repo is larger lifecycle for offline nine-row recovery. |
| Build | minimal | Two-path adapter change and fault regression only; no SQL parser or new lifecycle. |

Reversibility: forward = low; backward = low. A two-file revert is mechanically simple but would restore the known build failure; no remote rollback is implied.

House prior art: repository inventory listed klappy projects; fresh GitHub code searches for node:sqlite in3d-review-app and oddkit returned no results. Reuse the existing generator and pinned schema; prior original attestation prior-art record remains attributed, not re-run. Node official SQLite API is the named upstream substrate in original plan and independent local capability probes.

## Failure Modes — What Breaks When Portability Masks Fidelity

Different source rows/bytes; broken regression or leaked environment; lost literal oracle; skipped test/cost relaxation; stale base/path collision; local proof called deployment; broader change needed.

## Required Response When Detected

Return AMEND with exact discrepancy; fix regression and prove original failure; preserve oracle; fail without threshold/skip edits; reobserve/reconcile before editing; keep runtime acceptance pending; stop affected work for bounded amendment. Do not widen custody to force green.
