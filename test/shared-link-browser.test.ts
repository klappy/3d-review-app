// Browser-side shared-link behaviour.
//  [real-API]  cases drive ui/shared-link.js through app.fetch (the Hono worker, real handlers,
//              isolated miniflare D1 with migrations 0001-0004 + 0007 and the synthetic seed).
//  [module]    cases test pure functions with the DEV-ONLY fixture inputs (no endpoints faked).
//  [fake-DOM]  cases import ui/app.js against a small hand-written document (jsdom is not in
//              node_modules and no package is added); they check wiring, not rendering.
// None of this is a real-browser oracle; that remains a reviewer step (Playwright/Chromium).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
// @ts-expect-error plain JS module without types
import { copy, createSharedLinkClient, currentNamespace, digestNamespace, entryFailureKind, errorKind, parseEntryFragment, rememberCurrent, resolveConflict, restoreDraft, saveDraft, scopedStorage, shareUrl, stripFragment } from "../ui/shared-link.js";
// @ts-expect-error plain JS module without types
import * as sharedModule from "../ui/shared-link.js"; // namespace import: a missing export reads undefined instead of failing the whole file
// @ts-expect-error plain JS module without types
import { FORM, memoryStorage } from "./fixtures/shared-link-contract.dev.mjs";

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "shared-browser", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "shared-browser" } }] }));
let db: D1Database, env: any, owner: string;
const ORIGIN = "https://local.invalid";
const LINKS = "/v2/assessments/assess_tavo_collect/surveys/survey_tavo/links";
const fetchImpl = (url: string, init: any) => app.fetch(new Request(ORIGIN + url, init), env);
async function staff(body: unknown) {
  const r = await app.fetch(new Request(ORIGIN + LINKS, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${owner}` }, body: JSON.stringify(body) }), env);
  return (await r.json()) as any;
}
async function issue() {
  const dry = await staff({ params: {}, mode: "dry_run" }); expect(dry.ok).toBe(true);
  const created = await staff({ params: {}, mode: "execute", confirm_token: dry.result.confirm_token }); expect(created.ok).toBe(true);
  return created.result as { link_token: string; link_id: string; expires_at: string | null; entry_fragment: string };
}
async function context(token: string, fetcher = fetchImpl) {
  const storage = memoryStorage();
  const store = scopedStorage(storage, await digestNamespace(token));
  return { storage, store, client: createSharedLinkClient({ fetchImpl: fetcher, store }) };
}
const setOpen = (open: boolean) => db.prepare("UPDATE assessment_survey SET collection_status=? WHERE id='survey_tavo'").bind(open ? "open" : "closed").run();

beforeAll(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["migrations/0001_init.sql", "migrations/0002_code_escrow.sql", "migrations/0003_language_archive.sql", "migrations/0004_pinned_instruments.sql", "migrations/0007_shared_link_context.sql", "seed/synthetic.sql"]) {
    const sql = readFileSync(new URL("../" + file, import.meta.url), "utf8").split("\n").filter(l => !l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map(x => x.trim()).filter(Boolean).map(x => db.prepare(x)));
  }
  env = { DB: db, SESSION_SECRET: "synthetic-shared-browser", ENVIRONMENT: "dev" };
  owner = await mintSession(env, "person_mara", "user");
}, 60000);
afterAll(() => mf.dispose());

describe("[module] entry fragment and namespace", () => {
  it("parses only #survey=<encoded token> and rejects empty or other shapes", () => {
    expect(parseEntryFragment(`#survey=${encodeURIComponent("tok/with+odd=chars")}`)).toBe("tok/with+odd=chars");
    for (const bad of ["#survey=", "#survey=%20", "#session=abc", "?survey=abc", "#survey=a&x=1", "#survey=%E0%A4%A", ""]) expect(parseEntryFragment(bad)).toBeNull();
  });
  it("strips the fragment from history", () => {
    const calls: any[] = [];
    stripFragment({ history: { replaceState: (...a: any[]) => calls.push(a) }, location: { pathname: "/", search: "" } });
    expect(calls).toEqual([[null, "", "/"]]);
  });
  it("isolates two tokens in one storage; keys and shared:current carry the digest, never the token", async () => {
    const storage = memoryStorage();
    const nsA = await digestNamespace("tokA"), nsB = await digestNamespace("tokB");
    scopedStorage(storage, nsA).set("bearer", "pt_a"); scopedStorage(storage, nsB).set("bearer", "pt_b");
    rememberCurrent(storage, nsA);
    expect(scopedStorage(storage, nsA).get("bearer")).toBe("pt_a"); expect(scopedStorage(storage, nsB).get("bearer")).toBe("pt_b");
    expect(currentNamespace(storage)).toBe(nsA);
    for (const [k, v] of storage.keys().map((k: string) => [k, storage.getItem(k)])) { expect(k).toMatch(/^shared:([0-9a-f]{64}:|current$)/); expect(k + v).not.toMatch(/tokA|tokB/); }
    storage.setItem("shared:current", "not-a-digest"); expect(currentNamespace(storage)).toBeNull();
  });
  it("draft: template/version mismatch rejected; empty draft not stored; unknown item ids dropped", () => {
    const store = scopedStorage(memoryStorage(), "shared:test:");
    saveDraft(store, { ...FORM, template: { id: "tpl_team", version: 2 } }, { q1: "1" });
    expect(restoreDraft(store, FORM)).toEqual({ mismatch: true });
    saveDraft(store, FORM, { q1: "", q2: [] }); expect(store.get("draft")).toBeNull(); expect(restoreDraft(store, FORM)).toBeNull();
    saveDraft(store, FORM, { q1: "4", ghost: "x" }); expect(restoreDraft(store, FORM)).toEqual({ answers: { q1: "4" } });
  });
});

