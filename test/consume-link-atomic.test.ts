// Atomic single-use login-code redemption (Bugbot 4033370835, PR #26). Before the fix, authConsumeLink checked
// redeemed_at in JS and then ran an unconditional UPDATE, so two overlapping consumes of one code BOTH minted live
// sessions. The guarded UPDATE (… AND redeemed_at IS NULL AND expires_at >= ?) with meta.changes === 1 is the only
// authority now; this file proves it on real Miniflare D1.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { sha256 } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "cla", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "consume-link-atomic-db" } }] }));
afterAll(() => mf.dispose());
function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}
const permissive = () => ({ limit: async () => ({ success: true }) });
let db: D1Database;
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0006_oauth_code_redemption.sql", "0007_shared_link_context.sql"]) await db.batch(statements(db, `../migrations/${m}`));
}, 60_000);
const env = () => ({ DB: db, SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", RL_MCP_ANON: permissive(), RL_AUTH: permissive(), RL_REDEEM: permissive() }) as any;
const post = (path: string, body: unknown, ip = "203.0.113.7") => app.fetch(new Request("https://t.invalid" + path, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(body) }), env());
const requestCode = async (email: string) => { const r = await post("/v2/auth/link", { email }); expect(r.status).toBe(200); const j: any = await r.json(); expect(j.result.dev_only_code).toMatch(/^\d{6}$/); return j.result.dev_only_code as string; };
const consume = (email: string, code: string) => post("/v2/auth/session", { email, code });
const sessionsFor = async (email: string) => (await db.prepare("SELECT COUNT(*) AS n FROM session WHERE principal_id = (SELECT id FROM principal WHERE email_hash = ?)").bind(await sha256(email)).first<{ n: number }>())!.n;

describe("consume_link is atomic and single-use", () => {
  it("(a) 5 concurrent consumes of one code: exactly one 200 with a session, four code_used, ONE session row", async () => {
    const email = "race.owner@example.invalid";
    const code = await requestCode(email);
    const rs = await Promise.all(Array.from({ length: 5 }, () => consume(email, code)));
    const statuses = rs.map((r) => r.status);
    const bodies: any[] = await Promise.all(rs.map((r) => r.json()));
    const winners = bodies.filter((b) => typeof b.result?.session === "string" && /^st_/.test(b.result.session));
    const used = bodies.filter((b) => b.error?.code === "INVALID_PARAMS" && b.error?.message === "code_used");
    expect(statuses.filter((s) => s === 200).length).toBe(1);
    expect(winners.length).toBe(1);
    expect(used.length).toBe(4);
    expect(await sessionsFor(email)).toBe(1);
  }, 30_000);

  it("(b) sequential reuse of a redeemed code → code_used, no second session", async () => {
    const email = "twice.owner@example.invalid";
    const code = await requestCode(email);
    expect((await consume(email, code)).status).toBe(200);
    const r = await consume(email, code);
    expect(r.status).toBe(400);
    const j: any = await r.json(); expect(j.error.code).toBe("INVALID_PARAMS"); expect(j.error.message).toBe("code_used");
    expect(await sessionsFor(email)).toBe(1);
  }, 30_000);

  it("(c) expired code → code_expired and no session", async () => {
    const email = "stale.owner@example.invalid";
    const code = await requestCode(email);
    await db.prepare("UPDATE login_code SET expires_at = ? WHERE code_hash = ?").bind(Date.now() - 1000, await sha256(code)).run();
    const r = await consume(email, code);
    expect(r.status).toBe(400);
    const j: any = await r.json(); expect(j.error.code).toBe("INVALID_PARAMS"); expect(j.error.message).toBe("code_expired");
    expect(await sessionsFor(email)).toBe(0);
    expect((await db.prepare("SELECT redeemed_at FROM login_code WHERE code_hash = ?").bind(await sha256(code)).first<any>())!.redeemed_at).toBeNull();
  }, 30_000);

  it("(d) wrong code → code invalid", async () => {
    const email = "wrong.owner@example.invalid";
    await requestCode(email);
    const r = await consume(email, "000000");
    expect(r.status).toBe(400);
    const j: any = await r.json(); expect(j.error.code).toBe("INVALID_PARAMS"); expect(j.error.message).toBe("code invalid");
    expect(await sessionsFor(email)).toBe(0);
  }, 30_000);

  it("(e) the winner's token authenticates GET /v2/me", async () => {
    const email = "winner.owner@example.invalid";
    const code = await requestCode(email);
    const j: any = await (await consume(email, code)).json();
    const me = await app.fetch(new Request("https://t.invalid/v2/me", { headers: { authorization: `Bearer ${j.result.session}`, "cf-connecting-ip": "203.0.113.8" } }), env());
    expect(me.status).toBe(200);
    const m: any = await me.json(); expect(m.result.principal.id).toBe(j.result.principal_id); expect(m.result.principal.kind).toBe("user");
  }, 30_000);
});
