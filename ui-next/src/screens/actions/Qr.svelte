<!-- UI Next (v4) actions-lane QR drawing: fixture 21×21 modules or a live encoder's n×n .qr (base.css gives the white face, quiet zone and radius).
     Drawn as one SVG path so its size is an attribute (the boards size it with an inline width: canvas gap), modules in var(--ink), which the
     paper scope keeps dark in both themes; use it inside .paper. bits: n×n characters, "1" = dark module. The default n=21 retains the gallery's
     declared fixture; a live plan passes modules from the existing real URL encoder. The plain wrapper div keeps the
     code at its size beside long text in a flex row (a bare svg flex item shrank: ActionPlan's share block drew it 43px wide, 27px of code;
     the div's minimum is the svg's width; the board draws that block as a 1fr 72px grid inline, no contract row). Status: provisional. -->
<script>
  let { bits, n = 21, size = 120 } = $props();
  const modules = $derived.by(() => {
    if (!Number.isInteger(n) || n < 21 || n > 177 || (n - 21) % 4 || typeof bits !== "string" || bits.length !== n * n || !/^[01]+$/.test(bits)) throw new TypeError(`Qr: bits must be ${n * n} characters of 0/1 (${n}×${n})`);
    return n;
  });
  const d = $derived([...bits].map((c, i) => (c === "1" ? `M${i % modules} ${Math.floor(i / modules)}h1v1h-1z` : "")).join(""));
</script>

<div><svg class="qr" data-n={modules} width={size} height={size} viewBox={`0 0 ${modules} ${modules}`} shape-rendering="crispEdges" aria-hidden="true"><path {d} fill="var(--ink)"></path></svg></div>
