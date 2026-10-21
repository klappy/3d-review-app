// UI Next (v4) actions-lane icon paths (single-path forms of the boards' generator icons, generator/gen.py ICONS). Status: provisional.
// Each value is one SVG path d (rects and circles written as paths); drawn by ./Ico.svelte at the boards' 18px / 1.75 stroke.
import { G as BOARD } from "../../icons.js";
// Entries byte-identical to the shared board set (ui-next/src/icons.js G, pinned to gen.py) point at it (BOARD.<name>); the rest stay
// local until the lane re-checks them (same raster, different path text: RESULTS-shared.md Slice 2).
export const A = Object.freeze({
  dots: "M4.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M16.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0",
  check: BOARD.check,
  chev: BOARD.chev,
  plus: BOARD.plus,
  back: BOARD.back,
  arrow: BOARD.arrow,
  x: BOARD.x,
  pen: BOARD.pen,
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5V13a2.5 2.5 0 0 1 2.5-2.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  print: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM7 14h10v6H7z",
  people: BOARD.people,
  qr: "M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  copy: BOARD.copy,
  link: BOARD.link,
  mail: "M6 5.5h12a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5zM4 7.5l8 6 8-6",
  download: BOARD.down,
  out: BOARD.out,
  list: BOARD.list,
  sparkle: BOARD.sparkle,
  refresh: BOARD.refresh,
  warn: BOARD.warn,
  help: BOARD.help,
  clipboard: "M8 5h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 5V3.5h6V5M9 11h6M9 15h4",
});
