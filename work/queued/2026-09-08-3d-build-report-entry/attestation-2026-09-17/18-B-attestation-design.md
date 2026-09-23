# 18-B first attestation dish — proposed, not fired

What this is: A pure, source-derived verifier that recognizes the pinned synthetic responses without trusting database labels.
Why now: The isolated per-response experiment supports known subsets and known appended inputs, but its parsing and 7.85 MB repeated-template allowlist are not a production contract.
Your move: Otto routes this design to independent security review, then establishes the implementation order after applicable gates; no captain policy decision is requested.

Class: entrée. Risk: STANDARD (synthetic-only, non-wired, reversible utility; independent security review remains required).
Station: subagent. Owner: Astra's explicitly delegated report pen through Otto; this worker prepares design, not Fable's auth/contract pen.
Promise: planning cargo 35 minutes from observed 2026-09-16 21:01:25 EDT to 21:36:25 EDT, explicitly accepted by Otto in this task. Independent reviewer disposition is a separate dependency. This is NOT an implementation budget.
Depends: existing 18-B source-resolution and feasibility evidence; independent security review before implementation order. No new claimable implementation ticket or lane transition is asserted.
Order: cookbook #14 c5706705963 (planning/isolated experiments). Meal: existing September 16 parity build.
Outcome: reports can later prove both original captured and current complete inputs against the same pinned source; this dish itself exposes no report route.
Learning signal: all 425 known inputs recognized while single-field counterexamples fail closed; measured artifact and initialization cost.

## Ingredients and authority

Gold: klappy/3d-quality-review@f042cde553761a6a7f24132cef7802f956378ee0; cookbook #13 c5706246421. Report pen #14 c5706355411 / #15 c5706357997. Current-assessment eligibility settled in 53e8d781; deterministic narrative scope settled fd5d74d5374dceca7f09a1370f2e7c194608e553. Neither is reopened.

Reuse existing isolated report branch 89c80696677321bc00cfbdca19a8fc5b8d0fbf24, not a rebuild; baseline engine and PR13 remain unaccepted. At implementation start coordinator pins a fresh isolated branch preserving original worktrees; drift in any input requires reread and renewed review.

Bound inputs from that app candidate (SHA256 raw bytes):
- seed/synthetic/answer-sets.json: efc50c5ff9139d9235e4323233d27c54059527f92c54099e2f9dbf0cd71df1b5
- seed/synthetic/manifest.json: a938ee980306d7a58940a27295d4aecd203239ca21e8ceb90c0d09d719568b62
- migrations/0004_pinned_instruments.sql: 7280369baba5d2abbd51cf2c8dc23c0e2014f53cf424e77fd99d98460462d91e
- tools/synth_seed_sql.py: 9f554ae50557f53e5b1cff59a3361839b9beee40200afd2dd94d6364122153c2

Use migrations 0001–0004 in temporary SQLite only to recover actual v2 template rows; no remote seed replay. Existing source regeneration/oracle evidence lives in 18-B-oracle-review.md and 18-B-oracle-evidence.json. Reuse source manifest; add an attestation-index manifest, do not overwrite source's manifest or add invented scoring meaning.

## Exact declared products and exclusions

Proposed app paths: tools/build-synthetic-attestation.ts; src/report-attestation.ts; src/report-canonical-json.ts; src/synthetic-attestation-index.json; test/report-attestation.test.ts; test/report-canonical-json.test.ts; test/fixtures/report-canonical-v1.json; docs/report-attestation.md. Add only a scoped package script if required to regenerate/check artifact. Owner may choose an existing canonicalization dependency only after license/runtime evaluation and lockfile review; no unreviewed transitive parser.

No migrations, SQL queries, handler/registry/MCP/auth/receipt changes, public exports or deployment. Materialization and integration are separate dependent dishes, with their own accepted design and checks. This utility cannot establish grants, completeness of a database selection, or authorization. Never accept a partial query as complete because this function returned success.

## Source mapping and fail-closed generation

