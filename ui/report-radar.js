// Radar chart per lens set in the full report (high-numeracy view). Decision record: cookbook atoms/DEC-0014 (radar in
// the full report, "out of 100" wherever a score appears) and DEC-0004; unit work/active/2026-10-15-3d-radar-and-numeracy.
// Canvas rules followed (cookbook design/2026-10-15-glass-redesign/canvas/design-system.md, Radar row): inline SVG, one
// polygon per perspective, 2px strokes, markers of 8px or more, legend plus wrapping labels, spokes are the areas two or more
// perspectives scored, and a spoke is skipped where a perspective was not asked. Rules the canvas has not yet written
// (parity-loop R18) use the simplest choice: at least 3 spokes or no radar; a skipped spoke joins its neighbours directly;
// labels wrap at words; rings at 25/50/75/100; same chart at every width (it scales with the viewBox).
// Presentation only: reads cross_lens_multi exactly as returned, never re-scores, no mean.
import { lensLabel } from './report-lenses.js';

export const radarCopy = Object.freeze({
  heading: 'Perspectives at a glance',
  intro: 'Each spoke is one area two or more perspectives scored; further out is a higher score, out of 100. A perspective that was not asked about an area has no point on that spoke.',
  scale: 'Scores out of 100',
  title: 'Radar chart of scores out of 100 by perspective',
});
const MIN_SPOKES = 3;
const SIZE = 360, C = SIZE / 2, R = 120, LABEL_R = R + 24, RINGS = [25, 50, 75, 100], LINE = 21, WRAP = 13;
// Labels wrap at word boundaries (about 13 characters a line) so they stay legible when the chart scales down on a phone.
function wrap(name) {
  const lines = [];
  for (const word of String(name).split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + word).length <= WRAP) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word);
  }
  return lines;
}
const rows = v => (Array.isArray(v) ? v : []);
const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const clamp = v => Math.max(0, Math.min(100, v));

/** { spokes: [area], lenses: [{ lens, scores: [number|null per spoke] }] } or null when fewer than three shared areas. */
export function radarModel(report) {
  const payload = report && typeof report === 'object' ? report.payload : null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const areas = rows(payload.cross_lens_multi).map(entry => {
    if (!entry || typeof entry !== 'object') return null;
    const scores = rows(entry.lens_scores).filter(s => s && typeof s.lens === 'string' && Number.isFinite(num(s.score)));
    return scores.length >= 2 ? { name: String(entry.construct_name), scores } : null;
  }).filter(Boolean);
  if (areas.length < MIN_SPOKES) return null;
  const order = [];
  for (const a of areas) for (const s of a.scores) if (!order.includes(s.lens)) order.push(s.lens);
  return {
    spokes: areas.map(a => a.name),
    lenses: order.map(lens => ({ lens, scores: areas.map(a => { const hit = a.scores.find(s => s.lens === lens); return hit ? num(hit.score) : null; }) })),
  };
}

