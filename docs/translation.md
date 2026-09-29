# Dynamic translation (participant survey)

Captain rulings, 2026-09-28:
- "Just proxy the translation strings." Every Lovable build of 3D Review, including the Laos field app, translated the
  survey on the fly (`TranslationContext` + `translate-survey`). The Cloudflare rebuild dropped it. This restores it.
- The language drop-down is **limited to the LWCs (languages of wider communication) set on the project and/or the
  assessment**, and only those the translation model supports.
- Caching/deterministic storage of translation strings in Cloudflare (D1/KV) is acceptable.

## What participants see
- A **Language** drop-down above the survey offering **English + the survey's LWCs only** (assessment's first, then the
  project's; at most 8). Labels are endonym · English name (e.g. `ລາວ · Lao`). No LWCs set → no drop-down.
- Questions, answer choices, About-you fields and page words switch language; any string without a translation stays
  English. A note says it is machine translation; for languages flagged `review` it says "not yet checked by a speaker".
- `?lang=<tag>` pre-sets it (e.g. `https://dev.3dreview.app/?lang=lo#survey=link_…`), honoured only if the survey offers
  it. The device remembers the last choice. Urdu/Arabic render right-to-left.
- **Display only.** Item ids and option codes never change: answers, scores, reports and exports are exactly as before.

## Where facilitators set the languages
- **Setup step 1** ("Languages participants read (machine translation)") — saved on the assessment, and also on the
  project when the wizard creates a new project.
- **Prepare** view of an existing assessment (owners/members) — same checkboxes, saved with Save preparation.
- API: `lwc` (list of BCP 47 tags, or `"lo,th"`) on `cap.project.create|update` and `cap.assessment.create|update`;
  `cap.response.form` returns `languages: [{code, name, endonym, dir, review}]`.
- Supported table: `src/languages.ts` (browser mirror `ui/v3/lwc.js`; a test keeps them identical). 25 tags: 24
  machine-translated languages — lo th km my vi id ms fil zh-Hans hi mr ne bn or kn ta te si ur ar sw fr es pt — and
  `ins` (Indian Sign Language), which is recorded as an LWC but never machine-translated (`mt: false`: not in the
  participant picker, refused by `/v2/translate`). `review: true` for lo km my ne or kn si (and ins).

## Server: `POST /v2/translate` (src/translate.ts)
- Request `{ targetLang: <supported tag or English name>, context, sourceTexts: {key: english} }` →
  `{ translated, partial, locale, review, stored }`. Anonymous, `RL_HTTP_ANON`, size limits (600 strings, 2,000 chars
  each, 150k total). Unsupported language → 400. English returns the input unchanged.
- **Published strings only** (reviewer FAIL on #377, F1/F2; `src/translate-allowlist.ts`). `context` must be
  `participant-ui` or `participant-form:<template id>`. Only strings whose SHA-256 matches that scope's published set are
  translated and stored: the participant page's own words (mirror of `ui/participate/i18n.js` UI_EN, the page words, the
  practice wording and the welcome sentences for existing language names; a test keeps the mirror equal) or the item
  texts and choice labels of the **published** versions of that instrument plus the About-you fields. Anything else is
  refused (`400 not_published`, or omitted with `refused: n` and `partial: true`): never sent upstream, never stored,
  never served. The upstream receives a context the server builds from the verified scope, never the caller's text.
