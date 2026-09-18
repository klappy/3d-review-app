import { copy, createSharedLinkClient, currentNamespace, digestNamespace, entryFailureKind, errorKind, parseEntryFragment, rememberCurrent, resolveConflict, restoreDraft, saveDraft, scopedStorage, stripFragment, submitFailureKind } from '../shared-link.js';

// Only the existing participant client owns transport. No staff identity is read.
export function createParticipantJourney({ window: win, storage, fetchImpl, onChange = () => {} }) {
  let client, store, form, answers, uncertain = false, busy = false;
  let state = { phase: 'opening', notice: copy.labelOpening };
  const show = (phase, extra = {}) => { state = { phase, form, answers, busy, ...extra }; onChange(state); return state; };
  const unavailable = kind => show('unavailable', { notice: ({ closed: copy.collectionClosed, cannotResume: copy.cannotResume, rateLimited: copy.rateLimited, transient: copy.transient })[kind] || copy.linkUnavailable });
  function receipt(result) {
    store.remove('draft'); store.remove('submitKey'); uncertain = false;
    return show('receipt', { receipt: result, notice: `${copy.receiptThanks} ${copy.sameLinkOthers}` });
  }
  async function loadForm() {
    form = await client.form();
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
    async start() {
      return action(async () => {
        // Strip before the first async operation; malformed credentials cannot fall through to staff.
        const hash = win.location.hash;
        const token = parseEntryFragment(hash);
        if (hash) stripFragment(win);
        if (hash && token === null) return unavailable('unavailable');
        const namespace = token === null ? currentNamespace(storage) : await digestNamespace(token);
        if (!namespace) return unavailable('unavailable');
        store = scopedStorage(storage, namespace);
        client = createSharedLinkClient({ store, fetchImpl });
        rememberCurrent(storage, namespace);
        if (token !== null) {
          try { await client.open(token); }
          catch (e) { const kind = entryFailureKind(e, !!client.bearer); return kind === 'conflict' ? conflict() : unavailable(kind); }
        } else if (!client.bearer) return unavailable('cannotResume');
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
    async submit() {
      if (state.phase !== 'review' || !answers) return;
      return action(async () => {
        try { return receipt(await client.submit(answers)); }
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
