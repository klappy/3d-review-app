/**
 * Audit round 1 (train 22 security review) — server fixes, falsified against real D1 + R2 (Miniflare), repo migrations
 * and seed, with counting fake limiters (the pattern of test/limiter-boundary.test.ts):
 *   W2  a workshop room behind one NAT is not throttled by RL_HTTP_ANON when it presents valid participant bearers
 *       (/v2/translate) or valid signed links (passage files); anonymous / invalid callers still are.
 *   W3  an assessment that has (or had) passages can be deleted; the dry run counts them; rows and files are removed.
 *   E3  a passage add whose JSON body is not an object (null, [], 5) is a 400, not a 500.
 *   E4  an upstream "translation" that echoes an English sentence (3+ words) is neither served nor stored (Latin-script
 *       targets); one- and two-word sources spelled the same in the target (fr "phrases", "Question") are stored.
 *   +   undo of a translation-language change restores the prior languages (languages-only and combined edits).
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { handleTranslate, sha256Hex } from "../src/translate";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "audit1", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "audit1" }, r2Buckets: ["PASSAGES"] }] }));
let db: D1Database, bucket: R2Bucket, env: any, owner: string;
const aid = "assess_tavo_collect", ROOM_IP = "198.51.100.23";
/** Counting fake limiter: success while the key has spent ≤ limit units. */
const limiter = (limit: number) => { const seen = new Map<string, number>(); return { seen, limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= limit }; } }; };
const limited = () => ({ ...env, RL_HTTP_ANON: limiter(60), RL_MCP_CEILING: limiter(600) });
async function call(method: string, url: string, body?: unknown, bearer: string | null = owner, e: any = env, headers: Record<string, string> = {}) {
  const r = await app.fetch(new Request("https://local.invalid" + url, { method, headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" || body instanceof Uint8Array ? body as BodyInit : JSON.stringify(body) }), e);
  return { status: r.status, ...(await r.json() as any) };
}
async function participant() {
  const path = `/v2/assessments/${aid}/surveys/survey_tavo/links`;
  const dry = await call("POST", path, { params: {}, mode: "dry_run" });
  const link = (await call("POST", path, { params: {}, mode: "execute", confirm_token: dry.result.confirm_token })).result;
  return (await call("POST", "/v2/participate/link", { token: link.link_token }, null)).result.participant_token as string;
}
function upstream(answer: (en: string) => string) {
  const calls: any[] = [];
  const fetch = (async (_u: string, init: RequestInit) => { const b = JSON.parse(String(init.body)); calls.push(b); return new Response(JSON.stringify({ translated: Object.fromEntries(Object.entries(b.sourceTexts as Record<string, string>).map(([k, v]) => [k, answer(v)])) }), { headers: { "content-type": "application/json" } }); }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const translateReq = (sourceTexts: Record<string, string>, targetLang: string, headers: Record<string, string> = {}) => new Request("https://local.invalid/v2/translate", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ROOM_IP, ...headers }, body: JSON.stringify({ targetLang, context: "participant-ui", sourceTexts }) });

beforeAll(async () => {
  db = await mf.getD1Database("DB"); bucket = await mf.getR2Bucket("PASSAGES") as unknown as R2Bucket;
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql", "migrations/0012_translation.sql", "migrations/0013_passages.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, PASSAGES: bucket, SESSION_SECRET: "synthetic-audit1", ENVIRONMENT: "dev", TRANSLATE_UPSTREAM_URL: "https://upstream.invalid/t" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);

describe("W2 — a room behind one address is not throttled by the anonymous limit", () => {
  it("/v2/translate: 80 chunk requests with valid participant bearers pass; anonymous callers on the same address stop at 60", async () => {
    const e = limited(), up = upstream((en) => `ລາວ ${en}`);
    const tokens = [await participant(), await participant()];
    for (let i = 0; i < 80; i++) {
      const r = await handleTranslate(translateReq({ a: "Start", b: "Next" }, "lo", { authorization: `Bearer ${tokens[i % 2]}` }), e, { fetch: up.fetch });
      expect(r.status, `participant request ${i + 1}`).toBe(200);
    }
    expect(e.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0); // the address bucket was never touched
    expect([...e.RL_MCP_CEILING.seen.keys()].every((k) => k.startsWith("tr:participant:"))).toBe(true);
    expect(up.calls.length).toBe(1); // stored once, served from memory after that
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) statuses.push((await handleTranslate(translateReq({ a: "Start" }, "lo"), e, { fetch: up.fetch })).status);
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
  it("/v2/translate: an unknown or revoked-shaped bearer is anonymous and spends the address bucket", async () => {
    const e = limited(), up = upstream((en) => `ລາວ ${en}`);
    const bogus = `pt_${"0".repeat(32)}`;
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) statuses.push((await handleTranslate(translateReq({ a: "Start" }, "lo", { authorization: `Bearer ${bogus}` }), e, { fetch: up.fetch })).status);
    expect(statuses[59]).toBe(200);
    expect(statuses[60]).toBe(429);
    expect(e.RL_MCP_CEILING.seen.size).toBe(0);
  });
  it("/v2/translate: a participant still has its own ceiling (RL_MCP_CEILING, keyed per principal)", async () => {
    const e = { ...env, RL_HTTP_ANON: limiter(60), RL_MCP_CEILING: limiter(2) }, up = upstream((en) => `ລາວ ${en}`);
    const token = await participant();
    const s = [];
    for (let i = 0; i < 3; i++) s.push((await handleTranslate(translateReq({ a: "Start" }, "lo", { authorization: `Bearer ${token}` }), e, { fetch: up.fetch })).status);
    expect(s).toEqual([200, 200, 429]);
  });
  it("passage file: 80 requests with a valid signature pass; tampered links spend the address bucket and stop at 60", async () => {
    const add = await call("POST", `/v2/assessments/${aid}/passages?name=Mark%204.mp3`, new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 10, ...Array(64).fill(7)]), owner, env, { "content-type": "application/octet-stream" });
    expect(add.status).toBe(201);
    const href: string = add.result.passage.href;
    const e = limited();
    for (let i = 0; i < 80; i++) {
      const r = await app.fetch(new Request("https://local.invalid" + href, { headers: { "cf-connecting-ip": ROOM_IP, range: "bytes=0-9" } }), e);
      expect(r.status, `valid request ${i + 1}`).toBe(206);
      await r.arrayBuffer();
    }
    expect(e.RL_HTTP_ANON.seen.get(`ip:${ROOM_IP}`) ?? 0).toBe(0);
    const bad = href.replace(/sig=.{4}/, "sig=AAAA"), statuses: number[] = [];
    for (let i = 0; i < 61; i++) { const r = await app.fetch(new Request("https://local.invalid" + bad, { headers: { "cf-connecting-ip": ROOM_IP } }), e); statuses.push(r.status); await r.arrayBuffer(); }
    expect(statuses.slice(0, 60).every((s) => s === 403)).toBe(true);
    expect(statuses[60]).toBe(429);
    await call("DELETE", `/v2/assessments/${aid}/passages/${add.result.passage.id}`);
  });
});

describe("W3 — an assessment with passages can be deleted", () => {
  async function fresh(name: string) {
    const r = await call("POST", "/v2/projects/proj_rill/assessments", { name, language_id: "lang_tavo" });
    expect(r.status).toBe(200);
    return r.result.assessment.id as string;
  }
  async function del(id: string) {
    const dry = await call("DELETE", `/v2/assessments/${id}`, { mode: "dry_run" });
    const done = await call("DELETE", `/v2/assessments/${id}`, { mode: "execute", confirm_token: dry.result.confirm_token });
    return { dry: dry.result, done };
  }
  const rows = async (id: string) => (await db.prepare("SELECT COUNT(*) AS n FROM assessment_passage WHERE assessment_id = ?").bind(id).first<{ n: number }>())!.n;
  it("after add + remove: the dry run says 0 passages, the execute succeeds and the removed row is gone", async () => {
    const id = await fresh("W3 removed passage");
    const p = await call("POST", `/v2/assessments/${id}/passages`, { reference: "Genesis 1" });
    expect(p.status).toBe(201);
    expect((await call("DELETE", `/v2/assessments/${id}/passages/${p.result.passage.id}`)).status).toBe(200);
    const { dry, done } = await del(id);
    expect(dry.impact.affected[0]).toMatchObject({ assessment: id, surveys: 0, responses: 0, passages: 0 });
    expect(done.status).toBe(200);
    expect(done.result).toMatchObject({ deleted: true, id });
    expect(await rows(id)).toBe(0);
    expect(await db.prepare("SELECT id FROM assessment WHERE id = ?").bind(id).first()).toBeNull();
  });
  it("with active passages (a file, a link): the dry run counts them; the execute removes the rows and the stored file", async () => {
    const id = await fresh("W3 active passages");
    const file = await call("POST", `/v2/assessments/${id}/passages?name=MRK.usfm`, "\\id MRK\n\\c 4\n\\v 1 Again.", owner, env, { "content-type": "application/octet-stream" });
    expect(file.status).toBe(201);
    expect((await call("POST", `/v2/assessments/${id}/passages`, { url: "https://youtu.be/xyz" })).status).toBe(201);
    expect((await bucket.list({ prefix: `assessments/${id}/` })).objects.length).toBe(1);
    const { dry, done } = await del(id);
    expect(dry.impact.affected[0]).toMatchObject({ surveys: 0, responses: 0, passages: 2 });
    expect(done.status).toBe(200);
    expect(await rows(id)).toBe(0);
    expect((await bucket.list({ prefix: `assessments/${id}/` })).objects.length).toBe(0);
    expect((await app.fetch(new Request("https://local.invalid" + file.result.passage.href), env)).status).toBe(404);
  });
  it("a file uploaded after the rows were read loses its stored object too (the prefix is listed, not only the rows read)", async () => {
    const id = await fresh("W3 late upload");
    const file = await call("POST", `/v2/assessments/${id}/passages?name=MRK.usfm`, "\\id MRK\n\\c 4\n\\v 1 Again.", owner, env, { "content-type": "application/octet-stream" });
    expect(file.status).toBe(201);
    const dry = await call("DELETE", `/v2/assessments/${id}`, { mode: "dry_run" });
    // the race: rows are read, then another upload lands its object (and a row the batch deletes) before the batch runs
    const late = `assessments/${id}/pas_late.usfm`, reads = { n: 0 };
    const racing = { ...env, DB: new Proxy(db, { get(t: any, prop) {
      if (prop !== "prepare") return typeof t[prop] === "function" ? t[prop].bind(t) : t[prop];
      return (sql: string) => { const st = t.prepare(sql); if (/SELECT object_key, archived_at FROM assessment_passage/.test(sql)) { reads.n++; return { bind: (...a: unknown[]) => { const b = st.bind(...a); return { all: async () => { const r = await b.all(); await bucket.put(late, "late"); return r; } }; } }; } return st; };
    } }) };
    const done = await call("DELETE", `/v2/assessments/${id}`, { mode: "execute", confirm_token: dry.result.confirm_token }, owner, racing);
    expect(done.status).toBe(200);
    expect(reads.n).toBeGreaterThan(0);
    expect(await bucket.head(late)).toBeNull();
    expect((await bucket.list({ prefix: `assessments/${id}/` })).objects.length).toBe(0);
  });
  it("D5 still holds: an assessment with surveys is refused and its passages stay", async () => {
    const p = await call("POST", `/v2/assessments/${aid}/passages`, { reference: "Mark 4" });
    const { dry, done } = await del(aid);
    expect(dry.impact.affected[0].surveys).toBeGreaterThan(0);
    expect(done.status).toBe(400);
    expect(await db.prepare("SELECT id FROM assessment_passage WHERE id = ?").bind(p.result.passage.id).first()).not.toBeNull();
    await call("DELETE", `/v2/assessments/${aid}/passages/${p.result.passage.id}`);
  });
});

describe("E3 — a passage add whose JSON body is not an object", () => {
  it("null, [] and 5 → 400 INVALID_PARAMS (was a 500 TypeError for null)", async () => {
    for (const body of ["null", "[]", "5", '"x"']) {
      const r = await call("POST", `/v2/assessments/${aid}/passages`, body);
      expect(r.status, body).toBe(400);
      expect(r.error.code).toBe("INVALID_PARAMS");
    }
  });
});

describe("E4 — an echoed English sentence is neither served nor stored", () => {
  const frRows = async (...texts: string[]) => (await db.prepare(`SELECT COUNT(*) AS n FROM translation_memory WHERE locale = 'fr' AND source_hash IN (${texts.map(() => "?").join(",")})`).bind(...await Promise.all(texts.map(sha256Hex))).first<{ n: number }>())!.n;
  it("French (Latin script): an echoed 3+ word sentence is refused and not stored; the next real translation is stored", async () => {
    const A = "We would like your perspective", B = "Review your answers"; // 5 and 3 words
    const echo = upstream((en) => ` ${en.toUpperCase()} `);
    const r = await handleTranslate(translateReq({ a: A, b: B }, "fr"), env, { fetch: echo.fetch });
    expect(r.status).toBe(502);
    expect(await frRows(A, B)).toBe(0);
    const mixed = upstream((en) => (en === B ? "Vérifier vos réponses" : en));
    const r2 = await (await handleTranslate(translateReq({ a: A, b: B }, "fr"), env, { fetch: mixed.fetch })).json() as any;
    expect(r2).toMatchObject({ translated: { b: "Vérifier vos réponses" }, partial: true });
    expect(r2.translated.a).toBeUndefined();
    expect(await frRows(A, B)).toBe(1);
    const real = upstream(() => "Nous aimerions connaître votre avis");
    const r3 = await (await handleTranslate(translateReq({ a: A, b: B }, "fr"), env, { fetch: real.fetch })).json() as any;
    expect(r3).toMatchObject({ translated: { a: "Nous aimerions connaître votre avis", b: "Vérifier vos réponses" }, partial: false });
    expect(Object.values(real.calls[0].sourceTexts)).toEqual([A]);
    expect(await frRows(A, B)).toBe(2);
  });
  it("French: one- and two-word sources spelled the same (\"phrases\", \"Question\") are stored and the response is not partial", async () => {
    const same = upstream((en) => en);
    const r = await handleTranslate(translateReq({ p: "phrases", q: "Question" }, "fr"), env, { fetch: same.fetch });
    expect(r.status).toBe(200); // was 502: a batch made only of such words came back empty
    expect(await r.json()).toMatchObject({ translated: { p: "phrases", q: "Question" }, partial: false });
    expect(await frRows("phrases", "Question")).toBe(2);
    const again = upstream(() => { throw new Error("memory should answer"); });
    const r2 = await (await handleTranslate(translateReq({ p: "phrases", q: "Question" }, "fr"), env, { fetch: again.fetch })).json() as any;
    expect(r2).toMatchObject({ translated: { p: "phrases", q: "Question" }, partial: false, stored: 2 });
    expect(again.calls).toHaveLength(0);
  });
  it("a source without letters (\"18–24\") that comes back unchanged is served and stored, as before", async () => {
    const same = upstream((en) => en);
    const req = new Request("https://local.invalid/v2/translate", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ROOM_IP }, body: JSON.stringify({ targetLang: "fr", context: "participant-form:tpl_validation", sourceTexts: { r: "18–24" } }) });
    const r = await handleTranslate(req, env, { fetch: same.fetch });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ translated: { r: "18–24" }, partial: false });
    expect(await frRows("18–24")).toBe(1);
  });
});

