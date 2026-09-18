// Share card for ONE survey (leaf page) — product brief row "Survey": preview → create link (two-step), copy, QR, invitation
// sheet, revoke this session's link. Behaviour reference: legacy ui/app.js issue-link-* + ui/shared-link.js (staff side).
// Credential discipline (unchanged from legacy): the link token is shown ONCE, lives only in this module's in-memory model for
// the survey it was minted for, is never written to storage, never logged, never echoed into the URL, and is cleared when the
// identity, assessment, survey or data epoch changes. Revoke uses the link id, never the token.
// APIs (existing): POST /v2/assessments/{aid}/surveys/{sid}/links {params:{}, mode:'dry_run'|'execute', confirm_token}
//                  DELETE /v2/assessments/{aid}/surveys/{sid}/links/{link_id}
import { copy as sharedCopy, shareUrl } from '../shared-link.js';
import qrcode from './vendor-qrcode.js';

export const CAN_SHARE = new Set(['owner', 'member']); // issue_link / revoke_link roles O, M (contract rows)
export const copy = Object.freeze({
  title: 'Share this survey',
  lead: 'Create a participant link, then copy it, show its QR code or print an invitation sheet. Anyone with the link can answer; nothing is sent from here.',
  preview: 'Preview link',
  create: sharedCopy.issueConfirm,
  copyLink: sharedCopy.copyLink,
  copied: sharedCopy.linkCopied,
  qr: 'Show QR code',
  hideQr: 'Hide QR code',
  sheet: 'Print invitation sheet',
  revoke: 'Revoke this link',
  revoked: 'Link revoked. It no longer opens; answers already sent stay with the team.',
  onceShown: sharedCopy.issueDone,
  previewAgain: sharedCopy.previewAgain || 'Preview the link again.',
  readOnly: 'Your role here cannot create participant links (owner or member can).',
  notCollecting: 'This assessment is not collecting: a link can be created, but it opens only while the stage is Collect.',
});

export function blankShare() { return { stage: 'idle', confirm: null, expiresIn: null, impact: null, link: null, qr: false, copied: false, message: null, alert: false }; }
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
  const actions = link
    ? `<div class="share-link"><p class="eyebrow">Participant link · shown once</p><p class="note small" data-share-url><code>${esc(link.url)}</code></p>${link.expires_at ? `<p class="small muted">Expires ${esc(link.expires_at)}</p>` : ''}<div class="actions"><button type="button" class="primary" data-share-copy ${busy ? 'disabled' : ''}>${esc(copy.copyLink)}</button><button type="button" data-share-qr ${busy ? 'disabled' : ''}>${esc(share.qr ? copy.hideQr : copy.qr)}</button><button type="button" data-share-sheet ${busy ? 'disabled' : ''}>${esc(copy.sheet)}</button><button type="button" class="quiet" data-share-revoke ${busy ? 'disabled' : ''}>${esc(copy.revoke)}</button></div>${share.qr ? `<figure class="share-qr" data-share-qr-figure>${qrSvg(link.url)}<figcaption class="small muted">Scan to open the survey</figcaption></figure>` : ''}<p class="small muted">${esc(copy.onceShown)}</p></div>`
    : share.stage === 'previewed'
      ? `<p class="note small" data-share-impact>${esc(sharedCopy.issuePreview)} ${share.impact ? `Effect: ${esc(share.impact.effect || 'external')}; compensating control: ${esc(share.impact.compensating_control || '')}.` : ''} Confirmation expires in ${esc(share.expiresIn)} seconds.</p><div class="actions"><button type="button" class="primary" data-share-create ${busy ? 'disabled' : ''}>${esc(copy.create)}</button><button type="button" class="quiet" data-share-cancel ${busy ? 'disabled' : ''}>Cancel</button></div>`
      : `<div class="actions"><button type="button" class="primary" data-share-preview ${busy ? 'disabled' : ''}>${esc(copy.preview)}</button></div>`;
  return `<section class="panel" data-share><p class="eyebrow">Share</p><h2>${esc(copy.title)}</h2><p class="muted">${esc(copy.lead)}</p>${collecting ? '' : `<p class="small muted">${esc(copy.notCollecting)}</p>`}${actions}<p class="small ${share.alert ? 'alert' : 'muted'}" role="status" data-share-status>${esc(share.message || '')}</p></section>`;
}

