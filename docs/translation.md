# Dynamic translation (participant survey)

Captain ruling 2026-09-28 (~20:40 ET): "Just proxy the translation strings." Every Lovable build of 3D Review, the
Laos field app included, translated the participant survey on the fly. The Cloudflare rebuild dropped it. This restores it.

## How it works
- **Participant page** (`ui/participate/page.js`, helpers in `ui/participate/i18n.js`): a **Language** picker sits above
  the survey. Choosing a language sends the page's English strings to `POST /v2/translate` in two requests (page words;
  this survey's questions, choices and About-you fields) and redraws with what comes back. Anything missing stays English.
  A line under the picker says it is machine translation. Complete answers are cached on the device (localStorage) per
  language + survey, so a second visit is instant and works if the proxy is slow.
- **Pre-set language in a link:** add `?lang=<Language>` before the `#survey=` part, e.g.
  `https://dev.3dreview.app/?lang=Lao#survey=link_…`. The root route carries `?lang=` into `/participate/`.
  The device remembers the last choice.
- **Display only.** Item ids and option codes never change, so answers, scores, reports and exports are exactly as
  before (and stay English). Validation messages, the review page and the receipt heading use the chosen language.
- **Proxy** (`src/translate.ts`): same wire shape as the Laos app's `translate-survey` Supabase function —
  `{ targetLang, context, sourceTexts }` → `{ translated, partial }`. Anonymous, metered on `RL_HTTP_ANON`, size-limited
  (600 strings, 2,000 chars each, 150k total), returns only requested keys, caches complete answers in the Workers Cache
  API for a day. English returns the input unchanged without a call.
- **Configuration, not code:** `TRANSLATE_UPSTREAM_URL` (wrangler.toml var, DEV and production) points at the Laos app's
  `translate-survey` function, which is live and needs no key. Optional `TRANSLATE_UPSTREAM_KEY` (secret) is sent as
  `Bearer` + `apikey` if an upstream needs one. Unset URL → `503 translation_unavailable`; the page says so and stays English.

## Open for the captain
- README "Rules carried" lists **no Supabase**. The upstream is the Laos Lovable app's Supabase function (Lovable AI
  gateway → Gemini, with its own translation cache). It is one config value; any service with the same wire shape can
  replace it (e.g. a Workers AI route) without touching the page.
- What leaves the Worker: survey wording and page words only. No answers, names, codes or tokens are sent upstream.
- Machine translation is not a reviewed translation of the instrument. Facilitators should still read aloud or check
  wording with a speaker where it matters.
