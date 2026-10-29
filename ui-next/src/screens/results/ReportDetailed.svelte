<!-- UI Next (v4) Report detailed screen: the four-page detailed report. Status: provisional (playbook rule 12). ?screen=report-detailed.
     Board: ReportDetailed.dc.html (desktop only). On a phone (&w=phone) it renders the phone's reports list (ReportPhone, ./Report.svelte),
     where the phone shares the PDF; any ?state= renders the default. Four .paper[data-sheet=page] sheets (8.11 contract row; Paper is
     Card level), stacked in the shell's main: 1 head + radar + biggest tensions; 2 all areas compared + how to read; 3-4 every area with
     evidence (§8.11 .ev-card / table.ev-table) + their words. Scores are exact as returned (ui/report-lenses.js lensSpreadRows exact); levels v3ScoreBand;
     radar ui/report-radar.js radarModel. One .btn-primary: "Download this report (PDF)" (document bar). Copy: the board.
     A perspective under the minimum responses adds nothing a reader could work back to its score (validator R3-1): no barbell dot,
     no part in a gap or the tensions order, no radar shape, "—" in its evidence Score cells; an area with fewer than two placed
     perspectives says "too few perspectives to compare", never a gap. The fixture's reading of the radar (shapeReading, board copy)
     shows only when every perspective is drawn. A payload without a perspective or area still renders (R3-3): the evidence sheets
     iterate the cards, two a sheet from page 3, and no sheet is empty: with two perspectives the report has three pages and "In
     their words" closes page 3 (R4-5). Headings that count say the count drawn ("The two perspectives as one shape", "The two areas
     where…"), never a fixed three. All areas compared lists every cross_lens_multi area in payload order, malformed entries
     skipped, blank names as "—" (R4-3). report: the built report (default the fixture; the route passes none; a phone gets the
     phone list, ./Report.svelte, with the same prop, R4-4). Paper sheet contents (design-system.md §8.11 row, provisional): sections
     are plain divs > div.sheet-head (role heading, level 2; [data-v] the space under) + p.sheet-lead / p.sheet-text; the radar sits in
     .radar-row > svg + .radar-side > .radar-legend (.legend-item > i.radar-dot); a score row's notes are span.nowrap. No .small,
     .h3 or inline type inside a sheet; only value-driven left/width % (ScoreBar). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Level from "../../Level.svelte";
  import Coverage from "./Coverage.svelte";
  import DocBar from "./DocBar.svelte";
  import PdfActions from '../actions/PdfActions.svelte';
  import PaperHead from "./PaperHead.svelte";
  import PaperLegend from "./PaperLegend.svelte";
  import ScoreBar from "./ScoreBar.svelte";
  import Radar from "./Radar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Glyph from "./Glyph.svelte";
  import { G } from "./icons.js";
  import { out } from "./links.js";
  import { href } from "../href.js";
  import { REPORT, currentLevelMin, snapshotTotal, fmtScore, footPrivacy, readingPrivacy, lensCards, scoreRows, comparedRows, radar, gapLead, countWord, evidenceSheets, detailedPages } from "./data.js";

  let { phone = false, theme = "light", report, pdfUrl = null, pdfToken = null } = $props();
  const D = $derived(report ?? REPORT.desktop);
  const cards = $derived(lensCards(D.payload, D.counts, { sent: D.sent }));
  const tensions = $derived(scoreRows(D, D.counts).filter((r) => r.spread !== null).slice(0, 3));
  const all = $derived(comparedRows(D, D.counts));
  const shape = $derived(radar(D, D.radar, D.counts));
  const sheets = $derived(evidenceSheets(cards));
  // "How to read the scores" names the level minimum in force (served, else the safe 3): at 1 the board's words, "no answers".
  const MIN = currentLevelMin(), fewWords = MIN === 1 ? "no answers" : `fewer than ${MIN} answers`;
  const PAGES = $derived(detailedPages(cards));
  const FOOT = $derived(`Built from ${snapshotTotal(cards)} responses on ${D.review.builtOn} · Scores are 0–100. Every other page shows levels, which are bands · ${footPrivacy()}`);
  const shapeHeading = $derived(shape ? `The ${countWord(shape.legend.length)} perspectives as one shape` : "The perspectives as one shape");
  const tensionsLead = $derived(tensions.length === 0 ? "No area has two perspectives to compare yet." : tensions.length === 1 ? "The area where the perspectives are furthest apart." : `The ${countWord(tensions.length)} areas where the perspectives are furthest apart.`);
</script>

