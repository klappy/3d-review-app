// UI Next (v4) collect lane glyphs. Status: provisional. Single-path forms of the generator icons the collect boards draw
// (3d-review-cookbook design/2026-10-15-glass-redesign/generator/gen.py ICONS via ic(); rect/circle elements written as paths,
// geometry unchanged). Lane-local: the shared src/icons.js and Icon.svelte (stroke 2, 20px) stay untouched.
import { G as BOARD } from "../../icons.js";
// Entries byte-identical to the shared board set (ui-next/src/icons.js G, pinned to gen.py) point at it (BOARD.<name>); the rest stay
// local until the lane re-checks them (same raster, different path text: RESULTS-shared.md Slice 2).
export const G = Object.freeze({
  more: "M4.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0M16.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0",
  pen: BOARD.pen,
  people: "M6 8.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3.5 19a5.5 5.5 0 0 1 11 0M14 9.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M15.6 14.1A4.6 4.6 0 0 1 21 18.5",
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1 -2.5 2.5h-9a2.5 2.5 0 0 1 -2.5 -2.5v-4.5a2.5 2.5 0 0 1 2.5 -2.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  print: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-5a2 2 0 0 1 2 -2zM7 14h10v6H7z",
  x: BOARD.x,
  qr: "M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  check: BOARD.check,
  copy: "M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2zM5 15V6a2 2 0 0 1 2-2h9",
  doc: BOARD.file,
  back: BOARD.back,
  arrow: BOARD.arrow,
  chev: BOARD.chev,
});
