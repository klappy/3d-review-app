<!-- UI Next (v4) collect lane QR code. Status: provisional. Contract: design-system.md §1.3 + base.css .qr (#111 modules on #fff, --radius-s)
     and §8.7 "QR module grid" (.qr[data-n], QR versions 2–10; wiring debt 7 closed 2026-10-22, cookbook PR 199). cells: the n x n modules
     row-major as a 0/1 string — the fixture's 21x21 placeholders in the gallery, or the real code for a survey link encoded by
     app/data.js qrModules (ui/assess/vendor-qrcode.js, qrcode(0, "M"): the same encoder and settings the boards' qr_data.json carries).
     size: room 176, phone 260, page 440 (§8.7 QR sizes).
     Decorative to assistive tech: the link is always printed beside it. -->
<script>
  const SIZES = ["room", "phone", "page"];
  let { cells, size } = $props();
  if (!SIZES.includes(size)) throw new TypeError(`Qr: size must be room, phone or page, got ${String(size)}`);
  // §8.7: 21x21 placeholder or the encoder's n x n (version 2+); data-n picks the grid rule (base.css at the PIN; qr.css until the import).
  const n = $derived(Math.round(Math.sqrt(String(cells ?? "").length)));
  if (!/^[01]+$/.test(cells ?? "") || n * n !== String(cells).length || n < 21) throw new TypeError("Qr: cells are an n x n (n >= 21) square of modules as a 0/1 string");
</script>

<div class="qr" data-size={size} data-n={n} aria-hidden="true">{#each cells as m, i (i)}<i class={m === "1" ? undefined : "o"}></i>{/each}</div>
