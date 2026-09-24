// component: Evidence table (captain ruling 12:34). The results (10) disclosure: a quiet "Show evidence and details" /
// "Simple view" toggle and the "What supports this view?" table (Evidence · What we can say · Limit). Pure string
// builder: renders only the rows and footer the caller passes; escapes every cell.
const esc0 = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Returns { btn, table } so the caller can place the toggle in its header row and the table below the bands. */
export function evidenceTable(rows = [], open = false, esc = esc0, { footer = '', heading = 'What supports this view?' } = {}) {
  const btn = `<button type="button" class="quiet" data-v3-evidence-toggle aria-expanded="${open ? 'true' : 'false'}">${open ? 'Simple view' : 'Show evidence and details'}</button>`;
  const body = rows.map(e => `<tr>${e.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const foot = footer ? `<p class="small muted footer">${esc(footer)}</p>` : '';
  const table = `<div class="v3-evidence" data-v3-evidence${open ? '' : ' hidden'}><h3>${esc(heading)}</h3><table class="table"><thead><tr><th>Evidence</th><th>What we can say</th><th>Limit</th></tr></thead><tbody>${body}</tbody></table>${foot}</div>`;
  return { btn, table };
}
