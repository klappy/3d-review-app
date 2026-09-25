import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewAnswer, templateChoices, receiptLine } from './present.js';

test('new selection prefers pinned v2 and marks v1 placeholder as legacy', () => {
  const choices = templateChoices([
    { id: 'tpl_validation', version: 1, name: 'Validation', perspective: 'Translation Team', source_ref: 'synthetic-placeholder' },
    { id: 'tpl_future', version: 1, name: 'Future', perspective: 'Community', source_ref: 'other/source' },
    { id: 'tpl_validation', version: 2, name: 'Validation', perspective: 'Translation Team', source_ref: 'klappy/3d-quality-review@pin' },
  ]);
  assert.equal(choices[0].value, 'tpl_validation@2');
  assert.equal(choices[0].disabled, false);
  assert.match(choices[0].label, /Pinned source/);
  assert.equal(choices[1].value, 'tpl_future@1');
  assert.match(choices[1].label, /Published source/);
  assert.equal(choices[2].value, 'tpl_validation@1');
  assert.equal(choices[2].disabled, true);
  assert.match(choices[2].label, /Legacy synthetic placeholder/);
});

test('review uses participant-facing labels but does not change canonical answer codes', () => {
  const item = { type: 'multi', options: [
    { code: 'shared-glossary', text: 'A shared glossary' },
    { code: 'printed-list', text: 'A printed reference list' },
  ] };
  const canonical = ['shared-glossary', 'printed-list'];
  assert.equal(reviewAnswer(item, canonical), 'A shared glossary; A printed reference list');
  assert.deepEqual(canonical, ['shared-glossary', 'printed-list']);
  assert.equal(reviewAnswer({ ...item, type: 'single' }, 'shared-glossary'), 'A shared glossary');
  assert.equal(reviewAnswer(item, null), 'Skipped');
  assert.equal(reviewAnswer({ type: 'scale' }, 4), '4');
});

test('B-09: receipt line is a short reference and a local date, never the raw id or ISO string', () => {
  const line = receiptLine({ response_id: 'resp_c878ba96-265f-4bbf-911b-a5056f4755b7', submitted_at: '2026-09-25T17:27:05.171Z' });
  assert.match(line, /^Reference C878BA96 · /);
  assert.ok(!line.includes('resp_') && !line.includes('T17:27'));
  assert.equal(receiptLine({}), 'Saved');
  assert.equal(receiptLine({ response_id: 'resp_ab12cd34ef' }), 'Reference AB12CD34');
});
