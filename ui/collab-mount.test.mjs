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
  assert.ok(app.includes("createCollabHooks({ document, api, sharedMode,"));
  const mount=read('./collab-mount.js');
  assert.ok(mount.includes("if (sharedMode || !wRoot || !iRoot) return {"),'no-op on shared/participant routes');
  assert.ok(mount.includes("else if (currentScope?.type === 'workspace') { currentScope = null; invitations.reset(); }"),'workspace deselect clears only a workspace scope (Bugbot 4037616741)');
  assert.ok(mount.includes('if (staff && refreshedGeneration !== snapshot.generation) {'),'W list is read once per identity generation, never on reloads');
  assert.ok(!/projects\(list\) \{[^}]*workspaces\.refresh/.test(mount),'projects() never refreshes W');
  assert.ok(mount.includes('if (!currentScope) invitations.setScope(null);'),'identity re-observation keeps a current host scope');
  assert.ok(!/sessionStorage|localStorage|facilitatorToken/.test(mount),'hooks never touch token storage');
});
