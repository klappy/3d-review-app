// B09: optional "About you" (age range, gender) before Q1 on the participant form; skippable, no name field.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { drawAbout, aboutValues, aboutFields, mountParticipantView } from './participant-view.js';
import { RESPONDENT_FIELDS } from './v3/components/context-fields.js';

test('About you sits in the welcome before Start, every select optional with Prefer not to say', () => {
  const { window } = new JSDOM('<main id="participant"><div id="root"></div><form id="f"><div id="q"><fieldset data-item="Q1"><legend>Q1</legend><input name="Q1"></fieldset></div><button type="submit">Review</button></form></main>');
  const doc = window.document;
  const about = drawAbout(doc, RESPONDENT_FIELDS);
  mountParticipantView({ doc, root: doc.getElementById('root'), form: doc.getElementById('f'), questions: doc.getElementById('q'), model: { items: [{ id: 'Q1', type: 'text' }], template: {} }, about });
  const intro = doc.querySelector('.participant-intro');
  assert.ok(intro.contains(about));
  assert.ok(about.compareDocumentPosition(intro.querySelector('.participant-start')) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(about.querySelector('legend').textContent, 'About you (optional)');
  const selects = [...about.querySelectorAll('select')];
  assert.deepEqual(selects.map(s => s.dataset.key), ['age_range', 'gender']);
  assert.ok(selects.every(s => !s.required && s.value === '' && [...s.options].some(o => o.textContent === 'Prefer not to say')));
  assert.equal(about.querySelectorAll('input').length, 0);
  assert.deepEqual(aboutValues(about), {});
  selects[1].value = 'prefer_not';
  assert.deepEqual(aboutValues(about), { gender: 'prefer_not' });
  assert.equal(drawAbout(doc, []), null);
});

// S15a: hidden unless the facilitator turned demographics on for the assessment (off by default).
test('About you is hidden unless the form says demographics_enabled === true', () => {
  const { window } = new JSDOM('<main></main>');
  const doc = window.document;
  for (const model of [{ context_fields: RESPONDENT_FIELDS }, { demographics_enabled: false, context_fields: RESPONDENT_FIELDS }, { demographics_enabled: 'true', context_fields: RESPONDENT_FIELDS }, null]) {
    assert.deepEqual(aboutFields(model), []);
    assert.equal(drawAbout(doc, aboutFields(model)), null);
  }
  const on = { demographics_enabled: true, context_fields: RESPONDENT_FIELDS };
  assert.deepEqual(aboutFields(on).map(f => f.key), ['age_range', 'gender']);
  assert.ok(drawAbout(doc, aboutFields(on)));
});
