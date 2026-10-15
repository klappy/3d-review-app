// Lenses agree / disagree: one barbell per cross-lens sub-score, biggest spread first.
// Decision record: cookbook atoms/DEC-0012 and DEC-0013; unit work/active/2026-10-15-3d-report-lenses-disagree.
// Presentation only, shared by the assessment overview (HTML string) and the full report (DOM). It reads the existing
// payload fields (cross_lens_multi, cross_lens_single, lens_scores, evidence) and never changes or re-scores them.
// No mean of the lenses is shown: the lens scores and the spread (highest minus lowest) only.

// Spread cut points (points on the 0–100 axis), recorded in the PR: spread ≤ 10 agree (green), 10 < spread < 30 some
// difference (amber), spread ≥ 30 disagree (red). One place to change them.
export const SPREAD_CUTS = Object.freeze({ agree: 10, disagree: 30 });
// On screen the user's word is "perspective" (the results panel heading and the Results mock); "lens" stays a code name.
export const SPREAD_WORDS = Object.freeze({ agree: 'Perspectives agree', mixed: 'Some difference', disagree: 'Perspectives disagree' });
export const lensesCopy = Object.freeze({
  heading: 'Do the perspectives agree?',
  intro: 'Each line shows one area scored by more than one perspective, on a 0–100 scale. Biggest difference first.',
  spread: 'Difference',
  oneLens: 'Only one perspective scored this area',
  respondents: n => `${n} ${n === 1 ? 'response' : 'responses'}`,
  noCount: 'responses not counted',
  consultants: n => `${n} of them ${n === 1 ? 'consultant' : 'consultants'}`,
  legend: `Difference of ${SPREAD_CUTS.agree} points or less: perspectives agree · more than ${SPREAD_CUTS.agree} and less than ${SPREAD_CUTS.disagree}: some difference · ${SPREAD_CUTS.disagree} or more: perspectives disagree.`,
});
// Display names for the payload's lens ids (the same words the setup screen uses, scope.js PERSPECTIVES); unknown ids show as returned.
const LENS_LABELS = Object.freeze({ 'translation team': 'Translation team', team: 'Translation team', community: 'Community', church: 'Church' });
export const lensLabel = lens => LENS_LABELS[String(lens).toLowerCase()] || String(lens);

const rows = value => (Array.isArray(value) ? value : []);
const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const clamp = v => Math.max(0, Math.min(100, v));
// Two readings of one value. Overview: whole points (the band cards' scale), exact value in title. Full report: the value
// exactly as returned (report-view.js contract: String(), no rounding). The chip's band is always classified on the value shown.
const shownFor = exact => (exact ? v => String(v) : v => String(Math.round(v)));

/** Spread (points) → 'agree' | 'mixed' | 'disagree'. */
export function spreadBand(spread, cuts = SPREAD_CUTS) {
  return spread <= cuts.agree ? 'agree' : spread >= cuts.disagree ? 'disagree' : 'mixed';
}

/** Submissions per lens from the report's own evidence rows ("<Lens> — <form>" labels). Unmatched lens → null.
 *  The Consultant form (CHCC, "Church — Consultant") is scored by the pinned scorer inside the Church lens; this block
 *  never re-scores, so it counts consultant submissions separately (consultantsByLens) and says so beside the count. */
export function lensRespondents(payload) {
  const out = new Map();
  for (const e of rows(payload && payload.evidence)) {
    if (!e || typeof e.label !== 'string' || !Number.isFinite(num(e.n))) continue;
    const lens = e.label.split(' — ')[0];
    out.set(lens, (out.get(lens) || 0) + num(e.n));
  }
  return out;
}
export const CONSULTANT_FORM = 'CHCC';
export function consultantsByLens(payload) {
  const out = new Map();
  for (const e of rows(payload && payload.evidence)) {
    if (!e || e.form_type !== CONSULTANT_FORM || typeof e.label !== 'string' || !Number.isFinite(num(e.n))) continue;
    const lens = e.label.split(' — ')[0];
    out.set(lens, (out.get(lens) || 0) + num(e.n));
  }
  return out;
}

/** Barbell rows for a built report: [{ name, spread, band, lenses:[{lens, score, n}] }], biggest spread first;
 *  single-lens areas follow with spread null. Malformed entries are skipped, never guessed. The spread is the payload's
 *  own agreement_range when it is a number (exact as returned), else highest minus lowest of the shown scores.
 *  `exact` (full report) classifies the band on the exact spread; otherwise on the whole-point value the overview shows. */
