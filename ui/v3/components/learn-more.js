// component: Learn more (captain order 17:05, lane 9 "less text"). ONE collapsed disclosure for explanations a screen
// no longer shows up front: each v3 screen keeps one heading, at most one short line and one primary action.
// Same markup the public home shipped in #264. Pure string builder: `innerHtml` is already-escaped markup from the caller.
export function learnMore(innerHtml = '', { summary = 'Learn more' } = {}) {
  if (!innerHtml) return '';
  return `<details class="small learn-more"><summary>${String(summary).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</summary>${innerHtml}</details>`;
}
