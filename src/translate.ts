/**
 * Dynamic translation — POST /v2/translate.
 *
 * Captain rulings 2026-09-28: "Just proxy the translation strings." · the language drop-down is limited to the project's
 * and/or assessment's LWCs that the model supports (src/languages.ts) · deterministic storage in Cloudflare is fine.
 * Every Lovable build (the Laos field app included) translated the survey on the fly; the Cloudflare rebuild dropped it.
 *
 *   request  { targetLang: "<BCP 47 tag or English name of a supported LWC>", context: "<short id>", sourceTexts: { [key]: english } }
 *   response { translated: { [key]: text }, partial: boolean, locale, review: boolean, stored: number, refused?: number }
 *
 * Translation memory (D1 `translation_memory`, migration 0012) is the source of truth, keyed by (locale, SHA-256 of the
 * exact English text): a string is translated ONCE, stored, and served from storage forever after (first write wins;
 * never regenerated on read — LLM output is not reproducible, storage is). Only strings the memory lacks go upstream.
 * `rejected` rows are never served and are replaced by the next translation. Without migration 0012 the route still
 * works as a stateless proxy. Upstream = TRANSLATE_UPSTREAM_URL (+ optional TRANSLATE_UPSTREAM_KEY), speaking the Laos
 * app's `translate-survey` wire shape; it receives only English source strings — never answers, names, codes or tokens.
 * Output checks before storing: non-empty, plausible length, not an English sentence (3+ words) echoed back, and in the
 * target script for non-Latin languages.
 * Rate limit: anonymous callers spend RL_HTTP_ANON per address; a caller with a live participant bearer or session spends
 * its own RL_MCP_CEILING unit instead (translateLimiter below; audit round 1 W2).
 * Display only: item ids and option codes never change, so answers, scores and reports are unaffected.
 *
 * Published strings only (reviewer FAIL on #377, F1/F2; src/translate-allowlist.ts): `context` must be `participant-ui`
 * or `participant-form:<published template id>`, and only strings whose SHA-256 is in that scope's published set are
 * translated and stored. Other strings are refused — never sent upstream, never stored, never served — and the upstream
 * receives a context the server builds from the verified scope, never the caller's text.
 */
import type { Env } from "./handlers/types";
import { allow, clientIp, RATE_LIMIT_WINDOW_SECONDS } from "./ratelimit";
import { resolvePrincipal } from "./auth";
import { inScript, lwcLanguage, type LwcLanguage } from "./languages";
import { allowedScope, parseScope, upstreamContext } from "./translate-allowlist";

export const TRANSLATE_LIMITS = Object.freeze({ maxKeys: 600, maxKeyLength: 200, maxTextLength: 2000, maxTotalChars: 150_000, timeoutMs: 45_000, maxBodyBytes: 1_048_576 });
const CONTEXT = /^[A-Za-z0-9_.:@-]{1,120}$/;
const ENGLISH = new Set(["en", "eng", "english"]);
const IN_CHUNK = 90; // D1 allows 100 bound parameters per statement
/** Isolated strings (welcome leads carrying a member-authored language name) each cost one upstream call; the page sends one. */
export const MAX_ISOLATED_PER_REQUEST = 2;

export interface TranslateRequest { targetLang: string; context: string; sourceTexts: Record<string, string> }
type Deps = { fetch?: typeof fetch; now?: () => Date };

const reply = (value: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
});

/**
 * Security review (train 22 audit): the body is size-checked BEFORE it is parsed. A declared content-length over
 * maxBodyBytes is refused without reading; otherwise the stream is read only up to maxBodyBytes and cancelled past it.
 * 1 MiB covers the largest request parseTranslateRequest accepts (600 keys × 200 + 150 000 text characters, UTF-8 and
 * JSON escaping included); the page itself sends 20-string chunks of a few KB. Returns the text, or null when too large.
 */
