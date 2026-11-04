// ui/assess/improve-resources.js — Improve: a resource line under each suggested (low-scoring) area.
// Source: cookbook work/active/2026-10-26-3d-improve-resources-links (Done when 2): each low-scoring category shows its resources;
// a category with none says "More resources coming."
// DATA ONLY. The category → resource table is pending from its owner. Add entries to IMPROVE_RESOURCES exactly as delivered;
// never guess a title or a URL. Shape: { '<category>': [{ title: '<as delivered>', url: 'https://…' }, …] }.
// Keys match case-insensitively against the whole suggested area ("Church", "Translation Team · Listening") first,
// then its last part after " · " (the category name as the report names it, e.g. "Listening").
export const IMPROVE_RESOURCES = Object.freeze({});
export const RESOURCES_COMING = 'More resources coming.';

const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const safeUrl = u => typeof u === 'string' && /^https?:\/\//i.test(u.trim());

/** The resources for one suggested area: [] when the table has none (or only malformed entries). */
export function resourcesFor(area, table = IMPROVE_RESOURCES) {
  const keys = Object.keys(table || {}), byKey = new Map(keys.map(k => [norm(k), table[k]]));
  const whole = norm(area), last = norm(String(area ?? '').split(' · ').pop());
  const hit = byKey.get(whole) ?? byKey.get(last) ?? [];
  return (Array.isArray(hit) ? hit : []).filter(r => r && safeUrl(r.url) && String(r.title ?? '').trim());
}

/** One short line under the area: its resource links, or "More resources coming." */
export function resourcesMarkup(area, esc, table = IMPROVE_RESOURCES) {
  const rs = resourcesFor(area, table);
  const body = rs.length
    ? rs.map(r => `<a href="${esc(r.url.trim())}" target="_blank" rel="noopener noreferrer">${esc(r.title.trim())}</a>`).join(' · ')
    : esc(RESOURCES_COMING);
  return `<p class="small muted" data-resources-for="${esc(area)}">${body}</p>`;
}
