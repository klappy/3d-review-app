<!-- UI Next (v4) Level. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 2 Level row + ".lvl[data-level]" (R9, V-40); generator/gen.py meter() and glyph_* (lines 236-257):
     all four glyph skins (bars, faces, jars, plants) drawn, .app[data-imagery] shows one; --lvl colours the glyph only; meter + name always. -->
<script module>
  export const LEVELS = Object.freeze({ strong: "Strong", growing: "Growing", support: "Needs support", urgent: "Needs urgent attention", more: "More input needed" });
  export const SKINS = Object.freeze(["bars", "faces", "jars", "plants"]);
</script>
<script>
  const ON = { strong: 4, growing: 3, support: 2, urgent: 1, more: 0 };
  const MOUTH = { 4: "M7.5 13.5c1.5 3 7.5 3 9 0", 3: "M8 14c1.2 1.6 6.8 1.6 8 0", 2: "M8 15h8", 1: "M8 16c1.2-1.8 6.8-1.8 8 0" };
  const JAR = { 4: 12, 3: 9, 2: 6, 1: 3, 0: 0 };
  let { level, ...rest } = $props();
  if ("label" in rest) throw new TypeError("Level: the name comes from the level (section 4 words)");
  if (typeof level !== "string" || !Object.hasOwn(LEVELS, level)) throw new TypeError(`Level: unknown level "${String(level)}"`);
  const on = $derived(ON[level]);
</script>

<span class="lvl" data-level={level}>
  <span class={on === 0 ? "g g-bars meter gap" : "g g-bars meter"} aria-hidden="true">{#each [0, 1, 2, 3] as i}<b class={i < on ? "on" : undefined}></b>{/each}</span>
  <span class="g g-faces" aria-hidden="true">{#if on === 0}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5"><circle cx="12" cy="12" r="9"></circle></svg>{:else}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><circle cx="9" cy="10" r=".9" fill="currentColor"></circle><circle cx="15" cy="10" r=".9" fill="currentColor"></circle><path d={MOUTH[on]}></path></svg>{/if}</span>
  <span class="g g-jars" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray={on === 0 ? "2.5 2.5" : undefined}><path d="M8 4h8"></path><path d="M7 7h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"></path>{#if JAR[on]}<rect x="7" y={19 - JAR[on]} width="10" height={JAR[on]} fill="currentColor" opacity=".9"></rect>{/if}</svg></span>
  <span class="g g-plants" aria-hidden="true">{#if on === 0}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5" stroke-linecap="round"><path d="M6 20h12"></path><path d="M12 20v-6"></path></svg>{:else}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 20h12"></path>{#if on === 1}<path d="M12 20v-5"></path>{:else if on === 2}<path d="M12 20v-7"></path><path d="M12 15c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z" fill="currentColor"></path>{:else if on === 3}<path d="M12 20V9"></path><path d="M12 15c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4z" fill="currentColor"></path><path d="M12 12c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z" fill="currentColor"></path>{:else}<path d="M12 20V6"></path><path d="M12 16c-3 0-5-2-5-5 3 0 5 2 5 5z" fill="currentColor"></path><path d="M12 13c3 0 5-2 5-5-3 0-5 2-5 5z" fill="currentColor"></path><path d="M12 9c-2 0-3-1-3-3 2 0 3 1 3 3z" fill="currentColor"></path>{/if}</svg>{/if}</span>
  <span class="lvl-word">{LEVELS[level]}</span>
</span>
