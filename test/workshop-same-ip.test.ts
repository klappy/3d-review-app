// Workshop on one IP (cookbook work/active/2026-10-15-3d-workshop-same-ip, amended 881e57d): 200 participants +
// 20 facilitators behind ONE address, 3 assessments at once, the busiest minute — no refusal. And the non-IP keys
// (per secret, per email, per principal, global sign-in) refuse when an attacker rotates addresses.
// In-process replay of the limiter accounting: each binding is faked as a fixed-window counter at the limit
// wrangler.toml declares (RL_REDEEM at 300, assuming app #486 lands). Cloudflare's own counting is Cloudflare's to prove;
// the DEV load test from one egress IP is DoD 4.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allow, allowSignInAddress, allowSignInGlobal, enforceCapabilityLimit, LIMITER_NAMES, type LimiterName } from "../src/ratelimit";
import { authRequestLink } from "../src/handlers/platform";

const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8").split(/^\[env\.production\]$/m)[0];
const declared = Object.fromEntries([...toml.matchAll(/name = "(RL_[A-Z_]+)"[\s\S]*?simple = \{ limit = (\d+)/g)].map((m) => [m[1], Number(m[2])])) as Record<LimiterName, number>;
const AFTER_486 = { RL_REDEEM: 300 }; // app #486 (Otto): RL_REDEEM 60 → 300 per 60 s

const counter = (limit: number) => { const seen = new Map<string, number>(); const refused: string[] = [];
  return { seen, refused, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); if (n > limit) refused.push(key); return { success: n <= limit }; } }; };
const mkEnv = (over: Partial<Record<LimiterName, number>> = {}) => Object.fromEntries([
  ["ENVIRONMENT", "production"], // fail closed: every binding must be present
  ...LIMITER_NAMES.map((n) => [n, counter(over[n] ?? declared[n])]),
]) as any;
const refusals = (env: any) => LIMITER_NAMES.flatMap((n) => env[n].refused.map((k: string) => `${n} ${k}`));
const anon = { kind: "anonymous", id: "anon" };
const ctx = (env: any, ip: string, principal: any = anon) => ({ env, clientIp: ip, principal }) as any;
const call = async (env: any, ip: string, cap: string, params: Record<string, unknown>, principal: any = anon) => {
  try { await enforceCapabilityLimit(ctx(env, ip, principal), cap, params); return true; }
  catch (e: any) { if (e.code === "RATE_LIMITED") return false; throw e; }
};

/** cap.auth.request_link end to end through the limiter AND the handler (g:auth is spent in the handler, only on issuance).
 *  ENVIRONMENT "dev" with every binding present: the counters still count; D1 is a no-op stub. */
const issueCode = async (env: any, ip: string, email: string) => {
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) };
  const c = { ...ctx(env, ip), env: { ...env, ENVIRONMENT: "dev" }, db, log: () => {} };
  try { await enforceCapabilityLimit(c, "cap.auth.request_link", { email }); await authRequestLink(c, { email }); return true; }
  catch (e: any) { if (e.code === "RATE_LIMITED") return false; throw e; }
};

const ROOM = "203.0.113.50";
const P = 200, F = 20, LINKS = ["link-a".padEnd(43, "a"), "link-b".padEnd(43, "b"), "link-c".padEnd(43, "c")];

/** The busiest minute of one workshop room: every participant opens in the same minute, every facilitator signs in. */
async function busiestMinute(env: any, signIn: "email-link" | "dev-code") {
  for (let f = 0; f < F; f++) {
    if (signIn === "email-link") { // POST /v2/auth/email, then the landing check and the open (src/index.ts)
      expect(await allowSignInAddress(env, ROOM)).toBe(true); expect(await allowSignInGlobal(env)).toBe(true);
      expect(await allow(env, "RL_REDEEM", `ip:${ROOM}`)).toBe(true); expect(await allow(env, "RL_REDEEM", `ip:${ROOM}`)).toBe(true);
    } else { // DEV: cap.auth.request_link + cap.auth.consume_link
      expect(await issueCode(env, ROOM, `fac${f}@example.invalid`)).toBe(true);
      expect(await call(env, ROOM, "cap.auth.consume_link", { email: `fac${f}@example.invalid`, code: "123456" })).toBe(true);
    }
  }
  for (let i = 0; i < P; i++) {
    const pt = { kind: "participant", id: `resp_${i}` };
    expect(await call(env, ROOM, "cap.participant.open_link", { token: LINKS[i % LINKS.length] })).toBe(true);
    for (const cap of ["cap.response.form", "cap.response.submit", "cap.response.receipt"]) expect(await call(env, ROOM, cap, {}, pt)).toBe(true);
  }
  for (let f = 0; f < F; f++) { // dashboards, status polls, paper entry and a report build: 60 calls each (guess, generous)
    const st = { kind: "user", id: `usr_fac${f}` };
    for (let k = 0; k < 60; k++) expect(await call(env, ROOM, "cap.assessment.get", {}, st)).toBe(true);
  }
}

