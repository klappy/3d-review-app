/**
 * Dynamic translation proxy (src/translate.ts) — stateless path (no D1 / no migration 0012). Upstream stubbed; no network.
 * The D1 translation-memory path and the LWC limits are in test/lwc-translation.test.ts.
 */
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { acceptable, handleTranslate, parseTranslateRequest, TRANSLATE_LIMITS } from "../src/translate";
import { lwcLanguage } from "../src/languages";

const UP = "https://upstream.invalid/functions/v1/translate-survey";
const post = (body: unknown) => new Request("https://app.invalid/v2/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const env = (extra: Record<string, unknown> = {}) => ({ ENVIRONMENT: "dev", TRANSLATE_UPSTREAM_URL: UP, ...extra }) as any;
const body = { targetLang: "lo", context: "participant-ui", sourceTexts: { next: "Next", back: "Back" } };
/** Stub upstream that answers every requested key with `answer(englishText)`. */
function upstream(answer: (en: string) => unknown = (en) => `ລາວ ${en}`, status = 200) {
  const calls: { url: string; body: any; headers: Record<string, string> }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body)); calls.push({ url, body: b, headers: init.headers as Record<string, string> });
    const translated = Object.fromEntries(Object.entries(b.sourceTexts as Record<string, string>).map(([k, v]) => [k, answer(v)]));
    return new Response(JSON.stringify(status === 200 ? { translated, partial: false } : { error: "x" }), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("parseTranslateRequest", () => {
  it("accepts the Lovable wire shape", () => { expect(parseTranslateRequest(body)).toEqual(body); });
  it("refuses bad shapes and oversize requests", () => {
    expect(parseTranslateRequest({ ...body, targetLang: "" })).toBeTypeOf("string");
    expect(parseTranslateRequest({ ...body, context: "has spaces" })).toBeTypeOf("string");
    expect(parseTranslateRequest({ ...body, sourceTexts: { a: 1 } })).toBeTypeOf("string");
    expect(parseTranslateRequest({ ...body, sourceTexts: {} })).toBeTypeOf("string");
    const many = Object.fromEntries(Array.from({ length: TRANSLATE_LIMITS.maxKeys + 1 }, (_, i) => [`k${i}`, "x"]));
    expect(parseTranslateRequest({ ...body, sourceTexts: many })).toBeTypeOf("string");
    expect(parseTranslateRequest([])).toBeTypeOf("string");
  });
});

describe("acceptable (output checks before storing)", () => {
  const lo = lwcLanguage("lo")!, fr = lwcLanguage("fr")!;
  it("needs the target script for non-Latin languages", () => {
    expect(acceptable(lo, "Next", "ຕໍ່ໄປ")).toBe(true);
    expect(acceptable(lo, "Next", "Next")).toBe(false);
    expect(acceptable(fr, "Next", "Suivant")).toBe(true);
  });
  it("refuses empty, non-string and absurdly long output", () => {
    expect(acceptable(lo, "Next", "")).toBe(false);
    expect(acceptable(lo, "Next", 7)).toBe(false);
    expect(acceptable(lo, "Next", "ລ".repeat(500))).toBe(false);
  });
  it("numbers and symbols-only sources need no script", () => { expect(acceptable(lo, "18–24", "18–24")).toBe(true); });
});

describe("handleTranslate without translation memory", () => {
  it("proxies with the English language name upstream and returns the same keys", async () => {
    const up = upstream((en) => (en === "Next" ? "ຕໍ່ໄປ" : "ກັບຄືນ"));
    const res = await handleTranslate(post(body), env(), { fetch: up.fetch });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translated: { next: "ຕໍ່ໄປ", back: "ກັບຄືນ" }, partial: false, locale: "lo", review: true, stored: 0 });
    expect(up.calls).toHaveLength(1);
    expect(up.calls[0].url).toBe(UP);
    expect(up.calls[0].body.targetLang).toBe("Lao");
    expect(Object.values(up.calls[0].body.sourceTexts).sort()).toEqual(["Back", "Next"]);
    expect(up.calls[0].headers.authorization).toBeUndefined();
  });
  it("the same English sentence under two keys is asked once", async () => {
    const up = upstream();
    const res = await handleTranslate(post({ ...body, sourceTexts: { a: "Next", b: "Next" } }), env(), { fetch: up.fetch });
    expect(Object.keys(up.calls[0].body.sourceTexts)).toHaveLength(1);
    expect(await res.json()).toMatchObject({ translated: { a: "ລາວ Next", b: "ລາວ Next" }, partial: false });
  });
  it("accepts an English language name for a supported language", async () => {
    const res = await handleTranslate(post({ ...body, targetLang: "Thai" }), env(), { fetch: upstream(() => "ถัดไป").fetch });
    expect((await res.json() as any).locale).toBe("th");
  });
  it("sends the optional secret as Bearer + apikey", async () => {
    const up = upstream();
    await handleTranslate(post(body), env({ TRANSLATE_UPSTREAM_KEY: "k-1" }), { fetch: up.fetch });
    expect(up.calls[0].headers.authorization).toBe("Bearer k-1");
    expect(up.calls[0].headers.apikey).toBe("k-1");
  });
  it("English is returned as-is without calling the upstream", async () => {
    const up = upstream();
    const res = await handleTranslate(post({ ...body, targetLang: "en" }), env(), { fetch: up.fetch });
    expect((await res.json() as any).translated).toEqual(body.sourceTexts);
    expect(up.calls).toHaveLength(0);
  });
  it("a language outside the supported LWC table → 400", async () => {
    const res = await handleTranslate(post({ ...body, targetLang: "Klingon" }), env(), { fetch: upstream().fetch });
    expect(res.status).toBe(400);
  });
  it("no upstream configured → 503 and the page keeps English", async () => {
    const res = await handleTranslate(post(body), env({ TRANSLATE_UPSTREAM_URL: "" }));
    expect(res.status).toBe(503);
    expect((await res.json() as any).error).toBe("translation_unavailable");
  });
  it("upstream failure → 502; upstream 429 → 429; wrong-script output → 502", async () => {
    expect((await handleTranslate(post(body), env(), { fetch: upstream(undefined, 500).fetch })).status).toBe(502);
    expect((await handleTranslate(post(body), env(), { fetch: upstream(undefined, 429).fetch })).status).toBe(429);
    expect((await handleTranslate(post(body), env(), { fetch: upstream((en) => en).fetch })).status).toBe(502);
    const thrower = (async () => { throw new Error("down"); }) as unknown as typeof globalThis.fetch;
    expect((await handleTranslate(post(body), env(), { fetch: thrower })).status).toBe(502);
  });
  it("partial answers pass through marked partial", async () => {
    const res = await handleTranslate(post(body), env(), { fetch: upstream((en) => (en === "Next" ? "ຕໍ່ໄປ" : "")).fetch });
    expect(await res.json()).toMatchObject({ translated: { next: "ຕໍ່ໄປ" }, partial: true });
  });
  it("bad JSON and bad shape → 400", async () => {
    const raw = new Request("https://app.invalid/v2/translate", { method: "POST", body: "{not json" });
    expect((await handleTranslate(raw, env())).status).toBe(400);
    expect((await handleTranslate(post({ targetLang: "lo" }), env())).status).toBe(400);
  });
});

describe("route", () => {
  it("POST /v2/translate is mounted (no upstream → 503, not 404)", async () => {
    const res = await app.fetch(post(body), { ENVIRONMENT: "dev" } as any);
    expect(res.status).toBe(503);
  });
  it("English passes through the mounted route", async () => {
    const res = await app.fetch(post({ ...body, targetLang: "en" }), { ENVIRONMENT: "dev" } as any);
    expect(res.status).toBe(200);
    expect((await res.json() as any).translated).toEqual(body.sourceTexts);
  });
});
