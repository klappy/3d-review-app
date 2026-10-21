<!-- UI Next (v4) actions-lane paper survey preview: base.css paper scope (.psheet > .paper, .ptitle, .q, .o / .o i.sq, .rl, .pbadge, .pfoot),
     as generator boards_fac.py paper preview draws it. The boards scale the 794px sheet with an inline transform (scale 0.529 / 0.353);
     no contract row carries that scale yet, so the sheet shows at full size, clipped by .psheet (canvas gap). Always light (paper scope).
     Decorative (aria-hidden), as on the boards. Status: provisional. -->
<script>
  import Qr from "./Qr.svelte";
  let { paper, qr, practice = false, page = "1 of 3", note } = $props();
  const PRACTICE = "Practice copy · not a real review";
</script>

<div class="psheet" aria-hidden="true">
  <div class="paper l-card l-stack" data-gap="2">
    <div class="l-row" data-split data-gap="5">
      <div class="l-stack" data-gap="1">
        <div class="l-row" data-wrap data-gap="3"><div class="ptitle h1">{paper.title}</div>{#if practice}<span class="pbadge">{PRACTICE}</span>{/if}</div>
        <div class="small t-15">{paper.line}</div>
        {#if note}<div class="micro">{note}</div>{/if}
      </div>
      <Qr bits={qr} />
    </div>
    <div class="small t-15">Code <strong>{paper.code}</strong> · {paper.codeLine}</div>
    {#each paper.questions as q}
      <p class="q"><strong>{q.n}.</strong> {q.text}</p>
      {#each q.options as o}<div class="o"><i class={q.type === "multi" ? "sq" : undefined}></i>{o}</div>{/each}
      {#each Array(q.lines ?? 0) as _}<div class="rl"></div>{/each}
    {/each}
    <div class="pfoot">{#if practice}<span class="pbadge">{PRACTICE}</span>{/if}<span>{page}</span></div>
  </div>
</div>
