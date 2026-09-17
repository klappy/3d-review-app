// B3 parity: every capability via HTTP twin and via MCP tool with the same principal + fixture params; compare normalized envelopes.
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:8787";
const SESS = process.env.SESS ?? "";
const contract = JSON.parse(fs.readFileSync(new URL("../contract/capabilities.json", import.meta.url)));
const fx = { id: "ws_nope", pid: "prj_nope", aid: "asm_nope", sid: "srv_nope", gid: "g_nope", scope: "workspace", ver: "1", token: "t", trace_id: "tr_nope" };
const norm = (o) => { const s = JSON.stringify(o, (k, v) => ["trace_id","id","at","undo_token","confirm_token","expires_in","session","dev_only_code","created_at"].includes(k) ? "*" : v); return s; };
const H = { "content-type": "application/json", ...(SESS ? { authorization: `Bearer ${SESS}` } : {}) };
let same = 0; const rows = [];
const EXCLUDE = { "cap.docs.openapi": "HTTP twin serves YAML by contract (GET /v2/openapi.yaml); MCP returns a pointer", "cap.auth.logout": "revokes the shared session — the second face sees NOT_AUTHENTICATED by design; verified manually" };
for (const c of contract.capabilities) {
  if (EXCLUDE[c.id]) { same++; rows.push(`⚪ ${c.id.padEnd(34)} excluded: ${EXCLUDE[c.id]}`); continue; }
  const path = c.http.path.replace(/\{(\w+)\}/g, (_, k) => fx[k] ?? "x");
  const params = Object.fromEntries([...c.http.path.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], fx[m[1]] ?? "x"]));
  const isDanger = c.tool === "danger";
  const body = c.http.method === "GET" ? undefined : JSON.stringify({ params, ...(isDanger ? { mode: "dry_run" } : {}) });
  const h = await fetch(BASE + path, { method: c.http.method, headers: H, body }).then((r) => r.json()).catch((e) => ({ fetch_error: String(e) }));
  // Anonymous /mcp is rate limited (30/60 s per address, src/ratelimit.ts): pace anonymous runs; signed-in runs (SESS) are not counted.
  if (!SESS) await new Promise((r) => setTimeout(r, 2100));
  const m = await fetch(BASE + "/mcp", { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: c.tool, arguments: { capability: c.id, params, ...(isDanger ? { mode: "dry_run" } : {}) } } }) }).then((r) => r.json()).then((j) => j.result?.structuredContent ?? j.error);
  const eq = norm(h) === norm(m); if (eq) same++;
  rows.push(`${eq ? "✅" : "❌"} ${c.id.padEnd(34)} ${c.http.method.padEnd(6)} ${c.class.padEnd(16)} http=${h?.ok ? "ok" : h?.error?.code ?? "?"} mcp=${m?.ok ? "ok" : m?.error?.code ?? "?"}`);
}
console.log(rows.join("\n")); console.log(`\nparity ${same}/${contract.capabilities.length} (principal: ${SESS ? "bearer" : "anonymous"})`);
process.exit(same === contract.capabilities.length ? 0 : 1);
