import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { docs } from "../src/handlers/docs";
import type { Ctx } from "../src/handlers/types";

/** Cargo-exact Prefer packet 1e635576e89702bf63f511034a0ab0e3ee218396 landing strings. */
const INTRO = "3D Review helps you assess the health of how Bible translation is being carried out. It gathers structured perspectives from the translation team, community and church so you can examine practices, understand differences and identify questions worth pursuing.\n\nYou can use it alongside your existing translation and checking tools. Its questions concern implementation and experience: how review works, how feedback is incorporated, how decisions are made, and how people understand, use and trust the translation.\n\nStart with the context of your assessment, the people who should contribute and the questionnaires appropriate to their perspectives. The documentation for each released workflow should explain what is available, what permissions it requires and what outcome you can verify.\n";
const FAQ = "**Can I use 3D Review with translationCore?**\nYes. Keep using translationCore for your translation-checking work. 3D Review adds questions about how your process is functioning and what the translation team, community and church observe.\n\n**Will it work alongside AQuA?**\nYes. AQuA can remain part of your chosen checking approach. 3D Review examines the surrounding practices and perspectives—how review and feedback work, how the team operates, and how people experience the translation.\n\n**Can we use it with Paratext or another tool?**\nYes. 3D Review is designed to accompany the tools and processes you choose. Its focus is the health of their implementation through three perspectives, so it does not depend on adopting one particular checking product.\n\n**What if our translation method is different?**\nYou can use 3D Review alongside different Bible translation methods. The questions examine how the method is being carried out in your context: the team's practices, the community's experience and the church's perspective.\n\n**Does 3D Review check our translated text?**\nIt gathers people's observations about the process, team and translation experience. It does not inspect verses for errors or certify textual accuracy. Continue using the checking and review practices appropriate to your work.\n\n**Does “compatible” mean the apps are connected?**\nCompatibility here means complementary use alongside your workflow. A built-in software integration is a separate feature and should be described only where it is actually available.\n";

const INTRO_SHA256 = "30cb701bb315b24e900be620d1d438180f60e5bc0629867af5cf43a0baf6bd88";
const FAQ_SHA256 = "06fd268ea0ca2c697112d07a6eaaad287333eedbabebf7a92358a660381ba9da";

const stubCtx = {
  env: {} as Ctx["env"],
  db: {} as Ctx["db"],
  principal: { kind: "anonymous", id: "anon" },
  traceId: "tr_docs_topics_intro_faq",
  now: () => new Date("2026-09-17T07:58:00.000Z"),
  log: () => {},
} as unknown as Ctx;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("docs topics intro/faq (PACKET 2026-09-17 option A)", () => {
  it("returns cargo-exact intro text (F1)", async () => {
    const out = await docs(stubCtx, { topic: "intro" });
    expect(out.result).toEqual({ topic: "intro", text: INTRO });
    expect(sha256(out.result.text as string)).toBe(INTRO_SHA256);
    expect(Buffer.byteLength(out.result.text as string, "utf8")).toBe(791);
  });

  it("returns cargo-exact faq text (F2)", async () => {
    const out = await docs(stubCtx, { topic: "faq" });
    expect(out.result).toEqual({ topic: "faq", text: FAQ });
    expect(sha256(out.result.text as string)).toBe(FAQ_SHA256);
    expect(Buffer.byteLength(out.result.text as string, "utf8")).toBe(1547);
    expect(out.result.text as string).toContain("\u2014");
    expect(out.result.text as string).toContain("\u201c");
    expect(out.result.text as string).toContain("\u201d");
    expect(out.result.text as string).not.toContain("Sources:");
  });

  it("miss-path topics list includes intro and faq (F3)", async () => {
    const out = await docs(stubCtx, { topic: "no-such-topic" });
    const topics = out.result.topics as string[];
    expect(out.result.message).toBe("unknown topic no-such-topic");
    expect(topics).toEqual(expect.arrayContaining(["intro", "faq"]));
    expect(topics).toEqual(expect.arrayContaining([
      "glossary", "permissions", "reversibility", "telemetry", "privacy", "stages",
    ]));
  });
});
