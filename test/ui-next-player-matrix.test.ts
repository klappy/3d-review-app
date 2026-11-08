// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import HomepageCase from '../ui-player-matrix/HomepageCase.svelte';
import ReducedCase from '../ui-player-matrix/ReducedCase.svelte';
import { CASES } from '../ui-player-matrix/cases.js';
import { OVERVIEW } from '../ui-next/src/overview-video.js';
beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
for (const configuration of CASES.filter(c => c.kind !== 'native')) it(`${configuration.id}: intended component features only`, async () => {
  const seen: boolean[] = [];
  vi.mocked(HTMLMediaElement.prototype.load).mockImplementation(function(this: HTMLMediaElement) { seen.push(this.isConnected); });
  const view = render(configuration.kind === 'homepage' ? HomepageCase : ReducedCase, { props: { configuration } });
  const videos = view.container.querySelectorAll('video'); expect(videos).toHaveLength(1);
  const video = videos[0]; expect(video.getAttribute('src')).toBe(OVERVIEW.src);
  expect(video.controls).toBe(true); expect(video.preload).toBe('metadata'); expect(video.autoplay).toBe(false); expect(video.hasAttribute('playsinline')).toBe(true);
  expect(video.querySelector('source')).toBeNull(); expect(video.hasAttribute('crossorigin')).toBe(false);
  expect(video.getAttribute('poster')).toBe(configuration.poster ? OVERVIEW.poster : null);
  expect(video.querySelector('track')?.getAttribute('src') ?? null).toBe(configuration.captions ? OVERVIEW.captions : null);
  expect(video.querySelector('track[default]')).toBeNull();
  expect(seen).toEqual(configuration.lifecycle === false ? [] : [true]);
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  const button = view.queryByRole('button', { name: 'Watch how it works · 2:00' });
  expect(!!button).toBe(configuration.kind === 'homepage');
  if (button) { await fireEvent.click(button); expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1); }
  await fireEvent.error(video);
  expect(!!view.queryByRole('status')).toBe(configuration.kind === 'homepage');
  if (configuration.kind === 'homepage') expect(view.getByRole('status').textContent).not.toMatch(/media error|ready|network/);
});
