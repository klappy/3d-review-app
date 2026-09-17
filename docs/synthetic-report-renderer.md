# C1 — pure source-faithful synthetic assessment projection

This is an unwired ingredient, not an authorized report route or released reporting feature. It renders one strictly attested synthetic assessment capture, preserving the pinned source's profiles, categories, evidence counts and descriptive narrative. B owns complete query/current-grant eligibility and storage; C2/Auth owns transport/confirmation/receipt/cursor semantics; Design owns presentation. A successful pure render establishes none of those other boundaries.

## Inputs and scope

Base A3523f20ae5807a0f1d4a047352b62c3aa6d2dd82 (parenta57ba930). Source is klappy/3d-quality-review@f042cde553761a6a7f24132cef7802f956378ee0. Four pure inputs originate at appd605d9391236e6cba28146efde089ff41bff439a:

|Input|Original SHA256|C1 disposition|
|---|---|---|
|source-item-score.ts|c9bbdb9151dd9d5471f3e998e114a980d30e52c44f1167399cdf2ad8386f0b89|Exact bytes; type-only existing TemplateItem import has no runtime dependency.|
|reference-rollup.ts|2209add94f424afcc61ae59a66f7aff34a46c5f57e461934080f64113fe1cdb6|Only sorting comparator changes from localeCompare to Unicode code-point order, as accepted C1 requires. Formulae/membership unchanged.|
|reference-narrative.ts|e9902253472c0b49a66efbecb906231de45087c3f13a3bd25dba3bf0866fb5e4|Exact bytes. Trend helper remains unused by this single-assessment renderer.|
|pinned-report-model.json|d9b3fe4cdc54a8fdd31db062f66f40b44ad7888cfb4777f0654c65ccbe155b73|Exact bytes; no new scoring policy.|

Excluded: old reference-projection/report-snapshot DB adapter and0005. No A/B/Auth/UI/handler/contract/migration/package/seed change. Cookbook authority is semantic conformance, not permanent implementation/file identity.

## Internal interface and trust boundary

`renderSyntheticReport(expectedAssessmentId, rows: readonly CaptureRow[])` returns bounded `{eligible:false,reason:'HELD'}` or `{eligible:true,payload,payloadJson,captureDigest}`. It copies exact own primitive data descriptors synchronously before its first await, invokes actual A attestation on that immutable snapshot, then parses those same raw strings and renders. Getters, extra fields, mutated identities and malformed raw material cannot bypass A via an asserted caller eligibility flag. Arbitrary JavaScript proxies are not an accepted input model; rows come from the reviewed internal query adapter.

Known subsets can pass A and this pure function: source identity is not proof of complete DB membership or authorization. B must provide its complete single-observation capture, then establish its own guarded write/current-disclosure boundary. Never expose the pure renderer or flag/indicator helpers directly as an alternate public report operation.

The output is recursively frozen. `payloadJson` is accepted A canonicalJson with a524288-byte maximum. Capture digest is internal integration evidence, not permission to disclose it through receipts, errors or traces. No raw answers, response IDs, report IDs, mutable project/language labels, medium/portion/date enrichment, clock, randomness, network or DB is used by the renderer.

## Output contract

Literal schema `3d-synthetic-assessment-report-v1`; synthetic:true; full source_commit; assessment_id; versions `{scorer:'steve-f042cde-single-assessment-v1',narrative:'steve-f042cde-rule-narrative-v1',policy:'synthetic-current-assessment-asof-query-v1'}`. The policy identity states the intended integrated policy; the pure renderer does not itself execute the B query. These are semantic ingredient versions, not the product's release number.

- `lenses`: lens,score,n_subdims_included,sub_dimensions[{sub_dimension,score,n_items_included}].
- `cross_lens_multi` and `cross_lens_single`: construct_code,construct_name,triangulated_mean,agreement_range,n_lenses_included,lens_scores[{lens,score}]. Range is source max-minus-min, never inverted. One-lens range is null.
- `standalone_indicators`: item_id,lens,sub_dimension,question_text,score,n_responses. No contribution to lens/subdimension means.
- `translation_type_agreement`: null or construct_name,team_values,church_values,agree. Noncomparable side gives agree:null, never false/zero.
- `evidence`: form_type,label,n. Counts come from captured associations, not live labels.
- `narrative`: exact source-authored ordered strings over lenses and multi-lens comparisons only.

