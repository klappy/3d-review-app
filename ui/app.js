import { parseInvitationFragment } from './public-entry.js';
import { mountParticipantView } from './participant-view.js';
import { redactDiagnosticPath } from './diagnostic-path.js';
import { createCollabHooks } from './collab-mount.js';
import { mountEntityScreen } from './entity-screen.js';
import { mountLensSurveys } from './lens-surveys.js';
import { loadRoleHelp, loadBlankPrint, renderAssessmentHeadrow, renderStageTabs, renderStageTour, renderRoleHelp, renderBlankPrint, recalledTab, printAllowed } from './stage-screens.js';
import { initLanguageControls } from './language.js';
import { reviewAnswer, templateChoices } from './present.js';
import { assessmentGrants, clearIdentityData, codeEntryFailure, hasProjectWork, hasReportWork, hasSharedAssessmentEntry } from './visibility.js';
import { renderList, renderReport, upsertRow } from './report-view.js';
import { recoverParticipant, redeemAndOpen, resumeNoticeAfterReceipt, resumeTarget, savedSubmitKey } from './participant-resume.js';
import { copy as sharedCopy, createSharedLinkClient, fill, currentNamespace, digestNamespace, entryFailureKind, errorKind, parseEntryFragment, rememberCurrent, resolveConflict, restoreDraft, saveDraft, scopedStorage, shareUrl, stripFragment, submitFailureKind } from './shared-link.js';
// Thrown by shared-link paths that already showed the participant copy: run() marks the action as
// needing attention without painting raw server text into #error.
class HandledFailure extends Error { constructor() { super('handled'); this.name = 'HandledFailure'; } }
// In-memory only (per page): whether an earlier submit on this page had an unknown outcome.
let participantView = null;
let submitState = 'none'; // 'none' | 'uncertain'
const $ = id => document.getElementById(id);
let pendingInvitation = location.hash.startsWith('#invite=') ? parseInvitationFragment(location.hash) : null;
const invitationEntry = pendingInvitation !== null;
let invitationGeneration = 0;
function endInvitation() {
  invitationGeneration++;
  pendingInvitation = null;
  if (document.body) delete document.body.dataset.invitationIntent;
  $('invitation-entry-notice')?.remove?.();
}
if (invitationEntry) { document.body.dataset.invitationIntent = 'active'; document.body.dataset.invitationEntry = 'true'; } // entry isolation lasts the page lifetime: a saved participant route/namespace is ignored (never deleted) even after the intent ends (Bugbot 4039886032)
if (location.hash.startsWith('#invite=')) history.replaceState(null, '', location.pathname + location.search);
// Shared-link mode is decided first so no global (code-path) key is read or written in that mode.
const sharedToken = parseEntryFragment(location.hash);
if (sharedToken !== null) stripFragment(window);
const sharedResume = !invitationEntry && sharedToken === null ? currentNamespace(sessionStorage) : null;
const sharedMode = sharedToken !== null || sharedResume !== null;
const state = { session: sharedMode ? null : sessionStorage.getItem('facilitatorToken'), participant: sharedMode || invitationEntry ? null : sessionStorage.getItem('participantToken'), principal: null, project: null, projectView: null, assessment: null, survey: null, form: null, answers: null, responseKey: null, codeIds: null, confirmToken: null, shared: null, linkConfirm: null, shareUrl: null, assessmentRole: null, reportConfirm: null, reportCursor: null };
state.responseKey = sharedMode ? null : savedSubmitKey(sessionStorage, state.participant);
const collab = createCollabHooks({ document, api, sharedMode, onAcceptanceEnded: endInvitation, onReload: async () => { const me = await identity(); if (me && hasProjectWork(me)) await projects(); },
  // Opening a workspace makes it the selected entity: side-effect-free downstream clear (no change handlers, so no
  // fetch, no transient project scope, no run() notice — Bugbot 4038374305). Same synchronous resets chooseProject
  // performs before its await; the workspace scope is painted by the hook right after this returns.
  onWorkspaceOpened: () => clearEntitySelection() });
