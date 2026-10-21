<!-- UI Next (v4) collect lane room health. Status: provisional. Contract: design-system.md §2 Room health row (ruling 8): one
     [role=status] polite line "N surveys opened in the last minute" + a .tag "N opens turned away"; when N > 0 the warn tag
     (.tag[data-kind=warn], cookbook PR #188 --warn token, not yet in the pinned base.css) and one instruction under it.
     instruction=false on the projector QR room (the room line sits under the codes instead). Data: no capability yet (§2 Room health
     "no capability yet"), so the fixture's room counts drive it. -->
<script>
  let { opened, refused = 0, instruction = true, wrap = false } = $props();
  if (!Number.isInteger(opened) || !Number.isInteger(refused)) throw new TypeError("RoomHealth: opened and refused are counts");
</script>

{#snippet line()}<div class="l-row" data-gap="2" data-wrap={wrap ? "" : undefined} role="status" aria-live="polite"><span class="small"><strong class="tab-n">{opened}</strong> surveys opened in the last minute</span>{#if refused}<span class="tag" data-kind="warn">{refused} opens turned away</span>{:else}<span class="tag">0 opens turned away</span>{/if}</div>{/snippet}
{#if refused && instruction}<div class="l-stack" data-gap="1">{@render line()}<p class="small">Ask people on shared Wi-Fi to switch to mobile data, or hand out paper surveys.</p></div>{:else}{@render line()}{/if}
