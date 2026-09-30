/**
 * S23 (audit of train 22): the participant page now sends `authorization: Bearer <participant token>` on POST /v2/translate
 * (ui/participate/i18n.js translateInit). This file pins that the header is HARMLESS on the server as it stands: the
 * request is answered exactly as without it, the anonymous per-address limiter is the one consulted when no participant
 * session can be resolved, the Worker's Authorization gate (src/worker.ts) is /mcp-only, and the token never reaches the
 * upstream translator. Every assertion here also holds once the per-principal limiter (audit W2) resolves a live
 * participant, because none of these requests carries a resolvable session (no DB).
 */
import { describe, expect, it } from "vitest";
import app from "../src/index";
import worker from "../src/worker";
import { handleTranslate } from "../src/translate";

const UP = "https://upstream.invalid/functions/v1/translate-survey";
const PT = "pt_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6";
const body = { targetLang: "lo", context: "participant-ui", sourceTexts: { next: "Next", back: "Back" } };
const post = (b: unknown, bearer?: string, url = "https://app.invalid/v2/translate") => new Request(url, {
  method: "POST", body: JSON.stringify(b),
  headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
});
function upstream() {
  const calls: { body: string; headers: Record<string, string> }[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    calls.push({ body: String(init.body), headers: init.headers as Record<string, string> });
    const b = JSON.parse(String(init.body));
    const translated = Object.fromEntries(Object.entries(b.sourceTexts as Record<string, string>).map(([k, v]) => [k, v === "Next" ? "ຕໍ່ໄປ" : "ກັບຄືນ"]));
    return new Response(JSON.stringify({ translated, partial: false }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
function limiters() {
  const seen: [string, string][] = [];
  const binding = (name: string) => ({ limit: async ({ key }: { key: string }) => { seen.push([name, key]); return { success: true }; } });
  return { seen, env: { RL_HTTP_ANON: binding("RL_HTTP_ANON"), RL_MCP_CEILING: binding("RL_MCP_CEILING"), RL_MCP_ANON: binding("RL_MCP_ANON") } };
}

describe("POST /v2/translate with a participant bearer (header is harmless on the current server)", () => {
  it("answers exactly as without the header, on the anonymous per-address limiter", async () => {
    const results = [];
    for (const bearer of [undefined, PT]) {
      const up = upstream(), rl = limiters();
      const res = await handleTranslate(post(body, bearer), { ENVIRONMENT: "production", TRANSLATE_UPSTREAM_URL: UP, ...rl.env } as any, { fetch: up.fetch });
      expect(res.status).toBe(200);
      results.push(await res.json());
      expect(rl.seen).toEqual([["RL_HTTP_ANON", "ip:203.0.113.7"]]);
      expect(up.calls).toHaveLength(1);
    }
    expect(results[1]).toEqual(results[0]);
  });

  it("never forwards the participant token upstream (only the configured upstream key, if any)", async () => {
    for (const key of [undefined, "k-1"]) {
      const up = upstream();
      await handleTranslate(post(body, PT), { ENVIRONMENT: "dev", TRANSLATE_UPSTREAM_URL: UP, ...(key ? { TRANSLATE_UPSTREAM_KEY: key } : {}) } as any, { fetch: up.fetch });
      expect(up.calls).toHaveLength(1);
      expect(JSON.stringify(up.calls[0])).not.toContain(PT.slice(3));
      expect(up.calls[0].headers.authorization).toBe(key ? `Bearer ${key}` : undefined);
    }
  });

  it("the mounted route and the Worker entry accept it (the Worker's Authorization gate is /mcp only)", async () => {
    const en = { ...body, targetLang: "en" };
    const viaApp = await app.fetch(post(en, PT), { ENVIRONMENT: "dev" } as any);
    expect(viaApp.status).toBe(200);
    expect((await viaApp.json() as any).translated).toEqual(body.sourceTexts);
    const ectx = { waitUntil() {}, passThroughOnException() {}, props: undefined } as any;
    const viaWorker = await worker.fetch(post(en, PT, "https://t.invalid/v2/translate"), { ENVIRONMENT: "dev" } as any, ectx);
    expect(viaWorker.status).toBe(200);
    expect((await viaWorker.json() as any).translated).toEqual(body.sourceTexts);
  });
});
