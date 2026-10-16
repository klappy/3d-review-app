/**
 * Shared-IP room (DEV burst 2026-10-16: 200 cap.participant.open_link from one address, 142 refused by RL_HTTP_ANON
 * before RL_REDEEM was consulted). A twin whose capability has its own limiter (RL_REDEEM, RL_AUTH) is counted once,
 * by that limiter; every other anonymous twin still spends RL_HTTP_ANON exactly as before. Limiters are counting
 * fakes: the test proves WIRING (which bucket each call spends), not Cloudflare's counting.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "anon-rl", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "anon-rl" } }] }));
afterAll(() => mf.dispose());
const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
const ROOM_IP = "203.0.113.200";
const base = "/v2/assessments/assess_tavo_collect/surveys/survey_tavo/links";
let db: D1Database, token: string;
const mkEnv = (over: Record<string, unknown> = {}) => ({ DB: db, SESSION_SECRET: "synthetic-anon-rl", ENVIRONMENT: "dev",
  RL_MCP_ANON: limiter(1000), RL_MCP_CEILING: limiter(1000), RL_HTTP_ANON: limiter(60), RL_AUTH: limiter(1000), RL_REDEEM: limiter(1000), ...over }) as any;
const call = (env: any, method: string, path: string, body?: unknown, bearer?: string, ip = ROOM_IP) => app.fetch(new Request("https://t.invalid" + path, { method,
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body) }), env);

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  // One real shared survey link, issued by the owner (dry run → execute), as the summit room would scan it.
  const env = mkEnv(), owner = await mintSession(env, "person_mara", "user");
  const dry: any = await (await call(env, "POST", base, { params: {}, mode: "dry_run" }, owner)).json(); expect(dry.ok).toBe(true);
  const run: any = await (await call(env, "POST", base, { params: {}, mode: "execute", confirm_token: dry.result.confirm_token }, owner)).json(); expect(run.ok).toBe(true);
  token = run.result.link_token;
}, 60_000);

describe("anonymous twins with their own capability limiter skip RL_HTTP_ANON", () => {
  it("a 200-open burst on one link from one address is limited only by RL_REDEEM: none refused when RL_REDEEM allows it", async () => {
    const env = mkEnv({ RL_REDEEM: limiter(300) });
    const statuses: number[] = [];
    for (let i = 0; i < 200; i += 20)
      statuses.push(...(await Promise.all(Array.from({ length: 20 }, () => call(env, "POST", "/v2/participate/link", { token }).then((r) => r.status)))));
    expect(statuses.filter((s) => s === 429).length).toBe(0);
    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM_IP}`)).toBe(200); // each open counted once, by RL_REDEEM
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0); // the generic dampener was never touched
  }, 120_000);

  it("when RL_REDEEM is exhausted the open is refused by RL_REDEEM (capability error), never by RL_HTTP_ANON", async () => {
    const env = mkEnv({ RL_REDEEM: limiter(3) });
    for (let i = 0; i < 3; i++) expect((await call(env, "POST", "/v2/participate/link", { token })).status).toBe(200);
    const r = await call(env, "POST", "/v2/participate/link", { token });
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json();
    expect(j.error.code).toBe("RATE_LIMITED");
    expect(j.error.message).toBe("too many attempts — slow down"); // RL_REDEEM's refusal, not "too many anonymous requests"
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM_IP}`)).toBe(4);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0);
  }, 30_000);

  it("redeem_code and the two sign-in twins spend only their own limiter (RL_REDEEM / RL_AUTH)", async () => {
    const env = mkEnv({ RL_HTTP_ANON: limiter(0) }); // a generic bucket that refuses everything
    expect((await call(env, "POST", "/v2/participate/code", { code: "NOPE-0001" })).status).toBe(404);
    expect((await call(env, "POST", "/v2/auth/link", { email: "room.member@example.invalid" })).status).toBe(200);
    expect((await call(env, "POST", "/v2/auth/session", { email: "room.member@example.invalid", code: "000000" })).status).toBe(400);
    expect(env.RL_HTTP_ANON.seen.size).toBe(0);
    expect(env.RL_REDEEM.seen.get(`ip:${ROOM_IP}`)).toBe(1);
    expect(env.RL_AUTH.seen.get(`ip:${ROOM_IP}`)).toBe(2);
  }, 30_000);

  it("every other anonymous twin still spends RL_HTTP_ANON per address and is refused at the limit, as before", async () => {
    const env = mkEnv({ RL_HTTP_ANON: limiter(3) });
    for (let i = 0; i < 3; i++) expect((await call(env, "GET", "/v2/health")).status).toBe(200);
    const r = await call(env, "GET", "/v2/health");
    expect(r.status).toBe(429); expect(r.headers.get("retry-after")).toBe("60");
    const j: any = await r.json();
    expect(j.error.code).toBe("RATE_LIMITED");
    expect(j.error.message).toMatch(/^too many anonymous requests/);
    // a protected twin called anonymously spends the same bucket (refused before the 401)
    expect((await call(env, "POST", base, { params: {}, mode: "dry_run" })).status).toBe(429);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(5);
    // the open_link twin from the same exhausted address is still served (its own budget)
    expect((await call(env, "POST", "/v2/participate/link", { token })).status).toBe(200);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(5);
    // a credential holder is not counted, as before
    const bearer = await mintSession(env, "person_mara", "user");
    expect((await call(env, "GET", "/v2/health", undefined, bearer)).status).toBe(200);
    expect(env.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`)).toBe(5);
  }, 30_000);
});
