// Receipts, trace ids, undo tokens, confirm tokens. Persisted to `receipt` / `trace` tables.
import type { Ctx, ScopeType } from "./handlers/types";
import type { Capability } from "./registry";
import type { Receipt } from "./envelope";

export const CONFIRM_TTL_SECONDS = 300; // inherited from 05 sketch; 18-D open item D-2 (18-C rules the final value)

// ---------- ids ----------
export function randomId(prefix: string, bytes = 12): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return `${prefix}_${b64url(buf)}`;
}
export const newTraceId = () => randomId("tr");
export const newReceiptId = () => randomId("rcpt");
export const newUndoToken = () => randomId("undo", 18);

// ---------- encoding ----------
export function b64url(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const enc = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Canonical JSON: sorted keys, so the same intent hashes the same on both faces. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function sign(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}
export async function verify(secret: string, payload: string, sig: string): Promise<boolean> {
  const key = await hmacKey(secret);
  try { return await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), enc.encode(payload)); } catch { return false; }
}

// ---------- confirm tokens (danger two-step) ----------
export interface ConfirmIntent { capability: string; params_hash: string; actor: string; scope: string; revision: string; exp: number }

/** Bound to intent: capability + params hash + actor + scope + revision (contract sha). TTL 300 s, labeled inherited (D-2). */
export async function mintConfirmToken(secret: string, intent: Omit<ConfirmIntent, "exp">, now: Date): Promise<{ token: string; expires_in: number }> {
  const body: ConfirmIntent = { ...intent, exp: Math.floor(now.getTime() / 1000) + CONFIRM_TTL_SECONDS };
  const payload = b64url(enc.encode(canonical(body)));
  const sig = await sign(secret, payload);
  return { token: `cfm_${payload}.${sig}`, expires_in: CONFIRM_TTL_SECONDS };
}

export type ConfirmCheck = "ok" | "expired" | "mismatch" | "malformed";
export async function checkConfirmToken(secret: string, token: string, intent: Omit<ConfirmIntent, "exp">, now: Date): Promise<ConfirmCheck> {
  if (typeof token !== "string" || !token.startsWith("cfm_")) return "malformed";
  const [payload, sig] = token.slice(4).split(".");
  if (!payload || !sig) return "malformed";
  if (!(await verify(secret, payload, sig))) return "malformed";
  let body: ConfirmIntent;
  try { body = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))); } catch { return "malformed"; }
  if (body.exp < Math.floor(now.getTime() / 1000)) return "expired";
  for (const k of ["capability", "params_hash", "actor", "scope", "revision"] as const) if (body[k] !== intent[k]) return "mismatch";
  return "ok";
}

export async function paramsHash(params: Record<string, unknown>): Promise<string> {
  return (await sha256Hex(canonical(params))).slice(0, 32);
}

// ---------- receipt minting + persistence ----------
export interface MintInput {
  cap: Capability;
  scope: { type: ScopeType; id: string };
  priorState?: Record<string, unknown>;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  mode?: "dry_run" | "execute";
  confirmToken?: string;
}

export function inverseLabel(cap: Capability): string {
  // A batch of codes cannot be safely reversed by the single-code revoke
  // handler. Hold the contract's proposed inverse until batch undo exists.
  if(cap.id==="cap.survey.issue_codes") return "none";
  return cap.inverse.kind === "true" && cap.inverse.via ? cap.inverse.via : "none";
}

export async function mintReceipt(ctx: Ctx, input: MintInput): Promise<Receipt> {
  const { cap } = input;
  const at = ctx.now().toISOString();
  const trueInverse = cap.id!=="cap.survey.issue_codes" && cap.inverse.kind === "true" && input.mode !== "dry_run";
  const receipt: Receipt = {
    id: newReceiptId(),
    actor: ctx.principal.id,
    scope: input.scope,
    class: cap.class,
    inverse: inverseLabel(cap),
    trace_id: ctx.traceId,
    at,
  };
  if (trueInverse) receipt.undo_token = newUndoToken();
  if (cap.inverse.compensating_control) receipt.compensating_control = cap.inverse.compensating_control.trim();
  if (input.mode) receipt.mode = input.mode;
  await persistReceipt(ctx, receipt, cap.id, input);
  return receipt;
}

