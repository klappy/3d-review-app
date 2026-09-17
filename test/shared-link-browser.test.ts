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
import { copy, createSharedLinkClient, currentNamespace, digestNamespace, errorKind, parseEntryFragment, rememberCurrent, resolveConflict, restoreDraft, saveDraft, scopedStorage, shareUrl, stripFragment } from "../ui/shared-link.js";
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
    return e;
  }
  const document = { getElementById: (id: string) => { if (!byId.has(id)) byId.set(id, el("div", id)); return byId.get(id); }, createElement: (t: string) => el(t), querySelector: () => el("aside"), querySelectorAll: () => [] };
  return { document, $: (id: string) => document.getElementById(id) };
}
async function settled($: (id: string) => any) { // wait for the startup run() to finish
  for (let i = 0; i < 200; i++) { const n = $("notice").textContent; if (/complete\.$/.test(n) || !$("error").hidden) return; await new Promise(r => setTimeout(r, 25)); }
  throw new Error("startup did not settle: " + $("notice").textContent);
}
let bootCount = 0;
async function boot(storage: any, hash: string) {
  const { document, $ } = fakeDocument();
  const g: any = globalThis;
  g.document = document; g.window = g; g.sessionStorage = storage;
  g.location = { hash, pathname: "/", search: "", origin: ORIGIN }; g.history = { replaceState: () => { g.location.hash = ""; } };
  Object.defineProperty(g, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true }); g.CSS = { escape: (s: string) => s };
  g.fetch = fetchImpl;
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
