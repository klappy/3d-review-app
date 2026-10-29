// UI Next (v4) setup lane icon paths: single-path forms of cookbook design/2026-10-15-glass-redesign/generator/gen.py ICONS
// (circles and rects written as arcs so Glyph.svelte draws only <path>). Status: provisional.
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const GLYPHS = Object.freeze({
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  back: ["M19 12H5", "M11 6l-6 6 6 6"],
  x: ["M6 6l12 12M18 6L6 18"],
  plus: ["M12 5v14M5 12h14"],
  chev: ["M6 9l6 6 6-6"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  search: [circle(11, 11, 6.5), "M20 20l-4.3-4.3"],
  upload: ["M12 16V5", "M7 10l5-5 5 5", "M4 19h16"],
  link: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
  file: ["M7 3.5h7l5 5v12H7z", "M14 3.5v5h5"],
  eye: ["M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z", circle(12, 12, 2.5)],
  warn: ["M12 4l9 16H3z", "M12 10v4", "M12 17h.01"],
  people: [circle(9, 8.5, 3), "M3.5 19a5.5 5.5 0 0 1 11 0", circle(16.5, 9.5, 2.5), "M15.6 14.1A4.6 4.6 0 0 1 21 18.5"],
  lock: ["M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9a2.5 2.5 0 0 1-2.5-2.5V13a2.5 2.5 0 0 1 2.5-2.5z", "M8 10.5V8a4 4 0 0 1 8 0v2.5"],
  dots: [circle(6, 12, 1.6), circle(12, 12, 1.6), circle(18, 12, 1.6)],
  pen: ["M4 20l4-1 11-11-3-3L5 16z"],
  play: ["M8 5.5v13l10-6.5z"],
});
