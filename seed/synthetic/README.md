# seed/synthetic — synthetic answer sets (demo + differential fixtures)

Everything here is rendered from Steve Watters' **seeded** generators in `klappy/3d-quality-review @ f042cde`
(`survey-pipeline/synthetic/`). No file under `survey-pipeline/data/` (real Laos / Aushi exports, mock
*minnesota-nice*) is read — the checkout used to render these excludes that directory. No score, weight or answer
is authored in this repo: the app only maps Steve's rendered option **text** to the pinned v2 option **codes**.

| Dataset | Source generator (rng seed) | File | SQL | Projects / cycles / submissions |
|---|---|---|---|---|
| `named-personas` | `run_synthetic_pipeline._render(None)` (20260901) | `answer-sets.json` | `../synthetic-responses.sql` | 10 / 34 / 425 |
| `org-comparison` | `run_org_comparison_pipeline._render(3)` (20260904) | `answer-sets-org-comparison.json` | `../synthetic-responses-org.sql` | 9 / 45 / 525 |

`_render(3)` = three projects per org profile: the smallest cohort in which the source's own random medium choice
reaches Audio **and** Video-Sign. It is Steve's generator with a smaller `n`, not a hand-picked subset.

## Form coverage (manifest.json → `form_coverage`)

| Form | Synthetic submissions | From |
|---|---|---|
| Validation | 328 | both |
| Written | 369 | both |
| Involved-Pastor | 123 | both |
| Consultant | 40 | both |
| Audio | 30 | org-comparison |
| Video-Sign | 30 | org-comparison |
| Community-Pastor | 30 | org-comparison |
| **Mid-Level** | **0 — named gap** | source defines respondent personas `ml-strong/typical/weak`, but no project, trajectory, org or Patmos generator assigns prefix `ML` |
| **Denom-Leader** | **0 — named gap** | source defines `chdl-strong/typical/weak`; `org_profiles.py` allows `CHDL` as a church prefix but no profile uses it |

Do **not** describe all nine forms as answer-set or end-to-end covered. Closing the two gaps needs a source decision
(a role row or org profile in Steve's repo), not invented rows here — tension filed on cookbook #13.

## Honest limit — these are import-shaped rows, not app-valid submissions

Steve's personas carry a `missing_rate`, so his generator leaves some **required** items blank: **203 of 425** named-persona
submissions and **240 of 525** org-comparison submissions have at least one blank required item (`manifest.json → sql.*.
submissions_with_blank_required_items`, asserted by test, independently re-counted by the PR reviewer). Every answer that IS
present is a valid option code, but `cap.response.submit` would refuse these rows — the app could never have produced them.
They are right for differential scoring against Steve's pipeline (blank → null after `02_clean`) and wrong as evidence that
"the submit path accepts 950 responses". Results code must tolerate a missing required item.

Assessment `format` follows the community medium surveyed in the cycle (`audio`, `video-sign`, else `written`); the source's
`assessments.csv` says `written` for every cycle, including its audio cohorts.

## Regenerate (byte-reproducible)

```
# sparse checkout of the pin WITHOUT survey-pipeline/data, then in survey-pipeline/:
python3 -c "import sys; sys.argv=['x']; import run_synthetic_pipeline as r; r._render(None)"
python3 -c "import sys; sys.argv=['x']; import run_org_comparison_pipeline as r; r._render(3)"
python3 tools/synth_answers.py <checkout> seed/synthetic                   # answer-sets.json  sha256 efc50c5f…
python3 tools/synth_answers.py <checkout> seed/synthetic org-comparison
python3 tools/synth_seed_sql.py && python3 tools/synth_seed_sql.py org-comparison
```

`project_id` comes from the reference relation assessment → language → project (never the language id standing in
for it). In both source datasets the two ids happen to be equal, so no existing row changed.
