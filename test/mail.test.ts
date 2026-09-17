// OF-3 sender adapter: honest by construction. The provider is stubbed at fetch; no network, no real address.
import { afterEach, describe, expect, it, vi } from "vitest";
import { invitationMessage, sendMail } from "../src/mail";

afterEach(() => vi.restoreAllMocks());
const prod: any = { ENVIRONMENT: "production", RESEND_API_KEY: "re_test_only", MAIL_FROM: "3D Review <no-reply@mail.test-sender.dev>", PUBLIC_ORIGIN: "https://3d-review.klappy.dev" };
const msg = { to: "person@real-domain.dev", subject: "s", text: "t", idempotencyKey: "invite/inv_1" };

describe("mail adapter", () => {
  it("never pretends: unconfigured, non-production and synthetic recipients are delivered:false with a reason and no network call", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "re_x" }), { status: 200 }));
    expect(await sendMail({ ...prod, RESEND_API_KEY: undefined }, msg)).toEqual({ delivered: false, reason: "not_configured" });
    expect(await sendMail({ ...prod, MAIL_FROM: undefined }, msg)).toEqual({ delivered: false, reason: "not_configured" });
    for (const ENVIRONMENT of ["dev", undefined, "staging"]) expect(await sendMail({ ...prod, ENVIRONMENT }, msg)).toEqual({ delivered: false, reason: "not_production" });
    for (const to of ["rina@example.invalid", "a@b.test", "x@example.com", "y@thing.example", " X@Example.COM ", "x@sub.example.com", "x@bar.example.org", "x@host.localhost"]) expect(await sendMail(prod, { ...msg, to }), to).toEqual({ delivered: false, reason: "synthetic_recipient" });
    // exactly one plain mailbox or nothing leaves (review #16-3)
    for (const to of ["Rina <rina@real-domain.dev>", "x@real-domain.dev.", "x@localhost", "a@x.dev, b@y.dev", "x@real-domain.dev\r\nBcc: y@evil.dev", "x y@real-domain.dev", "@real-domain.dev", "x@", "", ".lead@real-domain.dev", "a..b@real-domain.dev", "a@-bad-.dev", "o'brien@real-domain.dev"]) expect(await sendMail(prod, { ...msg, to }), JSON.stringify(to)).toEqual({ delivered: false, reason: "invalid_address" });
    for (const to of ["first.last+tag@sub.real-domain.dev", "USER@Real-Domain.DEV", "user@xn--e1afmkfd.xn--p1ai", "u_s-e%r@a-b.museum"]) expect((await sendMail({ ...prod, RESEND_API_KEY: undefined }, { ...msg, to })).reason, to).toBe("not_configured"); // accepted shapes
    expect(await sendMail(prod, { ...msg, to: "person@foo.contest" })).not.toEqual({ delivered: false, reason: "synthetic_recipient" }); // no false positive on a real TLD
    expect(f.mock.calls.filter(([u]) => !String(u).includes("resend")).length).toBe(f.mock.calls.length - f.mock.calls.filter(([u]) => String(u).includes("resend")).length);
    expect(f.mock.calls.filter(([u]) => String(u).includes("resend")).length).toBe(1); // only the .contest probe reached the provider stub
  });
  it("production + configured: one POST to Resend with the idempotency key; delivered only on provider acceptance", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "re_msg_1" }), { status: 200 }));
    expect(await sendMail(prod, msg)).toEqual({ delivered: true, provider: "resend", provider_message_id: "re_msg_1" });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as any)["idempotency-key"]).toBe("invite/inv_1");
    expect(JSON.parse(init.body as string)).toMatchObject({ from: prod.MAIL_FROM, to: ["person@real-domain.dev"] });
  });
  it("provider refusal or outage is reported, not thrown", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 422 }));
    expect(await sendMail(prod, msg)).toEqual({ delivered: false, provider: "resend", reason: "provider_error", provider_status: 422 });
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("boom"));
    expect(await sendMail(prod, msg)).toEqual({ delivered: false, provider: "resend", reason: "provider_unreachable" });
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
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "mailh", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "mailh-db" } }] }));
afterAll(() => mf.dispose());
describe("cap.grant.invite in production, provider stubbed", () => {
  it("a replayed confirm_token mails ONCE; the row is 'sent' only on acceptance; nothing identifying the invitee is persisted; the hourly cap holds", async () => {
    const db = await mf.getD1Database("DB");
    const stmts = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n").split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
    for (const m of ["0001_init.sql", "0002_code_escrow.sql", "0003_language_archive.sql", "0004_pinned_instruments.sql"]) await db.batch(stmts(`../migrations/${m}`));
    await db.batch(stmts("../seed/synthetic.sql"));
    const env: any = { DB: db, SESSION_SECRET: "synthetic-mail", ...prod };
    let n = 0; const ctx = () => ({ env, db, principal: { kind: "user", id: "person_mara", provisioned: true }, traceId: `tr_mail_${++n}`, now: () => new Date(), log: () => {} }) as any;
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "re_msg_9" }), { status: 200 }));
    const params = { scope: "assessment", id: "assess_tavo_collect", email: "Victim.Person@Real-Domain.dev", role: "viewer" };
    const dry: any = await execute(ctx(), "cap.grant.invite", params, { tool: "danger", mode: "dry_run" });
    const runs: any[] = []; for (let i = 0; i < 3; i++) runs.push(await execute(ctx(), "cap.grant.invite", params, { tool: "danger", mode: "execute", confirm_token: dry.result.confirm_token }));
    expect(f).toHaveBeenCalledTimes(1);
    expect(runs.map((r) => r.result.delivered)).toEqual([true, false, false]);
    expect(runs[1].result.delivery.reason).toBe("duplicate_recent"); expect(runs[1].result.invitation_id).toBe(runs[0].result.invitation_id);
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
    // provider refusal → row stays pending
    f.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const p2 = { ...params, email: "other.person@real-domain.dev" };
    const d2: any = await execute(ctx(), "cap.grant.invite", p2, { tool: "danger", mode: "dry_run" });
    const r2: any = await execute(ctx(), "cap.grant.invite", p2, { tool: "danger", mode: "execute", confirm_token: d2.result.confirm_token });
    expect(r2.result.status).toBe("pending"); expect(r2.result.delivery.reason).toBe("provider_error");
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
});
