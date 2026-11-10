<!-- UI Next (v4) participant icon chip. Status: provisional. The boards' icn() (gen.py) as the PIN's §9 participant rows (cookbook
     design-system.md §9 "Participant phone rows"): .icn[data-size=32|36|56|64], --lens-soft ground and --primary icon from data-lens,
     or data-tone=neutral (--line ground, --ink-2 icon) for a non-lens icon (the problem head). Glyph at the boards' size (half the chip,
     30 on the 64 chip) and stroke 1.75: the shared Icon has one size (20) and stroke 2 (shared ask, cookbook RESULTS-participant.md).
     lens is required: the survey's perspective key (data.js surveyLens) or null for neutral; there is no default, so a Community
     survey never wears the team colour. -->
<script>
  import { P } from "./icons.js";
  const GLYPH = Object.freeze({ 32: 16, 36: 18, 56: 28, 64: 30 });
  let { icon, size = 36, lens } = $props();
  // Derived checks: they run again whenever a prop changes, not only at mount.
  const g = $derived.by(() => {
    if (!Object.hasOwn(P, icon)) throw new TypeError(`Chip: unknown icon "${String(icon)}"`);
    if (!Object.hasOwn(GLYPH, size)) throw new TypeError("Chip: size must be 32, 36, 56 or 64 (the §9 .icn[data-size] rows)");
    if (lens !== null && !["team", "community", "church"].includes(lens)) throw new TypeError("Chip: lens must be team, community, church or null (neutral)");
    return GLYPH[size];
  });
</script>

<span class="icn" data-size={String(size)} data-lens={lens ?? undefined} data-tone={lens === null ? "neutral" : undefined} aria-hidden="true"><svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={P[icon]} /></svg></span>
