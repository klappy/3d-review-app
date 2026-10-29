<!-- UI Next (v4) Landing screen (public, signed-out entry). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas, branch next-copy-about-canvas, PR #186): Landing.dc.html (desktop), LandingPhone.dc.html (phone).
     Composed only of AppShell > Page > Section > Card / Stack / Row / Grid and the section 2 components (TopBar public, PhoneHeader public,
     PhoneBar, Button, Disclosure); no <style>, no inline style. Rachel's copy (C01 hero, C02 lead) from ../copy/rachel.js only.
     FAQ rows are Disclosures (design-system.md V-12 moves LandingPhone's .dd accordions to .disc). One .btn-primary: "Try the sample review"
     (desktop hero; phone: the phone-bar). No About link: no Landing board draws one (cook auggie-next-type-2300). Type sizes use the section 1.2 type rows (.lead, .t-15). -->
<script>
  import { screenHref } from "../route.js";
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Mark from "../Mark.svelte";
  import Section from "../Section.svelte";
  import Card from "../Card.svelte";
  import Icon from "../Icon.svelte";
  import MediaCard from "../MediaCard.svelte";
  import { I } from "../icons.js";
  import Stack from "../Stack.svelte";
  import Row from "../Row.svelte";
  import Grid from "../Grid.svelte";
  import TopBar from "../TopBar.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import PhoneBar from "../PhoneBar.svelte";
  import Button from "../Button.svelte";
  import Disclosure from "../Disclosure.svelte";
  import { C01, C02 } from "../copy/rachel.js";

  // videoSrc: the intro video through the Transcode proxy (generate_transcode_url) once it exists; absent = placeholder frame (Media card contract).
  // home (live, signed in): the logo goes to the signed-in home, not back to this page (cookbook work/active/2026-10-26-3d-logged-in-home).
  let { phone = false, theme = "light", w, videoSrc, home } = $props();
  let SELF = $derived(screenHref("landing", { phone, theme, w }));
  const LOGO = $derived(home ?? SELF);
  const SAMPLE = "#results", VIDEO = "#video", CODE = "#survey-code", HELP = "#help";
  const PERSPECTIVES = [
    ["team", "Translation team", "How the team prepares, reviews and decides a passage is ready."],
    ["community", "Community", "Whether people understand, trust and use the translation."],
    ["church", "Church", "Whether pastors and leaders are involved and confident enough to use it."],
  ];
  const STEPS = [
    ["Prepare", "Name the review, attach the passage, choose who will take part."],
    ["Collect", "Each survey gets a link or a printed copy. People answer in their own language."],
    ["Understand", "Levels for each perspective, and the gaps between them."],
    ["Improve", "Choose what to talk about and plan the next step together."],
  ];
  const FAQ = [
    ["Is this a test of the translation?", "No. 3D Review looks at the process around the text — how people prepare, review, understand and use it. Your checking tools keep checking the words."],
    ["Who answers?", "The translation team, the community and the church, each with a short survey of their own. Nobody needs an account."],
    ["What do we get back?", "Levels for each perspective, side by side, and the gaps between them — then a next step your team chooses."],
    ["Does it replace a consultant?", "No. It gives the consultant and the team the same picture of how the work is landing."],
  ];
  const FAQ_PHONE = [
    ["Is this a test of the translation?", "No. It shows how the three perspectives see it, so the team knows where to work next."],
    ["Who answers?", "Translators, community members and church leaders — a few minutes each."],
    ["What do we get back?", "Levels, not scores: where each perspective is strong and where it needs support."],
    ["Does it replace a consultant?", "No. It gives the consultant and the team the same picture to start from."],
  ];
</script>

{#snippet top()}{#if phone}<PhoneHeader state="public" home={LOGO} />{:else}<TopBar variant="public" home={LOGO} />{/if}{/snippet}
{#snippet trail()}<Icon d={I.arrow} />{/snippet}
{#snippet lead()}<Icon d={I.play} />{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Try the sample review" href={SAMPLE} />{/if}{/snippet}

<AppShell {phone} {theme} screen rhythm="marketing" {top} {bar}>
  {#if phone}
    <Card hi pad="hero" gap={3}>
      <div><Mark size={44} /></div>
      <h1 class="title-phone">{C01}</h1>
      <p class="small t-15">{C02}</p>
      <a class="link" href={VIDEO}>Watch how it works · 2 min</a>
    </Card>
    <Card pad="list" gap={1} label="Common questions">
      {#each FAQ_PHONE as [q, a]}<Disclosure label={q} solid={false}><p class="small">{a}</p></Disclosure>{/each}
      <a class="link small" href={HELP}>All questions and the facilitator guide</a>
    </Card>
    <p class="small">Have a survey code? <a class="link" href={CODE}>Enter it here</a></p>
  {:else}
    <Page gap={8}>
      <Section>
        <Grid template="hero-landing">
          <Stack gap={4}>
            <h1 class="display">{C01}</h1>
            <p class="small lead">{C02}</p>
            <Row wrap gap={3}><Button label="Try the sample review" variant="primary" lg href={SAMPLE} {trail} /><Button label="Watch how it works · 2 min" lg href={VIDEO} {lead} /></Row>
            <p class="micro">No account needed to explore the sample. Facilitators sign in with an email link.</p>
          </Stack>
          <MediaCard title="What 3D Review is" duration="2:10" caption="One short video explains the three perspectives and what a review gives you." src={videoSrc} />
        </Grid>
      </Section>
      <Section>
        <h2 class="h1">Three perspectives on one translation</h2>
        <Grid cols={3} gap={4}>
          {#each PERSPECTIVES as [lens, name, text]}<Card gap={2} label={name}><span class="icn icn-lens" data-lens={lens} aria-hidden="true"><Icon d={I.people} /></span><h3 class="h2">{name}</h3><p class="small t-15">{text}</p></Card>{/each}
        </Grid>
        <p class="small">The answers are never averaged into one number. A confident team and a confused community is the most useful thing a review can show you.</p>
      </Section>
      <Section>
        <h2 class="h1">How a review runs</h2>
        <Grid cols={4} gap={4}>
          {#each STEPS as [name, text], i}<Row gap={3}><span class="num">{i + 1}</span><Stack gap={1}><h3 class="h3">{name}</h3><p class="small">{text}</p></Stack></Row>{/each}
        </Grid>
      </Section>
      <Section>
        <h2 class="h1">Common questions</h2>
        <Stack gap={2}>{#each FAQ as [q, a]}<Disclosure label={q}><p class="small t-15">{a}</p></Disclosure>{/each}</Stack>
        <a class="link" href={HELP}>All questions and the facilitator guide</a>
      </Section>
      <Section>
        <Row split wrap gap={3}><span class="small">3D Review · a project of the ETEN Innovation Lab</span><span class="small">Have a survey code? <a class="link" href={CODE}>Enter it here</a></span></Row>
      </Section>
    </Page>
  {/if}
</AppShell>
