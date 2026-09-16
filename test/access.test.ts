import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAccessJwt, resetAccessKeyCache } from "../src/access";

const b64u = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function signed(payload: Record<string, unknown>, kid = "k1") {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const head = b64u(JSON.stringify({ alg: "RS256", kid }));
  const body = b64u(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return { jwt: `${head}.${body}.${b64u(sig)}`, jwks: { keys: [{ kid, kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256" }] } };
}
const env: any = { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud-1" };
afterEach(() => { vi.restoreAllMocks(); resetAccessKeyCache(); });

describe("Cloudflare Access assertion verification (OF-7 email-code sign-in)", () => {
  it("accepts a valid assertion for this app and yields the email", async () => {
    const { jwt, jwks } = await signed({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) + 60, email: "Owner@Example.invalid", sub: "s1" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(jwks)));
    const id = await verifyAccessJwt(env, jwt);
    expect(id.email).toBe("owner@example.invalid");
  });
  it("refuses another app's audience, a bad signature, an expired token, and a missing token", async () => {
    const good = await signed({ iss: "https://team.cloudflareaccess.com", aud: ["aud-2"], exp: Math.floor(Date.now() / 1000) + 60, email: "x@example.invalid" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(good.jwks)));
    await expect(verifyAccessJwt(env, good.jwt)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    const tampered = good.jwt.slice(0, -4) + "AAAA";
    await expect(verifyAccessJwt(env, tampered)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    await expect(verifyAccessJwt(env, undefined)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED" });
    await expect(verifyAccessJwt({ ...env, ACCESS_AUD: undefined }, good.jwt)).rejects.toMatchObject({ code: "RESERVED_NOT_BUILT" });
  });
  it("refuses an expired assertion", async () => {
    const { jwt, jwks } = await signed({ iss: "https://team.cloudflareaccess.com", aud: ["aud-1"], exp: Math.floor(Date.now() / 1000) - 5, email: "x@example.invalid" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(jwks)));
    await expect(verifyAccessJwt(env, jwt)).rejects.toMatchObject({ code: "NOT_AUTHENTICATED", message: "assertion expired" });
  });
});
