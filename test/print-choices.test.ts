/**
 * Paper parity (captain 2026-09-29): cap.survey.print returns every question WITH its answer choices, in survey order,
 * for every pinned instrument — structured `items` for the app's printed form, and the choices in the HTML too.
 * Real D1 (Miniflare) with the repo migrations + synthetic seed.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "print", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "print" } }] }));
let db: D1Database, env: any, owner: string;
const aid = "assess_tavo_collect";
async function call(method: string, url: string, body?: unknown) {
  const r = await app.fetch(new Request("https://local.invalid" + url, { method, headers: { "content-type": "application/json", authorization: `Bearer ${owner}` }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { status: r.status, ...await r.json() as any };
}
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, SESSION_SECRET: "synthetic-print", ENVIRONMENT: "dev" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);

describe("printed survey carries the answer choices", () => {
  it("the synthetic seeded survey still prints (structured items alongside the HTML)", async () => {
    const r = await call("GET", `/v2/assessments/${aid}/surveys/survey_tavo/print`);
    expect(r.status).toBe(200);
    expect(r.result.blank).toBe(true);
    expect(r.result.items.length).toBeGreaterThan(0);
    for (const i of r.result.items) expect(typeof i.text).toBe("string");
  });
  it("every pinned v2 instrument (all 9 forms) keeps its choices when printed", async () => {
    const { results } = await db.prepare("SELECT id, version FROM survey_template WHERE version = 2").all<{ id: string; version: number }>();
    expect(results.length).toBeGreaterThanOrEqual(9);
    for (const t of results) {
      const sel = await call("POST", `/v2/assessments/${aid}/surveys`, { template_id: t.id, version: t.version });
      const sid = sel.result?.survey?.id ?? sel.result?.sid ?? sel.result?.id;
      expect(sid, `${t.id} selected (${sel.status} ${JSON.stringify(sel.error ?? {})})`).toBeTruthy();
      const p = await call("GET", `/v2/assessments/${aid}/surveys/${sid}/print`);
      expect(p.status, `${t.id} prints`).toBe(200);
      const choice = p.result.items.filter((i: any) => i.type === "single" || i.type === "multi");
      expect(choice.length, `${t.id}: has choice questions`).toBeGreaterThan(0);
      expect(choice.every((i: any) => Array.isArray(i.options) && i.options.length > 1), `${t.id}: every choice question has its options`).toBe(true);
      const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      for (const i of choice) for (const o of i.options) expect(p.result.html, `${t.id}: HTML lists "${o.text}"`).toContain(esc(o.text));
      expect(p.result.html).toMatch(/[○☐] /);
    }
  });
});
