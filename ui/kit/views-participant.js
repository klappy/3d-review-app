// Participant presentation from the frozen kit (cookbook c653482 views-participant.js: intro → one question per screen with
// pips → review → receipt). Presentation only: builds DOM around the REAL participant form fields and the real controller's
// state. It never reads storage, never owns transport, submission, identity or phase, and never fabricates a receipt.
// Every builder takes the document it must create nodes in, so the existing participant-view test doubles keep working.

export const STYLESHEETS = Object.freeze(['/kit/tokens.css', '/kit/components.css', '/kit/kit.css']);

export const copy = Object.freeze({
  introEyebrow: 'Take a survey',
  introTitle: 'Here to take the survey?',
  introHelp: 'No account, no sign-in. Everyone who receives the same link answers the same survey; answers are grouped with others.',
  begin: 'Begin',
  back: 'Back',
  next: 'Next',
  change: 'Change',
  reviewEyebrow: 'Review',
  reviewHelp: 'Change anything before you send. Nothing is submitted until you choose to.',
  receiptTitle: 'Thank you.',
  practiceTitle: 'Practice complete — nothing sent',
  practiceBadge: 'PRACTICE SURVEY · NOTHING IS SENT',
  optional: 'Optional',
  held: 'May leave unanswered · policy held',
  chooseAll: 'Choose all that apply',
  unknownAnswer: 'Leaving this blank records an unknown answer, not “no problems.”',
  exclusive: 'An exclusion choice cannot be combined with any other choice.',
  unsupported: 'This survey contains an unsupported question. Ask the person who shared the survey for help.',
  blank: '(left blank)',
});

export function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

