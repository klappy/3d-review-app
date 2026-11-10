<!-- UI Next (v4) document top bar (actions lane): .top[data-variant=document] — brand → "/" → document title → document actions,
     as generator boards_report.py draws it for ActionPlan. design-system.md "Top bar variants and breadcrumb" (R12) names the document
     variant; the shared ../../TopBar.svelte refuses it ("not ported yet"), so this lane-local variant carries it. Desktop only. Status: provisional. -->
<script>
  import Mark from "../../Mark.svelte";
  let { title, home, children } = $props();
  if (!(typeof title === "string" && title.trim())) throw new TypeError("DocTop: the document title is required");
  if (!(typeof home === "string" && home)) throw new TypeError("DocTop: home is the brand link (build it with ../href.js)");
</script>

<header class="top" data-variant="document">
  <a class="brand" href={home}><Mark /><span>3D Review</span></a>
  <span class="small" aria-hidden="true">/</span>
  <span class="h3">{title}</span>
  <div class="top-end l-row" data-gap="2">{@render children?.()}</div>
</header>
