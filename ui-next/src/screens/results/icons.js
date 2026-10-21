// UI Next (v4) results lane icon paths (single-path forms of the board glyphs, generator/gen.py ICONS). Status: provisional.
// Drawn by ./Glyph.svelte at the board's size and stroke (gen.py: 24 viewBox, stroke-width 1.75; tab check 13px at 2.5).
const ring = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const G = Object.freeze({
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  more: `${ring(6, 12, 1.6)}${ring(12, 12, 1.6)}${ring(18, 12, 1.6)}`,
  people: `${ring(9, 8.5, 3)}M3.5 19a5.5 5.5 0 0 1 11 0${ring(16.5, 9.5, 2.5)}M15.6 14.1A4.6 4.6 0 0 1 21 18.5`,
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  doc: "M7 3.5h7l5 5v12H7zM14 3.5v5h5",
  list: "M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01",
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5V13a2.5 2.5 0 0 1 2.5-2.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  print: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM7 14h10v6H7z",
  qr: "M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  clock: `${ring(12, 12, 8.5)}M12 7.5V12l3 2`,
  eye: `M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z${ring(12, 12, 2.5)}`,
  edit: "M4 20l4-1 11-11-3-3L5 16z",
  printer: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM7 14h10v6H7z",
  x: "M6 6l12 12M18 6L6 18",
  share: "M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5",
});
