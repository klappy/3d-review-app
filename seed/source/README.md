# seed/source — the real instrument, pinned

Byte-identical copies from the captain fork **klappy/3d-quality-review @ f042cde553761a6a7f24132cef7802f956378ee0** (Steve Watters' work, merged upstream 2026-09):

- `rubric_csv/Items.csv` — **111 items** across 9 forms (Validation, Mid-Level, Written, Audio, Video-Sign, Consultant, Involved-Pastor, Community-Pastor, Denom-Leader): item_id, lens, sub_dimension, question_text, item_type, score_max, weight_in_subdim, cross_lens_construct, standalone_indicator
- `rubric_csv/Options.csv` — **498 options**: item_id, option_order, option_text, option_code, score (0-100), weight, flag
- `rubric_csv/SubDimensions.csv`, `CrossLens.csv`, `EvidenceQuality.csv`, `Vocab_*.csv` — aggregation, triangulation map, coverage layer, controlled vocabularies
- `scoring_rubric_draft.md` — the narrative spec (decisions log §12)

Rule: these files are **read, never edited** here. Regenerate by copying from the pin; a change to the instrument is a new pin, recorded in the cookbook (14-STEVE-REPO-SYNC).

`../synthetic/` holds the answer sets rendered from Steve's persona generator against these items (see `tools/synth_answers.py` and `../synthetic/README.md` — 7 of 9 forms have synthetic submissions; Mid-Level and Denom-Leader are a named source gap). **No real Laos/Aushi export is ever copied into this repo.**
