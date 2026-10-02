/** entry / auth / ops / docs-file handlers (Lane B). Domain handlers are Lane A's. */
import { feedbackExperience, feedbackProvenance, projectFeedbackProvenance } from './feedback-provenance';
import type { Handler } from "./types";
import { CapError, id, sha256, notVisible } from "./types";
import { normalizeEmail } from "./common";
import { mintSession, revokeSessionByHash } from "../auth";
import { revokeOAuthGrants, type OAuthEnv } from "../oauth";
import contract from "../../contract/capabilities.json";
import { capabilities, byId } from "../registry";
import { APP_VERSION, APP_COMMIT, APP_STAMP, BUILD_UUID, RELEASE_SOURCE } from "../version";

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
  const email = normalizeEmail(p.email); // same normaliser as the limiter's em: key (review #12-11)
  if (dev && !SYNTHETIC_DOMAIN.test(email)) throw new CapError("INVALID_PARAMS", "dev sandbox accepts only synthetic identities (name@…example.invalid)", "no real email is ever accepted or contacted from the dev environment", "cap.auth.request_link");
  if (!dev) throw new CapError("RESERVED_NOT_BUILT", "email-code delivery is not wired in this environment yet", "production sign-in is Cloudflare email-code (OF-7); pending the auth lane", "cap.auth.request_link");
  const eh = await sha256(email);
  if (o?.dryRun) return { result: {}, impact: { affected: [{ email_hash: eh.slice(0, 12) }], irreversible: true, effect: "external", compensating_control: "expire code" } };
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)); // CSPRNG, not Math.random
  await ctx.db.prepare("INSERT INTO login_code (id, email_hash, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)").bind(id("lc"), eh, await sha256(code), Date.now() + 10 * 60e3, Date.now()).run();
  await ctx.db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)").bind(id("usr"), eh, 1, 0, new Date().toISOString()).run(); // provisioned = 1: self-service creation of OWN workspaces/projects (captain ruling 2026-09-17); support stays 0
  ctx.log("auth.code_issued", { email_hash_prefix: eh.slice(0, 8) }); // never the code: spans persist to the trace table (CON-PRIV-004)
  return { result: { sent: true, expires_in: 600, ...(ctx.env.ENVIRONMENT === "dev" ? { dev_only_code: code } : {}) }, scope: { type: "platform", id: "auth" } };
};

export const authConsumeLink: Handler = async (ctx, p) => {
  if (!p.email || !p.code) throw new CapError("INVALID_PARAMS", "email and code required");
  const eh = await sha256(normalizeEmail(String(p.email)));
  const row = await ctx.db.prepare("SELECT id, expires_at, redeemed_at AS used_at FROM login_code WHERE email_hash = ? AND code_hash = ? AND id NOT LIKE 'ml\\_%' ESCAPE '\\' ORDER BY created_at DESC LIMIT 1").bind(eh, await sha256(String(p.code))).first<any>();
  if (!row) throw new CapError("INVALID_PARAMS", "code invalid", "request a new code", "cap.auth.request_link");
  if (row.used_at) throw new CapError("INVALID_PARAMS", "code_used", "codes are single-use; request a new one");
  if (row.expires_at < Date.now()) throw new CapError("INVALID_PARAMS", "code_expired", "request a new code");
  const changed = await ctx.db.prepare("UPDATE login_code SET redeemed_at = ? WHERE id = ? AND redeemed_at IS NULL").bind(Date.now(), row.id).run();
  if (changed.meta.changes !== 1) throw new CapError("INVALID_PARAMS", "code_used", "codes are single-use; request a new one");
  const pr = await ctx.db.prepare("SELECT id, support FROM principal WHERE email_hash = ?").bind(eh).first<any>();
  const token = await mintSession(ctx.env, pr.id, pr.support ? "support" : "user");
  return { result: { session: token, principal_id: pr.id, note: "phase 0: same token works as cookie `session` and as Bearer (delegated identity contract = 18-D open item D-1)" }, scope: { type: "platform", id: "auth" } };
};

/** Logout revokes the credential the caller actually presented (cookie or bearer, HTTP or MCP) — never a
 *  client-supplied token. signed_out is true only when a live session row was deleted (Astra 5706310753). */
