<!-- UI Next (v4) Media card. Status: provisional (captain ruling 2026-10-20 22:29 ET).
     Contract: design-system.md section 2 "Media card": .glass-hi.l-media > .l-media-frame (16:10 dark frame, .l-media-play disc, .l-media-title line) + caption.
     src: an approved HTTPS or same-origin media URL when the video exists; absent = placeholder frame.
     Never auto-plays. No <style>, no inline style. -->
<script>
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  let { title, duration, caption, src, directSrc, poster, captions } = $props();
  if (!(typeof title === "string" && title.trim())) throw new TypeError("MediaCard: title is required");
  const safeMediaUrl = (value) => typeof value === 'string' && (/^https:\/\//.test(value) || /^\/(?![\/\\])[^\\\s]*$/.test(value));
  if (src != null && !safeMediaUrl(src)) throw new TypeError("MediaCard: src must be an https or same-origin media URL");
  if (directSrc != null && !safeMediaUrl(directSrc)) throw new TypeError("MediaCard: directSrc must be an https or same-origin media URL");
  const fallback = $derived(directSrc ?? src);
  let video;
  let failure = $state('');
  let playAttempt = 0;
  function diagnostic(kind) {
    // Only fixed event labels and native numeric state: never URLs, tokens or exception messages.
    return `${kind}; media error ${video?.error?.code ?? 0}; ready ${video?.readyState ?? 0}; network ${video?.networkState ?? 0}`;
  }
  function mediaFailed(event) {
    ++playAttempt;
    failure = `The video could not play here (${diagnostic(event?.currentTarget?.tagName === 'SOURCE' ? 'source' : 'video')}).`;
  }
  function initializeMedia(node, initialSource) {
    let currentSource;
    const selectSource = (nextSource) => {
      if (nextSource === currentSource) return;
      if (!safeMediaUrl(nextSource)) throw new TypeError("MediaCard: src must be an https or same-origin media URL");
      currentSource = nextSource;
      ++playAttempt;
      failure = '';
      // Actions run on the connected element. Select the resource explicitly,
      // rather than mutating a child source in an imported, empty video template.
      node.src = nextSource;
      node.load();
    };
    selectSource(initialSource);
    return {
      update: selectSource,
      destroy() {
        ++playAttempt;
        node.pause();
        node.removeAttribute('src');
        node.load();
      }
    };
  }
  function playing() {
    ++playAttempt;
    failure = '';
  }
  export function play() {
    if (!video) return;
    const media = video;
    const attempt = ++playAttempt;
    const retry = !!failure || !!media.error || media.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
    failure = '';
    const rejected = (error) => {
      if (attempt !== playAttempt || !media.paused || error?.name === 'AbortError') return;
      failure = error?.name === 'NotAllowedError'
        ? 'Tap the play control in the video to start playback.'
        : `The video could not play here (${diagnostic(error?.name === 'NotSupportedError' ? 'play NotSupportedError' : 'play rejected')}).`;
    };
    // Initialize/retry and play in the tap itself, before scrolling or focus.
    // Do not await a load event: Safari requires playback to retain activation.
    try {
      if (retry || media.networkState === HTMLMediaElement.NETWORK_EMPTY) media.load();
      media.play()?.catch(rejected);
    } catch (error) { rejected(error); }
    media.focus({ preventScroll: true });
    media.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }
  const line = $derived(duration ? `${title} · ${duration}` : title);
</script>

<div class="glass-hi l-media" role="group" aria-label={line}>
  <div class="l-media-frame">
    {#if src}<video bind:this={video} use:initializeMedia={src} {poster} controls playsinline preload="metadata" tabindex="0" aria-label={line} onerror={mediaFailed} onplaying={playing}>
      {#if captions}<track kind="captions" src={captions} srclang="en" label="English" />{/if}
      <a href={fallback}>Open the video</a>
    </video>{:else}<span class="icn l-media-play" aria-hidden="true"><Icon d={I.play} size={32} /></span>{/if}
    {#if !src}<span class="micro l-media-title">{line}</span>{/if}
  </div>
  {#if failure}<p class="small" role="status">{failure} <button type="button" onclick={play}>Try video again</button> or <a href={fallback}>open the video directly</a>.</p>{/if}
  {#if src}<p class="small"><a href={fallback}>Open video separately</a>{#if captions} · English text captions are available in the player.{/if}</p>{/if}
  {#if caption}<p class="small">{caption}</p>{/if}
</div>
