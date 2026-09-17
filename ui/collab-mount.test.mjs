import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=n=>readFileSync(fileURLToPath(new URL(n,import.meta.url)),'utf8');
const html=read('./index.html'), app=read('./app.js'), server=read('./server.mjs');

test('mount roots and the acceptance entry live inside #facilitator, after the current task, hidden until a staff identity is observed',()=>{
  const fac=html.slice(html.indexOf('<section id="facilitator"'),html.indexOf('<section id="participant"'));
  const i=id=>fac.indexOf(`id="${id}"`);
  assert.ok(i('overview')<i('assessment-context')&&i('assessment-context')<i('stage-workspace'));
  assert.ok(i('stage-workspace')<i('project-card')&&i('project-card')<i('collab'));
  assert.ok(i('reports-card')<i('collab')&&i('assessment-card')<i('collab'),'secondary collaborators follow the task in keyboard DOM order');
  assert.ok(fac.includes('<button id="accept-invitation" class="rv-btn quiet" type="button" hidden>Accept an invitation</button>'));
  assert.ok(fac.includes('<section id="workspace-manager-root" class="glass panel" hidden></section>'));
  assert.ok(fac.includes('<section id="scope-invitations-root" class="glass panel" hidden></section>'));
  assert.ok(i('accept-invitation')<i('workspace-manager-root'),'acceptance entry is outside and before the member-gated managers');
});

test('assets are allowlisted and module tests are not shipped',()=>{
  for(const a of ['/collab-mount.js','/workspace-manager.js','/workspace-manager.css','/scope-invitations.js','/scope-invitations.css'])assert.ok(server.includes(`'${a}':`),a);
  for(const a of ['/workspace-manager.css','/scope-invitations.css'])assert.ok(html.includes(`<link rel="stylesheet" href="${a}">`),a);
  assert.ok(read('./.assetsignore').split('\n').includes('collab-mount.test.mjs'));
});

