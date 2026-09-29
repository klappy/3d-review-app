/**
 * Captain rulings 2026-09-28: participants may only switch to the project's / assessment's LWCs that the model supports,
 * and translations are stored deterministically in Cloudflare (D1 translation_memory, migration 0012).
 * Real D1 (Miniflare) with the repo's migrations + synthetic seed; the translation upstream is stubbed.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { handleTranslate, sha256Hex } from "../src/translate";
import { LWC_LANGUAGES, normalizeLwc, participantLanguages, parseLwc } from "../src/languages";
import * as ui from "../ui/v3/lwc.js";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "lwc", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "lwc" } }] }));
let db: D1Database, env: any, owner: string;
const aid = "assess_tavo_collect", linkPath = `/v2/assessments/${aid}/surveys/survey_tavo/links`;
async function call(method: string, url: string, body?: unknown, bearer?: string) {
  const r = await app.fetch(new Request("https://local.invalid" + url, { method, headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env);
  return { status: r.status, ...await r.json() as any };
}
async function participant() {
  const dry = await call("POST", linkPath, { params: {}, mode: "dry_run" }, owner);
  const link = (await call("POST", linkPath, { params: {}, mode: "execute", confirm_token: dry.result.confirm_token }, owner)).result;
  return (await call("POST", "/v2/participate/link", { token: link.link_token })).result.participant_token as string;
}
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql", "migrations/0012_translation.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, SESSION_SECRET: "synthetic-lwc", ENVIRONMENT: "dev", TRANSLATE_UPSTREAM_URL: "https://upstream.invalid/t" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);

describe("supported LWC table", () => {
  it("browser mirror is identical", () => { expect(JSON.parse(JSON.stringify(ui.LWC_LANGUAGES))).toEqual(JSON.parse(JSON.stringify(LWC_LANGUAGES))); });
  it("normalizes tags and names, refuses unsupported, dedups, caps", () => {
    expect(normalizeLwc(["lo", "Thai", "LO"])).toEqual({ codes: ["lo", "th"] });
    expect(normalizeLwc("lo,th")).toEqual({ codes: ["lo", "th"] });
    expect(normalizeLwc(null)).toEqual({ codes: [] });
    expect("error" in normalizeLwc(["xx"])).toBe(true);
    expect("error" in normalizeLwc(LWC_LANGUAGES.map((l) => l.code))).toBe(true);
    expect(parseLwc('["lo","nope","th"]')).toEqual(["lo", "th"]);
    expect(participantLanguages('["th"]', '["lo","th"]').map((l) => l.code)).toEqual(["th", "lo"]);
  });
  it("BCS LWCs (captain 2026-09-29): Telugu, Kannada, Odia, Hindi, Indian Sign Language are accepted; the sign language is recorded but never offered for machine translation", async () => {
    expect(normalizeLwc(["Telugu", "Kannada", "Odia", "Hindi", "Indian Sign Language"])).toEqual({ codes: ["te", "kn", "or", "hi", "ins"] });
    expect(participantLanguages('["te","kn","or","hi","ins"]', "[]").map((l) => l.code)).toEqual(["te", "kn", "or", "hi"]);
    const res = await handleTranslate(new Request("https://local.invalid/v2/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetLang: "ins", context: "participant-ui", sourceTexts: { a: "Start" } }) }), env);
    expect(res.status).toBe(400);
  });
});

describe("LWCs on the assessment and project → participant languages", () => {
  it("owner sets assessment LWCs; unsupported refused; the value reads back", async () => {
    const bad = await call("PATCH", `/v2/assessments/${aid}`, { lwc: ["xx"] }, owner);
    expect(bad.status).toBe(400);
    const ok = await call("PATCH", `/v2/assessments/${aid}`, { lwc: ["lo", "th"] }, owner);
    expect(ok.status).toBe(200);
    expect(ok.result.assessment.lwc).toEqual(["lo", "th"]);
    const got = await call("GET", `/v2/assessments/${aid}`, undefined, owner);
    expect(got.result.assessment.lwc).toEqual(["lo", "th"]);
    expect(got.result.assessment.lwc_json).toBeUndefined();
  });
  it("lwc can ride with other fields in one PATCH", async () => {
    const r = await call("PATCH", `/v2/assessments/${aid}`, { purpose: "Genesis 1-3", lwc: "th,lo" }, owner);
    expect(r.status).toBe(200);
    expect(r.result.assessment.purpose).toBe("Genesis 1-3");
    expect(r.result.assessment.lwc).toEqual(["th", "lo"]);
  });
  it("project LWCs join the assessment's; the participant form lists only those, English implied", async () => {
    const a = await call("GET", `/v2/assessments/${aid}`, undefined, owner);
    const p = await call("PATCH", `/v2/projects/${a.result.assessment.project_id}`, { lwc: ["hi", "th"] }, owner);
    expect([200, 403, 404]).toContain(p.status);
    const token = await participant();
    const form = await call("GET", "/v2/participate/form", undefined, token);
    expect(form.status).toBe(200);
    const codes = form.result.languages.map((l: any) => l.code);
    expect(codes.slice(0, 2)).toEqual(["th", "lo"]);
    if (p.status === 200) expect(codes).toContain("hi");
    expect(form.result.languages[0]).toMatchObject({ code: "th", name: "Thai", endonym: "ไทย", dir: "ltr" });
    expect(codes).not.toContain("en");
  });
});

describe("translation memory (D1)", () => {
  function upstream(answer: (en: string) => string) {
    const calls: any[] = [];
    const fetch = (async (_u: string, init: RequestInit) => { const b = JSON.parse(String(init.body)); calls.push(b); return new Response(JSON.stringify({ translated: Object.fromEntries(Object.entries(b.sourceTexts as Record<string, string>).map(([k, v]) => [k, answer(v)])) }), { headers: { "content-type": "application/json" } }); }) as unknown as typeof globalThis.fetch;
    return { fetch, calls };
  }
  const req = (sourceTexts: Record<string, string>, targetLang = "lo") => new Request("https://local.invalid/v2/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetLang, context: "participant-ui", sourceTexts }) });

  it("translates once, stores, then serves from storage without calling the model again", async () => {
    const up1 = upstream((en) => `ລາວ-1 ${en}`);
    const r1 = await (await handleTranslate(req({ a: "Start", b: "Next" }), env, { fetch: up1.fetch })).json() as any;
    expect(r1).toMatchObject({ translated: { a: "ລາວ-1 Start", b: "ລາວ-1 Next" }, partial: false, stored: 0, locale: "lo" });
    const up2 = upstream((en) => `ລາວ-2 ${en}`); // a different (non-deterministic) model answer must never replace storage
    const r2 = await (await handleTranslate(req({ a: "Start", b: "Next" }), env, { fetch: up2.fetch })).json() as any;
    expect(r2).toMatchObject({ translated: { a: "ລາວ-1 Start", b: "ລາວ-1 Next" }, stored: 2 });
    expect(up2.calls).toHaveLength(0);
    const row = await db.prepare("SELECT source_text, text, status, provider FROM translation_memory WHERE locale = 'lo' AND source_hash = ?").bind(await sha256Hex("Start")).first<any>();
    expect(row).toEqual({ source_text: "Start", text: "ລາວ-1 Start", status: "machine", provider: "translate-survey" });
  });
  it("only strings the memory lacks go upstream", async () => {
    const up = upstream((en) => `ລາວ ${en}`);
    const r = await (await handleTranslate(req({ a: "Start", c: "Back" }), env, { fetch: up.fetch })).json() as any;
    expect(up.calls).toHaveLength(1);
    expect(Object.values(up.calls[0].sourceTexts)).toEqual(["Back"]);
    expect(r.translated).toEqual({ a: "ລາວ-1 Start", c: "ລາວ Back" });
  });
  it("wrong-script output is not stored; a rejected row is not served and is replaced", async () => {
    const latin = upstream((en) => en);
    await handleTranslate(req({ x: "Learn more" }), env, { fetch: latin.fetch });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM translation_memory WHERE source_text = 'Learn more'").first<any>()).toEqual({ n: 0 });
    await db.prepare("UPDATE translation_memory SET status = 'rejected' WHERE locale = 'lo' AND source_text = 'Back'").run();
    const fix = upstream(() => "ກັບຄືນ");
    const r = await (await handleTranslate(req({ c: "Back" }), env, { fetch: fix.fetch })).json() as any;
    expect(r.translated.c).toBe("ກັບຄືນ");
    expect(await db.prepare("SELECT text, status FROM translation_memory WHERE locale = 'lo' AND source_text = 'Back'").first<any>()).toEqual({ text: "ກັບຄືນ", status: "machine" });
  });
  it("memory is per language", async () => {
    const th = upstream(() => "เริ่ม");
    const r = await (await handleTranslate(req({ a: "Start" }, "th"), env, { fetch: th.fetch })).json() as any;
    expect(r.translated.a).toBe("เริ่ม");
    expect(th.calls).toHaveLength(1);
  });
  it("nothing about participants is stored: only English source strings and their translations", async () => {
    const cols = (await db.prepare("SELECT name FROM pragma_table_info('translation_memory')").all<any>()).results.map((r: any) => r.name);
    expect(cols).toEqual(["locale", "source_hash", "source_text", "text", "status", "provider", "created_at", "reviewed_by", "reviewed_at"]);
  });
});
