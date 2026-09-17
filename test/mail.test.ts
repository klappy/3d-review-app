// OF-3 sender adapter: honest by construction. The provider is stubbed at fetch; no network, no real address.
import { afterEach, describe, expect, it, vi } from "vitest";
import { invitationMessage, sendMail } from "../src/mail";

afterEach(() => vi.restoreAllMocks());
const prod: any = { ENVIRONMENT: "production", RESEND_API_KEY: "re_test_only", MAIL_FROM: "3D Review <no-reply@mail.test-sender.dev>", PUBLIC_ORIGIN: "https://3d-review.klappy.dev" };
const msg = { to: "person@real-domain.dev", subject: "s", text: "t", idempotencyKey: "invite/inv_1" };

describe("mail adapter", () => {
  it("never pretends: unconfigured, non-production and synthetic recipients are delivered:false with a reason and no network call", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    expect(await sendMail({ ...prod, RESEND_API_KEY: undefined }, msg)).toEqual({ delivered: false, reason: "not_configured" });
    expect(await sendMail({ ...prod, MAIL_FROM: undefined }, msg)).toEqual({ delivered: false, reason: "not_configured" });
    for (const ENVIRONMENT of ["dev", undefined, "staging"]) expect(await sendMail({ ...prod, ENVIRONMENT }, msg)).toEqual({ delivered: false, reason: "not_production" });
    for (const to of ["rina@example.invalid", "a@b.test", "x@example.com", "y@thing.example"]) expect(await sendMail(prod, { ...msg, to })).toEqual({ delivered: false, reason: "synthetic_recipient" });
    expect(f).not.toHaveBeenCalled();
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
    expect(m.link).toBe("https://3d-review.klappy.dev/?invite=il_abc%2F%2B");
    expect(m.text).toContain(m.link); expect(m.text).toContain("7 days"); expect(m.text).toContain("no password");
    expect(m.html).not.toMatch(/<img|<script/i);
  });
});
