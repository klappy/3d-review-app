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

  it("plain-language phrases rank their capability (NLX-MCP-001 phrase residual, J-10)", async () => {
    const top3: { q: string; expectId: string }[] = [
      { q: "invite someone to my assessment", expectId: "cap.grant.invite" },
      { q: "undo the last thing", expectId: "cap.ops.undo" },
      { q: "print the survey", expectId: "cap.survey.print" },
    ];
    for (const { q, expectId } of top3) {
      const ids = (await search(q)).hits.map((h) => h.id);
      expect(ids.slice(0, 3), q).toContain(expectId);
    }
    const multi = (await search("set up an assessment and send links to participants")).hits.map((h) => h.id).slice(0, 5);
    expect(multi.some((id) => ["cap.assessment.create", "cap.survey.issue_link", "cap.survey.send_links"].includes(id)), multi.join(",")).toBe(true);
  });

  it("nonsense phrase stays an honest miss", async () => {
    expect((await search("xyzzy flurble quantum")).hits).toEqual([]);
  });

  it("mixed known + unknown: mostly-unknown queries stay an honest miss (no id-token or guessed-name hit)", async () => {
    for (const q of [
      "xyzzy flurble create", // one generic id token among noise
      "secretmethod unknownthing set",
      "feedback foobar", // guessed name next to a real capability word
      "feedback inventedparam",
      "feedback inventedparameter",
      "xyzzy 1", // numeric / 1-char tokens carry no coverage
    ]) {
      const { hits } = await search(q);
      expect(hits, `${q} → ${hits.map((h) => h.id).join(",")}`).toEqual([]);
    }
  });

  it("the shared cap id prefix matches nothing on its own", async () => {
    expect((await search("cap")).hits).toEqual([]);
    expect((await search("cap xyzzy")).hits).toEqual([]);
    expect((await search("cap invite")).hits[0]?.id).toBe("cap.grant.invite");
  });

  it("a real word that matches no capability does not zero a strong match", async () => {
    const cases: { q: string; expectId: string }[] = [
      { q: "invite authentication", expectId: "cap.grant.invite" },
      { q: "invite participants troubleshooting", expectId: "cap.grant.invite" },
      { q: "undo recommendations", expectId: "cap.ops.undo" },
      { q: "invite collaborators", expectId: "cap.grant.invite" },
    ];
    for (const { q, expectId } of cases) {
      const ids = (await search(q)).hits.map((h) => h.id);
      expect(ids[0], `${q} → ${ids.join(",")}`).toBe(expectId);
    }
  });

  it("#516 follow-up: a glue word does not carry a guessed name past the gate", async () => {
    for (const q of ["feedback with inventedparam", "feedback inventedparam is the", "create xyzzy and the"]) {
      const { hits } = await search(q);
      expect(hits, `${q} → ${hits.map((h) => h.id).join(",")}`).toEqual([]);
    }
    // glue words still rank when the rest of the phrase is real
    expect((await search("feedback with note")).hits[0]?.id).toBe("cap.ops.feedback");
  });

  it("#516 follow-up: a repeated word counts once (gate and weight)", async () => {
    for (const q of ["invite invite xyzzy", "feedback feedback inventedparam"]) {
      const { hits } = await search(q);
      expect(hits, `${q} → ${hits.map((h) => h.id).join(",")}`).toEqual([]);
    }
    expect((await search("invite invite")).hits).toEqual((await search("invite")).hits);
    expect((await search("undo undo the last thing")).hits).toEqual((await search("undo the last thing")).hits);
  });

  it("#516 follow-up: JSON Schema keywords are not docs vocabulary; schema field names are", async () => {
    for (const q of ["feedback minproperties", "feedback maxlength", "feedback additionalproperties"]) {
      const { hits } = await search(q);
      expect(hits, `${q} → ${hits.map((h) => h.id).join(",")}`).toEqual([]);
    }
    expect((await search("feedback experience")).hits[0]?.id).toBe("cap.ops.feedback");
  });

  it("#517 review: field names under oneOf/anyOf/allOf and additionalProperties are docs vocabulary", async () => {
    // entry_fragment sits only under the oneOf branches of cap.survey.issue_link's result schema
    const ids = (await search("link fragment")).hits.map((h) => h.id);
    expect(ids.slice(0, 5), `link fragment → ${ids.join(",")}`).toContain("cap.survey.issue_link");
  });

  it("#517 review: words from a capability's roles text are docs vocabulary", async () => {
    // "share" appears only in roles text ("O, M with share authority (D2)")
    const ids = (await search("share results")).hits.map((h) => h.id);
    expect(ids, `share results → ${ids.join(",")}`).toContain("cap.results.summary");
  });

  it("#516 follow-up: a plural matches its singular capability word without outranking an id hit", async () => {
    expect((await search("list all workspaces")).hits[0]?.id).toBe("cap.workspace.list");
    expect((await search("list workspaces")).hits[0]?.id).toBe("cap.workspace.list");
    expect((await search("invite participants troubleshooting")).hits[0]?.id).toBe("cap.grant.invite");
  });

  it("#517 review 6230471956: every capability field is docs vocabulary again (0.34.10 parity)", async () => {
    // Words that live only in inverse, http, error codes, shared_link_contract or enum/const/$ref values.
    // Expected first hits are what origin/main (0.34.10) ranks for the same phrase.
    const cases: [string, string][] = [
      ["withdraw invitation", "cap.grant.revoke_invitation"],
      ["patch me", "cap.auth.me"],
      ["trace redaction", "cap.ops.trace"],
      ["sole owner", "cap.grant.transfer_owner"],
      ["revocation link", "cap.auth.consume_link"],
      ["status active", "cap.survey.get_status"],
      ["unsent links", "cap.survey.send_links"],
    ];
    for (const [q, first] of cases) {
      const ids = (await search(q)).hits.map((h) => h.id);
      expect(ids[0], `${q} → ${ids.join(",")}`).toBe(first);
    }
    expect((await search("patch me")).hits.map((h) => h.id)).toContain("cap.auth.me_update");
  });

  it("#517 review 6230471956: plurals — own-text plural keeps its rank; a singular match is id-only", async () => {
    for (const q of ["links", "unsent links"]) {
      const ids = (await search(q)).hits.map((h) => h.id);
      expect(ids.slice(0, 2), `${q} → ${ids.join(",")}`).toEqual(["cap.survey.send_links", "cap.survey.revoke_link"]);
    }
    expect((await search("news")).hits).toEqual([]);
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
