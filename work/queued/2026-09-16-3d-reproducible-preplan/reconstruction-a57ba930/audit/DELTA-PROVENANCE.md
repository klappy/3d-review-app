# Frozen release delta provenance and authority

This audit preserves app a57ba930 as evidence of what shipped. It does not make every shipped defect a requirement. All links below are immutable source or recorded scoped review; no new acceptance is inferred.

## Five shared operations

Frozen cookbook 36 `f30fc2cd8a4cf57761ce9560177b41506e98bb32`, `planning/2026-09-16-parity-build/prd/18-A-shared-link-contract.md:9–17`, defines issue_link, participant.open_link and response.form/submit/receipt. Authority is named A1/Auth/root dispositions5708270121/5708271276/5708292130 and final root app 26 comment 5709483693. App API supplier fc0bbc36 is not an ancestor of the release; applied integration ad95321 is. The integration tree also includes Auth, so whole-tree equality with API-only supplier would be a false claim. LINEAGE-CHECK.json preserves this distinction.

Actual producing implementation remains app-only: src/handlers/shared-link.ts, participant.ts, response.ts, survey.ts and five patched contract entries. Contract requires public anonymous HTTP entry, isolated random respondents, bearer-scoped own receipt, expiry/revoke denial, stable response identity, same-key/payload replay, different-key conflict and unique atomic response claim. Cookbook36:55–57 supplies detailed algorithm intent, but no maintained exact source module/projector. The source module imports common/error/receipt primitives; table rows in140-PATH-AUDIT.json record direct module inputs.

Exact0007 DDL is in cookbook 36:39–50, but leading comment/source serialization remains app-only. **Concrete contradictory instruction at cookbook 36:59:** integrated DBs must include0005_report_snapshot. Frozen app has0001–0004,0006,0007 and no0005. Root schema FIRE/postconditions accepted only0006/0007 remotely; local cold initialization requires0001→0002→0003→0004→0006→0007. Cookbook correction should date/scope supersession of that sentence; do not silently introduce report0005 or change shipped files. This is a cookbook defect, not a live migration regression.

## Auth and email-code CAS

Frozen cookbook 31 `2e8f76b48902b19bb52aa803102caacd661bacde`,18-D-mcp:62–81 and18-I-testing:49–68, records borrowed provider0.10.3/integrity, per-env provider factory, D1 OAuth redemption, PKCES256, validatedCSP, failclosedKV, five distinct namespace IDs, limiter unit ordering and residuals. Historical plan sections using0005 or wrong read-budget bounds are explicitly superseded by its later corrections. No historical/proposed residual becomes silently accepted just because it appears in a plan.

Auth release2315a828 is **tree-equivalent** to integrated 699ea513 but is not its literal ancestor; verified by Git objects. This matters for cookbook receipts and dependency pinning.

Final supplier befe794 separately corrected email login-code redemption in app src/handlers/platform.ts:48–49: guardedUPDATE `redeemed_at IS NULL`, then require `meta.changes===1` before minting. This differs from OAuth's new redemption table. `test/synthetic-owner-auth.test.ts:56` carries the overlapping-consume falsifier. Auth review[5709304834](https://github.com/klappy/3d-review-cookbook/issues/16#issuecomment-5709304834) accepts the race fix with expiry-roundtrip nit; exact protected-delta receipt[5709324338](https://github.com/klappy/3d-review-cookbook/issues/16#issuecomment-5709324338) confirms884c4c1 retains it. Frozen paired31 predates this CAS delta: catch-up must explicitly include its behavior, rationale, test and accepted nit. No automatic promotion of a competing larger fix46b96200.

## UI storage, recovery and R15

Frozen cookbook 36:63 records `shared:<SHA256(link token)>:` namespace, same-tab draft/key/receipt continuity and no automatic new context. Frozen copy 37 `41a4ee29c5f7e3c102b83576e3f3c40b7d3a5bc4`, design-system/copy.md:98–106, supplies closed/cannotResume/rateLimited/transient copy. It is essential copy, not canonical source for the entire shipped shell. The standalone design kit is a different artifact with different routes and stubs; it cannot stand in for ui/app.js/index.html/style.css/modules.

Supplier befe794 amended ui/shared-link.js:135–139 receipt-probe errors to distinguish unavailable/rateLimited/transient. Final 884c4c1 amended ui/app.js:375–380 no-fragment stale-bearer recovery: oneGET receipt; zeroPOST link; cannotResume; storage retained; global rawerror hidden for that path. Tests at test/shared-link-browser.test.ts:188,214,326 bind those branches. Independent Design[5709338664](https://github.com/klappy/3d-review-app/pull/26#issuecomment-5709338664) and Auditor[5709413538](https://github.com/klappy/3d-review-app/pull/26#issuecomment-5709413538)/[5709468595](https://github.com/klappy/3d-review-app/pull/26#issuecomment-5709468595) are the scoped acceptance, not proof of a later cold build.

Prior recovery PR18 cf143f3 contributed selected modules/tests/asset exclusions via a281c77; shared mode takes precedence over legacy globals. Whole app.js replacement from PR18 would erase the shared flow. Per-file last-touch and blob provenance is preserved in the ledger.

Known frozen residuals remain negative observations: raw CODE/message beside friendly submit/conflict copy; direct503/400 uncertain-outcome copy claiming not submitted; missing staff revoke UI; no separate respondent-count UI. Copy37:105 contains the misleading sentence, so copying approved essentials without residual classification would accidentally make a defect normative. The reconstruction must match frozen bytes/observations and separately carry desired behavior for future cookbook-defined versions. R15's corrected no-raw-code property does not magically apply to every submit path.

## Contract producer hazard

App tools/gen_contract.py:179 emits wall-clock generated_at; target capabilities.json:4 freezes2026-09-16T23:13:41Z. Exact output also depends on PyYAML version/serialization and originalmatrix0f441376. Lines134–171 never add final five params_schema/result_schema/shared_link_contract definitions. PUBLIC does not include public participant.open_link. Lines212–221 supply generic security/body instead of frozen concrete shared schemas. The global RATE_LIMITED enum **is already present** at generator:188; the audit does not claim it would vanish. Per-capability error additions and final shared amendment metadata are not generated by this loop. The description at:236 still says 79capabilities, while frozen release has 83. A future maintained recipe must encode reviewed bounded amendments and deterministic metadata explicitly; merely rerunning this old generator is unsafe for reconstruction fidelity.

## Tracked dist is separate historical cargo

All 4dist paths entered Git in ffa3111. README records2026-09-16T21:30:28.495Z; this is an embedded historical timestamp, not this audit clock. Source-map sourcesContent contains26app modules. Only 7match frozen release; all 26match source trees0542cf54 andfbc970c5, while24match the commit that first tracked dist. Historical config/lock inputs were retrieved locally; exact command/flags/platform/bundler timestamp handling still unknown. The old README timestamp is part of the byte target, not a new build time to invent.

This is **not a deployed-source regression**. Frozen manifest and actual Git/build/log/version receipts tie a57ba930 to build 3faa7906, deployed version 0fbd6782, deployment 677b3c1c. That Git hook builds current src/worker.ts; tracked olddist does not supply its entry point. Preserve all 4historical paths in the 140denominator. Later recipe needs a separately reviewed historical producer or an explicit unmet gate; never delete/normalize them to claim completion.
