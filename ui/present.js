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
  if (value === null || value === undefined || value === '') return 'Not answered (unknown)';
  if (item.type !== 'single' && item.type !== 'multi') return String(value);
  const labels = new Map((item.options || []).map(option => [option.code, option.text || option.label || option.code]));
  const choices = Array.isArray(value) ? value : [value];
  return choices.map(code => labels.get(code) || 'Unrecognized option').join('; ');
}
