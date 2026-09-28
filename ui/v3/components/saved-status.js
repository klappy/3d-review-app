// component: SavedStatus (U17, journeys scorecard). After a reversible write (a rename) the form that was used says "Saved";
// when the write's receipt carries an undo_token it says "Saved · Undo", and Undo calls the existing undo capability
// (POST /v2/undo/{token}, cap.ops.undo) through the host's undo(token), then says "Undone". No token → just "Saved".
// One status per anchor: a new one replaces the old. It clears on navigation (hashchange), like the page note (U30).
const STYLE_ID = 'v3-saved-status-style';
const CSS = '.v3-saved{flex-basis:100%;margin:6px 0 0}.v3-saved button{margin-left:4px;padding:0 6px;min-height:28px;background:transparent;border:0;color:var(--accent,#367e73);text-decoration:underline;cursor:pointer;font:inherit}';

export const undoTokenOf = envelope => { const t = envelope?.receipt?.undo_token; return typeof t === 'string' && t ? t : null; };

// anchor: the form (or heading row) that was used; the status goes right after it (or inside it with { inside: true }).
// undo(token) → resolves when undone (host restores what it shows), optionally to the repainted anchor; throwing shows the reason and keeps Undo.
export function showSavedStatus(anchor, { undoToken = null, undo = null, inside = false } = {}) {
  if (!anchor?.ownerDocument) return null;
  const doc = anchor.ownerDocument, win = doc.defaultView;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; (doc.head || doc.documentElement).append(s); }
  const host = inside ? anchor : anchor.parentElement; if (!host) return null;
  for (const old of host.querySelectorAll(':scope > .v3-saved')) old.remove();
  const box = doc.createElement('p'); box.className = 'v3-saved small'; box.setAttribute('role', 'status'); box.dataset.savedStatus = '';
  const clear = () => { box.remove(); win?.removeEventListener('hashchange', clear); };
  const text = doc.createTextNode('Saved'); box.append(text);
  if (undoToken && typeof undo === 'function') {
    text.data = 'Saved · ';
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = 'Undo'; b.dataset.undo = '';
    b.addEventListener('click', async () => {
      if (b.disabled) return; b.disabled = true;
      try {
        const next = await undo(undoToken); b.remove(); text.data = 'Undone'; box.classList.remove('alert');
        if (!box.isConnected && next?.ownerDocument) { if (inside) next.append(box); else next.after(box); } // the host repainted the form: follow it
      }
      catch (e) { b.disabled = false; text.data = `${String(e?.message || 'Undo failed.')} `; box.classList.add('alert'); }
    });
    box.append(b);
  }
  if (inside) anchor.append(box); else anchor.after(box);
  win?.addEventListener('hashchange', clear);
  return { element: box, clear };
}
