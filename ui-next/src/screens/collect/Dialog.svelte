<!-- UI Next (v4) collect lane dialog / sheet. Status: provisional. Contract: design-system.md §2 Dialog row + "Dialog and sheet states" (R14):
     one native <dialog> opened with showModal() (WHATWG dialog element; WAI-ARIA APG Dialog (Modal)), desktop dialog.glass-hi, phone
     dialog.glass-hi.sheet (geometry, ::backdrop --scrim and the scroll lock are the PIN's §8.7 rows). The screens draw the open state, so it
     opens on mount. Title row = the title snippet + the visible close (.btn-icon "×", aria-label Close) at its top right, then the body.
     Dismissal (R14 "Escape and dismissal"): Close, Escape (the cancel event, and a close the browser forces) and a click or tap outside the
     dialog's bounding rect all go to cancel, the href of the page the dialog was opened from, so the URL leaves the open state.
     handle: the sheet's decorative grab handle (.sheet-handle, aria-hidden). pad="menu": the menu-rows sheet padding. titleTop: the close
     sits at the top of a tall title block (CloseCollection: icon tile over the title; PrintQR: title over its intro), else centred on
     the title line. describedby: the id of a line that says what the dialog is for (PrintQR's intro), set as aria-describedby.
     navigate: how it leaves (default location.assign; tests pass a spy). Where showModal is missing (jsdom) it falls back to the open attribute. -->
<script>
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { G } from "./glyphs.js";
  import { gapAttr } from "../../gap.js";
  const assign = (url) => {
    try { globalThis.location?.assign?.(url); } catch { /* no navigation here (jsdom) */ }
  };
  let { labelledby, describedby, cancel, sheet = false, wide = false, handle = false, pad, gap = 4, titleTop = false, navigate = assign, title, children } = $props();
  if (!(typeof labelledby === "string" && labelledby)) throw new TypeError("Dialog: aria-labelledby points at the visible title");
  if (!(typeof cancel === "string" && cancel)) throw new TypeError("Dialog: cancel is the href Close, Escape and the backdrop go to (R14)");
  if (!title) throw new TypeError("Dialog: a title snippet is required (R14 title row)");
  const g = $derived(gapAttr(gap, "Dialog"));
  if (pad !== undefined && pad !== "menu") throw new TypeError(`Dialog: pad is menu or absent, got ${String(pad)}`);
  const modal = (el) => {
    let leaving = false;
    const away = () => { if (!leaving) { leaving = true; navigate(cancel); } };
    const oncancel = (e) => { e.preventDefault(); away(); };
    const onclose = () => away();
    const onclick = (e) => {
      if (e.target !== el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) away();
    };
    try { if (typeof el.showModal === "function") el.showModal(); else el.setAttribute("open", ""); } catch { el.setAttribute("open", ""); }
    el.addEventListener("cancel", oncancel);
    el.addEventListener("close", onclose);
    el.addEventListener("click", onclick);
    return () => {
      leaving = true;
      el.removeEventListener("cancel", oncancel);
      el.removeEventListener("close", onclose);
      el.removeEventListener("click", onclick);
      if (el.open && typeof el.close === "function") el.close();
    };
  };
</script>

{#snippet x()}<Icon d={G.x} />{/snippet}

<dialog {@attach modal} class={sheet ? "glass-hi sheet" : "glass-hi"} data-w={wide ? "wide" : undefined} data-pad={pad} aria-labelledby={labelledby} aria-describedby={describedby}>
  {#if handle}<div class="sheet-handle" aria-hidden="true"></div>{/if}
  <div class="l-stack" data-gap={g}>
    <div class="l-row" data-gap="3" data-split data-align={titleTop ? "start" : undefined}>{@render title()}<Button icon={x} ariaLabel="Close" variant="quiet" href={cancel} /></div>
    {@render children?.()}
  </div>
</dialog>
