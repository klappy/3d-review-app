import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";

const PORT = Number(process.env.SPEC_PORT ?? 3101);
const URL_ = `http://localhost:${PORT}/mcp`;
let child;

async function rpc(method, params) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e6), method, params }),
  });
  const text = await res.text();
  const body = text.startsWith("event:") || text.startsWith("data:")
    ? JSON.parse(text.split("\n").find(l => l.startsWith("data:")).slice(5).trim())
    : JSON.parse(text);
  assert.ok(!body.error, `rpc ${method} failed: ${JSON.stringify(body.error)}`);
  return body.result;
}

before(async () => {
  child = spawn(process.execPath, [path.join(import.meta.dirname, "server.mjs")], {
    env: { ...process.env, PORT: String(PORT), RPC_LOG: path.join(tmpdir(), "spike-spec-rpc.jsonl") },
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "spec", version: "0" } });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error("spike server did not start");
});

after(() => child?.kill());

test("tools/list carries _meta.ui.resourceUri for both tools", async () => {
  const { tools } = await rpc("tools/list", {});
  const byName = Object.fromEntries(tools.map(t => [t.name, t]));
  assert.equal(byName.assessment_overview._meta.ui.resourceUri, "ui://3d-review/overview.html");
  assert.equal(byName.survey_selector._meta.ui.resourceUri, "ui://3d-review/selector.html");
});

test("resources/read returns the MCP Apps MIME type and self-contained HTML", async () => {
  for (const uri of ["ui://3d-review/overview.html", "ui://3d-review/selector.html"]) {
    const { contents } = await rpc("resources/read", { uri });
    assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
    assert.match(contents[0].text, /window\.McpApps/);
    assert.ok(!/src="http/.test(contents[0].text), "view must not load a remote script");
  }
});

test("tools/call error fixture returns the fail envelope with isError", async () => {
  const result = await rpc("tools/call", { name: "assessment_overview", arguments: { fixture: "error" } });
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent.ok, false);
  assert.equal(result.structuredContent.error.code, "NOT_VISIBLE");
});

test("tools/call default fixture carries the fixture label and 8 surveys", async () => {
  const result = await rpc("tools/call", { name: "assessment_overview", arguments: { fixture: "default" } });
  assert.equal(result.structuredContent.fixture.label, "Fixture data — not live");
  assert.equal(result.structuredContent.surveys.length, 8);
});
