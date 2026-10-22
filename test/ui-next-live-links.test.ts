// UI Next live link cache (app/data.js linkFor / clearLinks): the participant link credential never crosses an authentication
// transition — not from the cache (SECURITY-575-8583e170 finding 1) and not from a request that was in flight when the
// transition happened (root + independent read 2026-10-22 at 87f5bb2e: an issueLink resolving after clearLinks must neither
// repopulate the cache nor return its token to the next identity).
import { afterEach, describe, expect, it } from "vitest";
import { linkFor, clearLinks } from "../ui-next/src/app/data.js";

const AID = "assess_1", SID = "survey_1", URL = `/v2/assessments/${AID}/surveys/${SID}/links`;
const json = (o: unknown) => new Response(JSON.stringify({ ok: true, result: o }), { status: 200, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; clearLinks(); });

describe("linkFor across an authentication transition", () => {
  it("an issueLink in flight when clearLinks runs is cut off: no token returned, nothing cached; the next identity issues its own", async () => {
    let releaseExecute: (r: Response) => void = () => {};
    const executes: string[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.mode === "dry_run") return json({ confirm_token: "ct", impact: {} });
      executes.push(body.confirm_token);
      if (executes.length === 1) return new Promise<Response>((r) => { releaseExecute = r; }); // the first execute hangs until released
      return json({ link_token: "link_SECOND", entry_fragment: "#survey=link_SECOND", expires_at: "2026-12-01T00:00:00Z" });
    }) as typeof fetch;

    const first = linkFor(AID, SID); // identity A starts issuing
    await new Promise((r) => setTimeout(r, 0));
    clearLinks(); // A signs out, B signs in (Live: onSignedIn / signOut both clear)
    releaseExecute(json({ link_token: "link_FIRST", entry_fragment: "#survey=link_FIRST", expires_at: "2026-12-01T00:00:00Z" }));
    await expect(first).rejects.toThrow(/sign-in changed/);

    const second = await linkFor(AID, SID); // B's own request: a fresh issue, never A's credential
    expect(second.token).toBe("link_SECOND");
    expect(executes).toHaveLength(2);
    expect((await linkFor(AID, SID)).token).toBe("link_SECOND"); // and B's link is what the cache now holds
  });

  it("without a transition the issued link is cached for the same identity and survey", async () => {
    let n = 0;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.mode === "dry_run") return json({ confirm_token: "ct" });
      n++; return json({ link_token: `link_${n}`, entry_fragment: `#survey=link_${n}`, expires_at: "2026-12-01T00:00:00Z" });
    }) as typeof fetch;
    expect((await linkFor(AID, SID)).token).toBe("link_1");
    expect((await linkFor(AID, SID)).token).toBe("link_1");
    expect(n).toBe(1);
  });
});
