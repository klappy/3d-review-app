// UI Next (v4) participant lane icons: single-path forms of the generator's ICONS the participant boards draw (gen.py ICONS). Status: provisional.
// Lane-local (the shared ui-next/src/icons.js is not edited by a lane); rect/circle elements are written as path arcs, same geometry.
import { I, G as BOARD } from "../../icons.js";
// Entries byte-identical to the shared board set (ui-next/src/icons.js G, pinned to gen.py) point at it (BOARD.<name>); the rest stay
// local until the lane re-checks them (same raster, different path text: RESULTS-shared.md Slice 2).
export const P = Object.freeze({
  arrow: I.arrow,
  back: I.back,
  chev: I.chev,
  globe: BOARD.globe,
  people: BOARD.people,
  list: BOARD.list,
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5V13a2.5 2.5 0 0 1 2.5-2.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  qr: "M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  audio: "M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v3",
  open: BOARD.out,
  check: BOARD.check,
  refresh: BOARD.refresh,
  warn: BOARD.warn,
  clock: BOARD.clock,
  cal: "M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5zM4 10h16M8 3v4M16 3v4",
  link: BOARD.link,
  print: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM7 14h10v6H7z",
});
