<script>
  import { onMount } from 'svelte';
  import AppShell from '../AppShell.svelte';
  import TopBar from '../TopBar.svelte';
  import PhoneHeader from '../PhoneHeader.svelte';
  import Page from '../Page.svelte';
  import Card from '../Card.svelte';
  import Row from '../Row.svelte';
  import Stack from '../Stack.svelte';
  import { token } from './api.js';
  import { to } from './router.js';
  import { createSurveyLinks } from './survey-links.js';
  let { aid, surveys = [], principalId, role, title = 'Review', phone = false, theme = 'light', user = {}, onrevoked, request } = $props();
  let state = $state({ stage: 'loading', sid: '', preview: null, link: null, message: '' });
  let flow;
  onMount(() => {
    const mountedHash = globalThis.location?.hash;
    flow = createSurveyLinks({ aid, surveys, principalId, role, request, context: () => ({ aid, principalId, bearer: token() }), onchange: next => { state = next; }, onrevoked });
    state = flow.state;
    const routeChanged = () => { if (globalThis.location?.hash !== mountedHash) flow.invalidate(); };
    const focus = () => { flow.recheck(); };
    globalThis.addEventListener('hashchange', routeChanged); globalThis.addEventListener('focus', focus);
    return () => { flow.dispose(); globalThis.removeEventListener('hashchange', routeChanged); globalThis.removeEventListener('focus', focus); };
  });
</script>
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Participant links" parent={title} back={to('collect',{aid})} initials={user.initials ?? ''} menuHref={to('menu',{}, {review:aid})} />{:else}<TopBar home={to('home')} who={user.first ?? ''} initials={user.initials ?? ''} crumbs={[{label:title,href:to('review',{aid})},{label:'Participant links'}]} />{/if}{/snippet}
<AppShell {phone} {theme} screen {top}>
  <Page width="read"><Card hi gap={4} label="Participant link management">
    <h1 class="h1">Participant links</h1>
    <p class="small">Anyone with an active link can answer its survey. Preview which survey you are sharing before confirming. Revoking a link does not delete answers already submitted.</p>
    <Stack gap={2}>
      <label class="lbl" for="survey-link-survey">Survey</label>
      <select class="in" id="survey-link-survey" value={state.sid} onchange={e => flow?.select(e.currentTarget.value)} disabled={['loading','busy','uncertain','changed','refused'].includes(state.stage)}>{#each surveys.filter(s=>!s.archived_at && (!s.state || s.state === 'selected')) as s}<option value={s.id}>{s.name || s.perspective || 'Survey'}</option>{/each}</select>
    </Stack>
    {#if state.stage === 'idle'}<button class="btn btn-primary" type="button" onclick={() => flow.prepare()} disabled={!state.sid}>Preview participant link</button>{/if}
    {#if state.stage === 'preview'}<section aria-label="Confirm survey link"><Stack gap={2}><h2 class="h3">{state.preview?.reuses ? 'Reuse the active participant link?' : 'Issue a participant link?'}</h2><p class="small">Survey: {surveys.find(s=>s.id === state.sid)?.name || surveys.find(s=>s.id === state.sid)?.perspective || 'Selected survey'}. Anyone receiving this link can answer. It remains active until revoked or expired.</p><Row gap={2}><button class="btn btn-primary" type="button" onclick={() => flow.confirm()}>Confirm link</button><button class="btn" type="button" onclick={() => flow.cancel()}>Cancel</button></Row></Stack></section>{/if}
    {#if state.link}<label class="lbl" for="survey-link-value">Participant link</label><input class="in" id="survey-link-value" readonly value={state.link.url} autocomplete="off" /><p class="small">Select and copy the link above. The value is held only on this page.</p>{/if}
    {#if state.stage === 'shown'}<Row gap={2}><button class="btn" type="button" onclick={() => flow.prepareRevoke()}>Revoke this link</button><button class="btn" type="button" onclick={() => flow.clear()}>Clear displayed link</button></Row>{/if}
    {#if state.stage === 'revoke-preview'}<section aria-label="Confirm link revocation"><p>Revoke this participant link? People with a shared copy will no longer be able to use it.</p><Row gap={2}><button class="btn" type="button" onclick={() => flow.revoke()}>Confirm revocation</button><button class="btn" type="button" onclick={() => flow.cancel()}>Cancel</button></Row></section>{/if}
    {#if state.message}<p class="small" role="status">{state.message}</p>{/if}
    {#if state.stage === 'busy'}<p class="small" role="status" aria-live="polite">Working…</p>{/if}
    <a class="link" href={to('collect',{aid})}>Back to Collect</a>
  </Card></Page>
</AppShell>
