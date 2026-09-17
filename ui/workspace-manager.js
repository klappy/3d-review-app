// Staff-only workspace controls. NativeDesign owns mounting and authenticated transport.
// request resolves the UNWRAPPED result (like app api()) and rejects failures.
// getContext: {principalId,kind,generation,shared,participant?,provisioned,authorizedProjects}.
// NativeDesign resets this controller on identity/route changes; shared/participant never mount.
// No token storage, implicit grants, project-content requests, or automatic retries.
const enc = encodeURIComponent;
export function mayGroup(workspaceRole, projectRole) {
  return (workspaceRole === 'owner' && ['owner', 'member'].includes(projectRole)) ||
    (workspaceRole === 'member' && projectRole === 'owner');
}
export function mountWorkspaceManager({ document: doc, root, request, getContext, onWorkspaceSelected = () => {}, onMutation = () => {} }) {
  let revision = 0, destroyed = false, busy = false, selected = null, workspaces = [], detail = null, pending = null, message = '';
  const context = () => getContext() || {};
  const staff = c => !!c.principalId && ['user', 'support'].includes(c.kind) && c.participant !== true && c.shared !== true;
  const snapshot = () => ({ revision, generation: context().generation, principalId: context().principalId, selected });
  const current = s => !destroyed && staff(context()) && s.revision === revision && s.generation === context().generation && s.principalId === context().principalId && s.selected === selected;
  const node = (tag, text, cls) => { const n = doc.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  function button(text, action, cls = 'rv-btn') { const b = node('button', text, cls); b.type = 'button'; b.disabled = busy; b.addEventListener('click', action); return b; }
  function invalidate() { revision++; pending = null; }
  function reset() { invalidate(); busy = false; selected = null; workspaces = []; detail = null; message = ''; root.replaceChildren(); root.hidden = true; }
  function safeRender(s) { if (current(s)) render(); else if (!destroyed && (!staff(context()) || s.generation !== context().generation || s.principalId !== context().principalId)) reset(); }
  async function run(action) {
    if (destroyed || busy || !staff(context())) return;
    busy = true; const s = snapshot(); render();
    try { await action(s); }
    catch { if (current(s)) { pending = null; message = 'The request could not be confirmed. Refresh workspaces before retrying.'; } }
    finally { if (current(s)) busy = false; safeRender(s); }
  }
  async function load(s) {
    const list = await request('/v2/workspaces', { method: 'GET' }); if (!current(s)) return false;
    workspaces = Array.isArray(list.workspaces) ? list.workspaces : [];
    if (selected && !workspaces.some(w => w.id === selected)) {
      selected = null; s.selected = null; detail = null; pending = null;
      await onWorkspaceSelected(null); if (!current(s)) return false;
    }
    if (selected) {
      // Capture the selected target before await; role/name comes from the authorized get.
      const id = selected; const result = await request(`/v2/workspaces/${enc(id)}`, { method: 'GET' });
      if (!current(s)) return false;
      if (!result.workspace || result.workspace.id !== id) throw new Error('WORKSPACE_MISMATCH');
      detail = result;
    }
    return true;
  }
  async function refresh() {
    if (!staff(context())) { reset(); return; }
    // Refresh is also the explicit recovery from uncertain writes. Clear old private state first.
    invalidate(); busy = false; selected = null; detail = null; workspaces = []; message = '';
    return run(async s => { await load(s); });
  }
  async function select(id) {
    if (busy || !workspaces.some(w => w.id === id)) return;
    invalidate(); selected = id; detail = null; message = '';
    await run(async s => {
      if (!await load(s) || !current(s)) return;
      await onWorkspaceSelected(detail.workspace); if (!current(s)) return;
    });
  }
  async function mutation(path, method, body) {
    pending = null;
    await run(async s => {
      const result = await request(path, { method, ...(body === undefined ? {} : { body }) }); if (!current(s)) return;
      const created = path === '/v2/workspaces' && method === 'POST';
      if (created) { if (!result.workspace?.id) throw new Error('INVALID_WORKSPACE'); selected = result.workspace.id; s.selected = selected; }
      message = 'Workspace updated.';
      await onMutation(); if (!current(s)) return;
      await load(s); if (!current(s)) return;
      if (created && detail) await onWorkspaceSelected(detail.workspace);
    });
  }
  function nameForm(label, value, submit) {
    const form = node('form', undefined, 'wm-form'); const field = node('label', label);
    const input = node('input'); input.name = 'name'; input.value = value || ''; input.required = true; input.disabled = busy; field.append(input);
    const save = node('button', label, 'rv-btn primary'); save.type = 'submit'; save.disabled = busy;
    input.addEventListener('input', () => { pending = null; const confirm = root.querySelector?.('[data-wm-confirm]'); if (confirm) confirm.disabled = true; });
    form.append(field, save); form.addEventListener('submit', e => { e.preventDefault(); const name = input.value.trim(); if (!name || busy) return; return submit(name); }); return form;
  }
  async function previewDelete() {
    const id = selected; pending = null;
    await run(async s => {
      const result = await request(`/v2/workspaces/${enc(id)}`, { method: 'DELETE', body: { mode: 'dry_run' } });
      if (!current(s)) return;
      if (typeof result.confirm_token !== 'string' || !result.impact || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw new Error('INVALID_PREVIEW');
      pending = { id, token: result.confirm_token, expiresAt: Date.now() + result.expires_in * 1000, impact: result.impact };
    });
  }
  async function confirmDelete() {
    const p = pending;
    if (!p || p.id !== selected || Date.now() >= p.expiresAt || detail?.workspace?.role !== 'owner') { pending = null; message = 'Preview deletion again before confirming.'; render(); return; }
    pending = null;
    await run(async s => {
      await request(`/v2/workspaces/${enc(p.id)}`, { method: 'DELETE', body: { mode: 'execute', confirm_token: p.token } });
      if (!current(s)) return;
      await onMutation(); if (!current(s)) return;
      // The old selected context is no longer valid. Reset then perform a fresh explicit read.
      selected = null; detail = null; s.selected = null; message = 'Workspace deleted.';
      await load(s); if (!current(s)) return;
      await onWorkspaceSelected(null);
    });
  }
  function render() {
    if (destroyed) return;
    if (!staff(context())) { reset(); return; }
    root.hidden = false; root.replaceChildren(); root.classList.add('workspace-manager');
    const header = node('div', undefined, 'wm-heading'); header.append(node('h2', 'Workspaces'), button('Refresh workspaces', refresh)); root.append(header);
    const status = node('p', busy ? 'Working…' : message, 'wm-status'); status.setAttribute('role', 'status'); root.append(status);
    if (context().kind === 'user' && context().provisioned) root.append(nameForm('Create workspace', '', name => mutation('/v2/workspaces', 'POST', { name })));
    const list = node('div', undefined, 'wm-grid');
    for (const w of workspaces) {
      const card = node('section', undefined, 'glass wm-card'); card.append(node('h3', w.name), node('p', `${w.role}${w.archived_at ? ' · Archived' : ''}`), button('Open workspace', () => select(w.id))); list.append(card);
    }
    if (!workspaces.length && !busy) list.append(node('p', 'No workspaces you hold a grant on.')); root.append(list);
    if (!detail || detail.workspace.id !== selected) return;
    const w = detail.workspace, section = node('section', undefined, 'glass wm-detail');
    section.append(node('h3', w.name), node('p', `${w.role}${w.archived_at ? ' · Archived' : ''}`));
    if (w.role === 'owner') {
      section.append(nameForm('Rename workspace', w.name, name => mutation(`/v2/workspaces/${enc(w.id)}`, 'PATCH', { name })));
      section.append(button(w.archived_at ? 'Unarchive workspace' : 'Archive workspace', () => mutation(`/v2/workspaces/${enc(w.id)}/${w.archived_at ? 'unarchive' : 'archive'}`, 'POST')));
    }
    section.append(node('h4', 'Grouped projects'), node('p', 'Grouping lists project names. Access to each project is separate.'));
    const authorized = Array.isArray(context().authorizedProjects) ? context().authorizedProjects : [];
    const projects = Array.isArray(detail.projects) ? detail.projects : [];
    for (const p of projects) {
      const row = node('div', undefined, 'wm-project'); row.append(node('span', p.name));
      const independent = authorized.find(a => a.id === p.id);
      if (independent && mayGroup(w.role, independent.role)) row.append(button('Remove from workspace', () => mutation(`/v2/workspaces/${enc(w.id)}/projects/${enc(p.id)}`, 'DELETE')));
      section.append(row);
    }
    if (!projects.length) section.append(node('p', 'No projects grouped here.'));
    const candidates = authorized.filter(p => mayGroup(w.role, p.role) && !projects.some(row => row.id === p.id));
    if (candidates.length) {
      const label = node('label', 'Group an authorized project'); const picker = node('select'); picker.disabled = busy;
      for (const p of candidates) { const option = node('option', p.name); option.value = p.id; picker.append(option); }
      picker.value = candidates[0].id; label.append(picker); section.append(label, button('Add project to workspace', () => {
        const p = (context().authorizedProjects || []).find(a => a.id === picker.value);
        if (p && mayGroup(w.role, p.role)) return mutation(`/v2/workspaces/${enc(w.id)}/projects/${enc(p.id)}`, 'POST');
      }));
    }
    if (w.role === 'owner') section.append(button('Preview deletion', previewDelete));
    if (pending) {
      const box = node('section', undefined, 'wm-confirm'); box.append(node('h4', 'Delete this workspace?'));
      // Show only known impact counts, never stringify arbitrary server records.
      for (const row of pending.impact.affected || []) for (const key of ['projects', 'assessments', 'responses', 'grants']) if (Number.isSafeInteger(row[key])) box.append(node('p', `${key}: ${row[key]}`));
      box.append(node('p', 'Deletion cannot be undone. Only an empty workspace can be deleted.'));
      const confirm = button('Confirm deletion', confirmDelete); confirm.setAttribute('data-wm-confirm', ''); box.append(confirm, button('Cancel', () => { pending = null; render(); })); section.append(box);
    }
    root.append(section);
  }
  function destroy() { reset(); destroyed = true; }
  reset();
  return { refresh, reset, destroy };
}
