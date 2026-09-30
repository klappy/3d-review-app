/**
 * Text passages open as a PDF made by PTXprint (captain 2026-09-30 12:08 ET: "Use PTXprintmcp server that i use for
 * converting the usfm/usx/sfm files to print/pdf."). Real D1 + R2 (Miniflare), repo migrations + seed, and a fake PTXprint
 * MCP server (streamable HTTP, SSE answers, like https://ptxprint.klappy.dev/mcp) in place of the network.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { bookOf, passagePayload, renderPassagePdf, sha256Hex } from "../src/ptxprint";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "passage-pdf", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "passage-pdf" }, r2Buckets: ["PASSAGES"] }] }));
let db: D1Database, bucket: R2Bucket, env: any, owner: string;
const aid = "assess_tavo_collect", base = `/v2/assessments/${aid}/passages`, MCP = "https://ptxprint.test/mcp", ORIGIN = "https://dev.test";
const USFM = new TextEncoder().encode("\\id MRK\n\\c 4\n\\p\n\\v 1 Again Jesus began to teach by the lake.");
const PDF = new TextEncoder().encode("%PDF-1.7\n" + "x".repeat(500) + "\n%%EOF");
async function raw(method: string, url: string, init: { body?: BodyInit; type?: string; bearer?: string | null; headers?: Record<string, string>; e?: any } = {}) {
  const headers: Record<string, string> = { ...(init.type ? { "content-type": init.type } : {}), ...(init.bearer === null ? {} : { authorization: `Bearer ${init.bearer ?? owner}` }), ...(init.headers ?? {}) };
  const u = url.startsWith("https://") ? url : "https://local.invalid" + url;
  return app.fetch(new Request(u, { method, headers, body: init.body }), init.e ?? env);
}
const json = async (r: Response) => ({ status: r.status, ...(await r.json() as any) });
const upload = (name: string, body: Uint8Array, e = env) => raw("POST", `${base}?name=${encodeURIComponent(name)}&reference=Mark%204`, { type: "application/octet-stream", body, e }).then(json);

/** A fake PTXprint MCP server. `mode` picks the outcome; `seen` records every call. */
function fakePtxprint(mode: "ok" | "failed" | "http500" | "notpdf") {
  const seen: { method: string; params?: any; session?: string | null }[] = [];
  let sourceFetch: Response | null = null;
  const sse = (id: number, result: unknown, extra: Record<string, string> = {}) => new Response(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id, result })}\n\n`, { headers: { "content-type": "text/event-stream", ...extra } });
  const tool = (id: number, obj: unknown) => sse(id, { content: [{ type: "text", text: JSON.stringify(obj) }] });
  let polls = 0;
  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://ptxprint.test/r2/outputs/job1/passage_Default_MRK_ptxp.pdf") return mode === "notpdf" ? new Response("<html>") : new Response(PDF, { headers: { "content-type": "application/pdf", "content-length": String(PDF.length) } });
    if (mode === "http500") return new Response("down", { status: 500 });
    const msg = JSON.parse(String(init?.body));
    const session = new Headers(init?.headers).get("mcp-session-id");
    seen.push({ method: msg.method === "tools/call" ? msg.params.name : msg.method, params: msg.params, session });
    if (msg.method === "initialize") return sse(msg.id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "ptxprint-mcp", version: "0.4.0" } }, { "mcp-session-id": "sess-1" });
    if (msg.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (msg.params.name === "submit_typeset") {
      // What the server's container does: fetch the source by URL (through the app's signed link) and check the sha256.
      const src = msg.params.arguments.payload.sources[0];
      sourceFetch = await raw("GET", src.url, { bearer: null });
      const bytes = new Uint8Array(await sourceFetch.clone().arrayBuffer());
      if ((await sha256Hex(bytes)) !== src.sha256) return tool(msg.id, { error: "sha256 mismatch" });
      return tool(msg.id, { job_id: "job1", predicted_pdf_url: "https://ptxprint.test/r2/outputs/job1/passage_Default_MRK_ptxp.pdf", cached: false });
    }
    if (msg.params.name === "get_job_status") {
      polls++;
      if (polls === 1) return tool(msg.id, { state: "running" });
      return mode === "failed" ? tool(msg.id, { state: "failed", human_summary: "PTXprint exited 1" }) : tool(msg.id, { state: "succeeded", pdf_url: "https://ptxprint.test/r2/outputs/job1/passage_Default_MRK_ptxp.pdf" });
    }
    return new Response("?", { status: 400 });
  };
  return { seen, handler, source: () => sourceFetch };
}
function stubFetch(fake: ReturnType<typeof fakePtxprint>) {
  const real = globalThis.fetch, calls: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://ptxprint.test")) { calls.push(url); return fake.handler(input, init); }
    return real(input, init);
  });
  return calls;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

beforeAll(async () => {
  db = await mf.getD1Database("DB"); bucket = await mf.getR2Bucket("PASSAGES") as unknown as R2Bucket;
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql", "migrations/0012_translation.sql", "migrations/0013_passages.sql", "migrations/0014_passage_pdf.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  env = { DB: db, PASSAGES: bucket, SESSION_SECRET: "synthetic-passage-pdf", ENVIRONMENT: "dev", PTXPRINT_MCP_URL: MCP, PUBLIC_ORIGIN: ORIGIN };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);

describe("helpers", () => {
  it("bookOf reads the \\id line; the payload names the book the Paratext way and marks every book present", () => {
    expect(bookOf("﻿\\id mrk - test\n\\c 4")).toBe("MRK");
    expect(bookOf("\\id TIT\n")).toBe("TIT");
    expect(bookOf("\\id XXA\n")).toBeNull();
    expect(bookOf("\\c 1 \\v 1 no id")).toBeNull();
    const p = passagePayload("TIT", "https://x.test/f?raw=1", "a".repeat(64), "Titus 2");
    expect(p).toMatchObject({ schema_version: "1.0", books: ["TIT"], sources: [{ book: "TIT", filename: "57TITtest.usfm", url: "https://x.test/f?raw=1" }] });
    expect(p.config_files["shared/ptxprint/Default/ptxprint.cfg"]).toMatch(/^booklist = TIT$/m);
    expect(p.config_files["shared/ptxprint/Default/ptxprint.cfg"]).toMatch(/^maintitle = Titus 2$/m);
    expect(p.config_files["Settings.xml"]).toContain(`<BooksPresent>${"1".repeat(66)}`);
    expect(passagePayload("MAT", "https://x.test/f", "a".repeat(64), "t").sources[0].filename).toBe("41MATtest.usfm");
  });
  it("renderPassagePdf: a slow server times out, a big PDF is refused, never a throw", async () => {
    const hang: typeof fetch = (_i, init) => new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
    expect(await renderPassagePdf({ mcpUrl: MCP, sourceUrl: "https://x.test/f", sha256: "a".repeat(64), book: "MRK", title: "t", fetchImpl: hang, timeoutMs: 100 })).toEqual({ ok: false, reason: "timeout" });
    const fake = fakePtxprint("ok");
    const small = await renderPassagePdf({ mcpUrl: MCP, sourceUrl: "https://x.test/f", sha256: "a".repeat(64), book: "MRK", title: "t", fetchImpl: async (i, init) => {
      const u = String(i); if (u.includes("/r2/")) return new Response(PDF, { headers: { "content-length": String(PDF.length) } });
      const m = JSON.parse(String(init?.body)); if (m.params?.name === "submit_typeset") return new Response(`data: ${JSON.stringify({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: JSON.stringify({ job_id: "j", predicted_pdf_url: "https://ptxprint.test/r2/x.pdf", cached: true }) }] } })}\n`, { headers: { "content-type": "text/event-stream" } });
      return fake.handler(i, init);
    }, maxPdfBytes: 100 });
    expect(small).toEqual({ ok: false, reason: "pdf too large" });
  });
});

describe("a facilitator uploads a USFM passage", () => {
  it("PTXprint makes a PDF: stored beside the original, pdf_key on the row, the link opens the PDF, ?raw=1 the text", async () => {
    const fake = fakePtxprint("ok"), calls = stubFetch(fake);
    const r = await upload("Mark 4.usfm", USFM);
    expect(r.status).toBe(201);
    expect(r.result.passage).toMatchObject({ media: "text", filename: "Mark 4.usfm", pdf: true });
    expect(fake.seen.map((s) => s.method)).toEqual(["initialize", "notifications/initialized", "submit_typeset", "get_job_status", "get_job_status"]);
    expect(fake.seen.slice(1).every((s) => s.session === "sess-1")).toBe(true);
    const payload = fake.seen[2].params.arguments.payload;
    expect(payload).toMatchObject({ books: ["MRK"], sources: [{ book: "MRK", filename: "42MRKtest.usfm", sha256: await sha256Hex(USFM) }] });
    expect(payload.sources[0].url).toMatch(new RegExp(`^${ORIGIN}/v2/passages/${r.result.passage.id}/file\\?exp=\\d+&sig=[^&]+&raw=1$`));
    expect(fake.source()!.headers.get("content-type")).toBe("text/plain; charset=utf-8"); // the server got the raw text
    expect(calls.at(-1)).toContain("/r2/outputs/job1/");
    const pid = r.result.passage.id;
    const row = await db.prepare("SELECT object_key, pdf_key FROM assessment_passage WHERE id = ?").bind(pid).first<any>();
    expect(row).toEqual({ object_key: `assessments/${aid}/${pid}.usfm`, pdf_key: `assessments/${aid}/${pid}.pdf` });
    expect(new Uint8Array(await (await bucket.get(row.pdf_key))!.arrayBuffer())).toEqual(PDF);

    const f = await raw("GET", r.result.passage.href, { bearer: null });
    expect(f.status).toBe(200);
    expect(f.headers.get("content-type")).toBe("application/pdf");
    expect(f.headers.get("content-disposition")).toBe("inline; filename*=UTF-8''Mark%204.pdf");
    expect(f.headers.get("content-security-policy")).toBeNull();
    expect(new Uint8Array(await f.arrayBuffer())).toEqual(PDF);
    const part = await raw("GET", r.result.passage.href, { bearer: null, headers: { range: "bytes=0-7" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-7/${PDF.length}`);
    const t = await raw("GET", r.result.passage.href + "&raw=1", { bearer: null });
    expect(t.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(t.headers.get("content-security-policy")).toContain("sandbox");
    expect(await t.text()).toContain("\\v 1 Again Jesus");

    const token = await participantForm();
    expect(token.find((p: any) => p.id === pid)).toMatchObject({ media: "text", pdf: true });
    expect((await raw("DELETE", `${base}/${pid}`)).status).toBe(200);
    expect((await bucket.list({ prefix: `assessments/${aid}/${pid}` })).objects.length).toBe(0);
  });

  for (const mode of ["failed", "http500", "notpdf"] as const) {
    it(`a PTXprint failure (${mode}) keeps the raw file: 201, no pdf_key, the link serves the text, one log line`, async () => {
      const fake = fakePtxprint(mode); stubFetch(fake);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const r = await upload("MRK.sfm", USFM);
      expect(r.status).toBe(201);
      expect(r.result.passage).toMatchObject({ media: "text", pdf: false });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toBe("passage.pdf");
      const pid = r.result.passage.id;
      expect((await db.prepare("SELECT pdf_key FROM assessment_passage WHERE id = ?").bind(pid).first<any>()).pdf_key).toBeNull();
      expect(await bucket.head(`assessments/${aid}/${pid}.pdf`)).toBeNull();
      const t = await raw("GET", r.result.passage.href, { bearer: null });
      expect(t.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      await raw("DELETE", `${base}/${pid}`);
    });
  }

  it("PTXPRINT_MCP_URL unset: no call, the raw file stays, no log", async () => {
    const calls = stubFetch(fakePtxprint("ok"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await upload("Mark 4.usfm", USFM, { ...env, PTXPRINT_MCP_URL: undefined });
    expect(r.status).toBe(201);
    expect(r.result.passage).toMatchObject({ media: "text", pdf: false });
    expect(calls).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    await raw("DELETE", `${base}/${r.result.passage.id}`);
  });

  it("USX and a USFM without a known \\id book are not sent; PDFs and audio never carry a pdf flag", async () => {
    const calls = stubFetch(fakePtxprint("ok"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const usx = await upload("Mark 4.usx", new TextEncoder().encode('<usx version="3.0"><book code="MRK"/></usx>'));
    expect(usx.result.passage).toMatchObject({ media: "text", pdf: false });
    const noId = await upload("x.usfm", new TextEncoder().encode("\\c 1\n\\v 1 In the beginning"));
    expect(noId.result.passage).toMatchObject({ media: "text", pdf: false });
    const pdf = await upload("Mark 4.pdf", PDF);
    expect(pdf.result.passage.pdf).toBeUndefined();
    expect(calls).toEqual([]);
    for (const x of [usx, noId, pdf]) await raw("DELETE", `${base}/${x.result.passage.id}`);
  });

  it("migration 0014 not applied: the render result is dropped, the raw file stays, never a 500", async () => {
    const fake = fakePtxprint("ok"); stubFetch(fake);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const flaky = { ...env, DB: new Proxy(db, { get(t, k) { if (k === "prepare") return (sql: string) => { if (/pdf_key = \?/.test(sql)) throw new Error("D1_ERROR: no such column: pdf_key"); return t.prepare(sql); }; const v = (t as any)[k]; return typeof v === "function" ? v.bind(t) : v; } }) };
    const r = await upload("Mark 4.usfm", USFM, flaky);
    expect(r.status).toBe(201);
    expect(r.result.passage.pdf).toBe(false);
    expect(await bucket.head(`assessments/${aid}/${r.result.passage.id}.pdf`)).toBeNull();
    expect(String(warn.mock.calls[0][2])).toMatch(/no such column/);
    await raw("DELETE", `${base}/${r.result.passage.id}`);
  });
});

async function participantForm() {
  const path = `/v2/assessments/${aid}/surveys/survey_tavo/links`;
  const dry = await json(await raw("POST", path, { type: "application/json", body: JSON.stringify({ params: {}, mode: "dry_run" }) }));
  const link = (await json(await raw("POST", path, { type: "application/json", body: JSON.stringify({ params: {}, mode: "execute", confirm_token: dry.result.confirm_token }) }))).result;
  const token = (await json(await raw("POST", "/v2/participate/link", { type: "application/json", bearer: null, body: JSON.stringify({ token: link.link_token }) }))).result.participant_token as string;
  return (await json(await raw("GET", "/v2/participate/form", { bearer: token }))).result.passages;
}
