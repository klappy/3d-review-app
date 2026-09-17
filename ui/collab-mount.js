// NativeDesign common hooks for the W (workspace-manager) and I (scope-invitations) modules.
// Contracts: cookbook #16 c5714752335 (W) and c5714786175 (I). This file owns adapters, lifecycle and
// placement only; it never grants, never stores credentials and never mounts on shared/participant routes.
import { mountWorkspaceManager } from './workspace-manager.js';
import { mountScopeInvitations } from './scope-invitations.js';

export function createCollabHooks({ document: doc, api, sharedMode, onReload, onWorkspaceOpened = () => {}, onAcceptanceEnded = () => {} }) {
  const wRoot = doc.getElementById('workspace-manager-root');
  const iRoot = doc.getElementById('scope-invitations-root');
  const acceptButton = doc.getElementById('accept-invitation');
  if (sharedMode || !wRoot || !iRoot) return { reset() {}, identity() {}, projects() {}, setScope() {}, destroy() {}, selectedWorkspace() { return null; }, isStaff() { return false; }, async openAcceptance() { return false; }, backToWorkspaces() {} };

  // Immutable per-identity snapshot; `generation` changes on every identity reset so stale async work is discarded.
  const snapshot = { generation: 0, principal: null, authorizedProjects: [] };
  let readiness = Promise.resolve(), workspaceReadFailed = false;
  const request = async (path, { method = 'GET', body } = {}) => {
    const generation = snapshot.generation;
    try { return await api(path, { method, body }); }
    catch (error) { if (generation === snapshot.generation && path === '/v2/workspaces') workspaceReadFailed = true; throw error; }
  }; // existing envelope adapter; accept path is redacted before #events
  const getContext = () => ({
    principalId: snapshot.principal?.id ?? null, kind: snapshot.principal?.kind ?? null, generation: snapshot.generation,
    shared: false, participant: false, provisioned: !!snapshot.principal?.provisioned,
    authorizedProjects: snapshot.authorizedProjects.map(p => ({ id: p.id, name: p.name, role: p.role })),
  });
  let invitations = null, workspaces = null, selectedWorkspace = null, currentScope = null, refreshedGeneration = -1;
  // Bugbot 4037957668: an accepted WORKSPACE invitation must reach the list; the W list is re-read after the identity
  // reload unless a workspace is currently selected (a nested refresh would throw that selection away, Bugbot 4037616741).
  invitations = mountScopeInvitations({ document: doc, root: iRoot, request, getContext, onAcceptanceEnded, onGrantsChanged: async () => { await onReload(); if (!selectedWorkspace) await workspaces.refresh(); } });
  workspaces = mountWorkspaceManager({
    document: doc, root: wRoot, request, getContext,
    // A null workspace (deselect/refresh/deletion) only clears a WORKSPACE scope; a project/assessment scope is untouched (Bugbot 4037616741).
    // Explicit workspace Open/create (non-null): the workspace becomes the ONE selected entity, so the downstream
    // project/assessment/survey selections are cleared through the host's own selects BEFORE the workspace scope is
    // painted (Auditor amend c5716400828). A null callback is passive (list refresh/deselect/deletion): it clears only a
    // workspace scope and never touches child selections (Bugbot 4037616741 / 4038131213 stay honoured).
    onWorkspaceSelected: ws => { selectedWorkspace = ws ? { id: ws.id, role: ws.role } : null; if (ws) { onWorkspaceOpened(); currentScope = { type: 'workspace', id: ws.id, role: ws.role }; invitations.setScope(currentScope); } else if (currentScope?.type === 'workspace') { currentScope = null; invitations.reset(); } },
    onMutation: () => onReload(),
  });
  acceptButton?.addEventListener('click', () => invitations.openAcceptance());

  return {
    // Identity change: synchronous reset of both modules before any other async work.
    // Both modules own their root's hidden flag; the hooks only drive lifecycle and the snapshot.
    reset() { snapshot.generation += 1; readiness = Promise.resolve(); workspaceReadFailed = false; snapshot.principal = null; snapshot.authorizedProjects = []; selectedWorkspace = null; currentScope = null; invitations.reset(); workspaces.reset(); if (acceptButton) acceptButton.hidden = true; },
    clearAcceptance() { invitations.reset(); },
    async openAcceptance(token, isCurrent = () => true) {
      const generation = snapshot.generation, principal = snapshot.principal?.id;
      if (!principal || snapshot.principal.kind !== 'user' || doc.body.dataset.invitationIntent !== 'active') return false;
      await readiness;
      if (!isCurrent() || generation !== snapshot.generation || principal !== snapshot.principal?.id || snapshot.principal.kind !== 'user' || workspaceReadFailed || doc.body.dataset.invitationIntent !== 'active') return false;
      invitations.openAcceptance(token); return true;
    },
    selectedWorkspace() { return selectedWorkspace; },
    isStaff() { const k = snapshot.principal?.kind; return k === 'user' || k === 'support'; },
    backToWorkspaces() { selectedWorkspace = null; currentScope = null; invitations.reset(); return workspaces.refresh(); },
    // Staff identity observed (any signed-in user, zero grants included): acceptance entry is reachable outside the member gate.
    // The W list is read once per identity generation; later identity()/projects() calls (onMutation/onGrantsChanged reloads)
    // update the snapshot only, so a just-created or selected workspace is not thrown back to the list (Bugbot 4037616741).
    identity(me) { snapshot.principal = me?.principal ?? null; const staff = me?.principal?.kind === 'user' || me?.principal?.kind === 'support'; if (acceptButton) acceptButton.hidden = !(staff && me.principal.kind === 'user'); if (staff && refreshedGeneration !== snapshot.generation) { refreshedGeneration = snapshot.generation; if (!currentScope) invitations.setScope(null); workspaceReadFailed = false; readiness = workspaces.refresh(); } },
    projects(list) { snapshot.authorizedProjects = (list || []).map(p => ({ id: p.id, name: p.name, role: p.role })); },
    // setScope(null) is a plain reset (prefetch resets in chooseProject/chooseAssessment/chooseGrantedAssessment call it before
    // their await). It never paints a workspace scope: restoring the selected workspace is the explicit job of the
    // empty-project path in chooseProject (Bugbot 4038131213 supersedes the generic fallback of 4037957687).
    setScope(scope) { if (scope) onAcceptanceEnded(); currentScope = scope ? { type: scope.type, id: scope.id, role: scope.role } : null; if (currentScope) invitations.setScope(currentScope); else invitations.reset(); },
    destroy() { invitations.destroy(); workspaces.destroy(); },
  };
}
