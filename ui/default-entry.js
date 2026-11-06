// Prepared for optional Summit item 13. Deliberately NOT wired into index.html.
// The coordinator activates the reviewed wiring only after the next production
// promotion is deployed and independently verified. This module stores no preference.
const PRESENTATION_QUERY = new Set(['ui', 'ui_next', 'theme', 'w']);

// Change the ordinary entry point, not the contracts of existing links. Hashes
// include survey/session/invitation credentials and legacy report/project routes.
// Unknown query parameters also stay with the current handler, including returns.
export function nextDefaultTarget(location) {
  if (!location || !['/', '/index.html'].includes(location.pathname)) return null;
  if (location.hash) return null;
  const search = location.search || '';
  const params = new URLSearchParams(search);
  if ([...params.keys()].some(key => !PRESENTATION_QUERY.has(key))) return null;
  if (params.getAll('ui').some(value => value !== 'next')) return null;
  if (params.getAll('ui_next').some(value => value !== 'on')) return null;
  // Force the live Next entry even if an older DEV gallery opt-out was stored.
  // Preserve the original query bytes; credentials never reach this branch.
  return '/next/' + search + (params.has('ui_next') ? '' : `${search ? '&' : '?'}ui_next=on`);
}

// Replace the one legacy bootstrap with this call at activation. Import legacy
// only on its chosen branch; do not start both applications while redirecting.
export async function bootDefaultEntry({ location = globalThis.location,
  probeNext = async () => (await fetch('/next/', { method: 'HEAD', cache: 'no-store', credentials: 'same-origin', redirect: 'error' })).ok,
  loadCurrent = () => import('./assess/assess.js') } = {}) {
  const target = nextDefaultTarget(location);
  if (target) {
    // This checks entry HTML availability, not application/bundle health. The
    // activation receipt must verify Next boot and its referenced assets.
    try {
      if (await probeNext() && nextDefaultTarget(location) === target) {
        location.replace(target); // no extra root history entry or Back/Forward loop
        return { ui: 'next', target };
      }
    } catch { /* unavailable assets or refused navigation: retain current UI */ }
  }
  await loadCurrent();
  return { ui: 'current' };
}
