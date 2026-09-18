import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { capabilities } from "../src/registry";

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "fb-mcp", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "fb-mcp-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

import contract from "../contract/capabilities.json";
let db: D1Database;
let env: { DB: D1Database; SESSION_SECRET: string; ENVIRONMENT: string };
let userToken: string;
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) await db.batch(statements(db, `../migrations/${m}`));
  await db.batch(statements(db, "../seed/synthetic.sql"));
  env = { DB: db, SESSION_SECRET: "synthetic-docs-feedback", ENVIRONMENT: "dev" };
  userToken = await mintSession(env, "person_mara", "user");
}, 60_000);
async function call(face: string, tool: string, args: any, authenticated = true) {
  const headers = { "content-type": "application/json", ...(authenticated ? {authorization: `Bearer ${userToken}`} : {}) };
  const req = face === "http"
    ? new Request(`https://t.invalid${tool === "docs" ? '/v2/docs?' + new URLSearchParams(args) : '/v2/feedback'}`, {method: tool === "docs" ? "GET" : "POST", headers, ...(tool === "docs" ? {} : {body: JSON.stringify(args.params)})})
    : new Request("https://t.invalid/mcp", {method: "POST", headers, body: JSON.stringify({jsonrpc:"2.0", id:1, method:"tools/call", params:{name:tool, arguments:args}})});
  const res = await app.fetch(req, env); const j:any = await res.json();
  return face === "http" ? j : j.result.structuredContent;
}
const cap = "cap.ops.feedback";
const schema = contract.capabilities.find(c=>c.id===cap)!.params_schema;
for (const face of ["http", "mcp"]) describe(`${face}: feedback documentation recovery (local Request + D1 fixture)`, () => {
  it("entry → feedback search → topic → capability shows accepted optional fields and amendment provenance", async () => {
    const entry = await call(face,"docs",{}); expect(entry.result.topics).toContain("feedback");
    const search = await call(face,"docs",{q:"feedback"}); expect(search.result.hits.map((h:any)=>h.id)).toContain(cap);
    const topic = await call(face,"docs",{topic:"feedback"}); expect(topic.result.text).toContain("body, message and comment are not accepted");
    const detail = await call(face,"docs",{capability:cap});
    expect(detail.result.params_schema).toEqual(schema);
    expect(detail.result.required_params).toEqual([]);
    expect(detail.result.optional_params.sort()).toEqual(Object.keys(schema!.properties!).sort());
    expect(detail.result.params_schema.properties.require_authenticated["x-cookbook-source"]).toContain("e9c09cb");
    expect(detail.result.guidance).toBe(topic.result.text);
  });
  it("documented minimal example runs without guessing; result does not echo text", async () => {
    const {result:p} = await call(face,"docs",{capability:cap});
    expect(p.http_request.body).toEqual(p.examples.mcp.arguments.params);
    const result = await call(face,"write",p.examples.mcp.arguments);
    expect(result.ok).toBe(true); expect(result.result.recorded).toBe(true); expect(result.result.feedback_id).toMatch(/^fb_/);
    expect(result.result).not.toHaveProperty("note");
    const row = await db.prepare("SELECT actor, body FROM feedback WHERE id = ?").bind(result.result.feedback_id).first<any>();
    expect(row.actor).toBe("person_mara"); expect(JSON.parse(row.body).note).toBe(p.http_request.body.note);
  });
  for (const guessed of ["body","message","comment"]) it(`${guessed} refusal directs a docs lookup; note example recovers`, async () => {
    const bad=await call(face,"write",{capability:cap,params:{[guessed]:"synthetic"}});
    expect(bad.ok).toBe(false); expect(bad.error.code).toBe("INVALID_PARAMS");
    const detail=await call(face,"docs",{capability:cap});
    expect(detail.result.params_schema.properties).not.toHaveProperty(guessed);
    expect(detail.result.params_schema.properties.note.type).toBe("string");
    expect((await call(face,"write",detail.result.examples.mcp.arguments)).ok).toBe(true);
  });
  it("documented attribution precondition refuses an anonymous resolved caller without insertion", async () => {
    const before=await db.prepare("SELECT count(*) n FROM feedback").first<any>();
    const result=await call(face,"write",{capability:cap,params:{note:"synthetic",require_authenticated:true}},false);
    expect(result.ok).toBe(false); expect(result.error.code).toBe("NOT_AUTHENTICATED");
    expect(await db.prepare("SELECT count(*) n FROM feedback").first<any>()).toEqual(before);
  });
  it("unsupported query remains an honest miss, not a guessed answer", async () => {
    expect((await call(face,"docs",{q:"feedback inventedparameter"})).result.hits).toEqual([]);
  });
});
