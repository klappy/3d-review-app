<!-- UI Next (v4) Setup step 1 "Details". Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/setup.json (details).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Setup1.dc.html (desktop), Setup1Phone.dc.html (phone, w=phone).
     Fields per section 2 Field, Language search and "Setup details: location and facilitator" rows; Translation format is an option-row radio group
     (R10). One .btn-primary: Continue (desktop card footer; phone-bar). Wiring debt: the draft (ui/v3/wizard.js freshDraft / saveWip) is not
     imported: it wired nothing here and pulled the whole wizard graph into /next/ (RESULTS-setup.md Round 2, F3). -->
<script>
  import Stack from "../../Stack.svelte";
  import Grid from "../../Grid.svelte";
  import SetupFrame from "./SetupFrame.svelte";
  import Field from "./Field.svelte";
  import Select from "./Select.svelte";
  import LangSearch from "./LangSearch.svelte";
  import data from "../../../fixtures/setup/setup.json";

  // The board draws one state; the route's ?state= prop is not read, so any value (unknown included) renders it and never throws.
  let { phone = false, theme = "light" } = $props();
  const d = data.details;
</script>

<SetupFrame {phone} {theme} step={1} title="Tell us about this review" phoneTitle="Details">
  {#if phone}
    <Field label="Name this review" id="n"><input class="in" id="n" value={d.name} /></Field>
    <Field label="Project" id="p"><Select id="p" options={d.projects} value={d.phoneProject} /></Field>
    <Field label="Language being reviewed" id="l" help="Search by name or code. Not listed? Add language."><LangSearch id="l" query={d.languageQuery} language={d.language} matches={d.matches} describedby="l-help" /></Field>
    <Field label="Location or community" id="lc" opt help="Where the sessions happen: a village, town or congregation."><input class="in" id="lc" value={d.location} aria-describedby="lc-help" /></Field>
    <Field label="Facilitator" id="fc" opt help="The person who leads the sessions. Leave blank if it varies."><input class="in" id="fc" value={d.facilitator} placeholder="Who leads the sessions" aria-describedby="fc-help" /></Field>
    <Field label="Format" id="f"><Select id="f" options={d.phoneFormats} value={d.format} /></Field>
    <Field label="Open until" id="d" opt><input class="in" id="d" type="date" value={d.closes} /></Field>
  {:else}
    <Stack gap={5}>
      <Field label="Name this review" id="name" help="Something your team will recognise later, like the passage or the workshop."><input class="in" id="name" value={d.name} aria-describedby="name-help" /></Field>
      <Grid cols={2} gap={5}>
        <Field label="Project" id="proj" help="A project is one translation. Put every review of it here so you can compare over time."><Select id="proj" options={d.projects} value={d.project} describedby="proj-help" /></Field>
        <Field label="Language being reviewed" id="lang" help="Search by name or code, then choose one. Not listed? Add language."><LangSearch id="lang" query={d.languageQuery} language={d.language} matches={d.matches} describedby="lang-help" /></Field>
      </Grid>
      <Grid cols={2} gap={5}>
        <Field label="Location or community" id="loc" opt help="Where the sessions happen: a village, town or congregation."><input class="in" id="loc" value={d.location} aria-describedby="loc-help" /></Field>
        <Field label="Facilitator" id="fac" opt help="The person who leads the sessions. Leave blank if it varies."><input class="in" id="fac" value={d.facilitator} placeholder="Who leads the sessions" aria-describedby="fac-help" /></Field>
      </Grid>
      <Field label="Translation format" id="fmt" group help="Decides which community survey people get.">
        <Grid cols={3} gap={2}>{#each d.formats as f}<label class="row-opt"><input class="rd" type="radio" name="fmt" value={f} checked={f === d.format} /><span>{f}</span></label>{/each}</Grid>
      </Field>
      <Grid cols={2} gap={5}>
        <Field label="Survey opens" id="open" opt><input class="in" id="open" type="date" value={d.opens} /></Field>
        <Field label="Survey closes" id="close" help="Results stay held until this date passes or you close collection."><input class="in" id="close" type="date" value={d.closes} aria-describedby="close-help" /></Field>
      </Grid>
    </Stack>
  {/if}
</SetupFrame>
