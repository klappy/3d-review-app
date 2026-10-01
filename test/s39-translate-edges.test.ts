/**
 * S39 — two train 22 audit edges on POST /v2/translate.
 *   Security: the body is size-checked BEFORE it is parsed (declared content-length, and a capped streamed read).
 *   E2: participant-ui hashing is memoized per isolate per source, not recomputed on every request.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleTranslate, readCappedBody, sha256Hex, TRANSLATE_LIMITS } from "../src/translate";
import { allowedScope, staticUiHashes, welcomeLead, welcomeLeadHash } from "../src/translate-allowlist";

const URL_ = "https://app.invalid/v2/translate";
const MAX = TRANSLATE_LIMITS.maxBodyBytes;
const env = { ENVIRONMENT: "dev" } as any;
/** A streamed body with no content-length header (chunked upload). */
function streamed(bytes: Uint8Array, chunk = 64 * 1024, headers: Record<string, string> = {}) {
  let at = 0, pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) { if (at >= bytes.length) return c.close(); c.enqueue(bytes.subarray(at, at + chunk)); at += chunk; pulled++; },
  }, { highWaterMark: 0 });
  const req = new Request(URL_, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: stream, duplex: "half" } as RequestInit);
  return { req, pulled: () => pulled };
}
/** A syntactically valid translate body padded with spaces to exactly `size` bytes. */
function bodyOfSize(size: number) {
  const json = JSON.stringify({ targetLang: "en", context: "participant-ui", sourceTexts: { next: "Next" } });
  return new TextEncoder().encode(json + " ".repeat(size - json.length));
}

afterEach(() => { vi.restoreAllMocks(); });

describe("translate refuses an oversized body before parsing it (security review, train 22)", () => {
  it("1 MiB covers the largest request the shape check accepts", () => {
    expect(MAX).toBe(1_048_576);
    expect(TRANSLATE_LIMITS.maxKeys * TRANSLATE_LIMITS.maxKeyLength + TRANSLATE_LIMITS.maxTotalChars * 3).toBeLessThan(MAX);
  });

  it("a declared content-length over the limit is refused with 413 invalid_params, never read or parsed", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const { req, pulled } = streamed(bodyOfSize(MAX + 1), 64 * 1024, { "content-length": String(MAX + 1) });
    expect(req.headers.get("content-length")).toBe(String(MAX + 1));
    const res = await handleTranslate(req, env);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "invalid_params", message: "request is too large" });
    expect(pulled()).toBe(0);
    expect(parse.mock.calls.some(([t]) => typeof t === "string" && t.length > MAX)).toBe(false);
  });

  it("a streamed body without content-length is cut off past the limit and never parsed", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const big = bodyOfSize(4 * MAX);
    const { req, pulled } = streamed(big);
    const res = await handleTranslate(req, env);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("invalid_params");
    expect(pulled()).toBeLessThan(big.length / (64 * 1024)); // stopped early, not read to the end
    expect(parse.mock.calls.some(([t]) => typeof t === "string" && t.length > MAX)).toBe(false);
  });

  it("a body exactly at the limit is accepted (streamed and declared)", async () => {
    const { req } = streamed(bodyOfSize(MAX));
    const res = await handleTranslate(req, env);
    expect(res.status).toBe(200);
    expect((await res.json()).translated).toEqual({ next: "Next" });
    const bytes = bodyOfSize(MAX);
    const declared = new Request(URL_, { method: "POST", headers: { "content-type": "application/json", "content-length": String(MAX) }, body: bytes });
    expect((await handleTranslate(declared, env)).status).toBe(200);
  });

  it("readCappedBody: small bodies decode as before; a lying small content-length is still capped by the read", async () => {
    expect(await readCappedBody(new Request(URL_, { method: "POST", body: "{\"a\":\"ລາວ\"}" }))).toBe("{\"a\":\"ລາວ\"}");
    expect(await readCappedBody(new Request(URL_, { method: "POST" }))).toBe("");
    expect(await readCappedBody(streamed(new Uint8Array(11)).req, 10)).toBeNull();
    expect(await readCappedBody(streamed(new Uint8Array(10)).req, 10)).toHaveLength(10);
  });

  it("malformed JSON under the limit keeps its 400 invalid_params", async () => {
    const res = await handleTranslate(new Request(URL_, { method: "POST", body: "{not json" }), env);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_params");
  });
});

describe("E2: participant-ui hashes are memoized per isolate per source", () => {
  it("the static set is hashed once and reused across calls; a changed source is hashed afresh", async () => {
    const digest = vi.spyOn(crypto.subtle, "digest");
    const source = Object.freeze(["Alpha s39", "Beta s39"]);
    const a = await staticUiHashes(source);
    const n = digest.mock.calls.length;
    expect(n).toBe(2);
    const b = await staticUiHashes(source);
    expect(b).toBe(a);
    expect(digest.mock.calls.length).toBe(n); // reused: no new hashing
    const changed = Object.freeze(["Alpha s39", "Gamma s39"]);
    const c = await staticUiHashes(changed);
    expect(c).not.toBe(a);
    expect(digest.mock.calls.length).toBe(n + 2);
    expect(c.has(await sha256Hex("Gamma s39"))).toBe(true);
    expect(c.has(await sha256Hex("Beta s39"))).toBe(false);
  });

  it("two participant-ui requests do not re-hash the page words; callers get a copy, never the memo", async () => {
    await allowedScope(undefined, { kind: "ui" }); // warm
    const digest = vi.spyOn(crypto.subtle, "digest");
    const first = await allowedScope(undefined, { kind: "ui" });
    first.allowed.add("tampered");
    const second = await allowedScope(undefined, { kind: "ui" });
    expect(digest).not.toHaveBeenCalled();
    expect(second.allowed.has("tampered")).toBe(false);
    expect(second.allowed.size).toBe(first.allowed.size - 1);
  });

  it("a welcome lead's hash is memoized by language name and equals the direct hash", async () => {
    const digest = vi.spyOn(crypto.subtle, "digest");
    const h1 = await welcomeLeadHash("Tavo s39");
    const h2 = await welcomeLeadHash("Tavo s39");
    expect(h1).toBe(h2);
    expect(digest).toHaveBeenCalledTimes(1);
    const other = await welcomeLeadHash("Kui s39");
    expect(digest).toHaveBeenCalledTimes(2);
    digest.mockRestore();
    expect(h1).toBe(await sha256Hex(welcomeLead("Tavo s39")));
    expect(other).toBe(await sha256Hex(welcomeLead("Kui s39")));
  });
});
