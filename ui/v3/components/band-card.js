// component: Band card + Band legend (captain ruling 12:34). ONE result card per perspective and ONE colour legend,
// used by the assessment results (Understand) and any page that shows bands. Pure string builders: no reads, no scoring
// (band words come from the caller, e.g. v3ScoreBand). Colours from design-system-v3 tokens only.
const esc0 = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const BAND_LEGEND = Object.freeze([['Strong', '--band-strong'], ['Growing', '--band-growing'], ['Needs support', '--band-needs-support'], ['Needs urgent attention', '--band-urgent'], ['More input needed', '--pip']]);
const LENS_CLASS = { 'Translation Team': 'team', Church: 'church', Community: 'community' };

/** One perspective card. `bodyHtml` and `countHtml` are already-escaped markup from the caller. */
export function bandCard({ lens, word, bodyHtml = '', countHtml = '' } = {}, esc = esc0) {
  return `<div class="glass band lens ${LENS_CLASS[lens] || ''}" data-v3-band="${esc(lens)}" data-v3-band-word="${esc(word)}"><div class="eyebrow">${esc(lens)}</div><div class="word">${esc(word)}</div>${bodyHtml}${countHtml}</div>`;
}

/** The colour legend: one dot per band word. */
export function bandLegend(items = BAND_LEGEND, esc = esc0) {
  return `<div class="legend small muted" data-v3-legend>${items.map(([w, v]) => `<span><i class="dot" style="background:var(${v})" aria-hidden="true"></i>${esc(w)}</span>`).join('')}</div>`;
}
