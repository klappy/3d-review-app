// Additive Steve-preview measure: each perspective's own stored subdimensions, never shared constructs or rescoring.
import { lensRespondents, lensLabel } from './report-lenses.js';
import { renderRadarSection } from './report-radar.js';
const list = x => Array.isArray(x) ? x : [];
export const perspectiveRadarIntro = "Each spoke is this perspective's own subdimension, scored out of 100. These are different areas from the shared-construct comparison. Missing scores leave a gap; they are never zero-filled.";
/** Cards must carry snapshot counts and exact source scores. Missing axes stay null; genuine zero remains zero. */
export function subdimensionRadarModels(cards, minimum = 3) {
  const floor = Number.isInteger(minimum) && minimum >= 1 ? minimum : 3;
  return list(cards).flatMap(c => {
    if (!c || typeof c.lens !== 'string') return [];
    const n = Object.hasOwn(c, 'snapshotN') ? c.snapshotN : c.n;
    if (!Number.isSafeInteger(n) || n < floor) return [];
    const rows = list(c.rows).filter(r => r && typeof r.name === 'string' && r.name.trim());
    const scores = rows.map(r => typeof r.score === 'number' && Number.isFinite(r.score) && r.score >= 0 && r.score <= 100 ? r.score : null);
    if (rows.length < 3 || scores.filter(x => x !== null).length < 3) return [];
    const lens = c.lens, label = c.label || lensLabel(lens);
    return [{ lens, label, n, spokes: rows.map(r => r.name), lenses: [{ lens, scores }] }];
  });
}
export function perspectiveRadarModels(report, minimum = 3) {
  const payload = report?.payload, counts = lensRespondents(payload);
  return subdimensionRadarModels(list(payload?.lenses).map(l => ({lens:l.lens, n:counts.get(l.lens), rows:list(l.sub_dimensions).map(s => ({name:s.sub_dimension,score:s.score}))})), minimum);
}
export function renderPerspectiveRadars({ doc, report, minimum = 3 }) {
  return perspectiveRadarModels(report, minimum).map(model => renderRadarSection({doc, model, kind:'perspectiveRadar', copy:{
    heading: `${model.label} subdimensions`, title:`${model.label} subdimension radar - scores out of 100`, scale:'Scores out of 100',
    intro:`${model.n} ${model.n === 1 ? 'response' : 'responses'}. ${model.n < 3 ? "Limited data: these scores reflect only the responses counted here. " : ""}${perspectiveRadarIntro}`,
  }}));
}
