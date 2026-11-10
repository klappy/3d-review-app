// One immutable public film, not an arbitrary URL proxy. Keep client credentials
// and referrers out of the upstream request; preserve native byte-range semantics.
export const OVERVIEW_MEDIA_PATH = '/v2/media/overview-8bd9e6de2dcf.mp4';
export const OVERVIEW_MEDIA_URL = 'https://cdn.3dreview.app/overview/8bd9e6de2dcf/3d-review-overview-120s-8bd9e6de2dcf.mp4';

export async function overviewMedia(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const headers = new Headers({ Accept: 'video/mp4', 'Accept-Encoding': 'identity' });
  if (request.method === 'GET') {
    for (const name of ['Range', 'If-Range']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
  }
  let upstream: Response;
  try {
    upstream = await fetch(OVERVIEW_MEDIA_URL, {
      method: request.method, headers, redirect: 'manual', cache: 'no-store',
    });
  } catch {
    return new Response('Overview video is temporarily unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  const mediaResponse = upstream.status === 200 || upstream.status === 206;
  const type = upstream.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const encoding = upstream.headers.get('Content-Encoding');
  if (![200, 206, 416].includes(upstream.status)
    || (mediaResponse && type !== 'video/mp4')
    || (encoding && encoding.toLowerCase() !== 'identity')
    || (upstream.status === 206 && !/^bytes \d+-\d+\/\d+$/.test(upstream.headers.get('Content-Range') ?? ''))
    || (upstream.status === 416 && !/^bytes \*\/\d+$/.test(upstream.headers.get('Content-Range') ?? ''))) {
    await upstream.body?.cancel();
    return new Response('Overview video is temporarily unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  const result = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (upstream.status === 416) {
    // The range total is useful; an upstream error document must never become
    // active HTML on the app's origin (nor expose infrastructure diagnostics).
    await upstream.body?.cancel();
    result.set('Content-Range', upstream.headers.get('Content-Range')!);
    result.set('Content-Length', '0');
    return new Response(null, { status: 416, headers: result });
  }
  for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
    const value = upstream.headers.get(name);
    if (value) result.set(name, value);
  }
  return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: result });
}
