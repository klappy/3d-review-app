<!-- UI Next (v4) Setup step 5 "Ready to launch". Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/setup.json (summary, phoneSummary).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Setup5.dc.html (desktop), Setup5Phone.dc.html (phone, w=phone).
     A summary row per step with Edit back to it, the lock note, and the page's one .btn-primary "Launch the survey" (to Collect).
     A blank facilitator reads "Not set", quiet (app PR 502 ui/v3/wizard.js:420 per the board's provenance).
     Rows marked derive=who|about in the fixture are computed by ./draft.js from step 3's checked state: the desktop text equals the board's;
     the phone leaves out Church, which SetupPhone unchecks (VALIDATION-setup-r2 N3; Setup5Phone still draws it: board line). -->
<script>
  import SetupFrame, { stepHref } from "./SetupFrame.svelte";
  import Glyph from "./Glyph.svelte";
  import { out } from "./links.js";
  import { surveys, whoLines, whoShort, aboutLine } from "./draft.js";
  import fixture from "../../../fixtures/setup/setup.json";

  // The board draws one state; the route's ?state= prop is not read, so any value (unknown included) renders it and never throws.
  // data: the fixture, or the live review in the same shape (app/data.js setupModel); onlaunch (live): opens collection for real before Collect.
  let { phone = false, theme = "light", data = fixture, onlaunch } = $props();
  const launching = (el) => { const f = (e) => { if (onlaunch && e.target instanceof Element && e.target.closest(".btn-primary")) { e.preventDefault(); onlaunch(); } }; el.addEventListener("click", f); return () => el.removeEventListener("click", f); };
  // Launch goes to the collect lane's Collect screen (links.js OUT "collect", registered in screens/collect/index.js).
  const COLLECT = $derived(out("collect", phone ? { w: "phone" } : {}));
  // "Who" and "About each group" say what steps 3 and 4 show (./draft.js; VALIDATION-setup-r2 N3); the phone reads step 3's phone state.
  const WHO = $derived(phone ? whoShort(data.groups, true) : whoLines(data.groups));
  const ABOUT = $derived(aboutLine(surveys(data.groups, phone), data.context.values, phone));
  const value = (r) => (r.derive === "who" ? WHO : r.derive === "about" ? ABOUT : r.value);
</script>

<div class="l-stack" {@attach launching}><SetupFrame {phone} {theme} step={5} title="Ready to launch" next={{ label: "Launch the survey", href: COLLECT, play: true }}>
  {#if phone}
    <p class="small">Check it over. You can change dates and details later.</p>
    {#each data.phoneSummary as r}
      <div class="l-row su-line" data-split data-gap="3">
        <span class="su-kv"><span class="micro">{r.label}</span>{#if value(r)}<span class="h3">{value(r)}</span>{:else}<span class="small">Not set</span>{/if}</span>
        <a class="link" href={stepHref(r.step, true)} aria-label={`Edit ${r.label}`}>Edit</a>
      </div>
    {/each}
  {:else}
    <div class="su-summary">
      {#each data.summary as r}
        <div class="su-sumrow">
          <span class="lbl">{r.label}</span>
          <div class="t-15">
            {#if r.derive === "who"}<span class="l-stack" data-gap="1">{#each WHO as [b, rest]}<span><strong>{b}</strong> · {rest}</span>{/each}</span>
            {:else if !(r.main || r.derive)}<span class="small">Not set</span>
            {:else}{@const main = r.derive === "about" ? ABOUT : r.main}{#if r.strong}<strong>{main}</strong>{:else}{main}{/if}{#if r.sub}<br /><span class="small">{r.sub}</span>{/if}{/if}
          </div>
          <a class="link" href={stepHref(r.step)} aria-label={`Edit ${r.label}`}>Edit</a>
        </div>
      {/each}
    </div>
    <div class="solid su-tile l-row" data-gap="4" data-align="start">
      <span class="icn icn-lens" data-lens="team" aria-hidden="true"><Glyph name="lock" /></span>
      <div class="l-stack" data-gap="1" data-grow><div class="h3">When you launch, the questions are locked so everyone answers the same survey.</div><p class="small">You can still change the dates, the passage file and the answer languages, and add people who can see results.</p></div>
    </div>
  {/if}
</SetupFrame></div>
