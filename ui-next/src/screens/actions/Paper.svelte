<!-- UI Next (v4) actions-lane paper survey preview: base.css paper scope (.psheet > .paper, .ptitle, .q, .o / .o i.sq, .rl, .pbadge, .pfoot),
     as generator boards_fac.py sheet() / paper_form() draw it. The sheet sits on the section 2 Paper preview row (design-system.md V-20,
     CORRECTIONS 31): .psheet[data-fit=a4|letter] fills its column (never wider than the sheet) and scales the whole 794px (A4) or 816px
     (Letter) sheet to that width in CSS, so the QR and every word stay whole (VALIDATION-integration N1; actions L3). fit: "a4" (default)
     or "letter". Always light (paper scope). Decorative (aria-hidden), as on the boards. Status: provisional. -->
<script>
  import Qr from "./Qr.svelte";
  import LiveQr from "../collect/Qr.svelte";
  // qr: the boards' 21x21 placeholder bits; cells: a real code's n x n modules (app/data.js qrModules, the collect lane's Qr), live.
  let { paper, qr, cells, practice = false, page = "1 of 3", note, fit = "a4" } = $props();
  if (fit !== "a4" && fit !== "letter") throw new TypeError(`Paper: fit is "a4" or "letter", not "${fit}"`);
  const PRACTICE = "Practice copy · not a real review";
</script>

<div class="psheet" data-fit={fit} aria-hidden="true">
  <div class="paper l-card l-stack" data-gap="2">
    <div class="l-row" data-split data-gap="5">
      <div class="l-stack" data-gap="1">
        <div class="l-row" data-wrap data-gap="3"><div class="ptitle h1">{paper.title}</div>{#if practice}<span class="pbadge">{PRACTICE}</span>{/if}</div>
        <div class="small t-15">{paper.line}</div>
        {#if note}<div class="micro">{note}</div>{/if}
      </div>
      {#if cells}<LiveQr {cells} size="room" />{:else if qr}<Qr bits={qr} />{/if}
    </div>
    <div class="small t-15">{#if paper.code}Code <strong>{paper.code}</strong> · {/if}{paper.codeLine}</div>
    {#each paper.questions as q}
      <p class="q"><strong>{q.n}.</strong> {q.text}</p>
      {#each q.options as o}<div class="o"><i class={q.type === "multi" ? "sq" : undefined}></i>{o}</div>{/each}
      {#each Array(q.lines ?? 0) as _}<div class="rl"></div>{/each}
    {/each}
    <div class="pfoot">{#if practice}<span class="pbadge">{PRACTICE}</span>{/if}<span class="pn">{page}</span></div>
  </div>
</div>
