// UI Next (v4) people lane icon paths: single-path forms of the board SVGs (canvas People, Workspace, WorkspacePhone, PeoplePhone; search: Workspace "Find a project"),
// for ../../Icon.svelte. Shared paths (mail, people, check, clock, globe, plus, arrow, chev, pen, x) come from ../../icons.js. Status: provisional.
import { G as BOARD } from "../../icons.js";
// Entries byte-identical to the shared board set (ui-next/src/icons.js G, pinned to gen.py) point at it (BOARD.<name>); the rest stay
// local until the lane re-checks them (same raster, different path text: RESULTS-shared.md Slice 2).
export const P = Object.freeze({
  dots: BOARD.dots,
  qr: "M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  list: BOARD.list,
  mic: "M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v3",
  video: BOARD.video,
  reviews: "M8 5h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 5V3.5h6V5M9 11h6M9 15h4",
  file: BOARD.file,
  refresh: BOARD.refresh,
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5V13a2.5 2.5 0 0 1 2.5-2.5zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  print: "M7 8V4h10v4M6 8h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM7 14h10v6H7z",
  church: BOARD.church,
  search: "M17.5 11a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0M20 20l-4.3-4.3",
});
