// Copied verbatim (LENSES + groupByLens) from ui/lens-surveys.js of klappy/3d-review-app @ main b0bb9c9.
// Copy, not import: the spike must not reach into ui/.
export const LENSES = ['Translation Team', 'Church', 'Community'];

export function groupByLens({ surveys = [], templates = [] }) {
  const included = surveys.filter(s => s.state === 'selected' && !s.archived_at);
  const groups = LENSES.map(lens => ({ lens, included: [], available: [] }));
  const other = { lens: 'Other perspective', included: [], available: [] };
  const groupFor = p => groups.find(g => g.lens === p) || other;
  for (const s of included) groupFor(s.perspective).included.push(s);
  // Only the current (highest published) version of each template is offered; a template already included is not offered twice.
  const latest = new Map();
  for (const t of templates) { const cur = latest.get(t.id); if (!cur || t.version > cur.version) latest.set(t.id, t); }
  for (const t of latest.values()) { if (!included.some(s => s.template_id === t.id)) groupFor(t.perspective).available.push(t); }
  return other.included.length || other.available.length ? [...groups, other] : groups;
}