export const authLogout: Handler = async (ctx) => {
  // OAuth-delegated caller (a connector): signing out = revoking that client's grants for this user.
  if (ctx.principal.oauthClientId) {
    const n = await revokeOAuthGrants(ctx.env as OAuthEnv, ctx.principal.id, ctx.principal.oauthClientId);
    if (n === 0) throw new CapError("NOT_AUTHENTICATED", "connection already revoked");
    return { result: { signed_out: true, revoked_grants: n }, scope: { type: "platform", id: "auth" } };
  }
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
  // Release identity (ticket 2026-09-17-3d-release-identity): `build` = <version>+<sha7> from the build-time stamp; `commit` = app code sha;
  // `release_source` = cookbook release-record commit (release/release-manifest.json). `contract`/`source_sha` remain the contract pin (cookbook 04) — distinct meanings.
  return { result: { ok: d1 === "ok", version: APP_VERSION, build: APP_STAMP, commit: APP_COMMIT, ...(BUILD_UUID ? { build_uuid: BUILD_UUID } : {}), release_source: RELEASE_SOURCE,
    contract: (contract as any).contract, source_sha: (contract as any).source.sha, deps: { d1 }, capabilities: capabilities.length } };
};

/** Literal answers-strip key-set (Auth A5). Dropped before unknown-key reject; never persisted. */
const FEEDBACK_STRIP_KEYS = ["answers", "responses", "response"] as const;
const FEEDBACK_WRITE_KEYS = new Set([
  "helpful", "note", "text", "context", "scope_type", "scope_id",
  "satisfaction", "confusion", "frustration", "sentiment_journey",
  "cast_id", "persona", "goal_id", "require_authenticated", "experience",
]);
const FEEDBACK_SCORE_KEYS = ["satisfaction", "confusion", "frustration"] as const;
const FEEDBACK_CODE_UNIT_128 = ["sentiment_journey", "cast_id", "persona", "goal_id"] as const;

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;
const invalidFeedback = (message: string) => new CapError("INVALID_PARAMS", message);

function jsonUtf8Size(value: unknown): number {
  try { return utf8Bytes(JSON.stringify(value) ?? "null"); }
  catch { throw invalidFeedback("params must be JSON-serializable"); }
}

function asFeedbackString(value: unknown, key: string): string {
  if (typeof value !== "string") throw invalidFeedback(`${key} must be a string`);
  return value;
}