describe("workshop on one IP: 200 participants + 20 facilitators, 3 assessments, busiest minute", () => {
  it("email-link sign-in (production path): zero refusals at the declared limits with RL_REDEEM 300", async () => {
    const env = mkEnv(AFTER_486);
    await busiestMinute(env, "email-link");
    expect(refusals(env)).toEqual([]);
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM}`)).toBe(P + 2 * F); // 240 of 300
    expect(env.RL_HTTP_ANON.seen.get(`au:${ROOM}`)).toBe(F);      // 20 of 60
  });
  it("dev code sign-in (request + consume): zero refusals — 40 sign-in steps on one address", async () => {
    const env = mkEnv(AFTER_486);
    await busiestMinute(env, "dev-code");
    expect(refusals(env)).toEqual([]);
    expect(env.RL_HTTP_ANON.seen.get(`au:${ROOM}`)).toBe(2 * F); // 40 of 60; on main it was 20 on RL_AUTH ip: (10) → refused
  });
  it("without #486 (RL_REDEEM 60) the same minute IS refused — this PR depends on #486 for the room", async () => {
    const env = mkEnv();
    for (let i = 0; i < P; i++) await call(env, ROOM, "cap.participant.open_link", { token: LINKS[i % 3] });
    expect(env.RL_REDEEM.refused.length).toBeGreaterThan(0);
  });
});

describe("abuse stays bounded when the attacker rotates addresses (non-IP keys)", () => {
  const rotating = (i: number) => `198.51.${(i >> 8) & 255}.${i & 255}`;
  it("one shared link opened from 1000 addresses: the per-secret sk: key refuses past 300", async () => {
    const env = mkEnv(AFTER_486);
    let ok = 0; for (let i = 0; i < 1000; i++) if (await call(env, rotating(i), "cap.participant.open_link", { token: LINKS[0] })) ok++;
    expect(ok).toBe(300);
    expect(new Set(env.RL_REDEEM.refused.map((k: string) => k.slice(0, 3)))).toEqual(new Set(["sk:"]));
  });
  it("code redemption normalises like the handler: case and spaces share one sk: key", async () => {
    const env = mkEnv(AFTER_486);
    await call(env, rotating(1), "cap.participant.redeem_code", { code: " abcd-1234 " });
    await call(env, rotating(2), "cap.participant.redeem_code", { code: "ABCD-1234" });
    expect([...env.RL_REDEEM.seen.entries()].filter(([k]: [string, number]) => k.startsWith("sk:")).map(([, n]: [string, number]) => n)).toEqual([2]);
  });
  it("sign-in spam at one mailbox from 100 addresses: the em: key refuses past 10", async () => {
    const env = mkEnv(AFTER_486);
    let ok = 0; for (let i = 0; i < 100; i++) if (await call(env, rotating(i), "cap.auth.request_link", { email: "victim@example.invalid" })) ok++;
    expect(ok).toBe(declared.RL_AUTH);
  });
  it("sign-in issuance to 1000 different mailboxes from 1000 addresses: the global g:auth ceiling refuses past 600", async () => {
    const env = mkEnv(AFTER_486);
    let ok = 0; for (let i = 0; i < 1000; i++) if (await issueCode(env, rotating(i), `x${i}@example.invalid`)) ok++;
    expect(ok).toBe(declared.RL_MCP_CEILING);
    expect(env.RL_MCP_CEILING.refused.every((k: string) => k === "g:auth")).toBe(true);
  });
  it("write flood by one participant bearer from rotating addresses: the per-principal pr: key refuses past 600", async () => {
    const env = mkEnv(AFTER_486);
    const pt = { kind: "participant", id: "resp_flood" };
    let ok = 0; for (let i = 0; i < 700; i++) if (await call(env, rotating(i), "cap.response.submit", {}, pt)) ok++;
    expect(ok).toBe(declared.RL_MCP_CEILING);
    expect(new Set(env.RL_MCP_CEILING.refused)).toEqual(new Set(["pr:participant:resp_flood"]));
  });
  it("a refused per-principal call is RATE_LIMITED with a plain rate-limit message and a one-minute retry", async () => {
    const env = mkEnv({ RL_MCP_CEILING: 0 });
    const err: any = await enforceCapabilityLimit(ctx(env, ROOM, { kind: "user", id: "usr_x" }), "cap.assessment.get", {}).catch((e) => e);
    expect(err.code).toBe("RATE_LIMITED"); expect(err.message).toMatch(/rate limit/); expect(err.message).toMatch(/60 seconds/);
  });
});
