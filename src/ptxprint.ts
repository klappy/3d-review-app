/**
 * Text passages (USFM/SFM) → a readable PDF through the PTXprint MCP server (klappy/ptxprint-mcp).
 * Captain 2026-09-30 12:08 ET: "Use PTXprintmcp server that i use for converting the usfm/usx/sfm files to print/pdf."
 *
 * The server speaks MCP over streamable HTTP at `<PTXPRINT_MCP_URL>` (e.g. https://ptxprint.klappy.dev/mcp; no key).
 * One render = initialize → notifications/initialized → tools/call submit_typeset {payload} → poll get_job_status until
 * `succeeded`/`failed` → GET the pdf_url. Sources travel by URL + sha256 (the server's container fetches and verifies the
 * bytes), so the caller passes a short-lived signed link to the raw file. The layout (config_files + fonts) is the server's
 * own proven smoke fixture, copied verbatim into ptxprint-passage-config.json; only the book lines change.
 *
 * Never throws: every failure is `{ ok: false, reason }` so the upload keeps the raw file (src/passages.ts).
 */
import CONFIG from "./ptxprint-passage-config.json";

export const PTXPRINT_LIMITS = Object.freeze({ timeoutMs: 30_000, pollMs: 1_500, maxPdfBytes: 25 * 1024 * 1024 });

// Paratext book numbers (canon article payload-construction §Sources: filename NNBBBSSS.ext; numbering skips 40).
const OT = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL".split(" ");
const NT = "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" ");
export const PARATEXT_BOOK: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries([
  ...OT.map((b, i) => [b, String(i + 1).padStart(2, "0")]), ...NT.map((b, i) => [b, String(i + 41)]),
]));

