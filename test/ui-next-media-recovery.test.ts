// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Landing from '../ui-next/src/screens/Landing.svelte';
import MediaCard from '../ui-next/src/MediaCard.svelte';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const label = 'What 3D Review is · 2:00';
const cta = 'Watch how it works · 2:00';
const setup = () => {
  const view = render(Landing, { props: { phone: true, home: '#/projects' } });
  const media = view.getByLabelText(label, { selector: 'video' }) as HTMLVideoElement;
  return { view, media, button: view.getByRole('button', { name: cta }) };
};

for (const src of ['//evil.example/video.mp4', '/\\evil.example/video.mp4', 'javascript:alert(1)', 'http://evil.example/video.mp4']) {
  it(`rejects unsafe media source ${src}`, () => {
    expect(() => render(MediaCard, { props: { title: 'Video', src } })).toThrow('MediaCard: src must');
  });
}

it('rejects an unsafe direct fallback even when the embedded source is same-origin', () => {
  expect(() => render(MediaCard, { props: { title: 'Video', src: '/v2/media/film.mp4', directSrc: '//evil.example/' } })).toThrow('MediaCard: directSrc must');
});

it('reports bounded source/video state without exposing URLs or exception text', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('private URL or token', 'NotSupportedError'));
  const { view, media, button } = setup();
  Object.defineProperty(media, 'networkState', { configurable: true, value: 3 });
  await fireEvent.error(media.querySelector('source')!);
  expect(view.getByRole('status').textContent).toContain('source; media error 0; ready 0; network 3');
  await fireEvent.click(button);
  expect(view.getByRole('status').textContent).toContain('play NotSupportedError');
  expect(view.getByRole('status').textContent).not.toContain('private URL');
  await fireEvent.playing(media);
  expect(view.queryByRole('status')).toBeNull();
});

it('starts an uninitialized element synchronously in the user click before presentation effects', async () => {
  const order: string[] = [];
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => { order.push('load'); });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => { order.push('play'); return Promise.resolve(); });
  const { media, button } = setup();
  media.scrollIntoView = () => { order.push('scroll'); };
  media.focus = () => { order.push('focus'); };
  button.click();
  expect(order.slice(0, 2)).toEqual(['load', 'play']);
  expect(order.indexOf('play')).toBeLessThan(order.indexOf('scroll'));
});

it('does not turn an ordinary interrupted play request into a broken-file message', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('Interrupted by pause', 'AbortError'));
  const { view, button } = setup();
  await fireEvent.click(button);
  expect(view.queryByRole('status')).toBeNull();
});

it('ignores an older play rejection after a newer native playback success', async () => {
  let rejectFirst!: (error: Error) => void;
  const first = new Promise<void>((_, reject) => { rejectFirst = reject; });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValueOnce(first).mockResolvedValue();
  const { view, media, button } = setup();
  await fireEvent.click(button);
  await fireEvent.click(button);
  await fireEvent.playing(media);
  rejectFirst(new DOMException('Old request was rejected', 'NotAllowedError'));
  await Promise.resolve();
  await Promise.resolve();
  expect(view.queryByRole('status')).toBeNull();
});

it('distinguishes activation rejection from a media failure and permits a direct retry', async () => {
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValueOnce(new DOMException('Activation required', 'NotAllowedError')).mockResolvedValue();
  const { view, media, button } = setup();
  await fireEvent.click(button);
  expect(view.getByRole('status').textContent).toContain('Tap the play control');
  expect(view.getByRole('status').textContent).not.toContain('could not play');
  Object.defineProperty(media, 'error', { configurable: true, value: { code: 3 } });
  await fireEvent.error(media);
  expect(view.getByRole('status').textContent).toContain('media error 3');
  await fireEvent.click(view.getByRole('button', { name: 'Try video again' }));
  expect(load).toHaveBeenCalledTimes(2);
  expect(play).toHaveBeenCalledTimes(2);
  await fireEvent.playing(media);
  expect(view.queryByRole('status')).toBeNull();
});
