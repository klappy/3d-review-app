# C2a current internal store boundary

C2a assembles accepted B2 `dc9e6dc4a61056048f86c0ae898a775ca64b471a` and C1 `3d8dce056154d7c860344c1e7a3d8175f6680381` on local union `1c2423d2a55526cf8cec19d50a21848cf55a9cec`. The internal store now uses the private compiled real renderer. It still exposes no public route, activation flag, caller-supplied payload or renderer registry. The B1 and B2 sections below are preserved historical ingredient evidence; C2a supersedes B2's null-descriptor and undifferentiated-HELD behavior. B1's standalone API and shared SQL producer remain unchanged.

`observeBuildEligibility(ctx, assessmentId)` returns exactly `{ok:true,marker:{assessment_id,eligible,policy_version}}` for a visible member-scoped observation, including `eligible:false` when ineligible. Its failures are `{ok:false,reason:'NOT_VISIBLE'|'UNAVAILABLE'}`. It never returns HELD or a capture token. Operational build/get/list return `{ok:true,value}`, `{ok:false,reason:'HELD',marker:{assessment_id,eligible:false,policy_version}}`, or a marker-free `NOT_VISIBLE`, `UNAVAILABLE`, `CONFLICT` or `DETERMINISM`. No held result carries report IDs, counts, hashes, cadence, labels, cursors or partial pages. Context identity comes from the authenticated server, not operation parameters. Anonymous/participant, grant-free support, unknown/revoked/archived scope stays invisible. Invalid internal operation parameters also disclose no marker; public input validation is C2b-owned.

Each observation SELECT starts from the existing exact-grant `target` and LEFT JOINs `captured`, preserving a target-only sentinel. The assessment ID comes from target, never a nullable report. The same returned capture bytes undergo strict A validation after SQL; SQL non-null is not cryptographic eligibility. No second grant/existence query manufactures a marker. Get target resolution includes the exact report ID; unknown report IDs therefore remain invisible. Eligible empty pages remain successful empty lists, distinct from authorized-ineligible sentinels. A current mixed/unknown/mutated capture holds the entire page. The preview also invokes the trusted renderer over the attested observation before saying eligible.

Build obtains the observation, then uses the unchanged guarded INSERT and mandatory fresh post-write SELECT. The earlier marker authorizes neither step. A post-write lost target is NOT_VISIBLE, an ineligible target is HELD with its fresh marker, and an eligible target without the exact attempted report key is CONFLICT. An internal malformed capture token or renderer/validator failure before an authorized result observation returns UNAVAILABLE without inventing a marker. Direct commit is internal only. A write may have succeeded even when its response is unavailable; no automatic retry occurs. Same-capture retries converge through the unique key; a known changed capture can legitimately produce a second immutable row, so it is not promised as recovery of the first report.

The real tuple uses A source `f042cde553761a6a7f24132cef7802f956378ee0` and root `d964f81639e0929ce5f53156b28e3902732b98d2394c6d8dc31c9d14a22fb7dd`, C1 scorer `steve-f042cde-single-assessment-v1`, narrative `steve-f042cde-rule-narrative-v1`, policy `synthetic-current-assessment-asof-query-v1`, and schema `3d-synthetic-assessment-report-v1`. These are ingredient identities, not a product release assignment. The independently specified first gold report key is `68b602d11a77162f72320c43827d30d33ed9f95fca9dfe5cb07f18905176a52d`.

The asynchronous validator freshly invokes C1 against the **original attested stored capture**, requires equal captureDigest and compares exact bounded canonical payload bytes. All validation call sites await it. There is no tolerance, schema-only shortcut, cache or mutable label lookup. This checks exact fields, types, nulls, array order, scores and narrative. It preserves the existing raw payload hash and commit-byte determinism check. A known append can leave an old report readable without rerendering it against new inputs. List validates all originals including the sixth lookahead before releasing any summary. Each original requires both its A validation and C1's own attestation/render, plus one current A validation for the page.

