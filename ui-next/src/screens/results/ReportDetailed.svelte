<!-- UI Next (v4) Report detailed screen: the four-page detailed report. Status: provisional (playbook rule 12). ?screen=report-detailed.
     Board: ReportDetailed.dc.html (desktop only; the phone shares the PDF from ReportPhone). Four .paper sheets in .psheet (Paper contract,
     Card level), stacked in the shell's main: 1 head + radar + biggest tensions; 2 all areas compared + how to read; 3-4 every area with
     evidence (.th/.td tables) + their words. Scores are exact as returned (ui/report-lenses.js lensSpreadRows exact); levels v3ScoreBand;
     radar ui/report-radar.js radarModel. One .btn-primary: "Download this report (PDF)" (document bar). Copy: the board. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import Grid from "../../Grid.svelte";
  import Level from "../../Level.svelte";
  import LensDot from "../../LensDot.svelte";
  import DocBar from "./DocBar.svelte";
  import PaperHead from "./PaperHead.svelte";
  import PaperLegend from "./PaperLegend.svelte";
  import ScoreBar from "./ScoreBar.svelte";
  import Radar from "./Radar.svelte";
  import { REPORT, LENS_ORDER, lensLabel, lensCards, scoreRows, radar } from "./data.js";

  let { phone = false, theme = "light", state } = $props();
  if (state !== undefined) throw new TypeError(`ReportDetailed: no board states (got "${String(state)}")`);
  if (phone) throw new TypeError("ReportDetailed: desktop only (the phone shares the PDF from ?screen=report&w=phone)");
  const D = REPORT.desktop;
  const cards = lensCards(D.payload, D.counts);
  const tensions = scoreRows(D, D.counts).slice(0, 3);
  const all = scoreRows(D, D.counts, D.payload.cross_lens_multi.map((a) => a.construct_name));
  const shape = radar(D, D.radar);
  const FOOT = `Built from ${D.review.responses} responses on ${D.review.builtOn} · Scores are 0–100. Every other page shows levels, which are bands · nothing here identifies a person`;
  const PAGES = 4;
</script>

{#snippet top()}<DocBar title={`Detailed report · ${PAGES} pages · ${D.review.title}`} other="Open the overview · 1 page" otherHref="?screen=report" />{/snippet}
{#snippet foot(n)}<div class="pfoot"><span>{FOOT}</span><span>{n} of {PAGES}</span></div>{/snippet}
{#snippet scores(rows)}
  {#each rows as row}
    <Grid template="barbell" gap={4}>
      <span class="small"><strong>{row.name}</strong></span>
      <ScoreBar {row} />
      <span class="small">gap {row.spread}{#each row.notAsked as who} · {who} not asked{/each}</span>
    </Grid>
  {/each}
  <PaperLegend />
{/snippet}
{#snippet evidence(c)}
  <div class="solid l-card l-stack" data-lens={c.lens} data-gap="2">
    <Row gap={3}><strong>{c.label}</strong><span class="small">{c.n} responses</span></Row>
    <table>
      <thead><tr><th class="th">Area</th><th class="th">Level</th><th class="th">Score</th><th class="th">Evidence</th><th class="th">Observation</th></tr></thead>
      <tbody>{#each c.rows as r}<tr><td class="td">{r.name}</td><td class="td"><Level level={r.level} /></td><td class="td tab-n">{r.score ?? "—"}</td><td class="td">{r.items} items</td><td class="td">{r.note}</td></tr>{/each}</tbody>
    </table>
  </div>
{/snippet}

<AppShell {theme} screen {top}>
  <Stack gap={6}>
    <div class="psheet"><div class="paper l-card l-stack" data-gap="5">
      <PaperHead review={D.review} {cards} kind="detailed report" />
      <Stack gap={1}>
        <h2 class="h3">The three perspectives as one shape</h2>
        <Row gap={4}>
          {#if shape}<Radar model={shape} />{/if}
          <Stack gap={3}>
            <Row wrap gap={4}>{#each LENS_ORDER as lens}<Row gap={2}><LensDot {lens} decorative /><span class="small">{lensLabel(lens)}</span></Row>{/each}</Row>
            <p class="small">Each ring is 25 on the 0–100 scale. The community shape collapses toward the centre on clarity and impact while the team and church stay wide — the same picture as the gaps above, seen whole. Where a perspective is not asked about an area, its shape skips that spoke.</p>
          </Stack>
        </Row>
      </Stack>
      <Stack gap={2}>
        <h2 class="h3">The biggest tensions</h2>
        <p class="small">The three areas where the perspectives are furthest apart. Every area is compared on the next page.</p>
        {@render scores(tensions)}
      </Stack>
      {@render foot(1)}
    </div></div>
    <div class="psheet"><div class="paper l-card l-stack" data-gap="5">
      <Stack gap={2}>
        <h2 class="h3">All areas compared across perspectives</h2>
        <p class="small">0–100 area scores; the band shows the spread between the perspectives asked. Only shared areas can be compared.</p>
        {@render scores(all)}
      </Stack>
      <Stack gap={2}>
        <h2 class="h3">How to read the scores</h2>
        <p class="small">Scores are the pinned report model's area values (0–100) aggregated from the item answers listed under Evidence. Levels are bands on those scores. An area with fewer than three answers shows More input needed and no score. Nothing in this report identifies a person.</p>
      </Stack>
      {@render foot(2)}
    </div></div>
    <div class="psheet"><div class="paper l-card l-stack" data-gap="5">
      <h2 class="h3">Every area, with evidence</h2>
      {@render evidence(cards[0])}
      {@render evidence(cards[1])}
      {@render foot(3)}
    </div></div>
    <div class="psheet"><div class="paper l-card l-stack" data-gap="5">
      <h2 class="h3">Every area, with evidence (continued)</h2>
      {@render evidence(cards[2])}
      <Stack gap={2}><h2 class="h3">In their words</h2><p class="small">{D.theirWords.map((w) => `“${w}”`).join(" · ")}</p></Stack>
      {@render foot(4)}
    </div></div>
  </Stack>
</AppShell>
