import { afterEach, expect, it, vi } from 'vitest';
import app from '../src/index';
import worker from '../src/worker';
import { OVERVIEW_MEDIA_PATH, OVERVIEW_MEDIA_URL } from '../src/overview-media';

afterEach(() => vi.unstubAllGlobals());
const request = (options: RequestInit = {}, query = '') => new Request(`https://dev.3dreview.app${OVERVIEW_MEDIA_PATH}${query}`, options);
const invoke = (r: Request) => app.fetch(r, {} as any);
const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', ETag: '"immutable-film"', 'Last-Modified': 'Fri, 06 Nov 2026 12:00:00 GMT' };

it('serves the fixed public film through the real Worker without auth or environment access', async () => {
  const body = new Uint8Array([0, 1, 2, 255]);
  const upstream = new Response(body, { headers: { ...headers, 'Content-Length': '4', 'Set-Cookie': 'must-not-forward' } });
  const fetch = vi.fn().mockResolvedValue(upstream); vi.stubGlobal('fetch', fetch);
  const response = await worker.fetch(request({ headers: { Cookie: 'private', Authorization: 'Bearer private', Referer: 'https://private.example/', Origin: 'https://private.example/' } }, '?url=https://evil.example/'), {} as any, {} as any);
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
  expect(fetch.mock.calls[0][0]).toBe(OVERVIEW_MEDIA_URL);
  const options = fetch.mock.calls[0][1];
  expect(Object.fromEntries(options.headers)).toEqual({ accept: 'video/mp4', 'accept-encoding': 'identity' });
  expect(options.redirect).toBe('manual'); expect(options.cache).toBe('no-store');
  expect(response.headers.get('etag')).toBe('"immutable-film"');
  expect(response.headers.get('accept-ranges')).toBe('bytes');
  expect(response.headers.get('content-length')).toBe('4');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('no-store');
});

for (const [range, contentRange] of [['bytes=0-1', 'bytes 0-1/20195565'], ['bytes=20195563-', 'bytes 20195563-20195564/20195565'], ['bytes=-2', 'bytes 20195563-20195564/20195565']]) {
  it(`preserves ${range}, validators and exact 206 bytes`, async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([6, 7]), { status: 206, headers: { ...headers, 'Content-Range': contentRange, 'Content-Length': '2' } })); vi.stubGlobal('fetch', fetch);
    const response = await invoke(request({ headers: { Range: range, 'If-Range': '"immutable-film"' } }));
    expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe(contentRange);
    expect(response.headers.get('content-length')).toBe('2'); expect(await response.arrayBuffer()).toEqual(new Uint8Array([6, 7]).buffer);
    expect(fetch.mock.calls[0][1].headers.get('Range')).toBe(range);
    expect(fetch.mock.calls[0][1].headers.get('If-Range')).toBe('"immutable-film"');
  });
}

it('preserves an upstream full 200 when If-Range no longer matches', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('full', { headers: { ...headers, 'Content-Length': '4' } })));
  const response = await invoke(request({ headers: { Range: 'bytes=0-1', 'If-Range': '"older"' } }));
  expect(response.status).toBe(200); expect(await response.text()).toBe('full');
});

it('preserves unsatisfiable range status and total length', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */20195565', 'Content-Length': '0' } })));
  const response = await invoke(request({ headers: { Range: 'bytes=99999999-' } }));
  expect(response.status).toBe(416); expect(response.headers.get('content-range')).toBe('bytes */20195565');
  expect(await response.text()).toBe('');
});

it('never serves an upstream 416 HTML error document on the app origin', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<script>upstream()</script>', { status: 416, headers: { 'Content-Range': 'bytes */20195565', 'Content-Type': 'text/html', 'Content-Length': '27' } })));
  const response = await invoke(request({ headers: { Range: 'bytes=99999999-' } }));
  expect(response.status).toBe(416); expect(response.headers.get('content-range')).toBe('bytes */20195565');
  expect(response.headers.get('content-type')).toBeNull(); expect(response.headers.get('content-length')).toBe('0');
  expect(response.body).toBeNull();
});

it('HEAD returns metadata with no body and does not forward Range', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { headers: { ...headers, 'Content-Length': '20195565' } })); vi.stubGlobal('fetch', fetch);
  const response = await invoke(request({ method: 'HEAD', headers: { Range: 'bytes=0-1' } }));
  expect(response.status).toBe(200); expect(response.body).toBeNull();
  expect(response.headers.get('content-length')).toBe('20195565');
  expect(fetch.mock.calls[0][1].method).toBe('HEAD'); expect(fetch.mock.calls[0][1].headers.has('Range')).toBe(false);
});

for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) it(`rejects ${method} before fetching`, async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const response = await invoke(request({ method }));
  expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('GET, HEAD'); expect(fetch).not.toHaveBeenCalled();
});

for (const [name, status, responseHeaders] of [
  ['redirect', 302, { Location: 'https://elsewhere.example/' }],
  ['HTML challenge', 200, { 'Content-Type': 'text/html' }],
  ['compressed bytes', 200, { ...headers, 'Content-Encoding': 'gzip' }],
  ['missing range', 206, headers],
  ['missing range total', 416, {}],
  ['upstream failure', 503, {}],
] as const) it(`rejects ${name} without exposing upstream content`, async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream private diagnostic', { status, headers: responseHeaders })));
  const response = await invoke(request()); expect(response.status).toBe(502);
  expect(await response.text()).toBe('Overview video is temporarily unavailable'); expect(response.headers.get('location')).toBeNull();
});

it('handles fetch rejection without exposing the error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private infrastructure detail')));
  const response = await invoke(request()); expect(response.status).toBe(502); expect(await response.text()).not.toContain('private');
});

it('streams rather than buffering the whole film', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { headers })));
  const response = await invoke(request());
  expect(response.body).toBe(stream);
  const reader = response.body!.getReader(); controller.enqueue(new Uint8Array([3]));
  expect((await reader.read()).value).toEqual(new Uint8Array([3])); controller.close();
});
