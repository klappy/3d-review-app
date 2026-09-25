import { isDemo, sampleParticipantEnvironment } from '../demo.js';
import { createParticipantJourney } from './controller.js';
import { mountParticipantView, itemError } from '../participant-view.js';
import { reviewAnswer, receiptLine } from '../present.js';

const $ = id => document.getElementById(id);
let pager, renderedPhase, renderedForm;
const disabledBeforeRequest = new WeakMap();
function element(tag, text) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
function draw(item) {
  const field = element('fieldset'); field.dataset.item = item.id;
  field.append(element('legend', `${item.text || item.id}${item.requiredness === 'unresolved' ? ' (optional)' : ''}`)); // B-09: plain words, no policy text
  if (item.type === 'scale' || item.type === 'text') {
    const input = element(item.type === 'text' ? 'textarea' : 'input'); input.name = item.id; input.required = item.required !== false;
    if (item.type === 'scale') { input.type = 'number'; input.min = item.scale.min; input.max = item.scale.max; input.step = 1; }
    field.append(input);
  } else if (item.type === 'single' || item.type === 'multi') {
    for (const option of item.options || []) {
      const label = element('label'), input = element('input'); input.type = item.type === 'multi' ? 'checkbox' : 'radio'; input.name = item.id; input.value = option.code; input.required = item.type === 'single' && item.required !== false;
      label.append(input, document.createTextNode(option.label || option.text || option.code)); field.append(label);
    }
    if (item.type === 'multi' && item.options?.some(o => o.exclusive)) field.append(element('p', 'An exclusion choice cannot be combined with any other choice.'));
  } else field.append(element('p', 'This survey contains an unsupported question. Ask the person who shared the survey for help.'));
  return field;
}
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
      $('review-answers').replaceChildren(...state.form.items.map(item => element('p', `${item.text || item.id}: ${reviewAnswer(item, state.answers[item.id])}`)));
      $('review').hidden = false; pager?.showReview();
    } else {
      pager?.showReceipt();
      if (state.phase === 'receipt') {
        $('receipt').replaceChildren(element('h2', demo ? 'Practice complete — nothing sent' : 'Response saved'), element('p', receiptLine(state.receipt)));
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
if (demo) { document.querySelector('main > h1').textContent = 'Practice survey · nothing is sent'; document.querySelector('main > p').textContent = 'Use the real survey flow with source-pinned synthetic sample questions. Answers stay in memory and disappear when you leave or reload.'; const back = element('a', 'Back to the tour'); back.href = '/?demo=1#assessment/demo-assessment/collect'; document.querySelector('main').prepend(back); }
const sample = demo ? sampleParticipantEnvironment(Number(new URLSearchParams(location.search).get('survey') || 0)) : null;
if (demo) { $('submit').textContent = 'Finish practice — nothing sent'; $('recover').textContent = 'Check practice'; }
const journey = createParticipantJourney({ ...(demo ? sample : { window, storage: sessionStorage }), onChange: paint });
$('answers').addEventListener('input', () => journey.save(values()));
$('answers').addEventListener('submit', event => { event.preventDefault(); try { journey.review(values(true)); } catch (error) { $('notice').textContent = error.message; } });
$('edit').addEventListener('click', () => journey.edit());
$('submit').addEventListener('click', () => journey.submit());
$('recover').addEventListener('click', () => journey.recover());
// A newly pasted link selects a fresh controller; a participant page never changes into a staff surface.
window.addEventListener('hashchange', () => location.reload());
journey.start().then(() => { if (demo && new URLSearchParams(location.search).get('response') === '1' && journey.state.phase === 'form') { journey.save(sample.sampleAnswers); journey.review(sample.sampleAnswers); } }).catch(() => { $('notice').textContent = 'The survey could not be opened. Open your survey link again in a moment.'; });
