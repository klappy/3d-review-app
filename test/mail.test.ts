// OF-3 sender adapter: honest by construction. The provider is stubbed at fetch; no network, no real address.
import { afterEach, describe, expect, it, vi } from "vitest";
import { invitationMessage, parseMailAllowlist, sendMail } from "../src/mail";
import { sha256 } from "../src/handlers/common";

afterEach(() => vi.restoreAllMocks());
const prod: any = { ENVIRONMENT: "production", RESEND_API_KEY: "re_test_only", MAIL_FROM: "3D Review <no-reply@mail.test-sender.dev>", PUBLIC_ORIGIN: "https://3d-review.klappy.dev" };
const msg = { to: "person@real-domain.dev", subject: "s", text: "t", idempotencyKey: "invite/inv_1" };
const ok = () => new Response(JSON.stringify({ id: "re_x" }), { status: 200 });
const resendCalls = (f: any) => f.mock.calls.filter(([u]: any[]) => String(u).includes("resend")).length;

describe("mail adapter", () => {
  it("never pretends: unconfigured and synthetic recipients are delivered:false / state not_sent with a reason and no network call", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    expect(await sendMail({ ...prod, RESEND_API_KEY: undefined }, msg)).toEqual({ delivered: false, state: "not_sent", reason: "not_configured" });
    expect(await sendMail({ ...prod, MAIL_FROM: undefined }, msg)).toEqual({ delivered: false, state: "not_sent", reason: "not_configured" });
    for (const to of ["rina@example.invalid", "a@b.test", "x@example.com", "y@thing.example", " X@Example.COM ", "x@sub.example.com", "x@bar.example.org", "x@host.localhost"]) expect(await sendMail(prod, { ...msg, to }), to).toEqual({ delivered: false, state: "not_sent", reason: "synthetic_recipient" });
    // exactly one plain mailbox or nothing leaves (review #16-3)
    for (const to of ["Rina <rina@real-domain.dev>", "x@real-domain.dev.", "x@localhost", "a@x.dev, b@y.dev", "x@real-domain.dev\r\nBcc: y@evil.dev", "x y@real-domain.dev", "@real-domain.dev", "x@", "", ".lead@real-domain.dev", "a..b@real-domain.dev", "a@-bad-.dev", "o'brien@real-domain.dev"]) expect(await sendMail(prod, { ...msg, to }), JSON.stringify(to)).toEqual({ delivered: false, state: "not_sent", reason: "invalid_address" });
    for (const to of ["first.last+tag@sub.real-domain.dev", "USER@Real-Domain.DEV", "user@xn--e1afmkfd.xn--p1ai", "u_s-e%r@a-b.museum"]) expect((await sendMail({ ...prod, RESEND_API_KEY: undefined }, { ...msg, to })).reason, to).toBe("not_configured"); // accepted shapes
    expect((await sendMail(prod, { ...msg, to: "person@foo.contest" })).reason).toBeUndefined(); // no false positive on a real TLD
    expect(resendCalls(f)).toBe(1); // only the .contest probe reached the provider stub
  });

  it("environment policy is fail-closed: anything that is not production, and not an allowlisted dev recipient, never reaches the provider", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    const hash = await sha256("person@real-domain.dev");
    // unknown / missing environments
    for (const ENVIRONMENT of [undefined, "staging", "preview", "DEV", "production ", ""]) expect(await sendMail({ ...prod, ENVIRONMENT }, msg), String(ENVIRONMENT)).toEqual({ delivered: false, state: "not_sent", reason: "not_allowed_env" });
    // dev without a usable allowlist
    const dev = (MAIL_ALLOWLIST_SHA256?: string) => ({ ...prod, ENVIRONMENT: "dev", MAIL_ALLOWLIST_SHA256 });
    for (const list of [undefined, "", "   ", ",,", "not-a-hash", hash.toUpperCase(), hash.slice(0, 63), hash + "a", `${hash},nope`, `${hash},${hash.slice(0, 10)}`])
      expect(await sendMail(dev(list), msg), JSON.stringify(list)).toEqual({ delivered: false, state: "not_sent", reason: "not_allowlisted" });
    // a well-formed list that does not contain this recipient
    expect(await sendMail(dev(`${await sha256("someone.else@real-domain.dev")}, ${await sha256("third@real-domain.dev")}`), msg)).toEqual({ delivered: false, state: "not_sent", reason: "not_allowlisted" });
    // dev + allowlisted, but unconfigured → still no fetch
    expect(await sendMail({ ...dev(hash), RESEND_API_KEY: undefined }, msg)).toEqual({ delivered: false, state: "not_sent", reason: "not_configured" });
    expect(await sendMail({ ...dev(hash), MAIL_FROM: undefined }, msg)).toEqual({ delivered: false, state: "not_sent", reason: "not_configured" });
    // a synthetic recipient is refused BEFORE the environment/allowlist check — an allowlist cannot re-enable it
    const syn = "rina@example.invalid";
    expect(await sendMail(dev(await sha256(syn)), { ...msg, to: syn })).toEqual({ delivered: false, state: "not_sent", reason: "synthetic_recipient" });
    expect(resendCalls(f)).toBe(0); // nothing above may touch the provider
  });

  it("dev + allowlisted + configured: exactly one POST with the normalised recipient (mixed case and whitespace in, one address out)", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "re_msg_dev" }), { status: 200 }));
    const env: any = { ...prod, ENVIRONMENT: "dev", MAIL_ALLOWLIST_SHA256: `${await sha256("someone.else@real-domain.dev")},${await sha256("person@real-domain.dev")}` };
    expect(await sendMail(env, { ...msg, to: "  PeRsOn@Real-Domain.DEV  " })).toEqual({ delivered: true, state: "accepted", provider: "resend", provider_message_id: "re_msg_dev" });
    expect(resendCalls(f)).toBe(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(init.body as string).to).toEqual(["person@real-domain.dev"]);
  });

  it("production + configured: one POST to Resend with the idempotency key; delivered only on provider acceptance", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "re_msg_1" }), { status: 200 }));
    expect(await sendMail(prod, msg)).toEqual({ delivered: true, state: "accepted", provider: "resend", provider_message_id: "re_msg_1" });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as any)["idempotency-key"]).toBe("invite/inv_1");
    expect(JSON.parse(init.body as string)).toMatchObject({ from: prod.MAIL_FROM, to: ["person@real-domain.dev"] });
  });

  it("a provider refusal is 'refused' with its status; a timeout or outage is 'unconfirmed', never a second attempt", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 422 }));
    expect(await sendMail(prod, msg)).toEqual({ delivered: false, state: "refused", provider: "resend", reason: "provider_error", provider_status: 422 });
    f.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect(await sendMail(prod, msg)).toEqual({ delivered: false, state: "refused", provider: "resend", reason: "provider_error", provider_status: 500 });
    // AbortSignal.timeout / network failure: the request MAY have been accepted remotely, so nothing is claimed and nothing retried
    f.mockRejectedValueOnce(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
    const before = f.mock.calls.length;
    expect(await sendMail(prod, msg)).toEqual({ delivered: false, state: "unconfirmed", provider: "resend", reason: "provider_unreachable" });
    expect(f.mock.calls.length - before).toBe(1);
    f.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await sendMail(prod, msg)).toEqual({ delivered: false, state: "unconfirmed", provider: "resend", reason: "provider_unreachable" });
  });

  it("the allowlist parser closes on anything it does not fully understand", () => {
    const h = "a".repeat(64);
    expect(parseMailAllowlist(`${h} , ${"b".repeat(64)}`)).toEqual(new Set([h, "b".repeat(64)]));
    for (const bad of [undefined, null, 42, "", " , ", h.toUpperCase(), `${h},x`, h.slice(1), h + "0", "g".repeat(64)]) expect(parseMailAllowlist(bad as any), JSON.stringify(bad)).toBeNull();
  });

  it("an EMPTY comma-separated entry is malformed too: a trailing comma, a doubled comma or a whitespace-only entry closes the whole list", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    const h = await sha256("person@real-domain.dev");
    // the parser: a valid hash plus an empty entry is NOT a one-entry list, it is an unreadable list
    for (const bad of [`${h},`, `,${h}`, `${h},,${h}`, `${h}, ,${h}`, `${h},\t,${h}`, `${h},`.repeat(2)])
      expect(parseMailAllowlist(bad), JSON.stringify(bad)).toBeNull();
    // …and the adapter therefore refuses the recipient outright, without touching the provider
    for (const list of [`${h},`, `${h},,${h}`, `${h}, ,${h}`])
      expect(await sendMail({ ...prod, ENVIRONMENT: "dev", MAIL_ALLOWLIST_SHA256: list } as any, msg), JSON.stringify(list))
        .toEqual({ delivered: false, state: "not_sent", reason: "not_allowlisted" });
    expect(resendCalls(f)).toBe(0);
  });

  it("invitation text carries the link, the expiry, the no-password instruction — and no project contents", () => {
    const m = invitationMessage("https://3d-review.klappy.dev", "il_abc/+", "member", "assessment", 7);
    expect(m.link).toBe("https://3d-review.klappy.dev/#invite=il_abc%2F%2B");
    expect(m.text).toContain(m.link); expect(m.text).toContain("7 days"); expect(m.text).toContain("no password");
    expect(m.html).not.toMatch(/<img|<script/i);
  });
});

