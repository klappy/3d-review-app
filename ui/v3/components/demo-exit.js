// component: Header with Exit demo / Sign in (captain ruling 12:34; CAPTAIN P0 12:10). The demo must never be a closed loop:
// in ?demo=1 the header carries "Exit demo" (bare "/" drops demo mode → home) and "Sign in" (real sign-in route), and the
// logo leaves demo instead of routing inside it. Idempotent DOM mount; no reads, no storage.
export const DEMO_EXIT_HREF = '/';
export const DEMO_SIGN_IN_HREF = '/v2/auth/email';
export const demoExitMarkup = () =>
  `<a class="rv-btn" href="${DEMO_EXIT_HREF}" data-v3-exit-demo>Exit demo</a><a class="rv-btn primary" href="${DEMO_SIGN_IN_HREF}" data-v3-demo-signin>Sign in</a>`;
export function placeDemoExit(doc) {
  const top = doc?.querySelector?.('header.top'); if (!top) return false;
  const brand = top.querySelector('a.brand');
  if (brand) { brand.setAttribute('href', DEMO_EXIT_HREF); brand.removeAttribute('data-navigate'); brand.setAttribute('data-v3-exit-demo', ''); brand.setAttribute('aria-label', '3D Review home (exit demo)'); }
  if (top.querySelector('.v3-demo-exit')) return true;
  const nav = doc.createElement('nav'); nav.className = 'v3-demo-exit'; nav.setAttribute('aria-label', 'Leave the demo');
  nav.innerHTML = demoExitMarkup();
  const right = top.querySelector('.right'); if (right) right.before(nav); else top.append(nav);
  return true;
}