async function persistReceipt(ctx: Ctx, r: Receipt, capabilityId: string, input: MintInput): Promise<void> {
  // A receipt is durable and may be inspected later. Persist only the fields
  // needed by known inverse handlers; never store bearer tokens, codes, answers,
  // addresses, arbitrary user payloads, or a reusable confirmation token.
  const priorBlob = JSON.stringify({
    prior: receiptFields(input.priorState, PRIOR_FIELDS[capabilityId] ?? []),
    params: receiptFields(input.params, PARAM_FIELDS[capabilityId] ?? []),
    result_ids: pickIds(input.result),
  });
  try {
    await ctx.db
      .prepare(
        `INSERT INTO receipt (id, actor, capability, scope_type, scope_id, class, inverse, undo_token, confirm_token, trace_id, prior_state_json, at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      )
      .bind(r.id, r.actor, capabilityId, r.scope.type, r.scope.id, r.class, r.inverse, r.undo_token ?? null, null, r.trace_id, priorBlob, r.at)
      .run();
  } catch (e) {
    ctx.log("receipt.persist.failed", { error: String(e) });
    throw e;
  }
}

const PARAM_FIELDS: Record<string, readonly string[]> = {
  "cap.workspace.update": ["id"], "cap.workspace.archive": ["id"], "cap.workspace.unarchive": ["id"],
  "cap.workspace.add_project": ["id","pid"], "cap.workspace.remove_project": ["id","pid"],
  "cap.project.update": ["id"], "cap.project.archive": ["id"], "cap.project.unarchive": ["id"],
  "cap.assessment.update": ["id"], "cap.assessment.set_stage": ["id"],
  "cap.assessment.archive": ["id"], "cap.assessment.unarchive": ["id"], "cap.assessment.notes.update": ["id"],
  "cap.survey.select": ["aid"], "cap.survey.deselect": ["aid","sid"],
};
const PRIOR_FIELDS: Record<string, readonly string[]> = {
  "cap.workspace.update": ["name"], "cap.workspace.archive": ["archived_at"], "cap.workspace.unarchive": ["archived_at"],
  "cap.workspace.add_project": ["workspace_id"], "cap.workspace.remove_project": ["workspace_id"],
  "cap.project.update": ["name","organization"], "cap.project.archive": ["archived_at"], "cap.project.unarchive": ["archived_at"],
  "cap.assessment.update": ["name","purpose","period","language_id","format"],
  "cap.assessment.set_stage": ["stage"], "cap.assessment.archive": ["archived_at"], "cap.assessment.unarchive": ["archived_at"],
  // Declared self:restore-prior undo requires the previous notes. This is
  // sensitive application data; receipt access and retention need owner review.
  "cap.assessment.notes.update": ["notes_reflection","notes_next_steps"],
  "cap.survey.select": ["state","archived_at"], "cap.survey.deselect": ["state","archived_at"],
};
function receiptFields(source: Record<string,unknown> | undefined, allowed: readonly string[]): Record<string,unknown> | null {
  if(!source) return null;
  const out:Record<string,unknown>={};
  for(const key of allowed) {
    const value=source[key];
    if(value===null||typeof value==="string"||typeof value==="number"||typeof value==="boolean") out[key]=value;
    else if(key==="ids"&&Array.isArray(value)&&value.every(x=>typeof x==="string")) out[key]=value;
  }
  return out;
}

/** Keys that look like ids (id, aid, sid, *_id) — what an inverse capability needs to address the row. */
export function pickIds(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const isId = (k: string, v: unknown) => (k === "id" || /^[a-z]*id$/.test(k) || k.endsWith("_id")) && (typeof v === "string" || typeof v === "number");
  for (const [k, v] of Object.entries(o ?? {})) if (isId(k, v)) out[k] = v;
  // Handlers return the created row nested under its noun ({ assessment: { id, project_id } }); the
  // inverse (archive/revoke) takes those ids as top-level params, so lift one level when nothing was found there.
  for (const v of Object.values(o ?? {})) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    for (const [k, nv] of Object.entries(v as Record<string, unknown>)) if (isId(k, nv) && out[k] === undefined) out[k] = nv;
  }
  return out;
}

export interface StoredReceipt {
  id: string; actor: string; capability: string; scope_type: ScopeType; scope_id: string; class: string; inverse: string;
  undo_token: string | null; trace_id: string; prior_state_json: string | null; at: string;
}

export async function findReceiptByUndoToken(ctx: Ctx, token: string): Promise<StoredReceipt | null> {
  const row = await ctx.db.prepare(`SELECT * FROM receipt WHERE undo_token = ?1`).bind(token).first<StoredReceipt>();
  return row ?? null;
}

export async function findReceiptById(ctx: Ctx, id: string): Promise<StoredReceipt | null> {
  const row = await ctx.db.prepare(`SELECT * FROM receipt WHERE id = ?1`).bind(id).first<StoredReceipt>();
  return row ?? null;
}

export async function consumeUndoToken(ctx: Ctx, receiptId: string): Promise<void> {
  // Token is single-use: clear it (the undo's own receipt records the reversal).
  await ctx.db.prepare(`UPDATE receipt SET undo_token = NULL WHERE id = ?1`).bind(receiptId).run();
}

// ---------- traces ----------
export interface Span { span: string; t: number; data?: Record<string, unknown> }

/** Persist the span log. Redacted at write time: never params, codes, addresses, answers (CON-PRIV-004). */
export async function persistTrace(ctx: Ctx, spans: Span[], meta: { capability: string; transport: "http" | "mcp"; tool?: string; ok: boolean; code?: string }): Promise<void> {
  const safeSpans = spans.map((s) => ({ span: s.span, t: s.t, ...(s.data ? { data: redact(s.data) } : {}) }));
  const blob = JSON.stringify({ ...meta, spans: safeSpans });
  try {
    await ctx.db
      .prepare(`INSERT INTO trace (trace_id, actor, spans_json, at) VALUES (?1, ?2, ?3, ?4)`)
      .bind(ctx.traceId, ctx.principal.id, blob, ctx.now().toISOString())
      .run();
  } catch (e) {
    // Trace persistence must never fail the request.
    console.warn("trace.persist.failed", ctx.traceId, String(e));
  }
}

const REDACT_KEYS = /param|code|email|address|answer|token|secret|password|body|response/i;
export function redact(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (REDACT_KEYS.test(k)) { out[k] = "[redacted]"; continue; }
    out[k] = typeof v === "object" && v !== null ? "[object]" : v;
  }
  return out;
}
