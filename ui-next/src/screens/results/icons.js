// UI Next (v4) results lane icon paths (single-path forms of the board glyphs, generator/gen.py ICONS). Status: provisional.
// Drawn by ./Glyph.svelte at the board's size and stroke (gen.py: 24 viewBox, stroke-width 1.75; tab check 13px at 2.5).
import { G as BOARD } from "../../icons.js";
// Entries byte-identical to the shared board set (ui-next/src/icons.js G, pinned to gen.py) point at it (BOARD.<name>); the rest stay
// local until the lane re-checks them (same raster, different path text: RESULTS-shared.md Slice 2).
const ring = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const G = Object.freeze({
  arrow: BOARD.arrow,
  back: BOARD.back,
  check: BOARD.check,
  more: `${ring(6, 12, 1.6)}${ring(12, 12, 1.6)}${ring(18, 12, 1.6)}`,
  people: `${ring(9, 8.5, 3)}M3.5 19a5.5 5.5 0 0 1 11 0${ring(16.5, 9.5, 2.5)}M15.6 14.1A4.6 4.6 0 0 1 21 18.5`,
  refresh: BOARD.refresh,
  download: BOARD.down,
  doc: BOARD.file,
  list: BOARD.list,
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5V13a2.5 2.5 0 0 1 2.5-2.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  print: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM7 14h10v6H7z",
  qr: "M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  clock: `${ring(12, 12, 8.5)}M12 7.5V12l3 2`,
  eye: `M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z${ring(12, 12, 2.5)}`,
  edit: BOARD.pen,
  printer: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM7 14h10v6H7z",
  x: BOARD.x,
  share: BOARD.out,
});
