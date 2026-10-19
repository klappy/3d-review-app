// Radar chart per lens set in the full report (high-numeracy view). Decision record: cookbook atoms/DEC-0014 (radar in
// the full report, "out of 100" wherever a score appears) and DEC-0004; unit work/active/2026-10-15-3d-radar-and-numeracy.
// Canvas rules followed (cookbook design/2026-10-15-glass-redesign/canvas/design-system.md, Radar row): inline SVG, one
// polygon per perspective, 2px strokes, markers of 8px or more, legend plus wrapping labels, spokes are the areas two or more
// perspectives scored, and a spoke is skipped where a perspective was not asked. Rules the canvas has not yet written
// (parity-loop R18) use the simplest choice: at least 3 spokes or no radar; a skipped spoke breaks the outline (closed only when every spoke is scored);
// labels wrap at words; rings at 25/50/75/100; the wide chart scales with main's fixed viewBox, the phone one is sized below.
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
// Phone legibility (cookbook work/active/2026-10-18-3d-radar-phone-legibility; canvas design-system.md Radar row; review
// #546 HOLD). Two layouts of the same chart, one shown at a time by a container query on the figure:
// - wide (container 460px or more, the svg at its 460px cap): main's sizes in viewBox units, unchanged (spoke labels 20,
//   ring labels 13, marker r 5) in main's fixed box (BASE), so the desktop chart is exactly main's (review #546 HOLD k0005).
// - narrow (under 460px): labels wrap to the room beside their spoke and every size is set in CSS from rendered px: unit = px * vbw / wmin,
//   where --vbw is the viewBox width and --wmin the lower edge of the container band, so at any width down to NARROW_MIN
//   markers are 8px or more across, ring labels 11px or more and spoke labels SPOKE_PX (never smaller than the ring labels).
//   The narrow box keeps main's width (BASE.w), so the plot is never smaller than main's at the same width (review #546
//   re-review HOLD: the box grew and the plot shrank); spoke labels wrap at words to the room beside their spoke and a
//   label still too wide moves inward to stay in the box; a word is broken with a hyphen only when it is longer than the
//   whole box line, and "/" stays with the word before it ("Appeal /" then "Beauty"). Only the 50 and 100 ring labels are drawn (25/50/75/100 stacked under markers),
//   and rings, spokes and outlines keep 1px/2px strokes at any scale (vector-effect: non-scaling-stroke).
const LABEL_FS = 20, EM_W = 0.6, PAD = 6, BASE = { x: -70, y: -40, w: SIZE + 140, h: SIZE + 80 };
const NARROW_MIN = 240, WIDE_MIN = 460, BANDS = Array.from({ length: (WIDE_MIN - NARROW_MIN) / 20 }, (_, k) => NARROW_MIN + 20 * k), NARROW_RINGS = [50, 100];
const MARKER_PX = 8, RING_PX = 11, SPOKE_PX = 11;
// Labels wrap at word boundaries (about 13 characters a line); a lone "/" stays on the line of the word before it.
// hardMax (narrow only): a word longer than hardMax characters (the whole box line) is broken with a hyphen; shorter words stay whole.
function wrap(name, width = WRAP, hardMax = 0) {
  const lines = [], words = [];
  for (let word of String(name).split(/\s+/).filter(Boolean)) {
    if (word === '/' && words.length) { words[words.length - 1] += ' /'; continue; }
    while (hardMax && word.length > hardMax) { const cut = hardMax - 1; words.push(`${word.slice(0, cut)}-`); word = word.slice(cut); }
    words.push(word);
  }
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + word).length <= width) lines[lines.length - 1] = `${last} ${word}`; else lines.push(word);
  }
  return lines.length ? lines : ['—']; // a blank (empty or whitespace-only) name shows an em dash, never an empty label (NaN box)
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

