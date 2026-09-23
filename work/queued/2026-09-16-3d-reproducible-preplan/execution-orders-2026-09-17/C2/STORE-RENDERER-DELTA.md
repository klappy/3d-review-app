# C2 store–renderer delta — proposed, not fired

Author: a8_inert_author. Actual planning START 2026-09-17 07:28:54 UTC. Scope: internal store integration and same-observation authorization/eligibility result only. Coordinator owns public/Auth/receipt/cursor/contract planning. This document does not authorize implementation, migration, route activation, provider changes or release.

## Observed exact inputs

- B2 dc9e6dc4a61056048f86c0ae898a775ca64b471a, clean `/tmp/3d-materialization-author`.
- C1 3d8dce056154d7c860344c1e7a3d8175f6680381, clean `/tmp/3d-report-renderer-author`; independent ACCEPT read from `/tmp/3d-c1-independent-review/INDEPENDENT-REVIEW.md`.
- Shared A3523f20ae5807a0f1d4a047352b62c3aa6d2dd82; B1ceeba19635421a70e84903b17fd4e1494eb9b5f7.
- Auth disposition5710531174, local `AUTH-DISPOSITION-5710531174.md`, especially Q1. Its final sentence retains independent B2/API review; it is not a FIRE.

B2 private descriptor is null (store:16), validator synchronous (12,99,117), get/build-result inner join `captured` (65–70), list starts from `captured` (71–83), and build uses B1's capture-only result (102–105). Those choices correctly withhold output but lose the distinction between invisible and authorized ineligible. C1 exports the actual renderer and version constants (renderer:10–12,106–112); it does not export a validator for arbitrary stored payloads. TypeScript's inferred payload type is not runtime validation.

## Smallest integration and exact custody

After independently accepted combined base containing the exact ingredients above, proposed author-owned paths are exactly:

1. `src/synthetic-report-store.ts`: compiled descriptor, awaited validation, authorization marker query projections and bounded result types.
2. `test/synthetic-report-materialization.test.ts`: retain B2 attack/SQL/immutability evidence; adapt exact private test substitution to the reviewed compiled descriptor and new result distinctions.
3. `test/synthetic-report-integration.test.ts` (new): real C1/D1 roundtrip, payload corruption, marker/linearization and resource measurements.
4. `docs/synthetic-report-boundary.md`: actual wired internal boundary, marker/result types, real tuple and remaining release gates.

No edit to A, C1 scoring/narrative/labels/model, B1 capture producer, migrations0008, handlers, policy, receipt, contract, packages, seeds or provider settings. Exact canonical equality to trusted C1 output makes a separate schema module unnecessary. The existing REPORT_CAPTURE_CTE is sufficient: `target` preserves authorization independently of `captured`. If inspection during implementation proves a shared producer edit necessary, stop for an exact scope amendment; do not silently widen these four paths. Integration of accepted ingredient commits is an explicit base preparation step by coordinator, not duplicate authorship of their files.

## Private descriptor and real payload validation

Keep one private compiled descriptor; no registration, setter, arbitrary caller payload, environment toggle or public renderer endpoint. Bind:

|Tuple field|Exact value/source|
|---|---|
|sourcePin|A trust f042cde553761a6a7f24132cef7802f956378ee0|
|indexRoot|A trust d964f81639e0929ce5f53156b28e3902732b98d2394c6d8dc31c9d14a22fb7dd|
|scorerVersion|C1 REPORT_VERSIONS.scorer = steve-f042cde-single-assessment-v1|
|narrativeVersion|C1 REPORT_VERSIONS.narrative = steve-f042cde-rule-narrative-v1|
|policyVersion|C1 REPORT_VERSIONS.policy = synthetic-current-assessment-asof-query-v1|
|outputSchemaVersion|C1 REPORT_SCHEMA = 3d-synthetic-assessment-report-v1|

Render invokes `renderSyntheticReport(c.assessmentId,c.rows)`, requires eligible and exact returned captureDigest equality, and returns its payload. Store still canonicalizes/bounds/hash-checks its own bytes. Validation changes to boolean-or-Promise<boolean>, with both call sites awaited. Private pure `validateSyntheticReportPayload(payload,capture)` inside the store module rerenders the **original stored attested capture**, requires exact captureDigest equality, then compares bounded A canonical JSON of parsed stored payload with C1's canonical `payloadJson`. It catches refusal and returns false. This validates every exact key, type, null, source/version/assessment identity, numeric value, order and narrative string against an actual valid C1 output; it is stronger than a hand-written shape-only validator. Unknown extra fields, omitted fields, wrong but well-typed scores, wrong source/version and rehashed forged narrative all fail. Original JSON whitespace remains covered by B2's exact raw hash and commit determinism check; semantic canonical equality does not weaken those checks.