{#snippet top()}<DocBar title={`Detailed report · ${PAGES} pages · ${D.review.title}`} other="Open the overview · 1 page" otherHref={href("report")} {pdfUrl} {pdfToken} />{/snippet}
{#snippet foot(n)}<div class="pfoot"><span class="pf-text">{FOOT}</span><span class="pn">{n} of {PAGES}</span></div>{/snippet}
{#snippet scores(rows)}
  {#each rows as row}
    <div class="barbell-row" data-kind="score"><!-- the numeric paper row (.paper .barbell-row[data-kind=score]); bb-label / bb-verdict -->
      <span class="bb-label">{row.name}</span>
      <ScoreBar {row} />
      <span class="bb-verdict">{gapLead(row)}{#if row.notes.length}{" · "}<span class="nowrap">{row.notes.join(" · ")}</span>{/if}</span>
    </div>
  {/each}
  <PaperLegend />
{/snippet}
{#snippet evidence(c)}
  <!-- design-system.md §8.11 Evidence table (paper): .ev-card > .ev-head (name + coverage cue) + table.ev-table; not the screen .tbl -->
  <div class="ev-card" data-lens={c.lens}>
    <div class="ev-head"><strong>{c.label}</strong><Coverage n={c.n} /></div>
    <table class="ev-table">
      <thead><tr><th>Area</th><th>Level</th><th data-align="end">Score</th><th data-align="end">Evidence</th><th>Observation</th></tr></thead>
      <tbody>{#each c.rows as r}<tr><td>{r.name}</td><td><Level level={r.level} /></td><td class="tab-n" data-align="end">{r.level === "more" || r.score === null ? "—" : fmtScore(r.score)}</td><td class="ev-muted" data-align="end">{r.items} items</td><td>{r.note}</td></tr>{/each}</tbody>
    </table>
  </div>
{/snippet}
{#snippet words()}{#if D.theirWords?.length}<div><div class="sheet-head" role="heading" aria-level="2">In their words</div><p class="sheet-text">{D.theirWords.map((w) => `“${w}”`).join(" · ")}</p></div>{/if}{/snippet}

{#snippet page1()}
    <div class="paper" data-sheet="page">
      <PaperHead review={D.review} {cards} kind="detailed report" />
      <div>
        <div class="sheet-head" data-v="4" role="heading" aria-level="2">{shapeHeading}</div>
        {#if shape}
        <div class="radar-row">
          <Radar model={shape} />
          <div class="radar-side">
            <div class="radar-legend">{#each shape.legend as l}<span class="legend-item"><i class="radar-dot" aria-hidden="true" data-lens={l.lens}></i>{l.label}</span>{/each}{#if shape.notes.length}<span class="legend-item">{shape.notes.join(" · ")}</span>{/if}</div>
            <p class="sheet-text">Each ring is 25 on the 0–100 scale.{!shape.notes.length && D.shapeReading ? ` ${D.shapeReading}` : ""} Where a perspective is not asked about an area, its shape skips that spoke.</p>
            {#each shape.lenses.filter((l) => l.skipped.length) as l (l.lens)}<p class="sheet-text" data-skip={l.lens}>{l.label} has no score for {l.skipped.join(", ")}.</p>{/each}
          </div>
        </div>
        {:else}<p class="sheet-text">Too few shared areas to draw the shape.</p>{/if}
      </div>
      <div>
        <div class="sheet-head" data-v="2" role="heading" aria-level="2">The biggest tensions</div>
        <p class="sheet-lead">{tensionsLead} Every area is compared on the next page.</p>
        {@render scores(tensions)}
      </div>
      {@render foot(1)}
    </div>
{/snippet}
{#snippet page2()}
    <div class="paper" data-sheet="page">
      <div>
        <div class="sheet-head" data-v="2" role="heading" aria-level="2">All areas compared across perspectives</div>
        <p class="sheet-lead">0–100 area scores; the band shows the spread between the perspectives asked. Only shared areas can be compared.</p>
        {@render scores(all)}
      </div>
      <div>
        <div class="sheet-head" data-v="8" role="heading" aria-level="2">How to read the scores</div>
        <p class="sheet-text">Scores are the pinned report model's area values (0–100) aggregated from the item answers listed under Evidence. Levels are bands on those scores. A perspective with {fewWords} shows More input needed and no score; the drops beside each perspective show how many answered (a few drops is little evidence, not a low result). {readingPrivacy()}</p>
      </div>
      {#if !sheets.length}{@render words()}{/if}
      {@render foot(2)}
    </div>
{/snippet}
{#snippet evidenceSheet(sheet, i)}
    <div class="paper" data-sheet="page">
      <div class="sheet-head" data-v="0" role="heading" aria-level="2">Every area, with evidence{i ? " (continued)" : ""}</div>
      {#each sheet as c (c.lens)}{@render evidence(c)}{/each}
      {#if i === sheets.length - 1}{@render words()}{/if}
      {@render foot(3 + i)}
    </div>
{/snippet}
{#snippet ptop()}<PhoneHeader state="nested" title="Detailed report" parent="Overview" back={href("report", { state: "overview" })} menuHref={out("menu")} />{/snippet}
{#snippet pbar()}{#if !pdfUrl}<div class="glass phone-bar" role="group" aria-label="Page actions"><button class="btn btn-primary btn-lg btn-block" type="button" disabled aria-describedby="pdf-why">Download this report (PDF)</button></div>{/if}{/snippet}

{#if phone}
<!-- design-system.md Phone report reading (QA-LIVE N2): the detailed view, the same sheets as desktop scaled to the width (.psheet[data-fit=a4]),
     back to the overview; the PDF reason in the page; the download disabled with it. -->
<AppShell phone {theme} screen top={ptop} bar={pbar}>
  {#if pdfUrl}<PdfActions url={pdfUrl} token={pdfToken} label="Download full report PDF" />{/if}
  <span class="micro">Detailed · {PAGES} pages · A4 scaled to the width; pinch to zoom</span>
  {#if !pdfUrl}<p class="small" id="pdf-why">PDF export is not in the new design yet; the current design's report page downloads it.</p>{/if}
  <div class="report-sheets">
    <div class="psheet" data-fit="a4">{@render page1()}</div>
    <div class="psheet" data-fit="a4">{@render page2()}</div>
    {#each sheets as sheet, i}<div class="psheet" data-fit="a4">{@render evidenceSheet(sheet, i)}</div>{/each}
  </div>
  <a class="link" href={href("report", { state: "overview" })}>Back to the overview <Glyph d={G.arrow} /></a>
</AppShell>
{:else}
<AppShell {theme} screen rhythm="report" {top}><!-- §8.3 Report frame: main.l-main[data-rhythm=report] > .paper[data-sheet] sheets as direct children -->
{@render page1()}{@render page2()}{#each sheets as sheet, i}{@render evidenceSheet(sheet, i)}{/each}
</AppShell>
{/if}
