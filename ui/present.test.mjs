import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewAnswer, templateChoices } from './present.js';

test('new selection prefers pinned v2 and marks v1 placeholder as legacy', () => {
  const choices = templateChoices([
    { id: 'tpl_validation', version: 1, name: 'Validation', perspective: 'Translation Team', source_ref: 'synthetic-placeholder' },
    { id: 'tpl_validation', version: 2, name: 'Validation', perspective: 'Translation Team', source_ref: 'klappy/3d-quality-review@pin' },
  ]);
  assert.equal(choices[0].value, 'tpl_validation@2');
  assert.equal(choices[0].disabled, false);
  assert.match(choices[0].label, /Pinned source/);
  assert.equal(choices[1].value, 'tpl_validation@1');
  assert.equal(choices[1].disabled, true);
  assert.match(choices[1].label, /Legacy synthetic placeholder/);
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
  assert.equal(reviewAnswer(item, null), 'Not answered (unknown)');
  assert.equal(reviewAnswer({ type: 'scale' }, 4), '4');
});
