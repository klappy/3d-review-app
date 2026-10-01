/**
 * S25: Print survey in the participants' language. The printed form's strings go through the existing POST /v2/translate
 * (translation memory first, published strings only); this checks client and server agree end to end on real D1
 * (Miniflare, the repo's migrations + synthetic seed), upstream stubbed.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { handleTranslate, sha256Hex } from "../src/translate";
import { PARTICIPANT_UI_STRINGS, allowedHashes } from "../src/translate-allowlist";
import { PRINT_WORDS, loadBlankPrint } from "../ui/stage-screens.js";
import { translatePrint, facilitatorFetch } from "../ui/assess/print-lang.js";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "prl", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "prl" } }] }));
let db: D1Database, items: any[];
beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql", "migrations/0011_context.sql", "migrations/0012_translation.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map((x) => x.trim()).filter(Boolean).map((x) => db.prepare(x)));
  }
  items = JSON.parse((await db.prepare("SELECT items_json FROM survey_template WHERE id = 'tpl_validation' AND version = 2").first<{ items_json: string }>())!.items_json);
}, 60000);

/** Upstream stand-in answering in Devanagari; counts the strings it was asked. */
function upstream() {
  const asked: string[] = [];
  const fetch = (async (_u: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body)); asked.push(...Object.values(b.sourceTexts as Record<string, string>));
    return new Response(JSON.stringify({ translated: Object.fromEntries(Object.entries(b.sourceTexts as Record<string, string>).map(([k, v]) => [k, `हिं ${v}`])) }), { headers: { "content-type": "application/json" } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, asked };
}
/** The browser's fetch, routed to the real handler (what the print page calls). */
const route = (env: any, up: typeof globalThis.fetch) => (async (url: string, init: RequestInit) => handleTranslate(new Request(`https://local.invalid${url}`, init), env, { fetch: up })) as any;
const printModel = async () => {
  const envelope = { ok: true, result: { blank: true, template_id: "tpl_validation", template_version: 2, html: "<h1>Translators</h1>", items } };
  return loadBlankPrint({ request: async () => ({ ok: true, json: async () => envelope }), token: "st_x", aid: "a1", sid: "s1", role: "owner", lang: "hi" });
};

describe("S25 printed survey words are published page words", () => {
  it("every PRINT_WORDS value is in the participant-ui allowlist", async () => {
    const mirror = new Set(PARTICIPANT_UI_STRINGS);
    for (const v of Object.values(PRINT_WORDS)) expect(mirror.has(v), v).toBe(true);
    const allowed = await allowedHashes(undefined, { kind: "ui" });
    for (const v of Object.values(PRINT_WORDS)) expect(allowed.has(await sha256Hex(v)), v).toBe(true);
  });
});

describe("S25 Print survey in Hindi, end to end through POST /v2/translate", () => {
  it("questions, choices and page words come back in Hindi and are stored; the second print is served from memory", async () => {
    const env = { DB: db, ENVIRONMENT: "dev", TRANSLATE_UPSTREAM_URL: "https://upstream.invalid/t" };
    const up = upstream();
    const hi = await translatePrint(await printModel(), { lang: "hi", fetchImpl: facilitatorFetch("st_x", route(env, up.fetch)) });
    expect(hi.lang).toBe("hi");
    expect(hi.english).toBe(0);
    expect(hi.items[0].text).toBe(`हिं ${items[0].text}`);
    expect(Object.values(hi.words).every((w: any) => w.startsWith("हिं "))).toBe(true);
    expect(up.asked.length).toBeGreaterThan(0);
    const again = upstream();
    const hi2 = await translatePrint(await printModel(), { lang: "hi", fetchImpl: facilitatorFetch("st_x", route(env, again.fetch)) });
    expect(again.asked).toEqual([]); // translation memory first: nothing goes upstream the second time
    expect(hi2.items.map((i: any) => i.text)).toEqual(hi.items.map((i: any) => i.text));
  });
  it("with no translation available (no upstream, empty memory) every string stays English, marked", async () => {
    const env = { DB: db, ENVIRONMENT: "dev" };
    const kn = await translatePrint(await printModel(), { lang: "kn", fetchImpl: facilitatorFetch("st_x", route(env, upstream().fetch)) });
    expect(kn.english).toBe(kn.phrases);
    expect(kn.items[0]).toMatchObject({ text: items[0].text, en: true });
  });
});