describe("[real-API] participant client against the worker", () => {
  it("open posts the token in the body only, credentials omit, no Authorization; bearer is pt_+32", async () => {
    const link = await issue();
    const seen: any[] = [];
    const spy = (url: string, init: any) => { seen.push({ url, init }); return fetchImpl(url, init); };
    const { client } = await context(link.link_token, spy);
    const opened = await client.open(link.link_token);
    expect(opened).toMatchObject({ resumed: false, survey_id: "survey_tavo" });
    expect(opened.participant_token).toMatch(/^pt_[A-Za-z0-9_-]{32}$/);
    expect(seen[0].url).toBe("/v2/participate/link");
    expect(seen[0].init.credentials).toBe("omit");
    expect(seen[0].init.headers.authorization).toBeUndefined();
    expect(JSON.parse(seen[0].init.body)).toEqual({ token: link.link_token });
    await client.form();
    for (const s of seen) expect(s.init.credentials).toBe("omit");
  });
  it("two independent storages on one link are two respondents with separate receipts; staff counts +2", async () => {
    const link = await issue();
    const one = await context(link.link_token), two = await context(link.link_token);
    await one.client.open(link.link_token); await two.client.open(link.link_token);
    expect(one.client.bearer).not.toBe(two.client.bearer);
    const before = (await (await app.fetch(new Request(ORIGIN + "/v2/assessments/assess_tavo_collect/surveys/survey_tavo", { headers: { authorization: `Bearer ${owner}` } }), env)).json() as any).result.counts.responses;
    const r1 = await one.client.submit({ Q1: 3 }), r2 = await two.client.submit({ Q1: 5 });
    expect(r1.response_id).not.toBe(r2.response_id);
    expect((await one.client.receipt()).response_id).toBe(r1.response_id);
    expect((await two.client.receipt()).response_id).toBe(r2.response_id);
    const after = (await (await app.fetch(new Request(ORIGIN + "/v2/assessments/assess_tavo_collect/surveys/survey_tavo", { headers: { authorization: `Bearer ${owner}` } }), env)).json() as any).result.counts.responses;
    expect(after).toBe(before + 2);
  });
  it("reload in the same storage resumes the same respondent (resume_token) and its own draft", async () => {
    const link = await issue();
    const { storage, store, client } = await context(link.link_token);
    await client.open(link.link_token);
    const form = await client.form();
    saveDraft(store, form, { Q1: "4" });
    const again = createSharedLinkClient({ fetchImpl, store: scopedStorage(storage, await digestNamespace(link.link_token)) });
    const opened = await again.open(link.link_token);
    expect(opened).toMatchObject({ resumed: true, participant_token: client.bearer });
    expect(restoreDraft(store, form)).toEqual({ answers: { Q1: "4" } });
  });
  it("a transport failure keeps draft and submit key; retry reuses the key; success clears both", async () => {
    const link = await issue();
    let failOnce = true;
    const flaky = (url: string, init: any) => { if (failOnce && url.endsWith("/responses")) { failOnce = false; return Promise.reject(new TypeError("network")); } return fetchImpl(url, init); };
    const { store, client } = await context(link.link_token, flaky);
    await client.open(link.link_token);
    saveDraft(store, FORM, { q1: "2" });
    await expect(client.submit({ Q1: 2 })).rejects.toThrow(/outcome is unknown/);
    expect(store.get("draft")).not.toBeNull();
    const key = store.get("submitKey"); expect(key).toBeTruthy();
    const result = await client.submit({ Q1: 2 });
    expect(result).toMatchObject({ duplicate: false });
    expect(store.get("draft")).toBeNull(); expect(store.get("submitKey")).toBeNull();
    // the retried submission carried the same key: a second submit with it replays, not duplicates
    store.set("submitKey", key!);
    expect(await client.submit({ Q1: 2 })).toMatchObject({ response_id: result.response_id, duplicate: true });
  });
  it("closed collection: STAGE_CONFLICT resolves via receipt (own receipt or closed); revoked link resolves unavailable", async () => {
    const link = await issue();
    const done = await context(link.link_token), late = await context(link.link_token);
    await done.client.open(link.link_token); await late.client.open(link.link_token);
    const saved = await done.client.submit({ Q1: 1 });
    await setOpen(false);
    try {
      let err: any; try { await late.client.submit({ Q1: 2 }); } catch (e) { err = e; }
      expect(errorKind(err)).toBe("conflict");
      expect(late.store.get("submitKey")).not.toBeNull(); // refusal keeps the key
      expect(await resolveConflict(late.client)).toEqual({ state: "closed" });
      let fresh: any; try { await (await context(link.link_token)).client.open(link.link_token); } catch (e) { fresh = e; }
      expect(errorKind(fresh)).toBe("conflict");
      expect(await resolveConflict(done.client)).toMatchObject({ state: "receipt", receipt: { submitted: true, response_id: saved.response_id } });
      expect(copy.collectionClosed.startsWith("Collection has closed")).toBe(true);
    } finally { await setOpen(true); }
    const revoke = await app.fetch(new Request(ORIGIN + LINKS + "/" + link.link_id, { method: "DELETE", headers: { "content-type": "application/json", authorization: `Bearer ${owner}` }, body: "{}" }), env);
    expect(((await revoke.json()) as any).ok).toBe(true);
    let gone: any; try { await done.client.open(link.link_token); } catch (e) { gone = e; }
    expect(errorKind(gone)).toBe("unavailable");
    expect(String(gone.message)).not.toContain(link.link_token);
    expect(await resolveConflict(done.client)).toEqual({ state: "unavailable" });
    expect(copy.linkUnavailable.startsWith("This link no longer works")).toBe(true);
  });
  it("already-submitted with a new client key is also STAGE_CONFLICT and resolves to the own receipt", async () => {
    const link = await issue();
    const { store, client } = await context(link.link_token);
    await client.open(link.link_token);
    const saved = await client.submit({ Q1: 4 });
    store.remove("submitKey"); // e.g. storage partially lost; a fresh key is minted
    let err: any; try { await client.submit({ Q1: 4 }); } catch (e) { err = e; }
    expect(errorKind(err)).toBe("conflict");
    expect(await resolveConflict(client)).toMatchObject({ state: "receipt", receipt: { response_id: saved.response_id } });
  });
  it("refused resume (stored resume_token unknown): cannot-resume kind, scoped storage byte-identical, one POST link, no new respondent", async () => {
    const link = await issue();
    const calls: string[] = [];
    const counting = (url: string, init: any) => { calls.push(`${init.method || "GET"} ${url}`); return fetchImpl(url, init); };
    const { storage, store } = await context(link.link_token, counting);
    store.set("bearer", "pt_" + "x".repeat(32)); store.set("submitKey", "key-1"); store.set("draft", JSON.stringify({ template: { id: "t", version: 1 }, answers: { Q1: 2 } }));
    const client = createSharedLinkClient({ fetchImpl: counting, store }); // the client reads the stored bearer at creation, as a reload does
    const before = JSON.stringify(storage.keys().map((k: string) => [k, storage.getItem(k)]));
    const sessions = async () => Number((await db.prepare("SELECT COUNT(*) AS n FROM participant_session").first<{ n: number }>())?.n);
    const n = await sessions();
    let err: any; try { await client.open(link.link_token); } catch (e) { err = e; }
    expect(err.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    expect(entryFailureKind(err, true)).toBe("cannotResume"); expect(entryFailureKind(err, false)).toBe("unavailable");
    expect(JSON.stringify(storage.keys().map((k: string) => [k, storage.getItem(k)]))).toBe(before);
    expect(calls.filter(c => c === "POST /v2/participate/link")).toHaveLength(1);
    expect(await sessions()).toBe(n);
    expect(copy.cannotResume).not.toMatch(/expired|no longer works|not saved|was not sent/i);
  });
  it("resolveConflict maps a receipt refusal by kind: unavailable only for NOT_FOUND, not rate-limit or transport", async () => {
    const fail = (code?: string) => ({
      bearer: "pt_x",
      receipt: async () => { const e: any = new Error(code || "offline"); if (code) e.code = code; throw e; },
    });
    expect(await resolveConflict(fail("NOT_FOUND_OR_NOT_VISIBLE"))).toEqual({ state: "unavailable" });
    expect(await resolveConflict(fail("RATE_LIMITED"))).toEqual({ state: "rateLimited" });
    expect(await resolveConflict(fail("429"))).toEqual({ state: "rateLimited" });
    expect(await resolveConflict(fail())).toEqual({ state: "transient" });
    expect(await resolveConflict(fail("503"))).toEqual({ state: "transient" });
    expect(await resolveConflict({ bearer: "pt_x", receipt: async () => ({ submitted: false }) })).toEqual({ state: "closed" });
  });
  it("error kinds: 429/RATE_LIMITED is rateLimited; network and 5xx are transient; closed stays conflict on the resume path", async () => {
    const link = await issue();
    const limited = async () => new Response(JSON.stringify({ ok: false, error: { code: "RATE_LIMITED", message: "slow down" } }), { status: 429, headers: { "content-type": "application/json" } });
    const { client: c1 } = await context(link.link_token, limited);
    let e1: any; try { await c1.open(link.link_token); } catch (e) { e1 = e; } expect(errorKind(e1)).toBe("rateLimited"); expect(entryFailureKind(e1, true)).toBe("rateLimited");
    const { client: c2 } = await context(link.link_token, async () => { throw new Error("offline"); });
    let e2: any; try { await c2.open(link.link_token); } catch (e) { e2 = e; } expect(errorKind(e2)).toBe("transient");
    const { client: c3 } = await context(link.link_token, async () => new Response("{\"ok\":false}", { status: 503, headers: { "content-type": "application/json" } }));
    let e3: any; try { await c3.open(link.link_token); } catch (e) { e3 = e; } expect(errorKind(e3)).toBe("transient");
    const { client: c4 } = await context(link.link_token); await c4.open(link.link_token);
    await setOpen(false);
    try { let e4: any; try { await c4.open(link.link_token); } catch (e) { e4 = e; } expect(e4).toBeUndefined(); /* resume path skips the collecting gate; submit is gated */ }
    finally { await setOpen(true); }
  });
  it("R-15 dead stored bearer, no fragment: exactly one GET /receipt, zero POST, NOT_AUTHENTICATED → cannotResume kind, storage byte-identical", async () => {
    const link = await issue();
    const calls: string[] = [];
    const counting = (url: string, init: any) => { calls.push(`${init.method || "GET"} ${url}`); return fetchImpl(url, init); };
    const { storage, store } = await context(link.link_token, counting);
    store.set("bearer", "pt_" + "z".repeat(32)); store.set("submitKey", "key-3"); store.set("draft", JSON.stringify({ template: { id: "t", version: 1 }, answers: { Q1: 3 } }));
    const before = JSON.stringify(storage.keys().sort().map((k: string) => [k, storage.getItem(k)]));
    const client = createSharedLinkClient({ fetchImpl: counting, store });
    let err: any; try { await client.receipt(); } catch (e) { err = e; }
    expect(err.code).toBe("NOT_AUTHENTICATED");
    expect(entryFailureKind(err, true)).toBe("cannotResume");
    expect(calls).toEqual(["GET /v2/participate/receipt"]);
    expect(JSON.stringify(storage.keys().sort().map((k: string) => [k, storage.getItem(k)]))).toBe(before);
  });
  it("staff: dry-run → execute → share URL = origin + '/' + entry_fragment, and the fragment round-trips", async () => {
    const link = await issue();
    expect(link.entry_fragment).toBe("#survey=" + encodeURIComponent(link.link_token));
    const url = shareUrl(ORIGIN, link.entry_fragment);
    expect(url).toBe(`${ORIGIN}/${link.entry_fragment}`);
    expect(parseEntryFragment(new URL(url).hash)).toBe(link.link_token);
    expect(() => shareUrl(ORIGIN, "#survey=")).toThrow(copy.linkNotConstructed);
    expect((await staff({ params: {}, mode: "execute" })).error.code).toBe("CONFIRM_REQUIRED");
  });
});

// ---- [fake-DOM] ui/app.js wiring ------------------------------------------------------------
function fakeDocument() {
  const byId = new Map<string, any>();
  function el(tag = "div", id = ""): any {
    const e: any = { tagName: tag.toUpperCase(), id, hidden: false, disabled: false, textContent: "", value: "", dataset: {}, children: [] as any[], options: [] as any[], elements: {}, listeners: {} as Record<string, Function[]> };
    e.addEventListener = (t: string, f: Function) => { (e.listeners[t] ||= []).push(f); };
    e.dispatch = async (t: string) => { for (const f of e.listeners[t] || []) await f({ preventDefault() {}, currentTarget: e }); };
    e.append = (...c: any[]) => e.children.push(...c); e.prepend = (...c: any[]) => e.children.unshift(...c);
    e.replaceChildren = (...c: any[]) => { e.children = c; }; e.add = (o: any) => e.options.push(o);
    e.querySelector = () => el("p"); e.querySelectorAll = () => []; e.reset = () => {}; e.focus = () => {};
    e.remove = () => { if (id) { byId.delete(id); removed.add(id); } };
    return e;
  }
  const removed = new Set<string>();
  // Every id-addressed element and its appended children, as document.body.textContent would read them.
  const allText = (): string => { const walk = (n: any): string => (n.textContent || "") + (n.children || []).map(walk).join(""); return [...byId.values()].map(walk).join("\n"); };
  const document = {
    getElementById: (id: string) => { if (removed.has(id)) return null; if (!byId.has(id)) byId.set(id, el("div", id)); return byId.get(id); },
    createElement: (t: string) => el(t), querySelector: () => el("aside"), querySelectorAll: () => [],
    body: { get textContent() { return allText(); } },
  };
  return { document, $: (id: string) => document.getElementById(id) };
}
const ATTENTION = "Action needs attention. No completion is assumed.";
async function settled($: (id: string) => any) { // wait for the startup run() to finish
  for (let i = 0; i < 200; i++) { const n = $("notice").textContent; if (/complete\.$/.test(n) || n === ATTENTION || !$("error").hidden) return; await new Promise(r => setTimeout(r, 25)); }
  throw new Error("startup did not settle: " + $("notice").textContent);
}
let bootCount = 0;
async function boot(storage: any, hash: string, fetcher: typeof fetchImpl = fetchImpl) {
  const { document, $ } = fakeDocument();
  const g: any = globalThis;
  g.document = document; g.window = g; g.sessionStorage = storage;
  g.location = { hash, pathname: "/", search: "", origin: ORIGIN }; g.history = { replaceState: () => { g.location.hash = ""; } };
  Object.defineProperty(g, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true }); g.CSS = { escape: (s: string) => s };
  g.fetch = fetcher;
  g.Option = class { constructor(public text: string, public value: string) {} };
  g.FormData = class { constructor(public form: any) {} get(k: string) { return this.form.values?.[k] ?? null; } getAll(k: string) { const v = this.form.values?.[k]; return Array.isArray(v) ? v : v == null ? [] : [v]; } };
  await import(/* @vite-ignore */ `${new URL("../ui/app.js", import.meta.url).href}?boot=${++bootCount}`); // fresh module instance per boot
  await settled($);
  return $;
}

