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
export function receiptLine(r = {}) {
  const id = String(r.response_id || ''); const ref = id ? id.replace(/^resp_/, '').slice(0, 8).toUpperCase() : '';
  const at = r.submitted_at ? new Date(r.submitted_at) : null; const when = at && !Number.isNaN(at.getTime()) ? at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return [ref && `Reference ${ref}`, when].filter(Boolean).join(' · ') || 'Saved';
}
