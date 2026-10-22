<!-- UI Next (v4) collect lane QR code. Status: provisional. Contract: design-system.md §1.3 + base.css .qr (21-module grid, #111 modules
     on #fff, --radius-s). cells: the 441 modules row-major as a 0/1 string; today the fixture's (the boards' placeholder codes, gen.py qr()).
     No encoder ships: a real code for a survey link needs a link backend and a .qr row keyed to the module count (the 3dreview.app/s/CODE
     links are 21 bytes, past version 1's 21x21), RESULTS-collect.md wiring debt. size: room 176, phone 260, page 440 (§8.7 QR sizes).
     Decorative to assistive tech: the link is always printed beside it. -->
<script>
  const SIZES = ["room", "phone", "page"];
  let { cells, size } = $props();
  if (!SIZES.includes(size)) throw new TypeError(`Qr: size must be room, phone or page, got ${String(size)}`);
  // 21x21 for the boards' placeholder codes; a real survey link (app/data.js qrModules) is a larger square (version 2+), so any n*n.
  const n = $derived(Math.round(Math.sqrt(String(cells ?? "").length)));
  if (!/^[01]+$/.test(cells ?? "") || n * n !== String(cells).length || n < 21) throw new TypeError("Qr: cells are an n x n (n >= 21) square of modules as a 0/1 string");
</script>

<div class="qr" data-size={size} data-n={n} aria-hidden="true">{#each cells as m, i (i)}<i class={m === "1" ? undefined : "o"}></i>{/each}</div>
