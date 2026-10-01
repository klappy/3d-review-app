// App feedback uses the existing contract. No page contents, answers or credentials are captured.
const scores = [['satisfaction', 'How satisfied are you?', 'Very dissatisfied', 'Very satisfied'], ['confusion', 'How confused did you feel?', 'Not at all confused', 'Very confused'], ['frustration', 'How frustrated did you feel?', 'Not at all frustrated', 'Very frustrated']];
export const feedback = {
  async load(ctx) { return { allowed: !ctx.demo && !!ctx.state.principal && ctx.state.principal.kind !== 'anonymous' }; },
  // modal: S54 — the same form inside a dialog over the current screen; "Back to home" becomes Close and the heading is the dialog's label.
  render(ctx, model, { modal = false } = {}) {
    const heading = text => modal ? `<h2 id="feedback-dialog-title">${text}</h2>` : `<h1>${text}</h1>`;
    const leave = modal ? '<button type="button" data-feedback-close>Close</button>' : null;
    const signIn = '<p>Sign in to share feedback about using 3D Review. The sample tour does not send feedback.</p><a class="button" href="/v2/auth/access">Sign in</a>';
    if (!model.allowed && modal) return `<section>${heading('App feedback')}${signIn} ${leave}</section>`;
    if (!model.allowed) return '<section class="panel narrow"><h1>App feedback</h1><p>Sign in to share feedback about using 3D Review. The sample tour does not send feedback.</p><a class="button" href="/v2/auth/access">Sign in</a> <a href="/">Back to home</a></section>';
    return `<section class="${modal ? '' : 'panel narrow'}">${heading('Share app feedback')}<p>Report a problem or suggest an improvement to 3D Review.</p><p class="small muted">All fields are optional. Your feedback is linked to your signed-in account and is available to authorized support. Please do not include survey answers, other people's personal details, passwords or access codes. Nothing from the page is attached automatically.</p><form id="app-feedback"><label class="field">What happened, or what would you improve?<textarea name="note" rows="5" aria-describedby="feedback-note-hint"></textarea></label><p id="feedback-note-hint" class="small muted">For a problem, tell us what happened and what you expected. For a suggestion, describe what would help. ${modal ? 'Your draft stays here until you close this window or reload.' : 'Your draft stays here until you leave or reload.'}</p><details><summary>Rate your experience (optional)</summary><label class="field">Was the app helpful?<select name="helpful"><option value="">Not answered</option><option value="true">Yes</option><option value="false">No</option></select></label>${scores.map(([key, label, low, high]) => `<label class="field">${label}<select name="${key}"><option value="">Not answered</option>${[1,2,3,4,5].map(n => `<option value="${n}">${n}${n === 1 ? ' — ' + low : n === 5 ? ' — ' + high : ''}</option>`).join('')}</select></label>`).join('')}<label class="field">How did the experience change as you went?<input name="sentiment_journey" maxlength="128" placeholder="For example: confused → clear"></label><p class="small muted">Optional short description, up to 128 characters.</p></details><div class="actions"><button type="submit" class="primary">Send feedback</button>${leave || '<a href="#">Back to home</a>'}</div></form><p id="feedback-status" role="status" aria-live="polite"></p><div id="feedback-receipt"></div></section>`;
  },
  bind(ctx, root, model) {
    const form = root.querySelector('#app-feedback'); if (!form || !model.allowed) return;
    const status = root.querySelector('#feedback-status'), receipt = root.querySelector('#feedback-receipt');
    const button = form.querySelector('button[type=submit]'); let busy = false, recorded = false, uncertain = false;
    const current = () => root.isConnected && ctx.isCurrent();
    form.onsubmit = async event => {
      event.preventDefault(); if (!current() || busy || recorded) return;
      const body = {};
      for (const name of ['helpful', 'note', ...scores.map(s => s[0]), 'sentiment_journey']) {
        const value = form.elements.namedItem(name).value;
        if (value === '') continue;
        if (name === 'helpful') { if (!['true','false'].includes(value)) return; body[name] = value === 'true'; }
        else if (scores.some(s => s[0] === name)) { const score = Number(value); if (!Number.isInteger(score) || score < 1 || score > 5) return; body[name] = score; }
        else body[name] = value;
      }
      if (!Object.keys(body).length) { status.textContent = 'Add a note or choose an answer before sending.'; return; }
      if (new TextEncoder().encode(body.note || '').length > 4096 || (body.sentiment_journey || '').length > 128) { status.textContent = 'Your note or experience description is too long. Shorten it and send again.'; return; }
      busy = true; status.textContent = uncertain ? 'Sending again. This may create a duplicate if the earlier request arrived.' : 'Sending feedback…';
      const controls = [...form.querySelectorAll('input,textarea,select,button:not([data-feedback-close])')]; controls.forEach(c => { c.disabled = true; });
      try {
        const result = await ctx.api('/v2/feedback', { method: 'POST', body: { ...body, require_authenticated: true } });
        if (!current()) return;
        if (result?.recorded !== true || typeof result.feedback_id !== 'string' || !result.feedback_id || result.stripped !== false) throw new Error('Unconfirmed receipt');
        recorded = true; status.textContent = 'Thank you. Your feedback was recorded.';
        receipt.textContent = `Feedback reference: ${result.feedback_id}`; button.textContent = 'Feedback sent';
      } catch (error) {
        if (!current()) return;
        const code = String(error.code || '');
        if (['401','NOT_AUTHENTICATED'].includes(code)) {
          status.textContent = 'Your sign-in is no longer active. Your text is still here; copy it before signing in again.';
          const link = root.ownerDocument.createElement('a'); link.href = '/v2/auth/access'; link.textContent = ' Sign in again'; status.append(link);
        } else if (['403','404','NOT_AUTHORIZED','NOT_AUTHORIZED_AT_SCOPE','NOT_FOUND_OR_NOT_VISIBLE'].includes(code)) status.textContent = 'Feedback was refused for this account. Your text is still here.';
        else if (['400','INVALID_PARAMS'].includes(code)) status.textContent = 'Feedback was not accepted. Check your answers and text length; your draft is still here.';
        else if (code === '429' || code === 'RATE_LIMITED') status.textContent = 'Too many requests. Wait before trying again; your draft is still here.';
        else { uncertain = true; status.textContent = 'We could not confirm whether your feedback was recorded. Your text is still here. Sending again may create a duplicate; nothing will retry automatically.'; }
        button.textContent = uncertain ? 'Send again (may duplicate)' : 'Send feedback';
      } finally {
        busy = false;
        if (current() && !recorded) controls.forEach(c => { c.disabled = false; });
      }
    };
  }
};