test('app.js lifecycle: reset first on identity change; identity/projects snapshots; exact singular scope with returned role; never in shared mode',()=>{
  assert.ok(app.includes("function resetClientIdentity() {\n  collab.reset();"),'reset() is the first statement of resetClientIdentity');
  assert.ok(app.includes("showAuthorizedWork(result);\n  collab.identity(result);"));
  assert.ok(app.includes("collab.projects(result.projects);"));
  assert.ok(app.includes("collab.setScope({ type: 'project', id: result.project.id, role: result.project.role });"));
  assert.ok(app.includes("collab.setScope({ type: 'assessment', id: result.assessment.id, role: result.assessment.role });"));
  assert.ok(app.includes("if (state.projectView) collab.setScope({ type: 'project', id: state.projectView.id, role: state.projectView.role });"),'leaving an assessment restores the still-selected project');
  assert.ok(app.includes("if (ws) collab.setScope({ type: 'workspace', id: ws.id, role: ws.role })"),'leaving a project restores the still-selected workspace');
  assert.ok(app.includes("createCollabHooks({ document, api, sharedMode,"));
  const mount=read('./collab-mount.js');
  assert.ok(mount.includes("if (sharedMode || !wRoot || !iRoot) return {"),'no-op on shared/participant routes');
  assert.ok(mount.includes("else if (currentScope?.type === 'workspace') { currentScope = null; invitations.reset(); }"),'workspace deselect clears only a workspace scope (Bugbot 4037616741)');
  assert.ok(mount.includes('if (staff && refreshedGeneration !== snapshot.generation) {'),'W list is read once per identity generation, never on reloads');
  assert.ok(mount.includes('if (!selectedWorkspace) await workspaces.refresh()'),'invitation accept re-reads W when none is selected');
  assert.ok(!/projects\(list\) \{[^}]*workspaces\.refresh/.test(mount),'projects() never refreshes W');
  assert.ok(mount.includes('if (!currentScope) invitations.setScope(null);'),'identity re-observation keeps a current host scope');
  assert.ok(mount.includes("if (ws) { onWorkspaceOpened(); currentScope = { type: 'workspace', id: ws.id, role: ws.role }; invitations.setScope(currentScope); } else if (currentScope?.type === 'workspace')"),'explicit workspace Open resets downstream before painting; null callback stays passive (Auditor c5716400828)');
  { const a=read('./app.js'); assert.ok(a.includes('onWorkspaceOpened: () => clearEntitySelection() });'),'explicit Open uses the side-effect-free clear');
    const body=a.slice(a.indexOf('function clearEntitySelection()'),a.indexOf('\n}\n',a.indexOf('function clearEntitySelection()')));
    assert.ok(!/dispatchEvent|await |api\(|run\(/.test(body),'clearEntitySelection dispatches no change events, awaits nothing, fetches nothing (Bugbot 4038374305)');
    for (const must of ["state.project = null","state.assessment = null","state.survey = null","$('projects').value = ''","resetSelect($('assessments'), 'Choose assessment')","resetSelect($('surveys'), 'Choose survey')","lensSurveys?.reset()","clearReportState()","clearCodeBatch()","clearShareLink()","clearStageScreens()","text($('notice'), '')","text($('error'), ''); $('error').hidden = true","languageControls.refresh()","$('stage-target').value = ''","$('create-assessment').reset()","$('create-language').reset()","text($('project-detail'), '')","text($('assessment-detail'), '')","text($('survey-detail'), '')"]) assert.ok(body.includes(must),must);
    // inventory: every per-entity display node that resetClientIdentity clears (minus identity-only nodes) is cleared here too
    const identityReset=a.slice(a.indexOf('function resetClientIdentity()'),a.indexOf('\n}\n',a.indexOf('function resetClientIdentity()')));
    for (const id of ['project-detail','assessment-detail','survey-detail','create-assessment','create-language','language-status']) assert.ok(identityReset.includes(id),'inventory source has '+id);
    assert.ok(read('./language.js').includes("if (!pid) {\n      status.textContent = 'Choose a project to list its languages.';"),'languages refresh with no project clears select+status without a fetch'); }
  assert.ok(mount.includes('onGrantsChanged: async () => { await onReload(); if (!selectedWorkspace) await workspaces.refresh(); }'),'accepted workspace invitation reaches the W list (Bugbot 4037957668)');
  assert.ok(!mount.includes("selectedWorkspace ? { type: 'workspace'"),'setScope(null) is a plain reset: no generic workspace fallback during prefetch resets (Bugbot 4038131213)');
  assert.ok(mount.includes("setScope(scope) { if (scope) onAcceptanceEnded(); currentScope = scope ? { type: scope.type, id: scope.id, role: scope.role } : null; if (currentScope) invitations.setScope(currentScope); else invitations.reset(); }"));
  { const a=read('./app.js'); const i=a.indexOf('async function chooseProject'); const body=a.slice(i,a.indexOf('async function assessments'));
    assert.ok(body.includes("if (!state.project) { const ws = collab.selectedWorkspace(); if (ws) collab.setScope({ type: 'workspace', id: ws.id, role: ws.role });"),'explicit empty-project restore stays');
    assert.ok(body.indexOf('collab.setScope(null);')<body.indexOf('if (!state.project)'),'prefetch reset precedes the explicit restore');
    for (const fn of ['chooseAssessment','chooseGrantedAssessment']) { const j=a.indexOf('async function '+fn); const b=a.slice(j,a.indexOf('\n}\n',j)); assert.ok(b.includes('collab.setScope(null)'),fn+' resets before its await'); const after=b.slice(b.indexOf('await api(')); assert.ok(!after.includes("type: 'workspace'"),fn+' never paints a workspace scope on a non-empty load'); }
    { const j=a.indexOf('async function chooseGrantedAssessment'); const b=a.slice(j,a.indexOf('\n}\n',j)); assert.ok(b.includes("if (!state.assessment) { const ws = collab.selectedWorkspace(); if (ws) collab.setScope({ type: 'workspace', id: ws.id, role: ws.role }); return; }"),'empty direct-grant selection restores the selected workspace explicitly'); } }
  const app2=read('./app.js');
  assert.ok(app2.includes("for (const id of ['issue-codes', 'code-count', 'preview-export', 'release-codes', 'issue-link-preview', 'issue-link-confirm', 'select-survey', 'load-templates']) { const n = $(id); if (n) n.hidden = !mayBuild; }"),'viewer write controls gated on assessmentRole (Auditor P2)');
  assert.ok(!/sessionStorage|localStorage|facilitatorToken/.test(mount),'hooks never touch token storage');
});

test('invitation handoff awaits initial workspace settlement and rejects reset or principal replacement',async()=>{
 const factory=new Function('mountWorkspaceManager','mountScopeInvitations',read('./collab-mount.js').replace(/^import .*;\n/gm,'').replace('export function createCollabHooks','function createCollabHooks')+'\nreturn createCollabHooks;');
 for(const ending of ['complete','reset','replace']){
  let release;const wait=new Promise(r=>release=r),opened=[];const doc={body:{dataset:{invitationIntent:'active'}},getElementById:()=>({addEventListener(){},hidden:false})};
  const hooks=factory(()=>({refresh:()=>wait,reset(){},destroy(){}}),()=>({setScope(){},reset(){},destroy(){},openAcceptance:t=>opened.push(t)}))({document:doc,api:async()=>({}),sharedMode:false,onReload:async()=>{}});
  hooks.identity({principal:{id:'first',kind:'user'}});const pending=hooks.openAcceptance('PRIVATE_SENTINEL');await Promise.resolve();assert.deepEqual(opened,[]);
  if(ending==='reset')hooks.reset();if(ending==='replace')hooks.identity({principal:{id:'second',kind:'user'}});
  release();assert.equal(await pending,ending==='complete');assert.deepEqual(opened,ending==='complete'?['PRIVATE_SENTINEL']:[]);
 }
});
test('failed initial workspace request blocks invitation handoff despite module catching its own error',async()=>{
 const factory=new Function('mountWorkspaceManager','mountScopeInvitations',read('./collab-mount.js').replace(/^import .*;\n/gm,'').replace('export function createCollabHooks','function createCollabHooks')+'\nreturn createCollabHooks;');
 let opens=0;const doc={body:{dataset:{invitationIntent:'active'}},getElementById:()=>({addEventListener(){}})};
 const hooks=factory(({request})=>({refresh:async()=>{try{await request('/v2/workspaces')}catch{}},reset(){},destroy(){}}),()=>({setScope(){},reset(){},destroy(){},openAcceptance(){opens++}}))({document:doc,api:async()=>{throw Error('refused')},sharedMode:false,onReload:async()=>{}});
 hooks.identity({principal:{id:'person',kind:'user'}});assert.equal(await hooks.openAcceptance('PRIVATE'),false);assert.equal(opens,0);
});

test('openAcceptance re-reads the workspace list after a failed first read instead of latching (Bugbot 4039886042)',()=>{
  const mount=read('./collab-mount.js');
  assert.ok(mount.includes("if (workspaceReadFailed) { workspaceReadFailed = false; readiness = workspaces.refresh().catch(() => {}); await readiness; if (!current()) return false; }"),'one re-read per attempt');
  assert.ok(mount.includes('if (workspaceReadFailed) return false;'),'only a failure of THIS read refuses the handoff');
  const app=read('./app.js');
  assert.ok(app.includes("document.body.dataset.invitationEntry = 'true'"),'invite entry isolation flag set for the page lifetime');
  assert.ok(!/delete document\.body\.dataset\.invitationEntry/.test(app),'the isolation flag is never cleared');
  assert.ok(!/removeItem\('participantToken'\)[^\n]*invit/.test(app),'storage is not deleted by the invite path');
});