// Invitation sheet: a print-only element mounted directly on <body> (same approach as the blank-survey print, Auditor 2A-1),
// removed after printing. Carries the URL, the QR and plain instructions; nothing else about the project.
export function invitationSheetHtml(ctx, { current, survey, url }) {
  const esc = ctx.esc;
  return `<div class="share-sheet-print"><h1>${esc(survey.template_name || 'Survey')}</h1><p>${esc(current.assessment.name)}${survey.perspective ? ` · ${esc(survey.perspective)} perspective` : ''}</p><p>Open this link on your phone or computer to answer. No account is needed. Your answers stay with the team.</p><p class="share-sheet-url">${esc(url)}</p><div class="share-sheet-qr">${qrSvg(url)}</div><p>Or scan the code with your camera.</p></div>`;
}

export function bind(ctx, root, { current, survey, share, api, onChange, print = () => globalThis.print?.(), clipboard = globalThis.navigator?.clipboard, doc = globalThis.document, origin = globalThis.location?.origin }) {
  const aid = current.assessment.id, sid = survey.id, base = `/v2/assessments/${ctx.enc(aid)}/surveys/${ctx.enc(sid)}/links`;
  const say = (message, alert = false) => { share.message = message; share.alert = alert; onChange(); };
  const run = async fn => { if (share.stage === 'busy') return; const before = share.stage; share.stage = 'busy'; onChange(); try { await fn(); } catch (e) { share.stage = before === 'busy' ? 'idle' : before; share.message = String(e.message || 'Request failed'); share.alert = true; onChange(); } };
  root.querySelector('[data-share-preview]')?.addEventListener('click', () => run(async () => {
    const r = await api(base, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
    share.confirm = r.confirm_token; share.expiresIn = r.expires_in; share.impact = r.impact || null; share.stage = 'previewed'; share.message = null; share.alert = false; onChange();
  }));
  root.querySelector('[data-share-cancel]')?.addEventListener('click', () => { Object.assign(share, blankShare()); onChange(); });
  root.querySelector('[data-share-create]')?.addEventListener('click', () => run(async () => {
    const confirm_token = share.confirm; if (!confirm_token) { share.stage = 'idle'; say(copy.previewAgain, true); return; }
    share.confirm = null;
    const r = await api(base, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token } });
    // The token leaves the response only as the once-shown URL held in memory; link_id is kept for revoke.
    share.link = { id: r.link_id, url: shareUrl(origin, r.entry_fragment), expires_at: r.expires_at || null }; share.stage = 'linked'; share.message = null; share.alert = false; onChange();
  }));
  root.querySelector('[data-share-copy]')?.addEventListener('click', async () => { try { await clipboard.writeText(share.link.url); say(copy.copied); } catch { say('Copy failed. Select the link text and copy it.', true); } });
  root.querySelector('[data-share-qr]')?.addEventListener('click', () => { share.qr = !share.qr; onChange(); });
  root.querySelector('[data-share-sheet]')?.addEventListener('click', () => {
    const sheet = doc.createElement('div'); sheet.className = 'stage-print-only share-sheet'; sheet.innerHTML = invitationSheetHtml(ctx, { current, survey, url: share.link.url });
    doc.body.append(sheet); try { print(); } finally { sheet.remove(); }
  });
  root.querySelector('[data-share-revoke]')?.addEventListener('click', () => run(async () => {
    const id = share.link.id; await api(`${base}/${ctx.enc(id)}`, { method: 'DELETE' });
    Object.assign(share, blankShare()); share.message = copy.revoked; onChange();
  }));
}

export const css = `.share-link code{word-break:break-all;user-select:all}.share-qr{margin:14px 0 0;max-width:220px}.share-qr svg{width:100%;height:auto;display:block;background:#fff;border-radius:8px}.share-sheet{display:none}@media print{.share-sheet{display:block}.share-sheet-print{font:16px/1.5 sans-serif;padding:24px;max-width:640px}.share-sheet-url{word-break:break-all;font-family:monospace;font-size:15px}.share-sheet-qr svg{width:240px;height:240px}}`;
