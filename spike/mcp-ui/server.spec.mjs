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
  }
});

/**
 * No-CDN guard: the served resource must reference nothing off-origin — not just no remote
 * <script>. Any http(s):// reached through url() or @import inside the served CSS, or
 * through src= / href= anywhere in the served HTML, fails. data: and blob: are allowed.
 * url()/@import are checked inside <style> only, because JS in the bundle legitimately
 * constructs `new URL("https://…")` values that are never fetched; src=/href= are checked
 * over the whole document. The DEV root in the overview view is a JS string handed to
 * ui/open-link, so it appears in none of the four reference forms.
 */
test("served HTML/CSS references no http(s):// URL in url()/@import/src=/href=", async () => {
  const CSS_FORMS = [
    [/url\(\s*['"]?\s*(https?:\/\/[^'")\s]+)/gi, "url()"],
    [/@import[^;]*?(https?:\/\/[^'")\s;]+)/gi, "@import"],
  ];
  const HTML_FORMS = [
    [/\bsrc\s*=\s*['"]?(https?:\/\/[^'"\s>]+)/gi, "src="],
    [/\bhref\s*=\s*['"]?(https?:\/\/[^'"\s>]+)/gi, "href="],
  ];
  for (const uri of ["ui://3d-review/overview.html", "ui://3d-review/selector.html"]) {
    const { contents } = await rpc("resources/read", { uri });
    const html = contents[0].text;
    const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join("\n");
    assert.ok(css.length > 1000, "expected the design-system CSS to be inlined in a <style> block");
    const found = [];
    for (const [re, label] of CSS_FORMS) for (const m of css.matchAll(re)) found.push(`${label} -> ${m[1]}`);
    for (const [re, label] of HTML_FORMS) for (const m of html.matchAll(re)) found.push(`${label} -> ${m[1]}`);
    assert.deepEqual(found, [], `${uri} references off-origin resources: ${found.join(", ")}`);
  }
});

test("views root the design system: body carries class=\"rv\" (components.css is .rv-scoped)", async () => {
  for (const uri of ["ui://3d-review/overview.html", "ui://3d-review/selector.html"]) {
    const { contents } = await rpc("resources/read", { uri });
    assert.match(contents[0].text, /<body class="rv" data-view-state="loading">/);
  }
});

test("tools/call error fixture returns the fail envelope with isError", async () => {
  const result = await rpc("tools/call", { name: "assessment_overview", arguments: { fixture: "error" } });
  assert.equal(result.isError, true);
  const env = result.structuredContent;
  // Shape is src/envelope.ts fail(); message is src/handlers/errors.ts notVisible("assessment").
  assert.deepEqual(env.ok, false);
  assert.equal(env.error.code, "NOT_FOUND_OR_NOT_VISIBLE");
  assert.equal(env.error.message, "assessment not found or not visible");
  assert.equal(typeof env.error.hint, "string");
  assert.match(env.trace_id, /^tr_/);
  assert.deepEqual(Object.keys(env), ["ok", "error", "trace_id"]);
});

test("tools/call default fixture carries the fixture label and 8 surveys", async () => {
  const result = await rpc("tools/call", { name: "assessment_overview", arguments: { fixture: "default" } });
  assert.equal(result.structuredContent.fixture.label, "Fixture data — not live");
  assert.equal(result.structuredContent.surveys.length, 8);
});
