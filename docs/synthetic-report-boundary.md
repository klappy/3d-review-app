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
