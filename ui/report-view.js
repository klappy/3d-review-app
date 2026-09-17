// Synthetic report rendering. Dependency-free and importable under node --test with an injected doc.
// Text nodes only: every value comes from the payload as returned (String(), no rounding, no word
// mapping, no colour), plus the fixed labels in `copy`. Nothing here fetches or authorizes.
export const copy = Object.freeze({
  headerPrefix: 'Synthetic data',
  builtStability: 'from the responses that were captured for it. Its content does not change; it may become unavailable under the current synthetic reporting policy.',
  built: 'Built',
  lenses: 'Lenses',
  crossLens: 'Cross-lens comparisons',
  standalone: 'Standalone indicators',
  translationAgreement: 'Translation type agreement',
  evidence: 'Evidence',
  narrative: 'Narrative',
  oneLens: 'one lens',
  notComparable: 'not comparable',
  emptyList: 'No reports have been built for this assessment.',
});
const val = value => String(value);
function el(doc, tag, textContent) {
  const node = doc.createElement(tag);
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}
function list(doc, rows) {
  const ul = el(doc, 'ul');
  for (const row of rows) ul.append(row);
  return ul;
}
function section(doc, heading, body) {
  const s = el(doc, 'section');
  s.append(el(doc, 'h4', heading), ...body);
  return s;
}
const rows = value => (Array.isArray(value) ? value : []);
// A held or malformed result renders nothing at all rather than a partial report.
export function renderReport({ doc, root, report }) {
  root.replaceChildren();
  const payload = report && typeof report === 'object' ? report.payload : null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const versions = payload.versions;
  if (typeof payload.source_commit !== 'string' || !versions || typeof versions !== 'object') return false;
  const out = [];
  out.push(el(doc, 'p', `${copy.headerPrefix} · source ${payload.source_commit.slice(0, 7)} · scorer ${val(versions.scorer)} · narrative ${val(versions.narrative)} · policy ${val(versions.policy)}`));
  out.push(el(doc, 'p', `${copy.built} ${val(report.created_at)} ${copy.builtStability}`));
  // Sections follow payload order; an absent or empty one is not announced.
  const lenses = rows(payload.lenses);
  if (lenses.length) {
    out.push(section(doc, copy.lenses, [list(doc, lenses.map(lens => {
      const li = el(doc, 'li', `${val(lens.lens)} · ${val(lens.score)}`);
      const subs = rows(lens.sub_dimensions);
      if (subs.length) li.append(list(doc, subs.map(sub => el(doc, 'li', `${val(sub.sub_dimension)} · ${val(sub.score)} · ${val(sub.n_items_included)}`))));
      return li;
    }))]));
  }
  const cross = [...rows(payload.cross_lens_multi), ...rows(payload.cross_lens_single)];
  if (cross.length) {
    out.push(section(doc, copy.crossLens, [list(doc, cross.map(entry => {
      const agreement = entry.agreement_range === null || entry.agreement_range === undefined ? copy.oneLens : val(entry.agreement_range);
      const li = el(doc, 'li', `${val(entry.construct_name)} · ${val(entry.triangulated_mean)} · ${agreement}`);
      const perLens = rows(entry.lens_scores);
      if (perLens.length) li.append(list(doc, perLens.map(score => el(doc, 'li', `${val(score.lens)}: ${val(score.score)}`))));
      return li;
    }))]));
  }
  const standalone = rows(payload.standalone_indicators);
  if (standalone.length) {
    out.push(section(doc, copy.standalone, [list(doc, standalone.map(ind => el(doc, 'li', `${val(ind.question_text)} · ${val(ind.lens)} · ${val(ind.sub_dimension)} · ${val(ind.score)} · ${val(ind.n_responses)}`)))]));
  }
  const agreement = payload.translation_type_agreement;
  if (agreement && typeof agreement === 'object') {
    out.push(section(doc, copy.translationAgreement, [list(doc, [
      el(doc, 'li', val(agreement.construct_name)),
      el(doc, 'li', rows(agreement.team_values).map(val).join(' · ')),
      el(doc, 'li', rows(agreement.church_values).map(val).join(' · ')),
      el(doc, 'li', agreement.agree === null || agreement.agree === undefined ? copy.notComparable : val(agreement.agree)),
    ])]));
  }
  const evidence = rows(payload.evidence);
  if (evidence.length) {
    out.push(section(doc, copy.evidence, [list(doc, evidence.map(entry => el(doc, 'li', `${val(entry.label)} · ${val(entry.n)}`)))]));
  }
  const narrative = rows(payload.narrative);
  if (narrative.length) out.push(section(doc, copy.narrative, narrative.map(line => el(doc, 'p', val(line)))));
  root.replaceChildren(...out);
  return true;
}
// Rows carry the only two disclosed list fields; opening one is the caller's authorized read.
function reportRow(doc, report, onOpen) {
  const li = el(doc, 'li');
  li.dataset.reportId = val(report.id);
  const button = el(doc, 'button', `${copy.built} ${val(report.created_at)} · ${val(report.id)}`);
  button.type = 'button';
  button.addEventListener('click', () => onOpen(report.id));
  li.append(button);
  return li;
}
export function renderList({ doc, list: target, reports, onOpen }) {
  target.replaceChildren(...rows(reports).map(report => reportRow(doc, report, onOpen)));
}
// An executed build can converge onto a row the list already shows (same captured membership and
// version tuple), so the row is keyed by id: one row per report, most recent build at the top.
export function upsertRow({ doc, list: target, report, onOpen }) {
  const id = val(report.id);
  const kept = [...(target.children || [])].filter(row => !row.dataset || row.dataset.reportId !== id);
  target.replaceChildren(reportRow(doc, report, onOpen), ...kept);
}
// The pending confirmation and the list cursor never outlive an identity, project or assessment change.
export function createReportState() {
  return {
    reportConfirm: null,
    reportCursor: null,
    clear() {
      if (this.reportConfirm && this.reportConfirm.timer) clearTimeout(this.reportConfirm.timer);
      this.reportConfirm = null;
      this.reportCursor = null;
    },
  };
}
