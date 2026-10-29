<!-- UI Next (v4) Media card. Status: provisional (captain ruling 2026-10-20 22:29 ET).
     Contract: design-system.md section 2 "Media card": .glass-hi.l-media > .l-media-frame (16:10 dark frame, .l-media-play disc, .l-media-title line) + caption.
     src: a URL served through the Transcode proxy (klappy/transcode generate_transcode_url) when the video exists; absent = placeholder frame.
     Never auto-plays. No <style>, no inline style. -->
<script>
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  let { title, duration, caption, src, poster } = $props();
  if (!(typeof title === "string" && title.trim())) throw new TypeError("MediaCard: title is required");
  if (src != null && !/^https:\/\//.test(src)) throw new TypeError("MediaCard: src must be an https Transcode proxy URL");
  const line = $derived(duration ? `${title} · ${duration}` : title);
</script>

<div class="glass-hi l-media" role="group" aria-label={line}>
  <div class="l-media-frame">
    {#if src}<video {src} {poster} controls preload="none" aria-label={line}></video>{:else}<span class="icn l-media-play" aria-hidden="true"><Icon d={I.play} size={32} /></span>{/if}
    <span class="micro l-media-title">{line}</span>
  </div>
  {#if caption}<p class="small">{caption}</p>{/if}
</div>
