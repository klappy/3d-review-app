<script>
  import Stack from "../../Stack.svelte";
  import { reviewResources, RESOURCES_COMING } from "./resource-data.js";
  let { weak = [] } = $props();
  const areas = $derived(reviewResources(weak));
</script>

<section aria-label="Resources for weakest areas">
  <Stack gap={3}>
    <div><h2 class="h3">Resources for weakest areas</h2><p class="small">For areas that need support or urgent attention. Resource links open in a new tab.</p></div>
    {#if !areas.length}<p class="small">No low-scoring areas are available to show from this report.</p>{/if}
    {#each areas as area}
      <div data-resources-for={area.label}>
        <h3 class="small">{area.label}</h3>
        {#if area.resources.length}
          <ul>{#each area.resources as resource}<li><a class="link" href={resource.url} target="_blank" rel="noopener noreferrer">{resource.title}</a></li>{/each}</ul>
        {:else}<p class="small">{RESOURCES_COMING}</p>{/if}
      </div>
    {/each}
  </Stack>
</section>
