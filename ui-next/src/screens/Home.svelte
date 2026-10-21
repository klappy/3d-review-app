<!-- UI Next (v4) Home screen ("Your reviews"). Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/home.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Home.dc.html (state "reviews"), HomeFirst.dc.html ("first"), HomePhone.dc.html (phone).
     Composed only of AppShell > Page > Section > Card / Stack / Row / Grid and the section 2 components; no <style>, no inline style.
     One .btn-primary per page: "Start a 3D Review" (desktop page head; phone: the phone-bar). Copy: design-system.md section 4 and
     Rachel's C01-C12 map (sources/rachel-copy-2026-10-19/app-copy-edits.txt), C12 in full, trajectory sentence included (cookbook current-ui-copy RULING option 2). -->
<script module>
  export const STATES = Object.freeze(["first", "reviews"]);
  // Rachel copy rows, word for word (app-copy-edits.txt paragraph order). Not rendered on Home: the boards draw no Learn more here;
  // Landing/About carry them (VALIDATION-558 fix 1, provisional). Kept verbatim-pinned for those screens. C01 is Landing's hero.
  export const COPY = Object.freeze({
    C02: "3D Review visualizes how a Bible translation project is performing so you can decide what to do next.",
    C03: [["team", "Translation team", "How the work is done"], ["community", "Community", "How it’s understood"], ["church", "Church", "How it’s used"]],
    C04: "Learn more",
    C05: "How it works",
    C06: ["Set up.", "A facilitator (usually a project manager or partner) creates the review and chooses the surveys that fit your project, whether it’s written, oral, or sign language."],
    C07: ["Share.", "Each group answers a short survey, by link, QR code, or on paper."],
    C08: ["Learn.", "You get a report that shows strengths and areas to grow, side by side, so you know where to focus next."],
    C09: ["Who it is for", "Translation teams and their leaders, the communities they serve and the churches they partner with"],
    C10: "When to use it",
    C11: "When your project would benefit from a pause to reflect and learn from feedback (consider using between books or publishing iterations)",
    C12: ["How often", "Repeat when a new assessment would be useful, or over increments of time to create a trajectory"],
  });
</script>
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Section from "../Section.svelte";
  import Card from "../Card.svelte";
  import Stack from "../Stack.svelte";
  import Row from "../Row.svelte";
  import Grid from "../Grid.svelte";
  import TopBar from "../TopBar.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import PhoneBar from "../PhoneBar.svelte";
  import Button from "../Button.svelte";
  import Pill from "../Pill.svelte";
  import Tag from "../Tag.svelte";
  import Level from "../Level.svelte";
  import LensDot, { LENSES } from "../LensDot.svelte";
  import Icon from "../Icon.svelte";
  import { I } from "../icons.js";
  import data from "../../fixtures/home.json";

  let { state = "reviews", phone = false, theme = "light" } = $props();
  if (!STATES.includes(state)) throw new TypeError(`Home: unknown state "${String(state)}" (first | reviews)`);
  if (phone && state === "first") throw new TypeError("Home: the phone board draws the with-reviews state only (HomePhone.dc.html)");
  const ARROW = "M5 12h14M13 6l6 6-6 6", SEARCH = "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4", PLAY = "M8 5v14l11-7z";
  const STAGES = ["results", "collecting", "setup"];
  const phoneGroups = $derived(data.phoneOrder.map((s) => data.groups.find((g) => g.stage === s)));
  const PHASES = [
    ["Prepare", "Name the review, add the passage, choose who will participate. Five short steps."],
    ["Collect", "Each survey gets its own link and QR. Print paper for anyone offline."],
    ["Understand", "Levels for each perspective, and the gaps between them."],
    ["Improve", "Turn the biggest gaps into a plan you can share."],
  ];
</script>

