<!-- UI Next (v4) Setup step 4 "About each group". Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/setup.json (groups, context).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Setup4.dc.html (desktop), Setup4Phone.dc.html (phone, w=phone).
     One disclosure per survey chosen in step 3 ("About this group (optional)", B09 group context, R30), then the participant questions card
     (age range, gender; off by default, skippable). Disclosures are details.disc (V-12: never .dd, which means a menu; the boards still draw .dd).
     Wiring: the questions and their types are ui/v3/components/context-fields.js GROUP_FIELDS / RESPONDENT_FIELDS (the browser mirror of
     src/context-fields.ts); the surveys are the checked roles of the fixture's groups. One .btn-primary: Continue. -->
<script>
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import Tag from "../../Tag.svelte";
  import SetupFrame from "./SetupFrame.svelte";
  import Field from "./Field.svelte";
  import Glyph from "./Glyph.svelte";
  import { groupFields, RESPONDENT_FIELDS } from "../../../../ui/v3/components/context-fields.js";
  import data from "../../../fixtures/setup/setup.json";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`setup4: the board draws one state, got "${String(state)}"`);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const values = (g) => data.context.values[g.perspective] ?? {};
  // One survey per checked role (team, church) or per group (community): the surveys step 3 chose.
  const SURVEYS = data.groups.flatMap((g) => (g.roles ? g.roles.filter((r) => r.checked).map((r) => ({ g, name: r.name, expected: r.expected })) : [{ g, name: g.name, expected: g.expected }]))
    .map((s) => ({ ...s, key: slug(s.name), fields: groupFields(s.g.perspective) }));
</script>

{#snippet chev()}<span class="disc-chev" aria-hidden="true"><Glyph name="chev" /></span>{/snippet}
{#snippet control(s, f)}{#if f.type === "count"}<input class="in num tab-n" type="number" min="0" inputmode="numeric" id={`${s.key}-${f.key}`} value={values(s.g)[f.key] ?? ""} />{:else}<input class="in" maxlength="200" id={`${s.key}-${f.key}`} value={values(s.g)[f.key] ?? ""} />{/if}{/snippet}

<SetupFrame {phone} {theme} step={4} title="About each group">
  {#if phone}
    <p class="small">Optional, once per survey — not per person. No names. Once the draft is saved with a survey, its questions are hidden.</p>
    <div class="l-stack su-ctx su-groups" data-gap="1">
      {#each data.groups as g}
        {@const mine = SURVEYS.filter((s) => s.g === g)}
        <details class="disc" open={g.perspective === data.context.open}>
          <summary class="disc-sum h3"><span class="icn icn-lens su-icn-s" data-lens={g.lens} aria-hidden="true"><Glyph name="people" size={14} /></span><span class="su-name" data-grow>{g.name}</span>{@render chev()}</summary>
          <div class="disc-body l-stack" data-gap="2">
            {#each mine as s}
              <Field label={g.roles ? `${s.name} · How many do you expect?` : "How many do you expect?"} id={`${s.key}-expected`} opt><input class="in" type="number" min="1" inputmode="numeric" id={`${s.key}-expected`} value={s.expected} /></Field>
            {/each}
            {#each mine as s}
              <details class="disc" open={g.perspective === data.context.open}>
                <summary class="disc-sum"><span class="l-stack su-name" data-gap="1" data-grow><span class="micro">{s.name}</span><span class="h3">About this group <span class="opt">(optional) · {s.fields.length}</span></span></span>{@render chev()}</summary>
                <div class="disc-body l-stack" data-gap="2">{#each s.fields as f}<Field label={f.label} id={`${s.key}-${f.key}`} opt>{@render control(s, f)}</Field>{/each}</div>
              </details>
            {/each}
          </div>
        </details>
      {/each}
    </div>
    <p class="small">Your responses are confidential.</p>
  {:else}
    <Stack gap={5}>
      <div class="glass l-card l-stack su-ctx" data-gap="1" role="group" aria-labelledby="ctx-h">
        <div class="h3" id="ctx-h">Describe each group you invited</div>
        <p class="small">Answer these now, once per survey you chose — not per person. All optional, nothing here asks for a name. Once the draft is saved with a survey, its questions are hidden.</p>
        {#each SURVEYS as s}
          <details class="disc" open={s.g.perspective === data.context.open}>
            <summary class="disc-sum"><span class="icn icn-lens su-icn-s" data-lens={s.g.lens} aria-hidden="true"><Glyph name="people" size={14} /></span><span class="su-name" data-grow><span class="h3">{s.name}</span> <span class="small">· {s.g.name}</span></span><span class="small">About this group <span class="opt">(optional)</span> · {s.fields.length} questions</span>{@render chev()}</summary>
            <div class="disc-body"><Grid cols={3} gap={4}>{#each s.fields as f}<Field label={f.label} id={`${s.key}-${f.key}`} opt>{@render control(s, f)}</Field>{/each}</Grid></div>
          </details>
        {/each}
        <p class="small">Your responses are confidential.</p>
      </div>
      <div class="glass l-card l-stack" data-gap="3" role="group" aria-labelledby="dem-h">
        <Row gap={3}><span class="h3" id="dem-h">Ask each participant about themselves</span><Tag label="Off by default" /></Row>
        <Grid cols={2} gap={2}>{#each RESPONDENT_FIELDS as f}<label class="row-opt compact"><input class="cb" type="checkbox" checked={data.context.demographics} /><span>{f.label}</span></label>{/each}</Grid>
        <p class="small">Asked once, before the survey questions. Both are skippable. When on, results and the answer list can be split by them.</p>
      </div>
    </Stack>
  {/if}
</SetupFrame>