// Handler-level production path (review #16-1, #16-2, #16-7): through execute(), provider stubbed at fetch.
import { readFileSync } from "node:fs";
import { afterAll } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { execute } from "../src/dispatch";
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "mailh", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "mailh-db", DB2: "mailh-db2", DB3: "mailh-db3", DB4: "mailh-db4", DB5: "mailh-db5", DB6: "mailh-db6", DB7: "mailh-db7", DB8: "mailh-db8", DB9: "mailh-db9", DB10: "mailh-db10", DB11: "mailh-db11", DB12: "mailh-db12", DB13: "mailh-db13" } }] }));
afterAll(() => mf.dispose());
/** A fresh schema + synthetic seed on one of this file's two isolated D1 bindings. */
async function freshDb(binding: "DB" | "DB2" | "DB3" | "DB4" | "DB5" | "DB6" | "DB7" | "DB8" | "DB9" | "DB10" | "DB11" | "DB12" | "DB13") {
  const db = await mf.getD1Database(binding);
  const stmts = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n").split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
  for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql"]) await db.batch(stmts(`../migrations/${m}`));
  await db.batch(stmts("../seed/synthetic.sql"));
  return db;
}
describe("cap.grant.invite in production, provider stubbed", () => {
  it("a replayed confirm_token mails ONCE; the row is 'sent' only on acceptance; nothing identifying the invitee is persisted; the hourly cap holds", async () => {
    const db = await freshDb("DB");
    const env: any = { DB: db, SESSION_SECRET: "synthetic-mail", ...prod };
    let n = 0; const ctx = () => ({ env, db, principal: { kind: "user", id: "person_mara", provisioned: true }, traceId: `tr_mail_${++n}`, now: () => new Date(), log: () => {} }) as any;
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "re_msg_9" }), { status: 200 }));
    const params = { scope: "assessment", id: "assess_tavo_collect", email: "Victim.Person@Real-Domain.dev", role: "viewer" };
    const dry: any = await execute(ctx(), "cap.grant.invite", params, { tool: "danger", mode: "dry_run" });
    const runs: any[] = []; for (let i = 0; i < 3; i++) runs.push(await execute(ctx(), "cap.grant.invite", params, { tool: "danger", mode: "execute", confirm_token: dry.result.confirm_token }));
    expect(f).toHaveBeenCalledTimes(1);
    expect(runs.map((r) => r.result.delivered)).toEqual([true, false, false]);
    expect(runs[0].result.delivery).toMatchObject({ provider: "resend", state: "accepted", reason: null });
    expect(runs[1].result.delivery).toMatchObject({ state: "not_sent", reason: "duplicate_recent" }); expect(runs[1].result.invitation_id).toBe(runs[0].result.invitation_id);
    expect((await db.prepare("SELECT COUNT(*) AS n FROM invitation WHERE scope_id = 'assess_tavo_collect' AND role = 'viewer'").first<{ n: number }>())!.n).toBe(1);
    expect((await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(runs[0].result.invitation_id).first<{ status: string }>())!.status).toBe("sent");
    const dump = JSON.stringify([(await db.prepare("SELECT * FROM trace").all()).results, (await db.prepare("SELECT * FROM receipt").all()).results, (await db.prepare("SELECT * FROM invitation").all()).results, runs]);
    expect(dump.toLowerCase()).not.toContain("victim"); expect(dump.toLowerCase()).not.toContain("real-domain");
    // CONCURRENT replays of one confirm_token: one statement decides, so one row and one mail (re-review #16)
    const pc = { ...params, email: "concurrent.person@real-domain.dev" };
    const dc: any = await execute(ctx(), "cap.grant.invite", pc, { tool: "danger", mode: "dry_run" });
    const callsBefore = f.mock.calls.length;
    const par: any[] = await Promise.all([1, 2, 3, 4, 5].map(() => execute(ctx(), "cap.grant.invite", pc, { tool: "danger", mode: "execute", confirm_token: dc.result.confirm_token })));
    expect(f.mock.calls.length - callsBefore).toBe(1);
    expect(par.filter((r) => r.result.delivered).length).toBe(1); expect(new Set(par.map((r) => r.result.invitation_id)).size).toBe(1);
    // a different role inside the window is refused loudly, never reported as ok with the old role
    const dr: any = await execute(ctx(), "cap.grant.invite", { ...pc, role: "member" }, { tool: "danger", mode: "dry_run" });
    const rr: any = await execute(ctx(), "cap.grant.invite", { ...pc, role: "member" }, { tool: "danger", mode: "execute", confirm_token: dr.result.confirm_token });
    expect(rr.error.code).toBe("INVALID_PARAMS"); expect(rr.error.docs).toBe("cap.grant.revoke_invitation");
    // provider refusal → row stays pending, state 'refused' with the status
    f.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const p2 = { ...params, email: "other.person@real-domain.dev" };
    const d2: any = await execute(ctx(), "cap.grant.invite", p2, { tool: "danger", mode: "dry_run" });
    const r2: any = await execute(ctx(), "cap.grant.invite", p2, { tool: "danger", mode: "execute", confirm_token: d2.result.confirm_token });
    expect(r2.result.status).toBe("pending"); expect(r2.result.delivery).toMatchObject({ state: "refused", reason: "provider_error", provider_status: 500 });
    // …and a never-mailed 'pending' row stops blocking a retry after 30 s (it could never be accepted: the token was never delivered)
    let clock = Date.now() + 31_000; const later = () => ({ ...ctx(), now: () => new Date(clock) });
    const d2b: any = await execute(later(), "cap.grant.invite", p2, { tool: "danger", mode: "dry_run" });
    const r2b: any = await execute(later(), "cap.grant.invite", p2, { tool: "danger", mode: "execute", confirm_token: d2b.result.confirm_token });
    expect(r2b.result.delivered).toBe(true); expect(r2b.result.invitation_id).not.toBe(r2.result.invitation_id);
    // participant-link rows (cap.survey.issue_link) never count against the collaborator-invite cap
    await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, assessment_survey_id, invitee_hash, token_hash, role, status, created_by, created_at) SELECT 'invite_link_' || value, 'survey', 'survey_tavo', 'survey_tavo', NULL, 'tl_' || value, 'participant', 'pending', 'person_mara', ? FROM json_each('[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40]')").bind(new Date().toISOString()).run();
    const p4 = { ...params, email: "after.workshop@real-domain.dev" };
    const d4: any = await execute(ctx(), "cap.grant.invite", p4, { tool: "danger", mode: "dry_run" });
    expect((await execute(ctx(), "cap.grant.invite", p4, { tool: "danger", mode: "execute", confirm_token: d4.result.confirm_token }) as any).ok).toBe(true);
    // hourly cap per inviter
    await db.prepare("INSERT INTO invitation (id, scope_type, scope_id, invitee_hash, token_hash, role, status, created_by, created_at) SELECT 'inv_fill_' || value, 'assessment', 'assess_tavo_collect', 'h_' || value, 't_' || value, 'viewer', 'pending', 'person_mara', ? FROM json_each('[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]')").bind(new Date().toISOString()).run();
    expect((await db.prepare("SELECT COUNT(*) AS n FROM invitation WHERE created_by='person_mara' AND scope_type<>'survey'").first<{ n: number }>())!.n).toBe(30);
    const p3 = { ...params, email: "third.person@real-domain.dev" };
    const d3: any = await execute(ctx(), "cap.grant.invite", p3, { tool: "danger", mode: "dry_run" });
    const r3: any = await execute(ctx(), "cap.grant.invite", p3, { tool: "danger", mode: "execute", confirm_token: d3.result.confirm_token });
    expect(r3.ok).toBe(false); expect(r3.error.code).toBe("RATE_LIMITED");
  }, 60_000);

  it("an unconfirmed send stores the invitation as 'unconfirmed', says the recipient has not accepted, and is not retried inside the call", async () => {
    const db = await freshDb("DB2");
    const env: any = { DB: db, SESSION_SECRET: "synthetic-mail", ...prod };
    const ctx = () => ({ env, db, principal: { kind: "user", id: "person_mara", provisioned: true }, traceId: `tr_unconf_${Math.random()}`, now: () => new Date(), log: () => {} }) as any;
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
    const params = { scope: "assessment", id: "assess_tavo_collect", email: "timeout.person@real-domain.dev", role: "viewer" };
    const dry: any = await execute(ctx(), "cap.grant.invite", params, { tool: "danger", mode: "dry_run" });
    const r: any = await execute(ctx(), "cap.grant.invite", params, { tool: "danger", mode: "execute", confirm_token: dry.result.confirm_token });
    expect(f).toHaveBeenCalledTimes(1); // one attempt, no retry and no replay
    expect(r.result.delivered).toBe(false);
    expect(r.result.delivery).toMatchObject({ provider: "resend", state: "unconfirmed", reason: "provider_unreachable" });
    expect(r.result.status).toBe("unconfirmed"); // AMEND P2: the row records the uncertainty instead of looking never-mailed
    expect(String(r.result.note)).toMatch(/has not accepted/);
    expect((await db.prepare("SELECT status FROM invitation WHERE id = ?").bind(r.result.invitation_id).first<{ status: string }>())!.status).toBe("unconfirmed");
  }, 30_000);
});

