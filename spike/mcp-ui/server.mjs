/**
 * Isolated MCP Apps spike server for klappy/3d-review-app.
 *
 * Streamable HTTP only (no stdio) on :3001 path /mcp. Fixture data only — this
 * process never calls a 3d-review DEV/production URL. The DEV root appears in
 * the views as a link target string, nothing more.
 */
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const DIR = import.meta.dirname;
const PORT = Number(process.env.PORT ?? 3001);
const RPC_LOG = process.env.RPC_LOG ?? path.join(DIR, "..", "..", "out", "rpc-log.jsonl");

const OVERVIEW_URI = "ui://3d-review/overview.html";
const SELECTOR_URI = "ui://3d-review/selector.html";

const fixture = JSON.parse(await readFile(path.join(DIR, "fixture", "assessment.json"), "utf8"));
const SDK_BUNDLE = await readFile(path.join(DIR, "views", "vendor", "app-global.js"), "utf8");

function logRpc(direction, payload) {
  try {
    appendFileSync(RPC_LOG, JSON.stringify({ ts: new Date().toISOString(), direction, payload }) + "\n");
  } catch {
    /* logging is best effort */
  }
}

/** Views are self-contained: the SDK bundle is inlined in place of the marker. */
async function renderView(name) {
  const html = await readFile(path.join(DIR, "views", name), "utf8");
  return html.replace("/*__APP_SDK_BUNDLE__*/", () => SDK_BUNDLE);
}

function payloadFor(tool, fixtureName) {
  if (fixtureName === "error") return null;
  const variant = fixture.variants[fixtureName] ?? fixture.variants.default;
  return { tool, fixture_name: fixtureName, ...variant };
}

const errorResult = () => ({
  isError: true,
  content: [{ type: "text", text: JSON.stringify(fixture.error) }],
  structuredContent: fixture.error,
});

export function createServer() {
  const server = new McpServer({ name: "3d-review MCP Apps spike (fixture only)", version: "0.0.0" });

  registerAppTool(
    server,
    "assessment_overview",
    {
      title: "Assessment overview (fixture)",
      description: "Renders a 3d-review assessment overview from fixture data. No live cap.* call.",
      inputSchema: z.object({ fixture: z.enum(["default", "empty", "error"]).optional() }),
      _meta: { ui: { resourceUri: OVERVIEW_URI } },
    },
    async ({ fixture: which = "default" }) => {
      if (which === "error") return errorResult();
      const data = payloadFor("assessment_overview", which);
      return { content: [{ type: "text", text: `Assessment overview (${which} fixture)` }], structuredContent: data };
    },
  );

  registerAppTool(
    server,
    "survey_selector",
    {
      title: "Survey selector (fixture)",
      description: "Renders the three-lens survey selector from fixture data. Preview only; performs no write.",
      inputSchema: z.object({ fixture: z.enum(["default", "viewer", "empty"]).optional() }),
      _meta: { ui: { resourceUri: SELECTOR_URI } },
    },
    async ({ fixture: which = "default" }) => {
      const data = payloadFor("survey_selector", which);
      return { content: [{ type: "text", text: `Survey selector (${which} fixture)` }], structuredContent: data };
    },
  );

  for (const [uri, file, title] of [
    [OVERVIEW_URI, "overview.html", "3d-review assessment overview"],
    [SELECTOR_URI, "selector.html", "3d-review survey selector"],
  ]) {
    registerAppResource(server, title, uri, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
      contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: await renderView(file) }],
    }));
  }

  return server;
}

const handler = createMcpHandler(createServer, { responseMode: "json", onerror: (e) => console.error("[mcp]", e) });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
};

// node:http <-> Web Request/Response bridge, so the spike needs no express dep.
const http = createHttpServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end();
  if (url.pathname !== "/mcp") return res.writeHead(404, CORS).end("not found");

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  if (body.length) {
    try {
      logRpc("request", JSON.parse(body.toString("utf8")));
    } catch {
      logRpc("request", { raw: body.toString("utf8").slice(0, 400) });
    }
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  headers.set("host", `localhost:${PORT}`);

  let response;
  try {
    response = await handler.fetch(
      new Request(url, {
        method: req.method,
        headers,
        body: body.length ? body : undefined,
        duplex: body.length ? "half" : undefined,
      }),
    );
  } catch (e) {
    console.error("[bridge]", e);
    return res.writeHead(500, CORS).end(String(e));
  }

  const outHeaders = { ...CORS };
  response.headers.forEach((v, k) => {
    outHeaders[k] = v;
  });
  const text = await response.text();
  if (text) {
    try {
      logRpc("response", JSON.parse(text));
    } catch {
      // SSE frames: log each data: line
      for (const line of text.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          logRpc("response", JSON.parse(line.slice(5).trim()));
        } catch {
          /* ignore */
        }
      }
    }
  }
  res.writeHead(response.status, outHeaders).end(text);
});

http.listen(PORT, "127.0.0.1", () => {
  console.log(`spike MCP server (fixture only) on http://localhost:${PORT}/mcp — rpc log: ${RPC_LOG}`);
});
