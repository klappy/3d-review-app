// component: EditableHeading (Bincy B07; feedback F04, interaction principles). The name IS the page heading; a modest
// pencil opens an inline field with Save / Cancel that calls the page's existing rename capability. No rename card, no name form.
// It enhances an <h1> the host already renders (kit shell or page), so the one-heading contract is unchanged.
// canEdit comes from the loaded role; without it nothing is added (viewers read the heading only).
// save(name) → resolves on success; resolving to false or throwing keeps the field open (a thrown message is shown).
const STYLE_ID = 'v3-editable-heading-style';
const CSS = '.v3-eh{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}.v3-eh>h1{margin:0;min-width:0;overflow-wrap:anywhere}'
  + '.v3-eh-edit{flex:none;padding:2px 8px;min-height:32px;font-size:16px;line-height:1;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--muted,#5b6b68);cursor:pointer}'
  + '.v3-eh-edit:hover,.v3-eh-edit:focus-visible{border-color:var(--edge,#cfdcd9);color:var(--ink,#16302b)}'
  + '.v3-eh-form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1 1 100%;margin:0}.v3-eh-form input{flex:1 1 200px;min-width:0;font:inherit;font-size:20px;font-weight:600;padding:6px 10px}'
  + '.v3-eh-msg{flex-basis:100%;margin:0}';

export function mountEditableHeading(h1, { canEdit = false, label = 'name', save, maxLength = 100 } = {}) {
  if (!h1 || !canEdit || typeof save !== 'function' || !h1.ownerDocument) return null;
  const doc = h1.ownerDocument;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; (doc.head || doc.documentElement).append(s); }
  let wrap = h1.parentElement?.classList?.contains('v3-eh') ? h1.parentElement : null;
  if (!wrap) { wrap = doc.createElement('div'); wrap.className = 'v3-eh'; h1.replaceWith(wrap); wrap.append(h1); }
  for (const n of [...wrap.children]) if (n !== h1) n.remove(); // re-mount after a repaint: one control, never two
  h1.hidden = false;
  const btn = doc.createElement('button');
  btn.type = 'button'; btn.className = 'v3-eh-edit'; btn.dataset.editHeading = ''; btn.setAttribute('aria-label', `Edit ${label}`); btn.title = `Edit ${label}`; btn.textContent = '✎';
  wrap.append(btn);
  let form = null, saving = false; // saving: a save() is in flight — no second submit, no Escape/Cancel until it settles (Bugbot 4108101050)
  const close = focus => { form?.remove(); form = null; h1.hidden = false; btn.hidden = false; if (focus) btn.focus(); };
  btn.addEventListener('click', () => {
    if (form) return;
    form = doc.createElement('form'); form.className = 'v3-eh-form';
    const input = doc.createElement('input'); input.name = 'name'; input.required = true; input.maxLength = maxLength; input.value = h1.textContent.trim(); input.setAttribute('aria-label', label.charAt(0).toUpperCase() + label.slice(1));
    const ok = doc.createElement('button'); ok.type = 'submit'; ok.textContent = 'Save'; // not 'primary': the page keeps its one primary action
    const cancel = doc.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.dataset.cancel = '';
    const msg = doc.createElement('p'); msg.className = 'v3-eh-msg small muted'; msg.setAttribute('role', 'status');
    form.append(input, ok, cancel, msg);
    cancel.addEventListener('click', () => { if (!saving) close(true); });
    form.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); if (!saving) close(true); } });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (saving) return;
      const name = input.value.trim(); if (!name) { input.focus(); return; }
      if (name === h1.textContent.trim()) { close(true); return; }
      saving = true; ok.disabled = cancel.disabled = input.readOnly = true; form.setAttribute('aria-busy', 'true'); msg.textContent = '';
      let done = false, reason = ''; try { done = (await save(name)) !== false; } catch (err) { reason = String(err?.message || ''); } finally { saving = false; }
      if (!form) return; // the host repainted (and re-mounted) while saving
      if (done) { h1.textContent = name; close(btn.isConnected); } else { ok.disabled = cancel.disabled = input.readOnly = false; form.removeAttribute('aria-busy'); msg.textContent = reason || 'The name was not saved.'; input.focus(); }
    });
    h1.hidden = true; btn.hidden = true; wrap.append(form); input.focus(); input.select?.();
  });
  return { button: btn, close: () => close(false) };
}
