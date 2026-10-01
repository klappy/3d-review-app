import { copy, createSharedLinkClient, receiptNotice, currentNamespace, digestNamespace, entryFailureKind, errorKind, parseEntryFragment, rememberCurrent, resolveConflict, restoreDraft, saveDraft, scopedStorage, stripFragment, submitFailureKind } from '../shared-link.js';
import { closedLine } from '../v3/components/active-until.js';
import { SURVEYOR_EN } from './i18n.js';

// Only the existing participant client owns transport. No staff identity is read.
export function createParticipantJourney({ window: win, storage, fetchImpl, onChange = () => {} }) {
  let client, store, form, answers, context = {}, uncertain = false, busy = false;
  // S29 surveyor mode: the raw link token, in memory only (never storage, URL or log) so "Interview another person"
  // can open the same link again as a new respondent. Gone after a reload.
  let linkToken = null;
  let state = { phase: 'opening', notice: copy.labelOpening };
  const show = (phase, extra = {}) => { state = { phase, form, answers, busy, ...extra }; onChange(state); return state; };
  const unavailable = kind => show('unavailable', { notice: ({ closed: copy.collectionClosed, cannotResume: copy.cannotResume, rateLimited: copy.rateLimited, transient: copy.transient })[kind] || copy.linkUnavailable });
  function receipt(result) {
    store.remove('draft'); store.remove('submitKey'); uncertain = false;
    // thanks: the notice's inputs, so the page can say it in the participant's language (receiptNotice with its translator).
    const thanks = { perspective: form?.template?.perspective, code: store.get('via') === 'code' };
    return show('receipt', { receipt: result, notice: receiptNotice(thanks.perspective, { code: thanks.code }), thanks });
  }
  async function loadForm() {
    form = await client.form();
    // B41: after the review's Active until date the link shows one plain line instead of the survey.
    const closed = closedLine(form?.period);
    if (closed) return show('unavailable', { notice: closed });
    const draft = restoreDraft(store, form);
    if (draft?.mismatch) store.remove('draft');
    return show('form', { draft: draft?.answers || null, notice: draft?.mismatch ? copy.draftMismatch : draft?.answers ? copy.draftRestored : '' });
  }
  async function conflict() {
    const result = await resolveConflict(client);
    return result.state === 'receipt' ? receipt(result.receipt) : unavailable(result.state);
  }
  async function action(fn) {
    if (busy) return state;
    busy = true; onChange({ ...state, busy: true });
    try { return await fn(); }
    finally { busy = false; state = { ...state, busy: false }; onChange(state); }
  }
  return {
    get state() { return state; },
    // S23: the participant token this tab holds (null before the link opens), for the page's translate requests only.
    // It is the shared-link client's own bearer — never a staff token (this journey reads no staff identity).
    get bearer() { return client?.bearer || null; },
    async start() {
      return action(async () => {
        // Strip before the first async operation; malformed credentials cannot fall through to staff.
        const hash = win.location.hash;
        const token = parseEntryFragment(hash);
        if (hash) stripFragment(win);
        if (hash && token === null) return unavailable('unavailable');
        linkToken = token;
        const namespace = token === null ? currentNamespace(storage) : await digestNamespace(token);
        if (!namespace) return unavailable('unavailable');
        store = scopedStorage(storage, namespace);
        client = createSharedLinkClient({ store, fetchImpl });
        // Select this link even if opening fails, so reload cannot fall back to another link.
        // A namespace alone is not evidence that a participant session exists.
        rememberCurrent(storage, namespace);
        if (token !== null) {
          try { await client.open(token); }
          catch (e) { const kind = entryFailureKind(e, !!client.bearer); return kind === 'conflict' ? conflict() : unavailable(kind); }
        } else if (!client.bearer) return show('unavailable', { notice: 'Open your original survey link to continue. No participant session is available in this tab.' });
        try {
          const result = await client.receipt();
          return result.submitted ? receipt(result) : await loadForm();
        } catch (e) {
          const kind = token === null ? entryFailureKind(e, true) : errorKind(e);
          return kind === 'conflict' ? conflict() : unavailable(kind);
        }
      });
    },
    save(values) { if (form && store) saveDraft(store, form, values); },
    review(values) { if (busy || state.phase !== 'form') return; answers = values; show('review', { notice: uncertain ? copy.submitUncertain : '' }); },
    edit() { if (busy || state.phase !== 'review') return; show('form', { draft: answers, notice: uncertain ? copy.submitUncertain : '' }); },
    // B09: optional respondent context (age range, gender) from the "About you" block; empty sends nothing extra.
    setContext(value) { context = value && typeof value === 'object' ? { ...value } : {}; },
    async submit() {
      if (state.phase !== 'review' || !answers) return;
      return action(async () => {
        try { return receipt(await client.submit(answers, form?.demographics_enabled === true ? context : {})); } // S15a: nothing sent when off
        catch (e) {
          const kind = submitFailureKind(e);
          const unknown = () => { uncertain = true; return show('review', { notice: copy.submitUncertain }); };
          if (kind === 'uncertain') return unknown();
          if (kind === 'unavailable') return unavailable(uncertain ? 'cannotResume' : 'unavailable');
          try {
            const result = await client.receipt();
            if (result.submitted) return receipt(result);
            if (kind === 'conflict') return unavailable('closed');
            return uncertain ? unknown() : show('review', { notice: copy.submitFailed });
          } catch (probe) {
            return errorKind(probe) === 'unavailable' ? unavailable(uncertain ? 'cannotResume' : 'unavailable') : unknown();
          }
        }
      });
    },
    // S29 surveyor mode (Lovable parity): after a submit, start the next respondent on this device from the same link.
    // A link opened without a resume credential is a new respondent (src/handlers/shared-link.ts openSharedLink), so this
    // drops only this tab's bearer for the link and opens it again; the earlier response stays committed and its session
    // is not revoked. An access code works once (src/handlers/participant.ts redeem_code), so a code session goes back to
    // code entry. After a reload the token is gone: the tab lets go of the old session and asks for the link again.
    async another() {
      if (busy || state.phase !== 'receipt' || !store) return state;
      if (store.get('via') === 'code') { win.location.assign('/#survey'); return state; }
      const previous = store.get('bearer');
      const drop = () => { store.remove('bearer'); store.remove('draft'); store.remove('submitKey'); answers = undefined; context = {}; uncertain = false; };
      if (!linkToken) { drop(); client = createSharedLinkClient({ store, fetchImpl }); return show('unavailable', { notice: SURVEYOR_EN.openLinkForNext }); }
      return action(async () => {
        drop(); client = createSharedLinkClient({ store, fetchImpl });
        try { await client.open(linkToken); }
        catch (e) {
          if (previous) store.set('bearer', previous); client = createSharedLinkClient({ store, fetchImpl }); // the old session stays this tab's
          const kind = errorKind(e); return unavailable(kind === 'conflict' ? 'closed' : kind);
        }
        try { const next = await loadForm(); return next.phase === 'form' ? show('form', { draft: null, notice: SURVEYOR_EN.nextPerson, fresh: true }) : next; }
        catch (e) { return unavailable(errorKind(e)); }
      });
    },
    async recover() {
      if (!client || !client.bearer || state.phase === 'receipt') return;
      return action(async () => {
        try {
          const result = await client.receipt();
          if (result.submitted) return receipt(result);
          if (!form) return await loadForm();
          return show(state.phase, { draft: state.draft, notice: uncertain ? copy.submitUncertain : 'No submission recorded yet.' });
        } catch (e) {
          const kind = errorKind(e);
          if (kind === 'unavailable') return unavailable(uncertain ? 'cannotResume' : 'unavailable');
          if (kind === 'conflict') return conflict();
          return show(state.phase, { draft: state.draft, notice: uncertain ? copy.submitUncertain : kind === 'rateLimited' ? copy.rateLimited : copy.transient });
        }
      });
    },
  };
}