/** The USFM book code from the `\id` line, when it is one of the 66 books PTXprint can place; else null. */
export function bookOf(usfm: string): string | null {
  const m = /\\id\s+([0-9A-Za-z]{3})\b/.exec(usfm.replace(/^﻿/, "").slice(0, 4096));
  const code = m ? m[1].toUpperCase() : "";
  return PARATEXT_BOOK[code] ? code : null;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const cfgKey = "shared/ptxprint/Default/ptxprint.cfg";
/** submit_typeset payload (server schema v1.0, src/payload.ts there) for one book of one passage file. */
export function passagePayload(book: string, sourceUrl: string, sha256: string, title: string) {
  const files = { ...(CONFIG.config_files as Record<string, string>) };
  const safeTitle = title.replace(/[\r\n]/g, " ").slice(0, 120);
  files[cfgKey] = files[cfgKey].replace(/^subject = .*$/m, `subject = ${book}`).replace(/^booklist = .*$/m, `booklist = ${book}`).replace(/^maintitle = .*$/m, `maintitle = ${safeTitle}`);
  // Settings.xml lists the books present; mark all 66 so any book resolves (the fixture marks only its own).
  files["Settings.xml"] = files["Settings.xml"].replace(/<BooksPresent>([01]+)<\/BooksPresent>/, (_m, bits: string) => `<BooksPresent>${"1".repeat(66)}${bits.slice(66)}</BooksPresent>`);
  return {
    schema_version: "1.0", project_id: "passage", config_name: "Default", books: [book], mode: "simple", define: {},
    config_files: files,
    // FileNameBookNameForm 41MAT + FileNamePostPart "test.usfm" in the fixture's Settings.xml → e.g. 42MRKtest.usfm.
    sources: [{ book, filename: `${PARATEXT_BOOK[book]}${book}test.usfm`, url: sourceUrl, sha256 }],
    fonts: CONFIG.fonts, figures: [],
  };
}

type Fetch = typeof fetch;
export type RenderResult = { ok: true; pdf: Uint8Array; jobId: string; cached: boolean } | { ok: false; reason: string };

/** Reads one JSON-RPC response from a streamable-HTTP answer (JSON or an SSE `data:` line). */
async function rpcResult(res: Response, id: number): Promise<any> {
  if (!res.ok) throw new Error(`mcp HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  const text = await res.text();
  const messages = type.includes("text/event-stream")
    ? text.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => { try { return JSON.parse(l.slice(5).trim()); } catch { return null; } })
    : [JSON.parse(text)];
  const msg = messages.find((m) => m && m.id === id);
  if (!msg) throw new Error("mcp: no response");
  if (msg.error) throw new Error(`mcp error ${msg.error.code ?? ""}: ${String(msg.error.message ?? "").slice(0, 200)}`);
  return msg.result;
}
/** tools/call → the tool's JSON text content. */
function toolJson(result: any): any {
  const text = result?.content?.find?.((c: any) => c?.type === "text")?.text;
  if (result?.isError) throw new Error(`tool error: ${String(text ?? "").slice(0, 200)}`);
  if (typeof text !== "string") throw new Error("tool: no text content");
  return JSON.parse(text);
}

/**
 * One PTXprint render, whole call bounded by `timeoutMs` (default 30 s) and the PDF by `maxPdfBytes`.
 * `fetchImpl` is injectable for tests; production uses the Worker's global fetch.
 */
export async function renderPassagePdf(opts: { mcpUrl: string; sourceUrl: string; sha256: string; book: string; title: string; fetchImpl?: Fetch; timeoutMs?: number; pollMs?: number; maxPdfBytes?: number }): Promise<RenderResult> {
  const f: Fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const deadline = Date.now() + (opts.timeoutMs ?? PTXPRINT_LIMITS.timeoutMs);
  const maxBytes = opts.maxPdfBytes ?? PTXPRINT_LIMITS.maxPdfBytes;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(0, deadline - Date.now()));
  let session: string | null = null, nextId = 1;
  const post = async (body: Record<string, unknown>) => f(opts.mcpUrl, {
    method: "POST", signal: ctrl.signal,
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "user-agent": "3d-review-app (passage-pdf)", ...(session ? { "mcp-session-id": session } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  const call = async (method: string, params: unknown) => { const id = nextId++; return rpcResult(await post({ id, method, params }), id); };
  try {
    const init = await post({ id: nextId, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "3d-review-app", version: "1" } } });
    session = init.headers.get("mcp-session-id");
    await rpcResult(init, nextId++);
    await (await post({ method: "notifications/initialized" })).body?.cancel();
    const submitted = toolJson(await call("tools/call", { name: "submit_typeset", arguments: { payload: passagePayload(opts.book, opts.sourceUrl, opts.sha256, opts.title) } }));
    const jobId = String(submitted.job_id ?? "");
    let pdfUrl: string | null = submitted.cached ? submitted.predicted_pdf_url : null;
    while (!pdfUrl) {
      if (Date.now() + (opts.pollMs ?? PTXPRINT_LIMITS.pollMs) >= deadline) return { ok: false, reason: "timeout" };
      await new Promise((r) => setTimeout(r, opts.pollMs ?? PTXPRINT_LIMITS.pollMs));
      const st = toolJson(await call("tools/call", { name: "get_job_status", arguments: { job_id: jobId } }));
      if (st.state === "failed" || st.state === "cancelled") return { ok: false, reason: `render ${st.state}: ${String(st.human_summary ?? st.errors?.[0] ?? "").slice(0, 160)}` };
      if (st.state === "succeeded") { pdfUrl = st.pdf_url ?? submitted.predicted_pdf_url; if (!pdfUrl) return { ok: false, reason: "succeeded without a pdf_url" }; }
    }
    const res = await f(pdfUrl, { signal: ctrl.signal, headers: { "user-agent": "3d-review-app (passage-pdf)" } });
    if (!res.ok) return { ok: false, reason: `pdf HTTP ${res.status}` };
    if (Number(res.headers.get("content-length") || "0") > maxBytes) { await res.body?.cancel(); return { ok: false, reason: "pdf too large" }; }
    const pdf = new Uint8Array(await res.arrayBuffer());
    if (pdf.length > maxBytes) return { ok: false, reason: "pdf too large" };
    if (!(pdf[0] === 0x25 && pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46)) return { ok: false, reason: "not a pdf" };
    return { ok: true, pdf, jobId, cached: !!submitted.cached };
  } catch (e) {
    return { ok: false, reason: ctrl.signal.aborted ? "timeout" : String((e as Error)?.message ?? e).slice(0, 200) };
  } finally { clearTimeout(timer); }
}
