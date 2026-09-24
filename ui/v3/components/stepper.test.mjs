import test from 'node:test';
import assert from 'node:assert/strict';
import { stepper, ensureStepperStyle, STEPPER_CSS, STEPPER_STYLE_ID } from './stepper.js';

test('Stepper: done ticked, current active with aria-current, later pending', () => {
  const h = stepper(['A', 'B', 'C'], 2, { label: 'Setup steps' });
  assert.match(h, /^<ol class="v3-stepper stepper" aria-label="Setup steps">/);
  assert.match(h, /<li class="done"><i aria-hidden="true">✓<\/i><span>A<\/span><b class="v3-sr"> \(completed\)<\/b><\/li>/);
  assert.match(h, /<li class="on" aria-current="step"><i aria-hidden="true">2<\/i><span>B<\/span><\/li>/);
  assert.match(h, /<li class="todo"><i aria-hidden="true">3<\/i><span>C<\/span><\/li>/);
  assert.equal((h.match(/aria-current/g) || []).length, 1);
});

test('Stepper: each step can navigate via app-local hash links; unsafe hrefs and labels are neutralised', () => {
  const h = stepper([{ label: 'Prepare', href: '#assessment/a1/prepare' }, { label: '<b>Collect</b>', href: 'javascript:alert(1)' }], 1);
  assert.match(h, /<li class="on" aria-current="step"><a href="#assessment\/a1\/prepare">/);
  assert.doesNotMatch(h, /javascript:/);
  assert.match(h, /&lt;b&gt;Collect&lt;\/b&gt;/);
});

test('Stepper: edge inputs — none current, all done, bad input', () => {
  assert.doesNotMatch(stepper(['A', 'B'], 0), /aria-current|done/);
  assert.doesNotMatch(stepper(['A', 'B', 'C'], 2), /class=""/);
  assert.equal((stepper(['A', 'B'], 3).match(/class="done"/g) || []).length, 2);
  assert.equal(stepper(null, 1), '<ol class="v3-stepper stepper" aria-label="Steps"></ol>');
  assert.match(stepper(['A'], 'x'), /class="on"/);
});

test('Stepper: style injects once and is a no-op without a document', () => {
  assert.equal(ensureStepperStyle(null), false);
  const nodes = new Map(); const head = { appendChild: el => nodes.set(el.id, el) };
  const doc = { head, getElementById: id => nodes.get(id) || null, createElement: () => ({}) };
  assert.equal(ensureStepperStyle(doc), true);
  assert.equal(ensureStepperStyle(doc), false);
  assert.equal(nodes.get(STEPPER_STYLE_ID).textContent, STEPPER_CSS);
  assert.match(STEPPER_CSS, /var\(--glass/);
});

test('stepper dots blur on the design-system-v3 --blur-panel token, not a hard-coded radius (ruling 12:22 glass)', () => {
  assert.match(STEPPER_CSS, /backdrop-filter:blur\(var\(--blur-panel,24px\)\)/);
  assert.doesNotMatch(STEPPER_CSS, /blur\(\d+px\)/);
});

test('done steps announce "completed" to screen readers (ruling 12:28 polish)', async () => {
  const { stepper, STEPPER_CSS } = await import('./stepper.js');
  const html = stepper(['A', 'B', 'C'], 2);
  assert.equal((html.match(/class="v3-sr"> \(completed\)/g) || []).length, 1);
  assert.match(STEPPER_CSS, /\.v3-stepper \.v3-sr\{position:absolute/);
});
