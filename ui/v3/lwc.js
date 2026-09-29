// Browser mirror of src/languages.ts LWC_LANGUAGES (test/languages.test.ts keeps the two identical).
// Captain ruling 2026-09-28: participants may only pick the project's / assessment's LWCs that the model supports.
export const LWC_LANGUAGES = Object.freeze([
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
export const MAX_LWC = 8;
const BY_CODE = new Map(LWC_LANGUAGES.map(l => [l.code.toLowerCase(), l]));
export const lwcByCode = code => BY_CODE.get(String(code || '').toLowerCase()) || null;
// Checkbox group for setup screens: name="lwc", value = BCP 47 tag, label = endonym · English name.
export function lwcFieldset(selected = [], esc = s => String(s), { disabled = false, legend = 'Languages participants read (machine translation)' } = {}) {
  const on = new Set(selected);
  return `<fieldset class="lwc-field"${disabled ? ' disabled' : ''}><legend>${esc(legend)}</legend><p class="small muted">Participants can switch the survey to these languages. English is always there. Up to ${MAX_LWC}.</p><div class="lwc-options">${LWC_LANGUAGES.map(l => `<label class="lwc-option"><input type="checkbox" name="lwc" value="${esc(l.code)}"${on.has(l.code) ? ' checked' : ''}> <span lang="${esc(l.code)}" dir="${esc(l.dir)}">${esc(l.endonym)}</span> <span class="muted">${esc(l.name)}</span></label>`).join('')}</div></fieldset>`;
}
export const lwcFrom = fd => [...new Set(fd.getAll('lwc').map(String))].filter(c => BY_CODE.has(c.toLowerCase())).slice(0, MAX_LWC);
export const LWC_CSS = '.lwc-field{border:0;padding:0;margin:14px 0 0;min-width:0}.lwc-field legend{font-weight:600;padding:0}.lwc-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 12px;margin-top:6px}.lwc-option{display:flex;align-items:center;gap:6px;min-height:40px;font-weight:400}';
