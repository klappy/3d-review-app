import { authReturnUI, rememberAuthReturn, clearAuthReturn, installLegacyAuthReturn } from './auth-return.js';
// Summit item 13: ordinary root entry selects Next after the prerequisite
// production promotion was verified. Explicit legacy and existing deep links keep
// their original handlers. This module stores no preference.
const PRESENTATION_QUERY = new Set(['ui', 'ui_next', 'theme', 'w']);

// Change the ordinary entry point, not the contracts of existing links. Hashes
// include survey/invitation credentials and legacy report/project routes. Valid
// auth session callbacks are transferred to Next using the existing tab storage.
// Unknown query parameters also stay with the current handler, including returns.
export function nextDefaultTarget(location) {
  if (!location || !['/', '/index.html'].includes(location.pathname)) return null;
  // Real email/Access callbacks return here; keep their bearer out of the Next URL.
  if (location.hash && !/^#session=([A-Za-z0-9_]+)$/.test(location.hash)) return null;
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
  probeNext = async signal => (await fetch('/next/', { method: 'HEAD', cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal })).ok,
  probeTimeoutMs = 2000, storage,
  loadCurrent = () => import('./assess/assess.js') } = {}) {
  const callback = /^#session=([A-Za-z0-9_]+)$/.exec(location?.hash || '');
  if (callback && authReturnUI(storage) === 'legacy') {
    clearAuthReturn(storage);
    installLegacyAuthReturn(globalThis.document, storage);
    await loadCurrent();
    return { ui: 'current' };
  }
  const target = nextDefaultTarget(location);
  const initialHash = location?.hash;
  if (target) {
    // This checks entry HTML availability, not application/bundle health. The
    // activation receipt must verify Next boot and its referenced assets.
    const controller = new AbortController();
    let timer;
    try {
      const available = await Promise.race([Promise.resolve().then(() => probeNext(controller.signal)),
        new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(false); }, probeTimeoutMs); })]);
      if (available && location.hash === initialHash && nextDefaultTarget(location) === target) {
        if (callback) (storage ?? globalThis.sessionStorage).setItem('facilitatorToken', callback[1]);
        clearAuthReturn(storage);
        location.replace(target); // no extra root history entry or Back/Forward loop
        return { ui: 'next', target };
      }
    } catch { /* unavailable entry, storage or navigation: retain current handler */ }
    finally { clearTimeout(timer); }
  }
  if (callback) clearAuthReturn(storage);
  else rememberAuthReturn('legacy', storage);
  installLegacyAuthReturn(globalThis.document, storage);
  await loadCurrent();
  return { ui: 'current' };
}
