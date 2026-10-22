<!-- UI Next (v4) Home, live. Status: provisional. The Home board (screens/Home.svelte, state "reviews" / "first") drawn from the account's
     real projects and reviews (app/data.js homeModel): one card per review, grouped by stage, each a link to its own page. "Start a 3D Review"
     opens the current design's four-step wizard (/#new), which already creates the review for real; the ported Setup screens stay a preview. -->
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Section from "../Section.svelte";
  import Card from "../Card.svelte";
  import Stack from "../Stack.svelte";
  import Row from "../Row.svelte";
  import PhoneBar from "../PhoneBar.svelte";
  import Button from "../Button.svelte";
  import Pill from "../Pill.svelte";
  import Icon from "../Icon.svelte";
  import { I } from "../icons.js";
  import Chrome from "./Chrome.svelte";
  import { to } from "./router.js";
  let { phone = false, theme = "light", chrome, home, note } = $props();
  const ARROW = "M5 12h14M13 6l6 6-6 6";
  const HEAD = { results: ["Results ready", "read and plan the next step"], collecting: ["Collecting", "share the link or QR, watch the counts"], setup: ["Setup not finished", "pick up where you left off"] };
  const START = "/#new";
  const NOTE = { workspaces: "Workspaces", workspace: "Workspace", people: "People", "people-workspace": "People", invitations: "Invitations", explore: "Explore", setup: "Setup" };
</script>

{#snippet plus()}<Icon d={I.plus} />{/snippet}
{#snippet arrow()}<Icon d={ARROW} />{/snippet}
{#snippet top()}<Chrome {chrome} workspace={home.workspace} workspaces={home.workspaces} />{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Start a 3D Review" lead="plus" href={START} />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if note}<Card gap={1}><span class="micro">{NOTE[note] ?? note}</span><p class="small">This section is not in the new design yet; it is still there in the <a class="link" href="/">current design</a>. Your reviews are below.</p></Card>{/if}
  {#if phone}
    <Row split gap={3}><h1 class="title-phone">Your reviews</h1><span class="small">{home.workspace}</span></Row>
    {#if home.empty}
      <Card hi gap={3}><span class="micro">Welcome, {chrome.who?.first ?? "there"}</span><h2 class="h2">Your first 3D Review takes about ten minutes to set up.</h2><p class="small">Start one, or ask a project owner to invite you.</p></Card>
    {/if}
    {#each home.groups as g (g.stage)}
      {#each g.reviews as r (r.id)}
        <Card href={r.href} gap={2}>
          <span class="micro">{r.project}</span>
          <Row wrap gap={2}><span class="h2">{r.title}</span><Pill stage={g.stage} /></Row>
          <span class="small">{r.meta}</span>
          <span class="link">{r.action}</span>
        </Card>
      {/each}
    {/each}
    {#if home.projects.length}
      <details class="dd"><summary class="link small">Projects · {home.projects.length}</summary>
        <Stack gap={2}>{#each home.projects as p (p.id)}<a class="card-link solid l-card l-stack" href={to("project", { pid: p.id })} data-gap="1"><span class="h3">{p.name}</span><span class="small">{p.assessment_count ?? 0} reviews</span></a>{/each}</Stack>
      </details>
    {/if}
  {:else}
    <Page gap={5}>
      <Row split wrap gap={3}>
        <h1 class="title-page">Your reviews</h1>
        <Row gap={2}><Button label="Current design" variant="quiet" href="/" /><Button label="Start a 3D Review" variant="primary" href={START} lead={plus} /></Row>
      </Row>
      {#if home.empty}
        <Card hi gap={5} label="Welcome">
          <Stack gap={3}>
            <span class="micro">Welcome, {chrome.who?.first ?? "there"}</span>
            <h2 class="display">Your first 3D Review takes about ten minutes to set up.</h2>
            <p>You have not started one yet. Start the real thing — you can change anything until you launch — or ask a project owner to invite you.</p>
            <Row wrap gap={3}><Button label="Start a 3D Review" href={START} lead={plus} /><a class="link" href={to("about")}>Why 3D Review exists</a></Row>
          </Stack>
        </Card>
      {/if}
      {#each home.groups as g (g.stage)}
        <Section heading={HEAD[g.stage][0]} help={HEAD[g.stage][1]}>
          {#each g.reviews as r (r.id)}
            <Card href={r.href} gap={3}>
              <span class="micro">{r.project}</span>
              <Row wrap gap={3}><h3 class="h2">{r.title}</h3><Pill stage={g.stage} /></Row>
              <Row wrap gap={4}><span class="small">{r.meta}</span></Row>
              <Row><span class="btn">{r.action}<Icon d={ARROW} /></span></Row>
            </Card>
          {/each}
        </Section>
      {/each}
      {#if home.projects.length}
        <Section heading="Projects" help="each project holds its reviews">
          <div class="l-grid" data-cols="3" data-gap="4">{#each home.projects as p (p.id)}<Card href={to("project", { pid: p.id })} gap={1}><span class="h3">{p.name}</span><span class="small">{p.assessment_count ?? 0} reviews · {p.response_count ?? 0} responses</span></Card>{/each}</div>
        </Section>
      {/if}
    </Page>
  {/if}
</AppShell>
