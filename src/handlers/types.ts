export type Role = "owner" | "member" | "viewer";
export type ScopeType = "workspace" | "project" | "assessment" | "survey" | "platform";
export interface Principal {
  kind: "user" | "participant" | "support" | "anonymous";
  id: string;
  email?: string;
  provisioned?: boolean;
  delegatedBy?: string;
  supportActor?: string;
  participantSurveyId?: string;
  respondentId?: string;
}
export interface Env { DB: D1Database; SESSION_SECRET: string; ENVIRONMENT?: string }
export interface Ctx {
  env: Env;
  db: D1Database;
  principal: Principal;
  traceId: string;
  now: () => Date;
  log: (span: string, data?: Record<string, unknown>) => void;
}
export interface Impact {
  affected: unknown[];
  irreversible: boolean;
  effect: "external" | "disclosure" | "destructive";
  retention?: string;
  compensating_control?: string;
}
export interface HandlerResult {
  result: Record<string, unknown>;
  scope?: { type: ScopeType; id: string };
  priorState?: Record<string, unknown>;
  impact?: Impact;
}
export type Handler = (ctx: Ctx, params: Record<string, any>, opts?: { dryRun?: boolean }) => Promise<HandlerResult>;

export class CapError extends Error {
  constructor(public code: string, message: string, public hint?: string, public docs?: string) { super(message); }
}
export const notVisible = () => new CapError("NOT_FOUND_OR_NOT_VISIBLE", "not found or not visible", "check the id and your grants; existence is not disclosed");
export const id = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
export async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
