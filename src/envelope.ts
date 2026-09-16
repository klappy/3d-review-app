export interface Receipt {
  id: string; actor: string; scope: { type: string; id: string }; class: string;
  inverse: string; undo_token?: string; compensating_control?: string; trace_id: string; at: string;
  mode?: "dry_run" | "execute";
}
export const ok = (capability: string, result: Record<string, unknown>, trace_id: string, receipt?: Receipt) =>
  ({ ok: true as const, capability, result, trace_id, ...(receipt ? { receipt } : {}) });
export const fail = (code: string, message: string, hint?: string, docs?: string, trace_id?: string) =>
  ({ ok: false as const, error: { code, message, ...(hint ? { hint } : {}), ...(docs ? { docs } : {}) }, ...(trace_id ? { trace_id } : {}) });
export const statusFor = (code: string): number =>
  ({ NOT_AUTHENTICATED: 401, NOT_AUTHORIZED_AT_SCOPE: 403, WRONG_TOOL_FOR_CLASS: 400, CONFIRM_REQUIRED: 409, CONFIRM_EXPIRED: 409,
     INVALID_PARAMS: 400, NOT_FOUND_OR_NOT_VISIBLE: 404, STAGE_CONFLICT: 409, RESERVED_NOT_BUILT: 501, NO_INVERSE: 409 } as Record<string, number>)[code] ?? 400;
