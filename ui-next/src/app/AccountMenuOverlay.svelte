<!-- Live account navigation is local to the existing view; no synthetic Home or aggregate-read loading page. -->
<script>
  import { tick } from "svelte";
  import { themeOf } from "../theme.svelte.js";
  import ThemeControl from '../ThemeControl.svelte';
  import Row from '../Row.svelte';
  import Ico from '../screens/actions/Ico.svelte';
  import IconAction from '../screens/actions/IconAction.svelte';
  import { A } from '../screens/actions/icons.js';
  import { modal, closeDialog } from '../screens/actions/modal.js';
  import '../../components/loading.css';
  let { theme='light', data=null, pending=false, error='', onclose=()=>{}, onretry=()=>{} }=$props();
  let sheet=$state();
  $effect(() => { if (!data || pending) return; let cancelled = false; tick().then(() => { if (!cancelled && sheet?.open) sheet.querySelector('[data-autofocus]')?.focus(); }); return () => { cancelled = true; }; });
  function dismiss() { closeDialog(sheet); onclose(); }
</script>
<div class="app account-overlay-root" data-theme={themeOf(theme)}>
  <dialog class="glass-hi sheet" data-pad="menu" aria-labelledby="live-menu-who" bind:this={sheet} {@attach modal} onclose={onclose} oncancel={e=>{e.preventDefault();dismiss();}}>
    <div class="sheet-handle" aria-hidden="true"></div>
    <Row split gap={2}><p class="micro sheet-title" id="live-menu-who">{data?.who ?? 'Workspace and account'}</p><IconAction d={A.x} ariaLabel="Close" onclick={dismiss} /></Row>
    {#if pending}<p class="small" role="status">Checking sign-in…</p>{/if}
    {#if error}<p class="small" role="alert">{error}</p><button class="btn" type="button" onclick={onretry}>Retry menu</button>{/if}
    {#if data}
      <nav aria-label="Workspace and account" aria-busy={pending}>
        {#each data.items as [icon,label,link,onclick],i}
          {#if typeof onclick==='function'}<button class="mi" data-size="lg" type="button" {onclick} disabled={pending} data-autofocus={i===0?'':undefined}><Ico d={A[icon]} /><span>{label}</span></button>
          {:else}<a class="mi" data-size="lg" href={link} data-autofocus={i===0?'':undefined}><Ico d={A[icon]} /><span>{label}</span></a>{/if}
          {#if label==='Public website home'}<ThemeControl uid="live-account" />{/if}
        {/each}
      </nav>
    {/if}
  </dialog>
</div>
