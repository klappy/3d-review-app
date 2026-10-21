<!-- UI Next (v4) actions-lane QR drawing: the boards' 21×21 .qr (generator/gen.py qr(); base.css .qr gives the white face, padding, radius).
     Drawn as one SVG path so its size is an attribute (the boards size it with an inline width: canvas gap), modules in var(--ink), which the
     paper scope keeps dark in both themes; use it inside .paper. bits: 441 characters, "1" = dark module. Decorative placeholder until a real
     code is drawn (wiring debt: ui/assess/share.js qrSvg() emits a code of any version; .qr is fixed at 21 modules). The plain wrapper div keeps the
     code at its size beside long text in a flex row (a bare svg flex item shrank: ActionPlan's share block drew it 43px wide, 27px of code;
     the div's minimum is the svg's width; the board draws that block as a 1fr 72px grid inline, no contract row). Status: provisional. -->
<script>
  let { bits, size = 120 } = $props();
  if (!(typeof bits === "string" && /^[01]{441}$/.test(bits))) throw new TypeError("Qr: bits must be 441 characters of 0/1 (21×21)");
  const d = $derived([...bits].map((c, i) => (c === "1" ? `M${i % 21} ${Math.floor(i / 21)}h1v1h-1z` : "")).join(""));
</script>

<div><svg class="qr" width={size} height={size} viewBox="0 0 21 21" shape-rendering="crispEdges" aria-hidden="true"><path {d} fill="var(--ink)"></path></svg></div>
