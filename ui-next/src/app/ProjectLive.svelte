<!-- UI Next (v4) Project page, live. Status: provisional. The project's reviews (GET /v2/projects/:id/assessments), newest first, each a
     link to its review page; the Setup lane's Project board drives the composition (screens/setup/Project.svelte), data from the store. -->
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Card from "../Card.svelte";
  import Row from "../Row.svelte";
  import Section from "../Section.svelte";
  import Pill from "../Pill.svelte";
  import PhoneBar from "../PhoneBar.svelte";
  import Chrome from "./Chrome.svelte";
  import { to } from "./router.js";
  import { STAGE_OF } from "./data.js";
  let { phone = false, theme = "light", chrome, project, assessments = [] } = $props();
  const rows = $derived(assessments.filter((a) => !a.archived_at).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).map((a) => ({ ...a, pill: STAGE_OF[a.stage] ?? "setup", href: to("review", { aid: a.id }) })));
  const crumbs = $derived([{ label: "Home", href: to("home") }, { label: project.name }]);
</script>

{#snippet top()}<Chrome {chrome} {crumbs} title={project.name} parent="Home" back={to("home")} />{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Start a 3D Review" lead="plus" href={`/#new`} />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  <Page gap={5}>
    <Row split wrap gap={3}><h1 class={phone ? "title-phone" : "title-page"}>{project.name}</h1>{#if project.organization}<span class="small">{project.organization}</span>{/if}</Row>
    <Section heading="Reviews" help={rows.length ? "newest first" : "none yet"}>
      {#if !rows.length}<Card gap={2}><p class="small">No reviews in this project yet. <a class="link" href="/#new">Start a 3D Review</a> in the current design.</p></Card>{/if}
      {#each rows as r (r.id)}
        <Card href={r.href} gap={2}>
          <Row wrap gap={3}><h3 class="h2">{r.name}</h3><Pill stage={r.pill} /></Row>
          <span class="small">{[r.language_name, r.format, `${r.response_count ?? 0} responses`].filter(Boolean).join(" · ")}</span>
        </Card>
      {/each}
    </Section>
  </Page>
</AppShell>
