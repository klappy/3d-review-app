// Presentation only. The caller retains authorization, report validation and root ownership.
// Source composition: cookbook 2c29676, views-coordinator.js V._understandBody.
// Demo bands/faces/counts are deliberately not data sources for this renderer.
// Exact existing copy.lenses label; kept local to avoid a renderer import cycle.
const lensesHeading = 'Lenses';

const rows = value => Array.isArray(value) ? value : [];
function node(doc, tag, text) {
  const result = doc.createElement(tag);
  if (text !== undefined) result.textContent = String(text);
  return result;
}

// Returns a detached Lenses section, or null when the existing report guard fails
// or no lenses exist. Replace only the existing Lenses section, never append duplicates.
export function renderReportCards({ doc, report }) {
  const payload = report && typeof report === 'object' ? report.payload : null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (typeof payload.source_commit !== 'string' || !payload.versions || typeof payload.versions !== 'object') return null;
  const lenses = rows(payload.lenses);
  if (!lenses.length || lenses.some(lens => !lens || typeof lens !== 'object')) return null;
  const section = node(doc, 'section');
  section.className = 'report-lenses';
  const grid = node(doc, 'ul');
  grid.className = 'report-lens-grid';
  for (const lens of lenses) {
    const card = node(doc, 'li');
    card.className = 'report-lens-card glass panel';
    card.dataset.lens = String(lens.lens);
    const score = node(doc, 'p', String(lens.score));
    score.className = 'report-lens-score';
    card.append(node(doc, 'h5', String(lens.lens)), score);
    const subs = rows(lens.sub_dimensions);
    if (subs.length) {
      const list = node(doc, 'ul');
      for (const sub of subs) {
        list.append(node(doc, 'li', `${String(sub.sub_dimension)} · ${String(sub.score)} · ${String(sub.n_items_included)}`));
      }
      card.append(list);
    }
    grid.append(card);
  }
  section.append(node(doc, 'h4', lensesHeading), grid);
  return section;
}
