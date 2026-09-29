import { isDemo, sampleParticipantEnvironment } from '../demo.js';
import { createParticipantJourney } from './controller.js';
import { mountParticipantView, itemError, drawAbout, aboutValues, welcomeCopy } from '../participant-view.js';
import { UI_EN, formStrings, translateForm, makeT, fetchTranslationsProgressive, initialLanguage, rememberLanguage, isEnglish, pickLanguage } from './i18n.js';
import { reviewAnswer, receiptLine, isOtherOption, otherBox, collectOther, syncOtherBoxes, OTHER_TEXT_KEY } from '../present.js';

const $ = id => document.getElementById(id);
let pager, renderedPhase, renderedForm;
const disabledBeforeRequest = new WeakMap();
function element(tag, text) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
// Dynamic translation (captain ruling 2026-09-28; Lovable-era behaviour): the participant picks a language, the page
// sends its English strings to /v2/translate and shows what comes back; anything missing stays English. Display only:
// ids and option codes never change, so answers, scores and reports are unaffected.
function localStore() { try { return window.localStorage; } catch { return null; } }
const wantedLang = initialLanguage({ search: location.search, storage: localStore() });
let lang = 'en'; // set from wantedLang once the survey says which languages it offers
let tr = { lang: 'English', form: null, ui: {}, items: {}, view: null };
let T = makeT({});
let loadSeq = 0;
const view = form => (form && tr.form === form && tr.lang === lang && tr.view ? tr.view : form);
function draw(item) {
  const field = element('fieldset'); field.dataset.item = item.id;
  field.append(element('legend', `${item.text || item.id}${item.requiredness === 'unresolved' ? ` ${T('optional')}` : ''}`)); // B-09: plain words, no policy text
  if (item.type === 'multi') { const hint = element('p', T('chooseAll')); hint.className = 'participant-hint'; field.append(hint); } // more than one answer may be chosen
  if (item.type === 'scale' || item.type === 'text') {
    const input = element(item.type === 'text' ? 'textarea' : 'input'); input.name = item.id; input.required = item.required !== false;
    if (item.type === 'scale') { input.type = 'number'; input.min = item.scale.min; input.max = item.scale.max; input.step = 1; }
    field.append(input);
  } else if (item.type === 'single' || item.type === 'multi') {
    for (const option of item.options || []) {
      const label = element('label'), input = element('input'); input.type = item.type === 'multi' ? 'checkbox' : 'radio'; input.name = item.id; input.value = option.code; input.required = item.type === 'single' && item.required !== false;
      label.append(input, document.createTextNode(option.label || option.text || option.code)); field.append(label);
      // C01: "Other (please describe)" gets its own short text field, shown only while Other is chosen.
      if (isOtherOption(option)) { const box = otherBox(document, item); box.placeholder = T('pleaseDescribe'); box.setAttribute('aria-label', T('pleaseDescribe')); field.append(box); }
    }
    if (item.type === 'multi' && item.options?.some(o => o.exclusive)) field.append(element('p', T('exclusionNote')));
  } else field.append(element('p', T('unsupported')));
  return field;
}
let about = null;
function values(validate = false) {
  const fd = new FormData($('answers')), out = {};
  const shown = view(journey.state.form);
  for (const item of shown.items) {
    if (validate) {
      if (!['scale', 'text', 'single', 'multi'].includes(item.type)) throw Error('This survey cannot be submitted because it contains an unsupported question.');
      const error = itemError(item, fd, T); if (error) throw Error(error);
    }
    let value = item.type === 'multi' ? fd.getAll(item.id) : fd.get(item.id);
    if (value === '' || value === null || (Array.isArray(value) && !value.length)) value = null;
    if (item.type === 'scale' && value !== null) value = Number(value);
    out[item.id] = value;
  }
  const other = collectOther(journey.state.form.items, fd, out); if (other) out[OTHER_TEXT_KEY] = other;
  return out;
}
const syncOther = () => { if (journey.state.form) syncOtherBoxes($('answers'), journey.state.form.items); };
function paint(state) {
  if (state.form) syncPicker(state.form);
  if (state.form) renderPassages(view(state.form) || state.form);
  if (state.form && !isEnglish(lang) && tr.form !== state.form && pendingForm !== state.form) loadTranslations(state.form);
  const shown = view(state.form);
  $('notice').textContent = demo && state.phase === 'receipt' ? 'Practice only. No response was sent or saved.' : state.notice || '';
  if (state.phase !== renderedPhase || (state.form && state.form !== renderedForm)) {
    for (const id of ['answers', 'review', 'receipt']) $(id).hidden = true;
    if (state.phase === 'form') {
      if (renderedForm !== state.form) {
        pager?.destroy(); $('questions').replaceChildren(...shown.items.map(draw));
        for (const field of $('questions').querySelectorAll('input,textarea')) {
          if (field.dataset.otherFor) { const text = state.draft?.[OTHER_TEXT_KEY]?.[field.dataset.otherFor]; if (typeof text === 'string') field.value = text; continue; }
          const value = state.draft?.[field.name]; if (value == null) continue;
          if (field.type === 'radio' || field.type === 'checkbox') field.checked = (Array.isArray(value) ? value : [value]).includes(field.value);
          else field.value = value;
        }
        syncOther();
        about = drawAbout(document, shown.context_fields || [], T);
        pager = mountParticipantView({ doc: document, root: $('participant-view-root'), form: $('answers'), questions: $('questions'), review: $('review'), reviewAnswers: $('review-answers'), receipt: $('receipt'), model: shown, reviewButton: $('review-button'), onEdit: () => journey.edit(), about, t: T });
        if (state.draft) pager.showForm();
      } else pager?.showForm();
      $('answers').hidden = false;
    } else if (state.phase === 'review') {
      $('review-answers').replaceChildren(...shown.items.map(item => { const answer = reviewAnswer(item, state.answers[item.id], state.answers[OTHER_TEXT_KEY]?.[item.id]); return element('p', `${item.text || item.id}: ${answer === 'Skipped' ? T('skipped') : answer}`); }));
      $('review').hidden = false; pager?.showReview();
    } else {
      pager?.showReceipt();
      if (state.phase === 'receipt') {
        $('receipt').replaceChildren(element('h2', demo ? 'Practice complete — nothing sent' : T('responseSaved')), element('p', receiptLine(state.receipt)));
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
// Static page words (captured after the demo wording is set) and the language picker.
const STATIC = [['.intro-title', 'static.title'], ['.intro-lead', 'static.lead'], ['#review-button', 'static.reviewButton'], ['#review > h2', 'static.reviewTitle'], ['#edit', 'static.edit'], ['#submit', 'static.submit'], ['#recover', 'static.recover']];
const staticEn = {}; for (const [sel, key] of STATIC) { const n = document.querySelector(sel); if (n) staticEn[key] = n.textContent; }
function applyStatic() { for (const [sel, key] of STATIC) { const n = document.querySelector(sel); if (n) n.textContent = T(key, staticEn[key]); } }
const langSelect = element('select'); langSelect.id = 'participant-lang';
let offered = null; // the survey's languages once known (form.languages); the picker is hidden while there are none
function syncPicker(form) {
  const list = Array.isArray(form?.languages) ? form.languages : [];
  const sig = list.map(l => l.code).join(',');
  if (offered === sig) return;
  offered = sig;
  langSelect.replaceChildren(Object.assign(element('option', 'English'), { value: 'en' }), ...list.map(l => Object.assign(element('option', `${l.endonym} · ${l.name}`), { value: l.code })));
  langBox.hidden = !list.length;
  const keep = pickLanguage(isEnglish(lang) ? wantedLang : lang, list);
  const next = keep ? keep.code : 'en';
  langSelect.value = next;
  if (next !== lang) { lang = next; loadTranslations(form); }
}
const currentEntry = () => pickLanguage(lang, journey?.state?.form?.languages || []);
const langLabel = element('label'); langLabel.className = 'participant-lang'; const langWord = element('span', UI_EN.language); langLabel.append(langWord, langSelect);
const langStatus = element('p'); langStatus.className = 'participant-lang-status'; langStatus.setAttribute('role', 'status'); langStatus.setAttribute('aria-live', 'polite');
// Visible "translating" feedback (captain 2026-09-29): never a silent wait. A card with a spinner, the language in its own
// script, plain words about the first-time wait, and a real progress bar ("n of N phrases"); shown only if loading takes
// longer than a moment (a stored translation appears without a flash). English stays readable underneath.
const trBanner = element('div'); trBanner.className = 'participant-translating'; trBanner.hidden = true; trBanner.setAttribute('role', 'status'); trBanner.setAttribute('aria-live', 'polite');
const trSpin = element('span'); trSpin.className = 'tr-spinner'; trSpin.setAttribute('aria-hidden', 'true');
const trBody = element('div'); trBody.className = 'tr-body';
const trTitle = element('p'); trTitle.className = 'tr-title';
const trSub = element('p'); trSub.className = 'tr-sub';
const trBar = element('div'); trBar.className = 'tr-bar'; trBar.setAttribute('role', 'progressbar'); trBar.setAttribute('aria-valuemin', '0'); trBar.setAttribute('aria-valuemax', '100'); trBar.setAttribute('aria-label', 'Translation progress');
const trFill = element('span'); trBar.append(trFill);
const trCount = element('p'); trCount.className = 'tr-count';
const trRetry = element('button', UI_EN.tryAgain); trRetry.type = 'button'; trRetry.className = 'rv-btn quiet tr-retry'; trRetry.hidden = true;
trBody.append(trTitle, trSub, trBar, trCount, trRetry); trBanner.append(trSpin, trBody);
function showTranslating(entry, { done = 0, total = 0 } = {}) {
  trBanner.hidden = false; trBanner.classList.remove('failed'); trSpin.hidden = false; trBar.hidden = false; trRetry.hidden = true;
  trTitle.textContent = entry ? `Translating into ${entry.endonym}${entry.endonym === entry.name ? '' : ` (${entry.name})`}…` : UI_EN.translating;
  trSub.textContent = UI_EN.translatingFirst;
  const pct = total ? Math.round((done / total) * 100) : 0;
  trFill.style.width = `${Math.max(4, pct)}%`; trBar.setAttribute('aria-valuenow', String(pct));
  trCount.textContent = total ? `${done} / ${total} ${UI_EN.phrases}` : '';
}
function showTranslateFailed() {
  trBanner.hidden = false; trBanner.classList.add('failed'); trSpin.hidden = true; trBar.hidden = true; trCount.textContent = '';
  trTitle.textContent = UI_EN.translateFailed; trSub.textContent = UI_EN.translateFailedHint; trRetry.hidden = false;
}
function hideTranslating() { trBanner.hidden = true; }
trRetry.addEventListener('click', () => loadTranslations());
const langBox = element('div'); langBox.className = 'participant-lang-box'; langBox.hidden = true; langBox.append(langLabel, langStatus, trBanner);
document.querySelector('main').prepend(langBox);
// The passage under review (captain 2026-09-29; Lovable parity): at the top of the survey on every screen. Audio plays
// in the page; PDF / USFM / USX text, videos and links open in a new tab. Rebuilt only when the passages or the language
// change, so audio keeps playing across questions.
const passageBox = element('section'); passageBox.className = 'participant-passages'; passageBox.hidden = true; passageBox.setAttribute('aria-label', 'The passage');
langBox.after(passageBox);
let passageSig = '';
function renderPassages(form) {
  const list = Array.isArray(form?.passages) ? form.passages.filter(p => p && typeof p.href === 'string' && p.href) : [];
  const sig = `${lang}|${Object.keys(tr.ui || {}).length > 0}|${list.map(p => p.id).join(',')}`; // relabel once a translation lands
  if (sig === passageSig) return;
  passageSig = sig; passageBox.hidden = !list.length;
  const rows = list.map(p => {
    const row = element('div'); row.className = `pp-row pp-${p.media}`;
    const label = element('p', [p.title, p.reference].filter(Boolean).join(' · ')); label.className = 'pp-label';
    if (p.media === 'audio') {
      const audio = element('audio'); audio.controls = true; audio.preload = 'none'; audio.src = p.href; audio.setAttribute('aria-label', `${T('passageListen')}: ${p.title}`);
      row.append(label, audio);
    } else {
      const a = element('a', p.media === 'video' ? `▶ ${T('passageWatch')}` : p.media === 'link' ? T('passageOpen') : T('passageRead')); // no emoji: low-end phones may lack the font
      a.href = p.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'pp-open';
      row.append(a, label);
    }
    return row;
  });
  // Open on the welcome; folds to one tappable line once the questions start, so the question stays in view.
  const wasOpen = passageDetails ? passageDetails.open : !document.querySelector('.participant-intro[hidden]');
  passageDetails = element('details'); passageDetails.className = 'pp-details'; passageDetails.open = wasOpen;
  const summary = element('summary', `${T('passageTitle')}${list.length > 1 ? ` (${list.length})` : ''}`); summary.className = 'pp-title';
  passageDetails.append(summary, ...rows);
  passageBox.replaceChildren(passageDetails);
}
let passageDetails = null;
document.addEventListener('click', e => { if (passageDetails && e.target?.closest?.('.participant-start')) passageDetails.open = false; });
let pendingForm = null;
function rerender() {
  // Keep the participant where they are: a translation arriving mid-survey redraws the same question, not the welcome.
  const fields = [...$('questions').children], at = fields.findIndex(f => !f.hidden);
  const midSurvey = journey?.state?.phase === 'form' && at >= 0 && !!document.querySelector('.participant-intro[hidden]');
  applyStatic(); langWord.textContent = T('language');
  document.documentElement.dir = currentEntry()?.dir === 'rtl' ? 'rtl' : 'ltr';
  renderedForm = null; renderedPhase = null;
  if (journey?.state) paint(journey.state);
  if (midSurvey) pager?.showForm(at);
}
async function loadTranslations(form = journey?.state?.form || null) {
  const seq = ++loadSeq; pendingForm = form;
  if (isEnglish(lang)) { tr = { lang, form, ui: {}, items: {}, view: null }; T = makeT({}); langStatus.textContent = ''; hideTranslating(); pendingForm = null; rerender(); return; }
  const entry = pickLanguage(lang, form?.languages || []);
  langStatus.textContent = '';
  const main = document.querySelector('main'); main?.setAttribute('aria-busy', 'true');
  const ui = { ...UI_EN, ...staticEn };
  if (form?.items) Object.assign(ui, welcomeCopy(form, form.items.length));
  const items = form?.items ? formStrings(form) : {};
  const total = Object.keys(ui).length + Object.keys(items).length;
  const seen = { ui: 0, items: 0 };
  let shown = false;
  const progress = () => { if (shown && seq === loadSeq) showTranslating(entry, { done: seen.ui + seen.items, total }); };
  const reveal = setTimeout(() => { if (seq === loadSeq) { shown = true; progress(); } }, 300); // no flash when it is already stored
  try {
    const store = localStore();
    const [u, it] = await Promise.all([
      fetchTranslationsProgressive({ lang, context: 'participant-ui', sourceTexts: ui, storage: store, onProgress: p => { seen.ui = p.done; progress(); } }),
      form?.items ? fetchTranslationsProgressive({ lang, context: `participant-form:${form.template?.id || 'form'}`, sourceTexts: items, storage: store, onProgress: p => { seen.items = p.done; progress(); } }) : Promise.resolve({ map: {} }),
    ]);
    if (seq !== loadSeq) return;
    tr = { lang, form, ui: u.map, items: it.map, view: form ? translateForm(form, it.map) : null }; T = makeT(u.map);
    hideTranslating();
    langStatus.textContent = entry?.review ? T('machineNoteReview') : T('machineNote');
  } catch {
    if (seq !== loadSeq) return;
    tr = { lang, form, ui: {}, items: {}, view: null }; T = makeT({});
    showTranslateFailed();
  } finally {
    clearTimeout(reveal);
    if (seq === loadSeq) main?.removeAttribute('aria-busy');
  }
  pendingForm = null; rerender();
}
langSelect.addEventListener('change', () => { lang = langSelect.value || 'en'; rememberLanguage(localStore(), lang); loadTranslations(); });
var journey;
journey = createParticipantJourney({ ...(demo ? sample : { window, storage: sessionStorage }), onChange: paint });
$('answers').addEventListener('input', () => journey.save(values()));
$('answers').addEventListener('change', syncOther);
$('answers').addEventListener('submit', event => { event.preventDefault(); try { journey.review(values(true)); } catch (error) { $('notice').textContent = error.message; } });
$('edit').addEventListener('click', () => journey.edit());
$('submit').addEventListener('click', () => { journey.setContext(aboutValues(about)); journey.submit(); });
$('recover').addEventListener('click', () => journey.recover());
// A newly pasted link selects a fresh controller; a participant page never changes into a staff surface.
window.addEventListener('hashchange', () => location.reload());
journey.start().then(() => { if (demo && new URLSearchParams(location.search).get('response') === '1' && journey.state.phase === 'form') { journey.save(sample.sampleAnswers); journey.review(sample.sampleAnswers); } }).catch(() => { $('notice').textContent = 'The survey could not be opened. Open your survey link again in a moment.'; });
