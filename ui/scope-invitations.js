/** Exact-scope collaborator UI. Presentation only; the server owns every grant.
 * request(path, options) resolves the unwrapped API result or rejects. It MUST
 * redact /v2/invitations/{token}/accept before diagnostics, or never log URLs.
 * getContext(): {principalId, kind, generation, shared}. No token storage access.
 * Integration must reset() synchronously on identity/shared-route changes.
 */
const scopes = new Set(['workspace', 'project', 'assessment']);
const roles = new Set(['viewer', 'member', 'owner']);
const enc = value => encodeURIComponent(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export function canManageScope(role) { return role === 'owner' || role === 'member'; }
export function invitationRoles(role) { return role === 'owner' ? ['viewer', 'member', 'owner'] : role === 'member' ? ['viewer', 'member'] : []; }
export function canRevokeGrant(caller, target) { return canManageScope(caller) && (target === 'viewer' || target === 'member'); }
export function canUpdateGrant(caller, target) { return caller === 'owner' && (target === 'viewer' || target === 'member'); }

export function mountScopeInvitations({document: doc, root, request, getContext, onGrantsChanged = () => {}}) {
  let scope = null, mode = 'manager', list = null, pending = null, credential = null, completedInvitation = null;
  let message = '', failure = false, busy = false, destroyed = false, epoch = 0, renderId = 0;
  let status, confirmation, credentialBox, controls = [], confirmButton;
  const context = () => getContext() || {};
  const staff = c => !!c.principalId && ['user', 'support'].includes(c.kind) && c.shared === false;
  const identity = c => JSON.stringify([c.principalId, c.kind, c.generation, c.shared]);
  const snapshot = () => ({epoch, identity: identity(context())});
  const current = s => !destroyed && s.epoch === epoch && staff(context()) && s.identity === identity(context());
  function el(tag, text, cls) { const n = doc.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function setStatus(text, error = false) { message = text; failure = error; if (status) { status.textContent = text; status.setAttribute('role', error ? 'alert' : 'status'); } }
  function lock(value) { busy = value; for (const n of controls) n.disabled = value; }
  function clearIntent() {
    epoch++; pending = null; credential = null; completedInvitation = null; lock(false);
    confirmation?.replaceChildren(); credentialBox?.replaceChildren();
    if (confirmButton) confirmButton = null;
  }
  function safeFailure(error, write) {
    // Never surface a supplied error message/URL: acceptance URLs contain tokens.
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code === 'NOT_FOUND_OR_NOT_VISIBLE' || code === 'NOT_AUTHORIZED_AT_SCOPE' || code === 'NOT_AUTHENTICATED') return 'This action is not available with your current identity and access. Refresh or sign in as the invited person.';
    if (code === 'INVALID_PARAMS' || code === 'CONFIRM_REQUIRED') return 'The request or confirmation is no longer valid. Check the details; the invitation may be expired, revoked or already used.';
    return write ? 'The outcome could not be confirmed. Refresh access before choosing to retry; no completion is assumed.' : 'The request could not be completed. Refresh and check your access.';
  }
  function button(text, action, {secondary = false} = {}) {
    const n = el('button', text, secondary ? 'quiet' : ''); n.type = 'button'; controls.push(n);
    const mounted = renderId, who = identity(context());
    n.addEventListener('click', () => {
      if (destroyed || busy || mounted !== renderId || who !== identity(context()) || !staff(context())) return;
      void action();
    });
    return n;
  }
  function field(label, input) { const n = el('label', label); input.setAttribute('aria-label', label); n.append(input); return n; }
  function input(type, name) { const n = el('input'); n.type = type; n.name = name; n.required = true; n.autocomplete = 'off'; controls.push(n); n.addEventListener('input', () => { clearIntent(); setStatus('Details changed. Preview again before confirming.'); }); return n; }
  function roleSelect(values, selected) { const n = el('select'); for (const role of values) { const o = el('option', role); o.value = role; n.append(o); } n.value = selected || values[0]; controls.push(n); n.addEventListener('change', () => { clearIntent(); setStatus('Role changed. Preview again before confirming.'); }); return n; }
  function path() { return `/v2/${scope.type}/${enc(scope.id)}`; }
  function baseResult(result) { if (!object(result)) throw new Error('Invalid result'); return result; }
  async function refreshList() {
    clearIntent(); list = null; render();
    if (!scope || !canManageScope(scope.role) || !staff(context())) return;
    const s = snapshot(), route = path(); lock(true); setStatus('Loading access…');
    try {
      const result = baseResult(await request(`${route}/grants`, {method: 'GET'}));
      if (!current(s)) return;
      if (result.scope?.type !== scope.type || result.scope?.id !== scope.id || !Array.isArray(result.grants) || !Array.isArray(result.pending_invitations)) throw new Error('Wrong scope');
      // No names or email addresses are inferred from principal IDs.
      list = {grants: result.grants.filter(g => object(g) && typeof g.id === 'string' && typeof g.principal_id === 'string' && roles.has(g.role)), pending: result.pending_invitations.filter(i => object(i) && typeof i.id === 'string' && roles.has(i.role) && ['sent', 'pending'].includes(i.status))};
      message = ''; failure = false;
    } catch (error) { if (current(s)) { list = null; message = safeFailure(error, false); failure = true; } }
    finally { if (current(s)) { lock(false); render(); } }
  }
  function showConfirmation(intent, result) {
    if (typeof result.confirm_token !== 'string' || !result.confirm_token) throw new Error('Missing confirmation');
    if (intent.kind === 'accept') {
      const effect = result.impact?.affected?.[0];
      if (!scopes.has(effect?.scope?.type) || typeof effect.scope.id !== 'string' || !roles.has(effect.role)) throw new Error('Missing acceptance scope');
      intent = {...intent, acceptanceScope: {...effect.scope}, acceptanceRole: effect.role,
        summary: `Accept ${effect.role} access at ${effect.scope.type} ${effect.scope.id}. Current access: ${roles.has(effect.currently) ? effect.currently : 'none'}. Existing stronger access will be preserved.`};
    }
    pending = {...intent, token: result.confirm_token, snapshot: snapshot()};
    // Render only locally described intent. Never dump impact, invitee hash or token.
    confirmation.replaceChildren(el('p', intent.summary, 'scope-invitations-impact'));
    confirmButton = button(intent.confirmLabel, confirm);
    confirmation.append(confirmButton, button('Cancel', () => { clearIntent(); setStatus('Cancelled. Nothing further was sent.'); }, {secondary:true}));
    setStatus('Review the action, then confirm.');
  }
  async function preview(intent) {
    clearIntent(); const s = snapshot(); lock(true); setStatus('Preparing confirmation…');
    try {
      const result = baseResult(await request(intent.url, {method:intent.method, body:{...intent.body, mode:'dry_run'}}));
      if (!current(s)) return;
      lock(false); showConfirmation(intent, result);
    } catch (error) { if (current(s)) { clearIntent(); setStatus(safeFailure(error, false), true); } }
  }
  async function confirm() {
    const intent = pending;
    if (!intent || !current(intent.snapshot)) { clearIntent(); setStatus('Preview again before confirming.'); return; }
    pending = null; confirmation.replaceChildren(); const s = snapshot(); lock(true); setStatus('Applying confirmed action…');
    try {
      const result = baseResult(await request(intent.url, {method:intent.method, body:{...intent.body, mode:'execute', confirm_token:intent.token}}));
      if (!current(s)) return;
      if (intent.kind === 'invite') {
        if (typeof result.invitation_id !== 'string' || typeof result.delivered !== 'boolean') throw new Error('Unexpected delivery result');
        completedInvitation = {id: result.invitation_id, role: intent.body.role, delivered: result.delivered};
        credential = !result.delivered && typeof result.dev_only_link_token === 'string' && result.dev_only_link_token ? result.dev_only_link_token : null;
        message = result.delivered ? 'Invitation created; the server reports email delivery. The recipient has not accepted yet.' : 'Invitation created; email not delivered. The recipient has not accepted yet.';
      } else if (intent.kind === 'accept') {
        if (result.granted !== true || result.scope?.type !== intent.acceptanceScope.type || result.scope?.id !== intent.acceptanceScope.id || !roles.has(result.role)) throw new Error('Invalid acceptance');
        message = `Invitation accepted. Access granted as ${result.role} at ${result.scope.type}.`;
        // Acceptance request/token exist only in this closure; wipe the entry DOM now.
        render();
        try { await onGrantsChanged(); } catch { if (current(s)) setStatus('Invitation accepted, but access could not be refreshed. Refresh before continuing.', true); }
        if (!current(s)) return;
      } else {
        if (result.grant !== intent.grantId || result.role !== intent.body.role) throw new Error('Wrong grant');
        list = null; message = 'Role updated. Refresh access to see the current list.';
        try { await onGrantsChanged(); } catch { if (current(s)) message = 'Role updated, but access could not be refreshed. Refresh before continuing.'; }
      }
      if (current(s)) { failure = false; render(); }
    } catch (error) { if (current(s)) { credential = null; list = null; render(); setStatus(safeFailure(error, true), true); } }
    finally { if (current(s)) lock(false); }
  }
  async function revoke(url, label, target, kind) {
    clearIntent(); const s = snapshot(); lock(true); setStatus(`${label}…`);
    try {
      const result = baseResult(await request(url, {method:'DELETE'}));
      if (!current(s)) return;
      if (kind === 'grant' ? result.grant !== target || result.revoked !== true : result.id !== target || result.status !== 'revoked') throw new Error('Invalid revocation');
      list = null; message = `${label} completed. Refresh access to see the current list.`;
      try { await onGrantsChanged(); } catch { if (current(s)) message = `${label} completed, but access could not be refreshed.`; }
      if (current(s)) render();
    } catch (error) { if (current(s)) { list = null; render(); setStatus(safeFailure(error, true), true); } }
    finally { if (current(s)) lock(false); }
  }
  function renderManager() {
    if (!scope || !canManageScope(scope.role)) { root.append(el('p', 'Select a scope where you are an owner or member to manage collaborators.')); return; }
    root.append(el('h3', `Collaborators · ${scope.type}`), el('p', scope.id, 'scope-invitations-context'));
    if (completedInvitation) {
      root.append(el('p', `${completedInvitation.id} · ${completedInvitation.role} · awaiting acceptance`));
      root.append(el('p', completedInvitation.delivered ? 'Email delivery does not mean the recipient has accepted. Continue to refresh the pending list.' : 'Complete the private handoff before continuing. Finishing discards any remaining token; it cannot be recovered here. Changing identity or scope also clears it.'));
      root.append(button(completedInvitation.delivered ? 'Continue and refresh access' : 'Finish handoff and refresh access', refreshList, {secondary:true}));
      return;
    }
    root.append(button('Refresh access', refreshList, {secondary:true}));
    const form = el('form', undefined, 'scope-invitations-form'), email = input('email','invite-email'), role = roleSelect(invitationRoles(scope.role));
    email.maxLength = 320;
    form.append(field('Recipient email', email), field('Role at this scope', role));
    form.append(button('Preview invitation', () => {
      if (!form.reportValidity()) return;
      const recipient = email.value.trim(); if (!recipient || !invitationRoles(scope.role).includes(role.value)) return;
      return preview({kind:'invite',url:`${path()}/invitations`,method:'POST',body:{email:recipient,role:role.value},summary:`Invite this recipient as ${role.value} at this ${scope.type} only. Delivery will be reported after creation.`,confirmLabel:'Confirm invitation'});
    }));
    form.addEventListener('submit', e => e.preventDefault()); root.append(form);
    if (!list) return;
    const grants = el('ul', undefined, 'scope-invitations-list');
    for (const g of list.grants) {
      const row = el('li'); row.append(el('span', `${g.principal_id} · ${g.role}`));
      if (canUpdateGrant(scope.role,g.role)) {
        const nextRole = roleSelect(['viewer','member','owner'],g.role);
        row.append(field(`Role for ${g.principal_id}`,nextRole),button('Preview role change', () => preview({kind:'role',url:`${path()}/grants/${enc(g.id)}`,method:'PATCH',body:{role:nextRole.value},grantId:g.id,summary:`Change this grant from ${g.role} to ${nextRole.value} at this ${scope.type} only. Previously seen information cannot be withdrawn.`,confirmLabel:'Confirm role change'})));
      }
      if (canRevokeGrant(scope.role,g.role)) row.append(button('Remove access', () => revoke(`${path()}/grants/${enc(g.id)}`,'Access removal',g.id,'grant'), {secondary:true}));
      grants.append(row);
    }
    root.append(el('h4','Current grants'),grants);
    const invitations = el('ul', undefined, 'scope-invitations-list');
    for (const i of list.pending) {
      const row = el('li'); row.append(el('span', `${i.id} · ${i.role} · awaiting acceptance`));
      if (invitationRoles(scope.role).includes(i.role)) row.append(button('Revoke invitation', () => revoke(`/v2/invitations/${enc(i.id)}`,'Invitation revocation',i.id,'invitation'), {secondary:true}));
      invitations.append(row);
    }
    root.append(el('h4','Pending invitations'),invitations);
  }
  function renderAcceptance() {
    root.append(el('h3','Accept an invitation'),el('p','Sign in with the email address that was invited. This grants access only after you review and confirm.'));
    const form = el('form',undefined,'scope-invitations-form'), token = input('password','invitation-token'); token.maxLength = 4096;
    form.append(field('Private invitation token',token),button('Preview acceptance', () => {
      if (!form.reportValidity()) return;
      const value=token.value.trim(); if(!value)return;
      return preview({kind:'accept',url:`/v2/invitations/${enc(value)}/accept`,method:'POST',body:{},summary:'Accept the invitation for the signed-in recipient. Access will be released at the scope and role shown by the server.',confirmLabel:'Confirm acceptance'});
    }));
    form.addEventListener('submit',e=>e.preventDefault()); root.append(form);
  }
  function render() {
    renderId++; controls=[]; root.replaceChildren(); root.classList.add('scope-invitations');
    const c=context(); root.hidden=destroyed||!staff(c); if(root.hidden)return;
    const menu=el('div',undefined,'scope-invitations-actions');
    if(c.kind==='user'&&mode!=='accept'&&!completedInvitation)menu.append(button('Accept an invitation',openAcceptance,{secondary:true}));
    if(mode==='accept')menu.append(button('Back to collaborators',()=>{clearIntent();mode='manager';message='';render();},{secondary:true}));
    root.append(menu);
    if(mode==='accept'&&c.kind==='user')renderAcceptance();else renderManager();
    status=el('p',message,'scope-invitations-status');status.setAttribute('role',failure?'alert':'status');status.setAttribute('aria-live','polite');
    confirmation=el('div',undefined,'scope-invitations-confirmation');credentialBox=el('div',undefined,'scope-invitations-credential');
    root.append(status,confirmation,credentialBox);
    if(credential) {
      credentialBox.append(el('p','Email was not delivered. Reveal this private token only for an authorized handoff to the invited recipient. Do not record it.'));
      credentialBox.append(button('Reveal private invitation token',()=>{
        const value=credential;credential=null;credentialBox.replaceChildren();
        const secret=el('input');secret.type='text';secret.readOnly=true;secret.value=value;secret.setAttribute('aria-label','Private invitation token');secret.autocomplete='off';
        credentialBox.append(secret,button('Hide private token',()=>credentialBox.replaceChildren(),{secondary:true}));
      },{secondary:true}));
    } else if(completedInvitation && !completedInvitation.delivered) credentialBox.append(el('p','No invitation credential is available in this response. Email was not delivered.'));
    lock(busy);
  }
  function setScope(value) {
    clearIntent(); scope=value&&scopes.has(value.type)&&typeof value.id==='string'&&value.id&&roles.has(value.role)?{type:value.type,id:value.id,role:value.role}:null;
    mode='manager';list=null;message='';failure=false;render();return refreshList();
  }
  function openAcceptance() {
    if(!staff(context())||context().kind!=='user')return;
    clearIntent();mode='accept';list=null;message='';failure=false;render();
  }
  function reset() {clearIntent();scope=null;list=null;mode='manager';message='';failure=false;renderId++;root.replaceChildren();root.hidden=true;}
  function destroy(){reset();destroyed=true;}
  render();
  return {setScope,openAcceptance,reset,destroy};
}
