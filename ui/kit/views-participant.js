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
  receiptHelp: 'Your answers stay with the team, grouped with others. Reopening your link shows this receipt again.',
  practiceTitle: 'Practice complete — nothing sent',
  practiceHelp: 'This was the practice survey. No response was sent or saved.',
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
export function pager(doc, count, { onBack, onNext } = {}) {
  const nav = el(doc, 'div', 'participant-pager');
  nav.hidden = true;
  const bar = el(doc, 'div', 'progress');
  bar.setAttribute('aria-hidden', 'true');
  const pips = [];
  for (let i = 0; i < count; i++) { const pip = el(doc, 'span'); pips.push(pip); bar.append(pip); }
  const progress = el(doc, 'p', 'participant-progress eyebrow');
  progress.setAttribute('aria-live', 'polite');
  const controls = el(doc, 'div', 'participant-page-actions row');
  const back = button(doc, copy.back, 'quiet', onBack);
  const next = button(doc, copy.next, 'primary', onNext);
  controls.append(back, next);
  nav.append(bar, progress, controls);
  function paint(index) {
    progress.textContent = `Question ${index + 1} of ${count}`;
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
    if (item.type === 'scale') { input.type = 'number'; input.min = item.scale.min; input.max = item.scale.max; input.step = 1; }
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
  const row = el(doc, 'div', 'participant-review-row');
  row.append(el(doc, 'p', 'muted', item.text || item.id));
  row.append(el(doc, 'strong', undefined, answerText === '' || answerText === null || answerText === undefined ? copy.blank : answerText));
  return row;
}

// Receipt from the controller's genuine receipt object only. Missing fields are said to be missing, never invented.
export function receipt(doc, result, { demo = false } = {}) {
  const wrap = el(doc, 'div', 'participant-receipt');
  wrap.append(el(doc, 'div', 'participant-receipt-mark', '✓'));
  wrap.append(el(doc, 'h2', undefined, demo ? copy.practiceTitle : copy.receiptTitle));
  wrap.append(el(doc, 'p', 'muted', demo ? copy.practiceHelp : copy.receiptHelp));
  wrap.append(el(doc, 'p', 'note', `${result?.response_id || 'ID unavailable'} · ${result?.submitted_at || 'time unavailable'}`));
  return wrap;
}

// Link the kit stylesheets once (the participant HTML is not owned by this slice) and scope kit rules to the page's main.
export function adoptKit(doc, main) {
  const head = doc.head;
  if (head) for (const href of STYLESHEETS) {
    if ([...head.querySelectorAll('link[rel="stylesheet"]')].some(link => link.getAttribute('href') === href)) continue;
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = href; head.append(link);
  }
  if (main && !/(^|\s)rv(\s|$)/.test(main.className || '')) main.className = `${main.className || ''} rv participant-kit`.trim();
}