## C2a local verification and remaining resource gate

```sh
npm exec vitest run test/synthetic-report-boundary.test.ts test/synthetic-report-materialization.test.ts test/synthetic-report-renderer.test.ts test/synthetic-report-integration.test.ts
npm run typecheck
```

The existing marker tests substitute exactly the private compiled descriptor declaration with their test-only descriptor; every other store/query byte is preserved and transform hashes are emitted. They now exercise an asynchronous false validator to catch unawaited Promise acceptance. The new integration tests use the unmodified real descriptor, all34assessments/425trusted responses, exact C1 bytes, independent key vector, rehashed semantic forgery, target-only/empty/invisible distinctions, before/after SELECT barriers, post-write changes, uncertain commits and real six-row pages. Existing B1 source fidelity and C1 independent-source fixture tests run together; prior isolated passes are not substituted for this combined run.

A admits at most23distinct responses for one existing assessment in this pinned425-row corpus. The425response parser bound remains for malformed refusal; no fictitious425valid-row assessment is claimed. Largest observed full-group payload is4,882bytes. Subset combinations may differ; the full-group maximum is not an exhaustive worst-subset bound. Actual D1 binding counts remain observation5, INSERT18, get5, post-write6, list7. Largest query is5,386UTF8bytes. Shared CTE, B1 literal and guarded INSERT are unchanged.

Initial local real six-row page:1,096,582serialized bytes, maximum row184,741bytes,487.7ms wall time. Six adversarial stored capture/payload pairs at their respective524,288byte ceilings:13,125,577serialized page bytes, maximum row2,187,595bytes; local D1 returned them and validation released only a held marker. This extends the retained historical2,172,407byte malformed-row evidence below. Do not represent raw-field limits as serialized transport limits. Values vary with randomly ordered immutable IDs and subset membership; final candidate evidence records fresh measurements.

Those are Node/Miniflare local wall times and byte counts, not isolated Worker CPU/peak memory or effective provider entitlement. Effective runtime CPU/memory, D1/transport limits, cold initialization and actual integrated resource margins remain mandatory before release. No cap is relaxed by this ingredient. A's100ms initialization ceiling remains separate from operation wall time. Public/Auth confirmation/receipt/cursor integration, independent combined review, exact-head checks, Design acceptance, separately fired DEV0008 rollout/deployment and authenticated DEV journey remain pending. Production is excluded.

---

# B1: complete synthetic capture and strict attestation adapter

This ingredient captures a complete assessment input from one guarded local-primary D1 SELECT and passes it to the independently reviewed attestation utility. It creates no report table, report payload, route, cursor or public API. It is not a report, disclosure-store implementation or production-readiness claim.

Base: attestation candidate `3523f20ae5807a0f1d4a047352b62c3aa6d2dd82`, parent `a57ba930ced3c23616982c7dab291949b75a3b8a`. The embedded `B1_CAPTURE_SQL` is byte-for-byte the reviewed table-free statement with SHA256 `8e3f51e2f5cb7350c2a7824e5a78c91c64fb17a1966d79b9fe3f064c711598c6`. It retains five positional bindings. Binding 2 is always null; binding 5 is the server-owned `member` minimum. The absent `synthetic_report` table is never referenced or created.

## Internal interfaces

- `captureForBuild(ctx: Pick<Ctx, 'db' | 'principal'>, assessmentId)` obtains the authorized capture. `ctx` comes from the existing authenticated server boundary, never directly from request-supplied principal data. Exactly one prepared SELECT is issued; subsequent parsing/hashing uses only its captured strings.
- `decodePackedCapture(expectedAssessmentId, raw)` validates the bounded packed envelope and returns frozen `CaptureRow` values. It does not authorize anything and does not by itself attest the result.
- `attestPackedCapture(expectedAssessmentId, raw)` validates the envelope and passes the exact raw answers/templates to A. This is an internal adapter, not an authorized database read. Future disclosure code must establish its own single-query authorization/completeness boundary before calling it.

