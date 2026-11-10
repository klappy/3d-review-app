// Observational only. No media mutation, requests, storage, telemetry or URL output.
export function observe(video, output) {
  const display = (event) => {
    const finite = value => Number.isFinite(value) ? value.toFixed(1) : 'unknown';
    output.textContent = `${event?.type ?? 'initial'}; time ${finite(video.currentTime)} / ${finite(video.duration)}; paused ${video.paused}; ready ${video.readyState}; network ${video.networkState}; media error ${video.error?.code ?? 0}`;
  };
  const events = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'playing', 'pause', 'timeupdate', 'waiting', 'stalled', 'error', 'emptied'];
  for (const event of events) video.addEventListener(event, display);
  display();
  return () => { for (const event of events) video.removeEventListener(event, display); };
}
