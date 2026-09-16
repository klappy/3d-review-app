import { describe, expect, it } from "vitest";
import { resolvePrincipal } from "../src/auth";
import { sha256 } from "../src/handlers/types";
import type { Env } from "../src/handlers/types";

function envFor(token: string, expiresAt: string, revokedAt: string | null = null): Env {
  return {
    SESSION_SECRET: "test-only-secret",
    DB: {
      prepare(sql: string) {
        return {
          bind(hash: string) {
            return {
              async first() {
                if (hash !== token) throw new Error("test passed raw token rather than digest");
                if (sql.includes("FROM session s")) return null;
                if (sql.includes("FROM participant_session")) return {
                  respondent_id: "respondent_fixture", assessment_survey_id: "survey_fixture",
                  expires_at: expiresAt, revoked_at: revokedAt,
                };
                throw new Error(`unexpected query: ${sql}`);
              },
            };
          },
        };
      },
    } as unknown as D1Database,
  };
}

describe("participant token isolation", () => {
  it("resolves a live bearer from participant_session at one survey", async () => {
    const token = "pt_synthetic";
    const principal = await resolvePrincipal(
      new Request("https://local.test/v2/participate/form", { headers: { Authorization: `Bearer ${token}` } }),
      envFor(await sha256(token), "2099-01-01T00:00:00.000Z"),
    );
    expect(principal).toMatchObject({ kind: "participant", id: "respondent_fixture", respondentId: "respondent_fixture", participantSurveyId: "survey_fixture" });
  });

  it("rejects revoked, expired, and cookie-only participant tokens", async () => {
    const token = "pt_synthetic", digest = await sha256(token);
    const bearer = new Request("https://local.test/v2/participate/form", { headers: { Authorization: `Bearer ${token}` } });
    expect((await resolvePrincipal(bearer, envFor(digest, "2000-01-01T00:00:00.000Z"))).kind).toBe("anonymous");
    expect((await resolvePrincipal(bearer, envFor(digest, "2099-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"))).kind).toBe("anonymous");
    expect((await resolvePrincipal(new Request("https://local.test/v2/participate/form", { headers: { Cookie: `session=${token}` } }), envFor(digest, "2099-01-01T00:00:00.000Z"))).kind).toBe("anonymous");
  });
});
