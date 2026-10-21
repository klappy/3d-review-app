<!-- UI Next (v4) Setup step 3 "Who will participate?". Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/setup.json (groups).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Setup3.dc.html (desktop), SetupPhone.dc.html (phone: step 3 of 5, w=phone).
     Desktop: one perspective group per div.row-opt (R10 exception: it holds labelled controls), team and church with their role rows
     (.row-opt.compact) and an optional expected count per checked role (section 2 "Expected count", R31); community with the group stepper.
     Wiring: the "who" line under each group is ui/assess/scope.js PERSPECTIVE_WHO (the current UI's wording). One .btn-primary: Continue. -->
<script>
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import SetupFrame from "./SetupFrame.svelte";
  import Glyph from "./Glyph.svelte";
  import { PERSPECTIVE_WHO } from "../../../../ui/assess/scope.js";
  import data from "../../../fixtures/setup/setup.json";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`setup3: the board draws one state, got "${String(state)}"`);
</script>

{#snippet many(perRole)}<span class="small">How many? <span class="opt">(optional)</span>{#if perRole} · per role below{/if}</span>{/snippet}

<SetupFrame {phone} {theme} step={3} title="Who will participate?">
  {#if phone}
    <p class="small">Each group gets its own link.</p>
    <Stack gap={2}>
      {#each data.groups as g}
        <label class="row-opt"><input class="cb" type="checkbox" checked={g.phoneChecked ?? g.checked} /><span class="icn icn-lens" data-lens={g.lens} aria-hidden="true"><Glyph name="person" /></span><span class="l-stack" data-gap="1"><span class="h3">{g.name}</span><span class="small">{g.phoneNote}</span></span></label>
      {/each}
    </Stack>
  {:else}
    <Stack gap={4}>
      <p class="small t-15">Invite at least one group. Each group — and each role inside it — gets its own link, so answers are never mixed up.</p>
      {#each data.groups as g}
        <div class="row-opt su-group" role="group" aria-label={g.name}>
          <Row split gap={3}>
            <Row gap={4}>
              <input class="cb" type="checkbox" checked={g.checked} aria-label={`Invite ${g.name}`} />
              <span class="icn icn-lens" data-lens={g.lens} aria-hidden="true"><Glyph name="person" /></span>
              <div class="l-stack" data-gap="1"><div class="h3">{g.name}</div><p class="small">{PERSPECTIVE_WHO[g.lens]}</p></div>
            </Row>
            {#if g.roles}{@render many(true)}
            {:else}
              <Row gap={2}>{@render many(false)}<span class="seg su-stepper"><button class="btn btn-quiet btn-icon su-step" type="button" aria-label="Fewer">−</button><span class="num tab-n su-num" aria-label={`${g.expected} expected`}>{g.expected}</span><button class="btn btn-quiet btn-icon su-step" type="button" aria-label="More">+</button></span></Row>
            {/if}
          </Row>
          {#if g.roles}
            <Stack gap={1}>
              <div class="lbl">{g.rolesLabel}</div>
              <Grid cols={2} gap={2}>
                {#each g.roles as r}
                  <div class="row-opt compact">
                    <label class="su-role"><input class="cb" type="checkbox" checked={r.checked} /><span>{r.name}</span>{#if r.note}<span class="small">{r.note}</span>{/if}</label>
                    {#if r.checked}<input class="in num tab-n su-count" type="number" min="1" inputmode="numeric" aria-label={`How many ${r.name} do you expect? (optional)`} placeholder="—" value={r.expected} />{/if}
                  </div>
                {/each}
              </Grid>
            </Stack>
          {:else}
            <p class="small">They answer the <strong>{g.format}</strong> survey, to match the translation format.</p>
          {/if}
        </div>
      {/each}
    </Stack>
  {/if}
</SetupFrame>