- **Language names are member-authored**, so the welcome sentence that carries one is allowlisted only when the name has a
  strict shape (≤ 60 characters, ≤ 6 words, Unicode letters/marks/spaces/hyphen/apostrophe/parentheses; names read in
  name order, at most 5,000). Each such sentence goes upstream **in its own request** (at most 2 per call), never in the
  same batch as the page words shared by every project (security review on #377, finding e).
- **Translation memory in D1** (`translation_memory`, migration 0012), keyed by `(locale, SHA-256 of the exact English
  text)`. A string is translated **once**, stored, and served from storage forever (first write wins; never regenerated
  on read — LLM output is not reproducible, storage is). Only strings the memory lacks go upstream. Status:
  `machine` / `reviewed` / `rejected` (rejected rows are never served and are replaced by the next translation).
- **Output checks before storing:** non-empty, plausible length, and in the target script for non-Latin languages
  (a Lao request that comes back in Latin letters is not stored or served).
- **Upstream** = `TRANSLATE_UPSTREAM_URL` (wrangler.toml, DEV + production) = the Laos app's live `translate-survey`
  function (Lovable AI gateway → Gemini, with its own cache); optional `TRANSLATE_UPSTREAM_KEY` secret. It receives only
  English source strings — never answers, names, codes or tokens.
- **Without migration 0012** everything still works: the form offers no languages (no `lwc_json` yet), `/v2/translate`
  runs as a stateless proxy for the page words only (instrument strings need D1 to be checked), and saving LWCs answers "needs database update 0012 first".
- First use of a language for a survey takes ~10–25 s (the upstream translates in chunks of 20); after that it is served
  from D1 instantly. **Warm it before a field session**: open the survey once in each language.

## Research and prior art (sources checked 2026-09-28)
- **Survey translation standard is TRAPD** (Translation, Review, Adjudication, Pretesting, Documentation), team-based;
  back-translation is no longer recommended; machine translation of items needs careful review and adjudication
  (Cross-Cultural Survey Guidelines, https://ccsg.isr.umich.edu/chapters/translation/overview/; ESS,
  https://www.europeansocialsurvey.org/methodology/translation).
- MT + human post-editing inside TRAPD reached quality hard to tell from human translation (EN→DE/RU; Zavala-Rojas et al.,
  POQ 2024, https://academic.oup.com/poq/article/88/1/123/7636611); uncorrected MT errors caused systematic bias in
  responses (Tsai et al., JSSAM 2026, https://academic.oup.com/jssam/advance-article/doi/10.1093/jssam/smag029/8789599).
  No study found for LLM questionnaire translation into Lao/Khmer/Burmese/Odia.
- **Localization practice:** BCP 47 tags (https://www.w3.org/International/articles/language-tags/); endonyms (static here;
  Intl.DisplayNames coverage in Workers unverified and it lacks e.g. S'gaw Karen); stable keys and content hashes
  (FormatJS); explicit fallback chains (i18next); XLIFF 2.0 states initial/translated/reviewed/final.
- **Prior art for MT + memory:** Lingo.dev lockfile (SHA-256 of source, only changed strings re-translated,
  https://lingo.dev/en/docs/cli/lockfile); Weblate/Tolgee/Crowdin mark machine vs reviewed, flag outdated translations when
  the source changes, and can restrict memory to approved strings (https://docs.weblate.org/en/latest/admin/memory.html,
  https://docs.tolgee.io/platform/translation_process/translation_states).
- **Model support:** Vertex AI lists Lao, Khmer, Myanmar, Nepali, Odia, Sinhala, Tamil, Telugu, Urdu, Thai, Vietnamese,
  Hindi, Bengali, Indonesian as supported by all Gemini models (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models);
  Firebase docs conflict for older models. General LLMs trail classic MT for most low-resource languages
  (https://aclanthology.org/2023.wmt-1.40/) — hence the `review` flag.
- **Cloudflare storage:** D1 is strongly consistent (free: 5M reads / 100k writes per day; queries fail past the daily
  free limits since 2026-09-01); KV is eventually consistent (~60 s) with 1 write/s per key; Cache API is per-colo only
  (https://developers.cloudflare.com/d1/platform/pricing/, https://developers.cloudflare.com/kv/concepts/how-kv-works/).
  So D1 is the source of truth; KV/Cache are not used for the memory.

## Next (not in this change)
- **Freeze per survey version:** snapshot the translated bundle at Launch and record `locale` + snapshot with each response
  (TRAPD "Documentation"; lets a report say which wording a participant saw).
- **Review workflow:** a screen for a bilingual reviewer to mark strings `reviewed`/`rejected` and edit them; a per-language
  glossary (survey + Bible-translation terms) sent with the prompt; placeholder checks.
- **Pre-warm on Launch** (translate every string for the chosen LWCs once), and an optional second provider for languages
  where Gemini is weak (Cloud Translation NMT; Workers AI IndicTrans2 for Indic languages).
- **Fonts:** Noto subsets per script; Burmese Zawgyi detection (https://github.com/google/myanmar-tools).
- README "Rules carried" lists **no Supabase**: the upstream is the Laos app's Supabase function (captain ruled "proxy").
  Swapping it is one config value.
