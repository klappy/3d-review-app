import { describe, expect, it } from "vitest";
import { docs, DOCS_SEARCH_STOPWORDS, tokenizeDocsQuery } from "../src/handlers/docs";
import type { Ctx } from "../src/handlers/types";

/** Frozen Auth Slice0 stopword allowlist — must stay byte-identical to DOCS_SEARCH_STOPWORDS. */
const FROZEN_STOPWORDS = ["a", "an", "the", "how", "do", "i", "my", "for", "to"] as const;

const stubCtx = {
  env: {} as Ctx["env"],
  db: {} as Ctx["db"],
  principal: { kind: "anonymous", id: "anon" },
  traceId: "tr_docs_search_slice0",
  now: () => new Date("2026-09-17T06:52:00.000Z"),
  log: () => {},
} as unknown as Ctx;

async function search(q: string) {
  const out = await docs(stubCtx, { q });
  return out.result as { q: string; hits: { id: string; class: string; section: string }[] };
}

describe("docs search Slice0 — tokenize / stopword / overlap rank (NLX-MCP-001)", () => {
  it("freezes stopword allowlist byte-identical to handler constant", () => {
    expect([...DOCS_SEARCH_STOPWORDS]).toEqual([...FROZEN_STOPWORDS]);
    expect(JSON.stringify([...DOCS_SEARCH_STOPWORDS])).toBe(JSON.stringify([...FROZEN_STOPWORDS]));
  });

  it("tokenizes: lowercase, trim, punctuation→space, drops stopwords", () => {
    expect(tokenizeDocsQuery("  How do I create an assessment? ")).toEqual(["create", "assessment"]);
    expect(tokenizeDocsQuery("set_stage / collect")).toEqual(["set", "stage", "collect"]);
    expect(tokenizeDocsQuery("how do I")).toEqual([]);
  });

  it("single-token keyword still hits assessment family (regression)", async () => {
    const { hits } = await search("assessment");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(5);
    expect(hits.some((h) => h.id.startsWith("cap.assessment."))).toBe(true);
  });

  it("create assessment / assessment create → cap.assessment.create at rank 1", async () => {
    for (const q of ["create assessment", "assessment create", "how do I create an assessment"]) {
      const { hits } = await search(q);
      expect(hits.length, q).toBeGreaterThan(0);
      expect(hits[0].id, q).toBe("cap.assessment.create");
    }
  });

  it("known keyword families remain visible at expected ids", async () => {
    const cases: { q: string; expectId: string }[] = [
      { q: "undo", expectId: "cap.ops.undo" },
      { q: "print", expectId: "cap.survey.print" },
      { q: "results", expectId: "cap.results.summary" },
      { q: "set_stage", expectId: "cap.assessment.set_stage" },
      { q: "invite", expectId: "cap.grant.invite" },
      { q: "trace", expectId: "cap.ops.trace" },
    ];
    for (const { q, expectId } of cases) {
      const { hits } = await search(q);
      expect(hits.length, q).toBeGreaterThan(0);
      expect(
        hits.some((h) => h.id === expectId),
        `${q} → ${hits.map((h) => h.id).join(",")}`,
      ).toBe(true);
    }
  });

  it("all-stopword and unknown tokens → truthful hits:[]", async () => {
    expect((await search("how do I")).hits).toEqual([]);
    expect((await search("a the an")).hits).toEqual([]);
    expect((await search("zzzz-no-such-capability-phrase")).hits).toEqual([]);
  });

  it("does not invent params schema on search hits", async () => {
    const { hits } = await search("create assessment");
    for (const h of hits) {
      expect(Object.keys(h).sort()).toEqual(["class", "id", "section"]);
      expect(h).not.toHaveProperty("params");
      expect(h).not.toHaveProperty("parameter_help");
    }
  });
});