Missing scored groups are absent; emitted score/mean values are finite0–100. Empty arrays and source absence narrative are meaningful states. Runtime bounds:3lenses,17subdimensions per lens,8constructs,111indicators,9form types,32narrative strings; labels256UTF8 bytes, questions/narrative4096 each, integer counts0–5743. Canonical encoding refuses nonfinite/unsupported values and enforces total bytes. The exact candidate fixture tests keys, nulls, types, array order and strings; numeric source/Pandas versus JS evaluation uses the previously reviewed1e-8 tolerance. Repeated/reordered same captures must produce byte-identical canonical payloads.

Array order uses Unicode code points, independent of locale; object-key canonicalization remains A's separate UTF16 rule. Rows are ordered by response identity before arithmetic to make summation deterministic. Lenses/subdimensions/per-lens values/form types/item IDs use lexical order. Multi-lens constructs sort descending range then construct code. Source SQL without ORDER BY is not claimed deterministic: source per-lens rows are normalized to explicit lens order for comparison; actual source04 group order and narrative tie behavior receive focused fixtures. A narrative text difference requires AMEND, not tolerance.

## Source-derived labels and fidelity evidence

pinned-report-labels.json derives8construct names from CrossLens.csv and9form labels from source07 FORM_TYPE_LABELS. It records both source SHA256s. Template identity mapping is checked against all nine actual A templates; duplicate/missing names and form mappings refuse. There are no guessed fallback display labels.

`sourceInputFlags` preserves source02 is_missing/is_other semantics internally. Source cleaning missingness is distinct from whether source03 assigns a score. All5743 input flag records are compared with source02;960missing and54Other match. The public-shaped payload intentionally omits individual flag/answer/respondent records because source07's assessment surface does not expose them. The committed fixture records only synthetic identities/flags and expected report projections, never real participant data.

## Test oracle and reproduction

Use the existing lockfile, Node22.16.0:

```sh
npm ci --ignore-scripts
npm exec vitest run test/synthetic-report-renderer.test.ts
npm run typecheck
```

The test obtains425 captures from the accepted A generator and verifies all34 full renders. The committed expected fixture was independently derived from original pinned source07, not the new TypeScript renderer: a copy of the previously generated synthetic source DB was read through its actual build_assessment_context. It contains34scoped reports,5743source02 flags, source-file hashes, a nonempty indicator fixture and exact narrative tie/rounding/empty fixtures. Only chart/display context excluded by the accepted C1 schema is removed; no formula or narrative is synthesized as an oracle.

Nonempty indicator proof: in a disposable copy of that synthetic source DB, two existing synthetic submissions receive ML-Q10 scores20/80; actual source04 recomputes aggregates and source07 returns one indicator with score50/n2. This is explicitly a helper fixture, not a real survey observation and not part of A's trusted public index. The untouched source corpus contains zero populated indicators. Source narrative.py supplies tie, half-even and empty cases directly. The author evidence contains the exact local oracle builder and regeneration hashes for reviewer rerun; no full pipeline rerun was needed to repeat prior numeric proof.

Final measurements and exact candidate hash live with the review cargo. Initial complete renderer pass matched34reports/270narrative strings; after deterministic input sorting, largest canonical payload4882bytes. Local timings are not Worker CPU or proof of actual account entitlement. Effective runtime limits, B2/C2/Design integration and release gates remain open.

## Meaning and remaining policy limits

Profiles preserve translation-team, community and church perspectives. Exact descriptive source comparisons are not a single quality score or an invented evaluative band. Historic source weighting/reportability/multi-problem tensions are not ratified anew by reproducing the pinned executable source; Design's source-policy explanation remains part of integrated acceptance. New LLM interpretation is outside this module.

Changes to source/model/labels/narrative/policy/schema meaning require governed tuple/version supersession and fresh applicable evidence. Internal helper reuse and a local test pass do not grant public disclosure, production promotion or whole-product acceptance. Independent candidate review is mandatory; the author does not accept this implementation.
