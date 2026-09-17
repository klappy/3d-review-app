import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=n=>readFileSync(fileURLToPath(new URL(n,import.meta.url)),'utf8');
const html=read('./index.html'), app=read('./app.js'), server=read('./server.mjs');

test('mount roots and the acceptance entry live inside #facilitator, above the project card, hidden until a staff identity is observed',()=>{
  const fac=html.slice(html.indexOf('<section id="facilitator"'),html.indexOf('<section id="participant"'));
  const i=id=>fac.indexOf(`id="${id}"`);
  assert.ok(i('overview')<i('collab')&&i('collab')<i('project-card'));
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
  assert.ok(read('./app.js').includes("onWorkspaceOpened: () => { for (const id of ['surveys', 'assessments', 'granted-assessments', 'projects'])"),'downstream reset goes through the existing selects');
  assert.ok(mount.includes('onGrantsChanged: async () => { await onReload(); if (!selectedWorkspace) await workspaces.refresh(); }'),'accepted workspace invitation reaches the W list (Bugbot 4037957668)');
  assert.ok(!mount.includes("selectedWorkspace ? { type: 'workspace'"),'setScope(null) is a plain reset: no generic workspace fallback during prefetch resets (Bugbot 4038131213)');
  assert.ok(mount.includes("setScope(scope) { currentScope = scope ? { type: scope.type, id: scope.id, role: scope.role } : null; if (currentScope) invitations.setScope(currentScope); else invitations.reset(); }"));
  { const a=read('./app.js'); const i=a.indexOf('async function chooseProject'); const body=a.slice(i,a.indexOf('async function assessments'));
    assert.ok(body.includes("if (!state.project) { const ws = collab.selectedWorkspace(); if (ws) collab.setScope({ type: 'workspace', id: ws.id, role: ws.role });"),'explicit empty-project restore stays');
    assert.ok(body.indexOf('collab.setScope(null);')<body.indexOf('if (!state.project)'),'prefetch reset precedes the explicit restore');
    for (const fn of ['chooseAssessment','chooseGrantedAssessment']) { const j=a.indexOf('async function '+fn); const b=a.slice(j,a.indexOf('\n}\n',j)); assert.ok(b.includes('collab.setScope(null)'),fn+' resets before its await'); const after=b.slice(b.indexOf('await api(')); assert.ok(!after.includes("type: 'workspace'"),fn+' never paints a workspace scope on a non-empty load'); }
    { const j=a.indexOf('async function chooseGrantedAssessment'); const b=a.slice(j,a.indexOf('\n}\n',j)); assert.ok(b.includes("if (!state.assessment) { const ws = collab.selectedWorkspace(); if (ws) collab.setScope({ type: 'workspace', id: ws.id, role: ws.role }); return; }"),'empty direct-grant selection restores the selected workspace explicitly'); } }
  const app2=read('./app.js');
  assert.ok(app2.includes("for (const id of ['issue-codes', 'code-count', 'preview-export', 'release-codes', 'issue-link-preview', 'issue-link-confirm', 'select-survey', 'load-templates']) { const n = $(id); if (n) n.hidden = !mayBuild; }"),'viewer write controls gated on assessmentRole (Auditor P2)');
  assert.ok(!/sessionStorage|localStorage|facilitatorToken/.test(mount),'hooks never touch token storage');
});
