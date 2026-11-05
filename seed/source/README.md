# seed/source — the real instrument, pinned

Byte-identical copies from the captain fork **klappy/3d-quality-review @ f042cde553761a6a7f24132cef7802f956378ee0** (Steve Watters' work, merged upstream 2026-09):

- `rubric_csv/Items.csv` — **111 items** across 9 forms (Validation, Mid-Level, Written, Audio, Video-Sign, Consultant, Involved-Pastor, Community-Pastor, Denom-Leader): item_id, lens, sub_dimension, question_text, item_type, score_max, weight_in_subdim, cross_lens_construct, standalone_indicator
- `rubric_csv/Options.csv` — **498 options**: item_id, option_order, option_text, option_code, score (0-100), weight, flag
- `rubric_csv/SubDimensions.csv`, `CrossLens.csv`, `EvidenceQuality.csv`, `Vocab_*.csv` — aggregation, triangulation map, coverage layer, controlled vocabularies
- `scoring_rubric_draft.md` — the narrative spec (decisions log §12)

Rule: these files are **read, never edited** here. Regenerate by copying from the pin; a change to the instrument is a new pin, recorded in the cookbook (14-STEVE-REPO-SYNC).

`../synthetic/` holds the answer sets rendered from Steve's persona generator against these items (see `tools/synth_answers.py`). **No real Laos/Aushi export is ever copied into this repo.**

## Decision 25 canonical amendment

`src/translation-brief-amendment.json` is generated from **klappy/3d-quality-review @ 605edb47d2280568f0f5860f7b1921c12a814222**, `rubric_csv/Options.csv`, by `tools/build_translation_brief_amendment.py`. It records the exact input SHA256 and the two role-specific `no-brief` options. Reproduce with `python3 tools/build_translation_brief_amendment.py --source-repo /path/to/source --check`.

This bounded new source pin adds only Decision 25 to the existing instrument. The historical `f042cde` CSVs, stored template IDs/versions, answers and captures remain unchanged. The shared parser projects this additive canonical erratum for all existing/new uses of TR-Q2/ML-Q2 (participant form and submission, assisted entry, template render, print/PDF). No assessment-specific definition or data migration is introduced. The source-defined `other` code and all saved answers retain their meaning. Newly generated reports record `instrument_amendment`, use a new scorer identity, retain status findings and exclude them from comparison. Exact historical renderer tuples remain readable through the compiled legacy validator; unknown tuples fail closed. Other upstream changes and imported/demo response replacement are outside this amendment.
