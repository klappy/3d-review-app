// Optional account display name (captain ruling a1, 2026-10-02; cookbook
// work/queued/2026-09-29-3d-train22-audit-backlog/RULING-2026-10-02-greet-alias.md): cap.me.update sets/clears the
// caller's OWN name; cap.auth.me returns it. HTTP and MCP twins, connector (OAuth) principal, undo, refusals, limits.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { byId } from "../src/registry";
import { oauthPrincipals, principalFromProps } from "../src/oauth";
import { cleanDisplayName } from "../src/handlers/me";

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "display-name", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "display-name-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

let db: D1Database;
let env: any;
let mara: string, ion: string, support: string, participant: string;
const MIGRATIONS = ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql", "0007_shared_link_context.sql", "0015_display_name.sql"];

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of MIGRATIONS) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-display-name", ENVIRONMENT: "dev" };
  await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)")
    .bind("person_support_dn", "synthetic_hash_support_dn", 1, 1, "2026-09-17T00:00:00.000Z").run();
  mara = await mintSession(env, "person_mara", "user");
  ion = await mintSession(env, "person_ion", "user");
  support = await mintSession(env, "person_support_dn", "support");
  participant = await mintSession(env, "resp_dn_1", "participant", { participant_survey_id: "survey_tavo", respondent_id: "resp_dn_1" });
}, 60_000);

