# 3D Quality Review — Scoring Rubric

**Working draft, v0.2 — 2026-06-01**

This document defines how questionnaire responses are converted into scores, profiles, and triangulation views — and how those feed the two intended reports (team self-assessment, strategist comparison).

It is the **narrative spec**. The machine-readable companion — every question, every option, every score — lives in `3D_Quality_Review_Scoring_Rubric.xlsx` in this same folder.

---

## 1. Design principles

1. **Don't collapse the three lenses into one number.** Each lens (Validation / Reception / Affirmation) is reported on its own. A "single quality score" hides the diagnostic signal that makes the 3D design valuable in the first place.
2. **Score within sub-dimensions; profile across them.** The parenthetical tags already in the questionnaires (e.g., *Translation Process*, *Understandable*, *Confidence in the Translation*) become the working sub-dimensions. Item scores roll up to sub-dimension scores. Sub-dimensions roll up to a lens score — but the *profile* is what gets reported, not the average.
3. **Not every question is scored.** Some are profile/descriptive (translation type, denominational landscape, age range) — these become filters and context. Some are open-text — these are theme-coded, not scored. Forcing scores onto profile items hurts both reports.
4. **Triangulation is its own measurement.** Where the same construct is observed by two or three lenses (e.g., consistency, clarity, trust/readiness), the cross-lens *agreement* is a separate output — possibly the most important one for the strategist.
5. **Track evidence quality separately from assessed quality.** A church-lens score from one consultant is not the same as one from three pastors plus a denominational leader. Sample size, role mix, prior familiarity, mother-tongue status, and "don't know" rates form a confidence/coverage layer.
6. **Process indicators travel; outcome perceptions are local.** For the strategist report, lean on process items (was external review done? are there ≥3 revision rounds?) when comparing across regions/methodologies. Outcome perceptions are still reported, but mainly through their *triangulation* across lenses rather than raw cross-project ranking.

---

## 2. Item-level schema (one row per question)

Every question in every form gets one row in the rubric spreadsheet with these columns:

| Column | Purpose |
|---|---|
| `item_id` | Stable code: `lens-form-Qnum` (e.g., `TR-Q1`, `ML-Q1`, `CA-Q4`, `CHCP-Q11`) |
| `lens` | `Translation Team` / `Community` / `Church` |
| `form_variant` | e.g., `Validation`, `Mid-Level`, `Written`, `Audio`, `Video-Sign`, `Consultant`, `Involved-Pastor`, `Community-Pastor`, `Denom-Leader` |
| `sub_dimension` | The parenthetical tag (e.g., `Translation Brief`, `Impactful`, `Affirmation`) |
| `question_text` | Verbatim, for traceability and reporting |
| `item_type` | `ordinal-scored` / `multi-capability-scored` / `multi-problem-scored` / `descriptive` / `open-text` |
| `option_values` | JSON: each option text → numeric score (or `null` for "don't know" / "Other") |
| `direction` | `best-first` / `worst-first` / `n/a` (sanity check) |
| `weight_in_subdim` | Default `1.0`. Override if some items are more central than others |
| `cross_lens_construct` | Tag if this item maps to a triangulated construct (e.g., `clarity`, `trust-readiness`, `consistency`) |
| `notes` | Edge cases, scoring rationale, version notes |

---

## 3. Item types and how each is scored

### 3.1 `ordinal-scored`
Single-select where options form a real better→worse continuum (most translator items, most community items, almost all church items).

- **Scoring:** Best option = 100; worst = 0; intermediate options linearly spaced. Formula: spacing = 100 ÷ (n − 1), rounded to the nearest integer.
- 5 options: 100 / 75 / 50 / 25 / 0
- 4 options: 100 / 67 / 33 / 0
- 3 options: 100 / 50 / 0
- **Missing (excluded from sub-dim mean):** "I don't have enough information to say," "We did not have a prior agreement so we cannot evaluate this," "Other (please describe)" without inferable mapping, or blank.

### 3.2 `multi-capability-scored`
Multi-select where checked options indicate *capability or practice coverage* (e.g., translator Q4 *exegetical resources*, Q12 *external reviewer types*, Q14 *consistency tools*, Q16 *oversight*; community Q8 *where used*).

