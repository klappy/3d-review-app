/**
 * MCP over streamable HTTP (JSON-RPC 2.0, POST /mcp). Exactly four tools: docs / read / write / danger.
 * Written reason for four (canon klappy://canon/constraints/mcp-tool-surface-ceiling): the read/write/danger split is the
 * host-level permission boundary; the telemetry role rides `read cap.ops.trace` + trace_id on every envelope.
 * Every tools/call goes through the same execute() the HTTP twins use — no fifth path.
 */
import type { Ctx } from "./handlers/types";
import { tools as toolNames } from "./registry";

export type Execute = (ctx: Ctx, capability: string, params: Record<string, any>, options: { tool?: any; mode?: "dry_run" | "execute"; confirm_token?: string; transport?: "http" | "mcp" }) => Promise<any>;
export type Docs = (ctx: Ctx, args: Record<string, any>) => Promise<any>;

const TOOL_DEFS = [
  { name: "docs", description: "Front door. No args → orientation (what 3D Review is, the four tools, auth, capability index, your roles). {capability} → that capability's page. {topic} → glossary | permissions | reversibility | telemetry | privacy | stages. {role, scope} → what you can do here. {q} → search. Role-aware, never role-leaking.",
    inputSchema: { type: "object", properties: { capability: { type: "string" }, topic: { type: "string" }, role: { type: "string" }, scope: { type: "object", properties: { type: { type: "string" }, id: { type: "string" } } }, q: { type: "string" } } } },
  { name: "read", description: "Execute any class=read capability by id. Same handler, receipt and errors as the HTTP twin.",
    inputSchema: { type: "object", required: ["capability"], properties: { capability: { type: "string" }, params: { type: "object" } } } },
  { name: "write", description: "Execute any class=write.reversible capability; returns a receipt (+ undo_token only when a true inverse is declared). {undo: token} reverses; NO_INVERSE otherwise.",
    inputSchema: { type: "object", properties: { capability: { type: "string" }, params: { type: "object" }, undo: { type: "string" } } } },
  { name: "danger", description: "Execute class=write.dangerous and write.effect capabilities in two steps: mode=dry_run → impact + confirm_token; mode=execute with confirm_token. Effects (sends, grants, releases) and destructive rows live here. No fifth tool.",
    inputSchema: { type: "object", required: ["capability", "mode"], properties: { capability: { type: "string" }, params: { type: "object" }, mode: { type: "string", enum: ["dry_run", "execute"] }, confirm_token: { type: "string" } } } },
];

const rpc = (id: any, result?: any, error?: { code: number; message: string; data?: any }) =>
  ({ jsonrpc: "2.0", id, ...(error ? { error } : { result }) });

export async function handleMcp(req: Request, ctx: Ctx, execute: Execute, docs: Docs): Promise<Response> {
  let msg: any;
  try { msg = await req.json(); } catch { return json(rpc(null, undefined, { code: -32700, message: "parse error" }), 400); }
  const batch = Array.isArray(msg) ? msg : [msg];
  const out: any[] = [];
  for (const m of batch) {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") { out.push(rpc(m?.id ?? null, undefined, { code: -32600, message: "invalid request" })); continue; }
    if (m.id === undefined) continue; // notifications
    switch (m.method) {
      case "initialize":
        out.push(rpc(m.id, { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "3d-review", version: "0.0.1-phase0" },
          instructions: "Call docs with no arguments first. Four tools only (docs/read/write/danger); the split is the permission boundary. Every envelope carries trace_id." }));
        break;
      case "ping": out.push(rpc(m.id, {})); break;
      case "tools/list": out.push(rpc(m.id, { tools: TOOL_DEFS })); break;
      case "tools/call": {
        const name = m.params?.name; const a = m.params?.arguments ?? {};
        if (!toolNames.includes(name)) { out.push(rpc(m.id, undefined, { code: -32602, message: `unknown tool ${name}; tools are ${toolNames.join(", ")}` })); break; }
        let env: any;
        if (name === "docs") env = await docs(ctx, a);
        else if (name === "write" && a.undo) env = await execute(ctx, "cap.ops.undo", { token: a.undo }, { tool: "write", transport: "mcp" });
        else env = await execute(ctx, a.capability, a.params ?? {}, { tool: name, mode: a.mode, confirm_token: a.confirm_token, transport: "mcp" });
        out.push(rpc(m.id, { content: [{ type: "text", text: JSON.stringify(env) }], structuredContent: env, isError: env?.ok === false }));
        break;
      }
      default: out.push(rpc(m.id, undefined, { code: -32601, message: `method not found: ${m.method}` }));
    }
  }
  return json(Array.isArray(msg) ? out : out[0] ?? null, 200);
}

const json = (b: any, status: number) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