Read raw JSON through duplicate-aware validation before ordinary parse. Require exact manifest source repo/pin/generator and reads_real_exports=false, plus pinned raw input hashes. Require exactly 425 source records, 34 assessment cycles and unique submission IDs; counts are pinned fixtures, not generalized product thresholds.

Map response ID to resp_syn_ + first20 lowercase SHA256 hex of UTF8 submission_id, assessment ID to assess_syn_ + assessment_cycle, survey ID to survey_syn_ + assessment_cycle + '_' + template.id with leading tpl_ removed. Resolve form_variant to exactly one v2 template name. Preserve full submission digest in generation collision audit; duplicate source IDs and any truncated generated-ID collision both abort the entire build, even if contents match. Never INSERT OR IGNORE or overwrite an index entry.

For each source answer require known item. Match selected text to exactly one option text for that item; zero or multiple matches abort. Text items preserve source strings. Multi items preserve array order and multiplicity; non-multi requires at most one selected value, never silently first. Missing optional item becomes null as existing generator does; omitted required answers remain absent exactly as the pinned generator produced; incompatible present types abort. Live questionnaire requiredness does not override historical gold missingness. No answer may be invented. Preserve absent versus explicit null versus empty string, including all 301 observed required-item omissions across the 425 tuples. Reject duplicate item IDs, duplicate option codes or text within an item, and duplicate form-name/version keys. Observed actual v2 scan: 111 items, zero ambiguous option texts; future malformed fixture must still fail. Do not change seed generator behavior in this dish; report disagreement as a source tension.

## Canonicalization contract and exact vectors

