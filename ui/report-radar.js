// Radar chart per lens set in the full report (high-numeracy view). Decision record: cookbook atoms/DEC-0014 (radar in
// the full report, "out of 100" wherever a score appears) and DEC-0004; unit work/active/2026-10-15-3d-radar-and-numeracy.
// Canvas rules followed (cookbook design/2026-10-15-glass-redesign/canvas/design-system.md, Radar row): inline SVG, one
// polygon per perspective, 2px strokes, markers of 8px or more, legend plus wrapping labels, spokes are the areas two or more
// perspectives scored, and a spoke is skipped where a perspective was not asked. Rules the canvas has not yet written
// (parity-loop R18) use the simplest choice: at least 3 spokes or no radar; a skipped spoke breaks the outline (closed only when every spoke is scored);
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
// Phone legibility (cookbook work/active/2026-10-18-3d-radar-phone-legibility; canvas design-system.md Radar row): the
// viewBox grows to hold every spoke label (estimated at EM_W of the font size a character), never smaller than the old
// box, so a long label such as "Understanding of the Source" is not clipped at 390px. Markers and ring labels are sized in
// viewBox units so they reach the canvas minimums (markers never under 8 CSS px, ring labels never under 11) at PHONE_W rendered width.
const BASE = { x: -70, y: -40, w: SIZE + 140, h: SIZE + 80 }, LABEL_FS = 20, EM_W = 0.6, PAD = 6, PHONE_W = 266;
const MARKER_PX = 8, RING_PX = 11; // PHONE_W: the radar svg measured 266px wide at 390×844 (shots-r18-2141), under the canvas estimate of 358
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
.lens-radar .ring-label{fill:var(--secondary)}.lens-radar .spoke-label{font-size:20px;fill:var(--ink)}
.lens-radar [data-radar-lens] polygon{fill-opacity:.12;stroke-width:2;fill:var(--secondary);stroke:var(--secondary)}.lens-radar [data-radar-lens] polyline{fill:none;stroke-width:2;stroke:var(--secondary)}
.lens-radar [data-radar-lens] circle{stroke:var(--paper);stroke-width:1.5;fill:var(--secondary)}
.lens-radar [data-radar-lens]:is([data-radar-lens="Translation Team" i],[data-radar-lens=team i]) :is(polygon,circle){fill:var(--lens-green)}
.lens-radar [data-radar-lens]:is([data-radar-lens="Translation Team" i],[data-radar-lens=team i]) :is(polygon,polyline){stroke:var(--lens-green)}
.lens-radar [data-radar-lens=community i] :is(polygon,circle){fill:var(--lens-blue)}.lens-radar [data-radar-lens=community i] :is(polygon,polyline){stroke:var(--lens-blue)}
.lens-radar [data-radar-lens=church i] :is(polygon,circle){fill:var(--lens-yellow)}.lens-radar [data-radar-lens=church i] :is(polygon,polyline){stroke:var(--lens-yellow)}
.lens-radar ul.lens-radar-legend{list-style:none;padding:0;margin:8px 0 0!important;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}
.lens-radar-legend li{display:flex;align-items:center;gap:6px;border:0!important;padding:0!important;margin:0!important}
.lens-radar-legend .lens-agree-dot{position:static;margin:0;width:10px;height:10px;border-width:1px}`;

/** Estimated extents of one laid-out spoke label in viewBox units: { left, right, top, bottom }. */
export function labelExtents({ lx, y, anchor, parts }) {
  const w = Math.max(...parts.map(p => p.length)) * EM_W * LABEL_FS;
  const left = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
  return { left, right: left + w, top: y - LABEL_FS * 0.8, bottom: y + (parts.length - 1) * LINE + LABEL_FS * 0.25 };
}
/** The old fixed box, grown (never shrunk) just enough to hold every spoke label plus PAD. */
function radarViewBox(labels) {
  let x0 = BASE.x, y0 = BASE.y, x1 = BASE.x + BASE.w, y1 = BASE.y + BASE.h;
  for (const l of labels) {
    const e = labelExtents(l);
    x0 = Math.min(x0, e.left - PAD); x1 = Math.max(x1, e.right + PAD); y0 = Math.min(y0, e.top - PAD); y1 = Math.max(y1, e.bottom + PAD);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Full report: detached DOM section, or null when fewer than three areas were scored by two or more perspectives. */
export function renderLensRadar({ doc, report }) {
  const model = radarModel(report);
  if (!model || typeof doc.createElementNS !== 'function') return null;
  const count = model.spokes.length;
  // Lay out spoke labels first so the viewBox can be fitted around them.
  const labels = model.spokes.map((name, i) => {
    const [lx, ly] = point(i, count, (LABEL_R / R) * 100);
    const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end';
    const parts = wrap(name);
    const y = ly - (ly < C ? (parts.length - 1) * LINE : 0) + 5;
    return { name, i, lx, y, anchor, parts };
  });
  const box = radarViewBox(labels);
  const scale = box.w / PHONE_W;
  const svg = svgEl(doc, 'svg', { viewBox: [box.x, box.y, box.w, box.h].map(fmt).join(' '), role: 'img' });
  svg.append(svgEl(doc, 'title', {}, radarCopy.title));
  for (const ring of RINGS) {
    svg.append(svgEl(doc, 'polygon', { class: 'ring', points: model.spokes.map((_, i) => point(i, count, ring).map(fmt).join(',')).join(' ') }));
    const [x, y] = point(0, count, ring);
    svg.append(svgEl(doc, 'text', { class: 'ring-label', x: fmt(x + 4), y: fmt(y + 3), 'font-size': fmt(RING_PX * scale) }, String(ring)));
  }
  for (const { i, lx, y, anchor, parts } of labels) {
    const [x2, y2] = point(i, count, 100);
    svg.append(svgEl(doc, 'line', { class: 'spoke', x1: C, y1: C, x2: fmt(x2), y2: fmt(y2) }));
    const text = svgEl(doc, 'text', { class: 'spoke-label', x: fmt(lx), y: fmt(y), 'text-anchor': anchor });
    parts.forEach((p, k) => text.append(svgEl(doc, 'tspan', { x: fmt(lx), dy: k ? LINE : 0 }, p)));
    svg.append(text);
  }
  for (const { lens, scores } of model.lenses) {
    const g = svgEl(doc, 'g', { 'data-radar-lens': lens });
    // Review #499 A/B: one closed outline only when every spoke has a value; otherwise one open line per run of adjacent
    // scored spokes (wrapping past the last spoke), so nothing is drawn across a skipped spoke and lone points stay markers.
    const pts = scores.map((s, i) => (s === null ? null : point(i, count, clamp(s))));
    const join = run => run.map(p => p.map(fmt).join(',')).join(' ');
    if (pts.every(Boolean)) g.append(svgEl(doc, 'polygon', { points: join(pts) }));
    else {
      const start = pts.findIndex(p => p === null), runs = [];
      let run = [];
      for (let k = 1; k <= count; k++) {
        const p = pts[(start + k) % count];
        if (p) run.push(p); else { if (run.length >= 2) runs.push(run); run = []; }
      }
      for (const r of runs) g.append(svgEl(doc, 'polyline', { points: join(r) }));
    }
    scores.forEach((s, i) => {
      if (s === null) return;
      const [x, y] = point(i, count, clamp(s));
      g.append(svgEl(doc, 'circle', { cx: fmt(x), cy: fmt(y), r: fmt((MARKER_PX / 2) * scale) }, undefined));
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