Do not use the fixture's 1e-8 cross-language tolerance for stored data. Same JS renderer/version must reproduce exact canonical bytes. Do not compare a stored report with a new current capture: accepted known append preserves the immutable original report while current eligibility remains separately checked.

This proposal deliberately pays for rerender validation, including up to six original renders plus the current attestation on list. All build/read/list paths reach awaited validation; no truthy Promise may count as success. Initial implementation has no cache. Any later bounded per-operation deduplication must key on the exact original capture and stay within that same observation; no cache across observations, actors or requests and no trusted prior validation bit. Build also performs validation; removing duplicate work would require an explicit measured, independently reviewed optimization. C1's own A attestation is retained. Real tuple report-key vectors must be independently recomputed; marker vectors remain test-only. These ingredient versions do not assign a product release version.

## Same-observation marker — proposed exact internal boundary

Introduce `EligibilityMarker = {assessment_id:string, eligible:boolean, policy_version:string}` and a discriminated result: success with the existing internal value; `HELD` with **only** that marker; `NOT_VISIBLE` with no marker; existing operational `UNAVAILABLE`, `CONFLICT`, `DETERMINISM` with no report data. Public mapping of operational failures and fixed held reason belongs to coordinator/Auth. Never return a held report ID, response ID/count/hash, cursor, timestamp, label or partial page.

Use the unchanged target predicates (unarchived assessment, user/support with actual exact assessment grant, member for build, viewer-or-higher for read/list). Anonymous/participant/support-without-grant yield no target. Existing report-ID target lookup gives no target for unknown report IDs. No separate authorization or existence read is added.

Proposed SQL projection changes, each still one authoritative SELECT:

- Build observation/dry-run helper: REPORT_CAPTURE_CTE plus `SELECT t.id AS assessment_id,c.capture_json AS current_capture FROM target t LEFT JOIN captured c ON c.assessment_id=t.id`. Five bindings, rid null, server-owned member minimum. B1 SQL bytes remain unchanged. No row -> NOT_VISIBLE; target-only row -> held marker. Eligible capture is held internally for build; dry-run returns only the three-field marker.
- Get: start from `target t`, LEFT JOIN `captured c`, LEFT JOIN the exact selected immutable report m. Target itself already requires that exact report to exist under t. Project target aid independently of m/c. Missing c yields a held marker; row with c passes strict A/current and stored validation. Unknown/ungranted/archived yields no row -> NOT_VISIBLE.
- List: retain bounded page CTE but anchor outer SELECT on target and LEFT JOIN captured/page. Target-only sentinel must survive ineligibility; captured-with-no-page sentinel remains eligible empty-list success. All six candidate originals remain validated before returning any page. No totals or excluded-row metadata.
- Build result: same target-first projection with key-restricted report LEFT JOIN. No target after write -> NOT_VISIBLE. Target with ineligible capture -> held. Target with eligible capture but no exact attempted key -> CONFLICT. Exact matching stored row still requires all existing identity/hash/raw-byte determinism checks. Never substitute the earlier pre-insert observation.
- INSERT remains unchanged: exact granted current captured token equals bound original bytes, ON CONFLICT only exact (assessment_id,report_key), immutable rows. This proposal adds no write based on marker alone.

The SQL observation establishes existence/grant and captures the exact candidate raw data, not A's cryptographic eligibility by SQL fiat. Final eligible boolean is computed by strict A/C1 validation over that **immutable same SELECT result**, with no second database read. Marker policy comes from compiled C1 policy; it cannot be supplied by caller or stored report. A malformed/mixed/unknown/empty capture or invalid stored payload returns the identical held marker; infrastructure query failure remains UNAVAILABLE, never manufactured authority. This two-stage same-observation interpretation needs explicit independent acceptance against Auth Q1's wording “derived inside the one query/observation”; a SQL non-null capture alone MUST NOT be called eligible.

Suggested internal public-facing seam: `observeBuildEligibility(ctx,aid)` -> `{ok:true,marker}` or NOT_VISIBLE/UNAVAILABLE. Its marker has no captured token, rows or digest. Store's private build observation can retain the attested capture internally. It does not promise eligibility will persist until execute: guarded INSERT and fresh post-insert SELECT remain authoritative. A handler must not call an additional gate/read to manufacture the held marker.