export function lensSpreadRows(report, { exact = false } = {}) {
  const payload = report && typeof report === 'object' ? report.payload : null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const counts = lensRespondents(payload), consultants = consultantsByLens(payload);
  const all = [...rows(payload.cross_lens_multi), ...rows(payload.cross_lens_single)].map((entry, order) => {
    if (!entry || typeof entry !== 'object') return null;
    const lenses = rows(entry.lens_scores).filter(s => s && typeof s.lens === 'string' && Number.isFinite(num(s.score)))
      .map(s => ({ lens: s.lens, score: num(s.score), n: counts.has(s.lens) ? counts.get(s.lens) : null, ...(consultants.get(s.lens) ? { consultants: consultants.get(s.lens) } : {}) }));
    if (!lenses.length) return null;
    const scores = lenses.map(s => s.score);
    const given = num(entry.agreement_range);
    const spread = lenses.length < 2 ? null : Number.isFinite(given) ? given : Math.max(...scores) - Math.min(...scores);
    return { name: String(entry.construct_name), spread, band: spread === null ? null : spreadBand(exact ? spread : Math.round(spread)), lenses, order }; // band from the value the chip shows
  }).filter(Boolean);
  return all.sort((a, b) => (a.spread === null) - (b.spread === null) || (b.spread ?? 0) - (a.spread ?? 0) || a.order - b.order)
    .map(({ order, ...row }) => row);
}

// Every colour is a design-system-v3 token (ui/design-system-v3/tokens.css); no raw hex. Bands reuse the band-card
// tokens (--band-growing / --band-needs-support / --band-urgent), chips the badge and warning pairs, quiet text --secondary.
export const lensesCss = `.lens-agree{margin:12px 0}.lens-agree h3,.lens-agree h4{margin:0 0 4px}.lens-agree>p{margin:0 0 10px}
.lens-agree ul.lens-agree-rows{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.lens-agree-row{padding:10px 12px;border:1px solid var(--line);border-left-width:6px;border-radius:12px;min-width:0}
.lens-agree-row[data-spread-band=agree]{border-left-color:var(--band-growing)}.lens-agree-row[data-spread-band=mixed]{border-left-color:var(--band-needs-support)}
.lens-agree-row[data-spread-band=disagree]{border-left-color:var(--band-urgent)}
.lens-agree-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;align-items:baseline}
.lens-agree-head strong{overflow-wrap:anywhere}
.lens-agree-chip{font-size:13px;font-weight:600;padding:1px 8px;border-radius:999px;white-space:nowrap;border:1px solid transparent}
.lens-agree-row[data-spread-band=agree] .lens-agree-chip{background:var(--badge-fill);color:var(--badge-ink)}
.lens-agree-row[data-spread-band=mixed] .lens-agree-chip{background:var(--warning-fill);color:var(--warning-ink)}
.lens-agree-row[data-spread-band=disagree] .lens-agree-chip{background:var(--paper);color:var(--ink);border-color:var(--band-urgent)}
.lens-agree-track{position:relative;height:18px;margin:10px 9px 6px;background:linear-gradient(var(--line),var(--line)) center/100% 2px no-repeat}
.lens-agree-bar{position:absolute;top:6px;height:6px;border-radius:3px;background:var(--secondary)}
.lens-agree-row[data-spread-band=agree] .lens-agree-bar{background:var(--band-growing)}.lens-agree-row[data-spread-band=mixed] .lens-agree-bar{background:var(--band-needs-support)}
.lens-agree-row[data-spread-band=disagree] .lens-agree-bar{background:var(--band-urgent)}
.lens-agree-dot{position:absolute;top:1px;width:16px;height:16px;margin-left:-8px;border-radius:50%;border:2px solid var(--paper);box-shadow:0 0 0 1px var(--secondary);background:var(--secondary)}
.lens-agree-dot:is([data-lens="Translation Team" i],[data-lens=team i]){background:var(--lens-green)}.lens-agree-dot[data-lens=community i]{background:var(--lens-blue)}
.lens-agree-dot[data-lens=church i]{background:var(--lens-yellow)}
.lens-agree-scale{display:flex;justify-content:space-between;font-size:11px;color:var(--secondary);margin:0 0 4px}
ul.lens-agree-scores{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}
.lens-agree-scores li{display:flex;align-items:center;gap:6px;border:0!important;padding:0!important}
.lens-agree-scores .lens-agree-dot{position:static;margin:0;width:10px;height:10px;border-width:1px}
.lens-agree-scores b{font-variant-numeric:tabular-nums}.lens-agree-n{color:var(--secondary);font-size:13px}
.lens-agree-legend{font-size:13px;color:var(--secondary);margin:10px 0 0}`;

const escape0 = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const countText = s => (s.n === null ? lensesCopy.noCount : s.consultants ? `${lensesCopy.respondents(s.n)}, ${lensesCopy.consultants(s.consultants)}` : lensesCopy.respondents(s.n));
const headText = (row, shown) => (row.spread === null ? lensesCopy.oneLens : `${SPREAD_WORDS[row.band]} · ${lensesCopy.spread} ${shown(row.spread)}`);

