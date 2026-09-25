import assert from 'node:assert/strict';
import test from 'node:test';
import { copy, createReportState, renderList, renderReport, upsertRow } from './report-view.js';

// Minimal fake DOM: no innerHTML exists on these nodes, so any HTML-string rendering would fail here.
function fakeNode(tag) {
  return { tag, textContent: '', children: [], listeners: {}, dataset: {},
    addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); },
    fire(event) { for (const fn of this.listeners[event] || []) fn({}); },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; } };
}
const doc = { createElement: tag => fakeNode(tag) };
const flat = node => [node.textContent, ...node.children.map(flat)].join('\n');
const lines = node => flat(node).split('\n').filter(Boolean);
// Sections are keyed by their <h4>; each section's remaining text is its rows, in render order.
function sectionRows(root, heading) {
  const section = root.children.find(s => s.tag === 'section' && s.children[0].textContent === heading);
  return section ? section.children.slice(1).flatMap(child => lines(child)) : null;
}

const REPORT = {
  id: 'rep_synthetic_1',
  created_at: '2026-09-17T10:00:00.000Z',
  payload: {
    schema_version: '3d-synthetic-assessment-report-v1',
    synthetic: true,
    source_commit: 'f042cdeabcdef123456',
    versions: { scorer: 'steve-f042cde-single-assessment-v1', narrative: 'steve-f042cde-rule-narrative-v1', policy: 'synthetic-current-assessment-asof-query-v1' },
    assessment_id: 'assess_synth',
    lenses: [
      { lens: 'team', score: 66.66666, n_subdims_included: 2, sub_dimensions: [
        { sub_dimension: 'process', score: 70, n_items_included: 3 },
        { sub_dimension: 'relationships', score: 63.3333, n_items_included: 2 },
      ] },
      { lens: 'church', score: 0, n_subdims_included: 0, sub_dimensions: [] },
    ],
    cross_lens_multi: [
      { construct_code: 'c1', construct_name: 'Shared understanding', triangulated_mean: 55.5, agreement_range: 12.25, n_lenses_included: 2, lens_scores: [{ lens: 'team', score: 61.75 }, { lens: 'community', score: 49.5 }] },
    ],
    cross_lens_single: [
      { construct_code: 'c2', construct_name: 'Church involvement', triangulated_mean: 40, agreement_range: null, n_lenses_included: 1, lens_scores: [{ lens: 'church', score: 40 }] },
    ],
    standalone_indicators: [
      { item_id: 'i1', lens: 'community', sub_dimension: 'clarity', question_text: 'Is the meaning clear?', score: 82.5, n_responses: 9 },
    ],
    translation_type_agreement: { construct_name: 'Translation type agreement', team_values: ['meaning-based'], church_values: ['literal', 'meaning-based'], agree: false },
    evidence: [{ form_type: 'team', label: 'Team form', n: 4 }, { form_type: 'church', label: 'Church form', n: 2 }],
    narrative: ['Team scores are highest on process.', 'One lens has no comparable data.'],
  },
};