The capture operation and attestation adapter return either `{eligible:true,capture}` or `{eligible:false,reason}`. The capture contains `assessmentId`, the exact `packedCapture` concurrency token, frozen `rows`, sorted frozen `responseIds` and `captureDigest`. Reasons are bounded `HELD` (invalid/unknown/ineligible/ungranted) or `UNAVAILABLE` (database failure). No underlying error text is logged or returned. These are internal shapes; no public error/receipt contract is established here.

The packed token is a concurrency token, not A's canonical digest or a report version key. It contains the original raw strings and must not be disclosed through logs/errors. A future guarded write must revalidate its own current permission and token equality. A prior eligible capture alone cannot authorize a later write or disclosure.

## Boundary and fidelity

The one SELECT requires an unarchived assessment and an exact assessment owner/member grant for an authenticated user or support principal. Support has no bypass; project/workspace roles do not inherit. Public code cannot supply the minimum role or report lookup. Unknown and inaccessible assessments produce the same held shape.

Membership includes every response whose survey belongs to the target, including archived surveys. It does not filter by synthetic labels, ID prefixes, successful template joins or answer validity. A global integrity predicate refuses if any response lacks its survey, survey assessment, response template or selected template. This conservative predicate prevents orphan corruption from silently reducing a capture. Selected/response template disagreement also refuses. Empty or oversized membership refuses; enumeration is never truncated to make attestation pass.

SQL packs ordered response and deduplicated template arrays. It preserves `answers_json` and `items_json` as strings without parsing their contents. The adapter parses only the bounded outer envelope, validates exact tuple arities/types/associations and rejects extra/duplicate/unused dictionary entries. Object-valued fields are forbidden. It constructs the exact template preimage by encoding scalar metadata and embedding unchanged `itemsRaw`; A then applies strict raw parsing, including duplicate decoded keys. No ordinary parse/reserialize step can erase duplicates in answers or items.

Limits: 425 responses, nine template identities, 8,192 raw answer bytes, 65,536 raw items bytes, 65,536 bytes for the complete template preimage, 524,288 packed bytes, 256-byte primitive metadata and 128-byte submitted timestamps. Whole-template wrapper overhead counts. Existing A depth/string/collection bounds still apply inside each answer/template. Identity, not mutable display labels, determines eligibility. All 301 historical required-answer omissions remain accepted through the unchanged A corpus.

Authorization and membership linearize at the SELECT. A grant/archive/input change before that observation refuses; a change after it cannot retract the captured observation, but the next call sees the change. This is as-of-query semantics, not instantaneous revocation. No second independent database read is described as the same snapshot.

## Reproduction and observed evidence

Use the existing lockfile/toolchain with Node 22.16.0. Tests use actual Miniflare local D1, existing migrations 0001–0004/0006/0007 and committed synthetic fixtures only. No remote binding, credentials or report migration is used.

```sh
npm ci --ignore-scripts
npm exec vitest run test/synthetic-report-boundary.test.ts
npm run typecheck
```

The test emits `B1_MEASUREMENTS` with every assessment's count/packed size. Observed coverage: all 34 assessments and 425 responses attest. Maximum packed capture: 74,796 bytes; complete template: 24,220; answer: 795; JSON-serialized D1 result row: 89,696. SQL is 4,690 UTF-8 bytes with five bindings. Four bindings produce an actual local-D1 error; the wrapper always supplies the reviewed five.

Twelve targeted tests cover that corpus, actual binding arity/table absence, exact grants/support restrictions, archived/empty/mixed/wrong-template inputs, preserved duplicate raw keys, outer shape/size/count refusals, and bounded D1 failure. Deterministic barriers cover grant loss, assessment archive and answer mutation before/after the SELECT. Temporary orphan corruption is injected and restored inside local D1 batches using deferred FK checking; the exact schema is retained. Removing the global predicate as a negative control incorrectly releases an otherwise valid capture, while the production query refuses all four orphan kinds.

