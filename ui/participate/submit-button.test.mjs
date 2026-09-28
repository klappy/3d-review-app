import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { copy } from '../shared-link.js';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('U44: the final submit reads "Submit answers" and uses the shared participant primary button', () => {
  const html = read('./index.html');
  assert.match(html, /<button id="submit" class="rv-btn primary participant-primary" type="button">Submit answers<\/button>/);
  assert.doesNotMatch(html + read('../legacy/index.html') + copy.submitUncertain, /Submit once/);
  assert.match(read('../participant-bar.css'), /body:not\(\.rv\) #participant :is\(\.participant-start,\.participant-primary\)\{/);
  assert.doesNotMatch(read('./page.css'), /#submit\{/, 'no per-page submit patch');
});
