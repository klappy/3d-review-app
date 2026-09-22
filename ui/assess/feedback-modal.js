import { feedback } from './feedback.js';
// Stable categories only. The route may contain identifiers; none enter the payload.
const pages = new Set(['workspaces','workspace','projects','project','assessment','survey','permissions','feedback']);
export function pageContext(route) {
  const kind = pages.has(route?.kind) ? route.kind : 'unknown';
  return { page: kind, component: 'app_feedback' };
}
export function createFeedbackModal({ doc, context, route, routeKey, clientRelease, now = () => new Date().toISOString() }) {
  const dialog = doc.createElement('dialog');
  dialog.setAttribute('aria-label', 'Share app feedback');
  dialog.className = 'panel feedback-modal';
  dialog.style.cssText = 'width:min(640px,calc(100% - 32px));max-height:85vh;overflow:auto;margin:auto';
  doc.body.append(dialog);
  let opener, identity, key, mounted = false, serial = 0;
  const close = () => dialog.close();
  const reset = () => { serial++; if (dialog.open) close(); dialog.replaceChildren(); mounted = false; };
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); });
  let outside = false;
  const isOutside = e => { const r = dialog.getBoundingClientRect(); return e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); };
  dialog.addEventListener('pointerdown', e => { outside = isOutside(e); });
  dialog.addEventListener('click', e => { if (outside && isOutside(e)) close(); outside = false; });
  return { reset, async open(from) {
    const ctx = context();
    if (mounted && (identity !== ctx.identity || key !== routeKey())) reset();
    opener = from;
    if (!mounted) {
      identity = ctx.identity; key = routeKey(); const mine = ++serial;
      const experience = { occurred_at: now(), surface: 'web', host: 'browser', client_release: { ...clientRelease }, context: pageContext(route()) };
      const model = await feedback.load(ctx);
      if (mine !== serial || identity !== context().identity || key !== routeKey()) return;
      const root = doc.createElement('div');
      const bound = { ...ctx, feedbackModal: true, feedbackExperience: experience, isCurrent: () => mine === serial && identity === context().identity && key === routeKey() };
      root.innerHTML = feedback.render(bound, model);
      const closeButton = doc.createElement('button'); closeButton.type = 'button'; closeButton.textContent = 'Close'; closeButton.setAttribute('aria-label', 'Close feedback');
      closeButton.style.cssText = 'position:sticky;top:0;float:right;z-index:2;min-height:44px;background:var(--paper)';
      closeButton.onclick = close; dialog.append(closeButton, root);
      feedback.bind(bound, root, model);
      root.querySelector('[data-feedback-close]')?.addEventListener('click', close);
      mounted = true;
    }
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('textarea,button')?.focus({ preventScroll: true });
  } };
}
