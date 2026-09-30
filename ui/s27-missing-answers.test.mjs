// S27 (0.24.1 persona B): with several required answers missing, Review names every one in one message and marks them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missingItems, missingMessage, mountParticipantView } from './participant-view.js';

const items = [
  { id: 'q0', type: 'text', text: 'Q zero' },
  { id: 'q1', type: 'text', text: 'Q one', required: false },
  { id: 'q2', type: 'single', text: 'Q two', options: [{ code: 'a' }] },
  { id: 'q3', type: 'multi', text: 'Q three', options: [{ code: 'x' }] },
];
function valuesOf(answers) {
  return class { get(id) { return answers[id] ?? null; } getAll(id) { return answers[id] ?? []; } };
}

test('missingItems lists every unanswered required item; missingMessage names them all at once', () => {
  const FD = valuesOf({ q1: '' });
  assert.deepEqual(missingItems(items, new FD()), [0, 2, 3]);
  assert.equal(missingMessage(items, [0, 2, 3]), 'Answer required: 1. Q zero · 3. Q two · 4. Q three');
  assert.equal(missingMessage(items, [2], (k, f) => k === 'answerRequired' ? 'Jibu linahitajika:' : f), 'Jibu linahitajika: 3. Q two');
  assert.deepEqual(missingItems(items, new (valuesOf({ q0: 'x', q2: 'a', q3: ['x'] }))()), []);
});

test('Review with three required answers missing: one message, the first missing question shown, each one marked', () => {
  class Node { children = []; listeners = {}; hidden = false; dataset = {}; attrs = {}; type = ''; textContent = ''; className = '';
    append(...n) { this.children.push(...n); } setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(t, f) { this.listeners[t] = f; } removeEventListener() {} focus() {} remove() {} querySelector() { return null; }
    querySelectorAll(s) { return s === 'button' ? [review] : []; } }
  const root = new Node(), form = new Node(), questions = new Node(), review = new Node(); review.type = 'submit'; form.contains = n => n === review;
  questions.children = items.map(it => { const f = new Node(); f.dataset.item = it.id; return f; });
  const answers = { q1: '' };
  const doc = { createElement: () => new Node(), defaultView: { FormData: valuesOf(answers) } };
  mountParticipantView({ doc, root, form, questions, reviewAnswers: new Node(), model: { items }, reviewButton: review });
  let prevented = false;
  review.listeners.click({ preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  const [, nav, error] = root.children;
  assert.equal(prevented, true);
  assert.equal(error.hidden, false);
  assert.equal(error.textContent, 'Answer required: 1. Q zero · 3. Q two · 4. Q three');
  assert.deepEqual(questions.children.map(f => f.hidden), [false, true, true, true]); // the first missing question is shown
  assert.deepEqual(questions.children.map(f => f.dataset.missing ?? null), ['true', null, 'true', 'true']);
  assert.deepEqual(questions.children.map(f => f.attrs['aria-invalid'] ?? null), ['true', null, 'true', 'true']);
  assert.deepEqual(nav.children[2].children.map(s => s.className), ['done missing', '', 'missing', 'missing']);
  answers.q0 = 'fixed'; form.listeners.change();
  assert.deepEqual(questions.children.map(f => f.dataset.missing ?? null), [null, null, 'true', 'true']);
  assert.deepEqual(nav.children[2].children.map(s => s.className), ['done', '', 'missing', 'missing']);
  answers.q2 = 'a'; form.listeners.input(); // S34: an answer clears its mark as it is given (input), not only on change/blur
  assert.deepEqual(questions.children.map(f => f.dataset.missing ?? null), [null, null, null, 'true']);
});