/** Persist accepted write keys under canonical body keys; row scopes stay opaque labels. */
export const opsFeedback: Handler = async (ctx, p) => {
  // Optional caller precondition, shared by HTTP and MCP. Never degrade an attributed UI write to anonymous.
  if ("require_authenticated" in p && typeof p.require_authenticated !== "boolean") throw invalidFeedback("require_authenticated must be a boolean");
  if (p.require_authenticated === true && ctx.principal.kind === "anonymous") throw new CapError("NOT_AUTHENTICATED", "Sign in before sending this feedback");
  const experience = "experience" in p ? feedbackExperience(p.experience) : undefined;
  const stripped = FEEDBACK_STRIP_KEYS.some((k) => k in p);
  const rest: Record<string, unknown> = { ...p };
  for (const k of FEEDBACK_STRIP_KEYS) delete rest[k];

  if (jsonUtf8Size(rest) > 8192) throw invalidFeedback("params exceed 8192 UTF-8 bytes");

  if ("helpful" in rest && typeof rest.helpful !== "boolean") throw invalidFeedback("helpful must be a boolean");
  if ("note" in rest) {
    const note = asFeedbackString(rest.note, "note");
    if (utf8Bytes(note) > 4096) throw invalidFeedback("note exceeds 4096 UTF-8 bytes");
  }
  if ("text" in rest) {
    const text = asFeedbackString(rest.text, "text");
    if (utf8Bytes(text) > 4096) throw invalidFeedback("text exceeds 4096 UTF-8 bytes");
  }
  if ("context" in rest && jsonUtf8Size(rest.context) > 1024) throw invalidFeedback("context exceeds 1024 UTF-8 bytes");
  for (const key of ["scope_type", "scope_id"] as const) {
    if (!(key in rest)) continue;
    const value = asFeedbackString(rest[key], key);
    if (value.length > 64) throw invalidFeedback(`${key} exceeds 64 code units`);
  }
  for (const key of FEEDBACK_SCORE_KEYS) {
    if (!(key in rest)) continue;
    const value = rest[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5)
      throw invalidFeedback(`${key} must be an integer 1-5`);
  }
  for (const key of FEEDBACK_CODE_UNIT_128) {
    if (!(key in rest)) continue;
    const value = asFeedbackString(rest[key], key);
    if (value.length > 128) throw invalidFeedback(`${key} exceeds 128 code units`);
  }

  const hasNote = "note" in rest;
  const hasText = "text" in rest;
  if (hasNote && hasText && rest.note !== rest.text) throw invalidFeedback("note and text conflict");

  for (const key of Object.keys(rest)) {
    if (!FEEDBACK_WRITE_KEYS.has(key)) throw invalidFeedback(`unknown field ${key}`);
  }

  const body: Record<string, unknown> = { stripped };
  if ("helpful" in rest) body.helpful = rest.helpful;
  if (hasNote) body.note = rest.note;
  else if (hasText) body.note = rest.text;
  if ("context" in rest) body.context = rest.context;
  for (const key of FEEDBACK_SCORE_KEYS) if (key in rest) body[key] = rest[key];
  for (const key of FEEDBACK_CODE_UNIT_128) if (key in rest) body[key] = rest[key];

  const submittedAt = new Date().toISOString();
  body._feedback_provenance = feedbackProvenance(ctx.env.ENVIRONMENT, submittedAt, experience);
  const feedbackId = id("fb");
  const scopeType = "scope_type" in rest ? asFeedbackString(rest.scope_type, "scope_type") : "platform";
  const scopeId = "scope_id" in rest ? asFeedbackString(rest.scope_id, "scope_id") : "-";
  await ctx.db.prepare("INSERT INTO feedback (id, actor, scope_type, scope_id, body, created_at) VALUES (?,?,?,?,?,?)")
    .bind(feedbackId, ctx.principal.id, scopeType, scopeId, JSON.stringify(body), submittedAt).run();
  return { result: { recorded: true, stripped, feedback_id: feedbackId }, scope: { type: "platform", id: "feedback" } };
};

/** Present typed stored fields must match the read projection; otherwise the row is malformed. */
function projectStoredFeedbackBody(raw: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ("helpful" in raw) {
    if (typeof raw.helpful !== "boolean") throw notVisible("feedback");
    body.helpful = raw.helpful;
  }
  if ("note" in raw) {
    if (typeof raw.note !== "string") throw notVisible("feedback");
    body.note = raw.note;
  } else if ("text" in raw) {
    if (typeof raw.text !== "string") throw notVisible("feedback");
    body.note = raw.text;
  }
  if ("context" in raw) body.context = raw.context;
  for (const key of FEEDBACK_SCORE_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) throw notVisible("feedback");
    body[key] = value;
  }
  for (const key of FEEDBACK_CODE_UNIT_128) {
    if (!(key in raw)) continue;
    if (typeof raw[key] !== "string") throw notVisible("feedback");
    body[key] = raw[key];
  }
  if ("stripped" in raw) {
    if (typeof raw.stripped !== "boolean") throw notVisible("feedback");
    body.stripped = raw.stripped;
  } else {
    body.stripped = false;
  }
  return body;
}

type FeedbackRow = { id: string; actor: string | null; scope_type: string | null; scope_id: string | null; body: string; created_at: string };
const FEEDBACK_COLUMNS = "id, actor, scope_type, scope_id, body, created_at";

/** S-only row projection for cap.ops.feedback_get (cap.ops.feedback_list uses it only to skip malformed rows); malformed rows are existence-hidden. */
function projectFeedbackRow(row: FeedbackRow) {
  let stored: unknown;
  try { stored = JSON.parse(row.body); } catch { throw notVisible("feedback"); }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw notVisible("feedback");
  const body = projectStoredFeedbackBody(stored as Record<string, unknown>);
  let provenance;
  try {
    provenance = projectFeedbackProvenance((stored as Record<string, unknown>)._feedback_provenance);
    if (provenance && provenance.submission.submitted_at !== row.created_at) throw notVisible("feedback");
  }
  catch { throw notVisible("feedback"); }
  return {
    id: row.id,
    actor: row.actor ?? "anon",
    scope_type: row.scope_type ?? "platform",
    scope_id: row.scope_id ?? "-",
    created_at: row.created_at,
    body,
    provenance,
  };
}

