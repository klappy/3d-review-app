import { renderReportCards } from './report-card.js';
import { lensesCopy, renderLensesAgree } from './report-lenses.js';
import { humanDate } from './assess/cards.js'; // one shared local-time formatter (B31)
// Synthetic report rendering. Dependency-free and importable under node --test with an injected doc.
// Text nodes only: every value comes from the payload as returned (String(), no rounding, no word
// mapping except the agreement sentence below, no colour), plus the fixed labels in `copy`. Nothing here fetches or authorizes.
// The lenses agree / disagree block (report-lenses.js) keeps that rule for values (exact scores and spread) and adds two
// presentation-only things: perspective display names, and a spread colour that always sits beside its text label.
export const copy = Object.freeze({
  headerPrefix: 'Synthetic data',
  builtStability: 'from the responses that were captured for it. Its content does not change; it may become unavailable under the current synthetic reporting policy.',
  built: 'Built',
  technical: 'Technical details',
  lenses: 'Lenses',
  crossLens: lensesCopy.heading, // lenses agree / disagree block (report-lenses.js); no cross-lens mean is shown
  standalone: 'Standalone indicators',
  translationAgreement: 'Translation type agreement',
  evidence: 'Evidence',
  narrative: 'Narrative',
  oneLens: 'one lens',
  notComparable: 'not comparable',
  agreed: 'Agreed',
  seenAs: 'Seen as',
  matches: 'Matches',
  differs: 'Differs',
  notComparableSentence: 'Not comparable',
  emptyList: 'No reports have been built for this assessment.',
});
const val = value => String(value);
// Plain words for the translation type agreement (U33, B31): one sentence, capitalised values,
// Matches/Differs in place of true/false. Display only; the payload is untouched.
const cap = value => { const text = String(value); return text.charAt(0).toUpperCase() + text.slice(1); };
export function agreementSentence(agreement) {
  const words = values => (Array.isArray(values) ? values : []).map(cap).join(', ') || '—';
  const verdict = agreement.agree === true ? copy.matches : agreement.agree === false ? copy.differs : copy.notComparableSentence;
  return `${copy.agreed}: ${words(agreement.team_values)} · ${copy.seenAs}: ${words(agreement.church_values)} · ${verdict}`;
}
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
  s.className = 'report-detail-section glass panel';
  s.append(el(doc, 'h4', heading), ...body);
  return s;
}
function metrics(doc, pairs) {
  const dl = el(doc, 'dl'); dl.className = 'report-metrics';
  for (const [label, value] of pairs) {
    const pair = el(doc, 'div'); const term = el(doc, 'dt', label); term.className = 'fs-label';
    pair.append(term, el(doc, 'dd', val(value))); dl.append(pair);
  }
  return dl;
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
  out.push(el(doc, 'p', `${copy.built} ${humanDate(report.created_at)} ${copy.builtStability}`));
  // B31: provenance ids and the report id stay off the screen by default — one closed disclosure.
  const tech = el(doc, 'details');
  tech.append(el(doc, 'summary', copy.technical), el(doc, 'p', `${copy.headerPrefix} · source ${payload.source_commit.slice(0, 7)} · scorer ${val(versions.scorer)} · narrative ${val(versions.narrative)} · policy ${val(versions.policy)}${report.id ? ` · report ${val(report.id)}` : ''} · built ${val(report.created_at)}`));
  out.push(tech);
  // Sections follow payload order; an absent or empty one is not announced. One exception: the lenses agree / disagree block
  // leads (cookbook DEC-0012), one barbell per area scored by two or more lenses, biggest spread first.
  const agree = renderLensesAgree({ doc, report });
  if (agree) out.push(agree);
  const cards = renderReportCards({ doc, report });
  if (cards) out.push(cards);
  const standalone = rows(payload.standalone_indicators);
  if (standalone.length) {
    out.push(section(doc, copy.standalone, [list(doc, standalone.map(ind => {
      const li = el(doc, 'li');
      li.append(el(doc, 'h5', val(ind.question_text)), el(doc, 'p', `${val(ind.lens)} · ${val(ind.sub_dimension)}`), metrics(doc, [['Score', ind.score], ['Responses', ind.n_responses]]));
      return li;
    }))]));
  }
  const agreement = payload.translation_type_agreement;
  if (agreement && typeof agreement === 'object') {
    out.push(section(doc, copy.translationAgreement, [el(doc, 'p', agreementSentence(agreement))]));
  }
  const evidence = rows(payload.evidence);
  if (evidence.length) {
    out.push(section(doc, copy.evidence, [list(doc, evidence.map(entry => {
      const li = el(doc, 'li'); li.className = 'report-evidence-row';
      li.append(el(doc, 'strong', val(entry.label)), metrics(doc, [['Submissions', entry.n]])); return li;
    }))]));
  }
  const narrative = rows(payload.narrative);
  if (narrative.length) {
    const observations = list(doc, narrative.map(line => el(doc, 'li', val(line))));
    observations.className = 'report-observations';
    out.push(section(doc, copy.narrative, [observations]));
  }
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
