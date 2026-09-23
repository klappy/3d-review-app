# First shipped increment: 140-path reconstruction evidence audit

**The frozen release is fully inventoried; the cookbook is not yet sufficient for a cold reconstruction.** Target: app `a57ba930ced3c23616982c7dab291949b75a3b8a`, tree `f0d676873e597b9f74848b2e3ca86e618a5c154d`. No target changes, recipe implementation, product work, build, provider action or shared-journal write occurred in this audit.

## Measured coverage

| Assessment | Paths | Meaning |
|---|---:|---|
| Partial | 108 | Relevant intent, accepted essential semantics or provenance exists; exact maintained producer/inputs are incomplete. |
| Missing | 20 | No sufficient matching producer/specification identified in the selected cookbook snapshots. |
| External input | 12 | Eleven pinned supplier data blobs independently match the target; one local secret-placeholder example requires external-value custody. |
| Maintained cookbook recipe proven complete | 0 | No cold build or complete maintained recipe was tested or claimed. |
| **Total** | **140** | Exact oracle set, including historical dist, empty file, tests, docs, tools and seeds. |

The eleven supplier matches are **byte comparisons**, not eleven successful cookbook reconstructions. The initial working label “reproducible” was narrowed to “external input” to avoid implying recipe/cold-build proof. `SUPPLIER-BYTE-RECEIPT.json` records each immutable blob, supplier path and exact equality. Existing 117-path baseline ratings remain in separate columns;23 additional release paths are explicit. Old “SPECIFIED” was a semantic assessment, so several rows are now “partial” under the stricter byte-reconstruction question. No prior evidence is deleted.

Main review material:
- [140-path ledger](140-PATH-AUDIT.tsv), with immutable cookbook locators, actual producing inputs/tool or missing producer, app last-touch/blob/hash/mode, prior ratings and exact gap IDs.
- [Full machine ledger](140-PATH-AUDIT.json), preserving the prior per-file evidence and direct source-module dependencies.
- [Delta semantics and authority](DELTA-PROVENANCE.md), covering shared operations, Auth/CAS, storage/R15, generator hazards and historical dist.
- [Bounded correction proposals](GAPS.md), for the next independently reviewed recipe-authoring stage.
- [Immutable source catalog](SOURCE-CATALOG.json), separating accepted essential scope from historical proposed planning.

## Most consequential findings

1. **Source text/producer custody is the main gap.** Essential docs now explain important behavior, but the selected cookbook snapshots contain no corresponding exact app source modules/templates. A content-hash inventory across those snapshots found only an incidental empty `err.txt` match with the empty seed file; that is not provenance. A blind builder cannot get140 exact files from prose and tests alone.
2. **The contract generator is historically incomplete.** It emits current time, retains old public-route/inverse/path heuristics and lacks final five-operation schemas/security/metadata. The global RATE_LIMITED enum is already present; per-capability Auth additions and shared amendments still need deterministic preservation. No generator was run. Concrete lines and frozen output facts are in the delta report.
3. **The cookbook has a concrete migration contradiction.** Frozen shared contract36:59 includes0005 in integrated initialization, but this release has no0005. Accepted local order is0001→0002→0003→0004→0006→0007; the already executed remote additive procedure was only0006→0007. Correct this scoped sentence without modifying the immutable app target or introducing report work.
4. **Final email-code CAS and R15 require catch-up.** Exact app reviews accept these later changes; frozen paired essentials do not fully describe their final implementation/negative oracles. The Auth 2315 source is tree-equivalent to integrated 699ea513, not literal ancestry. API fc0bbc36 was applied as ad95321 atop Auth, not a whole-tree copy.
5. **Tracked dist needs a historical producer.** All 4files are older artifacts, not the deployed bundle. Source-map evidence identifies26/26 matching source modules at 0542cf54/fbc970c5, versus 7/26 at the frozen release. Historical config/lock snapshots are available, but exact invocation/flags/environment/timestamp handling is unresolved. Preserve these files in the target.
6. **Fixture uncertainty is narrower now.** All 10rubric CSVs plus scoring-rubric Markdown match pinned f042cde supplier blobs. The upstream synthetic runner exists at blob825d6603, and uses fixed `random.Random(20260901)` with no arguments selecting all personas. Its app adapter and pandas/transitive pipeline dependencies/invocation still need maintained custody. Old claims that the seed itself is unknown should be superseded by this observed seed; no synthetic pipeline was executed.
7. **Known defects remain distinct from intended behavior.** Raw submit codes, uncertain-outcome wording, missing revoke UI and separate respondent-count UI are retained release observations. Frozen copy text is not permission to require misleading behavior in future versions. Reconstruction compares this release; future corrections go through cookbook-defined versions and reviewed app generation.

## Method and limits

Author started at observed Oddkit `2026-09-17T06:07:56.757Z` under root FIRE kitchen8c87607/k0208, routed by the actual reconstruction coordinator. Scope was the first bounded evidence/gap audit only, with 45-minute budget and 15-minute checkpoint. An early actionable checkpoint was sent after complete initial mapping; no idle wait or duplicate product worker dispatch.

The author is source-exposed and is **ineligible as the blind builder**. Used the existing Auditor117-path crosswalk as prior evidence, rather than rerunning its full audit. Retrieved immutable app/cookbook trees, verified all 140target hashes, measured last-touch lineage and selected module imports, inspected the essential paired docs and selected source/review deltas, fetched11 supplier blobs, and compared historical map embedded source content against 113reachable app commits. Target history is audit evidence only; it is not an app-checkout dependency to hand to a blind builder.

Selected cookbook snapshots: frozen main91d8fd30, design31d1f536, essentials31/2e8f76b4,36/f30fc2cd,34/bab67393,35/ecab91ae,37/41a4ee29; historical proposals12/c627720 and18/dac8a457. None is silently claimed merged. Root accepted the essential pins for the shipped increment; standalone independent final receipts for34/36 are not invented. Existing proposal18 is superseded where it suggests semantic equivalence can replace the 140-path exact obligation. No private transcript corpus was copied into audit outputs.

This is an evidence-sufficiency audit, not a line-by-line new security review or successful rebuild. Negative findings are scoped to the inspected frozen snapshots/known source homes; they do not claim a global absence of all possible historical material. Actual shipped behavior/test receipts remain attributed to their original runner and SHA. No tests were rerun; no new live acceptance, clean-room result or future monitoring is claimed.

## Next bounded work

The existing coordinator can now prepare the recipe-authoring order using the specific gaps, preserving owner authority and frozen target. It needs a sealed maintained source/dependency package, a canonical cookbook version/changelog proposal for root disposition, and independent semantic review before a fresh-context blind builder receives it. The app must not remain the ongoing authority by default: this reverse audit recovers the legacy shipped increment, then forward releases select the cookbook-defined version/commit first. No version identifier or publish decision is invented here.