/** S-only per-row read. Role gate is policy.ts N6; missing/malformed rows are existence-hidden. */
export const opsFeedbackGet: Handler = async (ctx, p) => {
  if (typeof p.id !== "string" || !p.id) throw new CapError("INVALID_PARAMS", "id required");
  const row = await ctx.db.prepare(`SELECT ${FEEDBACK_COLUMNS} FROM feedback WHERE id = ?`)
    .bind(p.id).first<FeedbackRow>();
  if (!row) throw notVisible("feedback");
  return { result: projectFeedbackRow(row) };
};

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
export const FEEDBACK_LIST_DEFAULT = 50;
export const FEEDBACK_LIST_MAX = 200;

/** S-only list-since index for triage (N8 ruling option 2): rows after the composite cursor (created_at, id) —
 * created_at > since, or created_at = since and id > after_id — ordered (created_at, id), at most `limit` scanned.
 * Role gate is policy.ts N6. Each row is the locator `{id, created_at, scope_type}` only — never body, actor, scope_id
 * or provenance; bodies stay behind per-id cap.ops.feedback_get. A row feedback_get would existence-hide (malformed)
 * is skipped here too, so every listed id resolves. `next` is the last scanned row's cursor (malformed rows included)
 * and `has_more` comes from the SQL page (limit+1), so callers page by `next`, not by the last returned row. */
export const opsFeedbackList: Handler = async (ctx, p) => {
  if (typeof p.since !== "string" || !ISO_8601.test(p.since) || Number.isNaN(Date.parse(p.since)))
    throw new CapError("INVALID_PARAMS", "since required (ISO-8601 date-time, e.g. 2026-10-01T00:00:00Z)");
  let limit = FEEDBACK_LIST_DEFAULT;
  if (p.limit !== undefined) {
    const n = typeof p.limit === "string" && /^\d+$/.test(p.limit) ? Number(p.limit) : p.limit;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > FEEDBACK_LIST_MAX)
      throw new CapError("INVALID_PARAMS", `limit must be an integer 1..${FEEDBACK_LIST_MAX}`);
    limit = n;
  }
  if (p.after_id !== undefined && (typeof p.after_id !== "string" || !p.after_id))
    throw new CapError("INVALID_PARAMS", "after_id must be a non-empty string (the id from a previous page's next)");
  const afterId: string | null = typeof p.after_id === "string" ? p.after_id : null;
  const since = new Date(p.since).toISOString();
  const stmt = afterId === null
    ? ctx.db.prepare(`SELECT ${FEEDBACK_COLUMNS} FROM feedback WHERE created_at > ? ORDER BY created_at ASC, id ASC LIMIT ?`)
        .bind(since, limit + 1)
    : ctx.db.prepare(`SELECT ${FEEDBACK_COLUMNS} FROM feedback WHERE created_at > ? OR (created_at = ? AND id > ?) ORDER BY created_at ASC, id ASC LIMIT ?`)
        .bind(since, since, afterId, limit + 1);
  const { results } = await stmt.all<FeedbackRow>();
  const scanned = (results ?? []).slice(0, limit);
  const has_more = (results ?? []).length > limit;
  const rows = [];
  for (const row of scanned) {
    let projected;
    try { projected = projectFeedbackRow(row); } catch (e) { if (!(e instanceof CapError)) throw e; continue; }
    rows.push({ id: projected.id, created_at: projected.created_at, scope_type: projected.scope_type });
  }
  const last = scanned[scanned.length - 1];
  const next = last ? { since: last.created_at, after_id: last.id } : null;
  return { result: { since, after_id: afterId, limit, rows, next, has_more } };
};

export const opsTrace: Handler = async (ctx, p) => {
  const row = await ctx.db.prepare("SELECT actor, spans_json, at FROM trace WHERE trace_id = ?").bind(p.trace_id).first<any>();
  if (!row || (ctx.principal.kind !== "support" && row.actor !== ctx.principal.id)) throw notVisible();
  return { result: { trace_id: p.trace_id, at: row.at, spans: JSON.parse(row.spans_json) } };
};

export const docsCapabilities: Handler = async () => ({ result: contract as any });
export const docsOpenapi: Handler = async () => ({ result: { note: "served as YAML at GET /v2/openapi.yaml", capabilities: byId.size } });
