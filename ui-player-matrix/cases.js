// Cumulative ladders. Every document loads exactly one fixed media resource.
export const CASES = Object.freeze([
  { id: 'a0', title: 'A0 · Working plain player', note: 'Literal HTML video. Native controls only.', kind: 'native', poster: false, captions: false, card: false },
  { id: 'a1', title: 'A1 · Add the poster', note: 'A0 plus the homepage poster.', kind: 'native', poster: true, captions: false, card: false },
  { id: 'a2', title: 'A2 · Add the captions track', note: 'A1 plus the same optional English VTT track, still default-off.', kind: 'native', poster: true, captions: true, card: false },
  { id: 'a3', title: 'A3 · Add homepage card styling', note: 'A2 plus the actual card CSS and positioned video frame.', kind: 'native', poster: true, captions: true, card: true },
  { id: 'a4', title: 'A4 · Add Svelte and source initialization', note: 'A3 changes DOM construction to Svelte and selects src with the connected-node load lifecycle. Native controls only. This step changes construction and initialization together; R5 tests Svelte without that lifecycle.', kind: 'reduced', poster: true, captions: true, card: true, lifecycle: true },
  { id: 'a5', title: 'A5 · Add homepage playback handlers', note: 'A4 plus the real homepage MediaCard and its Watch button, retry, error handling, focus and scroll. This preserves the failing 0.41.6 homepage configuration, not the signed-in app shell.', kind: 'homepage', poster: true, captions: true, card: true },
  { id: 'r0', title: 'R0 · Previous homepage player baseline', note: 'The real MediaCard and Watch button in the failing 0.41.6 configuration, including its optional captions track. Same player as A5; no Live auth or navigation shell.', kind: 'homepage', poster: true, captions: true, card: true },
  { id: 'r1', title: 'R1 · Remove the captions track', note: 'R0 without the VTT track.', kind: 'homepage', poster: true, captions: false, card: true },
  { id: 'r2', title: 'R2 · Remove the poster', note: 'R1 without the poster.', kind: 'homepage', poster: false, captions: false, card: true },
  { id: 'r3', title: 'R3 · Remove homepage card styling', note: 'R2 without the homepage CSS. Same real MediaCard and behavior.', kind: 'homepage', poster: false, captions: false, card: false },
  { id: 'r4', title: 'R4 · Remove custom playback handlers', note: 'R3 without Watch/retry/error handlers, focus or scroll. Svelte connected-source initialization remains; use native controls.', kind: 'reduced', poster: false, captions: false, card: false, lifecycle: true },
  { id: 'r5', title: 'R5 · Remove explicit source loading', note: 'R4 without the source action, explicit load or reset cleanup. Plain Svelte video with declarative src. Compare with literal-HTML A0.', kind: 'reduced', poster: false, captions: false, card: false, lifecycle: false },
]);
