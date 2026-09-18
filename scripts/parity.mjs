// B3 parity: HTTP twin vs MCP for the same principal. EXCLUDE rows never increment same.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const NORM_KEYS = Object.freeze(["trace_id", "id", "at", "undo_token", "confirm_token", "expires_in", "session", "dev_only_code", "created_at"]);
export const EXCLUDE = Object.freeze({
  "cap.docs.openapi": "HTTP twin serves YAML by contract (GET /v2/openapi.yaml); MCP returns a pointer",
  "cap.auth.logout": "revokes the shared session — the second face sees NOT_AUTHENTICATED by design; verified manually",
});

export function norm(o) {
  return JSON.stringify(o, (k, v) => (NORM_KEYS.includes(k) ? "*" : v));
}

export function compare(http, mcp) {
  const httpNorm = norm(http);
  const mcpNorm = norm(mcp);
  const eq = httpNorm === mcpNorm;
  const reserved = http?.error?.code === "RESERVED_NOT_BUILT" && mcp?.error?.code === "RESERVED_NOT_BUILT";
  let tag;
  if (!eq) tag = "DIFFER";
  else if (http?.ok === true && mcp?.ok === true) tag = "RESULT-PARITY";
  else tag = "REFUSAL-PARITY";
  return { eq, tag, reserved, httpNorm, mcpNorm };
}

export function summarizeParity(entries, contractLength) {
  let same = 0, compared = 0, differ = 0, excluded = 0, refusal = 0, result = 0, reserved = 0;
  for (const r of entries) {
    if (r.excluded) { excluded++; continue; }
    compared++;
    if (r.eq) {
      same++;
      if (r.tag === "REFUSAL-PARITY") refusal++;
      if (r.tag === "RESULT-PARITY") result++;
      if (r.reserved) reserved++;
    } else differ++;
  }
  const line = `parity same=${same}/compared=${compared} · excluded=${excluded} (docs.openapi, auth.logout) · contract=${contractLength}`;
  const extra = `refusal-parity ${refusal} · result-parity ${result} · reserved ${reserved}`;
  const normLine = `norm keys: ${NORM_KEYS.join(", ")} (nested id blanking kept)`;
  const caveat = "placeholder ids prove refusal-parity only; FX real-fixture mode is deferred";
  const text = [line, extra, normLine, caveat].join("\n");
  return { same, compared, excluded, differ, refusal, result, reserved, contract: contractLength, line, extra, text, exitCode: differ > 0 ? 1 : 0 };
}

export function isMainModule(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  return Boolean(argv1) && metaUrl === pathToFileURL(argv1).href;
}

export async function runParity({
  base = process.env.BASE ?? "http://localhost:8787",
  sess = process.env.SESS ?? "",
  contract = JSON.parse(fs.readFileSync(new URL("../contract/capabilities.json", import.meta.url))),
  fetchImpl = fetch,
} = {}) {
  if (!sess) {
    return { missingSess: true, exitCode: 2 };
  }
  const H = { "content-type": "application/json", authorization: `Bearer ${sess}` };
  const fx = { id: "ws_nope", pid: "prj_nope", aid: "asm_nope", sid: "srv_nope", gid: "g_nope", scope: "workspace", ver: "1", token: "t", trace_id: "tr_nope" };
  const entries = [];
  const printed = [];
  const diffs = [];
  for (const c of contract.capabilities) {
    if (EXCLUDE[c.id]) {
      entries.push({ id: c.id, excluded: true });
      printed.push(`⚪ ${c.id.padEnd(34)} excluded: ${EXCLUDE[c.id]}`);
      continue;
    }
    const path = c.http.path.replace(/\{(\w+)\}/g, (_, k) => fx[k] ?? "x");
    const params = Object.fromEntries([...c.http.path.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], fx[m[1]] ?? "x"]));
    const isDanger = c.tool === "danger";
    const body = c.http.method === "GET" ? undefined : JSON.stringify({ params, ...(isDanger ? { mode: "dry_run" } : {}) });
    const h = await fetchImpl(base + path, { method: c.http.method, headers: H, body }).then((r) => r.json()).catch((e) => ({ fetch_error: String(e) }));
    const m = await fetchImpl(base + "/mcp", { method: "POST", headers: H, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: c.tool, arguments: { capability: c.id, params, ...(isDanger ? { mode: "dry_run" } : {}) } } }) }).then((r) => r.json()).then((j) => j.result?.structuredContent ?? j.error).catch((e) => ({ fetch_error: String(e) }));
    const cmp = compare(h, m);
    entries.push({ id: c.id, excluded: false, eq: cmp.eq, tag: cmp.tag, reserved: cmp.reserved });
    const mark = cmp.eq ? "✅" : "❌";
    const reserved = cmp.reserved ? " reserved" : "";
    printed.push(`${mark} ${c.id.padEnd(34)} ${c.http.method.padEnd(6)} ${c.class.padEnd(16)} ${cmp.tag}${reserved} http=${h?.ok ? "ok" : h?.error?.code ?? "?"} mcp=${m?.ok ? "ok" : m?.error?.code ?? "?"}`);
    if (!cmp.eq) diffs.push({ id: c.id, http: cmp.httpNorm, mcp: cmp.mcpNorm });
  }
  const summary = summarizeParity(entries, contract.capabilities.length);
  return { entries, printed, diffs, summary, exitCode: summary.exitCode, missingSess: false };
}

export async function main(env = process.env) {
  const sess = env.SESS ?? "";
  if (!sess) {
    console.error("parity needs SESS=<bearer>: /mcp answers 401 without a credential (MCP authorization, src/oauth.ts)");
    process.exitCode = 2;
    return 2;
  }
  const { printed, diffs, summary, exitCode } = await runParity({ base: env.BASE ?? "http://localhost:8787", sess });
  console.log(printed.join("\n"));
  if (diffs.length) {
    console.log("\ndiffer envelopes (normalized):");
    for (const d of diffs) console.log(`${d.id}\n  http=${d.http}\n  mcp=${d.mcp}`);
  }
  console.log(`\n${summary.text}`);
  process.exitCode = exitCode;
  return exitCode;
}

if (isMainModule()) {
  main().then((code) => process.exit(code));
}