Version name: 3d-attestation-jcs-v1. Use RFC8785 canonical JSON UTF8 (https://www.rfc-editor.org/rfc/rfc8785), with strict raw parser rejection of duplicate decoded keys at every depth before JSON.parse can erase evidence. Escape aliases such as 'a' and '\u0061' are duplicates. Reject malformed JSON, lone surrogates, nonfinite numbers and integers outside Number.isSafeInteger; schema accepts no numeric answer values unless the pinned template explicitly permits them. Preserve Unicode without normalization and preserve array order. Object sorting uses UTF16 code units, not locale or UTF8 sorting. -0 canonicalizes to 0. Reject undefined, cycles and non-JSON JS values at typed ingress; raw JSON is the verification ingress for stored answers/templates.

Freeze test vectors in fixture file before implementation and independently inspect bytes/hashes: {"b":2,"a":1} => {"a":1,"b":2}; {"a":1,"b":2} has same bytes/hash; ["b","a"] differs from ["a","b"]; null differs from missing; empty string differs from null; composed/decomposed accented strings differ; -0 => 0; nested duplicate {"x":{"a":1,"a":2}} rejects; escaped duplicate {"a":1,"\u0061":2} rejects; lone surrogate rejects; 1e400 rejects; 9007199254740993 rejects; official RFC8785 number/UTF16 ordering vectors must pass within the stricter integer input policy. Fixed SHA256 values must be produced once with an independent implementation/tool and committed, not calculated as expected values using the function under test.

Hashes are lowercase full SHA256 hex, over ASCII domain prefix + single zero byte + canonical UTF8 bytes. Domains: 3d-answer-v1, 3d-template-v1, 3d-response-v1, 3d-index-v1, 3d-capture-v1. Algorithm/version mismatch is refusal, never silent fallback. Cryptographic hash is integrity binding to reviewed source, not a signature or proof that any caller is authorized.

## Compact index and identity boundary

Store templates once keyed by full template digest. Template digest includes id, version, exact source_ref, perspective, and parsed items content (all fields, not merely scoring subset). Entries store response_id, assessment_id, assessment_survey_id, response_template_id/version, selected_template_id/version, exact submitted_at string, answers_digest and template_digest. Entry digest covers every entry field plus canonicalization version, source pin and manifest raw digest. Index root covers sorted entries and deduplicated template dictionary plus mapping-version 3d-synthetic-map-v1 and input raw digests. No mutable project/language/assessment display labels are attested or returned. Original source submission IDs needed for audit stay in generation evidence, not a public response.

Runtime verifier receives expected assessment ID, a complete immutable capture supplied by a later authorized query layer, and the reviewed index. It checks nonempty, unique response IDs, all association IDs/versions and submitted metadata, exact source_ref and computed template digest, canonical answer digest, and expected index/mapping/canonical versions. Unknown/missing/malformed fields or associations fail closed. Return an internal discriminated result: eligible with sorted response IDs and capture identity digest, or ineligible with a bounded internal reason code. Never raw answers, template contents, user text or source identifiers in external errors/logs. No trust in source='synthetic', provenance_json flags, or prefixes.

A capture digest binds sorted full entry identities plus index root; it is not the future materialized report version key. Later materialization must bind scorer, narrative, policy and output-schema versions as well as this capture identity and original attested snapshot. Both stored and current captures must be independently eligible; they need not equal, so an old known subset retains its original payload after a known synthetic append. Unknown/mutated append suppresses access in the later integration dish. Do not use a cache keyed only by assessment ID.

## Cost and limits

Do not ship prototype 7.85 MB repeated template JSON. Measure generated index raw/gzip bytes, incremental bundled bytes and cold initialization against unchanged candidate using the same build tool. Record template count, entry count, parse/index median and maximum across 20 isolated local runs, machine/runtime and test command. Acceptance budget for this utility: generated JSON <=512 KiB raw, incremental compressed bundle <=256 KiB, local initialization maximum <=100 ms, no remote I/O; these are engineering ceilings, not claims of measured performance. If exceeded, return design with evidence to Otto; do not silently relax or ship. Future Workers integration must separately measure real platform startup/limits and cannot infer deploy acceptance from this local benchmark.

## Done-means

1. Reviewer can regenerate twice from pinned inputs and observe byte-identical compact index with all 425 source responses and no silently skipped answer.
2. Reviewer can compare all 425 actual seeded tuples and observe eligibility, then mutate each identity/metadata/source/answer/template field and observe refusal.
3. Reviewer can run fixed canonical vectors and observe exact independently established bytes/digests, duplicate-key refusal at all depths and version mismatch refusal.
4. Reviewer can inject ambiguous option text, duplicate source/index IDs and a mocked truncated-ID collision and observe complete generation failure with no partially written artifact.
5. Later report owner can verify a known old subset and expanded known set separately, while unknown/mixed/mutated sets fail, without receiving any public report payload or authorization claim.
6. Reviewer can inspect build and cost evidence and observe deduplicated templates within declared local budgets, with no route/registry/auth/seed mutations.
7. Otto can read exact-head independent verdict and local debrief, preserving prior negative controls and remaining integration blockers; no promotion is inferred.

## Failure Modes — What Breaks When Attestation Is Treated as a Label

Label laundering; parser ambiguity; silent mapping loss; collision overwrite; partial-enumeration authorization; stale index/version reuse; oversized artifact; claimed end-to-end parity.

## Required Response When Detected

Labels never grant eligibility; ambiguous JSON refuses; mapping discrepancy stops generation with source pointer; any collision aborts atomically before artifact rename; query completeness remains explicit caller obligation and later independent query tests; versions reject closed; budget breach returns measured redesign; scope all receipts to this pure utility. No deployment, merge or runtime wiring to make a test pass.

## Gates and return path

Live kitchen TEMPLATE1.2.0/CHECKLIST1.4.1/LIFECYCLE1.1.0/FIRE-CHECK1.3.0 read this planning turn. Checklist remains proposed pending independent review and coordinator implementation Promise. 6B: reuse existing source generator as mapping evidence, existing template migration as authoritative app mapping, RFC8785 as canonical semantics; none authorize rewriting Fable's substrate. Independent reviewer actually searched accessible GitHub house code for canonicalize, 8785 and duplicate key (40-result limits), then read klappy/ptxprint-mcp src/payload.ts@732c14624d0030cf39e40f48c7c94f33a9dce4c8 and klappy/appbuilder-mcp src/payload.ts@4e02dc49baf972de4b0cb05fc89123dfd13ff4cd. Reuse their UTF16 sorting/WebCrypto pattern with attribution; neither is a safe drop-in because undefined is omitted and strict raw duplicate keys, lone-surrogate/safe-integer/cycle/plain-object checks are absent. This is accessible-house evidence, not proof every private repo was visible; Cartographer INVALID_ARGUMENT was a schema-discovery failure. No fire gate claimed.

Return cargo to Otto and root; root persists amendment beside existing PR12 18-B plan, Auggie journals. Independent reviewer must inspect this exact revision before any implementation order. App PR9/13 review status, mandatory Bugbot SUCCESS and promotion hold remain unchanged.

## Driver-seat DELTA (before challenge)

Applied current driver's-seat prompt to source mapping, verifier boundary and eventual report consumer. Changed repeated full-template rows to a digest dictionary so worker can regenerate and review a small diff; added exact raw duplicate-key refusal because ordinary parsing destroys evidence; changed options[0] to cardinality-one mapping; separated pure verifier from query authorization so its result cannot masquerade as safe disclosure; added explicit generation failure/no partial artifact and measured budgets. Rejected rebuilding seed pipeline, assessment-wide baseline equality (invalidates safe known append), trusting synthetic flags, new human narrative approval, and embedding mutable labels. System picture: pinned source -> reproducible compact identities -> pure capture verification -> separately governed consistent authorization/materialization -> later routes. Only first two arrows are this dish.

## Actual challenge receipt and disposition

Oddkit challenge ran after driver-seat revision at 2026-09-16 21:03:02 EDT: CHALLENGED, block_until_addressed=false; it returned generic missing-evidence/confidence/context/disconfirmer/cost/reversibility/success-criteria questions, not a security approval. Grounding is the pinned files/hashes and 111-item uniqueness scan above, plus isolated 425-entry experiment; confidence is feasibility-only, production correctness unverified. Falsifiers include any valid pinned source record rejected, mutated record accepted, or canonical cross-implementation disagreement. A mismatch blocks this utility and all dependent report wiring. Local design is reversible; public publication cannot be undone by deleting a branch and remains separately authorized. Cost ceilings are proposed engineering bounds, not observations. Independent review is still required; do not relabel CHALLENGED as PASS.


## Consolidated independent-review revision — exact contracts

Supersedes the original missing-required and risk statements, not their historical review evidence. Independent review /tmp/3d-attestation-independent-review.md returned CHANGES REQUIRED. Fresh local scan independently reproduced 425 tuples and 301 required-key omissions. Observed maxima: answer JSON795 UTF8 bytes, template JSON24014 bytes, string136 code points, collection17 members, nesting4. These are observed pinned-data maxima, not future source assumptions.

Resource limits for v1: answer raw JSON8192 UTF8 bytes; template raw JSON65536 bytes; generated index raw JSON524288 bytes; nesting depth16 (root depth0); any data string4096 UTF8 bytes; object/array collection1024 members; capture425 rows maximum. Enforce byte limits before lexical traversal, nesting and decoded-string/member limits during duplicate-aware scanning before ordinary parse. Bounded internal reason only on failure. A future source change above limits requires a new reviewed version, never silent truncation. Typed ingress accepts only primitives, arrays and ordinary/null-prototype data objects with own enumerable string data-properties; reject symbols, accessors, inherited enumerable properties, custom prototypes, toJSON hooks, cycles and non-JSON values without invoking getters. Reject lone surrogates in keys and values. Typed ingress is internal only; no arbitrary proxy can be safely introspected, so caller-supplied JS objects are outside the production API. Verification ingress is bounded raw JSON plus validated primitive IDs.

Trusted construction: production module imports generated artifact AND independently compiled expected index root, exact source pin, four input raw SHA256s, mapping-version and canonicalization-version constants. Proposed additional path src/synthetic-attestation-trust.ts records these reviewed constants. Verify artifact root and header against these constants before constructing the verifier. An input cannot supply or override trusted constants. Test-only factory in test helper may inject a fixture trust bundle; it is not exported by production module or reachable through a handler. Negative test modifies index content and recomputes every self-reported hash/root: production construction must still refuse. Updating artifact and trust constants is an explicit reviewed source update, not automatic runtime acceptance.

All following preimages use exact field names, no omitted fields, no additional fields. Hash H(domain,value) follows the domain rule above. Canonical JSON sorts object keys; arrays below have explicit order. Hex digests must be64 lowercase ASCII hex. Identifiers are compared exactly, with no trimming/case/Unicode normalization. Sorting comparator is lexicographic UTF16 code-unit order; equal sort keys are rejected rather than deduplicated.

- Answer preimage is the exact mapped answer object, preserving absent keys; answerDigest=H('3d-answer-v1',answers).
- Template preimage: {templateId,templateVersion,sourceRef,perspective,items}; items is parsed complete items_json with array order preserved; templateDigest=H('3d-template-v1',preimage).
- Entry preimage: {responseId,assessmentId,assessmentSurveyId,responseTemplateId,responseTemplateVersion,selectedTemplateId,selectedTemplateVersion,submittedAt,answersDigest,templateDigest,canonicalVersion,sourcePin,manifestDigest}; responseDigest=H('3d-response-v1',preimage). manifestDigest is raw-byte SHA256 of pinned source manifest, distinct from a canonical object digest.
- Index preimage: {schemaVersion:'3d-attestation-index-v1',canonicalVersion:'3d-attestation-jcs-v1',mappingVersion:'3d-synthetic-map-v1',sourcePin,inputDigests:{answerSets,manifest,migration,generator},templates:[{templateDigest,preimage}],entries:[{responseDigest,preimage}]}. Templates sorted by templateDigest, entries sorted by preimage.responseId. Template digest reuse is allowed only when canonical template bytes are identical; conflicting same digest aborts. ResponseId ties always abort. indexRoot=H('3d-index-v1',preimage). Serialized artifact is {indexRoot,index:preimage}; root is NOT part of its own preimage.
- Capture preimage: {schemaVersion:'3d-attestation-capture-v1',canonicalVersion:'3d-attestation-jcs-v1',indexRoot,assessmentId,responses:[{responseId,responseDigest}]}; responses sorted by responseId, duplicate IDs rejected, each response belongs to assessmentId and individually matches trusted index. captureDigest=H('3d-capture-v1',preimage). Empty capture refuses. Original and expanded captures intentionally have different captureDigest; each can separately attest. This does not imply payload mutation or report version compatibility.

Freeze independently computed byte+digest vectors for every full preimage above, including reordered object keys, a known one-response subset versus expanded set, template-array reorder, root self-inclusion negative and duplicate capture IDs. Add explicit301-omission coverage: rebuilding the mapped answers preserves each absence; replacing one absent required key by null/empty or dropping a known explicit optional-null changes identity and refuses. Mock truncated-ID collision at generator hash seam only; hash primitive remains real in production. Index failure must not write a partial artifact.

Driver-seat revision DELTA: historical consumer needed faithful source identity rather than live submission validation, so replaced requiredness rejection with exact omitted/null identity; attacker could rehash a forged index, so separated compiled trust constants from candidate artifact; implementer lacked stable preimage schemas, so fixed domains/fields/order/tie policy; parser could traverse hostile data before cost checks, so added measured-headroom limits and raw ingress; independent reviewer found no actual allergen, so classified this isolated utility STANDARD while preserving security review. Rejected weakening comparisons to accept any missing answer, caller-selected trust roots, canonical hashes with implicit field order, and treating startup budget as input-size control. Scope remains pure utility, no implementation or fire.

Fresh post-revision challenge at2026-09-16 21:07:07 EDT: CHALLENGED, block_until_addressed=false. Generic confidence/disconfirmer/prior-art/assumption questions persisted despite supplied source context; no approval claimed. Confidence remains a scoped design hypothesis backed by observed corpus and isolated feasibility, falsified by any forged acceptance/gold rejection or independent vector disagreement. This receipt is additional to the earlier challenge and independent CHANGES REQUIRED; fresh independent review must now judge the actual revised file. No implementation began.
