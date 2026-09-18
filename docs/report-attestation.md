# Synthetic attestation utility v1

This isolated utility recognizes exact response identities from the reviewed synthetic source. It is **not wired into the worker**. It grants no access, checks no database query completeness and produces no report. A later authorized query layer must supply a complete immutable capture and separately attest stored and current captures. The returned capture digest is not a materialized report version key.

## Source and rebuild

Source supplier: `klappy/3d-quality-review@f042cde553761a6a7f24132cef7802f956378ee0`. Mapping: `3d-synthetic-map-v1`; canonical JSON: `3d-attestation-jcs-v1`. The four raw input hashes are independently compiled in `src/synthetic-attestation-trust.ts` and checked by the offline generator. The generator also pins local bootstrap migrations 0001–0003. It runs existing 0001–0004 in an in-memory SQLite database solely to recover v2 templates; it does not run seed SQL, call a provider, mutate a database file or modify migrations.

Tested with Node 22.16.0, Python 3.11.2, the existing package lock and `npm ci --ignore-scripts`. No dependency or package changes are required. From repository root:

```sh
npm ci --ignore-scripts
node --experimental-strip-types tools/build-synthetic-attestation.ts
node --experimental-strip-types tools/build-synthetic-attestation.ts /tmp/attestation-second.json
cmp src/synthetic-attestation-index.json /tmp/attestation-second.json
npm exec vitest run test/report-attestation.test.ts test/report-canonical-json.test.ts
npm run typecheck
```

The CLI produces a complete compact artifact only after every pin, mapping and collision check passes, then atomically renames a temporary file. Failure preserves any previous artifact. Its optional argument is an output filename. It never updates compiled trust constants; changing source pins/root and artifact requires explicit independent source review. Test-only collision injection exists solely in the offline tool module and is absent from runtime imports.

The pinned corpus is 425 tuples in 34 assessment cycles, with 111 instrument items and nine deduplicated templates. All **301 missing required answers remain absent**; all 659 optional nulls remain explicit null. Historical missingness is an identity fact, not a live requiredness policy. Array order and repeated selections are preserved. Duplicate source IDs, generated-ID collisions, ambiguous options/forms/items and incompatible selections abort generation. The test oracle independently decodes committed `seed/synthetic-responses.sql` literals without executing that SQL and compares every tuple to the new mapper.

## Internal API

```ts
attestCapture(expectedAssessmentId: string, capture: readonly CaptureRow[]): Promise<AttestationResult>
```

Each row has exactly these fields:

- `responseId`, `assessmentId`, `assessmentSurveyId` — exact strings.
- `responseTemplateId`, `selectedTemplateId`, `submittedAt` — exact strings.
- `responseTemplateVersion`, `selectedTemplateVersion` — positive safe integers.
- `answersRaw` — raw JSON of the exact mapped answer object.
- `templateRaw` — raw JSON of `{templateId, templateVersion, sourceRef, perspective, items}`; `items` contains every original field in original array order.

Rows are snapshotted synchronously before the first await; accessors and extra/missing fields refuse. Arbitrary proxies are outside the internal typed API contract and must never be passed by a caller. Raw JSON and validated primitive metadata are the production input boundary. No caller can inject trust constants or choose an index. The bundled index is checked against the separately compiled root and header before use; recomputing a forged artifact's self-hashes cannot make it trusted.

Success is `{eligible:true, responseIds, captureDigest}` with sorted response IDs. Failure is `{eligible:false, reason}` where reason is `INVALID_INPUT`, `INDEX_INVALID` or `IDENTITY_MISMATCH`; no raw content appears in reasons or logs. An empty, duplicate, unknown, mixed-assessment or malformed capture refuses. A known subset and expanded known set can both attest and have distinct digests. That says nothing about authorization, capture completeness or whether an existing report may change.

`initializeAttestation()` performs the same lazy trusted initialization for local measurement; it has no parameters or trust injection. Its rejection is an internal initialization failure. `attestCapture` converts this to bounded `INDEX_INVALID`.

## Canonicalization and hash boundaries

RFC 8785 UTF-16 key ordering and ECMAScript number serialization apply, with stricter rejection of nonfinite numbers, unsafe integers, lone surrogates, duplicate decoded keys and unsupported JavaScript data. There is no Unicode normalization. `-0` becomes `0`. Hashes are full lowercase SHA-256 over ASCII domain, a single zero byte and canonical UTF-8. Five domains bind exact answers, templates, response identities, index and capture. Field names and preimages follow the accepted 18-B contract and are exercised by fixed full-preimage vectors.

`test/fixtures/report-canonical-v1.json` contains independently established canonical bytes and Python `hashlib` digests, including all domains, subset/expanded captures, template ordering and root self-inclusion. The production implementation is never used to calculate expected vector digests. Generic hashing does not enforce capture semantics by itself: duplicate capture IDs are explicitly rejected by `attestCapture`.

Raw byte limits are enforced before lexical traversal: 8,192 answer bytes, 65,536 template bytes and 524,288 artifact bytes. Maximum nesting is 16 (root depth 0), decoded string size 4,096 UTF-8 bytes, collection size 1,024 and capture size 425. Typed internal serialization rejects accessors without calling them, non-data properties, symbols, hooks, custom prototypes, holes, cycles and inherited enumerable properties. Its byte budget is charged during traversal. Raw parsing checks decoded duplicate names before ordinary parsing can erase them.

## Local cost check

Measured on macOS 26.2 arm64, Node 22.16.0, esbuild 0.21.5. Initial artifact: 466,743 raw bytes / 62,525 gzip bytes. A same-options esbuild comparison of unchanged `src/worker.ts` against a measurement-only stdin wrapper retaining worker plus utility gives 64,079 incremental gzip bytes (ceiling 262,144). The wrapper is not committed or deployed. Both builds mark platform-provided `cloudflare:workers` external and load SQL/YAML as text.

An initial final-candidate measurement failed the 100 ms maximum ceiling at 102.04 ms (108.22 ms including import). That failure was preserved and escalated. The approved bounded optimization canonicalizes the full index once, parses a private snapshot and cryptographically hashes those exact bytes against the independent compiled root; it removes only a duplicate canonical traversal. The subsequent 20 fresh processes measured median initialization 44.50 ms, maximum initialization 58.18 ms and maximum import plus initialization 66.41 ms, with the same 100 ms ceiling. These are local results, not Workers startup or deployment acceptance. Rerun after a source or runtime change. Minimal cold-init reproduction, from repository root:

```sh
node --input-type=module <<'JS'
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
await build({entryPoints:['src/report-attestation.ts'],bundle:true,platform:'node',format:'esm',outfile:'/tmp/attestation-benchmark.mjs'});
for(let i=0;i<20;i++) console.log(execFileSync(process.execPath,['--input-type=module','-e',"const s=performance.now();const m=await import('/tmp/attestation-benchmark.mjs');const l=performance.now();await m.initializeAttestation();console.log(JSON.stringify({initMs:performance.now()-l,totalMs:performance.now()-s}));"],{encoding:'utf8'}).trim());
JS
```

`npm run typecheck` checks production `src` under the existing configuration. Tests and offline generator are executed by Vitest/Node; standalone static checking of those Node-only files would require Node type declarations absent from the unchanged dependency set. No package expansion was made to hide that limitation.

Independent exact-candidate review and applicable checks are still required before integration. No SQL/runtime query, routes, authorization, registry, MCP, receipt, seed or deployment changes are part of this utility.
