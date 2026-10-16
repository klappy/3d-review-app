// UI Next (v4) Button. Status: provisional.
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2, Button row
// (.btn + variant/size classes; icon-only needs aria-label). Values: generator/helmet.html .btn rules and gen.py btn()/iconbtn().
// Ported: primary, secondary (plain .btn), quiet, icon-only, lg, block; default and hover.
// Not ported: disabled (validation V-41, no rule in the canvas yet). Primary placement and the
// one-primary-per-page count are page rules (V-06, V-08), not this component's.
import { h } from "./h.js";

const VARIANT_CLASS = { secondary: "", primary: "btn-primary", quiet: "btn-quiet" };

const decorative = (node) => {
  if (node && typeof node.setAttribute === "function") node.setAttribute("aria-hidden", "true");
  return node;
};

/**
 * renderButton(props) -> HTMLButtonElement | HTMLAnchorElement
 * props:
 *   label      visible text (required unless icon-only)
 *   variant    "secondary" (default) | "primary" | "quiet"
 *   icon       a node: renders icon-only (.btn-icon); requires ariaLabel
 *   ariaLabel  accessible name; required for icon-only
 *   lead/trail optional leading/trailing icon nodes (decorative)
 *   lg, block  size and width modifiers (.btn-lg, .btn-block)
 *   href       renders an <a>; otherwise a <button type="button">
 */
export function renderButton(props = {}) {
  const { label, variant = "secondary", icon, ariaLabel, lead, trail, lg = false, block = false, href } = props;
  if (!Object.hasOwn(VARIANT_CLASS, variant)) throw new TypeError(`renderButton(): unknown variant "${variant}"`);
  if ("disabled" in props) throw new TypeError("renderButton(): the disabled state is not in the ported contract yet");
  const iconOnly = icon !== undefined && icon !== null;
  const name = typeof ariaLabel === "string" ? ariaLabel.trim() : "";
  if (iconOnly && !name) throw new TypeError("renderButton(): an icon-only button needs an aria-label");
  if (iconOnly && (label || lead || trail)) throw new TypeError("renderButton(): an icon-only button takes no label, lead or trail");
  if (!iconOnly && !(typeof label === "string" && label.trim())) throw new TypeError("renderButton(): a button needs a label");

  const cls = ["btn", VARIANT_CLASS[variant], iconOnly && "btn-icon", lg && "btn-lg", block && "btn-block"].filter(Boolean).join(" ");
  const attrs = href ? { class: cls, href } : { class: cls, type: "button" };
  if (name) attrs["aria-label"] = name;
  const children = iconOnly ? [decorative(icon)] : [lead && decorative(lead), label, trail && decorative(trail)];
  return h(href ? "a" : "button", attrs, ...children);
}
