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

export function reviewAnswer(item, value) {
  if (value === null || value === undefined || value === '') return 'Skipped'; // B-09: plain word on the review page
  if (item.type !== 'single' && item.type !== 'multi') return String(value);
  const labels = new Map((item.options || []).map(option => [option.code, option.text || option.label || option.code]));
  const choices = Array.isArray(value) ? value : [value];
  return choices.map(code => labels.get(code) || 'Unrecognized option').join('; ');
}

// B-09 (lanes-1321): the receipt reads as a short reference + local date/time, never a raw id and UTC ISO string.
// Only a real server receipt (resp_… id, parseable time) is shortened; anything else — the practice receipt's
// "practice-only-not-saved" / "Demonstration — not sent" — is shown as given (Bugbot #273).
export function receiptLine(r = {}) {
  const id = String(r.response_id || ''), rawAt = String(r.submitted_at || '');
  const at = rawAt ? new Date(rawAt) : null, validAt = !!at && !Number.isNaN(at.getTime());
  if (!/^resp_/.test(id) || (rawAt && !validAt)) return [id, rawAt].filter(Boolean).join(' · ') || 'Saved';
  const when = validAt ? at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return [`Reference ${id.slice(5, 13).toUpperCase()}`, when].filter(Boolean).join(' · ');
}
