// Workshop on ONE address (cookbook work/active/2026-10-15-3d-workshop-same-ip): 200 participants + 20 facilitators,
// 3+ assessments at once, everyone in the same minute. Limiters are fakes sized from RATE_LIMITS (the one config
// place), so these tests prove the KEYS and the budget; wrangler.toml must carry the same numbers (oracle below).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { enforceCapabilityLimit, enforcePrincipalWriteLimit, LIMITER_NAMES, OPTIONAL_LIMITER_NAMES, RATE_LIMIT_MESSAGE, RATE_LIMITS } from "../src/ratelimit";
import { CapError } from "../src/handlers/types";
import { authConsumeLink, authRequestLink } from "../src/handlers/platform";

const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
const sized = (over: Record<string, unknown> = {}) => ({ ENVIRONMENT: "production",
  ...Object.fromEntries([...LIMITER_NAMES, ...OPTIONAL_LIMITER_NAMES].map((n) => [n, limiter(RATE_LIMITS[n])])), ...over }) as any;
const anon = { kind: "anonymous", id: "anonymous" } as any;
const ctxFor = (env: any, ip: string, principal: any = anon) => ({ env, clientIp: ip, principal }) as any;
const refusal = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e as CapError; } };
const ROOM = "198.51.100.20";

describe("workshop budget on one address (DoD 2): 200 participants + 20 facilitators, 3 assessments, one minute", () => {
  it("no request in the busiest minute is refused", async () => {
    const env = sized();
    const refused: string[] = [];
    const links = ["link-assessment-a", "link-assessment-b", "link-assessment-c"];
    for (let i = 0; i < 200; i++) { // every participant opens their room's shared link
      const e = await refusal(enforceCapabilityLimit(ctxFor(env, ROOM), "cap.participant.open_link", { token: links[i % 3] }));
      if (e) refused.push(`open ${i}`);
    }
    for (let f = 0; f < 20; f++) { // every facilitator signs in: request + consume
      const email = `facilitator${f}@example.org`;
      if (await refusal(enforceCapabilityLimit(ctxFor(env, ROOM), "cap.auth.request_link", { email }))) refused.push(`request ${f}`);
      if (await refusal(enforceCapabilityLimit(ctxFor(env, ROOM), "cap.auth.consume_link", { email, code: "123456" }))) refused.push(`consume ${f}`);
    }
    for (let i = 0; i < 200; i++) { // every participant submits (plus an assisted/paper write) on their own session key
      const p = { kind: "participant", id: `participant-${i}` } as any;
      for (let k = 0; k < 2; k++) if (await refusal(enforcePrincipalWriteLimit(ctxFor(env, ROOM, p), "cap.response.submit", "write"))) refused.push(`write ${i}`);
    }
    expect(refused).toEqual([]);
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM}`)).toBe(200);
    expect(env.RL_AUTH.seen.get(`ip:${ROOM}`)).toBe(40);
  });
});

describe("protection that does not rest on the address key (DoD 3)", () => {
  it("per code: the 11th attempt on one code is refused even from a fresh address each time", async () => {
    const env = sized();
    const out = [];
    for (let i = 0; i < 11; i++) out.push(await refusal(enforceCapabilityLimit(ctxFor(env, `203.0.113.${i}`), "cap.participant.redeem_code", { code: "abcd2345" })));
    expect(out.slice(0, 10).every((e) => e === null)).toBe(true);
    expect(out[10]?.code).toBe("RATE_LIMITED");
    expect([...env.RL_PER_KEY.seen.keys()].every((k: string) => k.startsWith("code:") && !k.includes("ABCD2345"))).toBe(true); // hashed, never the code
  });
  it("per email: request_link for one mailbox is refused on its 11th from rotating addresses (own binding)", async () => {
    const env = sized();
    const out = [];
    for (let i = 0; i < 11; i++) out.push(await refusal(enforceCapabilityLimit(ctxFor(env, `203.0.113.${i}`), "cap.auth.request_link", { email: "Victim@Example.org" })));
    expect(out[9]).toBeNull(); expect(out[10]?.code).toBe("RATE_LIMITED");
    expect([...env.RL_AUTH.seen.keys()].some((k: string) => k.startsWith("em:"))).toBe(false); // moved off RL_AUTH once RL_PER_KEY is bound
  });
  it("per email falls back to RL_AUTH's em: key while RL_PER_KEY is unbound (no regression before Otto binds it)", async () => {
    const env = sized({ RL_PER_KEY: undefined });
    await enforceCapabilityLimit(ctxFor(env, "203.0.113.1"), "cap.auth.request_link", { email: "a@example.org" });
    expect([...env.RL_AUTH.seen.keys()].some((k: string) => k.startsWith("em:"))).toBe(true);
  });
  it("per link: one shared link is refused by its own link: key at RL_PER_LINK, with RL_GLOBAL at full size (Bugbot 4290741302)", async () => {
    const env = sized(); // every limiter at its RATE_LIMITS number — RL_GLOBAL is NOT shrunk, so g:RL_REDEEM cannot be the refuser
    const n = RATE_LIMITS.RL_PER_LINK;
    expect(n).toBeGreaterThanOrEqual(200); expect(n).toBeLessThan(RATE_LIMITS.RL_GLOBAL); // room-sized, and below the global ceiling
    const ip = (i: number) => `10.1.${i >> 8}.${i & 255}`;
    for (let i = 0; i < n; i++) expect(await refusal(enforceCapabilityLimit(ctxFor(env, ip(i)), "cap.participant.open_link", { token: "one-link" }))).toBeNull();
    const e = await refusal(enforceCapabilityLimit(ctxFor(env, ip(n)), "cap.participant.open_link", { token: "one-link" }));
    expect(e?.code).toBe("RATE_LIMITED"); expect(e?.hint).toMatch(/too many opens of this link/);
    expect(env.RL_GLOBAL.seen.get("g:RL_REDEEM")).toBe(n); // the link key refused before the global key was spent (review 6207996655 #2)
    expect([...env.RL_PER_LINK.seen.keys()].every((k: string) => k.startsWith("link:") && !k.includes("one-link"))).toBe(true);
    expect([...env.RL_GLOBAL.seen.keys(), ...env.RL_REDEEM.seen.keys()].some((k: string) => k.startsWith("link:"))).toBe(false);
    // a second link is its own bucket
    expect(await refusal(enforceCapabilityLimit(ctxFor(env, ip(n + 1)), "cap.participant.open_link", { token: "other-link" }))).toBeNull();
  });
  it("per link: one address at full rate cannot drain a shared link and lock the room out (review 6207996655 #1)", async () => {
    expect(RATE_LIMITS.RL_PER_LINK).toBeGreaterThanOrEqual(4 * RATE_LIMITS.RL_REDEEM); // recorded trade: 4 addresses still can
    const env = sized();
    const attacker = "203.0.113.66";
    let allowed = 0;
    for (let i = 0; i < RATE_LIMITS.RL_REDEEM + 100; i++)
      if (!(await refusal(enforceCapabilityLimit(ctxFor(env, attacker), "cap.participant.open_link", { token: "room-link" })))) allowed++;
    expect(allowed).toBe(RATE_LIMITS.RL_REDEEM); // the attacker's own address key stops it, and its refusals spend no link units
    // the room, on its own address, still opens the same link: all 200
    for (let i = 0; i < 200; i++)
      expect(await refusal(enforceCapabilityLimit(ctxFor(env, ROOM), "cap.participant.open_link", { token: "room-link" }))).toBeNull();
    // three attacker addresses at full rate still leave the room room to open
    const env3 = sized();
    for (const a of ["203.0.113.1", "203.0.113.2", "203.0.113.3"])
      for (let i = 0; i < RATE_LIMITS.RL_REDEEM; i++) await enforceCapabilityLimit(ctxFor(env3, a), "cap.participant.open_link", { token: "room-link" });
    for (let i = 0; i < 200; i++)
      expect(await refusal(enforceCapabilityLimit(ctxFor(env3, ROOM), "cap.participant.open_link", { token: "room-link" }))).toBeNull();
  });
  it("per link at today's wrangler numbers (RL_REDEEM 60, RL_GLOBAL unbound): 200 opens of one link from 200 addresses are all allowed", async () => {
    const env = sized({ RL_REDEEM: limiter(60), RL_GLOBAL: undefined, RL_PER_KEY: undefined, RL_PER_LINK: undefined });
    for (let i = 0; i < 200; i++)
      expect(await refusal(enforceCapabilityLimit(ctxFor(env, `10.0.${i >> 8}.${i & 255}`), "cap.participant.open_link", { token: "one-link" }))).toBeNull();
  });
  it("global ceiling: guessing spread over many addresses stops at RL_GLOBAL", async () => {
    const env = sized({ RL_GLOBAL: limiter(3) });
    const out = [];
    for (let i = 0; i < 4; i++) out.push(await refusal(enforceCapabilityLimit(ctxFor(env, `203.0.113.${i}`), "cap.participant.redeem_code", { code: `CODE000${i}` })));
    expect(out.slice(0, 3).every((e) => e === null)).toBe(true); expect(out[3]?.code).toBe("RATE_LIMITED");
    expect([...env.RL_GLOBAL.seen.keys()]).toEqual(["g:RL_REDEEM"]);
  });
  it("global ceiling is spent last: malformed requests and per-secret refusals spend no g: unit (review 6207996655 #2)", async () => {
    const env = sized();
    const ip = (i: number) => `10.2.${i >> 8}.${i & 255}`;
    // malformed: missing / empty / non-string secrets — the handler refuses them; the service-wide budget is untouched
    await refusal(enforceCapabilityLimit(ctxFor(env, ip(1)), "cap.participant.open_link", {}));
    await refusal(enforceCapabilityLimit(ctxFor(env, ip(2)), "cap.participant.open_link", { token: "" }));
    await refusal(enforceCapabilityLimit(ctxFor(env, ip(3)), "cap.participant.redeem_code", { code: 12345678 }));
    await refusal(enforceCapabilityLimit(ctxFor(env, ip(4)), "cap.auth.request_link", {}));
    await refusal(enforceCapabilityLimit(ctxFor(env, ip(5)), "cap.auth.request_link", { email: 7 })); // INVALID_PARAMS
    await refusal(enforceCapabilityLimit(ctxFor(env, ip(6)), "cap.auth.consume_link", { email: "a@example.org" })); // no code
    expect(env.RL_GLOBAL.seen.size).toBe(0);
    // per-code refusals (the 11th+ try on one code) do not spend g:RL_REDEEM either
    for (let i = 0; i < 30; i++) await refusal(enforceCapabilityLimit(ctxFor(env, ip(100 + i)), "cap.participant.redeem_code", { code: "ABCD2345" }));
    expect(env.RL_GLOBAL.seen.get("g:RL_REDEEM")).toBe(RATE_LIMITS.RL_PER_KEY);
    // and an address refused by its own key spends nothing further
    const env2 = sized({ RL_REDEEM: limiter(0) });
    await refusal(enforceCapabilityLimit(ctxFor(env2, ROOM), "cap.participant.open_link", { token: "room-link" }));
    expect(env2.RL_GLOBAL.seen.size).toBe(0); expect(env2.RL_PER_LINK.seen.size).toBe(0);
  });
  it("limiter and auth handlers agree on malformed: a shape that spends no g:RL_AUTH is refused before any lookup (Bugbot 4291079028)", async () => {
    const touched: string[] = [];
    const db = { prepare: (sql: string) => { touched.push(sql); throw new Error("handler reached the database"); } };
    const shapes: [string, Record<string, unknown>][] = [
      ["cap.auth.consume_link", { email: "a@example.invalid", code: 123456 }], // numeric code: the bypass Bugbot found
      ["cap.auth.consume_link", { email: "a@example.invalid", code: "   " }],
      ["cap.auth.consume_link", { email: 7, code: "123456" }],
      ["cap.auth.request_link", { email: "   " }],
    ];
    for (const [cap, params] of shapes) {
      const env = sized();
      await refusal(enforceCapabilityLimit(ctxFor(env, ROOM), cap, params));
      expect(env.RL_GLOBAL.seen.size, `${cap} ${JSON.stringify(params)} spent g:`).toBe(0);
      const handler = cap === "cap.auth.consume_link" ? authConsumeLink : authRequestLink;
      const e = await refusal(handler({ env: { ENVIRONMENT: "dev" }, db, log: () => {} } as any, params, undefined as any));
      expect(e?.code, `${cap} ${JSON.stringify(params)}`).toBe("INVALID_PARAMS");
    }
    expect(touched).toEqual([]);
  });
  it("optional limiters absent: skipped, never refused (an unbound RL_GLOBAL / RL_PER_KEY does not stop a workshop)", async () => {
    const env = sized({ RL_GLOBAL: undefined, RL_PER_KEY: undefined, RL_PER_LINK: undefined });
    expect(await refusal(enforceCapabilityLimit(ctxFor(env, ROOM), "cap.participant.redeem_code", { code: "ABCD2345" }))).toBeNull();
    expect(await refusal(enforceCapabilityLimit(ctxFor(env, ROOM), "cap.participant.open_link", { token: "one-link" }))).toBeNull();
  });
  it("per session: writes by one principal are bounded on wr:<kind>:<id>; reads and anonymous callers are not metered there", async () => {
    const env = sized({ RL_MCP_CEILING: limiter(2) });
    const p = { kind: "participant", id: "p-1" } as any;
    expect(await refusal(enforcePrincipalWriteLimit(ctxFor(env, ROOM, p), "cap.response.submit", "write"))).toBeNull();
    expect(await refusal(enforcePrincipalWriteLimit(ctxFor(env, ROOM, p), "cap.response.submit", "write"))).toBeNull();
    const e = await refusal(enforcePrincipalWriteLimit(ctxFor(env, ROOM, p), "cap.response.submit", "write"));
    expect(e?.code).toBe("RATE_LIMITED"); expect(e?.message).toBe(RATE_LIMIT_MESSAGE);
    await enforcePrincipalWriteLimit(ctxFor(env, ROOM, p), "cap.response.form", "read");
    await enforcePrincipalWriteLimit(ctxFor(env, ROOM), "cap.participant.open_link", "write");
    expect([...env.RL_MCP_CEILING.seen.keys()]).toEqual(["wr:participant:p-1"]);
  });
});

describe("every rate-limit refusal says so and offers a retry in one minute (DoD 6)", () => {
  const env = (over: Record<string, unknown> = {}) => ({ ENVIRONMENT: "dev", SESSION_SECRET: "synthetic-test-secret", RL_MCP_ANON: limiter(0), RL_HTTP_ANON: limiter(0), RL_AUTH: limiter(0), RL_REDEEM: limiter(0), RL_MCP_CEILING: limiter(0), ...over }) as any;
  const send = (e: any, method: string, path: string, body?: unknown) => app.fetch(new Request("https://t.invalid" + path, { method,
    headers: { "content-type": "application/json", "cf-connecting-ip": ROOM, origin: "https://t.invalid" }, body: body === undefined ? undefined : JSON.stringify(body) }), e);
  it("HTTP twin (anonymous dampener): 429, Retry-After 60, plain message", async () => {
    const r = await send(env(), "GET", "/v2/health");
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json(); expect(j.error.code).toBe("RATE_LIMITED"); expect(j.error.message).toBe(RATE_LIMIT_MESSAGE); expect(j.error.data.retry_after).toBe(60);
  });
  it("capability limiter (open link): 429, Retry-After 60, plain message", async () => {
    const r = await send(env(), "POST", "/v2/participate/link", { token: "x".repeat(43) });
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json(); expect(j.error.message).toBe(RATE_LIMIT_MESSAGE); expect(j.error.hint).toMatch(/one minute/);
  });
  it("/mcp anonymous: 429, Retry-After 60, plain message in the JSON-RPC error", async () => {
    const r = await send(env(), "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json(); expect(j.error.message).toBe(RATE_LIMIT_MESSAGE); expect(j.error.data.retry_after).toBe(60);
  });
});

const boundIn = (toml: string, section: string) => {
  const out: Record<string, number> = {}; let cur: string | null = null, name = "";
  for (const line of toml.split("\n")) {
    const t = line.trim(); const arr = t.match(/^\[\[([\w.]+)\]\]$/);
    if (arr) { cur = arr[1]; name = ""; continue; } if (/^\[[\w.]+\]$/.test(t)) { cur = null; continue; }
    if (cur !== section) continue;
    const n = t.match(/^name\s*=\s*"(\w+)"/); if (n) name = n[1];
    const l = t.match(/^simple\s*=.*limit\s*=\s*(\d+)/); if (l && name) out[name] = Number(l[1]);
  }
  return out;
};

describe("one config place: wrangler.toml mirrors RATE_LIMITS", () => {
  // Bindings Otto has not yet re-numbered or added (wrangler.toml is Otto's; see the PR body). When his commit sets them,
  // this test fails until the matching line here is deleted — the mismatch can never go quiet.
  const AWAITING_WRANGLER: Record<string, number | "unbound"> = { RL_HTTP_ANON: 60, RL_AUTH: 10, RL_REDEEM: 60, RL_PER_KEY: "unbound", RL_PER_LINK: "unbound", RL_GLOBAL: "unbound" };
  it("RL_AUTH is never bound above RL_PER_KEY's number unless RL_PER_KEY is bound beside it (review 6207996655 #3)", () => {
    // While RL_PER_KEY is unbound the em: key rides RL_AUTH (src/ratelimit.ts), so raising RL_AUTH alone loosens the
    // per-mailbox sign-in limit with it. Otto binds both in one change; this refuses the one without the other.
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    for (const section of ["ratelimits", "env.production.ratelimits"]) {
      const b = boundIn(toml, section);
      if (b.RL_AUTH !== undefined && b.RL_AUTH > RATE_LIMITS.RL_PER_KEY) expect(b.RL_PER_KEY, `${section}: RL_AUTH ${b.RL_AUTH} needs RL_PER_KEY bound`).toBeDefined();
    }
    // the rule itself, on a sample that raises RL_AUTH alone
    const sample = `[[ratelimits]]\nname = "RL_AUTH"\nnamespace_id = "1"\nsimple = { limit = 100, period = 60 }\n`;
    expect(boundIn(sample, "ratelimits")).toEqual({ RL_AUTH: 100 });
  });
  it("every limiter's bound number equals RATE_LIMITS (top level and production), except the named pending ones", () => {
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    for (const section of ["ratelimits", "env.production.ratelimits"]) {
      const b = boundIn(toml, section);
      for (const n of [...LIMITER_NAMES, ...OPTIONAL_LIMITER_NAMES]) {
        const actual = b[n] ?? "unbound";
        if (n in AWAITING_WRANGLER) expect(actual, `${section} ${n}: Otto set it — delete its AWAITING_WRANGLER entry`).toBe(AWAITING_WRANGLER[n]);
        else expect(actual, `${section} ${n}`).toBe(RATE_LIMITS[n]);
      }
    }
  });
});
