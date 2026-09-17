// Browser-side shared-link behaviour, run as vitest unit tests against the DEV-ONLY
// contract fixture (test/fixtures/shared-link-contract.dev.mjs). This is not an
// integrated-behaviour proof: the fixture fakes the API, and there is no DOM here.
// The real-browser oracle (Playwright/Chromium against the API candidate) is a reviewer step.
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module without types
import { createSharedLinkClient, digestNamespace, parseEntryFragment, restoreDraft, saveDraft, scopedStorage, shareUrl, stripFragment, unavailableState, copy } from "../ui/shared-link.js";
// @ts-expect-error plain JS module without types
import { FORM, createFixture, memoryStorage } from "./fixtures/shared-link-contract.dev.mjs";

const TOKEN_A = "tokA/with+odd=chars";
const TOKEN_B = "tokB";
const liveLinks = () => ({ [TOKEN_A]: { state: "live" }, [TOKEN_B]: { state: "live" } });

async function context(fixture: any, token: string) {
  const storage = memoryStorage();
  const store = scopedStorage(storage, await digestNamespace(token));
  const client = createSharedLinkClient({ fetchImpl: fixture.fetchImpl, store });
  return { storage, store, client };
}

describe("entry fragment", () => {
  it("parses only #survey=<encoded token> and rejects empty or other shapes", () => {
    expect(parseEntryFragment(`#survey=${encodeURIComponent(TOKEN_A)}`)).toBe(TOKEN_A);
    expect(parseEntryFragment("#survey=")).toBeNull();
    expect(parseEntryFragment("#survey=%20")).toBeNull();
    expect(parseEntryFragment("#session=abc")).toBeNull();
    expect(parseEntryFragment("?survey=abc")).toBeNull();
    expect(parseEntryFragment("#survey=a&x=1")).toBeNull();
    expect(parseEntryFragment("#survey=%E0%A4%A")).toBeNull(); // bad percent-encoding
    expect(parseEntryFragment("")).toBeNull();
  });
  it("strips the fragment from history without keeping the token", () => {
    const calls: any[] = [];
    stripFragment({ history: { replaceState: (...a: any[]) => calls.push(a) }, location: { pathname: "/", search: "" } });
    expect(calls).toEqual([[null, "", "/"]]);
  });
});

describe("namespace", () => {
  it("isolates two tokens in one storage and never stores the token itself", async () => {
    const storage = memoryStorage();
    const a = scopedStorage(storage, await digestNamespace(TOKEN_A));
    const b = scopedStorage(storage, await digestNamespace(TOKEN_B));
    a.set("bearer", "pt_a"); b.set("bearer", "pt_b");
    expect(a.get("bearer")).toBe("pt_a"); expect(b.get("bearer")).toBe("pt_b");
    for (const key of storage.keys()) { expect(key).toMatch(/^shared:[0-9a-f]{64}:/); expect(key).not.toContain(TOKEN_A); expect(key).not.toContain(TOKEN_B); }
    expect(await digestNamespace(TOKEN_A)).toBe(await digestNamespace(TOKEN_A));
  });
});

describe("participant open", () => {
  it("posts the token in the body only, with credentials omit and no Authorization", async () => {
    const fx = createFixture({ links: liveLinks() });
    const { client } = await context(fx, TOKEN_A);
    const opened = await client.open(TOKEN_A);
    expect(opened.participant_token).toMatch(/^pt_[A-Za-z0-9_-]{32}$/);
    const call = fx.calls[0];
    expect(call.url).toBe("/v2/participate/link");
    expect(call.credentials).toBe("omit");
    expect(call.headers.authorization).toBeUndefined();
    expect(call.body).toEqual({ token: TOKEN_A });
    for (const c of fx.calls) expect(c.credentials).toBe("omit");
  });
  it("two independent storages opening the same link become two respondents with separate receipts", async () => {
    const fx = createFixture({ links: liveLinks() });
    const one = await context(fx, TOKEN_A), two = await context(fx, TOKEN_A);
    await one.client.open(TOKEN_A); await two.client.open(TOKEN_A);
    expect(one.client.bearer).not.toBe(two.client.bearer);
    const r1 = await one.client.submit({ q1: 3, q2: ["a"] });
    const r2 = await two.client.submit({ q1: 5, q2: ["none"] });
    expect(r1.response_id).not.toBe(r2.response_id);
    expect((await one.client.receipt()).response_id).toBe(r1.response_id);
    expect((await two.client.receipt()).response_id).toBe(r2.response_id);
  });
  it("reload in the same storage resumes the same respondent and its own draft", async () => {
    const fx = createFixture({ links: liveLinks() });
    const { storage, store, client } = await context(fx, TOKEN_A);
    await client.open(TOKEN_A);
    const form = await client.form();
    saveDraft(store, form, { q1: "4", q2: ["a"], ghost: "x" });
    // reload: new client over the same storage
    const again = createSharedLinkClient({ fetchImpl: fx.fetchImpl, store: scopedStorage(storage, await digestNamespace(TOKEN_A)) });
    const opened = await again.open(TOKEN_A);
    expect(opened.resumed).toBe(true);
    expect(again.bearer).toBe(client.bearer);
    expect(fx.calls.at(-1).body).toEqual({ token: TOKEN_A, resume_token: client.bearer });
    expect(restoreDraft(store, form)).toEqual({ answers: { q1: "4", q2: ["a"] } }); // unknown item id dropped
  });
});

