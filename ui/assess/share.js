// Share card for ONE survey (leaf page) — product brief row "Survey": outcome-first sharing with confirmed copy, QR, invitation
// sheet, revoke this session's link. Behaviour reference: legacy ui/app.js issue-link-* + ui/shared-link.js (staff side).
// Credential discipline (unchanged from legacy): the link token is shown ONCE, lives only in this module's in-memory model for
// the survey it was minted for, is never written to storage, never logged, never echoed into the URL, and is cleared when the
// identity, assessment, survey or data epoch changes. Revoke uses the link id, never the token.
// APIs (existing): POST /v2/assessments/{aid}/surveys/{sid}/links {params:{}, mode:'dry_run'|'execute', confirm_token}
//                  DELETE /v2/assessments/{aid}/surveys/{sid}/links/{link_id}
import { shareUrl } from '../shared-link.js';
import qrcode from './vendor-qrcode.js';

export const CAN_SHARE = new Set(['owner', 'member']); // issue_link / revoke_link roles O, M (contract rows)
export const copy = Object.freeze({
  title: 'Share this survey',
  lead: 'Share a link, show a QR code or print invitations. Anyone with the link can answer without an account. Nothing is emailed from here.',
  open: 'Share survey', copyLink: 'Copy link', copied: 'Link copied.',
  qr: 'Show QR code', hideQr: 'Hide QR code', sheet: 'Print invitations',
  revoke: 'Revoke this link',
  revoked: 'Link revoked. It no longer opens; answers already sent stay with the team.',
  onceShown: 'Keep a copy of this link before leaving. It is only available on this page for now.',
  readOnly: 'Your role here cannot share participant links (owner or member can).',
  notCollecting: 'This assessment is not collecting: the link opens only while the stage is Collect.',
  uncertain: 'The request may have created a link, but its result was not received. Trying again may create another link. Nothing was emailed.',
});

export function blankShare() { return { stage: 'idle', open: false, confirm: null, deadline: 0, link: null, qr: false, message: null, alert: false }; }
// share model keyed to (aid, sid, epoch) — assess.js drops it whenever any of those changes.
export function shareFor(state, aid, sid, epoch) {
  const s = state.share;
  if (s && s.aid === aid && s.sid === sid && s.epoch === epoch) return s;
  state.share = { aid, sid, epoch, ...blankShare() };
  return state.share;
}

export function qrSvg(url) { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }

export function render(ctx, { current, survey, share }) {
  const esc = ctx.esc, role = current.assessment.role;
  if (!CAN_SHARE.has(role)) return `<section class="panel" data-share><p class="eyebrow">Share</p><h2>${esc(copy.title)}</h2><p class="muted">${esc(copy.readOnly)}</p></section>`;
  const collecting = survey.collection_status === 'open' || current.assessment.stage === 'collect';
  const busy = share.stage === 'busy';
  const link = share.link;
  const ready = !!link || share.stage === 'ready';
  const actions = !share.open
    ? `<button type="button" class="primary" data-share-open>${esc(copy.open)}</button>`
    : `<p class="note small">${link ? 'Use the same link below.' : `Choose how to share ${esc(survey.template_name || 'this survey')}. Your choice makes a participant link available.`} You can revoke the link later; answers already sent stay with the team.</p>
      ${link ? `<div class="share-link"><p data-share-url><code>${esc(link.url)}</code></p>${link.expires_at ? `<p class="small muted">Expires ${esc(link.expires_at)}</p>` : ''}</div>` : ''}
      <div class="actions">${ready || busy ? `<button type="button" class="primary" data-share-copy ${busy ? 'disabled' : ''}>${esc(copy.copyLink)}</button><button type="button" data-share-qr ${busy ? 'disabled' : ''}>${esc(share.qr ? copy.hideQr : copy.qr)}</button><button type="button" data-share-sheet ${busy ? 'disabled' : ''}>${esc(copy.sheet)}</button>` : `<button type="button" data-share-open>Try sharing again</button>`}${link ? `<button type="button" class="quiet" data-share-revoke ${busy ? 'disabled' : ''}>${esc(copy.revoke)}</button>` : ''}<button type="button" class="quiet" data-share-close ${busy ? 'disabled' : ''}>Close</button></div>
      ${share.qr && link ? `<figure class="share-qr" data-share-qr-figure>${qrSvg(link.url)}<figcaption class="small muted">Scan to open the survey</figcaption></figure>` : ''}${link ? `<p class="small muted">${esc(copy.onceShown)}</p>` : ''}`;
  return `<section class="panel" data-share><p class="eyebrow">Share</p><h2>${esc(copy.title)}</h2><p class="muted">${esc(copy.lead)}</p>${collecting ? '' : `<p class="small muted">${esc(copy.notCollecting)}</p>`}${actions}<p class="small ${share.alert ? 'alert' : 'muted'}" role="status" data-share-status>${esc(share.message || '')}</p></section>`;
}

