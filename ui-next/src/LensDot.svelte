<!-- UI Next (v4) Lens dot / lens point. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 2, Lens dot row. Ported: the data-lens colour binding only (kind="dot" -> .lensdot,
     kind="pt" -> .pt); barbell geometry and extension wait on V-39. -->
<script module>
  export const LENSES = Object.freeze({ team: "Translation team", community: "Community", church: "Church" });
</script>
<script>
  let { lens, label, decorative = false, kind = "dot" } = $props();
  if (kind !== "dot" && kind !== "pt") throw new TypeError(`LensDot: unknown kind "${kind}" (dot | pt)`);
  if (typeof lens !== "string" || !Object.hasOwn(LENSES, lens)) throw new TypeError(`LensDot: unknown lens "${lens}" (team | community | church)`);
  if (label !== undefined && !(typeof label === "string" && label.trim())) throw new TypeError("LensDot: label must be non-empty text");
  if (decorative && label !== undefined) throw new TypeError("LensDot: a decorative dot takes no label");
  const name = $derived(decorative ? undefined : label === undefined ? LENSES[lens] : label.trim());
</script>

<span class={kind === "pt" ? "pt" : "lensdot"} data-lens={lens} role={decorative ? undefined : "img"} aria-label={name} aria-hidden={decorative ? "true" : undefined}></span>