const SVG = 'http://www.w3.org/2000/svg';
const point = (i, count, value) => {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / count, r = (R * value) / 100;
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
};
const fmt = n => Math.round(n * 10) / 10;
function svgEl(doc, tag, attrs = {}, text) {
  const el = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

export const radarCss = `.lens-radar figure{margin:8px 0 0}.lens-radar svg{display:block;width:100%;max-width:460px;height:auto;margin:0 auto;overflow:visible}
.lens-radar .ring{fill:none;stroke:var(--line);stroke-width:1}.lens-radar .spoke{stroke:var(--line);stroke-width:1}
.lens-radar .ring-label{font-size:13px;fill:var(--secondary)}.lens-radar .spoke-label{font-size:20px;fill:var(--ink)}
.lens-radar [data-radar-lens] polygon{fill-opacity:.12;stroke-width:2;fill:var(--secondary);stroke:var(--secondary)}
.lens-radar [data-radar-lens] circle{stroke:var(--paper);stroke-width:1.5;fill:var(--secondary)}
.lens-radar [data-radar-lens]:is([data-radar-lens="Translation Team" i],[data-radar-lens=team i]) :is(polygon,circle){fill:var(--lens-green)}
.lens-radar [data-radar-lens]:is([data-radar-lens="Translation Team" i],[data-radar-lens=team i]) polygon{stroke:var(--lens-green)}
.lens-radar [data-radar-lens=community i] :is(polygon,circle){fill:var(--lens-blue)}.lens-radar [data-radar-lens=community i] polygon{stroke:var(--lens-blue)}
.lens-radar [data-radar-lens=church i] :is(polygon,circle){fill:var(--lens-yellow)}.lens-radar [data-radar-lens=church i] polygon{stroke:var(--lens-yellow)}
.lens-radar ul.lens-radar-legend{list-style:none;padding:0;margin:8px 0 0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}
.lens-radar-legend li{display:flex;align-items:center;gap:6px;border:0!important;padding:0!important}
.lens-radar-legend .lens-agree-dot{position:static;margin:0;width:10px;height:10px;border-width:1px}`;

/** Full report: detached DOM section, or null when fewer than three areas were scored by two or more perspectives. */
export function renderLensRadar({ doc, report }) {
  const model = radarModel(report);
  if (!model || typeof doc.createElementNS !== 'function') return null;
  const count = model.spokes.length;
  const svg = svgEl(doc, 'svg', { viewBox: `-70 -40 ${SIZE + 140} ${SIZE + 80}`, role: 'img' });
  svg.append(svgEl(doc, 'title', {}, radarCopy.title));
  for (const ring of RINGS) {
    svg.append(svgEl(doc, 'polygon', { class: 'ring', points: model.spokes.map((_, i) => point(i, count, ring).map(fmt).join(',')).join(' ') }));
    const [x, y] = point(0, count, ring);
    svg.append(svgEl(doc, 'text', { class: 'ring-label', x: fmt(x + 4), y: fmt(y + 3) }, String(ring)));
  }
  model.spokes.forEach((name, i) => {
    const [x, y] = point(i, count, 100);
    svg.append(svgEl(doc, 'line', { class: 'spoke', x1: C, y1: C, x2: fmt(x), y2: fmt(y) }));
    const [lx, ly] = point(i, count, (LABEL_R / R) * 100);
    const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end';
    const parts = wrap(name);
    const text = svgEl(doc, 'text', { class: 'spoke-label', x: fmt(lx), y: fmt(ly - (ly < C ? (parts.length - 1) * LINE : 0) + 5), 'text-anchor': anchor });
    parts.forEach((p, k) => text.append(svgEl(doc, 'tspan', { x: fmt(lx), dy: k ? LINE : 0 }, p)));
    svg.append(text);
  });
  for (const { lens, scores } of model.lenses) {
    const g = svgEl(doc, 'g', { 'data-radar-lens': lens });
    const pts = scores.map((s, i) => (s === null ? null : point(i, count, clamp(s)))).filter(Boolean);
    g.append(svgEl(doc, 'polygon', { points: pts.map(p => p.map(fmt).join(',')).join(' ') }));
    scores.forEach((s, i) => {
      if (s === null) return;
      const [x, y] = point(i, count, clamp(s));
      g.append(svgEl(doc, 'circle', { cx: fmt(x), cy: fmt(y), r: 5 }, undefined));
      g.lastChild.append(svgEl(doc, 'title', {}, `${lensLabel(lens)} · ${model.spokes[i]}: ${String(s)} out of 100`));
    });
    svg.append(g);
  }
  const h = doc.createElement('h4'); h.textContent = radarCopy.heading;
  const p = doc.createElement('p'); p.className = 'small muted'; p.textContent = radarCopy.intro;
  const fig = doc.createElement('figure'); fig.append(svg);
  const cap = doc.createElement('figcaption'); cap.className = 'small muted'; cap.textContent = radarCopy.scale; fig.append(cap);
  const legend = doc.createElement('ul'); legend.className = 'lens-radar-legend';
  for (const { lens } of model.lenses) {
    const li = doc.createElement('li'); const dot = doc.createElement('span');
    dot.className = 'lens-agree-dot'; dot.dataset.lens = lens; dot.setAttribute('aria-hidden', 'true');
    li.append(dot, doc.createTextNode(lensLabel(lens))); legend.append(li);
  }
  const style = doc.createElement('style'); style.textContent = radarCss;
  const section = doc.createElement('section');
  section.className = 'lens-radar report-detail-section glass panel';
  section.dataset.lensRadar = '';
  section.append(h, p, fig, legend, style);
  return section;
}
