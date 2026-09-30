/**
 * Passage files and links on an assessment — captain 2026-09-29 (BCS demo; Teryl): bring back the Lovable version's
 * scripture files. Each assessment can carry the passage under review as USFM / SFM / USX text, a PDF, an MP3, or a link
 * (e.g. a YouTube sign-language video); participants open it from the survey (cap.response.form → `passages`).
 *
 * Prior art: the Laos Lovable app stored `assessment_events.scripture_file_paths` in a public Supabase bucket and showed one
 * "View Scripture Portion" button per file above every question. Here files are private in R2 and reach participants
 * through short-lived signed links (HMAC with SESSION_SECRET), so a passage is only reachable from its own survey.
 *
 *   GET    /v2/assessments/:aid/passages            list (viewer+), each with a signed `href`
 *   POST   /v2/assessments/:aid/passages            owner/member. JSON {url, title?, reference?} adds a link;
 *                                                   any other body is the file itself: ?name=<file.ext>&title=&reference=
 *   DELETE /v2/assessments/:aid/passages/:pid       owner/member (row archived, stored file removed)
 *   GET    /v2/passages/:pid/file?exp=&sig=         the file, inline, with Range support (audio seeking on phones);
 *                                                   a USFM/SFM passage serves its PTXprint PDF when one was made, ?raw=1 the text
 *
 * USFM/SFM uploads are typeset once into a PDF by the PTXprint MCP server (src/ptxprint.ts; captain 2026-09-30) when
 * PTXPRINT_MCP_URL is set; the PDF sits beside the original in R2 and the row's pdf_key names it (migration 0014).
 * No URL, a failed or slow render (30 s), or no 0014 column: the raw file stays, no pdf_key, one log line — never a 500.
 *
 * Files need the R2 binding PASSAGES (wrangler.toml); without it uploads answer 503 and links still work.
 * Envelope {ok, result} / {ok:false, error} like every /v2 route. Metadata table: migration 0013.
 */
import type { Ctx, Env, Principal, Role } from "./handlers/types";
import { resolvePrincipal } from "./auth";
import { atLeast, newId, roleAt } from "./handlers/common";
import { allow, clientIp, RATE_LIMIT_WINDOW_SECONDS } from "./ratelimit";
import { linkTitle } from "./link-title";
import { bookOf, renderPassagePdf, sha256Hex } from "./ptxprint";

export const PASSAGE_LIMITS = Object.freeze({ maxBytes: 50 * 1024 * 1024, maxPerAssessment: 20, participantTtlSeconds: 12 * 3600, staffTtlSeconds: 3600, title: 120, reference: 120, url: 1000 });
type Media = "text" | "pdf" | "audio" | "video" | "link" | "reference";
export interface PassageRow { id: string; assessment_id: string; kind: "file" | "link" | "reference"; media: Media; title: string; reference: string | null; filename: string | null; content_type: string | null; size: number | null; object_key: string | null; url: string | null; created_at: string; created_by: string | null; archived_at: string | null; pdf_key?: string | null }
type PEnv = Env & { PASSAGES?: R2Bucket; PTXPRINT_MCP_URL?: string; PUBLIC_ORIGIN?: string };

// Accepted files: extension → what it is, how it is served, and a cheap content check (first bytes).
const TYPES: Record<string, { media: Media; serve: string; check: (head: Uint8Array, text: string) => boolean }> = {
  usfm: { media: "text", serve: "text/plain; charset=utf-8", check: (_h, t) => /\\(id|c|v|p|h|mt\d?)\b/.test(t) },
  sfm: { media: "text", serve: "text/plain; charset=utf-8", check: (_h, t) => /\\(id|c|v|p|h|mt\d?)\b/.test(t) },
  usx: { media: "text", serve: "text/plain; charset=utf-8", check: (_h, t) => /<usx[\s>]/i.test(t) },
  pdf: { media: "pdf", serve: "application/pdf", check: (h) => h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46 },
  mp3: { media: "audio", serve: "audio/mpeg", check: (h) => (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0) },
};
export const PASSAGE_EXTENSIONS = Object.keys(TYPES);
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|youtube-nocookie\.com)$/i;

