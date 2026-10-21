<!-- UI Next (v4) Card. Status: provisional. Light DOM, literal contract classes (design-system.md section 8.1), no <style>, no inline style.
     Owns surface (.glass / .glass-hi), radius and inner padding; inner axis is a Stack. Never owns its width or outer margin.
     href makes it the section 2 card link (a.card-link.glass): the whole card is one target.
     pad (design-system.md 8.2, phone twins): hero = 28/24 hero card, list = 8/18 FAQ list card with 48px rows.
     lens sets data-lens on the card: section 2 Perspective card, the accent bar comes from .glass[data-lens] in base.css. -->
<script>
  import { gapAttr } from "./gap.js";
  let { hi = false, gap, label, href, lens, pad, children, ...rest } = $props();
  if (pad != null && !["hero", "list"].includes(pad)) throw new TypeError(`Card: pad must be hero or list`);
  if (lens != null && !["team", "community", "church"].includes(lens)) throw new TypeError(`Card: lens must be team, community or church`);
  for (const k of ["width", "style", "margin"]) if (k in rest) throw new TypeError(`Card: no ${k} (the parent Grid or Page track sets width; the parent gap spaces it)`);
  const g = $derived(gapAttr(gap, "Card"));
</script>

{#if href}<a class="card-link glass l-card l-stack" {href} data-gap={g} data-lens={lens} aria-label={label}>{@render children?.()}</a>
{:else}<div class={hi ? "glass-hi l-card l-stack" : "glass l-card l-stack"} data-gap={g} data-lens={lens} data-pad={pad} aria-label={label} role={label ? "group" : undefined}>{@render children?.()}</div>{/if}