describe("[fake-DOM] ui/app.js shared mode", () => {
  it("opens from the fragment, strips it, remembers only the digest, and a reload without a fragment resumes the same context", async () => {
    const link = await issue();
    const storage = memoryStorage();
    const $ = await boot(storage, link.entry_fragment);
    expect((globalThis as any).location.hash).toBe("");
    expect($("facilitator").hidden).toBe(true);
    expect($("answers").hidden).toBe(false);
    const ns = await digestNamespace(link.link_token);
    expect(storage.getItem("shared:current")).toBe(ns);
    const bearer = storage.getItem(ns + "bearer"); expect(bearer).toMatch(/^pt_/);
    for (const k of storage.keys()) expect(k + storage.getItem(k)).not.toContain(link.link_token);
    expect(storage.getItem("participantToken")).toBeNull(); expect(storage.getItem("responseKey")).toBeNull();
    // same-tab reload: no fragment, namespaced state present
    const $2 = await boot(storage, "");
    expect($2("facilitator").hidden).toBe(true);
    expect($2("answers").hidden).toBe(false);
    expect(storage.getItem(ns + "bearer")).toBe(bearer);
  });
  it("submit: global responseKey untouched; a STAGE_CONFLICT on retry resolves via receipt to the own receipt", async () => {
    const link = await issue();
    const storage = memoryStorage();
    const $ = await boot(storage, link.entry_fragment);
    const ns = await digestNamespace(link.link_token);
    $("answers").values = { Q1: "3" };
    await $("answers").dispatch("submit"); await settled($);
    expect($("review").hidden).toBe(false);
    await $("submit").dispatch("click"); await settled($);
    expect($("receipt").hidden).toBe(false);
    expect($("receipt").textContent).toMatch(/^Response saved · resp_/);
    expect(storage.getItem("responseKey")).toBeNull(); expect(storage.getItem(ns + "submitKey")).toBeNull();
    // retry with a fresh key after the key was lost → server STAGE_CONFLICT → receipt replay
    (globalThis as any).crypto.randomUUID; // ensure available
    await $("submit").dispatch("click"); await settled($);
    expect($("error").hidden).toBe(true);
    expect($("receipt").textContent).toMatch(/^Response saved · resp_/);
    expect(storage.getItem("responseKey")).toBeNull();
    // reload after submit shows the receipt, not an editable form
    const $2 = await boot(storage, "");
    expect($2("receipt").hidden).toBe(false); expect($2("answers").hidden).toBe(true);
  });
  it("refused resume shows the cannot-resume copy; no fresh open; scoped bearer/key/draft unchanged", async () => {
    const link = await issue();
    const storage = memoryStorage();
    const ns = await digestNamespace(link.link_token);
    storage.setItem(ns + "bearer", "pt_" + "y".repeat(32)); storage.setItem(ns + "submitKey", "key-2"); storage.setItem(ns + "draft", "{\"template\":{\"id\":\"t\",\"version\":1},\"answers\":{\"Q1\":1}}");
    const before = JSON.stringify(storage.keys().sort().map((k: string) => [k, storage.getItem(k)]));
    const $ = await boot(storage, link.entry_fragment);
    expect($("participant-error").hidden).toBe(false); expect($("participant-error").textContent).toBe(copy.cannotResume);
    expect($("answers").hidden).toBe(true); expect($("error").hidden).toBe(true);
    expect(storage.getItem(ns + "bearer")).toBe("pt_" + "y".repeat(32));
    expect(JSON.stringify(storage.keys().filter((k: string) => k !== "shared:current").sort().map((k: string) => [k, storage.getItem(k)]))).toBe(before);
  });
  it("R-15 boot with no fragment and a dead scoped bearer: cannot-resume copy, no raw text in #error, no POST, storage unchanged", async () => {
    const link = await issue();
    const storage = memoryStorage();
    const ns = await digestNamespace(link.link_token);
    storage.setItem("shared:current", ns);
    storage.setItem(ns + "bearer", "pt_" + "w".repeat(32)); storage.setItem(ns + "submitKey", "key-4"); storage.setItem(ns + "draft", "{\"template\":{\"id\":\"t\",\"version\":1},\"answers\":{\"Q1\":2}}");
    const before = JSON.stringify(storage.keys().sort().map((k: string) => [k, storage.getItem(k)]));
    const calls: string[] = [];
    const $ = await boot(storage, "", (url, init) => { calls.push(`${init.method || "GET"} ${url}`); return fetchImpl(url, init); });
    expect(calls).toEqual(["GET /v2/participate/receipt"]);
    expect($("participant-error").hidden).toBe(false); expect($("participant-error").textContent).toBe(copy.cannotResume);
    expect($("error").hidden).toBe(true); expect($("error").textContent).not.toMatch(/NOT_AUTHENTICATED/);
    expect($("answers").hidden).toBe(true);
    expect(JSON.stringify(storage.keys().sort().map((k: string) => [k, storage.getItem(k)]))).toBe(before);
  });
  it("closed collection on entry shows the closed copy; no form", async () => {
    const link = await issue();
    await setOpen(false);
    try {
      const $ = await boot(memoryStorage(), link.entry_fragment);
      expect($("participant-error").hidden).toBe(false);
      expect($("participant-error").textContent).toBe(copy.collectionClosed);
      expect($("answers").hidden).toBe(true);
    } finally { await setOpen(true); }
  });
});

