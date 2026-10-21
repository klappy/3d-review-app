<!-- UI Next (v4) Report detailed screen: the four-page detailed report. Status: provisional (playbook rule 12). ?screen=report-detailed.
     Board: ReportDetailed.dc.html (desktop only). On a phone (&w=phone) it renders the phone's reports list (ReportPhone, ./Report.svelte),
     where the phone shares the PDF; any ?state= renders the default. Four .paper[data-sheet=page] sheets (8.11 contract row; Paper is
     Card level), stacked in the shell's main: 1 head + radar + biggest tensions; 2 all areas compared + how to read; 3-4 every area with
     evidence (.th/.td tables) + their words. Scores are exact as returned (ui/report-lenses.js lensSpreadRows exact); levels v3ScoreBand;
     radar ui/report-radar.js radarModel. One .btn-primary: "Download this report (PDF)" (document bar). Copy: the board.
     A perspective under the minimum responses adds nothing a reader could work back to its score (validator R3-1): no barbell dot,
     no part in a gap or the tensions order, no radar shape, "—" in its evidence Score cells; an area with fewer than two placed
     perspectives says "too few perspectives to compare", never a gap. The fixture's reading of the radar (shapeReading, board copy)
     shows only when every perspective is drawn. A payload without a perspective or area still renders (R3-3): the evidence sheets
     iterate the cards, two a sheet from page 3, and no sheet is empty: with two perspectives the report has three pages and "In
     their words" closes page 3 (R4-5). Headings that count say the count drawn ("The two perspectives as one shape", "The two areas
     where…"), never a fixed three. All areas compared lists every cross_lens_multi area in payload order, malformed entries
     skipped, blank names as "—" (R4-3). report: the built report (default the fixture; the route passes none; a phone gets the
     phone list, ./Report.svelte, with the same prop, R4-4). -->
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
  import Report from "./Report.svelte";
  import { href } from "../href.js";
  import { REPORT, lensCards, scoreRows, comparedRows, radar, withNotes, gapLead, responsesText, countWord, evidenceSheets } from "./data.js";

  let { phone = false, theme = "light", report } = $props();
  const D = $derived(report ?? REPORT.desktop);
  const cards = $derived(lensCards(D.payload, D.counts));
  const tensions = $derived(scoreRows(D, D.counts).filter((r) => r.spread !== null).slice(0, 3));
  const all = $derived(comparedRows(D, D.counts));
  const shape = $derived(radar(D, D.radar, D.counts));
  const sheets = $derived(evidenceSheets(cards));
  const PAGES = $derived(2 + sheets.length);
  const FOOT = $derived(`Built from ${D.review.responses} responses on ${D.review.builtOn} · Scores are 0–100. Every other page shows levels, which are bands · nothing here identifies a person`);
  const shapeHeading = $derived(shape ? `The ${countWord(shape.legend.length)} perspectives as one shape` : "The perspectives as one shape");
  const tensionsLead = $derived(tensions.length === 0 ? "No area has two perspectives to compare yet." : tensions.length === 1 ? "The area where the perspectives are furthest apart." : `The ${countWord(tensions.length)} areas where the perspectives are furthest apart.`);
</script>

{#snippet top()}<DocBar title={`Detailed report · ${PAGES} pages · ${D.review.title}`} other="Open the overview · 1 page" otherHref={href("report")} />{/snippet}
{#snippet foot(n)}<div class="pfoot"><span>{FOOT}</span><span>{n} of {PAGES}</span></div>{/snippet}
{#snippet scores(rows)}
  {#each rows as row}
    <Grid template="barbell" gap={4}>
      <span class="small"><strong>{row.name}</strong></span>
      <ScoreBar {row} />
      <span class="small">{withNotes(gapLead(row), row)}</span>
    </Grid>
  {/each}
  <PaperLegend />
{/snippet}
{#snippet evidence(c)}
  <div class="solid l-card l-stack" data-lens={c.lens} data-gap="2">
    <Row gap={3}><strong>{c.label}</strong><span class="small">{responsesText(c.n)}</span></Row>
    <table>
      <thead><tr><th class="th">Area</th><th class="th">Level</th><th class="th">Score</th><th class="th">Evidence</th><th class="th">Observation</th></tr></thead>
      <tbody>{#each c.rows as r}<tr><td class="td">{r.name}</td><td class="td"><Level level={r.level} /></td><td class="td tab-n">{r.level === "more" || r.score === null ? "—" : r.score}</td><td class="td">{r.items} items</td><td class="td">{r.note}</td></tr>{/each}</tbody>
    </table>
  </div>
{/snippet}
{#snippet words()}{#if D.theirWords?.length}<Stack gap={2}><h2 class="h3">In their words</h2><p class="small">{D.theirWords.map((w) => `“${w}”`).join(" · ")}</p></Stack>{/if}{/snippet}

{#if phone}
<Report phone {theme} {report} />
{:else}
<AppShell {theme} screen {top}>
  <Stack gap={6}>
    <div class="paper" data-sheet="page">
      <PaperHead review={D.review} {cards} kind="detailed report" />
      <Stack gap={1}>
        <h2 class="h3">{shapeHeading}</h2>
        {#if shape}
        <Row gap={4}>
          <Radar model={shape} />
          <Stack gap={3}>
            <Row wrap gap={4}>{#each shape.legend as l}<Row gap={2}><LensDot lens={l.lens} decorative /><span class="small">{l.label}</span></Row>{/each}{#if shape.notes.length}<span class="small">{shape.notes.join(" · ")}</span>{/if}</Row>
            <p class="small">Each ring is 25 on the 0–100 scale.{!shape.notes.length && D.shapeReading ? ` ${D.shapeReading}` : ""} Where a perspective is not asked about an area, its shape skips that spoke.</p>
          </Stack>
        </Row>
        {:else}<p class="small">Too few shared areas to draw the shape.</p>{/if}
      </Stack>
      <Stack gap={2}>
        <h2 class="h3">The biggest tensions</h2>
        <p class="small">{tensionsLead} Every area is compared on the next page.</p>
        {@render scores(tensions)}
      </Stack>
      {@render foot(1)}
    </div>
    <div class="paper" data-sheet="page">
      <Stack gap={2}>
        <h2 class="h3">All areas compared across perspectives</h2>
        <p class="small">0–100 area scores; the band shows the spread between the perspectives asked. Only shared areas can be compared.</p>
        {@render scores(all)}
      </Stack>
      <Stack gap={2}>
        <h2 class="h3">How to read the scores</h2>
        <p class="small">Scores are the pinned report model's area values (0–100) aggregated from the item answers listed under Evidence. Levels are bands on those scores. An area with fewer than three answers shows More input needed and no score. Nothing in this report identifies a person.</p>
      </Stack>
      {#if !sheets.length}{@render words()}{/if}
      {@render foot(2)}
    </div>
    {#each sheets as sheet, i}
    <div class="paper" data-sheet="page">
      <h2 class="h3">Every area, with evidence{i ? " (continued)" : ""}</h2>
      {#each sheet as c (c.lens)}{@render evidence(c)}{/each}
      {#if i === sheets.length - 1}{@render words()}{/if}
      {@render foot(3 + i)}
    </div>
    {/each}
  </Stack>
</AppShell>
{/if}
