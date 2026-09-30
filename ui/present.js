// Presentation-only transforms. Canonical template IDs and answer codes remain
// unchanged in /v2 requests and persisted responses.
export function templateChoices(templates) {
  const pinned = [];
  const published = [];
  const legacy = [];
  for (const template of templates) {
    const placeholder = template.source_ref === 'synthetic-placeholder';
    const isPinned = typeof template.source_ref === 'string' && template.source_ref.startsWith('klappy/3d-quality-review@');
    const option = {
      value: `${template.id}@${template.version}`,
      label: `${template.name} · ${template.perspective} · v${template.version} · ${placeholder ? 'Legacy synthetic placeholder (existing surveys only)' : isPinned ? 'Pinned source' : 'Published source'}`,
      disabled: placeholder,
    };
    (placeholder ? legacy : isPinned ? pinned : published).push(option);
  }
  return [...pinned, ...published, ...legacy];
}

// C01: an "Other (please describe)" option (server marks it other:true; legacy/Lovable items use code "other").
export const OTHER_TEXT_KEY = '_other';
export const OTHER_TEXT_MAX = 500;
export const isOtherOption = option => option?.other === true || option?.code === 'other';
export const otherFieldName = id => `${id}::other`;
export function choseOther(item, value) {
  const codes = Array.isArray(value) ? value : value == null ? [] : [value];
  return (item.options || []).some(option => isOtherOption(option) && codes.includes(option.code));
}

// Both participant surfaces (/participate/ and the root #survey= flow) draw, read and toggle the field the same way.
export function otherBox(doc, item) {
  const box = doc.createElement('input'); box.type = 'text'; box.name = otherFieldName(item.id); box.maxLength = OTHER_TEXT_MAX;
  box.placeholder = 'Please describe'; box.setAttribute('aria-label', 'Please describe'); box.dataset.otherFor = item.id; box.hidden = true;
  return box;
}
export function collectOther(items, formData, answers) {
  const other = {};
  for (const item of items) {
    const text = formData.get(otherFieldName(item.id));
    if (typeof text === 'string' && text.trim() && choseOther(item, answers[item.id])) other[item.id] = text.trim();
  }
  return Object.keys(other).length ? other : null;
}
export function syncOtherBoxes(form, items, FormDataCtor = globalThis.FormData) {
  const fd = new FormDataCtor(form);
  for (const box of form.querySelectorAll('input[data-other-for]')) {
    const item = items.find(i => i.id === box.dataset.otherFor);
    box.hidden = !item || !choseOther(item, item.type === 'multi' ? fd.getAll(item.id) : fd.get(item.id));
  }
}

export function reviewAnswer(item, value, otherText) {
  if (value === null || value === undefined || value === '') return 'Skipped'; // B-09: plain word on the review page
  if (item.type !== 'single' && item.type !== 'multi') return String(value);
  const options = new Map((item.options || []).map(option => [option.code, option]));
  const choices = Array.isArray(value) ? value : [value];
  const described = typeof otherText === 'string' ? otherText.trim() : '';
  return choices.map(code => {
    const option = options.get(code); if (!option) return 'Unrecognized option';
    const label = option.text || option.label || option.code;
    return described && isOtherOption(option) ? `${label}: ${described}` : label;
  }).join('; ');
}

// B-09 (lanes-1321): the receipt reads as a short reference + local date/time, never a raw id and UTC ISO string.
// Only a real server receipt (resp_… id, parseable time) is shortened; anything else — the practice receipt's
// "practice-only-not-saved" / "Demonstration — not sent" — is shown as given (Bugbot #273).
// { t, locale } (participant page, gate 0.24.0): "Reference" and the date follow the chosen language; defaults are unchanged.
export function receiptLine(r = {}, { t = (k, f) => f, locale } = {}) {
  const id = String(r.response_id || ''), rawAt = String(r.submitted_at || '');
  const at = rawAt ? new Date(rawAt) : null, validAt = !!at && !Number.isNaN(at.getTime());
  if (!/^resp_/.test(id) || (rawAt && !validAt)) return [id, rawAt].filter(Boolean).join(' · ') || 'Saved';
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  let when = '';
  if (validAt) { try { when = at.toLocaleString(locale, opts); } catch { when = at.toLocaleString(undefined, opts); } }
  return [`${t('reference', 'Reference')} ${id.slice(5, 13).toUpperCase()}`, when].filter(Boolean).join(' · ');
}