describe("draft", () => {
  it("rejects a draft written against another template/version", async () => {
    const store = scopedStorage(memoryStorage(), "shared:test:");
    saveDraft(store, { ...FORM, template: { id: "tpl_team", version: 2 } }, { q1: "1" });
    expect(restoreDraft(store, FORM)).toEqual({ mismatch: true });
    saveDraft(store, { ...FORM, template: { id: "tpl_other", version: 3 } }, { q1: "1" });
    expect(restoreDraft(store, FORM)).toEqual({ mismatch: true });
  });
  it("an empty draft is not stored and is not a response", () => {
    const store = scopedStorage(memoryStorage(), "shared:test:");
    saveDraft(store, FORM, { q1: "", q2: [] });
    expect(store.get("draft")).toBeNull();
    expect(restoreDraft(store, FORM)).toBeNull();
  });
  it("a failed submit keeps the draft and the submit key; retry reuses the key; success clears both", async () => {
    const fx = createFixture({ links: liveLinks() });
    const { store, client } = await context(fx, TOKEN_A);
    await client.open(TOKEN_A);
    saveDraft(store, FORM, { q1: "2" });
    fx.failNextSubmit();
    await expect(client.submit({ q1: 2, q2: null })).rejects.toThrow(/UNAVAILABLE/);
    expect(store.get("draft")).not.toBeNull();
    const key = store.get("submitKey"); expect(key).toBeTruthy();
    const result = await client.submit({ q1: 2, q2: null });
    expect(fx.calls.at(-1).body.idempotency_key).toBe(key);
    expect(result.submitted).toBe(true);
    expect(store.get("draft")).toBeNull(); expect(store.get("submitKey")).toBeNull();
  });
});

describe("unavailable states", () => {
  it("closed collection refuses new answers but replays the own receipt", async () => {
    const fx = createFixture({ links: liveLinks() });
    const { client } = await context(fx, TOKEN_A);
    const late = await context(fx, TOKEN_A);
    await client.open(TOKEN_A); await late.client.open(TOKEN_A);
    const submitted = await client.submit({ q1: 1, q2: null });
    fx.close(TOKEN_A);
    let state: string | null = null;
    try { await client.open(TOKEN_A); } catch (e) { state = unavailableState(e); }
    expect(state).toBe("closed");
    expect((await client.receipt()).response_id).toBe(submitted.response_id); // own receipt replays
    await expect(late.client.submit({ q1: 1, q2: null })).rejects.toMatchObject({ code: "COLLECTION_CLOSED" }); // close between form and submit refuses
    expect(late.store.get("draft")).toBeNull(); expect(late.store.get("submitKey")).not.toBeNull(); // key retained on refusal
    // a fresh context on the closed link cannot open at all
    const fresh = await context(fx, TOKEN_A);
    await expect(fresh.client.open(TOKEN_A)).rejects.toMatchObject({ code: "COLLECTION_CLOSED" });
    expect(copy.collectionClosed.startsWith("Collection has closed")).toBe(true);
  });
  it("revoked/unknown link maps to the unavailable-link state and the error text carries no token", async () => {
    const fx = createFixture({ links: { [TOKEN_A]: { state: "revoked" } } });
    const { client } = await context(fx, TOKEN_A);
    let error: any;
    try { await client.open(TOKEN_A); } catch (e) { error = e; }
    expect(unavailableState(error)).toBe("revoked");
    expect(String(error.message)).not.toContain(TOKEN_A);
    expect(copy.linkUnavailable.startsWith("This link no longer works")).toBe(true);
  });
});

describe("staff issue", () => {
  it("dry-run then execute yields entry_fragment; UI builds origin + '/' + fragment and the fragment round-trips the token", async () => {
    const fx = createFixture();
    const staff = async (body: any) => (await (await fx.fetchImpl("/v2/assessments/a1/surveys/s1/links", { method: "POST", headers: { authorization: "Bearer st_staff" }, body: JSON.stringify(body) })).json()).result;
    const preview = await staff({ params: {}, mode: "dry_run" });
    const issued = await staff({ params: {}, mode: "execute", confirm_token: preview.confirm_token });
    expect(issued.entry_fragment.startsWith("#survey=")).toBe(true);
    const url = shareUrl("https://example.invalid", issued.entry_fragment);
    expect(url).toBe(`https://example.invalid/${issued.entry_fragment}`);
    expect(parseEntryFragment(new URL(url).hash)).toBe(issued.link_token);
    expect(() => shareUrl("https://example.invalid", "#survey=")).toThrow();
    // copied URL opens as a participant
    const { client } = await context(fx, issued.link_token);
    await expect(client.open(parseEntryFragment(new URL(url).hash)!)).resolves.toMatchObject({ resumed: false });
  });
});
