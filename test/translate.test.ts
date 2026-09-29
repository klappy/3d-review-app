/**
 * Dynamic translation proxy (src/translate.ts) — captain ruling 2026-09-28 "Just proxy the translation strings".
 * The upstream is stubbed; no network. Same wire shape as the Laos Lovable translate-survey function.
 */
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { handleTranslate, parseTranslateRequest, pickTranslated, TRANSLATE_LIMITS } from "../src/translate";

const UP = "https://upstream.invalid/functions/v1/translate-survey";
const post = (body: unknown) => new Request("https://app.invalid/v2/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const env = (extra: Record<string, unknown> = {}) => ({ ENVIRONMENT: "dev", TRANSLATE_UPSTREAM_URL: UP, ...extra }) as any;
const body = { targetLang: "Lao", context: "participant-ui", sourceTexts: { next: "Next", back: "Back" } };
function upstream(reply: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(reply), { status, headers: { "content-type": "application/json" } }); }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
function memoryCache() {
  const store = new Map<string, string>();
  return { store, cache: { async match(r: Request) { const v = store.get(r.url); return v ? new Response(v) : undefined; }, async put(r: Request, res: Response) { store.set(r.url, await res.text()); } } as unknown as Cache };
}

describe("parseTranslateRequest", () => {
  it("accepts the Lovable wire shape", () => { expect(parseTranslateRequest(body)).toEqual(body); });
  it("refuses bad language, context, texts and oversize requests", () => {
    expect(parseTranslateRequest({ ...body, targetLang: "<script>" })).toBeTypeOf("string");
    expect(parseTranslateRequest({ ...body, context: "has spaces" })).toBeTypeOf("string");
    expect(parseTranslateRequest({ ...body, sourceTexts: { a: 1 } })).toBeTypeOf("string");
    expect(parseTranslateRequest({ ...body, sourceTexts: {} })).toBeTypeOf("string");
    const many = Object.fromEntries(Array.from({ length: TRANSLATE_LIMITS.maxKeys + 1 }, (_, i) => [`k${i}`, "x"]));
    expect(parseTranslateRequest({ ...body, sourceTexts: many })).toBeTypeOf("string");
    expect(parseTranslateRequest([])).toBeTypeOf("string");
  });
  it("accepts language names with spaces and parentheses", () => {
    expect(parseTranslateRequest({ ...body, targetLang: "Chinese (Simplified)" })).not.toBeTypeOf("string");
    expect(parseTranslateRequest({ ...body, targetLang: "Bahasa Indonesia" })).not.toBeTypeOf("string");
  });
});

describe("pickTranslated", () => {
  it("keeps only requested keys with non-empty strings and reports partial", () => {
    expect(pickTranslated({ a: "A", b: "B" }, { a: " ກ ", b: "", c: "extra" })).toEqual({ translated: { a: "ກ" }, partial: true });
    expect(pickTranslated({ a: "A" }, { a: "ກ" })).toEqual({ translated: { a: "ກ" }, partial: false });
    expect(pickTranslated({ a: "A" }, "nope")).toEqual({ translated: {}, partial: true });
  });
});

describe("handleTranslate", () => {
  it("proxies the strings to the upstream and returns the same keys", async () => {
    const up = upstream({ translated: { next: "ຕໍ່ໄປ", back: "ກັບຄືນ" }, cached: false, partial: false });
    const res = await handleTranslate(post(body), env(), { fetch: up.fetch, cache: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translated: { next: "ຕໍ່ໄປ", back: "ກັບຄືນ" }, partial: false });
    expect(up.calls).toHaveLength(1);
    expect(up.calls[0].url).toBe(UP);
    expect(JSON.parse(String(up.calls[0].init.body))).toEqual(body);
    expect((up.calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();
  });
  it("sends the optional secret as Bearer + apikey", async () => {
    const up = upstream({ translated: { next: "ຕໍ່ໄປ", back: "ກັບຄືນ" } });
    await handleTranslate(post(body), env({ TRANSLATE_UPSTREAM_KEY: "k-1" }), { fetch: up.fetch, cache: null });
    const h = up.calls[0].init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer k-1");
    expect(h.apikey).toBe("k-1");
  });
  it("English is returned as-is without calling the upstream", async () => {
    const up = upstream({});
    const res = await handleTranslate(post({ ...body, targetLang: "English" }), env(), { fetch: up.fetch, cache: null });
    expect(await res.json()).toEqual({ translated: body.sourceTexts, partial: false });
    expect(up.calls).toHaveLength(0);
  });
  it("no upstream configured → 503 and the page keeps English", async () => {
    const res = await handleTranslate(post(body), env({ TRANSLATE_UPSTREAM_URL: "" }), { cache: null });
    expect(res.status).toBe(503);
    expect((await res.json() as any).error).toBe("translation_unavailable");
  });
  it("upstream failure → 502; upstream 429 → 429; nothing translated → 502", async () => {
    expect((await handleTranslate(post(body), env(), { fetch: upstream({ error: "x" }, 500).fetch, cache: null })).status).toBe(502);
    expect((await handleTranslate(post(body), env(), { fetch: upstream({ error: "x" }, 429).fetch, cache: null })).status).toBe(429);
    expect((await handleTranslate(post(body), env(), { fetch: upstream({ translated: {} }).fetch, cache: null })).status).toBe(502);
    const thrower = (async () => { throw new Error("down"); }) as unknown as typeof globalThis.fetch;
    expect((await handleTranslate(post(body), env(), { fetch: thrower, cache: null })).status).toBe(502);
  });
  it("partial answers pass through marked partial and are not cached", async () => {
    const mem = memoryCache();
    const res = await handleTranslate(post(body), env(), { fetch: upstream({ translated: { next: "ຕໍ່ໄປ" } }).fetch, cache: mem.cache });
    expect(await res.json()).toEqual({ translated: { next: "ຕໍ່ໄປ" }, partial: true });
    expect(mem.store.size).toBe(0);
  });
  it("complete answers are cached and served without a second upstream call", async () => {
    const mem = memoryCache();
    const up = upstream({ translated: { next: "ຕໍ່ໄປ", back: "ກັບຄືນ" } });
    await handleTranslate(post(body), env(), { fetch: up.fetch, cache: mem.cache });
    const again = await handleTranslate(post(body), env(), { fetch: up.fetch, cache: mem.cache });
    expect(await again.json()).toEqual({ translated: { next: "ຕໍ່ໄປ", back: "ກັບຄືນ" }, partial: false, cached: true });
    expect(up.calls).toHaveLength(1);
  });
  it("bad JSON and bad shape → 400", async () => {
    const raw = new Request("https://app.invalid/v2/translate", { method: "POST", body: "{not json" });
    expect((await handleTranslate(raw, env(), { cache: null })).status).toBe(400);
    expect((await handleTranslate(post({ targetLang: "Lao" }), env(), { cache: null })).status).toBe(400);
  });
});

describe("route", () => {
  it("POST /v2/translate is mounted on the app (no upstream → 503, not 404)", async () => {
    const res = await app.fetch(post(body), { ENVIRONMENT: "dev" } as any);
    expect(res.status).toBe(503);
  });
  it("English passes through the mounted route", async () => {
    const res = await app.fetch(post({ ...body, targetLang: "en" }), { ENVIRONMENT: "dev" } as any);
    expect(res.status).toBe(200);
    expect((await res.json() as any).translated).toEqual(body.sourceTexts);
  });
});
