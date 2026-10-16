// UI Next (v4) shared DOM helper. Status: provisional.
// h(tag, attrs, ...children) builds light-DOM elements with document.createElement,
// setAttribute and text nodes, so text is never parsed as markup (no interpolated innerHTML).
// esc() is the one escaping helper, for the rare caller that must build an HTML string.
// Import-free so it can be shared with panel modules.
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2;
// recipe: work/active/2026-10-15-glass-redesign-v4/TICKET.md "Slice recipe" items 1-2.

const isNode = (value) => value !== null && typeof value === "object" && typeof value.nodeType === "number";

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) append(el, child);
    else if (isNode(child)) el.appendChild(child);
    else el.appendChild(el.ownerDocument.createTextNode(String(child)));
  }
}

/**
 * Create an element.
 * attrs: null/undefined/false values are skipped, true sets an empty attribute,
 * anything else is set as a string. Inline event-handler attributes (on*) are refused.
 * children: strings and numbers become text nodes, nodes are appended, arrays are flattened,
 * null/undefined/booleans are skipped.
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (/^on/i.test(name)) throw new TypeError(`h(): inline handler attribute "${name}" is refused; use addEventListener`);
    el.setAttribute(name, value === true ? "" : String(value));
  }
  append(el, children);
  return el;
}

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape a value for HTML text or a quoted attribute. null/undefined become "". */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
