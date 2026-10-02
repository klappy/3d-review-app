/**
 * Passage files and links (captain 2026-09-29; Lovable parity). Real D1 + R2 (Miniflare), repo migrations + seed.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { extOf, linkOf, signedHref } from "../src/passages";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "passages", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "passages" }, r2Buckets: ["PASSAGES"] }] }));
let db: D1Database, bucket: R2Bucket, env: any, owner: string;
const aid = "assess_tavo_collect", base = `/v2/assessments/${aid}/passages`;
async function raw(method: string, url: string, init: { body?: BodyInit; type?: string; bearer?: string | null; headers?: Record<string, string>; e?: any } = {}) {
  const headers: Record<string, string> = { ...(init.type ? { "content-type": init.type } : {}), ...(init.bearer === null ? {} : { authorization: `Bearer ${init.bearer ?? owner}` }), ...(init.headers ?? {}) };
  return app.fetch(new Request("https://local.invalid" + url, { method, headers, body: init.body }), init.e ?? env);
}
const json = async (r: Response) => ({ status: r.status, ...(await r.json() as any) });
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 10, ...Array(200).fill(7)]);
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");
const USFM = new TextEncoder().encode("\\id MRK\n\\c 4\n\\v 1 Again Jesus began to teach by the lake.");
async function participantToken() {
  const path = `/v2/assessments/${aid}/surveys/survey_tavo/links`;
  const dry = await json(await raw("POST", path, { type: "application/json", body: JSON.stringify({ params: {}, mode: "dry_run" }) }));
  const link = (await json(await raw("POST", path, { type: "application/json", body: JSON.stringify({ params: {}, mode: "execute", confirm_token: dry.result.confirm_token }) }))).result;
  return (await json(await raw("POST", "/v2/participate/link", { type: "application/json", bearer: null, body: JSON.stringify({ token: link.link_token }) }))).result.participant_token as string;
}
beforeAll(async () => {
  db = await mf.getD1Database("DB"); bucket = await mf.getR2Bucket("PASSAGES") as unknown as R2Bucket;
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql", "migrations/0012_translation.sql", "migrations/0013_passages.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, PASSAGES: bucket, SESSION_SECRET: "synthetic-passages", ENVIRONMENT: "dev" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);

describe("helpers", () => {
  it("extensions and links", () => {
    expect(extOf("Mark 4.USFM")).toBe("usfm");
    expect(linkOf("https://www.youtube.com/watch?v=abc")).toMatchObject({ media: "video" });
    expect(linkOf("https://youtu.be/abc")).toMatchObject({ media: "video" });
    expect(linkOf("https://example.org/p.pdf")).toMatchObject({ media: "link" });
    expect(linkOf("http://example.org")).toBeNull();
    expect(linkOf("javascript:alert(1)")).toBeNull();
    expect(linkOf("https://user:pw@example.org")).toBeNull();
  });
});

describe("facilitator adds passages", () => {
  it("adds a sign-language video link", async () => {
    const r = await json(await raw("POST", base, { type: "application/json", body: JSON.stringify({ url: "https://youtu.be/xyz", title: "Mark 4 in ISL", reference: "Mark 4:1-20" }) }));
    expect(r.status).toBe(201);
    expect(r.result.passage).toMatchObject({ kind: "link", media: "video", title: "Mark 4 in ISL", reference: "Mark 4:1-20", href: "https://youtu.be/xyz" });
  });
  it("refuses a non-https link", async () => {
    expect((await raw("POST", base, { type: "application/json", body: JSON.stringify({ url: "http://x.org" }) })).status).toBe(400);
  });
  it("uploads MP3, PDF and USFM; refuses the wrong content, unknown types and empty files", async () => {
    for (const [name, body, media] of [["Mark 4.mp3", MP3, "audio"], ["Mark 4.pdf", PDF, "pdf"], ["MRK.usfm", USFM, "text"]] as const) {
      const r = await json(await raw("POST", `${base}?name=${encodeURIComponent(name)}&reference=Mark%204`, { type: "application/octet-stream", body }));
      expect(r.status, name).toBe(201);
      expect(r.result.passage).toMatchObject({ kind: "file", media, filename: name, reference: "Mark 4" });
      expect(r.result.passage.href).toMatch(/^\/v2\/passages\/passage_[^/]+\/file\?exp=\d+&sig=/);
      expect(r.result.passage.object_key).toBeUndefined();
    }
    expect((await raw("POST", `${base}?name=fake.usfm`, { type: "application/octet-stream", body: PDF })).status).toBe(400);
    expect((await raw("POST", `${base}?name=virus.exe`, { type: "application/octet-stream", body: MP3 })).status).toBe(400);
    expect((await raw("POST", `${base}?name=empty.mp3`, { type: "application/octet-stream", body: new Uint8Array() })).status).toBe(400);
  });
  it("anonymous callers cannot list or add", async () => {
    expect((await raw("GET", base, { bearer: null })).status).toBe(401);
    expect((await raw("POST", base, { bearer: null, type: "application/json", body: "{}" })).status).toBe(401);
  });
});

describe("participants open the passage", () => {
  it("the survey form lists the passages with signed links; the file serves inline with Range support", async () => {
    const token = await participantToken();
    const form = await json(await raw("GET", "/v2/participate/form", { bearer: token }));
    expect(form.status).toBe(200);
    const p = form.result.passages;
    expect(p.map((x: any) => x.media)).toEqual(["video", "audio", "pdf", "text"]);
    const audio = p.find((x: any) => x.media === "audio");
    const full = await raw("GET", audio.href, { bearer: null });
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("audio/mpeg");
    expect(full.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await full.arrayBuffer()).length).toBe(MP3.length);
    const part = await raw("GET", audio.href, { bearer: null, headers: { range: "bytes=0-9" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-9/${MP3.length}`);
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(MP3.subarray(0, 10));
    const text = p.find((x: any) => x.media === "text");
    const t = await raw("GET", text.href, { bearer: null });
    expect(t.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(t.headers.get("content-security-policy")).toContain("sandbox");
    expect(await t.text()).toContain("\\v 1 Again Jesus");
  });
  it("a tampered or expired link is refused", async () => {
    const list = await json(await raw("GET", base));
    const f = list.result.passages.find((x: any) => x.kind === "file");
    expect((await raw("GET", f.href.replace(/sig=.{4}/, "sig=AAAA"), { bearer: null })).status).toBe(403);
    const old = await signedHref(env, f.id, 60, Date.now() - 3600_000);
    expect((await raw("GET", old, { bearer: null })).status).toBe(403);
  });
});

describe("removing and degraded setups", () => {
  it("remove archives the row, deletes the stored file, and the link stops working", async () => {
    const list = await json(await raw("GET", base));
    const f = list.result.passages.find((x: any) => x.media === "pdf");
    expect((await raw("DELETE", `${base}/${f.id}`)).status).toBe(200);
    expect((await raw("GET", f.href, { bearer: null })).status).toBe(404);
    const after = await json(await raw("GET", base));
    expect(after.result.passages.some((x: any) => x.id === f.id)).toBe(false);
    expect(await bucket.list({ prefix: `assessments/${aid}/${f.id}` }).then((r) => r.objects.length)).toBe(0);
  });
  it("without the R2 binding: uploads answer 503, links still work", async () => {
    const e = { ...env, PASSAGES: undefined };
    expect((await raw("POST", `${base}?name=a.mp3`, { type: "application/octet-stream", body: MP3, e })).status).toBe(503);
    expect((await raw("POST", base, { type: "application/json", body: JSON.stringify({ url: "https://example.org/mark4" }), e })).status).toBe(201);
    expect((await json(await raw("GET", base, { e }))).result.file_storage).toBe(false);
  });
});

// BCS demo 2026-09-29 (bee:10809312 u3540382372-388): a passage can be named with nothing attached; the survey and the
// printed form then say "read or listen to Genesis 1 first". Cookbook ticket work/active/2026-09-29-3d-passage-instructions.
describe("a passage named with nothing attached", () => {
  it("adds a reference-only passage; refuses one with neither a name nor a link", async () => {
    const r = await json(await raw("POST", base, { type: "application/json", body: JSON.stringify({ reference: "  Genesis   1 " }) }));
    expect(r.status).toBe(201);
    expect(r.result.passage).toMatchObject({ kind: "reference", media: "reference", title: "Genesis 1", reference: "Genesis 1", href: null, filename: null, size: null });
    for (const body of [{}, { reference: "" }, { reference: "   ", title: "x" }]) {
      const bad = await json(await raw("POST", base, { type: "application/json", body: JSON.stringify(body) }));
      expect(bad.status).toBe(400); expect(bad.error.message).toMatch(/name the passage/);
    }
  });
  it("participants see it named (no link); the file route never serves it; remove archives it", async () => {
    const token = await participantToken();
    const form = await json(await raw("GET", "/v2/participate/form", { bearer: token }));
    const ref = form.result.passages.find((x: any) => x.kind === "reference");
    expect(ref).toMatchObject({ reference: "Genesis 1", href: null });
    expect(JSON.stringify(ref)).not.toMatch(/object_key|assessments\//);
    const fake = await signedHref(env, ref.id, 60);
    expect((await raw("GET", fake, { bearer: null })).status).toBe(404);
    expect((await json(await raw("DELETE", `${base}/${ref.id}`))).status).toBe(200);
    const after = await json(await raw("GET", "/v2/participate/form", { bearer: token }));
    expect(after.result.passages.some((x: any) => x.kind === "reference")).toBe(false);
  });
});

// S56 (cookbook ASK-2026-10-01-passage-receipts, option 1): add and remove leave one audit receipt each.
describe("passage receipts", () => {
  type R = { id: string; actor: string; capability: string; scope_type: string; scope_id: string; class: string; inverse: string; trace_id: string; prior_state_json: string };
  const receiptsFor = async (pid: string) => (await db.prepare("SELECT * FROM receipt WHERE capability IN ('cap.passage.add', 'cap.passage.remove') ORDER BY at, id").all<R>()).results.filter((r) => JSON.parse(r.prior_state_json).passage_id === pid);
  const passageReceiptCount = async () => Number((await db.prepare("SELECT COUNT(*) AS n FROM receipt WHERE capability IN ('cap.passage.add', 'cap.passage.remove')").first<{ n: number }>())?.n ?? 0);
  const expectReceipt = (r: R, capability: string, pid: string, kind: string, media: string) => {
    expect(r).toMatchObject({ actor: "person_mara", capability, scope_type: "assessment", scope_id: aid, class: "audit", inverse: "none" });
    expect(r.trace_id).toMatch(/^tr/);
    const detail = JSON.parse(r.prior_state_json);
    expect(Object.keys(detail).sort()).toEqual(["kind", "media", "passage_id"]);
    expect(detail).toEqual({ passage_id: pid, kind, media });
  };
  it("adding a link, a reference or a file leaves one cap.passage.add receipt with ids, kind and media only", async () => {
    for (const [req, kind, media] of [
      [{ type: "application/json", body: JSON.stringify({ url: "https://example.org/secret-title-page", title: "Private title" }) }, "link", "link"],
      [{ type: "application/json", body: JSON.stringify({ reference: "Luke 15" }) }, "reference", "reference"],
      [{ type: "application/octet-stream", body: MP3, q: "?name=Luke%2015.mp3&title=Private%20title" }, "file", "audio"],
    ] as const) {
      const before = await passageReceiptCount();
      const r = await json(await raw("POST", base + ((req as any).q ?? ""), { type: req.type, body: req.body }));
      expect(r.status, kind).toBe(201);
      const pid = r.result.passage.id as string;
      expect(await passageReceiptCount()).toBe(before + 1);
      const rows = await receiptsFor(pid);
      expect(rows).toHaveLength(1);
      expectReceipt(rows[0], "cap.passage.add", pid, kind, media);
      expect(rows[0].prior_state_json).not.toMatch(/Private title|example\.org|Luke 15\.mp3/);
    }
  });
  it("removing leaves one cap.passage.remove receipt, with its own trace id", async () => {
    const add = await json(await raw("POST", base, { type: "application/json", body: JSON.stringify({ url: "https://youtu.be/receipt" }) }));
    const pid = add.result.passage.id as string;
    expect((await raw("DELETE", `${base}/${pid}`)).status).toBe(200);
    const rows = await receiptsFor(pid);
    expect(rows.map((x) => x.capability)).toEqual(["cap.passage.add", "cap.passage.remove"]);
    expectReceipt(rows[1], "cap.passage.remove", pid, "link", "video");
    expect(rows[1].trace_id).not.toBe(rows[0].trace_id);
    // A refused remove (already archived) writes nothing more.
    expect((await raw("DELETE", `${base}/${pid}`)).status).toBe(404);
    expect(await receiptsFor(pid)).toHaveLength(2);
  });
  it("a failed insert writes no receipt", async () => {
    const failingDb = new Proxy(db, { get(t, k) {
      if (k === "prepare") return (sql: string) => sql.startsWith("INSERT INTO assessment_passage") ? { bind: () => ({ run: async () => { throw new Error("D1 insert failed"); } }) } : t.prepare(sql);
      const v = (t as any)[k]; return typeof v === "function" ? v.bind(t) : v;
    } });
    const before = await passageReceiptCount();
    const r = await raw("POST", base, { type: "application/json", body: JSON.stringify({ url: "https://example.org/fails" }), e: { ...env, DB: failingDb } });
    expect(r.status).toBeGreaterThanOrEqual(500);
    expect(await passageReceiptCount()).toBe(before);
  });
});
