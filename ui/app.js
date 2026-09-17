import { initLanguageControls } from './language.js';
import { reviewAnswer, templateChoices } from './present.js';
import { clearIdentityData, codeEntryFailure, hasProjectWork } from './visibility.js';
import { recoverParticipant, redeemAndOpen, resumeNoticeAfterReceipt, resumeTarget, savedSubmitKey } from './participant-resume.js';
import { copy as sharedCopy, createSharedLinkClient, fill, currentNamespace, digestNamespace, errorKind, parseEntryFragment, rememberCurrent, resolveConflict, restoreDraft, saveDraft, scopedStorage, shareUrl, stripFragment } from './shared-link.js';
const $ = id => document.getElementById(id);
// Shared-link mode is decided first so no global (code-path) key is read or written in that mode.
const sharedToken = parseEntryFragment(location.hash);
if (sharedToken !== null) stripFragment(window);
const sharedResume = sharedToken === null ? currentNamespace(sessionStorage) : null;
const sharedMode = sharedToken !== null || sharedResume !== null;
const state = { session: sharedMode ? null : sessionStorage.getItem('facilitatorToken'), participant: sharedMode ? null : sessionStorage.getItem('participantToken'), principal: null, project: null, projectView: null, assessment: null, survey: null, form: null, answers: null, responseKey: null, codeIds: null, confirmToken: null, shared: null, linkConfirm: null, shareUrl: null };
state.responseKey = sharedMode ? null : savedSubmitKey(sessionStorage, state.participant);
const path = (value) => encodeURIComponent(value);
function note(message) { $('notice').textContent = message; $('error').hidden = true; }
function fail(message) { $('error').textContent = message; $('error').hidden = false; $('notice').textContent = 'Action needs attention. No completion is assumed.'; }
function text(node, value) { node.textContent = value == null ? '' : String(value); }
function option(select, value, label) { select.add(new Option(label, value)); }
function resetSelect(select, label) { select.replaceChildren(new Option(label, '')); }
function required(value, message) { if (!value) throw new Error(message); return value; }
async function api(url, { method = 'GET', body, participant = false } = {}) {
  if (participant && state.shared) return state.shared.request(url, { method, body }); // shared link: credential-less fetch, link bearer only
  const token = participant ? state.participant : state.session;
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let response;
  try { response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new Error('Local API unavailable. For a write, its outcome is unknown; check server state before retrying.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error(`Unreadable API response (${response.status}).`); }
  if (!response.ok || !data.ok) throw new Error(`${data.error?.code || response.status}: ${data.error?.message || 'Request failed'}`);
  const li = document.createElement('li'); li.textContent = `${method} ${url} · ${data.capability || 'v2'} · ${data.receipt?.id || data.receipt?.receipt_id || 'read'} · ${data.trace_id || 'no trace'}`; $('events').prepend(li);
  return data.result;
}
async function run(label, task) {
  note(label); const buttons = [...document.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
  try { await task(); note(`${label} — complete.`); } catch (error) { fail(error.message); }
  finally { buttons.forEach(b => b.disabled = b.id === 'release-codes' ? !state.confirmToken : b.id === 'issue-link-confirm' ? !state.linkConfirm : false); }
}
function showAuthorizedWork(me) {
  const visible = hasProjectWork(me);
  for (const id of ['project-card', 'assessment-card', 'survey-card', 'results-card']) $(id).hidden = !visible;
  $('create-project').hidden = !me.principal.provisioned;
  text($('access-state'), visible ? '' : 'No project access is assigned to this identity. Scoped project work is hidden.');
}
function resetClientIdentity() {
  clearIdentityData(state, sessionStorage);
  clearCodeBatch(); clearShareLink(); // sign-out/sign-in: the once-shown link and confirm token never outlive the identity
  for (const id of ['project-card', 'assessment-card', 'survey-card', 'results-card']) $(id).hidden = true;
  $('create-project').hidden = true;
  for (const [id, label] of [['projects', 'Choose project'], ['assessments', 'Choose assessment'], ['surveys', 'Choose survey'], ['languages', 'Choose language'], ['templates', 'Choose template']]) resetSelect($(id), label);
  for (const id of ['project-detail', 'assessment-detail', 'survey-detail', 'form-context', 'dev-code']) text($(id), '');
  text($('participant-resume'), '');
  text($('results'), 'Select an assessment.'); text($('identity'), 'Not signed in');
  text($('access-state'), 'Sign in to see authorized project work.');
  $('questions').replaceChildren(); $('review-answers').replaceChildren(); $('events').replaceChildren();
  text($('receipt'), '');
  for (const id of ['answers', 'review', 'receipt', 'recover']) $(id).hidden = true;
  $('redeem').reset(); $('consume-login').reset(); $('create-project').reset(); $('create-assessment').reset(); $('create-language').reset();
  text($('participant-error'), ''); $('participant-error').hidden = true;
  text($('language-status'), 'Choose a project to list its languages.');
}
const languageControls = initLanguageControls({ api, run, getProject: () => state.project, onLanguages: active => {
  if (state.projectView) text($('project-detail'), `${state.projectView.name} · ${state.projectView.role} · ${active.length} active language(s)`);
} });
function bindForm(id, label, handler) { $(id).addEventListener('submit', e => { e.preventDefault(); run(label, () => handler(new FormData(e.currentTarget))); }); }
function bindClick(id, label, handler) { $(id).addEventListener('click', () => run(label, handler)); }
async function identity() {
  if (!state.session) { text($('identity'), 'Not signed in'); return; }
  const result = await api('/v2/me'); state.principal = result.principal;
  text($('identity'), `${result.principal.kind} · ${result.principal.id}`);
  showAuthorizedWork(result);
  return result;
}
async function projects() {
  const result = await api('/v2/projects'); resetSelect($('projects'), 'Choose project');
  for (const p of result.projects || []) option($('projects'), p.id, `${p.name} · ${p.role}`);
  if (state.project) $('projects').value = state.project;
}
async function chooseProject() {
  state.project = $('projects').value || null; state.projectView = null; state.assessment = null; state.survey = null;
  clearCodeBatch(); clearShareLink();
  text($('project-detail'), ''); text($('assessment-detail'), ''); text($('survey-detail'), '');
  text($('results'), 'Select an assessment.');
  resetSelect($('assessments'), 'Choose assessment'); resetSelect($('surveys'), 'Choose survey');
  if (!state.project) { await languageControls.refresh(); return; }
  const result = await api(`/v2/projects/${path(state.project)}`);
  state.projectView = result.project;
  await languageControls.refresh();
  await assessments();
}
async function assessments() {
  const pid = required(state.project, 'Choose a project.');
  const result = await api(`/v2/projects/${path(pid)}/assessments`); resetSelect($('assessments'), 'Choose assessment');
  for (const a of result.assessments || []) option($('assessments'), a.id, `${a.name} · ${a.stage} · ${a.role}`);
  if (state.assessment) $('assessments').value = state.assessment;
}
async function chooseAssessment() {
  state.assessment = $('assessments').value || null; state.survey = null; resetSelect($('surveys'), 'Choose survey');
  clearCodeBatch(); clearShareLink();
  text($('assessment-detail'), ''); text($('survey-detail'), ''); text($('results'), 'Select an assessment.');
  if (!state.assessment) return;
  const result = await api(`/v2/assessments/${path(state.assessment)}`);
  text($('assessment-detail'), `${result.assessment.name} · stage ${result.assessment.stage} · exact role ${result.assessment.role}`);
  const next = { prepare: 'collect', collect: 'understand', understand: 'improve', improve: 'understand' }[result.assessment.stage];
  if (next) $('stage-target').value = next;
  for (const survey of result.surveys || []) option($('surveys'), survey.id, `${survey.template_name} · ${survey.collection_status}`);
  if (result.surveys?.length === 1) { $('surveys').value = result.surveys[0].id; state.survey = result.surveys[0].id; }
}
async function templates() {
  const result = await api('/v2/templates'); resetSelect($('templates'), 'Choose current pinned template');
  for (const choice of templateChoices(result.templates || [])) {
    const entry = new Option(choice.label, choice.value);
    entry.disabled = choice.disabled;
    $('templates').add(entry);
  }
  const pinned = [...$('templates').options].find(entry => entry.value && !entry.disabled);
  if (pinned) $('templates').value = pinned.value;
}
function drawQuestion(item) {
  const field = document.createElement('fieldset'); field.dataset.item = item.id;
  const legend = document.createElement('legend'); legend.textContent = `${item.text || item.id}${item.requiredness === 'unresolved' ? ' (may leave unanswered; policy held)' : ''}`; field.append(legend);
  if (item.answer_semantics === 'unresolved_no_problems_vs_skipped') { const note = document.createElement('p'); note.textContent = 'Leaving this blank records an unknown answer, not “no problems.”'; field.append(note); }
  if (item.type === 'scale') { const input = document.createElement('input'); input.name = item.id; input.type = 'number'; input.min = item.scale.min; input.max = item.scale.max; input.step = 1; input.required = item.required !== false; field.append(input); }
  else if (item.type === 'text') { const input = document.createElement('textarea'); input.name = item.id; input.required = item.required !== false; field.append(input); }
  else if (item.type === 'single' || item.type === 'multi') {
    for (const opt of item.options || []) { const label = document.createElement('label'); const input = document.createElement('input'); input.type = item.type === 'multi' ? 'checkbox' : 'radio'; input.name = item.id; input.value = opt.code; input.required = item.type === 'single' && item.required !== false; label.append(input, document.createTextNode(opt.label || opt.text || opt.code)); field.append(label); }
    if (item.type === 'multi' && (item.options || []).some(opt => opt.exclusive)) { const note = document.createElement('p'); note.textContent = 'An exclusion choice cannot be combined with any other choice.'; field.append(note); }
  } else { const warning = document.createElement('p'); warning.textContent = `Unsupported item type ${item.type}; cannot submit.`; field.append(warning); }
  return field;
}
function answersFromForm() {
  const values = new FormData($('answers')); const answers = {};
  for (const item of state.form.items) {
    let value = item.type === 'multi' ? values.getAll(item.id) : values.get(item.id);
    if (value === null || value === '' || (Array.isArray(value) && !value.length)) {
      if (item.required === false) value = null;
      else throw new Error(`Answer required: ${item.text || item.id}`);
    }
    if (item.type === 'scale' && value !== null) value = Number(value);
    if (item.type === 'multi' && Array.isArray(value) && value.length > 1 && (item.options || []).some(opt => opt.exclusive && value.includes(opt.code))) throw new Error(`An exclusion choice cannot be combined: ${item.text || item.id}`);
    answers[item.id] = value;
  }
  return answers;
}
bindForm('request-login', 'Requesting local code…', async fd => {
  const result = await api('/v2/auth/link', { method: 'POST', body: { email: String(fd.get('email')).trim() } });
  text($('dev-code'), result.dev_only_code ? `Synthetic sandbox code: ${result.dev_only_code}` : 'Code requested. Delivery is not configured for this phase.');
  $('consume-login').elements.email.value = fd.get('email');
});
bindForm('consume-login', 'Signing in…', async fd => {
  const result = await api('/v2/auth/session', { method: 'POST', body: { email: String(fd.get('email')).trim(), code: String(fd.get('code')).trim() } });
  resetClientIdentity(); state.session = result.session; sessionStorage.setItem('facilitatorToken', state.session);
  const me = await identity(); if (hasProjectWork(me)) { await projects(); await templates(); }
});
bindClick('signout', 'Signing out…', async () => {
  let remoteError;
  try { if (state.session) await api('/v2/auth/session', { method: 'DELETE' }); }
  catch (error) { remoteError = error; }
  finally { resetClientIdentity(); }
  if (remoteError) throw new Error(`Local session cleared; server sign-out could not be confirmed: ${remoteError.message}`);
});
bindClick('load-projects', 'Loading projects…', projects);
$('projects').addEventListener('change', () => run('Loading project…', chooseProject));
bindForm('create-project', 'Creating project…', async fd => { const result = await api('/v2/projects', { method: 'POST', body: { name: String(fd.get('name')).trim() } }); state.project = result.project.id; await projects(); $('projects').value = state.project; await chooseProject(); });
bindClick('load-assessments', 'Loading assessments…', assessments);
$('assessments').addEventListener('change', () => run('Loading assessment…', chooseAssessment));
bindClick('set-stage', 'Moving assessment stage…', async () => {
  const aid = required(state.assessment, 'Choose an assessment.');
  const sid = state.survey;
  await api(`/v2/assessments/${path(aid)}/stage`, { method: 'POST', body: { stage: $('stage-target').value } });
  await assessments(); $('assessments').value = aid;
  await chooseAssessment();
  if (sid && [...$('surveys').options].some(entry => entry.value === sid)) { $('surveys').value = sid; state.survey = sid; await surveyStatus(); }
});
bindForm('create-assessment', 'Creating assessment…', async fd => {
  const pid = required(state.project, 'Choose a project.'); const result = await api(`/v2/projects/${path(pid)}/assessments`, { method: 'POST', body: { name: String(fd.get('name')).trim(), language_id: String(fd.get('language')) } });
  state.assessment = result.assessment.id; await assessments(); $('assessments').value = state.assessment; await chooseAssessment();
});
bindClick('load-templates', 'Loading templates…', templates);
bindClick('select-survey', 'Selecting survey…', async () => {
  const aid = required(state.assessment, 'Choose an assessment.'); const selected = required($('templates').value, 'Choose a template.');
  const [template_id, version] = selected.split('@'); const result = await api(`/v2/assessments/${path(aid)}/surveys`, { method: 'POST', body: { template_id, version: Number(version) } });
  const sid = result.survey.id; await chooseAssessment(); state.survey = sid; $('surveys').value = sid; await surveyStatus();
});
$('surveys').addEventListener('change', () => { state.survey = $('surveys').value || null; clearCodeBatch(); clearShareLink(); });
async function surveyStatus() {
  const aid = required(state.assessment, 'Choose an assessment.'), sid = required(state.survey, 'Choose a survey.');
  const result = await api(`/v2/assessments/${path(aid)}/surveys/${path(sid)}`);
  text($('survey-detail'), `${result.survey.template_name} · ${result.survey.collection_status} · ${result.counts.responses} response(s)`);
}
bindClick('survey-status', 'Checking survey…', surveyStatus);
function clearCodeBatch() {
  state.codeIds = null; state.confirmToken = null;
  text($('issued-ids'), 'No code batch issued in this page session.');
  text($('export-impact'), ''); text($('codes-output'), ''); $('codes-output').hidden = true;
  $('release-codes').disabled = true;
}
function codeRoute() {
  const aid = required(state.assessment, 'Choose an assessment.'), sid = required(state.survey, 'Choose a survey.');
  return `/v2/assessments/${path(aid)}/surveys/${path(sid)}/codes`;
}
bindClick('issue-codes', 'Issuing code IDs…', async () => {
  const count = Number($('code-count').value);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Code count must be 1–100.');
  const result = await api(codeRoute(), { method: 'POST', body: { count } });
  state.codeIds = result.ids; state.confirmToken = null;
  text($('issued-ids'), `${result.count} code ID(s) issued: ${result.ids.join(', ')}`);
  text($('export-impact'), 'Preview and confirm to reveal code values.');
  text($('codes-output'), ''); $('codes-output').hidden = true;
});
bindClick('preview-export', 'Previewing credential release…', async () => {
  const ids = required(state.codeIds, 'Issue a code batch in this page session first.');
  const result = await api(`${codeRoute()}/export`, { method: 'POST', body: { params: { ids }, mode: 'dry_run' } });
  state.confirmToken = result.confirm_token;
  text($('export-impact'), `Release ${result.count} code value(s) once; impact: ${JSON.stringify(result.impact)}. Confirmation expires in ${result.expires_in} seconds.`);
});
bindClick('release-codes', 'Releasing credential values…', async () => {
  const ids = required(state.codeIds, 'Issue a code batch first.'), confirm_token = required(state.confirmToken, 'Preview export again.');
  state.confirmToken = null; // a failed/uncertain release requires a fresh preview
  const result = await api(`${codeRoute()}/export`, { method: 'POST', body: { params: { ids }, mode: 'execute', confirm_token } });
  text($('codes-output'), result.codes.map(entry => `${entry.id}: ${entry.code}`).join('\n'));
  $('codes-output').hidden = false;
  text($('export-impact'), 'Released once. Save/print now; these values cannot be exported again.');
});
function linkRoute() {
  const aid = required(state.assessment, 'Choose an assessment.'), sid = required(state.survey, 'Choose a survey.');
  return `/v2/assessments/${path(aid)}/surveys/${path(sid)}/links`;
}
// Memory only: the once-shown URL and confirm token are never written to storage; every selection change and sign-out clears them.
function clearShareLink() { state.linkConfirm = null; state.shareUrl = null; text($('issue-link-impact'), ''); text($('share-url'), ''); $('share-url').hidden = true; $('copy-link').hidden = true; text($('copy-state'), ''); $('issue-link-confirm').disabled = true; }
bindClick('issue-link-preview', sharedCopy.labelPreviewLink, async () => {
  clearShareLink();
  const result = await api(linkRoute(), { method: 'POST', body: { params: {}, mode: 'dry_run' } });
  state.linkConfirm = result.confirm_token;
  text($('issue-link-impact'), `${sharedCopy.issuePreview} ${fill(sharedCopy.issueImpact, { impact: JSON.stringify(result.impact), seconds: result.expires_in })}`);
  $('issue-link-confirm').disabled = false;
});
bindClick('issue-link-confirm', sharedCopy.labelCreateLink, async () => {
  const confirm_token = required(state.linkConfirm, sharedCopy.previewAgain);
  state.linkConfirm = null; $('issue-link-confirm').disabled = true;
  const result = await api(linkRoute(), { method: 'POST', body: { params: {}, mode: 'execute', confirm_token } });
  state.shareUrl = shareUrl(location.origin, result.entry_fragment);
  text($('share-url'), state.shareUrl); $('share-url').hidden = false; $('copy-link').hidden = false;
  text($('issue-link-impact'), `${sharedCopy.issueDone}${result.expires_at ? ` ${fill(sharedCopy.issueExpires, { expires_at: result.expires_at })}` : ''}`);
});
bindClick('copy-link', sharedCopy.labelCopyLink, async () => { await navigator.clipboard.writeText(required(state.shareUrl, sharedCopy.createFirst)); text($('copy-state'), sharedCopy.linkCopied); });
bindClick('refresh-counts', sharedCopy.labelRefreshCounts, surveyStatus);
bindClick('load-results', 'Reading result state…', async () => {
  const aid = required(state.assessment, 'Choose an assessment.'); const result = await api(`/v2/assessments/${path(aid)}/results`);
  text($('results'), result.suppressed ? `Suppressed / ${result.status}: ${result.reason || 'Disclosure policy pending'}` : JSON.stringify(result));
});
bindForm('redeem', 'Redeeming access code…', async fd => {
  text($('participant-error'), ''); $('participant-error').hidden = true;
  await redeemAndOpen(
    () => api('/v2/participate/code', { method: 'POST', body: { code: String(fd.get('code')).trim() } }),
    result => {
    state.participant = result.participant_token; sessionStorage.setItem('participantToken', state.participant);
    state.form = null; state.answers = null;
    $('questions').replaceChildren(); $('review-answers').replaceChildren();
    for (const id of ['form-context', 'receipt']) text($(id), '');
    for (const id of ['answers', 'review', 'receipt']) $(id).hidden = true;
    state.responseKey = null; sessionStorage.removeItem('responseKey');
    text($('participant-resume'), '');
    $('recover').hidden = false;
    },
    loadForm,
    () => { text($('participant-error'), codeEntryFailure); $('participant-error').hidden = false; $('participant-error').focus(); },
  );
});
function clearParticipantError() {
  text($('participant-error'), ''); $('participant-error').hidden = true;
}
async function loadForm() {
  const result = await api('/v2/participate/form', { participant: true }); state.form = result; state.answers = null;
  clearParticipantError();
  text($('form-context'), `${result.assessment} · ${result.language} · ${result.template.id}@${result.template.version}`);
  $('questions').replaceChildren(...result.items.map(drawQuestion)); $('answers').hidden = false; $('review').hidden = true; $('receipt').hidden = true; $('recover').hidden = false;
  if (state.shared) restoreSharedDraft();
}
function draftValues() {
  const values = new FormData($('answers')); const out = {};
  for (const item of state.form.items) { const v = item.type === 'multi' ? values.getAll(item.id) : values.get(item.id); if (v !== null) out[item.id] = v; }
  return out;
}
function restoreSharedDraft() {
  const draft = restoreDraft(state.sharedStore, state.form);
  if (!draft) return;
  if (draft.mismatch) { state.sharedStore.remove('draft'); text($('participant-resume'), sharedCopy.draftMismatch); return; }
  for (const item of state.form.items) { const v = draft.answers[item.id]; if (v == null) continue; for (const input of $('answers').querySelectorAll(`[name="${CSS.escape(item.id)}"]`)) { if (input.type === 'checkbox') input.checked = v.includes(input.value); else if (input.type === 'radio') input.checked = input.value === v; else input.value = v; } }
  text($('participant-resume'), sharedCopy.draftRestored);
}
$('answers').addEventListener('input', () => { if (state.shared && state.form) saveDraft(state.sharedStore, state.form, draftValues()); });
async function restoreParticipant() {
  // A failed first receipt request must leave the saved session recoverable.
  $('recover').hidden = false;
  try {
    const receipt = await api('/v2/participate/receipt', { participant: true });
    if (resumeTarget(receipt) === 'receipt') {
      showReceipt(receipt);
      state.responseKey = null; sessionStorage.removeItem('responseKey');
      text($('participant-resume'), 'Saved submission restored from the server.');
    } else {
      await loadForm();
      text($('participant-resume'), 'Form reopened from your participant session. Answers entered before reload were not saved; please re-enter them.');
    }
  } catch (error) {
    text($('participant-error'), 'Participant session could not be reopened. If the code has already been used, contact the facilitator.');
    $('participant-error').hidden = false;
    throw error;
  }
}
bindForm('answers', 'Preparing answer review…', async () => {
  state.answers = answersFromForm(); $('review-answers').replaceChildren();
  for (const item of state.form.items) { const p = document.createElement('p'); p.textContent = `${item.text || item.id}: ${reviewAnswer(item, state.answers[item.id])}`; $('review-answers').append(p); }
  $('answers').hidden = true; $('review').hidden = false;
});
$('edit').addEventListener('click', () => { $('answers').hidden = false; $('review').hidden = true; });
bindClick('submit', 'Submitting response…', async () => {
  required(state.answers, 'Review answers first.');
  if (state.shared) { // scoped namespace only; the global responseKey is never touched in this mode
    let result;
    try { result = await state.shared.submit(state.answers); }
    catch (error) {
      if (errorKind(error) === 'conflict') { const resolved = await resolveConflict(state.shared); if (resolved.state === 'receipt') { state.sharedStore.remove('draft'); state.sharedStore.remove('submitKey'); showReceipt(resolved.receipt); return; } showSharedUnavailable(resolved.state); }
      else text($('participant-resume'), sharedCopy.submitFailed);
      throw error;
    }
    showReceipt(result); return;
  }
  if (!state.responseKey) { state.responseKey = crypto.randomUUID(); sessionStorage.setItem('responseKey', state.responseKey); }
  const result = await api('/v2/participate/responses', { method: 'POST', participant: true, body: { answers: state.answers, idempotency_key: state.responseKey } });
  showReceipt(result);
  state.responseKey = null; sessionStorage.removeItem('responseKey');
});
function showReceipt(result) {
  clearParticipantError();
  text($('receipt'), result.submitted === false ? 'No submission recorded yet.' : `Response saved · ${result.response_id || 'ID unavailable'} · ${result.submitted_at || 'time unavailable'}`);
  text($('participant-resume'), resumeNoticeAfterReceipt(result, $('participant-resume').textContent));
  $('receipt').hidden = false;
  if (result.submitted !== false) { $('review').hidden = true; $('answers').hidden = true; }
  if (state.shared && result.submitted !== false) text($('participant-resume'), `${sharedCopy.receiptThanks} ${sharedCopy.sameLinkOthers}`);
}
bindClick('recover', 'Recovering receipt…', async () => {
  const receipt = await api('/v2/participate/receipt', { participant: true });
  await recoverParticipant(receipt, !!state.form, loadForm, showReceipt);
  if (!receipt.submitted) return;
  if (state.shared) { state.sharedStore.remove('draft'); state.sharedStore.remove('submitKey'); } // scoped namespace only; globals untouched in shared mode
  else { state.responseKey = null; sessionStorage.removeItem('responseKey'); }
});
// Return leg of Cloudflare email-code sign-in: /v2/auth/access hands the session back in the URL fragment.
{ const m = location.hash.match(/^#session=([A-Za-z0-9_]+)$/); if (m) { resetClientIdentity(); state.session = m[1]; sessionStorage.setItem('facilitatorToken', m[1]); history.replaceState(null, '', location.pathname); } }
function showSharedUnavailable(kind) {
  text($('participant-error'), kind === 'closed' ? sharedCopy.collectionClosed : sharedCopy.linkUnavailable); $('participant-error').hidden = false;
  $('answers').hidden = true; $('review').hidden = true;
}
async function sharedLinkEntry(token, namespace) {
  $('facilitator').hidden = true; document.querySelector('aside').hidden = true; $('participant').querySelector('p.note').hidden = true;
  for (const el of $('redeem').querySelectorAll('label,button')) el.hidden = true; // code entry hidden; the alert slot stays
  namespace = namespace || await digestNamespace(token);
  state.sharedStore = scopedStorage(sessionStorage, namespace);
  rememberCurrent(sessionStorage, namespace); // digest only; the raw token is never persisted
  state.shared = createSharedLinkClient({ store: state.sharedStore, onEvent: e => { const li = document.createElement('li'); li.textContent = `${e.method} ${e.url} · ${e.capability || 'v2'} · ${e.receipt?.id || e.receipt?.receipt_id || 'read'} · ${e.trace_id || 'no trace'}`; $('events').prepend(li); } });
  try {
    // With a fragment: open (resume_token when this namespace holds a bearer). Without one (reload):
    // the raw token is not persisted, so resume goes straight to the receipt with the stored bearer.
    if (token !== null) await state.shared.open(token);
    else if (!state.shared.bearer) { showSharedUnavailable('unavailable'); return; }
    const receipt = await state.shared.receipt(); // receipt is checked before any editable form
    $('recover').hidden = false;
    if (resumeTarget(receipt) === 'receipt') showReceipt(receipt); else await loadForm();
  } catch (error) {
    const kind = errorKind(error);
    if (kind === 'conflict') { const resolved = await resolveConflict(state.shared); if (resolved.state === 'receipt') { $('recover').hidden = false; showReceipt(resolved.receipt); return; } showSharedUnavailable(resolved.state); return; }
    showSharedUnavailable('unavailable');
    throw error;
  }
}
if (sharedMode) run(sharedCopy.labelOpening, () => sharedLinkEntry(sharedToken, sharedResume));
else run('Checking session…', async () => {
  try { const me = await identity(); if (me && hasProjectWork(me)) { await projects(); await templates(); } }
  catch { state.session = null; state.principal = null; sessionStorage.removeItem('facilitatorToken'); text($('identity'), 'Not signed in'); }
  if (state.participant) await restoreParticipant();
});
