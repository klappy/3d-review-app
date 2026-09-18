// MCP Apps panel wiring (checkpoint 8): the four-tool surface is unchanged; every tool carries the panel resource in _meta;
// resources/list + resources/read serve ONE self-contained HTML resource with the app profile MIME; nothing off-origin.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import worker from "../src/worker";
import { mintSession } from "../src/auth";
import { PANEL_URI, PANEL_MIME } from "../src/mcp";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "mcp-ui", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "mcp-ui-db" }, kvNamespaces: { OAUTH_KV: "mcp-ui-kv" } }] }));
afterAll(() => mf.dispose());
const ORIGIN = "https://3dr.test";
const ectx = () => ({ waitUntil() {}, passThroughOnException() {}, props: undefined }) as any;
const limiter = () => ({ limit: async () => ({ success: true }) });
let env: any; let bearer: string;
function statements(db: D1Database, path: string) { const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n"); return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)); }
beforeAll(async () => {
  const db = await mf.getD1Database("DB");
  for (const f of ["../migrations/0001_init.sql", "../migrations/0002_code_escrow.sql", "../migrations/0003_language_archive.sql", "../migrations/0004_pinned_instruments.sql", "../migrations/0006_oauth_code_redemption.sql", "../migrations/0007_shared_link_context.sql", "../migrations/0008_synthetic_report.sql", "../seed/synthetic.sql"]) await db.batch(statements(db, f));
  env = { DB: db, OAUTH_KV: await mf.getKVNamespace("OAUTH_KV"), SESSION_SECRET: "synthetic-test-secret", ENVIRONMENT: "dev", RL_MCP_ANON: limiter(), RL_HTTP_ANON: limiter(), RL_AUTH: limiter(), RL_REDEEM: limiter(), RL_MCP_CEILING: limiter() };
  bearer = "Bearer " + (await mintSession(env, "person_mara", "user"));
});
const rpc = (body: unknown, token: string | undefined = bearer) => worker.fetch(new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: token } : {}) }, body: JSON.stringify(body) }), env, ectx()).then((r) => r.json() as any);

describe("MCP Apps panel resource", () => {
  it("initialize advertises resources and the ui extension; tools/list is still exactly docs/read/write/danger, each carrying the panel uri in _meta", async () => {
    const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(init.result.capabilities.resources).toBeDefined(); expect(init.result.capabilities.extensions["io.modelcontextprotocol/ui"]).toBeDefined();
    const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(list.result.tools.map((t: any) => t.name)).toEqual(["docs", "read", "write", "danger"]);
    for (const t of list.result.tools) { expect(t._meta.ui.resourceUri).toBe(PANEL_URI); expect(t._meta["ui/resourceUri"]).toBe(PANEL_URI); }
  });
  it("resources/list names the one panel; resources/read serves self-contained HTML with the app-profile MIME; unknown uri is refused", async () => {
    const list = await rpc({ jsonrpc: "2.0", id: 3, method: "resources/list" });
    expect(list.result.resources).toHaveLength(1); expect(list.result.resources[0]).toMatchObject({ uri: PANEL_URI, mimeType: PANEL_MIME });
    const read = await rpc({ jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: PANEL_URI } });
    const c = read.result.contents[0]; expect(c.mimeType).toBe("text/html;profile=mcp-app"); expect(c.text).toContain("window.McpApps = { App:"); expect(c.text).toContain("function card(");
    expect(c.text).not.toMatch(/\bsrc=["']https?:/); expect(c.text).not.toMatch(/\bhref=["']https?:/); expect(c.text).not.toMatch(/@import\s+url\(\s*["']?https?:/);
    for (const s of ["call('read'", "call('write'", "call('danger'"]) expect(c.text).toContain(s); // the panel drives the same tools; no fifth path
    for (const s of ["routeGeneration", "state.executing", "if (g !== gen) return", "if (generation !== routeGeneration) return", "shared-assessments"]) expect(c.text).toContain(s);
    const bad = await rpc({ jsonrpc: "2.0", id: 5, method: "resources/read", params: { uri: "ui://3d-review/other.html" } }); expect(bad.error.code).toBe(-32602);
  });
  it("the committed panel is a fresh build of panel-src (byte lock against source-only drift)", () => {
    const check = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/build-mcp-panel.mjs", import.meta.url)), "--check"], { encoding: "utf8" });
    expect(check.status, check.stderr + check.stdout).toBe(0);
  });
  it("resources need the same authorization as tools (no anonymous MCP)", async () => {
    const r = await worker.fetch(new Request(ORIGIN + "/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 6, method: "resources/read", params: { uri: PANEL_URI } }) }), env, ectx());
    expect(r.status).toBe(401);
  });
  it("the panel's identity read round-trips through the real read tool with the host bearer", async () => {
    const me = await rpc({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "read", arguments: { capability: "cap.auth.me", params: {} } } });
    expect(me.result.structuredContent.ok).toBe(true); expect(me.result.structuredContent.result.principal.id).toBe("person_mara");
  });
});
