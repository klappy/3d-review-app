/**
 * Dynamic translation proxy — POST /v2/translate.
 *
 * Captain ruling 2026-09-28 (~20:40 ET): "Just proxy the translation strings." Every Lovable build of 3D Review
 * (the Laos field app included) translated the survey on the fly: the participant picks a language, the page sends
 * its English strings, a translation function returns the same keys translated, English stays the fallback. The
 * Cloudflare rebuild dropped it. This route restores it as a thin proxy with the SAME wire shape as the Laos app's
 * `translate-survey` function, so that function (or anything that speaks its shape) is the upstream:
 *
 *   request  { targetLang: string, context: string, sourceTexts: { [key]: englishText } }
 *   response { translated: { [key]: text }, partial: boolean, cached?: boolean }
 *
 * - Nothing stored or scored changes: answers stay option CODES, so reports and scoring stay English and exact.
 * - Upstream is configuration, never code: TRANSLATE_UPSTREAM_URL (var) + optional TRANSLATE_UPSTREAM_KEY (secret,
 *   sent as Bearer + apikey). Unset URL → 503 translation_unavailable; the page keeps English.
 * - Anonymous (participants have no account) and metered on RL_HTTP_ANON per address, like every anonymous twin.
 * - Only the requested keys come back, as trimmed strings; anything else the upstream says is dropped.
 * - Complete results are kept in the Workers Cache API for a day (the upstream also caches); partial ones are not.
 */
import type { Env } from "./handlers/types";
import { allow, clientIp, RATE_LIMIT_WINDOW_SECONDS } from "./ratelimit";

export const TRANSLATE_LIMITS = Object.freeze({ maxKeys: 600, maxKeyLength: 200, maxTextLength: 2000, maxTotalChars: 150_000, timeoutMs: 45_000 });
const LANG = /^[\p{L}][\p{L}\p{M} ()'.,-]{0,47}$/u;   // "Lao", "lo", "Bahasa Indonesia", "Chinese (Simplified)"
const CONTEXT = /^[A-Za-z0-9_.:@-]{1,120}$/;
const ENGLISH = new Set(["en", "eng", "english"]);
const CACHE_ORIGIN = "https://translate-cache.3dreview.invalid/";

export interface TranslateRequest { targetLang: string; context: string; sourceTexts: Record<string, string> }
type Deps = { fetch?: typeof fetch; cache?: Cache | null };

const reply = (value: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
});

/** Shape check; returns the clean request or a one-line reason. */
export function parseTranslateRequest(body: unknown): TranslateRequest | string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "JSON object body required";
  const { targetLang, context, sourceTexts } = body as Record<string, unknown>;
  if (typeof targetLang !== "string" || !LANG.test(targetLang.trim())) return "targetLang must be a language name or code";
  if (typeof context !== "string" || !CONTEXT.test(context)) return "context must be a short id";
  if (!sourceTexts || typeof sourceTexts !== "object" || Array.isArray(sourceTexts)) return "sourceTexts must be an object of strings";
  const entries = Object.entries(sourceTexts as Record<string, unknown>);
  if (!entries.length) return "sourceTexts is empty";
  if (entries.length > TRANSLATE_LIMITS.maxKeys) return `at most ${TRANSLATE_LIMITS.maxKeys} strings per request`;
  let total = 0;
  const clean: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (!k || k.length > TRANSLATE_LIMITS.maxKeyLength) return "each key must be 1-200 characters";
    if (typeof v !== "string" || v.length > TRANSLATE_LIMITS.maxTextLength) return "each text must be a string of at most 2000 characters";
    total += v.length;
    clean[k] = v;
  }
  if (total > TRANSLATE_LIMITS.maxTotalChars) return "request text is too long";
  return { targetLang: targetLang.trim(), context, sourceTexts: clean };
}

