// UI Next (v4) explore lane: the modal helpers the Explore filters sheet and the Feedback dialog share. Status: provisional.
// Contract: cookbook design/2026-10-15-glass-redesign/canvas/design-system.md "Dialog and sheet states": a native
// <dialog class="glass-hi"> opened with showModal() (top layer, inert page, ::backdrop from the dialog.glass-hi rows).
// Plain JS (no Svelte import), so both screens and vitest import one copy.

/** Svelte attachment: open the dialog as a modal on mount; where showModal is missing or throws (not connected yet), set [open]. */
export function modal(el) {
  if (typeof el.showModal === "function") { try { el.showModal(); return; } catch { /* not connected yet: fall through */ } }
  el.setAttribute("open", "");
}

/** Is the pointer of event e outside the box of element el? */
function outside(el, e) {
  const r = el.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/**
 * Close a modal only for a press that starts and ends on its ::backdrop. Returns { onpointerdown, onclick } for the <dialog>.
 * - The backdrop and the dialog's own padding both report the <dialog> as the target, so the pointer must fall outside its
 *   box (validator F2: a tap on the sheet's padding closed it).
 * - A press that starts on a row and is released over the backdrop clicks the rows' shared ancestor, the <dialog>, outside
 *   its box, so the press must also have started there (validator N3).
 * Escape still closes through the native cancel.
 */
export function backdropClose() {
  let down = false;
  return {
    onpointerdown(e) { down = e.target === e.currentTarget && outside(e.currentTarget, e); },
    onclick(e) {
      const el = e.currentTarget;
      const out = down && e.target === el && outside(el, e);
      down = false;
      if (out) { if (typeof el.close === "function") el.close(); else el.removeAttribute("open"); }
      return out;
    },
  };
}