export async function readCappedBody(request: Request, max = TRANSLATE_LIMITS.maxBodyBytes): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && declared.trim() !== "" && !(Number(declared) <= max)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Shape check; returns the clean request or a one-line reason. Language support is checked by the handler. */
export function parseTranslateRequest(body: unknown): TranslateRequest | string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "JSON object body required";
  const { targetLang, context, sourceTexts } = body as Record<string, unknown>;
  if (typeof targetLang !== "string" || !targetLang.trim() || targetLang.length > 48) return "targetLang must be a language code";
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

/** Same words, ignoring case and spacing: how an upstream "translation" that merely echoed the English is recognised. */
const sameWords = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();
/** From this many words a source is a sentence, and a sentence that comes back word for word is an echo, not a translation. */
export const ECHO_MIN_WORDS = 3;

/** A translation worth storing: non-empty, not absurdly long, not an English sentence echoed back, and in the target
 *  script where that is checkable. Audit round 1 E4: for Latin-script targets (fr, es, id, …) the script check cannot
 *  catch an echo, and memory is first-write-wins — an echoed row would pin English for that language forever. An echoed
 *  sentence (ECHO_MIN_WORDS or more words) is neither served nor stored; the page keeps the English it already shows
 *  and the next request asks again. One- and two-word sources are often spelled the same in the target (fr "phrases",
 *  "Question", "Total"; es "Hospital"), so an unchanged short source is accepted (review of #396: refusing them left
 *  every French participant-ui response partial and never cached). Sources without letters ("18–24") legitimately
 *  come back unchanged and stay acceptable. */
export function acceptable(lang: LwcLanguage, source: string, text: unknown): text is string {
  if (typeof text !== "string") return false;
  const t = text.trim();
  if (!t || t.length > source.length * 8 + 80) return false;
  if (!/\p{L}/u.test(source)) return true;
  const sentence = source.trim().split(/\s+/).length >= ECHO_MIN_WORDS;
  return !(sentence && sameWords(source, t)) && inScript(lang.code, t);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Row = { source_hash: string; text: string; status: string };
async function readMemory(db: D1Database, locale: string, hashes: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < hashes.length; i += IN_CHUNK) {
    const part = hashes.slice(i, i + IN_CHUNK);
    const { results } = await db.prepare(`SELECT source_hash, text, status FROM translation_memory WHERE locale = ? AND source_hash IN (${part.map(() => "?").join(",")})`)
      .bind(locale, ...part).all<Row>();
    for (const r of results) if (r.status !== "rejected") out.set(r.source_hash, r.text);
  }
  return out;
}
async function writeMemory(db: D1Database, locale: string, rows: { hash: string; source: string; text: string }[], provider: string, at: string) {
  if (!rows.length) return;
  const stmt = db.prepare(`INSERT INTO translation_memory (locale, source_hash, source_text, text, status, provider, created_at) VALUES (?, ?, ?, ?, 'machine', ?, ?)
    ON CONFLICT (locale, source_hash) DO UPDATE SET text = excluded.text, status = 'machine', provider = excluded.provider, created_at = excluded.created_at,
    reviewed_by = NULL, reviewed_at = NULL WHERE translation_memory.status = 'rejected'`);
  await db.batch(rows.map((r) => stmt.bind(locale, r.hash, r.source, r.text, provider, at)));
}