- **Scoring:** Each option gets a non-negative weight. Score = (sum of weights of checked options) / (sum of all option weights, excluding any "we don't / none" option and excluding "Other"). Cap at 100.
- "Other (please describe)" never enters this math, checked or not: it can't lower the denominator's ceiling, and checking a real option alongside it scores identically to checking that real option alone. If "Other" is the *only* option checked, the item is excluded from scoring entirely (like ordinal items' "Other," flagged `missing`) rather than scored near-zero — an unlisted real practice isn't zero capability.
- The "we don't use any / no one" option is **mutually exclusive** with the others; if checked, score = 0.
- Weights are explicit in the rubric (not hidden) so the system stays defensible.

### 3.3 `multi-problem-scored`
Multi-select where checked options indicate *problems present* (e.g., community Q2 *what makes it hard*).

- **Scoring:** Score = 100 − (count of problems checked / count of total problem options × 100).
- "Other" describing an additional problem → counts as one more problem; check the open text first.

### 3.4 `descriptive`
Single-select or multi-select with no inherent better/worse — captures *what kind* of project this is (translator Q2 *translation type*, all participant-info fields, church Q3 *denominations active*).

- **Not scored.** Stored as a categorical attribute on the response, used as a filter and as context in the report.

### 3.5 `open-text`
Free-text (community Q6/Q12/Q13, "Other" descriptions everywhere).

- **Not scored.** Theme-coded post-hoc. Representative quotes surfaced in the team report. "Other" text is reviewed to see whether it should map to an existing option, indicate a new option, or simply be qualitative input.

---

## 4. Aggregation: items → sub-dimensions → lens

- **Sub-dimension score** = unweighted mean of normalized item scores within the sub-dimension (treating "missing" as excluded, not zero), then optionally adjusted by per-item `weight_in_subdim`.
- **Lens score** = unweighted mean of sub-dimension scores. *Not* the mean of all items — this keeps a six-item sub-dimension from dominating a two-item sub-dimension.
- **Overall project score** — *not* computed. The profile (six sub-dimension scores for translators, four for community, two-to-five for church depending on form) is the headline. If a single summary is needed externally, use **triangulated readiness** (§ 6) instead.

A sub-dimension is reportable only if **≥2 items in it have non-missing scores**. Below that threshold, report as "insufficient data."

---

## 5. Sub-dimension catalog (from the existing tags)

**Translation Team / Validation** (two respondent types, each with its own form):

*Translator form (TR):* five sub-dimensions
- Translation Process & Brief (TR-Q1, TR-Q3, TR-Q4, TR-Q5, TR-Q6, TR-Q7, TR-Q8; TR-Q2 is descriptive)
- Understanding the Source (TR-Q9, TR-Q10)
- External Review (TR-Q11, TR-Q12)
- Consistency (TR-Q13, TR-Q14)
- Governance (TR-Q15, TR-Q16, TR-Q17)

*Mid-Level Quality Roles form (ML):* four scored sub-dimensions + one single-item indicator
- Translation Process & Brief (ML-Q1, ML-Q3, ML-Q4, ML-Q5, ML-Q6, ML-Q7, ML-Q8; ML-Q2 is descriptive)
- Understanding the Source: **ML-Q10 only** *(single-item indicator — ML-Q9 excluded by design; ML-Q10 alone falls below the ≥2-item reportable threshold from § 4 and is reported as a standalone item, not a sub-dimension score)*
- External Review (ML-Q11, ML-Q12)
- Consistency (ML-Q13, ML-Q14)
- Governance (ML-Q15, ML-Q16, ML-Q17)

Mid-level roles covered by the ML form: Facilitator, Team Leader, Consultant-in-Training (CiT), Translation Advisor, or similar (captured via free-text "Other" if none of those fit). These are people between the drafting translators and the final approving consultant who contribute meaningfully to quality and can observe the process, but who are not the translation team itself. The ML form uses the same 17 questions as the TR form with two adjustments: (1) pronouns shifted from first-person ("your team") to third-person ("the team"); (2) Q9 ("How confident is your team in understanding the original text") excluded because mid-level roles cannot reliably self-report on translator source-text competence.

**Community / Reception** (four sub-dimensions, parallel across Written/Audio/Video-Sign):
- Understandable (Q1, Q2, Q3)
- Appealing — Written / Audio / Video-Sign (Q4, Q5)
- Impactful (Q7, Q8, Q9, Q10)
- Trust / Open Feedback (Q11; Q12 and Q13 are open-text)

**Church / Affirmation** (varies by form):
- *Consultant:* Confidence in the Translation (Q1–Q4), Readiness (Q5)
- *Involved Pastor / Denom Leader:* Translation Brief (Q1, Q2), Church Involvement (Q3, Q4, Q5), Confidence in the Translation (Q6, Q7), Affirmation (Q8, Q9, Q10)
- *Community Pastor:* Same as Involved Pastor + Impact Observation (Q11, Q12, Q13, Q14)

Note: *Church Involvement* Q3 (number of denominations active) is descriptive — it provides the denominator for Q4's score, not a score of its own.

---

## 6. Cross-lens triangulation map

The same construct is observed by multiple lenses. For these, we compute *both* the within-lens score *and* a cross-lens agreement metric.

| Construct | Translation Team item(s) | Community item(s) | Church item(s) |
|---|---|---|---|
| **Brief process & perceived fidelity** | TR-Q1; ML-Q1 (has a brief) | — | CHIP/CHCP/CHDL-Q2 (does the translation reflect the agreed type?) |
| **Translation type agreement** *(categorical, not triangulated — see below)* | TR-Q2; ML-Q2 (what type does the brief describe?) | — | CHIP/CHCP/CHDL-Q1 (what type did the community agree on?) |
| **Understanding of the source** | TR-Q9 *(ML-Q9 excluded — no ML contribution to this construct)* | — | CHCC-Q2, CHIP/CHCP/CHDL-Q7 |
| **Consistency** | TR-Q13 (practice); ML-Q13 | — | CHCC-Q3 (consultant confidence) |
| **Clarity / naturalness** | — | CW/CA/CV-Q1, -Q3 | CHIP/CHCP/CHDL-Q8 |
| **Appealing / beautiful** | — | CW/CA/CV-Q4, -Q5 | CHIP/CHCP/CHDL-Q9 |
| **Trust / readiness** | — | CW/CA/CV-Q11 | CHCC-Q4, CHCC-Q5, CHIP/CHCP/CHDL-Q10 |
| **Impact / use** | — | CW/CA/CV-Q9, -Q10 | CHCP-Q12, -Q13 |

**Triangulation metric (proposed):** For each cross-lens construct, normalize each contributing item to 0–100 within its lens, then compute:
- **Triangulated mean** = mean of available lens-level scores
- **Triangulation agreement** = 100 − (max − min across contributing lens scores). High value = lenses agree; low value = lenses disagree and the project warrants investigation.

Both numbers are reported. The strategist report leans on **triangulated readiness** as the single most-comparable cross-project metric.

**Translation type agreement is the one exception to this shape.** TR-Q2/ML-Q2 and CHIP/CHCP/CHDL-Q1 are `descriptive` items (a translation-type category, not a numeric judgment) — there is no lens-level score to normalize or average. It's reported as a categorical comparison instead: the actual set of types each side named, and whether the sets overlap at all. This was originally folded into "Translation Brief alignment" (pre-2026-08-13) under the assumption it would be triangulated the same way as everything else in this table; it wasn't, and the two were split apart once that gap was found (Decision #22).

---

## 7. Project-level fields (for strategist filtering)

**Revision (2026-06-02):** Field testing (Laos, March 2026) exposed a structural mismatch: the original flat record conflated project-level and language-level metadata. Many projects are *cluster projects* — one project umbrella covering multiple languages. These require a two-level structure. The unit of scoring, reporting, and strategist comparison is the **language**, not the project. A cluster of three languages contributes three data points to the strategist N.

---

### 7a. Project / cluster record (one per project)

Captured once and shared across all languages in the project. Does not vary by language.

| Field | Vocabulary | Source |
|---|---|---|
| `project_id` | Internal | Project registry |
| `project_name` | Free | Project registry |
| `region` | Controlled list (§ 11.1) — continent + sub-region | Project registry |
| `country` | ISO 3166 | Project registry |
| `lead_organization` | Controlled list (§ 11.4) | Project registry |
| `partner_organizations` | Multi-select (§ 11.4) | Project registry |

---

### 7b. Language / assessment record (one per language per cycle)

Linked to the project record via `project_id`. A single-language project has exactly one language record. A cluster project has one per language.

| Field | Vocabulary | Source |
|---|---|---|
| `language_id` | Internal — unique per language within a project | Project registry |
| `target_language_iso` | ISO 639-3 | Project registry |
| `language_name` | Free | Project registry |
| `dialect` | Free (optional) | Project registry |
| `cycle_date` | ISO date | This assessment |
| `scripture_portion` | Controlled list — book(s), or NT/OT/full | Each cycle |
| `medium` | `written` / `audio` / `video-sign` / `multi` (§ 11.2 Field E) | Each cycle |
| `drafting_source` | Controlled list (§ 11.2 Field A) | Each cycle |
| `drafting_modality` | Controlled list (§ 11.2 Field B) | Each cycle |
| `advisor_locus` | Controlled list (§ 11.2 Field C) | Each cycle |
| `church_role` | Controlled list (§ 11.2 Field D) | Each cycle |
| `publication_state` | Controlled list (§ 11.3 Field A) | Each cycle |
| `verification_milestones` | Multi-select (§ 11.3 Field B) | Each cycle |

**Note on methodology fields within a cluster:** In most cluster projects all languages share the same drafting_source, drafting_modality, advisor_locus, and church_role. These fields sit at the language level because they *can* vary (e.g., one language oral-internalisation, another text-based within the same project umbrella), and the language is the unit of comparison. Where they are identical across languages in a cluster, strategist reports should note the cluster size to avoid implicit double-counting.

---

### 7c. Form response levels

Most questionnaire responses are collected and reported at the **language level**. Exception:

| Form | Level | Rationale |
|---|---|---|
| Translators / Validation (TR) | Language | Translators work on one language |
| Mid-Level Quality Roles (ML) | Language | Mid-level roles are language-team-specific |
| Community — Written/Audio/Video-Sign | Language | Reception is language-specific |
| Church — Translation Consultant | Language | Consultant checks a specific language |
| Church — Involved Pastor | Language | Pastor relationship is language-community-specific |
| Church — Community Pastor | Language | Same |
| Church — Denominational Leader | **Project** | Denom leader's affirmation covers the whole project / cluster; they should not be required to fill out a separate form per language |

For Denom Leader responses in cluster projects: one response is collected and linked to the project record. It contributes to the Church lens score for each language in the cluster unless the respondent specifies otherwise.

**Decisions outstanding:** `region` still needs a controlled vocabulary before strategist comparisons are meaningful. (Methodology resolved into five axes 2026-06-01 — see § 11.2. Maturity resolved 2026-05-11 — see § 11.3.)

---

## 8. Evidence-quality / coverage layer

Tracked per lens per **language** per cycle, alongside scores (see § 7 — the language is the unit of analysis, not the project):

- **Translation Team lens:** tracked separately per respondent type.
  - *Translator (TR) respondents:* number of team members present, role coverage (lead, drafter, reviewer, consultant), education distribution.
  - *Mid-Level (ML) respondents:* number of respondents, role types represented (Facilitator / Team Leader / CiT / Translation Advisor / Other), organizational affiliation, how long each has been working with the translation team, mother-tongue status relative to the receptor language.
- **Community lens:** number of respondent groups (across written/audio/video-sign), total participants, selection method (random / purposive / church-based / community-nominated), settings represented (city/town/village), age range coverage, gender mix.
- **Church lens:** number of role types represented (consultant, involved pastor, community pastor, denominational leader), accreditation of consultant (UBS/SIL/other/none), mother-tongue status of consultant, prior familiarity distribution, denominational diversity of pastors.
- **"Don't know" / "no prior agreement" rate** per lens per sub-dimension. High rate = low visibility, flag for reporting.

These never count toward the score, but every report shows them next to the score so the reader can weight accordingly.

---

## 9. Two reports, one data set

**Team self-assessment (purpose 1)**
- Profile chart per lens (radar or bar) showing sub-dimension scores 0–100.
- Triangulation panel: for each cross-lens construct, show all contributing lens scores side-by-side; flag mismatches.
- Open-text themes from community Q6/Q12/Q13 with representative quotes.
- Weakest 3 items called out with verbatim question + answer mapped, so the team sees *exactly what to change*.
- (Future cycles) Delta from last cycle on each sub-dimension.

**Strategist comparison (purpose 2)**
- Distributions of sub-dimension scores within each filter cut (region / methodology / maturity / portion / organization).
- Triangulation agreement distribution — languages where the three lenses *agree* on quality (high or low) vs. where they diverge.
- Process indicators as binary or ordinal flags rolled to language level (documented brief? external review at key stages? ≥3 revision rounds? structured community feedback? consultant approval?).
- Evidence-quality summary per language (so segments aren't compared apples-to-oranges).
- No language-vs-language ranking. The unit of comparison is the *segment*, not the individual language. Cluster projects are noted as such.

---

## 10. Example rows (illustrative, not authoritative)

| item_id | sub_dimension | item_type | option_values (JSON-ish) | notes |
|---|---|---|---|---|
| `TR-Q1` | Translation Brief | ordinal-scored | `documented:100, shared-undocumented:67, working-on:33, other:null` | Drop "Other" unless inferable |
| `TR-Q2` | Translation Brief | descriptive | (translation type — Corresponding / Resembling / Clarifying / Simplifying) | Filter, not score |
| `TR-Q4` | Translation Process | multi-capability-scored | `original:3, interlinear:2, commentaries:2, handbooks:2, back-translations:1, national:1, other-widely-spoken:1` | Weights reflect exegetical depth |
| `TR-Q8` | Translation Process | ordinal-scored | `3+:100, 2:67, 1:33, no-standard:0` | "No standard" = lowest |
| `CW-Q2` | Understandable | multi-problem-scored | each problem checked subtracts | "Other" counts only if a new problem |
| `CW-Q11` | Trust / Open Feedback | ordinal-scored | `trust-completely:100, mostly:67, not-sure:33, not-trust:0` | Cross-lens: `trust-readiness` |
| `CHCC-Q5` | Readiness | ordinal-scored | `bless:100, adjustments:50, not-yet:0` | Cross-lens: `trust-readiness` |
| `CHIP-Q1` | Translation Brief | descriptive | translation type expected | Compare with TR-Q2 for alignment |
| `CHCP-Q12` | Impact Observation | ordinal-scored | `many-testimonies:100, some-share:50, no-effect:0` | Cross-lens: `impact-use` |

---

## 11. Controlled vocabularies (strawman — for review)

These are *proposed starting points*, not final lists.

**Framing note (2026-05-11):** Vocabularies are intentionally **organization-neutral** — the instrument is intended to work across the ecosystem (Wycliffe, Unfolding Word, Bible Societies, Seed Company, and others), not within any single agency's operational structure. Where SIL-specific terminology or org-specific stage models would constrain the framework, generic categories are preferred.

### 11.1 Region

Two-level: top-level region + optional sub-region. Top-level is the required filter; sub-region is for finer cuts.

| Code | Region | Sub-regions (codes) |
|---|---|---|
| `AFR` | Africa | `AFR-W` West, `AFR-C` Central, `AFR-E` East, `AFR-S` Southern, `AFR-N` North |
| `AME` | Americas | `AME-N` North, `AME-C` Central & Caribbean, `AME-S` South |
| `ASI` | Asia | `ASI-S` South, `ASI-SE` Southeast, `ASI-E` East, `ASI-C` Central |
| `EUR` | Europe | (no sub-regions proposed) |
| `MENA` | Middle East & North Africa | overlaps with `AFR-N` — pick one for North African languages |
| `PAC` | Pacific / Oceania | `PAC-MEL` Melanesia, `PAC-POL` Polynesia, `PAC-MIC` Micronesia, `PAC-ANZ` Australia & NZ |

**Open questions:** Does SIL have an existing Areas structure we should mirror? How is the MENA / North-Africa overlap resolved operationally?

### 11.2 Methodology — multi-axis

**Revision (2026-05-12):** Earlier draft used a single flat list (`consultant-expat / consultant-mtt / mobilized-fast / church-centric / oral-primary / ai-assisted / hybrid`). That list quietly conflated four orthogonal axes — drafting source, drafting modality, advisor locus, and product modality — and forced one choice when real projects vary independently along each. A typology proposed for LPM use (*Possible typology of translation approaches that would be useful for LPMs*, May 2026) decomposes methodology along similar axes, with each project getting a value per axis rather than a single approach label. Adopting that multi-axis structure here.

**Revision (2026-06-01):** Further restructuring: (1) `oral-internalisation` moved from Field A to Field B — it describes a drafting modality, not a source text; `oral` removed from Field B as subsumed. (2) Field C changed to multi-select; `church-based` and `mixed` removed — church role is now its own axis. (3) New Field D (`church_role`) added with six codes spanning frontier through church-centric, including `discipleship-network` for emerging faith communities not yet constituted as formal churches. (4) Former Field D (`product_modality`) renumbered Field E.

**Pilot N caution.** Multi-axis filtering multiplies bucket combinations. With pilot N in the dozens, the strategist report (§ 9) should cut **one axis at a time**, not joint. Joint cuts (e.g., `drafting_source` × `advisor_locus`) wait until total N supports them (~100+ languages). Until then, joint cuts produce anecdotes, not comparisons. Note: the unit of N is the **language**, not the project — a cluster project with three languages contributes three to the N (see § 7).

**Orthogonality with TR-Q2.** "Translation Type" (Corresponding / Resembling / Clarifying / Simplifying, captured in translator Q2) describes the intended *stance* toward the source — fidelity vs. clarity — not methodology. The two taxonomies are orthogonal: an AI-drafted project may be Resembling or Clarifying; an FIA project may be any of the four. Reports should not collapse them.

**Ownership is captured elsewhere.** The typology document deliberately separates *how the work is done* from *who manages it*. Project ownership and partner structure live in § 7 (`lead_organization`, `partner_organizations`) and the vocabulary in § 11.4 (including `local-church`, `national-church-body`, `community-based`). The four axes below describe the work itself.

**Field A — `drafting_source`** (single-select; what the draft text or recording derives from):

| Code | Source |
|---|---|
| `original-languages` | Original-language exegesis (Greek / Hebrew / Aramaic) |
| `lwc-text` | LWC (Language of Wider Communication) translation as primary source |
| `related-language-text` | Adaptation from a closely-related language translation |
| `ai-llm` | AI / Large Language Model drafting, followed by human review |
| `computer-rule-based` | Rule-based or trained computer drafting (e.g., NT-trained tool drafting OT) |
| `mixed` | Different books or stages use different sources |
| `unknown` | Not captured at intake |

**Field B — `drafting_modality`** (single-select; the work-mode of producing the draft):

| Code | Modality |
|---|---|
| `text-based` | Team exegetes written source text and produces written drafts |
| `oral-internalisation` | Team familiarises with and internalises source material, then retells orally or in sign (FIA / storying / performance-based drafting). Moved here from Field A — this describes *how the team works*, not which source text they draw from |
| `signed` | Sign-language video drafting not involving prior oral internalisation |
| `mixed` | Combines text-based and oral-internalisation / signed at different stages |
| `unknown` | Not captured at intake |

`drafting_modality` is *how the team works*; `medium` (§ 7) is *what gets published*. A team may draft via oral internalisation and publish in print, or draft in text and publish in audio. Capture both.

**Field C — `advisor_locus`** (multi-select; who provides expert review and approval — select all that apply):

| Code | Locus |
|---|---|
| `external-expat-consultant` | External consultant who is not a mother-tongue speaker of the receptor language |
| `external-mtt-consultant` | External consultant who is a mother-tongue or near-mother-tongue speaker |
| `local-advisor` | Local expert (often mother-tongue) advises throughout; no external consultant in the standard sense |
| `unknown` | Not captured at intake |

Church-based affirmation is captured in Field D (`church_role`), not here. `mixed` is removed as redundant — multi-select already handles projects where both an external consultant and a local advisor are involved.

**Field D — `church_role`** (single-select; the role of the faith community in the translation process):

| Code | Role |
|---|---|
| `frontier` | Little or no faith community yet exists in the receptor language group; translation is pioneering work |
| `discipleship-network` | An emerging or informal network of disciples exists but is not a formally constituted church; this community participates in QA |
| `church-minimal` | Established church exists but engagement is limited to structured community testing; process is consultant/team-driven |
| `church-participatory` | Established church actively involved throughout drafting and review; final authority rests with a credentialed consultant |
| `church-centric` | Church community drives and owns the process; translation is an explicit church-formation activity; affirmation authority rests with the church body |
| `unknown` | Not captured at intake |

Note: `frontier` + `external-expat-consultant` or `external-mtt-consultant` in Field C is a diagnostic combination for strategists — it describes pioneering work where no local faith community yet holds QA capacity.

**Field E — `product_modality`** — already captured in § 7 as `medium` (`written` / `audio` / `video-sign` / `multi`). Kept there to avoid duplication; listed here for completeness as the fifth methodology axis.

**Optional derived `methodology_label`** — for reports that need a single categorical column, the five axes can be mapped to one of the following prototypes. Field D (`church_role`) now enables splitting the two FIA variants that the earlier list collapsed:

- *oral-signed storying*
- *adaptation / revision*
- *computer or AI drafting*
- *performance-based drafting — external consultant model* (`oral-internalisation` + `church-participatory`)
- *performance-based drafting — church-centric model* (`oral-internalisation` + `church-centric`)
- *text-based drafting*

Mapping rules are deferred — the five axes are the authoritative data; the label is convenience only.

**Open questions:**
- Whether to surface the typology's "intended audience and context" framing (translator literacy assumed, church capacity) as its own project-level field, or leave implicit in `church_role` (Field D) and `verification_milestones` (§ 11.3).
- For `drafting_modality: mixed` projects, whether to add a free-text note field describing the mix, or rely on the evidence-quality layer (§ 8).
- Whether `advisor_locus` codes should track *accreditation* (UBS / SIL / other / none) — currently in the § 8 evidence layer; could promote here.
- The LPM typology's "Video" question (translation-of-scripture-product vs. translation-proper, per Greg C's note) — deferred.

### 11.3 Maturity

**Revision (2026-05-11):** Earlier draft used a linear single-stage taxonomy. That boxes out MAST (rapid workshop drafting that combines drafting + internal review + community testing in a single event) and CCBT / Church-Centric Bible Translation (where church/community testing happens *during* drafting, not after). Replacing with two orthogonal fields so the framework is methodology-agnostic.

**Field A — `publication_state`** (single-select, mutually exclusive):

| Code | State |
|---|---|
| `pre-publication` | Not yet released for general use |
| `published` | Released for community / church use |
| `published-revising` | Released, but a revision cycle has reopened |

**Field B — `verification_milestones`** (multi-select; methodology-agnostic flags. Order does not matter — projects accumulate flags in whatever sequence their methodology dictates):

| Code | Milestone |
|---|---|
| `team-reviewed` | Internal team has cross-checked the portion under assessment |
| `community-tested-1` | Community testing has occurred (at least one round) |
| `community-tested-multi` | Multiple community testing rounds completed |
| `external-reviewed` | External review completed — consultant, denominational leader, peer-language team, or other outside reviewer (methodology-agnostic) |
| `church-affirmed` | Church / denominational body has formally affirmed for use |

**Derived single-stage view** (computed from the two fields, for reports that need one categorical cut):

| Derived stage | Rule |
|---|---|
| `drafting-only` | `pre-publication` + no verification milestones |
| `in-verification` | `pre-publication` + ≥1 verification milestone, missing `external-reviewed` or `church-affirmed` |
| `pre-publication-ready` | `pre-publication` + `external-reviewed` and/or `church-affirmed` |
| `published` | `published` |
| `revising` | `published-revising` |

This way: a MAST workshop output can be `pre-publication` + `[team-reviewed, community-tested-1]` after a single event. A CCBT project might reach `[community-tested-multi, church-affirmed]` before any "external" check, because the community/church *is* the affirming body. Neither is forced into a sequence the methodology doesn't follow.

**Open question:** Does `church-affirmed` need finer-grained options (e.g., distinguishing single-denomination vs. multi-denomination affirmation)? Could borrow from Church-lens Q4 (denominational involvement).

### 11.4 Organization

Two fields. `lead_organization` names the project's primary owning agency; `partner_organizations` is multi-select for all partners involved. Both pull from the same vocabulary.

The vocabulary below is organized around **ETEN / illumiNations principal partners** (the coalition driving global Bible translation strategy), plus Unfolding Word and its aligned partners (which sit somewhat outside ETEN), plus structural categories for non-agency contributors.

**ETEN / illumiNations principal partners** (per Claude's recall, May 2025 knowledge — Steve to verify currency):

| Code | Organization |
|---|---|
| `abs` | American Bible Society |
| `biblica` | Biblica |
| `deaf-bible-society` | Deaf Bible Society |
| `fcbh` | Faith Comes By Hearing (Hosanna!) |
| `lbt` | Lutheran Bible Translators |
| `pbt` | Pioneer Bible Translators |
| `sil` | SIL International (or SIL national affiliate) |
| `seed-company` | The Seed Company |
| `ubs` | United Bible Societies (or member Bible Society) |
| `unfolding-word` | unfoldingWord |
| `wycliffe-usa` | Wycliffe Bible Translators USA |
| `wycliffe-ga` | Wycliffe Global Alliance (and member organizations) |
| `youversion` | YouVersion / Life.Church |
| `word-for-the-world` | Word for the World |

**Additional agencies** *(Steve to confirm placement):*

| Code | Organization |
|---|---|
| `wycliffe-associates` | Wycliffe Associates (MAST / CCBT mobilization) |

**Structural categories** (for projects whose lead is not a major agency):

| Code | Category |
|---|---|
| `local-church` | Local church or church network as project lead |
| `national-church-body` | National denomination or church body |
| `discipleship-network` | Informal discipleship network as project lead — not yet a formally constituted church |
| `community-based` | Secular or non-ecclesiastical community group with no formal agency lead |
| `other-agency` | Other translation agency (specify in free-text) |

*Note: §11.4 describes organizational ownership — who leads and is accountable for the project. §11.2 Field D (`church_role`) describes the methodological role of the faith community in the translation process. These are orthogonal: a `local-church` lead may run a project with any `church_role` value, and an agency-led project may be `church-centric` in methodology.*

**Open questions:**
- This list is biased toward the Anglophone Bible translation ecosystem. Regional and non-Anglophone partners (e.g., agencies primarily operating in Latin America, francophone Africa, Asia) are likely missing. Steve to add.
- ETEN partner list evolves; verify against current illumiNations roster.
- Should partners affiliated with both ETEN and Unfolding Word movements be tagged with both codes (multi-select on partners), or is `lead_organization` always a single primary affiliation?

---

## 12. Decisions log

| # | Decision | Date | Status |
|---|---|---|---|
| 1 | Do not produce a single composite quality score | 2026-05-11 | Confirmed |
| 2 | Adopt design principles 1–5 in § 1 | 2026-05-11 | Confirmed |
| 3 | Translation Brief sub-dim → merge into Translation Process | 2026-05-11 | Confirmed |
| 4 | Methodology / region / maturity / org vocabularies → invent together | 2026-05-11 | Pending vocab definition |
| 5 | Multi-media community responses → report each medium separately *and* aggregate at the lens level | 2026-05-11 | Confirmed |
| 6 | Normalize to 0–100 (internal math); display raw answer text in team reports | 2026-05-11 | Confirmed |
| 7 | Weighting within sub-dimensions: equal to start, revisit after pilot | 2026-05-11 | Pending |
| 8 | "Other (please describe)" → exclude from score, review qualitatively | — | Proposed |
| 9 | Triangulation agreement formula (range vs. variance) | — | Pending |
| 10 | Translation Brief sub-dim merged → "Translation Process & Brief" | 2026-05-11 | Confirmed |
| 11 | Maturity model split into orthogonal `publication_state` + `verification_milestones` | 2026-05-11 | Confirmed |
| 12 | Vocabularies organized around ETEN/illumiNations + Unfolding Word ecosystem, not SIL | 2026-05-11 | Confirmed |
| 13 | v0.1 rubric spreadsheet built — 95 items, 409 options across 8 forms | 2026-05-11 | Delivered |
| 14 | Methodology field replaced with four orthogonal axes (`drafting_source` / `drafting_modality` / `advisor_locus` / `product_modality`) per LPM typology document. Strategist report restricted to single-axis cuts until N ≥ ~100. | 2026-05-12 | Confirmed |
| 15 | "Translators" lens renamed "Translation Team." New Mid-Level Quality Roles form (ML) added as a second respondent type under that umbrella, covering Facilitator, Team Leader, CiT, Translation Advisor, Quality Checker, Trainer. ML form = TR form with pronouns shifted to third-person and Q9 excluded. ML-Q10 (Understanding the Source) reported as single-item indicator only, not a sub-dimension score. XLSX rubric to be updated: 9 forms, ~111 items. Prompted by Laos field testing, March 2026; proposed by Teryl Gonzalez, May 2026. | 2026-06-01 | Confirmed |
| 17 | §7 restructured into two levels: Project/cluster record (project_id, name, orgs, region, country) and Language/assessment record (all language-specific fields — ISO code, language name, dialect, cycle_date, scripture_portion, medium, methodology axes, maturity). Denominational Leader responses designated project-level; all other forms remain language-level. Strategist N counts languages, not projects. Prompted by Laos cluster-project field test (March 2026). | 2026-06-02 | Confirmed |
| 18 | TR-Q10 and ML-Q10 ("When the team encounters a difficult exegetical question, what do they do?") changed from `ordinal-scored` to `multi-capability-scored`. A team may use multiple strategies simultaneously. Weights: consult-trained 4, research-resources 3, team-discuss 2, follow-others 1, leave-it 0. | 2026-06-04 | Confirmed |
| 19 | Facilitator prefill role label for TR form: use generic "Translator", not "Mother-Tongue Translator" / "MTT". Not all drafters in cluster projects are mother-tongue speakers of the receptor language. | 2026-06-04 | Confirmed |
| 16 | §11.2 Methodology restructured: `oral-internalisation` moved from Field A to Field B (it is a modality, not a source); `oral` removed from Field B as subsumed. Field C changed to multi-select; `church-based` and `mixed` removed. New Field D (`church_role`) added — six codes: `frontier`, `discipleship-network`, `church-minimal`, `church-participatory`, `church-centric`, `unknown`. Former Field D (`product_modality`) renumbered Field E. `church_role` added to §7 project-level fields. Derived methodology_label extended to six prototypes, separating the two FIA variants. | 2026-06-01 | Confirmed |
| 20 | §7c Denominational Leader cluster broadcast, implemented in the survey pipeline: rather than auto-detecting which cycle of each sibling language a response should count toward (ambiguous once a language can have several independent assessment cycles), an analyst maps one Denom Leader `submission_id` to multiple `assessment_id`s by hand in `data/reference/submission_assessment_map.csv` — one row per sibling language's current cycle. Broadcast is therefore analyst-curated per response, not automatic cluster-wide propagation. | 2026-08-13 | Confirmed |
| 21 | Decision #8 ("Other" excluded from score) confirmed for `multi-capability-scored` items specifically: "Other" is excluded from both the numerator and denominator of the weighted-fraction score (so it can no longer create an unreachable ceiling below 100 on TR/ML-Q4/-Q10/-Q12/-Q14/-Q16), and an answer where "Other" is the *only* checked option is excluded from scoring entirely (`None`), matching ordinal items' existing "Other" treatment, rather than scored near-zero. `multi-problem-scored`'s "Other" (§3.3 — counts as an additional problem) is intentionally unaffected and still open under #8. | 2026-08-13 | Confirmed |
| 22 | §6's "Translation Brief alignment" construct split into two: "Brief process & perceived fidelity" (TR/ML-Q1 vs CHIP/CHCP/CHDL-Q2 — the numeric triangulation that was actually being computed all along) and "Translation type agreement" (TR/ML-Q2 vs CHIP/CHCP/CHDL-Q1 — the categorical name-the-same-type comparison the original construct's own description promised but never computed, since those items are `descriptive` and never scored). Implemented in the survey pipeline as a separate categorical rollup (`TranslationTypeAgreement`), not a `CrossLensScore`. | 2026-08-13 | Confirmed |
| 23 | ML participant-information role field simplified: the six-role checkbox list (Facilitator, Team Leader, CiT, Translation Advisor, Quality Checker, Trainer) caused confusion in the online questionnaire. Reduced to "Facilitator, Team Leader, Consultant-in-Training, Translation Advisor, or similar" — Quality Checker and Trainer dropped as separate checkboxes and folded into the existing free-text "Other" option. Not a scored field, so no rubric/CSV scoring impact — participant-info metadata only. "CiT" abbreviation retained in internal rubric shorthand and reports; questionnaire-facing text spells out "Consultant-in-Training." Prompted by 3D team meeting feedback, August 2026. | 2026-08-17 | Confirmed |
| 24 | §6's "Impact / use" cross-lens construct trimmed from 13 contributing items to 8: `CW/CA/CV-Q7` (community's own use-frequency) and `CHCP-Q11`/`CHCP-Q14` dropped, keeping only `CW/CA/CV-Q9`/`-Q10` (community emotional/behavioral impact) vs. `CHCP-Q12`/`-Q13` (matching pastor-observation wording). `CHCP-Q11` ("How often do you yourself use this translation?") scores the pastor's *own* ministry language choice (daily-preach / mixed / national-only), not an observation of congregational use — it was never a valid counterpart to `CW-Q7`'s community-level frequency question. `CHCP-Q14` ("Have you noticed any changes...") is a general catch-all with no Community-side item to compare against. Both remain scored within Church's own Impact Observation sub-dimension; they're excluded only from this specific cross-lens triangulation, whose whole premise is comparing matched self-report/observation pairs. Surfaced investigating a request to check the impact-use triangulation for bias; found alongside a separate, already-fixed pipeline bug where a construct with data from only one lens was reporting `agreement=0.0` (misreading as perfect agreement) instead of `None`. | 2026-08-17 | Confirmed |