export const radarCss = `.lens-radar figure{margin:8px 0 0;container-type:inline-size}.lens-radar svg{display:block;width:100%;max-width:460px;height:auto;margin:0 auto;overflow:visible}
.lens-radar .ring{fill:none;stroke:var(--line);stroke-width:1}.lens-radar .spoke{stroke:var(--line);stroke-width:1}
.lens-radar .ring-label{font-size:13px;fill:var(--secondary)}.lens-radar .spoke-label{font-size:${LABEL_FS}px;fill:var(--ink)}
.lens-radar [data-radar-lens] polygon{fill-opacity:.12;stroke-width:2;fill:var(--secondary);stroke:var(--secondary)}.lens-radar [data-radar-lens] polyline{fill:none;stroke-width:2;stroke:var(--secondary)}
.lens-radar [data-radar-lens] circle{stroke:var(--paper);stroke-width:1.5;fill:var(--secondary)}
.lens-radar [data-radar-lens]:is([data-radar-lens="Translation Team" i],[data-radar-lens=team i]) :is(polygon,circle){fill:var(--lens-green)}
.lens-radar [data-radar-lens]:is([data-radar-lens="Translation Team" i],[data-radar-lens=team i]) :is(polygon,polyline){stroke:var(--lens-green)}
.lens-radar [data-radar-lens=community i] :is(polygon,circle){fill:var(--lens-blue)}.lens-radar [data-radar-lens=community i] :is(polygon,polyline){stroke:var(--lens-blue)}
.lens-radar [data-radar-lens=church i] :is(polygon,circle){fill:var(--lens-yellow)}.lens-radar [data-radar-lens=church i] :is(polygon,polyline){stroke:var(--lens-yellow)}
.lens-radar ul.lens-radar-legend{list-style:none;padding:0;margin:8px 0 0!important;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}
.lens-radar-legend li{display:flex;align-items:center;gap:6px;border:0!important;padding:0!important;margin:0!important}
.lens-radar-legend .lens-agree-dot{position:static;margin:0;width:10px;height:10px;border-width:1px}
.lens-radar svg.radar-narrow{display:none;--wmin:${NARROW_MIN}}
@container (max-width:${WIDE_MIN - 0.02}px){.lens-radar svg.radar-wide{display:none}.lens-radar svg.radar-narrow{display:block}}
${BANDS.slice(1).map(b => `@container (min-width:${b}px){.lens-radar svg.radar-narrow{--wmin:${b}}}`).join('')}
.lens-radar .radar-narrow .ring-label{font-size:calc(${RING_PX}px * var(--vbw) / var(--wmin))}
.lens-radar .radar-narrow .spoke-label{font-size:calc(${SPOKE_PX}px * var(--vbw) / var(--wmin))}
.lens-radar .radar-narrow circle{r:calc(${MARKER_PX / 2}px * var(--vbw) / var(--wmin))}
.lens-radar .radar-narrow :is(.ring,.spoke,polygon,polyline,circle){vector-effect:non-scaling-stroke}`;

