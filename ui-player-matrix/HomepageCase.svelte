<script>
  import MediaCard from '../ui-next/src/MediaCard.svelte';
  import { OVERVIEW } from '../ui-next/src/overview-video.js';
  let { configuration } = $props();
  let media;
</script>
<button type="button" class="btn btn-quiet" onclick={() => media?.play()}>Watch how it works · 2:00</button>
<MediaCard bind:this={media} title="What 3D Review is" duration={OVERVIEW.duration} src={OVERVIEW.src} directSrc={OVERVIEW.directSrc} poster={configuration.poster ? OVERVIEW.poster : undefined} captions={configuration.captions ? OVERVIEW.captions : undefined} />
