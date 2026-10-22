// UI Next (v4) explore lane icon paths: single-path forms of the icons the Explore, Feedback and Help boards draw
// (cookbook design/2026-10-15-glass-redesign/canvas Explore*.dc.html, Feedback*.dc.html, Help*.dc.html; generator/gen.py ICONS).
// Circles and rects are written as arcs so the shared Icon component (one <path>) can draw them. Status: provisional.
import { G as BOARD } from "../../icons.js";
// Entries byte-identical to the shared board set (ui-next/src/icons.js G, pinned to gen.py) point at it (BOARD.<name>); the rest stay
// local until the lane re-checks them (same raster, different path text: RESULTS-shared.md Slice 2).
export const E = Object.freeze({
  pen: BOARD.pen,
  download: BOARD.down,
  list: BOARD.list,
  search: BOARD.search,
  doc: BOARD.file,
  people: BOARD.people,
  globe: BOARD.globe,
  clock: BOARD.clock,
  calendar: "M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5M4 10h16M8 3v4M16 3v4",
  mic: "M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3M6 11a6 6 0 0 0 12 0M12 17v3",
  mail: "M6 5.5h12A2.5 2.5 0 0 1 20.5 8v8a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5M4 7.5l8 6 8-6",
});
