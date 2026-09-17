// Design Screens slice — disjoint from Root layout/tokens/public tour and from app.js.
// Pins (read-only): cookbook design-system 2c29676d0b133bd9db59dd71d28b651882a9b6c3
//   ui_kits/3d-review/views-coordinator.js, views-print.js, print.css
//   cookbook plan06 e877d17b70eae57e8ea4279f5e89cf0e4d766336 (stage tab semantics only).
// Wires to existing /v2 handlers. Does not invent roles, receipts, links, or credentials.

export const STAGES = Object.freeze([
  { id: 'prepare', label: 'Prepare' },
  { id: 'collect', label: 'Collect' },
  { id: 'understand', label: 'Understand' },
  { id: 'improve', label: 'Improve' },
]);

export const REPEAT_WHEN_APPROPRIATE = 'Repeat when appropriate';

export const PRINT_ROLES = Object.freeze(['owner', 'member']);
export const HELP_ROLES = Object.freeze(['owner', 'member', 'viewer']);

// In-stage first-run copy from views-coordinator STAGE_TOUR, remapped to app stage ids
// (prepare/collect/understand/improve). Not the public five-step tour.
export const STAGE_TOUR = Object.freeze({
  prepare: Object.freeze([
    'Name the cycle and its language; pick the perspectives.',
    'Nothing is sent yet. Links and codes appear once you open collection.',
    'Browsing the four phases never changes the stage; the button on the right does.',
  ]),
  collect: Object.freeze([
    'Each survey card holds its links, codes and the print form.',
    'Counts are responses over invited; small groups stay protected in results.',
    'Close collection when you have the voices you need; that moves the stage to Understand.',
  ]),
  understand: Object.freeze([
    'Bands, not scores. Withheld means a small group, not a poor result.',
    'Results are per language and per cycle; check the evidence notes before sharing.',
    'Share a viewer link only after the review gate; viewers see output, never input.',
  ]),
  improve: Object.freeze([
    'Write the reflection and the next step; they stay with this cycle.',
    'Repeat when it helps the project reflect on progress; there is no schedule.',
    'Start the next cycle from the project, not from here.',
  ]),
});

const TAB_KEY = id => `stage-tab:${id}`;
const TOUR_KEY = (id, stage) => `stage-tour:${id}:${stage}`;

export function isStageId(id) {
  return STAGES.some(stage => stage.id === id);
}

export function stageLabel(id) {
  return STAGES.find(stage => stage.id === id)?.label || '';
}

export function rememberTab(storage, assessmentId, tabId) {
  if (!storage || !assessmentId || !isStageId(tabId)) return;
  storage.setItem(TAB_KEY(assessmentId), tabId);
}

export function recalledTab(storage, assessmentId, fallback = 'prepare') {
  const saved = storage && assessmentId ? storage.getItem(TAB_KEY(assessmentId)) : null;
  return isStageId(saved) ? saved : (isStageId(fallback) ? fallback : 'prepare');
}

// Tabs remember; browsing never advances the server stage.
export function selectStageTab(storage, assessmentId, tabId) {
  if (!isStageId(tabId) || !assessmentId) return recalledTab(storage, assessmentId);
  rememberTab(storage, assessmentId, tabId);
  return tabId;
}

export function authorizedRole(assessment) {
  const role = assessment && typeof assessment.role === 'string' ? assessment.role : null;
  return HELP_ROLES.includes(role) ? role : null;
}

export function roleHelpVisible(role) {
  return HELP_ROLES.includes(role);
}

export function printAllowed(role) {
  return PRINT_ROLES.includes(role);
}

export function helpForStage(docs, stage) {
  if (!docs || !roleHelpVisible(docs.role)) return { visible: false };
  const can = Array.isArray(docs.can) ? docs.can : [];
  const allowed = new Set(can);
  const suggested = docs.next_best && isStageId(stage) ? docs.next_best[stage] : null;
  const available = typeof suggested === 'string' && allowed.has(suggested) ? suggested : null;
  return { visible: true, role: docs.role, stage, available, can };
}

export function shouldShowStageTour(storage, assessmentId, stage) {
  if (!isStageId(stage) || !assessmentId) return false;
  return !storage || storage.getItem(TOUR_KEY(assessmentId, stage)) !== '1';
}

export function dismissStageTour(storage, assessmentId, stage) {
  if (!storage || !assessmentId || !isStageId(stage)) return;
  storage.setItem(TOUR_KEY(assessmentId, stage), '1');
}

export function credentialFields(result) {
  if (!result || typeof result !== 'object') return ['missing-result'];
  const leaked = [];
  for (const key of ['codes', 'code', 'link_token', 'session', 'access_code', 'secret']) {
    if (result[key] != null && result[key] !== '') leaked.push(key);
  }
  if (result.blank !== true) leaked.push('not-blank');
  return leaked;
}