// ---- [fake-DOM] staff link state never outlives its selection or identity (Bugbot 4033211757) ----
async function staffLink(storage: any) {
  const $ = await boot(storage, "");
  $("projects").value = "proj_rill"; await $("projects").dispatch("change"); await settled($);
  $("assessments").value = "assess_tavo_collect"; await $("assessments").dispatch("change"); await settled($);
  $("surveys").value = "survey_tavo"; await $("surveys").dispatch("change");
  await $("issue-link-preview").dispatch("click"); await settled($);
  expect($("issue-link-confirm").disabled).toBe(false);
  await $("issue-link-confirm").dispatch("click"); await settled($);
  expect($("share-url").hidden).toBe(false); expect($("share-url").textContent).toMatch(/^https:\/\/local\.invalid\/#survey=/);
  expect($("copy-link").hidden).toBe(false);
  return $;
}
function expectCleared($: any, storage: any) {
  expect($("share-url").hidden).toBe(true); expect($("share-url").textContent).toBe("");
  expect($("copy-link").hidden).toBe(true); expect($("issue-link-confirm").disabled).toBe(true);
  expect($("issue-link-impact").textContent).toBe(""); expect($("copy-state").textContent).toBe("");
  for (const k of storage.keys()) expect(String(storage.getItem(k))).not.toContain("#survey=");
}
describe("[fake-DOM] staff share URL lifetime", () => {
  it("switching assessment clears the once-shown URL and confirm state; nothing is persisted", async () => {
    const storage = memoryStorage(); storage.setItem("facilitatorToken", owner);
    const $ = await staffLink(storage);
    for (const k of storage.keys()) expect(String(storage.getItem(k))).not.toContain("#survey=");
    $("assessments").value = "assess_tavo_prepare"; await $("assessments").dispatch("change"); await settled($);
    expectCleared($, storage);
    // a fresh project selection also starts clean
    $("projects").value = "proj_aster"; await $("projects").dispatch("change"); await settled($);
    expectCleared($, storage);
  });
  it("sign-out clears the URL and confirm state, and a reload after it shows no link", async () => {
    const storage = memoryStorage(); storage.setItem("facilitatorToken", owner);
    const $ = await staffLink(storage);
    await $("signout").dispatch("click"); await settled($);
    expectCleared($, storage);
    expect(storage.getItem("facilitatorToken")).toBeNull();
    // fresh boot: the fake document has no markup defaults, so check content and storage, not `hidden`
    const $2 = await boot(storage, "");
    expect($2("share-url").textContent).toBe(""); expect($2("issue-link-impact").textContent).toBe("");
    for (const k of storage.keys()) expect(String(storage.getItem(k))).not.toContain("#survey=");
  });
});

// ---- [fake-DOM] truthful submit-failure feedback on the shared route (Sprint 2 slice A) ----------
// Rows F1–F10 of the slice brief. The server replays a committed response for the same idempotency
// key, so a lost success must read as "uncertain, retry is safe", never "not submitted".
const SURVEY = "/v2/assessments/assess_tavo_collect/surveys/survey_tavo";
async function counts() { return ((await (await app.fetch(new Request(ORIGIN + SURVEY, { headers: { authorization: `Bearer ${owner}` } }), env)).json()) as any).result.counts.responses as number; }
const snapshot = (storage: any) => JSON.stringify(storage.keys().sort().map((k: string) => [k, storage.getItem(k)]));
const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refuse = (status: number, code: string) => async () => jsonResponse(status, { ok: false, error: { code, message: `${code} synthetic message` }, trace_id: "tr_synthetic0001" });
const offline = async () => { throw new TypeError("network lost before the request left"); };
type Route = ((url: string, init: any) => Promise<Response>) | null;
function router() { // per-route overrides on top of the real worker; null = real
  const plan: { responses: Route; receipt: Route } = { responses: null, receipt: null };
  const bodies: any[] = []; // parsed JSON of every real /responses reply (to read duplicate:true/false)
  const fetcher = async (url: string, init: any) => {
    if (url.endsWith("/responses") && plan.responses) return plan.responses(url, init);
    if (url.endsWith("/receipt") && plan.receipt) return plan.receipt(url, init);
    const r = await fetchImpl(url, init);
    if (url.endsWith("/responses")) bodies.push(await r.clone().json());
    return r;
  };
  // lost success: the server commits, then the reply never arrives
  const lost = async (url: string, init: any) => { const r = await fetchImpl(url, init); bodies.push(await r.clone().json()); throw new TypeError("reply lost after the server committed"); };
  return { plan, fetcher, bodies, lost };
}
const LEAK = /STAGE_CONFLICT|INVALID_PARAMS|NOT_FOUND|RATE_LIMITED|trace|tr_[A-Za-z0-9]|\b[45]\d\d\b/;
function strict($: any) { // F9, after every row
  expect((globalThis as any).document.body.textContent).not.toMatch(LEAK);
  expect($("error").textContent).toBe(""); expect($("error").hidden).toBe(true);
  expect((globalThis as any).document.getElementById("evidence")).toBeNull();
}
async function review($: any, values: Record<string, string>) { $("answers").values = values; await $("answers").dispatch("input"); await $("answers").dispatch("submit"); await settled($); expect($("review").hidden).toBe(false); }
async function edit($: any, values: Record<string, string>) { await $("edit").dispatch("click"); expect($("answers").hidden).toBe(false); await review($, values); }
async function submit($: any) { await $("submit").dispatch("click"); await settled($); strict($); }
async function armed(storage: any, ns: string) { // mint the key up front so "byte-identical" covers submitKey too
  if (!storage.getItem(ns + "submitKey")) storage.setItem(ns + "submitKey", globalThis.crypto.randomUUID());
  return snapshot(storage);
}
async function openForm(link: { link_token: string; entry_fragment: string }, values = { Q1: "3" }) {
  const storage = memoryStorage(); const r = router();
  const $ = await boot(storage, link.entry_fragment, r.fetcher); strict($);
  const ns = await digestNamespace(link.link_token);
  await review($, values);
  return { $, storage, ns, ...r };
}
function expectUncertain($: any, storage: any, snap: string) {
  expect($("participant-resume").textContent).toBe(copy.submitUncertain);
  expect($("receipt").hidden).toBe(true); expect($("participant-error").hidden).toBe(true);
  expect($("notice").textContent).toBe(ATTENTION);
  expect(snapshot(storage)).toBe(snap);
}
describe("[fake-DOM] shared submit failure feedback (S2-A)", () => {
  const warns: any[][] = []; let originalWarn: any;
  beforeAll(async () => { owner = await mintSession(env, "person_mara", "user"); /* the staff sign-out test above ended the shared owner session */ originalWarn = console.warn; console.warn = (...args: any[]) => { warns.push(args); }; });
  afterAll(() => { console.warn = originalWarn; });
  it("[module] submitFailureKind: 0/5xx/no status → uncertain; STAGE_CONFLICT → conflict; NOT_FOUND/NOT_AUTHENTICATED → unavailable; other 4xx → rejected", () => {
    const err = (status: number | undefined, code?: string) => Object.assign(new Error("x"), { status, code });
    const kind = sharedModule.submitFailureKind;
    for (const e of [err(0), err(500), err(503, "503"), err(undefined), err(502, "STAGE_CONFLICT")]) expect(kind(e)).toBe("uncertain");
    expect(kind(err(409, "STAGE_CONFLICT"))).toBe("conflict");
    expect(kind(err(404, "NOT_FOUND_OR_NOT_VISIBLE"))).toBe("unavailable"); expect(kind(err(401, "NOT_AUTHENTICATED"))).toBe("unavailable");
    for (const e of [err(400, "INVALID_PARAMS"), err(429, "RATE_LIMITED"), err(403, "NOT_AUTHORIZED_AT_SCOPE"), err(400)]) expect(kind(e)).toBe("rejected");
    expect(copy.submitFailed).toBe("Your answers were not submitted. They are still here; try again.");
  });
  it("[module] call() attaches status: JSON failure carries response.status; network and unreadable carry 0 and no code", async () => {
    const store = scopedStorage(memoryStorage(), "shared:test:");
    const at = async (fetcher: any) => { try { await createSharedLinkClient({ fetchImpl: fetcher, store }).form(); } catch (e) { return e as any; } };
    const j = await at(refuse(400, "INVALID_PARAMS")); expect(j.status).toBe(400); expect(j.code).toBe("INVALID_PARAMS"); expect(j.trace_id).toBe("tr_synthetic0001");
    const n = await at(offline); expect(n.status).toBe(0); expect(n.code).toBeUndefined();
    const u = await at(async () => new Response("<html>", { status: 502 })); expect(u.status).toBe(0); expect(u.code).toBeUndefined();
  });
  it("F1 lost success: uncertain copy, #error hidden, storage byte-identical, counts +1; retry with the same key replays duplicate:true, counts unchanged", async () => {
    const link = await issue(); const { $, storage, ns, plan, bodies, lost } = await openForm(link);
    const before = await counts(); const snap = await armed(storage, ns); warns.length = 0;
    plan.responses = lost; await submit($);
    expectUncertain($, storage, snap);
    expect(await counts()).toBe(before + 1); expect(bodies[0].result.duplicate).toBe(false);
    expect(warns).toEqual([["[3dr] submit", { status: 0, code: undefined, trace_id: undefined }]]);
    plan.responses = null; await submit($);
    expect($("receipt").hidden).toBe(false); expect($("receipt").textContent).toMatch(/^Response saved · resp_/);
    expect(bodies[1].result).toMatchObject({ response_id: bodies[0].result.response_id, duplicate: true });
    expect(await counts()).toBe(before + 1);
    expect(storage.getItem(ns + "submitKey")).toBeNull(); expect(storage.getItem(ns + "draft")).toBeNull();
  });
  it("F2 503 JSON reply: uncertain, counts unchanged, storage byte-identical; retry commits duplicate:false", async () => {
    const link = await issue(); const { $, storage, ns, plan, bodies } = await openForm(link);
    const before = await counts(); const snap = await armed(storage, ns); warns.length = 0;
    plan.responses = refuse(503, "INTERNAL"); await submit($);
    expectUncertain($, storage, snap); expect(await counts()).toBe(before);
    expect(warns).toEqual([["[3dr] submit", { status: 503, code: "INTERNAL", trace_id: "tr_synthetic0001" }]]);
    plan.responses = null; await submit($);
    expect($("receipt").textContent).toMatch(/^Response saved · resp_/); expect(bodies[0].result.duplicate).toBe(false); expect(await counts()).toBe(before + 1);
  });
  it("F3 throw before the request left: uncertain, counts unchanged; retry commits duplicate:false", async () => {
    const link = await issue(); const { $, storage, ns, plan, bodies } = await openForm(link);
    const before = await counts(); const snap = await armed(storage, ns);
    plan.responses = offline; await submit($);
    expectUncertain($, storage, snap); expect(await counts()).toBe(before);
    plan.responses = null; await submit($);
    expect($("receipt").textContent).toMatch(/^Response saved · resp_/); expect(bodies[0].result.duplicate).toBe(false); expect(await counts()).toBe(before + 1);
  });
  it("F4 400 with no prior commit: the receipt probe says submitted:false → submitFailed; storage byte-identical", async () => {
    const link = await issue(); const { $, storage, ns, plan } = await openForm(link);
    const before = await counts(); const snap = await armed(storage, ns);
    plan.responses = refuse(400, "INVALID_PARAMS"); await submit($);
    expect($("participant-resume").textContent).toBe(copy.submitFailed);
    expect($("receipt").hidden).toBe(true); expect($("notice").textContent).toBe(ATTENTION);
    expect(snapshot(storage)).toBe(snap); expect(await counts()).toBe(before);
  });
  it("F6 direct 404 on submit with no earlier uncertainty: linkUnavailable copy; storage byte-identical", async () => {
    const link = await issue(); const { $, storage, ns, plan } = await openForm(link);
    const snap = await armed(storage, ns);
    plan.responses = refuse(404, "NOT_FOUND_OR_NOT_VISIBLE"); await submit($);
    expect($("participant-error").hidden).toBe(false); expect($("participant-error").textContent).toBe(copy.linkUnavailable);
    expect($("participant-resume").textContent).toBe(""); expect($("recover").hidden).toBe(true);
    expect($("answers").hidden).toBe(true); expect($("review").hidden).toBe(true);
    expect(snapshot(storage)).toBe(snap);
  });
  const probes: [string, string, Route][] = [
    ["F7a", "probe 503", refuse(503, "INTERNAL")],
    ["F7b", "probe throws", offline],
    ["F7c", "probe 429", refuse(429, "RATE_LIMITED")],
  ];
  for (const [row, label, probe] of probes) it(`${row} lost success → edit → 400 with ${label}: uncertain retained, storage byte-identical, no second commit`, async () => {
    const link = await issue(); const { $, storage, ns, plan, lost } = await openForm(link);
    const before = await counts();
    plan.responses = lost; await submit($); expect($("participant-resume").textContent).toBe(copy.submitUncertain); expect(await counts()).toBe(before + 1);
    plan.responses = null; await edit($, { Q1: "4" });
    const snap = await armed(storage, ns);
    plan.responses = refuse(400, "INVALID_PARAMS"); plan.receipt = probe; await submit($);
    expectUncertain($, storage, snap); expect(await counts()).toBe(before + 1);
  });
  it("F7d lost success → edit → 400 with probe 404: cannotResume copy (not linkUnavailable); storage byte-identical", async () => {
    const link = await issue(); const { $, storage, ns, plan, lost } = await openForm(link);
    plan.responses = lost; await submit($); expect($("participant-resume").textContent).toBe(copy.submitUncertain);
    plan.responses = null; await edit($, { Q1: "4" });
    const snap = await armed(storage, ns);
    plan.responses = refuse(400, "INVALID_PARAMS"); plan.receipt = refuse(404, "NOT_FOUND_OR_NOT_VISIBLE"); await submit($);
    expect($("participant-error").hidden).toBe(false); expect($("participant-error").textContent).toBe(copy.cannotResume);
    expect($("participant-resume").textContent).toBe(""); expect($("recover").hidden).toBe(true);
    expect($("answers").hidden).toBe(true); expect(snapshot(storage)).toBe(snap);
  });
  it("F7e lost success → edit → 400 with a live probe: the committed receipt is shown; draft and key cleared; counts unchanged", async () => {
    const link = await issue(); const { $, storage, ns, plan, lost, bodies } = await openForm(link);
    const before = await counts();
    plan.responses = lost; await submit($); expect($("participant-resume").textContent).toBe(copy.submitUncertain);
    plan.responses = null; await edit($, { Q1: "4" });
    plan.responses = refuse(400, "INVALID_PARAMS"); await submit($);
    expect($("receipt").hidden).toBe(false); expect($("receipt").textContent).toContain(bodies[0].result.response_id);
    expect($("participant-resume").textContent).toBe(`${copy.receiptThanks} ${copy.sameLinkOthers}`);
    expect(storage.getItem(ns + "draft")).toBeNull(); expect(storage.getItem(ns + "submitKey")).toBeNull();
    expect(await counts()).toBe(before + 1);
  });
  it("F8 earlier uncertain (nothing committed) → edit → 400 with probe submitted:false: uncertain retained, never submitFailed", async () => {
    const link = await issue(); const { $, storage, ns, plan } = await openForm(link);
    const before = await counts();
    plan.responses = refuse(503, "INTERNAL"); await submit($); expect($("participant-resume").textContent).toBe(copy.submitUncertain);
    plan.responses = null; await edit($, { Q1: "4" });
    const snap = await armed(storage, ns);
    plan.responses = refuse(400, "INVALID_PARAMS"); await submit($); // real probe: submitted:false
    expectUncertain($, storage, snap); expect(await counts()).toBe(before);
  });
  it("F11 recover after a lost submit with GET /receipt → 404: #error empty and hidden, cannotResume copy, #participant-resume cleared, storage byte-identical", async () => {
    const link = await issue(); const { $, storage, ns, plan, lost } = await openForm(link);
    plan.responses = lost; await submit($); expect($("participant-resume").textContent).toBe(copy.submitUncertain);
    const snap = await armed(storage, ns); warns.length = 0;
    plan.receipt = refuse(404, "NOT_FOUND_OR_NOT_VISIBLE");
    await $("recover").dispatch("click"); await settled($); strict($);
    expect($("notice").textContent).toBe(ATTENTION);
    expect($("participant-error").hidden).toBe(false); expect($("participant-error").textContent).toBe(copy.cannotResume);
    expect($("participant-resume").textContent).toBe("");
    expect($("answers").hidden).toBe(true); expect(snapshot(storage)).toBe(snap);
    expect(warns).toEqual([["[3dr] recover", { status: 404, code: "NOT_FOUND_OR_NOT_VISIBLE", trace_id: "tr_synthetic0001" }]]);
  });
  it("F11b recover after a lost submit with GET /receipt → 503: #error empty, uncertainty retained, form still available, storage byte-identical", async () => {
    const link = await issue(); const { $, storage, ns, plan, lost } = await openForm(link);
    plan.responses = lost; await submit($);
    const snap = await armed(storage, ns);
    plan.receipt = refuse(503, "INTERNAL");
    await $("recover").dispatch("click"); await settled($); strict($);
    expectUncertain($, storage, snap);
    expect($("review").hidden).toBe(false);
  });
  for (const [row, status, code, expected] of [["F11c", 503, "INTERNAL", "transient"], ["F11d", 429, "RATE_LIMITED", "rateLimited"]] as const) it(`${row} fresh open, Recover with GET /receipt → ${status}: ${expected} copy in #participant-resume, form and Recover stay, #error empty, storage byte-identical`, async () => {
    const link = await issue(); const storage = memoryStorage(); const { plan, fetcher } = router();
    const $ = await boot(storage, link.entry_fragment, fetcher); strict($);
    expect($("answers").hidden).toBe(false); expect($("recover").hidden).toBe(false);
    const snap = snapshot(storage);
    plan.receipt = refuse(status, code);
    await $("recover").dispatch("click"); await settled($); strict($);
    expect($("participant-resume").textContent).toBe(copy[expected]);
    expect($("participant-error").hidden).toBe(true);
    expect($("answers").hidden).toBe(false); expect($("review").hidden).toBe(true); expect($("recover").hidden).toBe(false);
    expect($("notice").textContent).toBe(ATTENTION);
    expect(snapshot(storage)).toBe(snap);
  });
  const unreadable = async () => new Response("<html>gateway</html>", { status: 502 });
  const conflictProbes: [string, string, Route][] = [
    ["F5-M1", "probe 429", refuse(429, "RATE_LIMITED")],
    ["F5-M2", "probe 503", refuse(503, "INTERNAL")],
    ["F5-M3", "probe throws", offline],
    ["F5-M4", "probe unreadable body", unreadable],
  ];
  for (const [row, label, probe] of conflictProbes) it(`${row} first submit 409 STAGE_CONFLICT then ${label}: always submitUncertain (never the probe's wording), review and Recover stay, storage byte-identical; released retry commits`, async () => {
    const link = await issue(); const { $, storage, ns, plan, bodies } = await openForm(link);
    const before = await counts(); const snap = await armed(storage, ns);
    plan.responses = refuse(409, "STAGE_CONFLICT"); plan.receipt = probe; await submit($);
    expectUncertain($, storage, snap);
    expect($("participant-resume").textContent).not.toBe(copy.rateLimited); expect($("participant-resume").textContent).not.toBe(copy.transient);
    expect($("review").hidden).toBe(false); expect($("answers").hidden).toBe(true); expect($("recover").hidden).toBe(false);
    expect(await counts()).toBe(before);
    plan.responses = null; plan.receipt = null; await submit($);
    expect($("receipt").hidden).toBe(false); expect($("receipt").textContent).toMatch(/^Response saved · resp_/);
    expect(bodies[0].result.duplicate).toBe(false); expect(await counts()).toBe(before + 1);
    expect(storage.getItem(ns + "draft")).toBeNull(); expect(storage.getItem(ns + "submitKey")).toBeNull();
  });
  it("F5-M5 409 STAGE_CONFLICT with a live probe that says submitted:true: own receipt shown, draft and key cleared", async () => {
    const link = await issue(); const { $, storage, ns, plan, bodies, lost } = await openForm(link);
    plan.responses = lost; await submit($); // commit whose reply was lost
    plan.responses = null; await edit($, { Q1: "4" });
    plan.responses = refuse(409, "STAGE_CONFLICT"); await submit($); // real probe: submitted:true
    expect($("receipt").hidden).toBe(false); expect($("receipt").textContent).toContain(bodies[0].result.response_id);
    expect($("participant-error").hidden).toBe(true);
    expect(storage.getItem(ns + "draft")).toBeNull(); expect(storage.getItem(ns + "submitKey")).toBeNull();
  });
  it("F10 fragment entry with GET /receipt → 503: transient copy shown, #error stays empty and hidden", async () => {
    const link = await issue(); const storage = memoryStorage(); const { plan, fetcher } = router();
    plan.receipt = refuse(503, "INTERNAL");
    const $ = await boot(storage, link.entry_fragment, fetcher);
    strict($);
    expect($("participant-error").hidden).toBe(false); expect($("participant-error").textContent).toBe(copy.transient);
    expect($("answers").hidden).toBe(true); expect($("notice").textContent).toBe(ATTENTION);
    expect(storage.getItem((await digestNamespace(link.link_token)) + "bearer")).toMatch(/^pt_/);
  });
});
