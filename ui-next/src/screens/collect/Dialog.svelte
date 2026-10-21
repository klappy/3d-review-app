<!-- UI Next (v4) collect lane dialog / sheet. Status: provisional. Contract: design-system.md §2 Dialog row + "Dialog and sheet states" (R14):
     one native <dialog> opened with showModal() (WHATWG dialog element; WAI-ARIA APG Dialog (Modal)), desktop .glass-hi, phone .glass-hi.sheet;
     the modal makes the page behind inert, Escape closes as Cancel, focus returns to the opener. The screens draw the open state, so it opens
     on mount. Geometry (radius-xl, --dialog surface, --scrim ::backdrop, 560 / wide 1000 widths, the bottom sheet) has no rule in the
     pinned base.css yet: a canvas gap row (canvas-collect-gaps). Where showModal is missing (jsdom) it falls back to the open attribute. -->
<script>
  let { labelledby, sheet = false, wide = false, children } = $props();
  if (!(typeof labelledby === "string" && labelledby)) throw new TypeError("Dialog: aria-labelledby points at the visible title");
  const modal = (el) => {
    try { if (typeof el.showModal === "function") el.showModal(); else el.setAttribute("open", ""); } catch { el.setAttribute("open", ""); }
    return () => { if (el.open && typeof el.close === "function") el.close(); };
  };
</script>

<dialog {@attach modal} class={sheet ? "glass-hi sheet" : "glass-hi"} data-w={wide ? "wide" : undefined} aria-labelledby={labelledby}>{@render children?.()}</dialog>