/** Estimated extents of one laid-out spoke label in viewBox units at font size fs: { left, right, top, bottom }. */
export function labelExtents({ lx, y, anchor, parts }, fs = LABEL_FS) {
  const w = Math.max(...parts.map(p => p.length)) * EM_W * fs, line = LINE * fs / LABEL_FS;
  const left = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
  return { left, right: left + w, top: y - fs * 0.8, bottom: y + (parts.length - 1) * line + fs * 0.25 };
}
/** Narrow: main's fixed box grown (never shrunk) to hold every label plus PAD, evenly on both sides so the chart stays centred. */
export function radarViewBox(labels, fs = LABEL_FS) {
  let x0 = BASE.x, y0 = BASE.y, x1 = BASE.x + BASE.w, y1 = BASE.y + BASE.h;
  for (const l of labels) {
    const e = labelExtents(l, fs);
    x0 = Math.min(x0, e.left - PAD); x1 = Math.max(x1, e.right + PAD); y0 = Math.min(y0, e.top - PAD); y1 = Math.max(y1, e.bottom + PAD);
  }
  const half = Math.max(C - x0, x1 - C);
  return { x: C - half, y: y0, w: 2 * half, h: y1 - y0 };
}
/** Spoke labels laid out at font size fs, wrapping at width characters a line. */
function layoutLabels(spokes, fs, width, topClear = 0, half = 0) {
  const count = spokes.length, line = LINE * fs / LABEL_FS, gap = fs * 0.2;
  return spokes.map((name, i) => {
    // topClear lifts the top spoke label clear of the ring numbers drawn just above that spoke (narrow only).
    const [px, py] = point(i, count, ((LABEL_R - 4 + gap + (i === 0 ? topClear : 0)) / R) * 100);
    const anchor = Math.abs(px - C) < 8 ? 'middle' : px > C ? 'start' : 'end';
    // half > 0 (narrow): fit each label's line length to the room between its anchor and the box edge.
    const room = anchor === 'middle' ? 2 * half : anchor === 'start' ? C + half - px : px - (C - half);
    const parts = half ? wrap(name, Math.max(4, Math.floor((room - PAD) / (EM_W * fs))), Math.floor((2 * half - 2 * PAD) / (EM_W * fs))) : wrap(name, width);
    const y = py - (py < C ? (parts.length - 1) * line : 0) + fs / 4;
    let lx = px;
    if (half) {
      // A whole word wider than the room beside its spoke: move the label inward just enough to stay inside the box.
      const w = Math.max(...parts.map(p => p.length)) * EM_W * fs;
      if (anchor === 'start') lx = Math.min(px, C + half - PAD - w);
      else if (anchor === 'end') lx = Math.max(px, C - half + PAD + w);
    }
    return { name, i, lx, y, anchor, parts, line };
  });
}
/** Narrow layout: main's box width, spoke labels at their largest unit size (SPOKE_PX at NARROW_MIN) wrapped to fit it. */
function narrowLayout(spokes) {
  const fs = SPOKE_PX * BASE.w / NARROW_MIN, labels = layoutLabels(spokes, fs, 0, fs * RING_PX / SPOKE_PX, BASE.w / 2);
  return { labels, box: radarViewBox(labels, fs) };
}
function radarSvg(doc, model, variant) {
  const count = model.spokes.length;
  // Wide: main 8646a5b's fixed box exactly (review #546 HOLD k0005: growing it shrank the desktop chart).
  const { labels, box: vb } = variant === 'narrow' ? narrowLayout(model.spokes) : { labels: layoutLabels(model.spokes, LABEL_FS, WRAP), box: BASE };
  const svg = svgEl(doc, 'svg', { class: `radar-${variant}`, viewBox: [vb.x, vb.y, vb.w, vb.h].map(fmt).join(' '), role: 'img', style: `--vbw:${fmt(vb.w)}` });
  svg.append(svgEl(doc, 'title', {}, radarCopy.title));
  for (const ring of RINGS) {
    svg.append(svgEl(doc, 'polygon', { class: 'ring', points: model.spokes.map((_, i) => point(i, count, ring).map(fmt).join(',')).join(' ') }));
    if (variant === 'narrow' && !NARROW_RINGS.includes(ring)) continue;
    const [x, y] = point(0, count, ring);
    svg.append(svgEl(doc, 'text', { class: 'ring-label', x: fmt(x + 4), y: fmt(y + 3) }, String(ring)));
  }
  for (const { i, lx, y, anchor, parts, line } of labels) {
    const [x2, y2] = point(i, count, 100);
    svg.append(svgEl(doc, 'line', { class: 'spoke', x1: C, y1: C, x2: fmt(x2), y2: fmt(y2) }));
    const text = svgEl(doc, 'text', { class: 'spoke-label', x: fmt(lx), y: fmt(y), 'text-anchor': anchor });
    parts.forEach((p, k) => text.append(svgEl(doc, 'tspan', { x: fmt(lx), dy: k ? fmt(line) : 0 }, p)));
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
      g.append(svgEl(doc, 'circle', { cx: fmt(x), cy: fmt(y), r: 5 }, undefined));
      g.lastChild.append(svgEl(doc, 'title', {}, `${lensLabel(lens)} · ${model.spokes[i]}: ${String(s)} out of 100`));
    });
    svg.append(g);
  }
  return svg;
}

/** Full report: detached DOM section, or null when fewer than three areas were scored by two or more perspectives. */
export function renderLensRadar({ doc, report }) {
  const model = radarModel(report);
  if (!model || typeof doc.createElementNS !== 'function') return null;
  const h = doc.createElement('h4'); h.textContent = radarCopy.heading;
  const p = doc.createElement('p'); p.className = 'small muted'; p.textContent = radarCopy.intro;
  const fig = doc.createElement('figure'); fig.append(radarSvg(doc, model, 'wide'), radarSvg(doc, model, 'narrow'));
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