describe("undo of a translation-language change", () => {
  const undo = (token: string) => call("POST", `/v2/undo/${encodeURIComponent(token)}`, {});
  const lwcOf = async (table: "assessment" | "project", id: string) => JSON.parse((await db.prepare(`SELECT lwc_json FROM ${table} WHERE id = ?`).bind(id).first<{ lwc_json: string | null }>())!.lwc_json ?? "[]");
  it("assessment, languages only: undo restores the prior languages", async () => {
    await db.prepare("UPDATE assessment SET lwc_json = ? WHERE id = ?").bind('["lo","th"]', aid).run();
    const r = await call("PATCH", `/v2/assessments/${aid}`, { lwc: ["fr"] });
    expect(r.status).toBe(200);
    expect(await lwcOf("assessment", aid)).toEqual(["fr"]);
    const u = await undo(r.receipt.undo_token);
    expect(u.status).toBe(200);
    expect(await lwcOf("assessment", aid)).toEqual(["lo", "th"]);
  });
  it("assessment, purpose + languages: undo restores both; an empty prior list is restored as empty", async () => {
    await db.prepare("UPDATE assessment SET lwc_json = '[]', purpose = 'Before' WHERE id = ?").bind(aid).run();
    const r = await call("PATCH", `/v2/assessments/${aid}`, { purpose: "After", lwc: ["th"] });
    expect(r.status).toBe(200);
    const u = await undo(r.receipt.undo_token);
    expect(u.status).toBe(200);
    const row = await db.prepare("SELECT purpose FROM assessment WHERE id = ?").bind(aid).first<{ purpose: string }>();
    expect(row!.purpose).toBe("Before");
    expect(await lwcOf("assessment", aid)).toEqual([]);
  });
  it("project, languages only and name + languages: undo restores the prior languages", async () => {
    await db.prepare("UPDATE project SET lwc_json = ? WHERE id = 'proj_rill'").bind('["hi"]').run();
    const r = await call("PATCH", "/v2/projects/proj_rill", { lwc: ["th", "lo"] });
    expect(r.status).toBe(200);
    expect((await undo(r.receipt.undo_token)).status).toBe(200);
    expect(await lwcOf("project", "proj_rill")).toEqual(["hi"]);
    const r2 = await call("PATCH", "/v2/projects/proj_rill", { name: "Rill Renamed", lwc: ["fr"] });
    expect(r2.status).toBe(200);
    expect((await undo(r2.receipt.undo_token)).status).toBe(200);
    expect(await lwcOf("project", "proj_rill")).toEqual(["hi"]);
    expect((await db.prepare("SELECT name FROM project WHERE id = 'proj_rill'").first<{ name: string }>())!.name).toBe("Rill Project");
  });
  it("an edit that does not touch languages records no languages in its undo", async () => {
    await db.prepare("UPDATE assessment SET lwc_json = ? WHERE id = ?").bind('["lo"]', aid).run();
    const r = await call("PATCH", `/v2/assessments/${aid}`, { purpose: "Only purpose" });
    await db.prepare("UPDATE assessment SET lwc_json = ? WHERE id = ?").bind('["th"]', aid).run(); // changed elsewhere meanwhile
    expect((await undo(r.receipt.undo_token)).status).toBe(200);
    expect(await lwcOf("assessment", aid)).toEqual(["th"]);
  });
});
