// UI Next (v4) collect lane glyphs. Status: provisional. Single-path forms of the generator icons the collect boards draw
// (3d-review-cookbook design/2026-10-15-glass-redesign/generator/gen.py ICONS via ic(); rect/circle elements written as paths,
// geometry unchanged). Lane-local: the shared src/icons.js and Icon.svelte (stroke 2, 20px) stay untouched.
export const G = Object.freeze({
  more: "M4.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0M16.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0",
  pen: "M4 20l4-1 11-11-3-3L5 16z",
  people: "M6 8.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3.5 19a5.5 5.5 0 0 1 11 0M14 9.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M15.6 14.1A4.6 4.6 0 0 1 21 18.5",
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1 -2.5 2.5h-9a2.5 2.5 0 0 1 -2.5 -2.5v-4.5a2.5 2.5 0 0 1 2.5 -2.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  print: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-5a2 2 0 0 1 2 -2zM7 14h10v6H7z",
  x: "M6 6l12 12M18 6L6 18",
  qr: "M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  copy: "M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2zM5 15V6a2 2 0 0 1 2-2h9",
  doc: "M7 3.5h7l5 5v12H7zM14 3.5v5h5",
  back: "M19 12H5M11 6l-6 6 6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chev: "M6 9l6 6 6-6",
});