{#snippet plus()}<Icon d={I.plus} />{/snippet}
{#snippet search()}<Icon d={SEARCH} />{/snippet}
{#snippet arrow()}<Icon d={ARROW} />{/snippet}
{#snippet check()}<Icon d={I.check} />{/snippet}
{#snippet play()}<Icon d={PLAY} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" initials={data.user.initials} />{:else}<TopBar who={data.user.first} initials={data.user.initials} workspace={data.workspace} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Start a 3D Review" lead="plus" href="#setup" />{/if}{/snippet}


<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <Row split gap={3}><h1 class="title-phone">Your reviews</h1><a class="link small" href="#explore">Explore all</a></Row>
    <Card href="#invitations" gap={2}><Row gap={3}><span class="icn" data-lens="church"><Icon d={I.mail} /></span><span class="small"><b>1 invitation</b> · {data.invitation.phone}</span></Row></Card>
    <Row wrap gap={2}><span class="chip">{data.workspace}</span><span class="chip">Mine</span><a class="link small" href="#explore">+ filter</a></Row>
    {#each phoneGroups as g}
      {#each g.reviews as r}
        <Card href={r.href} gap={2}>
          <span class="micro">{r.project}</span>
          <Row wrap gap={2}><span class="h2">{r.title}</span><Pill stage={g.stage} /></Row>
          <span class="small">{r.phoneMeta ?? r.meta}</span>
          <span class="link">{r.action}</span>
        </Card>
      {/each}
    {/each}
    <Card href="#practice" gap={2}><Row gap={3}><span class="icn" data-lens="team"><Icon d={I.sparkle} /></span><span class="small"><b>Practice</b> · open the sample or make a practice copy</span></Row></Card>
    <details class="dd"><summary class="link small">Completed · {data.completed.length}</summary>
      <Stack gap={2}>{#each data.completed as c}<a class="card-link solid l-card l-stack" href="#next-step" data-gap="1"><span class="h3">{c.title}</span><span class="small">{c.meta}</span></a>{/each}</Stack>
    </details>
  {:else}
    <Page gap={5}>
      <Row split wrap gap={3}>
        <h1 class="title-page">Your reviews</h1>
        <Row gap={2}><Button label="Explore all reviews" variant="quiet" href="#explore" lead={search} /><Button label="Start a 3D Review" variant="primary" href="#setup" lead={plus} /></Row>
      </Row>
      {#if state === "first"}
        <Card hi gap={5} label="Welcome">
          <Stack gap={3}>
            <span class="micro">Welcome, {data.user.first}</span>
            <h2 class="display">Your first 3D Review takes about ten minutes to set up.</h2>
            <p>You have not started one yet. Try the practice copy first if you want to see the whole journey with made-up answers, or start the real thing — you can change anything until you launch.</p>
            <Row wrap gap={3}><Button label="Open the sample review" href="#results" /><Button label="Make a practice copy" href="#sandbox" /><a class="link" href="#video">Watch the 2-minute tour</a></Row>
          </Stack>
          <Grid cols={4} gap={4}>
            {#each PHASES as [name, text], i}<Row gap={3}><span class="num">{i + 1}</span><Stack gap={1}><h3 class="h3">{name}</h3><p class="small">{text}</p></Stack></Row>{/each}
          </Grid>
        </Card>
        <Card gap={3} label="Invitations">
          <Row split wrap gap={4}>
            <Row gap={3}><span class="icn" data-lens="team"><Icon d={I.mail} /></span><Stack gap={1}><h3 class="h3">Invited to a project already?</h3><p class="small">Invitations appear here and in the account menu. Nothing to accept right now.</p></Stack></Row>
            <a class="link" href="#invitations">Invitations</a>
          </Row>
        </Card>
        <p class="small">Coming from the old 3D Review site? Your link brought you to the new app; the old one now forwards here. <a class="link" href="#help-h7">What changed</a></p>
      {:else}
        <Card gap={3} label="Invitation">
          <Row split wrap gap={4}>
            <Row gap={3}><span class="icn" data-lens="team"><Icon d={I.mail} /></span><Stack gap={1}><h3 class="h3">{data.invitation.from} invited you to <em>{data.invitation.project}</em></h3><p class="small">{data.invitation.role}</p></Stack></Row>
            <Row gap={2}><Button label="Decline" variant="quiet" /><Button label="Accept" href="#invitations" lead={check} /></Row>
          </Row>
        </Card>
        <Row wrap gap={2}>
          <span class="small">Show</span>
          {#each data.groups as g}<label class="chip"><input class="cb" type="checkbox" checked />{g.heading} <span class="small">{g.reviews.length}</span></label>{/each}
          <label class="chip"><input class="cb" type="checkbox" />Completed <span class="small">{data.completed.length}</span></label>
          <span class="chip">Workspace · BCS India</span><span class="chip">Facilitator · me</span>
          <Button label="Add filter" variant="quiet" lead={plus} />
        </Row>
        {#each data.groups as g}
          <Section heading={g.heading} help={g.help}>
            {#each g.reviews as r}
              <Card href={r.href} gap={3}>
                <span class="micro">{r.project} · {r.language}</span>
                <Row wrap gap={3}><h3 class="h2">{r.title}</h3><Pill stage={g.stage} /></Row>
                <Row wrap gap={4}>
                  <span class="small">{r.meta}</span>
                  {#if r.levels}{#each r.levels as [lens, level]}<span class="lvl-pair">{LENSES[lens]} <Level {level} /></span>{/each}{/if}
                  {#if r.counts}{#each r.counts as [lens, n]}<span class="lvl-pair"><LensDot {lens} decorative />{LENSES[lens]} {n}</span>{/each}<span class="small">{r.until}</span>{/if}
                  {#if r.tag}<Tag label={r.tag} />{/if}
                </Row>
                <Row><span class="btn">{r.action}<Icon d={ARROW} /></span></Row>
              </Card>
            {/each}
          </Section>
        {/each}
        <Card gap={3} label="Practice">
          <Row split wrap gap={4}>
            <Row gap={3}><span class="icn" data-lens="team"><Icon d={I.sparkle} /></span><Stack gap={1}><h3 class="h3">Practice</h3><p class="small">Try a review without real answers. Open the shared sample, or make a practice copy of one of yours and fill it with simulated responses. Practice copies are badged, kept out of Explore and reports, and can be deleted.</p></Stack></Row>
            <Row gap={2}><Button label="Open the sample" variant="quiet" href="#results" /><Button label="Make a practice copy" href="#sandbox" /></Row>
          </Row>
        </Card>
        <Section heading="Completed" help={`${data.completed.length} · hidden until you tick Completed above`}>
          <details><summary class="link">Show them anyway</summary>
            <Stack gap={2}>{#each data.completed as c}<a class="card-link solid l-card l-stack" href="#next-step" data-gap="1"><span class="h3">{c.title}</span><span class="small">{c.meta}</span></a>{/each}</Stack>
          </details>
        </Section>
      {/if}
    </Page>
  {/if}
</AppShell>
