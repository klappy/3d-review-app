/** entry / auth / ops / docs-file handlers (Lane B). Domain handlers are Lane A's. */
import type { Handler } from "./types";
import { CapError, id, sha256, notVisible } from "./types";
import { mintSession, revokeSessionByHash } from "../auth";
import contract from "../../contract/capabilities.json";
import { capabilities, byId } from "../registry";

export const entryIntents: Handler = async () => ({ result: { intents: [
  { id: "what", route: "docs" }, { id: "how", route: "docs {topic:'stages'}" }, { id: "example", route: "GET /v2/example" },
  { id: "take survey", route: "POST /v2/participate/code" }, { id: "manage", route: "POST /v2/auth/link" }, { id: "view results", route: "GET /v2/assessments/{id}/results" } ] } });

export const entryExample: Handler = async () => ({ result: { fixture: true, assessment: { id: "asm_example", name: "Example assessment (fixture)", stage: "understand", language: "Example language",
  surveys: [{ id: "srv_example", template: "translation-team@1", responses: 12 }], summary: { coverage: { translator: 5, community: 4, church: 3 }, bands: { clarity: "mid", naturalness: "high", accuracy: "mid" } } } } });

/** phase 0: no email send — the code is logged with a DEV marker. Effect row; dry_run shows the address hash only. */
/**
 * Access boundary (cookbook #14, 2026-09-16): ENVIRONMENT=dev is a shared SYNTHETIC sandbox. It issues the code
 * in-band (dev_only_code) and therefore accepts ONLY reserved synthetic identities (RFC 2606 `.invalid` domains) —
 * no real mailbox can be impersonated. Production sign-in is Cloudflare email-code (OF-7); until that path is wired
 * production reports RESERVED_NOT_BUILT rather than pretending a code was sent.
 */
const SYNTHETIC_DOMAIN = /\.invalid$/i;
export const authRequestLink: Handler = async (ctx, p, o) => {
  if (!p.email || typeof p.email !== "string") throw new CapError("INVALID_PARAMS", "email required");
  // Fail CLOSED: only an explicit ENVIRONMENT="dev" is the synthetic sandbox; a missing variable is treated as production.
  const dev = ctx.env.ENVIRONMENT === "dev";
  if (dev && !SYNTHETIC_DOMAIN.test(p.email)) throw new CapError("INVALID_PARAMS", "dev sandbox accepts only synthetic identities (name@…example.invalid)", "no real email is ever accepted or contacted from the dev environment", "cap.auth.request_link");
  if (!dev) throw new CapError("RESERVED_NOT_BUILT", "email-code delivery is not wired in this environment yet", "production sign-in is Cloudflare email-code (OF-7); pending the auth lane", "cap.auth.request_link");
  const eh = await sha256(p.email.toLowerCase());
  if (o?.dryRun) return { result: {}, impact: { affected: [{ email_hash: eh.slice(0, 12) }], irreversible: true, effect: "external", compensating_control: "expire code" } };
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)); // CSPRNG, not Math.random
  await ctx.db.prepare("INSERT INTO login_code (id, email_hash, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)").bind(id("lc"), eh, await sha256(code), Date.now() + 10 * 60e3, Date.now()).run();
  await ctx.db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id("usr"), eh, 0, 0, new Date().toISOString()).run();
  ctx.log("auth.code_issued", { email_hash_prefix: eh.slice(0, 8) }); // never the code: spans persist to the trace table (CON-PRIV-004)
  return { result: { sent: true, expires_in: 600, ...(ctx.env.ENVIRONMENT === "dev" ? { dev_only_code: code } : {}) }, scope: { type: "platform", id: "auth" } };
};