export function itemsFromPrintHtml(html) {
  if (typeof html !== 'string') return [];
  const items = [];
  const re = /<li>([\s\S]*?)<hr\s*\/?><\/li>/gi;
  let match;
  while ((match = re.exec(html))) items.push(decodeEntities(stripTags(match[1])).trim());
  return items.filter(Boolean);
}

export function printTitleFromHtml(html) {
  if (typeof html !== 'string') return '';
  const title = html.match(/<h1>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
  return title ? decodeEntities(stripTags(title[1])).trim() : '';
}

export async function readEnvelope(request, url, { token } = {}) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let response;
  try {
    response = await request(url, { method: 'GET', headers, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    return { ok: false, error: { code: 'UNAVAILABLE' } };
  }
  let data;
  try { data = await response.json(); } catch { return { ok: false, error: { code: 'UNREADABLE' } }; }
  if (!response.ok || !data || data.ok !== true) {
    return { ok: false, error: (data && data.error) || { code: String(response.status) } };
  }
  return { ok: true, result: data.result };
}

export async function loadRoleHelp({ request, token, assessmentId, stage }) {
  if (!request || !assessmentId) return { visible: false, reason: 'no-assessment' };
  const assessmentRead = await readEnvelope(request, `/v2/assessments/${encodeURIComponent(assessmentId)}`, { token });
  if (!assessmentRead.ok) return { visible: false, reason: (assessmentRead.error && assessmentRead.error.code) || 'not-visible' };
  const role = authorizedRole(assessmentRead.result && assessmentRead.result.assessment);
  if (!roleHelpVisible(role)) return { visible: false, reason: 'no-authorized-role' };
  const docsRead = await readEnvelope(request, `/v2/docs?role=${encodeURIComponent(role)}`, { token });
  if (!docsRead.ok) return { visible: false, reason: (docsRead.error && docsRead.error.code) || 'docs-unavailable' };
  return helpForStage({ ...docsRead.result, role: docsRead.result.role || role }, stage);
}

export async function loadBlankPrint({ request, token, aid, sid, role, lang }) {
  if (!printAllowed(role)) return { visible: false, reason: 'not-authorized' };
  if (!request || !aid || !sid) return { visible: false, reason: 'no-survey' };
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  const printRead = await readEnvelope(request, `/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(sid)}/print${query}`, { token });
  if (!printRead.ok) return { visible: false, reason: (printRead.error && printRead.error.code) || 'not-visible' };
  const leaked = credentialFields(printRead.result);
  if (leaked.length) return { visible: false, reason: 'unsafe-print', leaked };
  const result = printRead.result;
  return {
    visible: true,
    blank: true,
    template_id: result.template_id,
    template_version: result.template_version,
    title: printTitleFromHtml(result.html),
    items: itemsFromPrintHtml(result.html),
  };
}

function el(doc, tag, text) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderStageTabs(doc, root, { assessmentId, stage, selected, storage, onSelect }) {
  root.replaceChildren();
  const nav = el(doc, 'nav');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Assessment stages');
  nav.className = 'stage-tabs';
  const current = recalledTab(storage, assessmentId, selected || 'prepare');
  for (const tab of STAGES) {
    const button = el(doc, 'button', tab.label);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('data-stage', tab.id);
    button.setAttribute('aria-selected', tab.id === current ? 'true' : 'false');
    button.addEventListener('click', () => {
      const next = selectStageTab(storage, assessmentId, tab.id);
      if (onSelect) onSelect(next);
    });
    nav.append(button);
  }
  root.append(nav);
  const now = el(doc, 'p', `Current stage: ${stageLabel(stage) || 'unknown'}`);
  now.className = 'stage-now';
  root.append(now);
  const repeat = el(doc, 'p', REPEAT_WHEN_APPROPRIATE);
  repeat.className = 'stage-repeat';
  root.append(repeat);
  return { selected: current };
}

export function renderRoleHelp(doc, root, help) {
  root.replaceChildren();
  root.hidden = !help || !help.visible;
  if (!help || !help.visible) return;
  root.className = 'role-help';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'What you can do here');
  root.append(el(doc, 'h2', 'What you can do here'));
  root.append(el(doc, 'p', `Authorized role: ${help.role}`));
  if (help.available) root.append(el(doc, 'p', `Next here: ${help.available}`));
  else root.append(el(doc, 'p', 'This stage’s suggested next step is not available at your role.'));
}

export function renderStageTour(doc, root, { storage, assessmentId, stage, role, onDismiss }) {
  root.replaceChildren();
  const show = shouldShowStageTour(storage, assessmentId, stage);
  root.hidden = !show;
  if (!show) return;
  const steps = STAGE_TOUR[stage] || [];
  root.className = 'stage-tour';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', `First time in ${stageLabel(stage)}`);
  const head = el(doc, 'div');
  head.className = 'headrow';
  head.append(el(doc, 'p', `First time in ${stageLabel(stage)}${role ? ` · ${role}` : ''}`));
  const gotIt = el(doc, 'button', 'Got it');
  gotIt.type = 'button';
  gotIt.addEventListener('click', () => {
    dismissStageTour(storage, assessmentId, stage);
    if (onDismiss) onDismiss();
  });
  head.append(gotIt);
  root.append(head);
  const list = el(doc, 'ol');
  for (const step of steps) list.append(el(doc, 'li', step));
  root.append(list);
}

export function renderBlankPrint(doc, root, model, { paper = 'a4', onPrint } = {}) {
  root.replaceChildren();
  root.hidden = !model || !model.visible;
  if (!model || !model.visible) return;
  root.className = 'stage-screens';
  const tools = el(doc, 'div');
  tools.className = 'print-tools no-print';
  const paperLabel = el(doc, 'label', 'Paper');
  const paperSelect = el(doc, 'select');
  for (const size of ['a4', 'letter']) {
    const option = el(doc, 'option', size.toUpperCase());
    option.value = size;
    if (size === paper) option.selected = true;
    paperSelect.append(option);
  }
  paperSelect.addEventListener('change', event => {
    const next = event.currentTarget.value === 'letter' ? 'letter' : 'a4';
    renderBlankPrint(doc, root, model, { paper: next, onPrint });
  });
  paperLabel.append(paperSelect);
  tools.append(paperLabel);
  const printBtn = el(doc, 'button', 'Print');
  printBtn.type = 'button';
  printBtn.className = 'primary';
  printBtn.addEventListener('click', () => { if (onPrint) onPrint(); });
  tools.append(printBtn);
  tools.append(el(doc, 'span', `${model.items.length} questions · ${paper.toUpperCase()} · nothing personal on the page`));
  root.append(tools);

  const article = el(doc, 'article');
  article.className = `paper ${paper}`;
  const header = el(doc, 'header');
  header.className = 'p-head';
  const brandWrap = el(doc, 'div');
  const brand = el(doc, 'div');
  brand.className = 'p-brand';
  const mark = el(doc, 'span', '3D');
  brand.append(mark, doc.createTextNode ? doc.createTextNode(' Review') : el(doc, 'span', ' Review'));
  brandWrap.append(brand);
  brandWrap.append(el(doc, 'h1', model.title || 'Blank survey'));
  header.append(brandWrap);

  const code = el(doc, 'div');
  code.className = 'p-code';
  const codeLabel = el(doc, 'div', 'Code (optional; legacy)');
  codeLabel.className = 'p-label';
  const slot = el(doc, 'div');
  slot.className = 'p-slot';
  slot.setAttribute('aria-label', 'Blank code slot');
  for (let i = 0; i < 6; i++) slot.append(el(doc, 'span'));
  const leave = el(doc, 'div', 'Leave blank when answering from the shared link');
  leave.className = 'p-label';
  code.append(codeLabel, slot, leave);
  header.append(code);

  const qr = el(doc, 'div');
  qr.className = 'p-qr';
  const qrBox = el(doc, 'div');
  qrBox.className = 'qr';
  qrBox.setAttribute('aria-label', 'Invitation link is not printed on this blank form');
  const qrLabel = el(doc, 'div', 'No invitation link on this blank form');
  qrLabel.className = 'p-label';
  qr.append(qrBox, qrLabel);
  header.append(qr);
  article.append(header);

  article.append(el(doc, 'p', 'Your answers are grouped with others; nothing here asks who you are. Mark one box per question unless it says choose all that apply.'));
  const list = el(doc, 'ol');
  list.className = 'p-items';
  for (const [index, text] of model.items.entries()) {
    const item = el(doc, 'li');
    item.className = 'p-item';
    const q = el(doc, 'div');
    q.className = 'p-q';
    const n = el(doc, 'span', String(index + 1));
    n.className = 'p-n';
    q.append(n, el(doc, 'span', text));
    item.append(q);
    list.append(item);
  }
  article.append(list);

  const foot = el(doc, 'footer');
  foot.className = 'p-foot';
  const version = [model.template_id, model.template_version != null ? `@${model.template_version}` : ''].join('');
  foot.append(el(doc, 'span', version ? `Form ${version}` : 'Blank form'));
  foot.append(el(doc, 'span', 'Facilitator: this page never prints codes or credentials'));
  article.append(foot);
  root.append(article);
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, '');
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
