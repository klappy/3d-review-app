// UI Next live invitations (app/data.js inviteWithConfirm): cap.grant.invite is a danger twin — the dry run is previewed, the person
// confirms recipient/role/scope, and only then is execute sent with the preview's token (ui/assess/permissions.js two steps;
// workspace-permissions TICKET DoD 2). Cancel sends nothing.
import { afterEach, describe, expect, it } from "vitest";
import { inviteWithConfirm } from "../ui-next/src/app/data.js";

const SCOPE = { type: "assessment", id: "assess_1" };
const json = (o: unknown) => new Response(JSON.stringify({ ok: true, result: o }), { status: 200, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const serve = () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)); calls.push({ url, body });
    if (body.mode === "dry_run") return json({ confirm_token: "ct_1", impact: { affected: [{ will_see: "assessment contents at role member" }], irreversible: true } });
    return json({ invitation: { id: "inv_1", status: "sent" } });
  }) as typeof fetch;
  return calls;
};

describe("inviteWithConfirm", () => {
  it("cancel: the dry run is the only request; nothing is sent", async () => {
    const calls = serve(); const shown: string[] = [];
    const out = await inviteWithConfirm(SCOPE, { email: "a@example.org", role: "member" }, (t) => { shown.push(t); return false; });
    expect(out).toEqual({ sent: false });
    expect(calls.map((c) => c.body.mode)).toEqual(["dry_run"]);
    expect(calls[0].url).toBe("/v2/assessment/assess_1/invitations");
    expect(shown[0]).toMatch(/a@example.org .* member/); expect(shown[0]).toMatch(/cannot be undone/);
  });
  it("confirm: execute follows with the preview's token, recipient and role", async () => {
    const calls = serve();
    const out = await inviteWithConfirm(SCOPE, { email: "a@example.org", role: "member" }, () => true);
    expect(out.sent).toBe(true);
    expect(calls.map((c) => c.body.mode)).toEqual(["dry_run", "execute"]);
    expect(calls[1].body).toMatchObject({ email: "a@example.org", role: "member", confirm_token: "ct_1" });
  });
  it("a held preview never asks and never executes", async () => {
    globalThis.fetch = (async () => json({ status: "held", reason: "policy" })) as typeof fetch;
    let asked = false;
    await expect(inviteWithConfirm(SCOPE, { email: "a@example.org", role: "member" }, () => { asked = true; return true; })).rejects.toThrow(/held/);
    expect(asked).toBe(false);
  });
});
