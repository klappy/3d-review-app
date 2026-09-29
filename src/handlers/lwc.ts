// Translation languages (LWCs) on a project / an assessment — captain ruling 2026-09-28, see src/languages.ts.
// Kept out of patchOf (which takes strings only): `lwc` is a list of BCP 47 tags (or "lo,th"), validated against the
// supported-language table, stored as JSON in lwc_json (migration 0012).
import type { Ctx } from "./types";
import { CapError } from "./errors";
import { normalizeLwc, parseLwc } from "../languages";

/** Removes `lwc` from params; returns the validated codes (undefined when not sent). */
export function takeLwc(params: Record<string, unknown>): string[] | undefined {
  if (!("lwc" in params)) return undefined;
  const raw = params.lwc; delete params.lwc;
  const n = normalizeLwc(raw);
  if ("error" in n) throw new CapError("INVALID_PARAMS", n.error, "lwc:supported codes are listed in src/languages.ts");
  return n.codes;
}
const missingColumn = (e: unknown) => /no such column: lwc_json|has no column named lwc_json/i.test(`${(e as Error)?.message ?? e} ${((e as Error)?.cause as Error)?.message ?? ""}`);
export async function saveLwc(ctx: Ctx, table: "project" | "assessment", id: string, codes: string[]): Promise<void> {
  try { await ctx.db.prepare(`UPDATE ${table} SET lwc_json = ? WHERE id = ?`).bind(JSON.stringify(codes), id).run(); }
  catch (e) { if (missingColumn(e)) throw new CapError("STAGE_CONFLICT", "translation languages need database update 0012 first", "ask the 3D team to apply migration 0012"); throw e; }
}
/** Create paths: store if possible; a database without 0012 keeps the new row and reports lwc: [] instead of failing. */
export async function saveLwcOnCreate(ctx: Ctx, table: "project" | "assessment", id: string, codes: string[] | undefined): Promise<string[]> {
  if (!codes || !codes.length) return [];
  try { await saveLwc(ctx, table, id, codes); return codes; } catch (e) { if (e instanceof CapError && e.code === "STAGE_CONFLICT") return []; throw e; }
}
export const lwcOf = (row: unknown) => parseLwc((row as { lwc_json?: unknown } | null)?.lwc_json ?? "[]");
