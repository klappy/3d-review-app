// Typed handler error. The platform envelope maps `code` onto the contract error enum
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
  constructor(code: CapErrorCode, message: string, hint?: string, docs?: string) {
    super(message);
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
