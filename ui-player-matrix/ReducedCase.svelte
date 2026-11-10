<!-- Diagnostic-only reduction, never imported by the product. The retained source
     action matches MediaCard's resource operations, without playback/error state. -->
<script>
  import { OVERVIEW } from '../ui-next/src/overview-video.js';
  let { configuration } = $props();
  function initializeMedia(node, initialSource) {
    let currentSource;
    const selectSource = (nextSource) => {
      if (nextSource === currentSource) return;
      if (nextSource !== OVERVIEW.src) throw new TypeError('Unexpected diagnostic source');
      currentSource = nextSource;
      node.src = nextSource;
      node.load();
    };
    selectSource(initialSource);
    return { update: selectSource, destroy() { node.pause(); node.removeAttribute('src'); node.load(); } };
  }
</script>
<div class="glass-hi l-media" role="group" aria-label="What 3D Review is · 2:00">
  <div class="l-media-frame">
    {#if configuration.lifecycle}
      <video use:initializeMedia={OVERVIEW.src} poster={configuration.poster ? OVERVIEW.poster : undefined} controls playsinline preload="metadata" tabindex="0" aria-label="What 3D Review is · 2:00">
        {#if configuration.captions}<track kind="captions" src={OVERVIEW.captions} srclang="en" label="English" />{/if}
        <a href={OVERVIEW.directSrc}>Open the video</a>
      </video>
    {:else}
      <video src={OVERVIEW.src} controls playsinline preload="metadata" tabindex="0" aria-label="What 3D Review is · 2:00"><a href={OVERVIEW.directSrc}>Open the video</a></video>
    {/if}
  </div>
  <p class="small"><a href={OVERVIEW.directSrc}>Open video separately</a></p>
</div>
