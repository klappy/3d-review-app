<!-- UI Next (v4) Project screen (one translation, many reviews). Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/setup/project.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Project.dc.html (desktop), ProjectPhone.dc.html (phone, w=phone).
     Desktop: signed-in top bar, page head (workspace link, title, meta; settings, People, the one .btn-primary "Start a 3D Review"),
     two tracks: reviews newest first (card links: date, title + stage pill, a level per perspective) | "Over time" levels chart.
     Phone: root phone header, title + pill, People / Settings, the reviews list card, the primary in the phone-bar.
     Levels and stages come from the section 2 Level and Stage pill components (words from section 4). No <style>, no inline style.
     Links (screens/href.js, carrying ?w= and ?theme=): Start -> setup1; cross-lane names through ./links.js OUT: People -> people and the
     workspace link -> workspace (people lane); a review row -> its stage's screen (fixture "to": collect, results, nextStep -> next-step).
     "Over time" chart: viewBox 420x190 drawn at the aside's width (width 100%), with a 60px label gutter so the y labels are not
     covered by the first column (the board draws a fixed 420px svg in a 412px box and its labels run under the points, VALIDATION-setup F11). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Pill from "../../Pill.svelte";
  import Level from "../../Level.svelte";
  import LensDot from "../../LensDot.svelte";
  import Glyph from "./Glyph.svelte";
  import { href } from "../href.js";
  import { out } from "./links.js";
  import fixture from "../../../fixtures/setup/project.json";

  // The board draws one state; the route's ?state= prop is not read, so any value (unknown included) renders it and never throws.
  // data: the fixture, or the live model in the same shape (app/data.js projectModel); a review row may carry its own href.
  let { phone = false, theme = "light", data = fixture } = $props();
  const { workspace: ws, project: p, reviews, trend } = data;
  const W = $derived(phone ? { w: "phone" } : {});
  const to = (screen) => href(screen, W);
  const go = (key) => out(key, W);
  const START = $derived(to("setup1"));
  // "Over time" chart geometry (viewBox 420x190, rows every 30 from y30; board: a review every 110 from x40, labels from x8). Port: the
  // plot starts at x60 (labels end-anchored at x52), a review every 110 from x70, so the last point (x400, r5) stays inside the viewBox.
  const Y = { strong: 30, growing: 60, support: 90, urgent: 120, more: 150 };
  const X = (i) => 70 + 110 * i;
  const points = (levels) => levels.map((l, i) => `${X(i)},${Y[l]}`).join(" ");
</script>

{#snippet plus()}<Glyph name="plus" />{/snippet}
{#snippet people()}<Glyph name="people" />{/snippet}
{#snippet pen()}<Glyph name="pen" />{/snippet}
{#snippet dots()}<Glyph name="dots" size={20} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="root" home={to("home")} />{:else}<TopBar workspace={ws.short} home={to("home")} />{/if}{/snippet}
{#snippet bar()}{#if phone}<PhoneBar label="Start a 3D Review" lead="plus" href={START} />{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <a class="link small" href={go("workspace")}>{ws.short}</a>
    <Row wrap gap={2}><h1 class="title-phone">{p.name}</h1><Pill stage={p.stage} /></Row>
    <p class="small">{p.phoneMeta}</p>
    <Row gap={2}><Button label="People" href={go("people")} lead={people} block /><Button label="Settings" href={START} lead={pen} block /></Row>
    <section class="glass l-card" data-pad="list" aria-labelledby="revs-h">
      <Row split gap={3}><span class="micro" id="revs-h">Reviews over time</span><span class="small">newest first</span></Row>
      {#each reviews as r}
        <a class="card-link su-revline" href={r.href ?? go(r.to)}>
          <span class="su-revcol" data-grow><span class="small">{r.when}</span><span class="su-clip">{r.title}</span><span class="l-row" data-gap="2"><Pill stage={r.stage} /></span></span>
          {#if r.overall}<Level level={r.overall} />{:else}<span class="small">{r.note}</span>{/if}
        </a>
      {/each}
    </section>
  {:else}
    <Page gap={5}>
      <Row split wrap gap={4}>
        <Stack gap={1}><a class="link small" href={go("workspace")}>{ws.name}</a><h1 class="title-page">{p.name}</h1><p class="small t-15">{p.meta}</p></Stack>
        <Row gap={2}><Button icon={dots} ariaLabel="Project settings" /><Button label="People" href={go("people")} lead={people} /><Button label="Start a 3D Review" variant="primary" href={START} lead={plus} /></Row>
      </Row>
      <div class="l-grid" data-tpl="su-project" data-gap="5">
        <div class="l-stack" data-gap="3">
          <h2 class="h2">Reviews, newest first</h2>
          {#each reviews as r}
            <a class="card-link glass l-card su-rev" href={r.href ?? go(r.to)}>
              <span class="small tab-n">{r.when}</span>
              <span class="l-stack" data-gap="2">
                <span class="l-row" data-gap="2"><span class="h3">{r.title}</span><Pill stage={r.stage} /></span>
                <span class="l-row" data-wrap data-gap="4">{#if r.levels}{#each r.levels as [lens, level]}<span class="lvl-pair"><LensDot {lens} /><Level {level} /></span>{/each}{:else}<span class="small">{r.note}</span>{/if}</span>
              </span>
              <span class="go" aria-hidden="true"><Glyph name="arrow" /></span>
            </a>
          {/each}
        </div>
        <aside class="glass l-card l-stack" data-gap="3" aria-labelledby="trend-h">
          <div class="h3" id="trend-h">{trend.heading}</div>
          <p class="small">{trend.help}</p>
          <svg width="100%" viewBox="0 0 420 190" role="img" aria-label={`Levels over ${trend.months.length} reviews`}>
            {#each trend.rows as row, i}<text x="52" y={34 + 30 * i} font-size="var(--t-11)" fill="var(--ink-3)" text-anchor="end">{row}</text>{/each}
            {#each trend.months as m, i}<text x={X(i)} y="178" font-size="var(--t-11)" fill="var(--ink-2)" text-anchor="middle">{m}</text>{/each}
            {#each trend.rows as _, i}<line x1="60" x2="410" y1={30 + 30 * i} y2={30 + 30 * i} stroke="var(--line)"></line>{/each}
            {#each Object.entries(trend.lines) as [lens, levels]}<polyline data-lens={lens} points={points(levels)} fill="none" stroke="var(--lens)" stroke-width="2.5" stroke-linejoin="round"></polyline>{#each levels as l, i}<circle data-lens={lens} cx={X(i)} cy={Y[l]} r="5" fill="var(--lens)" stroke="var(--field)" stroke-width="2"></circle>{/each}{/each}
          </svg>
          <Row wrap gap={4}>{#each Object.keys(trend.lines) as lens}<span class="lvl-pair"><LensDot {lens} decorative />{{ team: "Translation team", community: "Community", church: "Church" }[lens]}</span>{/each}</Row>
          <p class="small">{trend.read}</p>
        </aside>
      </div>
    </Page>
  {/if}
</AppShell>
