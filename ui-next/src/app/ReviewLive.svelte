<!-- UI Next (v4) Review page, live. Status: provisional. One review (GET /v2/assessments/:id): its stage, surveys with their counts, and the
     stage's actions — open collection (POST /stage collect), the collection room, results and reports. The current design's assessment
     page is the behaviour reference (ui/assess/views.js); the composition follows the Collect/Results boards' review head. -->
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Card from "../Card.svelte";
  import Row from "../Row.svelte";
  import Stack from "../Stack.svelte";
  import Section from "../Section.svelte";
  import Pill from "../Pill.svelte";
  import Button from "../Button.svelte";
  import PhoneBar from "../PhoneBar.svelte";
  import LensDot from "../LensDot.svelte";
  import Chrome from "./Chrome.svelte";
  import { to } from "./router.js";
  import { STAGE_OF, lensKeyOf } from "./data.js";
  let { phone = false, theme = "light", chrome, assessment: a, surveys = [], project, onstage } = $props();
  const pill = $derived(STAGE_OF[a.stage] ?? "setup");
  const live = $derived(surveys.filter((s) => !s.archived_at));
  const crumbs = $derived([{ label: "Home", href: to("home") }, ...(project ? [{ label: project.name, href: to("project", { pid: project.id }) }] : []), { label: a.name }]);
  const canEdit = $derived(["owner", "member"].includes(a.role));
  let busy = $state(false), error = $state("");
  const move = (stage) => async () => { busy = true; error = ""; try { await onstage(stage); } catch (e) { error = e?.message || "The stage could not be changed."; } finally { busy = false; } };
  const primary = $derived(a.stage === "prepare" ? { label: "Open collection", stage: "collect" } : a.stage === "collect" ? { label: "Open the collection room", href: to("qr-room", { aid: a.id }) } : { label: "See the results", href: to("results", { aid: a.id }) });
</script>

{#snippet top()}<Chrome {chrome} {crumbs} title={a.name} parent={project?.name ?? "Home"} back={project ? to("project", { pid: project.id }) : to("home")} />{/snippet}
{#snippet bar()}{#if phone}{#if primary.href}<PhoneBar label={primary.label} href={primary.href} />{:else}<div class="glass phone-bar" role="group" aria-label="Page actions"><button class="btn btn-primary btn-lg btn-block" type="button" onclick={move(primary.stage)} disabled={busy || !canEdit || !live.length}>{primary.label}</button></div>{/if}{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  <Page gap={5}>
    <Stack gap={2}>
      <span class="micro">{project?.name ?? ""}{a.language_name ? ` · ${a.language_name}` : ""}{a.format ? ` · ${a.format}` : ""}</span>
      <Row split wrap gap={3}><h1 class={phone ? "title-phone" : "title-page"}>{a.name}</h1><Pill stage={pill} /></Row>
      {#if a.purpose}<p class="small">{a.purpose}</p>{/if}
    </Stack>
    {#if !phone}
      <Row wrap gap={2}>
        {#if primary.href}<Button label={primary.label} variant="primary" href={primary.href} />{:else}<button class="btn btn-primary" type="button" onclick={move(primary.stage)} disabled={busy || !canEdit || !live.length}>{busy ? "Opening…" : primary.label}</button>{/if}
        {#if a.stage !== "prepare"}<Button label="Collection" href={to("collect", { aid: a.id })} /><Button label="Results" href={to("results", { aid: a.id })} /><Button label="Report" href={to("report", { aid: a.id })} />{/if}
        <Button label="Open in the current design" variant="quiet" href={`/#assessment/${encodeURIComponent(a.id)}`} />
      </Row>
    {/if}
    {#if error}<p class="small field-error" role="alert">{error}</p>{/if}
    {#if a.stage === "prepare" && !live.length}<Card gap={2}><p class="small">No surveys are selected yet. Choose them in the <a class="link" href={`/#assessment/${encodeURIComponent(a.id)}`}>current design</a>, then open collection here.</p></Card>{/if}
    <Section heading="Surveys" help={`${live.length} selected`}>
      {#each live as s (s.id)}
        <Card gap={1}>
          <Row wrap gap={3}><LensDot lens={lensKeyOf(s.perspective) ?? "team"} decorative /><span class="h3">{s.template_name || s.template_id}</span><span class="small">{s.perspective}</span><span class="small">{s.collection_status === "open" ? "collecting" : "closed"}</span></Row>
        </Card>
      {/each}
    </Section>
    {#if a.stage === "collect" && canEdit}
      <Row wrap gap={2}><Button label="Close collection and look at results" variant="quiet" href={to("close-collection", { aid: a.id })} /></Row>
    {/if}
  </Page>
</AppShell>