/** One upstream call for the strings the memory lacks; keys are hash prefixes so duplicates are asked once. */
async function askUpstream(env: Env, deps: Deps, lang: LwcLanguage, context: string, missing: Map<string, string>): Promise<{ texts: Map<string, string>; status: number }> {
  const url = typeof env.TRANSLATE_UPSTREAM_URL === "string" ? env.TRANSLATE_UPSTREAM_URL.trim() : "";
  if (!/^https:\/\//.test(url)) return { texts: new Map(), status: 503 };
  const sourceTexts: Record<string, string> = {};
  const keyOf = new Map<string, string>();
  for (const [hash, text] of missing) { const k = `s_${hash.slice(0, 16)}`; sourceTexts[k] = text; keyOf.set(k, hash); }
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = typeof env.TRANSLATE_UPSTREAM_KEY === "string" ? env.TRANSLATE_UPSTREAM_KEY.trim() : "";
  if (secret) { headers.authorization = `Bearer ${secret}`; headers.apikey = secret; }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TRANSLATE_LIMITS.timeoutMs);
  // S33 E1: the limit covers the body read too, so the timer is cleared only after res.json() settles (every path).
  try {
    let res: Response;
    try { res = await (deps.fetch ?? fetch)(url, { method: "POST", headers, signal: ctl.signal, body: JSON.stringify({ targetLang: lang.name, context, sourceTexts }) }); }
    catch { return { texts: new Map(), status: 502 }; }
    if (!res.ok) return { texts: new Map(), status: res.status === 429 ? 429 : 502 };
    const data = await res.json().catch(() => null) as { translated?: Record<string, unknown> } | null;
    if (ctl.signal.aborted) return { texts: new Map(), status: 502 };
    const texts = new Map<string, string>();
    for (const [k, hash] of keyOf) { const v = data?.translated?.[k]; if (acceptable(lang, missing.get(hash)!, v)) texts.set(hash, (v as string).trim()); }
    return { texts, status: 200 };
  } finally { clearTimeout(timer); }
}

/** Which limiter a translate request spends (audit round 1 W2). A caller presenting a live credential — the participant
 *  bearer from the survey link, or a signed-in session — spends its OWN unit on RL_MCP_CEILING (600/60 s, keyed by the
 *  principal), never the per-address anonymous bucket: a workshop room of ~50 phones behind one NAT fetches the survey
 *  in 20-string chunks and would exhaust RL_HTTP_ANON (60/60 s per address) in seconds. Everyone else keeps RL_HTTP_ANON
 *  per address. Credential resolution is the shared one (src/auth.ts): 0 D1 reads for a malformed token. */
export async function translateLimiter(request: Request, env: Env): Promise<{ name: "RL_HTTP_ANON" | "RL_MCP_CEILING"; key: string; participantSurveyId: string | null }> {
  let who: Awaited<ReturnType<typeof resolvePrincipal>> | null = null;
  try { who = env.DB ? await resolvePrincipal(request, env) : null; } catch { who = null; }
  // Security W1: the participant's own survey scopes which language name its welcome lead may carry (allowedScope).
  const participantSurveyId = who?.kind === "participant" ? who.participantSurveyId ?? null : null;
  if (who && who.kind !== "anonymous") return { name: "RL_MCP_CEILING", key: `tr:${who.kind}:${who.id}`, participantSurveyId };
  return { name: "RL_HTTP_ANON", key: `ip:${clientIp(request)}`, participantSurveyId: null };
}

