// v3 shell switches and shared shell vocabulary (lane 1; klappy/3d-review-cookbook design-system-v3 @66d97f3).
// Presentation only: no transport, no storage, no contract change. Stage ids are unchanged (prepare|collect|understand|improve).
// Flip V3_SHELL to false to restore the v2 context tree (one constant, reversible).
export const V3_SHELL = true;

// Plain state words (ADOPTION.md "What adoption would change": copy PATCH). Keys are the product's stage ids.
export const STATE_WORDS = Object.freeze(Object.assign(Object.create(null), {
  // App stage ids (src/handlers/assessment.ts): prepare → collect → understand → improve. v3 prototype words keyed by its draft/collecting/reviewing/improving.
  prepare: 'Setup not finished',
  collect: 'Collecting responses',
  understand: 'Ready to look at results',
  improve: 'Reviewed',
  preparing: 'Setup not finished',
  collecting: 'Collecting responses',
  reviewing: 'Ready to look at results',
  improving: 'Reviewed',
  done: 'Finished'
}));
export const stateWord = stage => {
  const key = typeof stage === 'string' ? stage.toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(STATE_WORDS, key) ? STATE_WORDS[key] : '';
};

// One primary action per page: within a page region, keep the first visible .primary button and demote the rest to
// ordinary buttons (class only; handlers and labels untouched). Returns the number demoted.
export function onePrimary(region) {
  if (!V3_SHELL || !region || typeof region.querySelectorAll !== 'function') return 0;
  const primaries = [...region.querySelectorAll('button.primary, .rv-btn.primary, a.primary')].filter(el => !el.closest('dialog, [hidden]'));
  let demoted = 0;
  for (const el of primaries.slice(1)) { el.classList.remove('primary'); el.classList.add('v3-demoted'); demoted++; }
  return demoted;
}

// CAPTAIN P0 12:10 demo exits live in the shared component (ruling 12:34); re-exported so existing imports keep working.
export { DEMO_EXIT_HREF, DEMO_SIGN_IN_HREF, placeDemoExit } from './v3/components/demo-exit.js';
