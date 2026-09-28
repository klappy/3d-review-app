import { describe, expect, it } from "vitest";
import { docs } from "../src/handlers/docs";
import type { Ctx } from "../src/handlers/types";
import { byId } from "../src/registry";
import { requiredRole, roleMeets } from "../src/policy";

/** U16 (J8 "agent as viewer: what can I do here?"): docs {role} never advertises a verb the role cannot call. */
const ctx = {
  env: {} as Ctx["env"],
  db: {} as Ctx["db"],
  principal: { kind: "anonymous", id: "anon" },
  traceId: "tr_docs_role_filter",
  now: () => new Date("2026-09-25T21:30:00.000Z"),
  log: () => {},
} as unknown as Ctx;

const ask = async (role: string) => (await docs(ctx, { role })).result as { can: string[]; next_best: Record<string, string> };

describe("docs role filter (U16)", () => {
  it("viewer next_best holds only the read step", async () => {
    const v = await ask("viewer");
    expect(v.next_best).toEqual({ understand: "cap.results.summary" });
  });

  it("viewer can: every entry is public or a read row the server's role table admits for viewer", async () => {
    const v = await ask("viewer");
    for (const id of v.can) {
      const c = byId.get(id)!;
      expect(c.public || (c.class === "read" && roleMeets("viewer", requiredRole(c.roles)))).toBe(true);
    }
    for (const w of ["cap.survey.select", "cap.survey.issue_codes", "cap.assessment.notes.update"]) expect(v.can).not.toContain(w);
    // cap.ops.feedback is public with roles "any": authorize() admits everyone, so it stays.
    expect(v.can).toContain("cap.ops.feedback");
    expect(v.can).toContain("cap.results.summary");
  });

  it("owner and member next_best unchanged (all four stages)", async () => {
    const full = { prepare: "cap.survey.select", collect: "cap.survey.issue_codes", understand: "cap.results.summary", improve: "cap.assessment.notes.update" };
    for (const role of ["owner", "member"]) {
      const r = await ask(role);
      expect(r.next_best).toEqual(full);
      for (const id of Object.values(full)) expect(r.can).toContain(id);
    }
  });
});
