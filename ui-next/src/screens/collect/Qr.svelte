<!-- UI Next (v4) collect lane QR code. Status: provisional. Contract: design-system.md §1.3 + base.css .qr (21-module grid, #111 modules
     on #fff, --radius-s). cells: the 441 modules row-major as a 0/1 string (the fixture carries the boards' placeholder codes, gen.py qr());
     text: a link to encode instead, through the current UI's vendored qrcode-generator (ui/assess/vendor-qrcode.js, model.js qrModules).
     size names the drawn width (room 176, phone 260, page 440): data-size is a canvas gap row (canvas-collect-gaps), so today it fills its track.
     Decorative to assistive tech: the link is always printed beside it. -->
<script>
  import { qrModules } from "./model.js";
  const SIZES = ["room", "phone", "page"];
  let { cells, text, size } = $props();
  const mods = $derived(cells ?? qrModules(text));
  if (!/^[01]{441}$/.test(cells ?? qrModules(text) ?? "")) throw new TypeError("Qr: cells (441 modules, 21x21, as a 0/1 string) or a text short enough for a 21x21 code");
  if (size !== undefined && !SIZES.includes(size)) throw new TypeError(`Qr: size must be room, phone or page, got ${String(size)}`);
</script>

<div class="qr" data-size={size} aria-hidden="true">{#each mods as m, i (i)}<i class={m === "1" ? undefined : "o"}></i>{/each}</div>
