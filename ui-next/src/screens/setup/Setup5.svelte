<!-- UI Next (v4) Setup step 5 "Ready to launch". Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/setup.json (summary, phoneSummary).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Setup5.dc.html (desktop), Setup5Phone.dc.html (phone, w=phone).
     A summary row per step with Edit back to it, the lock note, and the page's one .btn-primary "Launch the survey" (to Collect).
     A blank facilitator reads "Not set", quiet (app PR 502 ui/v3/wizard.js:420 per the board's provenance). -->
<script>
  import SetupFrame, { stepHref } from "./SetupFrame.svelte";
  import Glyph from "./Glyph.svelte";
  import data from "../../../fixtures/setup/setup.json";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`setup5: the board draws one state, got "${String(state)}"`);
  const COLLECT = "?screen=collect";
</script>

<SetupFrame {phone} {theme} step={5} title="Ready to launch" next={{ label: "Launch the survey", href: `${COLLECT}${phone ? "&w=phone" : ""}` }}>
  {#if phone}
    <p class="small">Check it over. You can change dates and details later.</p>
    <div class="su-summary">
      {#each data.phoneSummary as r}
        <div class="l-row su-line" data-split data-gap="3">
          <span class="l-stack" data-gap="1"><span class="micro">{r.label}</span>{#if r.value}<span class="h3">{r.value}</span>{:else}<span class="small">Not set</span>{/if}</span>
          <a class="link" href={stepHref(r.step, true)} aria-label={`Edit ${r.label}`}>Edit</a>
        </div>
      {/each}
    </div>
  {:else}
    <div class="su-summary">
      {#each data.summary as r}
        <div class="su-sumrow">
          <span class="lbl">{r.label}</span>
          <div class="t-15">
            {#if r.lines}<span class="l-stack" data-gap="1">{#each r.lines as [b, rest]}<span><strong>{b}</strong> · {rest}</span>{/each}</span>
            {:else if !r.main}<span class="small">Not set</span>
            {:else}{#if r.strong}<strong>{r.main}</strong>{:else}{r.main}{/if}{#if r.sub}<br /><span class="small">{r.sub}</span>{/if}{/if}
          </div>
          <a class="link" href={stepHref(r.step)} aria-label={`Edit ${r.label}`}>Edit</a>
        </div>
      {/each}
    </div>
    <div class="solid su-tile l-row" data-gap="4">
      <span class="icn icn-lens" data-lens="team" aria-hidden="true"><Glyph name="lock" /></span>
      <div class="l-stack" data-gap="1"><div class="h3">When you launch, the questions are locked so everyone answers the same survey.</div><p class="small">You can still change the dates, the passage file and the answer languages, and add people who can see results.</p></div>
    </div>
  {/if}
</SetupFrame>