const env_ = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const ok = (result: unknown, status = 200) => env_(status, { ok: true, result });
const fail = (status: number, code: string, message: string, hint?: string) => env_(status, { ok: false, error: { code, message, ...(hint ? { hint } : {}) } });

export function extOf(name: string): string { const m = /\.([A-Za-z0-9]{2,5})$/.exec(name.trim()); return m ? m[1].toLowerCase() : ""; }
export function cleanText(v: unknown, max: number): string | null { if (typeof v !== "string") return null; const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim(); return t ? t.slice(0, max) : null; }
/** An https link participants may open; YouTube/Vimeo count as video. */
export function linkOf(raw: unknown): { url: string; media: Media } | null {
  if (typeof raw !== "string" || raw.length > PASSAGE_LIMITS.url) return null;
  let u: URL; try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return null;
  return { url: u.toString(), media: VIDEO_HOSTS.test(u.hostname) ? "video" : "link" };
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function signedHref(env: Env, id: string, ttlSeconds: number, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `/v2/passages/${encodeURIComponent(id)}/file?exp=${exp}&sig=${await hmac(env.SESSION_SECRET, `passage:${id}:${exp}`)}`;
}
async function validSig(env: Env, id: string, exp: string | null, sig: string | null, now = Date.now()): Promise<boolean> {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp) || Number(exp) < Math.floor(now / 1000)) return false;
  const want = await hmac(env.SESSION_SECRET, `passage:${id}:${exp}`);
  if (want.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Participant/staff view of a passage: never the storage key. */
export async function passageView(env: Env, p: PassageRow, ttlSeconds: number) {
  return { id: p.id, kind: p.kind, media: p.media, title: p.title, reference: p.reference, filename: p.filename, size: p.size,
    ...(p.media === "text" ? { pdf: !!p.pdf_key } : {}),
    href: p.kind === "link" ? p.url : p.kind === "reference" ? null : await signedHref(env, p.id, ttlSeconds), created_at: p.created_at };
}
/** Active passages of an assessment; [] when the table does not exist yet (migration 0013 not applied). */
export async function listPassages(db: D1Database, aid: string): Promise<PassageRow[]> {
  try { return (await db.prepare("SELECT * FROM assessment_passage WHERE assessment_id = ? AND archived_at IS NULL ORDER BY created_at, id").bind(aid).all<PassageRow>()).results; }
  catch { return []; }
}
/** For cap.response.form: what a participant of this assessment may open (signed for 12 h). */
export async function participantPassages(env: Env, aid: string) {
  const rows = await listPassages(env.DB, aid);
  return Promise.all(rows.map((p) => passageView(env, p, PASSAGE_LIMITS.participantTtlSeconds)));
}

async function staff(request: Request, env: Env, aid: string, min: Role): Promise<{ principal: Principal; role: Role } | Response> {
  const principal = await resolvePrincipal(request, env);
  if (principal.kind === "anonymous" || principal.kind === "participant") return fail(401, "NOT_AUTHENTICATED", "sign in first");
  const ctx = { env, db: env.DB, principal } as unknown as Ctx;
  const role = await roleAt(ctx, "assessment", aid);
  if (!role) return fail(404, "NOT_FOUND_OR_NOT_VISIBLE", "resource not found or not visible");
  if (!atLeast(role, min)) return fail(403, "NOT_AUTHORIZED_AT_SCOPE", `${min} role required at this assessment`);
  return { principal, role };
}
export const missingTable = (e: unknown) => /no such table: assessment_passage/i.test(`${(e as Error)?.message ?? e} ${((e as Error)?.cause as Error)?.message ?? ""}`);

export async function handleList(request: Request, env: PEnv, aid: string): Promise<Response> {
  const who = await staff(request, env, aid, "viewer"); if (who instanceof Response) return who;
  const rows = await listPassages(env.DB, aid);
  return ok({ passages: await Promise.all(rows.map((p) => passageView(env, p, PASSAGE_LIMITS.staffTtlSeconds))), file_storage: !!env.PASSAGES, accepts: PASSAGE_EXTENSIONS, max_bytes: PASSAGE_LIMITS.maxBytes });
}

export async function handleAdd(request: Request, env: PEnv, aid: string, now = new Date()): Promise<Response> {
  const who = await staff(request, env, aid, "member"); if (who instanceof Response) return who;
  let count = 0;
  try { count = Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM assessment_passage WHERE assessment_id = ? AND archived_at IS NULL").bind(aid).first<{ n: number }>())?.n ?? 0); }
  catch (e) { if (missingTable(e)) return fail(409, "STAGE_CONFLICT", "passages need database update 0013 first", "ask the 3D team to apply migration 0013"); throw e; }
  if (count >= PASSAGE_LIMITS.maxPerAssessment) return fail(400, "INVALID_PARAMS", `at most ${PASSAGE_LIMITS.maxPerAssessment} passages per assessment`);
  const id = newId("passage"), at = now.toISOString(), q = new URL(request.url).searchParams;
  const type = (request.headers.get("content-type") || "").toLowerCase();
  let row: PassageRow;
  if (type.startsWith("application/json")) {
    let parsed: unknown; try { parsed = await request.json(); } catch { return fail(400, "INVALID_PARAMS", "JSON object body required"); }
    // Audit round 1 E3: `null`, an array or a scalar parses as JSON but is not an object — 400, never a TypeError 500.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "INVALID_PARAMS", "JSON object body required");
    const body = parsed as Record<string, unknown>;
    // BCS demo 2026-09-29 (bee:10809312 u3540382372-388): a passage can be named with nothing attached ("Genesis 1").
    // The survey then says "please read or listen to Genesis 1 before you answer"; the facilitator reads or plays it.
    if (body.url === undefined || body.url === null || body.url === "") {
      const reference = cleanText(body.reference, PASSAGE_LIMITS.reference);
      if (!reference) return fail(400, "INVALID_PARAMS", "name the passage (e.g. Genesis 1) or give a https:// link");
      row = { id, assessment_id: aid, kind: "reference", media: "reference", title: cleanText(body.title, PASSAGE_LIMITS.title) ?? reference, reference, filename: null, content_type: null, size: null, object_key: null, url: null, created_at: at, created_by: who.principal.id, archived_at: null };
      await insertPassage(env.DB, row);
      return ok({ passage: await passageView(env, row, PASSAGE_LIMITS.staffTtlSeconds) }, 201);
    }
    const link = linkOf(body.url);
    if (!link) return fail(400, "INVALID_PARAMS", "a link must be a full https:// address");
    const title = cleanText(body.title, PASSAGE_LIMITS.title) ?? cleanText(body.reference, PASSAGE_LIMITS.title) ?? (link.media === "video" ? "Video of the passage" : linkTitle(link.url));
    row = { id, assessment_id: aid, kind: "link", media: link.media, title, reference: cleanText(body.reference, PASSAGE_LIMITS.reference), filename: null, content_type: null, size: null, object_key: null, url: link.url, created_at: at, created_by: who.principal.id, archived_at: null };
  } else {
    if (!env.PASSAGES) return fail(503, "STAGE_CONFLICT", "file storage is not set up on this site yet; add a link instead", "bind the PASSAGES R2 bucket in wrangler.toml");
    const name = cleanText(q.get("name"), 200) ?? "";
    const ext = extOf(name), spec = TYPES[ext];
    if (!spec) return fail(400, "INVALID_PARAMS", `choose a ${PASSAGE_EXTENSIONS.map((e) => "." + e).join(", ")} file`);
    const declared = Number(request.headers.get("content-length") || "0");
    if (declared > PASSAGE_LIMITS.maxBytes) return fail(413, "INVALID_PARAMS", "file is larger than 50 MB");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return fail(400, "INVALID_PARAMS", "the file is empty");
    if (bytes.length > PASSAGE_LIMITS.maxBytes) return fail(413, "INVALID_PARAMS", "file is larger than 50 MB");
    const head = bytes.subarray(0, 4096), text = spec.media === "text" ? new TextDecoder("utf-8").decode(head).replace(/^﻿/, "") : "";
    if (!spec.check(head, text)) return fail(400, "INVALID_PARAMS", `this does not look like a ${ext.toUpperCase()} file`);
    const objectKey = `assessments/${aid}/${id}.${ext}`;
    await env.PASSAGES.put(objectKey, bytes, { httpMetadata: { contentType: spec.serve } });
    row = { id, assessment_id: aid, kind: "file", media: spec.media, title: cleanText(q.get("title"), PASSAGE_LIMITS.title) ?? name, reference: cleanText(q.get("reference"), PASSAGE_LIMITS.reference), filename: name, content_type: spec.serve, size: bytes.length, object_key: objectKey, url: null, created_at: at, created_by: who.principal.id, archived_at: null };
  }
  try { await insertPassage(env.DB, row); }
  catch (e) { // S33 E4: the file went to R2 before the row; a failed insert must not leave it orphaned
    if (row.object_key && env.PASSAGES) await env.PASSAGES.delete(row.object_key).catch(() => {});
    throw e;
  }
  if (row.kind === "file" && row.media === "text" && env.PASSAGES) row = await withPdf(request, env as PEnv & { PASSAGES: R2Bucket }, row);
  return ok({ passage: await passageView(env, row, PASSAGE_LIMITS.staffTtlSeconds) }, 201);
}
/**
 * One PTXprint render for a USFM/SFM upload (the row is already stored, so the server's container can fetch the raw file
 * through a 10-minute signed link). Success: PDF beside the original, pdf_key on the row. Anything else: row unchanged.
 * USX is not sent: the server's canon documents USFM sources only (klappy/ptxprint-mcp canon/articles/payload-construction).
 */
async function withPdf(request: Request, env: PEnv & { PASSAGES: R2Bucket }, row: PassageRow): Promise<PassageRow> {
  const skip = (reason: string) => { console.warn("passage.pdf", row.id, reason); return row; };
  if (!env.PTXPRINT_MCP_URL) return row; // not configured on this site: the text file is the passage (no log per upload)
  const ext = extOf(row.filename ?? "");
  if (ext !== "usfm" && ext !== "sfm") return row;
  const raw = await env.PASSAGES.get(row.object_key!);
  if (!raw) return skip("raw file missing");
  const bytes = new Uint8Array(await raw.arrayBuffer());
  const book = bookOf(new TextDecoder("utf-8").decode(bytes.subarray(0, 4096)));
  if (!book) return skip("no \\id book PTXprint can place");
  const origin = (env.PUBLIC_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
  const sourceUrl = `${origin}${await signedHref(env, row.id, 600)}&raw=1`;
  const r = await renderPassagePdf({ mcpUrl: env.PTXPRINT_MCP_URL, sourceUrl, sha256: await sha256Hex(bytes), book, title: row.title });
  if (!r.ok) return skip(r.reason);
  const pdfKey = `assessments/${row.assessment_id}/${row.id}.pdf`;
  try {
    await env.PASSAGES.put(pdfKey, r.pdf, { httpMetadata: { contentType: "application/pdf" } });
    await env.DB.prepare("UPDATE assessment_passage SET pdf_key = ? WHERE id = ?").bind(pdfKey, row.id).run();
  } catch (e) {
    await env.PASSAGES.delete(pdfKey).catch(() => {});
    return skip(`store: ${String((e as Error)?.message ?? e).slice(0, 160)}`); // e.g. migration 0014 not applied yet
  }
  return { ...row, pdf_key: pdfKey };
}
const insertPassage = (db: D1Database, row: PassageRow) => db.prepare("INSERT INTO assessment_passage (id, assessment_id, kind, media, title, reference, filename, content_type, size, object_key, url, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
  .bind(row.id, row.assessment_id, row.kind, row.media, row.title, row.reference, row.filename, row.content_type, row.size, row.object_key, row.url, row.created_at, row.created_by).run();


export async function handleRemove(request: Request, env: PEnv, aid: string, pid: string, now = new Date()): Promise<Response> {
  const who = await staff(request, env, aid, "member"); if (who instanceof Response) return who;
  const row = await env.DB.prepare("SELECT * FROM assessment_passage WHERE id = ? AND assessment_id = ? AND archived_at IS NULL").bind(pid, aid).first<PassageRow>().catch(() => null);
  if (!row) return fail(404, "NOT_FOUND_OR_NOT_VISIBLE", "resource not found or not visible");
  await env.DB.prepare("UPDATE assessment_passage SET archived_at = ? WHERE id = ?").bind(now.toISOString(), pid).run();
  if (row.object_key && env.PASSAGES) await env.PASSAGES.delete(row.pdf_key ? [row.object_key, row.pdf_key] : row.object_key).catch(() => {});
  return ok({ removed: pid });
}

/** The file itself for a signed link: inline, exact content type, nosniff, Range for audio seeking. */
export async function handleFile(request: Request, env: PEnv, pid: string): Promise<Response> {
  // Audit round 1 W2: the signature is checked FIRST (one HMAC, no storage) and only a missing, tampered or expired link
  // spends RL_HTTP_ANON. A valid link is already a server-issued, short-lived capability; a workshop room behind one NAT
  // (50 phones seeking in the same MP3 with Range requests) must not share the 60/60 s anonymous address budget.
  const q = new URL(request.url).searchParams;
  if (!(await validSig(env, pid, q.get("exp"), q.get("sig")))) {
    if (!(await allow(env, "RL_HTTP_ANON", `ip:${clientIp(request)}`))) return fail(429, "RATE_LIMITED", "too many requests", `wait up to ${RATE_LIMIT_WINDOW_SECONDS} seconds`);
    return fail(403, "NOT_AUTHORIZED_AT_SCOPE", "this passage link has expired; reopen the survey");
  }
  const row = await env.DB.prepare("SELECT * FROM assessment_passage WHERE id = ? AND archived_at IS NULL AND kind = 'file'").bind(pid).first<PassageRow>().catch(() => null);
  if (!row || !row.object_key || !env.PASSAGES) return fail(404, "NOT_FOUND_OR_NOT_VISIBLE", "resource not found or not visible");
  // A USFM/SFM passage opens as its PTXprint PDF; ?raw=1 (and PTXprint's own fetch of the source) gets the text.
  const asPdf = row.media === "text" && !!row.pdf_key && q.get("raw") !== "1";
  const key = asPdf ? row.pdf_key! : row.object_key;
  const size = asPdf ? ((await env.PASSAGES.head(key))?.size ?? 0) : (row.size ?? 0);
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  let range: { offset: number; length: number } | undefined;
  if (m && size) {
    const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    const end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || end < start) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    range = { offset: start, length: end - start + 1 };
  }
  const obj = await env.PASSAGES.get(key, range ? { range } : undefined);
  if (!obj) return fail(404, "NOT_FOUND_OR_NOT_VISIBLE", "resource not found or not visible");
  const headers: Record<string, string> = {
    "content-type": asPdf ? "application/pdf" : row.content_type || "application/octet-stream",
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(asPdf ? (row.filename || "passage").replace(/\.[A-Za-z0-9]{2,5}$/, "") + ".pdf" : row.filename || "passage")}`,
    "x-content-type-options": "nosniff", "cache-control": "private, max-age=3600", "accept-ranges": "bytes",
    "referrer-policy": "no-referrer",
  };
  if (row.media === "text" && !asPdf) headers["content-security-policy"] = "sandbox; default-src 'none'";
  if (range) { headers["content-range"] = `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`; headers["content-length"] = String(range.length); return new Response(obj.body, { status: 206, headers }); }
  headers["content-length"] = String(size);
  return new Response(obj.body, { status: 200, headers });
}

export function installPassages(app: { get: Function; post: Function; delete: Function }): void {
  app.get("/v2/assessments/:aid/passages", (c: any) => handleList(c.req.raw, c.env, c.req.param("aid")));
  app.post("/v2/assessments/:aid/passages", (c: any) => handleAdd(c.req.raw, c.env, c.req.param("aid")));
  app.delete("/v2/assessments/:aid/passages/:pid", (c: any) => handleRemove(c.req.raw, c.env, c.req.param("aid"), c.req.param("pid")));
  app.get("/v2/passages/:pid/file", (c: any) => handleFile(c.req.raw, c.env, c.req.param("pid")));
}
