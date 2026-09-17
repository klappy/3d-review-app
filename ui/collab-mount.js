// NativeDesign common hooks for the W (workspace-manager) and I (scope-invitations) modules.
// Contracts: cookbook #16 c5714752335 (W) and c5714786175 (I). This file owns adapters, lifecycle and
// placement only; it never grants, never stores credentials and never mounts on shared/participant routes.
import { mountWorkspaceManager } from './workspace-manager.js';
import { mountScopeInvitations } from './scope-invitations.js';

export function createCollabHooks({ document: doc, api, sharedMode, onReload }) {
  const wRoot = doc.getElementById('workspace-manager-root');
  const iRoot = doc.getElementById('scope-invitations-root');
  const acceptButton = doc.getElementById('accept-invitation');
  if (sharedMode || !wRoot || !iRoot) return { reset() {}, identity() {}, projects() {}, setScope() {}, destroy() {}, selectedWorkspace() { return null; }, isStaff() { return false; }, backToWorkspaces() {} };

  // Immutable per-identity snapshot; `generation` changes on every identity reset so stale async work is discarded.
  const snapshot = { generation: 0, principal: null, authorizedProjects: [] };
  const request = (path, { method = 'GET', body } = {}) => api(path, { method, body }); // existing envelope adapter; accept path is redacted before #events
  const getContext = () => ({
    principalId: snapshot.principal?.id ?? null, kind: snapshot.principal?.kind ?? null, generation: snapshot.generation,
    shared: false, participant: false, provisioned: !!snapshot.principal?.provisioned,
    authorizedProjects: snapshot.authorizedProjects.map(p => ({ id: p.id, name: p.name, role: p.role })),
  });
  let invitations = null, workspaces = null, selectedWorkspace = null, currentScope = null, refreshedGeneration = -1;
  invitations = mountScopeInvitations({ document: doc, root: iRoot, request, getContext, onGrantsChanged: () => onReload() });
  workspaces = mountWorkspaceManager({
    document: doc, root: wRoot, request, getContext,
    // A null workspace (deselect/refresh/deletion) only clears a WORKSPACE scope; a project/assessment scope is untouched (Bugbot 4037616741).
    onWorkspaceSelected: ws => { selectedWorkspace = ws ? { id: ws.id, role: ws.role } : null; if (ws) { currentScope = { type: 'workspace', id: ws.id, role: ws.role }; invitations.setScope(currentScope); } else if (currentScope?.type === 'workspace') { currentScope = null; invitations.reset(); } },
    onMutation: () => onReload(),
  });
  acceptButton?.addEventListener('click', () => invitations.openAcceptance());

  return {
    // Identity change: synchronous reset of both modules before any other async work.
    // Both modules own their root's hidden flag; the hooks only drive lifecycle and the snapshot.
    reset() { snapshot.generation += 1; snapshot.principal = null; snapshot.authorizedProjects = []; selectedWorkspace = null; currentScope = null; invitations.reset(); workspaces.reset(); if (acceptButton) acceptButton.hidden = true; },
    selectedWorkspace() { return selectedWorkspace; },
    isStaff() { const k = snapshot.principal?.kind; return k === 'user' || k === 'support'; },
    backToWorkspaces() { selectedWorkspace = null; currentScope = null; invitations.reset(); return workspaces.refresh(); },
    // Staff identity observed (any signed-in user, zero grants included): acceptance entry is reachable outside the member gate.
    // The W list is read once per identity generation; later identity()/projects() calls (onMutation/onGrantsChanged reloads)
    // update the snapshot only, so a just-created or selected workspace is not thrown back to the list (Bugbot 4037616741).
    identity(me) { snapshot.principal = me?.principal ?? null; const staff = me?.principal?.kind === 'user' || me?.principal?.kind === 'support'; if (acceptButton) acceptButton.hidden = !(staff && me.principal.kind === 'user'); if (staff && refreshedGeneration !== snapshot.generation) { refreshedGeneration = snapshot.generation; if (!currentScope) invitations.setScope(null); workspaces.refresh(); } },
    projects(list) { snapshot.authorizedProjects = (list || []).map(p => ({ id: p.id, name: p.name, role: p.role })); },
    setScope(scope) { currentScope = scope ? { type: scope.type, id: scope.id, role: scope.role } : null; if (scope) invitations.setScope(currentScope); else invitations.reset(); },
    destroy() { invitations.destroy(); workspaces.destroy(); },
  };
}
