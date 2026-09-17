import { afterEach, describe, expect, it } from "vitest";
import { execute } from "../src/dispatch";
import { handlers } from "../src/handlers";
import type { Ctx } from "../src/handlers/types";
import { capabilities } from "../src/registry";
import app from "../src/index";

function context(): Ctx {
  const statement = { bind() { return this; }, async run() { return { success: true }; } };
  const db = { prepare: () => statement } as unknown as D1Database;
  return {
    env: { DB: db, SESSION_SECRET: "test-only-secret", ENVIRONMENT: "dev" }, db,
    principal: { kind: "anonymous", id: "anon" },
    traceId: "tr_test", now: () => new Date("2026-09-16T20:00:00Z"), log: () => {},
  };
}

afterEach(() => { delete handlers["cap.auth.request_link"]; });

describe("shared dispatch boundary", () => {
  it("loads all 83 contract capabilities", () => expect(capabilities).toHaveLength(83));

  it("rejects the wrong tool before dispatch", async () => {
    const result = await execute(context(), "cap.entry.intents", {}, { tool: "write" });
    expect(result).toMatchObject({ ok: false, error: { code: "WRONG_TOOL_FOR_CLASS" } });
  });

  it("reports v2.1 rows as reserved", async () => {
    const cap = capabilities.find((c) => c.slice === "v2.1-oct")!;
    const result = await execute(context(), cap.id, {}, { tool: cap.tool });
    expect(result).toMatchObject({ ok: false, error: { code: "RESERVED_NOT_BUILT" } });
  });

  it("mounts the HTTP twin with a JSON envelope and 501 for an unbuilt handler", async () => {
    const response = await app.request("http://local.test/v2/support/acts-as", { method: "POST" }, context().env);
    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "RESERVED_NOT_BUILT" } });
  });

  it("requires intent-bound dry run before danger execution", async () => {
    let effects = 0;
    handlers["cap.auth.request_link"] = async (_ctx, _params, opts) => {
      if (!opts?.dryRun) effects++;
      return { result: { sent: !opts?.dryRun }, impact: { affected: [], irreversible: false, effect: "external" } };
    };
    const noToken = await execute(context(), "cap.auth.request_link", { email: "synthetic@example.invalid" }, { tool: "danger", mode: "execute" });
    expect(noToken).toMatchObject({ ok: false, error: { code: "CONFIRM_REQUIRED" } });
    const dry = await execute(context(), "cap.auth.request_link", { email: "synthetic@example.invalid" }, { tool: "danger", mode: "dry_run" });
    expect(dry.ok).toBe(true);
    if (!dry.ok) throw new Error("dry_run failed");
    expect(effects).toBe(0);
    const token = dry.result.confirm_token as string;
    const mismatch = await execute(context(), "cap.auth.request_link", { email: "other@example.invalid" }, { tool: "danger", mode: "execute", confirm_token: token });
    expect(mismatch).toMatchObject({ ok: false, error: { code: "CONFIRM_REQUIRED" } });
    const done = await execute(context(), "cap.auth.request_link", { email: "synthetic@example.invalid" }, { tool: "danger", mode: "execute", confirm_token: token });
    expect(done).toMatchObject({ ok: true, result: { sent: true }, receipt: { class: "write.effect", mode: "execute" } });
    expect(effects).toBe(1);
  });
});

import { pickIds } from "../src/receipt";
describe("pickIds lifts nested created-row ids for the inverse", () => {
  it("finds id/project_id one level down", () => {
    expect(pickIds({ assessment: { id: "assess_1", project_id: "proj_1", name: "x" } })).toEqual({ id: "assess_1", project_id: "proj_1" });
  });
  it("top-level ids win over nested", () => {
    expect(pickIds({ id: "top", grant: { id: "g1", scope_id: "ws_1" } })).toEqual({ id: "top", scope_id: "ws_1" });
  });
});

import { authRequestLink } from "../src/handlers/platform";
describe("auth.request_link access boundary (cookbook #14)", () => {
  it("dev accepts only reserved .invalid synthetic identities", async () => {
    const ctx = { ...context(), env: { ...context().env, ENVIRONMENT: "dev" } } as Ctx;
    await expect(authRequestLink(ctx, { email: "someone@gmail.com" })).rejects.toMatchObject({ code: "INVALID_PARAMS" });
    const dry = await authRequestLink(ctx, { email: "demo.owner@example.invalid" }, { dryRun: true });
    expect(dry.impact?.effect).toBe("external");
  });
  it("production reports RESERVED_NOT_BUILT instead of pretending a code was sent", async () => {
    const ctx = { ...context(), env: { ...context().env, ENVIRONMENT: "production" } } as Ctx;
    await expect(authRequestLink(ctx, { email: "demo.owner@example.invalid" })).rejects.toMatchObject({ code: "RESERVED_NOT_BUILT" });
  });
});
