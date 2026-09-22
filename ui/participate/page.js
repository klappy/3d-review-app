import { isDemo, sampleParticipantEnvironment } from '../demo.js';
import { createParticipantJourney } from './controller.js';
import { mountParticipantView, itemError } from '../participant-view.js';
import { reviewAnswer } from '../present.js';
import { adoptKit, field as kitField, receipt as kitReceipt, reviewRow as kitReviewRow } from '../kit/views-participant.js';

const $ = id => document.getElementById(id);
let pager, renderedPhase, renderedForm;
const disabledBeforeRequest = new WeakMap();
function element(tag, text) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
// K4: one real fieldset per item, painted by the kit. Field names, types, required flags and native validation are unchanged.
function draw(item) { return kitField(document, item); }
function values(validate = false) {
  const fd = new FormData($('answers')), out = {};
  for (const item of journey.state.form.items) {
    if (validate) {
      if (!['scale', 'text', 'single', 'multi'].includes(item.type)) throw Error('This survey cannot be submitted because it contains an unsupported question.');
      const error = itemError(item, fd); if (error) throw Error(error);
    }
    let value = item.type === 'multi' ? fd.getAll(item.id) : fd.get(item.id);
    if (value === '' || value === null || (Array.isArray(value) && !value.length)) value = null;
    if (item.type === 'scale' && value !== null) value = Number(value);
    out[item.id] = value;
  }
  return out;
}
function paint(state) {
  $('notice').textContent = demo && state.phase === 'receipt' ? 'Practice only. No response was sent or saved.' : state.notice || '';
  if (state.phase !== renderedPhase || (state.form && state.form !== renderedForm)) {
    for (const id of ['answers', 'review', 'receipt']) $(id).hidden = true;
    if (state.phase === 'form') {
      if (renderedForm !== state.form) {
        pager?.destroy(); $('questions').replaceChildren(...state.form.items.map(draw));
        for (const field of $('questions').querySelectorAll('input,textarea')) {
          const value = state.draft?.[field.name]; if (value == null) continue;
          if (field.type === 'radio' || field.type === 'checkbox') field.checked = (Array.isArray(value) ? value : [value]).includes(field.value);
          else field.value = value;
        }
        pager = mountParticipantView({ doc: document, root: $('participant-view-root'), form: $('answers'), questions: $('questions'), review: $('review'), reviewAnswers: $('review-answers'), receipt: $('receipt'), model: state.form, reviewButton: $('review-button'), onEdit: () => journey.edit() });
        if (state.draft) pager.showForm();
      } else pager?.showForm();
      $('answers').hidden = false;
    } else if (state.phase === 'review') {
      $('review-answers').replaceChildren(...state.form.items.map(item => kitReviewRow(document, item, reviewAnswer(item, state.answers[item.id]))));
      $('review').hidden = false; pager?.showReview();
    } else {
      pager?.showReceipt();
      if (state.phase === 'receipt') {
        $('receipt').replaceChildren(kitReceipt(document, state.receipt, { demo }));
        $('receipt').hidden = false;
      }
    }
    renderedPhase = state.phase; renderedForm = state.form;
  }
  $('recover').hidden = !['form', 'review'].includes(state.phase);
  for (const button of document.querySelectorAll('button')) {
    if (button.id === 'version' || button.id === 'changelog-close') continue;
    if (state.busy) { if (!disabledBeforeRequest.has(button)) disabledBeforeRequest.set(button, button.disabled); button.disabled = true; }
    else if (disabledBeforeRequest.has(button)) { button.disabled = disabledBeforeRequest.get(button); disabledBeforeRequest.delete(button); }
  }
}
const demo = isDemo(location.search);
// K4: kit stylesheets + `.rv` scope on the participant main. The participant HTML is not owned by this slice; nothing else in the document changes.
adoptKit(document, $('participant'));
if (!demo) $('submit').className = 'primary';
if (demo) { document.querySelector('main > h1').textContent = 'Practice survey · nothing is sent'; document.querySelector('main > p').textContent = 'Use the real survey flow with source-pinned synthetic sample questions. Answers stay in memory and disappear when you leave or reload.'; const back = element('a', 'Back to the tour'); back.href = '/?demo=1#assessment/demo-assessment/collect'; document.querySelector('main').prepend(back); }
const sample = demo ? sampleParticipantEnvironment(Number(new URLSearchParams(location.search).get('survey') || 0)) : null;
if (demo) { $('submit').textContent = 'Finish practice — nothing sent'; $('submit').className = 'primary'; $('recover').textContent = 'Check practice'; }
const journey = createParticipantJourney({ ...(demo ? sample : { window, storage: sessionStorage }), onChange: paint });
$('answers').addEventListener('input', () => journey.save(values()));
$('answers').addEventListener('submit', event => { event.preventDefault(); try { journey.review(values(true)); } catch (error) { $('notice').textContent = error.message; } });
$('edit').addEventListener('click', () => journey.edit());
$('submit').addEventListener('click', () => journey.submit());
$('recover').addEventListener('click', () => journey.recover());
// A newly pasted link selects a fresh controller; a participant page never changes into a staff surface.
window.addEventListener('hashchange', () => location.reload());
journey.start().then(() => { if (demo && new URLSearchParams(location.search).get('response') === '1' && journey.state.phase === 'form') { journey.save(sample.sampleAnswers); journey.review(sample.sampleAnswers); } }).catch(() => { $('notice').textContent = 'The survey could not be opened. Open your survey link again in a moment.'; });
