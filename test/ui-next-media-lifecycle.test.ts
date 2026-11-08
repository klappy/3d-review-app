// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import MediaCard from '../ui-next/src/MediaCard.svelte';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const first = '/v2/media/overview-8bd9e6de2dcf.mp4';
const second = '/v2/media/another-approved-film.mp4';
const props = { title: 'Overview', src: first };
const prepare = () => {
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  return { load, pause, play };
};

it('assigns the native video source and selects it only after the node is connected', () => {
  const { load, play } = prepare();
  const seen: unknown[] = [];
  load.mockImplementation(function (this: HTMLMediaElement) { seen.push([this.isConnected, this.getAttribute('src'), this.querySelector('source')]); });
  const view = render(MediaCard, { props });
  expect(seen).toEqual([[true, first, null]]);
  expect(view.container.querySelector('video')?.getAttribute('src')).toBe(first);
  expect(play).not.toHaveBeenCalled();
});

it('keeps the same resource through unrelated prop updates and native playback', async () => {
  const { load, play } = prepare();
  const view = render(MediaCard, { props });
  const video = view.container.querySelector('video')!;
  await fireEvent.playing(video);
  await view.rerender({ ...props, title: 'Updated label', caption: 'New caption' });
  expect(view.container.querySelector('video')).toBe(video);
  expect(video.getAttribute('src')).toBe(first);
  expect(load).toHaveBeenCalledTimes(1);
  expect(play).not.toHaveBeenCalled();
});

it('selects a genuinely changed source and ignores a rejection from the old source', async () => {
  const { load, play } = prepare();
  let rejectOld!: (error: Error) => void;
  play.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectOld = reject; }));
  const view = render(MediaCard, { props });
  const video = view.container.querySelector('video')!;
  await fireEvent.error(video);
  await fireEvent.click(view.getByRole('button', { name: 'Try video again' }));
  await view.rerender({ ...props, src: second });
  expect(video.getAttribute('src')).toBe(second);
  expect(load).toHaveBeenCalledTimes(3); // Initial selection, retry, real source change.
  rejectOld(new DOMException('Old source failed', 'NotSupportedError'));
  await Promise.resolve(); await Promise.resolve();
  expect(view.queryByRole('status')).toBeNull();
  await fireEvent.error(video);
  expect(view.getByRole('status').textContent).toContain('video; media error');
});

it('validates a changed source before assigning or loading it', async () => {
  const { load } = prepare();
  const view = render(MediaCard, { props });
  const video = view.container.querySelector('video')!;
  await expect(view.rerender({ ...props, src: '//untrusted.example/film.mp4' })).rejects.toThrow('MediaCard: src must');
  expect(video.getAttribute('src')).toBe(first);
  expect(load).toHaveBeenCalledTimes(1);
});

it('pauses and clears the media resource on unmount', async () => {
  const { load, pause } = prepare();
  const view = render(MediaCard, { props });
  const video = view.container.querySelector('video')!;
  await view.unmount();
  expect(pause).toHaveBeenCalledTimes(1);
  expect(video.hasAttribute('src')).toBe(false);
  expect(load).toHaveBeenCalledTimes(2);
  expect(video.isConnected).toBe(false);
});
