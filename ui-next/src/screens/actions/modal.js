// UI Next (v4) actions lane: open a native <dialog> modal on mount and close it on a backdrop tap (design-system.md
// "Dialog and sheet states", R14). Status: provisional. Svelte attachment: <dialog {@attach modal}>. showModal() gives the top
// layer, the inert page, Escape as cancel and focus return; where it is missing (jsdom) or throws (not connected yet), the dialog
// is opened in place with the open attribute. Initial focus (R14 Focus on open) goes to the element marked data-autofocus (Svelte
// turns an autofocus attribute into its own focus call and drops the attribute, so showModal() would not see it). A tap on the ::backdrop lands on the dialog element
// itself but outside its box; a tap on the dialog's own padding lands inside the box and is kept (R14 Escape and dismissal).
export function modal(el, { open = true } = {}) {
  if (open && typeof el.showModal === "function") {
    try { el.showModal(); } catch { el.setAttribute("open", ""); }
  } else if (open) el.setAttribute("open", "");
  if (open) el.querySelector("[data-autofocus]")?.focus();
  const tap = (e) => {
    if (e.target !== el) return;
    const r = el.getBoundingClientRect();
    if (r.width && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeDialog(el);
  };
  el.addEventListener("click", tap);
  return () => el.removeEventListener("click", tap);
}
export function closeDialog(el) {
  if (!el) return;
  if (typeof el.close === "function") el.close();
  else el.removeAttribute("open");
}