// Invitation sheet: a print-only element mounted directly on <body> (same approach as the blank-survey print, Auditor 2A-1),
// removed after printing. Carries the URL, the QR and plain instructions; nothing else about the project.
export function invitationSheetHtml(ctx, { current, survey, url }) {
  const esc = ctx.esc;
  return `<div class="share-sheet-print"><h1>${esc(survey.template_name || 'Survey')}</h1><p>${esc(current.assessment.name)}${survey.perspective ? ` · ${esc(survey.perspective)} perspective` : ''}</p><p>Open this link on your phone or computer to answer. No account is needed. Your answers stay with the team.</p><p class="share-sheet-url">${esc(url)}</p><div class="share-sheet-qr">${qrSvg(url)}</div><p>Or scan the code with your camera.</p></div>`;
}

export function bind(ctx, root, { current, survey, share, api, onChange, print = () => globalThis.print?.(), clipboard = globalThis.navigator?.clipboard, doc = globalThis.document, origin = globalThis.location?.origin, now = Date.now }) {
  const aid = current.assessment.id, sid = survey.id, base = `/v2/assessments/${ctx.enc(aid)}/surveys/${ctx.enc(sid)}/links`;
  // The model stays current until identity, survey or epoch changes. A same-page paint disconnects this root; that must
  // not blank the model or skip onChange. Copy/print still require the bound node so a gone page cannot receive a credential.
  const same = () => !ctx.isCurrent || ctx.isCurrent();
  const live = () => root.isConnected !== false && same();
  const update = () => { if (same()) onChange(); };
  const say = (message, alert = false) => { share.message = message; share.alert = alert; update(); };
  const fail = (message) => { share.stage = share.link ? 'linked' : 'idle'; say(message, true); };
  root.querySelector('[data-share-open]')?.addEventListener('click', async () => {
    if (!live() || share.stage === 'busy') return;
    share.open = true;
    if (share.link) { update(); return; }
    share.stage = 'busy'; share.confirm = null; say('Getting sharing options ready…');
    try {
      const r = await api(base, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
      if (!same()) { Object.assign(share, blankShare()); return; }
      if (!r.confirm_token || !(r.expires_in > 0)) throw new Error('Invalid preparation');
      share.confirm = r.confirm_token; share.deadline = now() + r.expires_in * 1000; share.stage = 'ready'; say('');
    } catch { if (!same()) { Object.assign(share, blankShare()); return; } fail('Sharing options could not be prepared. Try again, or sign in if your session has ended.'); }
  });
  root.querySelector('[data-share-close]')?.addEventListener('click', () => {
    if (share.stage === 'busy') return;
    share.open = false; share.qr = false; share.confirm = null; share.stage = share.link ? 'linked' : 'idle'; say('');
  });
  const deliver = async action => {
    if (!live() || share.stage === 'busy' || !CAN_SHARE.has(current.assessment.role)) return;
    if (!share.link) {
      if (!share.confirm || now() >= share.deadline) { share.confirm = null; fail('Sharing options expired. Try sharing again.'); return; }
      const confirm_token = share.confirm;
      share.confirm = null; share.stage = 'busy'; say('Preparing your link…');
      try {
        const r = await api(base, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token } });
        if (!same()) { Object.assign(share, blankShare(), { message: copy.uncertain, alert: true }); return; }
        if (!r.link_id || typeof r.entry_fragment !== 'string' || !/^#survey=[A-Za-z0-9_-]+$/.test(r.entry_fragment)) throw new Error('Incomplete result');
        share.link = { id: r.link_id, url: shareUrl(origin, r.entry_fragment), expires_at: r.expires_at || null };
      } catch (e) {
        if (!same()) { Object.assign(share, blankShare(), { message: copy.uncertain, alert: true }); return; }
        fail(['CONFIRM_EXPIRED', 'CONFIRM_REQUIRED'].includes(e.code) ? 'Sharing options expired. Try sharing again.' : e.status === 401 || e.status === 403 ? 'You no longer have permission to share. Sign in and check your access.' : copy.uncertain);
        return;
      }
    }
    if (!same()) return;
    share.stage = 'linked'; say('');
    if (!live()) return;
    if (action === 'qr') { share.qr = !share.qr; update(); return; }
    if (action === 'copy') {
      try { await clipboard.writeText(share.link.url); if (same()) say(copy.copied); }
      catch { if (same()) say('Your link is ready. Press Copy link again, or select the link text and copy it.', true); }
      return;
    }
    try {
      const sheet = doc.createElement('div'); sheet.className = 'stage-print-only share-sheet'; sheet.innerHTML = invitationSheetHtml(ctx, { current, survey, url: share.link.url });
      doc.body.append(sheet); try { print(); } finally { sheet.remove(); }
    } catch { if (same()) say('Your link is ready, but printing did not open. Press Print invitations again.', true); }
  };
  root.querySelector('[data-share-copy]')?.addEventListener('click', () => deliver('copy'));
  root.querySelector('[data-share-qr]')?.addEventListener('click', () => deliver('qr'));
  root.querySelector('[data-share-sheet]')?.addEventListener('click', () => deliver('sheet'));
  root.querySelector('[data-share-revoke]')?.addEventListener('click', async () => {
    if (!live() || share.stage === 'busy' || !share.link) return;
    share.stage = 'busy'; update();
    try {
      await api(`${base}/${ctx.enc(share.link.id)}`, { method: 'DELETE' });
      if (!same()) return;
      Object.assign(share, blankShare()); say(copy.revoked);
    } catch { if (same()) fail('Revocation could not be confirmed. The link may still work. Try revoking it again.'); }
  });
}

