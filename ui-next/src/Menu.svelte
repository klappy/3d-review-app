<!-- UI Next (v4) Menu. Status: provisional. Light DOM, literal contract classes, no <style>.
     Contract: design-system.md section 2 Menu row + "Disclosure, menu roles and the refused item" (R11):
     native details.dd > summary + .menu as a disclosure; no role=menu / menuitem / aria-haspopup; danger last after hr;
     a refused item is a button[aria-disabled=true] with its reason in .mi-why, never an <a>.
     Behaviour (live QA Q7): one menu open at a time; a click or tap outside closes it; Escape closes it and returns focus to its
     summary; choosing a link item closes it. Layering: an open menu (and the top bar that holds two) sits above the page (topbar.css). -->
<script>
  import Icon from "./Icon.svelte";
  import ThemeControl from "./ThemeControl.svelte";
  let { summary, summaryClass = "menu-btn", label, title, items = [], align = "end", open = false, id = "menu" } = $props();
  if (!summary) throw new TypeError("Menu: a summary snippet is required");
  for (const it of items) {
    if (it.refused && it.href) throw new TypeError("Menu: a refused item is never a link");
    if (it.refused && !(typeof it.refused === "string" && it.refused.trim())) throw new TypeError("Menu: a refused item says why");
  }
  const di = items.findIndex((it) => it.danger);
  if (di !== -1 && di !== items.length - 1) throw new TypeError("Menu: the destructive item is last");
  if (di > 0 && items[di - 1].kind !== "hr") throw new TypeError("Menu: the destructive item follows an hr");
  const behave = (el) => {
    const doc = el.ownerDocument;
    const close = (refocus) => { if (!el.open) return; el.open = false; if (refocus) el.querySelector(":scope > summary")?.focus(); };
    const onToggle = () => { if (el.open) for (const d of doc.querySelectorAll("details.dd[data-menu][open]")) if (d !== el) d.open = false; };
    const onDown = (e) => { if (el.open && !el.contains(e.target)) close(false); };
    const onKey = (e) => { if (e.key === "Escape" && el.open) { e.stopPropagation(); close(true); } };
    const onClick = (e) => { if (e.target instanceof Element && e.target.closest("a.mi")) close(false); };
    el.addEventListener("toggle", onToggle); el.addEventListener("keydown", onKey); el.addEventListener("click", onClick); doc.addEventListener("pointerdown", onDown);
    return () => { el.removeEventListener("toggle", onToggle); el.removeEventListener("keydown", onKey); el.removeEventListener("click", onClick); doc.removeEventListener("pointerdown", onDown); };
  };
</script>

<details class="dd" data-menu {open} {@attach behave}>
  <summary class={summaryClass} aria-label={label} {title}>{@render summary()}</summary>
  <div class="glass-hi menu" data-align={align === "start" ? "start" : undefined}>
    {#each items as it, i}
      {#if it.kind === "hr"}<hr class="hr" />
      {:else if it.kind === "head"}<div class="mi-head"><div class="h3">{it.label}</div>{#if it.sub}<div class="small">{it.sub}</div>{/if}</div>
      {:else if it.kind === "theme"}<ThemeControl uid={id} />
      {:else if it.kind === "micro"}<div class="micro mi-head">{it.label}</div>
      {:else if it.refused}
        <button class={it.danger ? "mi danger" : "mi"} type="button" aria-disabled="true" aria-describedby={`${id}-${i}-why`}>{#if it.icon}<Icon d={it.icon} />{/if}{it.label}</button>
        <p class="mi-why small" id={`${id}-${i}-why`}>{it.refused}</p>
      {:else if it.href}
        <a class={it.danger ? "mi danger" : "mi"} href={it.href}>{#if it.icon}<Icon d={it.icon} />{/if}{it.label}{#if it.tag}<span class="tag">{it.tag}</span>{/if}</a>
      {:else}
        <button class={it.danger ? "mi danger" : "mi"} type="button" onclick={it.onclick}>{#if it.icon}<Icon d={it.icon} />{/if}{it.label}{#if it.tag}<span class="tag">{it.tag}</span>{/if}</button>
      {/if}
    {/each}
  </div>
</details>