// S54 (captain fb_c9324db7e9774c59a89b): open the feedback form in place, over the current screen, without touching location.hash.
// The screen underneath is never re-rendered: closing (Close, Escape, backdrop) removes only the dialog and returns focus to `returnFocus`.
// Same render/bind as the #feedback route, so validation, POST body and receipt/error copy are identical; the route stays as the deep-link fallback.
export async function openFeedbackDialog(ctx, { doc = document, returnFocus = null } = {}) {
  doc.getElementById('feedback-dialog')?.remove();
  const dialog = doc.createElement('dialog');
  dialog.id = 'feedback-dialog'; dialog.className = 'panel'; dialog.setAttribute('aria-labelledby', 'feedback-dialog-title');
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  const model = await feedback.load(ctx);
  dialog.innerHTML = feedback.render(ctx, model, { modal: true });
  doc.body.append(dialog);
  feedback.bind({ ...ctx, isCurrent: () => !closed && ctx.isCurrent() }, dialog, model);
  const onBackdrop = event => { // a click on the dialog box itself (its padding) is inside; only the ::backdrop area outside the box closes
    if (event.target !== dialog) return false;
    const r = dialog.getBoundingClientRect();
    return !r.width || event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
  };
  // rev444: a drag that starts in the form and is released on the backdrop must not close (and lose the draft); only a press that
  // also began on the backdrop counts. The press target is recorded on the dialog element and checked on click.
  let pressedOnBackdrop = false;
  for (const type of ['pointerdown', 'mousedown']) dialog.addEventListener(type, event => { pressedOnBackdrop = onBackdrop(event); });
  dialog.addEventListener('click', event => {
    const backdrop = pressedOnBackdrop && onBackdrop(event); pressedOnBackdrop = false;
    if (backdrop || event.target.closest?.('[data-feedback-close]')) close();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); // Escape
  dialog.addEventListener('close', close);
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  (dialog.querySelector('textarea, a[href], button') || dialog).focus();
  return { dialog, close };
}
