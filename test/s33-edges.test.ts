/**
 * S33 edges (Train 22 audit backlog, cook A): translate body read stays under the upstream time limit (E1), a passage
 * file does not outlive a failed row insert (E4), and two or three first link calls at once leave one live link per survey that every caller agrees on.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { handleTranslate, TRANSLATE_LIMITS } from "../src/translate";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "s33-edges", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "s33-edges" }, r2Buckets: ["PASSAGES"] }] }));
let db: D1Database, bucket: R2Bucket, env: any, owner: string;
const aid = "assess_tavo_collect";
beforeAll(async () => {
  db = await mf.getD1Database("DB"); bucket = await mf.getR2Bucket("PASSAGES") as unknown as R2Bucket;
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql", "migrations/0012_translation.sql", "migrations/0013_passages.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, PASSAGES: bucket, SESSION_SECRET: "synthetic-s33", ENVIRONMENT: "dev", TRANSLATE_UPSTREAM_URL: "https://upstream.invalid/t" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);
afterAll(() => mf.dispose());

/** DB whose statements matching `hit` are replaced by `stub(sql)`; everything else is the real D1. */
function dbWith(hit: (sql: string) => boolean, stub: (sql: string) => any): D1Database {
  return new Proxy(db as any, { get(t, k) {
    if (k === "prepare") return (sql: string) => hit(sql) ? stub(sql) : t.prepare(sql);
    const v = t[k]; return typeof v === "function" ? v.bind(t) : v;
  } }) as D1Database;
}

describe("E1: the upstream time limit covers reading the body", () => {
  it("a body that never finishes is cut off by the timer instead of hanging", async () => {
    const real = globalThis.setTimeout;
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: any, ms?: number, ...a: any[]) => real(fn, ms === TRANSLATE_LIMITS.timeoutMs ? 30 : ms, ...a)) as any);
    try {
      let readStarted = false;
      const stall = (async (_u: string, init: RequestInit) => ({
        ok: true, status: 200,
        json: () => { readStarted = true; return new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))); },
      })) as unknown as typeof globalThis.fetch;
      const req = new Request("https://local.invalid/v2/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetLang: "lo", context: "participant-ui", sourceTexts: { z: "Next" } }) });
      const r = await Promise.race([handleTranslate(req, env, { fetch: stall }), new Promise<"hung">((res) => real(() => res("hung"), 3000))]);
      expect(readStarted).toBe(true);
      expect(r).not.toBe("hung");
      await (r as Response).json();
      expect(await db.prepare("SELECT COUNT(*) AS n FROM translation_memory WHERE locale = 'lo'").first<{ n: number }>()).toEqual({ n: 0 });
    } finally { spy.mockRestore(); }
  });
});

describe("E4: a passage file is removed when its row cannot be stored", () => {
  it("R2 holds no object for the upload after the insert throws", async () => {
    const e = { ...env, DB: dbWith((sql) => sql.startsWith("INSERT INTO assessment_passage"), () => ({ bind: () => ({ run: async () => { throw new Error("D1 down"); } }) })) };
    const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");
    const before = (await bucket.list({ prefix: `assessments/${aid}/` })).objects.length;
    const r = await app.fetch(new Request(`https://local.invalid/v2/assessments/${aid}/passages?name=s33.pdf`, { method: "POST", headers: { "content-type": "application/pdf", authorization: `Bearer ${owner}` }, body: PDF }), e);
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect((await bucket.list({ prefix: `assessments/${aid}/` })).objects.length).toBe(before);
  });
});

describe("one live link per survey under a simultaneous first call", () => {
  const base = `/v2/assessments/${aid}/surveys/survey_tavo/links`;
  const call = async (body: unknown, e = env) => { const r = await app.fetch(new Request("https://local.invalid" + base, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${owner}` }, body: JSON.stringify(body) }), e); return await r.json() as any; };
  const LOOKUP = "FROM invitation WHERE assessment_survey_id = ? AND scope_type = 'survey'";
  /** Env whose first live-link lookup (the pre-insert one) sees nothing, as if it ran before the other racer stored. */
  const blindFirst = (extra: (sql: string) => any = () => undefined) => { let n = 0; return { ...env, DB: dbWith(
    (sql) => (sql.includes(LOOKUP) && n++ === 0) || extra(sql) !== undefined,
    (sql) => extra(sql) ?? { bind: () => ({ all: async () => ({ results: [] }) }) }) }; };
  const live = async () => Number((await db.prepare("SELECT COUNT(*) AS n FROM invitation WHERE assessment_survey_id = 'survey_tavo' AND status IN ('pending','accepted')").first<{ n: number }>())!.n);
  it("the second minter deletes its own row and hands back the earlier link as reused", async () => {
    const dry1 = await call({ params: {}, mode: "dry_run" });
    const first = (await call({ params: {}, mode: "execute", confirm_token: dry1.result.confirm_token })).result;
    const n = await live();
    // The racing call's pre-insert lookup ran before `first` was stored: it sees no live link.
    const dry2 = await call({ params: {}, mode: "dry_run" }, blindFirst());
    const second = (await call({ params: {}, mode: "execute", confirm_token: dry2.result.confirm_token }, blindFirst())).result;
    expect(second).toMatchObject({ link_id: first.link_id, link_token: first.link_token, reused: true });
    expect(await live()).toBe(n);
  });
  it("a third caller between a racer's insert and its delete gets the surviving earliest link", async () => {
    const dry1 = await call({ params: {}, mode: "dry_run" });
    const a = (await call({ params: {}, mode: "execute", confirm_token: dry1.result.confirm_token })).result;
    // Racer X: blind pre-insert lookup, inserts its own row, but is paused before its DELETE (stubbed to a no-op).
    const paused = () => blindFirst((sql) => sql.startsWith("DELETE FROM invitation WHERE id = ?") ? { bind: () => ({ run: async () => ({}) }) } : undefined);
    const dryX = await call({ params: {}, mode: "dry_run" }, paused());
    const x = (await call({ params: {}, mode: "execute", confirm_token: dryX.result.confirm_token }, paused())).result;
    expect(x).toMatchObject({ link_id: a.link_id, reused: true });
    const xRows = await db.prepare("SELECT id FROM invitation WHERE assessment_survey_id = 'survey_tavo' AND status IN ('pending','accepted') AND id != ?").bind(a.link_id).all<{ id: string }>();
    expect(xRows.results.length).toBeGreaterThan(0); // X's own row is still live, newer than A
    // Third caller C lands now, with a normal (non-blind) lookup.
    const dryC = await call({ params: {}, mode: "dry_run" });
    expect(JSON.stringify(dryC.result)).toContain(a.link_id); // the dry run already names A as the link it reuses
    const c = (await call({ params: {}, mode: "execute", confirm_token: dryC.result.confirm_token })).result;
    expect(c).toMatchObject({ link_id: a.link_id, link_token: a.link_token, reused: true });
    // X resumes and deletes its own row; C's link must still exist.
    for (const r of xRows.results) await db.prepare("DELETE FROM invitation WHERE id = ?").bind(r.id).run();
    expect(await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(c.link_id).first<{ status: string }>()).toMatchObject({ status: "pending" });
  });
});