export function button(doc, label, className, onClick) {
  const node = el(doc, 'button', className, label);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

// Intro card: eyebrow from what the real form model already carries, kit title, question count, source provenance, Begin.
export function intro(doc, model, onBegin) {
  const items = Array.isArray(model?.items) ? model.items : [];
  const section = el(doc, 'section', 'participant-intro');
  const labels = [model?.assessment, model?.language, model?.period, model?.template?.perspective].filter(v => v !== null && v !== undefined && v !== '');
  section.append(el(doc, 'p', 'eyebrow', labels.length ? labels.join(' · ') : copy.introEyebrow));
  section.append(el(doc, 'h2', undefined, copy.introTitle));
  section.append(el(doc, 'p', 'muted', copy.introHelp));
  section.append(el(doc, 'p', 'participant-count', `${items.length} question${items.length === 1 ? '' : 's'}`));
  const row = el(doc, 'div', 'row');
  const begin = button(doc, copy.begin, 'primary', onBegin);
  row.append(begin);
  section.append(row);
  if (model?.template?.source_ref) section.append(el(doc, 'p', 'footer', model.template.source_ref));
  return { section, begin };
}

// Pager: kit pips + "Question i of n" + Back/Next. Callers own index/validation; this only paints.
export function pager(doc, count, { onBack, onNext, label } = {}) {
  const nav = el(doc, 'div', 'participant-pager');
  nav.hidden = true;
  const bar = el(doc, 'div', 'progress');
  bar.setAttribute('aria-hidden', 'true');
  const pips = [];
  for (let i = 0; i < count; i++) { const pip = el(doc, 'span'); pips.push(pip); bar.append(pip); }
  const progress = el(doc, 'p', 'participant-progress eyebrow');
  progress.setAttribute('aria-live', 'polite');
  progress.setAttribute('style', 'font-weight:400;text-transform:none;letter-spacing:.06em;font-size:13px;margin-bottom:8px'); // kit form screen
  const controls = el(doc, 'div', 'participant-page-actions row');
  controls.setAttribute('style', 'justify-content:space-between;margin-top:14px');
  const back = button(doc, copy.back, 'quiet', onBack);
  const next = button(doc, copy.next, 'primary', onNext);
  controls.append(back, next);
  nav.append(bar, progress); // controls are placed by the caller under the visible question (kit order: pips, count, question, answers, Back/Next)
  function paint(index) {
    progress.textContent = `Question ${index + 1} of ${count}${label ? ` · ${label}` : ''}`;
    pips.forEach((pip, i) => { pip.className = i <= index ? 'done' : ''; });
    back.disabled = index === 0;
    next.hidden = index === count - 1;
  }
  return { nav, bar, progress, controls, back, next, paint };
}

export function pageError(doc) {
  const error = el(doc, 'p', 'participant-page-error note warning');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  return error;
}

// Chips derived only from the real item model; nothing here changes required/optional semantics.
export function itemChips(doc, item) {
  const chips = [];
  if (item.type === 'multi') chips.push(copy.chooseAll);
  if (item.requiredness === 'unresolved') chips.push(copy.held);
  else if (item.required === false) chips.push(copy.optional);
  if (!chips.length) return null;
  const row = el(doc, 'div', 'participant-chips row');
  for (const chip of chips) row.append(el(doc, 'span', 'chip', chip));
  return row;
}

// One real fieldset per item. Names, types, required and native validation are the app's existing contract, unchanged:
// scale → input[type=number] min/max/step 1; text → textarea; single → radio group; multi → checkbox group.
export function field(doc, item) {
  const fieldset = el(doc, 'fieldset', 'participant-item');
  fieldset.dataset.item = item.id;
  fieldset.append(el(doc, 'legend', undefined, item.text || item.id));
  const chips = itemChips(doc, item);
  if (chips) fieldset.append(chips);
  if (item.answer_semantics === 'unresolved_no_problems_vs_skipped') fieldset.append(el(doc, 'p', 'note', copy.unknownAnswer));
  if (item.type === 'scale' || item.type === 'text') {
    const input = el(doc, item.type === 'text' ? 'textarea' : 'input');
    input.name = item.id; input.required = item.required !== false;
    if (item.type === 'scale') { input.type = 'number'; input.min = item.scale.min; input.max = item.scale.max; input.step = 1; input.inputMode = 'numeric'; fieldset.append(el(doc, 'p', 'muted participant-scale-hint', `${item.scale.min} to ${item.scale.max}`)); }
    fieldset.append(input);
  } else if (item.type === 'single' || item.type === 'multi') {
    for (const option of item.options || []) {
      const label = el(doc, 'label', `choice${option.exclusive ? ' flag-exclusion' : ''}`);
      const input = el(doc, 'input');
      input.type = item.type === 'multi' ? 'checkbox' : 'radio'; input.name = item.id; input.value = option.code;
      input.required = item.type === 'single' && item.required !== false;
      label.append(input, doc.createTextNode(` ${option.label || option.text || option.code}`));
      fieldset.append(label);
    }
    if (item.type === 'multi' && item.options?.some(o => o.exclusive)) fieldset.append(el(doc, 'p', 'note', copy.exclusive));
  } else fieldset.append(el(doc, 'p', 'note warning', copy.unsupported));
  return fieldset;
}

// Review row: question, then the answer as the app already presents it. The Change control is appended by participant-view.
export function reviewRow(doc, item, answerText) {
  const row = el(doc, 'div', 'participant-review-row row');
  row.setAttribute('style', 'justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)');
  const question = el(doc, 'div', 'muted', item.text || item.id); question.setAttribute('style', 'flex:1 1 100%;font-size:13px');
  row.append(question);
  row.append(el(doc, 'strong', undefined, answerText === '' || answerText === null || answerText === undefined ? copy.blank : answerText));
  return row;
}

// Receipt from the controller's genuine receipt object only. Missing fields are said to be missing, never invented.
export function receipt(doc, result, { demo = false } = {}) {
  const wrap = el(doc, 'div', 'participant-receipt'); wrap.setAttribute('style', 'text-align:center;padding:10px 0');
  const mark = el(doc, 'div', 'participant-receipt-mark', '✓'); mark.setAttribute('style', 'font-size:42px;color:var(--receipt)'); mark.setAttribute('aria-hidden', 'true'); wrap.append(mark);
  wrap.append(el(doc, 'h2', undefined, demo ? copy.practiceTitle : copy.receiptTitle));
  // The controller's own notice (#notice) already carries the thanks/same-link wording; the kit adds no second paragraph.
  const note = el(doc, 'p', 'note', `${result?.response_id || 'ID unavailable'} · ${result?.submitted_at || 'time unavailable'}`); note.setAttribute('style', 'text-align:left'); wrap.append(note);
  return wrap;
}

// Link the kit stylesheets once (the participant HTML is not owned by this slice) and scope kit rules to the page's main.
// The kit's participant stage (cookbook phoneChrome): one 640px glass card whose content is phase-specific. The legacy
// permanent h1/help above every phase is retired here (independent review aef4ec AMEND A); each phase brings its own heading.
export function adoptKit(doc, main, { demo = false } = {}) {
  const head = doc.head;
  if (head) for (const href of STYLESHEETS) {
    if ([...head.querySelectorAll('link[rel="stylesheet"]')].some(link => link.getAttribute('href') === href)) continue;
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = href; head.append(link);
  }
  if (!main) return null;
  if (!/(^|\s)rv(\s|$)/.test(main.className || '')) main.className = `${main.className || ''} rv participant-kit glass phone`.trim();
  main.setAttribute('style', 'max-width:640px;width:calc(100% - 24px);margin:24px auto;padding:var(--phone-pad,20px)');
  for (const legacy of [...main.children].filter(n => (n.tagName === 'H1' || n.tagName === 'P') && !n.id)) legacy.hidden = true;
  let frame = main.querySelector('.participant-frame');
  if (!frame) { frame = el(doc, 'div', 'participant-frame'); main.prepend(frame); }
  frame.replaceChildren();
  if (demo) { const badge = el(doc, 'span', 'badge demo', copy.practiceBadge); frame.append(badge); }
  return frame;
}

// Phase heading inside the card (kit: review screen carries eyebrow "Review" + "Your answers"; the intro and receipt carry
// their own). Caller passes the phase; nothing here reads controller state.
export function phaseHeading(doc, phase) {
  if (phase !== 'review') return null;
  return { eyebrow: el(doc, 'p', 'participant-phase-heading eyebrow', copy.reviewEyebrow), help: el(doc, 'p', 'participant-phase-help muted', copy.reviewHelp) };
}

// Notice tone from the controller's own state: the kit colours the existing #notice; wording and phase stay the controller's.
// `warningNotices` is the set of controller copy strings that describe a refusal/failure/uncertainty (page.js supplies it).
export function paintNotice(node, text, { phase, warningNotices = [] } = {}) {
  node.textContent = text || '';
  const warning = !!text && (phase === 'unavailable' || warningNotices.includes(text));
  node.className = text ? `note${warning ? ' warning' : ''}` : '';
  // The page's own #notice rule outranks the kit's class; the warning fill is asserted inline from the same token.
  if (warning) node.setAttribute('style', 'background:var(--warning-fill);color:var(--warning-ink)'); else node.removeAttribute('style');
  return warning;
}

