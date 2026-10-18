// Typed capability error (shared by handlers, dispatch and receipt.ts; 0.35.18 moved it out of handlers/). The platform envelope maps `code` onto the contract error enum
// (contract/capabilities.json `errors`). Handlers throw; dispatch catches.
export type CapErrorCode =
  | "NOT_AUTHENTICATED"
  | "NOT_AUTHORIZED_AT_SCOPE"
  | "WRONG_TOOL_FOR_CLASS"
  | "CONFIRM_REQUIRED"
  | "CONFIRM_EXPIRED"
  | "INVALID_PARAMS"
  | "NOT_FOUND_OR_NOT_VISIBLE"
  | "STAGE_CONFLICT"
  | "RESERVED_NOT_BUILT"
  | "NO_INVERSE"
  | "RATE_LIMITED";

export class CapError extends Error {
  readonly code: CapErrorCode;
  readonly hint?: string;
  readonly docs?: string;
  /** RATE_LIMITED only: seconds until a retry can work, when it is not the one-minute limiter window. */
  readonly retryAfter?: number;
  constructor(code: CapErrorCode, message: string, hint?: string, docs?: string, retryAfter?: number) {
    super(message);
    this.retryAfter = retryAfter;
    this.name = "CapError";
    this.code = code;
    this.hint = hint;
    this.docs = docs;
  }
}

/** Existence is never leaked: a missing row and an invisible row read the same. */
export function notVisible(what = "resource"): CapError {
  return new CapError("NOT_FOUND_OR_NOT_VISIBLE", `${what} not found or not visible`);
}

/** SQLite constraint failure as D1 reports it (miniflare and production both surface the SQLite text, sometimes only on `cause`). */
const CONSTRAINT = /UNIQUE constraint failed|PRIMARY KEY constraint failed|SQLITE_CONSTRAINT/i;
export function isConstraintError(e: unknown): boolean {
  const msg = `${e instanceof Error ? e.message : String(e)} ${e instanceof Error && e.cause instanceof Error ? e.cause.message : ""}`;
  return CONSTRAINT.test(msg);
}
