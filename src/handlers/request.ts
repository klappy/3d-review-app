// cap.request.create — the D1 request route for people who are not provisioned creators. Idempotent per (principal, kind, target) while pending. Lane B (Fable).
import type { Handler } from "./types";
import { CapError } from "./errors";
import { newId, nowIso, reqStr, requireUser } from "./common";

const KINDS = ["workspace", "project", "access"] as const;

export const create: Handler = async (ctx, p) => {
  const principal = requireUser(ctx);
  const kind = reqStr(p, "kind");
  if (!(KINDS as readonly string[]).includes(kind)) throw new CapError("INVALID_PARAMS", `kind must be one of ${KINDS.join(", ")}`, "kind");
  const target = reqStr(p, "target");
  const scope_type = typeof p.scope_type === "string" ? p.scope_type : null;
  const scope_id = typeof p.scope_id === "string" ? p.scope_id : null;
  const existing = await ctx.db.prepare("SELECT id, created_at FROM request WHERE principal_id = ? AND kind = ? AND status = 'pending' AND json_extract(details_json, '$.target') = ?")
    .bind(principal, kind, target).first<{ id: string; created_at: string }>();
  if (existing) return { result: { request_id: existing.id, status: "pending", idempotent: true, created_at: existing.created_at }, scope: { type: "platform", id: "requests" } };
  const id = newId("req");
  await ctx.db.prepare("INSERT INTO request (id, principal_id, kind, scope_type, scope_id, details_json, status, created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, principal, kind, scope_type, scope_id, JSON.stringify({ target, note: typeof p.note === "string" ? p.note.slice(0, 500) : null }), "pending", nowIso(ctx)).run();
  return { result: { request_id: id, status: "pending", idempotent: false, visible_to: "KCS support" }, scope: { type: "platform", id: "requests" } };
};

export const handlers: Record<string, Handler> = { "cap.request.create": create };