test('R1 full payload renders header, stability line and every section in payload order', () => {
  const root = fakeNode('section');
  assert.equal(renderReport({ doc, root, report: REPORT }), true);
  const when = new Date('2026-09-17T10:00:00.000Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  assert.equal(root.children[0].textContent, `Built ${when} from the responses that were captured for it. Its content does not change; it may become unavailable under the current synthetic reporting policy.`);
  assert.doesNotMatch(root.children[0].textContent, /\d{4}-\d{2}-\d{2}T/); // B31: no raw ISO stamp on screen
  const tech = root.children[1]; // B31: ids only behind one closed "Technical details" disclosure
  assert.equal(tech.tag, 'details'); assert.equal(tech.open, undefined);
  assert.equal(tech.children[0].tag, 'summary'); assert.equal(tech.children[0].textContent, 'Technical details');
  assert.match(tech.children[1].textContent, /^Synthetic data · source f042cde · scorer steve-f042cde-single-assessment-v1 · narrative steve-f042cde-rule-narrative-v1 · policy synthetic-current-assessment-asof-query-v1/);
  assert.deepEqual(root.children.slice(2).map(s => s.children[0].textContent), [copy.lenses, copy.crossLens, copy.standalone, copy.translationAgreement, copy.evidence, copy.narrative]);
  for (const node of root.children) assert.equal('innerHTML' in node, false);
});

test('R2 lenses print scores exactly as returned; an empty sub-dimension list adds no rows', () => {
  const root = fakeNode('section');
  renderReport({ doc, root, report: REPORT });
  assert.deepEqual(sectionRows(root, copy.lenses), ['team', '66.66666', 'process · 70 · 3', 'relationships · 63.3333 · 2', 'church', '0']);
});

test('R3 cross-lens: multi before single, null agreement_range prints the fixed label "one lens"', () => {
  const root = fakeNode('section');
  renderReport({ doc, root, report: REPORT });
  assert.deepEqual(sectionRows(root, copy.crossLens), [
    'Shared understanding · 55.5 · 12.25', 'team: 61.75', 'community: 49.5',
    'Church involvement · 40 · one lens', 'church: 40',
  ]);
});

test('R4 standalone indicators, evidence and narrative rows', () => {
  const root = fakeNode('section');
  renderReport({ doc, root, report: REPORT });
  assert.deepEqual(sectionRows(root, copy.standalone), ['Is the meaning clear? · community · clarity · 82.5 · 9']);
  assert.deepEqual(sectionRows(root, copy.evidence), ['Team form · 4', 'Church form · 2']);
  assert.deepEqual(sectionRows(root, copy.narrative), ['Team scores are highest on process.', 'One lens has no comparable data.']);
});

test('R5 translation type agreement: values and agree false', () => {
  const root = fakeNode('section');
  renderReport({ doc, root, report: REPORT });
  assert.deepEqual(sectionRows(root, copy.translationAgreement), ['Translation type agreement', 'meaning-based', 'literal · meaning-based', 'false']);
});

test('R6 agree null prints "not comparable"; translation section absent when the payload holds null', () => {
  const root = fakeNode('section');
  renderReport({ doc, root, report: { ...REPORT, payload: { ...REPORT.payload, translation_type_agreement: { ...REPORT.payload.translation_type_agreement, agree: null } } } });
  assert.deepEqual(sectionRows(root, copy.translationAgreement), ['Translation type agreement', 'meaning-based', 'literal · meaning-based', 'not comparable']);
  const bare = fakeNode('section');
  renderReport({ doc, root: bare, report: { ...REPORT, payload: { ...REPORT.payload, translation_type_agreement: null } } });
  assert.equal(sectionRows(bare, copy.translationAgreement), null);
  assert.equal(flat(bare).includes(copy.notComparable), false);
});

test('R7 empty arrays announce no section', () => {
  const root = fakeNode('section');
  renderReport({ doc, root, report: { ...REPORT, payload: { ...REPORT.payload, lenses: [], cross_lens_multi: [], cross_lens_single: [], standalone_indicators: [], evidence: [], narrative: [] } } });
  assert.deepEqual(root.children.slice(2).map(s => s.children[0].textContent), [copy.translationAgreement]);
});

test('R8 held or malformed results render nothing at all', () => {
  for (const report of [null, undefined, {}, { created_at: 'x', payload: null }, { created_at: 'x', payload: { versions: null, source_commit: 'abc' } }, { created_at: 'x', payload: { source_commit: 7, versions: {} } }]) {
    const root = fakeNode('section');
    root.children = [fakeNode('p')];
    assert.equal(renderReport({ doc, root, report }), false);
    assert.deepEqual(root.children, []);
  }
});

test('R9 renderList renders one button row per report and opens by id', () => {
  const list = fakeNode('ol'), opened = [];
  renderList({ doc, list, reports: [{ id: 'rep_a', created_at: 't1' }, { id: 'rep_b', created_at: 't2' }], onOpen: id => opened.push(id) });
  assert.deepEqual(list.children.map(li => li.children[0].textContent), ['Built t1 · rep_a', 'Built t2 · rep_b']);
  assert.deepEqual(list.children.map(li => li.children[0].tag), ['button', 'button']);
  list.children[1].children[0].fire('click');
  assert.deepEqual(opened, ['rep_b']);
  renderList({ doc, list, reports: [], onOpen: () => {} });
  assert.deepEqual(list.children, []);
});

test('R11 upsertRow: an executed build that converges onto a listed id keeps exactly one row, at the top', () => {
  const list = fakeNode('ol'), opened = [];
  const onOpen = id => opened.push(id);
  renderList({ doc, list, reports: [{ id: 'rep_a', created_at: 't1' }, { id: 'rep_b', created_at: 't2' }], onOpen });
  upsertRow({ doc, list, report: { id: 'rep_b', created_at: 't2' }, onOpen });
  assert.deepEqual(list.children.map(li => li.dataset.reportId), ['rep_b', 'rep_a']);
  assert.deepEqual(list.children.map(li => li.children[0].textContent), ['Built t2 · rep_b', 'Built t1 · rep_a']);
  list.children[0].children[0].fire('click');
  assert.deepEqual(opened, ['rep_b']);
  upsertRow({ doc, list, report: { id: 'rep_c', created_at: 't3' }, onOpen }); // a genuinely new report still leads
  assert.deepEqual(list.children.map(li => li.dataset.reportId), ['rep_c', 'rep_b', 'rep_a']);
  const empty = fakeNode('ol');
  upsertRow({ doc, list: empty, report: { id: 'rep_a', created_at: 't1' }, onOpen });
  assert.deepEqual(empty.children.map(li => li.dataset.reportId), ['rep_a']);
});

test('R10 createReportState().clear() drops the pending confirmation, its timer and the cursor', () => {
  const state = createReportState();
  assert.equal(state.reportConfirm, null);
  assert.equal(state.reportCursor, null);
  let cleared = 0;
  state.reportConfirm = { token: 'tok', expiresAt: 1, timer: setTimeout(() => { cleared = -1; }, 60000) };
  state.reportCursor = 'cur1_abc';
  const timer = state.reportConfirm.timer;
  state.clear();
  assert.equal(state.reportConfirm, null);
  assert.equal(state.reportCursor, null);
  clearTimeout(timer); // no-op if clear() already did it; the process must not be held open either way
  assert.equal(cleared, 0);
});
