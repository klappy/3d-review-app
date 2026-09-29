/**
 * Languages of wider communication (LWCs) the participant survey can be machine-translated into.
 *
 * Captain ruling 2026-09-28: the participant's language drop-down is LIMITED to the LWCs set on the project and/or the
 * assessment, and only where the translation model supports them. This table is that support list: BCP 47 tags
 * (script subtag where a language has more than one script), English name (what the translation model is asked for),
 * endonym (what the participant sees; static because Intl.DisplayNames coverage in the Workers runtime is unverified),
 * text direction, a script pattern the output must contain, and `review` = machine output needs a speaker's review
 * before it is trusted (low-resource languages; see docs/translation.md for sources).
 * Support basis: Vertex AI "Gemini models" language list (checked 2026-09-28 for lo km my ne or si ta te ur th vi hi bn id);
 * the rest are high-resource languages. Mirrored for the browser in ui/v3/lwc.js (test keeps the two identical).
 */
export interface LwcLanguage { code: string; name: string; endonym: string; dir: "ltr" | "rtl"; script: string; review: boolean }

export const LWC_LANGUAGES: readonly LwcLanguage[] = Object.freeze([
  { code: "lo", name: "Lao", endonym: "ລາວ", dir: "ltr", script: "\\u0E80-\\u0EFF", review: true },
  { code: "th", name: "Thai", endonym: "ไทย", dir: "ltr", script: "\\u0E00-\\u0E7F", review: false },
  { code: "km", name: "Khmer", endonym: "ខ្មែរ", dir: "ltr", script: "\\u1780-\\u17FF", review: true },
  { code: "my", name: "Burmese", endonym: "မြန်မာ", dir: "ltr", script: "\\u1000-\\u109F", review: true },
  { code: "vi", name: "Vietnamese", endonym: "Tiếng Việt", dir: "ltr", script: "", review: false },
  { code: "id", name: "Indonesian", endonym: "Bahasa Indonesia", dir: "ltr", script: "", review: false },
  { code: "ms", name: "Malay", endonym: "Bahasa Melayu", dir: "ltr", script: "", review: false },
  { code: "fil", name: "Filipino", endonym: "Filipino", dir: "ltr", script: "", review: false },
  { code: "zh-Hans", name: "Chinese (Simplified)", endonym: "简体中文", dir: "ltr", script: "\\u4E00-\\u9FFF", review: false },
  { code: "hi", name: "Hindi", endonym: "हिन्दी", dir: "ltr", script: "\\u0900-\\u097F", review: false },
  { code: "mr", name: "Marathi", endonym: "मराठी", dir: "ltr", script: "\\u0900-\\u097F", review: false },
  { code: "ne", name: "Nepali", endonym: "नेपाली", dir: "ltr", script: "\\u0900-\\u097F", review: true },
  { code: "bn", name: "Bengali", endonym: "বাংলা", dir: "ltr", script: "\\u0980-\\u09FF", review: false },
  { code: "or", name: "Odia", endonym: "ଓଡ଼ିଆ", dir: "ltr", script: "\\u0B00-\\u0B7F", review: true },
  { code: "ta", name: "Tamil", endonym: "தமிழ்", dir: "ltr", script: "\\u0B80-\\u0BFF", review: false },
  { code: "te", name: "Telugu", endonym: "తెలుగు", dir: "ltr", script: "\\u0C00-\\u0C7F", review: false },
  { code: "si", name: "Sinhala", endonym: "සිංහල", dir: "ltr", script: "\\u0D80-\\u0DFF", review: true },
  { code: "ur", name: "Urdu", endonym: "اردو", dir: "rtl", script: "\\u0600-\\u06FF", review: false },
  { code: "ar", name: "Arabic", endonym: "العربية", dir: "rtl", script: "\\u0600-\\u06FF", review: false },
  { code: "sw", name: "Swahili", endonym: "Kiswahili", dir: "ltr", script: "", review: false },
  { code: "fr", name: "French", endonym: "Français", dir: "ltr", script: "", review: false },
  { code: "es", name: "Spanish", endonym: "Español", dir: "ltr", script: "", review: false },
  { code: "pt", name: "Portuguese", endonym: "Português", dir: "ltr", script: "", review: false },
]);
const BY_CODE = new Map(LWC_LANGUAGES.map((l) => [l.code.toLowerCase(), l]));
export const MAX_LWC = 8;

/** The supported language for a tag or an English name (case-insensitive), else null. */
export function lwcLanguage(value: unknown): LwcLanguage | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return BY_CODE.get(v) ?? LWC_LANGUAGES.find((l) => l.name.toLowerCase() === v) ?? null;
}
/** Parse a stored lwc_json cell (or anything) into supported codes; never throws. */
export function parseLwc(raw: unknown): string[] {
  let list: unknown = raw;
  if (typeof raw === "string") { try { list = JSON.parse(raw); } catch { list = []; } }
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const v of list) { const l = lwcLanguage(v); if (l && !out.includes(l.code)) out.push(l.code); }
  return out.slice(0, MAX_LWC);
}
/** A request value (array of tags, or "lo,th") → supported codes; unknown tags are refused with the reason. */
export function normalizeLwc(value: unknown): { codes: string[] } | { error: string } {
  if (value === null || value === "") return { codes: [] };
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!list) return { error: "lwc must be a list of language codes" };
  const codes: string[] = [];
  for (const v of list) {
    if (typeof v !== "string" || !v.trim()) continue;
    const l = lwcLanguage(v);
    if (!l) return { error: `language "${String(v).slice(0, 40)}" is not available for translation` };
    if (!codes.includes(l.code)) codes.push(l.code);
  }
  if (codes.length > MAX_LWC) return { error: `at most ${MAX_LWC} languages` };
  return { codes };
}
/** Union, assessment first then project, as participant-facing entries. */
export function participantLanguages(assessmentLwc: unknown, projectLwc: unknown) {
  const codes = [...parseLwc(assessmentLwc)];
  for (const c of parseLwc(projectLwc)) if (!codes.includes(c)) codes.push(c);
  return codes.slice(0, MAX_LWC).map((c) => { const l = BY_CODE.get(c.toLowerCase())!; return { code: l.code, name: l.name, endonym: l.endonym, dir: l.dir, review: l.review }; });
}
/** True when a translation is plausibly in the target script (non-Latin targets must contain that script). */
export function inScript(code: string, text: string): boolean {
  const l = BY_CODE.get(code.toLowerCase());
  if (!l || !l.script) return true;
  return new RegExp(`[${l.script}]`, "u").test(text);
}
