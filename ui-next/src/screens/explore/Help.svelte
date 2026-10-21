<!-- UI Next (v4) Help screen ("Help and FAQ"). Status: provisional (playbook rule 12). Explore lane of the screens fanout.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Help.dc.html (desktop), HelpPhone.dc.html (phone). Copy: ./help-copy.js, word for word.
     Composed only of AppShell > Page > Section > Card / Stack / Row / Grid and the section 2 components (TopBar, PhoneHeader nested,
     Disclosure for every FAQ and topic row, Media card, chip links); no <style>, no inline style.
     Contract gaps (rule 11, cookbook PR canvas-explore-gaps; RESULTS-explore.md): the 260px/1fr side-nav grid with its sticky glass nav,
     the horizontal media card, the 24px section heading. Until they land the desktop uses the phone board's chip nav, the section 2 Media card
     in a Grid track and .h2.
     One .btn-primary per page: none on desktop (the board draws none); phone "Send app feedback" in the phone-bar. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Section from "../../Section.svelte";
  import Card from "../../Card.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Button from "../../Button.svelte";
  import Disclosure from "../../Disclosure.svelte";
  import MediaCard from "../../MediaCard.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { E } from "./icons.js";
  import { INTRO, VIDEO, TOPICS, FAQ, FAQ_TITLE } from "./help-copy.js";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`Help: the boards draw one state, got "${String(state)}"`);
  const HOME = "?screen=home";
  const FEEDBACK = phone ? "?screen=feedback&w=phone" : "?screen=feedback";
  const ABOUT = phone ? "?screen=about&w=phone" : "?screen=about";
  const [FAQ_ID, FAQ_HEAD] = FAQ_TITLE;
  const NAV = [...TOPICS.map(([id, title]) => [id, title]), [FAQ_ID, FAQ_HEAD]];
</script>

{#snippet pen()}<Icon d={E.pen} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Help and FAQ" parent="Home" back={HOME} />{:else}<TopBar home={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Send app feedback" variant="primary" lg block href={FEEDBACK} lead={pen} /></div>{/if}{/snippet}
{#snippet nav()}<nav aria-label="Help sections"><Row wrap gap={2}>{#each NAV as [id, title]}<a class="chip" href={`#${id}`}>{title}</a>{/each}</Row></nav>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">Help and FAQ</h1>
    {@render nav()}
    <Card pad="list" gap={1} label="Help topics">
      {#each TOPICS as [id, title, , text], i}<div id={id}><Disclosure label={title} open={i === 0} solid={false}><p class="small">{text}</p></Disclosure></div>{/each}
    </Card>
    <h2 class="micro" id={FAQ_ID}>{FAQ_HEAD} · {FAQ.length}</h2>
    <Card pad="list" gap={1} label={FAQ_HEAD}>
      {#each FAQ as [q, a]}<Disclosure label={q} solid={false}><p class="small">{a}</p></Disclosure>{/each}
    </Card>
    <a class="link" href={ABOUT}>Read why 3D Review exists <Icon d={I.arrow} /></a>
  {:else}
    <Page width="narrow" gap={6}>
      <Section>
        <Stack gap={1}>
          <h1 class="title-page">Help and FAQ</h1>
          <p class="small body-16">{INTRO}</p>
        </Stack>
        {@render nav()}
        <Grid cols={3}><MediaCard title={VIDEO.title} duration={VIDEO.duration} caption={VIDEO.also} /></Grid>
      </Section>
      {#each TOPICS as [id, title, runs]}
        <section class="l-section" id={id}>
          <h2 class="h2">{title}</h2>
          <p class="small body-16">{#each runs as run, i}{#if i % 2}<strong>{run}</strong>{:else}{run}{/if}{/each}</p>
        </section>
      {/each}
      <section class="l-section" id={FAQ_ID}>
        <h2 class="h2">{FAQ_HEAD}</h2>
        <Stack gap={2}>{#each FAQ as [q, a]}<Disclosure label={q}><p class="small t-15">{a}</p></Disclosure>{/each}</Stack>
      </section>
      <Section>
        <p class="small">Still stuck? <a class="link" href={FEEDBACK}>Send app feedback</a>, or read <a class="link" href={ABOUT}>why 3D Review exists</a>.</p>
      </Section>
    </Page>
  {/if}
</AppShell>