export async function handleTranslate(request: Request, env: Env, deps: Deps = {}): Promise<Response> {
  const limiter = await translateLimiter(request, env);
  if (!(await allow(env, limiter.name, limiter.key)))
    return reply({ error: "rate_limited", hint: `wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds and try again` }, 429, { "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) });
  const raw = await readCappedBody(request).catch(() => ""); // a broken stream is a bad body (400 below), not an oversized one
  if (raw === null) return reply({ error: "invalid_params", message: "request is too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply({ error: "invalid_params", message: "JSON object body required" }, 400); }
  const parsed = parseTranslateRequest(body);
  if (typeof parsed === "string") return reply({ error: "invalid_params", message: parsed }, 400);
  if (ENGLISH.has(parsed.targetLang.toLowerCase())) return reply({ translated: parsed.sourceTexts, partial: false, locale: "en", review: false, stored: 0 });
  const lang = lwcLanguage(parsed.targetLang);
  if (!lang || lang.mt === false) return reply({ error: "invalid_params", message: "this language is not available for machine translation" }, 400);
  const scope = parseScope(parsed.context);
  if (!scope) return reply({ error: "invalid_params", message: "context must be participant-ui or participant-form:<template id>" }, 400);

  // Unique English strings by hash (the same sentence on two screens is one memory row), kept only when the hash is in
  // the scope's published set (F1/F2): anything else is refused before memory, upstream or storage.
  const { allowed, isolated } = await allowedScope(env.DB, scope, limiter.participantSurveyId);
  const hashOfKey = new Map<string, string>(), textOfHash = new Map<string, string>();
  let refused = 0;
  for (const [k, text] of Object.entries(parsed.sourceTexts)) {
    const h = await sha256Hex(text);
    if (!allowed.has(h)) { refused++; continue; }
    hashOfKey.set(k, h); textOfHash.set(h, text);
  }
  if (!hashOfKey.size) return reply({ error: "not_published", message: "Only the survey's published questions and page words are translated.", refused }, 400);
  const hashes = [...textOfHash.keys()];

  let memory: Map<string, string> | null = null;
  try { memory = env.DB ? await readMemory(env.DB, lang.code, hashes) : null; } catch { memory = null; } // no migration 0012 → stateless
  const found = memory ?? new Map<string, string>();
  const missing = new Map(hashes.filter((h) => !found.has(h)).map((h) => [h, textOfHash.get(h)!]));
  let upstreamStatus = 200, fresh = new Map<string, string>();
  if (missing.size) {
    // Security review on #377 (e): a string built from a member-authored language name never shares an upstream call
    // with other strings — the shared batch holds page words only, and each welcome lead goes alone (bounded per request).
    const shared = new Map([...missing].filter(([h]) => !isolated.has(h)));
    const batches = [...missing].filter(([h]) => isolated.has(h)).slice(0, MAX_ISOLATED_PER_REQUEST).map((e) => new Map([e]));
    if (shared.size) batches.unshift(shared);
    const statuses: number[] = [];
    for (const batch of batches) {
      const up = await askUpstream(env, deps, lang, upstreamContext(scope), batch);
      statuses.push(up.status);
      for (const [h, t] of up.texts) fresh.set(h, t);
    }
    upstreamStatus = statuses.includes(200) ? 200 : statuses[statuses.length - 1] ?? 200;
    if (memory && fresh.size) {
      const at = (deps.now?.() ?? new Date()).toISOString();
      try {
        await writeMemory(env.DB, lang.code, [...fresh].map(([hash, text]) => ({ hash, source: textOfHash.get(hash)!, text })), "translate-survey", at);
        for (const [h, t] of await readMemory(env.DB, lang.code, [...fresh.keys()])) fresh.set(h, t); // first write wins under a race
      } catch { /* served, not stored */ }
    }
  }
  const translated: Record<string, string> = {};
  for (const [k, h] of hashOfKey) { const t = found.get(h) ?? fresh.get(h); if (t) translated[k] = t; }
  const n = Object.keys(translated).length;
  if (!n) {
    if (upstreamStatus === 503) return reply({ error: "translation_unavailable", message: "Translation is not set up on this site. The survey stays in English." }, 503);
    if (upstreamStatus === 429) return reply({ error: "rate_limited", hint: "translation is busy — try again shortly" }, 429, { "retry-after": String(RATE_LIMIT_WINDOW_SECONDS) });
    return reply({ error: "translation_failed", message: "No translation came back. The survey stays in English." }, 502);
  }
  return reply({ translated, partial: n < hashOfKey.size + refused, locale: lang.code, review: lang.review, stored: [...hashOfKey.values()].filter((h) => found.has(h)).length, ...(refused ? { refused } : {}) });
}

/** Mounted from src/index.ts; POST only. Setup screens read the supported table from ui/v3/lwc.js (mirror of src/languages.ts). */
export function installTranslate(app: { post: (path: string, handler: (c: any) => Response | Promise<Response>) => unknown }): void {
  app.post("/v2/translate", (c) => handleTranslate(c.req.raw, c.env as Env));
}