Local timings are harness wall-clock measurements including the local D1 bridge and JavaScript attestation, not Workers CPU. The final recorded corpus run had median 30.94 ms and maximum 96.97 ms; an earlier first run reached 303.90 ms. These observations are retained, not converted into a platform acceptance claim. Account effective CPU allowance, worker memory/CPU, worst admitted integrated report/page costs and production runtime margins remain required before integrated release under the reviewed B1 exception.

## Remaining gates

Independent exact-candidate B1 review is still required. B2 store/immutability/get/list, renderer/version/schema integration, contract/confirmation/cursor projection, public routes/UI, actual effective-runtime acceptance and additive DEV rollout remain separately gated. No migration reservation is exercised here. Changes to A's utility, Auth, seeds, packages or existing source are outside B1 custody. Cookbook authority concerns semantic conformance; this SQL is a reviewed implementation choice, not a permanent required architecture for all future builds.

# B2: local immutable store candidate, production renderer disabled

B2 builds on independently accepted B1 `ceeba19635421a70e84903b17fd4e1494eb9b5f7`. It adds the reviewed additive `0008_synthetic_report.sql` table/index/immutability triggers and an internal store. That migration is applied **only to disposable local test D1** here; reservation/publication is not remote rollout authority. It does not depend on historical `0005`, modify `0006`/`0007`, install a renderer or expose any handler.

Production contains one private `APPROVED_RENDERER` constant set to **null**. Build, commit, read and list all fail closed while it is null. There is no exported renderer setter/factory, registration mechanism, request-supplied rendered-product argument or activation setting. Future C integration requires a reviewed compiled descriptor with its source/index/version tuple, deterministic renderer and strict capture-bound output validator. Replacing null is a later code change, not permission supplied by this candidate.

## Internal store operations and observation points

- `buildMaterialized(ctx, assessmentId)` captures through B1, then calls the guarded commit path.
- `commitMaterialized(ctx, assessmentId, captured)` reattests the original raw token and renders internally through the compiled descriptor. It ignores asserted digest/row eligibility on a supplied object; it accepts no arbitrary rendered JSON. This internal entry supports an existing capture, not a public API.
- `readMaterialized(ctx, reportId)` resolves report-to-assessment, exact grant, archive state and complete current input in one SELECT.
- `listMaterialized(ctx, assessmentId, afterId, pageSize)` accepts a validated internal ID and size 1–5, fetches up to one lookahead and validates the entire selected page. It exposes no total or payload in summaries. `afterId` is **not a public cursor**; authenticated/encrypted principal/assessment/version/expiry-bound transport cursors remain a separate C contract.

Internal success is `{ok:true,value}`. Bounded failures contain only `HELD`, `UNAVAILABLE`, `CONFLICT` or `DETERMINISM`, never an attempted report ID, count, answers, labels or database message. Public mapping, consent, receipts and error semantics remain contract-owner work. A withheld/failed build result does not mean that no immutable row was committed.

The table-free B1 query remains byte-identical. One shared producer reuses all its grant/integrity/bounds/packing predicates, restoring only the independently reviewed report-ID target for store statements. Actual bind arities are capture 5, commit 18, get 5, build-result 6 and list 7. `INSERT … SELECT … ON CONFLICT(assessment_id,report_key) DO NOTHING` checks a fresh member grant, nonarchive and exact raw current-token equality. Unexpected SQL constraints/failures do not become duplicates. Every commit, including a no-op duplicate, is followed by a fresh authorized build-result SELECT and full stored/current validation before returning any metadata.

Report identity hashes the exact accepted `3d-materialized-report-key-v1` preimage with domain `3d-materialized-report-v1` plus a zero byte. It includes original capture digest, assessment, source pin, attestation index root and all four approved semantic versions. It excludes actor/time. Payload hash binds exact UTF-8 bytes. A same-key row with different exact payload bytes is a determinism failure; it is never updated or silently reused.

