import { lwcByCode, MAX_LWC } from '../v3/lwc.js';
import { fetchTranslationsProgressive, isEnglish } from '../participate/i18n.js';
import { PRINT_WORDS } from '../stage-screens.js';

// S25 — Print survey in a participant language (BCS training 2026-09-29: "in Hindi, now what do they do?").
// Borrowed, not rebuilt: the participant page's translation fetch (ui/participate/i18n.js fetchTranslationsProgressive)
// sends the printed form's English strings to POST /v2/translate (src/translate.ts): translation memory first, the model
// only for strings memory lacks, published strings only. Each string that does not come back stays English and is marked
// on the paper. Question ids, option codes and the 0.23.0 layout (choices, write-in lines) do not change.

// Tier B (build ticket: each door default is one flag/constant flip): false = no language choice, Print survey is English.
export const PRINT_IN_LANGUAGE = true;

// The participant drop-down's list (src/languages.ts participantLanguages): the assessment's LWCs, then the project's,
// once each, machine-translatable only (sign languages are recorded but never offered), at most MAX_LWC. English is not
// in the list: the picker always offers it first.
export function printLanguages(assessmentLwc = [], projectLwc = []) {
  const codes = [];
  for (const raw of [...(Array.isArray(assessmentLwc) ? assessmentLwc : []), ...(Array.isArray(projectLwc) ? projectLwc : [])]) {
    const l = lwcByCode(raw);
    if (l && l.mt !== false && !codes.includes(l.code)) codes.push(l.code);
  }
  return codes.slice(0, MAX_LWC).map(lwcByCode);
}
export const languageLabel = l => (l.endonym && l.endonym !== l.name ? `${l.endonym} (${l.name})` : l.name);

// The picker beside Print survey; '' when the assessment has no participant language (nothing changes then).
export function printLanguageField(languages, selected, esc) {
  if (!PRINT_IN_LANGUAGE || !languages?.length) return '';
  const pick = languages.some(l => l.code === selected) ? selected : 'en';
  const opt = (value, label) => `<option value="${esc(value)}"${value === pick ? ' selected' : ''}>${esc(label)}</option>`;
  return `<label class="field" data-print-lang>Language on paper <select id="print-lang">${opt('en', 'English')}${languages.map(l => opt(l.code, languageLabel(l))).join('')}</select></label>`;
}

// The facilitator's own session rides the request (the ticket: "facilitator session"): its bearer when the page holds one,
// and same-origin credentials. translateInit's participant-only header rule is for the participant page; here the caller
// is a signed-in owner or member, so the server counts this under that person (src/translate.ts translateLimiter).
export const facilitatorFetch = (token, fetchImpl = globalThis.fetch) => (url, init = {}) =>
  fetchImpl(url, { ...init, headers: { ...(init.headers || {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, credentials: 'same-origin' });

// The paper's own words that this form actually shows (renderBlankPrint's choices), so nothing unseen is asked or counted.
export function wordsOnPaper(model) {
  const items = model?.items || [], structured = items.some(i => i && typeof i === 'object');
  const has = t => items.some(i => i && typeof i === 'object' && (Array.isArray(t) ? t.includes(i.type) : i.type === t));
  return Object.keys(PRINT_WORDS).filter(k => ({
    blankSurvey: !model?.title, passageLead: !!model?.passageLine, introChoices: structured, introLines: !structured, noLink: false,
    chooseAll: has('multi'), chooseOne: has(['single', 'scale']),
  })[k] ?? true);
}

// Every English string of the printed form, keyed locally: form strings (question texts, choice labels) go under the
// survey's published scope, the paper's own words under participant-ui (both are allowlisted server-side).
export function printStrings(model) {
  const form = {}, ui = {};
  for (const [i, entry] of (model?.items || []).entries()) {
    const it = typeof entry === 'string' ? { text: entry } : entry || {};
    if (typeof it.text === 'string' && it.text) form[`q${i}`] = it.text;
    for (const [j, o] of (it.options || []).entries()) if (typeof o?.text === 'string' && o.text) form[`q${i}.o${j}`] = o.text;
  }
  for (const k of wordsOnPaper(model)) ui[`w.${k}`] = PRINT_WORDS[k];
  return { form, ui };
}

// A display copy of the print model in `language`, from a key → text map: translated where present, English (marked
// en:true / wordsEn) where not. Pure; the renderer (ui/stage-screens.js renderBlankPrint) draws it.
export function applyPrintTranslation(model, language, map = {}) {
  const t = (key, english) => (typeof map[key] === 'string' && map[key].trim() ? { text: map[key], en: false } : { text: english, en: true });
  let total = 0, english = 0;
  const count = r => { total++; if (r.en) english++; return r; };
  const items = (model.items || []).map((entry, i) => {
    if (typeof entry === 'string') return t(`q${i}`, entry).text; // legacy string item: no mark possible, so not counted
    const q = count(t(`q${i}`, entry.text));
    return { ...entry, text: q.text, en: q.en, ...(entry.options ? { options: entry.options.map((o, j) => { const r = count(t(`q${i}.o${j}`, o.text)); return { ...o, text: r.text, en: r.en }; }) } : {}) };
  });
  const words = {}, wordsEn = [];
  for (const k of wordsOnPaper(model)) { const r = count(t(`w.${k}`, PRINT_WORDS[k])); words[k] = r.text; if (r.en) wordsEn.push(k); }
  const lead = PRINT_WORDS.passageLead;
  const passageLine = model.passageLine && model.passageLine.startsWith(lead) ? `${words.passageLead}${model.passageLine.slice(lead.length)}` : model.passageLine;
  return { ...model, items, words, wordsEn, passageLine, lang: language.code, dir: language.dir, language: languageLabel(language), review: language.review === true, phrases: total, english };
}

// Fetch and apply. No request for English or a language the list does not support. Never rejects: a failed or empty
// translation leaves the whole form English (marked), so the facilitator can still print.
export async function translatePrint(model, { lang, fetchImpl = globalThis.fetch, onProgress = () => {} } = {}) {
  const language = lwcByCode(lang);
  if (!PRINT_IN_LANGUAGE || !model?.visible || isEnglish(lang) || !language || language.mt === false) return model;
  const { form, ui } = printStrings(model);
  const seen = { form: 0, ui: 0 }, total = Object.keys(form).length + Object.keys(ui).length;
  const tick = () => onProgress({ done: seen.form + seen.ui, total });
  const run = (context, sourceTexts, key) => (Object.keys(sourceTexts).length
    ? fetchTranslationsProgressive({ lang: language.code, context, sourceTexts, fetchImpl, onProgress: p => { seen[key] = p.done; tick(); } }).then(r => r.map, () => ({}))
    : Promise.resolve({}));
  const [fm, um] = await Promise.all([
    model.template_id ? run(`participant-form:${model.template_id}`, form, 'form') : Promise.resolve({}),
    run('participant-ui', ui, 'ui'),
  ]);
  return applyPrintTranslation(model, language, { ...fm, ...um });
}

// The facilitator's status line once a form is ready.
export function printReadyLine(model) {
  if (!model?.lang) return `${model.items.length} questions ready. Use Print below.`;
  const english = model.english ? ` ${model.english} of ${model.phrases} phrases have no translation yet and stay in English, marked EN on the paper.` : '';
  const machine = model.english === model.phrases ? '' : model.review ? ' Machine translation, not yet checked by a speaker of this language.' : ' Machine translation.';
  return `${model.items.length} questions ready in ${model.language}.${english}${machine} Use Print below.`;
}