// B36 (Bincy checklist): one row per group — "Group · Survey", then Copy link and Show QR code as secondary buttons, one tap
// each. The same copy strings, QR and clipboard path as the Share card above; used on the launched screen and on Collect.
// `url` is known on the launched screen; on Collect it is issued on the first tap (issueLink) and kept in memory only.
export function groupLinks(ctx, rows) {
  const esc = ctx.esc;
  return `<ul class="share-groups" data-group-links>${rows.map(r => `<li class="share-group" data-group-link="${esc(r.key)}"><span class="share-group-label" data-group-label>${esc(r.group)} <span aria-hidden="true">·</span> ${esc(r.survey)}</span>${r.url ? `<input class="share-group-url" readonly aria-label="${esc(`${r.group} · ${r.survey} link`)}" value="${esc(r.url)}">` : ''}<span class="share-group-actions"><button type="button" data-group-copy="${esc(r.key)}">${esc(copy.copyLink)}</button><button type="button" data-group-qr="${esc(r.key)}" aria-expanded="false">${esc(copy.qr)}</button></span><span class="small muted" role="status" data-group-status></span><div class="share-qr" data-group-qr-figure hidden></div></li>`).join('')}</ul>`;
}

// resolve(key) → Promise<url>. Delegated on `root`, so a repaint of the rows needs no rebinding.
export function bindGroupLinks(root, { resolve, clipboard = globalThis.navigator?.clipboard, signal } = {}) {
  const busy = new Set();
  root.addEventListener('click', async e => {
    const b = e.target?.closest?.('[data-group-copy],[data-group-qr]'); if (!b) return;
    const row = b.closest('[data-group-link]'); if (!row) return;
    const key = b.dataset.groupCopy ?? b.dataset.groupQr, isQr = b.dataset.groupQr !== undefined;
    const status = row.querySelector('[data-group-status]'), fig = row.querySelector('[data-group-qr-figure]');
    const say = (t, alert = false) => { if (status) { status.textContent = t; status.className = `small ${alert ? 'alert' : 'muted'}`; } };
    if (isQr && fig && !fig.hidden) { fig.hidden = true; fig.innerHTML = ''; b.textContent = copy.qr; b.setAttribute('aria-expanded', 'false'); return; }
    if (busy.has(key)) return; busy.add(key);
    let url;
    try { url = await resolve(key); } catch { busy.delete(key); say('The link could not be prepared. Try again, or sign in if your session has ended.', true); return; }
    busy.delete(key);
    if (!url) { say('The link could not be prepared. Try again.', true); return; }
    if (isQr) { if (fig) { fig.innerHTML = `${qrSvg(url)}<p class="small muted">Scan to open the survey</p>`; fig.hidden = false; } b.textContent = copy.hideQr; b.setAttribute('aria-expanded', 'true'); say(''); return; }
    try { await clipboard.writeText(url); say(copy.copied); } catch { say(`Copy did not work. Select and copy: ${url}`, true); }
  }, signal ? { signal } : undefined);
}

// Collect: issue one participant link for a survey in one tap (dry_run → execute, the Share card's API pair). The token is
// returned to the caller only; never stored, never logged.
export async function issueLink(api, { aid, sid, origin = globalThis.location?.origin, enc = encodeURIComponent }) {
  const base = `/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/links`;
  const d = await api(base, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
  if (!d?.confirm_token) throw new Error('Invalid preparation');
  const r = await api(base, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token: d.confirm_token } });
  if (!r?.link_id || typeof r.entry_fragment !== 'string' || !/^#survey=[A-Za-z0-9_-]+$/.test(r.entry_fragment)) throw new Error('Incomplete result');
  return { id: r.link_id, url: shareUrl(origin, r.entry_fragment), expires_at: r.expires_at || null };
}

export const css = `.share-groups{list-style:none;padding:0;margin:10px 0;display:grid;gap:10px}.share-group{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.share-group-label{font-weight:600;flex:1 1 180px;min-width:0}.share-group-url{flex:1 1 100%;min-width:0;font-size:13px}.share-group-actions{display:flex;gap:6px;flex-wrap:wrap}.share-group [data-group-status]{flex:1 1 100%;word-break:break-all}.share-group [data-group-status]:empty{display:none}.share-group .share-qr{flex:1 1 100%}.share-link code{word-break:break-all;user-select:all}.share-qr{margin:14px 0 0;max-width:220px}.share-qr svg{width:100%;height:auto;display:block;background:#fff;border-radius:8px}.share-sheet{display:none}@media print{.share-sheet{display:block}.share-sheet-print{font:16px/1.5 sans-serif;padding:24px;max-width:640px}.share-sheet-url{word-break:break-all;font-family:monospace;font-size:15px}.share-sheet-qr svg{width:240px;height:240px}}`;
