// component: Card (captain ruling 12:34). ONE card for home / workspace / project / assessment / survey pages.
// The markup lives in ui/assess/cards.js (kept import-free because it is inlined into the MCP panel); this module is the
// v3 component import point — a re-export, never a copy. Pages compose `card` / `cardGrid` / the entity cards from here.
export { childCounts, card, cardGrid, workspaceCard, projectCard, assessmentCard, surveyCard, routes, stageLabel } from '../../assess/cards.js';
