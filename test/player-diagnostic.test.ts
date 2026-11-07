import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../ui/player-diagnostic.html', import.meta.url), 'utf8');
const mediaPath = '/v2/media/overview-8bd9e6de2dcf.mp4';

it('uses two literal native source patterns without app initialization or extra media features', () => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const videos = [...document.querySelectorAll('video')];
  expect(videos).toHaveLength(2);
  expect(videos[0].getAttribute('src')).toBe(mediaPath);
  expect(videos[0].querySelector('source')).toBeNull();
  expect(videos[1].hasAttribute('src')).toBe(false);
  expect(videos[1].querySelector('source')?.getAttribute('src')).toBe(mediaPath);
  expect(videos[1].querySelector('source')?.getAttribute('type')).toBe('video/mp4');
  for (const video of videos) {
    expect(video.controls).toBe(true); expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.preload).toBe('metadata'); expect(video.autoplay).toBe(false);
    expect(video.hasAttribute('poster')).toBe(false); expect(video.hasAttribute('crossorigin')).toBe(false);
    expect(video.querySelector('track')).toBeNull();
  }
  const script = document.querySelector('script')!.textContent!;
  expect(script).not.toMatch(/\.(?:play|pause|load)\(/);
  expect(script).not.toMatch(/XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  expect(document.querySelector('script[src]')).toBeNull();
  dom.window.close();
});

it('makes only a user-triggered fixed same-origin credential-free two-byte check', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([0, 0]), { status: 206, headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-1/20195565', 'Content-Length': '2' } }));
  const dom = new JSDOM(html, { runScripts: 'dangerously', beforeParse(window) { window.fetch = fetch; } });
  expect(fetch).not.toHaveBeenCalled();
  const button = dom.window.document.getElementById('range-check') as HTMLButtonElement;
  button.click(); await vi.waitFor(() => expect(button.disabled).toBe(false));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(mediaPath);
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: { Range: 'bytes=0-1' }, credentials: 'omit', cache: 'no-store', redirect: 'error' });
  expect(dom.window.document.getElementById('range-state')!.textContent).toBe('HTTP 206; Content-Type video/mp4; Content-Range bytes 0-1/20195565; Content-Length 2; body 2 bytes.');
  dom.window.close();
});

it('cancels an oversized response rather than buffering the whole film', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32)); }, cancel });
  const fetch = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
  const dom = new JSDOM(html, { runScripts: 'dangerously', beforeParse(window) { window.fetch = fetch; } });
  const button = dom.window.document.getElementById('range-check') as HTMLButtonElement;
  button.click(); await vi.waitFor(() => expect(button.disabled).toBe(false));
  expect(cancel).toHaveBeenCalledOnce();
  expect(dom.window.document.getElementById('range-state')!.textContent).toContain('body more than 16 (stopped) bytes');
  dom.window.close();
});

it('observes a native source failure without treating network state as an error count', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const document = dom.window.document;
  const video = document.getElementById('source-player') as HTMLVideoElement;
  Object.defineProperty(video, 'networkState', { value: 3 });
  video.querySelector('source')!.dispatchEvent(new dom.window.Event('error'));
  expect(document.getElementById('source-state')!.textContent).toContain('source error: NETWORK_NO_SOURCE; HAVE_NOTHING; native media error none');
  expect(document.getElementById('source-state')!.textContent).toContain('not an error count');
  dom.window.close();
});
