// Dynamic translation for the participant survey (captain ruling 2026-09-28: restore the Lovable-era behaviour).
// The page sends its English strings to POST /v2/translate (src/translate.ts, a proxy with the Laos app's
// translate-survey wire shape) and shows whatever comes back; any missing string stays English. Only DISPLAY text
// is translated: item ids and option codes never change, so answers, scores and reports are exactly as before.
// Pure helpers here (node:test in i18n.test.mjs); page.js owns the DOM.

// Languages offered in the picker: the value sent upstream is the English name; the label leads with the endonym.
export const LANGUAGES = Object.freeze([
  ['English', 'English'],
  ['Lao', 'ລາວ · Lao'], ['Thai', 'ไทย · Thai'], ['Khmer', 'ខ្មែរ · Khmer'], ['Burmese', 'မြန်မာ · Burmese'],
  ['Vietnamese', 'Tiếng Việt · Vietnamese'], ['Indonesian', 'Bahasa Indonesia'], ['Malay', 'Bahasa Melayu'],
  ['Filipino', 'Filipino'], ['Chinese (Simplified)', '中文 · Chinese'], ['Hindi', 'हिन्दी · Hindi'],
  ['Bengali', 'বাংলা · Bengali'], ['Nepali', 'नेपाली · Nepali'], ['Marathi', 'मराठी · Marathi'], ['Odia', 'ଓଡ଼ିଆ · Odia'],
  ['Tamil', 'தமிழ் · Tamil'], ['Telugu', 'తెలుగు · Telugu'], ['Urdu', 'اردو · Urdu'], ['Arabic', 'العربية · Arabic'],
  ['French', 'Français · French'], ['Spanish', 'Español · Spanish'], ['Portuguese', 'Português · Portuguese'],
  ['Swahili', 'Kiswahili · Swahili'],
]);
const RTL = new Set(['urdu', 'arabic', 'persian', 'farsi', 'hebrew', 'pashto', 'dari']);
export const isEnglish = lang => !lang || ['en', 'eng', 'english'].includes(String(lang).trim().toLowerCase());
export const isRtl = lang => RTL.has(String(lang || '').trim().toLowerCase());
export const LANG_PATTERN = /^[\p{L}][\p{L}\p{M} ()'.,-]{0,47}$/u;   // mirrors src/translate.ts
export const cleanLang = lang => { const v = typeof lang === 'string' ? lang.trim() : ''; return v && LANG_PATTERN.test(v) ? v : ''; };

// Fixed participant-page chrome, keyed. Assembled sentences (lead, time) are added per form by the page.
export const UI_EN = Object.freeze({
  language: 'Language',
  translating: 'Translating…',
  translateFailed: 'Translation is not available right now. Showing English.',
  machineNote: 'Machine translation. If anything is unclear, ask the person who shared the survey.',
  welcome: 'We would like your perspective',
  start: 'Start',
  learnMore: 'Learn more',
  foot: 'No account, no sign-in. You can review your answers before you send them.',
  back: 'Back',
  next: 'Next',
  question: 'Question',
  of: 'of',
  answerRequired: 'Answer required:',
  exclusionError: 'An exclusion choice cannot be combined:',
  exclusionNote: 'An exclusion choice cannot be combined with any other choice.',
  chooseAll: 'Choose all that apply.',
  optional: '(optional)',
  unsupported: 'This survey contains an unsupported question. Ask the person who shared the survey for help.',
  change: 'Change',
  skipped: 'Skipped',
  aboutYou: 'About you (optional)',
  chooseOptional: 'Choose (optional)',
  pleaseDescribe: 'Please describe',
  responseSaved: 'Response saved',
});

// Every translatable string of one form, keyed by stable ids (item id + option code), never by position.
export function formStrings(form) {
  const out = {};
  for (const item of form?.items || []) {
    if (typeof item.text === 'string' && item.text) out[`${item.id}.text`] = item.text;
    for (const o of item.options || []) { const label = o.label || o.text; if (typeof label === 'string' && label) out[`${item.id}.opt.${o.code}`] = label; }
  }
  for (const f of form?.context_fields || []) {
    if (f.label) out[`about.${f.key}.label`] = f.label;
    for (const o of f.options || []) if (o.label) out[`about.${f.key}.opt.${o.code}`] = o.label;
  }
  return out;
}

// A display copy of the form: same ids, codes, types and order; only text/label strings swapped where translated.
export function translateForm(form, map = {}) {
  if (!form || !map || !Object.keys(map).length) return form;
  const pick = (key, fallback) => (typeof map[key] === 'string' && map[key] ? map[key] : fallback);
  return {
    ...form,
    items: (form.items || []).map(item => ({
      ...item,
      ...(typeof item.text === 'string' ? { text: pick(`${item.id}.text`, item.text) } : {}),
      ...(item.options ? { options: item.options.map(o => {
        const label = pick(`${item.id}.opt.${o.code}`, o.label || o.text);
        return { ...o, ...(o.label !== undefined ? { label } : {}), text: label };
      }) } : {}),
    })),
    ...(form.context_fields ? { context_fields: form.context_fields.map(f => ({
      ...f, label: pick(`about.${f.key}.label`, f.label),
      ...(f.options ? { options: f.options.map(o => ({ ...o, label: pick(`about.${f.key}.opt.${o.code}`, o.label) })) } : {}),
    })) } : {}),
  };
}

// t(key, fallback): translated chrome when present, else the English fallback (or UI_EN[key]).
export const makeT = (map = {}) => (key, fallback) => (typeof map[key] === 'string' && map[key] ? map[key] : (fallback ?? UI_EN[key] ?? key));

// FNV-1a over the canonical JSON: a short, stable local-cache key (not a security boundary).
export function hashOf(obj) {
  const s = JSON.stringify(Object.keys(obj).sort().map(k => [k, obj[k]]));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const CACHE_PREFIX = '3dr.tr.v1:';
function readCache(storage, key) { try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function writeCache(storage, key, value) { try { storage?.setItem(key, JSON.stringify(value)); } catch { /* best effort */ } }

// One request to the proxy, with a device cache for complete answers. Resolves { map, partial, cached };
// rejects on any failure so the caller can keep English and say so.
export async function fetchTranslations({ lang, context, sourceTexts, fetchImpl = globalThis.fetch, storage = null, endpoint = '/v2/translate' }) {
  if (isEnglish(lang)) return { map: {}, partial: false, cached: false };
  const key = `${CACHE_PREFIX}${lang.toLowerCase()}:${context}:${hashOf(sourceTexts)}`;
  const hit = readCache(storage, key);
  if (hit && typeof hit === 'object') return { map: hit, partial: false, cached: true };
  const res = await fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetLang: lang, context, sourceTexts }) });
  if (!res || !res.ok) throw new Error(`translate ${res ? res.status : 'failed'}`);
  const data = await res.json();
  const map = {};
  for (const k of Object.keys(sourceTexts)) if (typeof data?.translated?.[k] === 'string' && data.translated[k].trim()) map[k] = data.translated[k];
  if (!Object.keys(map).length) throw new Error('translate empty');
  const partial = data?.partial === true || Object.keys(map).length < Object.keys(sourceTexts).length;
  if (!partial) writeCache(storage, key, map);
  return { map, partial, cached: false };
}

// Language chosen for this page: ?lang= wins (facilitators can share a pre-set link), then the device's last choice.
export function initialLanguage({ search = '', storage = null } = {}) {
  let fromUrl = '';
  try { fromUrl = cleanLang(new URLSearchParams(search).get('lang') || ''); } catch { fromUrl = ''; }
  if (fromUrl) return fromUrl;
  try { return cleanLang(storage?.getItem('3dr.lang') || '') || 'English'; } catch { return 'English'; }
}
export function rememberLanguage(storage, lang) { try { storage?.setItem('3dr.lang', lang); } catch { /* best effort */ } }