export const authConsumeLink: Handler = async (ctx, p) => {
  if (!p.email || !p.code) throw new CapError("INVALID_PARAMS", "email and code required");
  const eh = await sha256(String(p.email).toLowerCase());
  const row = await ctx.db.prepare("SELECT id, expires_at, redeemed_at AS used_at FROM login_code WHERE email_hash = ? AND code_hash = ? ORDER BY created_at DESC LIMIT 1").bind(eh, await sha256(String(p.code))).first<any>();
  if (!row) throw new CapError("INVALID_PARAMS", "code invalid", "request a new code", "cap.auth.request_link");
  if (row.used_at) throw new CapError("INVALID_PARAMS", "code_used", "codes are single-use; request a new one");
  if (row.expires_at < Date.now()) throw new CapError("INVALID_PARAMS", "code_expired", "request a new code");
  await ctx.db.prepare("UPDATE login_code SET redeemed_at = ? WHERE id = ?").bind(Date.now(), row.id).run();
  const pr = await ctx.db.prepare("SELECT id, support FROM principal WHERE email_hash = ?").bind(eh).first<any>();
  const token = await mintSession(ctx.env, pr.id, pr.support ? "support" : "user");
  return { result: { session: token, principal_id: pr.id, note: "phase 0: same token works as cookie `session` and as Bearer (delegated identity contract = 18-D open item D-1)" }, scope: { type: "platform", id: "auth" } };
};

/** Logout revokes the credential the caller actually presented (cookie or bearer, HTTP or MCP) — never a
 *  client-supplied token. signed_out is true only when a live session row was deleted (Astra 5706310753). */
export const authLogout: Handler = async (ctx) => {
  const h = ctx.principal.sessionTokenHash;
  if (!h) throw new CapError("NOT_AUTHENTICATED", "no session to sign out");
  const revoked = await revokeSessionByHash(ctx.env, h);
  if (revoked === 0) throw new CapError("NOT_AUTHENTICATED", "session already revoked");
  return { result: { signed_out: true }, scope: { type: "platform", id: "auth" } };
};

export const authMe: Handler = async (ctx) => {
  const pr = ctx.principal;
  if (pr.kind === "anonymous") throw new CapError("NOT_AUTHENTICATED", "no session");
  const grants = pr.kind === "user" || pr.kind === "support" ? (await ctx.db.prepare("SELECT scope_type, scope_id, role FROM grant WHERE principal_id = ?").bind(pr.id).all()).results : [];
  return { result: { principal: { id: pr.id, kind: pr.kind, provisioned: !!pr.provisioned, delegated_by: pr.delegatedBy ?? null, support_actor: pr.supportActor ?? null, participant_survey_id: pr.participantSurveyId ?? null }, grants } };
};

export const opsHealth: Handler = async (ctx) => {
  let d1 = "ok";
  try { await ctx.db.prepare("SELECT 1").first(); } catch (e) { d1 = "down"; }
  return { result: { ok: d1 === "ok", build: "0.0.1-phase0", contract: (contract as any).contract, source_sha: (contract as any).source.sha, deps: { d1 }, capabilities: capabilities.length } };
};

export const opsFeedback: Handler = async (ctx, p) => {
  const stripped = "answers" in p;
  const { answers: _drop, ...rest } = p;
  await ctx.db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
    .bind(id("fb"), ctx.principal.id, String(rest.scope_type ?? "platform"), String(rest.scope_id ?? "-"), JSON.stringify({ context: rest.context ?? null, text: rest.text ?? "", stripped }), new Date().toISOString()).run();
  return { result: { recorded: true, stripped }, scope: { type: "platform", id: "feedback" } };
};

export const opsTrace: Handler = async (ctx, p) => {
  const row = await ctx.db.prepare("SELECT actor, spans_json, at FROM trace WHERE trace_id = ?").bind(p.trace_id).first<any>();
  if (!row || (ctx.principal.kind !== "support" && row.actor !== ctx.principal.id)) throw notVisible();
  return { result: { trace_id: p.trace_id, at: row.at, spans: JSON.parse(row.spans_json) } };
};

export const docsCapabilities: Handler = async () => ({ result: contract as any });
export const docsOpenapi: Handler = async () => ({ result: { note: "served as YAML at GET /v2/openapi.yaml", capabilities: byId.size } });