## Executable local verification

Using the unchanged lockfile and disposable local Miniflare D1 only:

`npm exec vitest run test/synthetic-report-boundary.test.ts test/synthetic-report-materialization.test.ts test/synthetic-report-renderer.test.ts test/synthetic-report-integration.test.ts`

`npm run typecheck`

1. Materialize/get/list all34 gold assessments, covering425attested rows; payloads exactly equal C1 output and source fixtures already accepted by C1. Repeat commit yields same row; tuple/key/hash independently checked. Known append yields new key while old payload remains unchanged and readable.
2. Corrupt stored payload while recomputing raw SHA: extra/missing keys, wrong assessment/source/schema/version, changed numeric score/narrative/order/null, injected respondent field. Read/list hold with marker only; no partial page. Unsupported stored tuple also holds. Strict duplicate-key/raw-parser attacks retained.
3. Exercise exact actual D1 statements/bind counts (observation5, INSERT18, get5, build-result6,list7 unless review explicitly amends); missing bind refuses. Preserve byte-identical shared CTE and INSERT guard. Test eligible empty list separately from ineligible target sentinel and invisible target absence.
4. For build observation/get/list/post-write read, mutate grant/archive/answers immediately before versus after the SELECT. Returned marker/result must match that single observation; trace proves no second grant/existence query. Grant-free support, participant, unknown assessment/report, revoked/archived target all have no marker. Authorized real/mixed/unknown/empty/malformed captures have identical three-field held marker. Adversarial stored-row corruption cannot leak IDs/count/cursor through held result.
5. Preserve B2 before-INSERT membership/grant mutations, after-write loss, concurrency uniqueness, trigger immutability, negative stale-return and missing-token-guard controls. Adapt marker tests without replacing runtime behavior beyond the single private descriptor declaration. Real integration tests use the unmodified compiled descriptor.
6. Exercise full five-plus-lookahead page including corrupt sixth row and valid empty terminal page. Measure resource consumption for real render and strict validator on build/get/list, plus near-bound malformed captures/payloads. Do not accept maximum gold payload as worst-case bound.

## Resource evidence required before integrated release

Local candidate work may proceed only under separately accepted local-authoring exception. Effective account/Worker/D1 limits remain a prerelease gate, not established here. Preserve prior failure/bounds: B2 raw selected fields1,111,298bytes and JSON-serialized row2,172,407bytes at two524,288byte fields; local success does not prove provider transport acceptance. C1 corpus max4,882bytes is an observed dataset maximum, not an adversarial/report-schema maximum. B2 old page measurements do not include real renderer validation cost.

Measure actual Worker isolated CPU/peak memory and transport under exact integrated versions/config: cold A root verification and module startup; warm/cold build (render+validate+postwrite validate); get; six-row list with original captures+one current capture; refusal at accepted bounds; pathological JSON escaping; DB query duration/rows read, selected raw-row bytes versus serialized transport bytes, request response bytes and compressed bundle. Preserve at most6rows,524288capture/payload caps,425membership cap and actual binding/query-size evidence. Identify effective CPU configuration/entitlement rather than inferring from local wall time or usage_model. A's100ms initialization ceiling remains unchanged and separately measured. Do not present Vitest/Node aggregate RSS as Worker peak memory.

If measurements require changing page size, validation strategy, byte limits, schema or policy/version, return an amendment for independent review; no silent relaxation or caching authority. No provider measurement/deployment is authorized by this planning document.

## Availability and later implementation estimate

I am available as the single internal store/renderer integration author after a separately reviewed exact order and FIRE. Honest proposed authoring plus own-test budget: **2–3 active hours**, first measured checkpoint within **30 minutes**. Excludes coordinator base preparation, independent review, public/Auth implementation and effective-platform release proof. This is a new C2 scope, not a reset of completed B2's history.

First checkpoint: saved local diff of compiled tuple/async validator and target-first query variants; actual D1 bind/read results proving eligible-empty versus held versus invisible; one real rendered roundtrip or exact failing boundary; initial timing observations and remaining estimate. Candidate completion requires the full local tests above and immutable input preservation. Coordinator owns public transport/confirmation/receipt/cursor and root owns FIRE/shared publication. No such integration was implemented during this planning pass.