Get/list reattest stored and current captures independently, bind the original digest to the stored digest, compare source/index/versions with the compiled descriptor, recompute the full report key and verify exact payload hash/size/schema. The output validator also binds output identity to the original attested capture. A known synthetic append can preserve old output and permit exact duplicate recovery; unknown, mixed or mutated current inputs suppress access. Recomputing a payload's self-hash does not bypass schema/identity checks. These unkeyed hashes do not prove integrity against an administrator able to rewrite the database and application authority together.

Read/list disclosure linearizes at their one primary SELECT. Changes before it refuse; changes afterward affect subsequent calls without retroactively retracting the captured result. List attests the common current token once only after confirming each returned row has the same token; it validates every original capture, including lookahead. One bad selected row suppresses the whole page. The authorized-empty sentinel takes its assessment ID from the authorized capture, not a nullable report field. No cross-request eligibility cache is used.

## Local marker tests and measurements

```sh
npm exec vitest run test/synthetic-report-materialization.test.ts test/synthetic-report-boundary.test.ts
npm run typecheck
```

Tests use existing esbuild to bundle the same store source with exactly one asserted substitution of the private null declaration. The marker and transform live only in the test file and temporary output. A reversible textual comparison proves that no SQL/store/validation algorithm changed; `B2_MARKER_PROOF` emits source/descriptor/transformed hashes and replacement count. A separate test calls the unmodified production module and proves all operations refuse without querying. No temporary marker bundle is committed or deployed.

The pinned test tuple uses `test-marker-scorer-v1`, `test-marker-narrative-v1`, `test-marker-policy-v1` and `test-marker-output-v1`, with A's exact source pin/root. Its only output fields are schema, assessment ID, capture digest and sorted response IDs, all bound to the attested original capture. A separate scorer-v2 bundle proves version identity change and rejection of an unknown old tuple. Neither is a real report renderer or a production version assignment. An independently calculated Python SHA-256 vector checks the first gold capture's complete report key.

Local tests cover same-key concurrency, immutable triggers, forced constraint rollback, capture changes before insert, authority loss after insert, exact duplicate recovery after known append, get/list scope and as-of-query races, every stored identity/version field, recomputed corrupt payload hashes, full-page/lookahead refusal, empty-page identity and byte ceilings. Removing the commit equality guard writes an unintended inconsistent row; supplying a stale read bypasses current archive state. Those negative controls fail the same safety oracles that the real implementation passes.

Actual local D1 accepts all five binding variants; insufficient binds fail. The largest SQL is 5,363 bytes and the maximum parameter count is 18. A six-row marker page measured 886,159 JSON-serialized bytes, maximum row 150,351 bytes. These are marker/gold measurements, not real-renderer worst cases. `B2_PAGE_MEASUREMENTS` records local D1 metadata, query walltime and a Node memory sample; the sample includes test harness, fixture and bundle overhead and is neither peak isolated Worker memory nor Worker CPU.

A deliberately malformed stored capture and payload at their respective 524,288-byte schema ceilings produced 1,111,298 raw selected field bytes but **2,172,407 JSON-serialized row bytes** because of escaping. Local D1 returned the row; strict validation withheld all output. One byte above either schema ceiling was rejected by D1. Do not confuse raw field limits with serialized transport overhead or describe this as below 2 MB in every representation. Actual deployment transport, CPU/memory and worst admitted page/real-payload margins remain explicit review/release holds.

This finishes only the local B2 ingredient when independently accepted. Effective account limits and isolated runtime proof, real C renderer/output-schema/source acceptance, Auth/public contract/confirmation/cursor integration, Design consumption, independent integrated browser/transport review and separately authorized additive DEV rollout remain open. Production renderer stays null; no source scoring/report completion, live release or production promotion follows from marker test success.