function clearEntitySelection() {
  endInvitation();
  clearStageScreens();
  state.project = null; state.projectView = null; state.assessment = null; state.survey = null;
  clearCodeBatch(); clearShareLink();
  state.assessmentRole = null; clearReportState(); showReportControls();
  $('projects').value = ''; $('granted-assessments').value = ''; text($('granted-detail'), '');
  text($('project-detail'), ''); text($('assessment-detail'), ''); text($('survey-detail'), '');
  text($('results'), 'Select an assessment.'); text($('notice'), ''); // a completed notice from the previous entity does not survive the switch
  text($('error'), ''); $('error').hidden = true; // nor its error (Bugbot 4038528843)
  resetSelect($('assessments'), 'Choose assessment'); resetSelect($('surveys'), 'Choose survey');
  // Complete downstream display-state inventory (Bugbot 4038528822): project languages (select + status; no fetch with
  // no project), the next-stage target, and the per-entity forms that may hold typed input from the previous entity.
  languageControls.refresh(); $('stage-target').value = '';
  $('create-assessment').reset(); $('create-language').reset();
  lensSurveys?.reset(); entityScreen?.render();
}
const entityScreen = sharedMode || typeof window === 'undefined' ? null : mountEntityScreen(document, window, { isStaff: () => collab.isStaff(), selectedWorkspace: () => collab.selectedWorkspace(), backToWorkspaces: () => collab.backToWorkspaces() });
// Assessment = three lenses; inclusion goes through the existing select/deselect capabilities and re-reads the assessment.
const lensSurveys = sharedMode || !$('lens-surveys-root') ? null : mountLensSurveys({ document, root: $('lens-surveys-root'), actions: {
  select: (template_id, version) => run('Including survey…', async () => { const aid = required(state.assessment, 'Choose an assessment.'); await api(`/v2/assessments/${path(aid)}/surveys`, { method: 'POST', body: { template_id, version: Number(version) } }); await chooseAssessment(); }),
  deselect: sid => run('Removing survey from assessment…', async () => { const aid = required(state.assessment, 'Choose an assessment.'); await api(`/v2/assessments/${path(aid)}/surveys/${path(sid)}`, { method: 'DELETE' }); await chooseAssessment(); }),
  open: sid => { $('surveys').value = sid; if ($('surveys').value === sid) $('surveys').dispatchEvent(new Event('change')); },
  counts: async ids => { const aid = state.assessment; const map = new Map(); for (const sid of ids) { try { const r = await api(`/v2/assessments/${path(aid)}/surveys/${path(sid)}`); if (state.assessment === aid) map.set(sid, r.counts); } catch { /* count unavailable: row shows without it */ } } return map; },
} });
const path = (value) => encodeURIComponent(value);
let stageGeneration = 0;
let stageContext = null;
function clearStageScreens() {
  stageGeneration++;
  stageContext = null;
  $('assessment-context').replaceChildren();
  $('stage-workspace').hidden = true;
  for (const id of ['stage-tabs-root', 'stage-help-root', 'stage-tour-root', 'stage-print-root']) $(id).replaceChildren();
  $('stage-print-survey').replaceChildren();
  $('stage-print-load').hidden = true;
}
function stageSnapshot() { return { generation: stageGeneration, session: state.session, aid: state.assessment, sid: state.survey }; }
function stageCurrent(snap, survey = false) {
  return !sharedMode && !!state.principal && snap.generation === stageGeneration && snap.session === state.session && snap.aid === state.assessment && (!survey || snap.sid === state.survey);
}
function stageRequest(snap, survey = false) {
  return async (url, options) => {
    if (!stageCurrent(snap, survey)) throw new Error('Context changed');
    const response = await fetch(url, options);
    if (!stageCurrent(snap, survey)) throw new Error('Context changed');
    const data = await response.json();
    if (!stageCurrent(snap, survey)) throw new Error('Context changed');
    return { ok: response.ok, status: response.status, json: async () => data };
  };
}
async function refreshStageScreens(assessment, surveys = []) {
  const snap = stageSnapshot();
  if (!stageCurrent(snap)) return;
  const help = await loadRoleHelp({request: stageRequest(snap), token: snap.session, assessmentId: snap.aid, stage: assessment.stage});
  if (!stageCurrent(snap) || !help.visible) return;
  stageContext = { assessment, help, surveys };
  $('stage-workspace').hidden = false;
  const picker = $('stage-print-survey');
  resetSelect(picker, 'Choose survey');
  for (const survey of surveys) option(picker, survey.id, survey.template_name || survey.id);
  picker.value = state.survey || '';
  $('stage-print-tools').hidden = !printAllowed(help.role);
  $('stage-print-load').hidden = !printAllowed(help.role) || !state.survey;
  paintStageScreens();
}
function paintStageScreens(selected) {
  if (!stageContext || sharedMode) return;
  const { assessment, help } = stageContext;
  const tab = selected || recalledTab(sessionStorage, state.assessment, assessment.stage);
  renderStageTabs(document, $('stage-tabs-root'), {assessmentId:state.assessment, stage:assessment.stage, selected:tab, storage:sessionStorage, onSelect:next=>paintStageScreens(next)});
  renderStageTour(document, $('stage-tour-root'), {assessmentId:state.assessment, stage:tab, role:help.role, storage:sessionStorage, onDismiss:()=>paintStageScreens(tab)});
  // The displayed capability suggestion is valid only for the fetched stage.
  renderRoleHelp(document, $('stage-help-root'), tab === assessment.stage ? help : {...help, available:null});
}
function clearStagePrint() {
  stageGeneration++;
  $('stage-print-root').replaceChildren();
  $('stage-print-root').hidden = true;
  $('stage-print-survey').value = state.survey || '';
  $('stage-print-load').hidden = !stageContext || !printAllowed(stageContext.help.role) || !state.survey;
}
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
  if (!response.ok || !data.ok) throw Object.assign(new Error(`${data.error?.code || response.status}: ${data.error?.message || 'Request failed'}`), { code: data.error?.code || String(response.status), status: response.status }); // .code lets mounted modules classify refusals (Auditor R-A); message unchanged
  const li = document.createElement('li'); li.textContent = `${method} ${redactDiagnosticPath(url)} · ${data.capability || 'v2'} · ${data.receipt?.id || data.receipt?.receipt_id || 'read'} · ${data.trace_id || 'no trace'}`; $('events').prepend(li);
  return data.result;
}
async function run(label, task) {
  note(label); const buttons = [...document.querySelectorAll('button')].filter(b => b.id !== 'version' && b.id !== 'changelog-close'); buttons.forEach(b => b.disabled = true);
  try { await task(); note(`${label} — complete.`); }
  catch (error) { if (error instanceof HandledFailure) { $('notice').textContent = 'Action needs attention. No completion is assumed.'; $('error').textContent = ''; $('error').hidden = true; } else fail(error.message); }
  finally { buttons.forEach(b => b.disabled = b.id === 'release-codes' ? !state.confirmToken : b.id === 'issue-link-confirm' ? !state.linkConfirm : b.id === 'build-report' ? !state.reportConfirm : false); }
}
function showAuthorizedWork(me) {
  const visible = hasProjectWork(me);
  for (const id of ['project-card', 'assessment-card', 'survey-card', 'results-card']) $(id).hidden = !visible;
  // An assessment-only grantee reaches reports without any project navigation.
  const reports = hasReportWork(me);
  $('reports-card').hidden = !reports;
  // The granted picker is the assessment-only entry: a project identity reaches the same assessment
  // through the project path, so it never becomes a second source for state.assessment.
  $('shared-assessments').hidden = !hasSharedAssessmentEntry(me);
  const grantedBefore = $('granted-assessments').value; // identity re-observation (onGrantsChanged/onMutation) must not drop the selected granted assessment (Bugbot 4037753258)
  resetSelect($('granted-assessments'), 'Choose');
  for (const grant of assessmentGrants(me)) option($('granted-assessments'), grant.scope_id, `${grant.scope_id} · ${grant.role}`);
  if (grantedBefore && state.assessment === grantedBefore) $('granted-assessments').value = grantedBefore;
  $('create-project').hidden = !me.principal.provisioned;
  text($('access-state'), visible ? '' : 'No project access is assigned to this identity. Scoped project work is hidden.');
}
function resetClientIdentity() {
  collab.reset(); // W/I managers clear synchronously before any other identity work
  entityScreen?.reset(); lensSurveys?.reset();
  endInvitation();
  participantView?.destroy(); participantView = null;
  clearStageScreens();
  clearIdentityData(state, sessionStorage);
  clearCodeBatch(); clearShareLink(); // sign-out/sign-in: the once-shown link and confirm token never outlive the identity
  state.assessmentRole = null; clearReportState(); showReportControls();
  for (const id of ['project-card', 'assessment-card', 'survey-card', 'results-card', 'reports-card', 'shared-assessments']) $(id).hidden = true;
  $('create-project').hidden = true;
  resetSelect($('granted-assessments'), 'Choose'); text($('granted-detail'), '');
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
  collab.identity(result);
  return result;
}
async function projects() {
  const result = await api('/v2/projects'); resetSelect($('projects'), 'Choose project');
  collab.projects(result.projects);
  for (const p of result.projects || []) option($('projects'), p.id, `${p.name} · ${p.role}`);
  if (state.project) $('projects').value = state.project;
}
async function chooseProject() {
  clearStageScreens();
  state.project = $('projects').value || null; state.projectView = null; state.assessment = null; state.survey = null;
  clearCodeBatch(); clearShareLink();
  state.assessmentRole = null; clearReportState(); showReportControls();
  $('granted-assessments').value = ''; text($('granted-detail'), '');
  text($('project-detail'), ''); text($('assessment-detail'), ''); text($('survey-detail'), '');
  text($('results'), 'Select an assessment.');
  resetSelect($('assessments'), 'Choose assessment'); resetSelect($('surveys'), 'Choose survey');
  collab.setScope(null);
  if (!state.project) { const ws = collab.selectedWorkspace(); if (ws) collab.setScope({ type: 'workspace', id: ws.id, role: ws.role }); await languageControls.refresh(); return; } // leaving a project restores the still-selected workspace scope
  const result = await api(`/v2/projects/${path(state.project)}`);
  state.projectView = result.project;
  collab.setScope({ type: 'project', id: result.project.id, role: result.project.role });
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
  clearStageScreens();
  state.assessment = $('assessments').value || null; state.survey = null; resetSelect($('surveys'), 'Choose survey');
  clearCodeBatch(); clearShareLink();
  state.assessmentRole = null; clearReportState(); showReportControls();
  $('granted-assessments').value = ''; text($('granted-detail'), ''); // one state.assessment, exactly one visible source
  collab.setScope(null); // R2: downstream collaborator scope resets synchronously before any await
  lensSurveys?.reset();
  text($('assessment-detail'), ''); text($('survey-detail'), ''); text($('results'), 'Select an assessment.');
  if (!state.assessment) { if (state.projectView) collab.setScope({ type: 'project', id: state.projectView.id, role: state.projectView.role }); return; } // leaving an assessment restores the still-selected project scope (supplier a974903 intent)
  const stageRead = stageSnapshot();
  if (!state.templates) await templates(); // the lens catalogue must be loaded before the snapshot (Auditor P2 root cause)
  const result = await api(`/v2/assessments/${path(state.assessment)}`);
  if (!stageCurrent(stageRead)) return;
  state.assessmentRole = result.assessment.role; showReportControls();
  renderAssessmentHeadrow(document, $('assessment-context'), result.assessment);
  collab.setScope({ type: 'assessment', id: result.assessment.id, role: result.assessment.role });
  text($('assessment-detail'), `${result.assessment.name} · stage ${result.assessment.stage} · exact role ${result.assessment.role}`);
  const next = { prepare: 'collect', collect: 'understand', understand: 'improve', improve: 'understand' }[result.assessment.stage];
  if (next) $('stage-target').value = next;
  for (const survey of result.surveys || []) option($('surveys'), survey.id, `${survey.template_name} · ${survey.collection_status}`);
  lensSurveys?.set({ aid: result.assessment.id, role: result.assessment.role, stage: result.assessment.stage, surveys: result.surveys || [], templates: state.templates || [], canOpen: !$('survey-card').hidden });
  await refreshStageScreens(result.assessment, result.surveys || []);
}
async function templates() {
  const result = await api('/v2/templates'); resetSelect($('templates'), 'Choose current pinned template');
  state.templates = result.templates || [];
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
// Assessment-only entry: an exact assessment grant, authorized server-side, with no project navigation.
async function chooseGrantedAssessment() {
  clearStageScreens();
  state.assessment = $('granted-assessments').value || null; state.survey = null; state.assessmentRole = null;
  clearCodeBatch(); clearShareLink(); clearReportState(); showReportControls();
  $('assessments').value = ''; text($('assessment-detail'), ''); resetSelect($('surveys'), 'Choose survey');
  text($('survey-detail'), ''); text($('results'), 'Select an assessment.'); text($('granted-detail'), '');
  collab.setScope(null); lensSurveys?.reset(); entityScreen?.render(); // Bugbot 4037616728: the granted entry is an assessment selection too
  if (!state.assessment) { const ws = collab.selectedWorkspace(); if (ws) collab.setScope({ type: 'workspace', id: ws.id, role: ws.role }); return; } // empty direct-grant selection: explicit terminal restore of the selected workspace (transition matrix)
  try {
    const stageRead = stageSnapshot();
    if (!state.templates) await templates();
  const result = await api(`/v2/assessments/${path(state.assessment)}`);
  if (!stageCurrent(stageRead)) return;
    state.assessmentRole = result.assessment.role; showReportControls();
    renderAssessmentHeadrow(document, $('assessment-context'), result.assessment);
    collab.setScope({ type: 'assessment', id: result.assessment.id, role: result.assessment.role });
    text($('granted-detail'), `${result.assessment.name} · stage ${result.assessment.stage} · exact role ${result.assessment.role}`);
    for (const survey of result.surveys || []) option($('surveys'), survey.id, survey.template_name || survey.id);
    lensSurveys?.set({ aid: result.assessment.id, role: result.assessment.role, stage: result.assessment.stage, surveys: result.surveys || [], templates: state.templates || [], canOpen: !$('survey-card').hidden });
    entityScreen?.render();
    await refreshStageScreens(result.assessment, result.surveys || []);
  } catch (error) { state.assessmentRole = null; showReportControls(); clearReportState(); throw error; }
}
$('granted-assessments').addEventListener('change', () => run('Loading assessment…', chooseGrantedAssessment));
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
$('surveys').addEventListener('change', () => { state.survey = $('surveys').value || null; clearCodeBatch(); clearShareLink(); clearStagePrint(); });
$('stage-print-survey').addEventListener('change', () => {
  $('surveys').value = $('stage-print-survey').value;
  $('surveys').dispatchEvent(new Event('change'));
});
bindClick('stage-print-load', 'Loading blank form…', async () => {
  const snap = stageSnapshot();
  if (!stageContext || !stageCurrent(snap, true) || !snap.sid) return;
  $('stage-print-root').replaceChildren();
  const model = await loadBlankPrint({request:stageRequest(snap, true), token:snap.session, aid:snap.aid, sid:snap.sid, role:stageContext.help.role});
  if (!stageCurrent(snap, true)) return;
  renderBlankPrint(document, $('stage-print-root'), model);
});
async function surveyStatus() {
  clearStagePrint();
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
// Reports. Nothing here is cached: the pending confirmation, the list cursor and the opened report
// are page-memory only and are cleared on every identity, project or assessment change.
// The pending confirmation and its expiry timer are page memory only.
function dropReportConfirm() { if (state.reportConfirm?.timer) clearTimeout(state.reportConfirm.timer); state.reportConfirm = null; }
function clearReportState() {
  dropReportConfirm(); state.reportCursor = null;
  $('report-view').replaceChildren(); $('report-view').hidden = true;
  $('report-list').replaceChildren();
  text($('report-preview'), ''); text($('report-status'), '');
  $('load-more-reports').hidden = true;
  $('build-report').disabled = true;
}
function showReportControls() {
  const mayBuild = state.assessmentRole === 'owner' || state.assessmentRole === 'member';
  $('preview-report').hidden = !mayBuild; $('build-report').hidden = !mayBuild;
  // Auditor P2: a viewer's write controls on the survey card always 403 at the server; gate them on the same exact
  // assessment role the report controls use. Reads (survey-status, refresh-counts, blank print) stay. No backend change.
  for (const id of ['issue-codes', 'code-count', 'preview-export', 'release-codes', 'issue-link-preview', 'issue-link-confirm', 'select-survey', 'load-templates']) { const n = $(id); if (n) n.hidden = !mayBuild; }
}
function reportRoute() { return `/v2/assessments/${path(required(state.assessment, 'Choose an assessment.'))}/reports`; }
// Any failure inside a report action leaves no half-state behind; run()/fail() still shows the API message.
function reportAction(id, label, handler) { bindClick(id, label, async () => { try { await handler(); } catch (error) { clearReportState(); throw error; } }); }
function openReports(reports) {
  renderList({ doc: document, list: $('report-list'), reports, onOpen: id => run('Opening report…', () => openReport(id)) });
}
async function openReport(id) {
  try {
    const result = await api(`/v2/reports/${path(id)}`);
    if (result.suppressed) { clearReportState(); text($('report-status'), result.reason); return; }
    renderReport({ doc: document, root: $('report-view'), report: result.report });
    $('report-view').hidden = false;
    text($('report-status'), '');
  } catch (error) { clearReportState(); throw error; }
}
reportAction('preview-report', 'Previewing report build…', async () => {
  const result = await api(reportRoute(), { method: 'POST', body: { mode: 'dry_run' } });
  dropReportConfirm();
  $('build-report').disabled = true;
  // Held: the whole block is cleared first, so a reason never sits beside a report opened earlier.
  if (result.suppressed) { clearReportState(); text($('report-preview'), `${result.reason} No report will be built.`); return; }
  text($('report-preview'), `Building a report makes this assessment's synthetic results visible to everyone with access to it. Nothing is built until you choose Build report. This confirmation expires in ${result.expires_in} seconds.`);
  const timer = setTimeout(() => { dropReportConfirm(); $('build-report').disabled = true; }, Number(result.expires_in) * 1000);
  state.reportConfirm = { token: result.confirm_token, expiresAt: Date.now() + Number(result.expires_in) * 1000, timer };
  $('build-report').disabled = false;
});
reportAction('build-report', 'Building report…', async () => {
  const confirm_token = required(state.reportConfirm, 'Preview the report again.').token;
  dropReportConfirm(); $('build-report').disabled = true; text($('report-preview'), '');
  const result = await api(reportRoute(), { method: 'POST', body: { mode: 'execute', confirm_token } });
  if (result.suppressed) { clearReportState(); text($('report-status'), result.reason); return; }
  upsertRow({ doc: document, list: $('report-list'), report: { id: result.report.id, created_at: result.report.created_at }, onOpen: id => run('Opening report…', () => openReport(id)) });
  await openReport(result.report.id);
});
async function listReports() {
  const result = await api(reportRoute());
  if (result.suppressed) { clearReportState(); text($('report-status'), result.reason); return; }
  openReports(result.reports || []);
  state.reportCursor = typeof result.next_cursor === 'string' ? result.next_cursor : null;
  $('load-more-reports').hidden = !state.reportCursor;
  text($('report-status'), (result.reports || []).length ? '' : 'No reports have been built for this assessment.');
}
reportAction('refresh-reports', 'Loading reports…', listReports);
// Load more already has a page: a failed next page must stop paging, not wipe the list via reportAction.
bindClick('load-more-reports', 'Loading more reports…', async () => {
  const cursor = required(state.reportCursor, 'Refresh reports first.');
  let result;
  try { result = await api(`${reportRoute()}?cursor=${path(cursor)}`); }
  catch (error) { state.reportCursor = null; $('load-more-reports').hidden = true; throw error; }
  if (result.suppressed) { clearReportState(); text($('report-status'), result.reason); return; }
  const holder = document.createElement('ol');
  renderList({ doc: document, list: holder, reports: result.reports || [], onOpen: id => run('Opening report…', () => openReport(id)) });
  for (const row of [...holder.children]) $('report-list').append(row);
  state.reportCursor = typeof result.next_cursor === 'string' ? result.next_cursor : null;
  $('load-more-reports').hidden = !state.reportCursor;
});
showReportControls(); // no assessment is chosen at load, so the build path starts hidden
bindForm('redeem', 'Redeeming access code…', async fd => {
  text($('participant-error'), ''); $('participant-error').hidden = true;
  await redeemAndOpen(
    () => api('/v2/participate/code', { method: 'POST', body: { code: String(fd.get('code')).trim() } }),
    result => {
    state.participant = result.participant_token; sessionStorage.setItem('participantToken', state.participant);
    participantView?.destroy(); participantView = null;
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
  participantView?.destroy(); participantView = null;
  $('questions').replaceChildren(...result.items.map(drawQuestion)); $('answers').hidden = false; $('review').hidden = true; $('receipt').hidden = true; $('recover').hidden = false;
  if (state.shared) restoreSharedDraft();
  participantView = mountParticipantView({doc:document, root:$('participant-view-root'), form:$('answers'), questions:$('questions'), review:$('review'), reviewAnswers:$('review-answers'), receipt:$('receipt'), context:$('form-context'), model:result, reviewButton:$('participant-review-original'), onEdit:()=>{ $('answers').hidden=false; $('review').hidden=true; }});
  if (state.shared && state.sharedStore.get('draft')) participantView.showForm();
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
  participantView?.showReview();
});
$('edit').addEventListener('click', () => { $('answers').hidden = false; $('review').hidden = true; participantView?.showForm(); });
bindClick('submit', 'Submitting response…', async () => {
  required(state.answers, 'Review answers first.');
  if (state.shared) { // scoped namespace only; the global responseKey is never touched in this mode
    let result;
    try { result = await state.shared.submit(state.answers); }
    catch (error) {
      // Diagnostics stay in the console; nothing raw reaches the page (no #events in shared mode, never fail()).
      console.warn('[3dr] submit', { status: error?.status, code: error?.code, trace_id: error?.trace_id });
      const kind = submitFailureKind(error);
      const uncertain = () => { submitState = 'uncertain'; text($('participant-resume'), sharedCopy.submitUncertain); };
      if (kind === 'uncertain') uncertain();
      else if (kind === 'conflict') {
        const resolved = await resolveConflict(state.shared);
        if (resolved.state === 'receipt') { state.sharedStore.remove('draft'); state.sharedStore.remove('submitKey'); showReceipt(resolved.receipt); return; }
        if (resolved.state === 'rateLimited' || resolved.state === 'transient') uncertain(); // the probe's wording is not the answers' outcome: unknown means uncertain (auditor F5)
        else showSharedUnavailable(resolved.state);
      }
      else if (kind === 'unavailable') showSharedUnavailable(submitState === 'uncertain' ? 'cannotResume' : 'unavailable');
      else { // rejected: this request committed nothing, but an earlier uncertain one may have — ask the receipt before saying "not submitted"
        let receipt;
        try { receipt = await state.shared.receipt(); }
        catch (probeError) {
          if (errorKind(probeError) === 'unavailable') showSharedUnavailable(submitState === 'uncertain' ? 'cannotResume' : 'unavailable');
          else uncertain();
          throw new HandledFailure();
        }
        if (receipt.submitted) { state.sharedStore.remove('draft'); state.sharedStore.remove('submitKey'); showReceipt(receipt); return; }
        if (submitState === 'none') text($('participant-resume'), sharedCopy.submitFailed); else uncertain();
      }
      throw new HandledFailure();
    }
    showReceipt(result); return;
  }
  if (!state.responseKey) { state.responseKey = crypto.randomUUID(); sessionStorage.setItem('responseKey', state.responseKey); }
  const result = await api('/v2/participate/responses', { method: 'POST', participant: true, body: { answers: state.answers, idempotency_key: state.responseKey } });
  showReceipt(result);
  state.responseKey = null; sessionStorage.removeItem('responseKey');
});
function showReceipt(result) {
  // Existing uncertainty contract: while a submit outcome is unknown, a submitted:false receipt neither
  // contradicts the uncertain copy nor clears it (same fact, same outcome on the Submit and Recover paths).
  if (result.submitted === false && submitState === 'uncertain') return;
  clearParticipantError();
  text($('receipt'), result.submitted === false ? 'No submission recorded yet.' : `Response saved · ${result.response_id || 'ID unavailable'} · ${result.submitted_at || 'time unavailable'}`);
  text($('participant-resume'), resumeNoticeAfterReceipt(result, $('participant-resume').textContent));
  $('receipt').hidden = false;
  if (result.submitted !== false) { $('review').hidden = true; $('answers').hidden = true; participantView?.showReceipt(); }
  if (state.shared && result.submitted !== false) text($('participant-resume'), `${sharedCopy.receiptThanks} ${sharedCopy.sameLinkOthers}`);
}
bindClick('recover', 'Recovering receipt…', async () => {
  let receipt;
  if (state.shared) { // shared route: a refused probe shows participant copy, never raw server text in #error
    try { receipt = await state.shared.receipt(); }
    catch (error) {
      console.warn('[3dr] recover', { status: error?.status, code: error?.code, trace_id: error?.trace_id });
      const kind = errorKind(error);
      if (kind === 'unavailable') showSharedUnavailable(submitState === 'uncertain' ? 'cannotResume' : 'unavailable');
      else if (submitState === 'uncertain') text($('participant-resume'), sharedCopy.submitUncertain); // keep the uncertainty; the form stays
      else text($('participant-resume'), kind === 'rateLimited' ? sharedCopy.rateLimited : sharedCopy.transient); // live form: a probe blip is not a revoked session
      throw new HandledFailure();
    }
  } else receipt = await api('/v2/participate/receipt', { participant: true });
  await recoverParticipant(receipt, !!state.form, loadForm, showReceipt);
  if (!receipt.submitted && state.shared && submitState === 'uncertain') throw new HandledFailure(); // no "— complete." beside kept uncertainty
  if (!receipt.submitted) return;
  if (state.shared) { state.sharedStore.remove('draft'); state.sharedStore.remove('submitKey'); } // scoped namespace only; globals untouched in shared mode
  else { state.responseKey = null; sessionStorage.removeItem('responseKey'); }
});
// Return leg of Cloudflare email-code sign-in: /v2/auth/access hands the session back in the URL fragment.
{ const m = location.hash.match(/^#session=([A-Za-z0-9_]+)$/); if (m) { resetClientIdentity(); state.session = m[1]; sessionStorage.setItem('facilitatorToken', m[1]); history.replaceState(null, '', location.pathname); text($('identity'), 'Checking session…'); } }
function showSharedUnavailable(kind) {
  const message = { closed: sharedCopy.collectionClosed, cannotResume: sharedCopy.cannotResume, rateLimited: sharedCopy.rateLimited, transient: sharedCopy.transient }[kind] || sharedCopy.linkUnavailable;
  text($('participant-error'), message); $('participant-error').hidden = false;
  text($('participant-resume'), ''); // terminal copy replaces any sticky retry instruction
  $('answers').hidden = true; $('review').hidden = true; $('recover').hidden = true; participantView?.showReceipt();
}
async function sharedLinkEntry(token, namespace) {
  $('facilitator').hidden = true; $('evidence').remove(); document.querySelector('aside').hidden = true; $('participant-arrival').hidden = true; $('participant-code-guidance').hidden = true; // arrival and code guidance are for the legacy code path only (explicit targets: Bugbot 4036816500); evidence is removed, not hidden: no trace/receipt text exists on the shared route
  for (const el of $('redeem').querySelectorAll('label,button')) el.hidden = true; // code entry hidden; the alert slot stays
  namespace = namespace || await digestNamespace(token);
  state.sharedStore = scopedStorage(sessionStorage, namespace);
  rememberCurrent(sessionStorage, namespace); // digest only; the raw token is never persisted
  state.shared = createSharedLinkClient({ store: state.sharedStore }); // no onEvent: nothing is ever written to #events in shared mode
  try {
    // With a fragment: open (resume_token when this namespace holds a bearer). Without one (reload):
    // the raw token is not persisted, so resume goes straight to the receipt with the stored bearer.
    const resuming = !!state.shared.bearer; // a stored bearer means open() sends resume_token
    if (token !== null) {
      try { await state.shared.open(token); }
      catch (error) { const kind = entryFailureKind(error, resuming); if (kind !== 'conflict') { showSharedUnavailable(kind); return; } throw error; } // no automatic fresh open; scoped storage untouched
    } else if (!state.shared.bearer) { showSharedUnavailable('unavailable'); return; }
    let receipt;
    try { receipt = await state.shared.receipt(); } // receipt is checked before any editable form
    catch (error) { // R-15: a refused probe on the no-fragment resume path is cannot-resume; raw server text never reaches #error
      if (token === null && entryFailureKind(error, true) === 'cannotResume') { showSharedUnavailable('cannotResume'); return; }
      throw error;
    }
    $('recover').hidden = false;
    if (resumeTarget(receipt) === 'receipt') showReceipt(receipt); else await loadForm();
  } catch (error) {
    const kind = errorKind(error);
    if (kind === 'conflict') { const resolved = await resolveConflict(state.shared); if (resolved.state === 'receipt') { $('recover').hidden = false; showReceipt(resolved.receipt); return; } showSharedUnavailable(resolved.state); return; }
    showSharedUnavailable(kind);
    throw new HandledFailure(); // participant copy already shown; run() must not paint the raw error
  }
}
async function openPendingInvitation(generation) {
  if (generation !== invitationGeneration) return;
  if (pendingInvitation && document.body.dataset.invitationIntent === 'active') {
    if (state.principal?.kind === 'user') {
      const token = pendingInvitation; pendingInvitation = null;
      if (!await collab.openAcceptance(token, () => generation === invitationGeneration)) { if (generation !== invitationGeneration) return; endInvitation(); throw new Error('Invitation could not be opened. Reopen the invitation link after checking your sign-in and access.'); }
    } else {
      // Deliberately no persisted invitation credential or altered Access callback.
      pendingInvitation = null;
      const note = document.createElement('div'); note.id = 'invitation-entry-notice';
      const message = document.createElement('p');
      message.textContent = state.principal ? 'Sign in as the invited person, then reopen the invitation link.' : 'Sign in with the email address that was invited. After signing in, reopen the invitation link to review and accept it.';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel invitation'; cancel.addEventListener('click', endInvitation);
      note.append(message, cancel); $('facilitator').prepend(note);
      $('signin-panel').querySelector('a[href="/v2/auth/access"]')?.focus();
    }
  }
}
const invitationBootstrap = sharedMode ? run(sharedCopy.labelOpening, () => sharedLinkEntry(sharedToken, sharedResume))
: run('Checking session…', async () => {
  try { const me = await identity(); if (me && hasProjectWork(me)) { await projects(); await templates(); } }
  catch { state.session = null; state.principal = null; sessionStorage.removeItem('facilitatorToken'); text($('identity'), 'Not signed in'); }
  await openPendingInvitation(invitationGeneration);
  if (state.participant) await restoreParticipant();
});
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#invite=')) {
    // A participant bootstrap is isolated and cannot become staff by changing a hash.
    // Reload the actual invite URL to select the staff bootstrap; fragments never go to the server.
    if (sharedMode) { location.reload(); return; }
    const token = parseInvitationFragment(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    collab.clearAcceptance(); endInvitation();
    if (!token) return;
    pendingInvitation = token; document.body.dataset.invitationIntent = 'active'; document.body.dataset.invitationEntry = 'true'; // same-tab invite arrival is isolated from here on, like a page load (Bugbot 4039886032)
    const generation = invitationGeneration;
    void run('Opening invitation…', async () => { await invitationBootstrap; await openPendingInvitation(generation); });
    return;
  }
  // Staff navigation anchors do not cancel an invitation preview or confirmation.
  if (document.body.dataset.invitationIntent === 'active' && !['', '#facilitator', '#workspace', '#reports-card'].includes(location.hash)) { collab.clearAcceptance(); endInvitation(); }
});