/** Keep only requested keys whose value is a non-empty string; report whether any key is missing. */
export function pickTranslated(source: Record<string, string>, upstream: unknown): { translated: Record<string, string>; partial: boolean } {
  const got = upstream && typeof upstream === "object" && !Array.isArray(upstream) ? upstream as Record<string, unknown> : {};
  const translated: Record<string, string> = {};
  for (const key of Object.keys(source)) {
    const v = got[key];
    if (typeof v === "string" && v.trim()) translated[key] = v.trim().slice(0, TRANSLATE_LIMITS.maxTextLength * 4);
  }
  return { translated, partial: Object.keys(translated).length < Object.keys(source).length };
}

async function cacheKey(req: TranslateRequest): Promise<Request> {
  const ordered = JSON.stringify([req.targetLang.toLowerCase(), req.context, Object.keys(req.sourceTexts).sort().map((k) => [k, req.sourceTexts[k]])]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ordered));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Request(CACHE_ORIGIN + hex);
}
const defaultCache = (): Cache | null => (typeof caches !== "undefined" && (caches as unknown as { default?: Cache }).default) || null;

export async function handleTranslate(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  if (!(await allow(env, "RL_HTTP_ANON", `ip:${clientIp(request)}`)))
    return reply({ error: "rate_limited", hint: `wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds and try again` }, 429, { "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) });
  let body: unknown;
  try { body = await request.json(); } catch { return reply({ error: "invalid_params", message: "JSON object body required" }, 400); }
  const parsed = parseTranslateRequest(body);
  if (typeof parsed === "string") return reply({ error: "invalid_params", message: parsed }, 400);
  if (ENGLISH.has(parsed.targetLang.toLowerCase())) return reply({ translated: parsed.sourceTexts, partial: false });

  const upstreamUrl = typeof env.TRANSLATE_UPSTREAM_URL === "string" ? env.TRANSLATE_UPSTREAM_URL.trim() : "";
  if (!/^https:\/\//.test(upstreamUrl)) return reply({ error: "translation_unavailable", message: "Translation is not set up on this site. The survey stays in English." }, 503);

  const cache = deps.cache === undefined ? defaultCache() : deps.cache;
  const key = cache ? await cacheKey(parsed) : null;
  if (cache && key) {
    const hit = await cache.match(key).catch(() => undefined);
    if (hit) { const stored = await hit.json().catch(() => null) as { translated?: Record<string, string> } | null; if (stored?.translated) return reply({ translated: stored.translated, partial: false, cached: true }); }
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = typeof env.TRANSLATE_UPSTREAM_KEY === "string" ? env.TRANSLATE_UPSTREAM_KEY.trim() : "";
  if (secret) { headers.authorization = `Bearer ${secret}`; headers.apikey = secret; }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TRANSLATE_LIMITS.timeoutMs);
  let upstream: Response;
  try {
    upstream = await (deps.fetch ?? fetch)(upstreamUrl, { method: "POST", headers, body: JSON.stringify(parsed), signal: ctl.signal });
  } catch {
    return reply({ error: "translation_failed", message: "The translation service did not answer. The survey stays in English." }, 502);
  } finally { clearTimeout(timer); }
  if (upstream.status === 429) return reply({ error: "rate_limited", hint: "translation is busy — try again shortly" }, 429, { "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) });
  if (!upstream.ok) return reply({ error: "translation_failed", message: "The translation service refused. The survey stays in English.", upstream_status: upstream.status }, 502);
  const data = await upstream.json().catch(() => null) as { translated?: unknown } | null;
  const out = pickTranslated(parsed.sourceTexts, data?.translated);
  if (!Object.keys(out.translated).length) return reply({ error: "translation_failed", message: "No translation came back. The survey stays in English." }, 502);
  if (cache && key && !out.partial) {
    await cache.put(key, new Response(JSON.stringify({ translated: out.translated }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" } })).catch(() => {});
  }
  return reply(out);
}

/** Mounted from src/index.ts; POST only (the Hono app answers 404 to other methods on this path). */
export function installTranslate(app: { post: (path: string, handler: (c: any) => Response | Promise<Response>) => unknown }): void {
  app.post("/v2/translate", (c) => handleTranslate(c.req.raw, c.env as Env));
}