const stored = async (id: string) => (await db.prepare("SELECT display_name FROM principal WHERE id = ?").bind(id).first<{ display_name: string | null }>())!.display_name;
async function http(method: string, path: string, bearer?: string, body?: unknown, req?: (r: Request) => void) {
  const r = new Request(`https://t.invalid${path}`, { method, headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  req?.(r);
  const res = await app.fetch(r, env);
  return { status: res.status, json: await res.json() as any };
}
const setName = (bearer: string | undefined, body: unknown) => http("PATCH", "/v2/me", bearer, body);
const me = (bearer: string) => http("GET", "/v2/me", bearer);
async function mcp(tool: string, args: Record<string, unknown>, bearer?: string, req?: (r: Request) => void) {
  const r = new Request("https://t.invalid/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
  });
  req?.(r);
  const j: any = await (await app.fetch(r, env)).json();
  return j.result?.structuredContent ?? j.result ?? j;
}

describe("cap.me.update contract row", () => {
  it("is a write.reversible on the existing write tool, PATCH /v2/me, own account only, with a true inverse", () => {
    const c = byId.get("cap.me.update")!;
    expect([c.class, c.tool, c.public, c.http.method, c.http.path, c.inverse.kind, c.inverse.via, c.undo_token]).toEqual(["write.reversible", "write", false, "PATCH", "/v2/me", "true", "self:restore-prior", true]);
    expect(c.roles).toBe("any signed-in (own account only)");
    expect(c.params_schema?.properties).toHaveProperty("display_name");
  });
  it("appears in docs: its capability page and the index", async () => {
    const page = await mcp("docs", { capability: "cap.me.update" }, mara);
    expect(page.result?.capability ?? page.capability).toBe("cap.me.update");
    const idx = await mcp("docs", {}, mara);
    const index = (idx.result ?? idx).index;
    expect(index["A. Entry, identity, session"]).toContain("cap.me.update");
  });
});

describe("name normalization and limits", () => {
  it("trims, collapses inner whitespace, clears on null/empty, caps at 60 characters", () => {
    expect(cleanDisplayName("  Mara   K.  ")).toBe("Mara K.");
    expect(cleanDisplayName("")).toBeNull();
    expect(cleanDisplayName("   ")).toBeNull();
    expect(cleanDisplayName(null)).toBeNull();
    expect(cleanDisplayName("é".repeat(60))).toBe("é".repeat(60));
    expect(() => cleanDisplayName("x".repeat(61))).toThrow(/at most 60/);
    for (const bad of ["a\nb", "a\tb", "a‮b", "a\u0000b", 5, {}, []]) expect(() => cleanDisplayName(bad as any)).toThrow();
  });
});

describe("HTTP twin: PATCH /v2/me then GET /v2/me", () => {
  it("/v2/me returns display_name null before any is set", async () => {
    const r = await me(ion);
    expect(r.json.ok).toBe(true);
    expect(r.json.result.principal.display_name).toBeNull();
  });
  it("sets the caller's own name with a receipt and undo token; /v2/me reads it back; undo restores the prior value", async () => {
    const r = await setName(mara, { display_name: "  Mara  <b>K</b> " });
    expect(r.json.ok).toBe(true);
    expect(r.json.result).toEqual({ display_name: "Mara <b>K</b>" }); // stored as text; every screen escapes on render
    expect(r.json.receipt.undo_token).toBeTruthy();
    expect(r.json.receipt.scope).toEqual({ type: "platform", id: "person_mara" });
    expect((await me(mara)).json.result.principal.display_name).toBe("Mara <b>K</b>");
    // nobody else's row moved
    expect(await stored("person_ion")).toBeNull();
    // the receipt keeps the prior name only, not the new one
    const row = await db.prepare("SELECT prior_state_json FROM receipt WHERE undo_token = ?").bind(r.json.receipt.undo_token).first<{ prior_state_json: string }>();
    expect(JSON.parse(row!.prior_state_json)).toMatchObject({ prior: { display_name: null }, params: {} });
    const u = await http("POST", `/v2/undo/${r.json.receipt.undo_token}`, mara, {});
    expect(u.json.ok).toBe(true);
    expect(await stored("person_mara")).toBeNull();
  });
  it("clears with null or an empty string", async () => {
    await setName(mara, { display_name: "Mara" });
    expect((await setName(mara, { display_name: "" })).json.result.display_name).toBeNull();
    await setName(mara, { display_name: "Mara" });
    expect((await setName(mara, { display_name: null })).json.result.display_name).toBeNull();
    expect(await stored("person_mara")).toBeNull();
  });
  it("refuses too long, wrong type, missing field, and any attempt to name another account", async () => {
    expect((await setName(mara, { display_name: "x".repeat(61) })).json.error.code).toBe("INVALID_PARAMS");
    expect((await setName(mara, { display_name: 7 })).json.error.code).toBe("INVALID_PARAMS");
    expect((await setName(mara, {})).json.error.code).toBe("INVALID_PARAMS");
    for (const k of ["id", "principal_id", "account", "email"]) {
      const r = await setName(mara, { display_name: "Not Ion", [k]: "person_ion" });
      expect(r.json.error.code).toBe("INVALID_PARAMS");
    }
    expect(await stored("person_ion")).toBeNull();
    expect(await stored("person_mara")).toBeNull();
  });
  it("anonymous and participants are refused and write nothing", async () => {
    expect((await setName(undefined, { display_name: "Anon" })).json.error.code).toBe("NOT_AUTHENTICATED");
    expect((await setName(participant, { display_name: "P" })).json.error.code).toBe("NOT_AUTHORIZED_AT_SCOPE");
    const n = await db.prepare("SELECT COUNT(*) AS c FROM principal WHERE display_name IS NOT NULL").first<{ c: number }>();
    expect(Number(n!.c)).toBe(0);
  });
  it("another account (even support) cannot undo a name change: undo is the owner's own", async () => {
    const r = await setName(mara, { display_name: "Mara" });
    const u = await http("POST", `/v2/undo/${r.json.receipt.undo_token}`, support, {});
    expect(u.json.ok).toBe(false);
    expect(u.json.error.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    expect(await stored("person_mara")).toBe("Mara");
    expect(await stored("person_support_dn")).toBeNull();
    await setName(mara, { display_name: null });
  });
});

describe("MCP twin: tools/call write cap.me.update then read cap.auth.me", () => {
  it("sets over /mcp and reads it back over /mcp; read cap.auth.me carries display_name", async () => {
    const w = await mcp("write", { capability: "cap.me.update", params: { display_name: "Ion over MCP" } }, ion);
    expect(w.ok).toBe(true);
    expect(w.result.display_name).toBe("Ion over MCP");
    expect(w.receipt.undo_token).toBeTruthy();
    const r = await mcp("read", { capability: "cap.auth.me", params: {} }, ion);
    expect(r.ok).toBe(true);
    expect(r.result.principal.display_name).toBe("Ion over MCP");
    // undo over MCP: write {undo}
    const u = await mcp("write", { undo: w.receipt.undo_token }, ion);
    expect(u.ok).toBe(true);
    expect((await mcp("read", { capability: "cap.auth.me", params: {} }, ion)).result.principal.display_name).toBeNull();
  });
  it("is refused on the read and danger tools (WRONG_TOOL_FOR_CLASS)", async () => {
    expect((await mcp("read", { capability: "cap.me.update", params: { display_name: "x" } }, ion)).error.code).toBe("WRONG_TOOL_FOR_CLASS");
    expect((await mcp("danger", { capability: "cap.me.update", params: { display_name: "x" }, mode: "dry_run" }, ion)).error.code).toBe("WRONG_TOOL_FOR_CLASS");
    expect(await stored("person_ion")).toBeNull();
  });
  it("a connector (OAuth) principal sets the granting person's own name, never anyone else's", async () => {
    // The worker entry resolves a provider-issued grant into this principal (src/worker.ts); the test binds it the same way.
    const p = await principalFromProps(env, { principal_id: "person_ion", client_id: "client_dn" } as any);
    expect(p).toMatchObject({ kind: "user", id: "person_ion", delegatedBy: "oauth:client_dn" });
    const bind = (r: Request) => { oauthPrincipals.set(r, p!); };
    const w = await mcp("write", { capability: "cap.me.update", params: { display_name: "Ion via app" } }, undefined, bind);
    expect(w.ok).toBe(true);
    expect(await stored("person_ion")).toBe("Ion via app");
    expect(await stored("person_mara")).toBeNull();
    const read = await mcp("read", { capability: "cap.auth.me", params: {} }, undefined, bind);
    expect(read.result.principal).toMatchObject({ id: "person_ion", display_name: "Ion via app", delegated_by: "oauth:client_dn" });
    // naming another account through the connector is refused, and nothing moves
    const other = await mcp("write", { capability: "cap.me.update", params: { display_name: "Mara?", principal_id: "person_mara" } }, undefined, bind);
    expect(other.error.code).toBe("INVALID_PARAMS");
    expect(await stored("person_mara")).toBeNull();
    // the HTTP twin with the same connector principal behaves the same
    const h = await http("PATCH", "/v2/me", undefined, { display_name: null }, bind);
    expect(h.json.ok).toBe(true);
    expect(await stored("person_ion")).toBeNull();
  });
});

describe("before migration 0015 is applied", () => {
  it("/v2/me still answers with display_name null, and the write says it is not available yet", async () => {
    const mf2 = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "dn-pre", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "dn-pre-db" } }] }));
    try {
      const db2 = await mf2.getD1Database("DB");
      for (const m of MIGRATIONS.filter((m) => m !== "0015_display_name.sql")) await db2.batch(statements(db2, `../migrations/${m}`));
      await db2.batch(statements(db2, "../seed/synthetic.sql"));
      const env2 = { DB: db2, SESSION_SECRET: "synthetic-dn-pre", ENVIRONMENT: "dev" };
      const t = await mintSession(env2 as any, "person_mara", "user");
      const r = await app.fetch(new Request("https://t.invalid/v2/me", { headers: { authorization: `Bearer ${t}` } }), env2);
      const j: any = await r.json();
      expect(j.ok).toBe(true);
      expect(j.result.principal.display_name).toBeNull();
      const w = await app.fetch(new Request("https://t.invalid/v2/me", { method: "PATCH", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ display_name: "Mara" }) }), env2);
      expect(((await w.json()) as any).error.code).toBe("RESERVED_NOT_BUILT");
    } finally { await mf2.dispose(); }
  });
});
