// UI Next (v4) icon paths used by the Home components (single-path forms of generator/gen.py ICONS). Status: provisional.
import { href } from "./screens/href.js";
export const I = Object.freeze({
  help: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18",
  chev: "M6 9l6 6 6-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  play: "M8 5.5v13l10-6.5z",
  back: "M19 12H5M11 6l-6 6 6 6",
  x: "M6 6l12 12M18 6L6 18",
  mail: "M4 7.5l8 6 8-6M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  pen: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  people: "M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M2.5 20c.7-3.5 3.3-5.5 6.5-5.5s5.8 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .7 3.2 2.6 3.5 5.2",
  out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  check: "M5 12.5l4.5 4.5L19 7",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18",
  eye: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5",
  plus: "M12 5v14M5 12h14",
  globe: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3",
});
// The account menu's rows. A screen link is built with href() from the current query, so it keeps ?ui_next=on, w and theme
// (a literal screen=about query dropped theme=dark: cookbook work/active/2026-10-21-ui-next-screens-fanout/VALIDATION-setup-r3.md N8).
export const accountItems = (from = globalThis.location?.search ?? "") => Object.freeze([
  { kind: "head", label: "Bincy Kurian", sub: "bincy@example.org" },
  { kind: "hr" },
  { label: "Invitations", href: "#invitations", icon: I.mail, tag: "1 new" },
  { label: "Help and FAQ", href: "#help", icon: I.help },
  { label: "Why 3D Review exists", href: href("about", {}, from), icon: I.sparkle },
  { label: "Send app feedback", href: "#feedback", icon: I.pen },
  { kind: "hr" },
  { label: "Use another account", href: "#main", icon: I.people },
  { label: "Sign out", href: "#main", icon: I.out },
]);