// ── Independent review AMEND: P1 (no terminal state is ever resurrected) and P2 (no replay of an uncertain attempt) ──────────
// The provider is a fetch stub whose promise this file resolves BY HAND, so a revoke or an accept can be made to land while the
// send is still in flight. Fake time is ctx.now() — the handlers read the clock from there and nowhere else.
import { invite, revoke_invitation, accept, list as listGrants } from "../src/handlers/grant";
import { del as deleteWorkspace } from "../src/handlers/workspace";

const devMail = async (...addresses: string[]): Promise<any> => ({
  ...prod, ENVIRONMENT: "dev", MAIL_ALLOWLIST_SHA256: (await Promise.all(addresses.map((a) => sha256(a)))).join(","),
});
/** A fetch stub that parks: `entered` resolves with the request init as soon as the handler calls it, `release` finishes it. */
function parkedFetch() {
  let release!: (r: Response) => void; const gate = new Promise<Response>((r) => { release = r; });
  let saw!: (init: any) => void; const entered = new Promise<any>((r) => { saw = r; });
  const f = vi.spyOn(globalThis, "fetch").mockImplementation(((_u: any, init: any) => { saw(init); return gate; }) as any);
  return { f, entered, release };
}
const tokenOf = (init: any) => decodeURIComponent(String(JSON.parse(init.body as string).text).match(/#invite=(\S+)/)![1]);
const idOf = (init: any) => String((init.headers as any)["idempotency-key"]).replace(/^invite\//, "");
const statusOf = async (db: any, id: string) => (await db.prepare("SELECT status, accepted_at FROM invitation WHERE id = ?").bind(id).first<{ status: string; accepted_at: string | null }>())!;
const rowCount = async (db: any, hash: string) => (await db.prepare("SELECT COUNT(*) AS n FROM invitation WHERE invitee_hash = ?").bind(hash).first<{ n: number }>())!.n;
const SCOPE = { scope: "assessment", id: "assess_tavo_collect" };

/** owner-at-scope ctx factory on a fresh db, with a movable clock. */
async function bed(binding: "DB3" | "DB4" | "DB5" | "DB6" | "DB7" | "DB8" | "DB9" | "DB10" | "DB11" | "DB12" | "DB13", email: string) {
  const db = await freshDb(binding);
  const env = await devMail(email);
  env.DB = db; env.SESSION_SECRET = "synthetic-mail";
  let clock = Date.parse("2026-09-17T12:00:00.000Z"); let n = 0;
  const ctx = (principal = "person_mara") => ({ env, db, principal: { kind: "user", id: principal, provisioned: true }, traceId: `tr_amend_${++n}`, now: () => new Date(clock), log: () => {} }) as any;
  const advance = (ms: number) => { clock += ms; };
  const asRecipient = async () => { // a signed-in principal whose email_hash is this invitee's
    await db.prepare("INSERT OR IGNORE INTO principal (id, email_hash, provisioned, support, created_at) VALUES (?,?,1,0,?)").bind("person_invitee", await sha256(email), new Date(clock).toISOString()).run();
    return ctx("person_invitee");
  };
  return { db, ctx, advance, asRecipient, hash: await sha256(email) };
}

describe("cap.grant.invite — the post-network status write never resurrects a terminal state (AMEND P1)", () => {
  it("a revoke that lands while the send is in flight survives provider acceptance: stored status stays 'revoked', delivery still reports 'accepted', and the token is dead", async () => {
    const email = "race.revoke@real-domain.dev";
    const { db, ctx, asRecipient } = await bed("DB3", email);
    const { entered, release } = parkedFetch();
    const call = invite(ctx(), { ...SCOPE, email, role: "viewer" });
    const init = await entered;                      // the row is written and 'pending'; the send is parked
    const id = idOf(init), token = tokenOf(init);
    expect((await statusOf(db, id)).status).toBe("pending");
    const rv = await revoke_invitation(ctx(), { id }); // the human revokes DURING the send
    expect(rv.result).toMatchObject({ id, status: "revoked" });
    release(new Response(JSON.stringify({ id: "re_race_1" }), { status: 200 })); // …and only now the provider says 2xx
    const r: any = await call;
    expect((await statusOf(db, id)).status).toBe("revoked");            // the conditional UPDATE did not fire
    expect(r.result.status).toBe("revoked");                            // the result reports what is STORED
    expect(r.result.delivered).toBe(true);                              // …separately from what the provider said
    expect(r.result.delivery).toMatchObject({ state: "accepted", provider: "resend" });
    expect(String(r.result.note)).toMatch(/revoked/);
    await expect(accept(await asRecipient(), { token })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  }, 30_000);

  it("an accept that lands while the send is in flight is not downgraded: status stays 'accepted', accepted_at is preserved and the grant remains", async () => {
    const email = "race.accept@real-domain.dev";
    const { db, ctx, asRecipient } = await bed("DB4", email);
    const recipient = await asRecipient();
    const { entered, release } = parkedFetch();
    const call = invite(ctx(), { ...SCOPE, email, role: "viewer" });
    const init = await entered;
    const id = idOf(init), token = tokenOf(init);
    const acc = await accept(recipient, { token });   // the recipient accepts DURING the send
    expect(acc.result).toMatchObject({ granted: true, role: "viewer" });
    const afterAccept = await statusOf(db, id);
    expect(afterAccept.status).toBe("accepted"); expect(afterAccept.accepted_at).toBeTruthy();
    release(new Response(JSON.stringify({ id: "re_race_2" }), { status: 200 }));
    const r: any = await call;
    const afterSend = await statusOf(db, id);
    expect(afterSend.status).toBe("accepted");                          // no downgrade to 'sent'
    expect(afterSend.accepted_at).toBe(afterAccept.accepted_at);        // and nothing was rewritten
    expect(r.result.status).toBe("accepted");
    expect(r.result.delivery).toMatchObject({ state: "accepted" });
    expect(await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_id = ?').bind("person_invitee", SCOPE.id).first()).toBeTruthy();
  }, 30_000);

  // A provider REFUSAL transitions nothing, so before the AMEND it reported the default 'pending' regardless of what the row
  // actually said. The no-transition branches now re-read the stored status through the same helper.
  it("a delayed provider REFUSAL after a concurrent revoke reports the STORED 'revoked', not the default 'pending': delivery.state is 'refused' with its provider_status and the token is dead", async () => {
    const email = "race.refuse.revoke@real-domain.dev";
    const { db, ctx, asRecipient } = await bed("DB9", email);
    const { entered, release } = parkedFetch();
    const call = invite(ctx(), { ...SCOPE, email, role: "viewer" });
    const init = await entered;
    const id = idOf(init), token = tokenOf(init);
    expect((await statusOf(db, id)).status).toBe("pending");
    const rv = await revoke_invitation(ctx(), { id });   // the human revokes DURING the send
    expect(rv.result).toMatchObject({ id, status: "revoked" });
    release(new Response(JSON.stringify({ message: "domain not verified" }), { status: 422 })); // …and the provider then REFUSES
    const r: any = await call;
    expect((await statusOf(db, id)).status).toBe("revoked");
    expect(r.result.status).toBe("revoked");                         // the stored status, re-read on a no-transition outcome
    expect(r.result.delivered).toBe(false);
    expect(r.result.delivery).toMatchObject({ state: "refused", provider: "resend", provider_status: 422 });
    await expect(accept(await asRecipient(), { token })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  }, 30_000);

  it("a delayed provider REFUSAL after a concurrent accept reports the STORED 'accepted' with accepted_at and the grant preserved", async () => {
    const email = "race.refuse.accept@real-domain.dev";
    const { db, ctx, asRecipient } = await bed("DB10", email);
    const recipient = await asRecipient();
    const { entered, release } = parkedFetch();
    const call = invite(ctx(), { ...SCOPE, email, role: "viewer" });
    const init = await entered;
    const id = idOf(init), token = tokenOf(init);
    const acc = await accept(recipient, { token });     // the recipient accepts DURING the send
    expect(acc.result).toMatchObject({ granted: true, role: "viewer" });
    const afterAccept = await statusOf(db, id);
    expect(afterAccept.status).toBe("accepted"); expect(afterAccept.accepted_at).toBeTruthy();
    release(new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }));
    const r: any = await call;
    const afterSend = await statusOf(db, id);
    expect(afterSend.status).toBe("accepted");
    expect(afterSend.accepted_at).toBe(afterAccept.accepted_at);     // the refusal rewrote nothing
    expect(r.result.status).toBe("accepted");
    expect(r.result.delivered).toBe(false);
    expect(r.result.delivery).toMatchObject({ state: "refused", provider_status: 429 });
    expect(await db.prepare('SELECT role FROM "grant" WHERE principal_id = ? AND scope_id = ?').bind("person_invitee", SCOPE.id).first()).toBeTruthy();
  }, 30_000);

  it("a plain refusal with no concurrent change still reports 'pending' (regression): the re-read reports the row as it stands", async () => {
    const email = "plain.refuse@real-domain.dev";
    const { db, ctx } = await bed("DB11", email);
    const { entered, release } = parkedFetch();
    const call = invite(ctx(), { ...SCOPE, email, role: "viewer" });
    const init = await entered;
    const id = idOf(init);
    release(new Response(JSON.stringify({ message: "invalid from address" }), { status: 400 }));
    const r: any = await call;
    expect((await statusOf(db, id)).status).toBe("pending");
    expect(r.result.status).toBe("pending");
    expect(r.result.delivered).toBe(false);
    expect(r.result.delivery).toMatchObject({ state: "refused", provider_status: 400 });
  }, 30_000);
});

describe("cap.grant.invite — an uncertain attempt is never replayed, across calls, without a schema change (AMEND P2)", () => {
  it("a timeout stores the invitation as 'unconfirmed', and a later invite at +31 s and at +11 min returns the SAME invitation with duplicate_uncertain, no new row and no second fetch", async () => {
    const email = "uncertain.person@real-domain.dev";
    const { db, ctx, advance, hash } = await bed("DB5", email);
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
    const first: any = await invite(ctx(), { ...SCOPE, email, role: "viewer" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(first.result.status).toBe("unconfirmed");
    expect(first.result.delivery).toMatchObject({ state: "unconfirmed", reason: "provider_unreachable" });
    expect((await statusOf(db, first.result.invitation_id)).status).toBe("unconfirmed");
    // past PENDING_DEDUPE_S (30 s): a never-mailed 'pending' row would stop blocking here — an 'unconfirmed' row must not
    advance(31_000);
    const at31: any = await invite(ctx(), { ...SCOPE, email, role: "viewer" });
    expect(at31.result.invitation_id).toBe(first.result.invitation_id);
    expect(at31.result.status).toBe("unconfirmed");
    expect(at31.result.delivery).toMatchObject({ state: "unconfirmed", reason: "duplicate_uncertain" });
    expect(at31.result.delivered).toBe(false);
    expect(at31.result.dev_only_link_token).toBeUndefined();            // no token was minted
    // past INVITE_COOLDOWN_S (10 min): there is no cooldown expiry for an unexpired uncertain row
    advance(11 * 60_000);
    const at11m: any = await invite(ctx(), { ...SCOPE, email, role: "viewer" });
    expect(at11m.result.invitation_id).toBe(first.result.invitation_id);
    expect(at11m.result.delivery).toMatchObject({ state: "unconfirmed", reason: "duplicate_uncertain" });
    expect(f).toHaveBeenCalledTimes(1);                                 // still exactly one provider attempt, ever
    expect(await rowCount(db, hash)).toBe(1);                           // and exactly one row
    // the uncertain row is LIVE in the pending listing, not filtered out as unknown
    const shown: any = await listGrants(ctx(), SCOPE);
    expect((shown.result.pending_invitations as any[]).map((i) => i.id)).toContain(first.result.invitation_id);
  }, 30_000);

  it("two concurrent invites inside the uncertain window produce one row and one invitation id", async () => {
    const email = "uncertain.concurrent@real-domain.dev";
    const { db, ctx, advance, hash } = await bed("DB6", email);
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
    const first: any = await invite(ctx(), { ...SCOPE, email, role: "viewer" });
    expect(first.result.status).toBe("unconfirmed");
    advance(31_000);
    const pair: any[] = await Promise.all([invite(ctx(), { ...SCOPE, email, role: "viewer" }), invite(ctx(), { ...SCOPE, email, role: "viewer" })]);
    expect(new Set(pair.map((r) => r.result.invitation_id))).toEqual(new Set([first.result.invitation_id]));
    expect(pair.every((r) => r.result.delivery.reason === "duplicate_uncertain")).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(await rowCount(db, hash)).toBe(1);
  }, 30_000);

  it("revoke is the way out: revoking the uncertain invitation lets a fresh one be created with exactly one new provider attempt", async () => {
    const email = "uncertain.retry@real-domain.dev";
    const { db, ctx, advance, hash } = await bed("DB7", email);
    const f = vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" }));
    const first: any = await invite(ctx(), { ...SCOPE, email, role: "viewer" });
    expect(first.result.status).toBe("unconfirmed");
    await revoke_invitation(ctx(), { id: first.result.invitation_id });  // explicit human decision
    expect((await statusOf(db, first.result.invitation_id)).status).toBe("revoked");
    advance(31_000);
    f.mockReset(); f.mockResolvedValue(new Response(JSON.stringify({ id: "re_retry" }), { status: 200 }) as any);
    const second: any = await invite(ctx(), { ...SCOPE, email, role: "viewer" });
    expect(second.result.invitation_id).not.toBe(first.result.invitation_id);
    expect(second.result.status).toBe("sent");
    expect(second.result.delivery).toMatchObject({ state: "accepted" });
    expect(f).toHaveBeenCalledTimes(1);                                  // one fresh attempt with a fresh idempotency key
    expect(String((f.mock.calls[0] as any)[1].headers["idempotency-key"])).toBe(`invite/${second.result.invitation_id}`);
    expect(await rowCount(db, hash)).toBe(2);
  }, 30_000);

  it("accept works on an 'unconfirmed' invitation: the mail may have arrived, and the token proves it did", async () => {
    const email = "uncertain.accepted@real-domain.dev";
    const { db, ctx, asRecipient } = await bed("DB8", email);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const r: any = await invite(ctx(), { ...SCOPE, email, role: "viewer" });
    expect(r.result.status).toBe("unconfirmed");
    const acc = await accept(await asRecipient(), { token: r.result.dev_only_link_token });
    expect(acc.result).toMatchObject({ granted: true, role: "viewer" });
    const row = await statusOf(db, r.result.invitation_id);
    expect(row.status).toBe("accepted"); expect(row.accepted_at).toBeTruthy();
  }, 30_000);
});

// A row can also VANISH while the send is in flight: cap.workspace.delete (src/handlers/workspace.ts:86) and
// cap.project.delete (src/handlers/project.ts:60) hard-delete the scope's invitation rows. Before this AMEND the re-read
// fell back to the literal 'pending', reporting a live invitation that no longer existed. It is now reported as 'deleted',
// and the provider's own outcome is still reported separately — the caller must learn BOTH facts (AMEND 53c5717098103).
describe("cap.grant.invite — a scope deleted during the send is reported as 'deleted', never as 'pending' (AMEND 53c5717098103)", () => {
  const WS = { scope: "workspace", id: "ws_empty_race" };
  /** An EMPTY workspace (phase 0 deletes only those) owned by person_mara, on a fresh db. */
  async function wsBed(binding: "DB12" | "DB13", email: string) {
    const b = await bed(binding, email);
    await b.db.batch([
      b.db.prepare("INSERT INTO workspace (id,name,created_at,created_by) VALUES (?,?,?,?)").bind(WS.id, "Empty Workshop", "2026-09-17T12:00:00.000Z", "person_mara"),
      b.db.prepare('INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES (?,?,?,?,?,?)').bind("grant_mara_ws_empty", "person_mara", "workspace", WS.id, "owner", "2026-09-17T12:00:00.000Z"),
    ]);
    return b;
  }

  it("a provider ACCEPTANCE after a concurrent cap.workspace.delete reports status 'deleted' with delivery.state 'accepted': no row survives and the token is dead", async () => {
    const email = "race.wsdelete.accept@real-domain.dev";
    const { db, ctx, asRecipient } = await wsBed("DB12", email);
    const { entered, release } = parkedFetch();
    const call = invite(ctx(), { ...WS, email, role: "viewer" });
    const init = await entered;                       // the row is written and 'pending'; the send is parked
    const id = idOf(init), token = tokenOf(init);
    expect((await statusOf(db, id)).status).toBe("pending");
    const dl: any = await deleteWorkspace(ctx(), { id: WS.id });  // the owner deletes the SCOPE during the send
    expect(dl.result).toMatchObject({ deleted: true, id: WS.id });
    release(new Response(JSON.stringify({ id: "re_race_del_1" }), { status: 200 })); // …and only now the provider says 2xx
    const r: any = await call;
    expect(await db.prepare("SELECT id FROM invitation WHERE id = ?").bind(id).first()).toBeNull(); // hard-deleted with the scope
    expect(r.result.status).toBe("deleted");                       // NOT the old literal 'pending'
    expect(r.result.delivered).toBe(true);                         // the provider outcome is reported unchanged
    expect(r.result.delivery).toMatchObject({ state: "accepted", provider: "resend" });
    expect(String(r.result.note)).toMatch(/scope was removed while the message was being sent/);
    await expect(accept(await asRecipient(), { token })).rejects.toMatchObject({ code: "NOT_FOUND_OR_NOT_VISIBLE" });
  }, 30_000);

  it("a provider REFUSAL after the same concurrent cap.workspace.delete also reports 'deleted', with delivery.state 'refused' and its provider_status", async () => {
    const email = "race.wsdelete.refuse@real-domain.dev";
    const { db, ctx } = await wsBed("DB13", email);
    const { entered, release } = parkedFetch();
    const call = invite(ctx(), { ...WS, email, role: "viewer" });
    const init = await entered;
    const id = idOf(init);
    const dl: any = await deleteWorkspace(ctx(), { id: WS.id });
    expect(dl.result).toMatchObject({ deleted: true, id: WS.id });
    release(new Response(JSON.stringify({ message: "domain not verified" }), { status: 422 }));
    const r: any = await call;
    expect(await db.prepare("SELECT id FROM invitation WHERE id = ?").bind(id).first()).toBeNull();
    expect(r.result.status).toBe("deleted");                       // a no-transition outcome maps a missing row the same way
    expect(r.result.delivered).toBe(false);
    expect(r.result.delivery).toMatchObject({ state: "refused", provider: "resend", provider_status: 422 });
    expect(String(r.result.note)).toMatch(/no longer exists/);
  }, 30_000);
});