// One node spec ({tag, cls, text, data, style, title, hidden, kids}) serialised two ways: an escaped HTML string for the
// overview template and plain createElement/textContent nodes for the full report (which never uses innerHTML).
const n = (tag, cls, kids = [], extra = {}) => ({ tag, cls, kids, ...extra });
function spec(report, level, exact = false) {
  const list = lensSpreadRows(report, { exact }), shown = shownFor(exact);
  if (!list.length) return null;
  const items = list.map(row => {
    const pos = row.lenses.map(s => clamp(s.score)), lo = Math.min(...pos), hi = Math.max(...pos);
    const dots = row.lenses.map(s => n('span', 'lens-agree-dot', [], { data: { lens: s.lens }, style: { left: `${clamp(s.score)}%` }, title: `${lensLabel(s.lens)}: ${s.score}` }));
    const bar = row.spread === null ? [] : [n('span', 'lens-agree-bar', [], { style: { left: `${lo}%`, width: `${hi - lo}%` } })];
    const scores = row.lenses.map(s => n('li', null, [
      n('span', 'lens-agree-dot', [], { data: { lens: s.lens }, hidden: true }), n('span', null, [], { text: `${lensLabel(s.lens)} ` }),
      n('b', null, [], exact ? { text: shown(s.score) } : { text: shown(s.score), title: String(s.score) }), n('span', 'lens-agree-n', [], { text: ` ${countText(s)}` }),
    ], { data: { lensScore: s.lens } }));
    const data = { spreadBand: row.band || 'single' };
    if (row.spread !== null) data.spread = String(row.spread);
    return n('li', 'lens-agree-row', [
      n('div', 'lens-agree-head', [n('strong', null, [], { text: row.name }), n('span', 'lens-agree-chip', [], { text: headText(row, shown) })]),
      n('div', 'lens-agree-track', [...bar, ...dots], { hidden: true }),
      n('div', 'lens-agree-scale', [n('span', null, [], { text: '0' }), n('span', null, [], { text: '100' })], { hidden: true }),
      n('ul', 'lens-agree-scores', scores),
    ], { data });
  });
  return n('section', 'lens-agree', [
    n(level, null, [], { text: lensesCopy.heading }),
    n('p', 'small muted', [], { text: lensesCopy.intro }), n('ul', 'lens-agree-rows', items),
    n('p', 'lens-agree-legend', [], { text: lensesCopy.legend }), n('style', null, [], { text: lensesCss, raw: true }),
  ], { data: { lensesAgree: '' } });
}
const kebab = k => k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
function toHtml(node, esc) {
  const attrs = [node.cls ? ` class="${esc(node.cls)}"` : '', ...Object.entries(node.data || {}).map(([k, v]) => ` data-${kebab(k)}${v === '' ? '' : `="${esc(v)}"`}`),
    node.style ? ` style="${esc(Object.entries(node.style).map(([k, v]) => `${k}:${v}`).join(';'))}"` : '', node.title ? ` title="${esc(node.title)}"` : '', node.hidden ? ' aria-hidden="true"' : ''].join('');
  const text = node.text === undefined ? '' : node.raw ? node.text : esc(node.text);
  return `<${node.tag}${attrs}>${text}${node.kids.map(k => toHtml(k, esc)).join('')}</${node.tag}>`;
}
function toDom(doc, node) {
  const el = doc.createElement(node.tag);
  if (node.cls) el.className = node.cls;
  if (node.text !== undefined) el.textContent = node.text;
  for (const [k, v] of Object.entries(node.data || {})) el.dataset[k] = v;
  if (node.style && el.style) for (const [k, v] of Object.entries(node.style)) el.style[k] = v;
  if (node.title) el.title = node.title;
  if (node.hidden && el.setAttribute) el.setAttribute('aria-hidden', 'true');
  if (node.kids.length) el.append(...node.kids.map(k => toDom(doc, k)));
  return el;
}

/** Overview: HTML string (every value escaped), or '' when the report has no cross-lens areas. */
export function lensesAgreeMarkup(report, esc = escape0, level = 'h3') {
  const tree = spec(report, level);
  return tree ? toHtml(tree, esc) : '';
}

/** Full report: detached DOM section (createElement/textContent only), or null when there is nothing to show.
 *  Scores and spread print exactly as returned (report-view.js header); the band is classified on that exact value. */
export function renderLensesAgree({ doc, report }) {
  const tree = spec(report, 'h4', true);
  if (!tree) return null;
  tree.cls = 'lens-agree report-detail-section glass panel';
  return toDom(doc, tree);
}
