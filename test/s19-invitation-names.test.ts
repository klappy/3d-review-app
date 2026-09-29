// S19 — captain 2026-09-29 ~19:04 ET, on DEV: "it's ridiculous to not see what I'm accepting the invite to! And there's multiple
// so they just keep coming!!!" cap.me.invitations now names each scope (name + path of names) — for the signed-in person's OWN
// email-matched, live invitations only. Names only: no parent ids, no other scope contents; the `#invite=` token path is unchanged.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { accept, mine } from "../src/handlers/grant";
import { sha256 } from "../src/handlers/common";
import { byId } from "../src/registry";
import type { Ctx } from "../src/handlers/types";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "s19", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "s19-test-db" } }] }));
afterAll(() => mf.dispose());

describe("S19: cap.me.invitations names what you accept", () => {
  it("contract: the result schema carries scope.name and scope.path; the notes say names only, own invitations only", () => {
    const cap: any = byId.get("cap.me.invitations")!;
    const scope = cap.result_schema.properties.invitations.items.properties.scope;
    expect(scope.properties.name).toEqual({ type: ["string", "null"] });
    expect(scope.properties.path).toEqual({ type: "array", items: { type: "string" } });
    expect(cap.notes).toMatch(/names only/);
    const openapi = readFileSync(new URL("../contract/openapi.yaml", import.meta.url), "utf8");
    expect(openapi).toMatch(/operationId: cap\.me\.invitations\n\s+summary: [^\n]+\n\s+description: [^\n]*scope \{type, id, name, path\}/);
  });

  it("names and paths appear only for the caller's own live invitations; revoked, expired, accepted and others' are absent; no other field leaks", async () => {
    const db = await mf.getD1Database("DB");
    const sql = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    const stmts = (path: string) => sql(path).split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
    await db.batch(stmts("../migrations/0001_init.sql"));
    const now = new Date("2026-09-29T23:00:00.000Z"), at = now.toISOString(), later = "2026-10-06T23:00:00.000Z";
    const mk = (id: string): Ctx => ({ env: { DB: db, SESSION_SECRET: "synthetic-only", ENVIRONMENT: "dev" } as any, db, principal: { kind: "user", id }, traceId: "tr_s19", now: () => now, log: () => {} });
    const run = (q: string, ...v: unknown[]) => db.prepare(q).bind(...v).run();
    for (const [id, email] of [["usr_o", "owner@example.invalid"], ["usr_i", "invitee@example.invalid"], ["usr_x", "stranger@example.invalid"]])
      await run("INSERT INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,?,?,?)", id, await sha256(email), 1, 0, at);
    // A workspace › project › assessment chain, a project with no workspace, and scopes only the absent invitations point at.
    await run("INSERT INTO workspace (id, name, created_at, created_by) VALUES (?,?,?,?)", "ws_n", "North <Workspace> & Co", at, "usr_o");
    await run("INSERT INTO project (id, workspace_id, name, organization, created_at, created_by) VALUES (?,?,?,?,?,?)", "proj_n", "ws_n", "Hill \"Project\"", "Hidden Org Contents", at, "usr_o");
    await run("INSERT INTO language (id, project_id, code, name, created_at) VALUES (?,?,?,?,?)", "lang_n", "proj_n", "qaa", "Hidden Language Contents", at);
    await run("INSERT INTO assessment (id, project_id, language_id, name, purpose, stage, created_at, created_by) VALUES (?,?,?,?,?,?,?,?)", "asm_n", "proj_n", "lang_n", "Spring review", "Hidden Purpose Contents", "prepare", at, "usr_o");
    await run("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)", "proj_lone", null, "Lone Project", at, "usr_o");
    for (const [id, name] of [["proj_rev", "Revoked Secret"], ["proj_exp", "Expired Secret"], ["proj_acc", "Accepted Secret"], ["proj_other", "Other Person Secret"]])
      await run("INSERT INTO project (id, workspace_id, name, created_at, created_by) VALUES (?,?,?,?,?)", id, "ws_n", name, at, "usr_o");
    const inv = async (id: string, type: string, scopeId: string, email: string | null, role: string, status: string, expires: string | null, token = `th_${id}`) =>
      run("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        id, type, scopeId, email === null ? null : await sha256(email), token, role, status, "usr_o", at, expires);
    const me = "invitee@example.invalid";
    await inv("inv_1_ws", "workspace", "ws_n", me, "owner", "sent", later);
    await inv("inv_2_proj", "project", "proj_n", me, "member", "pending", later);
    await inv("inv_3_asm", "assessment", "asm_n", me, "viewer", "unconfirmed", null);
    await inv("inv_4_lone", "project", "proj_lone", me, "viewer", "sent", later);
    await inv("inv_5_gone", "project", "proj_deleted", me, "viewer", "sent", later); // scope row gone in flight → no name, no path
    await inv("inv_6_rev", "project", "proj_rev", me, "owner", "revoked", later);
    await inv("inv_7_exp", "project", "proj_exp", me, "owner", "sent", "2026-09-01T00:00:00.000Z");
    await inv("inv_8_acc", "project", "proj_acc", me, "owner", "accepted", later);
    await inv("inv_9_other", "project", "proj_other", "stranger@example.invalid", "member", "sent", later);
    await inv("inv_10_survey", "survey", "proj_n", me, "participant", "sent", later);

    const listed = (await mine(mk("usr_i"), {})).result.invitations as any[];
    expect(listed.map((i) => [i.id, i.scope])).toEqual([
      ["inv_1_ws", { type: "workspace", id: "ws_n", name: "North <Workspace> & Co", path: ["North <Workspace> & Co"] }],
      ["inv_2_proj", { type: "project", id: "proj_n", name: "Hill \"Project\"", path: ["North <Workspace> & Co", "Hill \"Project\""] }],
      ["inv_3_asm", { type: "assessment", id: "asm_n", name: "Spring review", path: ["North <Workspace> & Co", "Hill \"Project\"", "Spring review"] }],
      ["inv_4_lone", { type: "project", id: "proj_lone", name: "Lone Project", path: ["Lone Project"] }],
      ["inv_5_gone", { type: "project", id: "proj_deleted", name: null, path: [] }],
    ]);
    // No other field: the item and its scope carry exactly the documented keys.
    for (const i of listed) {
      expect(Object.keys(i).sort()).toEqual(["expires_at", "id", "invited_at", "inviter_display_name", "role", "scope"]);
      expect(Object.keys(i.scope).sort()).toEqual(["id", "name", "path", "type"]);
    }
    const wire = JSON.stringify(listed);
    for (const hidden of ["Revoked Secret", "Expired Secret", "Accepted Secret", "Other Person Secret", "Hidden Org Contents", "Hidden Language Contents", "Hidden Purpose Contents", "lang_n", "th_inv", await sha256(me)])
      expect(wire, hidden).not.toContain(hidden);
    // Parent ids never ride along: the assessment row names its parents but carries only its own id.
    expect(JSON.stringify(listed[2])).not.toMatch(/ws_n|proj_n/);
    expect(JSON.stringify(listed[1])).not.toMatch(/ws_n/);

    // Other people see only their own — the stranger gets their one invitation named; the inviter (no invitation) gets none.
    expect(((await mine(mk("usr_x"), {})).result.invitations as any[]).map((i) => [i.id, i.scope.name])).toEqual([["inv_9_other", "Other Person Secret"]]);
    expect((await mine(mk("usr_o"), {})).result.invitations).toEqual([]);

    // Token path unchanged: the link's dry run still discloses no name (possibly signed out on arrival; no email-matched list).
    await inv("inv_11_tok", "project", "proj_lone", me, "member", "sent", later, await sha256("tok_s19_link"));
    const dry = await accept(mk("usr_i"), { token: "tok_s19_link" }, { dryRun: true });
    expect(dry.impact!.affected[0]).toMatchObject({ scope: { type: "project", id: "proj_lone" }, role: "member" });
    expect(JSON.stringify(dry)).not.toContain("Lone Project");
  });
});
