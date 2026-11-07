<!-- UI Next (v4) Media card. Status: provisional (captain ruling 2026-10-20 22:29 ET).
     Contract: design-system.md section 2 "Media card": .glass-hi.l-media > .l-media-frame (16:10 dark frame, .l-media-play disc, .l-media-title line) + caption.
     src: a URL an approved HTTPS media source when the video exists; absent = placeholder frame.
     Never auto-plays. No <style>, no inline style. -->
<script>
  import Icon from "./Icon.svelte";
  import { I } from "./icons.js";
  let { title, duration, caption, src, poster, captions } = $props();
  if (!(typeof title === "string" && title.trim())) throw new TypeError("MediaCard: title is required");
  if (src != null && !/^https:\/\//.test(src)) throw new TypeError("MediaCard: src must be an https media URL");
  let video;
  let failed = $state(false);
  export function play() {
    video?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    video?.focus();
    if (failed) { video?.load(); failed = false; }
    try { video?.play()?.catch(() => { failed = true; }); } catch { failed = true; }
  }
  const line = $derived(duration ? `${title} · ${duration}` : title);
</script>

<div class="glass-hi l-media" role="group" aria-label={line}>
  <div class="l-media-frame">
    {#if src}<video bind:this={video} {src} {poster} controls playsinline preload="none" tabindex="0" aria-label={line} onerror={() => { failed = true; }} onplaying={() => { failed = false; }}>
      {#if captions}<track kind="captions" src={captions} srclang="en" label="English" />{/if}
      <a href={src}>Open the video</a>
    </video>{:else}<span class="icn l-media-play" aria-hidden="true"><Icon d={I.play} size={32} /></span>{/if}
    {#if !src}<span class="micro l-media-title">{line}</span>{/if}
  </div>
  {#if failed}<p class="small" role="status">The video could not play here. <a href={src}>Open the video directly</a>, or try the player again.</p>{/if}
  {#if src}<p class="small"><a href={src}>Open video separately</a>{#if captions} · English text captions are available in the player.{/if}</p>{/if}
  {#if caption}<p class="small">{caption}</p>{/if}
</div>
