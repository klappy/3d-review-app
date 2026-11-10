<!-- UI Next (v4) About screen ("Why 3D Review exists"). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas, branch next-copy-about-canvas, PR #186): About.dc.html (desktop), AboutPhone.dc.html (phone).
     Composed only of AppShell > Page > Section > Card / Stack / Row / Grid and the section 2 components (TopBar, PhoneHeader nested, PhoneBar,
     Button, Disclosure); no <style>, no inline style. Rachel's copy (C02-C12) comes from ../copy/rachel.js only, generated from generator/copy_rachel.py.
     Learn more is a native <details> disclosure, open by default as the boards draw it (F03). One .btn-primary per page:
     desktop "Try the sample review" (experimentation card); phone "Take the tour" in the phone-bar (AboutPhone F03).
     C12 "How often" ships in full, trajectory clause included (cookbook work/active/2026-10-19-current-ui-copy/RULING.md option 2, captain 2026-10-21). -->
<script>
  import { screenHref } from "../route.js";
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Mark from "../Mark.svelte";
  import Section from "../Section.svelte";
  import Card from "../Card.svelte";
  import Stack from "../Stack.svelte";
  import Row from "../Row.svelte";
  import Grid from "../Grid.svelte";
  import TopBar from "../TopBar.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import PhoneBar from "../PhoneBar.svelte";
  import Button from "../Button.svelte";
  import Disclosure from "../Disclosure.svelte";
  import { C02, CAPS, HOW, WHO, LEARN_MORE, HOW_IT_WORKS } from "../copy/rachel.js";

  let { phone = false, theme = "light", w } = $props();
  let HOME = $derived(screenHref("home", { phone, theme, w }));
  const TOUR = "#results", SURVEY = "#survey-code";
  // Card labels keep UI Next casing (VALIDATION-186 product yellow 1); captions are Rachel's C03.
  const FACETS = [
    ["team", "The Translation Team", "translation brief · understanding the source · process · external review · consistency · governance"],
    ["community", "The Community", "understandable · appealing · impact"],
    ["church", "The Church", "translation brief · church involvement · confidence · affirmation"],
  ];
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="About" parent="Home" back={HOME} />{:else}<TopBar home={HOME} end={false} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Take the tour" href={TOUR} />{/if}{/snippet}
{#snippet learnMore()}
  <Disclosure label={LEARN_MORE} open gap={4}>
    <Stack gap={2}>
      <h3 class="h2">{HOW_IT_WORKS}</h3>
      <ol class="l-stack" data-gap="2">{#each HOW as [t, d]}<li><b>{t}</b> {d}</li>{/each}</ol>
    </Stack>
    {#each WHO as [t, d]}<Stack gap={1}><h4 class="h3">{t}</h4><p class="small">{d}</p></Stack>{/each}
  </Disclosure>
{/snippet}

<AppShell {phone} {theme} screen rhythm="read" {top} {bar}>
  {#if phone}
    <h1 class="title-phone">Why 3D Review exists</h1>
    <Card hi pad="hero" gap={2}>
      <p class="t-16">{C02}</p>
      <p class="small">Developed with the Lab · early adopters in India, Laos and the Philippines.</p>
    </Card>
    <Card gap={3} label="Three perspectives">
      {#each FACETS as [lens, name]}<div class="cap-row" data-lens={lens}><div class="cap-name">{name}</div><p class="small">{CAPS[lens]}</p></div>{/each}
    </Card>
    {@render learnMore()}
    <Stack gap={2}>
      <Button label="Take a survey" href={SURVEY} block />
      <Button label="Back to home" variant="quiet" href={HOME} block />
    </Stack>
  {:else}
    <Page gap={7}>
      <Section>
        <Grid template="hero-about">
        <Stack gap={5}>
        <span class="micro">Why 3D Review exists</span>
        <h1 class="display display-tight">How can we know that it's good enough?</h1>
        <p class="lead">{C02}</p>
        <p class="small body-16">Project leaders ask it throughout a translation. Teams using emerging approaches need a way to evaluate their work; partners supporting them need visibility into its impact. 3D Review was built to answer both — not with a single pass/fail check, but with short surveys from three points of view, kept distinct so field realities show up against goals and expectations.</p>
        </Stack>
        <Mark size={300} />
        </Grid>
      </Section>
      <Section>
        <h2 class="h1">Three facets of one stone</h2>
        <p class="small t-16">Think of a gemstone. Each facet offers a different perspective but is only part of the whole; turning the stone throws new light, and the differences between facets are what give you the complete view.</p>
        <Grid cols={3} gap={4}>
          {#each FACETS as [lens, name, asks]}
            <Card gap={2} label={name} {lens}><span class="h2">{name}</span><p class="small t-15">{CAPS[lens]}</p><p class="micro">Asks about: {asks}</p></Card>
          {/each}
        </Grid>
      </Section>
      <Section>{@render learnMore()}</Section>
      <Section heading="What it is not">
        <p class="small body-16">It does not replace quality-assurance staff or processes — a consultant can be one of the people completing the survey. It does not analyse the translated text, so it does not replace aQuA, Paratext or other checking tools; it complements them with what they cannot measure: process health, church reception and community impact.</p>
      </Section>
      <Section heading="What you get back">
        <p class="small body-16">Reports that compare the three perspectives side by side. A team that reports high confidence next to a community that reports low understanding is a valuable insight — it shows exactly where to focus.</p>
      </Section>
      <Section>
        <Card hi gap={3} label="3D Review is in experimentation">
          <h2 class="h2">3D Review is in experimentation</h2>
          <p class="small t-15">Early-adopter teams are testing it and shaping what comes next. Testers facilitate a review and work with the developers on the final reports.</p>
          <Row><Button label="Try the sample review" variant="primary" href={TOUR} /></Row>
        </Card>
      </Section>
      <Section>
        <Row wrap gap={2}><Button label="Back to home" variant="quiet" href={HOME} /><Button label="Take the tour" href={TOUR} /><Button label="Take a survey" href={SURVEY} /></Row>
      </Section>
    </Page>
  {/if}
</AppShell>
